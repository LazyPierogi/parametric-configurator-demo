const DB_NAME = 'cw-segment-cache';
const DB_VERSION = 1;
const STORE_NAME = 'segments';
export const MAX_CACHE_BYTES = 25 * 1024 * 1024; // 25 MB cap for cached masks + photos
type FlowMode = 'legacy' | 'new';

export type CachedMeasurement = {
  wallWidthCm: number;
  wallHeightCm: number;
  provider: 'googleai' | 'openai' | 'qwen' | 'localcv' | 'noreref';
  model: string;
  elapsedMs?: number;
  confidencePct?: number | null;
  warnings?: string[] | null;
  usedFallback?: boolean;
  fallbackProvider?: string | null;
};

export type SegmentCacheRecord = {
  key: string;
  createdAt: number;
  elapsedMs: number;
  photo: Blob;
  photoName?: string;
  mask: Blob;
  size: number;
  flowMode?: FlowMode;
  curtainPolygon?: Array<{ x: number; y: number }>;
  measurement?: CachedMeasurement;
  debugSummary?: string;
  schemaVersion?: number;
};

export type SegmentCacheWrite = {
  key: string;
  createdAt: number;
  elapsedMs: number;
  photo: Blob;
  photoName?: string;
  mask: Blob;
  flowMode?: FlowMode;
  curtainPolygon?: Array<{ x: number; y: number }>;
  measurement?: CachedMeasurement;
  debugSummary?: string;
  schemaVersion?: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) {
    return Promise.reject(new Error('IndexedDB not available'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error ?? new Error('Failed to open cache database'));
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('byCreatedAt', 'createdAt');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
    });
  }
  return dbPromise;
}

function sizeOf(record: Partial<SegmentCacheRecord>): number {
  const photoSize = record.photo instanceof Blob ? record.photo.size : 0;
  const maskSize = record.mask instanceof Blob ? record.mask.size : 0;
  if (typeof record.size === 'number') {
    return record.size;
  }
  return photoSize + maskSize;
}

function clampPolygon(points?: Array<{ x: number; y: number }> | null): Array<{ x: number; y: number }> | undefined {
  if (!points || !Array.isArray(points)) return undefined;
  return points
    .map((p) => ({
      x: Math.max(0, Math.min(1, Number(p.x))),
      y: Math.max(0, Math.min(1, Number(p.y))),
    }))
    .filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y));
}

async function listAll(db: IDBDatabase): Promise<SegmentCacheRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      resolve((req.result as SegmentCacheRecord[]) ?? []);
    };
    req.onerror = () => reject(req.error ?? new Error('Failed to load cache entries'));
  });
}

function waitTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Transaction error'));
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

async function ensureSpace(db: IDBDatabase, requiredBytes: number, quotaBytes: number): Promise<boolean> {
  const t0 = performance.now();
  
  if (requiredBytes > quotaBytes) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[segment-cache] entry exceeds quota, skipping cache', { requiredBytes, quotaBytes });
    }
    return false;
  }
  
  const all = await listAll(db);
  const t1 = performance.now();
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[segment-cache] listAll took ${Math.round(t1 - t0)}ms, found ${all.length} entries`);
  }
  
  let total = all.reduce((sum, rec) => sum + sizeOf(rec), 0);
  const t2 = performance.now();
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[segment-cache] size calculation took ${Math.round(t2 - t1)}ms, total: ${total} bytes`);
  }
  if (total + requiredBytes <= quotaBytes) {
    return true;
  }
  const sorted = all.slice().sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  let freed = 0;
  const toDelete: SegmentCacheRecord[] = [];
  for (const rec of sorted) {
    if (total + requiredBytes - freed <= quotaBytes) {
      break;
    }
    freed += sizeOf(rec);
    toDelete.push(rec);
  }
  if (total + requiredBytes - freed > quotaBytes) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[segment-cache] insufficient space even after eviction attempt', {
        requiredBytes,
        quotaBytes,
        freed
      });
    }
    return false;
  }
  if (toDelete.length === 0) {
    return true;
  }
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const rec of toDelete) {
    store.delete(rec.key);
  }
  await waitTx(tx);
  if (process.env.NODE_ENV !== 'production') {
    const evicted = toDelete.map((rec) => ({ key: rec.key, size: sizeOf(rec) }));
    const freedBytes = evicted.reduce((sum, rec) => sum + rec.size, 0);
    console.info('[segment-cache] evicted old entries', { evicted, freedBytes });
  }
  return true;
}

export async function saveSegmentToCache(entry: SegmentCacheWrite, quotaBytes: number = MAX_CACHE_BYTES): Promise<void> {
  const startTime = performance.now();
  if (!hasIndexedDb()) return;
  const db = await openDb().catch(() => null);
  if (!db) return;
  
  const record: SegmentCacheRecord = {
    ...entry,
    flowMode: entry.flowMode === 'legacy' ? 'legacy' : 'new',
    curtainPolygon: clampPolygon(entry.curtainPolygon),
    measurement: entry.measurement,
    debugSummary: entry.debugSummary,
    schemaVersion: entry.schemaVersion ?? 2,
    size: sizeOf(entry)
  };
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('[segment-cache] Starting cache save', { key: record.key, size: record.size });
  }
  
  const ok = await ensureSpace(db, record.size, quotaBytes);
  if (!ok) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[segment-cache] ensureSpace failed, skipping cache');
    }
    return;
  }
  
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(record);
  await waitTx(tx).catch((err) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[segment-cache] failed to store entry', err);
    }
  });
  
  const elapsed = Math.round(performance.now() - startTime);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[segment-cache] Cache save completed in ${elapsed}ms`);
  }
}

export async function getCachedSegment(key: string): Promise<SegmentCacheRecord | null> {
  if (!hasIndexedDb()) return null;
  const db = await openDb().catch(() => null);
  if (!db) return null;
  try {
    return await new Promise<SegmentCacheRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const value = req.result as SegmentCacheRecord | undefined;
        resolve(value ?? null);
      };
      req.onerror = () => reject(req.error ?? new Error('Failed to read cached segment'));
    });
  } catch {
    return null;
  }
}

export async function getLatestCachedSegment(): Promise<SegmentCacheRecord | null> {
  if (!hasIndexedDb()) return null;
  const db = await openDb().catch(() => null);
  if (!db) return null;
  try {
    return await new Promise<SegmentCacheRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const hasIndex = store.indexNames.contains('byCreatedAt');
      const cursorRequest = hasIndex
        ? store.index('byCreatedAt').openCursor(null, 'prev')
        : store.openCursor(null, 'prev');
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        resolve(cursor ? (cursor.value as SegmentCacheRecord) : null);
      };
      cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error('Failed to read latest cached segment'));
    });
  } catch {
    return null;
  }
}

export async function updateSegmentMetadata(
  key: string,
  patch: {
    flowMode?: FlowMode;
    curtainPolygon?: Array<{ x: number; y: number }> | null;
    measurement?: CachedMeasurement | null;
    debugSummary?: string | null;
    schemaVersion?: number;
  }
): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb().catch(() => null);
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onerror = () => reject(req.error ?? new Error('Failed to read cache entry for update'));
    req.onsuccess = () => {
      const existing = req.result as SegmentCacheRecord | undefined;
      if (!existing) {
        tx.abort();
        return resolve();
      }
      const next: SegmentCacheRecord = {
        ...existing,
        flowMode:
          patch.flowMode
            ? (patch.flowMode === 'legacy' ? 'legacy' : 'new')
            : existing.flowMode === 'legacy'
            ? 'legacy'
            : 'new',
        curtainPolygon:
          patch.curtainPolygon === undefined
            ? existing.curtainPolygon
            : clampPolygon(patch.curtainPolygon) ?? undefined,
        measurement: patch.measurement === undefined ? existing.measurement : patch.measurement ?? undefined,
        debugSummary: patch.debugSummary === undefined ? existing.debugSummary : patch.debugSummary ?? undefined,
        schemaVersion: patch.schemaVersion ?? existing.schemaVersion ?? 2,
      };
      try {
        store.put(next);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('Transaction error'));
        tx.onabort = () => resolve();
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to update cache entry'));
      }
    };
  }).catch((err) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[segment-cache] updateSegmentMetadata failed', err);
    }
  });
}

export async function clearSegmentCache(): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb().catch(() => null);
  if (!db) return;
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).clear();
  await waitTx(tx).catch(() => undefined);
}

// Convenience: derive a preferred restore record given session policy.
// The caller provides a function to read the last uploaded key (kept in sessionStorage).
export async function getPreferredRestoreRecord(
  readLastUploadedKey: () => string | null,
  opts?: { preferLastUploaded?: boolean }
): Promise<SegmentCacheRecord | null> {
  const preferLast = opts?.preferLastUploaded !== false;
  if (preferLast) {
    try {
      const k = readLastUploadedKey();
      if (k) {
        const rec = await getCachedSegment(k);
        if (rec) return rec;
      }
    } catch { /* ignore */ }
  }
  return await getLatestCachedSegment();
}
