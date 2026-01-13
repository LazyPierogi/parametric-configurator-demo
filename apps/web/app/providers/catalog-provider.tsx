'use client';

import { createContext, ReactNode, useContext, useMemo } from 'react';
import type { CatalogProvider, CatalogProviderId } from '@curtain-wizard/core/src/catalog';
import { createCatalogProvider } from '@curtain-wizard/core/src/catalog';

export type CatalogProviderContextValue = {
  providerId: CatalogProviderId;
  provider: CatalogProvider;
};

const CatalogProviderContext = createContext<CatalogProviderContextValue | null>(null);

export function CatalogProviderBridge({ providerId, children }: { providerId: CatalogProviderId; children: ReactNode }) {
  // No longer need to initialize parent bridge — using direct Magento GraphQL queries

  const value = useMemo<CatalogProviderContextValue>(() => {
    return {
      providerId,
      provider: createCatalogProvider(providerId),
    };
  }, [providerId]);

  return <CatalogProviderContext.Provider value={value}>{children}</CatalogProviderContext.Provider>;
}

export function useCatalogProvider(): CatalogProviderContextValue {
  const ctx = useContext(CatalogProviderContext);
  if (!ctx) {
    throw new Error('CatalogProviderBridge is missing in the component tree.');
  }
  return ctx;
}
