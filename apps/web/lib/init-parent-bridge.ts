/**
 * Initialize parent bridge for storefront communication
 * 
 * ⚠️ DEPRECATED: This module is no longer used by the app.
 * The app now queries Magento GraphQL directly via magentoClient in apps/web/lib/magento-client.ts
 *
 * This file remains for backwards compatibility with legacy embed integrations only.
 * 
 * Legacy: This script exposed the callParent function to the global window object
 * so it could be accessed by the storefront catalog provider in iframe mode.
 * 
 * @deprecated Use magentoClient instead
 */

import { callParent, isParentAvailable } from './parent-bridge';

function isInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.parent !== window && window.parent !== null;
  } catch {
    return false;
  }
}

declare global {
  interface Window {
    __curtainWizardBridge?: {
      callParent: typeof callParent;
      isParentAvailable: typeof isParentAvailable;
      // Backwards-compatible: some embed consumers expect `isInIframe`
      isInIframe?: typeof isInIframe;
      initialized: boolean;
    };
  }
}

/**
 * Initialize the parent bridge communication layer
 * Safe to call multiple times (will only initialize once)
 */
export function initParentBridge(): void {
  if (typeof window === 'undefined') {
    return; // Server-side, skip
  }

  const isDebug = process.env.NEXT_PUBLIC_CONFIGURE_DEBUG_UI === '1';

  if (window.__curtainWizardBridge?.initialized) {
    if (isDebug) {
      console.log('[ParentBridge] Already initialized, skipping');
    }
    return; // Already initialized
  }

  window.__curtainWizardBridge = {
    callParent,
    isParentAvailable,
    // expose legacy helper for consumers that still check iframe status
    isInIframe,
    initialized: true,
  };

  if (isDebug) {
    // Note: parent availability may depend on runtime environment (delegated subdomain)
    (async () => {
      const available = await isParentAvailable(2000).catch(() => false);
      console.log('[ParentBridge] ✓ Initialized', {
        parentAvailable: available,
        parentOrigin: process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN,
        timeout: process.env.NEXT_PUBLIC_STOREFRONT_TIMEOUT_MS,
        timestamp: new Date().toISOString()
      });
    })();
  }
}

/**
 * Check if parent bridge is available and ready
 */
export function isParentBridgeReady(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(window.__curtainWizardBridge?.initialized);
}
