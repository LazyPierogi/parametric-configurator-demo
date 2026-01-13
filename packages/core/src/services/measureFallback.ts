import type { CurtainPolygon, MeasureOutput } from '../types/services';
import { summarizeCurtainPolygon } from './measurePrompt';

export type MeasureWithFallbackInput = {
  base: MeasureOutput;
  polygon?: CurtainPolygon | null;
  polygonResult?: MeasureOutput | null;
  confidenceThresholdPct?: number;
};

export type MeasureWithFallbackResult = MeasureOutput & {
  usedFallback: boolean;
  fallbackProvider?: string;
};

export type PolygonBBoxFractions = {
  rectWidthFraction: number;
  rectHeightFraction: number;
};

export function computePolygonBBoxFractions(polygon: CurtainPolygon | null | undefined): PolygonBBoxFractions | null {
  if (!polygon || polygon.length < 3) return null;
  const summary = summarizeCurtainPolygon(polygon);
  const width = summary.widthPct / 100;
  const height = summary.heightPct / 100;
  if (!(width > 0 && width <= 1)) return null;
  if (!(height > 0 && height <= 1)) return null;
  return { rectWidthFraction: width, rectHeightFraction: height };
}

export function scaleMeasurementByPolygonBBox(base: MeasureOutput, fractions: PolygonBBoxFractions): MeasureOutput {
  const widthFactor = Math.max(0, Math.min(1, fractions.rectWidthFraction));
  const heightFactor = Math.max(0, Math.min(1, fractions.rectHeightFraction));
  const scaledWidth = base.wallWidthCm * widthFactor;
  const scaledHeight = base.wallHeightCm * heightFactor;
  const debug = {
    ...(base.debug || {}),
    geometryScaling: {
      kind: 'bboxScale',
      rectWidthFraction: widthFactor,
      rectHeightFraction: heightFactor,
      baseWallWidthCm: base.wallWidthCm,
      baseWallHeightCm: base.wallHeightCm,
    },
  } as Record<string, unknown>;
  return {
    ...base,
    wallWidthCm: scaledWidth,
    wallHeightCm: scaledHeight,
    debug,
  };
}

export function measureWithFallback(input: MeasureWithFallbackInput): MeasureWithFallbackResult {
  const { base, polygon, polygonResult, confidenceThresholdPct = 50 } = input;
  const fractions = computePolygonBBoxFractions(polygon ?? null);

  if (polygonResult && typeof polygonResult.confidencePct === 'number') {
    const confidence = polygonResult.confidencePct;
    if (confidence >= confidenceThresholdPct) {
      return {
        ...polygonResult,
        usedFallback: false,
      };
    }
    if (fractions) {
      const scaled = scaleMeasurementByPolygonBBox(base, fractions);
      const warnings = (scaled.warnings ? [...scaled.warnings] : []).concat([
        `Measurement fell back to wall×bbox scaling because polygon confidence ${Math.round(confidence)}% < ${confidenceThresholdPct}%.`,
      ]);
      return {
        ...scaled,
        warnings,
        usedFallback: true,
        fallbackProvider: 'geometry:bbox',
      };
    }
  }

  if (fractions) {
    const scaled = scaleMeasurementByPolygonBBox(base, fractions);
    return {
      ...scaled,
      usedFallback: false,
    };
  }

  return {
    ...base,
    usedFallback: false,
  };
}
