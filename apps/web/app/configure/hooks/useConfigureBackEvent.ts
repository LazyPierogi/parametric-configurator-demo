"use client";

import { useEffect, useRef } from 'react';

export function useConfigureBackEvent(onBack: () => void, enabled: boolean = true) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled) return;

    const handler = (_event: Event) => {
      onBackRef.current();
    };

    window.addEventListener('cw-configure-back', handler);
    return () => {
      window.removeEventListener('cw-configure-back', handler);
    };
  }, [enabled]);
}
