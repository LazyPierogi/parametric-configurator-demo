/**
 * Render Cache for Canvas Curtain Renderer
 * Stores completed canvas renders as data URLs to avoid re-rendering identical parameters
 */

import type { RenderConfig } from './types';
import { serializeRenderParams, formatWallBox, formatSegmentBounds } from './key-utils';

interface CacheEntry {
  dataUrl: string;
  timestamp: number;
  hits: number;
}

const CACHE_MAX_SIZE = 20; // Keep last 20 unique renders
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

class RenderCache {
  private cache = new Map<string, CacheEntry>();
  private hitCount = 0;
  private missCount = 0;

  /**
   * Generate cache key from render parameters
   * Only includes parameters that affect visual output
   */
  private generateKey(config: RenderConfig): string {
    const {
      fabric,
      colorHex,
      pleatId,
      canvasWidth,
      canvasHeight,
      textureScale,
      pipeline,
      renderParams,
      wallBox,
      segmentBounds,
      backgroundSignature,
    } = config;

    const paramsKey = serializeRenderParams(renderParams);
    const normalizedScale = Math.round(textureScale * 100) / 100;
    const baseKeyParts = [
      `fabric:${fabric.sku}`,
      `color:${colorHex}`,
      `pleat:${pleatId}`,
      `size:${canvasWidth}x${canvasHeight}`,
      `scale:${normalizedScale}`,
      `pipeline:${pipeline}`,
      `params:${paramsKey || 'default'}`,
    ];

    const transmissionStrength = renderParams?.transmissionStrength ?? 0;
    if (transmissionStrength > 0.02) {
      baseKeyParts.push(
        `bg:${backgroundSignature || 'none'}`,
        `wall:${wallBox ? formatWallBox(wallBox) : 'none'}`,
        `seg:${segmentBounds ? formatSegmentBounds(segmentBounds) : 'none'}`
      );
    }

    return baseKeyParts.join('|');
  }

  /**
   * Get cached render if available
   */
  get(config: RenderConfig): string | null {
    const key = this.generateKey(config);
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check if entry is stale
    if (Date.now() - entry.timestamp > CACHE_MAX_AGE_MS) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    // Update hit count and timestamp
    entry.hits++;
    entry.timestamp = Date.now();
    this.hitCount++;

    return entry.dataUrl;
  }

  /**
   * Store render result in cache
   */
  set(config: RenderConfig, dataUrl: string): void {
    const key = this.generateKey(config);

    // Store new entry
    this.cache.set(key, {
      dataUrl,
      timestamp: Date.now(),
      hits: 0,
    });

    // Evict oldest entries if cache too large
    if (this.cache.size > CACHE_MAX_SIZE) {
      this.evictOldest();
    }
  }

  /**
   * Pre-warm cache with a render (used for pre-caching visible items)
   */
  preWarm(config: RenderConfig, dataUrl: string): void {
    const key = this.generateKey(config);
    
    // Don't overwrite existing entries
    if (this.cache.has(key)) return;
    
    this.set(config, dataUrl);
  }

  /**
   * Check if parameters are already cached
   */
  has(config: RenderConfig): boolean {
    const key = this.generateKey(config);
    const entry = this.cache.get(key);
    
    if (!entry) return false;
    
    // Check if stale
    if (Date.now() - entry.timestamp > CACHE_MAX_AGE_MS) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Evict least-recently-used entries
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    // Find oldest entry
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.hitCount + this.missCount;
    const hitRate = totalRequests > 0 ? (this.hitCount / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: CACHE_MAX_SIZE,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: hitRate.toFixed(1) + '%',
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key: key.substring(0, 50) + '...',
        hits: entry.hits,
        age: Math.round((Date.now() - entry.timestamp) / 1000) + 's',
      })),
    };
  }

  /**
   * Clear all cached renders
   */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }
}

// Singleton instance
export const renderCache = new RenderCache();
