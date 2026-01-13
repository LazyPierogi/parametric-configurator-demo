import type { CurtainPolygon } from '../types/services';

export type PolygonSummary = {
  widthPct: number;
  heightPct: number;
  areaPct: number;
};

export const UNIVERSAL_PROMPT =
  'You are an expert at estimating wall dimensions from photos. Follow these steps:\n\n' +
  'STEP 1: Identify the main opposite wall\n' +
  '- Focus on the single wall directly facing the camera\n' +
  '- Exclude side walls, floor, and ceiling from measurements\n' +
  '- Note any perspective distortion or lens effects\n\n' +
  'STEP 2: Find reference objects with known dimensions\n' +
  'Look for these common objects:\n' +
  '- Doors: typically 200-210cm height, 70-90cm width\n' +
  '- Windows: typically 120-150cm height, 80-120cm width\n' +
  '- Electrical outlets: typically 10-30cm above floor\n' +
  '- Light switches: typically 110-120cm above floor\n' +
  '- Baseboards: typically 10-15cm height\n\n' +
  'STEP 3: Establish scale\n' +
  '- Use reference objects to calculate pixel-to-centimeter ratio\n' +
  '- If no clear references exist, estimate from typical mobile phone FOV (65-75° horizontal, 50-60° vertical)\n' +
  '- Account for perspective: objects near image edges appear more distorted\n\n' +
  'STEP 4: Measure the wall\n' +
  '- Identify wall boundaries (left edge, right edge, top edge near ceiling, bottom edge near floor)\n' +
  '- Apply your calculated scale to convert pixels to centimeters\n' +
  '- Sanity check: typical interior walls are 230-300cm height, 250-600cm width\n\n' +
  'Provide ONLY this JSON output: { "wallWidthCm": number, "wallHeightCm": number }\n' +
  'Target accuracy: within 10% of actual dimensions.\n';

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function sanitizeCurtainPolygon(points?: CurtainPolygon | null): CurtainPolygon | null {
  if (!Array.isArray(points)) return null;
  const cleaned = points
    .map((pt) => {
      const rawX = typeof pt?.x === 'number' ? pt.x : Number(pt?.x);
      const rawY = typeof pt?.y === 'number' ? pt.y : Number(pt?.y);
      if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
        return null;
      }
      return {
        x: clamp01(rawX),
        y: clamp01(rawY),
      };
    })
    .filter((pt): pt is { x: number; y: number } => !!pt);
  if (cleaned.length < 3) return null;
  return cleaned as CurtainPolygon;
}

export function summarizeCurtainPolygon(points: CurtainPolygon): PolygonSummary {
  const xs = points.map((pt) => pt.x);
  const ys = points.map((pt) => pt.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  const normalizedArea = Math.max(0, Math.abs(area) / 2);
  return {
    widthPct: width * 100,
    heightPct: height * 100,
    areaPct: normalizedArea * 100,
  };
}

export function polygonInstructions(points: CurtainPolygon | null): string {
  if (!points || points.length < 3) return '';
  const summary = summarizeCurtainPolygon(points);
  const vertices = points
    .map((pt, idx) => {
      const px = (pt.x * 100).toFixed(2);
      const py = (pt.y * 100).toFixed(2);
      return `  - Point ${idx + 1}: ${px}% width, ${py}% height`;
    })
    .join('\n');
  const bounding = `Approximate bounding span: ${summary.widthPct.toFixed(2)}% width × ${summary.heightPct.toFixed(2)}% height.`;
  const area = `Projected area coverage: ${summary.areaPct.toFixed(2)}% of the image.`;
  return [
    '\nFOCUS REGION:',
    'The customer selected a curtain box described by this polygon (normalized to image width/height):',
    vertices,
    bounding,
    area,
    'Measure only the wall area inside this polygon. Ignore the rest of the scene.',
    'Report wallWidthCm and wallHeightCm for this polygon span.',
    '',
  ].join('\n');
}

export function buildPolygonAwarePrompt(polygon: CurtainPolygon | null): string {
  return UNIVERSAL_PROMPT + polygonInstructions(polygon);
}

export function buildUniversalPrompt(polygon: CurtainPolygon | null): string {
  return buildPolygonAwarePrompt(polygon);
}

export function buildPromptTemplate(polygon: CurtainPolygon | null): string {
  return `${buildPolygonAwarePrompt(polygon)}Photo: {{media url=photoDataUri}}\n`;
}
