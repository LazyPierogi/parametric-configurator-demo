import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Fabric, ChildItem } from '@curtain-wizard/core/src/catalog';

export type CanvasRenderParams = {
  shadowStrength: number;
  weaveStrength: number;
  occlusionStrength: number;
  transmissionStrength?: number;
  specularStrength?: number;
  artistVariant?: number;
  // Material Presets - Procedural Pipeline
  textureScale?: number;
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
  heightStrength?: number;
};

export function useCurtainFirstCanvasRenderParams({
  USE_CANVAS_RENDERER,
  previewFabric,
  selectedChildItem,
  selectedPleatId,
}: {
  USE_CANVAS_RENDERER: boolean;
  previewFabric: Fabric | null;
  selectedChildItem: ChildItem | null;
  selectedPleatId: string | null;
}): {
  canvasRenderParams: CanvasRenderParams;
  handleUpdateCanvasParams: (nextParams: CanvasRenderParams) => void;
  texScale: number;
  texOpacity: number;
} {
  const [presetTexScale, setPresetTexScale] = useState<number | null>(null);
  const [presetOpacity, setPresetOpacity] = useState<number | null>(null);

  const [canvasRenderParams, setCanvasRenderParams] = useState<CanvasRenderParams>({
    shadowStrength: 0.5,
    weaveStrength: 0.15,
    occlusionStrength: 0.0,
    transmissionStrength: 0.2,
    specularStrength: 0.05,
    artistVariant: 1,
    highlightClamp: 1.0,
    weaveScale: 1.2,
    weaveBlendMode: 'multiply',
    // Material Presets defaults
    textureScale: 1.0,
    opacity: 1.0,
    noiseStrength: 0.05,
    textureAsset: 'sheer-weave',
    // Color Presets defaults
    contrastBoost: 0.0,
    // Pleating Presets defaults
    tileWidthPx: 220,
    heightStrength: 0.4,
  });

  const handleUpdateCanvasParams = useCallback((nextParams: CanvasRenderParams) => {
    setCanvasRenderParams(nextParams);
    if (typeof nextParams.tileWidthPx === 'number' && Number.isFinite(nextParams.tileWidthPx)) {
      setPresetTexScale(nextParams.tileWidthPx);
    }
    if (typeof nextParams.opacity === 'number' && Number.isFinite(nextParams.opacity)) {
      const nextOpacityPct = Math.max(0, Math.min(100, nextParams.opacity * 100));
      setPresetOpacity(nextOpacityPct);
    }
  }, []);

  useEffect(() => {
    if (!USE_CANVAS_RENDERER) return;
    if (!previewFabric || !selectedChildItem) return;
    let cancelled = false;

    Promise.all([
      import('@/lib/canvas-renderer/color-presets'),
      import('@/lib/canvas-renderer/material-presets'),
      import('@/lib/canvas-renderer/pleating-presets'),
    ]).then(([{ getColorCategoryPreset }, { getMaterialPreset, getMaterialToken }, { getPleatingPresetForMaterial }]) => {
      if (cancelled) return;

      const colorPreset = getColorCategoryPreset(previewFabric as any, selectedChildItem.color_label);
      const materialPreset = getMaterialPreset(previewFabric.materialFamily as any);
      const pleatingPreset = getPleatingPresetForMaterial(previewFabric.materialFamily as any, selectedPleatId || 'wave');
      const materialToken = getMaterialToken(previewFabric.materialFamily as any);

      handleUpdateCanvasParams({
        shadowStrength: colorPreset.shadowStrength,
        weaveStrength: materialPreset.weaveStrength,
        occlusionStrength: colorPreset.occlusionStrength,
        transmissionStrength: materialToken.transmission,
        specularStrength: materialToken.specBoost,
        artistVariant: 1,
        opacity: materialPreset.opacity,
        noiseStrength: materialPreset.noiseStrength,
        textureAsset: materialPreset.textureAsset,
        highlightClamp: materialPreset.highlightClamp,
        weaveScale: materialPreset.weaveScale,
        weaveBlendMode: materialPreset.weaveBlendMode || 'multiply',
        contrastBoost: colorPreset.contrastBoost,
        tileWidthPx: pleatingPreset.tileWidthPx,
        heightStrength: pleatingPreset.heightStrength,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [USE_CANVAS_RENDERER, previewFabric, selectedChildItem, selectedPleatId, handleUpdateCanvasParams]);

  const texScale = useMemo(() => {
    return USE_CANVAS_RENDERER
      ? Math.max(1, canvasRenderParams.tileWidthPx ?? presetTexScale ?? previewFabric?.textureDefaults?.tileWidthPx ?? 200)
      : Math.max(1, previewFabric?.textureDefaults?.tileWidthPx ?? 200);
  }, [USE_CANVAS_RENDERER, canvasRenderParams.tileWidthPx, presetTexScale, previewFabric?.textureDefaults?.tileWidthPx]);

  const texOpacity = useMemo(() => {
    return USE_CANVAS_RENDERER
      ? Math.max(
          0,
          Math.min(
            100,
            canvasRenderParams.opacity != null
              ? canvasRenderParams.opacity * 100
              : presetOpacity ?? previewFabric?.textureDefaults?.opacityPct ?? 95,
          ),
        )
      : Math.max(0, Math.min(100, previewFabric?.textureDefaults?.opacityPct ?? 95));
  }, [USE_CANVAS_RENDERER, canvasRenderParams.opacity, presetOpacity, previewFabric?.textureDefaults?.opacityPct]);

  return {
    canvasRenderParams,
    handleUpdateCanvasParams,
    texScale,
    texOpacity,
  };
}
