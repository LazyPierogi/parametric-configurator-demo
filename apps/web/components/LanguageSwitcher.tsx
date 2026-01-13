'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from '@/app/providers/locale-context';
import { supportedLocales } from '@curtain-wizard/core/src/i18n';

const localeNativeNames: Record<string, string> = {
  en: 'English',
  pl: 'Polski',
  uk: 'Українська',
};

export function LanguageSwitcher() {
  const { locale, setLocale, t, prefetchLocale } = useLocale();
  const options = useMemo(() => supportedLocales.map((code) => ({ code, label: localeNativeNames[code] ?? code })), []);

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, []);

  const current = options.find((o) => o.code === locale) ?? options[0];

  return (
    <div ref={rootRef} className="relative inline-block">
      {/* Visually hidden label for a11y */}
      <span className="sr-only">
        {t('language.switcherLabel')}
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => { options.filter(o => o.code !== locale).forEach(o => prefetchLocale(o.code as typeof supportedLocales[number])); }}
        onFocus={() => { options.filter(o => o.code !== locale).forEach(o => prefetchLocale(o.code as typeof supportedLocales[number])); }}
        className="inline-flex items-center gap-2 px-2.5 py-2 rounded-full border border-active-border bg-white text-xs text-active-text cursor-pointer min-w-[44px] min-h-[36px] hover:bg-neutral-50 transition-colors"
      >
        <span className="font-semibold">{current.label}</span>
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 7l5 5 5-5" stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div 
          role="listbox" 
          aria-label={t('language.switcherLabel')} 
          className="absolute right-0 mt-1.5 bg-white border border-neutral-200 rounded-lg shadow-lg min-w-[180px] z-dropdown p-1.5"
        >
          {options.map((opt) => (
            <button
              key={opt.code}
              role="option"
              aria-selected={opt.code === locale}
              onMouseEnter={() => { if (opt.code !== locale) prefetchLocale(opt.code as typeof supportedLocales[number]); }}
              onFocus={() => { if (opt.code !== locale) prefetchLocale(opt.code as typeof supportedLocales[number]); }}
              onClick={() => { setLocale(opt.code as typeof supportedLocales[number]); setOpen(false); }}
              className={`w-full text-left px-3 py-2.5 rounded-lg border-none cursor-pointer text-xs text-neutral-900 transition-colors ${
                opt.code === locale ? 'bg-active-accent/10 text-active-text' : 'hover:bg-neutral-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
