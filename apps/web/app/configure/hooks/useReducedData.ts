"use client";

import { useEffect, useState } from 'react';

export function useReducedData(): boolean {
  const [reducedData, setReducedData] = useState(false);

  useEffect(() => {
    try {
      const sd = typeof navigator !== 'undefined' && (navigator as any).connection?.saveData === true;
      const prd =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-data: reduce)').matches;
      setReducedData(Boolean(sd || prd));
    } catch {
      setReducedData(false);
    }
  }, []);

  return reducedData;
}
