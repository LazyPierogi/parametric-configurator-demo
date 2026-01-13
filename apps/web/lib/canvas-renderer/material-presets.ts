/**
 * Unified Material Presets
 * Task 1010+ - Canvas-based curtain rendering system
 * 
 * All material-specific rendering parameters in one place:
 * - Procedural pipeline: texture scale, opacity, noise
 * - Artist pipeline: transmission, shadows, highlights
 * - Shared: weave strength for both pipelines
 */

import type { MaterialFamily, MaterialToken } from './types';

/**
 * Unified material preset configuration
 * Combines procedural and artist pipeline parameters
 */
export type MaterialPreset = {
  /** Material family identifier */
  family: MaterialFamily;
  
  // === Procedural Pipeline Parameters ===
  /** Overall curtain opacity (0 = fully transparent, 1 = fully opaque) */
  opacity: number;
  /** Noise strength for natural fabric variation (0 = none, 0.2 = strong) */
  noiseStrength: number;
  /** Texture asset filename (without extension) */
  textureAsset: string;
  
  // === Artist Pipeline Parameters ===
  /** Light transmission (0 = opaque, 1 = fully transparent) */
  transmission: number;
  /** Shadow gain for depth (0 = no shadows, 1 = heavy shadows) */
  shadowGain: number;
  /** Highlight clamp (1.0 = no clamp, lower = dim highlights) */
  highlightClamp: number;
  /** Specular boost for sheen (0 = matte, 1 = glossy) */
  specBoost: number;
  /** Weave scale for material texture pattern (higher = finer/denser pattern) */
  weaveScale: number;
  /** Default blend mode for material weave detail (artist pipeline) */
  weaveBlendMode?: 'multiply' | 'overlay';
  
  // === Shared Parameters ===
  /** Weave strength for both procedural and artist pipelines */
  weaveStrength: number;
};

/**
 * Material presets per fabric family
 * Tuned for realistic appearance across different materials
 */
export const MATERIAL_PRESETS: Record<MaterialFamily, MaterialPreset> = {
  sheer: {
    // Procedural pipeline (from material-presets.ts)
    family: 'sheer',
    opacity: 0.93,            // Semi-transparent
    noiseStrength: 0.02,      // Very subtle variation (delicate fabric)
    textureAsset: 'sheer-weave',
    
    // Artist pipeline (from material-tokens.ts)
    transmission: 0.15,
    shadowGain: 0.65,
    highlightClamp: 1.0,
    specBoost: 0.8,
    weaveScale: 1.2,
    weaveBlendMode: 'multiply',
    
    // Shared (use artist values as they're more refined)
    weaveStrength: 0.08,     // Very subtle weave (from tokens)
  },
  
  linen: {
    // Procedural pipeline
    family: 'linen',
    opacity: 1,              // Nearly opaque
    noiseStrength: 0.01,      // Natural linen irregularity
    textureAsset: 'linen-weave',
    
    // Artist pipeline
    transmission: 0.05,
    shadowGain: 1,
    highlightClamp: 1.0,
    specBoost: 0.4,
    weaveScale: 1.2,
    weaveBlendMode: 'multiply',
    
    // Shared
    weaveStrength: 0.25,
  },
  
  blackout: {
    // Procedural pipeline
    family: 'blackout',
    opacity: 1.0,             // Fully opaque
    noiseStrength: 0.03,      // Subtle variation
    textureAsset: 'blackout-weave',
    
    // Artist pipeline
    transmission: 0.00,      // No transmission
    shadowGain: 0.18,        // Moderate shadows
    highlightClamp: 1.0,     // No clamp
    specBoost: 0.03,         // Minimal reflection
    weaveScale: 1.3,         // Tighter, denser weave pattern
    weaveBlendMode: 'multiply',
    
    // Shared
    weaveStrength: 0.12,     // Reduced from procedural (from tokens)
  },

  'blackout-basic': {
    // Procedural pipeline
    family: 'blackout-basic',
    opacity: 1.0,             // Fully opaque for basic blackout
    noiseStrength: 0.02,      // Slight variation to keep fabric alive
    textureAsset: 'blackout-basic-weave',

    // Artist pipeline
    transmission: 0.0,       // Blocks light entirely
    shadowGain: 0.22,        // Slightly deeper trough shadows
    highlightClamp: 0.95,    // Clamp highlights to avoid plastic sheen
    specBoost: 0.06,         // Small sheen for coated weave
    weaveScale: 1.5,         // Denser weave pattern
    weaveBlendMode: 'multiply',

    // Shared
    weaveStrength: 0.16,     // Make weave detail visible without noise
  },
  
  cotton: {
    // Procedural pipeline
    family: 'cotton',
    opacity: 0.92,            // Mostly opaque
    noiseStrength: 0,        // Natural cotton texture
    textureAsset: 'cotton-weave',
    
    // Artist pipeline
    transmission: 0.08,
    shadowGain: 0.12,        // Reduced from procedural
    highlightClamp: 1.0,     // No clamp
    specBoost: 0.04,
    weaveScale: 1.4,         // Balanced cotton weave pattern
    weaveBlendMode: 'multiply',
    
    // Shared
    weaveStrength: 0.14,     // Subtle weave (from tokens)
  },
  
  velvet: {
    // Procedural pipeline
    family: 'velvet',
    opacity: 0.98,            // Nearly opaque
    noiseStrength: 0.02,      // Subtle pile variation
    textureAsset: 'velvet-weave',
    
    // Artist pipeline
    transmission: 0.00,      // No transmission
    shadowGain: 0.16,        // Reduced from procedural
    highlightClamp: 1.0,     // No clamp
    specBoost: 0.08,         // Noticeable sheen
    weaveScale: 1.8,         // Fine pile texture pattern
    weaveBlendMode: 'multiply',
    
    // Shared
    weaveStrength: 0.20,     // Emphasize pile texture (from tokens)
  },
  
  silk: {
    // Procedural pipeline
    family: 'silk',
    opacity: 0.88,            // Semi-opaque
    noiseStrength: 0.01,      // Minimal (smooth fabric)
    textureAsset: 'silk-weave',
    
    // Artist pipeline
    transmission: 0.12,
    shadowGain: 0.10,        // Reduced from procedural
    highlightClamp: 1.0,     // No clamp
    specBoost: 0.12,         // High sheen
    weaveScale: 1.1,         // Smooth, fine weave pattern
    weaveBlendMode: 'multiply',
    
    // Shared
    weaveStrength: 0.10,     // Gentle silk weave (from tokens)
  },

  'curtain-linen': {
    // Procedural pipeline
    family: 'curtain-linen',
    opacity: 0.98,
    noiseStrength: 0,
    textureAsset: 'sheer-weave',
    
    // Artist pipeline
    transmission: 0.05,      // Low transmission
    shadowGain: 0,
    highlightClamp: 1.0,     // No clamp
    specBoost: 0.05,         // Natural matte finish
    weaveScale: 1.6,         // Medium weave texture pattern
    weaveBlendMode: 'multiply',
    
    // Shared
    weaveStrength: 0.25,
  },

  'sheer-linen': {
    // Procedural pipeline
    family: 'sheer-linen',
    opacity: 0.95,
    noiseStrength: 0,
    textureAsset: 'sheer-weave',
    
    // Artist pipeline
    transmission: 0.1,      // High light transmission
    shadowGain: 0,
    highlightClamp: 1.0,     // No clamp for bright fabrics
    specBoost: 0.04,
    weaveScale: 1.8,
    weaveBlendMode: 'multiply',
    
    // Shared
    weaveStrength: 0.3,
  },

  'curtain-basic': {
    // Procedural pipeline
    family: 'curtain-basic',
    opacity: 0.97,
    noiseStrength: 0.01,
    textureAsset: 'sheer-weave',
    
    // Artist pipeline
    transmission: 0,
    shadowGain: 0,
    highlightClamp: 1.0,
    specBoost: 0.55,
    weaveScale: 1.6,
    weaveBlendMode: 'multiply',
    
    // Shared
    weaveStrength: 0.05,
  },

  'sheer-basic': {
    // Procedural pipeline
    family: 'sheer-basic',
    opacity: 0.95,
    noiseStrength: 0.02,
    textureAsset: 'sheer-weave',
    
    // Artist pipeline
    transmission: 0.07,
    shadowGain: 0.7,
    highlightClamp: 1.0,
    specBoost: 0.65,
    weaveScale: 0.9,
    weaveBlendMode: 'multiply',
    
    // Shared
    weaveStrength: 0.25,
  },
};

/**
 * Get material preset for a fabric family
 * Falls back to linen if materialFamily not specified
 */
export function getMaterialPreset(materialFamily?: MaterialFamily): MaterialPreset {
  if (!materialFamily || !(materialFamily in MATERIAL_PRESETS)) {
    console.warn(`[Material Presets] Unknown materialFamily "${materialFamily}", using linen as fallback`);
    return MATERIAL_PRESETS.linen;
  }
  return MATERIAL_PRESETS[materialFamily];
}

/**
 * Convert MaterialPreset to MaterialToken for artist pipeline
 */
export function presetToToken(preset: MaterialPreset): MaterialToken {
  return {
    family: preset.family,
    transmission: preset.transmission,
    weaveScale: preset.weaveScale,
    weaveStrength: preset.weaveStrength,
    shadowGain: preset.shadowGain,
    highlightClamp: preset.highlightClamp,
    specBoost: preset.specBoost,
  };
}

/**
 * Get material token for artist pipeline (backward compatibility)
 * Falls back to linen if materialFamily not specified
 */
export function getMaterialToken(materialFamily?: MaterialFamily): MaterialToken {
  const preset = getMaterialPreset(materialFamily);
  return presetToToken(preset);
}

/**
 * Apply overrides to material preset
 * Useful for debug UI or designer controls
 */
export function applyMaterialOverrides(
  preset: MaterialPreset,
  overrides?: Partial<Omit<MaterialPreset, 'family' | 'textureAsset'>>
): MaterialPreset {
  if (!overrides) return preset;
  
  return {
    ...preset,
    ...overrides,
  };
}

/**
 * Apply debug parameter overrides to material token (backward compatibility)
 */
export function applyDebugOverrides(
  token: MaterialToken,
  overrides?: Partial<MaterialToken>
): MaterialToken {
  if (!overrides) return token;
  
  return {
    ...token,
    ...overrides,
  };
}
