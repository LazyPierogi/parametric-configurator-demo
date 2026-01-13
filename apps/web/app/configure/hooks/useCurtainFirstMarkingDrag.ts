import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import { useEffect } from 'react';
import { maybeSnap as maybeSnapPx } from '../lib/rightAngleSnap';

type HeroPoint = { x: number; y: number };

type UseCurtainFirstMarkingDragArgs = {
  phase: 'idle' | 'segmenting' | 'mark' | 'ready' | 'restoring';
  imgRef: RefObject<HTMLImageElement | null>;
  imgSize: { w: number; h: number };
  markPicks: HeroPoint[];
  setMarkPicks: Dispatch<SetStateAction<HeroPoint[]>>;
  markNormalizedRef: MutableRefObject<boolean>;
  setCorners: Dispatch<SetStateAction<HeroPoint[] | null>>;
  markDragIx: number | null;
  setMarkDragIx: Dispatch<SetStateAction<number | null>>;
};

export function useCurtainFirstMarkingDrag({
  phase,
  imgRef,
  imgSize,
  markPicks,
  setMarkPicks,
  markNormalizedRef,
  setCorners,
  markDragIx,
  setMarkDragIx,
}: UseCurtainFirstMarkingDragArgs) {
  useEffect(() => {
    if (markPicks.length !== 4) {
      return;
    }
    if (!markNormalizedRef.current) {
      const xs = markPicks.map((p) => p.x);
      const ys = markPicks.map((p) => p.y);
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
    setCorners(markPicks);
  }, [markPicks, setCorners, setMarkPicks, markNormalizedRef]);

  useEffect(() => {
    if (phase !== 'mark' || markDragIx == null) return;
    const onMove = (e: PointerEvent) => {
      const host = imgRef.current?.getBoundingClientRect();
      if (!host) return;
      const x = (e.clientX - host.left) / Math.max(1, host.width);
      const y = (e.clientY - host.top) / Math.max(1, host.height);
      const p = { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
      setMarkPicks((prev) => {
        if (prev.length !== 4) return prev;
        const widthPx = Math.max(1, imgSize.w);
        const heightPx = Math.max(1, imgSize.h);
        const toPx = (q: { x: number; y: number }) => ({ x: q.x * widthPx, y: q.y * heightPx });
        const fromPx = (q: { x: number; y: number }) => ({
          x: Math.max(0, Math.min(1, q.x / widthPx)),
          y: Math.max(0, Math.min(1, q.y / heightPx)),
        });
        const ptsPx = prev.map(toPx);
        const proposedPx = toPx(p);
        const snappedPx = maybeSnapPx(ptsPx, markDragIx, proposedPx);
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
  }, [phase, markDragIx, imgRef, imgSize, setMarkPicks, setMarkDragIx]);
}
