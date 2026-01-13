import { Button } from '@/components/ui/Button';
import { usePalette, type Palette } from '@/lib/palette-context';
import { ChangeEvent, useState } from 'react';
import { DraggableDebugPanel } from './DraggableDebugPanel';
import { PricingDiagnosticsPanel } from './PricingDiagnosticsPanel';
import type { PriceQuote } from '@curtain-wizard/core/src/catalog';
import type { Fabric } from '@curtain-wizard/core/src/catalog/types';

type DebugUiState = {
  handleBg: string;
  borderHex: string;
  borderOpacity: number;
  handleOpacity: number;
  ringHex: string;
  ringOpacity: number;
  wallStroke: string;
  wallStrokeOpacity: number;
};

export interface DebugControlsProps {
  visible: boolean;
  showDebug: boolean;
  onToggleDebug: () => void;
  showSave: boolean;
  onToggleSave: () => void;
  stitchLinesVisible: boolean;
  onToggleStitchLines: (checked: boolean) => void;
  debugUi: DebugUiState;
  onUpdateDebugUi: (partial: Partial<DebugUiState>) => void;
  envSnippet: string;
  onCopyEnvSnippet: () => Promise<void> | void;
  version: string;
  envVars: Record<string, string>;
  t: (key: string, params?: Record<string, any>) => string;
  // Canvas rendering system (Task 1010+)
  canvasRendererEnabled?: boolean;
  canvasDebugInfo?: {
    pipeline: string;
    materialFamily: string | undefined;
    colorHex: string;
    colorCategory?: string;
    luminance: number;
    pleatId: string;
  };
  canvasRenderParams?: {
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
    heightStrength?: number;
  };
  onUpdateCanvasParams?: (params: {
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
    heightStrength?: number;
  }) => void;

  pricingDiagnostics?: {
    quote: PriceQuote | null;
    selectedFabric: Fabric | null;
    selectedPleatId: string | null;
    fabricMultiplier: number;
    laborMultiplier: number;
  };
}

export function DebugControls({
  visible,
  showDebug,
  onToggleDebug,
  showSave,
  onToggleSave,
  stitchLinesVisible,
  onToggleStitchLines,
  debugUi,
  onUpdateDebugUi,
  envSnippet,
  onCopyEnvSnippet,
  version,
  envVars,
  t,
  canvasRendererEnabled,
  canvasDebugInfo,
  canvasRenderParams,
  onUpdateCanvasParams,
  pricingDiagnostics,
}: DebugControlsProps) {
  const { current: currentPalette, setPalette, isTransitioning } = usePalette();
  const [showEnvVars, setShowEnvVars] = useState(false);
  
  // Designer Preset Editor state
  type PresetGroup = 'material' | 'color' | 'pleating';
  const [activePresetGroup, setActivePresetGroup] = useState<PresetGroup>('material');
  
  if (!visible) return null;

  const handleColorChange = (key: keyof DebugUiState) => (event: ChangeEvent<HTMLInputElement>) => {
    onUpdateDebugUi({ [key]: event.target.value } as Partial<DebugUiState>);
  };

  const handleRangeChange = (key: keyof DebugUiState) => (event: ChangeEvent<HTMLInputElement>) => {
    onUpdateDebugUi({ [key]: Number(event.target.value) } as Partial<DebugUiState>);
  };

  // Content for the draggable debug panel
  const debugPanelContent = (
    <>
      {/* Environment Variables Display */}
      <div className="mb-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => setShowEnvVars((v) => !v)} className="w-full">
          {showEnvVars ? 'Hide Environment Variables' : 'Show Environment Variables'}
        </Button>
        {showEnvVars && (
          <div className="mt-2 rounded border border-neutral-300 bg-white p-2">
            <pre className="text-[10px] font-mono text-neutral-700 whitespace-pre-wrap break-all max-h-[150px] overflow-y-auto">
              {Object.entries(envVars)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => `${key}=${value}`)
                .join('\n')}
            </pre>
          </div>
        )}
      </div>

      {pricingDiagnostics && (
        <PricingDiagnosticsPanel
          visible={showDebug}
          quote={pricingDiagnostics.quote}
          selectedFabric={pricingDiagnostics.selectedFabric}
          selectedPleatId={pricingDiagnostics.selectedPleatId}
          fabricMultiplier={pricingDiagnostics.fabricMultiplier}
          laborMultiplier={pricingDiagnostics.laborMultiplier}
        />
      )}
      
      <div className="grid grid-cols-2 items-center gap-2.5 text-sm">
          {/* Designer Preset Editor (Task 1010+) */}
          {canvasRendererEnabled && canvasDebugInfo && canvasRenderParams && onUpdateCanvasParams && (
            <>
              <label className="text-neutral-700 font-semibold col-span-2 border-t border-neutral-200 pt-2">
                🎛️ Designer Preset Editor
              </label>
              
              <label className="text-neutral-700 text-xs">Preset Group</label>
              <select
                value={activePresetGroup}
                onChange={(e) => setActivePresetGroup(e.target.value as PresetGroup)}
                className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
              >
                <option value="material">Material Presets</option>
                <option value="color">Color Presets</option>
                <option value="pleating">Pleating Presets</option>
              </select>
              
              <div className="col-span-2 text-xs text-neutral-500 mt-1 mb-2">
                Current: <span className="font-mono">{canvasDebugInfo.materialFamily || 'unknown'}</span> material, 
                <span className="font-mono"> {canvasDebugInfo.colorCategory || 'colored'}</span> color, 
                <span className="font-mono"> {canvasDebugInfo.pleatId}</span> pleat
              </div>
              
              {/* Material Presets Parameters */}
              {activePresetGroup === 'material' && (
                <>
                  <label className="text-neutral-700 text-xs col-span-2 font-semibold mt-2 border-t border-neutral-200 pt-2">
                    Procedural Pipeline
                  </label>
                  
                  <label className="text-neutral-700 text-xs" title="Overall curtain opacity - 0 = fully transparent, 1 = fully opaque">
                    Opacity
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={canvasRenderParams.opacity ?? 1.0}
                      onChange={(e) => onUpdateCanvasParams({ 
                        ...canvasRenderParams, 
                        opacity: Number(e.target.value) 
                      })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-12 text-right">
                      {(canvasRenderParams.opacity ?? 1.0).toFixed(2)}
                    </span>
                  </div>
                  
                  <label className="text-neutral-700 text-xs" title="Noise strength for natural fabric variation - 0 = none, 0.2 = strong">
                    Noise Strength
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={0.2}
                      step={0.01}
                      value={canvasRenderParams.noiseStrength ?? 0.05}
                      onChange={(e) => onUpdateCanvasParams({ 
                        ...canvasRenderParams, 
                        noiseStrength: Number(e.target.value) 
                      })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-12 text-right">
                      {(canvasRenderParams.noiseStrength ?? 0.05).toFixed(2)}
                    </span>
                  </div>
                  
                  <label className="text-neutral-700 text-xs col-span-2 font-semibold mt-2 border-t border-neutral-200 pt-2">
                    Artist Pipeline
                  </label>
                  
                  <label className="text-neutral-700 text-xs" title="Light transmission through fabric - 0 = opaque, 1 = fully transparent">
                    Transmission
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={canvasRenderParams.transmissionStrength ?? 0}
                      onChange={(e) => onUpdateCanvasParams({ 
                        ...canvasRenderParams, 
                        transmissionStrength: Number(e.target.value) 
                      })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-12 text-right">
                      {(canvasRenderParams.transmissionStrength ?? 0).toFixed(2)}
                    </span>
                  </div>
                  
                  <label className="text-neutral-700 text-xs" title="Shadow depth multiplier - higher = deeper shadows in pleats">
                    Shadow Gain
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={canvasRenderParams.shadowStrength}
                      onChange={(e) => onUpdateCanvasParams({ 
                        ...canvasRenderParams, 
                        shadowStrength: Number(e.target.value) 
                      })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-12 text-right">
                      {canvasRenderParams.shadowStrength.toFixed(2)}
                    </span>
                  </div>
                  
                  <label className="text-neutral-700 text-xs" title="Highlight clamp - 1.0 = no clamp, lower = dim highlights">
                    Highlight Clamp
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={canvasRenderParams.highlightClamp ?? 1.0}
                      onChange={(e) => onUpdateCanvasParams({ 
                        ...canvasRenderParams, 
                        highlightClamp: Number(e.target.value) 
                      })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-12 text-right">
                      {(canvasRenderParams.highlightClamp ?? 1.0).toFixed(2)}
                    </span>
                  </div>
                  
                  <label className="text-neutral-700 text-xs" title="Specular boost for sheen - 0 = matte, 1 = glossy">
                    Specular Boost
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={canvasRenderParams.specularStrength ?? 0}
                      onChange={(e) => onUpdateCanvasParams({ 
                        ...canvasRenderParams, 
                        specularStrength: Number(e.target.value) 
                      })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-12 text-right">
                      {(canvasRenderParams.specularStrength ?? 0).toFixed(2)}
                    </span>
                  </div>
                  
                  <label className="text-neutral-700 text-xs" title="Weave scale for artist pipeline texture">
                    Weave Scale
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0.5}
                      max={3}
                      step={0.1}
                      value={canvasRenderParams.weaveScale ?? 1.2}
                      onChange={(e) => onUpdateCanvasParams({ 
                        ...canvasRenderParams, 
                        weaveScale: Number(e.target.value) 
                      })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-12 text-right">
                      {(canvasRenderParams.weaveScale ?? 1.2).toFixed(2)}
                    </span>
                  </div>
                  
                  <label className="text-neutral-700 text-xs">
                    {t('configure.debug.weaveBlendMode')}
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={canvasRenderParams.weaveBlendMode ?? 'multiply'}
                      onChange={(e) =>
                        onUpdateCanvasParams({
                          ...canvasRenderParams,
                          weaveBlendMode: e.target.value as 'multiply' | 'overlay',
                        })
                      }
                      className="flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
                    >
                      <option value="multiply">{t('configure.debug.weaveBlendModeMultiply')}</option>
                      <option value="overlay">{t('configure.debug.weaveBlendModeOverlay')}</option>
                    </select>
                  </div>
                  
                  <label className="text-neutral-700 text-xs col-span-2 font-semibold mt-2 border-t border-neutral-200 pt-2">
                    Shared
                  </label>
                  
                  <label className="text-neutral-700 text-xs" title="Weave pattern visibility for both procedural and artist pipelines - 0 = invisible, 1 = prominent">
                    Weave Strength
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={canvasRenderParams.weaveStrength}
                      onChange={(e) => onUpdateCanvasParams({ 
                        ...canvasRenderParams, 
                        weaveStrength: Number(e.target.value) 
                      })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-12 text-right">
                      {canvasRenderParams.weaveStrength.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
              
              {/* Color Presets Parameters */}
              {activePresetGroup === 'color' && (
                <>
                  <label className="text-neutral-700 text-xs col-span-2 font-semibold mt-2 border-t border-neutral-200 pt-2">
                    Color Parameters (from ColorCategoryPreset)
                  </label>
                  
                  <label className="text-neutral-700 text-xs" title="Shadow strength from pleat ramps - visible but gentle for bright fabrics, stronger for dark">
                    Shadow Strength
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={canvasRenderParams.shadowStrength}
                      onChange={(e) => onUpdateCanvasParams({ 
                        ...canvasRenderParams, 
                        shadowStrength: Number(e.target.value) 
                      })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-12 text-right">
                      {canvasRenderParams.shadowStrength.toFixed(2)}
                    </span>
                  </div>
                  
                  <label className="text-neutral-700 text-xs" title="Ambient occlusion darkness - subtle depth for bright colors, medium/strong for dark colors">
                    Occlusion Strength
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={canvasRenderParams.occlusionStrength}
                      onChange={(e) => onUpdateCanvasParams({ 
                        ...canvasRenderParams, 
                        occlusionStrength: Number(e.target.value) 
                      })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-12 text-right">
                      {canvasRenderParams.occlusionStrength.toFixed(2)}
                    </span>
                  </div>
                  
                  <label className="text-neutral-700 text-xs" title="Contrast boost - 0 = no boost (keeps whites bright), higher = more contrast">
                    Contrast Boost
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={0.2}
                      step={0.01}
                      value={canvasRenderParams.contrastBoost ?? 0.0}
                      onChange={(e) => onUpdateCanvasParams({ 
                        ...canvasRenderParams, 
                        contrastBoost: Number(e.target.value) 
                      })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-12 text-right">
                      {(canvasRenderParams.contrastBoost ?? 0.0).toFixed(2)}
                    </span>
                  </div>
                </>
              )}
              
              {/* Pleating Presets Parameters */}
              {activePresetGroup === 'pleating' && (
                <>
                  <label className="text-neutral-700 text-xs col-span-2 font-semibold mt-2 border-t border-neutral-200 pt-2">
                    Pleating Parameters (from PleatingPreset)
                  </label>
                  
                  <label className="text-neutral-700 text-xs" title="Horizontal tile width in pixels - controls pleat spacing (wave: 220px, flex: 200px, doubleFlex: 160px)">
                    Tile Width (px)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={100}
                      max={300}
                      step={10}
                      value={canvasRenderParams.tileWidthPx ?? 220}
                      onChange={(e) => onUpdateCanvasParams({ 
                        ...canvasRenderParams, 
                        tileWidthPx: Number(e.target.value) 
                      })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-12 text-right">
                      {canvasRenderParams.tileWidthPx ?? 220}
                    </span>
                  </div>

                  <label className="text-neutral-700 text-xs" title="Height/relief map influence - 0 = off, 1 = strong">
                    Height Map Strength
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={canvasRenderParams.heightStrength ?? 0.2}
                      onChange={(e) => onUpdateCanvasParams({ 
                        ...canvasRenderParams, 
                        heightStrength: Number(e.target.value) 
                      })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono w-12 text-right">
                      {(canvasRenderParams.heightStrength ?? 0.2).toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="col-span-2 text-xs text-neutral-500 mt-1">
                    ℹ️ Presets: wave=220px, flex=200px, doubleFlex=160px
                  </div>
                </>
              )}
              
              {/* Copy & Reset Buttons */}
              <div className="col-span-2 flex gap-2 mt-3">
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm"
                  onClick={async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const button = event.currentTarget;
                    const originalText = button.textContent;

                    const presetData = {
                      presetGroup: activePresetGroup,
                      material: canvasDebugInfo.materialFamily || 'unknown',
                      colorGroup: canvasDebugInfo.colorCategory || 'colored',
                      pleatId: canvasDebugInfo.pleatId,
                      ...(activePresetGroup === 'material' && {
                        // Procedural Pipeline
                        opacity: canvasRenderParams.opacity ?? 1.0,
                        noiseStrength: canvasRenderParams.noiseStrength ?? 0.05,
                        textureAsset: 'sheer-weave', // TODO: get from state
                        // Artist Pipeline
                        transmission: canvasRenderParams.transmissionStrength ?? 0,
                        shadowGain: canvasRenderParams.shadowStrength,
                        highlightClamp: canvasRenderParams.highlightClamp ?? 1.0,
                        specBoost: canvasRenderParams.specularStrength ?? 0,
                        weaveScale: canvasRenderParams.weaveScale ?? 1.2,
                        // Shared
                        weaveStrength: canvasRenderParams.weaveStrength,
                      }),
                      ...(activePresetGroup === 'color' && {
                        shadowStrength: canvasRenderParams.shadowStrength,
                        occlusionStrength: canvasRenderParams.occlusionStrength,
                        contrastBoost: canvasRenderParams.contrastBoost ?? 0.0,
                      }),
                      ...(activePresetGroup === 'pleating' && {
                        tileWidthPx: canvasRenderParams.tileWidthPx ?? 220,
                        heightStrength: canvasRenderParams.heightStrength ?? 0.2,
                      }),
                    };
                    
                    const json = JSON.stringify(presetData, null, 2);
                    let copied = false;
                    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                      try {
                        await navigator.clipboard.writeText(json);
                        copied = true;
                      } catch (error) {
                        copied = false;
                      }
                    }
                    if (!copied && typeof document !== 'undefined') {
                      const textarea = document.createElement('textarea');
                      textarea.value = json;
                      textarea.style.position = 'fixed';
                      textarea.style.left = '-9999px';
                      document.body.appendChild(textarea);
                      textarea.focus();
                      textarea.select();
                      try {
                        copied = document.execCommand('copy');
                      } catch (error) {
                        copied = false;
                      }
                      document.body.removeChild(textarea);
                    }

                    button.textContent = copied ? '✓ Copied!' : '⚠️ Copy failed';
                    setTimeout(() => {
                      button.textContent = originalText ?? button.textContent;
                    }, 2000);
                  }}
                  title={`Copy ${activePresetGroup.charAt(0).toUpperCase() + activePresetGroup.slice(1)} Preset values as JSON`}
                >
                  📋 Copy {activePresetGroup.charAt(0).toUpperCase() + activePresetGroup.slice(1)} Preset
                </Button>
                
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm"
                  onClick={() => {
                    onUpdateCanvasParams({
                      shadowStrength: 0.5,
                      weaveStrength: 0.15,
                      occlusionStrength: 0.0,
                      transmissionStrength: 0.2,
                      specularStrength: 0.05,
                      artistVariant: 1,
                    });
                  }}
                >
                  ↺ Reset
                </Button>
              </div>
            </>
          )}
          
          {/* Palette Switcher */}
          <label className="text-neutral-700 font-semibold col-span-2 mt-2 border-t border-neutral-200 pt-2">
            🎨 Color Palette
          </label>
          <label className="text-neutral-700">Active Palette</label>
          <select
            value={currentPalette}
            onChange={(e) => setPalette(e.target.value as Palette)}
            disabled={isTransitioning}
            className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm disabled:opacity-50"
          >
            <option value="signature">Signature (Standalone)</option>
            <option value="havinic">Havinic (Storefront)</option>
            <option value="hybrid">Hybrid (Transition)</option>
          </select>
          {isTransitioning && (
            <div className="col-span-2 text-xs text-neutral-500 italic">
              Transitioning palette...
            </div>
          )}
          
          {/* Canvas Rendering System (Task 1010+) */}
          {canvasRendererEnabled && canvasDebugInfo && (
            <>
              <label className="text-neutral-700 font-semibold col-span-2 mt-2 border-t border-neutral-200 pt-2">
                🎨 Canvas Rendering
              </label>
              
              <label className="text-neutral-700 text-xs">Pipeline</label>
              <div className="text-xs font-mono bg-neutral-100 px-2 py-1 rounded">
                {canvasDebugInfo.pipeline}
              </div>
              
              <label className="text-neutral-700 text-xs">Material Family</label>
              <div className="text-xs font-mono bg-neutral-100 px-2 py-1 rounded">
                {canvasDebugInfo.materialFamily || 'none'}
              </div>
              
              <label className="text-neutral-700 text-xs">Pleat ID</label>
              <div className="text-xs font-mono bg-neutral-100 px-2 py-1 rounded">
                {canvasDebugInfo.pleatId}
              </div>
              
              <label className="text-neutral-700 text-xs">Color</label>
              <div className="flex items-center gap-2">
                <div 
                  style={{ backgroundColor: canvasDebugInfo.colorHex }}
                  className="w-6 h-6 rounded border border-neutral-300"
                />
                <span className="text-xs font-mono">{canvasDebugInfo.colorHex}</span>
              </div>
              
              <label className="text-neutral-700 text-xs">Luminance (Y)</label>
              <div className="text-xs font-mono bg-neutral-100 px-2 py-1 rounded">
                {canvasDebugInfo.luminance.toFixed(3)}
              </div>
              
              <div className="col-span-2 text-xs text-neutral-500 mt-1">
                ℹ️ Canvas renderer uses material tokens per fabric family. Assets: 3 pleats × 4 maps = 12 textures total.
              </div>
            </>
          )}
          
          {/* Debug Handles */}
          <label className="text-neutral-700 font-semibold col-span-2 mt-2 border-t border-neutral-200 pt-2">
            🎯 Debug Handles
          </label>
          <label className="text-neutral-700">{t('configure.debug.showStitchLines')}</label>
          <input
            type="checkbox"
            checked={stitchLinesVisible}
            onChange={(event) => onToggleStitchLines(event.target.checked)}
          />
          <label className="text-neutral-700">{t('configure.debug.handleBg')}</label>
          <input type="color" value={debugUi.handleBg} onChange={handleColorChange('handleBg')} />
          <label className="text-neutral-700">{t('configure.debug.borderColor')}</label>
          <input type="color" value={debugUi.borderHex} onChange={handleColorChange('borderHex')} />
          <label className="text-neutral-700">{t('configure.debug.borderOpacity')}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={debugUi.borderOpacity}
            onChange={handleRangeChange('borderOpacity')}
          />
          <label className="text-neutral-700">{t('configure.debug.handleOpacity')}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={debugUi.handleOpacity}
            onChange={handleRangeChange('handleOpacity')}
          />
          <label className="text-neutral-700">{t('configure.debug.ringColor')}</label>
          <input type="color" value={debugUi.ringHex} onChange={handleColorChange('ringHex')} />
          <label className="text-neutral-700">{t('configure.debug.ringOpacity')}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={debugUi.ringOpacity}
            onChange={handleRangeChange('ringOpacity')}
          />
          <label className="text-neutral-700">{t('configure.debug.wallStroke')}</label>
          <input type="color" value={debugUi.wallStroke} onChange={handleColorChange('wallStroke')} />
          <label className="text-neutral-700">{t('configure.debug.wallStrokeOpacity')}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={debugUi.wallStrokeOpacity}
            onChange={handleRangeChange('wallStrokeOpacity')}
          />
        </div>
      
      <div className="mt-3 border-t border border-neutral-200 pt-3">
        <Button type="button" variant="secondary" size="sm" onClick={onToggleSave} className="w-full mb-2">
          {showSave ? t('configure.debug.closeSave') : t('configure.debug.save')}
        </Button>
        {showSave && (
          <>
            <div className="mb-2 text-xs text-neutral-700">{t('configure.debug.copyHint')}</div>
            <textarea
              readOnly
              value={envSnippet}
              className="h-[100px] w-full rounded-md border border-neutral-300 bg-white p-2 text-xs font-mono"
            />
            <div className="mt-2">
              <Button type="button" variant="secondary" size="sm" onClick={onCopyEnvSnippet}>
                {t('configure.debug.copy')}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );

  // Only render the draggable panel (toggle button is now at page top)
  return (
    <DraggableDebugPanel
      open={showDebug}
      onClose={onToggleDebug}
      title={<><span>🛠️ {t('configure.debug.heading')}</span> <span className="text-xs text-neutral-500 font-mono ml-2">{version}</span></>}
    >
      {debugPanelContent}
    </DraggableDebugPanel>
  );
}
