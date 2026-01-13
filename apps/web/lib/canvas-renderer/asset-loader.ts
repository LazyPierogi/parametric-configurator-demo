/**
 * Asset Loader
 * Task 1010+ - Canvas-based curtain rendering system
 * 
 * Loads and caches pleat textures (pleatRamp, weaveDetail, etc.)
 */

import type { PleatAssets, MaterialFamily } from './types';
import { loadImage, imageToImageData } from './compositor';
import type { ArtistTextureFamily, ArtistTextureMap } from './artist-textures';
import {
  ARTIST_TEXTURE_EXTENSIONS,
  clampVariant,
  getArtistTexturePath,
  getArtistTextureSpec,
} from './artist-textures';

type PleatAssetCandidateMap = Record<keyof Omit<PleatAssets, 'weaveDetail'>, string[]>;

/**
 * Asset cache: pleatId -> asset type -> ImageData
 */
const assetCache = new Map<string, Map<string, ImageData>>();

/**
 * Material texture cache: materialFamily -> ImageData
 */
const materialTextureCache = new Map<string, ImageData>();

/**
 * Artist asset cache: family|variant -> map type -> ImageData
 */
const artistAssetCache = new Map<string, Map<ArtistTextureMap, ImageData>>();

/**
 * Get base URL for canvas textures
 */
function getTextureBaseUrl(): string {
  // Use dedicated canvas textures base URL
  const canvasBase = (process.env.NEXT_PUBLIC_CANVAS_TEXTURES_BASE_URL ?? '').trim();
  
  if (!canvasBase || canvasBase === '/') {
    // Local development: serve from /public via Next.js routes
    return '/media/textures/canvas';
  }
  
  // Production or custom host: return as-is (no /canvas suffix)
  return canvasBase.replace(/\/+$/, '');
}

/**
 * Build asset URL candidates for a pleat type (WEBP preferred, PNG/JPEG fallback)
 * Note: weaveDetail is now material-specific, loaded separately
 */
export function getPleatAssetUrls(pleatId: string): PleatAssetCandidateMap {
  const base = getTextureBaseUrl();
  const makeCandidates = (path: string): string[] =>
    ARTIST_TEXTURE_EXTENSIONS.map(ext => `${path}.${ext}`);
  
  if (pleatId === 'flex') {
    return {
      pleatRamp: makeCandidates(`${base}/flex25d/pleatRamp_flex`),
      translucencyMask: makeCandidates(`${base}/flex25d/translucency_flex`),
      occlusion: makeCandidates(`${base}/flex25d/occlusion_flex`),
      normal: makeCandidates(`${base}/flex25d/normal_flex`),
    };
  }
  
  return {
    pleatRamp: makeCandidates(`${base}/${pleatId}/pleatRamp`),
    translucencyMask: makeCandidates(`${base}/${pleatId}/translucencyMask`),
    occlusion: makeCandidates(`${base}/${pleatId}/occlusion`),
    normal: makeCandidates(`${base}/${pleatId}/normal`),
  };
}

/**
 * Get material texture URL with format fallback
 */
export function getMaterialTextureUrl(materialFamily: MaterialFamily): string[] {
  const base = getTextureBaseUrl();
  return ARTIST_TEXTURE_EXTENSIONS.map(ext => `${base}/texture-details/${materialFamily}-weave.${ext}`);
}

/**
 * Load asset with format fallback
 */
async function loadAssetWithFallback(urls: string[]): Promise<ImageData> {
  const lastError = new Error('All asset formats failed to load');

  for (const url of urls) {
    try {
      const img = await loadImage(url);
      const imageData = imageToImageData(img);
      return imageData;
    } catch (error) {
      lastError.message = `Failed to load: ${url}. ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  throw lastError;
}

/**
 * Clear material texture cache (useful for production debugging)
 */
export function clearMaterialTextureCache(): void {
  materialTextureCache.clear();
  console.log('[Canvas Renderer] Material texture cache cleared');
}

/**
 * Preload material texture
 */
export async function preloadMaterialTexture(materialFamily: MaterialFamily): Promise<ImageData> {
  // Check cache first (but include base URL in cache key to avoid dev/prod conflicts)
  const cacheKey = `${materialFamily}_${getTextureBaseUrl()}`;
  if (materialTextureCache.has(cacheKey)) {
    console.log(`[Canvas Renderer] Using cached texture for: ${materialFamily}`);
    return materialTextureCache.get(cacheKey)!;
  }
  
  const urls = getMaterialTextureUrl(materialFamily);
  const imageData = await loadAssetWithFallback(urls);
  
  // Cache for future use (with base URL in key)
  materialTextureCache.set(cacheKey, imageData);
  
  console.log(`[Canvas Renderer] Preloaded and cached material texture: ${materialFamily}`);
  return imageData;
}

/**
 * Preload artist-authored pleat textures for a family/variant
 */
export async function preloadArtistTextures(
  family: ArtistTextureFamily,
  variant = 1
): Promise<Map<ArtistTextureMap, ImageData>> {
  const normalizedVariant = clampVariant(family, variant);
  const cacheKey = `${family}#${normalizedVariant}`;

  if (artistAssetCache.has(cacheKey)) {
    return artistAssetCache.get(cacheKey)!;
  }

  const spec = getArtistTextureSpec(family);
  const assets = new Map<ArtistTextureMap, ImageData>();
  const maps: ArtistTextureMap[] = ['pleatRamp', 'occlusion', 'translucency', 'normal', 'depth'];

  const loaders = maps.map(async mapName => {
    try {
      const urls = getArtistTexturePath(family, mapName, normalizedVariant);
      const data = await loadAssetWithFallback(urls);
      assets.set(mapName, data);
    } catch (error) {
      console.warn(`[Canvas Renderer] Missing artist map "${mapName}" for family "${family}"`, error);
    }
  });

  await Promise.all(loaders);

  if (assets.size === 0) {
    throw new Error(
      `[Canvas Renderer] No artist maps available for "${family}" (variant ${normalizedVariant})`
    );
  }

  artistAssetCache.set(cacheKey, assets);
  console.log(
    `[Canvas Renderer] Preloaded ${assets.size}/${maps.length} artist maps for ${family} (variant ${normalizedVariant}, pleats=${spec.pleatsPerTile})`
  );
  return assets;
}

/**
 * Get cached artist asset
 */
export function getCachedArtistAsset(
  family: ArtistTextureFamily,
  map: ArtistTextureMap,
  variant = 1
): ImageData | null {
  const normalizedVariant = clampVariant(family, variant);
  const cacheKey = `${family}#${normalizedVariant}`;
  const assets = artistAssetCache.get(cacheKey);
  if (!assets) return null;
  return assets.get(map) ?? null;
}

/**
 * Preload all assets for a pleat type (without weaveDetail)
 * Returns map of asset name -> ImageData
 */
export async function preloadPleatAssets(pleatId: string): Promise<Map<string, ImageData>> {
  // Check cache first
  if (assetCache.has(pleatId)) {
    return assetCache.get(pleatId)!;
  }
  
  const urls = getPleatAssetUrls(pleatId);
  const assets = new Map<string, ImageData>();
  
  // Load all assets in parallel
  const entries = Object.entries(urls);
  const loadPromises = entries.map(async ([name, candidates]) => {
    const imageData = await loadAssetWithFallback(candidates);
    assets.set(name, imageData);
  });
  
  await Promise.all(loadPromises);
  
  // Cache for future use
  assetCache.set(pleatId, assets);
  
  console.log(`[Canvas Renderer] Preloaded ${assets.size} pleat assets for: ${pleatId}`);
  return assets;
}

/**
 * Get cached asset for a pleat
 * Returns null if not loaded
 */
export function getCachedAsset(pleatId: string, assetName: string): ImageData | null {
  const pleatAssets = assetCache.get(pleatId);
  if (!pleatAssets) return null;
  return pleatAssets.get(assetName) || null;
}

/**
 * Get cached material texture
 * Returns null if not loaded
 */
export function getCachedMaterialTexture(materialFamily: MaterialFamily): ImageData | null {
  const cacheKey = `${materialFamily}_${getTextureBaseUrl()}`;
  return materialTextureCache.get(cacheKey) || null;
}

/**
 * Clear asset cache (for testing/development)
 */
export function clearAssetCache(): void {
  assetCache.clear();
  materialTextureCache.clear();
  artistAssetCache.clear();
  console.log('[Canvas Renderer] Asset cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  pleatsCached: number;
  materialsCached: number;
  artistFamiliesCached: number;
  totalAssets: number;
} {
  let totalAssets = 0;
  assetCache.forEach(assets => {
    totalAssets += assets.size;
  });
  totalAssets += materialTextureCache.size;
  artistAssetCache.forEach(assets => {
    totalAssets += assets.size;
  });
  
  return {
    pleatsCached: assetCache.size,
    materialsCached: materialTextureCache.size,
    artistFamiliesCached: artistAssetCache.size,
    totalAssets,
  };
}
