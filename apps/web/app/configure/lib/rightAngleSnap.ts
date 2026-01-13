export type PointPx = { x: number; y: number };

export function snapToRightAnglePx(
  prev: PointPx,
  p: PointPx,
  next: PointPx,
  opts?: { thresholdDeg?: number; strength?: number }
): PointPx {
  const thresholdDeg = opts?.thresholdDeg ?? 5;
  const strength = opts?.strength ?? 0.5;

  const v1x = p.x - prev.x;
  const v1y = p.y - prev.y;
  const v2x = next.x - p.x;
  const v2y = next.y - p.y;
  const n1 = Math.hypot(v1x, v1y) || 1;
  const n2 = Math.hypot(v2x, v2y) || 1;
  const dot = (v1x / n1) * (v2x / n2) + (v1y / n1) * (v2y / n2);
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  const devDeg = Math.abs((angle * 180) / Math.PI - 90);
  if (devDeg > thresholdDeg) return p;

  const mx = (prev.x + next.x) / 2;
  const my = (prev.y + next.y) / 2;
  const r = Math.hypot(next.x - prev.x, next.y - prev.y) / 2;
  const dx = p.x - mx;
  const dy = p.y - my;
  const d = Math.hypot(dx, dy);
  if (d < 1e-3 || r <= 0) return p;

  const proj = { x: mx + (dx / d) * r, y: my + (dy / d) * r };
  return { x: p.x + (proj.x - p.x) * strength, y: p.y + (proj.y - p.y) * strength };
}

export function rightAngleDeviation(a: PointPx, pivot: PointPx, b: PointPx): number {
  const v1x = a.x - pivot.x;
  const v1y = a.y - pivot.y;
  const v2x = b.x - pivot.x;
  const v2y = b.y - pivot.y;
  const n1 = Math.hypot(v1x, v1y);
  const n2 = Math.hypot(v2x, v2y);
  if (n1 < 1e-3 || n2 < 1e-3) return Number.POSITIVE_INFINITY;

  const dot = (v1x / n1) * (v2x / n2) + (v1y / n1) * (v2y / n2);
  const angleDeg = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
  return Math.abs(angleDeg - 90);
}

export function maybeSnap(
  pts: PointPx[],
  dragIx: number,
  proposed: PointPx,
  opts?: { thresholdDeg?: number; strength?: number }
): PointPx {
  if (pts.length !== 4) return proposed;
  const prevIx = (dragIx + 3) % 4;
  const nextIx = (dragIx + 1) % 4;

  const snapped = snapToRightAnglePx(pts[prevIx], proposed, pts[nextIx], opts);

  const candidate = pts.slice();
  candidate[dragIx] = snapped;

  const prevPrevIx = (prevIx + 3) % 4;
  const nextNextIx = (nextIx + 1) % 4;
  const threshold = opts?.thresholdDeg ?? 5;

  const devAtDrag = rightAngleDeviation(candidate[prevIx], candidate[dragIx], candidate[nextIx]);
  const devAtPrev = rightAngleDeviation(candidate[prevPrevIx], candidate[prevIx], candidate[dragIx]);
  const devAtNext = rightAngleDeviation(candidate[dragIx], candidate[nextIx], candidate[nextNextIx]);

  if (devAtDrag <= threshold && devAtPrev <= threshold && devAtNext <= threshold) {
    return snapped;
  }

  return proposed;
}
