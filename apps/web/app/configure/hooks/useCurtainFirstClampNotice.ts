import { useCallback, useEffect, useRef, useState } from 'react';

export type ClampNotice = { type: 'height' | 'width'; message: string } | null;

export function useCurtainFirstClampNotice(): {
  clampNotice: ClampNotice;
  notifyClamp: (type: 'height' | 'width', message: string) => void;
} {
  const [clampNotice, setClampNotice] = useState<ClampNotice>(null);
  const lastClampToastRef = useRef<{ height: number; width: number }>({ height: 0, width: 0 });
  const clampHideTimerRef = useRef<number | null>(null);

  const notifyClamp = useCallback(
    (type: 'height' | 'width', message: string) => {
      const now = Date.now();
      if (now - lastClampToastRef.current[type] < 5000) {
        console.debug('[clamp] notify suppressed (cooldown)', { type, message, last: lastClampToastRef.current[type], now });
        return;
      }
      lastClampToastRef.current[type] = now;
      console.debug('[clamp] notify scheduled', { type, message, now });
      setClampNotice({ type, message });
    },
    [setClampNotice]
  );

  useEffect(() => {
    if (clampNotice) {
      console.debug('[clamp] notice set', clampNotice);
    }
    if (typeof window === 'undefined') return;
    if (!clampNotice) {
      if (clampHideTimerRef.current != null) {
        window.clearTimeout(clampHideTimerRef.current);
        clampHideTimerRef.current = null;
      }
      return undefined;
    }
    if (clampHideTimerRef.current != null) {
      window.clearTimeout(clampHideTimerRef.current);
    }
    const id = window.setTimeout(() => {
      setClampNotice(null);
      clampHideTimerRef.current = null;
      console.debug('[clamp] notice cleared');
    }, 2000);
    clampHideTimerRef.current = id;
    return () => {
      window.clearTimeout(id);
      if (clampHideTimerRef.current === id) {
        clampHideTimerRef.current = null;
      }
    };
  }, [clampNotice]);

  return { clampNotice, notifyClamp };
}
