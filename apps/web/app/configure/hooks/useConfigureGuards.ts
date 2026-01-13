"use client";

import { useEffect, useRef } from 'react';

type ConfigureGuardsArgs = {
  enableBeforeUnload: boolean;
  enableBackGuard: boolean;
  enableIframeResize: boolean;
  parentOrigin: string;
};

export function useConfigureGuards({
  enableBeforeUnload,
  enableBackGuard,
  enableIframeResize,
  parentOrigin,
}: ConfigureGuardsArgs) {
  // Store handler ref so we can remove it from outside the hook
  const beforeUnloadHandlerRef = useRef<((event: BeforeUnloadEvent) => void) | null>(null);

  // beforeunload warning (Curtain-first only)
  useEffect(() => {
    if (!enableBeforeUnload) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    beforeUnloadHandlerRef.current = handler;
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      beforeUnloadHandlerRef.current = null;
    };
  }, [enableBeforeUnload]);

  // Expose cleanup function on window for programmatic removal
  useEffect(() => {
    (window as any).__cwDisableBeforeUnload = () => {
      if (beforeUnloadHandlerRef.current) {
        window.removeEventListener('beforeunload', beforeUnloadHandlerRef.current);
        beforeUnloadHandlerRef.current = null;
      }
    };
    return () => {
      delete (window as any).__cwDisableBeforeUnload;
    };
  }, []);

  // Back-button interception (Curtain-first only)
  const backButtonInterceptedRef = useRef(false);
  const guardUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enableBackGuard) {
      backButtonInterceptedRef.current = false;
      guardUrlRef.current = null;
      return;
    }

    if (!backButtonInterceptedRef.current) {
      guardUrlRef.current = window.location.href;
      window.history.pushState({ cwConfigureGuard: true }, '', guardUrlRef.current);
      backButtonInterceptedRef.current = true;
    }

    const onPopState = (_event: PopStateEvent) => {
      if (!backButtonInterceptedRef.current) return;
      const guardUrl = guardUrlRef.current;
      if (guardUrl) {
        window.history.pushState({ cwConfigureGuard: true }, '', guardUrl);
      } else {
        window.history.pushState({ cwConfigureGuard: true }, '', window.location.href);
      }
      const customEvent = new CustomEvent('cw-configure-back');
      window.dispatchEvent(customEvent);
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      backButtonInterceptedRef.current = false;
      guardUrlRef.current = null;
    };
  }, [enableBackGuard]);

  // Iframe height sync (legacy embed support)
  useEffect(() => {
    if (!enableIframeResize) return;

    const sendHeight = () => {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ source: 'curtain-wizard', type: 'configuratorHeight', height }, parentOrigin);
    };

    const initial = window.requestAnimationFrame(sendHeight);
    window.addEventListener('load', sendHeight);
    window.addEventListener('resize', sendHeight);

    const resizeObserver = new ResizeObserver(sendHeight);
    resizeObserver.observe(document.body);

    return () => {
      window.removeEventListener('load', sendHeight);
      window.removeEventListener('resize', sendHeight);
      resizeObserver.disconnect();
      window.cancelAnimationFrame(initial);
    };
  }, [enableIframeResize, parentOrigin]);
}
