import { useEffect, useMemo, useRef, useState } from 'react';

export type LightingMode = 'off' | 'lite' | 'enhanced';

export type UseLightingEstimateInput = {
  previewUrl: string | null;
  fileSignature: string | null;
  mode: LightingMode;
  opacity: number; // 0..1
  gridX?: number; // default 48
  gridY?: number; // default 32
  roi?: { x: number; y: number; w: number; h: number } | null; // normalized 0..1 ROI to sample
  throttleMs?: number; // delay before running estimator to avoid bursts; default 120
};

export type UseLightingEstimateOutput = {
  cssFilter: string; // e.g. 'brightness(1.04) contrast(1.02) saturate(1.01)' or 'none'
  gradient: { angleDeg: number; strength: number } | null; // coarse luminance gradient for Enhanced mode
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function useLightingEstimate(input: UseLightingEstimateInput): UseLightingEstimateOutput {
  const { previewUrl, fileSignature, mode, opacity, gridX = 48, gridY = 32, roi, throttleMs = 120 } = input;
  const [cssFilter, setCssFilter] = useState<string>('none');
  const [gradient, setGradient] = useState<{ angleDeg: number; strength: number } | null>(null);
  const cacheRef = useRef<Map<string, { cssFilter: string; gradient: { angleDeg: number; strength: number } | null }>>(new Map());
  const timerRef = useRef<number | null>(null);

  const cacheKey = useMemo(() => {
    if (!fileSignature) return null;
    const r = roi
      ? `|roi=${[roi.x, roi.y, roi.w, roi.h].map(v => Math.round(clamp(v, 0, 1) * 100)).join(',')}`
      : '|roi=full';
    return `${fileSignature}|gx=${gridX}|gy=${gridY}|op=${Math.round(opacity * 100)}|mode=${mode}${r}`;
  }, [fileSignature, gridX, gridY, opacity, mode, roi?.x, roi?.y, roi?.w, roi?.h]);

  useEffect(() => {
    if (!previewUrl || !fileSignature || mode === 'off') {
      setCssFilter('none');
      setGradient(null);
      return;
    }

    if (cacheKey && cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey)!;
      setCssFilter(cached.cssFilter);
      setGradient(cached.gradient);
      return;
    }

    let cancelled = false;

    const run = () => {
      const img = new Image();
      (img as any).decoding = 'async';
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const w = Math.max(8, Math.floor(gridX));
          const h = Math.max(6, Math.floor(gridY));
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          if (!ctx) { if (!cancelled) setCssFilter('none'); return; }
          // Draw ROI (if provided) scaled into w x h; else draw full image
          const iw = (img as HTMLImageElement).naturalWidth || img.width;
          const ih = (img as HTMLImageElement).naturalHeight || img.height;
          if (roi && roi.w > 0 && roi.h > 0) {
            const rx = clamp(roi.x, 0, 1), ry = clamp(roi.y, 0, 1);
            const rw = clamp(roi.w, 0, 1), rh = clamp(roi.h, 0, 1);
            const sx = Math.floor(rx * iw);
            const sy = Math.floor(ry * ih);
            const sw = Math.max(1, Math.floor(rw * iw));
            const sh = Math.max(1, Math.floor(rh * ih));
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
          } else {
            ctx.drawImage(img, 0, 0, iw, ih, 0, 0, w, h);
          }
          const { data } = ctx.getImageData(0, 0, w, h);

          // Compute average luminance and saturation over the whole downscaled image
          let sumL = 0; let sumSat = 0; const n = w * h;
          const L = new Float32Array(w * h);
          for (let i = 0; i < n; i++) {
            const j = i * 4;
            const r = data[j] / 255; const g = data[j + 1] / 255; const b = data[j + 2] / 255;
            const l = 0.2126 * r + 0.7152 * g + 0.0722 * b; // Rec.709
            L[i] = l;
            sumL += l;
            const maxc = Math.max(r, g, b);
            const minc = Math.min(r, g, b);
            const sat = maxc > 0 ? (maxc - minc) / maxc : 0;
            sumSat += sat;
          }
          const avgL = n > 0 ? sumL / n : 0.5;
          const avgSat = n > 0 ? sumSat / n : 0.5;

          // Map to CSS filter parameters (subtle)
          const strength = clamp(opacity, 0, 1);
          const bright = clamp(1 + (avgL - 0.5) * 0.4 * strength, 0.85, 1.15);
          const contr = clamp(1 + (avgL - 0.5) * 0.2 * strength, 0.9, 1.1);
          const satu = clamp(1 + (avgSat - 0.5) * 0.2 * strength, 0.9, 1.1);
          const filter = `brightness(${bright.toFixed(3)}) contrast(${contr.toFixed(3)}) saturate(${satu.toFixed(3)})`;

          // Coarse luminance gradient via central differences
          let gxSum = 0, gySum = 0, cnt = 0;
          for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
              const i = y * w + x;
              const lxm = L[i - 1];
              const lxp = L[i + 1];
              const lym = L[i - w];
              const lyp = L[i + w];
              gxSum += (lxp - lxm) * 0.5;
              gySum += (lyp - lym) * 0.5;
              cnt++;
            }
          }
          const gx = cnt ? gxSum / cnt : 0;
          const gy = cnt ? gySum / cnt : 0;
          const mag = Math.hypot(gx, gy);
          const angleDeg = Math.atan2(gy, gx) * (180 / Math.PI);
          const normMag = clamp(mag / 0.25, 0, 1); // normalize typical range
          const grad = normMag > 0.02 ? { angleDeg, strength: normMag * strength } : null;

          if (!cancelled) {
            if (cacheKey) cacheRef.current.set(cacheKey, { cssFilter: filter, gradient: grad });
            setCssFilter(filter);
            setGradient(grad);
          }
        } catch {
          if (!cancelled) { setCssFilter('none'); setGradient(null); }
        }
      };
      img.onerror = () => { if (!cancelled) { setCssFilter('none'); setGradient(null); } };
      img.src = previewUrl;
    };

    const schedule = () => {
      // Defer to idle if available after throttle
      const start = () => {
        if (typeof (window as any).requestIdleCallback === 'function') {
          (window as any).requestIdleCallback(run);
        } else {
          setTimeout(run, 0);
        }
      };
      if (throttleMs > 0) {
        timerRef.current = window.setTimeout(start, throttleMs);
      } else {
        start();
      }
    };

    schedule();

    return () => { cancelled = true; if (timerRef.current != null) { clearTimeout(timerRef.current); timerRef.current = null; } };
  }, [previewUrl, fileSignature, mode, opacity, gridX, gridY, cacheKey, throttleMs]);

  return useMemo(() => ({ cssFilter, gradient }), [cssFilter, gradient]);
}
