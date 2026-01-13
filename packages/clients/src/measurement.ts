export type LocalMeasureDebug = {
  a4Corners?: number[][];
  wallBounds?: { left: number; top: number; right: number; bottom: number };
  pxPerCm?: number;
  rectifiedBoundsCm?: { minX: number; maxX: number; minY: number; maxY: number };
  sheet?: { widthCm: number; heightCm: number; avgWidthPx: number; avgHeightPx: number };
  trimPercentile?: { lower: number; upper: number };
  mode?: 'rectified' | 'axisAligned';
  axisEstimate?: { widthCm: number; heightCm: number; valid: boolean };
  rectifiedError?: string;
  rectifiedDisabled?: boolean;
  thumbs?: Record<string, string>;
};

export type LocalMeasureResult = {
  wallWidthCm: number;
  wallHeightCm: number;
  debug?: LocalMeasureDebug;
};

export type LocalMeasureOptions = {
  url: string;
  scaleLongSide?: number | null;
  debug?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

function buildHeaders(opts: LocalMeasureOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
  };
  if (opts.scaleLongSide != null && Number.isFinite(opts.scaleLongSide)) {
    headers['X-Scale-Long-Side'] = String(Math.max(1, Math.floor(opts.scaleLongSide)));
  }
  if (opts.debug) headers['X-Debug'] = '1';
  if (opts.headers) {
    for (const [key, value] of Object.entries(opts.headers)) {
      if (value != null) headers[key] = value;
    }
  }
  return headers;
}

function coercePositiveNumber(value: unknown, field: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`Invalid ${field} from local measurement response`);
  }
  return num;
}

/**
 * Minimal client for the FastAPI /measure endpoint (local CV path).
 */
export async function measureLocalCV(image: Buffer, opts: LocalMeasureOptions): Promise<LocalMeasureResult> {
  const url = opts.url;
  if (!url) throw new Error('measureLocalCV requires a URL');
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(opts),
    body: image,
    signal: opts.signal,
  } as RequestInit);

  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.detail === 'string') detail = parsed.detail;
    } catch {}
    throw new Error(`Local measurement error ${res.status}: ${detail}`);
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse local measurement JSON: ${(err as Error).message}`);
  }

  const wallWidthCm = coercePositiveNumber(json?.wallWidthCm, 'wallWidthCm');
  const wallHeightCm = coercePositiveNumber(json?.wallHeightCm, 'wallHeightCm');

  const result: LocalMeasureResult = { wallWidthCm, wallHeightCm };
  if (json && typeof json === 'object' && json.debug && typeof json.debug === 'object') {
    result.debug = json.debug as LocalMeasureDebug;
  }
  return result;
}
