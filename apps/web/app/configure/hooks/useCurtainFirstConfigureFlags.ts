"use client";

import type { RenderPipeline } from '@/lib/canvas-renderer';

export type CurtainFirstConfigureFlags = {
  LIGHTING_MODE: 'off' | 'lite' | 'enhanced';
  LIGHTING_OPACITY: number;
  LIGHTING_GRID_X: number;
  LIGHTING_GRID_Y: number;
  LIGHTING_THROTTLE_MS: number;
  LIGHTING_ENABLED_ENV: boolean;

  MATERIAL_REUSE_ENABLED: boolean;

  CONFIGURE_FLOW_MODE: 'new';
  USE_CURTAIN_FIRST_FLOW: true;

  CURTAIN_BOX_HEIGHT_SOURCE: 'auto' | 'mask' | 'full';
  CURTAIN_MEASUREMENT_ENABLED: boolean;

  activeRenderPipeline: RenderPipeline;
  USE_CANVAS_RENDERER: true;

  CONFIGURE_FALLBACK_LATEST: boolean;
};

export function useCurtainFirstConfigureFlags(): CurtainFirstConfigureFlags {
  const LIGHTING_MODE = (process.env.NEXT_PUBLIC_LIGHTING_MODE ?? 'lite') as 'off' | 'lite' | 'enhanced';
  const LIGHTING_OPACITY = Number(process.env.NEXT_PUBLIC_LIGHTING_OPACITY ?? '0.35');
  const LIGHTING_GRID_X = Number(process.env.NEXT_PUBLIC_LIGHTING_GRID_X ?? '48');
  const LIGHTING_GRID_Y = Number(process.env.NEXT_PUBLIC_LIGHTING_GRID_Y ?? '32');
  const LIGHTING_THROTTLE_MS = Number(process.env.NEXT_PUBLIC_LIGHTING_THROTTLE_MS ?? '120');
  const LIGHTING_ENABLED_ENV = (process.env.NEXT_PUBLIC_LIGHTING_ENABLED ?? '1') !== '0';

  const MATERIAL_REUSE_ENABLED = (process.env.NEXT_PUBLIC_MATERIAL_REUSE_ENABLED ?? '0') === '1';

  const CONFIGURE_FLOW_MODE = 'new' as const;
  const USE_CURTAIN_FIRST_FLOW = true as const;

  const CURTAIN_BOX_HEIGHT_SOURCE = (process.env.NEXT_PUBLIC_CURTAIN_BOX_HEIGHT_SOURCE ?? 'auto') as
    | 'auto'
    | 'mask'
    | 'full';

  const CURTAIN_MEASUREMENT_ENABLED = false;

  const activeRenderPipeline: RenderPipeline = 'artist';
  const USE_CANVAS_RENDERER = true as const;

  const CONFIGURE_FALLBACK_LATEST = (process.env.NEXT_PUBLIC_CONFIGURE_FALLBACK_LATEST ?? '0') === '1';

  return {
    LIGHTING_MODE,
    LIGHTING_OPACITY,
    LIGHTING_GRID_X,
    LIGHTING_GRID_Y,
    LIGHTING_THROTTLE_MS,
    LIGHTING_ENABLED_ENV,
    MATERIAL_REUSE_ENABLED,
    CONFIGURE_FLOW_MODE,
    USE_CURTAIN_FIRST_FLOW,
    CURTAIN_BOX_HEIGHT_SOURCE,
    CURTAIN_MEASUREMENT_ENABLED,
    activeRenderPipeline,
    USE_CANVAS_RENDERER,
    CONFIGURE_FALLBACK_LATEST,
  };
}
