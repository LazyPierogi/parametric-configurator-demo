/**
 * Color Category Rendering Presets
 * Task 1010+ - Maps colorCategory to optimal rendering parameters
 * 
 * These presets ensure curtains look realistic across different color categories:
 * - bright: whites, creams, pastels (high luminance, subtle shadows)
 * - grey: silvers, grays, charcoals (medium contrast, visible shadows)
 * - dark: navy, black, deep colors (strong shadows, high contrast)
 * - colored: vibrant colors (balanced settings)
 * - patterned: special handling for patterns (TBD)
 */

import type { Fabric } from '@curtain-wizard/core/src/catalog/types';
import type { MaterialFamily } from './types';

export type ColorCategory =
  | 'bright'
  | 'grey'
  | 'dark'
  | 'colored'
  | 'patterned'
  | 'intensive'
  | 'natural'
  | 'brown';

export type ColorCategoryPreset = {
  shadowStrength: number;
  occlusionStrength: number;
  contrastBoost: number;
};

/**
 * Rendering presets per color category
 * Tuned based on real-world testing with mock catalog
 */
export const COLOR_CATEGORY_PRESETS: Record<ColorCategory, ColorCategoryPreset> = {
  bright: {
    // Whites, creams, pastels (#FFFAFA, #FFFDD0)
    // Keep shadows very subtle to preserve brightness
    shadowStrength: 0.70,       // Visible but gentle pleat shadows
    occlusionStrength: 0.20,     // Subtle depth
    contrastBoost: 0.00,         // No contrast boost (keeps whites bright)
  },
  
  grey: {
    // Grays, silvers (#C0C0C0, #36454F)
    // Medium contrast, visible structure
    shadowStrength: 0.75,        // Clear pleat definition
    occlusionStrength: 0.35,     // Medium depth
    contrastBoost: 0.04,         // Slight contrast boost
  },
  
  dark: {
    // Navy, black, deep colors (#191970, #000080)
    // Strong shadows, high contrast for depth
    shadowStrength: 0.25,        // Strong pleat shadows
    occlusionStrength: 1,     // Deep shadows
    contrastBoost: 0.26,         // High contrast to prevent flatness
  },
  
  colored: {
    // Vibrant colors (#E0BBE4, #9CAF88)
    // Balanced settings for accurate color representation
    shadowStrength: 0.55,        // Moderate shadows
    occlusionStrength: 0.30,     // Balanced depth
    contrastBoost: 0.03,         // Slight enhancement
  },
  
  patterned: {
    // Patterned fabrics (stripes, florals, etc.)
    // Reduce overlays to preserve pattern visibility
    shadowStrength: 0.55,        // Moderate shadows
    occlusionStrength: 0.30,     // Standard depth
    contrastBoost: 0.03,         // Slight enhancement
  },

  intensive: {
    // High-saturation colors benefit from a touch more contrast but controlled shadows
    shadowStrength: 0.60,
    occlusionStrength: 0.34,
    contrastBoost: 0.10,
  },

  natural: {
    // Earthy/organic palette (sage, sand) with gentle contrast
    shadowStrength: 0.58,
    occlusionStrength: 0.32,
    contrastBoost: 0.02,
  },

  brown: {
    // Warm, deeper neutrals — closer to dark but with warmer highlights
    shadowStrength: 0.68,
    occlusionStrength: 0.40,
    contrastBoost: 0.14,
  },
};

// Designer per-material overrides (Option B)
// Key: materialFamily -> colorCategory -> partial preset overrides
const COLOR_OVERRIDES: Partial<Record<MaterialFamily, Partial<Record<ColorCategory, Partial<ColorCategoryPreset>>>>> = {
  'sheer-linen': {
    dark:   { shadowStrength: 0,   occlusionStrength: 0,   contrastBoost: 0.20 },
    bright: { shadowStrength: 1.0, occlusionStrength: 0,   contrastBoost: 0.00 },
  },
  'sheer-basic': {
    bright: { shadowStrength: 0.8, occlusionStrength: 0.2, contrastBoost: 0.04 },
  },
  'curtain-linen': {
    bright: { shadowStrength: 0,   occlusionStrength: 0.60, contrastBoost: 0.04 },
  },
  'curtain-basic': {
    dark:   { shadowStrength: 0.25, occlusionStrength: 1.0, contrastBoost: 0.11 },
  },
  'blackout-basic': {
    dark:   { shadowStrength: 0.22, occlusionStrength: 1.0, contrastBoost: 0.15 },
    bright: { shadowStrength: 0.40, occlusionStrength: 0.85, contrastBoost: 0.08 },
  },
};

/**
 * Get color category from fabric data
 * Falls back to 'colored' if not specified
 */
export function getColorCategory(fabric: Fabric, colorLabel?: string): ColorCategory {
  // Try color-specific category first (from colorCategoryByColor)
  if (colorLabel && fabric.colorCategoryByColor) {
    const cat = fabric.colorCategoryByColor[colorLabel];
    if (cat && cat in COLOR_CATEGORY_PRESETS) {
      return cat as ColorCategory;
    }
  }
  
  // Fall back to fabric-level colorCategory
  if (fabric.colorCategory && fabric.colorCategory in COLOR_CATEGORY_PRESETS) {
    return fabric.colorCategory as ColorCategory;
  }
  
  // Default fallback
  return 'colored';
}

/**
 * Get rendering preset for a fabric/color combination
 */
export function getColorCategoryPreset(
  fabric: Fabric, 
  colorLabel?: string
): ColorCategoryPreset {
  const category = getColorCategory(fabric, colorLabel);
  const base = COLOR_CATEGORY_PRESETS[category];
  const family = (fabric.materialFamily as MaterialFamily) || 'linen';
  const override = COLOR_OVERRIDES[family]?.[category];
  if (!override) return base;
  return {
    shadowStrength: override.shadowStrength ?? base.shadowStrength,
    occlusionStrength: override.occlusionStrength ?? base.occlusionStrength,
    contrastBoost: override.contrastBoost ?? base.contrastBoost,
  };
}

/**
 * Merge user overrides with color category preset
 * User settings take precedence over preset defaults
 */
export function mergePresetWithOverrides(
  preset: ColorCategoryPreset,
  overrides?: Partial<ColorCategoryPreset>
): ColorCategoryPreset {
  if (!overrides) return preset;
  
  return {
    shadowStrength: overrides.shadowStrength ?? preset.shadowStrength,
    occlusionStrength: overrides.occlusionStrength ?? preset.occlusionStrength,
    contrastBoost: overrides.contrastBoost ?? preset.contrastBoost,
  };
}
