"use client";

import { useLightingEstimate } from './useLightingEstimate';
import { useCurtainFirstLightingRoi } from './useCurtainFirstLightingRoi';

type HeroPoint = { x: number; y: number };

type UseCurtainFirstLightingArgs = {
  previewUrl: string | null;
  fileSignature: string | null;

  corners: HeroPoint[] | null;
  dragIx: number | null;
  boxDragActive: boolean;

  reducedData: boolean;

  LIGHTING_ENABLED_ENV: boolean;
  LIGHTING_MODE: string;
  LIGHTING_OPACITY: number;
  LIGHTING_GRID_X: number;
  LIGHTING_GRID_Y: number;
  LIGHTING_THROTTLE_MS: number;
};

export function useCurtainFirstLighting({
  previewUrl,
  fileSignature,
  corners,
  dragIx,
  boxDragActive,
  reducedData,
  LIGHTING_ENABLED_ENV,
  LIGHTING_MODE,
  LIGHTING_OPACITY,
  LIGHTING_GRID_X,
  LIGHTING_GRID_Y,
  LIGHTING_THROTTLE_MS,
}: UseCurtainFirstLightingArgs): {
  lightingEnabled: boolean;
  lightingRoi: { x: number; y: number; w: number; h: number } | null;
  lighting: ReturnType<typeof useLightingEstimate>;
} {
  const lightingEnabled = LIGHTING_ENABLED_ENV && LIGHTING_MODE !== 'off' && !reducedData;

  const lightingRoi = useCurtainFirstLightingRoi({
    corners,
    dragIx,
    boxDragActive,
  });

  const lighting = useLightingEstimate({
    previewUrl,
    fileSignature,
    mode: lightingEnabled ? (LIGHTING_MODE as 'off' | 'lite' | 'enhanced') : 'off',
    opacity: Number.isFinite(LIGHTING_OPACITY) ? Math.max(0, Math.min(1, LIGHTING_OPACITY)) : 0.35,
    gridX: Number.isFinite(LIGHTING_GRID_X) ? LIGHTING_GRID_X : 48,
    gridY: Number.isFinite(LIGHTING_GRID_Y) ? LIGHTING_GRID_Y : 32,
    roi: lightingRoi,
    throttleMs: Number.isFinite(LIGHTING_THROTTLE_MS) ? Math.max(0, LIGHTING_THROTTLE_MS) : 120,
  });

  return { lightingEnabled, lightingRoi, lighting };
}
