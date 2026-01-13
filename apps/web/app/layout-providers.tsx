'use client';

import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { CatalogProviderBridge } from '@/app/providers/catalog-provider';
import { LocaleProvider } from '@/app/providers/locale-context';
import { PaletteProvider } from '@/lib/palette-context';
import { GlobalPaletteDebug } from '@/components/debug/GlobalPaletteDebug';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
 import { APP_VERSION } from '@/lib/version';
import { checkVersionAndRefresh, clearVersionTracking } from '@/lib/version-check';
import { clearMeasurementCache } from '@/lib/measurement-cache';
import { clearSegmentCache } from '@/lib/segment-cache';
import { clearFlowState } from '@/lib/flow-state';
import { STORAGE_KEYS } from '@/lib/storage-keys';
import { defaultLocale } from '@curtain-wizard/core/src/i18n';
import { toast } from 'react-hot-toast';
import type { ReactNode } from 'react';
import type { CatalogProviderId } from '@curtain-wizard/core/src/catalog';

/**
 * LayoutProviders
 * 
 * All client-side providers and UI elements wrapped in a single 'use client' component.
 * This separates client logic from the server layout component.
 */
export function LayoutProviders({ 
  children,
  catalogProvider = 'mock'
}: { 
  children: ReactNode;
  catalogProvider?: CatalogProviderId;
}) {
  const debugUIEnabled = (process.env.NEXT_PUBLIC_CONFIGURE_DEBUG_UI || '').toLowerCase() === 'true' || 
                          (process.env.NEXT_PUBLIC_CONFIGURE_DEBUG_UI || '') === '1';

  // Check for version mismatch (stale cache) and force refresh if needed
  // Also handle ?clear-cache=1 URL parameter for manual cache clearing
  useEffect(() => {
    // Handle manual cache clearing via URL parameter
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('clear-cache') === '1') {
        (async () => {
          try {
            // Clear all client-side caches
            clearMeasurementCache();
            await clearSegmentCache();
            clearFlowState();
            clearVersionTracking();
            
            // Clear sessionStorage items (versioned keys)
            try { 
              sessionStorage.removeItem(STORAGE_KEYS.LAST_UPLOADED);
              // Also clear old non-versioned keys for migration
              sessionStorage.removeItem('cw-lastUploadedKey');
              sessionStorage.removeItem('cw_last_uploaded_segment_key_v1');
            } catch {}
            
            // Clear localStorage items (versioned keys)
            try {
              localStorage.removeItem(STORAGE_KEYS.PALETTE_PREFERENCE);
              localStorage.removeItem(STORAGE_KEYS.MEASUREMENT_OBSERVATIONS);
              localStorage.removeItem(STORAGE_KEYS.LOCALE_PREFERENCE);
              localStorage.removeItem(STORAGE_KEYS.WELCOME_DISMISSED);
              // Also clear old non-versioned keys for migration
              localStorage.removeItem('cw-palette-preference');
              localStorage.removeItem('cw-measurement-observations');
              localStorage.removeItem('cw-locale');
              localStorage.removeItem('configure-welcome-seen');
            } catch {}
            
            // Clear cwDebug runtime state if it exists
            try {
              const w = window as any;
              if (w.cwDebug) {
                w.cwDebug = {};
              }
            } catch {}
            
            toast.success('Wyczyszczono wszystkie lokalne cache (włącznie z paletą i debug)');
            
            // Remove the parameter from URL without refresh
            url.searchParams.delete('clear-cache');
            window.history.replaceState({}, '', url.toString());
          } catch (e) {
            console.warn('[CW] Failed to clear caches:', e);
            toast.error('Błąd przy czyszczeniu cache');
          }
        })();
        return; // Skip version check when clearing cache
      }
    }
    
    // Only check version in production - in dev hot reload can cause hydration mismatches
    if (process.env.NODE_ENV === 'production') {
      checkVersionAndRefresh();
    } else {
      // In development, show version info in console for debugging
      console.log(`[CW Dev] Version: ${APP_VERSION}`);
    }
  }, []);

  return (
    <>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <PaletteProvider persistToStorage={true}>
        <CatalogProviderBridge providerId={catalogProvider}>
          <LocaleProvider initialLocale={defaultLocale}>
            <div className="fixed top-3 right-4 z-toast">
              <LanguageSwitcher />
            </div>
            {debugUIEnabled && <GlobalPaletteDebug />}
            {children}
          </LocaleProvider>
        </CatalogProviderBridge>
      </PaletteProvider>
    </>
  );
}
