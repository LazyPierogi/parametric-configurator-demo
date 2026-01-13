import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';

type HeroPoint = { x: number; y: number };

function clampCornersByRatio(input: HeroPoint[], ratio: number): HeroPoint[] {
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
}

export function useCurtainFirstHeightAutoClamp({
  phase,
  corners,
  setCorners,
  dims,
  maxCurtainHeightCm,
  selectedFabric,
}: {
  phase: 'idle' | 'segmenting' | 'mark' | 'ready' | 'restoring';
  corners: HeroPoint[] | null;
  setCorners: Dispatch<SetStateAction<HeroPoint[] | null>>;
  dims: { hCm: number };
  maxCurtainHeightCm: number | null;
  selectedFabric: unknown;
}) {
  useEffect(() => {
    if (phase !== 'ready' || !corners || !selectedFabric) return;
    if (typeof maxCurtainHeightCm !== 'number' || !Number.isFinite(maxCurtainHeightCm)) return;
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
  }, [phase, corners, dims.hCm, maxCurtainHeightCm, selectedFabric, setCorners]);
}
