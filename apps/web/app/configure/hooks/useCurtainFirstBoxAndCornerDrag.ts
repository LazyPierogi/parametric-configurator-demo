import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useEffect } from 'react';
import { maybeSnap as maybeSnapPx } from '../lib/rightAngleSnap';

type HeroPoint = { x: number; y: number };

type BoxDragState = { startX: number; startY: number; initialCorners: HeroPoint[] } | null;

type UseCurtainFirstBoxAndCornerDragArgs = {
  imgRef: RefObject<HTMLImageElement | null>;
  fullscreenImgRef: RefObject<HTMLImageElement | null>;
  isFullscreen: boolean;
  imgSize: { w: number; h: number };
  corners: HeroPoint[] | null;
  setCorners: Dispatch<SetStateAction<HeroPoint[] | null>>;
  boxDrag: BoxDragState;
  setBoxDrag: Dispatch<SetStateAction<BoxDragState>>;
  setBoxHover: Dispatch<SetStateAction<boolean>>;
  dragIx: number | null;
  setDragIx: Dispatch<SetStateAction<number | null>>;
  maxCurtainHeightCm: number | null;
  baseBoxRatio: { w: number; h: number } | null;
  baseCm: { w: number; h: number };
  notifyClamp: (type: 'height' | 'width', message: string) => void;
};

export function useCurtainFirstBoxAndCornerDrag({
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
  maxCurtainHeightCm,
  baseBoxRatio,
  baseCm,
  notifyClamp,
}: UseCurtainFirstBoxAndCornerDragArgs) {
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
      const next = boxDrag.initialCorners.map((c) => ({
        x: Math.max(0, Math.min(1, c.x + dx)),
        y: Math.max(0, Math.min(1, c.y + dy)),
      }));
      setCorners(next);
    };
    const onEnd = () => {
      setBoxHover(false);
      setBoxDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [boxDrag, imgRef, setCorners, setBoxDrag, setBoxHover]);

  useEffect(() => {
    if (dragIx == null) return;
    const onMove = (e: PointerEvent) => {
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
        pxPoints[dragIx] = maybeSnapPx(pxPoints, dragIx, proposedPx);

        let didClamp = false;
        const heightLimitCm =
          typeof maxCurtainHeightCm === 'number' && Number.isFinite(maxCurtainHeightCm) ? maxCurtainHeightCm : null;

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
  }, [
    dragIx,
    corners,
    imgRef,
    fullscreenImgRef,
    isFullscreen,
    imgSize,
    maxCurtainHeightCm,
    baseBoxRatio,
    baseCm,
    notifyClamp,
    setCorners,
    setDragIx,
  ]);
}
