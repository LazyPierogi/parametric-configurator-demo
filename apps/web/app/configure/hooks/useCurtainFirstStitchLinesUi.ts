"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TranslateFn } from '../types';

type UseCurtainFirstStitchLinesUiArgs = {
  t: TranslateFn;
  segDrag: unknown;
};

type UseCurtainFirstStitchLinesUiResult = {
  stitchLinesVisible: boolean;
  setStitchLinesVisible: (value: boolean) => void;
  setStitchChipHovering: (value: boolean) => void;
  stitchNoticeMessage: string | null;
  stitchLineBackground: string;
  stitchLineOpacity: number;
  triggerStitchNotice: () => void;
  STITCH_LINE_HITBOX_PX: number;
  STITCH_LINE_WIDTH_PX: number;
};

export function useCurtainFirstStitchLinesUi({
  t,
  segDrag,
}: UseCurtainFirstStitchLinesUiArgs): UseCurtainFirstStitchLinesUiResult {
  const STITCH_LINES_ENV_DEFAULT = (process.env.NEXT_PUBLIC_STITCH_LINES_ENABLED ?? '1') !== '0';
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

  return {
    stitchLinesVisible,
    setStitchLinesVisible,
    setStitchChipHovering,
    stitchNoticeMessage,
    stitchLineBackground,
    stitchLineOpacity,
    triggerStitchNotice,
    STITCH_LINE_HITBOX_PX,
    STITCH_LINE_WIDTH_PX,
  };
}
