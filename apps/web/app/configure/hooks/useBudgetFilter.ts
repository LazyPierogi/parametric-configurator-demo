import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CatalogFilter } from '@curtain-wizard/core/src/catalog';

type UseBudgetFilterParams = {
  min?: number;
  max?: number;
  throttleMs?: number;
};

type UseBudgetFilterResult = {
  bounds: { min: number; max: number };
  uiRange: [number, number];
  committedRange: [number, number];
  setUiRange: (next: [number, number]) => void;
  commitRange: (next: [number, number]) => void;
  isNoFilterUi: boolean;
  isAnyPriceUi: boolean;
  catalogFilter: CatalogFilter;
};

export function useBudgetFilter({ min = 55, max = 300, throttleMs = 120 }: UseBudgetFilterParams = {}): UseBudgetFilterResult {
  const [committedRange, setCommittedRange] = useState<[number, number]>([min, max]);
  const [uiRange, setUiRangeState] = useState<[number, number]>([min, max]);
  const throttleRef = useRef<{ last: number; timer: number | null }>({ last: 0, timer: null });

  useEffect(() => {
    setUiRangeState(committedRange);
  }, [committedRange]);

  useEffect(() => {
    const [uiMin, uiMax] = uiRange;
    const [committedMin, committedMax] = committedRange;
    if (uiMin === committedMin && uiMax === committedMax) return;
    if (typeof window === 'undefined') return;

    const now = Date.now();
    const elapsed = now - throttleRef.current.last;

    const commit = () => {
      throttleRef.current.last = Date.now();
      const nextMin = Math.min(uiMin, uiMax);
      const nextMax = Math.max(uiMin, uiMax);
      setCommittedRange([nextMin, nextMax]);
    };

    if (elapsed >= throttleMs) {
      commit();
    } else {
      if (throttleRef.current.timer != null) {
        window.clearTimeout(throttleRef.current.timer);
      }
      throttleRef.current.timer = window.setTimeout(() => {
        throttleRef.current.timer = null;
        commit();
      }, Math.max(0, throttleMs - elapsed));
    }

    return () => {
      if (throttleRef.current.timer != null) {
        window.clearTimeout(throttleRef.current.timer);
        throttleRef.current.timer = null;
      }
    };
  }, [committedRange, uiRange, throttleMs]);

  const setUiRange = useCallback((next: [number, number]) => {
    setUiRangeState(next);
  }, []);

  const commitRange = useCallback((next: [number, number]) => {
    const [rawMin, rawMax] = next;
    const sorted: [number, number] = [Math.min(rawMin, rawMax), Math.max(rawMin, rawMax)];
    setCommittedRange(sorted);
    setUiRangeState(sorted);
  }, []);

  const isNoFilterCommitted = useMemo(
    () => committedRange[0] <= min && committedRange[1] >= max,
    [committedRange, min, max],
  );

  const isNoFilterUi = useMemo(
    () => uiRange[0] <= min && uiRange[1] >= max,
    [uiRange, min, max],
  );

  const isAnyPriceUi = useMemo(() => uiRange[1] >= max, [uiRange, max]);

  const catalogFilter = useMemo<CatalogFilter>(() => {
    if (isNoFilterCommitted) return {};
    const [loRaw, hiRaw] = committedRange;
    const lo = Math.max(0, Math.min(loRaw, hiRaw));
    const hi = Math.max(0, Math.max(loRaw, hiRaw));
    const minMinor = lo * 100;
    const maxMinor = hi >= max ? Number.MAX_SAFE_INTEGER / 10 : hi * 100;
    return { priceRangeMinor: { min: minMinor, max: Math.floor(maxMinor) } };
  }, [committedRange, isNoFilterCommitted, max]);

  return {
    bounds: { min, max },
    uiRange,
    committedRange,
    setUiRange,
    commitRange,
    isNoFilterUi,
    isAnyPriceUi,
    catalogFilter,
  };
}
