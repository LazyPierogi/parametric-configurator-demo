"use client";

import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { isValidBlob } from '@/lib/blob-url-fallback';
import { getCachedSegment, saveSegmentToCache } from '@/lib/segment-cache';
import type { SegmentResult } from './useCurtainFirstRestore';
import type { TranslateFn } from '../types';

type Phase = 'idle' | 'segmenting' | 'mark' | 'ready' | 'restoring';

type ProgressState = { label: string; value: number | null } | null;

type UseSegmentationJobArgs = {
  file: File | null;
  fileSignature: string | null;

  CONFIGURE_FLOW_MODE: 'legacy' | 'new';
  CACHE_QUOTA_BYTES: number;
  INFLIGHT_TTL_MS: number;

  t: TranslateFn;
  formatNumber: (value: number) => string;

  applySegmentResult: (
    result: SegmentResult,
    options?: {
      offline?: boolean;
      notify?: boolean;
      preservePhase?: boolean;
    },
  ) => Promise<void>;

  setBusy: Dispatch<SetStateAction<boolean>>;
  setElapsed: Dispatch<SetStateAction<number | null>>;
  setAttachedUrl: Dispatch<SetStateAction<string | null>>;
  setProposalUrl: Dispatch<SetStateAction<string | null>>;
  setProgress: Dispatch<SetStateAction<ProgressState>>;
  setCacheNotice: Dispatch<SetStateAction<string | null>>;
  setRestoredOffline: Dispatch<SetStateAction<boolean>>;
  setMarkPicks: Dispatch<SetStateAction<{ x: number; y: number }[]>>;
  setCorners: Dispatch<SetStateAction<{ x: number; y: number }[] | null>>;
  setPhase: Dispatch<SetStateAction<Phase>>;
};

export function useSegmentationJob({
  file,
  fileSignature,
  CONFIGURE_FLOW_MODE,
  CACHE_QUOTA_BYTES,
  INFLIGHT_TTL_MS,
  t,
  formatNumber,
  applySegmentResult,
  setBusy,
  setElapsed,
  setAttachedUrl,
  setProposalUrl,
  setProgress,
  setCacheNotice,
  setRestoredOffline,
  setMarkPicks,
  setCorners,
  setPhase,
}: UseSegmentationJobArgs) {
  const inFlightRef = useRef(new Map<string, { promise: Promise<SegmentResult>; timestamp: number; resolvedAt?: number }>());

  const run = useCallback(
    async (opts?: { file?: File; key?: string; force?: boolean }) => {
      const targetFile = opts?.file ?? file;
      const key = opts?.key ?? fileSignature;
      if (!targetFile || !key) return;

      let trackedPromise: Promise<SegmentResult> | null = null;
      try {
        setBusy(true);
        setElapsed(null);
        setAttachedUrl(null);
        setProposalUrl(null);
        setProgress({ label: t('configure.progress.preparing'), value: null });
        setCacheNotice(null);
        setRestoredOffline(false);
        setMarkPicks([]);
        setCorners(null);

        if (!opts?.force) {
          const cached = await getCachedSegment(key);
          if (cached) {
            const photoValid = await isValidBlob(cached.photo);
            const maskValid = await isValidBlob(cached.mask);
            if (photoValid && maskValid) {
              await applySegmentResult(
                {
                  key,
                  mask: cached.mask,
                  elapsedMs: cached.elapsedMs,
                  source: 'cache',
                  photo: cached.photo,
                  photoName: cached.photoName,
                },
                { offline: !navigator.onLine },
              );
              return;
            } else {
              console.warn('[configure] Cached Blobs invalid, will re-segment', { photoValid, maskValid });
            }
          }
        }

        setPhase('segmenting');

        const existing = inFlightRef.current.get(key);
        if (existing) {
          const resolvedAge = existing.resolvedAt != null ? performance.now() - existing.resolvedAt : null;
          const age = performance.now() - existing.timestamp;
          if (existing.resolvedAt == null || (resolvedAge != null && resolvedAge <= INFLIGHT_TTL_MS) || age <= INFLIGHT_TTL_MS) {
            setProgress({ label: t('configure.progress.waitingExisting'), value: null });
            const reused = await existing.promise;
            await applySegmentResult(reused);
            return;
          }
        }

        const rawPromise = new Promise<SegmentResult>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const started = performance.now();
          xhr.open('POST', '/api/segment');
          xhr.responseType = 'blob';
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const ratio = event.total ? event.loaded / event.total : 0;
              setProgress({
                label: t('configure.progress.uploadingPercent', { percent: formatNumber(Math.round(ratio * 100)) }),
                value: ratio,
              });
            } else {
              setProgress({ label: t('configure.progress.uploading'), value: null });
            }
          };
          xhr.upload.onloadstart = () => setProgress({ label: t('configure.progress.uploading'), value: 0 });
          xhr.upload.onloadend = () => setProgress({ label: t('configure.progress.processing'), value: null });
          xhr.onreadystatechange = () => {
            if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
              setProgress({ label: t('configure.progress.processing'), value: null });
            }
          };
          xhr.onerror = () => reject(new Error('Network error while uploading image'));
          xhr.onabort = () => reject(new Error('Segmentation request aborted'));
          xhr.onload = async () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const blob = xhr.response as Blob;
              const headerElapsed = xhr.getResponseHeader('X-Elapsed-MS');
              const elapsedMs = headerElapsed ? Number(headerElapsed) : Math.round(performance.now() - started);
              try {
                await saveSegmentToCache(
                  {
                    key,
                    mask: blob,
                    elapsedMs,
                    photo: targetFile,
                    photoName: targetFile.name,
                    createdAt: Date.now(),
                    flowMode: CONFIGURE_FLOW_MODE,
                  },
                  CACHE_QUOTA_BYTES,
                );
              } catch (err) {
                if (process.env.NODE_ENV !== 'production') {
                  console.warn('[segment-cache] store failed', err);
                }
              }
              resolve({ key, mask: blob, elapsedMs, source: 'network' });
            } else {
              try {
                const serverMsg = typeof xhr.response === 'string' && xhr.response.trim() ? xhr.response : (xhr.statusText || '');
                if (serverMsg) console.error('[segment] server error', serverMsg);
              } catch {}
              reject(new Error(t('configure.toastSegFailed')));
            }
          };
          const fd = new FormData();
          fd.append('image', targetFile);
          xhr.send(fd);
        });

        trackedPromise = rawPromise
          .then((result) => {
            const entry = inFlightRef.current.get(key);
            if (entry) {
              entry.resolvedAt = performance.now();
            }
            setTimeout(() => {
              const entry = inFlightRef.current.get(key);
              if (
                entry &&
                entry.promise === trackedPromise &&
                entry.resolvedAt != null &&
                performance.now() - entry.resolvedAt >= INFLIGHT_TTL_MS
              ) {
                inFlightRef.current.delete(key);
              }
            }, INFLIGHT_TTL_MS);
            return result;
          })
          .catch((err) => {
            const entry = inFlightRef.current.get(key);
            if (entry && entry.promise === trackedPromise) {
              inFlightRef.current.delete(key);
            }
            throw err;
          });

        inFlightRef.current.set(key, { promise: trackedPromise, timestamp: performance.now() });

        const result = await trackedPromise;
        await applySegmentResult(result);
      } catch (e: any) {
        toast.error(e?.message || t('configure.toastSegFailed'));
      } finally {
        if (trackedPromise) {
          const key = opts?.key ?? fileSignature;
          if (key) {
            const entry = inFlightRef.current.get(key);
            if (entry && entry.promise === trackedPromise && entry.resolvedAt == null) {
              inFlightRef.current.delete(key);
            }
          }
        }
        setBusy(false);
        setProgress(null);
      }
    },
    [
      CACHE_QUOTA_BYTES,
      CONFIGURE_FLOW_MODE,
      INFLIGHT_TTL_MS,
      applySegmentResult,
      file,
      fileSignature,
      formatNumber,
      setAttachedUrl,
      setBusy,
      setCacheNotice,
      setCorners,
      setElapsed,
      setMarkPicks,
      setPhase,
      setProgress,
      setProposalUrl,
      setRestoredOffline,
      t,
    ],
  );

  return {
    run,
  };
}
