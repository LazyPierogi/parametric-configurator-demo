import type { RenderConfig, MaterialToken, MaterialFamily } from '../types';
import { relativeLuminance, clamp } from '../color-utils';
import {
  blend,
  type BlendMode,
  sampleTexture,
  createOffscreenCanvas,
  fillCanvas,
  extractROI,
  applyBlur,
} from '../compositor';
import {
  getCachedArtistAsset,
  getCachedMaterialTexture,
  preloadArtistTextures,
} from '../asset-loader';
import type { ArtistTextureFamily, ArtistTextureMap } from '../artist-textures';
import { clampVariant, getArtistTextureSpec } from '../artist-textures';

type ArtistPipelineOptions = {
  family: ArtistTextureFamily;
  variant?: number;
};

type ArtistMaps = {
  pleatRamp: ImageData | null;
  occlusion: ImageData | null;
  translucency: ImageData | null;
  normal: ImageData | null;
  depth?: ImageData | null;
};

const DEFAULT_LIGHT_DIRECTION: [number, number, number] = [0.35, 0.5, 0.78];

function normalize(vec: [number, number, number]): [number, number, number] {
  const [x, y, z] = vec;
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

const NORMALIZED_LIGHT = normalize(DEFAULT_LIGHT_DIRECTION);

const scaledArtistMapCache = new Map<string, ImageData>();

// Cache for blurred Wall Box backgrounds (key: backgroundImageId + wallBoxHash)
const blurredWallBoxCache = new Map<string, HTMLCanvasElement>();

function isUsableHtmlImage(img: HTMLImageElement): boolean {
  return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
}

function getRenderedImageSize(backgroundImage: HTMLImageElement | HTMLCanvasElement): { w: number; h: number } {
  if (backgroundImage instanceof HTMLImageElement) {
    if (!isUsableHtmlImage(backgroundImage)) {
      return { w: 0, h: 0 };
    }
    const w =
      backgroundImage.naturalWidth ||
      backgroundImage.width ||
      0;
    const h =
      backgroundImage.naturalHeight ||
      backgroundImage.height ||
      0;
    return { w, h };
  }
  return { w: backgroundImage.width || 0, h: backgroundImage.height || 0 };
}

function pseudoRandom2D(x: number, y: number, seed: number): number {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >>> 13)) >>> 0;
  h = (h * 1274126177) >>> 0;
  h ^= h >>> 16;
  return (h & 0xffffffff) / 0xffffffff;
}

function getScaledArtistMap(
  family: ArtistTextureFamily,
  map: ArtistTextureMap,
  variant: number,
  source: ImageData | null,
  width: number,
  height: number
): ImageData | null {
  if (!source) return null;
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const cacheKey = `${family}#${variant}#${map}#${safeWidth}x${safeHeight}`;
  const cached = scaledArtistMapCache.get(cacheKey);
  if (cached) return cached;
  if (source.width === safeWidth && source.height === safeHeight) {
    scaledArtistMapCache.set(cacheKey, source);
    return source;
  }
  const scaled = scaleImageData(source, safeWidth, safeHeight);
  if (scaled) {
    scaledArtistMapCache.set(cacheKey, scaled);
    return scaled;
  }
  return null;
}

function getArtistMaps(family: ArtistTextureFamily, variant = 1): ArtistMaps {
  return {
    pleatRamp: getCachedArtistAsset(family, 'pleatRamp', variant),
    occlusion: getCachedArtistAsset(family, 'occlusion', variant),
    translucency: getCachedArtistAsset(family, 'translucency', variant),
    normal: getCachedArtistAsset(family, 'normal', variant),
    depth: getCachedArtistAsset(family, 'depth', variant),
  };
}

function getWallBoxCacheKey(
  backgroundImage: HTMLImageElement | HTMLCanvasElement,
  wallBox: NonNullable<RenderConfig['wallBox']>
): string {
  // Use rendered image dimensions and position for cache key
  const { w, h } = getRenderedImageSize(backgroundImage);
  const imageId = `${w}x${h}`;
  const wallBoxKey = `${wallBox.x},${wallBox.y},${wallBox.width}x${wallBox.height}`;
  return `${imageId}|${wallBoxKey}`;
}

export function getBlurredWallBox(
  backgroundImage: HTMLImageElement | HTMLCanvasElement,
  wallBox: NonNullable<RenderConfig['wallBox']>
): HTMLCanvasElement | null {
  const { w: renderW, h: renderH } = getRenderedImageSize(backgroundImage);
  if (!Number.isFinite(renderW) || !Number.isFinite(renderH) || renderW <= 0 || renderH <= 0) {
    return null;
  }

  const cacheKey = getWallBoxCacheKey(backgroundImage, wallBox);
  const cached = blurredWallBoxCache.get(cacheKey);
  if (cached) return cached;

  // Convert HTMLImageElement to canvas if needed
  let sourceCanvas: HTMLCanvasElement;
  if (backgroundImage instanceof HTMLImageElement) {
    if (!isUsableHtmlImage(backgroundImage)) {
      return null;
    }
    sourceCanvas = createOffscreenCanvas(renderW, renderH);
    const ctx = sourceCanvas.getContext('2d')!;
    try {
      ctx.drawImage(backgroundImage, 0, 0, renderW, renderH);
    } catch {
      return null;
    }
  } else {
    sourceCanvas = backgroundImage;
  }

  // Extract and blur entire Wall Box (once!)
  const roiCanvas = extractROI(sourceCanvas, wallBox.x, wallBox.y, wallBox.width, wallBox.height);
  const blurred = applyBlur(roiCanvas, 6);
  
  // Cache the result
  blurredWallBoxCache.set(cacheKey, blurred);
  return blurred;
}

/**
 * Clear blurred Wall Box cache (call when background image changes)
 */
export function clearBlurredWallBoxCache(): void {
  blurredWallBoxCache.clear();
}

function prepareBackground(
  backgroundImage: HTMLImageElement | HTMLCanvasElement | undefined,
  wallBox: RenderConfig['wallBox'],
  segmentBounds: RenderConfig['segmentBounds'],
  width: number,
  height: number
): ImageData | null {
  if (!backgroundImage || !wallBox) return null;

  // Get cached blurred Wall Box (blur applied only once!)
  const blurredWallBox = getBlurredWallBox(backgroundImage, wallBox);
  if (!blurredWallBox) return null;
  
  // If segmentBounds provided, extract only the segment's portion
  let sourceCanvas: HTMLCanvasElement;
  if (segmentBounds) {
    // Extract segment slice from cached blurred Wall Box
    sourceCanvas = extractROI(
      blurredWallBox,
      segmentBounds.xInWallBox,
      0,
      segmentBounds.width,
      wallBox.height
    );
  } else {
    // Legacy fallback: use entire Wall Box (will be tiled)
    sourceCanvas = blurredWallBox;
  }
  
  // Scale to target canvas dimensions
  const bgCanvas = createOffscreenCanvas(width, height);
  const bgCtx = bgCanvas.getContext('2d')!;
  bgCtx.drawImage(sourceCanvas, 0, 0, width, height);
  return bgCtx.getImageData(0, 0, width, height);
}

function scaleImageData(source: ImageData | null, width: number, height: number): ImageData | null {
  if (!source) return null;
  if (source.width === width && source.height === height) return source;

  const canvas = createOffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  const temp = createOffscreenCanvas(source.width, source.height);
  temp.getContext('2d')!.putImageData(source, 0, 0);
  ctx.drawImage(temp, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function encodeNormal(px: number, py: number, pz: number): [number, number, number] {
  const nx = px / 255 * 2 - 1;
  const ny = py / 255 * 2 - 1;
  const nz = pz / 255 * 2 - 1;
  const length = Math.hypot(nx, ny, nz) || 1;
  return [nx / length, ny / length, nz / length];
}

function applySpecular(
  r: number,
  g: number,
  b: number,
  specStrength: number,
  normal: [number, number, number]
): [number, number, number] {
  if (specStrength <= 0) return [r, g, b];
  const dot = Math.max(0, normal[0] * NORMALIZED_LIGHT[0] + normal[1] * NORMALIZED_LIGHT[1] + normal[2] * NORMALIZED_LIGHT[2]);
  const highlight = Math.pow(dot, 12) * specStrength;
  const resultR = clamp(r + highlight, 0, 1);
  const resultG = clamp(g + highlight, 0, 1);
  const resultB = clamp(b + highlight, 0, 1);
  return [resultR, resultG, resultB];
}

export async function renderArtistPipeline(
  config: RenderConfig,
  materialToken: MaterialToken,
  options: ArtistPipelineOptions
): Promise<HTMLCanvasElement> {
  const variant = clampVariant(options.family, options.variant ?? config.renderParams?.artistVariant ?? 1);

  await preloadArtistTextures(options.family, variant);
  const maps = getArtistMaps(options.family, variant);

  if (!maps.pleatRamp && !maps.occlusion) {
    throw new Error(`[Artist Pipeline] Missing core maps for family "${options.family}"`);
  }

  const baseMap = maps.pleatRamp ?? maps.occlusion ?? maps.translucency ?? maps.normal;
  const baseWidth = baseMap?.width ?? Math.max(64, config.canvasWidth);
  const baseHeight = baseMap?.height ?? Math.max(64, config.canvasHeight);
  const targetCanvasHeight = config.canvasHeight || baseHeight;
  const width = Math.max(64, Math.min(config.canvasWidth || baseWidth, baseWidth));
  const height = Math.max(128, Math.min(targetCanvasHeight, baseHeight));

  const canvas = createOffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  fillCanvas(canvas, config.colorHex);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const rampData = getScaledArtistMap(options.family, 'pleatRamp', variant, maps.pleatRamp, width, height)?.data ?? null;
  const occlusionData = getScaledArtistMap(options.family, 'occlusion', variant, maps.occlusion, width, height)?.data ?? null;
  const translucencyImage = getScaledArtistMap(options.family, 'translucency', variant, maps.translucency, width, height);
  const translucencyData = translucencyImage?.data ?? null;
  const normalData = getScaledArtistMap(options.family, 'normal', variant, maps.normal, width, height)?.data ?? null;
  const depthData = getScaledArtistMap(options.family, 'depth', variant, maps.depth ?? null, width, height)?.data ?? null;

  const transmissionRequested =
    translucencyData &&
    (config.renderParams?.transmissionStrength ?? materialToken.transmission) > 0.02;
  const backgroundData =
    transmissionRequested && config.backgroundImage && config.wallBox
      ? prepareBackground(config.backgroundImage, config.wallBox, config.segmentBounds, width, height)
      : null;
  const backgroundPixels = backgroundData?.data ?? null;

  const renderParams = {
    shadowStrength: clamp(config.renderParams?.shadowStrength ?? 1, 0, 2),
    occlusionStrength: clamp(config.renderParams?.occlusionStrength ?? 1, 0, 2),
    weaveStrength: clamp(config.renderParams?.weaveStrength ?? materialToken.weaveStrength, 0, 2),
    transmissionStrength: clamp(
      config.renderParams?.transmissionStrength ?? materialToken.transmission,
      0,
      1
    ),
    specularStrength: clamp(
      config.renderParams?.specularStrength ?? materialToken.specBoost,
      0,
      2
    ),
    // Material Presets - Procedural Pipeline
    opacity: config.renderParams?.opacity ?? 1.0,
    noiseStrength: config.renderParams?.noiseStrength ?? 0.05,
    textureAsset: config.renderParams?.textureAsset ?? 'sheer-weave',
    // Material Presets - Artist Pipeline
    highlightClamp: config.renderParams?.highlightClamp ?? 1.0,
    weaveScale: config.renderParams?.weaveScale ?? 1.2,
    weaveBlendMode: (config.renderParams?.weaveBlendMode === 'overlay' ? 'overlay' : 'multiply') as BlendMode,
    // Color Presets
    contrastBoost: config.renderParams?.contrastBoost ?? 0.0,
    // Pleating Presets
    tileWidthPx: config.renderParams?.tileWidthPx ?? 220,
    // Pleating Presets (Depth / Height Map influence)
    heightStrength: clamp(config.renderParams?.heightStrength ?? 0.4, 0, 1),
  };

  const noiseSeed = ((Math.floor(variant) || 1) * 9973) >>> 0;

  const materialTextureBase = getCachedMaterialTexture(
    (config.fabric.materialFamily || 'linen') as MaterialFamily
  );
  // Use original texture size - no upscaling to save memory and preserve quality
  const materialTextureImage = materialTextureBase;
  const materialTextureData = materialTextureImage?.data ?? null;
  const materialTextureWidth = materialTextureImage?.width ?? 512; // fallback for missing texture
  const materialTextureHeight = materialTextureImage?.height ?? 512;

  const spec = getArtistTextureSpec(options.family);
  const luminance = relativeLuminance(config.colorHex);
  const applyRamp = rampData && renderParams.shadowStrength > 0.001;
  const applyOcclusion = occlusionData && renderParams.occlusionStrength > 0.001;
  const applyWeave = materialTextureImage && materialTextureData && renderParams.weaveStrength > 0.001;
  const applySpecularHighlights = normalData && renderParams.specularStrength > 0.02;
  const applyTransmission = backgroundPixels && translucencyData && renderParams.transmissionStrength > 0.02;
  const applyHeightShading = depthData && renderParams.heightStrength > 0.001;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] / 255;
    let g = data[i + 1] / 255;
    let b = data[i + 2] / 255;

    if (applyRamp) {
      const rampValue = rampData[i] / 255;
      r = blend(r, rampValue, 'soft-light', materialToken.shadowGain * renderParams.shadowStrength);
      g = blend(g, rampValue, 'soft-light', materialToken.shadowGain * renderParams.shadowStrength);
      b = blend(b, rampValue, 'soft-light', materialToken.shadowGain * renderParams.shadowStrength);
    }

    // Apply contrast boost (for color presets)
    if (renderParams.contrastBoost > 0.001) {
      const contrast = 1.0 + renderParams.contrastBoost;
      r = ((r - 0.5) * contrast) + 0.5;
      g = ((g - 0.5) * contrast) + 0.5;
      b = ((b - 0.5) * contrast) + 0.5;
    }

    // Apply noise for natural fabric variation
    const idx = i / 4;
    const px = idx % width;
    const py = Math.floor(idx / width);

    if (renderParams.noiseStrength > 0.001) {
      const noise = (pseudoRandom2D(px, py, noiseSeed) - 0.5) * renderParams.noiseStrength * 2;
      r = clamp(r + noise, 0, 1);
      g = clamp(g + noise, 0, 1);
      b = clamp(b + noise, 0, 1);
    }

    if (applyOcclusion) {
      const aoValue = occlusionData[i] / 255;
      const aoFactor = 1.0 - (1.0 - aoValue) * renderParams.occlusionStrength;
      r = clamp(r * aoFactor, 0, 1);
      g = clamp(g * aoFactor, 0, 1);
      b = clamp(b * aoFactor, 0, 1);
    }

    // Optional height/relief shading (from depth/height map)
    // Interprets darker areas (lower height) as deeper folds → darker result
    if (applyHeightShading) {
      const depthValue = depthData![i] / 255; // 0 = low, 1 = high
      const darken = (1.0 - depthValue) * renderParams.heightStrength; // stronger darkening in low regions
      const factor = clamp(1.0 - darken, 0, 1);
      r = r * factor;
      g = g * factor;
      b = b * factor;
    }

    if (applyWeave) {
      const u = (px / materialTextureWidth) * renderParams.weaveScale;
      const v = (py / materialTextureHeight) * renderParams.weaveScale;
      const weaveValue = sampleTexture(
        materialTextureImage,
        u,
        v,
        'repeat'
      );
      r = blend(r, weaveValue, renderParams.weaveBlendMode, renderParams.weaveStrength);
      g = blend(g, weaveValue, renderParams.weaveBlendMode, renderParams.weaveStrength);
      b = blend(b, weaveValue, renderParams.weaveBlendMode, renderParams.weaveStrength);
    }

    if (applySpecularHighlights) {
      const normal = encodeNormal(normalData[i], normalData[i + 1], normalData[i + 2]);
      [r, g, b] = applySpecular(r, g, b, renderParams.specularStrength, normal);
    }

    if (applyTransmission) {
      const transmissionMask = translucencyData[i] / 255;
      const transmission = clamp(
        transmissionMask * renderParams.transmissionStrength,
        0,
        1
      );
      const bgR = backgroundPixels[i] / 255;
      const bgG = backgroundPixels[i + 1] / 255;
      const bgB = backgroundPixels[i + 2] / 255;

      r = r * (1 - transmission) + bgR * transmission;
      g = g * (1 - transmission) + bgG * transmission;
      b = b * (1 - transmission) + bgB * transmission;
    }

    data[i] = Math.round(clamp(r, 0, renderParams.highlightClamp) * 255);
    data[i + 1] = Math.round(clamp(g, 0, renderParams.highlightClamp) * 255);
    data[i + 2] = Math.round(clamp(b, 0, renderParams.highlightClamp) * 255);
  }

  ctx.putImageData(imageData, 0, 0);

  // Apply opacity and other post-processing effects
  if (renderParams.opacity < 1.0) {
    // Create temporary canvas for opacity blending
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(canvas, 0, 0);
    
    // Clear original and draw with opacity
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = renderParams.opacity;
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.globalAlpha = 1.0;
  }

  if (config.debug) {
    console.log('[Artist Pipeline] Render complete', {
      family: options.family,
      variant,
      width,
      height,
      luminance: Number(luminance.toFixed(3)),
      mapsLoaded: {
        pleatRamp: !!maps.pleatRamp,
        occlusion: !!maps.occlusion,
        translucency: !!maps.translucency,
        normal: !!maps.normal,
        depth: !!maps.depth,
      },
      renderParams,
      spec,
    });
  }

  return canvas;
}
