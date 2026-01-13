'use client';

import type { ClipboardEvent, Dispatch, DragEvent, MutableRefObject, RefObject, SetStateAction } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Spinner } from '@/components/ui/Spinner';
import { Toast } from '@/components/ui/Toast';
import { UploadDropzone } from '@/components/ui/UploadDropzone';
import { FullscreenPhotoViewer } from '@/components/ui/FullscreenPhotoViewer';
import { cn } from '@/lib/utils';
import { motionTokens, getAdjustedDuration, getConfigureEntryDurationMs } from '@/lib/motion-utils';
import type { RenderPipeline } from '@/lib/canvas-renderer';
import { CanvasCurtainLayer, TransmissionLayer } from './CanvasCurtainLayer';
import { ScreenshotCanvas, type ScreenshotCanvasRef } from './ScreenshotCanvas';
import type { ChildItem, Fabric } from '@curtain-wizard/core/src/catalog/types';

type HeroPoint = { x: number; y: number };
type SegmentLayout = { offsetPercent: number; widthPercent: number };
type SegmentDragState =
  | { type: 'move' | 'resize-left' | 'resize-right'; index: number; startX: number; initialLayouts: SegmentLayout[] }
  | null;
type BoxDragState = { startX: number; startY: number; initialCorners: HeroPoint[] } | null;
type LightingEstimate = { cssFilter?: string; gradient?: { angleDeg: number; strength: number } } | null;
type CanvasRenderParams = {
  shadowStrength: number;
  weaveStrength: number;
  occlusionStrength: number;
  transmissionStrength?: number;
  specularStrength?: number;
  artistVariant?: number;
  textureScale?: number;
  opacity?: number;
  noiseStrength?: number;
  textureAsset?: string;
  highlightClamp?: number;
  weaveScale?: number;
  weaveBlendMode?: 'multiply' | 'overlay';
  contrastBoost?: number;
  tileWidthPx?: number;
  heightStrength?: number;
};
type ClampNotice = { type: 'height' | 'width'; message: string } | null;
type MeasurementState = { status: 'idle' | 'pending' | 'success' | 'error'; polygonKey: string | null };
type ProgressState = { label: string; value: number | null } | null;
type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export type HeroSurfaceProps = {
  isMobile: boolean;
  heroDockedDesktop: boolean;
  dropRef: RefObject<HTMLDivElement | null>;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLDivElement>) => void;
  MOBILE_FIRST_TEST: boolean;
  dragActive: boolean;
  previewUrl: string | null;
  t: TranslateFn;
  MAX_MB: number;
  curtainHeroRef: RefObject<HTMLDivElement | null>;
  imgRef: RefObject<HTMLImageElement | null>;
  phase: 'idle' | 'segmenting' | 'mark' | 'ready' | 'restoring';
  overlayRef: RefObject<HTMLDivElement | null>;
  wallMaskUrl: string | null;
  clipPoly: string | null;
  wallBoxPct: { left: number; top: number; width: number; height: number };
  wallBoxRef: RefObject<HTMLDivElement | null>;
  segments: SegmentLayout[];
  imgSize: { w: number; h: number };
  texOrient: { angleRad: number; bgYOffsetPx: number; sinA: number; cosA: number };
  lightingEnabled: boolean;
  LIGHTING_MODE: 'off' | 'lite' | 'enhanced';
  lighting: LightingEstimate;
  LIGHTING_OPACITY: number;
  textureUrl: string | null;
  getRenderableUrl: (url?: string | null) => string | null;
  texScale: number;
  texOpacity: number;
  hoverTextureUrl: string | null;
  crossfadeUrl: string | null;
  crossfadeActive: boolean;
  USE_CANVAS_RENDERER: boolean;
  selectedFabric: Fabric | null;
  selectedChildItem: ChildItem | null;
  selectedPleatId: string | null;
  renderPipeline: RenderPipeline;
  canvasRenderParams: CanvasRenderParams;
  segDrag: SegmentDragState;
  DEBUG_UI_ENABLED: boolean;
  wallBoxPixels: { x: number; y: number; width: number; height: number } | null;
  boxHover: boolean;
  setBoxHover: (value: boolean) => void;
  boxDrag: BoxDragState;
  setBoxDrag: (value: BoxDragState) => void;
  setSegDrag: (value: SegmentDragState) => void;
  setDragIx: (value: number | null) => void;
  dragIx: number | null;
  corners: HeroPoint[] | null;
  dims: { wCm: number; hCm: number };
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  clampNotice: ClampNotice;
  stitchNoticeMessage: string | null;
  stitchPositionsFromQuote?: number[][];
  stitchWidthsPerSegment: number[] | null;
  stitchActiveFabric: Fabric | null;
  effectiveStitchWidthCm: number | null;
  stitchLineBackground: string;
  stitchLineOpacity: number;
  stitchLinesVisible: boolean;
  triggerStitchNotice: () => void;
  STITCH_LINE_HITBOX_PX: number;
  STITCH_LINE_WIDTH_PX: number;
  materialReuseActive: boolean;
  markPicks: HeroPoint[];
  setMarkPicks: Dispatch<SetStateAction<HeroPoint[]>>;
  setCorners: Dispatch<SetStateAction<HeroPoint[] | null>>;
  markNormalizedRef: MutableRefObject<boolean>;
  setPhase: (phase: 'idle' | 'segmenting' | 'mark' | 'ready' | 'restoring') => void;
  markDragIx: number | null;
  setMarkDragIx: Dispatch<SetStateAction<number | null>>;
  maybeSnap: (points: HeroPoint[], dragIndex: number, proposed: HeroPoint, options?: { thresholdDeg?: number; strength?: number }) => HeroPoint;
  notifyClamp: (type: 'height' | 'width', message: string) => void;
  maxCurtainHeightCm: number | null;
  baseBoxRatio: { w: number; h: number } | null;
  baseCm: { w: number; h: number };
  topMidPct: { x: number; y: number } | null;
  showMask: boolean;
  maskUrl: string | null;
  progress: ProgressState;
  USE_CURTAIN_FIRST_FLOW: boolean;
  curtainMeasureState: MeasurementState;
  curtainMeasureError: string | null;
  readyPxPts: string;
  // Fullscreen state lifted to page.tsx for coordinate calculations
  isFullscreen: boolean;
  setIsFullscreen: Dispatch<SetStateAction<boolean>>;
  fullscreenImgRef: RefObject<HTMLImageElement | null>;
  // Screenshot canvas ref for order screenshots
  screenshotCanvasRef?: RefObject<ScreenshotCanvasRef>;
  onCurtainPainted?: () => void;
};

export function HeroSurface(props: HeroSurfaceProps) {
  const {
    isMobile,
    heroDockedDesktop,
    dropRef,
    onDrop,
    onPaste,
    MOBILE_FIRST_TEST,
    dragActive,
    previewUrl,
    t,
    MAX_MB,
    curtainHeroRef,
    imgRef,
    phase,
    overlayRef,
    wallMaskUrl,
    clipPoly,
    wallBoxPct,
    wallBoxRef,
    segments,
    imgSize,
    texOrient,
    lightingEnabled,
    LIGHTING_MODE,
    lighting,
    LIGHTING_OPACITY,
    textureUrl,
    getRenderableUrl,
    texScale,
    texOpacity,
    hoverTextureUrl,
    crossfadeUrl,
    crossfadeActive,
    USE_CANVAS_RENDERER,
    selectedFabric,
    selectedChildItem,
    selectedPleatId,
    renderPipeline,
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
    fullscreenImgRef,
    screenshotCanvasRef,
    onCurtainPainted,
  } = props;

  // Aggregate curtain rendering status from all CanvasCurtainLayer instances
  const [isCurtainRendering, setIsCurtainRendering] = useState(false);
  const [showCurtainRenderingOverlay, setShowCurtainRenderingOverlay] = useState(false);
  const renderingSegmentsRef = useRef<Set<number>>(new Set());

  const [hasCurtainPainted, setHasCurtainPainted] = useState(false);
  const hasCurtainPaintedRef = useRef(false);
  const paintedSegmentsRef = useRef<Set<number>>(new Set());
  const prevPhaseRef = useRef(phase);

  const [processingOverlayLatched, setProcessingOverlayLatched] = useState(false);
  const processingOverlayMinHideAtRef = useRef(0);
  const processingOverlayHideTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (phase === 'ready' && prev !== 'ready') {
      hasCurtainPaintedRef.current = false;
      paintedSegmentsRef.current.clear();
      setHasCurtainPainted(false);
    }
    if (phase !== 'ready' && prev === 'ready') {
      hasCurtainPaintedRef.current = false;
      paintedSegmentsRef.current.clear();
      setHasCurtainPainted(false);
    }
  }, [phase]);

  const handleSegmentRenderStatus = useCallback(
    (index: number, isRendering: boolean) => {
      const set = renderingSegmentsRef.current;
      if (isRendering) {
        set.add(index);
      } else {
        set.delete(index);
      }
      const next = set.size > 0;
      setIsCurtainRendering((prev) => (prev === next ? prev : next));
    },
    [],
  );

  const handleCurtainDidPaint = useCallback(
    (index: number) => {
      if (phase !== 'ready') return;
      if (hasCurtainPaintedRef.current) return;
      paintedSegmentsRef.current.add(index);
      if (segments.length > 0 && paintedSegmentsRef.current.size >= segments.length) {
        hasCurtainPaintedRef.current = true;
        setHasCurtainPainted(true);
        onCurtainPainted?.();
      }
    },
    [onCurtainPainted, phase, segments.length],
  );

  // Overlay hysteresis: only show loader if rendering lasts longer than a short threshold
  useEffect(() => {
    const THRESHOLD_MS = 220;
    let timeoutId: number | null = null;

    if (isCurtainRendering) {
      timeoutId = window.setTimeout(() => {
        setShowCurtainRenderingOverlay(true);
      }, THRESHOLD_MS);
    } else {
      // Rendering finished — hide overlay immediately
      setShowCurtainRenderingOverlay(false);
    }

    return () => {
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isCurtainRendering]);

  const hasCurtainGeometry = Boolean(
    corners &&
      corners.length >= 3 &&
      wallBoxPixels &&
      wallBoxPixels.width > 0 &&
      wallBoxPixels.height > 0,
  );
  const hasCurtainAppearance = Boolean(
    selectedFabric &&
      selectedChildItem &&
      (USE_CANVAS_RENDERER ? selectedPleatId : true),
  );
  const shouldShowCurtainProcessingOverlay =
    phase === 'ready' &&
    (!hasCurtainGeometry ||
      !hasCurtainAppearance ||
      showCurtainRenderingOverlay ||
      (USE_CANVAS_RENDERER && segments.length > 0 && !hasCurtainPainted));

  useEffect(() => {
    const MIN_VISIBLE_MS = 700;

    if (processingOverlayHideTimeoutRef.current != null) {
      window.clearTimeout(processingOverlayHideTimeoutRef.current);
      processingOverlayHideTimeoutRef.current = null;
    }

    if (shouldShowCurtainProcessingOverlay) {
      processingOverlayMinHideAtRef.current = Date.now() + getAdjustedDuration(MIN_VISIBLE_MS);
      setProcessingOverlayLatched(true);
      return;
    }

    const remaining = processingOverlayMinHideAtRef.current - Date.now();
    if (remaining > 0) {
      processingOverlayHideTimeoutRef.current = window.setTimeout(() => {
        setProcessingOverlayLatched(false);
        processingOverlayHideTimeoutRef.current = null;
      }, remaining);
      return;
    }

    setProcessingOverlayLatched(false);
  }, [shouldShowCurtainProcessingOverlay]);

  // Mobile QoL: Large hitbox for easy finger targeting, but visually discrete handles
  // hitboxScale: actual touch/drag detection area (2.0x on mobile)
  // Visual size is controlled via CSS ::after pseudo-element (50% on mobile, 100% on desktop)
  const hitboxScale = isMobile ? 2.0 : 1;
  const fullscreenDurationMs = getAdjustedDuration(motionTokens.duration.medium);

  // Safety: whenever fullscreen closes, clear any drag state so handles remain responsive
  useEffect(() => {
    if (!isFullscreen) {
      setDragIx(null);
      setSegDrag(null);
      setBoxDrag(null);
      setMarkDragIx(null);
    }
  }, [isFullscreen, setDragIx, setSegDrag, setBoxDrag, setMarkDragIx]);

  // While dragging anything, disable text selection / touch callouts globally (iOS)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const docEl = document.documentElement as any;
    const hasDrag = dragIx != null || segDrag !== null || boxDrag !== null || markDragIx != null;
    if (!hasDrag) return;
    const prevUserSelect = docEl.style.userSelect;
    const prevWebkitUserSelect = docEl.style.webkitUserSelect;
    const prevCallout = docEl.style.webkitTouchCallout;
    const prevTapHighlight = docEl.style.webkitTapHighlightColor;
    docEl.style.userSelect = 'none';
    docEl.style.webkitUserSelect = 'none';
    docEl.style.webkitTouchCallout = 'none';
    docEl.style.webkitTapHighlightColor = 'transparent';
    return () => {
      docEl.style.userSelect = prevUserSelect;
      docEl.style.webkitUserSelect = prevWebkitUserSelect;
      docEl.style.webkitTouchCallout = prevCallout;
      docEl.style.webkitTapHighlightColor = prevTapHighlight;
    };
  }, [dragIx, segDrag, boxDrag, markDragIx]);

  return (
    <>
      {previewUrl && (
        <FullscreenPhotoViewer
          open={isFullscreen}
          onClose={() => { setIsFullscreen(false); setDragIx(null); setSegDrag(null); setBoxDrag(null); setMarkDragIx(null); }}
          src={previewUrl}
          alt={t('configure.previewAlt')}
          durationMs={fullscreenDurationMs}
          imageRef={fullscreenImgRef}
          overlay={
            <>
              {phase === 'mark' && (
                <div
                  className={cn(
                    'absolute inset-0 z-[30] flex flex-col items-center justify-center rounded-lg text-center text-white cw-frosted-overlay backdrop-blur-sm bg-black/50',
                    markPicks.length < 4 ? 'cursor-crosshair' : 'cursor-default'
                  )}
                  onClick={(e) => {
                    const host = fullscreenImgRef.current?.getBoundingClientRect();
                    if (!host) return;
                    const x = (e.clientX - host.left) / (host.width || 1);
                    const y = (e.clientY - host.top) / (host.height || 1);
                    const p = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
                    setMarkPicks((prev) => (prev.length < 4 ? [...prev, p] : prev));
                  }}
                >
                  {/* Softened shimmer line - mark phase (opacity 0.5 for subtlety) */}
                  <div 
                    className="absolute top-0 left-0 right-0 h-[6px] pointer-events-none"
                    style={{
                      opacity: 0.5,
                      background: 'linear-gradient(90deg, transparent 0%, transparent 20%, rgba(255, 255, 255, 1) 50%, transparent 80%, transparent 100%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmerSlide 1.5s linear infinite',
                      boxShadow: '0 0 16px rgba(255, 255, 255, 0.5), 0 0 8px rgba(255, 255, 255, 0.4)',
                      filter: 'blur(0.5px)'
                    }}
                  />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[120%] text-center text-lg font-bold text-white">
                    {markPicks.length < 4
                      ? t('configure.mark.instruction', { pos: [t('configure.mark.positions.topLeft'), t('configure.mark.positions.topRight'), t('configure.mark.positions.bottomRight'), t('configure.mark.positions.bottomLeft')][markPicks.length] })
                      : t('configure.mark.done')}
                  </div>
                  <svg className="pointer-events-none absolute inset-0" viewBox={`0 0 ${Math.max(imgSize.w, 1)} ${Math.max(imgSize.h, 1)}`}>
                    {markPicks.length >= 2 && (
                      <polyline
                        points={markPicks.map((p) => `${p.x * imgSize.w},${p.y * imgSize.h}`).join(' ')}
                        fill="none"
                        stroke="var(--cw-highlight-stroke)"
                        strokeWidth={2}
                      />
                    )}
                    {markPicks.length === 4 && (
                      <polygon
                        points={[...markPicks, markPicks[0]].map((p) => `${p.x * imgSize.w},${p.y * imgSize.h}`).join(' ')}
                        fill="var(--cw-highlight-fill)"
                        stroke="var(--cw-highlight-stroke)"
                        strokeWidth={2}
                      />
                    )}
                    {markPicks.map((p, ix) => (
                      <g key={ix}>
                        <circle
                          cx={p.x * imgSize.w}
                          cy={p.y * imgSize.h}
                          r={8 * hitboxScale}
                          fill="rgb(139, 186, 139)"
                          stroke="#fff"
                          strokeWidth={2}
                          style={{ touchAction: 'none' }}
                          className="pointer-events-auto cursor-grab"
                          onPointerDown={(e) => {
                            (e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);
                            setMarkDragIx(ix);
                          }}
                        />
                        <text x={p.x * imgSize.w + 10} y={p.y * imgSize.h - 10} fontSize={12} fill="rgb(139, 186, 139)" stroke="#fff" strokeWidth={0.5}>
                          {ix + 1}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              )}

              {phase === 'ready' && (
                <>
                  <div
                    ref={overlayRef as React.RefObject<HTMLDivElement>}
                    style={{
                      position: 'absolute', inset: 0,
                      ...(wallMaskUrl ? {
                        WebkitMaskImage: `url(${wallMaskUrl})`, maskImage: `url(${wallMaskUrl})`,
                        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
                        WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
                      } : {}),
                      ...(clipPoly ? { WebkitClipPath: clipPoly, clipPath: clipPoly } : {}),
                      borderRadius: 8,
                      zIndex: 10,
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      ref={wallBoxRef as React.RefObject<HTMLDivElement>}
                      style={{ position: 'absolute', left: `${wallBoxPct.left}%`, top: `${wallBoxPct.top}%`, width: `${wallBoxPct.width}%`, height: `${wallBoxPct.height}%`, userSelect: 'none', WebkitUserSelect: 'none' }}
                    >
                      {segments.map((seg, ix) => {
                        const wallLeftPx = (wallBoxPct.left / 100) * imgSize.w;
                        const wallTopPx = (wallBoxPct.top / 100) * imgSize.h;
                        const wallWidthPx = (wallBoxPct.width / 100) * imgSize.w;
                        const segLeftPx = (seg.offsetPercent / 100) * wallWidthPx;
                        const segWidthPx = (seg.widthPercent / 100) * wallWidthPx;
                        const originRotY = (-(wallLeftPx + segLeftPx) * texOrient.sinA) + (wallTopPx * texOrient.cosA);
                        const bgY = Math.round(texOrient.bgYOffsetPx - originRotY);
                        return (
                          <div key={ix} style={{ position: 'absolute', top: 0, bottom: 0, left: `${seg.offsetPercent}%`, width: `${seg.widthPercent}%`, pointerEvents: 'none' }}>
                            <div style={{ position: 'absolute', inset: 0, transform: `rotate(${texOrient.angleRad}rad)`, transformOrigin: '0 0', filter: lightingEnabled && lighting?.cssFilter ? lighting.cssFilter : 'none' }}>
                              {USE_CANVAS_RENDERER && selectedFabric && selectedChildItem && selectedPleatId ? (
                                <CanvasCurtainLayer
                                  fabric={selectedFabric}
                                  colorHex={selectedChildItem.color}
                                  pleatId={selectedPleatId}
                                  width={Math.round((seg.widthPercent / 100) * imgSize.w)}
                                  height={Math.round(imgSize.h)}
                                  textureScale={Math.max(20, texScale)}
                                  opacity={texOpacity}
                                  backgroundImage={fullscreenImgRef.current || undefined}
                                  wallBox={wallBoxPixels || undefined}
                                  segmentBounds={{
                                    xInWallBox: Math.round(segLeftPx),
                                    width: Math.round(segWidthPx),
                                  }}
                                  disableTransmission={true}
                                  debug={DEBUG_UI_ENABLED}
                                  pipelineOverride={renderPipeline}
                                  renderParams={canvasRenderParams}
                                  isDragging={segDrag !== null}
                                  tileOffsetPx={Math.round(wallLeftPx + segLeftPx)}
                                  verticalOffsetPx={bgY}
                                  onRenderStatusChange={(isRendering) => handleSegmentRenderStatus(ix, isRendering)}
                                  onDidPaint={() => handleCurtainDidPaint(ix)}
                                />
                              ) : (
                                <>
                                  <div
                                    style={{
                                      position: 'absolute', inset: 0,
                                      backgroundImage: textureUrl ? `url(${getRenderableUrl(textureUrl)})` : 'repeating-linear-gradient(45deg, rgba(200,200,200,0.5) 0 10px, rgba(230,230,230,0.5) 10px 20px)',
                                      backgroundRepeat: textureUrl ? 'repeat-x' : 'repeat',
                                      backgroundSize: (textureUrl && corners && corners.length >= 3)
                                        ? `${Math.max(20, texScale)}px ${Math.max(...corners.map(c => c.y * imgSize.h)) - Math.min(...corners.map(c => c.y * imgSize.h))}px`
                                        : (textureUrl ? `${Math.max(20, texScale)}px 100%` : `${Math.max(10, texScale)}% auto`),
                                      backgroundPosition: `0px ${bgY}px`,
                                      opacity: Math.max(0, Math.min(1, texOpacity / 100)),
                                      transition: 'opacity 180ms ease',
                                      willChange: 'opacity',
                                      pointerEvents: 'none',
                                    }}
                                  />
                                  <div
                                    style={{
                                      position: 'absolute', inset: 0,
                                      backgroundImage: (hoverTextureUrl || crossfadeUrl) ? `url(${getRenderableUrl(hoverTextureUrl || crossfadeUrl)})` : undefined,
                                      backgroundRepeat: (hoverTextureUrl || crossfadeUrl) ? 'repeat-x' : undefined,
                                      backgroundSize: ((hoverTextureUrl || crossfadeUrl) && corners && corners.length >= 3)
                                        ? `${Math.max(20, texScale)}px ${Math.max(...corners.map(c => c.y * imgSize.h)) - Math.min(...corners.map(c => c.y * imgSize.h))}px`
                                        : ((hoverTextureUrl || crossfadeUrl) ? `${Math.max(20, texScale)}px 100%` : undefined),
                                      backgroundPosition: `0px ${bgY}px`,
                                      opacity: (hoverTextureUrl ? 1 : (crossfadeActive ? 1 : 0)) * Math.max(0, Math.min(1, texOpacity / 100)),
                                      transition: 'opacity 180ms ease',
                                      willChange: 'opacity',
                                      pointerEvents: 'none',
                                    }}
                                  />
                                </>
                              )}
                              {lightingEnabled && LIGHTING_MODE === 'enhanced' && lighting?.gradient && (
                                <div
                                  aria-hidden
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    pointerEvents: 'none',
                                    mixBlendMode: 'soft-light',
                                    opacity: Math.max(0, Math.min(1, (LIGHTING_OPACITY || 0.35) * Math.max(0, Math.min(1, lighting.gradient.strength)) * 0.75)),
                                    filter: lightingEnabled && lighting?.gradient ? `linear-gradient(${lighting.gradient.angleDeg}deg, rgba(255,255,255,${lighting.gradient.strength * 0.3}), rgba(255,255,255,${lighting.gradient.strength * 0.1}))` : 'none'
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {corners && corners.length >= 3 && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 40,
                        pointerEvents: 'auto',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} viewBox={`0 0 ${Math.max(imgSize.w, 1)} ${Math.max(imgSize.h, 1)}`}>
                        <polygon points={readyPxPts} fill="none" stroke={"var(--cw-wall-stroke, #e5e7eb)"} strokeOpacity={"var(--cw-wall-stroke-opacity, 1)"} strokeWidth={2} />
                      </svg>
                      <div
                        style={{
                          position: 'absolute',
                          left: `${wallBoxPct.left}%`,
                          top: `${wallBoxPct.top}%`,
                          width: `${wallBoxPct.width}%`,
                          height: `${wallBoxPct.height}%`,
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          WebkitTouchCallout: 'none',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                      >
                        {segments.map((seg, ix) => {
                          const wallWidthPx = (wallBoxPct.width / 100) * imgSize.w;
                          const wallHeightPx = (wallBoxPct.height / 100) * imgSize.h;
                          const segWidthPx = (seg.widthPercent / 100) * wallWidthPx;
                          const yMidFromXSeg = (xSegPx: number) => (xSegPx * texOrient.sinA + (wallHeightPx * 0.5) * texOrient.cosA);
                          const yCenterPct = (yMidFromXSeg(segWidthPx / 2) / Math.max(1, wallHeightPx)) * 100;
                          const yLeftPct = (yMidFromXSeg(0) / Math.max(1, wallHeightPx)) * 100;
                          const yRightPct = (yMidFromXSeg(segWidthPx) / Math.max(1, wallHeightPx)) * 100;
                          const xOffsetPct = -((wallHeightPx * 0.5) * texOrient.sinA) / Math.max(1, wallWidthPx) * 100;
                          return (
                            <div key={`handles-fullscreen-${ix}`}>
                              <div
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  try { window.getSelection()?.removeAllRanges(); } catch {}
                                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                                  setSegDrag({ type: 'move', index: ix, startX: e.clientX, initialLayouts: JSON.parse(JSON.stringify(segments)) });
                                }}
                                style={{ position: 'absolute', left: `calc(${seg.offsetPercent + seg.widthPercent / 2 + xOffsetPct}% - ${9 * hitboxScale}px)`, top: `calc(${yCenterPct}% - ${9 * hitboxScale}px)`, width: 18 * hitboxScale, height: 18 * hitboxScale, borderRadius: 9 * hitboxScale, zIndex: 100, transform: `rotate(${texOrient.angleRad}rad)`, pointerEvents: 'auto', touchAction: 'none' }}
                                className="cw-handle cw-handle--grab cw-debug-ui"
                                aria-label={`segment-${ix + 1}-move`}
                              />
                              <div
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  try { window.getSelection()?.removeAllRanges(); } catch {}
                                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                                  setSegDrag({ type: 'resize-left', index: ix, startX: e.clientX, initialLayouts: JSON.parse(JSON.stringify(segments)) });
                                }}
                                style={{ position: 'absolute', left: `calc(${seg.offsetPercent + xOffsetPct}% - ${6 * hitboxScale}px)`, top: `calc(${yLeftPct}% - ${12 * hitboxScale}px)`, width: 12 * hitboxScale, height: 24 * hitboxScale, borderRadius: 4 * hitboxScale, zIndex: 100, transform: `rotate(${texOrient.angleRad}rad)`, pointerEvents: 'auto', touchAction: 'none' }}
                                className="cw-handle cw-handle--ew cw-debug-ui"
                                aria-label={`segment-${ix + 1}-resize-left`}
                              />
                              <div
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  try { window.getSelection()?.removeAllRanges(); } catch {}
                                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                                  setSegDrag({ type: 'resize-right', index: ix, startX: e.clientX, initialLayouts: JSON.parse(JSON.stringify(segments)) });
                                }}
                                style={{ position: 'absolute', left: `calc(${seg.offsetPercent + seg.widthPercent + xOffsetPct}% - ${6 * hitboxScale}px)`, top: `calc(${yRightPct}% - ${12 * hitboxScale}px)`, width: 12 * hitboxScale, height: 24 * hitboxScale, borderRadius: 4 * hitboxScale, zIndex: 100, transform: `rotate(${texOrient.angleRad}rad)`, pointerEvents: 'auto', touchAction: 'none' }}
                                className="cw-handle cw-handle--ew cw-debug-ui"
                                aria-label={`segment-${ix + 1}-resize-right`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      {corners.map((p, ix) => (
                        <div
                          key={`corner-fullscreen-${ix}`}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try { window.getSelection()?.removeAllRanges(); } catch {}
                            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                            setDragIx(ix);
                          }}
                          style={{
                            position: 'absolute',
                            left: `calc(${(p.x * 100).toFixed(2)}% - ${8 * hitboxScale}px)`,
                            top: `calc(${(p.y * 100).toFixed(2)}% - ${8 * hitboxScale}px)`,
                            width: 16 * hitboxScale,
                            height: 16 * hitboxScale,
                            borderRadius: 8 * hitboxScale,
                            cursor: 'grab',
                            zIndex: 110,
                            pointerEvents: 'auto',
                            touchAction: 'none',
                          }}
                          className="cw-handle cw-handle--grab"
                          aria-label={`corner-${ix + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          }
          footer={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-0 text-sm font-medium text-active-text hover:bg-transparent"
              onClick={() => { setIsFullscreen(false); setDragIx(null); setSegDrag(null); setBoxDrag(null); setMarkDragIx(null); }}
            >
              ← {t('common.back')}
            </Button>
          }
        />
      )}
            {/* Hero Photo Section (sticky on mobile; desktop handled by outer layout container) */}
            <div
              className={cn(
                'cw-hero-shell flex-shrink-0 w-full transition-all ease-out',
                heroDockedDesktop ? 'lg:self-start lg:w-full lg:max-w-none' : 'lg:self-center lg:mx-auto'
              )}
              style={{ transitionDuration: `${getConfigureEntryDurationMs()}ms` }}
            >
            <div
              ref={dropRef as React.RefObject<HTMLDivElement>}
              onDrop={onDrop}
              onPaste={onPaste}
              onContextMenu={(e) => e.preventDefault()}
              tabIndex={0}
              className={cn(
                'relative w-full overflow-hidden rounded-2xl bg-surface-glass/90',
                'border border-white/30 shadow-glass backdrop-blur-md p-3',
                MOBILE_FIRST_TEST ? 'flex items-center justify-center' : 'min-h-[320px]',
                dragActive
                  ? 'border-active-accent/60 bg-active-accent/10 shadow-glass-hover scale-[1.01]'
                  : 'border-white/30 hover:border-white/40 hover:shadow-glass-hover'
              )}
              style={{
                background: previewUrl ? undefined : 'linear-gradient(135deg, rgba(var(--cw-surface-glass-rgb), 0.8) 0%, rgba(var(--cw-surface-glass-rgb), 0.6) 100%)',
                WebkitTouchCallout: 'none',
              }}
            >
              {!previewUrl && (
                <div className="text-center text-neutral-500">
                  <div className="font-semibold">{t('configure.upload.title')}</div>
                  <div className="text-xs mt-1.5">{t('configure.upload.hint', { button: t('configure.buttons.choosePhoto') })}</div>
                  <div className="text-2xs mt-1.5 text-neutral-400">{t('configure.upload.note', { max: MAX_MB.toString() })}</div>
                </div>
              )}
              {previewUrl && (
                <div 
                  id="curtain-hero-image-area"
                  ref={curtainHeroRef as React.RefObject<HTMLDivElement>}
                  className={cn(
                    "relative",
                    MOBILE_FIRST_TEST && "inline-block max-w-full"
                  )}
                >
                  <img 
                    ref={imgRef as React.RefObject<HTMLImageElement>} 
                    src={previewUrl} 
                    alt={t('configure.previewAlt')} 
                    className={cn(
                      "block rounded-lg",
                      MOBILE_FIRST_TEST ? "max-w-full max-h-full object-contain" : "max-w-full h-auto"
                    )}
                  />
                  {phase === 'ready' && isMobile && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsFullscreen(true); }}
                      className="absolute right-2 bottom-2 z-[60] rounded-full p-2 bg-white/90 hover:bg-white shadow-lg hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-active-accent/50"
                      aria-label={t('configure.summary.viewFabricImage')}
                    >
                      <svg
                        className="w-5 h-5 text-neutral-900"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Hidden screenshot canvas for order screenshots */}
                  {screenshotCanvasRef && (
                    <ScreenshotCanvas
                      ref={screenshotCanvasRef}
                      imageRef={imgRef}
                      overlayRef={overlayRef}
                      wallMaskUrl={wallMaskUrl}
                      phase={phase}
                    />
                  )}
                  
                  {phase === 'ready' && !isFullscreen && (
                    <div
                      ref={overlayRef as React.RefObject<HTMLDivElement>}
                      style={{
                        position: 'absolute', inset: 0,
                        ...(wallMaskUrl ? {
                          WebkitMaskImage: `url(${wallMaskUrl})`, maskImage: `url(${wallMaskUrl})`,
                          WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
                          WebkitMaskSize: '100% 100%', maskSize: '100% 100%',
                        } : {}),
                        ...(clipPoly ? { WebkitClipPath: clipPoly, clipPath: clipPoly } : {}),
                        borderRadius: 8,
                        zIndex: 10,
                        pointerEvents: 'none',
                      }}
                    >
                      <div
                        ref={wallBoxRef as React.RefObject<HTMLDivElement>}
                        style={{ position: 'absolute', left: `${wallBoxPct.left}%`, top: `${wallBoxPct.top}%`, width: `${wallBoxPct.width}%`, height: `${wallBoxPct.height}%`, userSelect: 'none', WebkitUserSelect: 'none' }}
                      >
                        {segments.map((seg, ix) => {
                          const wallLeftPx = (wallBoxPct.left / 100) * imgSize.w;
                          const wallTopPx = (wallBoxPct.top / 100) * imgSize.h;
                          const wallWidthPx = (wallBoxPct.width / 100) * imgSize.w;
                          const segLeftPx = (seg.offsetPercent / 100) * wallWidthPx;
                          const segWidthPx = (seg.widthPercent / 100) * wallWidthPx;
                          const originRotY = (-(wallLeftPx + segLeftPx) * texOrient.sinA) + (wallTopPx * texOrient.cosA);
                          const bgY = Math.round(texOrient.bgYOffsetPx - originRotY);
                          return (
                            <div key={ix} style={{ position: 'absolute', top: 0, bottom: 0, left: `${seg.offsetPercent}%`, width: `${seg.widthPercent}%`, pointerEvents: 'none' }}>
                              <div style={{ position: 'absolute', inset: 0, transform: `rotate(${texOrient.angleRad}rad)`, transformOrigin: '0 0', filter: lightingEnabled && lighting?.cssFilter ? lighting.cssFilter : 'none' }}>
                                {USE_CANVAS_RENDERER && selectedFabric && selectedChildItem && selectedPleatId ? (
                                  /* Canvas rendering pipeline (Task 1010+) */
                                  <CanvasCurtainLayer
                                    fabric={selectedFabric}
                                    colorHex={selectedChildItem.color}
                                    pleatId={selectedPleatId}
                                    width={Math.round((seg.widthPercent / 100) * imgSize.w)}
                                    height={Math.round(imgSize.h)}
                                    textureScale={Math.max(20, texScale)}
                                    opacity={texOpacity}
                                    backgroundImage={imgRef.current || undefined}
                                    wallBox={wallBoxPixels || undefined}
                                    segmentBounds={{
                                      xInWallBox: Math.round(segLeftPx),
                                      width: Math.round(segWidthPx),
                                    }}
                                    disableTransmission={true}
                                    debug={DEBUG_UI_ENABLED}
                                    pipelineOverride={renderPipeline}
                                    renderParams={canvasRenderParams}
                                    isDragging={segDrag !== null}
                                    tileOffsetPx={Math.round(wallLeftPx + segLeftPx)}
                                    verticalOffsetPx={bgY}
                                    onRenderStatusChange={(isRendering) => handleSegmentRenderStatus(ix, isRendering)}
                                    onDidPaint={() => handleCurtainDidPaint(ix)}
                                  />
                                ) : (
                                  <>
                                    {/* Base layer (current texture) - CSS */}
                                    <div
                                      style={{
                                        position: 'absolute', inset: 0,
                                        backgroundImage: textureUrl ? `url(${getRenderableUrl(textureUrl)})` : 'repeating-linear-gradient(45deg, rgba(200,200,200,0.5) 0 10px, rgba(230,230,230,0.5) 10px 20px)',
                                        backgroundRepeat: textureUrl ? 'repeat-x' : 'repeat',
                                        backgroundSize: (textureUrl && corners && corners.length >= 3)
                                          ? `${Math.max(20, texScale)}px ${Math.max(...corners.map(c => c.y * imgSize.h)) - Math.min(...corners.map(c => c.y * imgSize.h))}px`
                                          : (textureUrl ? `${Math.max(20, texScale)}px 100%` : `${Math.max(10, texScale)}% auto`),
                                        backgroundPosition: `0px ${bgY}px`,
                                        opacity: Math.max(0, Math.min(1, texOpacity / 100)),
                                        transition: 'opacity 180ms ease',
                                        willChange: 'opacity',
                                        pointerEvents: 'none',
                                      }}
                                    />
                                    {/* Overlay layer for hover previews and crossfade swaps - CSS */}
                                    <div
                                      style={{
                                        position: 'absolute', inset: 0,
                                        backgroundImage: (hoverTextureUrl || crossfadeUrl) ? `url(${getRenderableUrl(hoverTextureUrl || crossfadeUrl)})` : undefined,
                                        backgroundRepeat: (hoverTextureUrl || crossfadeUrl) ? 'repeat-x' : undefined,
                                        backgroundSize: ((hoverTextureUrl || crossfadeUrl) && corners && corners.length >= 3)
                                          ? `${Math.max(20, texScale)}px ${Math.max(...corners.map(c => c.y * imgSize.h)) - Math.min(...corners.map(c => c.y * imgSize.h))}px`
                                          : ((hoverTextureUrl || crossfadeUrl) ? `${Math.max(20, texScale)}px 100%` : undefined),
                                        backgroundPosition: `0px ${bgY}px`,
                                        opacity: (hoverTextureUrl ? 1 : (crossfadeActive ? 1 : 0)) * Math.max(0, Math.min(1, texOpacity / 100)),
                                        transition: 'opacity 180ms ease',
                                        willChange: 'opacity',
                                        pointerEvents: 'none',
                                      }}
                                    />
                                  </>
                                )}
                                {/* Enhanced mode: per-segment gradient overlay, blended softly */}
                                {lightingEnabled && LIGHTING_MODE === 'enhanced' && lighting?.gradient && (
                                  <div
                                    aria-hidden
                                    style={{
                                      position: 'absolute',
                                      inset: 0,
                                      pointerEvents: 'none',
                                      mixBlendMode: 'soft-light',
                                      opacity: Math.max(0, Math.min(1, (LIGHTING_OPACITY || 0.35) * Math.max(0, Math.min(1, lighting.gradient.strength)) * 0.75)),
                                      filter: lightingEnabled && lighting?.gradient ? `linear-gradient(${lighting.gradient.angleDeg}deg, rgba(255,255,255,${lighting.gradient.strength * 0.3}), rgba(255,255,255,${lighting.gradient.strength * 0.1}))` : 'none'
                                    }}
                                  />
                                )}
                              </div>
                              {/* Stitch lines: show where fabric widths are sewn together (moved outside rotation) */}
                              {(() => {
                                // Material reuse mode: use actual stitch positions from quote
                                if (materialReuseActive && stitchPositionsFromQuote && stitchPositionsFromQuote[ix]) {
                                  const stitchPositions = stitchPositionsFromQuote[ix];
                                  if (stitchPositions.length === 0 || !stitchActiveFabric || !stitchLinesVisible) {
                                    return null;
                                  }
                                  const segWidthCm = (seg.widthPercent / 100) * dims.wCm;
                                  return (
                                    <>
                                      {stitchPositions.map((stitchCm, stitchIx) => {
                                        const stitchPercent = (stitchCm / segWidthCm) * 100;
                                        if (stitchPercent < 0 || stitchPercent > 100) return null;
                                        return (
                                          <div
                                            key={`stitch-reuse-${stitchActiveFabric.id}-${ix}-${stitchIx}`}
                                            aria-label={`Fabric stitch line ${stitchIx + 1}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              triggerStitchNotice();
                                            }}
                                            style={{
                                              position: 'absolute',
                                              left: `${stitchPercent}%`,
                                              top: 0,
                                              bottom: 0,
                                              width: `${STITCH_LINE_HITBOX_PX}px`,
                                              marginLeft: `${-STITCH_LINE_HITBOX_PX / 2}px`,
                                              cursor: 'help',
                                              pointerEvents: 'auto',
                                              zIndex: 9999,
                                            }}
                                          >
                                            <div
                                              aria-hidden
                                              style={{
                                                position: 'absolute',
                                                top: 0,
                                                bottom: 0,
                                                left: '50%',
                                                width: `${STITCH_LINE_WIDTH_PX}px`,
                                                transform: 'translateX(-50%)',
                                                backgroundImage: stitchLineBackground,
                                                opacity: stitchLineOpacity,
                                                transition: 'opacity 220ms ease',
                                                pointerEvents: 'none',
                                              }}
                                            />
                                            {DEBUG_UI_ENABLED && (
                                              <div
                                                style={{
                                                  position: 'absolute',
                                                  top: '50%',
                                                  left: '50%',
                                                  transform: 'translate(-50%, -50%)',
                                                  width: 24,
                                                  height: 24,
                                                  borderRadius: 12,
                                                  background: 'rgba(0, 255, 0, 0.5)',
                                                  border: '2px solid white',
                                                  fontSize: 10,
                                                  color: 'white',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  fontWeight: 'bold',
                                                  pointerEvents: 'none',
                                                }}
                                              >
                                                R{stitchIx + 1}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </>
                                  );
                                }
                                // Fallback: traditional per-segment calculation
                                if (stitchWidthsPerSegment && stitchWidthsPerSegment[ix] != null && stitchWidthsPerSegment[ix] > 1 && stitchActiveFabric && effectiveStitchWidthCm && stitchLinesVisible) {
                                  return (
                                    <>
                                      {Array.from({ length: stitchWidthsPerSegment[ix] - 1 }).map((_, stitchIx) => {
                                        const segWidthCm = (seg.widthPercent / 100) * dims.wCm;
                                        const stitchPositionCm = (stitchIx + 1) * effectiveStitchWidthCm;
                                        const stitchPercent = (stitchPositionCm / segWidthCm) * 100;
                                        if (stitchPercent < 0 || stitchPercent > 100) return null;
                                        return (
                                          <div
                                            key={`stitch-${stitchActiveFabric.id}-${seg.offsetPercent}-${stitchIx}`}
                                            aria-label={`Fabric stitch line ${stitchIx + 1}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              triggerStitchNotice();
                                            }}
                                            style={{
                                              position: 'absolute',
                                              left: `${stitchPercent}%`,
                                              top: 0,
                                              bottom: 0,
                                              width: `${STITCH_LINE_HITBOX_PX}px`,
                                              marginLeft: `${-STITCH_LINE_HITBOX_PX / 2}px`,
                                              cursor: 'help',
                                              pointerEvents: 'auto',
                                              zIndex: 9999,
                                            }}
                                          >
                                            <div
                                              aria-hidden
                                              style={{
                                                position: 'absolute',
                                                top: 0,
                                                bottom: 0,
                                                left: '50%',
                                                width: `${STITCH_LINE_WIDTH_PX}px`,
                                                transform: 'translateX(-50%)',
                                                backgroundImage: stitchLineBackground,
                                                opacity: stitchLineOpacity,
                                                transition: 'opacity 220ms ease',
                                                pointerEvents: 'none',
                                              }}
                                            />
                                            {DEBUG_UI_ENABLED && (
                                              <div
                                                style={{
                                                  position: 'absolute',
                                                  top: '50%',
                                                  left: '50%',
                                                  transform: 'translate(-50%, -50%)',
                                                  width: 24,
                                                  height: 24,
                                                  borderRadius: 12,
                                                  background: 'rgba(255, 0, 0, 0.5)',
                                                  border: '2px solid white',
                                                  fontSize: 10,
                                                  color: 'white',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  fontWeight: 'bold',
                                                  pointerEvents: 'none',
                                                }}
                                              >
                                                {stitchIx + 1}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          );
                        })}
                        
                        {/* Shared transmission layer for all segments */}
                        {USE_CANVAS_RENDERER && selectedFabric && selectedChildItem && selectedPleatId && imgRef.current && wallBoxPixels && selectedFabric.typeId !== 'blackout' && selectedFabric.typeId !== 'heavy' && (canvasRenderParams?.transmissionStrength ?? 0) > 0.02 && (() => {
                          // Generate CSS mask from segment positions
                          const maskSegments = segments.map(seg => 
                            `${seg.offsetPercent}% 0%, ${seg.offsetPercent}% 100%, ${(seg.offsetPercent + seg.widthPercent)}% 100%, ${(seg.offsetPercent + seg.widthPercent)}% 0%`
                          ).join(', ');
                          
                          return (
                            <div style={{ 
                              position: 'absolute', 
                              inset: 0,
                              transform: `rotate(${texOrient.angleRad}rad)`,
                              transformOrigin: '0 0',
                              pointerEvents: 'none',
                              // CSS mask to show transmission only within segments
                              WebkitMaskImage: `polygon(${maskSegments})`,
                              maskImage: `polygon(${maskSegments})`,
                              WebkitMaskRepeat: 'no-repeat',
                              maskRepeat: 'no-repeat',
                              WebkitMaskSize: '100% 100%',
                              maskSize: '100% 100%',
                            }}>
                              <TransmissionLayer
                                fabric={selectedFabric}
                                colorHex={selectedChildItem.color}
                                width={Math.round(wallBoxPixels.width)}
                                height={Math.round(wallBoxPixels.height)}
                                backgroundImage={imgRef.current}
                                wallBox={wallBoxPixels}
                                transmissionStrength={canvasRenderParams.transmissionStrength ?? 0}
                                debug={DEBUG_UI_ENABLED}
                                counterRotateRad={texOrient.angleRad}
                              />
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                  {showMask && wallMaskUrl && (
                    <img
                      aria-hidden
                      alt=""
                      src={wallMaskUrl}
                      className="absolute inset-0 rounded-lg"
                      style={{
                        pointerEvents: 'none',
                        opacity: 0.35,
                        filter: 'brightness(0)',
                      }}
                    />
                  )}
                  {phase === 'segmenting' && (
                    <div
                      className="absolute inset-0 z-[30] rounded-lg text-white flex flex-col items-center justify-center text-center cw-frosted-overlay backdrop-blur-sm bg-black/50"
                    >
                      {/* Shimmer line - AI scanning beam (full intensity) */}
                      <div 
                        className="absolute top-0 left-0 right-0 h-[6px] pointer-events-none"
                        style={{
                          opacity: 0.85,
                          background: 'linear-gradient(90deg, transparent 0%, transparent 20%, rgba(255, 255, 255, 1) 50%, transparent 80%, transparent 100%)',
                          backgroundSize: '200% 100%',
                          animation: 'shimmerSlide 2.5s ease-in-out infinite',
                          boxShadow: '0 0 20px rgba(255, 255, 255, 0.8), 0 0 10px rgba(255, 255, 255, 0.6)',
                          filter: 'blur(2.5px)'
                        }}
                      />
                      <Spinner size="md" color="light" />
                      <div className="mt-2 text-white font-semibold">{progress?.label ?? t('configure.segmenting')}</div>
                      <div className="mt-1 text-neutral-100 text-xs">{t('configure.progress.keepTabOpen')}</div>
                      <div className="w-3/5 max-w-[260px] mt-3">
                        <Progress 
                          value={progress?.value != null ? Math.round(progress.value * 100) : 40}
                          max={100}
                          color="primary"
                          className="h-1.5"
                        />
                      </div>
                    </div>
                  )}
                  {phase === 'restoring' && (
                    <div
                      className="absolute inset-0 z-[30] rounded-lg text-white flex flex-col items-center justify-center text-center cw-frosted-overlay backdrop-blur-sm bg-black/45"
                    >
                      {/* Shimmer line - restoring from estimate */}
                      <div 
                        className="absolute top-0 left-0 right-0 h-[6px] pointer-events-none"
                        style={{
                          opacity: 0.7,
                          background: 'linear-gradient(90deg, transparent 0%, transparent 20%, rgba(255, 255, 255, 1) 50%, transparent 80%, transparent 100%)',
                          backgroundSize: '200% 100%',
                          animation: 'shimmerSlide 2.1s ease-in-out infinite',
                          boxShadow: '0 0 18px rgba(255, 255, 255, 0.7), 0 0 9px rgba(255, 255, 255, 0.5)',
                          filter: 'blur(2px)'
                        }}
                      />
                      <Spinner size="md" color="light" />
                      <div className="mt-2 text-white font-semibold">{t('configure.progress.processing')}</div>
                    </div>
                  )}
                  {processingOverlayLatched && (
                    <div
                      className="absolute inset-0 z-[9999] rounded-lg text-white flex flex-col items-center justify-center text-center cw-frosted-overlay backdrop-blur-sm bg-black/45"
                    >
                      <div 
                        className="absolute top-0 left-0 right-0 h-[6px] pointer-events-none"
                        style={{
                          opacity: 0.7,
                          background: 'linear-gradient(90deg, transparent 0%, transparent 20%, rgba(255, 255, 255, 1) 50%, transparent 80%, transparent 100%)',
                          backgroundSize: '200% 100%',
                          animation: 'shimmerSlide 2.1s ease-in-out infinite',
                          boxShadow: '0 0 18px rgba(255, 255, 255, 0.7), 0 0 9px rgba(255, 255, 255, 0.5)',
                          filter: 'blur(2px)'
                        }}
                      />
                      <Spinner size="md" color="light" />
                      <div className="mt-2 text-white font-semibold">{t('configure.progress.processing')}</div>
                      <div className="mt-1 text-neutral-100 text-xs">{t('configure.progress.keepTabOpen')}</div>
                    </div>
                  )}
                  {phase === 'mark' && !isFullscreen && (
                    <div
                      className={cn(
                        'absolute inset-0 z-[30] flex flex-col items-center justify-center rounded-lg text-center text-white cw-frosted-overlay backdrop-blur-sm bg-black/50',
                        markPicks.length < 4 ? 'cursor-crosshair' : 'cursor-default'
                      )}
                      onClick={(e) => {
                        const host = imgRef.current?.getBoundingClientRect();
                        if (!host) return;
                        const x = (e.clientX - host.left) / (host.width || 1);
                        const y = (e.clientY - host.top) / (host.height || 1);
                        const p = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
                        setMarkPicks((prev) => (prev.length < 4 ? [...prev, p] : prev));
                      }}
                      >
                        {/* Softened shimmer line - mark phase (opacity 0.5 for subtlety) */}
                        <div 
                          className="absolute top-0 left-0 right-0 h-[6px] pointer-events-none"
                          style={{
                            opacity: 0.5,
                            background: 'linear-gradient(90deg, transparent 0%, transparent 20%, rgba(255, 255, 255, 1) 50%, transparent 80%, transparent 100%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmerSlide 1.5s linear infinite',
                            boxShadow: '0 0 16px rgba(255, 255, 255, 0.5), 0 0 8px rgba(255, 255, 255, 0.4)',
                            filter: 'blur(0.5px)'
                          }}
                        />
                        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[120%] text-center text-lg font-bold text-white">
                          {markPicks.length < 4
                            ? t('configure.mark.instruction', { pos: [t('configure.mark.positions.topLeft'), t('configure.mark.positions.topRight'), t('configure.mark.positions.bottomRight'), t('configure.mark.positions.bottomLeft')][markPicks.length] })
                            : t('configure.mark.done')}
                        </div>
                        <svg className="pointer-events-none absolute inset-0" viewBox={`0 0 ${Math.max(imgSize.w, 1)} ${Math.max(imgSize.h, 1)}`}>
                        {markPicks.length >= 2 && (
                          <polyline
                            points={markPicks.map((p) => `${p.x * imgSize.w},${p.y * imgSize.h}`).join(' ')}
                            fill="none"
                            stroke="var(--cw-highlight-stroke)"
                            strokeWidth={2}
                          />
                        )}
                        {markPicks.length === 4 && (
                          <polygon
                            points={[...markPicks, markPicks[0]].map((p) => `${p.x * imgSize.w},${p.y * imgSize.h}`).join(' ')}
                            fill="var(--cw-highlight-fill)"
                            stroke="var(--cw-highlight-stroke)"
                            strokeWidth={2}
                          />
                        )}
                        {markPicks.map((p, ix) => (
                          <g key={ix}>
                            <circle
                              cx={p.x * imgSize.w}
                              cy={p.y * imgSize.h}
                              r={8 * hitboxScale}
                              fill="rgb(139, 186, 139)"
                              stroke="#fff"
                              strokeWidth={2}
                              style={{ touchAction: 'none' }}
                              className="pointer-events-auto cursor-grab"
                              onPointerDown={(e) => {
                                (e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);
                                setMarkDragIx(ix);
                              }}
                            />
                            <text x={p.x * imgSize.w + 10} y={p.y * imgSize.h - 10} fontSize={12} fill="rgb(139, 186, 139)" stroke="#fff" strokeWidth={0.5}>
                              {ix + 1}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  )}
                  
                  {/* Desktop modal: positioned over photo (absolute) */}
                  {phase === 'mark' && markPicks.length === 4 && !isMobile && (
                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="corner-confirm-title"
                      className="absolute inset-0 z-50 flex px-3 items-center justify-center py-3 animate-in fade-in duration-200 rounded-lg cw-frosted-overlay"
                      onClick={(e) => {
                        // Click backdrop to close (same as "Mark again")
                        if (e.target === e.currentTarget) {
                          setMarkPicks([]);
                          setCorners(null as any);
                          markNormalizedRef.current = false; // Reset normalization flag
                        }
                      }}
                    >
                      <div
                        className="bg-active-bg border border-active-border p-4 w-full max-w-[560px] rounded-[14px] shadow-[0_18px_44px_rgba(0,0,0,0.18)] animate-in duration-200 ease-out slide-in-from-bottom-4 zoom-in-95"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div id="corner-confirm-title" className="text-lg font-bold mb-1.5">
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
                              markNormalizedRef.current = false; // Reset normalization flag
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
                  
                  {phase === 'ready' && corners && corners.length >= 3 && !isFullscreen && (
                    <div
                      style={{ position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'auto' }}
                    >
                      {USE_CURTAIN_FIRST_FLOW && curtainMeasureState.status === 'pending' && (
                        <div className="pointer-events-none absolute left-3 top-3 z-[120] max-w-[260px]">
                          <Banner variant="info">{t('estimate.loadingMagic')}</Banner>
                        </div>
                      )}
                      {USE_CURTAIN_FIRST_FLOW && curtainMeasureError && (
                        <div className="pointer-events-none absolute left-3 top-3 z-[121] max-w-[260px]">
                          <Banner variant="error">{curtainMeasureError}</Banner>
                        </div>
                      )}
                      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} viewBox={`0 0 ${Math.max(imgSize.w, 1)} ${Math.max(imgSize.h, 1)}`}>
                        <polygon points={readyPxPts} fill="none" stroke={"var(--cw-wall-stroke, #e5e7eb)"} strokeOpacity={"var(--cw-wall-stroke-opacity, 1)"} strokeWidth={2} />
                      </svg>
                      <div style={{ position: 'absolute', left: `${wallBoxPct.left}%`, top: `${wallBoxPct.top}%`, width: `${wallBoxPct.width}%`, height: `${wallBoxPct.height}%` }}>
                        {topMidPct && (
                          <div
                            onPointerDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                              setBoxHover(true);
                              if (!corners) return;
                              setBoxDrag({
                                startX: e.clientX,
                                startY: e.clientY,
                                initialCorners: corners.map((c) => ({ x: c.x, y: c.y })),
                              });
                            }}
                            onMouseEnter={() => setBoxHover(true)}
                            onMouseLeave={() => { if (!boxDrag) setBoxHover(false); }}
                            style={{
                              position: 'absolute',
                              left: `calc(${(((topMidPct.x * 100) - wallBoxPct.left) / Math.max(0.0001, wallBoxPct.width)) * 100}% - ${(boxHover ? 8 : 5) * hitboxScale}px)`,
                              top: `calc(${(((topMidPct.y * 100) - wallBoxPct.top) / Math.max(0.0001, wallBoxPct.height)) * 100}% - ${(boxHover ? 8 : 5) * hitboxScale}px)`,
                              width: (boxHover ? 16 : 10) * hitboxScale,
                              height: (boxHover ? 16 : 10) * hitboxScale,
                              borderRadius: 999,
                              zIndex: 120,
                              pointerEvents: 'auto',
                              transition: 'width 120ms ease, height 120ms ease, left 120ms ease, top 120ms ease',
                              touchAction: 'none',
                            }}
                            className="cw-handle cw-handle--move"
                            aria-label={`wallbox-move`}
                          />
                        )}
                        {segments.map((seg, ix) => {
                          const wallWidthPx = (wallBoxPct.width / 100) * imgSize.w;
                          const wallHeightPx = (wallBoxPct.height / 100) * imgSize.h;
                          const segWidthPx = (seg.widthPercent / 100) * wallWidthPx;
                          const yMidFromXSeg = (xSegPx: number) => (xSegPx * texOrient.sinA + (wallHeightPx * 0.5) * texOrient.cosA);
                          const yCenterPct = (yMidFromXSeg(segWidthPx / 2) / Math.max(1, wallHeightPx)) * 100;
                          const yLeftPct = (yMidFromXSeg(0) / Math.max(1, wallHeightPx)) * 100;
                          const yRightPct = (yMidFromXSeg(segWidthPx) / Math.max(1, wallHeightPx)) * 100;
                          const xOffsetPct = -((wallHeightPx * 0.5) * texOrient.sinA) / Math.max(1, wallWidthPx) * 100;
                          return (
                            <div key={`handles-${ix}`}>
                              <div
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                                  setSegDrag({ type: 'move', index: ix, startX: e.clientX, initialLayouts: JSON.parse(JSON.stringify(segments)) });
                                }}
                                style={{ position: 'absolute', left: `calc(${seg.offsetPercent + seg.widthPercent / 2 + xOffsetPct}% - ${9 * hitboxScale}px)`, top: `calc(${yCenterPct}% - ${9 * hitboxScale}px)`, width: 18 * hitboxScale, height: 18 * hitboxScale, borderRadius: 9 * hitboxScale, zIndex: 100, transform: `rotate(${texOrient.angleRad}rad)`, pointerEvents: 'auto', touchAction: 'none' }}
                                className="cw-handle cw-handle--grab cw-debug-ui"
                                aria-label={`segment-${ix + 1}-move`}
                              />
                              <div
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                                  setSegDrag({ type: 'resize-left', index: ix, startX: e.clientX, initialLayouts: JSON.parse(JSON.stringify(segments)) });
                                }}
                                style={{ position: 'absolute', left: `calc(${seg.offsetPercent + xOffsetPct}% - ${6 * hitboxScale}px)`, top: `calc(${yLeftPct}% - ${12 * hitboxScale}px)`, width: 12 * hitboxScale, height: 24 * hitboxScale, borderRadius: 4 * hitboxScale, zIndex: 100, transform: `rotate(${texOrient.angleRad}rad)`, pointerEvents: 'auto', touchAction: 'none' }}
                                className="cw-handle cw-handle--ew cw-debug-ui"
                                aria-label={`segment-${ix + 1}-resize-left`}
                              />
                              <div
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                                  setSegDrag({ type: 'resize-right', index: ix, startX: e.clientX, initialLayouts: JSON.parse(JSON.stringify(segments)) });
                                }}
                                style={{ position: 'absolute', left: `calc(${seg.offsetPercent + seg.widthPercent + xOffsetPct}% - ${6 * hitboxScale}px)`, top: `calc(${yRightPct}% - ${12 * hitboxScale}px)`, width: 12 * hitboxScale, height: 24 * hitboxScale, borderRadius: 4 * hitboxScale, zIndex: 100, transform: `rotate(${texOrient.angleRad}rad)`, pointerEvents: 'auto', touchAction: 'none' }}
                                className="cw-handle cw-handle--ew cw-debug-ui"
                                aria-label={`segment-${ix + 1}-resize-right`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      {corners.map((p, ix) => (
                        <div
                          key={`corner-${ix}`}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try { window.getSelection()?.removeAllRanges(); } catch {}
                            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                            setDragIx(ix);
                          }}
                          style={{
                            position: 'absolute',
                            left: `calc(${(p.x * 100).toFixed(2)}% - ${8 * hitboxScale}px)`,
                            top: `calc(${(p.y * 100).toFixed(2)}% - ${8 * hitboxScale}px)`,
                            width: 16 * hitboxScale,
                            height: 16 * hitboxScale,
                            borderRadius: 8 * hitboxScale,
                            cursor: 'grab',
                            zIndex: 110,
                            pointerEvents: 'auto',
                            touchAction: 'none',
                          }}
                          className="cw-handle cw-handle--grab"
                          aria-label={`corner-${ix + 1}`}
                        />
                      ))}
                      {(() => {
                        const totalLabel = t('configure.overlay.totalDimensions', {
                          width: formatNumber(dims.wCm, { maximumFractionDigits: 0 }),
                          height: formatNumber(dims.hCm, { maximumFractionDigits: 0 }),
                          unit: t('common.unit.cm'),
                        });
                        const segmentsSummary = segments
                          .map((s) => `${formatNumber(dims.wCm * (s.widthPercent / 100), { maximumFractionDigits: 0 })} ${t('common.unit.cm')}`)
                          .join(' | ');
                        const segmentsLabel = t('configure.overlay.segments', { list: segmentsSummary });
                        return (
                          <>
                            <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1">
                              <div className="rounded-lg bg-black/60 px-[10px] py-[6px] text-[12px] text-white">
                                {totalLabel}
                              </div>
                              <div className="rounded-lg bg-black/50 px-2 py-1 text-[11px] text-white">
                                {segmentsLabel}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                      {phase === 'ready' && (clampNotice || stitchNoticeMessage) && (
                        <>
                          <Toast show={!!clampNotice} position="center">
                            {clampNotice?.message}
                          </Toast>
                          <Toast
                            show={!!stitchNoticeMessage}
                            position="center"
                            offsetY={clampNotice ? 64 : 0}
                          >
                            {stitchNoticeMessage}
                          </Toast>
                        </>
                      )}
                    </div>
                )}
              </div>
            )}
          </div>
        </div>
    </>
  );
}
