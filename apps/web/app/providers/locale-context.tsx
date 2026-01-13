'use client';

import { createContext, useContext, useMemo, useState, useEffect, ReactNode, useCallback } from 'react';
import { defaultLocale } from '@curtain-wizard/core/src/i18n';
import type { SupportedLocale } from '@curtain-wizard/core/src/i18n';
import { supportedLocales } from '@curtain-wizard/core/src/i18n';
import { STORAGE_KEYS } from '@/lib/storage-keys';

export type LocaleContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  prefetchLocale: (locale: SupportedLocale) => Promise<void>;
  isLoading: boolean;
};

const storageKey = STORAGE_KEYS.LOCALE_PREFERENCE;

const LocaleContext = createContext<LocaleContextValue | null>(null);

const localeSet = new Set<SupportedLocale>(supportedLocales);

export function LocaleProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: SupportedLocale }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(initialLocale ?? defaultLocale);
  const [bundles, setBundles] = useState<Partial<Record<SupportedLocale, Record<string, string>>>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadLocale = useCallback(async (loc: SupportedLocale) => {
    if (bundles[loc]) return; // already loaded
    try {
      const res = await fetch(`/api/i18n/${loc}`);
      if (!res.ok) throw new Error('failed');
      const json = (await res.json()) as Record<string, string>;
      setBundles((prev) => ({ ...prev, [loc]: json }));
    } catch {
      // noop; fallback will cover using default locale strings
    }
  }, [bundles]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (async () => {
      setIsLoading(true);
      let chosen: SupportedLocale = initialLocale ?? defaultLocale;
      try {
        const paramsLocale = new URL(window.location.href).searchParams.get('lang') as SupportedLocale | null;
        if (paramsLocale && localeSet.has(paramsLocale)) {
          chosen = paramsLocale;
          window.localStorage.setItem(storageKey, paramsLocale);
        } else {
          const saved = window.localStorage.getItem(storageKey) as SupportedLocale | null;
          if (saved && localeSet.has(saved)) {
            chosen = saved;
          }
        }
      } catch {}
      setLocaleState(chosen);
      // Load default locale first for immediate fallback
      await loadLocale(defaultLocale);
      // If chosen is different, load it in parallel
      if (chosen !== defaultLocale) {
        await loadLocale(chosen);
      }
      setIsLoading(false);
    })();
  }, [initialLocale, loadLocale]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next: SupportedLocale) => {
    setLocaleState(next);
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(storageKey, next); } catch {}
      const url = new URL(window.location.href);
      url.searchParams.set('lang', next);
      window.history.replaceState({}, '', url.toString());
    }
    void loadLocale(next);
  };

  const t = (key: string, vars?: Record<string, string | number>) => {
    const current = bundles[locale] ?? {};
    const fallback = bundles[defaultLocale] ?? {};
    const value = current[key] ?? fallback[key] ?? key;
    if (!vars) return value;
    return Object.entries(vars).reduce((acc, [token, val]) => acc.replace(new RegExp(`{${token}}`, 'g'), String(val)), value);
  };

  const prefetchLocale = useCallback(async (loc: SupportedLocale) => {
    await loadLocale(loc);
  }, [loadLocale]);

  const value = useMemo(() => ({ locale, setLocale, t, prefetchLocale, isLoading }), [locale, t, prefetchLocale, isLoading]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('LocaleProvider is missing in component tree');
  }
  return ctx;
}
