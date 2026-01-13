import type { CurtainPolygon } from '../types/services';

export type PixelPoint = { x: number; y: number };

export type ImageSize = {
  width: number;
  height: number;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function orientation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const v = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  if (v > 0) return 1; // counter‑clockwise
  if (v < 0) return -1; // clockwise
  return 0; // collinear
}

function onSegment(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean {
  return Math.min(ax, bx) <= cx && cx <= Math.max(ax, bx) && Math.min(ay, by) <= cy && cy <= Math.max(ay, by);
}

function segmentsIntersect(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  p4x: number,
  p4y: number,
): boolean {
  const o1 = orientation(p1x, p1y, p2x, p2y, p3x, p3y);
  const o2 = orientation(p1x, p1y, p2x, p2y, p4x, p4y);
  const o3 = orientation(p3x, p3y, p4x, p4y, p1x, p1y);
  const o4 = orientation(p3x, p3y, p4x, p4y, p2x, p2y);

  if (o1 !== o2 && o3 !== o4) return true;

  if (o1 === 0 && onSegment(p1x, p1y, p2x, p2y, p3x, p3y)) return true;
  if (o2 === 0 && onSegment(p1x, p1y, p2x, p2y, p4x, p4y)) return true;
  if (o3 === 0 && onSegment(p3x, p3y, p4x, p4y, p1x, p1y)) return true;
  if (o4 === 0 && onSegment(p3x, p3y, p4x, p4y, p2x, p2y)) return true;

  return false;
}

export function isSimplePolygon(points: CurtainPolygon | null | undefined): boolean {
  if (!Array.isArray(points) || points.length < 3) return false;
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    const a1 = points[i];
    const a2 = points[(i + 1) % n];
    for (let j = i + 1; j < n; j += 1) {
      const b1 = points[j];
      const b2 = points[(j + 1) % n];
      const sharesEndpoint =
        (a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2) ||
        Math.abs(i - j) === 1 ||
        (i === 0 && j === n - 1) ||
        (j === 0 && i === n - 1);
      if (sharesEndpoint) continue;
      if (segmentsIntersect(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y, b2.x, b2.y)) {
        return false;
      }
    }
  }
  return true;
}

export function normalizePolygonFromPx(pointsPx: PixelPoint[], imgSize: ImageSize): CurtainPolygon | null {
  if (!Array.isArray(pointsPx) || pointsPx.length < 3) return null;
  const width = imgSize.width || 0;
  const height = imgSize.height || 0;
  if (!(width > 0 && height > 0)) return null;

  const normalized: CurtainPolygon = pointsPx
    .map((pt) => {
      const nx = clamp01(pt.x / width);
      const ny = clamp01(pt.y / height);
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
      return { x: nx, y: ny };
    })
    .filter((pt): pt is { x: number; y: number } => !!pt);

  if (normalized.length < 3) return null;
  if (!isSimplePolygon(normalized)) return null;
  return normalized;
}
