"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from 'next/navigation';
import { createVerticalSweepOverlay, createPulsingIndicator, prefersReducedMotion } from '@/lib/motion-utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'react-hot-toast';
import { getCachedSegment, saveSegmentToCache, updateSegmentMetadata, clearSegmentCache } from '@/lib/segment-cache';
import type { SegmentCacheWrite } from '@/lib/segment-cache';
import { fingerprintBlob } from '@/lib/file-signature';
import { storeFlowState, setLastUploadedKey } from '@/lib/flow-state';
import { useLocale } from '@/app/providers/locale-context';
import { getMeasurementFromCache, saveMeasurementToCache, type MeasurementProvider, clearMeasurementCache } from '@/lib/measurement-cache';
import { APP_VERSION } from '@/lib/version';
import { cn } from '@/lib/utils';
import { isHEIC, validateAndConvertImage } from '@/lib/image-validation';
import { useDeviceCapabilities } from '@/hooks/useDeviceCapabilities';
import { recordMeasurementObservation } from '@/lib/measurement-observer';
import { analyzeWallMaskPng, computePolygonDimensionsWithHeuristics } from '@/lib/mask-heuristics';
import { isValidBlob } from '@/lib/blob-url-fallback';
import { HeroSurface } from './components/HeroSurface';
import WebflowLayoutStatic from '@/components/WebflowLayoutStatic';

type MeasureOut = {
  wallWidthCm: number;
  wallHeightCm: number;
  confidencePct?: number;
  warnings?: string[];
  usedFallback?: boolean;
  fallbackProvider?: string;
};

/** Wall measurement from Qwen (without polygon) - used as base for heuristics */
type WallMeasurement = {
  wallWidthCm: number;
  wallHeightCm: number;
  provider: MeasurementProvider;
  model: string;
  elapsedMs?: number;
  confidencePct?: number;
  warnings?: string[];
};

const MEASURE_ENGINE_PREF = (process.env.NEXT_PUBLIC_MEASURE_ENGINE_DEBUG || 'localcv').toLowerCase() as 'vlm' | 'localcv' | 'auto' | 'noreref';
const FLOW_MODE: 'legacy' | 'new' = 'new';
const MIN_POLY_SPAN = 0.03; // 3% span guard to avoid accidental taps
const defaultProviderForDebug = (): MeasurementProvider => {
  if (MEASURE_ENGINE_PREF === 'localcv') return 'localcv';
  if (MEASURE_ENGINE_PREF === 'noreref') return 'noreref';
  // For VLM/auto modes, default to Qwen (production-default provider)
  return 'qwen';
};
const defaultModelForProvider = (provider: MeasurementProvider): string => {
  if (provider === 'localcv') return 'localcv';
  if (provider === 'noreref') return 'noreref';
  if (provider === 'openai') return process.env.AI1_GPT_MODEL || 'openai/gpt-4o-mini';
  if (provider === 'qwen') return process.env.AI1_QWEN_MODEL || 'qwen3-vl-flash';
  return process.env.AI1_GEMINI_MODEL || 'googleai/gemini-2.0-flash-001';
};

export default function EstimatePage() {
  const DEBUG_UI_ENABLED = ['true', '1', 'yes', 'on'].includes((process.env.NEXT_PUBLIC_CONFIGURE_DEBUG_UI || '').toLowerCase().trim());
  const { t, locale, isLoading: isLocaleLoading } = useLocale();
  const router = useRouter();
  const MAX_MB = Number(process.env.NEXT_PUBLIC_MAX_IMAGE_MB || '15');
  const MAX_BYTES = Math.max(1, Math.floor(MAX_MB * 1024 * 1024));
  const autoRetryEnv = Number(process.env.NEXT_PUBLIC_FLOW_AUTO_RETRIES ?? '1');
  const autoRetryAttempts = Number.isFinite(autoRetryEnv) ? Math.max(0, Math.floor(autoRetryEnv)) : 0;
  const totalAttempts = autoRetryAttempts + 1;

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<MeasureOut | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const initialProvider = defaultProviderForDebug();
  const [provider, setProvider] = useState<MeasurementProvider>(initialProvider);
  const [model, setModel] = useState<string>(defaultModelForProvider(initialProvider));
  const [measureStatus, setMeasureStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [measureError, setMeasureError] = useState<string | null>(null);
  const [segStatus, setSegStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [segError, setSegError] = useState<string | null>(null);
  const [segmentKey, setSegmentKey] = useState<string | null>(null);
  const [segElapsed, setSegElapsed] = useState<number | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [bypassCache, setBypassCache] = useState(false);
  // Size confirmation modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmW, setConfirmW] = useState<string>('');
  const [confirmH, setConfirmH] = useState<string>('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [heicConverting, setHeicConverting] = useState(false);
  const [markPicks, setMarkPicks] = useState<{ x: number; y: number }[]>([]);
  const markNormalizedRef = useRef(false);
  const [markDragIx, setMarkDragIx] = useState<number | null>(null);
  const [polygonError, setPolygonError] = useState<string | null>(null);
  const [cornerConfirmOpen, setCornerConfirmOpen] = useState(false);
  const cornersConfirmedRef = useRef(false);
  // Wall measurement from Qwen (base for heuristics in new flow)
  const [wallMeasurement, setWallMeasurement] = useState<WallMeasurement | null>(null);
  const [wallMeasureStatus, setWallMeasureStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const imgRef = useRef<HTMLImageElement | null>(null);
  const MIN_W_CM = 40, MAX_W_CM = 1000;
  const MIN_H_CM = 40, MAX_H_CM = 400;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputGalleryRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const dropCounterRef = useRef(0);
  const currentFileRef = useRef<File | null>(null);
  const dataUriRef = useRef<string | null>(null);
  const navigateOnceRef = useRef(false);
  const loadingToastRef = useRef<string | null>(null);
  const lastSignatureRef = useRef<string | null>(null);
  const pickTokenRef = useRef<symbol | null>(null);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);
  const heroContainerRef = useRef<HTMLDivElement | null>(null);
  const { useCompactLayout } = useDeviceCapabilities();
  const isMobile = useCompactLayout;

  // Shimmer animation during AI measurement - AI scanning beam effect
  useLayoutEffect(() => {
    if (measureStatus !== 'pending' || !heroContainerRef.current) return;

    const reducedMotion = prefersReducedMotion();
    const cleanup = reducedMotion
      ? createPulsingIndicator(heroContainerRef.current, {
          color: 'rgba(var(--cw-primary-rgb), 0.8)',
          size: '10px',
        })
      : createVerticalSweepOverlay(heroContainerRef.current, {
          // Full-width vertical sweep (AI scan) for the glass hero
          height: '600px',
          opacity: 0.9,
          glowSize: '5px',
          duration: 1400,
          zIndex: 18,
          mixBlendMode: 'soft-light',
        });

    return () => {
      cleanup?.();
    };
  }, [measureStatus]);

  const onChangeProvider = useCallback((p: MeasurementProvider) => {
    setProvider(p);
    setModel(defaultModelForProvider(p));
  }, []);

  const toDataUri = useCallback((f: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(f);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (loadingToastRef.current) {
        toast.dismiss(loadingToastRef.current);
        loadingToastRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const pending = measureStatus === 'pending' || segStatus === 'pending';
    if (pending) {
      if (!loadingToastRef.current) {
        loadingToastRef.current = toast.loading(t('estimate.loadingMagic'));
      }
    } else if (loadingToastRef.current) {
      toast.dismiss(loadingToastRef.current);
      loadingToastRef.current = null;
    }
  }, [measureStatus, segStatus, t]);

  // Normalize rectangle once after 4 points placed
  useEffect(() => {
    if (markPicks.length !== 4) {
      if (markPicks.length < 4) {
        markNormalizedRef.current = false;
      }
      return;
    }
    if (!markNormalizedRef.current) {
      const xs = markPicks.map((p) => p.x);
      const ys = markPicks.map((p) => p.y);
      const minX = Math.max(0, Math.min(...xs));
      const maxX = Math.min(1, Math.max(...xs));
      const minY = Math.max(0, Math.min(...ys));
      const maxY = Math.min(1, Math.max(...ys));
      const rect = [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
      setMarkPicks(rect);
      markNormalizedRef.current = true;
    }
  }, [markPicks]);

  const toNormalized = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const host = imgRef.current?.getBoundingClientRect();
      if (!host) return null;
      const x = (clientX - host.left) / Math.max(1, host.width);
      const y = (clientY - host.top) / Math.max(1, host.height);
      return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    },
    []
  );

  useEffect(() => {
    if (markDragIx == null) return;
    const onMove = (e: PointerEvent) => {
      const norm = toNormalized(e.clientX, e.clientY);
      if (!norm) return;
      setMarkPicks((prev) => {
        if (!prev[markDragIx]) return prev;
        const next = prev.slice();
        next[markDragIx] = norm;
        return next;
      });
      setPolygonError(null);
    };
    const onEnd = () => setMarkDragIx(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [markDragIx, toNormalized]);

  const resetForFile = useCallback((f: File) => {
    setMeasureStatus('idle');
    setSegStatus('idle');
    setMeasureError(null);
    setSegError(null);
    setResult(null);
    setElapsed(null);
    setSegElapsed(null);
    setSegmentKey(null);
    setPhotoName(f.name || null);
    currentFileRef.current = f;
    dataUriRef.current = null;
    navigateOnceRef.current = false;
    lastSignatureRef.current = null;
    lastMeasurementCacheKeyRef.current = null;
    setConfirmOpen(false);
    setMarkPicks([]);
    setMarkDragIx(null);
    setPolygonError(null);
    setCornerConfirmOpen(false);
    markNormalizedRef.current = false;
    setHeicConverting(false);
    cornersConfirmedRef.current = false;
  }, []);

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropCounterRef.current += 1;
      setDragActive(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropCounterRef.current = Math.max(0, dropCounterRef.current - 1);
      if (dropCounterRef.current === 0) {
        setDragActive(false);
      }
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dropCounterRef.current = 0;
      setDragActive(false);
    };
    el.addEventListener('dragover', handleDragOver);
    el.addEventListener('dragenter', handleDragEnter);
    el.addEventListener('dragleave', handleDragLeave);
    el.addEventListener('drop', handleDrop);
    return () => {
      el.removeEventListener('dragover', handleDragOver);
      el.removeEventListener('dragenter', handleDragEnter);
      el.removeEventListener('dragleave', handleDragLeave);
      el.removeEventListener('drop', handleDrop);
    };
  }, []);

  const lastMeasurementCacheKeyRef = useRef<string | null>(null);
  const hashPolygon = useCallback((poly: { x: number; y: number }[]) => {
    const json = JSON.stringify(poly);
    let hash = 0;
    for (let i = 0; i < json.length; i += 1) {
      hash = (hash << 5) - hash + json.charCodeAt(i);
      hash |= 0;
    }
    return `poly${(hash >>> 0).toString(16)}`;
  }, []);

  const runMeasurement = useCallback(async (targetFile: File, signature: string, attempts: number, curtainPolygon?: { x: number; y: number }[] | null) => {
    setMeasureStatus('pending');
    setMeasureError(null);
    const normalizedPolygon =
      curtainPolygon && curtainPolygon.length >= 3
        ? curtainPolygon.map((p) => ({
            x: Number(p.x.toFixed(6)),
            y: Number(p.y.toFixed(6)),
          }))
        : null;
    const polygonHash = normalizedPolygon ? hashPolygon(normalizedPolygon) : null;
    const baseCacheKey = normalizedPolygon ? `${signature}::${polygonHash}` : signature;
    const measurementCacheKey =
      FLOW_MODE === 'new'
        ? `${baseCacheKey}::${FLOW_MODE}::mpipeV2`
        : baseCacheKey;
    const cached = bypassCache ? null : getMeasurementFromCache(measurementCacheKey, provider, model);
    if (cached) {
      setElapsed(cached.elapsedMs ?? null);
      setResult({ wallWidthCm: cached.wallWidthCm, wallHeightCm: cached.wallHeightCm });
      setMeasureStatus('success');
      lastMeasurementCacheKeyRef.current = measurementCacheKey;
      void updateSegmentMetadata(signature, { flowMode: FLOW_MODE });
      if (DEBUG_UI_ENABLED) toast.success(t('estimate.toastEstimated', { time: (cached.elapsedMs ?? 0).toString() }));
      setConfirmW(String(Math.round(cached.wallWidthCm)));
      setConfirmH(String(Math.round(cached.wallHeightCm)));
      if (FLOW_MODE === 'legacy' || cornersConfirmedRef.current) {
        setConfirmOpen(true);
      }
      return { wallWidthCm: cached.wallWidthCm, wallHeightCm: cached.wallHeightCm };
    }
    const dataUri = dataUriRef.current ?? (await toDataUri(targetFile));
    dataUriRef.current = dataUri;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const t0 = performance.now();
        const res = await fetch('/api/measure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photoDataUri: dataUri,
            provider,
            model,
            bypassCache,
            ...(normalizedPolygon ? { curtainPolygon: normalizedPolygon } : {}),
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json() as MeasureOut;
        const elapsedMs = Math.round(performance.now() - t0);
        setElapsed(elapsedMs);
        setResult(json);
        setMeasureStatus('success');
        lastMeasurementCacheKeyRef.current = measurementCacheKey;
        const measurementMeta = {
          wallWidthCm: json.wallWidthCm,
          wallHeightCm: json.wallHeightCm,
          provider,
          model,
          elapsedMs,
          confidencePct: json.confidencePct ?? null,
          warnings: json.warnings ?? null,
          usedFallback: json.usedFallback,
          fallbackProvider: json.fallbackProvider ?? null,
        };
        void updateSegmentMetadata(signature, {
          flowMode: FLOW_MODE,
          measurement: measurementMeta,
          schemaVersion: 2,
        });
        if (!bypassCache) {
          saveMeasurementToCache({
            key: measurementCacheKey,
            provider,
            model,
            wallWidthCm: json.wallWidthCm,
            wallHeightCm: json.wallHeightCm,
            elapsedMs,
            createdAt: Date.now(),
          });
        }
        if (DEBUG_UI_ENABLED) toast.success(t('estimate.toastEstimated', { time: elapsedMs.toString() }));
        setConfirmW(String(Math.round(json.wallWidthCm)));
        setConfirmH(String(Math.round(json.wallHeightCm)));
        if (FLOW_MODE === 'legacy' || cornersConfirmedRef.current) {
          setConfirmOpen(true);
        }
        if (DEBUG_UI_ENABLED) {
          recordMeasurementObservation({
            status: 'success',
            flowMode: FLOW_MODE,
            provider,
            model,
            elapsedMs,
            wallWidthCm: json.wallWidthCm,
            wallHeightCm: json.wallHeightCm,
            confidencePct: json.confidencePct,
            warnings: json.warnings ?? null,
            photoKey: signature,
            segmentKey: signature,
            cacheKey: measurementCacheKey,
            source: normalizedPolygon ? 'estimate-curtain' : 'estimate-wall',
            polygon: normalizedPolygon ?? undefined,
            polygonKey: polygonHash ?? undefined,
            ...(json.usedFallback != null
              ? { usedFallback: json.usedFallback, fallbackProvider: json.fallbackProvider ?? null }
              : {}),
          });
        }
        return json;
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          toast(t('estimate.toastRetrying', {
            task: t('estimate.retryMeasurementLabel'),
            attempt: String(attempt + 1),
          }));
        }
      }
    }
    const message = t('estimate.measureError');
    setMeasureStatus('error');
    setMeasureError(message);
    toast.error(message);
    throw lastError ?? new Error(message);
  }, [DEBUG_UI_ENABLED, FLOW_MODE, bypassCache, hashPolygon, model, provider, t, toDataUri]);

  /**
   * Run wall measurement with Qwen (no polygon) - used as base for heuristics in new flow.
   * This runs in parallel with segmentation when photo is uploaded.
   */
  const runWallMeasurement = useCallback(async (targetFile: File, signature: string, attempts: number): Promise<WallMeasurement | null> => {
    setWallMeasureStatus('pending');
    const qwenProvider: MeasurementProvider = 'qwen';
    const qwenModel = process.env.AI1_QWEN_MODEL || 'qwen3-vl-flash';
    
    // Check cache first
    const cacheKey = `${signature}::wall::qwen::${FLOW_MODE}::mpipeV2`;
    const cached = bypassCache ? null : getMeasurementFromCache(cacheKey, qwenProvider, qwenModel);
    if (cached) {
      const measurement: WallMeasurement = {
        wallWidthCm: cached.wallWidthCm,
        wallHeightCm: cached.wallHeightCm,
        provider: qwenProvider,
        model: qwenModel,
        elapsedMs: cached.elapsedMs,
        // confidencePct and warnings not stored in cache, will be undefined
      };
      setWallMeasurement(measurement);
      setWallMeasureStatus('success');
      if (process.env.NODE_ENV !== 'production') {
        console.log('[estimate] Wall measurement from cache:', measurement);
      }
      return measurement;
    }
    
    const dataUri = dataUriRef.current ?? (await toDataUri(targetFile));
    dataUriRef.current = dataUri;
    
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const t0 = performance.now();
        const res = await fetch('/api/measure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photoDataUri: dataUri,
            provider: qwenProvider,
            model: qwenModel,
            bypassCache,
            // NO curtainPolygon - we want the full wall measurement
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json() as MeasureOut;
        const elapsedMs = Math.round(performance.now() - t0);
        
        const measurement: WallMeasurement = {
          wallWidthCm: json.wallWidthCm,
          wallHeightCm: json.wallHeightCm,
          provider: qwenProvider,
          model: qwenModel,
          elapsedMs,
          confidencePct: json.confidencePct,
          warnings: json.warnings,
        };
        
        setWallMeasurement(measurement);
        setWallMeasureStatus('success');
        
        // Cache the wall measurement
        if (!bypassCache) {
          saveMeasurementToCache({
            key: cacheKey,
            provider: qwenProvider,
            model: qwenModel,
            wallWidthCm: json.wallWidthCm,
            wallHeightCm: json.wallHeightCm,
            elapsedMs,
            createdAt: Date.now(),
          });
        }
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('[estimate] Wall measurement completed:', measurement);
        }
        
        return measurement;
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          console.warn('[estimate] Wall measurement retry', attempt, error);
        }
      }
    }
    
    console.error('[estimate] Wall measurement failed after retries:', lastError);
    setWallMeasureStatus('error');
    return null;
  }, [FLOW_MODE, bypassCache, toDataUri]);

  const runSegmentation = useCallback(async (targetFile: File, signature: string, attempts: number) => {
    setSegStatus('pending');
    setSegError(null);
    let cached = bypassCache ? null : await getCachedSegment(signature);
    
    // Validate cached Blobs (Safari can invalidate IndexedDB Blobs between sessions)
    if (cached) {
      const maskValid = await isValidBlob(cached.mask);
      if (!maskValid) {
        console.warn('[estimate] Cached mask Blob is invalid (Safari/iOS bug), will re-segment');
        cached = null;
      }
    }
    
    if (cached) {
      // Ensure cached photo matches the current upload. Compare by fingerprint if possible; fall back to name/size.
      let needsRefresh = false;
      try {
        const freshSig = await fingerprintBlob(targetFile);
        if (freshSig && freshSig !== cached.key) {
          needsRefresh = true;
        }
      } catch {
        needsRefresh = (
          cached.photoName !== (targetFile.name || cached.photoName) ||
          cached.photo.size !== targetFile.size
        );
      }
      if (!bypassCache && needsRefresh) {
        try {
          await saveSegmentToCache({
            key: signature,
            createdAt: Date.now(),
            elapsedMs: cached.elapsedMs,
            photo: targetFile,
            photoName: targetFile.name || cached.photoName,
            mask: cached.mask,
            flowMode: FLOW_MODE,
          });
          // Update lastUploadedKey when refreshing cached entry
          try { setLastUploadedKey(signature); } catch {}
        } catch {}
      } else if (!bypassCache) {
        // Even if not refreshing, update lastUploadedKey for this cached hit
        try { setLastUploadedKey(signature); } catch {}
      }
      setSegmentKey(signature);
      setSegElapsed(cached.elapsedMs);
      setSegStatus('success');
      setPhotoName(cached.photoName ?? targetFile.name ?? null);
      return cached;
    }
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const form = new FormData();
        form.append('image', targetFile, targetFile.name || 'photo.jpg');
        const start = performance.now();
        const res = await fetch('/api/segment', { method: 'POST', body: form });
        if (!res.ok) throw new Error(await res.text());
        const elapsedHeader = res.headers.get('X-Elapsed-MS');
        const headerValue = elapsedHeader ? Number(elapsedHeader) : NaN;
        const elapsedMs = Number.isFinite(headerValue)
          ? Math.max(0, Math.round(headerValue))
          : Math.round(performance.now() - start);
        const maskBlob = await res.blob();
        const t0 = performance.now();

        const entry: SegmentCacheWrite = {
          key: signature,
          createdAt: Date.now(),
          elapsedMs,
          photo: targetFile,
          photoName: targetFile.name,
          mask: maskBlob,
          flowMode: FLOW_MODE,
        };

        // Update UI immediately - don't wait for cache
        setSegmentKey(signature);
        setSegElapsed(elapsedMs);
        setSegStatus('success');
        setPhotoName(targetFile.name || null);

        if (process.env.NODE_ENV !== 'production') {
          console.log(`[estimate] UI updated in ${Math.round(performance.now() - t0)}ms after blob received`);
        }

        // Ensure cache write completes before finishing so Configure can restore offline
        if (!bypassCache) {
          const cacheStart = performance.now();
          try {
            await saveSegmentToCache(entry);
            try { setLastUploadedKey(signature); } catch {}

            if (process.env.NODE_ENV !== 'production') {
              console.log(`[estimate] Segment cache save completed in ${Math.round(performance.now() - cacheStart)}ms`);
              try {
                const verify = await getCachedSegment(signature);
                if (!verify) {
                  console.error('[estimate] Segment cache verification failed for', signature);
                } else {
                  console.log('[estimate] Segment cache verification passed for', signature);
                }
              } catch (err) {
                console.error('[estimate] Segment cache verification error', err);
              }
            }
            // Small delay to ensure IndexedDB transaction is fully committed
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (err) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn('[estimate] Cache save failed', err);
            }
          }
        } else {
          try { setLastUploadedKey(signature); } catch {}
        }

        return entry;
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          toast(t('estimate.toastRetrying', {
            task: t('estimate.retrySegmentationLabel'),
            attempt: String(attempt + 1),
          }));
        }
      }
    }
    const message = t('estimate.segError');
    setSegStatus('error');
    setSegError(message);
    toast.error(message);
    throw lastError ?? new Error(message);
  }, [bypassCache, t]);

  const startAnalysis = useCallback(async (opts?: { measurement?: boolean; segmentation?: boolean; wallMeasurement?: boolean }) => {
    const targetFile = currentFileRef.current ?? file;
    if (!targetFile) return;
    const shouldSegment = opts?.segmentation !== false;
    const shouldMeasure =
      opts?.measurement != null
        ? opts.measurement
        : FLOW_MODE === 'legacy';
    // For new flow: run wall measurement (Qwen without polygon) in parallel with segmentation
    const shouldWallMeasure = opts?.wallMeasurement === true || (FLOW_MODE === 'new' && opts?.wallMeasurement !== false && !shouldMeasure);
    
    console.log('[estimate] startAnalysis called:', { 
      opts, 
      shouldSegment, 
      shouldMeasure, 
      shouldWallMeasure,
      flowMode: FLOW_MODE 
    });
    
    navigateOnceRef.current = false;

    let signature = segmentKey;
    if (shouldSegment || !signature) {
      signature = await fingerprintBlob(targetFile);
    }
    lastSignatureRef.current = signature ?? null;
    if (signature) {
      try { setLastUploadedKey(signature); } catch {}
    }

    const measurementPromise = shouldMeasure && signature
      ? runMeasurement(
          targetFile,
          signature,
          totalAttempts,
          FLOW_MODE === 'new' ? markPicks : undefined
        )
      : Promise.resolve(result);
    
    // Wall measurement (Qwen) for new flow - runs in parallel with segmentation
    const wallMeasurementPromise = shouldWallMeasure && signature
      ? runWallMeasurement(targetFile, signature, totalAttempts)
      : Promise.resolve(null);
    
    const segmentationPromise = shouldSegment && signature
      ? runSegmentation(targetFile, signature, totalAttempts)
      : Promise.resolve(null);

    // Do not auto-navigate; confirmation modal will proceed when the user confirms.
    void measurementPromise;
    void wallMeasurementPromise;
    void segmentationPromise;
  }, [FLOW_MODE, bypassCache, elapsed, file, markPicks, model, photoName, provider, result, router, runMeasurement, runWallMeasurement, runSegmentation, segmentKey, t, totalAttempts]);

  // Validation flags for inline styling in the confirm modal
  const parsedW = Number((confirmW || '').replace(/\D+/g, ''));
  const parsedH = Number((confirmH || '').replace(/\D+/g, ''));
  const wInvalid =
    confirmOpen &&
    confirmW !== '' &&
    (!Number.isFinite(parsedW) || parsedW < 50 || parsedW > 1000);
  const hInvalid =
    confirmOpen &&
    confirmH !== '' &&
    (!Number.isFinite(parsedH) || parsedH < 50 || parsedH > 1000);
  const normalizedPolygon = useMemo(
    () =>
      markPicks.length
        ? markPicks.map((p) => ({
            x: Math.max(0, Math.min(1, p.x)),
            y: Math.max(0, Math.min(1, p.y)),
          }))
        : null,
    [markPicks],
  );
  const polygonBounds = useMemo(() => {
    if (!normalizedPolygon || normalizedPolygon.length < 3) return null;
    const xs = normalizedPolygon.map((p) => p.x);
    const ys = normalizedPolygon.map((p) => p.y);
    const minX = Math.max(0, Math.min(...xs));
    const maxX = Math.min(1, Math.max(...xs));
    const minY = Math.max(0, Math.min(...ys));
    const maxY = Math.min(1, Math.max(...ys));
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
    };
  }, [normalizedPolygon]);
  const polygonValid = useMemo(() => {
    if (!normalizedPolygon || !polygonBounds) return false;
    return (
      normalizedPolygon.length === 4 &&
      polygonBounds.width >= MIN_POLY_SPAN &&
      polygonBounds.height >= MIN_POLY_SPAN
    );
  }, [normalizedPolygon, polygonBounds]);

  const resetPolygon = useCallback(() => {
    setMarkPicks([]);
    setMarkDragIx(null);
    setPolygonError(null);
    markNormalizedRef.current = false;
    setCornerConfirmOpen(false);
    cornersConfirmedRef.current = false;
  }, []);

  const onBackToUpload = useCallback(() => {
    setConfirmOpen(false);
    setConfirmError(null);
    setFile(null);
    setPreview(null);
    setResult(null);
    setMeasureStatus('idle');
    setSegStatus('idle');
    setMeasureError(null);
    setSegError(null);
    setSegmentKey(null);
    setSegElapsed(null);
    setElapsed(null);
    setPhotoName(null);
    // Reset wall measurement state (new flow)
    setWallMeasurement(null);
    setWallMeasureStatus('idle');
    currentFileRef.current = null;
    lastSignatureRef.current = null;
    dataUriRef.current = null;
    navigateOnceRef.current = false;
    setHeicConverting(false);
    resetPolygon();
    if (inputRef.current) {
      try {
        inputRef.current.value = '';
      } catch {}
    }
    if (inputGalleryRef.current) {
      try {
        inputGalleryRef.current.value = '';
      } catch {}
    }
  }, [resetPolygon]);

  const startPolygonMeasurement = useCallback(async () => {
    if (FLOW_MODE !== 'new') {
      void startAnalysis({ measurement: true, segmentation: false });
      return;
    }
    if (!normalizedPolygon || !polygonValid) {
      setPolygonError(t('estimate.polygon.errorIncomplete'));
      return;
    }
    const targetFile = currentFileRef.current ?? file;
    if (!targetFile) {
      setPolygonError(t('estimate.polygon.errorNoPhoto'));
      return;
    }
    let signature = lastSignatureRef.current ?? segmentKey ?? null;
    if (!signature) {
      try {
        signature = await fingerprintBlob(targetFile);
        lastSignatureRef.current = signature;
      } catch {
        signature = null;
      }
    }
    if (!signature) {
      setPolygonError(t('estimate.polygon.errorNoPhoto'));
      return;
    }
    setPolygonError(null);
    setMeasureStatus('pending');
    
    try {
      // NEW FLOW: Use heuristics with Qwen wall measurement + mask
      console.log('[estimate] Starting polygon measurement with heuristics...');
      console.log('[estimate] Current state:', { 
        wallMeasureStatus, 
        hasWallMeasurement: !!wallMeasurement,
        segStatus,
        hasSegmentKey: !!segmentKey 
      });
      
      // Wait for wall measurement if not yet available
      let currentWallMeasurement = wallMeasurement;
      if (!currentWallMeasurement && wallMeasureStatus !== 'error') {
        // Wall measurement might still be running, need to wait or run it
        if (wallMeasureStatus === 'pending' || wallMeasureStatus === 'idle') {
          console.log('[estimate] Wall measurement not ready, running now...');
          currentWallMeasurement = await runWallMeasurement(targetFile, signature, totalAttempts);
        }
      }
      
      if (!currentWallMeasurement) {
        // Fall back to old behavior if wall measurement failed
        console.warn('[estimate] Wall measurement not available, falling back to API call');
        await runMeasurement(targetFile, signature, totalAttempts, normalizedPolygon);
        return;
      }
      
      console.log('[estimate] Wall measurement ready:', currentWallMeasurement);
      
      // Wait for segmentation to complete if still running
      if (segStatus === 'pending') {
        console.log('[estimate] Waiting for segmentation to complete...');
        // Poll for segmentation completion (max 30 seconds)
        for (let i = 0; i < 300; i++) {
          await new Promise(r => setTimeout(r, 100));
          // Check cache directly since state might not update
          const seg = await getCachedSegment(signature);
          if (seg?.mask) {
            console.log('[estimate] Segmentation completed (found in cache)');
            break;
          }
        }
      }
      
      // Get mask from cache for heuristics
      let wallBounds = null;
      const cachedSegment = await getCachedSegment(signature);
      console.log('[estimate] Cached segment:', { 
        found: !!cachedSegment, 
        hasMask: !!cachedSegment?.mask,
        maskSize: cachedSegment?.mask?.size,
        key: cachedSegment?.key
      });
      
      if (cachedSegment?.mask) {
        try {
          console.log('[estimate] Analyzing mask PNG...');
          wallBounds = await analyzeWallMaskPng(cachedSegment.mask);
          console.log('[estimate] Wall bounds from mask:', wallBounds);
        } catch (err) {
          console.warn('[estimate] Mask analysis failed:', err);
        }
      } else {
        console.warn('[estimate] No mask available in cache for signature:', signature);
      }
      
      // Compute polygon dimensions with heuristics
      const heuristicsResult = computePolygonDimensionsWithHeuristics(
        normalizedPolygon,
        wallBounds,
        currentWallMeasurement
      );
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('[estimate] Heuristics result:', heuristicsResult);
      }
      
      // Build the result
      const measureResult: MeasureOut = {
        wallWidthCm: heuristicsResult.curtainWidthCm,
        wallHeightCm: heuristicsResult.curtainHeightCm,
        confidencePct: currentWallMeasurement.confidencePct,
        warnings: [
          ...(currentWallMeasurement.warnings || []),
          ...(heuristicsResult.warnings || []),
          heuristicsResult.heuristicsApplied ? 'heuristics:applied' : 'heuristics:fallback',
        ],
        usedFallback: !heuristicsResult.heuristicsApplied,
        fallbackProvider: heuristicsResult.heuristicsApplied ? 'geometry:mask_heuristics' : 'geometry:bbox',
      };
      
      setResult(measureResult);
      setElapsed(currentWallMeasurement.elapsedMs ?? null);
      setMeasureStatus('success');
      setConfirmW(String(Math.round(measureResult.wallWidthCm)));
      setConfirmH(String(Math.round(measureResult.wallHeightCm)));
      setConfirmOpen(true);
      
      // Cache the final result
      const polygonHash = hashPolygon(normalizedPolygon);
      const measurementCacheKey = `${signature}::${polygonHash}::${FLOW_MODE}::mpipeV2`;
      lastMeasurementCacheKeyRef.current = measurementCacheKey;
      
      if (!bypassCache) {
        saveMeasurementToCache({
          key: measurementCacheKey,
          provider: currentWallMeasurement.provider,
          model: currentWallMeasurement.model,
          wallWidthCm: measureResult.wallWidthCm,
          wallHeightCm: measureResult.wallHeightCm,
          elapsedMs: currentWallMeasurement.elapsedMs,
          createdAt: Date.now(),
        });
      }
      
      // Record observation for diagnostics
      if (DEBUG_UI_ENABLED) {
        recordMeasurementObservation({
          status: 'success',
          flowMode: FLOW_MODE,
          provider: currentWallMeasurement.provider,
          model: currentWallMeasurement.model,
          elapsedMs: currentWallMeasurement.elapsedMs,
          wallWidthCm: measureResult.wallWidthCm,
          wallHeightCm: measureResult.wallHeightCm,
          confidencePct: measureResult.confidencePct,
          warnings: measureResult.warnings ?? null,
          photoKey: signature,
          segmentKey: signature,
          cacheKey: measurementCacheKey,
          source: 'estimate-curtain',
          polygon: normalizedPolygon,
          polygonKey: polygonHash,
          usedFallback: measureResult.usedFallback,
          fallbackProvider: measureResult.fallbackProvider ?? null,
        });
      }
      
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[estimate] polygon measurement failed', err);
      }
      setMeasureStatus('error');
      setPolygonError(t('estimate.measureError'));
    }
  }, [DEBUG_UI_ENABLED, FLOW_MODE, bypassCache, file, hashPolygon, normalizedPolygon, polygonValid, runMeasurement, runWallMeasurement, segmentKey, segStatus, t, totalAttempts, wallMeasurement, wallMeasureStatus]);

  // When polygon becomes valid (4 corners), prompt for confirmation in new flow
  useEffect(() => {
    if (FLOW_MODE !== 'new') return;
    if (polygonValid && markPicks.length === 4 && !cornerConfirmOpen && !cornersConfirmedRef.current && measureStatus !== 'pending') {
      setCornerConfirmOpen(true);
    }
    if ((!polygonValid || markPicks.length !== 4) && cornerConfirmOpen) {
      setCornerConfirmOpen(false);
    }
  }, [FLOW_MODE, polygonValid, markPicks.length, cornerConfirmOpen, measureStatus]);

  const onConfirmCorners = useCallback(() => {
    if (FLOW_MODE !== 'new') return;
    cornersConfirmedRef.current = true;
    setCornerConfirmOpen(false);
    void startPolygonMeasurement();
  }, [FLOW_MODE, startPolygonMeasurement]);

  const hasPending = measureStatus === 'pending' || segStatus === 'pending';

  const retryMeasurement = useCallback(() => {
    if (FLOW_MODE === 'new') {
      void startPolygonMeasurement();
    } else {
      void startAnalysis({ measurement: true, segmentation: false });
    }
  }, [FLOW_MODE, startAnalysis, startPolygonMeasurement]);

  const retrySegmentation = useCallback(() => {
    void startAnalysis({ measurement: false, segmentation: true });
  }, [startAnalysis]);

  const onPick = useCallback(async (f: File) => {
    const token = Symbol('picker');
    pickTokenRef.current = token;

    const isHeicFile = isHEIC(f);
    if (isHeicFile) {
      setHeicConverting(true);
    }

    // Validate and convert image (handles HEIC conversion)
    const validation = await validateAndConvertImage(f, MAX_BYTES);

    if (pickTokenRef.current !== token) return;

    if (!validation.valid) {
      setHeicConverting(false);
      const message =
        validation.error === 'conversion_failed'
          ? t('estimate.toastHeicFailed')
          : validation.message || t('estimate.toastTooLarge', { max: MAX_MB.toString() });
      toast.error(message);
      return;
    }

    const processedFile = validation.file!;
    const wasHEIC = isHeicFile;

    if (pickTokenRef.current !== token) return;

    // Show conversion notice for HEIC files
    if (wasHEIC && processedFile.type === 'image/jpeg') {
      toast.success(t('estimate.toastHeicConverted'));
    }

    resetForFile(processedFile);
    setFile(processedFile);
    try {
      const url = URL.createObjectURL(processedFile);
      setPreview(url);
      if (!wasHEIC) {
        toast.success(t('estimate.toastLoaded'));
      }
      if (FLOW_MODE === 'legacy') {
        void startAnalysis();
      } else {
        void startAnalysis({ measurement: false, segmentation: true });
      }
    } catch {
      setPreview(null);
      toast.error(t('estimate.toastPreviewFailed'));
    }
    setHeicConverting(false);
  }, [FLOW_MODE, MAX_BYTES, MAX_MB, resetForFile, startAnalysis, t]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (f) void onPick(f);
  }, [onPick]);

  const onClickPick = useCallback(() => inputRef.current?.click(), []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dropCounterRef.current = 0;
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void onPick(f);
  }, [onPick]);

  const onDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dropCounterRef.current += 1;
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dropCounterRef.current = Math.max(0, dropCounterRef.current - 1);
    if (dropCounterRef.current === 0) {
      setDragActive(false);
    }
  }, []);

  const onClickDrop = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Trigger native file picker (will show camera + gallery options on mobile)
    inputGalleryRef.current?.click();
  }, []);

  const onPaste = useCallback(async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of Array.from(items)) {
      if (it.type.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) { await onPick(f); break; }
      }
    }
  }, [onPick]);

  const handleClearClientCaches = useCallback(async () => {
    try {
      clearMeasurementCache();
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[estimate] failed to clear measurement cache', err);
      }
    }
    try {
      await clearSegmentCache();
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[estimate] failed to clear segment cache', err);
      }
    }
    if (process.env.NODE_ENV !== 'production') {
      toast.success('Local measurement + segment caches cleared');
    }
  }, []);

  // Show loading skeleton while locale loads to prevent flash of translation keys
  if (isLocaleLoading) {
    return (
      <WebflowLayoutStatic>
        <div className="page-container max-w-4xl animate-pulse">
          <div className="h-8 bg-neutral-200 rounded mb-2 mx-auto w-48"></div>
          <div className="h-4 bg-neutral-200 rounded mb-8 mx-auto w-96"></div>
          <div className="h-64 bg-neutral-200 rounded-lg mb-4"></div>
          <div className="h-12 bg-neutral-200 rounded w-32 mx-auto"></div>
        </div>
      </WebflowLayoutStatic>
    );
  }

  return (
    <WebflowLayoutStatic>
      <div ref={pageContainerRef} className="page-container max-w-4xl">
        <h1 className="text-2xl font-semibold mb-1 text-center">{t('estimate.title')}</h1>
        <p className="mt-0 text-neutral-600 text-center">{t('estimate.intro')}</p>

      {/* Controls */}
      <div className="flex gap-2 flex-wrap items-center mb-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
          capture="environment"
          onChange={onInputChange}
          className="hidden"
        />
        <input
          ref={inputGalleryRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
          onChange={onInputChange}
          className="hidden"
        />
        {DEBUG_UI_ENABLED && (
          <>
            <Button variant="secondary" onClick={onClickPick}>{t('estimate.choosePhoto')}</Button>
            <label className="inline-flex gap-1.5 items-center">
              {t('estimate.providerLabel')}
              <Select value={provider} onChange={(e) => onChangeProvider(e.target.value as any)}>
                <option value="qwen">Qwen VL (Alibaba)</option>
                <option value="googleai">{t('estimate.providerGoogle')}</option>
                <option value="openai">{t('estimate.providerOpenai')}</option>
                <option value="localcv">{t('estimate.providerLocalcv')}</option>
                <option value="noreref">{t('estimate.providerNoreref')}</option>
              </Select>
            </label>
            <label className="inline-flex gap-1.5 items-center">
              <input type="checkbox" checked={bypassCache} onChange={(e) => setBypassCache(e.target.checked)} />
              {t('estimate.bypassCacheLabel')}
            </label>
            <Button variant="secondary" type="button" onClick={() => { void handleClearClientCaches(); }}>
              Clear local caches
            </Button>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={t('estimate.modelPlaceholder')}
              disabled={provider === 'localcv' || provider === 'noreref'}
              className="w-[280px]"
            />
            {hasPending && <span className="text-active-accent">{t('estimate.loadingMagic')}</span>}
            {measureStatus === 'success' && elapsed != null && (
              <span className="text-neutral-600">{t('estimate.elapsed', { time: elapsed.toString() })}</span>
            )}
            {segStatus === 'success' && segElapsed != null && (
              <span className="text-neutral-600">{t('estimate.segElapsed', { time: segElapsed.toString() })}</span>
            )}
            <Button
              variant="secondary"
              type="button"
              className="!bg-yellow-100 hover:!bg-yellow-200 !border-yellow-400 !text-yellow-800"
              onClick={async () => {
                // Create a simple test image (100x75 grey PNG)
                const canvas = document.createElement('canvas');
                canvas.width = 100;
                canvas.height = 75;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.fillStyle = '#888888';
                  ctx.fillRect(0, 0, 100, 75);
                }
                const testPhotoBlob = await new Promise<Blob>((resolve) => 
                  canvas.toBlob((b) => resolve(b!), 'image/png')
                );
                
                // Create a mock mask (white rectangle)
                const maskCanvas = document.createElement('canvas');
                maskCanvas.width = 100;
                maskCanvas.height = 75;
                const maskCtx = maskCanvas.getContext('2d');
                if (maskCtx) {
                  maskCtx.fillStyle = '#ffffff';
                  maskCtx.fillRect(0, 0, 100, 75);
                }
                const testMaskBlob = await new Promise<Blob>((resolve) => 
                  maskCanvas.toBlob((b) => resolve(b!), 'image/png')
                );
                
                const debugKey = `debug-skip-${Date.now()}`;
                const mockMeasurement = {
                  wallWidthCm: 180,
                  wallHeightCm: 250,
                  provider: 'qwen' as const,
                  model: 'debug-skip',
                  elapsedMs: 0,
                };
                
                // Mock polygon covering 40% width, 25% height, centered
                const mockPolygon = [
                  { x: 0.30, y: 0.35 },
                  { x: 0.70, y: 0.35 },
                  { x: 0.70, y: 0.60 },
                  { x: 0.30, y: 0.60 },
                ];
                
                // Save to segment cache
                const { saveSegmentToCache } = await import('@/lib/segment-cache');
                await saveSegmentToCache({
                  key: debugKey,
                  createdAt: Date.now(),
                  elapsedMs: 0,
                  photo: testPhotoBlob,
                  photoName: 'debug-test.png',
                  mask: testMaskBlob,
                  flowMode: 'new',
                  curtainPolygon: mockPolygon,
                  measurement: mockMeasurement,
                });
                
                // Store flow state
                storeFlowState({
                  measurement: mockMeasurement,
                  curtainPolygon: mockPolygon,
                  segmentKey: debugKey,
                  photoName: 'debug-test.png',
                  createdAt: Date.now(),
                  flowMode: 'new',
                });
                
                // Navigate to configure
                router.push(`/configure?w_cm=180&h_cm=250`);
              }}
            >
              ⚡ Skip to Configure (Debug)
            </Button>
          </>
        )}
      </div>

      {/* Drop/Paste zone */}
      <HeroSurface
        isMobile={isMobile}
        dropRef={dropRef}
        heroContainerRef={heroContainerRef}
        onDrop={onDrop}
        onPaste={onPaste}
        onClickDrop={onClickDrop}
        confirmOpen={confirmOpen}
        preview={preview}
        t={t}
        confirmW={confirmW}
        setConfirmW={setConfirmW}
        confirmH={confirmH}
        setConfirmH={setConfirmH}
        wInvalid={wInvalid}
        hInvalid={hInvalid}
        confirmError={confirmError}
        setConfirmError={setConfirmError}
        setConfirmOpen={setConfirmOpen}
        setFile={setFile}
        setPreview={setPreview}
        setResult={setResult}
        setMeasureStatus={setMeasureStatus}
        setSegStatus={setSegStatus}
        currentFileRef={currentFileRef}
        lastSignatureRef={lastSignatureRef}
        segStatus={segStatus}
        segmentKey={segmentKey}
        photoName={photoName}
        bypassCache={bypassCache}
        provider={provider}
        model={model}
        elapsed={elapsed}
        flowMode={FLOW_MODE}
        saveMeasurementToCache={saveMeasurementToCache}
        storeFlowState={storeFlowState}
        router={router}
        imgRef={imgRef}
        markPicks={markPicks}
        onOverlayClick={(x, y) => {
          const norm = toNormalized(x, y);
          if (!norm) return;
          setMarkPicks((prev) => {
            if (prev.length >= 4) return prev;
            return [...prev, norm];
          });
          setPolygonError(null);
        }}
        onHandlePointerDown={(idx) => {
          setPolygonError(null);
          setMarkDragIx(idx);
        }}
        measurementCacheKey={lastMeasurementCacheKeyRef.current}
        curtainPolygon={FLOW_MODE === 'new' ? normalizedPolygon : null}
        heicConverting={heicConverting}
        cornerConfirmOpen={cornerConfirmOpen}
        onConfirmCorners={onConfirmCorners}
        onConfirmCornersReset={resetPolygon}
        onBackToUpload={onBackToUpload}
      />
      {measureStatus === 'error' && measureError && (
        <div className="mt-3 p-3 bg-error-bg border border-error-border rounded-lg text-error-text flex flex-col gap-2">
          <span>{measureError}</span>
          <Button variant="secondary" onClick={retryMeasurement}>{t('estimate.retryMeasurementButton')}</Button>
        </div>
      )}
      {segStatus === 'error' && segError && (
        <div className="mt-3 p-3 bg-warning-bg border border-warning-border rounded-lg text-warning-text flex flex-col gap-2">
          <span>{segError}</span>
          <Button variant="secondary" onClick={retrySegmentation}>{t('estimate.retrySegmentationButton')}</Button>
        </div>
      )}
      {DEBUG_UI_ENABLED && result && (
        <div className="mt-3 p-3 bg-active-bg border border-active-border rounded-lg">
          <div className="font-semibold mb-2 text-active-text">{t('estimate.resultTitle')}</div>
          <div>{t('estimate.resultWidth', { value: result.wallWidthCm.toFixed(1) })}</div>
          <div>{t('estimate.resultHeight', { value: result.wallHeightCm.toFixed(1) })}</div>
          {typeof result.confidencePct === 'number' && (
            <div>{t('estimate.resultConfidence', { value: result.confidencePct.toFixed(0) })}</div>
          )}
          {Array.isArray(result.warnings) && result.warnings.length > 0 && (
            <div className="mt-1.5">
              <div className="font-medium text-warning-text">{t('estimate.resultWarningsTitle')}</div>
              <ul className="m-1 pl-5 text-warning-text">
                {result.warnings.map((warn, idx) => (
                  <li key={idx} className="text-sm">{warn}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      
      {/* Mobile modal: slides from bottom (fixed, outside photo container) */}
      {confirmOpen && isMobile && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex px-3 bg-black/45 items-end backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            onKeyDown={(e) => { if (e.key === 'Enter') { (document.getElementById('cw-confirm-btn') as HTMLButtonElement | null)?.click(); } }}
            onClick={(e) => e.stopPropagation()}
            className="cw-modal-scope bg-active-bg border border-active-border p-4 w-full rounded-t-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.2)] animate-in duration-200 ease-out slide-in-from-bottom-8"
          >
            <div className="text-lg font-bold mb-1.5">{t('estimate.confirm.title')}</div>
            <div className="text-sm text-neutral-600 mb-3">{t('estimate.confirm.subtitle')}</div>
            <div className="flex items-start justify-between gap-4 max-[360px]:flex-col">
              <div className="flex w-[48%] flex-col gap-1 max-[360px]:w-full">
                <label className="text-xs text-neutral-800">{t('estimate.confirm.widthLabel')}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  step={1}
                  min={50}
                  max={1000}
                  value={confirmW}
                  onChange={(e) => {
                    const digits = (e.target.value || '').replace(/\D+/g, '');
                    if (digits.length > 4) return;
                    setConfirmW(digits);
                  }}
                  onBlur={(e) => {
                    const num = Number((e.target.value || '').replace(/\D+/g, ''));
                    if (!Number.isFinite(num) || num === 0) return;
                    const clamped = Math.max(50, Math.min(1000, Math.round(num)));
                    setConfirmW(String(clamped));
                  }}
                  onFocus={(e) => { try { (e.target as HTMLInputElement).select(); } catch {} }}
                  aria-invalid={wInvalid || undefined}
                  className={cn(
                    'w-full max-w-full',
                    wInvalid ? 'border-error text-error-text' : 'border-neutral-300'
                  )}
                />
                <div className={cn('text-2xs', wInvalid ? 'text-error-text' : 'text-neutral-500')}>
                  {t('estimate.confirm.rangeHint')}
                </div>
              </div>
              <div className="flex w-[48%] flex-col gap-1 max-[360px]:w-full">
                <label className="text-xs text-neutral-800">{t('estimate.confirm.heightLabel')}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  step={1}
                  min={50}
                  max={1000}
                  value={confirmH}
                  onChange={(e) => {
                    const digits = (e.target.value || '').replace(/\D+/g, '');
                    if (digits.length > 4) return;
                    setConfirmH(digits);
                  }}
                  onBlur={(e) => {
                    const num = Number((e.target.value || '').replace(/\D+/g, ''));
                    if (!Number.isFinite(num) || num === 0) return;
                    const clamped = Math.max(50, Math.min(1000, Math.round(num)));
                    setConfirmH(String(clamped));
                  }}
                  onFocus={(e) => { try { (e.target as HTMLInputElement).select(); } catch {} }}
                  aria-invalid={hInvalid || undefined}
                  className={cn(
                    'w-full max-w-full',
                    hInvalid ? 'border-error text-error-text' : 'border-neutral-300'
                  )}
                />
                <div className={cn('text-2xs', hInvalid ? 'text-error-text' : 'text-neutral-500')}>
                  {t('estimate.confirm.rangeHint')}
                </div>
              </div>
            </div>
            {confirmError && <div className="text-error-text text-xs mt-2">{confirmError}</div>}
            <div className="flex justify-between items-center gap-2 mt-3.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onBackToUpload();
                }}
              >
                ← {t('common.back')}
              </Button>
              <Button
                id="cw-confirm-btn"
                variant="primary"
                disabled={segStatus === 'pending'}
                onClick={() => {
                  let w = Number(String(confirmW).replace(',', '.'));
                  let h = Number(String(confirmH).replace(',', '.'));
                  if (!Number.isFinite(w) || !Number.isFinite(h)) {
                    setConfirmError(t('estimate.confirm.error'));
                    return;
                  }
                  // Round to full cm and clamp within sane bounds
                  w = Math.max(50, Math.min(1000, Math.round(w)));
                  h = Math.max(50, Math.min(1000, Math.round(h)));
                  if (w < 50 || w > 1000 || h < 50 || h > 1000) {
                    setConfirmError(t('estimate.confirm.error'));
                    return;
                  }
                  if (segStatus === 'pending') {
                    setConfirmError(t('estimate.confirm.waitSegmentation'));
                    toast.error(t('estimate.toastWaitSegmentation'));
                    return;
                  }
                  if (segStatus !== 'success' || !segmentKey) {
                    setConfirmError(t('estimate.confirm.retrySegmentation'));
                    toast.error(t('estimate.toastNeedSegmentation'));
                    return;
                  }
                  setConfirmError(null);
                  const key = segmentKey;
                  const photoLabel = photoName ?? undefined;
                  const flowPhotoUrl = preview ?? null;
                  const flowPhotoType = currentFileRef.current?.type ?? null;
                  const flowPhotoSize = currentFileRef.current?.size ?? null;
                  const measurementKey = lastMeasurementCacheKeyRef.current ?? lastSignatureRef.current ?? key ?? null;
                  if (key) {
                    // Persist user-confirmed dimensions to cache so next load uses them
                    if (!bypassCache && measurementKey) {
                      try {
                        saveMeasurementToCache({ key: measurementKey, provider, model, wallWidthCm: w, wallHeightCm: h, elapsedMs: elapsed ?? undefined, createdAt: Date.now() });
                      } catch {}
                    }
                    storeFlowState({
                      measurement: {
                        wallWidthCm: w,
                        wallHeightCm: h,
                        provider,
                        model,
                        elapsedMs: elapsed ?? undefined,
                        confidencePct: result?.confidencePct ?? undefined,
                        warnings: result?.warnings ?? undefined,
                        usedFallback: result?.usedFallback,
                        fallbackProvider: result?.fallbackProvider ?? undefined,
                      },
                      segmentKey: key,
                      photoName: photoLabel,
                      photoUrl: flowPhotoUrl,
                      photoType: flowPhotoType,
                      photoSize: flowPhotoSize,
                      createdAt: Date.now(),
                      flowMode: FLOW_MODE,
                      curtainPolygon: FLOW_MODE === 'new' ? normalizedPolygon ?? undefined : undefined,
                    });
                  }
                  setConfirmOpen(false);
                  
                  // Use View Transitions API for smooth page transition (if supported)
                  const doc = document as any;
                  if (typeof doc.startViewTransition === 'function' && !prefersReducedMotion()) {
                    doc.startViewTransition(() => {
                      router.push(`/configure?w_cm=${w.toFixed(0)}&h_cm=${h.toFixed(0)}`);
                    });
                  } else {
                    router.push(`/configure?w_cm=${w.toFixed(0)}&h_cm=${h.toFixed(0)}`);
                  }
                }}
              >
                {segStatus === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" color="light" />
                    {t('estimate.confirm.confirmButton')}
                  </div>
                ) : (
                  t('estimate.confirm.confirmButton')
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Version display */}
      <div className="fixed bottom-2 right-2 text-xs text-neutral-400 font-mono bg-active-bg/80 backdrop-blur-sm px-2 py-1 rounded shadow-sm border border-active-border">
        {APP_VERSION}
      </div>
      </div>
    </WebflowLayoutStatic>
  );
}
