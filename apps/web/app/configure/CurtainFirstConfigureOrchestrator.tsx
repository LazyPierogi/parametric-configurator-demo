"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera } from 'lucide-react';
import { preparePageTransitionIn, prepareConfiguratorPanelEntry } from '@/lib/motion-utils';
import { useCatalogProvider } from '@/app/providers/catalog-provider';
import { useLocale } from '@/app/providers/locale-context';
import { peekFlowState, clearFlowState, type FlowMeasurement } from '@/lib/flow-state';
import { APP_VERSION } from '@/lib/version';
import { getSummaryConfig, isFieldEnabled } from '@curtain-wizard/core/src/catalog/lib/summaryConfig';
import { getConfiguratorSections, getEnabledSectionsInOrder } from '@curtain-wizard/core/src/catalog/lib/configuratorSections';
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
import type { RenderPipeline } from '@/lib/canvas-renderer';
import { CanvasCurtainLayer, TransmissionLayer } from './components/CanvasCurtainLayer';
import { useWallBoxBaseline } from './hooks/useWallBoxBaseline';
import { useCurtainFirstPhaseMachine } from './hooks/useCurtainFirstPhaseMachine';
import { logCacheHealth } from '@/lib/cache-recovery';
import { useSmartSticky } from './hooks/useSmartSticky';
import { useConfigureGuards } from './hooks/useConfigureGuards';
import { useConfigureBackEvent } from './hooks/useConfigureBackEvent';
import { useIsEmbed } from './hooks/useIsEmbed';
import { useReducedData } from './hooks/useReducedData';
import { useCurtainFirstRestore } from './hooks/useCurtainFirstRestore';
import { useSegmentationJob } from './hooks/useSegmentationJob';
import { computeCurtainFirstDims } from './lib/computeCurtainFirstDims';
import { useCurtainFirstGeometryObserver } from './hooks/useCurtainFirstGeometryObserver';
import { runCurtainMeasurementOnConfigure } from './hooks/useCurtainMeasurementOnConfigure';
import { useCurtainFirstConfigureFlags } from './hooks/useCurtainFirstConfigureFlags';
import { useCurtainFirstQuote } from './hooks/useCurtainFirstQuote';
import type { TranslateFn } from './types';
import { CurtainSummaryShell } from '@/features/configurator/components/CurtainSummaryShell';
import { CollapsibleSummary } from './components/CollapsibleSummary';
import { CurtainPhotoHero } from '@/features/configurator/components/CurtainPhotoHero';
import { CurtainConfiguratorPanel } from '@/features/configurator/components/CurtainConfiguratorPanel';
import type { ScreenshotCanvasRef } from './components/ScreenshotCanvas';
import WebflowLayoutStatic from '@/components/WebflowLayoutStatic';
import { formatCurrency, formatNumberWithLocale } from './lib/formatters';
import { maybeSnap as maybeSnapPx } from './lib/rightAngleSnap';
import { useCurtainFirstClampNotice } from './hooks/useCurtainFirstClampNotice';
import { useCurtainFirstMarkingDrag } from './hooks/useCurtainFirstMarkingDrag';
import { CurtainFirstConfigureContent } from './components/CurtainFirstConfigureContent';
import { useCurtainFirstSegmentDrag } from './hooks/useCurtainFirstSegmentDrag';
import { useCurtainFirstBoxAndCornerDrag } from './hooks/useCurtainFirstBoxAndCornerDrag';
import { useCurtainFirstHeightAutoClamp } from './hooks/useCurtainFirstHeightAutoClamp';
import { useCurtainFirstLighting } from './hooks/useCurtainFirstLighting';
import { useCurtainFirstGeometryDerived } from './hooks/useCurtainFirstGeometryDerived';
import { useCurtainFirstCanvasRenderParams } from './hooks/useCurtainFirstCanvasRenderParams';
import { useCurtainFirstCanvasInitialPrewarm, useCurtainFirstCanvasVariantPrewarm } from './hooks/useCurtainFirstCanvasPrewarming';
import { useCurtainFirstAddToCart, useCurtainFirstAddToCartState } from './hooks/useCurtainFirstAddToCart';
import { useCurtainFirstSummaryProps } from './hooks/useCurtainFirstSummaryProps';
import { useCurtainFirstHeroProps } from './hooks/useCurtainFirstHeroProps';
import { useCurtainFirstPanelProps } from './hooks/useCurtainFirstPanelProps';
import { useCurtainFirstDebugUi } from './hooks/useCurtainFirstDebugUi';
import { useCurtainFirstStitchLinesUi } from './hooks/useCurtainFirstStitchLinesUi';
import { CurtainFirstDebugStack } from './components/CurtainFirstDebugStack';
import { useCurtainFirstTexturePreviewDisabled } from './hooks/useCurtainFirstTexturePreviewDisabled';

type LightingEstimate = { cssFilter?: string; gradient?: { angleDeg: number; strength: number } } | null;

type ConfigurePageProps = {
  onCurtainFirstMissingFlow?: () => void;
};

// (CornerSelector not used in overlay flow anymore)

const STOREFRONT_CART_URL = process.env.NEXT_PUBLIC_STOREFRONT_CART_URL ?? null;

export default function CurtainFirstConfigureOrchestrator({
  onCurtainFirstMissingFlow,
}: Pick<ConfigurePageProps, 'onCurtainFirstMissingFlow'>) {
  return (
    <ConfigurePageContent
      onCurtainFirstMissingFlow={onCurtainFirstMissingFlow}
    />
  );
}

export function ConfigurePageContent({ onCurtainFirstMissingFlow }: ConfigurePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { provider, providerId } = useCatalogProvider();
  const { locale, t } = useLocale();
  const flags = useCurtainFirstConfigureFlags();
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
  const LIGHTING_MODE = flags.LIGHTING_MODE;
  const LIGHTING_OPACITY = flags.LIGHTING_OPACITY;
  const LIGHTING_GRID_X = flags.LIGHTING_GRID_X;
  const LIGHTING_GRID_Y = flags.LIGHTING_GRID_Y;
  const LIGHTING_THROTTLE_MS = flags.LIGHTING_THROTTLE_MS;
  const LIGHTING_ENABLED_ENV = flags.LIGHTING_ENABLED_ENV;
  // Material Reuse Optimization (Task 902+)
  const MATERIAL_REUSE_ENABLED = flags.MATERIAL_REUSE_ENABLED;
  const CONFIGURE_FLOW_MODE = flags.CONFIGURE_FLOW_MODE;
  const USE_CURTAIN_FIRST_FLOW = flags.USE_CURTAIN_FIRST_FLOW;
  const CURTAIN_BOX_HEIGHT_SOURCE = flags.CURTAIN_BOX_HEIGHT_SOURCE;
  const CURTAIN_MEASUREMENT_ENABLED = flags.CURTAIN_MEASUREMENT_ENABLED;
  // Canvas Rendering System (Task 1010+)
  const activeRenderPipeline: RenderPipeline = flags.activeRenderPipeline;
  const USE_CANVAS_RENDERER = flags.USE_CANVAS_RENDERER;
  if (process.env.NODE_ENV !== 'production') {
    // One-time mount log for fast triage
    console.info('[Configure] Mount flags', {
      USE_CANVAS_RENDERER,
      CONFIGURE_FLOW_MODE,
      NEXT_PUBLIC_TEXTURES_PIPELINE: process.env.NEXT_PUBLIC_TEXTURES_PIPELINE,
    });
  }
  const reducedData = useReducedData();
  // Optional: allow fallback to latest cached segment when no flow state
  const CONFIGURE_FALLBACK_LATEST = flags.CONFIGURE_FALLBACK_LATEST;

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

  const summaryFieldsEnv = process.env.NEXT_PUBLIC_SUMMARY_FIELDS;
  const summaryConfig = useMemo(() => getSummaryConfig(summaryFieldsEnv), [summaryFieldsEnv]);
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
  const { ensureImage, getRenderableUrl } = useCurtainFirstTexturePreviewDisabled();

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
  } = useCatalogOptions({ provider, providerId, filter: catalogFilter, ensureImage, t });
  useEffect(() => { setSelectedFabric(selectedFabric) }, [selectedFabric]);
  
  // Device capabilities (proper detection, not pixel-based!)
  const { useCompactLayout, hasTouch, hasHover, isSmallScreen } = useDeviceCapabilities();
  const isMobile = useCompactLayout; // Legacy compat - will refactor consumers gradually
  const layoutMode: 'desktop' | 'compact' = isMobile ? 'compact' : 'desktop';
  
  const [consultUrl, setConsultUrl] = useState<string | null>(null);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const { addToCartState, setAddToCartState } = useCurtainFirstAddToCartState();
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
  // Use hovered fabric's defaults on preview; fall back to selected fabric
  const previewFabric = useMemo(() => selectedFabric ?? null, [selectedFabric]);
  // Texture defaults: use presets if available (canvas renderer), otherwise fall back to catalog textureDefaults

  const { canvasRenderParams, handleUpdateCanvasParams, texScale, texOpacity } = useCurtainFirstCanvasRenderParams({
    USE_CANVAS_RENDERER,
    previewFabric,
    selectedChildItem,
    selectedPleatId,
  });

  // UI cue: highlight the hovered color chip so users know only chips trigger previews
  const [hoveredChipKey, setHoveredChipKey] = useState<string | null>(null);

  // Note: Device capability detection now handled by useDeviceCapabilities hook
  // (removed old resize listener for pixel-based isMobile)

  const runRef = useRef<
    ((opts?: { file?: File; key?: string; force?: boolean }) => Promise<void> | void) | null
  >(null);
  const {
    file,
    setFile,
    fileSignature,
    setFileSignature,
    previewUrl,
    setPreviewUrl,
    maskUrl,
    setMaskUrl,
    wallMaskUrl,
    setWallMaskUrl,
    attachedUrl,
    setAttachedUrl,
    proposalUrl,
    setProposalUrl,
    busy,
    setBusy,
    elapsed,
    setElapsed,
    showMask,
    setShowMask,
    phase,
    setPhase,
    progress,
    setProgress,
    dragActive,
    cacheNotice,
    setCacheNotice,
    restoredOffline,
    setRestoredOffline,
    dropRef,
    onDrop,
    onPaste,
  } = useCurtainFirstPhaseMachine({
    t: t as TranslateFn,
    MAX_BYTES,
    MAX_MB,
    runRef,
  });
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

  const imgRef = useRef<HTMLImageElement | null>(null);
  // Fullscreen state and ref lifted here so corner drag can use correct image for coordinates
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenImgRef = useRef<HTMLImageElement | null>(null);
  const curtainHeroRef = useRef<HTMLDivElement | null>(null);
  const configuratorPanelRef = useRef<HTMLDivElement | null>(null);
  const [curtainPainted, setCurtainPainted] = useState(false);
  const prevPhaseRef = useRef(phase);
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

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (phase === 'ready' && prev !== 'ready') {
      setCurtainPainted(false);
    }
    if (phase !== 'ready' && prev === 'ready') {
      setCurtainPainted(false);
    }
  }, [phase]);

  const handleCurtainPainted = useCallback(() => {
    setCurtainPainted(true);
  }, []);

  const readyForPanels = phase === 'ready' && (isMobile || !USE_CANVAS_RENDERER || curtainPainted);

  const { clampNotice, notifyClamp } = useCurtainFirstClampNotice();
  const maybeSnap = useCallback(
    (
      points: { x: number; y: number }[],
      dragIndex: number,
      proposed: { x: number; y: number },
      options?: { thresholdDeg?: number; strength?: number },
    ) => maybeSnapPx(points, dragIndex, proposed, options),
    [],
  );

  useCurtainFirstMarkingDrag({
    phase,
    imgRef,
    imgSize,
    markPicks,
    setMarkPicks,
    markNormalizedRef,
    setCorners,
    markDragIx,
    setMarkDragIx,
  });
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
  const [showDebug, setShowDebug] = useState(false);
  const [segDrag, setSegDrag] = useState<
    | { type: 'move' | 'resize-left' | 'resize-right'; index: number; startX: number; initialLayouts: { offsetPercent: number; widthPercent: number }[] }
    | null
  >(null);
  const {
    debugUi,
    showSave,
    setShowSave,
    envSnippet,
    activeEnvVars,
    handleUpdateDebugUi,
    handleCopyEnvSnippet,
  } = useCurtainFirstDebugUi({ DEBUG_UI_ENABLED, phase });

  const {
    stitchLinesVisible,
    setStitchLinesVisible,
    setStitchChipHovering,
    stitchNoticeMessage,
    stitchLineBackground,
    stitchLineOpacity,
    triggerStitchNotice,
    STITCH_LINE_HITBOX_PX,
    STITCH_LINE_WIDTH_PX,
  } = useCurtainFirstStitchLinesUi({ t: t as TranslateFn, segDrag });

  const { lightingEnabled, lightingRoi, lighting } = useCurtainFirstLighting({
    previewUrl,
    fileSignature,
    corners,
    dragIx,
    boxDragActive: boxDrag != null,
    reducedData,
    LIGHTING_ENABLED_ENV,
    LIGHTING_MODE,
    LIGHTING_OPACITY,
    LIGHTING_GRID_X,
    LIGHTING_GRID_Y,
    LIGHTING_THROTTLE_MS,
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
  const geometry = useCurtainFirstGeometryDerived({ corners, segments, imgSize });
  const clipPoly = geometry.clipPoly;

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
  useCurtainFirstCanvasInitialPrewarm({
    USE_CANVAS_RENDERER,
    reducedData,
    selectedFabric,
    selectedChildItem,
    selectedPleatId,
    imgSize,
    phase,
    activeRenderPipeline,
    texScale,
    canvasRenderParams,
    DEBUG_UI_ENABLED,
  });
  
  // Pre-warm render cache with visible color variants (Task 1010+ Performance)
  useCurtainFirstCanvasVariantPrewarm({
    USE_CANVAS_RENDERER,
    selectedFabric,
    selectedChildItem,
    selectedPleatId,
    imgSize,
    activeRenderPipeline,
    texScale,
    canvasRenderParams,
    DEBUG_UI_ENABLED,
    getChildItems,
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

  const readyPxPts = geometry.readyPxPts;

  const wallBoxBounds = geometry.wallBoxBounds;

  // Wall box rectangle in percentages of the image, to position segments and handles inside
  const wallBoxPct = geometry.wallBoxPct;

  // Wall box in pixel coordinates for canvas renderer (transmission effect)
  const wallBoxPixels = geometry.wallBoxPixels;

  const boxRatio = geometry.boxRatio;

  // Initialize normalized baseline when entering ready the first time
  useWallBoxBaseline({
    isReady: readyForPanels,
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
  const coverageRatio = geometry.coverageRatio;

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

  const { quote, lastConfig } = useCurtainFirstQuote({
    provider,
    selectedFabricId,
    selectedPleatId,
    selectedHemId,
    selectedServices,
    selectedColor,
    selectedChildItem,
    dims,
    coverageRatio,
    segmentCount,
    segments,
    corners,
    materialReuseEnabled: MATERIAL_REUSE_ENABLED,
    setAddToCartState,
  });

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
  const canAddToCart = !!quote && !!lastConfig;

  const {
    showCoverageWarning,
    addToCartDisabled,
    handleAddToCart,
    handleResetAddToCart,
    handleCoverageConfirm,
    handleCoverageCancel,
  } = useCurtainFirstAddToCart({
    provider,
    providerId,
    lastConfig,
    coverageRatio,
    canAddToCart,
    t: t as TranslateFn,
    routerPush: (href) => router.push(href),
    addToCartState,
    setAddToCartState,
  });

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

  useCurtainFirstSegmentDrag({
    phase,
    segments,
    setSegments,
    segDrag,
    setSegDrag,
    wallBoxRef,
    dims,
    maxPanelWidthPercent,
    maxPanelWidthCm: maxPanelWidthCm ?? null,
    MIN_SEG_WIDTH,
    DEFAULT_SEG_GAP_PX,
    segmentCount,
    wallBoxWidthPct: wallBoxPct.width,
    imgWidthPx: imgSize.w,
    clampMessage,
    notifyClamp,
  });

  useCurtainFirstBoxAndCornerDrag({
    imgRef,
    fullscreenImgRef,
    isFullscreen,
    imgSize,
    corners,
    setCorners,
    boxDrag,
    setBoxDrag,
    setBoxHover,
    dragIx,
    setDragIx,
    maxCurtainHeightCm: maxCurtainHeightCm ?? null,
    baseBoxRatio,
    baseCm,
    notifyClamp,
  });

  useCurtainFirstHeightAutoClamp({
    phase,
    corners,
    setCorners,
    dims,
    maxCurtainHeightCm: maxCurtainHeightCm ?? null,
    selectedFabric,
  });

  // Hero + summary sticky handled via shared hook

  // Determine the top edge orientation and background Y-offset so the tile's top aligns to it.
  const texOrient = geometry.texOrient;

  // Midpoint of the top wall-box edge in image percentages (0..1)
  const topMidPct = geometry.topMidPct;
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

  runRef.current = run;

  // Dynamic overlay/blur styles (persisted via env; defaults light/low)
  // TESTING: Mobile-first layout foundation (Task 1.4)
  const MOBILE_FIRST_TEST = isMobile; // TODO: Move to env after testing
  const heroDockedDesktop = !isMobile && readyForPanels;

  const { summaryProps, collapsibleSummaryProps } = useCurtainFirstSummaryProps({
    isReady: readyForPanels,
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
  });

  // Mobile uses full SummaryPanel, desktop uses CollapsibleSummary attached to Hero
  const summaryNodeMobile = <CurtainSummaryShell {...summaryProps} />;
  const collapsibleSummaryNode = <CollapsibleSummary {...collapsibleSummaryProps} />;

  const heroProps = useCurtainFirstHeroProps({
    className: 'items-stretch',
    isMobile,
    heroDockedDesktop,
    heroStickyRef,
    dropRef,
    onDrop,
    onPaste,
    MOBILE_FIRST_TEST,
    dragActive,
    previewUrl,
    t: t as TranslateFn,
    MAX_MB,
    curtainHeroRef,
    imgRef,
    overlayRef,
    wallBoxRef,
    fullscreenImgRef,
    onCurtainPainted: handleCurtainPainted,
    phase,
    wallMaskUrl,
    clipPoly: clipPoly || null,
    wallBoxPct,
    segments,
    imgSize,
    texOrient,
    lightingEnabled,
    LIGHTING_MODE,
    lighting: lighting as LightingEstimate,
    LIGHTING_OPACITY,
    getRenderableUrl,
    texScale,
    texOpacity,
    USE_CANVAS_RENDERER,
    selectedFabric,
    selectedChildItem,
    selectedPleatId,
    renderPipeline: activeRenderPipeline,
    canvasRenderParams,
    segDrag,
    DEBUG_UI_ENABLED,
    wallBoxPixels,
    boxHover,
    setBoxHover,
    boxDrag,
    setBoxDrag,
    setSegDrag,
    setDragIx,
    dragIx,
    corners,
    dims,
    formatNumber,
    clampNotice,
    stitchNoticeMessage,
    stitchPositionsFromQuote,
    stitchWidthsPerSegment,
    stitchActiveFabric,
    effectiveStitchWidthCm,
    stitchLineBackground,
    stitchLineOpacity,
    stitchLinesVisible,
    triggerStitchNotice,
    STITCH_LINE_HITBOX_PX,
    STITCH_LINE_WIDTH_PX,
    materialReuseActive,
    markPicks,
    setMarkPicks,
    setCorners,
    markNormalizedRef,
    setPhase,
    markDragIx,
    setMarkDragIx,
    maybeSnap,
    notifyClamp,
    maxCurtainHeightCm,
    baseBoxRatio,
    baseCm,
    topMidPct,
    showMask,
    maskUrl,
    progress,
    USE_CURTAIN_FIRST_FLOW,
    curtainMeasureState,
    curtainMeasureError,
    readyPxPts,
    isFullscreen,
    setIsFullscreen,
    screenshotCanvasRef,
  });

  const panelProps = useCurtainFirstPanelProps({
    isMobile,
    isReady: phase === 'ready',
    t,
    locale,
    formatNumber,
    formatCurrency,
    providerId,
    quote: quote ?? null,
    segmentCount,
    onSegmentCountChange: setSegmentCount,
    catalogError,
    catalogLoading,
    sectionsOrder,
    BUDGET_MIN_PLN,
    BUDGET_MAX_PLN,
    budgetUiMinPln,
    budgetUiMaxPln,
    isNoFilterUi,
    isAnyPriceUi,
    setUiRange,
    commitRange,
    fabricTypes,
    selectedFabricTypeId,
    setSelectedFabricTypeId,
    fabricCountByType,
    fabrics,
    selectedFabricId,
    setSelectedFabricId: setSelectedFabricId as any,
    selectedColor,
    setSelectedColor,
    setSelectedChildItem,
    getFilteredColors,
    getChildItems,
    ensureImage,
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
    pleats,
    selectedPleatId,
    setSelectedPleatId,
    hems,
    selectedHemId,
    setSelectedHemId,
    serviceOptions,
    selectedServices,
    toggleService,
    setConsultUrl,
    handleOpenExitDialog,
  });

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
      <CurtainPhotoHero {...heroProps} />
      {/* Collapsible Summary - attached to Hero, only on desktop */}
      {!isMobile && collapsibleSummaryNode}
    </div>
  );

  const debugStack = (
    <CurtainFirstDebugStack
      phase={phase}
      DEBUG_UI_ENABLED={DEBUG_UI_ENABLED}
      showDebug={showDebug}
      setShowDebug={setShowDebug}
      showSave={showSave}
      setShowSave={setShowSave}
      stitchLinesVisible={stitchLinesVisible}
      setStitchLinesVisible={setStitchLinesVisible}
      debugUi={debugUi}
      onUpdateDebugUi={handleUpdateDebugUi}
      envSnippet={envSnippet}
      onCopyEnvSnippet={handleCopyEnvSnippet}
      version={APP_VERSION}
      envVars={activeEnvVars}
      t={t as TranslateFn}
      canvasRendererEnabled={USE_CANVAS_RENDERER}
      activeRenderPipeline={activeRenderPipeline}
      selectedFabric={selectedFabric ?? null}
      selectedChildItem={selectedChildItem ?? null}
      selectedPleatId={selectedPleatId ?? null}
      canvasRenderParams={canvasRenderParams}
      onUpdateCanvasParams={handleUpdateCanvasParams}
      quote={quote ?? null}
      priceFabricMultiplierEnv={process.env.NEXT_PUBLIC_PRICE_FABRIC_MULTIPLIER}
      priceLaborMultiplierEnv={process.env.NEXT_PUBLIC_PRICE_LABOR_MULTIPLIER}
    />
  );

  const configuratorPanel = (DEBUG_UI_ENABLED || readyForPanels) ? (
    <div
      ref={configuratorPanelRef}
      className={cn(
        'flex-shrink-0 w-full transition-all duration-500 ease-out',
        !isMobile && 'lg:flex-1 lg:min-w-[380px]',
      )}
    >
      <CurtainConfiguratorPanel {...panelProps} />
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

        <CurtainFirstConfigureContent
          isMobile={isMobile}
          heroDockedDesktop={heroDockedDesktop}
          heroSection={heroSection}
          debugStack={debugStack}
          configuratorPanel={configuratorPanel}
          summaryNodeMobile={summaryNodeMobile}
        />
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
        isReady={readyForPanels}
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
