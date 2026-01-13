import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useEffect } from 'react';

type SegmentLayout = { offsetPercent: number; widthPercent: number };

type SegmentDragState =
  | {
      type: 'move' | 'resize-left' | 'resize-right';
      index: number;
      startX: number;
      initialLayouts: SegmentLayout[];
    }
  | null;

type UseCurtainFirstSegmentDragArgs = {
  phase: 'idle' | 'segmenting' | 'mark' | 'ready' | 'restoring';
  segments: SegmentLayout[];
  setSegments: Dispatch<SetStateAction<SegmentLayout[]>>;
  segDrag: SegmentDragState;
  setSegDrag: Dispatch<SetStateAction<SegmentDragState>>;
  wallBoxRef: RefObject<HTMLDivElement | null>;
  dims: { wCm: number };
  maxPanelWidthPercent: number;
  maxPanelWidthCm: number | null;
  MIN_SEG_WIDTH: number;
  DEFAULT_SEG_GAP_PX: number;
  segmentCount: number;
  wallBoxWidthPct: number;
  imgWidthPx: number;
  clampMessage: string | null;
  notifyClamp: (type: 'height' | 'width', message: string) => void;
};

export function useCurtainFirstSegmentDrag({
  phase,
  segments,
  setSegments,
  segDrag,
  setSegDrag,
  wallBoxRef,
  dims,
  maxPanelWidthPercent,
  maxPanelWidthCm,
  MIN_SEG_WIDTH,
  DEFAULT_SEG_GAP_PX,
  segmentCount,
  wallBoxWidthPct,
  imgWidthPx,
  clampMessage,
  notifyClamp,
}: UseCurtainFirstSegmentDragArgs) {
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

    if (
      segDrag &&
      (segDrag.type === 'resize-left' || segDrag.type === 'resize-right') &&
      typeof maxPanelWidthCm === 'number' &&
      Number.isFinite(maxPanelWidthCm)
    ) {
      console.debug('[clamp] effect auto-adjusted segment widths', {
        segDrag: segDrag.type,
        maxPanelWidthCm,
        maxPanelWidthPercent,
      });
      notifyClamp('width', `This fabric choice is limited to ${Math.round(maxPanelWidthCm)}cm width.`);
    }
  }, [phase, segments, maxPanelWidthPercent, maxPanelWidthCm, segDrag, notifyClamp, setSegments]);

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
        const baseMinWidthPct = MIN_SEG_WIDTH;
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
          const overFabricLimit =
            fabricLimitActive &&
            ((limitPct != null && requestedWidthPct > limitPct + 1e-3) ||
              (limitCm != null && requestedWidthCm > limitCm + 0.5));

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
          const overFabricLimit =
            fabricLimitActive &&
            ((limitPct != null && requestedWidthPct > limitPct + 1e-3) ||
              (limitCm != null && requestedWidthCm > limitCm + 0.5));

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
          const maxAllowed = Number.isFinite(maxPanelWidthPercent)
            ? Math.min(rightEdge - minLeft, maxPanelWidthPercent)
            : rightEdge - minLeft;
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
        setSegDrag((prev) =>
          prev
            ? {
                ...prev,
                startX: e.clientX,
                initialLayouts: JSON.parse(JSON.stringify(finalLayouts)),
              }
            : null,
        );
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
  }, [segDrag, wallBoxRef, setSegments, setSegDrag, dims.wCm, maxPanelWidthPercent, maxPanelWidthCm, clampMessage, notifyClamp, phase, MIN_SEG_WIDTH]);

  useEffect(() => {
    const n = Math.max(1, Math.min(4, segmentCount));
    const wallWidthPx = (wallBoxWidthPct / 100) * imgWidthPx;
    if (wallWidthPx <= 0) return;

    const almost = (a: number, b: number) => Math.abs(a - b) < 1e-3;
    const expectedW = 100 / n;
    const isInitialEqual =
      segments.length === n &&
      segments.every((s, i) => almost(s.widthPercent, expectedW) && almost(s.offsetPercent, i * expectedW));

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
  }, [segmentCount, wallBoxWidthPct, imgWidthPx, segments, setSegments, DEFAULT_SEG_GAP_PX, MIN_SEG_WIDTH]);
}
