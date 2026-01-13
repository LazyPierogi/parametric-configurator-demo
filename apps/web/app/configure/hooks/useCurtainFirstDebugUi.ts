"use client";

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { getActiveEnvVariables } from '@/lib/version';

type DebugUiState = {
  handleBg: string;
  borderHex: string;
  borderOpacity: number;
  handleOpacity: number;
  ringHex: string;
  ringOpacity: number;
  wallStroke: string;
  wallStrokeOpacity: number;
};

type UseCurtainFirstDebugUiArgs = {
  DEBUG_UI_ENABLED: boolean;
  phase: string;
};

type UseCurtainFirstDebugUiResult = {
  debugUi: DebugUiState;
  showSave: boolean;
  setShowSave: React.Dispatch<React.SetStateAction<boolean>>;
  envSnippet: string;
  activeEnvVars: Record<string, string>;
  handleUpdateDebugUi: (partial: Partial<DebugUiState>) => void;
  handleCopyEnvSnippet: () => Promise<void>;
};

export function useCurtainFirstDebugUi({
  DEBUG_UI_ENABLED,
  phase,
}: UseCurtainFirstDebugUiArgs): UseCurtainFirstDebugUiResult {
  const envGet = (k: string) => (process.env[k as any] ?? '').toString();
  const envNum01 = (k: string, fb: number) => {
    const v = parseFloat(envGet(k));
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fb;
  };
  const envStr = (k: string, fb: string) => {
    const v = envGet(k);
    return v && typeof v === 'string' ? v : fb;
  };

  const defaultDebugUi: DebugUiState = {
    handleBg: envStr('NEXT_PUBLIC_HANDLE_BG', '#e5e7eb'),
    borderHex: envStr('NEXT_PUBLIC_HANDLE_BORDER_HEX', '#000000'),
    borderOpacity: envNum01('NEXT_PUBLIC_HANDLE_BORDER_OPACITY', 0.15),
    handleOpacity: envNum01('NEXT_PUBLIC_HANDLE_OPACITY', 1),
    ringHex: envStr('NEXT_PUBLIC_RING_HEX', '#000000'),
    ringOpacity: envNum01('NEXT_PUBLIC_RING_OPACITY', 0.28),
    wallStroke: envStr('NEXT_PUBLIC_WALL_STROKE', '#e5e7eb'),
    wallStrokeOpacity: envNum01('NEXT_PUBLIC_WALL_STROKE_OPACITY', 1),
  };

  const [debugUi, setDebugUi] = useState<DebugUiState>(defaultDebugUi);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tryUrls = ['/config/wall-box-pallette.json', '/api/static?p=config/wall-box-pallette.json'];
        let j: any | null = null;
        for (const u of tryUrls) {
          try {
            const r = await fetch(u, { cache: 'no-store' });
            if (r.ok) {
              j = await r.json();
              break;
            }
          } catch {
            // ignore
          }
        }
        if (!j) return;

        const next = {
          handleBg: typeof j.handleBg === 'string' ? j.handleBg : defaultDebugUi.handleBg,
          borderHex: typeof j.borderHex === 'string' ? j.borderHex : defaultDebugUi.borderHex,
          borderOpacity: Number.isFinite(j.borderOpacity)
            ? Math.max(0, Math.min(1, j.borderOpacity))
            : defaultDebugUi.borderOpacity,
          handleOpacity: Number.isFinite(j.handleOpacity)
            ? Math.max(0, Math.min(1, j.handleOpacity))
            : defaultDebugUi.handleOpacity,
          ringHex: typeof j.ringHex === 'string' ? j.ringHex : defaultDebugUi.ringHex,
          ringOpacity: Number.isFinite(j.ringOpacity)
            ? Math.max(0, Math.min(1, j.ringOpacity))
            : defaultDebugUi.ringOpacity,
          wallStroke: typeof j.wallStroke === 'string' ? j.wallStroke : defaultDebugUi.wallStroke,
          wallStrokeOpacity: Number.isFinite(j.wallStrokeOpacity)
            ? Math.max(0, Math.min(1, j.wallStrokeOpacity))
            : defaultDebugUi.wallStrokeOpacity,
        } as DebugUiState;

        if (cancelled) return;
        setDebugUi(next);

        try {
          const root = document.documentElement;
          const hex = (s: string) => (s && s.startsWith('#') ? s : `#${s || ''}`);
          const toRgb = (h: string) => {
            const s = hex(h);
            const r = parseInt(s.slice(1, 3), 16) || 0;
            const g = parseInt(s.slice(3, 5), 16) || 0;
            const b = parseInt(s.slice(5, 7), 16) || 0;
            return `${r},${g},${b}`;
          };
          root.style.setProperty('--cw-handle-bg', String(next.handleBg));
          root.style.setProperty('--cw-handle-border', `rgba(${toRgb(next.borderHex)}, ${next.borderOpacity})`);
          root.style.setProperty('--cw-handle-opacity', String(next.handleOpacity));
          if (DEBUG_UI_ENABLED) {
            root.style.setProperty('--cw-ring-rgb', toRgb(next.ringHex));
            root.style.setProperty('--cw-ring-opacity', String(next.ringOpacity));
          }
          root.style.setProperty('--cw-wall-stroke', String(next.wallStroke));
          root.style.setProperty('--cw-wall-stroke-opacity', String(next.wallStrokeOpacity));
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [showSave, setShowSave] = useState(false);

  const envSnippet = useMemo(() => {
    const toHex = (v: string) => (v && v.startsWith('#') ? v : `#${v || ''}`);
    return [
      `# Debug UI (handles & wall box)`,
      `NEXT_PUBLIC_HANDLE_BG=${debugUi.handleBg}`,
      `NEXT_PUBLIC_HANDLE_BORDER_HEX=${toHex(debugUi.borderHex)}`,
      `NEXT_PUBLIC_HANDLE_BORDER_OPACITY=${debugUi.borderOpacity}`,
      `NEXT_PUBLIC_HANDLE_OPACITY=${debugUi.handleOpacity}`,
      `NEXT_PUBLIC_RING_HEX=${toHex(debugUi.ringHex)}`,
      `NEXT_PUBLIC_RING_OPACITY=${debugUi.ringOpacity}`,
      `NEXT_PUBLIC_WALL_STROKE=${debugUi.wallStroke}`,
      `NEXT_PUBLIC_WALL_STROKE_OPACITY=${debugUi.wallStrokeOpacity}`,
    ].join('\n');
  }, [debugUi]);

  const activeEnvVars = useMemo(() => getActiveEnvVariables(), [phase, DEBUG_UI_ENABLED]);

  const handleUpdateDebugUi = useCallback((partial: Partial<DebugUiState>) => {
    setDebugUi((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleCopyEnvSnippet = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(envSnippet);
      toast.success('ENV snippet copied to clipboard');
    } catch {
      // ignore
    }
  }, [envSnippet]);

  useEffect(() => {
    if (!DEBUG_UI_ENABLED) return;
    const hexToRgb = (hex: string): string => {
      const m = hex.trim().replace('#', '');
      const n = m.length === 3 ? m.split('').map((ch) => ch + ch).join('') : m;
      const r = parseInt(n.slice(0, 2), 16) || 0;
      const g = parseInt(n.slice(2, 4), 16) || 0;
      const b = parseInt(n.slice(4, 6), 16) || 0;
      return `${r},${g},${b}`;
    };
    const ringRgb = hexToRgb(debugUi.ringHex);
    const borderRgb = hexToRgb(debugUi.borderHex);

    try {
      (window as any).cwDebug?.set({
        handleBg: debugUi.handleBg,
        handleBorder: `rgba(${borderRgb}, ${Math.max(0, Math.min(1, debugUi.borderOpacity))})`,
        handleOpacity: Math.max(0, Math.min(1, debugUi.handleOpacity)),
        ringRgb,
        ringOpacity: Math.max(0, Math.min(1, debugUi.ringOpacity)),
        wallStroke: debugUi.wallStroke,
        wallStrokeOpacity: Math.max(0, Math.min(1, debugUi.wallStrokeOpacity)),
      });
    } catch {
      // ignore
    }
  }, [DEBUG_UI_ENABLED, debugUi]);

  useEffect(() => {
    // intentionally no-op: we do not write to localStorage to avoid overriding global palette
  }, [debugUi]);

  useEffect(() => {
    if (typeof document === 'undefined' || !DEBUG_UI_ENABLED) return;

    try {
      const root = document.documentElement;
      const applyVars = (vars: Record<string, string | number>) => {
        Object.entries(vars || {}).forEach(([k, v]) => {
          if (k === 'ringOpacity') root.style.setProperty('--cw-ring-opacity', String(v));
          else if (k === 'ringRgb') root.style.setProperty('--cw-ring-rgb', String(v));
          else if (k === 'handleBg') root.style.setProperty('--cw-handle-bg', String(v));
          else if (k === 'handleBorder') root.style.setProperty('--cw-handle-border', String(v));
          else if (k === 'wallStroke') root.style.setProperty('--cw-wall-stroke', String(v));
          else if (k === 'handleOpacity') root.style.setProperty('--cw-handle-opacity', String(v));
          else if (k === 'wallStrokeOpacity') root.style.setProperty('--cw-wall-stroke-opacity', String(v));
          else if (k.startsWith('--')) root.style.setProperty(k, String(v));
        });
      };

      const w = window as any;
      w.cwDebug = w.cwDebug || {};
      w.cwDebug.set = (vars: Record<string, string | number>) => applyVars(vars);
      if (w.cwDebug && w.cwDebug.vars) applyVars(w.cwDebug.vars);
    } catch {
      // ignore
    }
  }, [DEBUG_UI_ENABLED]);

  return {
    debugUi,
    showSave,
    setShowSave,
    envSnippet,
    activeEnvVars,
    handleUpdateDebugUi,
    handleCopyEnvSnippet,
  };
}
