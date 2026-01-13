import { STORAGE_KEYS } from './storage-keys';

const STORAGE_KEY = STORAGE_KEYS.MEASUREMENT_CACHE;
const MAX_ENTRIES = 30;

type CacheStore = Record<string, MeasurementCacheEntry>;

export type MeasurementProvider = 'googleai' | 'openai' | 'qwen' | 'localcv' | 'noreref';

export type MeasurementCacheEntry = {
  key: string;
  provider: MeasurementProvider;
  model: string;
  wallWidthCm: number;
  wallHeightCm: number;
  elapsedMs?: number;
  createdAt: number;
};

function makeStoreKey(key: string, provider: MeasurementProvider, model: string): string {
  return `${key}::${provider}::${model}`;
}

function loadStore(): CacheStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const obj = parsed as Record<string, any>;
    const entries: CacheStore = {};
    for (const [k, value] of Object.entries(obj)) {
      if (!value || typeof value !== 'object') continue;
      const entry = value as MeasurementCacheEntry;
      if (typeof entry.key !== 'string' || typeof entry.provider !== 'string' || typeof entry.model !== 'string') {
        continue;
      }
      if (typeof entry.wallWidthCm !== 'number' || typeof entry.wallHeightCm !== 'number') {
        continue;
      }
      entries[k] = {
        key: entry.key,
        provider: entry.provider,
        model: entry.model,
        wallWidthCm: entry.wallWidthCm,
        wallHeightCm: entry.wallHeightCm,
        elapsedMs: typeof entry.elapsedMs === 'number' ? entry.elapsedMs : undefined,
        createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : Date.now(),
      };
    }
    return entries;
  } catch {
    return {};
  }
}

function saveStore(store: CacheStore): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors (quota/full)
  }
}

export function getMeasurementFromCache(
  key: string,
  provider: MeasurementProvider,
  model: string,
): MeasurementCacheEntry | null {
  const store = loadStore();
  const entry = store[makeStoreKey(key, provider, model)];
  if (!entry) return null;
  return entry;
}

export function saveMeasurementToCache(entry: MeasurementCacheEntry): void {
  const store = loadStore();
  const cacheKey = makeStoreKey(entry.key, entry.provider, entry.model);
  store[cacheKey] = { ...entry, createdAt: entry.createdAt ?? Date.now() };
  const allEntries = Object.entries(store)
    .map(([id, value]) => ({ id, value }))
    .sort((a, b) => (b.value.createdAt ?? 0) - (a.value.createdAt ?? 0));
  if (allEntries.length > MAX_ENTRIES) {
    for (const { id } of allEntries.slice(MAX_ENTRIES)) {
      delete store[id];
    }
  }
  saveStore(store);
}

export function clearMeasurementCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}
