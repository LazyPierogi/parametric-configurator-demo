/**
 * Pre-warming hook for curtain renders
 * Pre-renders visible color variants in idle time to make switching instant
 */

import { useEffect, useRef } from 'react';
import type { Fabric, ChildItem } from '@curtain-wizard/core/src/catalog';
import type { RenderConfig } from '@/lib/canvas-renderer';
import { renderCache, renderCurtain } from '@/lib/canvas-renderer';

type PreWarmConfig = {
  enabled: boolean;
  fabric: Fabric | null;
  childItems: ChildItem[];
  currentColor: string | null;
  renderConfig: Omit<RenderConfig, 'colorHex' | 'fabric'>;
  maxPreWarms?: number;
};

export function useRenderPreWarming(config: PreWarmConfig) {
  const { 
    enabled, 
    fabric, 
    childItems, 
    currentColor, 
    renderConfig,
    maxPreWarms = 5 
  } = config;
  
  const preWarmQueueRef = useRef<string[]>([]);
  const isPreWarmingRef = useRef(false);
  const abortRef = useRef(false);

  useEffect(() => {
    if (!enabled || !fabric || childItems.length === 0) return;

    // Build queue of colors to pre-warm (exclude current color)
    const colorsToWarm = childItems
      .map(item => item.color_label)
      .filter(color => color !== currentColor)
      .slice(0, maxPreWarms);

    preWarmQueueRef.current = colorsToWarm;
    abortRef.current = false;

    // Start pre-warming in idle time
    const preWarmNext = async () => {
      if (abortRef.current || isPreWarmingRef.current || preWarmQueueRef.current.length === 0) {
        return;
      }

      isPreWarmingRef.current = true;
      const colorToWarm = preWarmQueueRef.current.shift();

      if (!colorToWarm) {
        isPreWarmingRef.current = false;
        return;
      }

      try {
        const warmConfig: RenderConfig = {
          ...renderConfig,
          fabric,
          colorHex: colorToWarm,
          debug: false, // Don't log pre-warming
          backgroundSignature: 'none',
        };

        // Check if already cached
        if (renderCache.has(warmConfig)) {
          // Already cached, skip
          isPreWarmingRef.current = false;
          scheduleNextPreWarm();
          return;
        }

        // Render in background
        const result = await renderCurtain(warmConfig);
        
        // Don't need to do anything with result, it's already cached
        if (renderConfig.debug) {
          console.log(`[Pre-warming] Warmed color ${colorToWarm} for ${fabric.sku}`);
        }
      } catch (error) {
        console.warn(`[Pre-warming] Failed to warm color ${colorToWarm}:`, error);
      } finally {
        isPreWarmingRef.current = false;
        scheduleNextPreWarm();
      }
    };

    const scheduleNextPreWarm = () => {
      if (abortRef.current || preWarmQueueRef.current.length === 0) return;
      
      // Use requestIdleCallback if available, otherwise setTimeout
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => preWarmNext(), { timeout: 5000 });
      } else {
        setTimeout(preWarmNext, 100);
      }
    };

    // Start first pre-warm after a short delay
    const startTimeout = setTimeout(() => {
      scheduleNextPreWarm();
    }, 500);

    return () => {
      abortRef.current = true;
      clearTimeout(startTimeout);
      preWarmQueueRef.current = [];
    };
  }, [enabled, fabric, childItems, currentColor, renderConfig, maxPreWarms]);
}
