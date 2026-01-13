import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { __measureInternals } from '../src/services/measure';

const {
  sanitizePolygon,
  polygonInstructions,
  buildUniversalPrompt,
  buildPromptTemplate,
  summarizeCurtainPolygon,
} = __measureInternals;

describe('measureFromImage polygon helpers', () => {
  it('sanitizes polygons and clamps coordinates to 0..1', () => {
    const points = [
      { x: -0.2, y: 0.1 },
      { x: 0.5, y: 1.2 },
      { x: 0.8, y: 0.4 },
      { x: Number.NaN, y: 0.3 },
    ];
    const sanitized = sanitizePolygon(points);
    assert.ok(sanitized, 'expected sanitized polygon');
    assert.equal(sanitized!.length, 3, 'invalid points should be removed');
    assert.deepEqual(sanitized![0], { x: 0, y: 0.1 });
    assert.deepEqual(sanitized![1], { x: 0.5, y: 1 });
    assert.deepEqual(sanitized![2], { x: 0.8, y: 0.4 });
  });

  it('returns null for incomplete or invalid polygons', () => {
    assert.equal(sanitizePolygon(undefined), null);
    assert.equal(sanitizePolygon([]), null);
    assert.equal(sanitizePolygon([{ x: 0.1, y: 0.2 }]), null);
  });

  it('builds polygon instructions with bounding span percentages', () => {
    const polygon = sanitizePolygon([
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.6 },
      { x: 0.1, y: 0.6 },
    ]);
    assert.ok(polygon);
    const instructions = polygonInstructions(polygon);
    assert.match(instructions, /FOCUS REGION/);
    assert.match(instructions, /Point 1: 10\.00% width, 10\.00% height/);
    assert.match(instructions, /Approximate bounding span: 80\.00% width × 50\.00% height/);
    assert.match(instructions, /Projected area coverage: 40\.00% of the image\./);
  });

  it('embeds polygon instructions into prompt builders', () => {
    const polygon = sanitizePolygon([
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.8, y: 0.7 },
    ]);
    assert.ok(polygon);
    const universal = buildUniversalPrompt(polygon);
    assert.match(universal, /Report wallWidthCm and wallHeightCm for this polygon span/);
    const template = buildPromptTemplate(polygon);
    assert.match(template, /Photo: \{\{media url=photoDataUri\}\}/);
  });

  it('summarizes polygon coverage metrics', () => {
    const polygon = sanitizePolygon([
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.7, y: 0.7 },
      { x: 0.3, y: 0.6 },
    ]);
    assert.ok(polygon);
    const summary = summarizeCurtainPolygon(polygon!);
    assert.ok(summary.widthPct > 0);
    assert.ok(summary.heightPct > 0);
    assert.ok(summary.areaPct > 0);
  });
});
