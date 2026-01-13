/**
 * Mock parent window for testing storefront communication
 * 
 * This mock simulates a parent storefront window that responds to Curtain Wizard
 * postMessage requests. Use it for local development and testing.
 * 
 * @usage
 * ```ts
 * // In your test setup or dev tools console:
 * import { startParentMock } from '@/lib/parent-bridge-mock';
 * const cleanup = startParentMock();
 * // ... run tests
 * cleanup(); // Stop mock
 * ```
 */

import type { StorefrontProductList, StorefrontCartResponse } from '@curtain-wizard/core/src/catalog/storefront/types';

export type ParentMockConfig = {
  /** Origin to respond from (must match NEXT_PUBLIC_STOREFRONT_ORIGIN) */
  origin?: string;
  /** Delay in ms to simulate network latency */
  latencyMs?: number;
  /** Mock product data to return */
  mockProducts?: StorefrontProductList;
  /** Simulate errors for specific actions */
  errorActions?: string[];
  /** Log all messages to console */
  debug?: boolean;
};

const DEFAULT_MOCK_PRODUCTS: StorefrontProductList = {
  products: [
    {
      sku: 'STOR-FAB-SHEER-01',
      name: 'Storefront Sheer Fabric 150',
      type: 'sheer-thin',
      price: 8500, // 85.00 PLN per linear metre
      currency: 'PLN',
      attributes: {
        fabricWidthCm: 150,
        verticalRepeatCm: 0,
        repeatType: 'straight',
        pattern: 'plain',
        colors: ['white', 'ivory', 'cream'],
        compatiblePleats: ['wave', 'tape'],
        availableHems: ['hem-1cm'],
        allowancesTopCm: 10,
        allowancesBottomCm: 10,
        shrinkagePct: 2,
        fullnessByPleat: { wave: 2.2, tape: 2.0 },
        minOrderIncrementCm: 10,
        swatchUrl: '/media/textures/plain-sheer-150-snow.webp',
        thumbnailUrls: ['/media/textures/plain-sheer-150-snow.webp'],
        textureUrl: '/media/textures/plain-sheer-150-snow.webp',
      },
    },
    {
      sku: 'STOR-FAB-LINEN-01',
      name: 'Storefront Linen Drape 300',
      type: 'drape-thick',
      price: 12900, // 129.00 PLN per linear metre
      currency: 'PLN',
      attributes: {
        fabricWidthCm: 300,
        verticalRepeatCm: 0,
        repeatType: 'straight',
        pattern: 'plain',
        colors: ['sage', 'charcoal', 'cream'],
        compatiblePleats: ['wave', 'microflex', 'tunnel'],
        availableHems: ['hem-1cm', 'hem-10cm'],
        allowancesTopCm: 10,
        allowancesBottomCm: 10,
        shrinkagePct: 2,
        fullnessByPleat: { wave: 2.2, microflex: 2.4, tunnel: 1.8 },
        minOrderIncrementCm: 10,
        swatchUrl: '/media/textures/linen-300-sage.webp',
        thumbnailUrls: ['/media/textures/linen-300-sage.webp'],
        textureUrl: '/media/textures/linen-300-sage.webp',
      },
    },
  ],
  categories: [
    { id: 'sheer-thin', name: 'Thin Sheer', description: 'Lightweight sheers' },
    { id: 'drape-thick', name: 'Thick Drape', description: 'Room-darkening drapes' },
  ],
  metadata: {
    totalCount: 2,
    currency: 'PLN',
    locale: 'pl',
  },
};

/**
 * Start a mock parent window listener
 * Returns cleanup function to stop the mock
 */
export function startParentMock(config: ParentMockConfig = {}): () => void {
  const {
    origin = process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN ?? window.location.origin,
    latencyMs = 100,
    mockProducts = DEFAULT_MOCK_PRODUCTS,
    errorActions = [],
    debug = false,
  } = config;

  const listener = async (event: MessageEvent) => {
    // Only respond to messages from our iframe
    if (!event.data || event.data.source !== 'curtain-wizard') {
      return;
    }

    const { id, action, payload } = event.data;

    if (debug) {
      console.log('[Parent Mock] Received:', { id, action, payload });
    }

    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, latencyMs));

    // Simulate errors for specific actions
    if (errorActions.includes(action)) {
      const errorResponse = {
        id,
        source: 'storefront',
        error: `Mock error for action: ${action}`,
      };

      if (debug) {
        console.log('[Parent Mock] Sending error:', errorResponse);
      }

      event.source?.postMessage(errorResponse, { targetOrigin: event.origin } as any);
      return;
    }

    // Handle different actions
    let responseData: unknown = null;

    switch (action) {
      case 'getProductList':
        responseData = mockProducts;
        break;

      case 'getProducts': {
        const skus = (payload as any)?.skus ?? [];
        const products = mockProducts.products.filter((p) => skus.includes(p.sku));
        responseData = { products, categories: mockProducts.categories };
        break;
      }

      case 'getPriceQuote': {
        // Return a basic quote - in real implementation, parent would calculate this
        responseData = {
          currency: 'PLN',
          subtotalMinor: 0,
          totalMinor: 0,
          breakdown: [
            {
              id: 'note',
              label: 'Price calculated at checkout',
              amountMinor: 0,
              currency: 'PLN',
              type: 'base',
            },
          ],
        };
        break;
      }

      case 'addToCart': {
        const cartResponse: StorefrontCartResponse = {
          success: true,
          cartId: 'mock-cart-123',
          items: ((payload as any)?.skus ?? []).map((sku: string, idx: number) => ({
            sku,
            quantity: ((payload as any)?.quantities ?? [])[idx] ?? 1,
          })),
          metadata: {
            mockParent: true,
            receivedPayload: payload,
          },
        };
        responseData = cartResponse;
        break;
      }

      default:
        if (debug) {
          console.warn('[Parent Mock] Unknown action:', action);
        }
        event.source?.postMessage(
          {
            id,
            source: 'storefront',
            error: `Unknown action: ${action}`,
          },
          { targetOrigin: event.origin } as any
        );
        return;
    }

    const response = {
      id,
      source: 'storefront',
      data: responseData,
    };

    if (debug) {
      console.log('[Parent Mock] Sending response:', response);
    }

    event.source?.postMessage(response, { targetOrigin: event.origin } as any);
  };

  window.addEventListener('message', listener);

  if (debug) {
    console.log('[Parent Mock] Started with origin:', origin);
  }

  // Return cleanup function
  return () => {
    window.removeEventListener('message', listener);
    if (debug) {
      console.log('[Parent Mock] Stopped');
    }
  };
}

/**
 * Quick helper to start mock in console
 * 
 * @example
 * ```
 * // In browser console:
 * window.__startParentMock?.()
 * ```
 */
if (typeof window !== 'undefined') {
  (window as any).__startParentMock = (config?: ParentMockConfig) => {
    console.log('Starting parent mock with config:', config);
    return startParentMock({ debug: true, ...config });
  };
}
