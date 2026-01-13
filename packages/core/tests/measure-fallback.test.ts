import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  computePolygonBBoxFractions,
  scaleMeasurementByPolygonBBox,
  measureWithFallback,
} from '../src/services/measureFallback.ts';
import type { CurtainPolygon, MeasureOutput } from '../src/types/services';

function makeBaseMeasurement(overrides: Partial<MeasureOutput> = {}): MeasureOutput {
  return {
    wallWidthCm: 400,
    wallHeightCm: 200,
    ...overrides,
  };
}

function makeBoxPolygon(left: number, right: number, top: number, bottom: number): CurtainPolygon {
  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

describe('measureFallback helpers', () => {
  it('computes polygon bbox fractions from a simple box', () => {
    const polygon = makeBoxPolygon(0.1, 0.9, 0.2, 0.7);
    const fractions = computePolygonBBoxFractions(polygon)!;
    assert.ok(fractions, 'expected fractions');
    const eps = 1e-6;
    assert.ok(Math.abs(fractions.rectWidthFraction - 0.8) < eps);
    assert.ok(Math.abs(fractions.rectHeightFraction - 0.5) < eps);
  });

  it('returns null bbox fractions for degenerate polygons', () => {
    const polygon = makeBoxPolygon(0.2, 0.2, 0.3, 0.7); // zero width
    const fractions = computePolygonBBoxFractions(polygon);
    assert.equal(fractions, null);
  });

  it('scales measurement by bbox fractions and records geometry debug', () => {
    const base = makeBaseMeasurement({ wallWidthCm: 500, wallHeightCm: 250 });
    const scaled = scaleMeasurementByPolygonBBox(base, {
      rectWidthFraction: 0.5,
      rectHeightFraction: 0.25,
    });

    assert.equal(scaled.wallWidthCm, 250);
    assert.equal(scaled.wallHeightCm, 62.5);

    const debug = scaled.debug as Record<string, any> | undefined;
    assert.ok(debug && typeof debug === 'object');
    const geom = debug.geometryScaling as Record<string, any> | undefined;
    assert.ok(geom && typeof geom === 'object');
    assert.equal(geom.kind, 'bboxScale');
    assert.equal(geom.baseWallWidthCm, 500);
    assert.equal(geom.baseWallHeightCm, 250);
    assert.ok(geom.rectWidthFraction <= 1 && geom.rectWidthFraction >= 0);
    assert.ok(geom.rectHeightFraction <= 1 && geom.rectHeightFraction >= 0);
  });

  it('prefers high-confidence polygonResult over geometric fallback', () => {
    const base = makeBaseMeasurement();
    const polygon = makeBoxPolygon(0.1, 0.9, 0.2, 0.7);
    const polygonResult: MeasureOutput = {
      wallWidthCm: 190,
      wallHeightCm: 110,
      confidencePct: 80,
    };

    const result = measureWithFallback({ base, polygon, polygonResult });
    assert.equal(result.wallWidthCm, 190);
    assert.equal(result.wallHeightCm, 110);
    assert.equal(result.usedFallback, false);
    assert.equal(result.fallbackProvider, undefined);
  });

  it('falls back to wall×bbox scaling when polygonResult confidence is low', () => {
    const base = makeBaseMeasurement({ wallWidthCm: 400, wallHeightCm: 200 });
    const polygon = makeBoxPolygon(0.0, 0.5, 0.0, 0.5); // 50% × 50%
    const polygonResult: MeasureOutput = {
      wallWidthCm: 999,
      wallHeightCm: 999,
      confidencePct: 40,
    };

    const result = measureWithFallback({ base, polygon, polygonResult, confidenceThresholdPct: 50 });

    // Expect geometric scaling of base rather than polygonResult dimensions.
    assert.equal(result.wallWidthCm, 200);
    assert.equal(result.wallHeightCm, 100);
    assert.equal(result.usedFallback, true);
    assert.equal(result.fallbackProvider, 'geometry:bbox');
    assert.ok(Array.isArray(result.warnings));
    assert.ok(result.warnings!.some((w) => w.includes('wall×bbox')));
  });

  it('uses geometric scaling without marking fallback when no polygonResult is provided', () => {
    const base = makeBaseMeasurement({ wallWidthCm: 300, wallHeightCm: 180 });
    const polygon = makeBoxPolygon(0.0, 0.5, 0.0, 0.5);

    const result = measureWithFallback({ base, polygon });
    assert.equal(result.wallWidthCm, 150);
    assert.equal(result.wallHeightCm, 90);
    assert.equal(result.usedFallback, false);
  });

  it('returns base measurement unchanged when no polygon is available', () => {
    const base = makeBaseMeasurement({ wallWidthCm: 320, wallHeightCm: 240 });

    const result = measureWithFallback({ base, polygon: null });
    assert.equal(result.wallWidthCm, 320);
    assert.equal(result.wallHeightCm, 240);
    assert.equal(result.usedFallback, false);
  });
});
