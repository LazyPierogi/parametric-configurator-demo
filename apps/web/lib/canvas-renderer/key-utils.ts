/**
 * Canvas Renderer Key Utilities
 * Provides helpers to serialize render parameters into compact, stable cache keys.
 */

import type { RenderConfig } from './types';

type Rect = RenderConfig['wallBox'];
type Segment = RenderConfig['segmentBounds'];
type RenderParams = RenderConfig['renderParams'] | Record<string, unknown> | undefined;

function normalizeNumber(value: number): string {
  if (!Number.isFinite(value)) return 'NaN';
  // Round to 4 decimal places to avoid key churn from floating noise
  return (Math.round(value * 10000) / 10000).toString();
}

/**
 * Serialize render parameters into a deterministic string.
 * Automatically handles new fields without requiring manual updates.
 */
export function serializeRenderParams(params: RenderParams): string {
  if (!params) return '';

  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      let normalized: string;
      if (typeof value === 'number') {
        normalized = normalizeNumber(value);
      } else if (typeof value === 'boolean') {
        normalized = value ? '1' : '0';
      } else if (value == null) {
        normalized = 'null';
      } else {
        normalized = String(value);
      }
      return [key, normalized] as const;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  return entries.map(([key, value]) => `${key}:${value}`).join('|');
}

/**
 * Serialize wall box coordinates (pixels).
 */
export function formatWallBox(wallBox: Rect): string {
  if (!wallBox) return '';
  const { x, y, width, height } = wallBox;
  return [
    normalizeNumber(x),
    normalizeNumber(y),
    normalizeNumber(width),
    normalizeNumber(height),
  ].join(',');
}

/**
 * Serialize segment bounds within the wall box.
 */
export function formatSegmentBounds(segment: Segment): string {
  if (!segment) return '';
  const { xInWallBox, width } = segment;
  return [normalizeNumber(xInWallBox), normalizeNumber(width)].join(',');
}
