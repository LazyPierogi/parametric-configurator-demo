"use client";

import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import type { CatalogProvider, CurtainConfig } from '@curtain-wizard/core/src/catalog';
import type { AddToCartState, TranslateFn } from '../types';

const STOREFRONT_CART_URL = process.env.NEXT_PUBLIC_STOREFRONT_CART_URL ?? null;

type UseCurtainFirstAddToCartArgs = {
  provider: CatalogProvider;
  providerId: string | null;
  lastConfig: CurtainConfig | null;
  coverageRatio: number;
  canAddToCart: boolean;
  t: TranslateFn;
  routerPush: (href: string) => void;
  addToCartState: AddToCartState;
  setAddToCartState: Dispatch<SetStateAction<AddToCartState>>;
};

export type UseCurtainFirstAddToCartResult = {
  showCoverageWarning: boolean;
  addToCartDisabled: boolean;
  handleAddToCart: (totalPriceMinor?: number) => void;
  handleResetAddToCart: () => void;
  handleCoverageConfirm: () => void;
  handleCoverageCancel: () => void;
};

export function useCurtainFirstAddToCartState(): {
  addToCartState: AddToCartState;
  setAddToCartState: Dispatch<SetStateAction<AddToCartState>>;
} {
  const [addToCartState, setAddToCartState] = useState<AddToCartState>({ status: 'idle' });
  return { addToCartState, setAddToCartState };
}

export function useCurtainFirstAddToCart({
  provider,
  providerId,
  lastConfig,
  coverageRatio,
  canAddToCart,
  t,
  routerPush,
  addToCartState,
  setAddToCartState,
}: UseCurtainFirstAddToCartArgs): UseCurtainFirstAddToCartResult {
  const [showCoverageWarning, setShowCoverageWarning] = useState(false);
  const [pendingTotalPriceMinor, setPendingTotalPriceMinor] = useState<number | undefined>();

  const addToCartDisabled = useMemo(() => {
    return addToCartState.status === 'loading' || !canAddToCart;
  }, [addToCartState.status, canAddToCart]);

  const performAddToCart = useCallback(async (totalPriceMinor?: number) => {
    if (!lastConfig) {
      toast.error(t('configure.toastNotReady'));
      return;
    }

    const isDebug = process.env.NEXT_PUBLIC_CONFIGURE_DEBUG_UI === '1';
    setAddToCartState({ status: 'loading' });

    try {
      if (isDebug) {
        console.log('[Configure] Generating cart payload from provider:', {
          providerId,
          config: lastConfig,
          timestamp: new Date().toISOString(),
        });
      }

      const cartItem = await provider.toCartPayload(lastConfig);

      if (isDebug) {
        console.log('[Configure] Cart item generated:', cartItem);
      }

      if (providerId === 'storefront') {
        if (isDebug) {
          console.log('[Configure] Storefront mode detected, adding to cart via Magento client:', {
            cartItem,
            timestamp: new Date().toISOString(),
          });
        }

        const { magentoClient, buildMagentoCartItems } = await import('@/lib/magento-client');

        try {
          const magentoItems = buildMagentoCartItems(cartItem, totalPriceMinor);

          if (isDebug) {
            console.log('[Configure] Built Magento cart items:', magentoItems);
          }

          const result = await magentoClient.addToCart(magentoItems);

          if (isDebug) {
            console.log('[Configure] Add to cart response from Magento:', result);
          }

          setAddToCartState({
            status: 'success',
            data: {
              mode: 'storefront',
              cartItem,
              magentoResponse: result,
            },
          });
          toast.success(t('configure.toastAdded'));

          setTimeout(() => {
            if (typeof (window as any).__cwDisableBeforeUnload === 'function') {
              (window as any).__cwDisableBeforeUnload();
            }
            const cartId = typeof localStorage !== 'undefined' ? localStorage.getItem('cart_id') : null;
            if (!STOREFRONT_CART_URL || !cartId) return;
            const href = STOREFRONT_CART_URL
              .replaceAll('{cartId}', encodeURIComponent(cartId))
              .replaceAll('{cart_id}', encodeURIComponent(cartId));
            routerPush(href);
          }, 2);
        } catch (magentoError: any) {
          const message = magentoError?.message ?? t('configure.toastFailed');
          setAddToCartState({ status: 'error', message });
          toast.error(message);
          if (isDebug) {
            console.error('[Configure] Magento add to cart error:', magentoError);
          }
          throw magentoError;
        }
      } else {
        if (isDebug) {
          console.log('[Configure] Mock mode, cart payload:', cartItem);
        }

        setAddToCartState({
          status: 'success',
          data: {
            mode: 'mock',
            cartItem,
            note: 'Mock provider: displaying payload for debugging',
          },
        });
        toast.success(t('configure.toastAdded'));
      }
    } catch (err: any) {
      const message = err?.message ?? t('configure.toastFailed');
      setAddToCartState({ status: 'error', message });
      toast.error(message);

      const isDebug = process.env.NEXT_PUBLIC_CONFIGURE_DEBUG_UI === '1';
      if (isDebug) {
        console.error('[Configure] Add to cart error:', err);
      }
    }
  }, [lastConfig, provider, providerId, routerPush, t]);

  const handleAddToCart = useCallback((totalPriceMinor?: number) => {
    const coveragePct = Math.round(coverageRatio * 100);
    if (coveragePct < 95 && !showCoverageWarning) {
      setPendingTotalPriceMinor(totalPriceMinor);
      setShowCoverageWarning(true);
      return;
    }
    setShowCoverageWarning(false);
    void performAddToCart(totalPriceMinor);
  }, [coverageRatio, performAddToCart, showCoverageWarning]);

  const handleCoverageConfirm = useCallback(() => {
    setShowCoverageWarning(false);
    void performAddToCart(pendingTotalPriceMinor);
    setPendingTotalPriceMinor(undefined);
  }, [performAddToCart, pendingTotalPriceMinor]);

  const handleCoverageCancel = useCallback(() => {
    setShowCoverageWarning(false);
    setPendingTotalPriceMinor(undefined);
  }, []);

  const handleResetAddToCart = useCallback(() => {
    setAddToCartState({ status: 'idle' });
  }, []);

  return {
    showCoverageWarning,
    addToCartDisabled,
    handleAddToCart,
    handleResetAddToCart,
    handleCoverageConfirm,
    handleCoverageCancel,
  };
}
