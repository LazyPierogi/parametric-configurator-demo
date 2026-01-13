/*
  Segmentation pipeline using Hugging Face Inference API with SegFormer-B3 ADE20K.
  Sharp-only composition and simple smoothing to stay robust and type-safe.
*/

import { HfInference } from "@huggingface/inference";
// UWAGA: sharp ładujemy dynamicznie wewnątrz funkcji, aby uniknąć ERR_DLOPEN_FAILED na Windows przy bundlowaniu
import fs from "fs/promises";
import path from "path";

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0B";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
};

const HF_MODEL = process.env.HF_MODEL || "nvidia/segformer-b5-finetuned-ade-640-640";

// Wsparcie różnych etykiet per maska dla lokalnych backendów (opcjonalne):
// MMSEG_WALL_LABELS, MMSEG_WINDOW_LABELS, MMSEG_ATTACHED_LABELS
// Dla zapytań "combined" (bez X-Mask) można użyć MMSEG_LABELS_COMBINED lub domyślnie MMSEG_WALL_LABELS
function labelsHeaderForKind(kind?: 'wall' | 'window' | 'attached'): Record<string, string> {
  const wall = process.env.MMSEG_WALL_LABELS;
  const win = process.env.MMSEG_WINDOW_LABELS || wall;
  const att = process.env.MMSEG_ATTACHED_LABELS || wall;
  const combined = process.env.MMSEG_LABELS_COMBINED || wall;
  const val = kind === 'window' ? win : kind === 'attached' ? att : (kind === 'wall' ? wall : combined);
  return val ? { 'X-Labels': val } : {};
}

// --- Wspólne aliasy i predykaty dopasowań etykiet (używane w filtrze i klasyfikacji) ---
const WALL_ALIASES = [
  'wall',
];
const WINDOW_ALIASES = [
  'window',
  'windowpane',
  'glass',
  'bay window',
  'sliding door',
  'french door',
  'patio door',
  'balcony door',
  'balcony window',
  'door',
];
const ATTACHED_ALIASES = [
  'plant', 'plants', 'potted plant', 'leaves', 'leaf', 'leafs',
  'pot', 'pots',
  'book', 'books', 'bookshelf', 'bookshelves', 'bookcase', 'bookcases',
  'painting', 'paintings', 'picture', 'pictures', 'poster', 'posters',
  'frame', 'frames', 'mirror', 'mirrors', 'shelf',
  'radiator', 'heater', 'sconce',
  'lamp', // w filtrze utrzymujemy szerzej; w klasyfikacji i tak decyduje kontakt ze ścianą
  'socket', 'switch', 'outlet',
  'curtain', 'curtains', 'drape', 'drapery', 'blinds', 'shade', 'roller blind', 'venetian blind', 'rod', 'hanger',
  'air conditioner', 'vent',
  'skirting', 'baseboard', 'molding', 'wainscoting',
  'tv', 'board', 'cabinet', 'cabinets', 'wardrobe', 'wardrobes', 'dresser', 'dressers',
  'box', 'boxes', 'board game',
];
const FLOOR_ALIASES = [ 'floor' ];
const CEILING_ALIASES = [ 'ceiling' ];

function includesAny(haystack: string, needles: string[]): boolean {
  for (const n of needles) { if (haystack.includes(n)) return true; }
  return false;
}
function normalizeLabel(x: string | undefined | null): string {
  return String(x || '').toLowerCase().trim();
}
function isWallish(lbl: string): boolean { return includesAny(lbl, WALL_ALIASES); }
function isWindowish(lbl: string): boolean { return includesAny(lbl, WINDOW_ALIASES); }
function isAttachedish(lbl: string): boolean { return includesAny(lbl, ATTACHED_ALIASES); }
function isFloorish(lbl: string): boolean { return includesAny(lbl, FLOOR_ALIASES); }
function isCeilingish(lbl: string): boolean { return includesAny(lbl, CEILING_ALIASES); }

export type SegmentOptions = {
  threshold?: number; // 0..1, binarization threshold for mask
  model?: string; // override HF model for this call
  raw?: boolean; // if true, bypass heuristics and return raw union of wall+window
  debugDir?: string; // force debug output directory (used by batch runner)
  // NEW: additional tuning params
  hfMinScore?: number; // 0..1, filter HF segments below this confidence
  minAreaPct?: number; // 0..1, min area fraction for wall component selection
  maxAreaPct?: number; // 0..1, max area fraction for wall component selection
  mmsegMinConf?: number; // 0..1, confidence threshold for local:mmseg backend
  onFallbackInput?: (info: { bytes: number; width: number; height: number; quality: number }) => void;
};

type HFSeg = { label?: string; score?: number; mask?: Blob | string };

export async function generateWallAlphaMaskPNG(
  inputImageBuffer: Buffer,
  opts: SegmentOptions = {}
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const threshold = clamp(typeof opts.threshold === "number" ? opts.threshold : 0.6, 0, 1);
  const DEBUG = process.env.SEG_DEBUG === "1" || process.env.SEG_DEBUG === "true" || !!opts.debugDir;
  const LONG_SIDE = Math.max(64, Number(process.env.SEG_LONG_SIDE || 1024));
  const FALLBACK_LONG_SIDE = Math.max(64, Number(process.env.SEG_FALLBACK_LONG_SIDE || LONG_SIDE));
  const FALLBACK_JPEG_QUALITY = clamp(
    Number.isFinite(Number(process.env.SEG_FALLBACK_JPEG_QUALITY))
      ? Number(process.env.SEG_FALLBACK_JPEG_QUALITY)
      : 82,
    40,
    100
  );
  const FALLBACK_MAX_BYTES = Math.max(65536, Number(process.env.SEG_FALLBACK_MAX_BYTES || 900_000));
  const ATTACH_CONTACT_PCT = clamp(Number(process.env.SEG_ATTACH_CONTACT_PCT ?? 0.01), 0, 1);
  const CONTACT_ANISO = process.env.SEG_CONTACT_ANISO === '1' || process.env.SEG_CONTACT_ANISO === 'true';
  const hfMinScore = clamp(
    typeof opts.hfMinScore === 'number' ? opts.hfMinScore : Number(process.env.SEG_HF_MIN_SCORE ?? 0),
    0, 1
  );
  const minAreaPctOpt = typeof opts.minAreaPct === 'number' ? clamp(opts.minAreaPct, 0, 1) : undefined;
  const maxAreaPctOpt = typeof opts.maxAreaPct === 'number' ? clamp(opts.maxAreaPct, 0, 1) : undefined;

  // Lokalny backend: jeśli model zaczyna się od 'local:' – odeślij obraz do odpowiedniego serwisu i zwróć maskę PNG
  const modelName = String(opts.model || HF_MODEL);
  if (modelName.startsWith('local:mmseg:')) {
    const m = modelName.slice('local:mmseg:'.length);
    const url = process.env.LOCAL_SEG_URL || 'http://127.0.0.1:8000/segment';
    try {
      // RAW tryb: pobierz oddzielnie wall i window, zapisz i zbuduj unijną alfę
      if (opts.raw) {
        const fetchMask = async (kind: 'wall' | 'window' | 'attached') => {
          const headers: Record<string, string> = {
            'Content-Type': 'application/octet-stream',
            'X-Model': m,
            'X-Threshold': String(threshold),
            'X-Mask': kind,
            // Przekazanie dodatkowych parametrów diagnostycznych do lokalnego MMSeg
            ...labelsHeaderForKind(kind),
            ...(typeof opts.mmsegMinConf === 'number' ? { 'X-MinConf': String(opts.mmsegMinConf) } : (process.env.MMSEG_MIN_CONF ? { 'X-MinConf': process.env.MMSEG_MIN_CONF } : {})),
            ...((opts.debugDir || process.env.SEG_DEBUG === '1' || process.env.SEG_DEBUG === 'true') ? { 'X-Debug': '1' } : {}),
            ...(process.env.MMSEG_RELOAD === '1' || process.env.MMSEG_RELOAD === 'true' ? { 'X-Reload': '1' } : {}),
          };
          if (DEBUG) {
            const xl = headers['X-Labels'] || '';
            const xm = headers['X-MinConf'];
            console.log(`[SEG-DEBUG] local:mmseg RAW ${kind} -> X-Labels="${xl}" X-Threshold=${headers['X-Threshold']}${xm ? ` X-MinConf=${xm}` : ''}`);
          }
          const r = await fetch(url, {
            method: 'POST',
            headers,
            body: inputImageBuffer,
          } as any);
          if (!r.ok) {
            const txt = await r.text();
            throw new Error(`local:mmseg (${kind}) error ${r.status}: ${txt}`);
          }
          return Buffer.from(await r.arrayBuffer());
        };
        const wallBuf = await fetchMask('wall');
        const winBuf = await fetchMask('window');
        const attBuf = await fetchMask('attached');
        // Decode both to grayscale 1ch
        const wallRaw = await sharp(wallBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const winRaw = await sharp(winBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const attRaw = await sharp(attBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const W = wallRaw.info.width, H = wallRaw.info.height, Cw = wallRaw.info.channels;
        const Cwin = winRaw.info.channels;
        const Catt = attRaw.info.channels;
        const wallGray = Buffer.alloc(W * H);
        const winGray = Buffer.alloc(W * H);
        const attGray = Buffer.alloc(W * H);
        for (let i = 0, j = 0; i < wallRaw.data.length; i += Cw, j++) wallGray[j] = Cw >= 4 ? (wallRaw.data as any)[i + 3] : (wallRaw.data as any)[i];
        for (let i = 0, j = 0; i < winRaw.data.length; i += Cwin, j++) winGray[j] = Cwin >= 4 ? (winRaw.data as any)[i + 3] : (winRaw.data as any)[i];
        for (let i = 0, j = 0; i < attRaw.data.length; i += Catt, j++) attGray[j] = Catt >= 4 ? (attRaw.data as any)[i + 3] : (attRaw.data as any)[i];
        // Binarize and union
        const union = Buffer.alloc(W * H);
        for (let i = 0; i < union.length; i++) union[i] = (wallGray[i] || winGray[i] || attGray[i]) ? 255 : 0;
        // Save debug files
        if (opts.debugDir) {
          try {
            await fs.mkdir(opts.debugDir, { recursive: true });
            const toPNG = async (arr: Buffer | Uint8Array) => (await sharp(arr, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer());
            await fs.writeFile(path.join(opts.debugDir, 'raw_wall.png'), await toPNG(wallGray));
            await fs.writeFile(path.join(opts.debugDir, 'raw_window.png'), await toPNG(winGray));
            await fs.writeFile(path.join(opts.debugDir, 'raw_attached.png'), await toPNG(attGray));
            await fs.writeFile(path.join(opts.debugDir, 'raw_union.png'), await toPNG(union));
          } catch {}
        }
        // Build RGBA alpha union (mask=1 -> alpha 0)
        const rgba = Buffer.alloc(W * H * 4, 255);
        for (let i = 0; i < W * H; i++) rgba[i * 4 + 3] = union[i] ? 0 : 255;
        return sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
      }

      // Non-raw: pojedyncze żądanie (combined domyślnie)
      const headers: Record<string, string> = {
        'Content-Type': 'application/octet-stream',
        'X-Model': m,
        'X-Threshold': String(threshold),
        ...labelsHeaderForKind(),
        ...(typeof opts.mmsegMinConf === 'number' ? { 'X-MinConf': String(opts.mmsegMinConf) } : (process.env.MMSEG_MIN_CONF ? { 'X-MinConf': process.env.MMSEG_MIN_CONF } : {})),
        ...((opts.debugDir || process.env.SEG_DEBUG === '1' || process.env.SEG_DEBUG === 'true') ? { 'X-Debug': '1' } : {}),
        ...(process.env.MMSEG_RELOAD === '1' || process.env.MMSEG_RELOAD === 'true' ? { 'X-Reload': '1' } : {}),
      };
      if (DEBUG) {
        const xl = headers['X-Labels'] || '';
        const xm = headers['X-MinConf'];
        console.log(`[SEG-DEBUG] local:mmseg COMBINED -> X-Labels="${xl}" X-Threshold=${headers['X-Threshold']}${xm ? ` X-MinConf=${xm}` : ''}`);
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: inputImageBuffer,
      } as any);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`local:mmseg error ${res.status}: ${txt}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (opts.debugDir) {
        try {
          await fs.mkdir(opts.debugDir, { recursive: true });
          const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          const W = info.width, H = info.height, C = info.channels;
          const gray = Buffer.alloc(W * H);
          // Preferuj kanał alfa (ostatni po ensureAlpha), aby nie mieszać luminancji z alfą (np. przy GA)
          if (C >= 2) {
            for (let i = C - 1, j = 0; j < gray.length; i += C, j++) gray[j] = (data as any)[i];
          } else {
            // Fallback: gdyby z jakiegoś powodu kanału alfa nie było, użyj pojedynczego kanału
            for (let i = 0, j = 0; j < gray.length; i += C, j++) gray[j] = (data as any)[i];
          }
          const toPNG = async (arr: Buffer | Uint8Array) => (await sharp(arr, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer());
          const png = await toPNG(gray);
          await fs.writeFile(path.join(opts.debugDir, 'final_mask.png'), png);
          try { await fs.writeFile(path.join(opts.debugDir, 'combined_post.png'), png); } catch {}
          // Ujednolicenie nazw miniaturek dla raportu: zapisz też fallbacki
          try { await fs.writeFile(path.join(opts.debugDir, 'attached_on_wall.png'), png); } catch {}
        } catch {}
      }
      return buf; // oczekujemy gotowego PNG z alpha
    } catch (e: any) {
      throw new Error(`Local MMSeg request failed: ${e?.message || String(e)}`);
    }
  }
  if (modelName.startsWith('local:mask2former:')) {
    // Lokalny serwer FastAPI z gałęzią Mask2Former: X-Model: mask2former_ade20k
    const url = process.env.LOCAL_SEG_URL || 'http://127.0.0.1:8000/segment';
    const m = 'mask2former_ade20k';
    try {
      if (opts.raw) {
        const fetchMask = async (kind: 'wall' | 'window' | 'attached') => {
          const headers: Record<string, string> = {
            'Content-Type': 'application/octet-stream',
            'X-Model': m,
            'X-Threshold': String(threshold),
            'X-Mask': kind,
            ...labelsHeaderForKind(kind),
            ...((opts.debugDir || process.env.SEG_DEBUG === '1' || process.env.SEG_DEBUG === 'true') ? { 'X-Debug': '1' } : {}),
            ...(process.env.MMSEG_RELOAD === '1' || process.env.MMSEG_RELOAD === 'true' ? { 'X-Reload': '1' } : {}),
          };
          if (DEBUG) {
            const xl = headers['X-Labels'] || '';
            console.log(`[SEG-DEBUG] local:mask2former RAW ${kind} -> X-Labels="${xl}" X-Threshold=${headers['X-Threshold']}`);
          }
          const r = await fetch(url, {
            method: 'POST',
            headers,
            body: inputImageBuffer,
          } as any);
          if (!r.ok) {
            const txt = await r.text();
            throw new Error(`local:mask2former (${kind}) error ${r.status}: ${txt}`);
          }
          return Buffer.from(await r.arrayBuffer());
        };
        const wallBuf = await fetchMask('wall');
        const winBuf = await fetchMask('window');
        const attBuf = await fetchMask('attached');
        const wallRaw = await sharp(wallBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const winRaw = await sharp(winBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const attRaw = await sharp(attBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const W = wallRaw.info.width, H = wallRaw.info.height, Cw = wallRaw.info.channels;
        const Cwin = winRaw.info.channels;
        const Catt = attRaw.info.channels;
        const wallGray = Buffer.alloc(W * H);
        const winGray = Buffer.alloc(W * H);
        const attGray = Buffer.alloc(W * H);
        for (let i = 0, j = 0; i < wallRaw.data.length; i += Cw, j++) wallGray[j] = Cw >= 4 ? (wallRaw.data as any)[i + 3] : (wallRaw.data as any)[i];
        for (let i = 0, j = 0; i < winRaw.data.length; i += Cwin, j++) winGray[j] = Cwin >= 4 ? (winRaw.data as any)[i + 3] : (winRaw.data as any)[i];
        for (let i = 0, j = 0; i < attRaw.data.length; i += Catt, j++) attGray[j] = Catt >= 4 ? (attRaw.data as any)[i + 3] : (attRaw.data as any)[i];
        const union = Buffer.alloc(W * H);
        for (let i = 0; i < union.length; i++) union[i] = (wallGray[i] || winGray[i] || attGray[i]) ? 255 : 0;
        if (opts.debugDir) {
          try {
            await fs.mkdir(opts.debugDir, { recursive: true });
            const toPNG = async (arr: Buffer | Uint8Array) => (await sharp(arr, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer());
            await fs.writeFile(path.join(opts.debugDir, 'raw_wall.png'), await toPNG(wallGray));
            await fs.writeFile(path.join(opts.debugDir, 'raw_window.png'), await toPNG(winGray));
            await fs.writeFile(path.join(opts.debugDir, 'raw_attached.png'), await toPNG(attGray));
            await fs.writeFile(path.join(opts.debugDir, 'raw_union.png'), await toPNG(union));
          } catch {}
        }
        const rgba = Buffer.alloc(W * H * 4, 255);
        for (let i = 0; i < W * H; i++) rgba[i * 4 + 3] = union[i] ? 0 : 255;
        return sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
      }
      const longSide = process.env.LOCAL_SEG_LONG_SIDE;
      if (DEBUG && longSide) {
        console.log(`[SEG-DEBUG] LOCAL_SEG_LONG_SIDE=${longSide} will be sent as X-Scale-Long-Side header`);
      } else if (DEBUG && !longSide) {
        console.log(`[SEG-DEBUG] LOCAL_SEG_LONG_SIDE not set, service will use default (env M2F_LONG_SIDE or 768)`);
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/octet-stream',
        'X-Model': m,
        'X-Threshold': String(threshold),
        ...labelsHeaderForKind(),
        ...(longSide ? { 'X-Scale-Long-Side': longSide } : {}),
        ...((opts.debugDir || process.env.SEG_DEBUG === '1' || process.env.SEG_DEBUG === 'true') ? { 'X-Debug': '1' } : {}),
        ...(process.env.MMSEG_RELOAD === '1' || process.env.MMSEG_RELOAD === 'true' ? { 'X-Reload': '1' } : {}),
      };
      if (DEBUG) {
        const xl = headers['X-Labels'] || '';
        console.log(`[SEG-DEBUG] local:mask2former COMBINED -> X-Labels="${xl}" X-Threshold=${headers['X-Threshold']}`);
      }
      // Opcjonalnie: zamiast ufać masce COMBINED z serwera, złóż finalną maskę lokalnie z RAW (wall/window/attached)
      const COMPOSE_FROM_RAW = (process.env.SEG_M2F_COMPOSE_FROM_RAW === '1' || process.env.SEG_M2F_COMPOSE_FROM_RAW === 'true');
      if (COMPOSE_FROM_RAW) {
        // Pobierz RAW maski jak w trybie opts.raw, ale nie zwracaj unii – tylko tablice binarne do złożenia
        const fetchMask = async (kind: 'wall' | 'window' | 'attached') => {
          const headersRaw: Record<string, string> = {
            'Content-Type': 'application/octet-stream',
            'X-Model': m,
            'X-Threshold': String(threshold),
            'X-Mask': kind,
            ...labelsHeaderForKind(kind),
            ...(longSide ? { 'X-Scale-Long-Side': longSide } : {}),
            ...((opts.debugDir || process.env.SEG_DEBUG === '1' || process.env.SEG_DEBUG === 'true') ? { 'X-Debug': '1' } : {}),
            ...(process.env.MMSEG_RELOAD === '1' || process.env.MMSEG_RELOAD === 'true' ? { 'X-Reload': '1' } : {}),
          };
          if (DEBUG) {
            const xl2 = headersRaw['X-Labels'] || '';
            console.log(`[SEG-DEBUG] local:mask2former COMPOSE RAW ${kind} -> X-Labels="${xl2}" X-Threshold=${headersRaw['X-Threshold']}`);
          }
          const r = await fetch(url, {
            method: 'POST',
            headers: headersRaw,
            body: inputImageBuffer,
          } as any);
          if (!r.ok) {
            const txt = await r.text();
            throw new Error(`local:mask2former (compose ${kind}) error ${r.status}: ${txt}`);
          }
          return Buffer.from(await r.arrayBuffer());
        };
        const wallBuf = await fetchMask('wall');
        const winBuf = await fetchMask('window');
        const attBuf = await fetchMask('attached');
        // Dekoduj do 1-kanałowych map (używamy kanału alfa jeśli dostępny, inaczej luminancji)
        const wallRaw = await sharp(wallBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const winRaw = await sharp(winBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const attRaw = await sharp(attBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const W = wallRaw.info.width, H = wallRaw.info.height, Cw = wallRaw.info.channels;
        const Cwin = winRaw.info.channels;
        const Catt = attRaw.info.channels;
        const wallCombined = new Uint8ClampedArray(W * H);
        const windowCombined = new Uint8ClampedArray(W * H);
        const attachedCombined = new Uint8ClampedArray(W * H);
        const floorCombined = new Uint8ClampedArray(W * H);
        const ceilingCombined = new Uint8ClampedArray(W * H);
        // Binarizacja względem progu (kanał alfa z serwera: 0 = maska, 255 = tło)
        // Maskę uznajemy za "1" gdy alfa < (1 - threshold) * 255
        for (let i = 0, j = 0; i < wallRaw.data.length; i += Cw, j++) {
          const v = Cw >= 4 ? (wallRaw.data as any)[i + 3] : (wallRaw.data as any)[i];
          if (v < (1 - threshold) * 255) wallCombined[j] = 255;
        }
        for (let i = 0, j = 0; i < winRaw.data.length; i += Cwin, j++) {
          const v = Cwin >= 4 ? (winRaw.data as any)[i + 3] : (winRaw.data as any)[i];
          if (v < (1 - threshold) * 255) windowCombined[j] = 255;
        }
        for (let i = 0, j = 0; i < attRaw.data.length; i += Catt, j++) {
          const v = Catt >= 4 ? (attRaw.data as any)[i + 3] : (attRaw.data as any)[i];
          if (v < (1 - threshold) * 255) attachedCombined[j] = 255;
        }
        // --- Poniżej lokalna kompozycja identyczna jak w ścieżce HF ---
        // Dylacja okien skalowana rozmiarem obrazu (ok. 0.4% krótszego boku)
        {
          const base = Math.min(W, H);
          const r = Math.max(1, Math.round(base * 0.004));
          const winDil = dilateBinary(windowCombined, W, H, r);
          for (let i = 0; i < W * H; i++) windowCombined[i] = winDil[i];
        }
        // Proste oczyszczenie: odetnij sufit i podłogę od ściany (tu puste, bo nie pobieramy floor/ceiling – bezpieczne no-op)
        const morphStrength = threshold < 0.25 ? 1 : threshold < 0.6 ? 2 : 3;
        const floorDil = dilateBinary(floorCombined, W, H, morphStrength);
        const ceilDil = dilateBinary(ceilingCombined, W, H, morphStrength);
        for (let i = 0; i < W * H; i++) {
          if (floorDil[i] || ceilDil[i]) wallCombined[i] = 0;
        }
        // 1) komponenty spójne na masce ścian
        const { labels: wallLabels, comps } = labelComponents(wallCombined, W, H);
        if (DEBUG && opts.debugDir) {
          try {
            const wallPre = await sharp(Buffer.from(wallCombined), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
            await fs.writeFile(path.join(opts.debugDir, `wall_combined.png`), wallPre);
            const winPre = await sharp(Buffer.from(windowCombined), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
            await fs.writeFile(path.join(opts.debugDir, `windows_combined.png`), winPre);
          } catch {}
        }
        // 2) scoring komponentów: centralność + rozmiar + kształt (+kary za krawędzie)
        const cx0 = W / 2, cy0 = H / 2, diag = Math.hypot(cx0, cy0);
        let bestIdx = -1, bestScore = -Infinity;
        let minFrac = 0.005;
        for (let pass = 0; pass < 2 && bestIdx < 0; pass++) {
          const effMinFrac = (typeof minAreaPctOpt === 'number') ? minAreaPctOpt : minFrac;
          const minArea = Math.max(1, Math.floor(effMinFrac * W * H));
          const maxArea = (typeof maxAreaPctOpt === 'number') ? Math.max(1, Math.floor(maxAreaPctOpt * W * H)) : Infinity;
          for (let k = 0; k < comps.length; k++) {
            const c = comps[k];
            if (c.area < minArea) continue;
            if (c.area > maxArea) continue;
            const centerDist = Math.hypot(c.cx - cx0, c.cy - cy0) / diag;
            const centrality = 1 - centerDist;
            const areaNorm = c.area / (W * H);
            const w = c.maxX - c.minX + 1, h = c.maxY - c.minY + 1;
            const aspect = w > h ? h / w : w / h;
            const compact = c.perimeter > 0 ? (4 * Math.PI * c.area) / (c.perimeter * c.perimeter) : 0;
            const edgeBandX = Math.max(2, Math.floor(0.02 * W));
            const edgeBandY = Math.max(2, Math.floor(0.03 * H));
            const touchesLeft = c.minX <= edgeBandX ? 1 : 0;
            const touchesRight = c.maxX >= W - 1 - edgeBandX ? 1 : 0;
            const touchesTop = c.minY <= edgeBandY ? 1 : 0;
            const touchesBottom = c.maxY >= H - 1 - edgeBandY ? 1 : 0;
            const edgePenalty = 0.4 * (touchesLeft + touchesRight) + 0.6 * (touchesTop + touchesBottom);
            const tallPenalty = aspect < 0.3 ? (0.3 - aspect) * 1.0 : 0;
            const score = centrality * 1.2 + areaNorm * 3.2 + aspect * 0.6 + compact * 0.4 - edgePenalty - tallPenalty;
            if (score > bestScore) { bestScore = score; bestIdx = k; }
          }
          if (typeof minAreaPctOpt !== 'number') {
            minFrac = 0.002;
          }
        }
        let wallSelected = new Uint8ClampedArray(W * H);
        if (bestIdx >= 0) {
          for (let i = 0; i < W * H; i++) {
            if (wallLabels[i] === bestIdx + 1) wallSelected[i] = 255;
          }
        }
        if (bestIdx >= 0) {
          wallSelected = closeBinary(wallSelected, W, H, Math.max(1, morphStrength - 1));
        }
        // Opcjonalne: scal sąsiednie komponenty ściany przez małe mostki (łącz bliskie komponenty głównej ściany)
        const WALL_MERGE_RADIUS = Math.max(0, Math.floor(Number(process.env.SEG_WALL_MERGE_RADIUS ?? 2)));
        if (bestIdx >= 0 && WALL_MERGE_RADIUS > 0) {
          const bridge = dilateBinary(wallSelected, W, H, WALL_MERGE_RADIUS);
          const include = new Array(comps.length).fill(false);
          include[bestIdx] = true;
          for (let i = 0; i < wallLabels.length; i++) {
            const lab = wallLabels[i];
            if (lab !== 0 && !include[lab - 1] && bridge[i]) include[lab - 1] = true;
          }
          const merged = new Uint8ClampedArray(W * H);
          for (let i = 0; i < wallLabels.length; i++) {
            const lab = wallLabels[i];
            if (lab !== 0 && include[lab - 1]) merged[i] = 255;
          }
          wallSelected = merged;
        }
        // 4) dylatacja ściany
        const wallDilated = dilateBinary(wallSelected, W, H, morphStrength);
        // 5) dołącz okna dotykające ściany
        let windowsOnWall = new Uint8ClampedArray(W * H);
        {
          const { labels: winLabels, comps: winComps } = labelComponents(windowCombined, W, H);
          const wallContact = dilateBinary(wallDilated, W, H, 1);
          const idxOf = (x: number, y: number) => y * W + x;
          const touchesWall: boolean[] = new Array(winComps.length).fill(false);
          for (let k = 0; k < winComps.length; k++) {
            const c = winComps[k];
            let touch = false;
            for (let y = c.minY; y <= c.maxY && !touch; y++) {
              for (let x = c.minX; x <= c.maxX; x++) {
                const i = idxOf(x, y);
                if (winLabels[i] === k + 1 && wallContact[i]) { touch = true; break; }
              }
            }
            touchesWall[k] = touch;
          }
          for (let i = 0; i < winLabels.length; i++) {
            const lab = winLabels[i];
            if (lab !== 0 && touchesWall[lab - 1]) windowsOnWall[i] = 255;
          }
        }
        if (threshold >= 0) {
          const winE = erodeBinary(windowsOnWall, W, H, 1);
          windowsOnWall = dilateBinary(winE, W, H, 1);
        }
        // 5b) dołącz obiekty przyścienne jeśli mają kontakt ze ścianą/oknem
        let attachedOnWall = new Uint8ClampedArray(W * H);
        {
          const { labels: attLabels, comps: attComps } = labelComponents(attachedCombined, W, H);
          const contactBase = new Uint8ClampedArray(W * H);
          for (let i = 0; i < W * H; i++) if (wallDilated[i] || windowsOnWall[i]) contactBase[i] = 255;
          const rx = Math.max(1, morphStrength + 2);
          const ry = Math.max(1, Math.floor((morphStrength + 1) / 2));
          const CONTACT_ANISO = process.env.SEG_CONTACT_ANISO === '1' || process.env.SEG_CONTACT_ANISO === 'true';
          const contactArea = CONTACT_ANISO
            ? dilateBinaryAniso(contactBase, W, H, rx, ry)
            : dilateBinary(contactBase, W, H, Math.max(1, morphStrength + 1));
          const touchesWallA: boolean[] = new Array(attComps.length).fill(false);
          const idxOf = (x: number, y: number) => y * W + x;
          for (let k = 0; k < attComps.length; k++) {
            const c = attComps[k];
            let contactPixels = 0;
            for (let y = c.minY; y <= c.maxY; y++) {
              for (let x = c.minX; x <= c.maxX; x++) {
                const i = idxOf(x, y);
                if (attLabels[i] === k + 1 && contactArea[i]) contactPixels++;
              }
            }
            const frac = c.area > 0 ? contactPixels / c.area : 0;
            const ATTACH_CONTACT_PCT = clamp(Number(process.env.SEG_ATTACH_CONTACT_PCT ?? 0.01), 0, 1);
            touchesWallA[k] = frac >= ATTACH_CONTACT_PCT;
          }
          if (DEBUG && opts.debugDir) {
            try {
              await sharp(contactArea, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(opts.debugDir!, 'contact_area.png'));
            } catch {}
          }
          for (let i = 0; i < attLabels.length; i++) {
            const lab = attLabels[i];
            if (lab !== 0 && touchesWallA[lab - 1]) attachedOnWall[i] = 255;
          }
        }
        // 6) finalna maska i gating wsparcia modelu
        const modelSupport = new Uint8ClampedArray(W * H);
        for (let i = 0; i < W * H; i++) {
          if (wallCombined[i] || windowCombined[i] || attachedCombined[i]) modelSupport[i] = 255;
        }
        const modelSupportDil = dilateBinary(modelSupport, W, H, 3);
        const BYPASS_SUPPORT = (process.env.SEG_BYPASS_SUPPORT === '1' || process.env.SEG_BYPASS_SUPPORT === 'true');
        const finalCombined = new Uint8ClampedArray(W * H);
        const detached = new Uint8ClampedArray(W * H);
        for (let i = 0; i < W * H; i++) if (attachedCombined[i] && !attachedOnWall[i]) detached[i] = 255;
        const proposalUnion = new Uint8ClampedArray(W * H);
        for (let i = 0; i < W * H; i++) {
          const wallSansDetached = wallSelected[i] && !detached[i] ? 255 : 0;
          const proposal = wallSansDetached || windowsOnWall[i] || attachedOnWall[i];
          if (proposal) proposalUnion[i] = 255;
          if (proposal && (BYPASS_SUPPORT || modelSupportDil[i])) finalCombined[i] = 255;
        }
        if (DEBUG && opts.debugDir) {
          try {
            await sharp(proposalUnion, { raw: { width: W, height: H, channels: 1 } })
              .png().toFile(path.join(opts.debugDir!, 'proposal_union.png'));
          } catch {}
        }
        if (DEBUG && opts.debugDir) {
          try {
            await sharp(modelSupport, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(opts.debugDir!, 'model_support.png'));
            await sharp(modelSupportDil, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(opts.debugDir!, 'model_support_dil.png'));
          } catch {}
        }
        if (DEBUG && opts.debugDir) {
          const toPNG = async (arr: Uint8ClampedArray, name: string) => {
            await sharp(arr, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(opts.debugDir!, name));
          };
          try {
            await toPNG(detached, 'attached_detached.png');
          } catch {}
        }
        const minArea = Math.max(1, Math.floor(0.002 * W * H));
        if (DEBUG && opts.debugDir) {
          try {
            await sharp(finalCombined, { raw: { width: W, height: H, channels: 1 } })
              .png().toFile(path.join(opts.debugDir!, 'final_combined_preclean.png'));
          } catch {}
        }
        const finalClean = removeSmallComponents(finalCombined, W, H, minArea);
        if (DEBUG && opts.debugDir) {
          try {
            await sharp(finalClean, { raw: { width: W, height: H, channels: 1 } })
              .png().toFile(path.join(opts.debugDir!, 'final_combined_postclean.png'));
          } catch {}
        }
        // Opcjonalne wypełnianie małych dziur wewnątrz maski (bez obiektów stykających się z krawędzią obrazu)
        const FILL_HOLES = (process.env.SEG_FILL_HOLES !== '0' && process.env.SEG_FILL_HOLES !== 'false');
        const HOLE_MAX_AREA_PCT = clamp(Number(process.env.SEG_HOLES_MAX_AREA_PCT ?? 0.01), 0, 1);
        let afterFill = finalClean;
        let holesDbg: Uint8ClampedArray | null = null;
        if (FILL_HOLES) {
          const maxHoleArea = Math.max(1, Math.floor(HOLE_MAX_AREA_PCT * W * H));
          let HOLES_BRIDGE_RADIUS = Math.max(0, Math.floor(Number(process.env.SEG_HOLES_BRIDGE_RADIUS ?? 1)));
          const HOLES_BRIDGE_CAP = Math.max(0, Math.floor(Number(process.env.SEG_HOLES_BRIDGE_CAP ?? 8)));
          if (HOLES_BRIDGE_RADIUS > HOLES_BRIDGE_CAP) HOLES_BRIDGE_RADIUS = HOLES_BRIDGE_CAP;
          if (DEBUG) {
            console.log(`[SEG-DEBUG] FILL_HOLES=${FILL_HOLES} HOLE_MAX_AREA_PCT=${HOLE_MAX_AREA_PCT} maxHoleArea=${maxHoleArea}/${W * H} HOLES_BRIDGE_RADIUS=${HOLES_BRIDGE_RADIUS} (cap=${HOLES_BRIDGE_CAP})`);
          }
          // 1) Zawsze wypełnij klasyczne, w pełni zamknięte dziury na oryginalnej masce
          const base = fillSmallHoles(afterFill as Uint8ClampedArray<any>, W, H, maxHoleArea);
          const holesMask = new Uint8ClampedArray(base.holes);
          // 2) Opcjonalnie „przerwij” cienkie kanały tła (invers) przez opening, aby quasi-dziury stały się zamknięte
          if (HOLES_BRIDGE_RADIUS > 0) {
            // Inwersja: tło (poza maską) -> 255; maska -> 0
            const inv0 = new Uint8ClampedArray(W * H);
            for (let i = 0; i < W * H; i++) inv0[i] = afterFill[i] ? 0 : 255;
            const openAccum = new Uint8ClampedArray(W * H);
            let r = 1;
            let changed = false;
            while (r <= HOLES_BRIDGE_RADIUS) {
              const invE = erodeBinary(inv0, W, H, r);
              const invOpen = dilateBinary(invE, W, H, r);
              // Wybierz komponenty tła, które NIE dotykają krawędzi – potencjalne quasi-dziury dla danego r
              const { labels: labO, comps: compsO } = labelComponents(invOpen, W, H);
              const take = new Array(compsO.length).fill(false);
              for (let k = 0; k < compsO.length; k++) {
                const c = compsO[k];
                const touchesBorder = (c.minX === 0 || c.minY === 0 || c.maxX === W - 1 || c.maxY === H - 1);
                if (!touchesBorder && c.area <= Math.max(1, maxHoleArea)) take[k] = true;
              }
              const openHoles = new Uint8ClampedArray(W * H);
              for (let i = 0; i < labO.length; i++) {
                const lab = labO[i];
                if (lab !== 0 && take[lab - 1]) openHoles[i] = 255;
              }
              const openHolesDil = dilateBinary(openHoles, W, H, r);
              let localAdded = 0;
              for (let i = 0; i < W * H; i++) {
                if (openHolesDil[i] && !afterFill[i] && !openAccum[i]) { openAccum[i] = 255; localAdded++; }
              }
              changed = changed || (localAdded > 0);
              // zwiększ promień wykładniczo
              r = r < 1 ? 1 : r * 2;
              // wczesne wyjście: jeśli przy dużym promieniu nic nie doszło (2 kolejne iteracje), przerwij
              if (r > 2 && !changed) break;
              if (localAdded === 0 && r > HOLES_BRIDGE_RADIUS / 2) break;
            }
            for (let i = 0; i < W * H; i++) if (openAccum[i]) holesMask[i] = 255;
            if (DEBUG && opts.debugDir) {
              try {
                await sharp(openAccum, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(opts.debugDir!, 'holes_open_accum.png'));
              } catch {}
            }
          }
          // 3) Zastosuj wykryte dziury do ORYGINALNEJ maski (fill-in), bez zmiany konturu
          const out = new Uint8ClampedArray(afterFill);
          for (let i = 0; i < out.length; i++) { if (holesMask[i]) out[i] = 255; }
          afterFill = out;
          holesDbg = holesMask;
        }
        if (DEBUG && opts.debugDir) {
          try {
            await sharp(afterFill, { raw: { width: W, height: H, channels: 1 } })
              .png().toFile(path.join(opts.debugDir!, 'combined_pre_smooth.png'));
            if (holesDbg) {
              await sharp(holesDbg, { raw: { width: W, height: H, channels: 1 } })
                .png().toFile(path.join(opts.debugDir!, 'holes_filled.png'));
            }
          } catch {}
        }
        const APPLY_SMOOTH = (process.env.SEG_SMOOTH === '1' || process.env.SEG_SMOOTH === 'true');
        let outputMask: Buffer = Buffer.from(afterFill);
        if (APPLY_SMOOTH) {
          const k = Math.max(3, Math.floor((morphStrength * 2 - 1) / 2) * 2 + 1);
          try {
            outputMask = await sharp(afterFill, { raw: { width: W, height: H, channels: 1 } })
              .median(k)
              .threshold(128)
              .raw()
              .toBuffer();
          } catch {
            outputMask = Buffer.from(afterFill);
          }
        }
        if (DEBUG && opts.debugDir) {
          try {
            // Zapisz jako RGBA: białe RGB, alfa=0 na masce (outputMask>0), alfa=255 poza maską
            const rgba = Buffer.alloc(W * H * 4, 255);
            for (let i = 0; i < W * H; i++) {
              const a = outputMask[i] > 0 ? 0 : 255;
              const o = i * 4;
              rgba[o + 0] = 255; // R
              rgba[o + 1] = 255; // G
              rgba[o + 2] = 255; // B
              rgba[o + 3] = a;   // A
            }
            await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
              .png().toFile(path.join(opts.debugDir!, 'final_mask.png'));
            await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
              .png().toFile(path.join(opts.debugDir!, 'combined_post.png'));
            // Dodatkowe statystyki maski do diagnostyki
            try {
              let nz = 0; const hist = new Array(256).fill(0);
              for (let i = 0; i < outputMask.length; i++) { const v = outputMask[i]; hist[v]++; if (v) nz++; }
              const total = W * H;
              const stats = { width: W, height: H, pixels: total, nonzero: nz, zeros: total - nz, nonzero_pct: total ? +(nz / total).toFixed(6) : 0, histogram: hist };
              await fs.writeFile(path.join(opts.debugDir!, 'final_mask_stats.json'), JSON.stringify(stats));
            } catch {}
          } catch {}
        }
        if (DEBUG && opts.debugDir) {
          try {
            const wsel = await sharp(Buffer.from(wallSelected), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
            await fs.writeFile(path.join(opts.debugDir!, `wall_selected.png`), wsel);
            const wdel = await sharp(Buffer.from(wallDilated), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
            await fs.writeFile(path.join(opts.debugDir!, `wall_selected_dilated.png`), wdel);
            const winSel = await sharp(Buffer.from(windowsOnWall), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
            await fs.writeFile(path.join(opts.debugDir!, `windows_on_wall.png`), winSel);
            const attSel = await sharp(Buffer.from(attachedOnWall), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
            await fs.writeFile(path.join(opts.debugDir!, `attached_on_wall.png`), attSel);
            const pre = await sharp(Buffer.from(finalCombined), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
            await fs.writeFile(path.join(opts.debugDir!, `combined_pre.png`), pre);
            const cleaned = await sharp(Buffer.from(finalClean), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
            await fs.writeFile(path.join(opts.debugDir!, `combined_cleaned.png`), cleaned);
            const supportImg = await sharp(Buffer.from(modelSupportDil), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
            await fs.writeFile(path.join(opts.debugDir!, `model_support.png`), supportImg);
          } catch {}
        }
        // Zbuduj RGBA (mask->alpha 0)
        const rgba = Buffer.alloc(W * H * 4, 255);
        for (let i = 0; i < W * H; i++) {
          const a = outputMask[i] > 0 ? 0 : 255;
          rgba[i * 4 + 3] = a;
        }
        return sharp(Buffer.from(rgba), { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: inputImageBuffer,
      } as any);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`local:mask2former error ${res.status}: ${txt}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (opts.debugDir) {
        try {
          await fs.mkdir(opts.debugDir, { recursive: true });
          const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          const W = info.width, H = info.height, C = info.channels;
          const gray = Buffer.alloc(W * H);
          // Preferuj kanał alfa (ostatni po ensureAlpha), aby nie mieszać luminancji z alfą (np. przy GA)
          if (C >= 2) {
            for (let i = C - 1, j = 0; j < gray.length; i += C, j++) gray[j] = (data as any)[i];
          } else {
            // Fallback: gdyby z jakiegoś powodu kanału alfa nie było, użyj pojedynczego kanału
            for (let i = 0, j = 0; j < gray.length; i += C, j++) gray[j] = (data as any)[i];
          }
          // Zapisz jako RGBA: białe RGB, alfa z 'gray' (0=przezroczyste na masce, 255=tło)
          const rgba = Buffer.alloc(W * H * 4, 255);
          for (let j = 0; j < W * H; j++) {
            const a = gray[j];
            const o = j * 4;
            rgba[o + 0] = 255; // R
            rgba[o + 1] = 255; // G
            rgba[o + 2] = 255; // B
            rgba[o + 3] = a;   // A
          }
          const png = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
          await fs.writeFile(path.join(opts.debugDir, 'final_mask.png'), png);
          try { await fs.writeFile(path.join(opts.debugDir, 'combined_post.png'), png); } catch {}
          try { await fs.writeFile(path.join(opts.debugDir, 'attached_on_wall.png'), png); } catch {}
          // Dodatkowe statystyki maski do diagnostyki
          try {
            let nz = 0; const hist = new Array(256).fill(0);
            for (let i = 0; i < gray.length; i++) { const v = gray[i]; hist[v]++; if (v) nz++; }
            const total = W * H;
            const stats = { width: W, height: H, pixels: total, nonzero: nz, zeros: total - nz, nonzero_pct: total ? +(nz / total).toFixed(6) : 0, histogram: hist };
            await fs.writeFile(path.join(opts.debugDir, 'final_mask_stats.json'), JSON.stringify(stats));
          } catch {}
        } catch {}
      }
      return buf;
    } catch (e: any) {
      throw new Error(`Local Mask2Former request failed: ${e?.message || String(e)}`);
    }
  }
  // Alternate local segmentation path disabled (no client-side ORT pipeline)
  if (false) {
    try {
      const base = process.env.LOCAL_SEG_NODE_URL || 'http://127.0.0.1:3000';
      const url = `${base}/api/segment`;

      // Timeout + 1 retry (domyślnie 120s). Konfigurowalne przez LOCAL_SEG_TIMEOUT_MS
      const timeoutMs = Math.max(10_000, Number(process.env.LOCAL_SEG_TIMEOUT_MS || 120_000));
      const doFetch = async (): Promise<Response> => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
          const r = await fetch(url, {
            method: 'POST',
            body: inputImageBuffer,
            headers: { 'Content-Type': 'application/octet-stream' },
            signal: ctrl.signal,
          } as any);
          return r as any;
        } finally {
          clearTimeout(t);
        }
      };

      let res: Response | null = null;
      let lastErr: any = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const r = await doFetch();
          res = r;
          if (r.ok) break;
          // Retry tylko dla 502/504, resztę traktujemy jako błąd trwały
          if (attempt === 1 && (r.status === 502 || r.status === 504)) {
            continue;
          }
          const txt = await r.text();
          throw new Error(`local segmentation (disabled) error ${r.status}: ${txt}`);
        } catch (e: any) {
          lastErr = e;
          // Przy pierwszym podejściu spróbuj ponownie w razie AbortError/TypeError (sieć)
          const name = e?.name || '';
          if (attempt === 1 && (name.includes('AbortError') || name.includes('TypeError'))) {
            continue;
          }
          throw e;
        }
      }
      if (!res) throw lastErr || new Error('local segmentation path disabled');
      const buf = Buffer.from(await res!.arrayBuffer());
      // Zapisz maski dla batch debug, jeśli proszono o debugDir
      if (opts.debugDir) {
        try {
          const dbg = opts.debugDir as string;
          await fs.mkdir(dbg, { recursive: true });
          const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          const W = info.width, H = info.height, C = info.channels;
          const gray = Buffer.alloc(W * H);
          if (C >= 4) {
            for (let i = 3, j = 0; i < data.length; i += C, j++) gray[j] = (data as any)[i];
          } else {
            for (let i = 0, j = 0; i < data.length; i += C, j++) {
              const r = (data as any)[i], g = (data as any)[i + 1] ?? r, b = (data as any)[i + 2] ?? r;
              gray[j] = Math.max(0, Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b)));
            }
          }
          const toPNG = async (arr: Buffer | Uint8Array) => (await sharp(arr, { raw: { width: W, height: H, channels: 1 } }).png().toBuffer());
          if (opts.raw) {
            const bin = Buffer.from(gray);
            for (let i = 0; i < bin.length; i++) bin[i] = bin[i] ? 255 : 0;
            const unionPng = await toPNG(bin);
            await fs.writeFile(path.join(dbg, 'raw_union.png'), unionPng);
            await fs.writeFile(path.join(dbg, 'raw_wall.png'), unionPng);
            try {
              const zeros = Buffer.alloc(W * H, 0);
              const winPng = await toPNG(zeros);
              await fs.writeFile(path.join(dbg, 'raw_window.png'), winPng);
            } catch {}
          } else {
            const png = await toPNG(gray);
            await fs.writeFile(path.join(dbg, 'final_mask.png'), png);
            try { await fs.writeFile(path.join(dbg, 'combined_post.png'), png); } catch {}
            // Ujednolicenie nazw miniaturek dla raportu: zapisz też fallbacki
            try { await fs.writeFile(path.join(dbg, 'attached_on_wall.png'), png); } catch {}
          }
        } catch {}
      }
      return buf;
    } catch (e: any) {
      throw new Error(`Local segmentation path removed: ${e?.message || String(e)}`);
    }
  }

  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    throw new Error("HF_TOKEN is not set. Please add it to your .env.local");
  }

  const { width: W = 1, height: H = 1 } = await sharp(inputImageBuffer).metadata();

  const hf = new HfInference(hfToken);
  // Pass a Blob (works across SDK/provider combos). If that fails, retry using `inputs`.
  let segments: HFSeg[] | undefined;
  // Opcjonalne skalowanie wejścia: dłuższy bok do LONG_SIDE, aspect preserved
  let hfInputBuffer = inputImageBuffer;
  try {
    const meta = await sharp(inputImageBuffer).metadata();
    const baseWidth = meta.width || W;
    const baseHeight = meta.height || H;
    const baseLong = Math.max(baseWidth, baseHeight);
    let targetLong = Math.min(baseLong, FALLBACK_LONG_SIDE);
    let quality = FALLBACK_JPEG_QUALITY;
    const minQuality = 40;
    const minLongSide = 64;
    const encode = async (): Promise<Buffer> => {
      let pipeline = sharp(inputImageBuffer);
      if (targetLong > 0 && baseLong > targetLong) {
        const resizeOpts = baseWidth >= baseHeight ? { width: targetLong } : { height: targetLong };
        pipeline = pipeline.resize({ ...resizeOpts, fit: 'inside', kernel: sharp.kernel.lanczos3 });
      }
      return pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    };

    hfInputBuffer = await encode();
    let attempts = 0;
    while (hfInputBuffer.length > FALLBACK_MAX_BYTES && attempts < 4) {
      attempts += 1;
      targetLong = Math.max(minLongSide, Math.floor(targetLong * 0.85));
      quality = Math.max(minQuality, Math.round(quality * 0.9));
      hfInputBuffer = await encode();
    }

    const resizedMeta = await sharp(hfInputBuffer).metadata();
    const resizedWidth = resizedMeta.width || baseWidth;
    const resizedHeight = resizedMeta.height || baseHeight;
    const sizeLabel = formatBytes(hfInputBuffer.length);
    console.info(
      `[segment] hf fallback input ${baseWidth}x${baseHeight} -> ${resizedWidth}x${resizedHeight} (${sizeLabel}) quality=${quality}`
    );
    opts.onFallbackInput?.({
      bytes: hfInputBuffer.length,
      width: resizedWidth,
      height: resizedHeight,
      quality,
    });
  } catch (resizeErr) {
    console.warn(
      '[segment] hf fallback resize failed; continuing with original buffer',
      resizeErr instanceof Error ? resizeErr.message : resizeErr
    );
    hfInputBuffer = inputImageBuffer;
    opts.onFallbackInput?.({
      bytes: hfInputBuffer.length,
      width: W,
      height: H,
      quality: FALLBACK_JPEG_QUALITY,
    });
  }
  const blobInput = new Uint8Array(hfInputBuffer);
  const blob = new Blob([blobInput], { type: "image/jpeg" });
  try {
    segments = (await hf.imageSegmentation({
      model: modelName || HF_MODEL,
      data: blob,
    } as any)) as HFSeg[];
  } catch (e: any) {
    if (DEBUG) {
      console.warn("hf.imageSegmentation failed (data)", {
        name: e?.name,
        message: e?.message,
        status: e?.status,
        cause: e?.cause,
      });
    } else {
      console.debug("hf.imageSegmentation failed (data) — falling back to inputs");
    }
    // Retry with `inputs` key for older/newer SDK variations
    try {
      segments = (await hf.imageSegmentation({
        model: modelName || HF_MODEL,
        inputs: blob,
      } as any)) as HFSeg[];
    } catch (e2: any) {
      if (DEBUG) {
        console.warn("hf.imageSegmentation failed (inputs)", {
          name: e2?.name,
          message: e2?.message,
          status: e2?.status,
          cause: e2?.cause,
        });
      }
      throw new Error(`HF request failed: ${e2?.message || e?.message || String(e2)}`);
    }
  }

  if (!Array.isArray(segments) || segments.length === 0) {
    return opaquePNG(W, H); // fallback: no cut-out
  }

  if (DEBUG) {
    const labels = segments.map((s) => `${s.label || ""}:${(s.score ?? 0).toFixed(3)}`);
    console.log("HF segments (label:score)", labels);
  }

  // Zapisz etykiety do labels.json w katalogu debug (jeśli włączony)
  if (DEBUG && opts.debugDir) {
    try {
      const labelsJson = segments.map((s) => ({ label: s.label ?? null, score: s.score ?? null }));
      await fs.writeFile(path.join(opts.debugDir, "labels.json"), JSON.stringify(labelsJson, null, 2), "utf-8");
    } catch {}
  }

  const relevant = segments.filter((s) => {
    const lbl = normalizeLabel(s.label);
    const okScore = (typeof s.score === 'number' ? s.score : 1) >= hfMinScore;
    // Rozszerzone dopasowanie: ściany, okna/drzwi/szkło, obiekty przyścienne oraz sufit/podłoga
    return okScore && (isWallish(lbl) || isWindowish(lbl) || isAttachedish(lbl) || isFloorish(lbl) || isCeilingish(lbl));
  });

  if (relevant.length === 0) return opaquePNG(W, H);

  // Zbieramy osobno maski (Uint8 0/255)
  const wallCombined = new Uint8ClampedArray(W * H);
  const windowCombined = new Uint8ClampedArray(W * H);
  const attachedCombined = new Uint8ClampedArray(W * H);
  const floorCombined = new Uint8ClampedArray(W * H);
  const ceilingCombined = new Uint8ClampedArray(W * H);
  // Prepare debug directory
  const debugDir = DEBUG
    ? (opts.debugDir || path.join(process.cwd(), ".next", "cache", "seg-debug", Date.now().toString()))
    : null;
  if (DEBUG && debugDir) {
    try { await fs.mkdir(debugDir, { recursive: true }); } catch {}
  }

  let idx = 0;
  for (const seg of relevant) {
    const maskBuf = await maskToBuffer(seg.mask);
    if (!maskBuf) continue;
    // Save raw mask if debugging
    if (DEBUG && debugDir) {
      try { await fs.writeFile(path.join(debugDir, `mask_raw_${idx}_${(seg.label||"unknown").toString().toLowerCase()}.png`), maskBuf); } catch {}
    }

    // Decode mask: resize with nearest neighbor; inspect alpha variability and fallback to luminance if alpha is flat
    const resizedRGBA = await sharp(maskBuf)
      .resize({ width: W, height: H, fit: "fill", kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rgba = resizedRGBA.data; // Uint8Array length = W*H*4
    const channelsRGBA = resizedRGBA.info.channels || 4;
    let useAlpha = channelsRGBA >= 4;

    // Compute alpha stats
    let aMin = 255, aMax = 0;
    if (useAlpha) {
      for (let i = 3; i < rgba.length; i += channelsRGBA) {
        const a = rgba[i];
        if (a < aMin) aMin = a;
        if (a > aMax) aMax = a;
      }
      // If alpha has no variation (e.g., always 255), fall back to luminance from RGB
      if (aMax - aMin < 5) {
        useAlpha = false;
      }
    }

    // Heuristic: detect color-encoded masks (non-black on black background)
    // Sample colors to avoid building a huge histogram
    let colorMaskDetected = false;
    let nonBlackCount = 0, blackCount = 0;
    const sampleStep = Math.max(1, Math.floor(Math.sqrt((W * H) / 5000))); // ~5k samples
    for (let y = 0; y < H; y += sampleStep) {
      for (let x = 0; x < W; x += sampleStep) {
        const base = (y * W + x) * channelsRGBA;
        const r = rgba[base], g = rgba[base + 1], b = rgba[base + 2];
        if (r === 0 && g === 0 && b === 0) blackCount++; else nonBlackCount++;
      }
    }
    if (nonBlackCount > 0 && nonBlackCount / (nonBlackCount + blackCount) < 0.5) {
      // Dominant background is black with sparse colored region(s)
      colorMaskDetected = true;
    }

    let data: Uint8Array;
    let chosen: 'alpha' | 'luma' | 'colorMask' = 'alpha';
    if (colorMaskDetected) {
      chosen = 'colorMask';
      data = new Uint8Array(W * H);
      for (let i = 0, j = 0; i < rgba.length; i += channelsRGBA, j++) {
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        data[j] = (r | g | b) === 0 ? 0 : 255;
      }
    } else if (useAlpha) {
      data = new Uint8Array(W * H);
      for (let i = 0, j = 0; i < rgba.length; i += channelsRGBA, j++) {
        data[j] = rgba[i + 3];
      }
    } else {
      chosen = 'luma';
      // Luminance from RGB (Rec. 601): Y = 0.299 R + 0.587 G + 0.114 B
      data = new Uint8Array(W * H);
      for (let i = 0, j = 0; i < rgba.length; i += channelsRGBA, j++) {
        const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        data[j] = Math.max(0, Math.min(255, Math.round(0.299 * r + 0.587 * g + 0.114 * b)));
      }
    }
    if (DEBUG && debugDir) {
      // Compute stats
      let min = 255, max = 0, sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = data[i];
        if (v < min) min = v;
        if (v > max) max = v;
        sum += v;
      }
      const mean = sum / data.length;
      if (DEBUG) console.log(`mask stats [${idx}] label=${seg.label} chosen=${chosen} alphaRange=${aMin}-${aMax} colorMaskDetected=${colorMaskDetected} sampleStep=${sampleStep} WxH=${W}x${H} min=${min} max=${max} mean=${mean.toFixed(2)}`);
      // Save resized-raw as png for quick look
      try {
        // Save the RGBA preview used for analysis and the chosen single-channel map
        const rgbaPng = await sharp(Buffer.from(rgba), { raw: { width: W, height: H, channels: channelsRGBA } }).png().toBuffer();
        await fs.writeFile(path.join(debugDir, `mask_resized_rgba_${idx}_${(seg.label||"unknown").toString().toLowerCase()}.png`), rgbaPng);
        const dbg = await sharp(Buffer.from(data), { raw: { width: W, height: H, channels: 1 } })
          .png()
          .toBuffer();
        await fs.writeFile(path.join(debugDir, `mask_resized_${idx}_${(seg.label||"unknown").toString().toLowerCase()}.png`), dbg);
        // Also save alpha-only for comparison
        if (channelsRGBA >= 4) {
          const alphaOnly = new Uint8Array(W * H);
          for (let i = 0, j = 0; i < rgba.length; i += channelsRGBA, j++) alphaOnly[j] = rgba[i + 3];
          const alphaPng = await sharp(Buffer.from(alphaOnly), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
          await fs.writeFile(path.join(debugDir, `mask_resized_alpha_${idx}_${(seg.label||"unknown").toString().toLowerCase()}.png`), alphaPng);
        }
      } catch {}
    }
    const label = String(seg.label || "").toLowerCase();
    const isWall = label.includes("wall");
    // Rozszerzone aliasy okien/drzwi (w tym pionowe/balkonowe)
    const isWindow = (
      label.includes("window") ||
      label.includes("windowpane") ||
      label.includes("glass") ||
      label.includes("bay window") ||
      label.includes("sliding door") ||
      label.includes("french door") ||
      label.includes("patio door") ||
      label.includes("balcony door") ||
      label.includes("balcony window") ||
      label.includes("door") // ogólne drzwi (często dla balkonowych)
    );
    // Obiekty zwykle na ścianie (łączone warunkowo w kolejnych krokach)
    const isAttached = (
      label.includes("plant") ||
      label.includes("plants") ||
      label.includes("leaves") ||
      label.includes("leaf") ||
      label.includes("leafs") ||
      label.includes("pot") ||
      label.includes("pots") ||
      label.includes("book") ||
      label.includes("pots") ||
      label.includes("bookshelf") ||
      label.includes("board game") ||
      label.includes("pots") ||
      label.includes("box") ||
      label.includes("boxes") ||
      label.includes("bookshelves") ||
      label.includes("bookcase") ||
      label.includes("bookcases") || 
      label.includes("painting") ||
      label.includes("paintings") ||
      label.includes("picture") ||
      label.includes("pictures") ||
      label.includes("poster") ||
      label.includes("posters") ||
      label.includes("frame") ||
      label.includes("frames") ||
      label.includes("mirror") ||
      label.includes("mirrors") ||
      label.includes("shelf") ||
      label.includes("radiator") ||
      label.includes("heater") ||
      label.includes("sconce") ||
      label.includes("socket") ||
      label.includes("switch") ||
      label.includes("curtain") ||
      label.includes("curtains") ||
      label.includes("drape") ||
      label.includes("drapery") ||
      label.includes("blinds") ||
      label.includes("shade") ||
      label.includes("roller blind") ||
      label.includes("venetian blind") ||
      label.includes("rod") ||
      label.includes("hanger") ||
      label.includes("air conditioner") ||
      label.includes("vent") ||
      label.includes("outlet") ||
      label.includes("skirting") ||
      label.includes("baseboard") ||
      label.includes("molding") ||
      label.includes("wainscoting") ||
      label.includes("tv") ||
      label.includes("board")
    );
    const isFloor = label.includes("floor");
    const isCeiling = label.includes("ceiling");
    for (let i = 0; i < W * H; i++) {
      if (data[i] >= threshold * 255) {
        if (isWall) wallCombined[i] = 255; // tylko ściany do maski ściany
        if (isWindow) windowCombined[i] = 255;
        if (isAttached) attachedCombined[i] = 255;
        if (isFloor) floorCombined[i] = 255;
        if (isCeiling) ceilingCombined[i] = 255;
      }
    }
    idx++;
  }
  
  // Dylacja okien skalowana rozmiarem obrazu (ok. 0.4% krótszego boku)
  {
    const base = Math.min(W, H);
    const r = Math.max(1, Math.round(base * 0.004));
    const winDil = dilateBinary(windowCombined, W, H, r);
    for (let i = 0; i < W * H; i++) windowCombined[i] = winDil[i];
  }

  // RAW tryb: zwróć surową unię (wall ∪ window) bez heurystyk i zapisz debugowe pliki
  if (opts.raw) {
    const rawUnion = new Uint8ClampedArray(W * H);
    for (let i = 0; i < W * H; i++) {
      if (wallCombined[i] || windowCombined[i]) rawUnion[i] = 255;
    }
    if (DEBUG && opts.debugDir) {
      try {
        const wallPng = await sharp(Buffer.from(wallCombined), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
        await fs.writeFile(path.join(opts.debugDir, `raw_wall.png`), wallPng);
        const winPng = await sharp(Buffer.from(windowCombined), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
        await fs.writeFile(path.join(opts.debugDir, `raw_window.png`), winPng);
        const unionPng = await sharp(Buffer.from(rawUnion), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
        await fs.writeFile(path.join(opts.debugDir, `raw_union.png`), unionPng);
      } catch {}
    }
    // Zbuduj obraz RGBA, w którym czarne=widoczne (alpha 255), białe (mask)=wycięte (alpha 0)
    const rgba = Buffer.alloc(W * H * 4, 255);
    for (let i = 0; i < W * H; i++) {
      const a = rawUnion[i] > 0 ? 0 : 255;
      rgba[i * 4 + 3] = a;
    }
    return sharp(Buffer.from(rgba), { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  }

  // Proste oczyszczenie: odetnij sufit i podłogę od ściany
  const morphStrength = threshold < 0.25 ? 1 : threshold < 0.6 ? 2 : 3;
  const floorDil = dilateBinary(floorCombined, W, H, morphStrength);
  const ceilDil = dilateBinary(ceilingCombined, W, H, morphStrength);
  for (let i = 0; i < W * H; i++) {
    if (floorDil[i] || ceilDil[i]) wallCombined[i] = 0;
  }

  // --- Heurystyka wyboru przeciwległej ściany ---
  // 1) komponenty spójne na masce ścian
  const { labels: wallLabels, comps } = labelComponents(wallCombined, W, H);
  if (DEBUG && debugDir) {
    try {
      const wallPre = await sharp(Buffer.from(wallCombined), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
      await fs.writeFile(path.join(debugDir, `wall_combined.png`), wallPre);
      const winPre = await sharp(Buffer.from(windowCombined), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
      await fs.writeFile(path.join(debugDir, `windows_combined.png`), winPre);
    } catch {}
  }

  // 2) scoring komponentów: centralność + rozmiar + kształt (+łagodne kary za krawędzie)
  const cx = W / 2, cy = H / 2, diag = Math.hypot(cx, cy);
  let bestIdx = -1, bestScore = -Infinity;
  // Minimalny próg pola komponentu: zaczynamy od 0.5%, w razie braku dopasowań spadamy do 0.2%
  let minFrac = 0.005;
  for (let pass = 0; pass < 2 && bestIdx < 0; pass++) {
    const effMinFrac = (typeof minAreaPctOpt === 'number') ? minAreaPctOpt : minFrac;
    const minArea = Math.max(1, Math.floor(effMinFrac * W * H));
    const maxArea = (typeof maxAreaPctOpt === 'number') ? Math.max(1, Math.floor(maxAreaPctOpt * W * H)) : Infinity;
    for (let k = 0; k < comps.length; k++) {
      const c = comps[k];
      if (c.area < minArea) continue;
      if (c.area > maxArea) continue;
      const centerDist = Math.hypot(c.cx - cx, c.cy - cy) / diag; // 0..1
      const centrality = 1 - centerDist; // 1 najlepsze
      const areaNorm = c.area / (W * H); // preferuj duże
      const w = c.maxX - c.minX + 1, h = c.maxY - c.minY + 1;
      const aspect = w > h ? h / w : w / h; // 0..1 (1 bardziej "kwadratowe")
      const compact = c.perimeter > 0 ? (4 * Math.PI * c.area) / (c.perimeter * c.perimeter) : 0; // 0..1
      // Łagodna kara za dotykanie krawędzi (ściany boczne/sufit/podłoga)
      const edgeBandX = Math.max(2, Math.floor(0.02 * W));
      const edgeBandY = Math.max(2, Math.floor(0.03 * H));
      const touchesLeft = c.minX <= edgeBandX ? 1 : 0;
      const touchesRight = c.maxX >= W - 1 - edgeBandX ? 1 : 0;
      const touchesTop = c.minY <= edgeBandY ? 1 : 0;
      const touchesBottom = c.maxY >= H - 1 - edgeBandY ? 1 : 0;
      const edgePenalty = 0.4 * (touchesLeft + touchesRight) + 0.6 * (touchesTop + touchesBottom);
      // Kara za bardzo "wysmukłe" kształty (większy nacisk na prostokątną ścianę)
      const tallPenalty = aspect < 0.3 ? (0.3 - aspect) * 1.0 : 0;
      // Wagi dobrane zachowawczo
      const score = centrality * 1.2 + areaNorm * 3.2 + aspect * 0.6 + compact * 0.4 - edgePenalty - tallPenalty;
      if (score > bestScore) { bestScore = score; bestIdx = k; }
    }
    if (typeof minAreaPctOpt !== 'number') {
      minFrac = 0.002; // poluzuj próg i spróbuj ponownie, jeśli nic nie wybrano (gdy brak twardej konfiguracji)
    }
  }

  // 3) budujemy maskę wybranej ściany
  let wallSelected = new Uint8ClampedArray(W * H);
  if (bestIdx >= 0) {
    for (let i = 0; i < W * H; i++) {
      if (wallLabels[i] === bestIdx + 1) wallSelected[i] = 255;
    }
  }
  // Lekkie domknięcie, by wypełnić drobne szczeliny w konturze ściany
  if (bestIdx >= 0) {
    wallSelected = closeBinary(wallSelected, W, H, Math.max(1, morphStrength - 1));
  }

  // 4) dylatacja ściany (siła zależna od suwaka)
  const wallDilated = dilateBinary(wallSelected, W, H, morphStrength);

  // 5) dołącz okna: komponenty okienne, które stykają się z poszerzoną ścianą (attach całych komponentów)
  let windowsOnWall = new Uint8ClampedArray(W * H);
  {
    const { labels: winLabels, comps: winComps } = labelComponents(windowCombined, W, H);
    // Dodatkowa 1px dylacja tylko na potrzeby testu kontaktu, żeby zniwelować mikroszczeliny
    const wallContact = dilateBinary(wallDilated, W, H, 1);
    const idxOf = (x: number, y: number) => y * W + x;
    const touchesWall: boolean[] = new Array(winComps.length).fill(false);
    // Sprawdź kontakt każdego komponentu okiennego z wallDilated w jego bbox
    for (let k = 0; k < winComps.length; k++) {
      const c = winComps[k];
      let touch = false;
      for (let y = c.minY; y <= c.maxY && !touch; y++) {
        for (let x = c.minX; x <= c.maxX; x++) {
          const i = idxOf(x, y);
          if (winLabels[i] === k + 1 && wallContact[i]) { touch = true; break; }
        }
      }
      touchesWall[k] = touch;
    }
    // Dołącz CAŁY komponent, jeśli styka się ze ścianą
    for (let i = 0; i < winLabels.length; i++) {
      const lab = winLabels[i];
      if (lab !== 0 && touchesWall[lab - 1]) windowsOnWall[i] = 255;
    }
  }
  // Lekki opening na oknach, żeby usunąć drobne wyspy
  if (threshold >= 0) { // warunek pozorny, tylko by uniknąć unused vars w niektórych bundlach
    const winE = erodeBinary(windowsOnWall, W, H, 1);
    windowsOnWall = dilateBinary(winE, W, H, 1);
  }

  // 5b) dołącz obiekty przyścienne (np. zasłony) tylko jeśli stykają się ze ścianą/oknem – w całości jako komponenty
  let attachedOnWall = new Uint8ClampedArray(W * H);
  {
    const { labels: attLabels, comps: attComps } = labelComponents(attachedCombined, W, H);
    // Kontakt liczony względem poszerzonej ściany ORAZ okien na ścianie – zasłony często dotykają ramy/okna
    const contactBase = new Uint8ClampedArray(W * H);
    for (let i = 0; i < W * H; i++) if (wallDilated[i] || windowsOnWall[i]) contactBase[i] = 255;
    // Anizotropowa dylatacja kontaktu (opcjonalna): poszerz głównie w poziomie, by lepiej łapać zasłony/półki
    const rx = Math.max(1, morphStrength + 2);
    const ry = Math.max(1, Math.floor((morphStrength + 1) / 2));
    const contactArea = CONTACT_ANISO
      ? dilateBinaryAniso(contactBase, W, H, rx, ry)
      : dilateBinary(contactBase, W, H, Math.max(1, morphStrength + 1));
    const touchesWallA: boolean[] = new Array(attComps.length).fill(false);
    const idxOf = (x: number, y: number) => y * W + x;
    for (let k = 0; k < attComps.length; k++) {
      const c = attComps[k];
      let contactPixels = 0;
      for (let y = c.minY; y <= c.maxY; y++) {
        for (let x = c.minX; x <= c.maxX; x++) {
          const i = idxOf(x, y);
          if (attLabels[i] === k + 1 && contactArea[i]) contactPixels++;
        }
      }
      const frac = c.area > 0 ? contactPixels / c.area : 0;
      touchesWallA[k] = frac >= ATTACH_CONTACT_PCT;
    }
    if (DEBUG && debugDir) {
      try {
        await sharp(contactArea, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(debugDir!, 'contact_area.png'));
      } catch {}
    }
    for (let i = 0; i < attLabels.length; i++) {
      const lab = attLabels[i];
      if (lab !== 0 && touchesWallA[lab - 1]) attachedOnWall[i] = 255;
    }
  }

  // 6) finalna maska: ściana + okna-na-ścianie, ograniczona do wsparcia modelu (support)
  const modelSupport = new Uint8ClampedArray(W * H);
  for (let i = 0; i < W * H; i++) {
    // WAŻNE: uwzględnij też attachedCombined – inaczej zasłony/kaloryfery/półki będą odrzucane jako "bez wsparcia modelu"
    if (wallCombined[i] || windowCombined[i] || attachedCombined[i]) modelSupport[i] = 255;
  }
  const modelSupportDil = dilateBinary(modelSupport, W, H, 3);
  const BYPASS_SUPPORT = (process.env.SEG_BYPASS_SUPPORT === '1' || process.env.SEG_BYPASS_SUPPORT === 'true');
  const finalCombined = new Uint8ClampedArray(W * H);
  // Wyklucz z propozycji piksele należące do obiektów przyściennych, które NIE mają styku (plamy po półkach/roślinach)
  const detached = new Uint8ClampedArray(W * H);
  for (let i = 0; i < W * H; i++) if (attachedCombined[i] && !attachedOnWall[i]) detached[i] = 255;
  // Propozycja (przed gatingiem i czyszczeniem) – do podglądu
  const proposalUnion = new Uint8ClampedArray(W * H);
  for (let i = 0; i < W * H; i++) {
    const wallSansDetached = wallSelected[i] && !detached[i] ? 255 : 0;
    const proposal = wallSansDetached || windowsOnWall[i] || attachedOnWall[i];
    if (proposal) proposalUnion[i] = 255;
    if (proposal && (BYPASS_SUPPORT || modelSupportDil[i])) finalCombined[i] = 255;
  }
  if (DEBUG && debugDir) {
    try {
      await sharp(proposalUnion, { raw: { width: W, height: H, channels: 1 } })
        .png().toFile(path.join(debugDir!, 'proposal_union.png'));
    } catch {}
  }
  if (DEBUG && debugDir) {
    try {
      await sharp(modelSupport, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(debugDir!, 'model_support.png'));
      await sharp(modelSupportDil, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(debugDir!, 'model_support_dil.png'));
    } catch {}
  }
  if (DEBUG && debugDir) {
    // zapisz pola pomocnicze do diagnozy styku
    const toPNG = async (arr: Uint8ClampedArray, name: string) => {
      await sharp(arr, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(debugDir!, name));
    };
    try {
      await toPNG(detached, 'attached_detached.png');
    } catch {}
  }
  // Usuwanie małych wysp (0.2% obrazu) – proste czyszczenie Fazy 0
  const minArea = Math.max(1, Math.floor(0.002 * W * H));
  if (DEBUG && debugDir) {
    try {
      await sharp(finalCombined, { raw: { width: W, height: H, channels: 1 } })
        .png().toFile(path.join(debugDir!, 'final_combined_preclean.png'));
    } catch {}
  }
  const finalClean = removeSmallComponents(finalCombined, W, H, minArea);
  if (DEBUG && debugDir) {
    try {
      await sharp(finalClean, { raw: { width: W, height: H, channels: 1 } })
        .png().toFile(path.join(debugDir!, 'final_combined_postclean.png'));
    } catch {}
  }
  if (DEBUG && debugDir) {
    try {
      await sharp(finalClean, { raw: { width: W, height: H, channels: 1 } })
        .png().toFile(path.join(debugDir!, 'combined_pre_smooth.png'));
    } catch {}
  }

  // 7) Finalna maska: domyślnie BEZ wygładzania medianą (unika artefaktów). Można włączyć przez SEG_SMOOTH=1
  const APPLY_SMOOTH = (process.env.SEG_SMOOTH === '1' || process.env.SEG_SMOOTH === 'true');
  let outputMask: Buffer = Buffer.from(finalClean);
  if (APPLY_SMOOTH) {
    // Bezpieczny nieparzysty rozmiar jądra co najmniej 3
    const k = Math.max(3, Math.floor((morphStrength * 2 - 1) / 2) * 2 + 1);
    try {
      outputMask = await sharp(finalClean, { raw: { width: W, height: H, channels: 1 } })
        .median(k)
        .threshold(128)
        .raw()
        .toBuffer();
    } catch {
      // fallback bez smoothingu
      outputMask = Buffer.from(finalClean);
    }
  }
  if (DEBUG && debugDir) {
    try {
      await sharp(outputMask, { raw: { width: W, height: H, channels: 1 } })
        .png().toFile(path.join(debugDir!, 'final_mask.png'));
      await sharp(outputMask, { raw: { width: W, height: H, channels: 1 } })
        .png().toFile(path.join(debugDir!, 'combined_post.png'));
    } catch {}
  }

  if (DEBUG && debugDir) {
    try {
      const wsel = await sharp(Buffer.from(wallSelected), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
      await fs.writeFile(path.join(debugDir, `wall_selected.png`), wsel);
      const wdel = await sharp(Buffer.from(wallDilated), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
      await fs.writeFile(path.join(debugDir, `wall_selected_dilated.png`), wdel);
      const winSel = await sharp(Buffer.from(windowsOnWall), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
      await fs.writeFile(path.join(debugDir, `windows_on_wall.png`), winSel);
      const attSel = await sharp(Buffer.from(attachedOnWall), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
      await fs.writeFile(path.join(debugDir, `attached_on_wall.png`), attSel);
      const pre = await sharp(Buffer.from(finalCombined), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
      await fs.writeFile(path.join(debugDir, `combined_pre.png`), pre);
      const cleaned = await sharp(Buffer.from(finalClean), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
      await fs.writeFile(path.join(debugDir, `combined_cleaned.png`), cleaned);
      const supportImg = await sharp(Buffer.from(modelSupportDil), { raw: { width: W, height: H, channels: 1 } }).png().toBuffer();
      await fs.writeFile(path.join(debugDir, `model_support.png`), supportImg);
      // combined_post i final_mask zostały już zapisane wyżej jako 1-kanałowe binarki
    } catch {}
  }

  // Build RGBA with alpha inverted: mask -> alpha 0 (transparent), others 255
  const rgba = Buffer.alloc(W * H * 4, 255);
  for (let i = 0; i < W * H; i++) {
    const a = outputMask[i] > 0 ? 0 : 255;
    rgba[i * 4 + 3] = a;
  }

  return sharp(Buffer.from(rgba), { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

async function maskToBuffer(mask?: Blob | string): Promise<Buffer | null> {
  if (!mask) return null;
  // Handle base64 data URL string
  if (typeof mask === "string") {
    const m = mask.match(/^data:image\/(png|webp|jpeg);base64,(.+)$/);
    if (m) return Buffer.from(m[2], "base64");
    // Some providers may return raw base64 without data URL; try to decode
    try {
      // If not valid base64, this will throw and we'll fall through to null
      return Buffer.from(mask, "base64");
    } catch {
      return null;
    }
  }

  // Node environments may return Buffer / Uint8Array / ArrayBuffer instead of Blob
  // Buffer
  // @ts-ignore - runtime check
  if (typeof Buffer !== "undefined" && Buffer.isBuffer && Buffer.isBuffer(mask)) {
    // @ts-ignore - mask is Buffer at runtime
    return mask as unknown as Buffer;
  }

  // Uint8Array or other typed arrays
  if (ArrayBuffer.isView(mask as any)) {
    return Buffer.from((mask as unknown as Uint8Array).buffer);
  }

  // Plain ArrayBuffer
  if ((mask as any) instanceof ArrayBuffer) {
    return Buffer.from(mask as unknown as ArrayBuffer);
  }

  // Blob (browser-like)
  if (typeof (mask as any).arrayBuffer === "function") {
    const ab = await (mask as any).arrayBuffer();
    return Buffer.from(ab);
  }

  return null;
}

function opaquePNG(w: number, h: number): Promise<Buffer> {
  const buf = Buffer.alloc(w * h * 4, 255);
  // dynamiczny import bez await, aby zachować sygnaturę Promise<Buffer>
  return import('sharp').then((m) => m.default(buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer());
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// --- Heurystyki: komponenty spójne i prosta dylatacja ---
type ComponentStats = {
  area: number;
  minX: number; minY: number; maxX: number; maxY: number;
  cx: number; cy: number;
  perimeter: number;
};

function labelComponents<T extends ArrayBufferLike>(mask: Uint8ClampedArray<T>, W: number, H: number): { labels: Uint32Array; comps: ComponentStats[] } {
  const labels = new Uint32Array(W * H);
  const comps: ComponentStats[] = [];
  let current = 0;

  const qx = new Int32Array(W * H);
  const qy = new Int32Array(W * H);

  const idx = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (mask[i] === 0 || labels[i] !== 0) continue;
      // BFS
      current++;
      let head = 0, tail = 0;
      qx[tail] = x; qy[tail] = y; tail++;
      labels[i] = current;

      let area = 0;
      let minX = x, maxX = x, minY = y, maxY = y;
      let sumX = 0, sumY = 0;
      let perimeter = 0;

      while (head < tail) {
        const cx0 = qx[head], cy0 = qy[head]; head++;
        const ii = idx(cx0, cy0);
        area++;
        sumX += cx0; sumY += cy0;
        if (cx0 < minX) minX = cx0; if (cx0 > maxX) maxX = cx0;
        if (cy0 < minY) minY = cy0; if (cy0 > maxY) maxY = cy0;

        // Perimeter: count edges touching background (4-neigh)
        const n4 = [ [1,0], [-1,0], [0,1], [0,-1] ];
        for (const [dx, dy] of n4) {
          const nx = cx0 + dx, ny = cy0 + dy;
          if (!inb(nx, ny) || mask[idx(nx, ny)] === 0) perimeter++;
        }

        // Expand to neighbors (4-neigh)
        for (const [dx, dy] of n4) {
          const nx = cx0 + dx, ny = cy0 + dy;
          if (!inb(nx, ny)) continue;
          const ni = idx(nx, ny);
          if (mask[ni] === 0 || labels[ni] !== 0) continue;
          labels[ni] = current;
          qx[tail] = nx; qy[tail] = ny; tail++;
        }
      }

      const cx = area > 0 ? sumX / area : 0;
      const cy = area > 0 ? sumY / area : 0;
      comps.push({ area, minX, minY, maxX, maxY, cx, cy, perimeter });
    }
  }

  return { labels, comps };
}

function dilateBinary<T extends ArrayBufferLike>(
  src: Uint8ClampedArray<T>,
  W: number,
  H: number,
  radius: number
): Uint8ClampedArray<T> {
  const dst = new Uint8ClampedArray(W * H) as Uint8ClampedArray<T>;
  const r = Math.max(0, Math.floor(radius));
  if (r === 0) return new Uint8ClampedArray(src) as Uint8ClampedArray<T>;
  const idx = (x: number, y: number) => y * W + x;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let on = 0;
      for (let dy = -r; dy <= r && !on; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= H) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= W) continue;
          if (src[idx(xx, yy)]) { on = 1; break; }
        }
      }
      if (on) dst[idx(x, y)] = 255;
    }
  }
  return dst as Uint8ClampedArray<T>;
}

// Prostokątna dylatacja (anizotropowa) dla opcji kontaktu
function dilateBinaryAniso<T extends ArrayBufferLike>(
  src: Uint8ClampedArray<T>,
  W: number,
  H: number,
  rx: number,
  ry: number
): Uint8ClampedArray<T> {
  const dst = new Uint8ClampedArray(W * H) as Uint8ClampedArray<T>;
  const rxi = Math.max(0, Math.floor(rx));
  const ryi = Math.max(0, Math.floor(ry));
  if (rxi === 0 && ryi === 0) return new Uint8ClampedArray(src) as Uint8ClampedArray<T>;
  const idx = (x: number, y: number) => y * W + x;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let on = 0;
      for (let dy = -ryi; dy <= ryi && !on; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= H) continue;
        for (let dx = -rxi; dx <= rxi; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= W) continue;
          if (src[idx(xx, yy)]) { on = 1; break; }
        }
      }
      if (on) dst[idx(x, y)] = 255;
    }
  }
  return dst as Uint8ClampedArray<T>;
}

function erodeBinary<T extends ArrayBufferLike>(
  src: Uint8ClampedArray<T>,
  W: number,
  H: number,
  radius: number
): Uint8ClampedArray<T> {
  const dst = new Uint8ClampedArray(W * H) as Uint8ClampedArray<T>;
  const r = Math.max(0, Math.floor(radius));
  if (r === 0) return new Uint8ClampedArray(src) as Uint8ClampedArray<T>;
  const idx = (x: number, y: number) => y * W + x;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let keep = 1;
      for (let dy = -r; dy <= r && keep; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= H) { keep = 0; break; }
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= W) { keep = 0; break; }
          if (!src[idx(xx, yy)]) { keep = 0; break; }
        }
      }
      if (keep) dst[idx(x, y)] = 255;
    }
  }
  return dst;
}

function closeBinary<T extends ArrayBufferLike>(
  src: Uint8ClampedArray<T>,
  W: number,
  H: number,
  radius: number
): Uint8ClampedArray<T> {
  if (radius <= 0) return new Uint8ClampedArray(src) as Uint8ClampedArray<T>;
  // Domknięcie = DYLATACJA -> EROZJA
  const di = dilateBinary(src, W, H, radius);
  return erodeBinary(di, W, H, radius);
}

function removeSmallComponents<T extends ArrayBufferLike>(
  src: Uint8ClampedArray<T>,
  W: number,
  H: number,
  minArea: number
): Uint8ClampedArray<T> {
  if (minArea <= 1) return new Uint8ClampedArray(src) as Uint8ClampedArray<T>;
  const { labels, comps } = labelComponents(src, W, H);
  const dst = new Uint8ClampedArray(W * H) as Uint8ClampedArray<T>;
  const keep = new Array(comps.length).fill(false);
  for (let k = 0; k < comps.length; k++) {
    if (comps[k].area >= minArea) keep[k] = true;
  }
  for (let i = 0; i < labels.length; i++) {
    const lab = labels[i];
    if (lab !== 0 && keep[lab - 1]) dst[i] = 255;
  }
  return dst as Uint8ClampedArray<T>;
}

// Wypełnij małe "dziury" (komponenty tła zamknięte w środku maski),
// pozostawiając komponenty tła dotykające krawędzi obrazu oraz duże obszary
// nienaruszone. Działa na maskach binarnych (0/255).
function fillSmallHoles<T extends ArrayBufferLike>(
  src: Uint8ClampedArray<T>,
  W: number,
  H: number,
  maxHoleArea: number
): { filled: Uint8ClampedArray<T>; holes: Uint8ClampedArray<T> } {
  // Inwersja: tło -> 255, maska -> 0
  const inv = new Uint8ClampedArray(W * H) as Uint8ClampedArray<T>;
  for (let i = 0; i < W * H; i++) inv[i] = src[i] ? 0 : 255;

  const { labels, comps } = labelComponents(inv, W, H);
  const fill = new Array(comps.length).fill(false);
  for (let k = 0; k < comps.length; k++) {
    const c = comps[k];
    const touchesBorder = (c.minX === 0 || c.minY === 0 || c.maxX === W - 1 || c.maxY === H - 1);
    if (!touchesBorder && c.area <= Math.max(1, maxHoleArea)) fill[k] = true;
  }
  const out = new Uint8ClampedArray(src) as Uint8ClampedArray<T>;
  const holesMask = new Uint8ClampedArray(W * H) as Uint8ClampedArray<T>;
  for (let i = 0; i < labels.length; i++) {
    const lab = labels[i];
    if (lab !== 0 && fill[lab - 1]) { out[i] = 255; holesMask[i] = 255; }
  }
  return { filled: out as Uint8ClampedArray<T>, holes: holesMask as Uint8ClampedArray<T> };
}

async function resizeMask<T extends ArrayBufferLike>(
  src: Uint8ClampedArray<T>,
  W: number,
  H: number,
  WW: number,
  HH: number
): Promise<Uint8ClampedArray<T>> {
  if (W === WW && H === HH) return new Uint8ClampedArray(src) as Uint8ClampedArray<T>;
  const sharpMod = (await import('sharp')).default;
  const buf = await sharpMod(Buffer.from(src), { raw: { width: W, height: H, channels: 1 } })
    .resize({ width: WW, height: HH, kernel: sharpMod.kernel.nearest })
    .raw()
    .toBuffer();
  return new Uint8ClampedArray(buf) as Uint8ClampedArray<T>;
}
