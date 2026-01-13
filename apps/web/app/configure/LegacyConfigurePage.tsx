"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { Camera } from 'lucide-react';
import { preparePageTransitionIn, prepareConfiguratorPanelEntry } from '@/lib/motion-utils';
import { useCatalogProvider } from '@/app/providers/catalog-provider';
import { useLocale } from '@/app/providers/locale-context';
import { peekFlowState, clearFlowState, type FlowMeasurement } from '@/lib/flow-state';
import { fingerprintBlob } from '@/lib/file-signature';
import { validateAndConvertImage } from '@/lib/image-validation';
import { APP_VERSION, getActiveEnvVariables } from '@/lib/version';
import type { CurtainConfig, PriceQuote } from '@curtain-wizard/core/src/catalog';
import { getSummaryConfig, isFieldEnabled } from '@curtain-wizard/core/src/catalog/lib/summaryConfig';
import { getConfiguratorSections, getEnabledSectionsInOrder } from '@curtain-wizard/core/src/catalog/lib/configuratorSections';
import { useLightingEstimate } from './hooks/useLightingEstimate';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { Progress } from '@/components/ui/Progress';
import { Spinner } from '@/components/ui/Spinner';
import { useBudgetFilter } from './hooks/useBudgetFilter';
import { useCatalogOptions } from './hooks/useCatalogOptions';
import { useDeviceCapabilities } from '@/hooks/useDeviceCapabilities';
import { cn } from '@/lib/utils';
import { ConfiguratorLayout } from './components/ConfiguratorLayout';
import { FiltersPanel } from './components/FiltersPanel';
import { CoverageWarningDialog } from './components/CoverageWarningDialog';
import { WelcomeModal } from './components/WelcomeModal';
import { setSelectedFabric } from '@curtain-wizard/core/src/catalog/state/fabricStore';
import { shouldUseCanvasRenderer, getPipelineFromEnv, relativeLuminance, renderCurtain, renderCache, getCanonicalCanvasWidth, type RenderConfig, type RenderPipeline } from '@/lib/canvas-renderer';
import { getColorCategory } from '@/lib/canvas-renderer/color-presets';
import { getPleatingPresetForMaterial } from '@/lib/canvas-renderer/pleating-presets';
import { CanvasCurtainLayer, TransmissionLayer } from './components/CanvasCurtainLayer';
import { useRenderPreWarming } from './hooks/useRenderPreWarming';
import { useWallBoxBaseline } from './hooks/useWallBoxBaseline';
import { DebugControls } from './components/DebugControls';
import { MeasurementDiagnosticsPanel } from './components/MeasurementDiagnosticsPanel';
import { PricingDiagnosticsPanel } from './components/PricingDiagnosticsPanel';
import { createBrowserCompatibleUrl, isValidBlob } from '@/lib/blob-url-fallback';
import { logCacheHealth } from '@/lib/cache-recovery';
import { useSmartSticky } from './hooks/useSmartSticky';
import { useConfigureGuards } from './hooks/useConfigureGuards';
import { useConfigureBackEvent } from './hooks/useConfigureBackEvent';
import { useIsEmbed } from './hooks/useIsEmbed';
import { useReducedData } from './hooks/useReducedData';
import { useTexturePreload } from './hooks/useTexturePreload';
import { useCurtainFirstRestore } from './hooks/useCurtainFirstRestore';
import { useSegmentationJob } from './hooks/useSegmentationJob';
import { computeCurtainFirstDims } from './lib/computeCurtainFirstDims';
import { useCurtainFirstGeometryObserver } from './hooks/useCurtainFirstGeometryObserver';
import { runCurtainMeasurementOnConfigure } from './hooks/useCurtainMeasurementOnConfigure';
import type { AddToCartState, TranslateFn } from './types';
import { CurtainSummaryShell, type CurtainSummaryShellProps } from '@/features/configurator/components/CurtainSummaryShell';
import { CollapsibleSummary, type CollapsibleSummaryProps } from './components/CollapsibleSummary';
import { CurtainPhotoHero, type CurtainPhotoHeroProps } from '@/features/configurator/components/CurtainPhotoHero';
import { CurtainConfiguratorPanel, type CurtainConfiguratorPanelProps } from '@/features/configurator/components/CurtainConfiguratorPanel';
import type { ScreenshotCanvasRef } from './components/ScreenshotCanvas';
import WebflowLayoutStatic from '@/components/WebflowLayoutStatic';
import { formatCurrency, formatNumberWithLocale } from './lib/formatters';

type LightingEstimate = { cssFilter?: string; gradient?: { angleDeg: number; strength: number } } | null;

type ConfigurePageProps = {
  flowMode?: 'legacy' | 'new';
  forceRenderPipeline?: RenderPipeline;
  onCurtainFirstMissingFlow?: () => void;
};

const STOREFRONT_CART_URL = process.env.NEXT_PUBLIC_STOREFRONT_CART_URL ?? null;

const INITIAL_RENDER_PIPELINE = getPipelineFromEnv();

export default function LegacyConfigurePage({ forceRenderPipeline }: ConfigurePageProps = {}) {
  return (
    <Suspense fallback={null}>
      <LegacyConfigurePageContent forceRenderPipeline={forceRenderPipeline} />
    </Suspense>
  );
}

export function LegacyConfigurePageContent({ forceRenderPipeline }: Pick<ConfigurePageProps, 'forceRenderPipeline'>) {
  return <ConfigurePageContent flowMode="legacy" forceRenderPipeline={forceRenderPipeline} />;
}

export function ConfigurePageContent({ flowMode, forceRenderPipeline, onCurtainFirstMissingFlow }: ConfigurePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { provider, providerId } = useCatalogProvider();
  const { locale, t } = useLocale();
  if (flowMode === 'new') {
    throw new Error(
      '[LegacyConfigurePage] flowMode="new" is no longer supported here. Use the curtain-first configure route implementation (CurtainFirstConfigureOrchestrator) instead.'
    );
  }
  const BYPASS_LOCAL_CACHE = useMemo(() => {
    try {
      const v1 = (searchParams?.get('bypassCache') || '').toLowerCase();
      const v2 = (searchParams?.get('cache') || '').toLowerCase();
      const fromQuery = v1 === '1' || v1 === 'true' || v2 === 'off' || v2 === 'disable' || v2 === 'disabled';
      const fromFlow = (() => { try { return !!peekFlowState()?.bypassCache; } catch { return false; } })();
      return fromQuery || fromFlow;
    } catch {
      return false;
    }
  }, [searchParams]);
  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => formatNumberWithLocale(locale, value, options),
    [locale],
  );
  const MAX_MB = Number(process.env.NEXT_PUBLIC_MAX_IMAGE_MB || '15');
  const MAX_BYTES = Math.max(1, Math.floor(MAX_MB * 1024 * 1024));
  const CACHE_QUOTA_BYTES = 25 * 1024 * 1024;
  const INFLIGHT_TTL_MS = 5000;
  const storefrontCartUrl = STOREFRONT_CART_URL;
  // Lighting env (Task 881)
  const LIGHTING_MODE = (process.env.NEXT_PUBLIC_LIGHTING_MODE ?? 'lite') as 'off' | 'lite' | 'enhanced';
  const LIGHTING_OPACITY = Number(process.env.NEXT_PUBLIC_LIGHTING_OPACITY ?? '0.35');
  const LIGHTING_GRID_X = Number(process.env.NEXT_PUBLIC_LIGHTING_GRID_X ?? '48');
  const LIGHTING_GRID_Y = Number(process.env.NEXT_PUBLIC_LIGHTING_GRID_Y ?? '32');
  const LIGHTING_THROTTLE_MS = Number(process.env.NEXT_PUBLIC_LIGHTING_THROTTLE_MS ?? '120');
  const LIGHTING_ENABLED_ENV = (process.env.NEXT_PUBLIC_LIGHTING_ENABLED ?? '1') !== '0';
  // Material Reuse Optimization (Task 902+)
  const MATERIAL_REUSE_ENABLED = (process.env.NEXT_PUBLIC_MATERIAL_REUSE_ENABLED ?? '0') === '1';
  const CONFIGURE_FLOW_MODE = (flowMode ?? 'new') as 'legacy' | 'new';
  const USE_CURTAIN_FIRST_FLOW = CONFIGURE_FLOW_MODE === 'new';
  const CURTAIN_BOX_HEIGHT_SOURCE = (process.env.NEXT_PUBLIC_CURTAIN_BOX_HEIGHT_SOURCE ?? 'auto') as
    | 'auto'
    | 'mask'
    | 'full';
  const CURTAIN_MEASUREMENT_ENABLED = false;
  // Canvas Rendering System (Task 1010+)
  const forcedRenderPipeline = useMemo<RenderPipeline | undefined>(() => {
    if (forceRenderPipeline) return forceRenderPipeline;
    if (USE_CURTAIN_FIRST_FLOW) return 'artist';
    return undefined;
  }, [USE_CURTAIN_FIRST_FLOW, forceRenderPipeline]);
  const [renderPipeline, setRenderPipeline] = useState<RenderPipeline>(forcedRenderPipeline ?? INITIAL_RENDER_PIPELINE);
  useEffect(() => {
    if (forcedRenderPipeline) return;
    setRenderPipeline(getPipelineFromEnv());
  }, [forcedRenderPipeline]);
  const activeRenderPipeline = forcedRenderPipeline ?? renderPipeline;
  const USE_CANVAS_RENDERER = shouldUseCanvasRenderer(activeRenderPipeline);
  if (process.env.NODE_ENV !== 'production') {
    // One-time mount log for fast triage
    console.info('[Configure] Mount flags', {
      USE_CANVAS_RENDERER,
      CONFIGURE_FLOW_MODE,
      NEXT_PUBLIC_TEXTURES_PIPELINE: process.env.NEXT_PUBLIC_TEXTURES_PIPELINE,
    });
  }
  const reducedData = useReducedData();
  const lightingEnabled = LIGHTING_ENABLED_ENV && LIGHTING_MODE !== 'off' && !reducedData;
  // Optional: allow fallback to latest cached segment when no flow state
  const CONFIGURE_FALLBACK_LATEST = (process.env.NEXT_PUBLIC_CONFIGURE_FALLBACK_LATEST ?? '0') === '1';

  // Note: Page entry animation now handled by View Transitions API in globals.css
  // No manual fade-in needed - browser handles smooth cross-fade automatically

  // Cache health check on mount (development only)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      logCacheHealth().catch(err => {
        console.error('[configure] Cache health check failed', err);
      });
    }
  }, []);

  const isEmbed = useIsEmbed();
  useConfigureBackEvent(() => setExitDialogOpen(true));

  const summaryConfig = useMemo(() => getSummaryConfig(process.env.NEXT_PUBLIC_SUMMARY_FIELDS), []);
  const configuratorSections = useMemo(() => getConfiguratorSections(process.env.NEXT_PUBLIC_CONFIGURATOR_SECTIONS), []);
  const sectionsOrder = useMemo(() => getEnabledSectionsInOrder(configuratorSections), [configuratorSections]);
  const {
    bounds: { min: BUDGET_MIN_PLN, max: BUDGET_MAX_PLN },
    uiRange: [budgetUiMinPln, budgetUiMaxPln],
    setUiRange,
    commitRange,
    isAnyPriceUi,
    isNoFilterUi,
    catalogFilter,
  } = useBudgetFilter();
  const { ensureImage, ensureImageForLegacy, getRenderableUrl, primeBlobUrl, isImageLoaded } = useTexturePreload({
    useCanvasRenderer: USE_CANVAS_RENDERER,
  });

  // If the overlay is already showing the exact target texture (from hover), just lock it in as base without reloading
  const promoteOverlayToBase = useCallback((url: string) => {
    // Promote immediately; overlay remains visible until next frame
    setTextureUrl(url);
    setCrossfadeActive(false);
    setCrossfadeUrl(null);
    // Clear hover overlay next frame to avoid flicker
    requestAnimationFrame(() => setHoverTextureUrl(null));
  }, []);

  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const {
    fabricTypes,
    fabrics,
    pleats,
    hems,
    serviceOptions,
    selectedFabricTypeId,
    setSelectedFabricTypeId,
    selectedFabricId,
    setSelectedFabricId,
    selectedColor,
    selectedChildItem,
    setSelectedColor,
    setSelectedChildItem,
    selectedStyle,
    setSelectedStyle,
    selectedColorCategory,
    setSelectedColorCategory,
    availableStyles,
    availableColorCategories,
    fabricCountByStyle,
    fabricCountByColorCategory,
    fabricCountByType,
    getFilteredColors,
    getChildItems,
    selectedPleatId,
    setSelectedPleatId,
    selectedHemId,
    setSelectedHemId,
    selectedServices,
    toggleService,
    catalogLoading,
    catalogError,
    selectedFabric,
    selectedPleat,
    selectedHem,
    selectedServiceObjects,
    maxCurtainHeightCm,
    maxPanelWidthCm,
  } = useCatalogOptions({ provider, providerId, filter: catalogFilter, ensureImage: ensureImageForLegacy, t });
  useEffect(() => { setSelectedFabric(selectedFabric) }, [selectedFabric]);
  
  // Device capabilities (proper detection, not pixel-based!)
  const { useCompactLayout, hasTouch, hasHover, isSmallScreen } = useDeviceCapabilities();
  const isMobile = useCompactLayout; // Legacy compat - will refactor consumers gradually
  const layoutMode: 'desktop' | 'compact' = isMobile ? 'compact' : 'desktop';
  
  const [consultUrl, setConsultUrl] = useState<string | null>(null);
  const [showCoverageWarning, setShowCoverageWarning] = useState(false);
  const [pendingTotalPriceMinor, setPendingTotalPriceMinor] = useState<number | undefined>();
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [lastConfig, setLastConfig] = useState<CurtainConfig | null>(null);
  const [lastConfigSignature, setLastConfigSignature] = useState<string | null>(null);
  const [addToCartState, setAddToCartState] = useState<AddToCartState>({ status: 'idle' });
  // Appearance (fixed defaults requested): light overlay + low blur

  const handleOpenExitDialog = useCallback(() => {
    setExitDialogOpen(true);
  }, []);

  const handleCloseExitDialog = useCallback(() => {
    setExitDialogOpen(false);
  }, []);

  const handleConfirmExit = useCallback(() => {
    try {
      clearFlowState();
    } catch {
      // ignore storage errors
    }
    setExitDialogOpen(false);
    if (typeof (window as any).__cwDisableBeforeUnload === 'function') {
      (window as any).__cwDisableBeforeUnload();
    }
    // No longer notify parent bridge — subdomain is now standalone
    router.push('/estimate');
  }, [router]);

  // Preset-based texture scale and opacity (override catalog textureDefaults for canvas renderer)
  const [presetTexScale, setPresetTexScale] = useState<number | null>(null);
  const [presetOpacity, setPresetOpacity] = useState<number | null>(null);
  const [canvasRenderParams, setCanvasRenderParams] = useState<{
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
  }>({
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
  
  // Hover preview texture (does not change selected fabric/color)
  const [hoverTextureUrl, setHoverTextureUrl] = useState<string | null>(null);
  const hoverBaseUrlRef = useRef<string | null>(null);
  const hoverToken = useRef(0);
  const hoverClearTimer = useRef<number | null>(null);
  const resetHoverBaseUrl = useCallback(() => {
    hoverBaseUrlRef.current = null;
  }, []);
  // UI cue: highlight the hovered color chip so users know only chips trigger previews
  const [hoveredChipKey, setHoveredChipKey] = useState<string | null>(null);
  const cancelHoverClear = useCallback(() => {
    if (hoverClearTimer.current != null) {
      clearTimeout(hoverClearTimer.current);
      hoverClearTimer.current = null;
    }
  }, []);
  const scheduleHoverClear = useCallback((ms: number = 80) => {
    cancelHoverClear();
    hoverClearTimer.current = window.setTimeout(() => {
      resetHoverBaseUrl();
      hoverToken.current++;
      setHoverTextureUrl(null);
      hoverClearTimer.current = null;
    }, ms);
  }, [cancelHoverClear, resetHoverBaseUrl]);

  const handleUpdateCanvasParams = useCallback(
    (nextParams: typeof canvasRenderParams) => {
      setCanvasRenderParams(nextParams);
      if (typeof nextParams.tileWidthPx === 'number' && Number.isFinite(nextParams.tileWidthPx)) {
        setPresetTexScale(nextParams.tileWidthPx);
      }
      if (typeof nextParams.opacity === 'number' && Number.isFinite(nextParams.opacity)) {
        const nextOpacityPct = Math.max(0, Math.min(100, nextParams.opacity * 100));
        setPresetOpacity(nextOpacityPct);
      }
    },
    [setCanvasRenderParams, setPresetTexScale, setPresetOpacity]
  );

  // Use hovered fabric's defaults on preview; fall back to selected fabric
  const previewFabric = useMemo(() => {
    const hoveredId = hoveredChipKey ? hoveredChipKey.split(':')[0] : null;
    if (hoveredId) {
      const f = fabrics.find((fab) => fab.id === hoveredId);
      if (f) return f;
    }
    return selectedFabric ?? null;
  }, [hoveredChipKey, fabrics, selectedFabric]);

  // Texture defaults: use presets if available (canvas renderer), otherwise fall back to catalog textureDefaults
  const texScale = USE_CANVAS_RENDERER
    ? Math.max(
        1,
        (canvasRenderParams.tileWidthPx ?? presetTexScale ?? previewFabric?.textureDefaults?.tileWidthPx ?? 200)
      )
    : Math.max(1, previewFabric?.textureDefaults?.tileWidthPx ?? 200);
  const texOpacity = USE_CANVAS_RENDERER
    ? Math.max(
        0,
        Math.min(
          100,
          (canvasRenderParams.opacity != null
            ? canvasRenderParams.opacity * 100
            : presetOpacity ?? previewFabric?.textureDefaults?.opacityPct ?? 95)
        )
      )
    : Math.max(0, Math.min(100, previewFabric?.textureDefaults?.opacityPct ?? 95));

  // Prefetch: first texture for all fabrics to make cross-card hover instant
  useEffect(() => {
    // Skip legacy asset prefetching when using canvas renderer (artist pipeline)
    if (USE_CANVAS_RENDERER) return;
    if (!fabrics || fabrics.length === 0) return;
    for (const f of fabrics) {
      const filteredColors = getChildItems(f);
      const defaultChildColor = filteredColors[0]?.color_label ?? f.colors?.[0] ?? null;
      const baseColor = f.id === selectedFabricId && selectedColor ? selectedColor : defaultChildColor;
      const url = (baseColor && f.textureByColor?.[baseColor]) || f.textureUrl || f.thumbnails?.[0] || null;
      void ensureImage(url);
    }
  }, [fabrics, selectedFabricId, selectedColor, ensureImage, getChildItems, USE_CANVAS_RENDERER]);

  // Note: Device capability detection now handled by useDeviceCapabilities hook
  // (removed old resize listener for pixel-based isMobile)

  const [file, setFile] = useState<File | null>(null);
  const [fileSignature, setFileSignature] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [maskUrl, setMaskUrl] = useState<string | null>(null);
  const [attachedUrl, setAttachedUrl] = useState<string | null>(null);
  const [proposalUrl, setProposalUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [showMask, setShowMask] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'segmenting' | 'mark' | 'ready' | 'restoring'>('idle');
  const [baseCm, setBaseCm] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [baseBoxRatio, setBaseBoxRatio] = useState<{ w: number; h: number } | null>(null);

  const lastCurtainBoxLogRef = useRef<string | null>(null);
  const [curtainMeasureState, setCurtainMeasureState] = useState<{
    status: 'idle' | 'pending' | 'success' | 'error';
    polygonKey: string | null;
  }>({
    status: 'idle',
    polygonKey: null,
  });
  const curtainMeasureStateRef = useRef<{ status: 'idle' | 'pending' | 'success' | 'error'; polygonKey: string | null }>({
    status: 'idle',
    polygonKey: null,
  });

  useEffect(() => {
    curtainMeasureStateRef.current = curtainMeasureState;
  }, [curtainMeasureState]);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Configure] phase ->', phase);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'mark') {
      // Panel will become visible when phase changes to 'ready'
      // Prepare it now for smooth slide-up entrance
      prepareConfiguratorPanelEntry(configuratorPanelRef.current);
    }
  }, [phase]);

  const [corners, setCorners] = useState<{ x: number; y: number }[] | null>(null);
  const [markPicks, setMarkPicks] = useState<{ x: number; y: number }[]>([]);
  const markNormalizedRef = useRef(false);
  const [markDragIx, setMarkDragIx] = useState<number | null>(null);
  const [flowMeasurementMeta, setFlowMeasurementMeta] = useState<FlowMeasurement | null>(null);
  const [curtainMeasureError, setCurtainMeasureError] = useState<string | null>(null);
  const measurementToastRef = useRef<string | null>(null);
  const measurementPhotoCacheRef = useRef<{ key: string | null; dataUri: string | null }>({ key: null, dataUri: null });

  const SHOULD_WARN_ON_LEAVE =
    USE_CURTAIN_FIRST_FLOW &&
    (phase !== 'idle' ||
      Boolean(file) ||
      Boolean(fileSignature) ||
      Boolean(previewUrl) ||
      Boolean(maskUrl) ||
      Boolean(corners && corners.length >= 3) ||
      Boolean(markPicks && markPicks.length >= 3));

  useConfigureGuards({
    enableBeforeUnload: SHOULD_WARN_ON_LEAVE,
    enableBackGuard: SHOULD_WARN_ON_LEAVE,
    enableIframeResize: isEmbed,
    parentOrigin: process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN ?? '*',
  });

  useEffect(() => {
    if (phase !== 'ready') {
      setCurtainMeasureState((prev) => (prev.status === 'idle' ? prev : { status: 'idle', polygonKey: null }));
      setCurtainMeasureError(null);
    }
  }, [phase]);
  useEffect(() => {
    measurementPhotoCacheRef.current = { key: null, dataUri: null };
  }, [fileSignature, previewUrl]);
  // Helper: gentle snap of the corner angle to 90° using Thales' circle projection
  const snapToRightAnglePx = useCallback((prev: {x:number;y:number}, p: {x:number;y:number}, next: {x:number;y:number}, opts?: { thresholdDeg?: number; strength?: number }) => {
    const thresholdDeg = opts?.thresholdDeg ?? 5; // snap when within 5° of 90°
    const strength = opts?.strength ?? 0.5;      // stronger, smoother pull
    const v1x = p.x - prev.x, v1y = p.y - prev.y;
    const v2x = next.x - p.x, v2y = next.y - p.y;
    const n1 = Math.hypot(v1x, v1y) || 1;
    const n2 = Math.hypot(v2x, v2y) || 1;
    const dot = (v1x / n1) * (v2x / n2) + (v1y / n1) * (v2y / n2);
    const angle = Math.acos(Math.max(-1, Math.min(1, dot))); // radians
    const devDeg = Math.abs((angle * 180) / Math.PI - 90);
    if (devDeg > thresholdDeg) return p;
    // Project p onto circle with diameter prev-next (guarantees right angle)
    const mx = (prev.x + next.x) / 2;
    const my = (prev.y + next.y) / 2;
    const r = Math.hypot(next.x - prev.x, next.y - prev.y) / 2;
    const dx = p.x - mx, dy = p.y - my;
    const d = Math.hypot(dx, dy);
    if (d < 1e-3 || r <= 0) return p;
    const proj = { x: mx + (dx / d) * r, y: my + (dy / d) * r };
    return { x: p.x + (proj.x - p.x) * strength, y: p.y + (proj.y - p.y) * strength };
  }, []);
  const rightAngleDeviation = useCallback((a: {x:number;y:number}, pivot: {x:number;y:number}, b: {x:number;y:number}) => {
    const v1x = a.x - pivot.x;
    const v1y = a.y - pivot.y;
    const v2x = b.x - pivot.x;
    const v2y = b.y - pivot.y;
    const n1 = Math.hypot(v1x, v1y);
    const n2 = Math.hypot(v2x, v2y);
    if (n1 < 1e-3 || n2 < 1e-3) return Infinity;
    const dot = (v1x / n1) * (v2x / n2) + (v1y / n1) * (v2y / n2);
    const angleDeg = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
    return Math.abs(angleDeg - 90);
  }, []);
  const maybeSnap = useCallback((pts: {x:number;y:number}[], dragIx: number, proposed: {x:number;y:number}, opts?: { thresholdDeg?: number; strength?: number }) => {
    if (pts.length !== 4) return proposed;
    const prevIx = (dragIx + 3) % 4;
    const nextIx = (dragIx + 1) % 4;
    const snapped = snapToRightAnglePx(pts[prevIx], proposed, pts[nextIx], opts);
    const candidate = pts.slice();
    candidate[dragIx] = snapped;
    const prevPrevIx = (prevIx + 3) % 4;
    const nextNextIx = (nextIx + 1) % 4;
    const threshold = opts?.thresholdDeg ?? 5;
    const devAtDrag = rightAngleDeviation(candidate[prevIx], candidate[dragIx], candidate[nextIx]);
    const devAtPrev = rightAngleDeviation(candidate[prevPrevIx], candidate[prevIx], candidate[dragIx]);
    const devAtNext = rightAngleDeviation(candidate[dragIx], candidate[nextIx], candidate[nextNextIx]);
    if (devAtDrag <= threshold && devAtPrev <= threshold && devAtNext <= threshold) {
      return snapped;
    }
    return proposed;
  }, [rightAngleDeviation, snapToRightAnglePx]);
  // On reaching 4 points the first time, normalize to rectangle once (failsafe)
  // Important: only ever run this once per marking session. Do NOT reset on later UI changes
  // like fabric selection or wall box drags; user adjustments must be preserved.
  useEffect(() => {
    if (markPicks.length !== 4) { return; }
    if (!markNormalizedRef.current) {
      const xs = markPicks.map(p => p.x);
      const ys = markPicks.map(p => p.y);
      const minX = Math.max(0, Math.min(...xs));
      const maxX = Math.min(1, Math.max(...xs));
      const minY = Math.max(0, Math.min(...ys));
      const maxY = Math.min(1, Math.max(...ys));
      const rect = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
      setMarkPicks(rect);
      markNormalizedRef.current = true;
    }
    // Keep corners in sync with current picks (so preview math can use it if needed)
    setCorners(markPicks);
  }, [markPicks, setCorners]);
  // Drag logic for mark overlay points
  useEffect(() => {
    if (phase !== 'mark' || markDragIx == null) return;
    const onMove = (e: PointerEvent) => {
      const host = imgRef.current?.getBoundingClientRect();
      if (!host) return;
      const x = (e.clientX - host.left) / Math.max(1, host.width);
      const y = (e.clientY - host.top) / Math.max(1, host.height);
      const p = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
      setMarkPicks(prev => {
        if (prev.length !== 4) return prev;
        const widthPx = Math.max(1, imgSize.w);
        const heightPx = Math.max(1, imgSize.h);
        const toPx = (q: {x:number;y:number}) => ({ x: q.x * widthPx, y: q.y * heightPx });
        const fromPx = (q: {x:number;y:number}) => ({ x: Math.max(0, Math.min(1, q.x / widthPx)), y: Math.max(0, Math.min(1, q.y / heightPx)) });
        const ptsPx = prev.map(toPx);
        const proposedPx = toPx(p);
        const snappedPx = maybeSnap(ptsPx, markDragIx, proposedPx);
        const out = prev.slice();
        out[markDragIx] = fromPx(snappedPx);
        return out;
      });
    };
    const onUp = () => setMarkDragIx(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [phase, markDragIx]);
  const [progress, setProgress] = useState<{ label: string; value: number | null } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);
  const [restoredOffline, setRestoredOffline] = useState(false);
  const [clampNotice, setClampNotice] = useState<{ type: 'height' | 'width'; message: string } | null>(null);
  const DEFAULT_TEXTURE_CANDIDATES = [
    // Serve from app public if present
    '/curtains/default_curtain.png',
    // Fallback to repo root public via API bridge
    '/api/static?p=curtains/default_curtain.png',
    '/api/static?p=originals/curtains/default_curtain.png',
  ];
  // Base texture currently shown
  const [textureUrl, setTextureUrl] = useState<string | null>(null);
  // Crossfade overlay texture for seamless swaps (also used by hover previews)
  const [crossfadeUrl, setCrossfadeUrl] = useState<string | null>(null);
  const [crossfadeActive, setCrossfadeActive] = useState(false);
  const crossfadeTokenRef = useRef(0);
  const categoryCoverTimerRef = useRef<number | null>(null);
  const lastTypeRef = useRef<string | null>(null);
  // When a click already handles swap for a specific URL, suppress the follow-up selected-effect from doing it again
  const suppressSwapUrlRef = useRef<string | null>(null);
  
  // Canvas render parameters (Task 1010+)
  // Note: jitter/taper/contrast/noise only used by procedural pipelines (tokens/translucent)
  // Artist pipeline rendering parameters
  // Apply color category preset when fabric/color/pleat changes (Task 1010+)
  useEffect(() => {
    if (!USE_CANVAS_RENDERER || !selectedChildItem) return;
    
    // Import preset helpers
    Promise.all([
      import('@/lib/canvas-renderer/color-presets'),
      import('@/lib/canvas-renderer/material-presets'),
      import('@/lib/canvas-renderer/pleating-presets'),
    ]).then(([{ getColorCategoryPreset }, { getMaterialPreset, getMaterialToken }, { getPleatingPreset }]) => {
      if (!selectedFabric) return;
      
      const colorPreset = getColorCategoryPreset(selectedFabric, selectedChildItem.color_label);
      const materialPreset = getMaterialPreset(selectedFabric.materialFamily as import('@/lib/canvas-renderer/types').MaterialFamily);
      const pleatingPreset = getPleatingPresetForMaterial(selectedFabric.materialFamily as any, selectedPleatId || 'wave');
      const materialToken = getMaterialToken(selectedFabric.materialFamily as import('@/lib/canvas-renderer/types').MaterialFamily);
      
      // Apply combined presets (user can still override via debug UI)
      handleUpdateCanvasParams({
        shadowStrength: colorPreset.shadowStrength,
        weaveStrength: materialPreset.weaveStrength,
        occlusionStrength: colorPreset.occlusionStrength,
        transmissionStrength: materialToken.transmission,
        specularStrength: materialToken.specBoost,
        artistVariant: 1,
        // Material Presets - Procedural Pipeline
        opacity: materialPreset.opacity,
        noiseStrength: materialPreset.noiseStrength,
        textureAsset: materialPreset.textureAsset,
        // Material Presets - Artist Pipeline
        highlightClamp: materialPreset.highlightClamp,
        weaveScale: materialPreset.weaveScale,
        weaveBlendMode: materialPreset.weaveBlendMode || 'multiply',
        // Color Presets
        contrastBoost: colorPreset.contrastBoost,
        // Pleating Presets
        tileWidthPx: pleatingPreset.tileWidthPx,
        heightStrength: pleatingPreset.heightStrength,
      });
      
      console.log('[Configure] Applied presets:', {
        colorCategory: selectedChildItem.colorCategory || selectedFabric.colorCategory || 'colored',
        materialFamily: selectedFabric.materialFamily || 'linen',
        pleatId: selectedPleatId,
        colorPreset,
        materialPreset,
        pleatingPreset,
        appliedParams: {
          opacity: materialPreset.opacity,
          noiseStrength: materialPreset.noiseStrength,
          weaveScale: materialPreset.weaveScale,
          transmission: materialPreset.transmission,
          shadowGain: materialPreset.shadowGain,
          highlightClamp: materialPreset.highlightClamp,
          specBoost: materialToken.specBoost,
          contrastBoost: colorPreset.contrastBoost,
          tileWidthPx: pleatingPreset.tileWidthPx,
          heightStrength: pleatingPreset.heightStrength,
        },
      });
    });
  }, [selectedFabric, selectedChildItem, selectedPleatId, USE_CANVAS_RENDERER, handleUpdateCanvasParams]);

  const [wallMaskUrl, setWallMaskUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // Fullscreen state and ref lifted here so corner drag can use correct image for coordinates
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenImgRef = useRef<HTMLImageElement | null>(null);
  const curtainHeroRef = useRef<HTMLDivElement | null>(null);
  const configuratorPanelRef = useRef<HTMLDivElement | null>(null);
  // Screenshot canvas ref for order screenshots
  const screenshotCanvasRef = useRef<ScreenshotCanvasRef>(null!);
  
  // Expose screenshot canvas globally for magento-client
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__curtainScreenshotCanvas = screenshotCanvasRef.current;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__curtainScreenshotCanvas;
      }
    };
  }, [screenshotCanvasRef.current]);
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [wallVerticalBounds, setWallVerticalBounds] = useState<{ top: number; bottom: number } | null>(null);
  // Wall-box move (via top-center handle): drag entire polygon horizontally and vertically
  const [boxDrag, setBoxDrag] = useState<
    | { startX: number; startY: number; initialCorners: { x: number; y: number }[] }
    | null
  >(null);
  const [boxHover, setBoxHover] = useState(false);
  const [dragIx, setDragIx] = useState<number | null>(null);
  const { heroStickyRef, heroStuck } = useSmartSticky({
    layoutMode,
  });
  // Simple Debug UI panel state (persisted), gated by env
  const DEBUG_UI_ENABLED = (process.env.NEXT_PUBLIC_CONFIGURE_DEBUG_UI || '').toLowerCase() === 'true' || (process.env.NEXT_PUBLIC_CONFIGURE_DEBUG_UI || '') === '1';
  const STITCH_LINES_ENV_DEFAULT = (process.env.NEXT_PUBLIC_STITCH_LINES_ENABLED ?? '1') !== '0';
  const [showDebug, setShowDebug] = useState(false);
  const [stitchLinesVisible, setStitchLinesVisible] = useState(STITCH_LINES_ENV_DEFAULT);
  const [stitchLinePointerHover, setStitchLinePointerHover] = useState(false);
  const [stitchChipHovering, setStitchChipHovering] = useState(false);
  const [stitchFlash, setStitchFlash] = useState(false);
  const [stitchNoticeMessage, setStitchNoticeMessage] = useState<string | null>(null);
  const STITCH_LINE_RGB = '255, 255, 255';
  const STITCH_LINE_BASE_OPACITY = 0.48;
  const STITCH_LINE_HITBOX_PX = 14;
  const STITCH_LINE_WIDTH_PX = 1;
  const STITCH_LINE_DASH_ON_PX = 8;
  const STITCH_LINE_DASH_OFF_PX = 8;
  const DEBUG_LS_KEY = 'cw_debug_ui_palette_v1';
  const stitchNoticeTimerRef = useRef<number | null>(null);
  const stitchHighlightTimerRef = useRef<number | null>(null);
  const lastStitchToastRef = useRef(0);
  const STITCH_COOLDOWN_MS = 3300;
  const stitchLineBackground = useMemo(
    () =>
      `repeating-linear-gradient(
        to bottom,
        rgba(${STITCH_LINE_RGB}, 1) 0,
        rgba(${STITCH_LINE_RGB}, 1) ${STITCH_LINE_DASH_ON_PX}px,
        rgba(${STITCH_LINE_RGB}, 0) ${STITCH_LINE_DASH_ON_PX}px,
        rgba(${STITCH_LINE_RGB}, 0) ${STITCH_LINE_DASH_ON_PX + STITCH_LINE_DASH_OFF_PX}px
      )`,
    [],
  );
  const [segDrag, setSegDrag] = useState<
    | { type: 'move' | 'resize-left' | 'resize-right'; index: number; startX: number; initialLayouts: { offsetPercent: number; widthPercent: number }[] }
    | null
  >(null);
  const stitchLineOpacity = useMemo(() => {
    if (segDrag) return 0;
    if (stitchFlash) return 1;
    const boosted = STITCH_LINE_BASE_OPACITY + 0.3;
    const highlightActive = stitchLinePointerHover || stitchChipHovering;
    return highlightActive ? Math.min(1, boosted) : STITCH_LINE_BASE_OPACITY;
  }, [segDrag, stitchFlash, stitchChipHovering, stitchLinePointerHover]);

  const triggerStitchNotice = useCallback(() => {
    if (typeof window === 'undefined') return;
    const now = Date.now();
    if (now - lastStitchToastRef.current < STITCH_COOLDOWN_MS) return;
    lastStitchToastRef.current = now;
    const message = t('configure.toastStitchLines');
    setStitchNoticeMessage(message);
    if (stitchNoticeTimerRef.current != null) {
      window.clearTimeout(stitchNoticeTimerRef.current);
    }
    stitchNoticeTimerRef.current = window.setTimeout(() => {
      setStitchNoticeMessage(null);
      stitchNoticeTimerRef.current = null;
    }, 3200);
    setStitchFlash(true);
    if (stitchHighlightTimerRef.current != null) {
      window.clearTimeout(stitchHighlightTimerRef.current);
    }
    stitchHighlightTimerRef.current = window.setTimeout(() => {
      setStitchFlash(false);
      stitchHighlightTimerRef.current = null;
    }, 600);
  }, [t]);

  useEffect(() => {
    if (!stitchLinesVisible) {
      setStitchLinePointerHover(false);
      setStitchChipHovering(false);
      setStitchFlash(false);
    }
  }, [stitchLinesVisible]);

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return;
      if (stitchNoticeTimerRef.current != null) {
        window.clearTimeout(stitchNoticeTimerRef.current);
        stitchNoticeTimerRef.current = null;
      }
      if (stitchHighlightTimerRef.current != null) {
        window.clearTimeout(stitchHighlightTimerRef.current);
        stitchHighlightTimerRef.current = null;
      }
    };
  }, []);
  // Allow global defaults via env for all users
  const envGet = (k: string) => (process.env[k as any] ?? '').toString();
  const envNum01 = (k: string, fb: number) => {
    const v = parseFloat(envGet(k));
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fb;
  };
  const envStr = (k: string, fb: string) => {
    const v = envGet(k);
    return v && typeof v === 'string' ? v : fb;
  };
  const defaultDebugUi = {
    handleBg: envStr('NEXT_PUBLIC_HANDLE_BG', '#e5e7eb'),
    borderHex: envStr('NEXT_PUBLIC_HANDLE_BORDER_HEX', '#000000'),
    borderOpacity: envNum01('NEXT_PUBLIC_HANDLE_BORDER_OPACITY', 0.15),
    handleOpacity: envNum01('NEXT_PUBLIC_HANDLE_OPACITY', 1),
    ringHex: envStr('NEXT_PUBLIC_RING_HEX', '#000000'),
    ringOpacity: envNum01('NEXT_PUBLIC_RING_OPACITY', 0.28),
    wallStroke: envStr('NEXT_PUBLIC_WALL_STROKE', '#e5e7eb'),
    wallStrokeOpacity: envNum01('NEXT_PUBLIC_WALL_STROKE_OPACITY', 1),
  };
  const [debugUi, setDebugUi] = useState(defaultDebugUi);
  // Load global palette once and apply (prefer app public folder; fallback to repo-root via API bridge)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tryUrls = ['/config/wall-box-pallette.json', '/api/static?p=config/wall-box-pallette.json'];
        let j: any | null = null;
        for (const u of tryUrls) {
          try {
            const r = await fetch(u, { cache: 'no-store' });
            if (r.ok) { j = await r.json(); break; }
          } catch {}
        }
        if (!j) return;
        const next = {
          handleBg: typeof j.handleBg === 'string' ? j.handleBg : defaultDebugUi.handleBg,
          borderHex: typeof j.borderHex === 'string' ? j.borderHex : defaultDebugUi.borderHex,
          borderOpacity: Number.isFinite(j.borderOpacity) ? Math.max(0, Math.min(1, j.borderOpacity)) : defaultDebugUi.borderOpacity,
          handleOpacity: Number.isFinite(j.handleOpacity) ? Math.max(0, Math.min(1, j.handleOpacity)) : defaultDebugUi.handleOpacity,
          ringHex: typeof j.ringHex === 'string' ? j.ringHex : defaultDebugUi.ringHex,
          ringOpacity: Number.isFinite(j.ringOpacity) ? Math.max(0, Math.min(1, j.ringOpacity)) : defaultDebugUi.ringOpacity,
          wallStroke: typeof j.wallStroke === 'string' ? j.wallStroke : defaultDebugUi.wallStroke,
          wallStrokeOpacity: Number.isFinite(j.wallStrokeOpacity) ? Math.max(0, Math.min(1, j.wallStrokeOpacity)) : defaultDebugUi.wallStrokeOpacity,
        } as typeof defaultDebugUi;
        if (cancelled) return;
        setDebugUi(next);
        // Apply handle/wall CSS variables for debug handles
        // NOTE: Do NOT override --cw-ring-rgb here unless DEBUG_UI_ENABLED
        // The global ring color is set in globals.css and should be palette-aware
        try {
          const root = document.documentElement;
          const hex = (s: string) => (s && s.startsWith('#') ? s : `#${s || ''}`);
          const toRgb = (h: string) => {
            const s = hex(h);
            const r = parseInt(s.slice(1, 3), 16) || 0;
            const g = parseInt(s.slice(3, 5), 16) || 0;
            const b = parseInt(s.slice(5, 7), 16) || 0;
            return `${r},${g},${b}`;
          };
          root.style.setProperty('--cw-handle-bg', String(next.handleBg));
          root.style.setProperty('--cw-handle-border', `rgba(${toRgb(next.borderHex)}, ${next.borderOpacity})`);
          root.style.setProperty('--cw-handle-opacity', String(next.handleOpacity));
          // Only override ring color when debug UI is enabled to allow palette-aware defaults
          if (DEBUG_UI_ENABLED) {
            root.style.setProperty('--cw-ring-rgb', toRgb(next.ringHex));
            root.style.setProperty('--cw-ring-opacity', String(next.ringOpacity));
          }
          root.style.setProperty('--cw-wall-stroke', String(next.wallStroke));
          root.style.setProperty('--cw-wall-stroke-opacity', String(next.wallStrokeOpacity));
        } catch {}
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Debug UI Save toggle + generated .env snippet
  const [showSave, setShowSave] = useState(false);
  const envSnippet = useMemo(() => {
    const toHex = (v: string) => (v && v.startsWith('#') ? v : `#${v || ''}`);
    return [
      `# Debug UI (handles & wall box)`,
      `NEXT_PUBLIC_HANDLE_BG=${debugUi.handleBg}`,
      `NEXT_PUBLIC_HANDLE_BORDER_HEX=${toHex(debugUi.borderHex)}`,
      `NEXT_PUBLIC_HANDLE_BORDER_OPACITY=${debugUi.borderOpacity}`,
      `NEXT_PUBLIC_HANDLE_OPACITY=${debugUi.handleOpacity}`,
      `NEXT_PUBLIC_RING_HEX=${toHex(debugUi.ringHex)}`,
      `NEXT_PUBLIC_RING_OPACITY=${debugUi.ringOpacity}`,
      `NEXT_PUBLIC_WALL_STROKE=${debugUi.wallStroke}`,
      `NEXT_PUBLIC_WALL_STROKE_OPACITY=${debugUi.wallStrokeOpacity}`,
    ].join('\n');
  }, [debugUi]);

  const activeEnvVars = useMemo(() => getActiveEnvVariables(), [phase, DEBUG_UI_ENABLED]);

  const handleUpdateDebugUi = useCallback(
    (partial: Partial<typeof defaultDebugUi>) => {
      setDebugUi((prev) => ({ ...prev, ...partial }));
    },
    []
  );

  const handleCopyEnvSnippet = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(envSnippet);
      toast.success('ENV snippet copied to clipboard');
    } catch {
      // ignore copy errors
    }
  }, [envSnippet]);

  // Lighting ROI derived from wall box corners; updated only when not dragging
  const [lightingRoi, setLightingRoi] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    if (!corners || corners.length < 3) { setLightingRoi(null); return; }
    if (dragIx != null || boxDrag != null) return; // avoid recompute during active drag
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    const minX = Math.max(0, Math.min(...xs));
    const minY = Math.max(0, Math.min(...ys));
    const maxX = Math.min(1, Math.max(...xs));
    const maxY = Math.min(1, Math.max(...ys));
    const w = Math.max(1e-3, maxX - minX);
    const h = Math.max(1e-3, maxY - minY);
    setLightingRoi({ x: minX, y: minY, w, h });
  }, [corners, dragIx, boxDrag]);

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
  // Segments: number and layouts (percent-based within wall box)
  type SegmentLayout = { offsetPercent: number; widthPercent: number };
  const [segmentCount, setSegmentCount] = useState<number>(2);
  const [segments, setSegments] = useState<SegmentLayout[]>(() => {
    const n = 2; const w = 100 / n; return Array.from({ length: n }, (_, i) => ({ offsetPercent: i * w, widthPercent: w }));
  });
  const MIN_SEG_WIDTH = 5; // percent
  const MIN_SEG_WIDTH_CM = 50; // physical minimum per segment
  const DEFAULT_SEG_GAP_PX = 100; // default visual gap between segments
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const wallBoxRef = useRef<HTMLDivElement | null>(null);
  const dropCounterRef = useRef(0);
  const lastClampToastRef = useRef<{ height: number; width: number }>({ height: 0, width: 0 });
  const clampHideTimerRef = useRef<number | null>(null);

  const notifyClamp = useCallback((type: 'height' | 'width', message: string) => {
    const now = Date.now();
    if (now - lastClampToastRef.current[type] < 5000) {
      console.debug('[clamp] notify suppressed (cooldown)', { type, message, last: lastClampToastRef.current[type], now });
      return;
    }
    lastClampToastRef.current[type] = now;
    console.debug('[clamp] notify scheduled', { type, message, now });
    setClampNotice({ type, message });
  }, [setClampNotice]);

  const clampCornersByRatio = useCallback((input: { x: number; y: number }[], ratio: number) => {
    if (ratio >= 1 || input.length === 0) return input;
    const ys = input.map((c) => c.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    if (maxY <= minY) return input;
    const centerY = (minY + maxY) / 2;
    return input.map((c) => ({
      x: c.x,
      y: centerY + (c.y - centerY) * ratio,
    }));
  }, []);

  useEffect(() => {
    if (clampNotice) {
      console.debug('[clamp] notice set', clampNotice);
    }
    if (typeof window === 'undefined') return;
    if (!clampNotice) {
      if (clampHideTimerRef.current != null) {
        window.clearTimeout(clampHideTimerRef.current);
        clampHideTimerRef.current = null;
      }
      return undefined;
    }
    if (clampHideTimerRef.current != null) {
      window.clearTimeout(clampHideTimerRef.current);
    }
    const id = window.setTimeout(() => {
      setClampNotice(null);
      clampHideTimerRef.current = null;
      console.debug('[clamp] notice cleared');
    }, 2000);
    clampHideTimerRef.current = id;
    return () => {
      window.clearTimeout(id);
      if (clampHideTimerRef.current === id) {
        clampHideTimerRef.current = null;
      }
    };
  }, [clampNotice]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) {
        try { URL.revokeObjectURL(previewUrl); } catch {}
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (maskUrl?.startsWith('blob:')) {
        try { URL.revokeObjectURL(maskUrl); } catch {}
      }
    };
  }, [maskUrl]);

  // (removed legacy preset budget chips in favor of slider)

  // Keep a ref to avoid re-running restore effect on locale changes
  // Restore segment with multi-level fallback on initial mount

  const { applySegmentResult } = useCurtainFirstRestore({
    t,
    DEBUG_UI_ENABLED,
    CONFIGURE_FLOW_MODE,
    USE_CURTAIN_FIRST_FLOW,
    CONFIGURE_FALLBACK_LATEST,
    BYPASS_LOCAL_CACHE,
    CACHE_QUOTA_BYTES,
    onCurtainFirstMissingFlow,
    invertMaskAlpha,
    setMaskUrl,
    setWallMaskUrl,
    setElapsed,
    setPhase,
    setProgress,
    setCacheNotice,
    setRestoredOffline,
    setPreviewUrl,
    setFile,
    setFileSignature,
    setMarkPicks,
    setCorners,
    setCurtainMeasureState,
    setBaseCm,
    setFlowMeasurementMeta,
    setAddToCartState,
  });

  // Segment drag handlers are defined after dims to use cm-based limits

  // Build CSS clip-path polygon from user-selected corners (normalized 0..1)
  const clipPoly = useMemo(() => {
    if (!corners || corners.length < 3) return undefined;
    const pts = corners
      .map((p) => `${(p.x * 100).toFixed(2)}% ${(p.y * 100).toFixed(2)}%`)
      .join(', ');
    return `polygon(${pts})`;
  }, [corners]);

  // Track image size for drawing polygon overlay in pixels
  useEffect(() => {
    const el = imgRef.current; if (!el) return;
    const update = () => {
      const nextW = el.clientWidth;
      const nextH = el.clientHeight;
      if (nextW <= 1 || nextH <= 1 || !Number.isFinite(nextW) || !Number.isFinite(nextH)) {
        return; // Ignore transient zero/NaN sizes during breakpoint flips
      }
      setImgSize((prev) => {
        if (prev.w === nextW && prev.h === nextH) return prev;
        return { w: nextW, h: nextH };
      });
    };
    update();
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => ro.disconnect();
  }, [previewUrl]);

  // Pre-warm artist canvas renderer for the initial visible curtain (current fabric/color/pleat).
  // This runs before the wall box reaches phase "ready" so the first visible curtain render can hit the cache.
  useEffect(() => {
    if (!USE_CANVAS_RENDERER) return;
    if (reducedData) return;
    if (!selectedFabric || !selectedChildItem || !selectedPleatId) return;
    if (imgSize.w <= 0 || imgSize.h <= 0) return;
    if (phase === 'ready') return;

    const pipeline = activeRenderPipeline;
    const canvasWidth = getCanonicalCanvasWidth(pipeline, imgSize.w, false);
    const canvasHeight = imgSize.h;
    const textureScalePx = Math.max(20, texScale);

    const baseRenderParams = canvasRenderParams;
    const effectiveRenderParams = baseRenderParams
      ? {
          ...baseRenderParams,
          // Segments disable transmission; align cache key with CanvasCurtainLayer effective params.
          transmissionStrength: 0,
        }
      : undefined;

    const config: RenderConfig = {
      pipeline,
      fabric: selectedFabric,
      colorHex: selectedChildItem.color,
      pleatId: selectedPleatId,
      canvasWidth,
      canvasHeight,
      textureScale: textureScalePx,
      backgroundSignature: 'none',
      debug: DEBUG_UI_ENABLED,
      renderParams: effectiveRenderParams,
    };

    if (renderCache.has(config)) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await renderCurtain(config);
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Configure] Pre-warm artist renderer failed', error);
        }
      } finally {
        if (cancelled && process.env.NODE_ENV !== 'production') {
          // No-op: we currently have no abort path for renderCurtain, but keep flag for future use.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    USE_CANVAS_RENDERER,
    reducedData,
    selectedFabric,
    selectedChildItem,
    selectedPleatId,
    imgSize.w,
    imgSize.h,
    texScale,
    renderPipeline,
    canvasRenderParams,
    phase,
  ]);
  
  // Pre-warm render cache with visible color variants (Task 1010+ Performance)
  useRenderPreWarming({
    enabled: USE_CANVAS_RENDERER && !!selectedFabric && !!selectedChildItem && imgSize.w > 0,
    fabric: selectedFabric,
    childItems: selectedFabric ? getChildItems(selectedFabric) : [],
    currentColor: selectedChildItem?.color_label || null,
    renderConfig: {
      pleatId: selectedPleatId || 'wave',
      canvasWidth: Math.round(imgSize.w * 0.5), // Pre-warm at typical segment width
      canvasHeight: imgSize.h,
      textureScale: Math.max(20, texScale),
      pipeline: getPipelineFromEnv(),
      debug: DEBUG_UI_ENABLED, // Optional logs when configure debug UI is enabled
      renderParams: canvasRenderParams,
    },
    maxPreWarms: 5, // Pre-warm up to 5 adjacent colors
  });

  useEffect(() => {
    if (!USE_CURTAIN_FIRST_FLOW) return;
    if (!CURTAIN_MEASUREMENT_ENABLED) return;
    const stateSnapshot = curtainMeasureStateRef.current;
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Configure] Curtain measurement check', {
        phase,
        dragIx,
        hasCorners: !!corners && corners.length,
        hasFile: !!file,
        hasPreview: !!previewUrl,
        status: stateSnapshot.status,
        polygonKey: stateSnapshot.polygonKey,
      });
    }
    if (phase !== 'ready') return;
    if (dragIx != null) return;
    if (!corners || corners.length < 3) return;
    if (!file && !previewUrl) return;

    // Skip redundant API call if we already have valid measurement from /estimate flow
    if (
      flowMeasurementMeta &&
      Number.isFinite(flowMeasurementMeta.wallWidthCm) &&
      flowMeasurementMeta.wallWidthCm > 0 &&
      Number.isFinite(flowMeasurementMeta.wallHeightCm) &&
      flowMeasurementMeta.wallHeightCm > 0
    ) {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[Configure] Curtain measurement skipped (using flow.measurement from /estimate)', {
          wallWidthCm: flowMeasurementMeta.wallWidthCm,
          wallHeightCm: flowMeasurementMeta.wallHeightCm,
          provider: flowMeasurementMeta.provider,
        });
      }
      return;
    }

    return runCurtainMeasurementOnConfigure({
      USE_CURTAIN_FIRST_FLOW,
      CONFIGURE_FLOW_MODE,
      corners,
      file,
      previewUrl,
      fileSignature,
      flowMeasurementMeta,
      curtainMeasureStateRef,
      measurementToastRef,
      measurementPhotoCacheRef,
      setBaseCm,
      setElapsed,
      setFlowMeasurementMeta,
      setCurtainMeasureState,
      setCurtainMeasureError,
      t,
    });
  }, [
    USE_CURTAIN_FIRST_FLOW,
    phase,
    dragIx,
    corners,
    file,
    previewUrl,
    fileSignature,
    flowMeasurementMeta,
    t,
  ]);

  const readyPxPts = useMemo(() => {
    if (!corners || corners.length < 3) return '';
    return corners.map(p => `${(p.x * imgSize.w)},${(p.y * imgSize.h)}`).join(' ');
  }, [corners, imgSize]);

  const wallBoxBounds = useMemo(() => {
    if (!corners || corners.length < 2) return null;
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    const minX = Math.max(0, Math.min(...xs));
    const maxX = Math.min(1, Math.max(...xs));
    const minY = Math.max(0, Math.min(...ys));
    const maxY = Math.min(1, Math.max(...ys));
    const width = Math.max(0.0001, maxX - minX);
    const height = Math.max(0.0001, maxY - minY);
    return { minX, maxX, minY, maxY, width, height };
  }, [corners]);

  // Wall box rectangle in percentages of the image, to position segments and handles inside
  const wallBoxPct = useMemo(() => {
    if (!wallBoxBounds) return { left: 0, top: 0, width: 100, height: 100 };
    return {
      left: wallBoxBounds.minX * 100,
      top: wallBoxBounds.minY * 100,
      width: wallBoxBounds.width * 100,
      height: wallBoxBounds.height * 100,
    };
  }, [wallBoxBounds]);

  // Wall box in pixel coordinates for canvas renderer (transmission effect)
  const wallBoxPixels = useMemo(() => {
    if (!wallBoxBounds || imgSize.w === 0 || imgSize.h === 0) return null;
    return {
      x: Math.round(wallBoxBounds.minX * imgSize.w),
      y: Math.round(wallBoxBounds.minY * imgSize.h),
      width: Math.round(wallBoxBounds.width * imgSize.w),
      height: Math.round(wallBoxBounds.height * imgSize.h),
    };
  }, [wallBoxBounds, imgSize]);

  const boxRatio = useMemo(() => {
    if (!wallBoxBounds) return { w: 0, h: 0 };
    return { w: wallBoxBounds.width, h: wallBoxBounds.height };
  }, [wallBoxBounds]);

  // Initialize normalized baseline when entering ready the first time
  useWallBoxBaseline({
    isReady: phase === 'ready',
    boxRatio,
    curtainHeroRef,
    configuratorPanelRef,
    baseBoxRatio,
    setBaseBoxRatio,
  });

  // Reset baseline when new image is picked or corners cleared
  useEffect(() => {
    if (!file || !previewUrl || !corners) {
      setBaseBoxRatio(null);
    }
  }, [file, previewUrl, corners]);

  // Update cm baseline from query params when present (client-only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const wStr = sp.get('w_cm') ?? sp.get('w') ?? sp.get('width');
    const hStr = sp.get('h_cm') ?? sp.get('h') ?? sp.get('height');
    const w = wStr != null ? Number(wStr) : NaN;
    const h = hStr != null ? Number(hStr) : NaN;
    setBaseCm((prev) => ({
      w: Number.isFinite(w) && w > 0 ? w : prev.w,
      h: Number.isFinite(h) && h > 0 ? h : prev.h,
    }));
  }, []);

  // Dimensions in cm scaled from base wall measurement and current wall box fractions
  const coverageRatio = useMemo(() => {
    if (!segments.length || !corners || corners.length < 3) return 0;
    const sum = segments.reduce(
      (acc, seg) => acc + Math.max(0, Math.min(seg.widthPercent, 100)),
      0,
    );
    return Math.min(1, Math.max(0.05, sum / 100));
  }, [segments, corners]);

  const MASK_HEIGHT_RATIO_MIN = 0.8;
  const MASK_HEIGHT_RATIO_MAX = 1.25;

  const dims = useMemo(() => {
    if (USE_CURTAIN_FIRST_FLOW && flowMeasurementMeta) {
      return computeCurtainFirstDims({
        flowMeasurementMeta,
        baseCm,
        baseBoxRatio,
        boxRatio,
      });
    }
    if (!corners || corners.length < 2 || boxRatio.w === 0 || boxRatio.h === 0) {
      return { wCm: baseCm.w, hCm: baseCm.h };
    }
    const widthFraction = Math.max(0, Math.min(1, boxRatio.w));
    const fullHeightFraction = Math.max(0, Math.min(1, boxRatio.h));

    // Legacy flow: preserve existing mask-only behaviour without polygon-only fallbacks.
    if (!USE_CURTAIN_FIRST_FLOW) {
      // Default: box height as a fraction of the full frame (current behaviour)
      let heightFraction = fullHeightFraction;

      // If we have reliable wall vertical bounds from the mask, reinterpret
      // the curtain box height as a fraction of the wall, not the whole frame.
      // When CURTAIN_BOX_HEIGHT_SOURCE='full', skip mask-based adjustment entirely.
      if (CURTAIN_BOX_HEIGHT_SOURCE !== 'full' && wallVerticalBounds && wallBoxBounds) {
        const wallTop = wallVerticalBounds.top;
        const wallBottom = wallVerticalBounds.bottom;
        const span = wallBottom - wallTop;
        if (span > 0.2 && span < 0.95) {
          const denom = Math.max(1e-6, span);
          const polyTopNorm = wallBoxBounds.minY;
          const polyBottomNorm = wallBoxBounds.maxY;
          const polyTopWithinWall = Math.max(0, Math.min(1, (polyTopNorm - wallTop) / denom));
          const polyBottomWithinWall = Math.max(0, Math.min(1, (polyBottomNorm - wallTop) / denom));
          const fracWall = Math.max(0, Math.min(1, polyBottomWithinWall - polyTopWithinWall));
          if (fracWall > 0) {
            if (CURTAIN_BOX_HEIGHT_SOURCE === 'mask') {
              heightFraction = fracWall;
            } else if (fullHeightFraction > 0) {
              const safeFull = Math.max(fullHeightFraction, 1e-6);
              const ratio = fracWall / safeFull;
              if (ratio >= MASK_HEIGHT_RATIO_MIN && ratio <= MASK_HEIGHT_RATIO_MAX) {
                heightFraction = fracWall;
              }
            }
          }
        }
      }

      const wCm = +(baseCm.w * widthFraction).toFixed(1);
      const hCm = +(baseCm.h * heightFraction).toFixed(1);
      return { wCm, hCm };
    }

    // Curtain-first flow: allow Stage 2 polygon fallback when mask is weak or missing.
    let polyHeightFraction: number | null = null;
    if (corners && corners.length >= 2) {
      const ys = corners.map((pt) => pt.y);
      const polyTop = Math.max(0, Math.min(1, Math.min(...ys)));
      const polyBottom = Math.max(0, Math.min(1, Math.max(...ys)));
      const spanPoly = polyBottom - polyTop;
      if (spanPoly > 0) {
        polyHeightFraction = Math.max(0, Math.min(1, spanPoly));
      }
    }

    // Default: box height as a fraction of the full frame (current behaviour)
    let heightFraction = fullHeightFraction;

    // If we have reliable wall vertical bounds from the mask, reinterpret
    // the curtain box height as a fraction of the wall, not the whole frame.
    // When CURTAIN_BOX_HEIGHT_SOURCE='full', skip mask-based adjustment entirely.
    if (CURTAIN_BOX_HEIGHT_SOURCE !== 'full' && wallVerticalBounds && wallBoxBounds) {
      const wallTop = wallVerticalBounds.top;
      const wallBottom = wallVerticalBounds.bottom;
      const span = wallBottom - wallTop;
      if (span > 0.2 && span < 0.95) {
        const denom = Math.max(1e-6, span);
        const polyTopNorm = wallBoxBounds.minY;
        const polyBottomNorm = wallBoxBounds.maxY;
        const polyTopWithinWall = Math.max(0, Math.min(1, (polyTopNorm - wallTop) / denom));
        const polyBottomWithinWall = Math.max(0, Math.min(1, (polyBottomNorm - wallTop) / denom));
        const fracWall = Math.max(0, Math.min(1, polyBottomWithinWall - polyTopWithinWall));
        if (fracWall > 0) {
          if (CURTAIN_BOX_HEIGHT_SOURCE === 'mask') {
            heightFraction = fracWall;
          } else if (fullHeightFraction > 0) {
            const safeFull = Math.max(fullHeightFraction, 1e-6);
            const ratio = fracWall / safeFull;
            if (ratio >= MASK_HEIGHT_RATIO_MIN && ratio <= MASK_HEIGHT_RATIO_MAX) {
              heightFraction = fracWall;
            } else if (polyHeightFraction != null) {
              heightFraction = polyHeightFraction;
            }
          }
        } else if (polyHeightFraction != null) {
          heightFraction = polyHeightFraction;
        }
      } else if (polyHeightFraction != null) {
        heightFraction = polyHeightFraction;
      }
    } else if (CURTAIN_BOX_HEIGHT_SOURCE !== 'full' && polyHeightFraction != null) {
      heightFraction = polyHeightFraction;
    }

    const wCm = +(baseCm.w * widthFraction).toFixed(1);
    const hCm = +(baseCm.h * heightFraction).toFixed(1);
    return { wCm, hCm };
  }, [USE_CURTAIN_FIRST_FLOW, flowMeasurementMeta, boxRatio, baseBoxRatio, corners, baseCm, wallBoxBounds, wallVerticalBounds]);

  useCurtainFirstGeometryObserver({
    DEBUG_UI_ENABLED,
    USE_CURTAIN_FIRST_FLOW,
    corners,
    dims,
    flowMeasurementMeta,
    fileSignature,
    CONFIGURE_FLOW_MODE,
    boxRatio,
    baseCm,
    wallBoxBounds,
    wallVerticalBounds,
    CURTAIN_BOX_HEIGHT_SOURCE,
    MASK_HEIGHT_RATIO_MIN,
    MASK_HEIGHT_RATIO_MAX,
    lastCurtainBoxLogRef,
  });

  const maxPanelWidthPercent = useMemo(() => {
    if (!Number.isFinite(maxPanelWidthCm) || maxPanelWidthCm === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
    if (dims.wCm <= 0) return Number.POSITIVE_INFINITY;
    return Math.max(0, (maxPanelWidthCm / dims.wCm) * 100);
  }, [maxPanelWidthCm, dims.wCm]);

  const quoteMeta = quote?.providerMetadata as Record<string, any> | undefined;
  const fabricLineItem = quote?.breakdown?.find((item) => item.id === 'fabric');
  const fabricLineMeta = fabricLineItem?.providerMetadata as Record<string, any> | undefined;
  const totalLinearMetres = typeof quoteMeta?.totalLinearCm === 'number' ? quoteMeta.totalLinearCm / 100 : null;
  const numWidths = typeof quoteMeta?.numWidths === 'number' ? quoteMeta.numWidths : null;
  const fullnessRatio = typeof quoteMeta?.fullness === 'number' ? quoteMeta.fullness : null;
  const appliedPanelWidthCm = typeof quoteMeta?.appliedPanelWidthCm === 'number' ? quoteMeta.appliedPanelWidthCm : null;
  const appliedWidthCm = typeof quoteMeta?.appliedWidthCm === 'number' ? quoteMeta.appliedWidthCm : null;
  const appliedHeightCm = typeof quoteMeta?.appliedHeightCm === 'number' ? quoteMeta.appliedHeightCm : null;
  const requestedPanelWidthCm = typeof quoteMeta?.requestedPanelWidthCm === 'number' ? quoteMeta.requestedPanelWidthCm : null;
  const widthsPerSegmentFromQuote = (quoteMeta?.widthsPerSegment || fabricLineMeta?.widthsPerSegment) as number[] | undefined;
  const segmentWidthsCmFromQuote = quoteMeta?.segmentWidthsCm as number[] | undefined;
  const stitchPositionsFromQuote = (quoteMeta?.stitchPositionsPerSegment || fabricLineMeta?.stitchPositionsPerSegment) as number[][] | undefined;
  const numWidthsUnoptimized = typeof quoteMeta?.numWidthsUnoptimized === 'number' ? quoteMeta.numWidthsUnoptimized : null;
  const materialReuseActive = quoteMeta?.materialReuseEnabled === true;
  const shrinkagePct = typeof fabricLineMeta?.shrinkagePct === 'number' ? fabricLineMeta.shrinkagePct : null;
  const repeatCm = typeof fabricLineMeta?.repeatCm === 'number' ? fabricLineMeta.repeatCm : null;
  const repeatType = typeof fabricLineMeta?.repeatType === 'string' ? fabricLineMeta.repeatType : null;
  const allowancesSummary = fabricLineMeta?.allowancesCm as { top: number; bottom: number } | undefined;
  const cutDropCm = typeof fabricLineMeta?.cutDropCm === 'number' ? fabricLineMeta.cutDropCm : null;
  const constraintsHit = quoteMeta?.constraintsHit as { width?: boolean; height?: boolean } | undefined;
  const addToCartDisabled = addToCartState.status === 'loading' || !quote || !lastConfig;

  const stitchActiveFabric = previewFabric ?? selectedFabric ?? null;

  const estimatedPanelWidthCm = useMemo(() => {
    if (typeof appliedPanelWidthCm === 'number' && Number.isFinite(appliedPanelWidthCm)) {
      return appliedPanelWidthCm;
    }
    if (typeof requestedPanelWidthCm === 'number' && Number.isFinite(requestedPanelWidthCm)) {
      return requestedPanelWidthCm;
    }
    if (segments.length > 0) {
      const firstSegment = segments[0];
      if (firstSegment && typeof firstSegment.widthPercent === 'number') {
        const width = dims.wCm * (firstSegment.widthPercent / 100);
        if (Number.isFinite(width)) return width;
      }
    }
    const fallback = dims.wCm / Math.max(1, segmentCount);
    return Number.isFinite(fallback) ? fallback : null;
  }, [appliedPanelWidthCm, requestedPanelWidthCm, dims.wCm, segments, segmentCount]);

  // Derive effective fullness and shrinkage for stitch positioning
  const stitchFullness = useMemo(() => {
    if (!stitchActiveFabric || !selectedPleatId) return fullnessRatio ?? 2.0;
    const fabricFullness = stitchActiveFabric.fullnessByPleat?.[selectedPleatId];
    if (typeof fabricFullness === 'number' && Number.isFinite(fabricFullness)) {
      return fabricFullness;
    }
    return fullnessRatio ?? 2.0;
  }, [stitchActiveFabric, selectedPleatId, fullnessRatio]);

  const stitchShrinkagePct = useMemo(() => {
    if (!stitchActiveFabric) return shrinkagePct ?? 0;
    const fabricShrinkage = stitchActiveFabric.shrinkagePct;
    if (typeof fabricShrinkage === 'number' && Number.isFinite(fabricShrinkage)) {
      return fabricShrinkage;
    }
    return shrinkagePct ?? 0;
  }, [stitchActiveFabric, shrinkagePct]);

  // Calculate widths per segment for asymmetric panels
  const stitchWidthsPerSegment = useMemo(() => {
    if (!stitchActiveFabric) return null;
    const fabricWidthCm = stitchActiveFabric.fabricWidthCm;
    if (!fabricWidthCm || !Number.isFinite(fabricWidthCm) || fabricWidthCm <= 0) {
      return null;
    }
    
    // When hovering or no quote data, estimate per segment
    const shouldEstimate = hoveredChipKey != null || !widthsPerSegmentFromQuote;
    if (!shouldEstimate && widthsPerSegmentFromQuote) {
      return widthsPerSegmentFromQuote;
    }
    
    // Calculate per segment
    const shrinkFactor = Math.max(0.5, 1 - (stitchShrinkagePct / 100));
    const fullness = Math.max(1, stitchFullness);
    const effectiveFabricWidthCm = fabricWidthCm * shrinkFactor;
    
    return segments.map(seg => {
      const segWidthCm = (seg.widthPercent / 100) * dims.wCm;
      const fabricNeededCm = segWidthCm * fullness;
      return Math.max(1, Math.ceil(fabricNeededCm / effectiveFabricWidthCm));
    });
  }, [stitchActiveFabric, hoveredChipKey, widthsPerSegmentFromQuote, segments, dims.wCm, stitchShrinkagePct, stitchFullness]);

  // Backwards compat: single value for summary display (now unused, kept for reference)
  const displayWidthsPerPanel = stitchWidthsPerSegment && stitchWidthsPerSegment.length > 0
    ? Math.max(...stitchWidthsPerSegment) 
    : null;

  const segmentWidthsForSummary = useMemo(() => {
    if (segmentWidthsCmFromQuote && segmentWidthsCmFromQuote.length > 0) {
      return segmentWidthsCmFromQuote;
    }
    if (Array.isArray(stitchWidthsPerSegment) && stitchWidthsPerSegment.length === segments.length && typeof appliedPanelWidthCm === 'number') {
      return stitchWidthsPerSegment.map((_, idx) => {
        const totalWidthsForSegment = stitchWidthsPerSegment[idx] ?? 1;
        const fabricWidth = stitchActiveFabric?.fabricWidthCm ?? 0;
        if (fabricWidth > 0) {
          return +(fabricWidth * totalWidthsForSegment).toFixed(0);
        }
        const segmentPct = segments[idx]?.widthPercent ?? 0;
        return +((appliedPanelWidthCm * (segmentPct / 100))).toFixed(0);
      });
    }
    if (!segments.length) return [];
    const totalWidth = typeof appliedWidthCm === 'number' ? appliedWidthCm : dims.wCm;
    return segments.map((seg) => +((totalWidth * (seg.widthPercent / 100))).toFixed(0));
  }, [segmentWidthsCmFromQuote, stitchWidthsPerSegment, segments, appliedPanelWidthCm, stitchActiveFabric?.fabricWidthCm, appliedWidthCm, dims.wCm]);

  const widthsPerSegmentSummary = widthsPerSegmentFromQuote && widthsPerSegmentFromQuote.length > 0
    ? widthsPerSegmentFromQuote
    : (stitchWidthsPerSegment && stitchWidthsPerSegment.length > 0 ? stitchWidthsPerSegment : null);

  // Compute effective fabric width after shrinkage and pleating for realistic stitch positioning
  const effectiveStitchWidthCm = useMemo(() => {
    if (!stitchActiveFabric) return null;
    const raw = stitchActiveFabric.fabricWidthCm;
    if (!raw || !Number.isFinite(raw) || raw <= 0) return null;
    const shrinkFactor = 1 - (stitchShrinkagePct / 100);
    const fullness = Math.max(1, stitchFullness);
    return (raw * shrinkFactor) / fullness;
  }, [stitchActiveFabric, stitchShrinkagePct, stitchFullness]);
  const clampMessage = useMemo(() => (
    typeof maxPanelWidthCm === 'number' && Number.isFinite(maxPanelWidthCm)
      ? t('configure.widthNotice', { value: Math.round(maxPanelWidthCm).toString() })
      : null
  ), [maxPanelWidthCm, t]);

  useEffect(() => {
    if (phase !== 'ready') return;
    if (!segments.length) return;
    if (!Number.isFinite(maxPanelWidthPercent) || maxPanelWidthPercent === Number.POSITIVE_INFINITY) return;

    let changed = false;
    const nextSegments = segments.map((seg) => {
      const limitedWidth = Math.min(seg.widthPercent, maxPanelWidthPercent);
      if (limitedWidth < seg.widthPercent - 1e-3) {
        changed = true;
        return { ...seg, widthPercent: limitedWidth };
      }
      return seg;
    });

    if (!changed) return;

    // Reflow segments to keep equal gaps and anchor right-most to the wall edge
    const n = nextSegments.length;
    const totalWidth = nextSegments.reduce((acc, s) => acc + Math.max(0, Math.min(100, s.widthPercent)), 0);
    const gapPct = Math.max(0, 100 - totalWidth);
    const eachGap = n > 1 ? gapPct / (n - 1) : 0;
    let offset = 0;
    const reflowed = nextSegments.map((s, i) => {
      const out = { ...s, offsetPercent: offset };
      offset += s.widthPercent;
      if (i < n - 1) offset += eachGap;
      return out;
    });

    setSegments(reflowed);

    if (segDrag && (segDrag.type === 'resize-left' || segDrag.type === 'resize-right') && typeof maxPanelWidthCm === 'number' && Number.isFinite(maxPanelWidthCm)) {
      console.debug('[clamp] effect auto-adjusted segment widths', {
        segDrag: segDrag.type,
        maxPanelWidthCm,
        maxPanelWidthPercent,
      });
      notifyClamp('width', `This fabric choice is limited to ${Math.round(maxPanelWidthCm)}cm width.`);
    }
  }, [phase, segments, maxPanelWidthPercent, maxPanelWidthCm, segDrag, notifyClamp]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedFabricId || !selectedPleatId || !selectedHemId) {
      setQuote(null);
      return undefined;
    }

    if (!corners || corners.length < 3) {
      setQuote(null);
      return undefined;
    }

    const effectiveWidth = Math.max(1, dims.wCm * Math.max(coverageRatio, 0.05));

    // Calculate per-segment widths for asymmetric panels
    const segmentWidthsCm = segments.map(seg => {
      const widthCm = (seg.widthPercent / 100) * dims.wCm;
      return Math.max(1, widthCm);
    });

    const config: CurtainConfig = {
      fabricId: selectedFabricId,
      pleatId: selectedPleatId,
      hemId: selectedHemId,
      colorId: selectedColor ?? undefined,
      widthCm: effectiveWidth,
      heightCm: Math.max(1, dims.hCm),
      segments: Math.max(1, segmentCount),
      segmentWidthsCm, // Pass individual segment widths for accurate pricing
      materialReuseEnabled: MATERIAL_REUSE_ENABLED, // Enable material reuse optimization
      services: selectedServices,
      extras: selectedColor ? { color: selectedColor, selectedChildItem: selectedChildItem } : undefined,
    };
    const nextConfig: CurtainConfig = {
      ...config,
      services: [...config.services],
    };
    const nextSignature = JSON.stringify(nextConfig);
    if (lastConfigSignature !== nextSignature) {
      setLastConfig(nextConfig);
      setLastConfigSignature(nextSignature);
      setAddToCartState((prev) => (prev.status === 'loading' ? prev : { status: 'idle' }));
    }

    const fetchQuote = async () => {
      try {
        const pricingModel = String(process.env.NEXT_PUBLIC_PRICING_MODEL ?? 'internal').toLowerCase();

        const newQuote = pricingModel === 'ridex'
          ? await provider.priceQuote(config)
          : await (async () => {
              // Get price multipliers from environment variables
              const fabricMultiplier = process.env.NEXT_PUBLIC_PRICE_FABRIC_MULTIPLIER
                ? Number(process.env.NEXT_PUBLIC_PRICE_FABRIC_MULTIPLIER)
                : 1.0;
              const laborMultiplier = process.env.NEXT_PUBLIC_PRICE_LABOR_MULTIPLIER
                ? Number(process.env.NEXT_PUBLIC_PRICE_LABOR_MULTIPLIER)
                : 1.0;
              return provider.priceQuote(config, { fabricMultiplier, laborMultiplier });
            })();
        if (!cancelled) setQuote(newQuote);
      } catch (error) {
        if (!cancelled) {
          console.error('[configure] priceQuote failed', error);
          setQuote(null);
        }
      }
    };

    void fetchQuote();
    return () => {
      cancelled = true;
    };
  }, [provider, selectedFabricId, selectedPleatId, selectedHemId, selectedServices, selectedColor, dims.wCm, dims.hCm, segmentCount, segments, coverageRatio, corners, t]);

  // Window-level pointer handlers for segment dragging (with neighbor and min-width constraints)
  useEffect(() => {
    if (!segDrag) return;
    const onMove = (e: PointerEvent) => {
      const rect = wallBoxRef.current?.getBoundingClientRect();
      if (!rect) return;
      const deltaXPercent = ((e.clientX - segDrag.startX) / Math.max(1, rect.width)) * 100;
      let finalLayouts: SegmentLayout[] | null = null;
      let fabricClamped = false;
      setSegments(() => {
        const layouts = JSON.parse(JSON.stringify(segDrag.initialLayouts)) as SegmentLayout[];
        const s = layouts[segDrag.index];
        const initial = segDrag.initialLayouts[segDrag.index];
        const prev = layouts[segDrag.index - 1];
        const next = layouts[segDrag.index + 1];
        const minLeft = prev ? prev.offsetPercent + prev.widthPercent : 0;
        const maxRight = next ? next.offsetPercent : 100;
        const span = Math.max(0, maxRight - minLeft);
        const maxWidthPct = Number.isFinite(maxPanelWidthPercent) ? Math.min(span, maxPanelWidthPercent) : span;
        const limitPct = Number.isFinite(maxPanelWidthPercent) ? maxPanelWidthPercent : null;
        const limitCm = typeof maxPanelWidthCm === 'number' && Number.isFinite(maxPanelWidthCm) ? maxPanelWidthCm : null;
        const fabricLimitActive = limitPct != null && limitPct <= span + 1e-6;
        const baseMinWidthPct =
          CONFIGURE_FLOW_MODE === 'legacy' && dims.wCm > 0
            ? (MIN_SEG_WIDTH_CM / dims.wCm) * 100
            : MIN_SEG_WIDTH;
        let minWidthPct = Math.max(MIN_SEG_WIDTH, baseMinWidthPct);
        if (Number.isFinite(maxWidthPct)) {
          minWidthPct = Math.min(minWidthPct, maxWidthPct);
        }
        if (segDrag.type === 'move') {
          const desiredLeft = initial.offsetPercent + deltaXPercent;
          const desiredRight = desiredLeft + initial.widthPercent;
          let left = desiredLeft;
          let width = initial.widthPercent;
          if (desiredLeft < minLeft) {
            const overflowL = minLeft - desiredLeft;
            left = minLeft;
            width = Math.max(width - overflowL, minWidthPct);
          }
          if (desiredRight > maxRight) {
            const overflowR = desiredRight - maxRight;
            width = Math.max(width - overflowR, minWidthPct);
            left = Math.max(minLeft, maxRight - width);
          }
          const maxAllowed = Number.isFinite(maxWidthPct) ? maxWidthPct : span;
          if (Number.isFinite(maxAllowed) && width > maxAllowed) {
            console.debug('[clamp] segment move limited by span', {
              width,
              span,
              maxAllowed,
              limitPct,
              limitCm,
              phase,
            });
            width = maxAllowed;
            left = Math.max(minLeft, Math.min(left, maxRight - width));
          }
          if (width < minWidthPct) {
            width = minWidthPct;
            left = Math.max(minLeft, Math.min(left, maxRight - width));
          }
          s.offsetPercent = left;
          s.widthPercent = width;
        } else if (segDrag.type === 'resize-right') {
          const limitRight = maxRight;
          const requestedWidthPct = initial.widthPercent + deltaXPercent;
          const requestedWidthCm = dims.wCm > 0 ? (requestedWidthPct / 100) * dims.wCm : Number.POSITIVE_INFINITY;
          const overFabricLimit = fabricLimitActive && (
            (limitPct != null && requestedWidthPct > limitPct + 1e-3)
            || (limitCm != null && requestedWidthCm > limitCm + 0.5)
          );

          if (overFabricLimit) {
            fabricClamped = true;
            console.debug('[clamp] segment resize-right over limit', {
              requestedWidthPct,
              requestedWidthCm,
              limitPct,
              limitCm,
              span,
              phase,
            });
            if (clampMessage) {
              notifyClamp('width', clampMessage);
            }
          }

          let newWidth = Math.min(requestedWidthPct, limitRight - initial.offsetPercent);
          const maxAllowed = Number.isFinite(maxWidthPct) ? maxWidthPct : limitRight - minLeft;
          if (Number.isFinite(maxAllowed)) {
            newWidth = Math.min(newWidth, maxAllowed);
          }
          newWidth = Math.max(minWidthPct, newWidth);
          s.widthPercent = newWidth;
        } else if (segDrag.type === 'resize-left') {
          const initialOffset = initial.offsetPercent;
          const initialWidth = initial.widthPercent;
          const maxLeft = initialOffset + initialWidth - minWidthPct;
          const desiredLeft = initialOffset + deltaXPercent;
          let newLeft = Math.max(minLeft, Math.min(desiredLeft, maxLeft));
          const rightEdge = initialOffset + initialWidth;
          const requestedWidthPct = rightEdge - desiredLeft;
          const requestedWidthCm = dims.wCm > 0 ? (requestedWidthPct / 100) * dims.wCm : Number.POSITIVE_INFINITY;
          const overFabricLimit = fabricLimitActive && (
            (limitPct != null && requestedWidthPct > limitPct + 1e-3)
            || (limitCm != null && requestedWidthCm > limitCm + 0.5)
          );

          if (overFabricLimit) {
            fabricClamped = true;
            console.debug('[clamp] segment resize-left over limit', {
              requestedWidthPct,
              requestedWidthCm,
              limitPct,
              limitCm,
              span,
              phase,
            });
            if (clampMessage) {
              notifyClamp('width', clampMessage);
            }
          }

          let newWidth = rightEdge - newLeft;
          const maxAllowed = Number.isFinite(maxPanelWidthPercent) ? Math.min(rightEdge - minLeft, maxPanelWidthPercent) : rightEdge - minLeft;
          if (Number.isFinite(maxAllowed) && newWidth > maxAllowed) {
            newWidth = maxAllowed;
            newLeft = rightEdge - newWidth;
          }
          if (newWidth < minWidthPct) {
            newWidth = minWidthPct;
            newLeft = Math.max(minLeft, rightEdge - newWidth);
          }
          s.offsetPercent = newLeft;
          s.widthPercent = newWidth;
        }
        finalLayouts = layouts;
        return layouts;
      });
      if (finalLayouts) {
        setSegDrag(prev => prev ? ({ ...prev, startX: e.clientX, initialLayouts: JSON.parse(JSON.stringify(finalLayouts)) }) : null);
      }
      if (fabricClamped && clampMessage && (segDrag.type === 'resize-left' || segDrag.type === 'resize-right')) {
        console.debug('[clamp] notifyClamp width (post-update)', {
          clampMessage,
          type: segDrag.type,
          dimsW: dims.wCm,
        });
      }
    };
    const onEnd = () => setSegDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [segDrag, dims.wCm, maxPanelWidthPercent, maxPanelWidthCm, clampMessage, notifyClamp]);

  // Wall-box move drag via top-center handle
  useEffect(() => {
    if (!boxDrag) return;
    const onMove = (e: PointerEvent) => {
      const host = imgRef.current?.getBoundingClientRect();
      if (!host) return;
      const dxNorm = (e.clientX - boxDrag.startX) / Math.max(1, host.width);
      const dyNorm = (e.clientY - boxDrag.startY) / Math.max(1, host.height);
      const xs0 = boxDrag.initialCorners.map((c) => c.x);
      const ys0 = boxDrag.initialCorners.map((c) => c.y);
      const minDx = -Math.min(...xs0);
      const maxDx = 1 - Math.max(...xs0);
      const minDy = -Math.min(...ys0);
      const maxDy = 1 - Math.max(...ys0);
      const dx = Math.max(minDx, Math.min(maxDx, dxNorm));
      const dy = Math.max(minDy, Math.min(maxDy, dyNorm));
      const next = boxDrag.initialCorners.map((c) => ({ x: Math.max(0, Math.min(1, c.x + dx)), y: Math.max(0, Math.min(1, c.y + dy)) }));
      setCorners(next);
    };
    const onEnd = () => { setBoxHover(false); setBoxDrag(null); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [boxDrag]);

  // Corner handle drag via window-level events (for reliable mobile touch support)
  useEffect(() => {
    if (dragIx == null) return;
    const onMove = (e: PointerEvent) => {
      // Use fullscreen image ref when in fullscreen mode, otherwise use main image ref
      const activeImgRef = isFullscreen ? fullscreenImgRef : imgRef;
      const host = activeImgRef.current?.getBoundingClientRect();
      if (!host || !corners) return;
      const x = (e.clientX - host.left) / Math.max(1, host.width);
      const y = (e.clientY - host.top) / Math.max(1, host.height);
      const p = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
      
      setCorners((prev) => {
        if (!prev) return prev;
        const widthPx = Math.max(1, imgSize.w);
        const heightPx = Math.max(1, imgSize.h);
        const pxPoints = prev.map((pt) => ({ x: pt.x * widthPx, y: pt.y * heightPx }));
        const proposedPx = { x: p.x * widthPx, y: p.y * heightPx };
        // Apply 90° snap relative to adjacent corners
        pxPoints[dragIx] = maybeSnap(pxPoints, dragIx, proposedPx);

        let didClamp = false;
        const heightLimitCm = typeof maxCurtainHeightCm === 'number' && Number.isFinite(maxCurtainHeightCm)
          ? maxCurtainHeightCm
          : null;

        if (heightLimitCm != null) {
          const proposedMinY = Math.min(...pxPoints.map((pt) => pt.y));
          const proposedMaxY = Math.max(...pxPoints.map((pt) => pt.y));
          const proposedHeightPx = proposedMaxY - proposedMinY;
          const baselineHeightRatio = baseBoxRatio?.h ?? (() => {
            const prevYs = prev.map((pt) => pt.y);
            const minPrev = Math.min(...prevYs);
            const maxPrev = Math.max(...prevYs);
            return Math.max(0.0001, maxPrev - minPrev);
          })();
          const allowedHeightRatio = (heightLimitCm / Math.max(1, baseCm.h)) * baselineHeightRatio;
          const allowedHeightPx = allowedHeightRatio * heightPx;
          if (proposedHeightPx > allowedHeightPx + 0.5) {
            didClamp = true;
            if (dragIx === 0 || dragIx === 1) {
              const currentMaxY = Math.max(...pxPoints.map((pt) => pt.y));
              const limitedY = currentMaxY - allowedHeightPx;
              pxPoints[dragIx].y = Math.max(0, Math.min(heightPx, limitedY));
            } else {
              const currentMinY = Math.min(...pxPoints.map((pt) => pt.y));
              const limitedY = currentMinY + allowedHeightPx;
              pxPoints[dragIx].y = Math.max(0, Math.min(heightPx, limitedY));
            }
          }
        }

        const next = pxPoints.map((pt) => ({
          x: Math.max(0, Math.min(1, pt.x / widthPx)),
          y: Math.max(0, Math.min(1, pt.y / heightPx)),
        }));

        if (didClamp && heightLimitCm != null) {
          notifyClamp('height', `Curtain height limited to ${Math.round(heightLimitCm)} cm for this fabric.`);
        }

        return next;
      });
    };
    const onEnd = () => setDragIx(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [dragIx, corners, imgSize, maybeSnap, maxCurtainHeightCm, baseBoxRatio, baseCm, notifyClamp, isFullscreen]);

  // Hero + summary sticky handled via shared hook

  // Apply Debug UI variables -> CSS vars via the cwDebug.set runtime helper (only when enabled)
  useEffect(() => {
    if (!DEBUG_UI_ENABLED) return;
    const hexToRgb = (hex: string): string => {
      const m = hex.trim().replace('#','');
      const n = m.length === 3 ? m.split('').map(ch => ch + ch).join('') : m;
      const r = parseInt(n.slice(0,2), 16) || 0;
      const g = parseInt(n.slice(2,4), 16) || 0;
      const b = parseInt(n.slice(4,6), 16) || 0;
      return `${r},${g},${b}`;
    };
    const ringRgb = hexToRgb(debugUi.ringHex);
    const borderRgb = hexToRgb(debugUi.borderHex);
    try {
      (window as any).cwDebug?.set({
        handleBg: debugUi.handleBg,
        handleBorder: `rgba(${borderRgb}, ${Math.max(0, Math.min(1, debugUi.borderOpacity))})`,
        handleOpacity: Math.max(0, Math.min(1, debugUi.handleOpacity)),
        ringRgb,
        ringOpacity: Math.max(0, Math.min(1, debugUi.ringOpacity)),
        wallStroke: debugUi.wallStroke,
        wallStrokeOpacity: Math.max(0, Math.min(1, debugUi.wallStrokeOpacity)),
      });
    } catch {}
  }, [DEBUG_UI_ENABLED, debugUi]);

  // Local persistence disabled: honor repo-driven global palette (public/config/wall-box-pallette.json)
  useEffect(() => {
    // intentionally no-op: we do not write to localStorage to avoid overriding global palette
  }, [debugUi]);

  // Determine the top edge orientation and background Y-offset so the tile's top aligns to it.
  const texOrient = useMemo(() => {
    if (!corners || corners.length < 2 || imgSize.w === 0 || imgSize.h === 0) {
      return { angleRad: 0, bgYOffsetPx: 0, sinA: 0, cosA: 1 } as const;
    }
    const pts = corners.map(p => ({ x: p.x * imgSize.w, y: p.y * imgSize.h }));
    // Pick the polygon edge with smallest average Y as the "top" edge
    let best = { a: 0, b: 1, avgY: Number.POSITIVE_INFINITY };
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const avgY = (pts[i].y + pts[j].y) / 2;
      if (avgY < best.avgY) best = { a: i, b: j, avgY };
    }
    const A = pts[best.a];
    const B = pts[best.b];
    const angleRad = Math.atan2(B.y - A.y, B.x - A.x);
    // rotate by -angle to bring the edge horizontal, then its Y is the constant offset
    const sinA = Math.sin(angleRad);
    const cosA = Math.cos(angleRad);
    const rotY = (x: number, y: number) => -x * sinA + y * cosA;
    const y0r = rotY(A.x, A.y);
    const y1r = rotY(B.x, B.y);
    const bgYOffsetPx = (y0r + y1r) / 2;
    return { angleRad, bgYOffsetPx, sinA, cosA } as const;
  }, [corners, imgSize]);

  // Midpoint of the top wall-box edge in image percentages (0..1)
  const topMidPct = useMemo(() => {
    if (!corners || corners.length < 2) return null;
    let best = { a: 0, b: 1, avgY: Number.POSITIVE_INFINITY };
    for (let i = 0; i < corners.length; i++) {
      const j = (i + 1) % corners.length;
      const avgY = (corners[i].y + corners[j].y) / 2;
      if (avgY < best.avgY) best = { a: i, b: j, avgY };
    }
    const A = corners[best.a];
    const B = corners[best.b];
    return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  }, [corners]);

  // Runtime debug API: expose CSS variable controls when debug UI is enabled
  // Note: Base styles and keyframes are now in globals.css (no runtime injection)
  useEffect(() => {
    if (typeof document === 'undefined' || !DEBUG_UI_ENABLED) return;
    
    try {
      const root = document.documentElement;
      const applyVars = (vars: Record<string, string | number>) => {
        Object.entries(vars || {}).forEach(([k, v]) => {
          if (k === 'ringOpacity') root.style.setProperty('--cw-ring-opacity', String(v));
          else if (k === 'ringRgb') root.style.setProperty('--cw-ring-rgb', String(v));
          else if (k === 'handleBg') root.style.setProperty('--cw-handle-bg', String(v));
          else if (k === 'handleBorder') root.style.setProperty('--cw-handle-border', String(v));
          else if (k === 'wallStroke') root.style.setProperty('--cw-wall-stroke', String(v));
          else if (k === 'handleOpacity') root.style.setProperty('--cw-handle-opacity', String(v));
          else if (k === 'wallStrokeOpacity') root.style.setProperty('--cw-wall-stroke-opacity', String(v));
          else if (k.startsWith('--')) root.style.setProperty(k, String(v));
        });
      };
      
      const w = window as any;
      w.cwDebug = w.cwDebug || {};
      w.cwDebug.set = (vars: Record<string, string | number>) => applyVars(vars);
      if (w.cwDebug && w.cwDebug.vars) applyVars(w.cwDebug.vars);
    } catch {}
  }, [DEBUG_UI_ENABLED]);
  // Utility: invert alpha channel of a PNG mask (alpha=0 -> 255, 255 -> 0)
  async function invertMaskAlpha(srcUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
          const ctx = c.getContext('2d'); if (!ctx) { reject(new Error('no ctx')); return; }
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, c.width, c.height);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            d[i + 0] = 255; d[i + 1] = 255; d[i + 2] = 255; // white
            d[i + 3] = 255 - d[i + 3]; // invert alpha
          }
          ctx.putImageData(imgData, 0, 0);
          resolve(c.toDataURL('image/png'));
        } catch (e) { reject(e as any); }
      }
      img.onerror = () => reject(new Error('mask load failed'));
      img.src = srcUrl;
    });
  }

  useEffect(() => {
    if (!wallMaskUrl) {
      setWallVerticalBounds(null);
      return;
    }
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (!width || !height) {
          setWallVerticalBounds(null);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setWallVerticalBounds(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, width, height);

        const sampleXs = [0.35, 0.45, 0.5, 0.55, 0.65];
        const tops: number[] = [];
        const bottoms: number[] = [];
        const MIN_SEG_FRAC = 0.2;
        const MAX_SEG_FRAC = 0.95;

        const isWall = (x: number, y: number): boolean => {
          const idx = (y * width + x) * 4;
          const alpha = data[idx + 3];
          return alpha >= 128;
        };

        for (const xp of sampleXs) {
          const cx = Math.max(0, Math.min(width - 1, Math.round(xp * width)));
          let bestStart = -1;
          let bestEnd = -1;
          let bestLen = 0;
          let runStart = -1;

          for (let y = 0; y < height; y += 1) {
            if (isWall(cx, y)) {
              if (runStart === -1) runStart = y;
            } else if (runStart !== -1) {
              const runEnd = y - 1;
              const len = runEnd - runStart + 1;
              if (len > bestLen) {
                bestLen = len;
                bestStart = runStart;
                bestEnd = runEnd;
              }
              runStart = -1;
            }
          }
          if (runStart !== -1) {
            const runEnd = height - 1;
            const len = runEnd - runStart + 1;
            if (len > bestLen) {
              bestLen = len;
              bestStart = runStart;
              bestEnd = runEnd;
            }
          }

          if (bestLen <= 0) continue;
          const frac = bestLen / height;
          if (frac < MIN_SEG_FRAC || frac > MAX_SEG_FRAC) continue;
          tops.push(bestStart / height);
          bottoms.push(bestEnd / height);
        }

        if (!tops.length || !bottoms.length) {
          setWallVerticalBounds(null);
          return;
        }

        const median = (values: number[]): number => {
          const sorted = [...values].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          if (sorted.length % 2 === 1) return sorted[mid];
          return (sorted[mid - 1] + sorted[mid]) / 2;
        };

        const top = median(tops);
        const bottom = median(bottoms);
        const span = bottom - top;
        if (!(span > 0.2 && span < 0.95)) {
          setWallVerticalBounds(null);
          return;
        }

        setWallVerticalBounds({ top, bottom });
      } catch {
        setWallVerticalBounds(null);
      }
    };
    img.onerror = () => {
      if (!cancelled) setWallVerticalBounds(null);
    };
    img.src = wallMaskUrl;
    return () => {
      cancelled = true;
    };
  }, [wallMaskUrl]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);

  const { run: runSegmentationJob } = useSegmentationJob({
    file,
    fileSignature,
    CONFIGURE_FLOW_MODE,
    CACHE_QUOTA_BYTES,
    INFLIGHT_TTL_MS,
    t,
    formatNumber,
    applySegmentResult,
    setBusy,
    setElapsed,
    setAttachedUrl,
    setProposalUrl,
    setProgress,
    setCacheNotice,
    setRestoredOffline,
    setMarkPicks,
    setCorners,
    setPhase,
  });

  const run = useCallback(async (opts?: { file?: File; key?: string; force?: boolean }) => {
    return runSegmentationJob(opts);
  }, [runSegmentationJob]);

  const performAddToCart = useCallback(async (totalPriceMinor?: number) => {
    if (!lastConfig) {
      toast.error(t('configure.toastNotReady'));
      return;
    }

    const isDebug = process.env.NEXT_PUBLIC_CONFIGURE_DEBUG_UI === '1';
    setAddToCartState({ status: 'loading' });

    try {
      // Generate cart item using provider (works in browser context for both mock and storefront)
      if (isDebug) {
        console.log('[Configure] Generating cart payload from provider:', {
          providerId,
          config: lastConfig,
          timestamp: new Date().toISOString()
        });
      }

      const cartItem = await provider.toCartPayload(lastConfig);

      if (isDebug) {
        console.log('[Configure] Cart item generated:', cartItem);
      }

      // Storefront mode: call Magento client to add to cart directly
      if (providerId === 'storefront') {
        if (isDebug) {
          console.log('[Configure] Storefront mode detected, adding to cart via Magento client:', {
            cartItem,
            timestamp: new Date().toISOString()
          });
        }

        // Dynamically import Magento client and builder
        const { magentoClient, buildMagentoCartItems } = await import('@/lib/magento-client');

        try {
          const magentoItems = buildMagentoCartItems(cartItem, totalPriceMinor);
          
          if (isDebug) {
            console.log('[Configure] Built Magento cart items:', magentoItems);
          }

          const result = await magentoClient.addToCart(magentoItems);

          if (isDebug) {
            console.log('[Configure] Add to cart response from Magento:', result);
          }

          setAddToCartState({ 
            status: 'success', 
            data: { 
              mode: 'storefront',
              cartItem, 
              magentoResponse: result,
            }
          });
          toast.success(t('configure.toastAdded'));
          
          // Redirect to cart after 5 seconds
          setTimeout(() => {
            // Disable beforeunload warning before redirect
            if (typeof (window as any).__cwDisableBeforeUnload === 'function') {
              (window as any).__cwDisableBeforeUnload();
            }
            const cartId = typeof localStorage !== 'undefined' ? localStorage.getItem('cart_id') : null;
            if (!STOREFRONT_CART_URL || !cartId) return;
            const href = STOREFRONT_CART_URL
              .replaceAll('{cartId}', encodeURIComponent(cartId))
              .replaceAll('{cart_id}', encodeURIComponent(cartId));
            router.push(href);
          }, 2);
        } catch (magentoError: any) {
          const message = magentoError?.message ?? t('configure.toastFailed');
          setAddToCartState({ status: 'error', message });
          toast.error(message);
          if (isDebug) {
            console.error('[Configure] Magento add to cart error:', magentoError);
          }
          throw magentoError;
        }
      } else {
        // Mock mode: show full payload for debugging
        if (isDebug) {
          console.log('[Configure] Mock mode, cart payload:', cartItem);
        }
        
        setAddToCartState({ 
          status: 'success', 
          data: {
            mode: 'mock',
            cartItem,
            note: 'Mock provider: displaying payload for debugging'
          }
        });
        toast.success(t('configure.toastAdded'));
      }
    } catch (err: any) {
      const message = err?.message ?? t('configure.toastFailed');
      setAddToCartState({ status: 'error', message });
      toast.error(message);
      
      if (isDebug) {
        console.error('[Configure] Add to cart error:', err);
      }
    }
  }, [lastConfig, providerId, provider, t]);

  const handleAddToCart = useCallback((totalPriceMinor?: number) => {
    const coveragePct = Math.round(coverageRatio * 100);
    if (coveragePct < 95 && !showCoverageWarning) {
      setPendingTotalPriceMinor(totalPriceMinor);
      setShowCoverageWarning(true);
      return;
    }
    setShowCoverageWarning(false);
    void performAddToCart(totalPriceMinor);
  }, [coverageRatio, performAddToCart, showCoverageWarning]);

  const handleCoverageConfirm = useCallback(() => {
    setShowCoverageWarning(false);
    void performAddToCart(pendingTotalPriceMinor);
    setPendingTotalPriceMinor(undefined);
  }, [performAddToCart, pendingTotalPriceMinor]);

  const handleCoverageCancel = useCallback(() => {
    setShowCoverageWarning(false);
    setPendingTotalPriceMinor(undefined);
  }, []);

  const handleResetAddToCart = useCallback(() => {
    setAddToCartState({ status: 'idle' });
  }, []);

  // Crossfade helper: overlay new texture, then promote to base
  const startCrossfade = useCallback((url: string) => {
    const token = ++crossfadeTokenRef.current;
    if (categoryCoverTimerRef.current != null) { try { window.clearTimeout(categoryCoverTimerRef.current); } catch {} categoryCoverTimerRef.current = null; }
    setCrossfadeUrl(url);
    // Next frame to ensure transition applies
    requestAnimationFrame(() => setCrossfadeActive(true));
    // After transition, promote
    window.setTimeout(() => {
      if (crossfadeTokenRef.current !== token) return;
      setTextureUrl(url);
      setCrossfadeActive(false);
      // Let opacity transition complete before clearing url (keeps paint stable)
      window.setTimeout(() => {
        if (crossfadeTokenRef.current !== token) return;
        setCrossfadeUrl(null);
      }, 30);
    }, 200);
  }, []);

  useEffect(() => {
    if (!selectedFabric) {
      // Keep previous texture to avoid flicker; initial default loader will handle blank state on first entry
      return;
    }

    // Standard color texture system
    const byColor = selectedColor ? selectedFabric.textureByColor?.[selectedColor] : null;
    const preferred = byColor || selectedFabric.textureUrl || selectedFabric.thumbnails?.[0] || null;
    // If a click already promoted/crossfaded this URL, skip to avoid double work
    if (preferred && suppressSwapUrlRef.current === preferred) {
      suppressSwapUrlRef.current = null;
      return;
    }
    const candidates: (string | null | undefined)[] = [preferred, selectedFabric.textureUrl, selectedFabric.thumbnails?.[0] || null];
    let cancelled = false;
    (async () => {
      for (const u of candidates) {
        if (!u) continue;
        const ok = await ensureImageForLegacy(u);
        if (cancelled) return;
        if (ok) {
          if (textureUrl === u) return;
          setTextureUrl(u);
          setCrossfadeUrl(null);
          setCrossfadeActive(false);
          const colors = selectedFabric.colors ?? [];
          for (const c of colors) {
            const cu = selectedFabric.textureByColor?.[c] || selectedFabric.textureUrl || selectedFabric.thumbnails?.[0] || null;
            void ensureImageForLegacy(cu);
          }
          // Prime blob URL in background (non-blocking)
          void primeBlobUrl(u);
        }
      }
      // None worked; keep previous textureUrl to avoid blank
    })();
    return () => { cancelled = true; };
  }, [selectedFabric, selectedColor, selectedChildItem, selectedPleatId, ensureImageForLegacy, textureUrl, startCrossfade]);

  useEffect(() => {
    if (!USE_CANVAS_RENDERER) return;
    // Remove any legacy asset preload links when using artist pipeline
    const links = document.querySelectorAll('link[rel="preload"][as="image"]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && (href.includes('/textures/') || href.includes('/thumbs/') || href.includes('/swatches/'))) {
        try { link.remove(); } catch {}
      }
    });
  }, [USE_CANVAS_RENDERER]);
  useEffect(() => {
    if (!selectedFabricTypeId) return;
    if (lastTypeRef.current === selectedFabricTypeId) return;
    lastTypeRef.current = selectedFabricTypeId;
    if (textureUrl) {
      setCrossfadeUrl(textureUrl);
      setCrossfadeActive(true);
      if (categoryCoverTimerRef.current != null) { try { window.clearTimeout(categoryCoverTimerRef.current); } catch {} }
      categoryCoverTimerRef.current = window.setTimeout(() => {
        setCrossfadeActive(false);
        window.setTimeout(() => setCrossfadeUrl(null), 30);
        categoryCoverTimerRef.current = null;
      }, 800);
    }
  }, [selectedFabricTypeId, textureUrl]);

  // Aggressive prefetch: warm textures for visible fabrics and all their colors with idle-queued chunks
  useEffect(() => {
    if (USE_CANVAS_RENDERER) return;
    if (!fabrics || fabrics.length === 0) return;
    const urls: string[] = [];
    const push = (u?: string | null) => { if (u) urls.push(u); };
    for (const f of fabrics) {
      // Base texture and first thumbnail
      push(f.textureUrl);
      push(f.thumbnails?.[0] ?? null);
      // All colors for every fabric (more aggressive to prevent flashes)
      const colors = f.colors ?? [];
      for (let i = 0; i < colors.length; i++) {
        const c = colors[i];
        push(f.textureByColor?.[c] || f.textureUrl || f.thumbnails?.[0] || null);
      }
    }
    // Deduplicate and remove already loaded
    const seen = new Set<string>();
    const queue = urls
      .filter((u): u is string => !!u)
      .filter((u) => {
        if (seen.has(u)) return false;
        seen.add(u);
        return !isImageLoaded(u);
      });
    if (queue.length === 0) return;

    let cancelled = false;
    let index = 0;
    const CONCURRENCY = 8;
    const pump = () => {
      if (cancelled) return;
      const slice = queue.slice(index, index + CONCURRENCY);
      index += CONCURRENCY;
      if (slice.length === 0) return;
      Promise.all(
        slice.map((u) =>
          ensureImageForLegacy(u).then((ok) => {
            if (ok) void primeBlobUrl(u);
          }),
        ),
      ).finally(() => {
        if (cancelled) return;
        if (typeof (window as any).requestIdleCallback === 'function') {
          (window as any).requestIdleCallback(pump);
        } else {
          setTimeout(pump, 0);
        }
      });
    };
    pump();
    return () => { cancelled = true; };
  }, [USE_CANVAS_RENDERER, fabrics, selectedFabricId, ensureImageForLegacy, isImageLoaded, primeBlobUrl]);

  // Height auto-clamp: run only immediately after entering ready from marking, not on later fabric swaps
  const enteredReadyOnceRef = useRef(false);
  useEffect(() => {
    if (phase === 'ready') {
      enteredReadyOnceRef.current = true;
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'ready' || !corners || !selectedFabric) return;
    if (typeof maxCurtainHeightCm !== 'number' || !Number.isFinite(maxCurtainHeightCm)) return;
    // If within limit, or user previously resized height (tracked via baseBoxRatio), do not force back to failsafe
    if (dims.hCm <= maxCurtainHeightCm + 0.5) return;
    const ratio = Math.max(0.01, maxCurtainHeightCm / Math.max(dims.hCm, 0.01));
    const adjustedCorners = clampCornersByRatio(corners, ratio);
    console.debug('[clamp] height ratio applied', {
      ratio,
      dimsHeight: dims.hCm,
      maxCurtainHeightCm,
      phase,
      corners,
      adjustedCorners,
    });
    setCorners(adjustedCorners);
  }, [phase, corners, dims.hCm, maxCurtainHeightCm, clampCornersByRatio, selectedFabric]);

  const onPick = useCallback(async (f: File) => {
    // Validate and convert image (handles HEIC conversion)
    const validation = await validateAndConvertImage(f, MAX_BYTES);
    
    if (!validation.valid) {
      toast.error(validation.message || t('configure.upload.toastTooLarge', { max: MAX_MB.toString() }));
      return;
    }

    const processedFile = validation.file!;
    const wasHEIC = f.type.includes('heic') || f.name.toLowerCase().endsWith('.heic') || f.name.toLowerCase().endsWith('.heif');
    
    // Show conversion notice for HEIC files
    if (wasHEIC && processedFile.type === 'image/jpeg') {
      toast.success('HEIC converted to JPEG');
    }
    
    setMaskUrl(null);
    setWallMaskUrl(null);
    setAttachedUrl(null);
    setProposalUrl(null);
    setElapsed(null);
    setCacheNotice(null);
    setRestoredOffline(false);
    setFile(processedFile);
    try {
      const urlResult = await createBrowserCompatibleUrl(processedFile);
      setPreviewUrl(urlResult.url);
      if (!wasHEIC) {
        toast.success(t('configure.upload.toastLoaded'));
      }
    } catch (error) {
      console.error('[configure] Failed to create preview URL for uploaded file', error);
      // Fallback to direct blob URL
      try {
        const fallbackUrl = URL.createObjectURL(processedFile);
        setPreviewUrl(fallbackUrl);
        if (!wasHEIC) {
          toast.success(t('configure.upload.toastLoaded'));
        }
      } catch {
        toast.error(t('configure.upload.toastLoadFailed'));
      }
    }
    try {
      const sig = await fingerprintBlob(processedFile);
      setFileSignature(sig);
      void run({ file: processedFile, key: sig });
    } catch (err) {
      toast.error(t('configure.upload.toastCacheReadFailed'));
    }
  }, [MAX_BYTES, MAX_MB, fingerprintBlob, run, t]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void onPick(f);
  }, [onPick]);

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const suppress = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('dragover', suppress);
    el.addEventListener('dragenter', suppress);
    el.addEventListener('dragleave', suppress);
    el.addEventListener('drop', suppress);
    return () => {
      el.removeEventListener('dragover', suppress);
      el.removeEventListener('dragenter', suppress);
      el.removeEventListener('dragleave', suppress);
      el.removeEventListener('drop', suppress);
    };
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dropCounterRef.current = 0;
    setDragActive(false);
  }, []);

  const onPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) { void onPick(f); break; }
      }
    }
  }, [onPick]);
  // Ensure default texture when entering ready phase
  // Try to resolve default curtain texture from candidates
  useEffect(() => {
    if (USE_CANVAS_RENDERER) return;
    if (phase !== 'ready' || textureUrl) return;
    let cancelled = false;
    (async () => {
      for (const url of DEFAULT_TEXTURE_CANDIDATES) {
        if (!url) continue;
        const ok = await ensureImageForLegacy(url);
        if (cancelled) return;
        if (ok) {
          startCrossfade(url);
          break;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [USE_CANVAS_RENDERER, ensureImageForLegacy, phase, startCrossfade, textureUrl]);

  // Equalize segments when count changes; also fix initial 0-gap layout once wall width is known
  useEffect(() => {
    const n = Math.max(1, Math.min(4, segmentCount));
    const wallWidthPx = (wallBoxPct.width / 100) * imgSize.w;
    if (wallWidthPx <= 0) return; // wait until image/wall box measured

    const almost = (a: number, b: number) => Math.abs(a - b) < 1e-3;
    const expectedW = 100 / n;
    const isInitialEqual = segments.length === n && segments.every((s, i) => almost(s.widthPercent, expectedW) && almost(s.offsetPercent, i * expectedW));

    // Recompute layout if count changed OR we are in the initial equal layout with no gaps
    if (segments.length !== n || (n > 1 && isInitialEqual)) {
      let gapPct = 0;
      if (n > 1) {
        const totalGapPx = DEFAULT_SEG_GAP_PX * (n - 1);
        gapPct = (totalGapPx / wallWidthPx) * 100;
      }
      const minUsable = n * MIN_SEG_WIDTH;
      if (100 - gapPct < minUsable) gapPct = Math.max(0, 100 - minUsable);
      const usablePct = 100 - gapPct;
      const eachWidth = usablePct / n;
      const eachGap = n > 1 ? gapPct / (n - 1) : 0;
      let offset = 0;
      const arr: SegmentLayout[] = [];
      for (let i = 0; i < n; i++) {
        arr.push({ offsetPercent: offset, widthPercent: eachWidth });
        offset += eachWidth;
        if (i < n - 1) offset += eachGap;
      }
      setSegments(arr);
    }
  }, [segmentCount, wallBoxPct.width, imgSize.w]);

  // Dynamic overlay/blur styles (persisted via env; defaults light/low)
  // TESTING: Mobile-first layout foundation (Task 1.4)
  const MOBILE_FIRST_TEST = isMobile; // TODO: Move to env after testing
  const heroDockedDesktop = !isMobile && phase === 'ready';

  // Extract total price from quote breakdown
  const totalPriceMinor = useMemo(() => {
    if (!quote?.breakdown) return undefined;
    const totalItem = quote.breakdown.find(item => item.type === 'total');
    return totalItem?.amountMinor;
  }, [quote]);

  const summaryProps = useMemo<CurtainSummaryShellProps>(() => ({
    isReady: phase === 'ready',
    t: t as TranslateFn,
    formatNumber,
    formatCurrency,
    summaryConfig,
    isFieldEnabled,
    selectedFabric: selectedFabric ?? null,
    selectedColor: selectedColor ?? null,
    selectedChildItem: selectedChildItem ?? null,
    selectedPleatId: selectedPleatId ?? null,
    selectedPleat: selectedPleat ?? null,
    selectedHem: selectedHem ?? null,
    quote: quote ?? null,
    segmentCount,
    segmentWidthsCmFromQuote,
    appliedHeightCm: appliedHeightCm ?? null,
    materialReuseActive,
    numWidths,
    numWidthsUnoptimized,
    cutDropCm,
    allowancesSummary,
    fullnessRatio,
    shrinkagePct,
    totalLinearMetres,
    selectedServiceObjects: selectedServiceObjects ?? [],
    providerId,
    locale,
    addToCartState,
    handleResetAddToCart,
    storefrontCartUrl,
    handleAddToCart,
    addToCartDisabled,
    debugUiEnabled: DEBUG_UI_ENABLED,
  }), [
    phase,
    t,
    formatNumber,
    formatCurrency,
    summaryConfig,
    selectedFabric,
    selectedColor,
    selectedChildItem,
    selectedPleatId,
    selectedPleat,
    selectedHem,
    selectedServiceObjects,
    quote,
    segmentCount,
    segmentWidthsCmFromQuote,
    appliedHeightCm,
    materialReuseActive,
    numWidths,
    numWidthsUnoptimized,
    cutDropCm,
    allowancesSummary,
    fullnessRatio,
    shrinkagePct,
    totalLinearMetres,
    selectedServiceObjects,
    providerId,
    locale,
    addToCartState,
    handleResetAddToCart,
    storefrontCartUrl,
    handleAddToCart,
    addToCartDisabled,
    totalPriceMinor,
    DEBUG_UI_ENABLED,
  ]);

  // Mobile uses full SummaryPanel, desktop uses CollapsibleSummary attached to Hero
  const summaryNodeMobile = <CurtainSummaryShell {...summaryProps} />;

  const collapsibleSummaryProps = useMemo<CollapsibleSummaryProps>(() => ({
    isReady: phase === 'ready',
    t: t as TranslateFn,
    formatNumber,
    formatCurrency,
    summaryConfig,
    isFieldEnabled,
    selectedChildItem: selectedChildItem ?? null,
    selectedPleatId: selectedPleatId ?? null,
    selectedPleat: selectedPleat ?? null,
    selectedHem: selectedHem ?? null,
    selectedServiceObjects: selectedServiceObjects ?? [],
    quote: quote ?? null,
    segmentCount,
    segmentWidthsCmFromQuote,
    appliedHeightCm: appliedHeightCm ?? null,
    materialReuseActive,
    numWidths,
    numWidthsUnoptimized,
    cutDropCm,
    allowancesSummary,
    fullnessRatio,
    shrinkagePct,
    totalLinearMetres,
    providerId,
    locale,
    addToCartState,
    handleResetAddToCart,
    storefrontCartUrl,
    handleAddToCart,
    addToCartDisabled,
    totalPriceMinor,
    debugUiEnabled: DEBUG_UI_ENABLED,
  }), [
    phase,
    t,
    formatNumber,
    formatCurrency,
    summaryConfig,
    selectedChildItem,
    selectedPleatId,
    selectedPleat,
    selectedHem,
    quote,
    segmentCount,
    segmentWidthsCmFromQuote,
    appliedHeightCm,
    materialReuseActive,
    numWidths,
    numWidthsUnoptimized,
    cutDropCm,
    allowancesSummary,
    fullnessRatio,
    shrinkagePct,
    totalLinearMetres,
    providerId,
    locale,
    addToCartState,
    handleResetAddToCart,
    storefrontCartUrl,
    handleAddToCart,
    addToCartDisabled,
    totalPriceMinor,
    DEBUG_UI_ENABLED,
  ]);

  const collapsibleSummaryNode = <CollapsibleSummary {...collapsibleSummaryProps} />;

  const heroSection = (
    <div
      ref={heroStickyRef}
      className={cn(
        'flex w-full flex-col gap-4 transition-transform duration-300 ease-out',
        'sticky z-20',
        isMobile ? 'top-3' : 'top-6',
        !isMobile && heroStuck && '-translate-y-1',
      )}
    >
      <CurtainPhotoHero
        className="items-stretch"
        isMobile={isMobile}
        heroDockedDesktop={heroDockedDesktop}
        heroStickyRef={heroStickyRef}
        dropRef={dropRef}
        onDrop={onDrop}
        onPaste={onPaste}
        MOBILE_FIRST_TEST={MOBILE_FIRST_TEST}
        dragActive={dragActive}
        previewUrl={previewUrl}
        t={t as TranslateFn}
        MAX_MB={MAX_MB}
        curtainHeroRef={curtainHeroRef}
        imgRef={imgRef}
        overlayRef={overlayRef}
        wallBoxRef={wallBoxRef}
        fullscreenImgRef={fullscreenImgRef}
        phase={phase}
        wallMaskUrl={wallMaskUrl}
        clipPoly={clipPoly || null}
        wallBoxPct={wallBoxPct}
        segments={segments}
        imgSize={imgSize}
        texOrient={texOrient}
        lightingEnabled={lightingEnabled}
        LIGHTING_MODE={LIGHTING_MODE}
        lighting={lighting as LightingEstimate}
        LIGHTING_OPACITY={LIGHTING_OPACITY}
        textureUrl={textureUrl}
        getRenderableUrl={getRenderableUrl}
        texScale={texScale}
        texOpacity={texOpacity}
        hoverTextureUrl={hoverTextureUrl}
        crossfadeUrl={crossfadeUrl}
        crossfadeActive={crossfadeActive}
        USE_CANVAS_RENDERER={USE_CANVAS_RENDERER}
        selectedFabric={selectedFabric}
        selectedChildItem={selectedChildItem}
        selectedPleatId={selectedPleatId}
        renderPipeline={activeRenderPipeline}
        canvasRenderParams={canvasRenderParams}
        segDrag={segDrag}
        DEBUG_UI_ENABLED={DEBUG_UI_ENABLED}
        wallBoxPixels={wallBoxPixels}
        boxHover={boxHover}
        setBoxHover={setBoxHover}
        boxDrag={boxDrag}
        setBoxDrag={setBoxDrag}
        setSegDrag={setSegDrag}
        setDragIx={setDragIx}
        dragIx={dragIx}
        corners={corners}
        dims={dims}
        formatNumber={formatNumber}
        clampNotice={clampNotice}
        stitchNoticeMessage={stitchNoticeMessage}
        stitchPositionsFromQuote={stitchPositionsFromQuote}
        stitchWidthsPerSegment={stitchWidthsPerSegment}
        stitchActiveFabric={stitchActiveFabric}
        effectiveStitchWidthCm={effectiveStitchWidthCm}
        stitchLineBackground={stitchLineBackground}
        stitchLineOpacity={stitchLineOpacity}
        stitchLinesVisible={stitchLinesVisible}
        triggerStitchNotice={triggerStitchNotice}
        STITCH_LINE_HITBOX_PX={STITCH_LINE_HITBOX_PX}
        STITCH_LINE_WIDTH_PX={STITCH_LINE_WIDTH_PX}
        materialReuseActive={materialReuseActive}
        markPicks={markPicks}
        setMarkPicks={setMarkPicks}
        setCorners={setCorners}
        markNormalizedRef={markNormalizedRef}
        setPhase={setPhase}
        markDragIx={markDragIx}
        setMarkDragIx={setMarkDragIx}
        maybeSnap={maybeSnap}
        notifyClamp={notifyClamp}
        maxCurtainHeightCm={maxCurtainHeightCm}
        baseBoxRatio={baseBoxRatio}
        baseCm={baseCm}
        topMidPct={topMidPct}
        showMask={showMask}
        maskUrl={maskUrl}
        progress={progress}
        USE_CURTAIN_FIRST_FLOW={USE_CURTAIN_FIRST_FLOW}
        curtainMeasureState={curtainMeasureState}
        curtainMeasureError={curtainMeasureError}
        readyPxPts={readyPxPts}
        isFullscreen={isFullscreen}
        setIsFullscreen={setIsFullscreen}
        screenshotCanvasRef={screenshotCanvasRef}
      />
      {/* Collapsible Summary - attached to Hero, only on desktop */}
      {!isMobile && collapsibleSummaryNode}
    </div>
  );

  const debugStack = (
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
        onUpdateDebugUi={handleUpdateDebugUi}
        envSnippet={envSnippet}
        onCopyEnvSnippet={handleCopyEnvSnippet}
        version={APP_VERSION}
        envVars={activeEnvVars}
        t={t}
        canvasRendererEnabled={USE_CANVAS_RENDERER}
        canvasDebugInfo={
          USE_CANVAS_RENDERER && selectedFabric && selectedChildItem && selectedPleatId
            ? {
                pipeline: activeRenderPipeline,
                materialFamily: selectedFabric.materialFamily,
                colorHex: selectedChildItem.color,
                colorCategory: getColorCategory(
                  selectedFabric,
                  selectedChildItem.color_label ?? undefined,
                ),
                luminance: relativeLuminance(selectedChildItem.color),
                pleatId: selectedPleatId,
              }
            : undefined
        }
        canvasRenderParams={USE_CANVAS_RENDERER ? canvasRenderParams : undefined}
        onUpdateCanvasParams={USE_CANVAS_RENDERER ? handleUpdateCanvasParams : undefined}
        pricingDiagnostics={{
          quote: quote ?? null,
          selectedFabric: selectedFabric ?? null,
          selectedPleatId: selectedPleatId ?? null,
          fabricMultiplier: process.env.NEXT_PUBLIC_PRICE_FABRIC_MULTIPLIER
            ? Number(process.env.NEXT_PUBLIC_PRICE_FABRIC_MULTIPLIER)
            : 1.0,
          laborMultiplier: process.env.NEXT_PUBLIC_PRICE_LABOR_MULTIPLIER
            ? Number(process.env.NEXT_PUBLIC_PRICE_LABOR_MULTIPLIER)
            : 1.0,
        }}
      />

      <MeasurementDiagnosticsPanel visible={DEBUG_UI_ENABLED && showDebug} />
    </>
  );

  const configuratorPanel = (DEBUG_UI_ENABLED || phase === 'ready') ? (
    <div
      ref={configuratorPanelRef}
      className={cn(
        'flex-shrink-0 w-full transition-all duration-500 ease-out',
        !isMobile && 'lg:flex-1 lg:min-w-[380px]',
      )}
    >
      <CurtainConfiguratorPanel
        isMobile={isMobile}
        isReady={phase === 'ready'}
        t={t}
        locale={locale}
        formatNumber={formatNumber}
        formatCurrency={formatCurrency}
        providerId={providerId}
        quote={quote ?? null}
        segmentCount={segmentCount}
        onSegmentCountChange={setSegmentCount}
        catalogError={catalogError}
        catalogLoading={catalogLoading}
        sectionsOrder={sectionsOrder}
        budget={{
          min: BUDGET_MIN_PLN,
          max: BUDGET_MAX_PLN,
          valueMin: budgetUiMinPln,
          valueMax: budgetUiMaxPln,
          isNoFilter: isNoFilterUi,
          isAnyPrice: isAnyPriceUi,
          setUiRange,
          commitRange,
        }}
        fabricType={{
          fabricTypes,
          selectedFabricTypeId,
          onSelect: setSelectedFabricTypeId,
          fabricCountByType,
        }}
        fabricCatalog={{
          fabrics,
          selectedFabricId,
          onSelectFabric: setSelectedFabricId,
          selectedColor,
          onSelectColor: (color: any) => setSelectedColor(color),
          onSelectChildItem: (childItem: any) => setSelectedChildItem(childItem),
          getFilteredColors,
          getChildItems,
          ensureImage,
          cancelHoverClear,
          scheduleHoverClear,
          resetHoverBaseUrl,
          setHoverTextureUrl,
          setHoveredChipKey,
          hoveredChipKey,
          setStitchChipHovering,
          availableStyles,
          fabricCountByStyle,
          selectedStyle,
          setSelectedStyle,
          availableColorCategories,
          fabricCountByColorCategory,
          selectedColorCategory,
          setSelectedColorCategory,
        }}
        pleating={{
          pleats,
          selectedPleatId,
          onSelect: setSelectedPleatId,
        }}
        hems={{
          hems,
          selectedHemId,
          onSelect: setSelectedHemId,
        }}
        services={{
          serviceOptions,
          selectedServices,
          toggleService,
          onOpenConsultation: (url: string) => setConsultUrl(url),
        }}
        onExitRequested={handleOpenExitDialog}
      />
    </div>
  ) : null;

  return (
    <WebflowLayoutStatic>
      <div id="main_content_outer">
        <ConfiguratorLayout
          ref={pageContainerRef}
          isMobile={isMobile}
          providerId={providerId}
          useMobileFirstLayout={MOBILE_FIRST_TEST}
          isExpanded={heroDockedDesktop}
        >
          <div className="mb-1 relative flex items-baseline justify-center gap-3">
            <h1 className="text-[24px] font-semibold leading-none text-center">{t('configure.title')}</h1>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 absolute right-0 top-1/2 -translate-y-1/2"
              onClick={handleOpenExitDialog}
            >
              <span className="hidden sm:inline">{t('configure.exit.buttonLabel')}</span>
              <span className="sm:hidden inline-flex items-center justify-center">
                <Camera className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">{t('configure.exit.buttonLabel')}</span>
              </span>
            </Button>
          </div>
          <p className="mt-0 mb-2 text-neutral-600 text-center">{t('configure.intro')}</p>
        {DEBUG_UI_ENABLED && cacheNotice && (
          <Banner variant={restoredOffline ? 'warning' : 'info'} className="mt-3 mb-4">
            {cacheNotice}
          </Banner>
        )}

        {DEBUG_UI_ENABLED && (
          <div className="flex gap-2 flex-wrap items-center mb-3">
            <Button variant="secondary" size="sm" onClick={() => setShowDebug((v) => !v)}>
              {showDebug ? '🛠️ Hide Debug Panel' : '🛠️ Show Debug Panel'}
            </Button>
            <span className="text-xs text-neutral-500 font-mono">{APP_VERSION}</span>
            <span className="text-xs text-neutral-500">
              {providerId === 'mock' ? t('configure.provider.mock') : t('configure.provider.storefront')}
            </span>
          </div>
        )}

        <div
          id="main_content_inner"
          className={cn('flex flex-col gap-3', !isMobile && 'gap-5')}
        >
          {isMobile ? (
            <div
              className="flex w-full flex-col gap-3"
              data-hero-layout={heroDockedDesktop ? 'docked' : 'centered'}
            >
              {heroSection}
              {debugStack}
              {configuratorPanel}
              <div className="mt-4 w-full">
                {summaryNodeMobile}
              </div>
            </div>
          ) : (
            <div
              className={cn(
                'flex flex-col w-full gap-3',
                heroDockedDesktop
                  ? 'lg:flex-row lg:items-stretch lg:gap-4'
                  : 'lg:items-center lg:gap-4 lg:justify-center',
              )}
              data-hero-layout={heroDockedDesktop ? 'docked' : 'centered'}
            >
              {/* Left column: stretches to match right column height so sticky can work */}
              <div className="flex w-full flex-col lg:w-[58%] lg:min-w-[500px] lg:flex-shrink-0">
                {heroSection}
                {debugStack}
              </div>
              {configuratorPanel}
            </div>
          )}
        </div>
      </ConfiguratorLayout>

      {phase === 'mark' && markPicks.length === 4 && isMobile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="corner-confirm-title-mobile"
          className="fixed inset-0 z-50 flex px-3 backdrop-blur-sm bg-black/45 items-end animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setMarkPicks([]);
              setCorners(null as any);
              markNormalizedRef.current = false;
            }
          }}
        >
          <div
            className="bg-active-bg border border-active-border p-4 w-full rounded-t-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.2)] animate-in duration-200 ease-out slide-in-from-bottom-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div id="corner-confirm-title-mobile" className="text-lg font-bold mb-1.5">
              {t('configure.mark.confirmed')}
            </div>
            <div className="text-sm text-neutral-600 mb-3">
              {t('configure.mark.subtitle')}
            </div>
            <div className="flex justify-end gap-2 mt-3.5">
              <Button
                variant="secondary"
                onClick={() => {
                  setMarkPicks([]);
                  setCorners(null as any);
                  markNormalizedRef.current = false;
                }}
              >
                {t('configure.mark.again')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setPhase('ready');
                }}
              >
                {t('common.yes')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {consultUrl && (
        <Dialog open={true} onClose={() => setConsultUrl(null)} title={t('configure.design.title')}>
          <div className="min-h-[420px] flex-1 bg-white">
            <iframe
              src={consultUrl}
              title="Design consultation booking"
              className="h-full w-full rounded-xl border border-neutral-200"
            />
          </div>
          <div className="mt-2.5 text-xs text-neutral-600">
            {t('configure.design.hint')}{' '}
            <a href={consultUrl} target="_blank" rel="noreferrer" className="text-active-accent">
              {t('configure.design.openNewTab')}
            </a>
            .
          </div>
        </Dialog>
      )}

      <Dialog open={exitDialogOpen} onClose={handleCloseExitDialog} title={t('configure.exit.title')}>
        <div className="text-sm text-neutral-700">{t('configure.exit.subtitle')}</div>
        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={handleCloseExitDialog}>
            {t('configure.exit.cancel')}
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={handleConfirmExit}>
            {t('configure.exit.confirm')}
          </Button>
        </div>
      </Dialog>

      <CoverageWarningDialog
        open={showCoverageWarning}
        coverageRatio={coverageRatio}
        t={t}
        formatNumber={formatNumber}
        onCancel={handleCoverageCancel}
        onConfirm={handleCoverageConfirm}
        anchorHeroRef={curtainHeroRef as unknown as React.RefObject<HTMLElement | null>}
        anchorPanelRef={configuratorPanelRef as unknown as React.RefObject<HTMLElement | null>}
      />

      <WelcomeModal
        isReady={phase === 'ready'}
        t={t}
        anchorHeroRef={curtainHeroRef as unknown as React.RefObject<HTMLElement | null>}
        anchorPanelRef={configuratorPanelRef as unknown as React.RefObject<HTMLElement | null>}
      />
      <div className="fixed bottom-2 right-2 text-xs text-neutral-400 font-mono bg-white/80 px-2 py-1 rounded shadow-sm z-50">
        {APP_VERSION}
      </div>
      </div>
    </WebflowLayoutStatic>
  );
}
