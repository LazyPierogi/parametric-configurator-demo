#!/usr/bin/env node

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { basename, resolve, join, extname, dirname } from 'node:path';

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.jpe', '.png', '.webp', '.heic', '.heif', '.gif', '.bmp', '.tif', '.tiff', '.avif', '.jfif'
]);

function isSupportedImage(filename) {
  return IMAGE_EXTENSIONS.has(extname(filename).toLowerCase());
}

const usage = `Usage: node scripts/measure-benchmark.mjs --files path1.jpg path2.png [--endpoint URL] [--provider localcv|googleai|openai|noreref]

Options:
  --files <paths...>           List of image files to benchmark (required)
  --dir <folder>               Include every *.jpg|*.jpeg|*.png inside folder
  --endpoint <url>             Measurement endpoint (default http://localhost:3010/api/measure)
  --provider <id>              Provider to pass through (default localcv)
  --repeat <n>                 Repeat each file N times (default 1)
  --no-cache                   Include { bypassCache: true } flag for the BFF (matches debug UI toggle)
  --scale <pixels>             Send localScaleLongSide value (local CV only)
  --ground-truth <file>        Optional JSON/CSV with expected widths/heights for error stats
  --rectify <auto|on|off>      Force Local CV rectification on/off (default auto)
  --debug-dir <folder>         Save debug PNGs/JSON per image (implies Local CV debug mode)
  --summary <json|table>       Output format (default table)
  --save <path>                Optional path to write JSON summary
  --poly100                    Use a synthetic center 100px square curtainPolygon for all images (normalized)
  --poly-box <x1,x2,y1,y2>     Use a normalized axis-aligned box polygon (e.g. 0.25,0.75,0.25,0.75 for center 50% box)

Examples:
  node scripts/measure-benchmark.mjs --files samples/room1.jpg
  node scripts/measure-benchmark.mjs --dir ./fixtures --provider googleai --repeat 3 --save results.json
  node scripts/measure-benchmark.mjs --files test.jpg --scale 896 --no-cache
`;

function parseArgs(argv) {
  const args = {
    files: [],
    dirs: [],
    endpoint: 'http://localhost:3010/api/measure',
    provider: 'localcv',
    repeat: 1,
    summary: 'table',
    bypassCache: false,
    scale: null,
    groundTruth: null,
    rectify: 'auto',
    debugDir: null,
    mockPolygon: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--files') {
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        args.files.push(resolve(argv[++i]));
      }
    } else if (arg === '--dir') {
      const dir = argv[++i];
      if (dir) args.dirs.push(resolve(dir));
    } else if (arg === '--endpoint') {
      args.endpoint = argv[++i] ?? args.endpoint;
    } else if (arg === '--provider') {
      args.provider = argv[++i] ?? args.provider;
    } else if (arg === '--repeat') {
      const n = Number(argv[++i]);
      if (Number.isFinite(n) && n > 0) args.repeat = Math.floor(n);
    } else if (arg === '--summary') {
      args.summary = (argv[++i] ?? args.summary).toLowerCase();
    } else if (arg === '--save') {
      args.save = resolve(argv[++i]);
    } else if (arg === '--ground-truth') {
      args.groundTruth = resolve(argv[++i]);
    } else if (arg === '--rectify') {
      const mode = (argv[++i] ?? '').toLowerCase();
      if (['auto', 'on', 'off'].includes(mode)) args.rectify = mode;
      else console.warn(`Unknown rectify mode: ${mode} (expected auto|on|off)`);
    } else if (arg === '--debug-dir') {
      args.debugDir = resolve(argv[++i]);
    } else if (arg === '--no-cache') {
      args.bypassCache = true;
    } else if (arg === '--scale') {
      const val = Number(argv[++i]);
      if (Number.isFinite(val) && val > 0) args.scale = Math.round(val);
    } else if (arg === '--poly100') {
      args.mockPolygon = { kind: 'centerRectPx', sizePx: 100 };
    } else if (arg === '--poly-box') {
      const spec = argv[++i];
      if (!spec) {
        console.warn('--poly-box expects a value like x1,x2,y1,y2 (all between 0 and 1).');
      } else {
        const parts = spec.split(',').map((v) => Number(v.trim()));
        if (parts.length === 4 && parts.every((v) => Number.isFinite(v))) {
          const [x1, x2, y1, y2] = parts;
          args.mockPolygon = { kind: 'normalizedBox', x1, x2, y1, y2 };
        } else {
          console.warn(`Invalid --poly-box value: ${spec}. Expected four comma-separated numbers.`);
        }
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log(usage);
      process.exit(0);
    } else {
      console.warn(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function normaliseKey(name) {
  return basename(String(name).trim()).toLowerCase();
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toFixedNumber(value, digits = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function slugify(value) {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || 'run';
}

function percentile(values, pct) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (pct / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  const weight = rank - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function computeErrorStats(items, actualKey, expectedKey) {
  const subset = items.filter((item) => typeof item[actualKey] === 'number' && typeof item[expectedKey] === 'number');
  if (!subset.length) return null;
  const diffs = subset.map((item) => item[actualKey] - item[expectedKey]);
  const absDiffs = diffs.map((value) => Math.abs(value));
  const count = subset.length;
  const meanDiff = diffs.reduce((sum, value) => sum + value, 0) / count;
  const mae = absDiffs.reduce((sum, value) => sum + value, 0) / count;
  const rmse = Math.sqrt(absDiffs.reduce((sum, value) => sum + value * value, 0) / count);
  const maxAbs = Math.max(...absDiffs);
  const p95 = percentile(absDiffs, 95);
  const pctErrors = subset
    .map((item) => {
      const expected = item[expectedKey];
      if (typeof expected !== 'number' || expected === 0) return null;
      return Math.abs((item[actualKey] - expected) / expected) * 100;
    })
    .filter((value) => value != null);
  const mape = pctErrors.length ? pctErrors.reduce((sum, value) => sum + value, 0) / pctErrors.length : null;
  return { count, meanDiff, mae, rmse, maxAbs, p95, mape };
}

function decodeDataUri(uri) {
  if (typeof uri !== 'string') return null;
  const match = uri.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[1], 'base64');
}

async function saveDebugArtifacts(options, label, responseJson, filePath) {
  if (!options.debugDir) return null;
  const debug = responseJson?.debug;
  if (!debug || typeof debug !== 'object') return null;

  const dir = join(options.debugDir, slugify(label));
  await mkdir(dir, { recursive: true });

  const meta = {
    file: label,
    source: filePath,
    provider: options.provider,
    mode: debug.mode ?? null,
    wallWidthCm: responseJson?.wallWidthCm ?? null,
    wallHeightCm: responseJson?.wallHeightCm ?? null,
    pxPerCm: debug.pxPerCm ?? null,
    axisEstimate: debug.axisEstimate ?? null,
    rectifiedBoundsCm: debug.rectifiedBoundsCm ?? null,
    trimPercentile: debug.trimPercentile ?? null,
    sheet: debug.sheet ?? null,
    a4Mask: debug.a4Mask ?? null,
    clamp: debug.clamp ?? null,
    a4Candidates: Array.isArray(debug.a4Candidates) ? debug.a4Candidates : null,
    confidencePct: responseJson?.confidencePct ?? null,
    warnings: Array.isArray(responseJson?.warnings) ? responseJson.warnings : null,
  };
  await writeFile(join(dir, 'measurement.json'), JSON.stringify(meta, null, 2));

  const thumbs = debug.thumbs && typeof debug.thumbs === 'object' ? debug.thumbs : {};
  for (const [key, value] of Object.entries(thumbs)) {
    const buffer = decodeDataUri(value);
    if (!buffer || !buffer.length) continue;
    const safeKey = key.replace(/[^a-z0-9_-]+/gi, '-');
    await writeFile(join(dir, `${safeKey || 'thumb'}.png`), buffer);
  }

  return dir;
}

function summariseMetrics(results) {
  const successful = results.filter((item) => typeof item.wallWidthCm === 'number' && typeof item.wallHeightCm === 'number');
  return {
    total: results.length,
    successful: successful.length,
    withTruth: successful.filter((item) => typeof item.expectedWidthCm === 'number' && typeof item.expectedHeightCm === 'number').length,
    width: computeErrorStats(successful, 'wallWidthCm', 'expectedWidthCm'),
    height: computeErrorStats(successful, 'wallHeightCm', 'expectedHeightCm'),
  };
}

function parseGroundTruthJson(raw) {
  const data = JSON.parse(raw);
  const map = new Map();
  const ingest = (entry, key) => {
    if (!entry) return;
    const file = normaliseKey(key ?? entry.file ?? entry.filename ?? entry.name);
    if (!file) return;
    const width = toNumber(entry.width ?? entry.widthCm ?? entry.wallWidthCm ?? entry.w);
    const height = toNumber(entry.height ?? entry.heightCm ?? entry.wallHeightCm ?? entry.h);
    if (width == null || height == null) return;
    map.set(file, { widthCm: width, heightCm: height });
  };
  if (Array.isArray(data)) {
    for (const item of data) ingest(item);
  } else if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) ingest(value, key);
  }
  return map;
}

function parseGroundTruthCsv(raw) {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const map = new Map();
  if (!lines.length) return map;
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idxFile = headers.findIndex((h) => ['file', 'filename', 'image'].includes(h));
  const idxWidth = headers.findIndex((h) => ['width', 'widthcm', 'wallwidthcm'].includes(h));
  const idxHeight = headers.findIndex((h) => ['height', 'heightcm', 'wallheightcm'].includes(h));
  if (idxFile === -1 || idxWidth === -1 || idxHeight === -1) return map;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
    const file = normaliseKey(cols[idxFile] ?? '');
    if (!file) continue;
    const width = toNumber(cols[idxWidth]);
    const height = toNumber(cols[idxHeight]);
    if (width == null || height == null) continue;
    map.set(file, { widthCm: width, heightCm: height });
  }
  return map;
}

async function loadGroundTruth(filePath) {
  if (!filePath) return new Map();
  const raw = await readFile(filePath, 'utf8');
  const ext = filePath.toLowerCase();
  try {
    if (ext.endsWith('.csv')) return parseGroundTruthCsv(raw);
    return parseGroundTruthJson(raw);
  } catch (err) {
    console.warn(`Failed to parse ground truth file ${filePath}: ${err?.message ?? err}`);
    return new Map();
  }
}

async function getImageSize(filePath) {
  try {
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(filePath, { failOn: 'none' }).metadata();
    const width = metadata?.width || 0;
    const height = metadata?.height || 0;
    if (width > 0 && height > 0) {
      return { width, height };
    }
    try {
      console.warn(`[polygon] Could not determine dimensions for ${filePath}`);
    } catch {}
  } catch (err) {
    try {
      console.warn(
        `[polygon] Failed to read image size for ${filePath}: ${err?.message ?? err}`
      );
    } catch {}
  }
  return null;
}

function buildCenterRectPolygon(width, height, sizePx) {
  const half = sizePx / 2;
  const cx = width / 2;
  const cy = height / 2;

  const leftPx = Math.max(0, cx - half);
  const rightPx = Math.min(width, cx + half);
  const topPx = Math.max(0, cy - half);
  const bottomPx = Math.min(height, cy + half);

  const safeWidth = width || 1;
  const safeHeight = height || 1;

  const left = leftPx / safeWidth;
  const right = rightPx / safeWidth;
  const top = topPx / safeHeight;
  const bottom = bottomPx / safeHeight;

  return [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
}

function mimeForPath(filePath) {
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.jpg':
    case '.jpeg':
    case '.jpe':
    case '.jfif':
      return 'image/jpeg';
    case '.heic':
    case '.heif':
      return 'image/heic';
    case '.gif':
      return 'image/gif';
    case '.bmp':
      return 'image/bmp';
    case '.tif':
    case '.tiff':
      return 'image/tiff';
    case '.avif':
      return 'image/avif';
    default:
      return 'application/octet-stream';
  }
}

async function convertHeicBuffer(buffer) {
  try {
    const sharp = (await import('sharp')).default;
    const converted = await sharp(buffer, { failOn: 'none' }).jpeg({ quality: 95 }).toBuffer();
    if (converted?.length) return converted;
  } catch (err) {
    try { console.debug?.('[benchmark] sharp HEIC convert failed', err?.message ?? err); } catch {}
  }
  try {
    const heicConvert = (await import('heic-convert')).default;
    const converted = await heicConvert({ buffer, format: 'JPEG', quality: 0.85 });
    if (converted?.length) return converted;
  } catch (err) {
    try { console.debug?.('[benchmark] heic-convert fallback failed', err?.message ?? err); } catch {}
  }
  return null;
}

async function normaliseFileBuffer(filePath) {
  const data = await readFile(filePath);
  const mime = mimeForPath(filePath);
  if (mime === 'image/heic' || mime === 'image/heif') {
    try {
      const sharp = (await import('sharp')).default;
      const metadata = await sharp(data, { failOn: 'none' }).metadata();
      const format = metadata?.format?.toLowerCase();
      if (format === 'heic' || format === 'heif') {
        return { buffer: data, mime, originalMime: mime };
      }
    } catch {
      // If sharp is unavailable or metadata lookup fails, fall back to conversion attempts below.
    }
    const converted = await convertHeicBuffer(data);
    if (converted) {
      return { buffer: converted, mime: 'image/jpeg', originalMime: mime };
    }
    return { buffer: data, mime, originalMime: mime };
  }
  return { buffer: data, mime, originalMime: mime };
}

async function toDataUri(filePath) {
  const { buffer, mime } = await normaliseFileBuffer(filePath);
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function deriveSegmentEndpoint(measureEndpoint) {
  if (typeof measureEndpoint !== 'string' || !measureEndpoint.length) {
    return 'http://localhost:3010/api/segment';
  }
  try {
    const url = new URL(measureEndpoint);
    if (url.pathname.includes('/measure')) {
      url.pathname = url.pathname.replace('/measure', '/segment');
      return url.toString();
    }
    url.pathname = '/api/segment';
    return url.toString();
  } catch {
    if (measureEndpoint.includes('/measure')) return measureEndpoint.replace('/measure', '/segment');
    return 'http://localhost:3010/api/segment';
  }
}

async function loadSegmentationMaskBuffer(filePath, endpoint) {
  try {
    const { buffer, mime } = await normaliseFileBuffer(filePath);
    const form = new FormData();
    const blob = new Blob([buffer], { type: mime });
    form.append('image', blob, basename(filePath));
    const res = await fetch(endpoint, { method: 'POST', body: form });
    if (!res.ok) {
      try {
        console.warn(`[segment] ${res.status} for ${filePath} at ${endpoint}`);
      } catch {}
      return null;
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch (err) {
    try {
      console.warn(`[segment] Failed to load mask for ${filePath}: ${err?.message ?? err}`);
    } catch {}
    return null;
  }
}

async function computeWallBoundsFromMask(maskBuffer) {
  try {
    const sharp = (await import('sharp')).default;
    const { data, info } = await sharp(maskBuffer, { failOn: 'none' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    if (!width || !height || !channels) {
      return { top: null, bottom: null, span: null, status: 'invalid_dimensions', warnings: ['mask:invalid_dimensions'] };
    }

    const alphaIndex = channels - 1;
    const sampleXs = [0.35, 0.45, 0.5, 0.55, 0.65];
    const tops = [];
    const bottoms = [];
    const MIN_SEG_FRAC = 0.2;
    const MAX_SEG_FRAC = 0.95;

    // Masks coming from /api/segment encode wall+window+attached as alpha=0 (transparent),
    // background as alpha=255 (opaque). On the client we call invertMaskAlpha() and then
    // treat alpha>=128 as "inside wall". Here we mirror that semantics without a canvas
    // roundtrip by interpreting low-alpha pixels as wall directly.
    const isWallAlpha = (alpha) => alpha <= 127; // equivalent to inverted alpha>=128

    for (const sx of sampleXs) {
      const x = Math.min(width - 1, Math.max(0, Math.round(width * sx)));
      let bestStart = -1;
      let bestEnd = -1;
      let bestLen = 0;
      let runStart = -1;

      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * channels;
        const alpha = data[idx + alphaIndex];
        if (isWallAlpha(alpha)) {
          if (runStart === -1) runStart = y;
        } else if (runStart !== -1) {
          const runEnd = y - 1;
          const len = runEnd - runStart + 1;
          if (len > bestLen) {
            bestLen = len;
            bestStart = runStart;
            bestEnd = runEnd;
          }
          runStart = -1;
        }
      }

      if (runStart !== -1) {
        const runEnd = height - 1;
        const len = runEnd - runStart + 1;
        if (len > bestLen) {
          bestLen = len;
          bestStart = runStart;
          bestEnd = runEnd;
        }
      }

      if (bestLen <= 0) continue;
      const frac = bestLen / height;
      if (frac < MIN_SEG_FRAC || frac > MAX_SEG_FRAC) continue;
      tops.push(bestStart / height);
      bottoms.push(bestEnd / height);
    }

    if (!tops.length || !bottoms.length) {
      return { top: null, bottom: null, span: null, status: 'no_wall_columns', warnings: ['mask:no_wall_column_hits'] };
    }

    const top = percentile(tops, 50);
    const bottom = percentile(bottoms, 50);
    const span = bottom - top;
    if (!(span > 0.2 && span < 0.95)) {
      return { top, bottom, span, status: 'span_out_of_range', warnings: [`mask:span_out_of_range(${span.toFixed(4)})`] };
    }
    return { top, bottom, span, status: 'ok', warnings: [] };
  } catch (err) {
    const msg = err?.message ?? String(err);
    try {
      console.warn(`[segment] Failed to analyse mask: ${msg}`);
    } catch {}
    return { top: null, bottom: null, span: null, status: 'exception', warnings: [`mask:exception(${msg})`] };
  }
}

async function computeMaskHeightFractionForPolygon(filePath, polygon, opts) {
  const base = { fraction: null, status: 'none', warnings: [] };
  if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
    return { ...base, status: 'no_polygon', warnings: ['mask:no_polygon'] };
  }
  const segEndpoint = deriveSegmentEndpoint(opts.endpoint);
  const maskBuffer = await loadSegmentationMaskBuffer(filePath, segEndpoint);
  if (!maskBuffer) {
    return { ...base, status: 'no_mask', warnings: ['segment:load_failed'] };
  }
  // Optional: save raw benchmark mask for visual inspection when --debug-dir is set.
  if (opts.debugDir) {
    try {
      const label = slugify(basename(filePath));
      const dir = join(opts.debugDir, label);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, 'mask_benchmark.png'), maskBuffer);
    } catch {}
  }
  const bounds = await computeWallBoundsFromMask(maskBuffer);
  if (!bounds || bounds.status !== 'ok') {
    return { ...base, status: bounds?.status ?? 'wall_bounds_invalid', warnings: bounds?.warnings ?? [] };
  }
  const { top, bottom, span } = bounds;
  const ys = polygon.map((pt) => pt.y);
  if (!ys.length) {
    return { ...base, status: 'no_polygon_y', warnings: ['mask:no_polygon_y'] };
  }
  const polyTop = Math.min(...ys);
  const polyBottom = Math.max(...ys);
  if (!(span > 0 && polyBottom > polyTop)) {
    return { ...base, status: 'poly_span_invalid', warnings: ['mask:poly_span_invalid'] };
  }
  const clampedTop = Math.max(top, Math.min(polyTop, bottom));
  const clampedBottom = Math.max(top, Math.min(polyBottom, bottom));
  const polySpanWithin = clampedBottom - clampedTop;
  if (!(polySpanWithin > 0)) {
    return { ...base, status: 'poly_span_outside_wall', warnings: ['mask:poly_span_outside_wall'] };
  }
  const frac = polySpanWithin / span;
  if (!(frac > 0 && frac <= 1.5)) {
    return { ...base, status: 'frac_out_of_range', warnings: [`mask:frac_out_of_range(${frac.toFixed(4)})`] };
  }
  return { fraction: frac, status: 'ok', warnings: [] };
}

function hasGlobPattern(value) {
  return /[*?[\]{}]/.test(value);
}

function globPatternToRegex(pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

async function expandFilePattern(pattern) {
  const folder = dirname(pattern);
  const base = basename(pattern);
  const dirPath = folder === '.' ? process.cwd() : resolve(folder);
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
  const matcher = globPatternToRegex(base);
  const results = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!matcher.test(entry.name)) continue;
    if (!isSupportedImage(entry.name)) continue;
    results.push(resolve(dirPath, entry.name));
  }
  return results;
}

async function run() {
  const opts = parseArgs(process.argv);

  const expandedFiles = [];
  for (const filePath of opts.files) {
    if (hasGlobPattern(filePath)) {
      const matches = await expandFilePattern(filePath);
      if (!matches.length) {
        console.warn(`[files] Pattern ${filePath} matched 0 files`);
      }
      expandedFiles.push(...matches);
    } else {
      expandedFiles.push(filePath);
    }
  }
  opts.files = expandedFiles;

  if (opts.dirs.length) {
    for (const dir of opts.dirs) {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          if (!isSupportedImage(entry.name)) continue;
          opts.files.push(resolve(dir, entry.name));
        }
      } catch (err) {
        console.warn(`Could not read directory ${dir}: ${err?.message ?? err}`);
      }
    }
  }

  if (!opts.files.length) {
    console.error('No files provided.');
    console.log(usage);
    process.exit(1);
  }

  if (opts.debugDir) {
    await mkdir(opts.debugDir, { recursive: true });
  }

  let groundTruth = new Map();
  if (opts.groundTruth) {
    try {
      groundTruth = await loadGroundTruth(opts.groundTruth);
      console.log(`[ground-truth] Loaded ${groundTruth.size} entries from ${opts.groundTruth}`);
    } catch (err) {
      console.warn(`[ground-truth] Unable to load ${opts.groundTruth}: ${err?.message ?? err}`);
    }
  }

  const missingTruth = new Set();
  const results = [];

  for (const filePath of opts.files) {
    const baseName = basename(filePath);
    const truthKey = normaliseKey(baseName);
    const truth = groundTruth.get(truthKey) ?? groundTruth.get(normaliseKey(filePath));
    if (!truth && opts.groundTruth) missingTruth.add(baseName);

    let mockPolygon = null;
    let rectWidthFraction = null;
    let rectHeightFraction = null;
    let rectHeightMaskFraction = null;
    let rectHeightMaskInfo = null;

    if (opts.mockPolygon?.kind === 'centerRectPx') {
      const dims = await getImageSize(filePath);
      if (dims) {
        mockPolygon = buildCenterRectPolygon(dims.width, dims.height, opts.mockPolygon.sizePx);
      }
    } else if (opts.mockPolygon?.kind === 'normalizedBox') {
      const { x1, x2, y1, y2 } = opts.mockPolygon;
      const left = Math.max(0, Math.min(x1, x2));
      const right = Math.min(1, Math.max(x1, x2));
      const top = Math.max(0, Math.min(y1, y2));
      const bottom = Math.min(1, Math.max(y1, y2));
      const w = Math.max(0, right - left);
      const h = Math.max(0, bottom - top);
      if (w > 0 && h > 0) {
        mockPolygon = [
          { x: left, y: top },
          { x: right, y: top },
          { x: right, y: bottom },
          { x: left, y: bottom },
        ];
        rectWidthFraction = w;
        rectHeightFraction = h;
      } else {
        try {
          console.warn(`[polygon] Ignoring degenerate normalized box for ${filePath}:`, { x1, x2, y1, y2 });
        } catch {}
      }
    }

    // Derive bounding-box fractions from the polygon if needed
    if (mockPolygon && (rectWidthFraction == null || rectHeightFraction == null)) {
      const xs = mockPolygon.map((pt) => pt.x);
      const ys = mockPolygon.map((pt) => pt.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const w = Math.max(0, maxX - minX);
      const h = Math.max(0, maxY - minY);
      if (w > 0 && h > 0) {
        rectWidthFraction = w;
        rectHeightFraction = h;
      }
    }

    // Optionally derive a wall-relative height fraction from the segmentation mask
    if (mockPolygon) {
      try {
        rectHeightMaskInfo = await computeMaskHeightFractionForPolygon(filePath, mockPolygon, opts);
        rectHeightMaskFraction = rectHeightMaskInfo?.fraction ?? null;
      } catch (err) {
        rectHeightMaskFraction = null;
        rectHeightMaskInfo = {
          fraction: null,
          status: 'exception',
          warnings: [`mask:exception(${err?.message ?? err})`],
        };
      }
    }

    for (let r = 0; r < opts.repeat; r++) {
      const label = `${baseName}${opts.repeat > 1 ? `#${r + 1}` : ''}`;
      try {
        const body = {
          photoDataUri: await toDataUri(filePath),
          provider: opts.provider,
        };
        if (opts.provider === 'localcv') body.model = 'localcv';
        if (opts.bypassCache) body.bypassCache = true;
        if (opts.scale && opts.provider === 'localcv') body.localScaleLongSide = opts.scale;
        if (opts.provider === 'localcv') body.localDebug = true;
        if (opts.rectify === 'on') body.localRectifyEnabled = true;
        if (opts.rectify === 'off') body.localRectifyEnabled = false;
        if (mockPolygon) body.curtainPolygon = mockPolygon;

        const started = performance.now();
        const res = await fetch(opts.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const elapsed = Math.round(performance.now() - started);
        if (!res.ok) {
          const text = await res.text();
          results.push({ file: label, status: res.status, elapsedMs: elapsed, provider: opts.provider, error: text.trim().slice(0, 180) });
          continue;
        }

        const json = await res.json();
        const width = toNumber(json.wallWidthCm);
        const height = toNumber(json.wallHeightCm);
        const record = {
          file: label,
          status: res.status,
          elapsedMs: elapsed,
          provider: opts.provider,
        };
        if (typeof json?.debug?.mode === 'string') record.mode = json.debug.mode;
        if (width != null) record.wallWidthCm = toFixedNumber(width);
        if (height != null) record.wallHeightCm = toFixedNumber(height);
        if (typeof json.confidencePct === 'number') record.confidencePct = toFixedNumber(json.confidencePct, 0);
        if (Array.isArray(json.warnings) && json.warnings.length) record.warnings = json.warnings.join('; ');
        let debugDir = null;
        if (opts.debugDir) {
          try {
            debugDir = await saveDebugArtifacts(opts, label, json, filePath);
          } catch (err) {
            console.warn(`[debug] Failed to save artifacts for ${label}: ${err?.message ?? err}`);
          }
        }
        if (debugDir) record.debugDir = debugDir;
        if (rectHeightMaskInfo) {
          if (rectHeightMaskInfo.status) record.maskStatus = rectHeightMaskInfo.status;
          if (Array.isArray(rectHeightMaskInfo.warnings) && rectHeightMaskInfo.warnings.length) {
            record.maskWarnings = rectHeightMaskInfo.warnings.join('; ');
          }
        }
        if (truth) {
          // Always record full-wall ground truth for reference
          record.truthWallWidthCm = toFixedNumber(truth.widthCm);
          record.truthWallHeightCm = toFixedNumber(truth.heightCm);

          // If we have a rectangle fraction (polygon run), compute expected rectangle cm.
          // Otherwise, use full-wall ground truth as before.
          let expectedWidth = truth.widthCm;
          let expectedHeight = truth.heightCm;
          const hasRectWidth = rectWidthFraction != null && rectWidthFraction > 0 && rectWidthFraction <= 1;
          const hasRectHeightFull = rectHeightFraction != null && rectHeightFraction > 0 && rectHeightFraction <= 1;
          const hasRectHeightMask = rectHeightMaskFraction != null && rectHeightMaskFraction > 0 && rectHeightMaskFraction <= 1.5;

          let effectiveHeightFraction = null;
          if (hasRectHeightMask) {
            effectiveHeightFraction = rectHeightMaskFraction;
          } else if (hasRectHeightFull) {
            effectiveHeightFraction = rectHeightFraction;
          }

          if (hasRectWidth && effectiveHeightFraction != null) {
            expectedWidth = truth.widthCm * rectWidthFraction;
            expectedHeight = truth.heightCm * effectiveHeightFraction;
            record.rectWidthFraction = toFixedNumber(rectWidthFraction, 4);
            record.rectHeightFraction = toFixedNumber(effectiveHeightFraction, 4);
            if (hasRectHeightFull) {
              record.rectHeightFullFraction = toFixedNumber(rectHeightFraction, 4);
            }
            if (hasRectHeightMask) {
              record.rectHeightMaskFraction = toFixedNumber(rectHeightMaskFraction, 4);
            }
            if (hasRectHeightFull && hasRectHeightMask && rectHeightFraction) {
              const ratio = rectHeightMaskFraction / rectHeightFraction;
              record.rectHeightMaskRatio = toFixedNumber(ratio, 4);
            }
            if (hasRectHeightMask) {
              record.rectHeightSource = 'mask';
            } else if (hasRectHeightFull) {
              record.rectHeightSource = 'full';
            } else {
              record.rectHeightSource = 'unknown';
            }
            record.target = 'rect';
          } else {
            record.target = 'wall';
            record.rectHeightSource = 'wall';
          }

          record.expectedWidthCm = toFixedNumber(expectedWidth);
          record.expectedHeightCm = toFixedNumber(expectedHeight);

          if (width != null && expectedWidth != null) {
            const diffW = width - expectedWidth;
            record.widthDiffCm = toFixedNumber(diffW);
            record.widthAbsErrCm = toFixedNumber(Math.abs(diffW));
            if (expectedWidth) record.widthPctErr = toFixedNumber(Math.abs(diffW / expectedWidth) * 100);
          }
          if (height != null && expectedHeight != null) {
            const diffH = height - expectedHeight;
            record.heightDiffCm = toFixedNumber(diffH);
            record.heightAbsErrCm = toFixedNumber(Math.abs(diffH));
            if (expectedHeight) record.heightPctErr = toFixedNumber(Math.abs(diffH / expectedHeight) * 100);
          }
        }
        results.push(record);
      } catch (err) {
        results.push({ file: label, status: 'error', elapsedMs: null, provider: opts.provider, error: err?.message ?? String(err) });
      }
    }
  }

  if (opts.groundTruth && groundTruth.size && missingTruth.size) {
    console.warn(`[ground-truth] Missing entries for ${missingTruth.size} file(s): ${Array.from(missingTruth).join(', ')}`);
  }

  const metrics = summariseMetrics(results);

  if (opts.summary === 'json') {
    console.log(JSON.stringify({ results, metrics }, null, 2));
  } else {
    const table = results.map((row) => ({
      file: row.file,
      target: row.target ?? '', // 'wall' or 'rect'
      status: row.status,
      elapsedMs: row.elapsedMs,
      mode: row.mode ?? '',
      confidencePct: row.confidencePct ?? '',
      truthWallWidthCm: row.truthWallWidthCm ?? null,
      truthWallHeightCm: row.truthWallHeightCm ?? null,
      rectWidthFrac: row.rectWidthFraction ?? null,
      rectHeightFrac: row.rectHeightFraction ?? null, // effective (mask-adjusted when available)
      rectHeightFracFull: row.rectHeightFullFraction ?? null,
      rectHeightFracMask: row.rectHeightMaskFraction ?? null,
      rectHeightFracRatio: row.rectHeightMaskRatio ?? null,
      maskStatus: row.maskStatus ?? '',
      maskWarnings: row.maskWarnings ?? '',
      rectHeightSource: row.rectHeightSource ?? '',
      expectedWidthCm: row.expectedWidthCm ?? null,
      measuredWidthCm: row.wallWidthCm ?? null,
      widthDiffCm: row.widthDiffCm ?? null,
      widthAbsErrCm: row.widthAbsErrCm ?? null,
      widthPctErr: row.widthPctErr ?? null,
      expectedHeightCm: row.expectedHeightCm ?? null,
      measuredHeightCm: row.wallHeightCm ?? null,
      heightDiffCm: row.heightDiffCm ?? null,
      heightAbsErrCm: row.heightAbsErrCm ?? null,
      heightPctErr: row.heightPctErr ?? null,
      error: row.error ?? '',
      warnings: row.warnings ?? '',
    }));
    console.table(table);

    if (metrics) {
      console.log(`Ground truth samples: ${metrics.withTruth}/${metrics.successful} successful responses (${metrics.total} total requests)`);
      const formatStat = (value, unit = 'cm') => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
        const digits = unit === '%' ? 2 : 2;
        return `${value.toFixed(digits)} ${unit}`;
      };
      if (metrics.width) {
        console.log(
          `Width  — bias ${formatStat(metrics.width.meanDiff)}, MAE ${formatStat(metrics.width.mae)}, ` +
          `RMSE ${formatStat(metrics.width.rmse)}, P95 ${formatStat(metrics.width.p95)}, ` +
          `max ${formatStat(metrics.width.maxAbs)}, MAPE ${formatStat(metrics.width.mape, '%')}`
        );
      } else {
        console.log('Width  — no ground truth');
      }
      if (metrics.height) {
        console.log(
          `Height — bias ${formatStat(metrics.height.meanDiff)}, MAE ${formatStat(metrics.height.mae)}, ` +
          `RMSE ${formatStat(metrics.height.rmse)}, P95 ${formatStat(metrics.height.p95)}, ` +
          `max ${formatStat(metrics.height.maxAbs)}, MAPE ${formatStat(metrics.height.mape, '%')}`
        );
      } else {
        console.log('Height — no ground truth');
      }
    }
  }

  if (opts.save) {
    const payload = {
      generatedAt: new Date().toISOString(),
      options: {
        endpoint: opts.endpoint,
        provider: opts.provider,
        repeat: opts.repeat,
        scale: opts.scale,
        bypassCache: opts.bypassCache,
        groundTruthPath: opts.groundTruth,
        mockPolygon: opts.mockPolygon,
      },
      results,
      metrics,
    };
    await writeFile(opts.save, JSON.stringify(payload, null, 2));
    console.log(`Saved results to ${opts.save}`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
