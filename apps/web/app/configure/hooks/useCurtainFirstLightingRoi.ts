import { useEffect, useState } from 'react';

type HeroPoint = { x: number; y: number };

type LightingRoi = { x: number; y: number; w: number; h: number };

export function useCurtainFirstLightingRoi({
  corners,
  dragIx,
  boxDragActive,
}: {
  corners: HeroPoint[] | null;
  dragIx: number | null;
  boxDragActive: boolean;
}): LightingRoi | null {
  const [lightingRoi, setLightingRoi] = useState<LightingRoi | null>(null);

  useEffect(() => {
    if (!corners || corners.length < 3) {
      setLightingRoi(null);
      return;
    }
    if (dragIx != null || boxDragActive) return;
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    const minX = Math.max(0, Math.min(...xs));
    const minY = Math.max(0, Math.min(...ys));
    const maxX = Math.min(1, Math.max(...xs));
    const maxY = Math.min(1, Math.max(...ys));
    const w = Math.max(1e-3, maxX - minX);
    const h = Math.max(1e-3, maxY - minY);
    setLightingRoi({ x: minX, y: minY, w, h });
  }, [corners, dragIx, boxDragActive]);

  return lightingRoi;
}
