import { useEffect } from 'react';
import type { Fabric, ChildItem } from '@curtain-wizard/core/src/catalog';
import type { RenderPipeline, RenderConfig } from '@/lib/canvas-renderer';
import { getCanonicalCanvasWidth, renderCache, renderCurtain } from '@/lib/canvas-renderer';
import { useRenderPreWarming } from './useRenderPreWarming';
import type { CanvasRenderParams } from './useCurtainFirstCanvasRenderParams';

export function useCurtainFirstCanvasInitialPrewarm({
  USE_CANVAS_RENDERER,
  reducedData,
  selectedFabric,
  selectedChildItem,
  selectedPleatId,
  imgSize,
  phase,
  activeRenderPipeline,
  texScale,
  canvasRenderParams,
  DEBUG_UI_ENABLED,
}: {
  USE_CANVAS_RENDERER: boolean;
  reducedData: boolean;
  selectedFabric: Fabric | null;
  selectedChildItem: ChildItem | null;
  selectedPleatId: string | null;
  imgSize: { w: number; h: number };
  phase: string;
  activeRenderPipeline: RenderPipeline;
  texScale: number;
  canvasRenderParams: CanvasRenderParams;
  DEBUG_UI_ENABLED: boolean;
}) {
  useEffect(() => {
    if (!USE_CANVAS_RENDERER) return;
    if (reducedData) return;
    if (!selectedFabric || !selectedChildItem || !selectedPleatId) return;
    if (imgSize.w <= 0 || imgSize.h <= 0) return;
    if (phase === 'ready') return;

    const pipeline = activeRenderPipeline;
    const canvasWidth = getCanonicalCanvasWidth(pipeline, imgSize.w, false);
    const canvasHeight = imgSize.h;
    const textureScalePx = Math.max(20, texScale);

    const baseRenderParams = canvasRenderParams;
    const effectiveRenderParams = baseRenderParams
      ? {
          ...baseRenderParams,
          // Segments disable transmission; align cache key with CanvasCurtainLayer effective params.
          transmissionStrength: 0,
        }
      : undefined;

    const config: RenderConfig = {
      pipeline,
      fabric: selectedFabric,
      colorHex: selectedChildItem.color,
      pleatId: selectedPleatId,
      canvasWidth,
      canvasHeight,
      textureScale: textureScalePx,
      backgroundSignature: 'none',
      debug: DEBUG_UI_ENABLED,
      renderParams: effectiveRenderParams,
    };

    if (renderCache.has(config)) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await renderCurtain(config);
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Configure] Pre-warm artist renderer failed', error);
        }
      } finally {
        if (cancelled && process.env.NODE_ENV !== 'production') {
          // No-op: we currently have no abort path for renderCurtain, but keep flag for future use.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    USE_CANVAS_RENDERER,
    reducedData,
    selectedFabric,
    selectedChildItem,
    selectedPleatId,
    imgSize.w,
    imgSize.h,
    texScale,
    activeRenderPipeline,
    canvasRenderParams,
    phase,
    DEBUG_UI_ENABLED,
  ]);
}

export function useCurtainFirstCanvasVariantPrewarm({
  USE_CANVAS_RENDERER,
  selectedFabric,
  selectedChildItem,
  selectedPleatId,
  imgSize,
  activeRenderPipeline,
  texScale,
  canvasRenderParams,
  DEBUG_UI_ENABLED,
  getChildItems,
}: {
  USE_CANVAS_RENDERER: boolean;
  selectedFabric: Fabric | null;
  selectedChildItem: ChildItem | null;
  selectedPleatId: string | null;
  imgSize: { w: number; h: number };
  activeRenderPipeline: RenderPipeline;
  texScale: number;
  canvasRenderParams: CanvasRenderParams;
  DEBUG_UI_ENABLED: boolean;
  getChildItems: (fabric: Fabric) => ChildItem[];
}) {
  useRenderPreWarming({
    enabled: USE_CANVAS_RENDERER && !!selectedFabric && !!selectedChildItem && imgSize.w > 0,
    fabric: selectedFabric,
    childItems: selectedFabric ? getChildItems(selectedFabric) : [],
    currentColor: selectedChildItem?.color_label || null,
    renderConfig: {
      pleatId: selectedPleatId || 'wave',
      canvasWidth: Math.round(imgSize.w * 0.5), // Pre-warm at typical segment width
      canvasHeight: imgSize.h,
      textureScale: Math.max(20, texScale),
      pipeline: activeRenderPipeline,
      debug: DEBUG_UI_ENABLED, // Optional logs when configure debug UI is enabled
      renderParams: canvasRenderParams,
    },
    maxPreWarms: 5, // Pre-warm up to 5 adjacent colors
  });
}
