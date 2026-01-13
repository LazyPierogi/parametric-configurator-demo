/**
 * Pleating Presets
 * Task 1010+ - Canvas-based curtain rendering system
 * 
 * Controls horizontal tile width for artist-authored pleat textures.
 * Each pleat style has a specific tile size that matches the artist maps.
 */

export type PleatId = 'wave' | 'flex' | 'doubleFlex';
import type { MaterialFamily } from './types';

/**
 * Pleating preset configuration
 */
export type PleatingPreset = {
  /** Pleat style identifier */
  pleatId: PleatId;
  /** Horizontal tile width in pixels (controls pleat spacing) */
  tileWidthPx: number;
  /** Display name */
  label: string;
  /** Height map strength (controls relief shading) */
  heightStrength?: number;
};

// Designer per-material pleating overrides (Option B)
// Key: materialFamily -> pleatId -> partial preset
const PLEATING_OVERRIDES: Partial<Record<MaterialFamily, Partial<Record<PleatId, Partial<PleatingPreset>>>>> = {
  'sheer-basic': {
    wave:       { tileWidthPx: 240, heightStrength: 0.25 },
    flex:       { tileWidthPx: 160, heightStrength: 0.15 },
    doubleFlex: { tileWidthPx: 180, heightStrength: 0.25 },
  },
  'sheer-linen': {
    wave:       { tileWidthPx: 220, heightStrength: 0.35 },
  },
  'curtain-basic': {
    wave:       { tileWidthPx: 180, heightStrength: 0.25 },
    flex:       { tileWidthPx: 200, heightStrength: 0.10 },
    doubleFlex: { tileWidthPx: 160, heightStrength: 0.15 },
  },
  'blackout-basic': {
    wave:       { tileWidthPx: 180, heightStrength: 0.28 },
    flex:       { tileWidthPx: 200, heightStrength: 0.12 },
    doubleFlex: { tileWidthPx: 160, heightStrength: 0.18 },
  },
};

/**
 * Get pleating preset with optional per-material overrides
 */
export function getPleatingPresetForMaterial(
  materialFamily: MaterialFamily | undefined,
  pleatId: string
): PleatingPreset {
  const base = getPleatingPreset(pleatId);
  const family = (materialFamily as MaterialFamily) || undefined;
  if (!family) return base;
  const override = (PLEATING_OVERRIDES[family] || {})[base.pleatId];
  if (!override) return base;
  return {
    ...base,
    tileWidthPx: override.tileWidthPx ?? base.tileWidthPx,
    heightStrength: override.heightStrength ?? base.heightStrength,
  };
}

/**
 * Pleating presets per pleat style
 * Tuned for realistic pleat appearance
 */
export const PLEATING_PRESETS: Record<PleatId, PleatingPreset> = {
  wave: {
    pleatId: 'wave',
    label: 'Wave Pleat',
    tileWidthPx: 220,    // Broader wave pattern
    heightStrength: 0.2,
  },
  
  flex: {
    pleatId: 'flex',
    label: 'Flex Pleat',
    tileWidthPx: 200,    // Sharp, narrow flex folds
    heightStrength: 0.2,
  },
  
  doubleFlex: {
    pleatId: 'doubleFlex',
    label: 'Double Flex Pleat',
    tileWidthPx: 160,    // Densest pleat pattern
    heightStrength: 0.2,
  },
};

/**
 * Get pleating preset for a pleat style
 * Falls back to wave if pleatId not recognized
 */
export function getPleatingPreset(pleatId: string): PleatingPreset {
  const normalized = pleatId as PleatId;
  
  if (!(normalized in PLEATING_PRESETS)) {
    console.warn(`[Pleating Presets] Unknown pleatId "${pleatId}", using wave as fallback`);
    return PLEATING_PRESETS.wave;
  }
  
  return PLEATING_PRESETS[normalized];
}

/**
 * Apply overrides to pleating preset
 * Useful for debug UI or special cases
 */
export function applyPleatingOverrides(
  preset: PleatingPreset,
  overrides?: Partial<Omit<PleatingPreset, 'pleatId' | 'label'>>
): PleatingPreset {
  if (!overrides) return preset;
  
  return {
    ...preset,
    tileWidthPx: overrides.tileWidthPx ?? preset.tileWidthPx,
  };
}
