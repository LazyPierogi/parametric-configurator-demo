import { loadEnv } from '@curtain-wizard/shared/src/env';
import type { CurtainPolygon, MeasureOutput } from '../types/services';
import { HfInference } from '@huggingface/inference';
import exifr from 'exifr';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

type ExifCandidate = { buffer: Buffer; mime?: string };

type NoReferenceOptions = {
  debug?: boolean;
  exifCandidates?: ExifCandidate[];
  curtainPolygon?: CurtainPolygon | null;
};

type SceneMaskResult = {
  width: number;
  height: number;
  wall: Uint8Array;
  floor: Uint8Array;
  ceiling: Uint8Array;
  window?: Uint8Array; // Optional: for wall refinement
  source: 'local' | 'hf' | 'fallback';
};

type MaskKind = 'wall' | 'floor' | 'ceiling' | 'window';

type ExifResult = {
  focalPx: number | null;
  source: 'exif' | 'fallback';
};

type BandInference = {
  value: number | null;
  strategy: 'mask' | 'gradient' | 'fallback';
};

type ConfidenceBreakdown = {
  base: number;
  penalties: number;
  confidence: number;
};

type DebugPayload = {
  provider: 'noreref';
  segmentationSource: 'local' | 'hf' | 'fallback';
  focalPx: number | null;
  distanceCm: number;
  cameraHeightCm: number;
  scaleCmPerPixel: number;
  ceilingY: number | null;
  floorY: number | null;
  wallBoundsPx: { left: number; right: number; top: number; bottom: number; width: number; height: number } | null;
  bandStrategies: { ceiling: BandInference['strategy']; floor: BandInference['strategy'] };
  confidence: ConfidenceBreakdown;
  sceneType?: 'simple' | 'fragmented';
  peakCount?: number;
  sharpness?: number;
  sections?: Array<{ left: number; right: number; width: number }>;
};

const HF_MODEL = process.env.MEASURE_HF_MODEL || 'nvidia/segformer-b5-finetuned-ade-640-640';

const WALL_ALIASES = ['wall'];
const FLOOR_ALIASES = ['floor'];
const CEILING_ALIASES = ['ceiling'];
const EXIF_TMP_DIR = join(os.tmpdir(), 'cw-heic-cache');
const HEIC_SIGNATURES = ['ftypheic', 'ftypheix', 'ftyphevc', 'ftypheis', 'ftyphevm', 'ftyphevs', 'ftypmif1', 'ftypmsf1', 'ftypavif'];
const LOCAL_SEG_TIMEOUT_MS = 60000; // 60s total for 3 sequential calls (~3-4s each + overhead)
const HF_SEG_TIMEOUT_MS = 30000;
const EXIF_TIMEOUT_MS = 7000;
const EXIF_HEIC_TIMEOUT_MS = 15000;

function normalizeLabel(label: unknown): string {
  return String(label || '').toLowerCase().trim();
}

function isLikelyHeic(candidate: ExifCandidate): boolean {
  const mime = (candidate.mime || '').toLowerCase();
  if (mime.includes('heic') || mime.includes('heif')) return true;
  if (candidate.buffer.length >= 12) {
    const signature = candidate.buffer.subarray(4, 12).toString('ascii');
    if (HEIC_SIGNATURES.some((sig) => signature.includes(sig))) {
      return true;
    }
  }
  return false;
}

function includesAlias(label: string, aliases: string[]): boolean {
  return aliases.some((alias) => label.includes(alias));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, Math.max(1, timeoutMs));
    if (timeoutId && typeof (timeoutId as any).unref === 'function') {
      try { (timeoutId as any).unref(); } catch {}
    }
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function percentile(values: number[], pct: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = clamp(pct, 0, 100) / 100 * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  const weight = rank - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (match) {
      const parsed = Number(match[0]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  if (typeof value === 'object') {
    const { numerator, denominator } = value as any;
    if (typeof numerator === 'number' && typeof denominator === 'number' && denominator !== 0) {
      const num = numerator / denominator;
      if (Number.isFinite(num)) return num;
    }
  }
  return null;
}

async function decodeMask(buffer: Buffer): Promise<{ width: number; height: number; mask: Uint8Array }> {
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;
  const channels = info.channels || 4;
  const mask = new Uint8Array(width * height);
  const alphaIndex = channels >= 4 ? 3 : 0;
  for (let i = alphaIndex, j = 0; j < mask.length; i += channels, j++) {
    mask[j] = data[i] > 127 ? 1 : 0;
  }
  return { width, height, mask };
}

function isAbortError(err: unknown): boolean {
  return (err as any)?.name === 'AbortError';
}

type MaskResult = { mask: Uint8Array; width: number; height: number };

async function segmentWithLocal(image: Buffer, debug: boolean, env: ReturnType<typeof loadEnv>): Promise<SceneMaskResult> {
  const url = env.LOCAL_SEG_URL;
  const controller = LOCAL_SEG_TIMEOUT_MS > 0 ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), LOCAL_SEG_TIMEOUT_MS) : null;
  
  // Ensure image is JPEG (FastAPI may not handle HEIC)
  let processedImage = image;
  if (isLikelyHeic({ buffer: image })) {
    try {
      try { console.log('[NOREREF] Converting HEIC to JPEG for segmentation'); } catch {}
      const converted = await convertHeicLikeToJpeg(image);
      if (converted) {
        processedImage = converted.buffer;
      }
    } catch (err) {
      try { console.warn('[NOREREF] HEIC conversion failed, sending original', err); } catch {}
    }
  }
  
  // PERFORMANCE FIX: Make ONE segmentation call instead of 4 sequential calls
  // The FastAPI service runs full Mask2Former inference each time - we can't afford 4× calls
  async function fetchMask(kind: MaskKind) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
      'X-Model': 'mask2former_ade20k',
      'X-Threshold': '0.6',
      'X-Mask': kind,
    };
    if (debug) headers['X-Debug'] = '1';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: processedImage,
        signal: controller?.signal,
      } as RequestInit);
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Local segmentation error ${res.status}: ${msg}`);
      }
      if (!(res.arrayBuffer instanceof Function)) {
        throw new Error('Local segmentation response missing arrayBuffer method');
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) {
        throw new Error('Local segmentation returned empty payload');
      }
      return decodeMask(buf);
    } catch (err) {
      if (isAbortError(err)) {
        throw new Error(`Local segmentation timed out after ${LOCAL_SEG_TIMEOUT_MS}ms`);
      }
      throw err;
    }
  }

  try {
    // CRITICAL PERFORMANCE OPTIMIZATION:
    // Use /segment-batch endpoint that returns ALL masks from ONE inference (4× faster)
    // Instead of 4 sequential calls each running full Mask2Former inference
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream',
      'X-Model': 'mask2former_ade20k',
    };
    if (debug) headers['X-Debug'] = '1';
    
    const batchUrl = url.replace('/segment', '/segment-batch');
    
    try {
      const res = await fetch(batchUrl, {
        method: 'POST',
        headers,
        body: processedImage,
        signal: controller?.signal,
      } as RequestInit);
      
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Batch segmentation error ${res.status}: ${msg}`);
      }
      
      const json = await res.json() as {
        wall: string;
        floor: string;
        ceiling: string;
        window: string;
        width: number;
        height: number;
      };
      
      // Decode base64 PNG masks
      const wallBuf = Buffer.from(json.wall, 'base64');
      const floorBuf = Buffer.from(json.floor, 'base64');
      const ceilingBuf = Buffer.from(json.ceiling, 'base64');
      const windowBuf = Buffer.from(json.window, 'base64');
      
      const [wall, floor, ceiling, window] = await Promise.all([
        decodeMask(wallBuf),
        decodeMask(floorBuf),
        decodeMask(ceilingBuf),
        decodeMask(windowBuf),
      ]);
      
      if (wall.width !== floor.width || wall.width !== ceiling.width || 
          wall.height !== floor.height || wall.height !== ceiling.height) {
        throw new Error('Batch segmentation returned mismatched dimensions');
      }
      
      return {
        width: wall.width,
        height: wall.height,
        wall: wall.mask,
        floor: floor.mask,
        ceiling: ceiling.mask,
        window: window.mask,
        source: 'local',
      };
    } catch (err) {
      if (isAbortError(err)) {
        throw new Error(`Batch segmentation timed out after ${LOCAL_SEG_TIMEOUT_MS}ms`);
      }
      throw err;
    }
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function segmentWithHf(image: Buffer, debug: boolean, env: ReturnType<typeof loadEnv>): Promise<SceneMaskResult> {
  const token = env.HF_TOKEN;
  if (!token) {
    throw new Error('HF_TOKEN is not configured');
  }
  const sharp = (await import('sharp')).default;
  const meta = await sharp(image).metadata();
  const width = meta.width || 1;
  const height = meta.height || 1;

  const hf = new HfInference(token);
  const uint8 = Uint8Array.from(image);
  const blob = new Blob([uint8], { type: 'image/jpeg' });
  const controller = HF_SEG_TIMEOUT_MS > 0 ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), HF_SEG_TIMEOUT_MS) : null;
  let segments;
  try {
    segments = await hf.imageSegmentation({ model: HF_MODEL, data: blob, signal: controller?.signal } as any);
  } catch (err) {
    if (isAbortError(err)) {
      throw new Error(`HF segmentation timed out after ${HF_SEG_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error('HF segmentation returned no segments');
  }

  const wall = new Uint8Array(width * height);
  const floor = new Uint8Array(width * height);
  const ceiling = new Uint8Array(width * height);

  for (const seg of segments) {
    const label = normalizeLabel(seg?.label);
    const isWall = includesAlias(label, WALL_ALIASES);
    const isFloor = includesAlias(label, FLOOR_ALIASES);
    const isCeiling = includesAlias(label, CEILING_ALIASES);
    if (!isWall && !isFloor && !isCeiling) continue;
    let maskBuf: Buffer | null = null;
    const rawMask = (seg as any)?.mask;
    // Handle various mask formats from HF
    if (rawMask?.arrayBuffer instanceof Function) {
      try {
        maskBuf = Buffer.from(await rawMask.arrayBuffer());
      } catch (err) {
        try { console.warn('[NOREREF] arrayBuffer() method failed', err); } catch {}
      }
    }
    // Handle Blob-like objects
    if (!maskBuf && typeof rawMask === 'object' && rawMask !== null && 'arrayBuffer' in rawMask) {
      try {
        const ab = await (rawMask as any).arrayBuffer();
        maskBuf = Buffer.from(ab);
      } catch (err) {
        try { console.warn('[NOREREF] Blob arrayBuffer conversion failed', err); } catch {}
      }
    }
    // Handle base64 strings
    if (!maskBuf && typeof rawMask === 'string') {
      const base64 = rawMask.startsWith('data:') ? rawMask.split(',')[1] : rawMask;
      maskBuf = Buffer.from(base64, 'base64');
    }
    // Handle Uint8Array
    if (!maskBuf && rawMask instanceof Uint8Array) {
      maskBuf = Buffer.from(rawMask.buffer, rawMask.byteOffset, rawMask.byteLength);
    }
    if (!maskBuf) {
      try { console.warn('[NOREREF] Could not decode mask for segment:', label); } catch {}
      continue;
    }
    const decoded = await sharp(maskBuf)
      .resize({ width, height, fit: 'fill', kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const data = decoded.data;
    const channels = decoded.info.channels || 4;
    const alphaIndex = channels >= 4 ? 3 : 0;
    for (let i = alphaIndex, j = 0; j < width * height; i += channels, j++) {
      if (data[i] > 127) {
        if (isWall) wall[j] = 1;
        if (isFloor) floor[j] = 1;
        if (isCeiling) ceiling[j] = 1;
      }
    }
  }

  if (!wall.some(Boolean)) {
    throw new Error('HF segmentation failed to detect wall');
  }

  return { width, height, wall, floor, ceiling, source: 'hf' };
}

async function segmentScene(image: Buffer, debug: boolean, env: ReturnType<typeof loadEnv>): Promise<{ result: SceneMaskResult; warning: string | null }> {
  try {
    const res = await segmentWithLocal(image, debug, env);
    return { result: res, warning: null };
  } catch (err) {
    const warn = `Local segmentation unavailable (${(err as Error).message})`;
    try {
      const res = await segmentWithHf(image, debug, env);
      return { result: res, warning: warn };
    } catch (hfErr) {
      throw new Error(`Segmentation failed: local→${(err as Error).message}; hf→${(hfErr as Error).message}`);
    }
  }
}

function buildFallbackScene(width: number, height: number): SceneMaskResult {
  const pixels = Math.max(1, width * height);
  const wall = new Uint8Array(pixels).fill(1);
  const floor = new Uint8Array(pixels);
  const ceiling = new Uint8Array(pixels);
  return { width, height, wall, floor, ceiling, source: 'fallback' };
}

async function decodeGray(image: Buffer): Promise<{ data: Uint8Array; width: number; height: number }> {
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(image)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    width: info.width,
    height: info.height,
  };
}

async function convertHeicLikeToJpeg(buffer: Buffer): Promise<ExifCandidate | null> {
  try {
    const sharp = (await import('sharp')).default;
    const converted = await sharp(buffer).jpeg({ quality: 95 }).toBuffer();
    if (converted?.length) return { buffer: converted, mime: 'image/jpeg' };
  } catch (err) {
    try { console.warn('[NOREREF] sharp HEIC convert failed', err); } catch {}
  }
  try {
    const heicConvert = (await import('heic-convert')).default as (opts: { buffer: Buffer; format: 'JPEG'; quality: number }) => Promise<Buffer>;
    const converted = await heicConvert({ buffer, format: 'JPEG', quality: 0.9 });
    if (converted?.length) return { buffer: converted, mime: 'image/jpeg' };
  } catch (err) {
    try { console.warn('[NOREREF] heic-convert fallback failed', err); } catch {}
  }
  try {
    const heicDecode = (await import('heic-decode')).default as (opts: { buffer: Buffer }) => Promise<{ width: number; height: number; data: Uint8Array }>;
    const decoded = await heicDecode({ buffer });
    if (decoded?.data?.length && decoded.width && decoded.height) {
      const sharp = (await import('sharp')).default;
      const rawBuffer = Buffer.from(decoded.data.buffer, decoded.data.byteOffset ?? 0, decoded.data.byteLength ?? decoded.data.length);
      const converted = await sharp(rawBuffer, {
        raw: { width: decoded.width, height: decoded.height, channels: 4 },
      }).jpeg({ quality: 92 }).toBuffer();
      if (converted?.length) return { buffer: converted, mime: 'image/jpeg' };
    }
  } catch (err) {
    try { console.warn('[NOREREF] heic-decode fallback failed', err); } catch {}
  }
  return null;
}

function computeRowDiffs(gray: Uint8Array, width: number, height: number): Float64Array {
  const diffs = new Float64Array(height);
  for (let y = 0; y < height - 1; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const nextIdx = (y + 1) * width + x;
      sum += Math.abs(gray[idx] - gray[nextIdx]);
    }
    diffs[y] = sum / width;
  }
  diffs[height - 1] = diffs[height - 2] || 0;
  return diffs;
}

function inferBandFromMask(mask: Uint8Array, width: number, height: number, pct: number, selector: 'floor' | 'ceiling'): BandInference {
  const rows: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        rows.push(y);
        break;
      }
    }
  }
  if (!rows.length) return { value: null, strategy: 'fallback' };
  const perc = percentile(rows, pct);
  if (perc == null) return { value: null, strategy: 'fallback' };
  return { value: perc, strategy: 'mask' };
}

function inferBandFromGradients(rowDiffs: Float64Array, height: number, selector: 'floor' | 'ceiling'): BandInference {
  if (!rowDiffs.length) return { value: null, strategy: 'fallback' };
  if (selector === 'ceiling') {
    const limit = Math.max(1, Math.floor(height * 0.4));
    let maxVal = -1;
    let best = 0;
    for (let y = 1; y < limit; y++) {
      if (rowDiffs[y] > maxVal) {
        maxVal = rowDiffs[y];
        best = y;
      }
    }
    return { value: best, strategy: 'gradient' };
  }
  const start = Math.max(1, Math.floor(height * 0.6));
  let maxVal = -1;
  let best = height - 1;
  for (let y = start; y < height - 1; y++) {
    if (rowDiffs[y] > maxVal) {
      maxVal = rowDiffs[y];
      best = y;
    }
  }
  return { value: best, strategy: 'gradient' };
}

/**
 * Peak detection result for histogram analysis
 */
type HistogramPeak = {
  position: number;    // X coordinate of peak center
  value: number;       // Peak height (pixel count)
  left: number;        // Left boundary of peak region
  right: number;       // Right boundary of peak region
};

/**
 * Histogram analysis result with scene classification
 */
type HistogramAnalysis = {
  histogram: Float32Array;         // Raw histogram
  smoothed: Float32Array;          // Smoothed histogram
  peaks: HistogramPeak[];          // All detected peaks
  sharpness: number;               // Peak sharpness metric (max/avg)
  sceneType: 'simple' | 'fragmented';  // Scene classification
};

/**
 * Find all significant peaks in a histogram.
 * Used to detect multiple wall sections separated by windows/objects.
 */
function findAllPeaks(
  histogram: Float32Array,
  minHeight: number,
  minSeparation: number
): HistogramPeak[] {
  const peaks: HistogramPeak[] = [];
  const width = histogram.length;
  
  // Find local maxima
  for (let x = 1; x < width - 1; x++) {
    const val = histogram[x];
    if (val < minHeight) continue;
    
    // Check if this is a local maximum
    const isLocalMax = val >= histogram[x - 1] && val >= histogram[x + 1];
    if (!isLocalMax) continue;
    
    // Check separation from existing peaks
    const tooClose = peaks.some(p => Math.abs(p.position - x) < minSeparation);
    if (tooClose) {
      // If current peak is stronger, replace the nearby peak
      const nearbyIdx = peaks.findIndex(p => Math.abs(p.position - x) < minSeparation);
      if (nearbyIdx >= 0 && val > peaks[nearbyIdx].value) {
        peaks.splice(nearbyIdx, 1);
      } else {
        continue;
      }
    }
    
    peaks.push({
      position: x,
      value: val,
      left: x,
      right: x,
    });
  }
  
  // Sort peaks by strength (strongest first)
  peaks.sort((a, b) => b.value - a.value);
  
  return peaks;
}

/**
 * Expand peak boundaries to find the extent of each wall section.
 */
function expandPeakBoundaries(
  peaks: HistogramPeak[],
  smoothed: Float32Array,
  minThreshold: number,
  margin: number
): HistogramPeak[] {
  const width = smoothed.length;
  
  return peaks.map(peak => {
    let left = peak.position;
    let right = peak.position;
    
    // Expand left
    while (left > margin && smoothed[left] > minThreshold) {
      left--;
    }
    
    // Expand right
    while (right < width - margin && smoothed[right] > minThreshold) {
      right++;
    }
    
    return {
      ...peak,
      left: Math.max(margin, left),
      right: Math.min(width - margin - 1, right),
    };
  });
}

/**
 * Analyze histogram to detect scene complexity and all significant peaks.
 */
function analyzeHistogram(
  mask: Uint8Array,
  width: number,
  height: number,
  startY: number,
  endY: number,
  windowMask?: Uint8Array
): HistogramAnalysis {
  // Compute horizontal histogram (count of wall pixels per column)
  const histogram = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = startY; y <= endY; y++) {
      const idx = y * width + x;
      // Count wall pixels that are NOT windows
      if (mask[idx] && (!windowMask || !windowMask[idx])) {
        count++;
      }
    }
    histogram[x] = count;
  }
  
  // Smooth histogram with moving average
  const smoothed = new Float32Array(width);
  const kernelSize = Math.max(1, Math.floor(width * 0.03)); // 3% of width
  for (let x = 0; x < width; x++) {
    let sum = 0;
    let count = 0;
    for (let dx = -kernelSize; dx <= kernelSize; dx++) {
      const nx = x + dx;
      if (nx >= 0 && nx < width) {
        sum += histogram[nx];
        count++;
      }
    }
    smoothed[x] = sum / count;
  }
  
  // Calculate histogram statistics
  let maxVal = 0;
  let sumVal = 0;
  let nonZeroCount = 0;
  for (let x = 0; x < width; x++) {
    if (smoothed[x] > maxVal) maxVal = smoothed[x];
    if (smoothed[x] > 0) {
      sumVal += smoothed[x];
      nonZeroCount++;
    }
  }
  const avgVal = nonZeroCount > 0 ? sumVal / nonZeroCount : 0;
  const sharpness = avgVal > 0 ? maxVal / avgVal : 0;
  
  // Find all significant peaks
  const margin = Math.floor(width * 0.1); // Ignore outer 10%
  const minHeight = maxVal * 0.4; // At least 40% of max (conservative - only strong peaks)
  const minSeparation = Math.floor(width * 0.08); // At least 8% width apart (avoid close peaks)
  
  let peaks = findAllPeaks(smoothed, minHeight, minSeparation);
  
  // Filter peaks outside margin
  peaks = peaks.filter(p => p.position >= margin && p.position < width - margin);
  
  // Expand peak boundaries
  const expansionThreshold = maxVal * 0.12; // Lower than peak detection for wider bounds
  peaks = expandPeakBoundaries(peaks, smoothed, expansionThreshold, margin);
  
  // Classify scene based on peak count, sharpness, and peak strength distribution
  let sceneType: 'simple' | 'fragmented';
  
  if (peaks.length === 0) {
    sceneType = 'simple'; // No peaks found - fallback to Phase 2
  } else if (peaks.length === 1) {
    sceneType = 'simple'; // Single peak = simple scene (use Phase 2)
  } else {
    // Multiple peaks detected - check if they're truly fragmented or just noise
    // Calculate strength ratio: strongest peak vs second strongest
    const strongestPeak = peaks[0].value;
    const secondStrongestPeak = peaks[1].value;
    const strengthRatio = strongestPeak / Math.max(1, secondStrongestPeak);
    
    try {
      console.log(`[NOREREF] Histogram analysis: ${peaks.length} peaks, sharpness ${sharpness.toFixed(2)}, strength ratio ${strengthRatio.toFixed(2)} (peak1: ${strongestPeak.toFixed(1)}, peak2: ${secondStrongestPeak.toFixed(1)})`);
    } catch {}
    
    // If one peak dominates (>2x stronger), treat as simple scene
    // If peaks are similar strength (ratio <1.5), it's truly fragmented
    if (strengthRatio > 2.0) {
      sceneType = 'simple'; // Dominant peak with noise - use Phase 2
      try { console.log(`[NOREREF] → Simple scene (dominant peak, ratio ${strengthRatio.toFixed(2)} > 2.0)`); } catch {}
    } else if (sharpness < 1.8) {
      // Low sharpness + multiple similar peaks = truly fragmented
      sceneType = 'fragmented';
      try { console.log(`[NOREREF] → Fragmented scene (low sharpness ${sharpness.toFixed(2)} < 1.8)`); } catch {}
    } else {
      // Medium sharpness + multiple peaks = likely fragmented
      sceneType = 'fragmented';
      try { console.log(`[NOREREF] → Fragmented scene (similar peaks, ratio ${strengthRatio.toFixed(2)} < 2.0)`); } catch {}
    }
  }
  
  return {
    histogram,
    smoothed,
    peaks,
    sharpness,
    sceneType,
  };
}

/**
 * Find central wall region by analyzing horizontal distribution of wall pixels.
 * In typical room photos, the opposite wall is in the center; side walls appear at edges.
 * 
 * LEGACY: This is the Phase 2 algorithm that works perfectly for simple scenes.
 * Kept for backwards compatibility and fallback.
 */
function findCentralWallRegion(
  mask: Uint8Array,
  width: number,
  height: number,
  startY: number,
  endY: number,
  windowMask?: Uint8Array
): { left: number; right: number } | null {
  // Compute horizontal histogram (count of wall pixels per column)
  // Exclude window pixels to get continuous wall sections
  const histogram = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = startY; y <= endY; y++) {
      const idx = y * width + x;
      // Count wall pixels that are NOT windows
      if (mask[idx] && (!windowMask || !windowMask[idx])) {
        count++;
      }
    }
    histogram[x] = count;
  }
  
  // Smooth histogram with moving average to reduce noise
  const smoothed = new Float32Array(width);
  const kernelSize = Math.max(1, Math.floor(width * 0.03)); // 3% of width
  for (let x = 0; x < width; x++) {
    let sum = 0;
    let count = 0;
    for (let dx = -kernelSize; dx <= kernelSize; dx++) {
      const nx = x + dx;
      if (nx >= 0 && nx < width) {
        sum += histogram[nx];
        count++;
      }
    }
    smoothed[x] = sum / count;
  }
  
  // Find peak in central region (avoid edges where side walls appear)
  const margin = Math.floor(width * 0.1); // Ignore outer 10%
  let maxVal = 0;
  let peakX = Math.floor(width / 2);
  
  for (let x = margin; x < width - margin; x++) {
    if (smoothed[x] > maxVal) {
      maxVal = smoothed[x];
      peakX = x;
    }
  }
  
  if (maxVal === 0) return null; // No wall pixels found
  
  // Find bounds around peak where histogram drops below threshold
  // Use 15% of peak (lower = wider detection) to capture full wall width
  const threshold = maxVal * 0.15;
  let left = peakX;
  let right = peakX;
  
  // Expand left
  while (left > margin && smoothed[left] > threshold) {
    left--;
  }
  
  // Expand right
  while (right < width - margin && smoothed[right] > threshold) {
    right++;
  }
  
  // Ensure minimum width (at least 30% of image to avoid detecting only a small patch)
  const minWidth = Math.floor(width * 0.3);
  if (right - left < minWidth) {
    const expand = Math.floor((minWidth - (right - left)) / 2);
    left = Math.max(margin, left - expand);
    right = Math.min(width - margin, right + expand);
  }
  
  // Safety check: if we're still using >80% of width, likely failed - return null for fallback
  if ((right - left) / width > 0.8) {
    return null;
  }
  
  return { left, right };
}

/**
 * Measure wall using multi-peak detection for fragmented scenes.
 * Sums all wall sections separated by windows/objects.
 */
function measureFragmentedWall(
  mask: Uint8Array,
  width: number,
  height: number,
  startY: number,
  endY: number,
  analysis: HistogramAnalysis
): { totalWidth: number; sections: Array<{ left: number; right: number; width: number }>; confidence: number } {
  const sections = [];
  let totalWidth = 0;
  
  // Measure each peak region independently
  for (const peak of analysis.peaks) {
    // Skip tiny sections (noise)
    const sectionWidth = peak.right - peak.left;
    const minSectionWidth = Math.floor(width * 0.05); // At least 5% of image width
    if (sectionWidth < minSectionWidth) continue;
    
    sections.push({
      left: peak.left,
      right: peak.right,
      width: sectionWidth,
    });
    
    totalWidth += sectionWidth;
  }
  
  // Confidence: lower for fragmented scenes (more assumptions)
  // 1 section = 1.0, 2 sections = 0.85, 3+ sections = 0.7
  let confidence = 1.0;
  if (sections.length === 2) {
    confidence = 0.85;
  } else if (sections.length >= 3) {
    confidence = 0.7;
  }
  
  return { totalWidth, sections, confidence };
}

type WallBoundsResult = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  pixels: number;
  sceneType?: 'simple' | 'fragmented';
  sections?: Array<{ left: number; right: number; width: number }>;
  peakCount?: number;
  sharpness?: number;
  multiPeakConfidence?: number; // Additional confidence factor for multi-peak detection
};

function computeWallBounds(
  mask: Uint8Array,
  width: number,
  height: number,
  top: number,
  bottom: number,
  windowMask?: Uint8Array
): WallBoundsResult | null {
  if (height <= 0 || width <= 0) return null;
  const startY = clamp(Math.floor(top), 0, height - 1);
  const endY = clamp(Math.ceil(bottom), 0, height - 1);
  
  // Priority 1: Analyze histogram to detect scene complexity
  const analysis = analyzeHistogram(mask, width, height, startY, endY, windowMask);
  
  let searchLeft: number;
  let searchRight: number;
  let resultWidth: number;
  let sceneType = analysis.sceneType;
  let sections: Array<{ left: number; right: number; width: number }> | undefined;
  let multiPeakConfidence = 1.0;
  
  // Always try Phase 2 first (proven to work for simple scenes)
  const centralRegion = findCentralWallRegion(mask, width, height, startY, endY, windowMask);
  const phase2Left = centralRegion?.left ?? 0;
  const phase2Right = centralRegion?.right ?? width - 1;
  const phase2Width = phase2Right - phase2Left;
  const phase2WidthPct = (phase2Width / width) * 100;
  
  // Route to appropriate measurement strategy
  // Key insight: Only use multi-peak when there's STRONG evidence of fragmentation
  // AND the multi-peak result would be significantly better
  if (analysis.sceneType === 'fragmented' && analysis.peaks.length >= 2) {
    // Try multi-peak detection
    const fragmented = measureFragmentedWall(mask, width, height, startY, endY, analysis);
    const multiPeakWidth = fragmented.totalWidth;
    const improvement = multiPeakWidth / Math.max(1, phase2Width);
    
    // Use multi-peak ONLY if:
    // 1. Found multiple sections (2+)
    // 2. Multi-peak result is significantly wider (>1.8x Phase 2)
    // 3. Sharpness is low (<1.6) indicating truly fragmented scene
    const shouldUseMultiPeak = 
      fragmented.sections.length >= 2 &&
      improvement >= 1.8 &&
      analysis.sharpness < 1.6;
    
    if (shouldUseMultiPeak) {
      // Use multi-peak result
      sections = fragmented.sections;
      resultWidth = multiPeakWidth;
      multiPeakConfidence = fragmented.confidence;
      sceneType = 'fragmented';
      
      searchLeft = Math.min(...sections.map(s => s.left));
      searchRight = Math.max(...sections.map(s => s.right));
      
      try {
        console.log(`[NOREREF] Multi-peak: ${sections.length} sections, ${resultWidth}px (${improvement.toFixed(1)}x Phase 2 ${phase2Width}px), sharpness ${analysis.sharpness.toFixed(2)}`);
      } catch {}
    } else {
      // Phase 2 is better
      sceneType = 'simple';
      searchLeft = phase2Left;
      searchRight = phase2Right;
      resultWidth = phase2Width;
      
      try {
        console.log(`[NOREREF] Phase 2 preferred: ${resultWidth}px (multi-peak ${improvement.toFixed(1)}x, sharpness ${analysis.sharpness.toFixed(2)})`);
      } catch {}
    }
  } else {
    // Simple scene: use Phase 2
    sceneType = 'simple';
    searchLeft = phase2Left;
    searchRight = phase2Right;
    resultWidth = phase2Width;
    
    try {
      console.log(`[NOREREF] Phase 2 (simple): ${resultWidth}px (${phase2WidthPct.toFixed(0)}%), sharpness ${analysis.sharpness.toFixed(2)}`);
    } catch {}
  }
  
  // Scan wall pixels within determined bounds
  let left = Infinity;
  let right = -1;
  let minY = Infinity;
  let maxY = -1;
  let pixels = 0;
  
  for (let y = startY; y <= endY; y++) {
    for (let x = searchLeft; x <= searchRight; x++) {
      if (mask[y * width + x]) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        pixels++;
      }
    }
  }
  
  if (!Number.isFinite(left) || right < 0) return null;
  
  // Use the calculated width from multi-peak or Phase 2
  const spanWidth = resultWidth;
  const spanHeight = Math.max(0, maxY - minY);
  
  return {
    left,
    right,
    top: minY,
    bottom: maxY,
    width: spanWidth,
    height: spanHeight,
    pixels,
    sceneType,
    sections,
    peakCount: analysis.peaks.length,
    sharpness: analysis.sharpness,
    multiPeakConfidence,
  };
}

let exiftoolInstance: import('exiftool-vendored').ExifTool | null = null;

function isStaleExiftoolError(err: unknown): boolean {
  if (!err) return false;
  const message = (err as Error)?.message || String(err);
  return message.toLowerCase().includes('batchcluster has ended');
}

function dedupeCandidates(candidates: ExifCandidate[]): ExifCandidate[] {
  const seen = new Set<string>();
  const result: ExifCandidate[] = [];
  for (const cand of candidates) {
    if (!cand?.buffer || !cand.buffer.length) continue;
    const key = createHash('sha1').update(cand.buffer).digest('hex');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cand);
  }
  return result;
}

async function expandExifCandidates(candidates: ExifCandidate[]): Promise<ExifCandidate[]> {
  const unique = dedupeCandidates(candidates);
  const expanded: ExifCandidate[] = [...unique];
  for (const cand of unique) {
    if (!isLikelyHeic(cand)) continue;
    try {
      const converted = await convertHeicLikeToJpeg(cand.buffer);
      if (converted?.buffer?.length) {
        expanded.push(converted);
      }
    } catch (err) {
      try { console.warn('[NOREREF] HEIC conversion for EXIF failed', err); } catch {}
    }
  }
  return dedupeCandidates(expanded);
}

function extensionForMime(mime?: string): string {
  const lower = (mime || '').toLowerCase();
  if (lower.includes('heic')) return 'heic';
  if (lower.includes('heif')) return 'heif';
  if (lower.includes('png')) return 'png';
  if (lower.includes('gif')) return 'gif';
  if (lower.includes('bmp')) return 'bmp';
  if (lower.includes('tif')) return 'tiff';
  if (lower.includes('webp')) return 'webp';
  return 'jpg';
}

async function ensureTempFile(buffer: Buffer, mime?: string): Promise<string> {
  const hash = createHash('sha1').update(buffer).digest('hex');
  const ext = extensionForMime(mime);
  const filePath = join(EXIF_TMP_DIR, `${hash}.${ext}`);
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(EXIF_TMP_DIR, { recursive: true });
    await fs.writeFile(filePath, buffer);
  }
  return filePath;
}

async function getExiftoolInstance() {
  if (!exiftoolInstance) {
    const mod = await import('exiftool-vendored');
    exiftoolInstance = mod.exiftool;
    process.once('exit', () => {
      exiftoolInstance?.end()?.catch(() => {});
    });
    process.once('SIGINT', () => {
      exiftoolInstance?.end()?.catch(() => {});
    });
  }
  return exiftoolInstance;
}

function computeFocalPx(meta: any, imageWidth: number): number | null {
  if (!meta) return null;
  const focalLengthMm = toNumber(meta?.FocalLength) ?? toNumber(meta?.LensFocalLength);
  const focal35 =
    toNumber(meta?.FocalLengthIn35mmFilm) ??
    toNumber(meta?.FocalLengthIn35mmFormat) ??
    toNumber(meta?.FocalLength35mm) ??
    toNumber(meta?.FocalLength35mmFilm);
  const scaleFactor = toNumber((meta as any)?.ScaleFactor35efl);

  let sensorWidthMm: number | null = null;
  if (focalLengthMm && focal35) {
    const derived = (36 * focalLengthMm) / focal35;
    if (Number.isFinite(derived) && derived > 0) sensorWidthMm = derived;
  }

  if ((!sensorWidthMm || sensorWidthMm <= 0) && focalLengthMm && scaleFactor) {
    const derived = 36 / scaleFactor;
    if (Number.isFinite(derived) && derived > 0) sensorWidthMm = derived;
  }

  if (sensorWidthMm && focalLengthMm) {
    const focalPx = (imageWidth * focalLengthMm) / sensorWidthMm;
    if (Number.isFinite(focalPx) && focalPx > 0) {
      return focalPx;
    }
  }

  const fovDeg =
    toNumber((meta as any)?.HFOV) ??
    toNumber((meta as any)?.FOV) ??
    toNumber((meta as any)?.VFOV);
  if (fovDeg && Number.isFinite(fovDeg) && fovDeg > 0 && fovDeg < 180) {
    const focalPx = (0.5 * imageWidth) / Math.tan((fovDeg * Math.PI) / 360);
    if (Number.isFinite(focalPx) && focalPx > 0) {
      return focalPx;
    }
  }

  return null;
}

async function parseWithExiftool(candidate: ExifCandidate, imageWidth: number, timeoutMs: number = EXIF_TIMEOUT_MS): Promise<number | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const exiftool = await getExiftoolInstance();
      const filePath = await ensureTempFile(candidate.buffer, candidate.mime);
      const tags = await withTimeout(exiftool.read(filePath), timeoutMs, 'exiftool.read');
      const focalPx = computeFocalPx(tags, imageWidth);
      
      // CRITICAL FIX: Force cleanup after each parse to prevent subprocess bloat
      // Without this, exiftool-vendored keeps a Perl subprocess alive that accumulates
      // state and blocks on the NEXT file after the last EXIF file
      try {
        await exiftoolInstance?.end();
      } catch (err) {
        try { console.warn('[NOREREF] exiftool cleanup warning', err); } catch {}
      }
      exiftoolInstance = null;
      
      return focalPx;
    } catch (err) {
      const message = (err as Error)?.message || String(err);
      const timedOut = message.toLowerCase().includes('timed out');
      const stale = isStaleExiftoolError(err);
      if (timedOut || stale) {
        try { console.warn('[NOREREF] exiftool instance reset', message); } catch {}
        try { await exiftoolInstance?.end(); } catch {}
        exiftoolInstance = null;
        continue;
      }
      try { console.warn('[NOREREF] exiftool fallback failed', err); } catch {}
      // Also cleanup on error
      try { await exiftoolInstance?.end(); } catch {}
      exiftoolInstance = null;
      return null;
    }
  }
  return null;
}

async function resolveFocalLength(candidates: ExifCandidate[], imageWidth: number, env: ReturnType<typeof loadEnv>): Promise<ExifResult> {
  const deduplicated = dedupeCandidates(candidates);
  const heicCandidates = deduplicated.filter((cand) => isLikelyHeic(cand));
  const nonHeicCandidates = deduplicated.filter((cand) => !isLikelyHeic(cand));

  // HEIC: prioritize exiftool directly (exifr cannot parse HEIC EXIF buffers, exiftool reads HEIC natively)
  for (const cand of heicCandidates) {
    const focalPx = await parseWithExiftool(cand, imageWidth, EXIF_HEIC_TIMEOUT_MS);
    if (focalPx) {
      return { focalPx, source: 'exif' };
    }
  }

  // Non-HEIC: expand candidates (may attempt HEIC->JPEG conversions for mixed batches)
  const expanded = await expandExifCandidates(nonHeicCandidates);

  // Non-HEIC: try exifr first (fast path)
  for (const cand of expanded) {
    try {
      const metadata = await withTimeout(exifr.parse(cand.buffer, {
        pick: ['FocalLength', 'FocalLengthIn35mmFilm', 'FocalLengthIn35mmFormat', 'ScaleFactor35efl', 'FOV', 'HFOV', 'VFOV'],
        translateValues: false,
      }), EXIF_TIMEOUT_MS, 'exifr.parse');
      const focalPx = computeFocalPx(metadata, imageWidth);
      if (focalPx) {
        return { focalPx, source: 'exif' };
      }
    } catch (err) {
      try { console.warn('[NOREREF] EXIF parse failed', err); } catch {}
    }
  }

  // Fallback: try exiftool for non-HEIC candidates
  for (const cand of expanded) {
    const focalPx = await parseWithExiftool(cand, imageWidth, EXIF_TIMEOUT_MS);
    if (focalPx) {
      return { focalPx, source: 'exif' };
    }
  }

  // Default to 74° HORIZONTAL FOV for width measurements (smartphone average)
  // Note: 74° horizontal ≈ 85° diagonal ≈ 53° vertical
  // Modern smartphones: iPhone ~70-74° horizontal, Android ~68-76° horizontal
  const defaultFovDeg = clamp(Number(env.MEASURE_DEFAULT_FOV_DEG || 74), 30, 110);
  const fPx = (0.5 * imageWidth) / Math.tan((defaultFovDeg * Math.PI) / 360);
  return { focalPx: fPx, source: 'fallback' };
}

interface WallQualityMetrics {
  sizePct: number;          // % of image covered by wall mask
  aspectRatio: number;      // width:height ratio
  edgeTouching: boolean;    // touches left/right edges
}

function assessWallQuality(
  wallBounds: { left: number; right: number; width: number; height: number; pixels: number } | null,
  imageWidth: number,
  imageHeight: number
): WallQualityMetrics {
  if (!wallBounds) {
    return { sizePct: 100, aspectRatio: imageWidth / imageHeight, edgeTouching: true };
  }
  
  const totalPixels = imageWidth * imageHeight;
  const sizePct = (wallBounds.pixels / totalPixels) * 100;
  const aspectRatio = wallBounds.width / Math.max(1, wallBounds.height);
  const edgeTouching = wallBounds.left <= 5 || wallBounds.right >= imageWidth - 5;
  
  return { sizePct, aspectRatio, edgeTouching };
}

function buildConfidence(
  hasFloor: boolean,
  hasCeiling: boolean,
  hasExif: boolean,
  fallbackSeg: boolean,
  distanceFallback: boolean,
  wallQuality: WallQualityMetrics,
  measurementSane: boolean,
  multiPeakConfidence?: number
): ConfidenceBreakdown {
  let base = 1;
  let penalties = 0;
  
  // Segmentation quality - most critical
  if (fallbackSeg) {
    penalties += 0.45; // Increased from 0.1 - full-frame mask is unreliable
  }
  
  // Floor/ceiling detection
  if (!hasFloor) penalties += 0.25; // Reduced from 0.35
  if (!hasCeiling) penalties += 0.15; // Reduced from 0.2
  
  // EXIF
  if (!hasExif) penalties += 0.15; // Reduced from 0.2
  
  // Wall mask quality (NEW) - critical for accuracy
  if (wallQuality.sizePct > 70) {
    penalties += 0.4; // Wall mask too large - likely includes entire room
  } else if (wallQuality.sizePct > 60) {
    penalties += 0.25;
  } else if (wallQuality.sizePct > 50) {
    penalties += 0.15;
  }
  
  if (wallQuality.edgeTouching) {
    penalties += 0.3; // Increased from 0.15 - likely includes side walls
  }
  
  // Aspect ratio check (NEW)
  if (wallQuality.aspectRatio > 6.0) {
    penalties += 0.35; // Too wide - measuring panoramic view
  } else if (wallQuality.aspectRatio > 4.5) {
    penalties += 0.2;
  } else if (wallQuality.aspectRatio < 1.2) {
    penalties += 0.2; // Too narrow - unusual for walls
  }
  
  // Distance estimation
  if (distanceFallback) penalties += 0.15;
  
  // Measurement sanity (NEW)
  if (!measurementSane) {
    penalties += 0.4; // Measurements outside realistic bounds
  }
  
  // Multi-peak confidence adjustment (Priority 1)
  // If multi-peak detection was used, apply its confidence factor
  // This reduces confidence for fragmented scenes (more assumptions)
  let finalBase = base;
  if (multiPeakConfidence !== undefined && multiPeakConfidence < 1.0) {
    finalBase *= multiPeakConfidence;
  }
  
  penalties = Math.min(finalBase, penalties);
  const confidence = Math.max(0, finalBase - penalties);
  
  return { base: finalBase, penalties, confidence };
}

export async function measureNoReference(image: Buffer, options?: NoReferenceOptions): Promise<MeasureOutput> {
  const env = loadEnv();
  const debug = options?.debug ?? false;
  let converted: ExifCandidate | null = null;
  async function getInitialGray(): Promise<{ data: Uint8Array; width: number; height: number; bufferForSeg: Buffer }> {
    try {
      const gray = await decodeGray(image);
      return { ...gray, bufferForSeg: image };
    } catch (err) {
      try { console.warn('[NOREREF] primary decode failed, attempting normalized JPEG', err); } catch {}
      converted = await convertHeicLikeToJpeg(image);
      if (!converted) throw err;
      const gray = await decodeGray(converted.buffer);
      return { ...gray, bufferForSeg: converted.buffer };
    }
  }

  const initial = await getInitialGray();
  let gray = initial.data;
  let width = initial.width;
  let height = initial.height;
  let imageForSegmentation = initial.bufferForSeg;

  let masks: SceneMaskResult;
  let segmentationWarning: string | null = null;
  try {
    const seg = await segmentScene(imageForSegmentation, debug, env);
    masks = seg.result;
    segmentationWarning = seg.warning;
  } catch (err) {
    masks = buildFallbackScene(initial.width, initial.height);
    segmentationWarning = `Segmentation fallback applied: ${(err as Error)?.message || 'unknown error'}`;
  }

  if (width !== masks.width || height !== masks.height) {
    const sharp = (await import('sharp')).default;
    const resized = await sharp(imageForSegmentation)
      .resize({ width: masks.width, height: masks.height, fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    gray = new Uint8Array(resized.data.buffer, resized.data.byteOffset, resized.data.byteLength);
    width = masks.width;
    height = masks.height;
  }

  const rowDiffs = computeRowDiffs(gray, width, height);
  const floorBand = inferBandFromMask(masks.floor, width, height, 5, 'floor');
  let floorY = floorBand.value;
  const ceilingBand = inferBandFromMask(masks.ceiling, width, height, 95, 'ceiling');
  let ceilingY = ceilingBand.value;
  const warnings: string[] = [];
  if (floorY == null || Number.isNaN(floorY)) {
    const fallback = inferBandFromGradients(rowDiffs, height, 'floor');
    floorY = fallback.value;
    if (floorY == null) {
      floorY = height - 1;
      warnings.push('Unable to locate floor – defaulting to image bottom.');
    } else if (floorBand.strategy !== 'mask') {
      warnings.push('Floor mask missing; using gradient fallback.');
    }
  }
  if (ceilingY == null || Number.isNaN(ceilingY)) {
    const fallback = inferBandFromGradients(rowDiffs, height, 'ceiling');
    ceilingY = fallback.value ?? 0;
    if (ceilingBand.strategy !== 'mask') {
      warnings.push('Ceiling mask missing; using gradient fallback.');
    }
  }

  if (ceilingY != null) ceilingY = clamp(ceilingY, 0, height - 1);
  if (floorY != null) floorY = clamp(floorY, 0, height - 1);

  if (floorY != null && ceilingY != null && floorY <= ceilingY) {
    const gradFloor = inferBandFromGradients(rowDiffs, height, 'floor').value;
    const gradCeiling = inferBandFromGradients(rowDiffs, height, 'ceiling').value;
    if (gradFloor != null && gradCeiling != null && gradFloor > gradCeiling) {
      floorY = clamp(gradFloor, 0, height - 1);
      ceilingY = clamp(gradCeiling, 0, height - 1);
    } else {
      ceilingY = 0;
      floorY = height - 1;
    }
    warnings.push('Floor and ceiling bands overlapped; using gradient fallback.');
  }

  const wallBounds = computeWallBounds(
    masks.wall,
    masks.width,
    masks.height,
    ceilingY ?? 0,
    floorY ?? height - 1,
    masks.window // Pass window mask for refinement
  );
  if (!wallBounds) {
    warnings.push('Could not isolate wall region; using full frame.');
  }
  const fullWidth = masks.width;
  const fullHeight = masks.height;
  const effectiveBounds = wallBounds ?? {
    left: 0,
    right: fullWidth - 1,
    top: ceilingY ?? 0,
    bottom: floorY ?? fullHeight - 1,
    width: Math.max(1, fullWidth - 1),
    height: Math.max(1, (floorY ?? fullHeight - 1) - (ceilingY ?? 0)),
    pixels: fullWidth * fullHeight,
  };

  // Assess wall mask quality
  const wallQuality = assessWallQuality(wallBounds, width, height);

  const exifCandidates: ExifCandidate[] = options?.exifCandidates && options.exifCandidates.length
    ? [...options.exifCandidates]
    : [{ buffer: image }];
  if (converted) {
    exifCandidates.push(converted);
  }
  const { focalPx, source: focalSource } = await resolveFocalLength(exifCandidates, width, env);
  if (!focalPx || !Number.isFinite(focalPx)) {
    throw new Error('Unable to determine focal length');
  }

  const cy = height / 2;
  const cameraHeightCm = Number.isFinite(env.MEASURE_CAMERA_HEIGHT_CM) ? env.MEASURE_CAMERA_HEIGHT_CM : 150;
  let distanceCm = cameraHeightCm * focalPx / Math.max(1, (floorY ?? height - 1) - cy);
  let distanceFallback = false;
  if (!Number.isFinite(distanceCm) || distanceCm <= 0 || (floorY ?? height - 1) <= cy + 5) {
    distanceCm = 300;
    distanceFallback = true;
    warnings.push('Floor sits near horizon; using fallback distance.');
  }
  distanceCm = clamp(distanceCm, 120, 800);

  const scale = distanceCm / focalPx;
  let wallHeightCm = effectiveBounds.height * scale;
  let wallWidthCm = Math.max(1, effectiveBounds.width) * scale;

  if (!Number.isFinite(wallHeightCm) || wallHeightCm <= 0) {
    wallHeightCm = Math.max(150, height * scale);
    warnings.push('Invalid wall height computation; using fallback height.');
  }
  if (!Number.isFinite(wallWidthCm) || wallWidthCm <= 0) {
    wallWidthCm = Math.max(150, width * scale);
    warnings.push('Invalid wall width computation; using fallback width.');
  }
  
  // Sanity checks for measurements (NEW)
  let measurementSane = true;
  const TYPICAL_WALL = {
    widthMin: 150,
    widthMax: 900,
    heightMin: 200,
    heightMax: 400,
    aspectMin: 1.0,
    aspectMax: 6.0
  };
  
  if (wallWidthCm < TYPICAL_WALL.widthMin || wallWidthCm > TYPICAL_WALL.widthMax) {
    measurementSane = false;
    warnings.push(`Wall width ${wallWidthCm.toFixed(0)}cm outside typical range (${TYPICAL_WALL.widthMin}-${TYPICAL_WALL.widthMax}cm)`);
  }
  
  if (wallHeightCm < TYPICAL_WALL.heightMin || wallHeightCm > TYPICAL_WALL.heightMax) {
    measurementSane = false;
    warnings.push(`Wall height ${wallHeightCm.toFixed(0)}cm outside typical range (${TYPICAL_WALL.heightMin}-${TYPICAL_WALL.heightMax}cm)`);
  }
  
  const measuredAspect = wallWidthCm / wallHeightCm;
  if (measuredAspect < TYPICAL_WALL.aspectMin || measuredAspect > TYPICAL_WALL.aspectMax) {
    measurementSane = false;
    warnings.push(`Wall aspect ratio ${measuredAspect.toFixed(1)}:1 unusual (typical ${TYPICAL_WALL.aspectMin}-${TYPICAL_WALL.aspectMax}:1)`);
  }
  
  // Check if measured width exceeds image width (physically impossible)
  const imageWidthCm = width * scale;
  if (wallWidthCm > imageWidthCm * 1.3) {
    measurementSane = false;
    warnings.push('Measured wall width exceeds image width by >30% - likely measuring side walls');
  }
  
  // Wall mask quality warnings
  if (wallQuality.sizePct > 70) {
    warnings.push(`Wall mask covers ${wallQuality.sizePct.toFixed(0)}% of image - likely includes side walls/entire room`);
  }
  
  if (wallQuality.edgeTouching) {
    warnings.push('Wall mask touches image edges - measurement may include side walls');
  }
  
  if (wallQuality.aspectRatio > 6.0) {
    warnings.push(`Wall aspect ratio ${wallQuality.aspectRatio.toFixed(1)}:1 too wide - likely measuring panoramic view`);
  }

  const confidence = buildConfidence(
    floorBand.strategy === 'mask',
    ceilingBand.strategy === 'mask',
    focalSource === 'exif',
    masks.source !== 'local',
    distanceFallback,
    wallQuality,
    measurementSane,
    wallBounds?.multiPeakConfidence
  );

  if (segmentationWarning) warnings.push(segmentationWarning);
  if (focalSource === 'fallback') {
    const fovDeg = env.MEASURE_DEFAULT_FOV_DEG || 74;
    warnings.push(`No EXIF focal length – assuming ${fovDeg}° horizontal FOV (smartphone average).`);
  }
  
  // Add scene type info to warnings for transparency
  if (wallBounds?.sceneType === 'fragmented' && wallBounds.sections && wallBounds.sections.length > 1) {
    warnings.push(`Multi-peak detection: measured ${wallBounds.sections.length} wall sections (total width includes all sections for curtain coverage).`);
  }
  
  const roundedWidth = Math.max(1, Math.round(wallWidthCm * 10) / 10);
  const roundedHeight = Math.max(1, Math.round(wallHeightCm * 10) / 10);
  const confidencePct = Math.round(confidence.confidence * 100);

  const debugPayload: DebugPayload = {
    provider: 'noreref',
    segmentationSource: masks.source,
    focalPx,
    distanceCm,
    cameraHeightCm,
    scaleCmPerPixel: scale,
    ceilingY: ceilingY ?? null,
    floorY: floorY ?? null,
    wallBoundsPx: effectiveBounds,
    bandStrategies: {
      ceiling: ceilingBand.strategy,
      floor: floorBand.strategy,
    },
    confidence,
    sceneType: wallBounds?.sceneType,
    peakCount: wallBounds?.peakCount,
    sharpness: wallBounds?.sharpness,
    sections: wallBounds?.sections,
  };
  
  // Add detailed histogram info when multi-peak is used
  if (wallBounds?.sceneType === 'fragmented' && wallBounds.sections && wallBounds.sections.length > 1) {
    try {
      console.log(`[NOREREF] Fragmented scene: ${wallBounds.sections.length} sections, sharpness ${wallBounds.sharpness?.toFixed(2)}, total width ${wallWidthCm.toFixed(0)}cm`);
      wallBounds.sections.forEach((sec, i) => {
        console.log(`[NOREREF]   Section ${i + 1}: ${sec.left}-${sec.right} (${sec.width}px, ${(sec.width * scale).toFixed(0)}cm)`);
      });
    } catch {}
  }

  return {
    wallWidthCm: roundedWidth,
    wallHeightCm: roundedHeight,
    confidencePct,
    warnings: warnings.length ? warnings : undefined,
    debug: debugPayload,
  };
}
