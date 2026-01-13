import { useMemo } from 'react';

type HeroPoint = { x: number; y: number };

type SegmentLayout = { offsetPercent: number; widthPercent: number };

type WallBoxBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
};

type WallBoxPct = { left: number; top: number; width: number; height: number };

type WallBoxPixels = { x: number; y: number; width: number; height: number };

type TexOrient = { angleRad: number; bgYOffsetPx: number; sinA: number; cosA: number };

type TopMidPct = { x: number; y: number };

export function useCurtainFirstGeometryDerived({
  corners,
  segments,
  imgSize,
}: {
  corners: HeroPoint[] | null;
  segments: SegmentLayout[];
  imgSize: { w: number; h: number };
}): {
  clipPoly: string | undefined;
  readyPxPts: string;
  wallBoxBounds: WallBoxBounds | null;
  wallBoxPct: WallBoxPct;
  wallBoxPixels: WallBoxPixels | null;
  boxRatio: { w: number; h: number };
  coverageRatio: number;
  texOrient: TexOrient;
  topMidPct: TopMidPct | null;
} {
  const clipPoly = useMemo(() => {
    if (!corners || corners.length < 3) return undefined;
    const pts = corners
      .map((p) => `${(p.x * 100).toFixed(2)}% ${(p.y * 100).toFixed(2)}%`)
      .join(', ');
    return `polygon(${pts})`;
  }, [corners]);

  const readyPxPts = useMemo(() => {
    if (!corners || corners.length < 3) return '';
    return corners.map((p) => `${p.x * imgSize.w},${p.y * imgSize.h}`).join(' ');
  }, [corners, imgSize]);

  const wallBoxBounds = useMemo<WallBoxBounds | null>(() => {
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

  const wallBoxPct = useMemo<WallBoxPct>(() => {
    if (!wallBoxBounds) return { left: 0, top: 0, width: 100, height: 100 };
    return {
      left: wallBoxBounds.minX * 100,
      top: wallBoxBounds.minY * 100,
      width: wallBoxBounds.width * 100,
      height: wallBoxBounds.height * 100,
    };
  }, [wallBoxBounds]);

  const wallBoxPixels = useMemo<WallBoxPixels | null>(() => {
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

  const coverageRatio = useMemo(() => {
    if (!segments.length || !corners || corners.length < 3) return 0;
    const sum = segments.reduce((acc, seg) => acc + Math.max(0, Math.min(seg.widthPercent, 100)), 0);
    return Math.min(1, Math.max(0.05, sum / 100));
  }, [segments, corners]);

  const texOrient = useMemo<TexOrient>(() => {
    if (!corners || corners.length < 2 || imgSize.w === 0 || imgSize.h === 0) {
      return { angleRad: 0, bgYOffsetPx: 0, sinA: 0, cosA: 1 };
    }
    const pts = corners.map((p) => ({ x: p.x * imgSize.w, y: p.y * imgSize.h }));
    let best = { a: 0, b: 1, avgY: Number.POSITIVE_INFINITY };
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const avgY = (pts[i].y + pts[j].y) / 2;
      if (avgY < best.avgY) best = { a: i, b: j, avgY };
    }
    const A = pts[best.a];
    const B = pts[best.b];
    const angleRad = Math.atan2(B.y - A.y, B.x - A.x);
    const sinA = Math.sin(angleRad);
    const cosA = Math.cos(angleRad);
    const rotY = (x: number, y: number) => -x * sinA + y * cosA;
    const y0r = rotY(A.x, A.y);
    const y1r = rotY(B.x, B.y);
    const bgYOffsetPx = (y0r + y1r) / 2;
    return { angleRad, bgYOffsetPx, sinA, cosA };
  }, [corners, imgSize]);

  const topMidPct = useMemo<TopMidPct | null>(() => {
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

  return {
    clipPoly,
    readyPxPts,
    wallBoxBounds,
    wallBoxPct,
    wallBoxPixels,
    boxRatio,
    coverageRatio,
    texOrient,
    topMidPct,
  };
}
