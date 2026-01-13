import type { CurtainPolygon } from '@curtain-wizard/core/src/types/services';
import {
  buildPromptTemplate,
  sanitizeCurtainPolygon,
  summarizeCurtainPolygon,
  type PolygonSummary,
} from '@curtain-wizard/core/src/services/measurePrompt';
import { STORAGE_KEYS } from './storage-keys';

const STORAGE_KEY = STORAGE_KEYS.MEASUREMENT_OBSERVATIONS;
const MAX_ENTRIES = 40;

export type MeasurementObservationStatus = 'success' | 'error';

export type MeasurementObservation = {
  id: string;
  createdAt: number;
  status: MeasurementObservationStatus;
  flowMode: 'legacy' | 'new';
  source?: string;
  provider: string | null;
  model: string | null;
  elapsedMs?: number;
  wallWidthCm?: number;
  wallHeightCm?: number;
  confidencePct?: number;
  warnings?: string[];
  usedFallback?: boolean;
  fallbackProvider?: string | null;
  error?: string | null;
  photoKey?: string | null;
  segmentKey?: string | null;
  cacheKey?: string | null;
  polygonKey?: string | null;
  polygon?: CurtainPolygon | null;
  polygonSummary?: PolygonSummary | null;
  prompt?: string | null;
  promptHash?: string | null;
};

export type RecordMeasurementObservationInput = {
  status: MeasurementObservationStatus;
  flowMode: 'legacy' | 'new';
  provider?: string | null;
  model?: string | null;
  elapsedMs?: number;
  wallWidthCm?: number;
  wallHeightCm?: number;
  confidencePct?: number;
  warnings?: string[] | null;
  error?: string | null;
  photoKey?: string | null;
  segmentKey?: string | null;
  polygon?: Array<{ x: number; y: number }> | null;
  polygonKey?: string | null;
  source?: string;
  usedFallback?: boolean;
  fallbackProvider?: string | null;
   cacheKey?: string | null;
};

type Listener = (entries: MeasurementObservation[]) => void;

const listeners = new Set<Listener>();

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `h${(hash >>> 0).toString(16)}`;
}

function generateId(): string {
  const cryptoRef = typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  return `cw-measure-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
}

function loadEntries(): MeasurementObservation[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: any) => {
        if (!entry || typeof entry !== 'object') return null;
        return {
          id: typeof entry.id === 'string' ? entry.id : generateId(),
          createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : Date.now(),
          status: entry.status === 'error' ? 'error' : 'success',
          flowMode: entry.flowMode === 'legacy' ? 'legacy' : 'new',
          source: typeof entry.source === 'string' ? entry.source : undefined,
          provider: typeof entry.provider === 'string' ? entry.provider : null,
          model: typeof entry.model === 'string' ? entry.model : null,
          elapsedMs: typeof entry.elapsedMs === 'number' ? entry.elapsedMs : undefined,
          wallWidthCm: typeof entry.wallWidthCm === 'number' ? entry.wallWidthCm : undefined,
          wallHeightCm: typeof entry.wallHeightCm === 'number' ? entry.wallHeightCm : undefined,
          confidencePct: typeof entry.confidencePct === 'number' ? entry.confidencePct : undefined,
          warnings: Array.isArray(entry.warnings)
            ? entry.warnings.filter((w: unknown) => typeof w === 'string')
            : undefined,
          usedFallback:
            typeof entry.usedFallback === 'boolean' ? entry.usedFallback : undefined,
          fallbackProvider:
            typeof entry.fallbackProvider === 'string'
              ? entry.fallbackProvider
              : entry.fallbackProvider === null
              ? null
              : undefined,
          error: typeof entry.error === 'string' ? entry.error : undefined,
          photoKey: typeof entry.photoKey === 'string' ? entry.photoKey : undefined,
          segmentKey: typeof entry.segmentKey === 'string' ? entry.segmentKey : undefined,
          polygonKey: typeof entry.polygonKey === 'string' ? entry.polygonKey : undefined,
          polygon: Array.isArray(entry.polygon) ? entry.polygon : null,
          polygonSummary:
            entry.polygonSummary && typeof entry.polygonSummary === 'object'
              ? {
                  widthPct: Number(entry.polygonSummary.widthPct) || 0,
                  heightPct: Number(entry.polygonSummary.heightPct) || 0,
                  areaPct: Number(entry.polygonSummary.areaPct) || 0,
                }
              : null,
          prompt: typeof entry.prompt === 'string' ? entry.prompt : undefined,
          promptHash: typeof entry.promptHash === 'string' ? entry.promptHash : undefined,
        } as MeasurementObservation;
      })
      .filter((entry): entry is MeasurementObservation => !!entry)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function saveEntries(entries: MeasurementObservation[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // ignore storage errors
  }
}

function notify(entries: MeasurementObservation[]): void {
  for (const listener of listeners) {
    try {
      listener(entries);
    } catch {
      // ignore listener failures
    }
  }
}

export function getMeasurementObservations(): MeasurementObservation[] {
  return loadEntries();
}

export function recordMeasurementObservation(input: RecordMeasurementObservationInput): void {
  if (!isBrowser()) return;
  const now = Date.now();
  const sanitizedPolygon = input.polygon ? sanitizeCurtainPolygon(input.polygon) : null;
  const normalizedPolygon =
    sanitizedPolygon?.map((pt) => ({
      x: Number(pt.x.toFixed(6)),
      y: Number(pt.y.toFixed(6)),
    })) ?? null;
  const polygonSummary = sanitizedPolygon ? summarizeCurtainPolygon(sanitizedPolygon) : null;
  const prompt = sanitizedPolygon ? buildPromptTemplate(sanitizedPolygon) : null;
  const promptHash = prompt ? hashString(prompt) : null;

  const warnings = Array.isArray(input.warnings)
    ? Array.from(new Set(input.warnings.filter((w) => typeof w === 'string')))
    : undefined;

  const entry: MeasurementObservation = {
    id: generateId(),
    createdAt: now,
    status: input.status,
    flowMode: input.flowMode,
    source: input.source,
    provider: input.provider ?? null,
    model: input.model ?? null,
    elapsedMs: input.elapsedMs,
    wallWidthCm: input.wallWidthCm,
    wallHeightCm: input.wallHeightCm,
    confidencePct: input.confidencePct,
    usedFallback: input.usedFallback === true ? true : undefined,
    fallbackProvider:
      typeof input.fallbackProvider === 'string'
        ? input.fallbackProvider
        : input.fallbackProvider === null
        ? null
        : undefined,
    warnings,
    error: input.error,
    photoKey: input.photoKey,
    segmentKey: input.segmentKey,
    cacheKey: input.cacheKey,
    polygonKey:
      input.polygonKey ??
      (normalizedPolygon ? JSON.stringify(normalizedPolygon) : undefined),
    polygon: normalizedPolygon,
    polygonSummary: polygonSummary ?? null,
    prompt,
    promptHash,
  };

  const entries = [entry, ...loadEntries()].slice(0, MAX_ENTRIES);
  saveEntries(entries);
  notify(entries);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('cw:measurement-observation', { detail: entry }),
    );
  }
}

export function clearMeasurementObservations(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
  const entries: MeasurementObservation[] = [];
  notify(entries);
}

export function subscribeMeasurementObservations(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
