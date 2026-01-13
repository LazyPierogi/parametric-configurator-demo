/**
 * Canvas Renderer Public API
 * Task 1010+ - Canvas-based curtain rendering system
 * 
 * Main entry point for the Configure page.
 * Orchestrates pipeline selection, asset loading, and rendering.
 */

export type { 
  RenderConfig, 
  RenderResult, 
  RenderPipeline, 
  MaterialToken,
  MaterialFamily,
  MaterialPreset,
  ArtistDebugParams 
} from './types';

export { 
  MATERIAL_PRESETS,
  getMaterialPreset,
  getMaterialToken,
  presetToToken,
  applyMaterialOverrides,
  applyDebugOverrides 
} from './material-presets';

export {
  preloadMaterialTexture,
  getCachedMaterialTexture,
  clearAssetCache,
  getCacheStats
} from './asset-loader';

export {
  relativeLuminance,
  isBrightColor
} from './color-utils';

export {
  renderCache
} from './render-cache';

export {
  clearBlurredWallBoxCache,
  getBlurredWallBox
} from './pipelines/artist';

import type { RenderConfig, RenderResult, RenderPipeline, MaterialFamily } from './types';
import { getMaterialToken, applyDebugOverrides } from './material-presets';
import { preloadMaterialTexture } from './asset-loader';
import { relativeLuminance } from './color-utils';
import { renderCache } from './render-cache';
import { renderArtistPipeline } from './pipelines/artist';
import type { ArtistTextureFamily } from './artist-textures';

const DEFAULT_CANONICAL_WIDTH = 1024;
const MIN_CANONICAL_WIDTH = 256;
const MAX_CANONICAL_WIDTH = 4096;

const CANVAS_CANONICAL_WIDTH = (() => {
  const raw = (process.env.NEXT_PUBLIC_CANVAS_TEXTURE_CANONICAL_PX ?? '').trim();
  if (!raw) return DEFAULT_CANONICAL_WIDTH;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_CANONICAL_WIDTH;
  return Math.min(Math.max(Math.round(parsed), MIN_CANONICAL_WIDTH), MAX_CANONICAL_WIDTH);
})();

export { CANVAS_CANONICAL_WIDTH };

export function getCanonicalCanvasWidth(
  pipeline: RenderPipeline,
  targetWidth: number,
  hasTransmission: boolean,
): number {
  if (hasTransmission) {
    return targetWidth;
  }
  if (pipeline === 'artist') {
    return CANVAS_CANONICAL_WIDTH;
  }
  // Fallback for future pipelines; current code only uses 'artist' here.
  return 600;
}

function resolveArtistContext(config: RenderConfig): { family: ArtistTextureFamily; variant?: number } | null {
  const { pleatId, fabric, renderParams } = config;
  const artistVariant = renderParams?.artistVariant;
  if (pleatId === 'wave') {
    const materialFamily = fabric.materialFamily;
    const family: ArtistTextureFamily = materialFamily === 'sheer' ? 'wave-sheer' : 'wave-drape';
    return { family, variant: artistVariant };
  }
  if (pleatId === 'flex') {
    return { family: 'flex', variant: artistVariant };
  }
  if (pleatId === 'doubleFlex') {
    return { family: 'double-flex', variant: artistVariant };
  }
  return null;
}

/**
 * Main render function with caching
 * Selects appropriate pipeline and renders curtain to canvas
 */
export async function renderCurtain(config: RenderConfig): Promise<RenderResult> {
  const startTime = performance.now();
  
  // Check cache first
  const cachedDataUrl = renderCache.get(config);
  if (cachedDataUrl) {
    try {
      if (config.debug) {
        const stats = renderCache.getStats();
        console.log(`[Canvas Renderer] Cache HIT (${stats.hitRate} hit rate)`, {
          pleat: config.pleatId,
          fabric: config.fabric.sku,
          color: config.colorHex,
        });
      }
      
      // Create canvas from cached data URL
      const canvas = document.createElement('canvas');
      canvas.width = config.canvasWidth;
      canvas.height = config.canvasHeight;
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) {
        throw new Error('Failed to get 2D context for cached render');
      }
      
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load cached render image'));
        img.src = cachedDataUrl;
      });
      if (typeof img.decode === 'function') {
        await img.decode();
      }
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        throw new Error('Cached render image has invalid intrinsic dimensions');
      }
      
      try {
        ctx.drawImage(img, 0, 0);
      } catch (error) {
        throw new Error(
          `Failed to draw cached render image: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      
      const renderTimeMs = performance.now() - startTime;
      const materialFamily = (config.fabric.materialFamily || 'linen') as MaterialFamily;
      const baseToken = getMaterialToken(materialFamily);
      const materialToken = config.debug 
        ? applyDebugOverrides(baseToken, config.debug as any)
        : baseToken;
      const luminance = relativeLuminance(config.colorHex);
      
      return {
        canvas,
        metrics: {
          renderTimeMs,
          materialToken,
          luminance,
          pipeline: config.pipeline,
        },
      };
    } catch (error) {
      if (config.debug) {
        console.warn('[Canvas Renderer] Cache HIT failed, falling back to re-render', error);
      }
    }
  }
  
  // Cache miss - render normally
  if (config.debug) {
    const stats = renderCache.getStats();
    console.log(`[Canvas Renderer] Cache MISS (${stats.hitRate} hit rate) - rendering...`);
  }
  
  // Ensure material texture is loaded
  const materialFamily = (config.fabric.materialFamily || 'linen') as MaterialFamily;
  await preloadMaterialTexture(materialFamily);
  
  // Get material token
  const baseToken = getMaterialToken(materialFamily);
  const materialToken = config.debug 
    ? applyDebugOverrides(baseToken, config.debug as any)
    : baseToken;
  
  // Render with artist pipeline
  let canvas: HTMLCanvasElement;
  const actualPipeline: RenderPipeline = config.pipeline;
  
  if (config.pipeline === 'off') {
    throw new Error('Pipeline "off" should be handled by CSS renderer');
  }
  
  const artistContext = resolveArtistContext(config);
  if (!artistContext) {
    throw new Error(
      `[Canvas Renderer] No artist texture family available for pleat "${config.pleatId}"`
    );
  }
  
  canvas = await renderArtistPipeline(config, materialToken, artistContext);
  
  const renderTimeMs = performance.now() - startTime;
  const luminance = relativeLuminance(config.colorHex);
  
  // Store in cache for future use
  const dataUrl = canvas.toDataURL('image/png');
  renderCache.set(config, dataUrl);
  
  if (config.debug) {
    const stats = renderCache.getStats();
    console.log(`[Canvas Renderer] Complete`, {
      requestedPipeline: config.pipeline,
      pipeline: actualPipeline,
      renderTimeMs: renderTimeMs.toFixed(2),
      pleat: config.pleatId,
      materialFamily: config.fabric.materialFamily,
      cacheStats: `${stats.size}/${stats.maxSize} entries, ${stats.hitRate} hit rate`,
    });
  }
  
  return {
    canvas,
    metrics: {
      renderTimeMs,
      materialToken,
      luminance,
      pipeline: actualPipeline,
    },
  };
}

/**
 * Utility: Check if canvas rendering should be used
 * Based on environment configuration
 */
export function shouldUseCanvasRenderer(pipeline?: string): boolean {
  return pipeline === 'artist';
}

/**
 * Utility: Get pipeline from environment variable
 */
export function getPipelineFromEnv(): RenderPipeline {
  const env = process.env.NEXT_PUBLIC_TEXTURES_PIPELINE || 'off';
  
  if (env === 'artist') return 'artist';
  if (env === 'off') return 'off';
  
  console.warn(`[Canvas Renderer] Invalid NEXT_PUBLIC_TEXTURES_PIPELINE="${env}", using "artist"`);
  return 'artist';
}
