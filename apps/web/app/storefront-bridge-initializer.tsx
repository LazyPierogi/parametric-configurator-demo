'use client';

import { useEffect } from 'react';
import { initStorefrontBridge } from '@/lib/storefront-bridge';

/**
 * Client-side component that initializes the StorefrontBridge
 * This runs only in the browser and sets up postMessage communication
 */
export function StorefrontBridgeInitializer() {
  useEffect(() => {
    const apiUrl =
      process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT ||
      process.env.NEXT_PUBLIC_MAGENTO_GRAPHQL_URL ||
      '';

    const trustedOriginsRaw =
      process.env.NEXT_PUBLIC_STOREFRONT_TRUSTED_ORIGINS ||
      process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN ||
      '';
    const trustedOrigins = trustedOriginsRaw
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    // Initialize the storefront bridge
    const bridge = initStorefrontBridge({
      apiUrl,
      trustedOrigins,
      debug: process.env.NEXT_PUBLIC_DEBUG === 'true',
    });

    if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
      console.log('StorefrontBridge initialized');
    }

    // Return cleanup if needed
    return () => {
      // Add cleanup logic here if necessary
    };
  }, []);

  // This component doesn't render anything
  return null;
}
