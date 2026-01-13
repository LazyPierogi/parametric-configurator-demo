"use client";

import { useCallback, useEffect, useRef } from 'react';

type UseTexturePreloadArgs = {
  useCanvasRenderer: boolean;
  maxBlobUrls?: number;
};

export function useTexturePreload({ useCanvasRenderer, maxBlobUrls = 150 }: UseTexturePreloadArgs) {
  // Image decode cache to avoid flicker when switching textures quickly
  const imgCache = useRef<Map<string, Promise<boolean> | 'loaded' | 'error'>>(new Map());
  // Blob URL cache to bypass revalidation and paint immediately from memory
  const blobUrlCacheRef = useRef<Map<string, string>>(new Map());
  const blobLruRef = useRef<string[]>([]);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const addPreload = useCallback(
    (url: string) => {
      if (useCanvasRenderer) return; // Skip preload when using artist pipeline
      if (typeof document === 'undefined') return;
      const id = `preload-${url}`;
      if (document.getElementById(id)) return;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'preload';
      (link as any).as = 'image';
      link.href = url;
      try { document.head.appendChild(link); } catch {}
    },
    [useCanvasRenderer],
  );

  const ensureImage = useCallback(
    (url?: string | null): Promise<boolean> => {
      if (!url) return Promise.resolve(false);
      if (useCanvasRenderer) {
        // Skip image loading entirely when using artist pipeline
        return Promise.resolve(false);
      }
      const cache = imgCache.current;
      const val = cache.get(url);
      if (val === 'loaded') return Promise.resolve(true);
      if (val && val !== 'error') return val as Promise<boolean>;
      const p = new Promise<boolean>((resolve) => {
        try {
          const img = new Image();
          // Hint browser to decode off-main-thread when possible
          (img as any).decoding = 'async';
          let settled = false;
          const done = () => { if (!settled) { settled = true; cache.set(url, 'loaded'); resolve(true); } };
          img.onload = done;
          img.onerror = () => {
            if (!settled) {
              settled = true;
              cache.set(url, 'error');
              resolve(false);
            }
          };
          img.src = url;
          // Network hint
          addPreload(url);
          // Prefer decode() when available for earlier readiness
          if (typeof (img as any).decode === 'function') {
            (img as any).decode().then(done).catch(() => { /* fall back to onload */ });
          }
        } catch {
          cache.set(url, 'error');
          resolve(false);
        }
      });
      cache.set(url, p);
      return p;
    },
    [addPreload, useCanvasRenderer],
  );

  const ensureImageForLegacy = useCallback(
    (url?: string | null): Promise<boolean> => {
      if (useCanvasRenderer) return Promise.resolve(false);
      return ensureImage(url);
    },
    [ensureImage, useCanvasRenderer],
  );

  const getRenderableUrl = useCallback((url?: string | null): string | null => {
    if (!url) return null;
    return blobUrlCacheRef.current.get(url) || url;
  }, []);

  const primeBlobUrl = useCallback(async (url?: string | null) => {
    if (!url) return;
    if (useCanvasRenderer) return;
    const cache = blobUrlCacheRef.current;
    if (cache.has(url)) return;

    // Abort any prior fetch for the same url
    const prev = abortControllers.current.get(url);
    if (prev) prev.abort();
    const controller = new AbortController();
    abortControllers.current.set(url, controller);

    try {
      const res = await fetch(url, {
        cache: 'force-cache',
        credentials: 'omit',
        mode: 'cors' as RequestMode,
        signal: controller.signal,
      });
      if (!res.ok) return;
      const blob = await res.blob();
      // Fetch might be aborted during blob read
      if (controller.signal.aborted) return;
      const obj = URL.createObjectURL(blob);
      cache.set(url, obj);
      blobLruRef.current.push(url);
      // Evict oldest if over capacity
      while (blobLruRef.current.length > maxBlobUrls) {
        const oldUrl = blobLruRef.current.shift();
        if (!oldUrl) break;
        const oldObj = cache.get(oldUrl);
        if (oldObj) {
          try { URL.revokeObjectURL(oldObj); } catch {}
          cache.delete(oldUrl);
        }
        const ac = abortControllers.current.get(oldUrl);
        if (ac) ac.abort();
        abortControllers.current.delete(oldUrl);
      }
    } catch {
      // ignore fetch errors/aborts
    } finally {
      // Only clear if this call still owns the active controller for this URL
      if (abortControllers.current.get(url) === controller) {
        abortControllers.current.delete(url);
      }
    }
  }, [maxBlobUrls, useCanvasRenderer]);

  const isImageLoaded = useCallback((url?: string | null): boolean => {
    if (!url) return false;
    const val = imgCache.current.get(url);
    return val === 'loaded';
  }, []);

  // Cleanup blob URLs and abort in-flight fetches on unmount
  useEffect(() => {
    return () => {
      abortControllers.current.forEach((ac) => ac.abort());
      abortControllers.current.clear();
      blobUrlCacheRef.current.forEach((objUrl) => {
        try { URL.revokeObjectURL(objUrl); } catch {}
      });
      blobUrlCacheRef.current.clear();
      blobLruRef.current = [];
    };
  }, []);

  return {
    ensureImage,
    ensureImageForLegacy,
    getRenderableUrl,
    primeBlobUrl,
    isImageLoaded,
  };
}
