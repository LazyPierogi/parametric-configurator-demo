/**
 * Canvas Renderer Types
 * Task 1010+ - Canvas-based curtain rendering system
 * 
 * Type definitions for material tokens, render configuration,
 * and pipeline selection.
 */

import type { Fabric } from '@curtain-wizard/core/src/catalog/types';
import type { MaterialPreset } from './material-presets';

/**
 * Material family identifier
 * Maps to Fabric.materialFamily
 */
export type MaterialFamily =
  | 'sheer'
  | 'linen'
  | 'blackout'
  | 'blackout-basic'
  | 'cotton'
  | 'velvet'
  | 'silk'
  | 'curtain-linen'
  | 'sheer-linen'
  | 'curtain-basic'
  | 'sheer-basic';

/**
 * Pleat texture assets (excluding material-specific weaveDetail)
 */
export type PleatAssets = {
  /** Pleat depth/shadow ramp texture */
  pleatRamp: string;
  /** Light transmission mask for sheer effects */
  translucencyMask: string;
  /** Ambient occlusion for depth */
  occlusion: string;
  /** Normal map for surface lighting */
  normal: string;
  /** Material-specific weave detail (loaded separately) */
  weaveDetail?: string;
};

/**
 * Material token: rendering parameters per fabric family
 * Defines physical characteristics for realistic rendering
 */
export type MaterialToken = {
  /** Fabric family identifier */
  family: MaterialFamily;
  /** Light transmission coefficient (0 = opaque, 1 = fully transparent) */
  transmission: number;
  /** Weave texture scale multiplier */
  weaveScale: number;
  /** Weave pattern visibility (0 = invisible, 1 = prominent) */
  weaveStrength: number;
  /** Shadow depth multiplier (higher = deeper shadows in pleats) */
  shadowGain: number;
  /** Highlight clipping threshold (prevents over-brightening) */
  highlightClamp: number;
  /** Specular reflection boost (0 = matte, higher = shinier) */
  specBoost: number;
};

/**
 * Rendering pipeline identifier
 */
export type RenderPipeline = 
  | 'off'                      // Legacy CSS textures (fallback)
  | 'artist';                  // Artist-authored 4-map rendering (default)

/**
 * Render configuration passed to the canvas renderer
 */
export type RenderConfig = {
  /** Selected rendering pipeline */
  pipeline: RenderPipeline;
  /** Fabric data (for materialFamily, colors, etc.) */
  fabric: Fabric;
  /** Selected color hex */
  colorHex: string;
  /** Pleat type (wave, flex, doubleFlex) */
  pleatId: string;
  /** Canvas dimensions (px) */
  canvasWidth: number;
  canvasHeight: number;
  /** Texture scale (horizontal tile width in px) */
  textureScale: number;
  /** Wall box dimensions in pixels (for background blur ROI) */
  wallBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Segment position within Wall Box (for transmission mapping) */
  segmentBounds?: {
    /** Horizontal offset from Wall Box left edge (px) */
    xInWallBox: number;
    /** Segment width (px) */
    width: number;
  };
  /** Background image data for translucent pipeline */
  backgroundImage?: HTMLImageElement | HTMLCanvasElement;
  /** Background signature used for caching (must change when image content changes) */
  backgroundSignature?: string;
  /** Debug mode: enable performance logging */
  debug?: boolean;
  /** Live render parameters for artist pipeline tweaking */
  renderParams?: {
    shadowStrength: number;
    weaveStrength: number;
    occlusionStrength: number;
    transmissionStrength?: number;
    specularStrength?: number;
    artistVariant?: number;
    // Material Presets - Procedural Pipeline
    opacity?: number;
    noiseStrength?: number;
    textureAsset?: string;
    // Material Presets - Artist Pipeline
    highlightClamp?: number;
    weaveScale?: number;
    weaveBlendMode?: 'multiply' | 'overlay';
    // Color Presets
    contrastBoost?: number;
    // Pleating Presets
    tileWidthPx?: number;
    /** Optional height/relief map influence (0 = off, 1 = full). */
    heightStrength?: number;
  };
};

/**
 * Render result with performance metrics
 */
export type RenderResult = {
  /** Rendered canvas element */
  canvas: HTMLCanvasElement;
  /** Performance metrics */
  metrics: {
    /** Total render time (ms) */
    renderTimeMs: number;
    /** Chosen material token */
    materialToken: MaterialToken;
    /** Color luminance (0-1) */
    luminance: number;
    /** Pipeline used */
    pipeline: RenderPipeline;
    /** FPS (if animated) */
    fps?: number;
  };
};

/**
 * Artist pipeline options for debug tweaking
 */
export type ArtistDebugParams = {
  shadowStrength?: number;
  occlusionStrength?: number;
  weaveStrength?: number;
  transmissionStrength?: number;
  specularStrength?: number;
  artistVariant?: number;
  weaveBlendMode?: 'multiply' | 'overlay';
  showMetrics?: boolean;
};

// Re-export MaterialPreset for convenience
export type { MaterialPreset } from './material-presets';
