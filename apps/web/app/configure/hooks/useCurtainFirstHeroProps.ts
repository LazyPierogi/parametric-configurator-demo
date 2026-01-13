"use client";

import type React from 'react';
import type { CurtainPhotoHeroProps } from '@/features/configurator/components/CurtainPhotoHero';
import type { TranslateFn } from '../types';

type UseCurtainFirstHeroPropsArgs = {
  className?: string;

  isMobile: boolean;
  heroDockedDesktop: boolean;
  heroStickyRef: React.RefObject<HTMLElement | null>;

  dropRef: React.RefObject<HTMLDivElement | null>;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onPaste: (event: React.ClipboardEvent<HTMLDivElement>) => void;
  MOBILE_FIRST_TEST: boolean;
  dragActive: boolean;
  previewUrl: string | null;
  t: TranslateFn;
  MAX_MB: number;

  curtainHeroRef: React.RefObject<HTMLElement | null>;
  imgRef: React.RefObject<HTMLImageElement | null>;
  overlayRef: React.RefObject<HTMLElement | null>;
  wallBoxRef: React.RefObject<HTMLElement | null>;
  fullscreenImgRef: React.RefObject<HTMLImageElement | null>;

  phase: string;
  wallMaskUrl: string | null;
  clipPoly: unknown | null;
  wallBoxPct: any;
  segments: any;
  imgSize: any;
  texOrient: any;

  lightingEnabled: boolean;
  LIGHTING_MODE: string;
  lighting: any;
  LIGHTING_OPACITY: number;

  getRenderableUrl: (url?: string | null) => string | null;
  texScale: number;
  texOpacity: number;

  USE_CANVAS_RENDERER: boolean;
  selectedFabric: any;
  selectedChildItem: any;
  selectedPleatId: string | null;
  renderPipeline: any;
  canvasRenderParams: any;

  segDrag: any;
  DEBUG_UI_ENABLED: boolean;
  wallBoxPixels: any;

  boxHover: any;
  setBoxHover: (v: any) => void;
  boxDrag: any;
  setBoxDrag: (v: any) => void;
  setSegDrag: (v: any) => void;
  setDragIx: (v: any) => void;
  dragIx: any;

  corners: any;
  dims: any;
  formatNumber: (value: number, opts?: Intl.NumberFormatOptions) => string;

  clampNotice: any;

  stitchNoticeMessage: any;
  stitchPositionsFromQuote: any;
  stitchWidthsPerSegment: any;
  stitchActiveFabric: any;
  effectiveStitchWidthCm: any;
  stitchLineBackground: any;
  stitchLineOpacity: any;
  stitchLinesVisible: boolean;
  triggerStitchNotice: (...args: any[]) => void;
  STITCH_LINE_HITBOX_PX: number;
  STITCH_LINE_WIDTH_PX: number;

  materialReuseActive: boolean;

  markPicks: any;
  setMarkPicks: (v: any) => void;
  setCorners: (v: any) => void;
  markNormalizedRef: React.MutableRefObject<boolean>;
  setPhase: (v: any) => void;
  markDragIx: any;
  setMarkDragIx: (v: any) => void;

  maybeSnap: (...args: any[]) => void;
  notifyClamp: (...args: any[]) => void;
  maxCurtainHeightCm: number;

  baseBoxRatio: any;
  baseCm: any;
  topMidPct: any;

  showMask: boolean;
  maskUrl: string | null;
  progress: any;

  USE_CURTAIN_FIRST_FLOW: boolean;
  curtainMeasureState: any;
  curtainMeasureError: any;

  readyPxPts: any;

  isFullscreen: boolean;
  setIsFullscreen: (v: boolean) => void;

  screenshotCanvasRef: any;

  onCurtainPainted?: () => void;
};

export function useCurtainFirstHeroProps({
  className,
  isMobile,
  heroDockedDesktop,
  heroStickyRef,
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
  overlayRef,
  wallBoxRef,
  fullscreenImgRef,
  phase,
  wallMaskUrl,
  clipPoly,
  wallBoxPct,
  segments,
  imgSize,
  texOrient,
  lightingEnabled,
  LIGHTING_MODE,
  lighting,
  LIGHTING_OPACITY,
  getRenderableUrl,
  texScale,
  texOpacity,
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
  screenshotCanvasRef,
  onCurtainPainted,
}: UseCurtainFirstHeroPropsArgs): CurtainPhotoHeroProps {
  return {
    className,
    isMobile,
    heroDockedDesktop,
    heroStickyRef,
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
    overlayRef,
    wallBoxRef,
    fullscreenImgRef,
    phase,
    wallMaskUrl,
    clipPoly,
    wallBoxPct,
    segments,
    imgSize,
    texOrient,
    lightingEnabled,
    LIGHTING_MODE,
    lighting,
    LIGHTING_OPACITY,
    textureUrl: null,
    getRenderableUrl,
    texScale,
    texOpacity,
    hoverTextureUrl: null,
    crossfadeUrl: null,
    crossfadeActive: false,
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
    screenshotCanvasRef,
    onCurtainPainted,
  };
}
