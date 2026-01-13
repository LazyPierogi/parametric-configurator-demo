/**
 * Storefront parent communication bridge for Curtain Wizard ↔ Storefront
 *
 * ⚠️ DEPRECATED: This module is no longer used by the app configurator.
 * The app now queries Magento GraphQL directly via magentoClient in apps/web/lib/magento-client.ts
 *
 * This file remains for backwards compatibility with legacy embed integrations only.
 * For new code, use magentoClient instead.
 *
 * Legacy postMessage-based RPC mechanism for the configurator (delegated subdomain)
 * to request data and actions from the parent storefront.
 *
 * @deprecated Use magentoClient instead
 * @module parent-bridge
 */

import type { MagentoCartItemInput } from '@curtain-wizard/clients';
import { buildMagentoCartItems } from '@curtain-wizard/clients';
import type { StorefrontCartItem } from '@curtain-wizard/core/src/catalog';

// Environment-based configuration
const PARENT_ORIGIN =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN ?? window.location.origin)
    : '';

const DEFAULT_TIMEOUT_MS = 30000;

export type ParentBridgeAction =
  | 'getProductList'
  | 'getProducts'
  | 'addToCart'
  | 'scrollParent'
  | 'pingResponse'
  | 'configuratorExitIntent';

export type ParentAddToCartPayload = {
  cartItems: MagentoCartItemInput[];
  skus: {};
  quantities: number[];
  metadata?: unknown;
};

export type ParentBridgePayload = {
  getProductList?: {
    locale?: string;
    currency?: string;
    categoryId?: string;
  };
  getProducts?: {
    skus: string[];
    locale?: string;
  };
  addToCart?: ParentAddToCartPayload;
};

export type ParentBridgeResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type ParentMessageRequest = {
  id: string;
  source: 'curtain-wizard';
  action: ParentBridgeAction;
  payload: Record<string, unknown>;
};

export type ParentMessageResponse = {
  id: string;
  source: 'storefront';
  data?: unknown;
  error?: string;
};

export function buildParentAddToCartPayload(
  cartItem: StorefrontCartItem,
  options: {
    cartItems?: MagentoCartItemInput[];
    metadata?: unknown;
  } = {}
): ParentAddToCartPayload {
  const cartItems = options.cartItems ?? buildMagentoCartItems(cartItem);
  const skus = cartItems.map(item => ({
    parent_sku: item.parent_sku,
    child_sku: item.child_sku
  }));
  const quantities = cartItems.map((item) => item.qty);

  return {
    cartItems,
    skus,
    quantities,
    metadata: options.metadata ?? cartItem,
  };
}

/**
 * Call a method on the parent storefront window via postMessage.
 *
 * @param action - The action to invoke on the parent (e.g., 'getProductList', 'getProducts', 'addToCart')
 * @param payload - Optional payload object to send with the action
 * @param options - Optional configuration (timeout, origin override)
 * @returns Promise resolving to the parent's response data
 * @throws Error if parent doesn't respond, returns an error, or timeout expires
 *
 * @example
 * ```ts
 * const products = await callParent('getProducts', { skus: ['SKU1', 'SKU2'] });
 * ```
 */
export async function callParent<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
  options: { timeout?: number; origin?: string } = {}
): Promise<T> {
  // Guard: only run in browser
  if (typeof window === 'undefined') {
    throw new Error('callParent can only be used in browser context');
  }

  const messageId = `cw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const targetOrigin = options?.origin ?? process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN ?? '*';
  const timeout = options?.timeout ?? parseInt(process.env.NEXT_PUBLIC_STOREFRONT_TIMEOUT_MS ?? '30000', 10);
  const isDebug = process.env.NEXT_PUBLIC_CONFIGURE_DEBUG_UI === '1';

  if (isDebug) {
    console.log('[CW→Parent] Sending request:', {
      id: messageId,
      action,
      payload,
      targetOrigin,
      timestamp: new Date().toISOString()
    });
  }

  return new Promise<T>((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('message', messageHandler);
    };

    const messageHandler = (event: MessageEvent) => {
      // Verify origin if specified
      if (targetOrigin !== '*' && event.origin !== targetOrigin) {
        if (isDebug) {
          console.warn('[CW←Parent] Rejected message from untrusted origin:', {
            expected: targetOrigin,
            received: event.origin
          });
        }
        return;
      }

      const responseData = event.data;

      // Only handle matching responses for this request
      if (responseData?.id !== messageId || responseData?.source !== 'storefront') {
        if (isDebug) {
          console.debug('[CW←Parent] Skipping non-matching message', {
            expectedId: messageId,
            receivedId: responseData?.id,
            source: responseData?.source,
          });
        }
        return; // keep listener for our own response
      }

      cleanup();

      if (responseData.error) {
        if (isDebug) {
          console.error('[CW←Parent] Error response:', {
            action,
            messageId,
            error: responseData.error
          });
        }
        reject(new Error(responseData.error));
      } else {
        if (isDebug) {
          console.log('[CW←Parent] Success response:', {
            action,
            messageId,
            dataPreview: Array.isArray(responseData?.products)
              ? `${responseData.products.length} products`
              : typeof responseData === 'object'
              ? Object.keys(responseData).join(', ')
              : responseData
          });
        }
        resolve(responseData as T);
      }
    };

    window.addEventListener('message', messageHandler);

    // Send message to parent
    const request: ParentMessageRequest = {
      id: messageId,
      source: 'curtain-wizard',
      action: action as ParentBridgeAction,
      payload,
    };

    window.postMessage(request, targetOrigin);

    // Timeout handler
    timeoutId = setTimeout(() => {
      cleanup();
      if (isDebug) {
        console.error('[CW→Parent] Timeout:', {
          action,
          messageId,
          timeoutMs: timeout
        });
      }
      reject(
        new Error(
          `Timeout waiting for parent response to '${action}' after ${timeout}ms. ` +
            `Make sure the parent window at ${targetOrigin} is listening for Curtain Wizard messages.`
        )
      );
    }, timeout);
  });
}

/**
 * Check if parent communication is available (correct origin).
 * Use this to conditionally enable storefront features.
 */
export async function isParentAvailable(timeoutMs = 3000): Promise<boolean> {
  try {
    // Send a lightweight ping to parent
    await callParent('pingResponse', {}, { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}
