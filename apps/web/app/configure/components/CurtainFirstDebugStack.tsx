"use client";

import type React from 'react';
import { getColorCategory } from '@/lib/canvas-renderer/color-presets';
import { relativeLuminance, type RenderPipeline } from '@/lib/canvas-renderer';
import type { PriceQuote } from '@curtain-wizard/core/src/catalog';
import type { Fabric } from '@curtain-wizard/core/src/catalog/types';
import { DebugControls, type DebugControlsProps } from './DebugControls';
import { MeasurementDiagnosticsPanel } from './MeasurementDiagnosticsPanel';

type CurtainFirstDebugStackProps = {
  phase: string;
  DEBUG_UI_ENABLED: boolean;
  showDebug: boolean;
  setShowDebug: React.Dispatch<React.SetStateAction<boolean>>;

  showSave: boolean;
  setShowSave: React.Dispatch<React.SetStateAction<boolean>>;

  stitchLinesVisible: boolean;
  setStitchLinesVisible: (checked: boolean) => void;

  debugUi: DebugControlsProps['debugUi'];
  onUpdateDebugUi: DebugControlsProps['onUpdateDebugUi'];

  envSnippet: string;
  onCopyEnvSnippet: () => Promise<void>;
  version: string;
  envVars: Record<string, string>;
  t: DebugControlsProps['t'];

  canvasRendererEnabled: boolean;
  activeRenderPipeline: RenderPipeline;
  selectedFabric: Fabric | null;
  selectedChildItem: { color: string; color_label?: string | null } | null;
  selectedPleatId: string | null;
  canvasRenderParams?: DebugControlsProps['canvasRenderParams'];
  onUpdateCanvasParams?: DebugControlsProps['onUpdateCanvasParams'];

  quote: PriceQuote | null;
  priceFabricMultiplierEnv: string | undefined;
  priceLaborMultiplierEnv: string | undefined;
};

export function CurtainFirstDebugStack({
  phase,
  DEBUG_UI_ENABLED,
  showDebug,
  setShowDebug,
  showSave,
  setShowSave,
  stitchLinesVisible,
  setStitchLinesVisible,
  debugUi,
  onUpdateDebugUi,
  envSnippet,
  onCopyEnvSnippet,
  version,
  envVars,
  t,
  canvasRendererEnabled,
  activeRenderPipeline,
  selectedFabric,
  selectedChildItem,
  selectedPleatId,
  canvasRenderParams,
  onUpdateCanvasParams,
  quote,
  priceFabricMultiplierEnv,
  priceLaborMultiplierEnv,
}: CurtainFirstDebugStackProps) {
  const pricingDiagnostics = {
    quote: quote ?? null,
    selectedFabric: selectedFabric ?? null,
    selectedPleatId: selectedPleatId ?? null,
    fabricMultiplier: priceFabricMultiplierEnv ? Number(priceFabricMultiplierEnv) : 1.0,
    laborMultiplier: priceLaborMultiplierEnv ? Number(priceLaborMultiplierEnv) : 1.0,
  };

  const canvasDebugInfo =
    canvasRendererEnabled && selectedFabric && selectedChildItem && selectedPleatId
      ? {
          pipeline: activeRenderPipeline,
          materialFamily: selectedFabric.materialFamily,
          colorHex: selectedChildItem.color,
          colorCategory: getColorCategory(selectedFabric, selectedChildItem.color_label ?? undefined),
          luminance: relativeLuminance(selectedChildItem.color),
          pleatId: selectedPleatId,
        }
      : undefined;

  return (
    <>
      <DebugControls
        visible={phase === 'ready' && DEBUG_UI_ENABLED}
        showDebug={showDebug}
        onToggleDebug={() => setShowDebug((v) => !v)}
        showSave={showSave}
        onToggleSave={() => setShowSave((v) => !v)}
        stitchLinesVisible={stitchLinesVisible}
        onToggleStitchLines={(checked: boolean) => setStitchLinesVisible(checked)}
        debugUi={debugUi}
        onUpdateDebugUi={onUpdateDebugUi}
        envSnippet={envSnippet}
        onCopyEnvSnippet={onCopyEnvSnippet}
        version={version}
        envVars={envVars}
        t={t}
        canvasRendererEnabled={canvasRendererEnabled}
        canvasDebugInfo={canvasDebugInfo}
        canvasRenderParams={canvasRendererEnabled ? canvasRenderParams : undefined}
        onUpdateCanvasParams={canvasRendererEnabled ? onUpdateCanvasParams : undefined}
        pricingDiagnostics={pricingDiagnostics}
      />

      <MeasurementDiagnosticsPanel visible={DEBUG_UI_ENABLED && showDebug} />
    </>
  );
}
