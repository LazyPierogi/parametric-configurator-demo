"use client";

import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { createBrowserCompatibleUrl, isValidBlob } from '@/lib/blob-url-fallback';
import { getCachedSegment, getLatestCachedSegment, saveSegmentToCache } from '@/lib/segment-cache';
import { peekFlowState, clearFlowState, getLastUploadedKey, type FlowMeasurement } from '@/lib/flow-state';
import type { AddToCartState, TranslateFn } from '../types';

export type SegmentResult = {
  key: string;
  mask: Blob;
  elapsedMs: number;
  source: 'network' | 'cache';
  photo?: Blob;
  photoName?: string;
};

type UseCurtainFirstRestoreArgs = {
  t: TranslateFn;
  DEBUG_UI_ENABLED: boolean;
  CONFIGURE_FLOW_MODE: 'legacy' | 'new';
  USE_CURTAIN_FIRST_FLOW: boolean;
  CONFIGURE_FALLBACK_LATEST: boolean;
  BYPASS_LOCAL_CACHE: boolean;
  CACHE_QUOTA_BYTES: number;

  onCurtainFirstMissingFlow?: () => void;

  invertMaskAlpha: (srcUrl: string) => Promise<string>;

  setMaskUrl: Dispatch<SetStateAction<string | null>>;
  setWallMaskUrl: Dispatch<SetStateAction<string | null>>;
  setElapsed: Dispatch<SetStateAction<number | null>>;
  setPhase: Dispatch<SetStateAction<'idle' | 'segmenting' | 'mark' | 'ready' | 'restoring'>>;
  setProgress: Dispatch<SetStateAction<{ label: string; value: number | null } | null>>;
  setCacheNotice: Dispatch<SetStateAction<string | null>>;
  setRestoredOffline: Dispatch<SetStateAction<boolean>>;
  setPreviewUrl: Dispatch<SetStateAction<string | null>>;
  setFile: Dispatch<SetStateAction<File | null>>;
  setFileSignature: Dispatch<SetStateAction<string | null>>;
  setMarkPicks: Dispatch<SetStateAction<{ x: number; y: number }[]>>;
  setCorners: Dispatch<SetStateAction<{ x: number; y: number }[] | null>>;
  setCurtainMeasureState: Dispatch<
    SetStateAction<{ status: 'idle' | 'pending' | 'success' | 'error'; polygonKey: string | null }>
  >;
  setBaseCm: Dispatch<SetStateAction<{ w: number; h: number }>>;
  setFlowMeasurementMeta: Dispatch<SetStateAction<FlowMeasurement | null>>;
  setAddToCartState: Dispatch<SetStateAction<AddToCartState>>;
};

export function useCurtainFirstRestore({
  t,
  DEBUG_UI_ENABLED,
  CONFIGURE_FLOW_MODE,
  USE_CURTAIN_FIRST_FLOW,
  CONFIGURE_FALLBACK_LATEST,
  BYPASS_LOCAL_CACHE,
  CACHE_QUOTA_BYTES,
  onCurtainFirstMissingFlow,
  invertMaskAlpha,
  setMaskUrl,
  setWallMaskUrl,
  setElapsed,
  setPhase,
  setProgress,
  setCacheNotice,
  setRestoredOffline,
  setPreviewUrl,
  setFile,
  setFileSignature,
  setMarkPicks,
  setCorners,
  setCurtainMeasureState,
  setBaseCm,
  setFlowMeasurementMeta,
  setAddToCartState,
}: UseCurtainFirstRestoreArgs) {
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const applySegmentResult = useCallback(
    async (result: SegmentResult, options: { offline?: boolean; notify?: boolean; preservePhase?: boolean } = {}) => {
      try {
        const maskUrlResult = await createBrowserCompatibleUrl(result.mask);
        setMaskUrl(maskUrlResult.url);
        invertMaskAlpha(maskUrlResult.url).then(setWallMaskUrl).catch(() => setWallMaskUrl(null));
      } catch (error) {
        console.error('[configure] Failed to create mask URL', error);
        const fallbackUrl = URL.createObjectURL(result.mask);
        setMaskUrl(fallbackUrl);
        invertMaskAlpha(fallbackUrl).then(setWallMaskUrl).catch(() => setWallMaskUrl(null));
      }
      setElapsed(result.elapsedMs);
      if (!options.preservePhase) {
        // Default behavior: after segmentation, move into mark phase.
        // Callers can preserve phase to avoid flashing the mark UI (e.g., restore from /estimate).
        setPhase((prev) => (prev === 'restoring' ? 'restoring' : 'mark'));
      }
      setProgress(null);
      if (result.source === 'cache') {
        const offline = Boolean(options.offline);
        setCacheNotice(offline ? tRef.current('configure.cache.offlineRestored') : tRef.current('configure.cache.loaded'));
        setRestoredOffline(offline);
        if (DEBUG_UI_ENABLED && options.notify !== false) {
          toast.success(offline ? tRef.current('configure.toastLoadedOffline') : tRef.current('configure.toastLoadedCached'));
        }
      } else {
        setCacheNotice(null);
        setRestoredOffline(false);
        if (DEBUG_UI_ENABLED && options.notify !== false) {
          toast.success(tRef.current('configure.toastSegmentedElapsed', { time: result.elapsedMs.toString() }));
        }
      }
    },
    [
      DEBUG_UI_ENABLED,
      invertMaskAlpha,
      setCacheNotice,
      setElapsed,
      setMaskUrl,
      setPhase,
      setProgress,
      setRestoredOffline,
      setWallMaskUrl,
    ],
  );

  const applySegmentResultRef = useRef(applySegmentResult);
  useEffect(() => {
    applySegmentResultRef.current = applySegmentResult;
  }, [applySegmentResult]);

  const wait = useCallback((ms: number) => {
    if (typeof window === 'undefined') return Promise.resolve();
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }, []);

  const loadCachedSegmentWithRetry = useCallback(
    async (key: string | null, attempts = 3, baseDelayMs = 140) => {
      if (!key) return null;
      if (BYPASS_LOCAL_CACHE) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[configure] Cache bypass enabled; skipping local cache lookup');
        }
        return null;
      }
      const startTime = performance.now();
      if (process.env.NODE_ENV !== 'production') {
        console.log(
          `[configure] Starting cache lookup for key: ${key.substring(0, 12)}..., max attempts: ${attempts}, baseDelay: ${baseDelayMs}ms`,
        );
      }
      for (let attempt = 0; attempt < attempts; attempt++) {
        const cached = await getCachedSegment(key);
        if (cached) {
          const elapsed = Math.round(performance.now() - startTime);
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[configure] ✅ Cache hit on attempt ${attempt + 1}/${attempts} after ${elapsed}ms`);
          }
          return cached;
        }
        if (attempt < attempts - 1) {
          const delay = baseDelayMs * Math.pow(1.5, attempt);
          if (process.env.NODE_ENV !== 'production') {
            console.log(
              `[configure] ⏳ Cache miss on attempt ${attempt + 1}, waiting ${Math.round(delay)}ms before retry ${attempt + 2}/${attempts}`,
            );
          }
          await wait(delay);
        }
      }
      const totalElapsed = Math.round(performance.now() - startTime);
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[configure] ❌ Cache lookup failed after ${attempts} attempts (${totalElapsed}ms total), will fallback to re-segmentation`,
        );
      }
      return null;
    },
    [BYPASS_LOCAL_CACHE, wait],
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    (async () => {
      const flow = peekFlowState();
      const normalizePolygon = (polygon?: Array<{ x: number; y: number }> | null) => {
        if (!polygon || !Array.isArray(polygon)) return null;
        const pts = polygon
          .map((p) => ({
            x: Math.max(0, Math.min(1, Number(p.x))),
            y: Math.max(0, Math.min(1, Number(p.y))),
          }))
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
        return pts.length >= 3 ? pts : null;
      };

      const applyRestoredMeasurement = (measurement?: FlowMeasurement | null) => {
        if (!measurement) return;
        setBaseCm({ w: measurement.wallWidthCm, h: measurement.wallHeightCm });
        setFlowMeasurementMeta(measurement);
        if (measurement.elapsedMs != null) {
          setElapsed(measurement.elapsedMs);
        }
      };

      const maybeAdoptPolygon = (polygon?: Array<{ x: number; y: number }> | null, mode?: 'legacy' | 'new') => {
        const normalized = normalizePolygon(polygon);
        if (!normalized) return;
        setMarkPicks(normalized);
        setCorners(normalized);
        setCurtainMeasureState({ status: 'idle', polygonKey: null });
        if ((mode ?? CONFIGURE_FLOW_MODE) === 'new') {
          // Transition from 'mark' or 'restoring' to 'ready'
          setPhase((prev) =>
            (prev === 'mark' || prev === 'ready' || prev === 'restoring' || prev === 'segmenting') ? 'ready' : prev
          );
        }
      };

      const applyAndClearFlow = async (
        cached: any,
        clearFlow: boolean,
        meta?: {
          polygon?: Array<{ x: number; y: number }> | null;
          flowMode?: 'legacy' | 'new';
          measurement?: FlowMeasurement | null;
          preservePhase?: boolean;
        },
      ) => {
        if (cancelled) return false;

        const photoValid = await isValidBlob(cached.photo);
        const maskValid = await isValidBlob(cached.mask);
        if (!photoValid || !maskValid) {
          console.warn('[configure] Cached Blobs are invalid (Safari/iOS bug), requesting re-upload', { photoValid, maskValid });
          setProgress(null);
          setPhase('idle');
          toast.error('Cached data expired. Please upload photo again.');
          return false;
        }

        try {
          const previewUrlResult = await createBrowserCompatibleUrl(cached.photo);
          setPreviewUrl((prev) => {
            if (!prev) return previewUrlResult.url;
            if (prev.startsWith('blob:')) return previewUrlResult.url;
            return prev;
          });
        } catch (error) {
          console.error('[configure] Failed to create preview URL from cache', error);
          const fallbackUrl = URL.createObjectURL(cached.photo);
          setPreviewUrl((prev) => {
            if (!prev) return fallbackUrl;
            if (prev.startsWith('blob:')) return fallbackUrl;
            return prev;
          });
        }

        try {
          const restoredFile = new File([cached.photo], cached.photoName ?? 'cached-photo.png', {
            type: cached.photo.type || 'image/png',
            lastModified: cached.createdAt,
          });
          setFile(restoredFile);
        } catch {
          setFile(null);
        }

        const preservePhase = Boolean(meta?.preservePhase);
        await applySegmentResultRef.current(
          {
            key: cached.key,
            mask: cached.mask,
            elapsedMs: cached.elapsedMs,
            source: 'cache',
            photo: cached.photo,
            photoName: cached.photoName,
          },
          { offline: !navigator.onLine, notify: false, preservePhase },
        );

        if (meta?.measurement) {
          applyRestoredMeasurement(meta.measurement);
        }
        maybeAdoptPolygon(meta?.polygon, meta?.flowMode);
        if (clearFlow) {
          clearFlowState();
        }
        return true;
      };

      if (flow && !cancelled) {
        applyRestoredMeasurement(flow.measurement);
        setAddToCartState({ status: 'idle' });
        // Use 'restoring' phase when we have a polygon from /estimate to skip the 'mark corners' UI
        const hasPolygon = flow.curtainPolygon && Array.isArray(flow.curtainPolygon) && flow.curtainPolygon.length >= 3;
        setPhase(hasPolygon ? 'restoring' : 'mark');
        setFile(null);
        setPreviewUrl(flow.photoUrl ?? null);
        setFileSignature(flow.segmentKey);
        setProgress({ label: tRef.current('configure.progress.loading'), value: null });

        const cached = await loadCachedSegmentWithRetry(flow.segmentKey, 3, 300);
        if (cached && !cancelled) {
          const success = await applyAndClearFlow(cached, true, {
            polygon: flow.curtainPolygon,
            flowMode: flow.flowMode,
            measurement: flow.measurement,
            preservePhase: hasPolygon,
          });
          if (success) return;
        }

        if (!cached && !cancelled && flow.photoUrl) {
          try {
            const response = await fetch(flow.photoUrl);
            if (!response.ok) throw new Error(`failed to load photo from ${flow.photoUrl}`);
            const blob = await response.blob();
            const inferredType = flow.photoType || blob.type || 'image/jpeg';
            const restoredFile = new File([blob], flow.photoName ?? 'flow-photo.jpg', {
              type: inferredType,
              lastModified: flow.createdAt,
            });
            setFileSignature(flow.segmentKey);
            setFile(restoredFile);
            setPreviewUrl(flow.photoUrl);
            setPhase('segmenting');
            setProgress({ label: tRef.current('configure.progress.processing'), value: null });

            const fd = new FormData();
            fd.append('image', restoredFile, restoredFile.name || 'photo.jpg');
            const started = performance.now();
            const res = await fetch('/api/segment', { method: 'POST', body: fd });
            if (!res.ok) {
              throw new Error(await res.text());
            }
            const headerElapsed = res.headers.get('X-Elapsed-MS');
            const elapsedVal = headerElapsed ? Number(headerElapsed) : Math.round(performance.now() - started);
            const mask = await res.blob();

            await applySegmentResultRef.current(
              {
                key: flow.segmentKey,
                mask,
                elapsedMs: Number.isFinite(elapsedVal) ? Math.max(0, Math.round(elapsedVal)) : 0,
                source: 'network',
                photo: restoredFile,
                photoName: restoredFile.name,
              },
              {
                offline: !navigator.onLine,
                preservePhase: Boolean(flow.curtainPolygon && flow.curtainPolygon.length >= 3),
              },
            );

            applyRestoredMeasurement(flow.measurement);
            maybeAdoptPolygon(flow.curtainPolygon, flow.flowMode);

            saveSegmentToCache(
              {
                key: flow.segmentKey,
                createdAt: Date.now(),
                elapsedMs: Number.isFinite(elapsedVal) ? Math.max(0, Math.round(elapsedVal)) : 0,
                photo: restoredFile,
                photoName: restoredFile.name,
                mask,
                flowMode: flow.flowMode ?? CONFIGURE_FLOW_MODE,
              },
              CACHE_QUOTA_BYTES,
            ).catch((err) => {
              if (process.env.NODE_ENV !== 'production') {
                console.warn('[configure] flow fallback cache store failed', err);
              }
            });

            clearFlowState();
            return;
          } catch (error) {
            console.error('[configure] flow fallback segmentation failed', error);
          }
        }

        if (!cancelled) {
          clearFlowState();
          toast.error(tRef.current('configure.toastSegFailed'));
        }
      }

      if (!USE_CURTAIN_FIRST_FLOW) {
        const lastKey = getLastUploadedKey();
        if (!BYPASS_LOCAL_CACHE && lastKey && !cancelled) {
          const cached = await getCachedSegment(lastKey);
          if (cached) {
            setFileSignature(lastKey);
            const success = await applyAndClearFlow(cached, false, {
              polygon: cached.curtainPolygon,
              flowMode: cached.flowMode,
              measurement: cached.measurement as FlowMeasurement | null,
            });
            if (success) return;
          }
        }
      }

      if (!USE_CURTAIN_FIRST_FLOW && !BYPASS_LOCAL_CACHE && CONFIGURE_FALLBACK_LATEST && !cancelled) {
        const latest = await getLatestCachedSegment();
        if (latest) {
          setFileSignature(latest.key);
          const success = await applyAndClearFlow(latest, false, {
            polygon: latest.curtainPolygon,
            flowMode: latest.flowMode,
            measurement: latest.measurement as FlowMeasurement | null,
          });
          if (success) return;
        }
      }

      if (!cancelled) {
        if (USE_CURTAIN_FIRST_FLOW) {
          if (onCurtainFirstMissingFlow) {
            onCurtainFirstMissingFlow();
          }
          return;
        }
        setPhase('idle');
        setPreviewUrl(null);
        setFile(null);
        setCacheNotice(null);
        setRestoredOffline(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    BYPASS_LOCAL_CACHE,
    CACHE_QUOTA_BYTES,
    CONFIGURE_FALLBACK_LATEST,
    CONFIGURE_FLOW_MODE,
    USE_CURTAIN_FIRST_FLOW,
    loadCachedSegmentWithRetry,
    setAddToCartState,
    setBaseCm,
    setCacheNotice,
    setCorners,
    setCurtainMeasureState,
    setElapsed,
    setFile,
    setFileSignature,
    setFlowMeasurementMeta,
    setMarkPicks,
    setPhase,
    setPreviewUrl,
    setProgress,
    setRestoredOffline,
    onCurtainFirstMissingFlow,
  ]);

  return { applySegmentResult };
}
