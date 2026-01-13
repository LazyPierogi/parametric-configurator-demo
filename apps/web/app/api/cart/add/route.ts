/**
 * Cart API endpoint - currently unused by Configure page
 * 
 * NOTE: As of the Configure page refactor, cart operations happen client-side
 * by calling provider.toCartPayload() directly in the browser context.
 * 
 * This route is preserved for:
 * - Future server-side cart operations
 * - Direct API access (e.g., from external tools or services)
 * - Reference implementation
 * 
 * For storefront provider, this route will fail on line 41 because
 * StorefrontCatalogProvider.toCartPayload() requires browser/iframe context.
 * Use mock provider for server-side testing.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loadEnv } from '@curtain-wizard/shared/src/env';
import { createCatalogProvider, type CatalogProviderId, type CurtainConfig } from '@curtain-wizard/core/src/catalog';
import { buildAddToCartMutation, MagentoGraphqlClient } from '@curtain-wizard/clients/src/magento';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  providerId: z.union([z.literal('mock'), z.literal('storefront')]).optional(),
  cartId: z.string().optional(),
  totalPriceMinor: z.number().optional(),
  config: z.object({
    fabricId: z.string(),
    pleatId: z.string(),
    hemId: z.string(),
    colorId: z.string().optional(),
    widthCm: z.number(),
    heightCm: z.number(),
    segments: z.number().min(1),
    segmentWidthsCm: z.array(z.number()).optional(),
    materialReuseEnabled: z.boolean().optional(),
    services: z.array(z.string()),
    locale: z.string().optional(),
    currency: z.string().optional(),
    extras: z.record(z.unknown()).optional(),
  }) satisfies z.ZodType<CurtainConfig>,
});

function resolveProviderId(envProvider: CatalogProviderId, requested?: CatalogProviderId): CatalogProviderId {
  return requested ?? envProvider;
}

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json());
    const env = loadEnv();
    const providerId = resolveProviderId(env.CATALOG_PROVIDER, body.providerId);
    const provider = createCatalogProvider(providerId);

    const cartItem = await provider.toCartPayload(body.config);
    const cartId = body.cartId ?? env.STOREFRONT_MAGENTO_CART_ID ?? 'guest-cart';

    const { mutation, variables } = buildAddToCartMutation(cartItem, cartId, body.totalPriceMinor);

    // Storefront mode: client-side will handle cart via parent postMessage
    // Server-side just returns the payload for client to forward
    if (providerId === 'storefront') {
      return NextResponse.json({
        mode: 'storefront',
        cartItem,
        note: 'Storefront mode: client should call parent.addToCart with cartItem payload.',
        useParentBridge: true,
      });
    }

    if (providerId === 'mock' || !env.STOREFRONT_MAGENTO_URL) {
      return NextResponse.json({
        mode: providerId,
        cartItem,
        mutation,
        variables,
        note: providerId === 'mock'
          ? 'Mock provider: skipped Magento GraphQL call.'
          : 'STOREFRONT_MAGENTO_URL not configured; returning payload only.',
      });
    }

    const client = new MagentoGraphqlClient({
      endpoint: env.STOREFRONT_MAGENTO_URL,
      accessToken: env.STOREFRONT_MAGENTO_TOKEN,
    });

    const data = await client.request(mutation, variables);

    return NextResponse.json({
      mode: providerId,
      cartItem,
      mutation,
      variables,
      magento: data,
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Failed to add to cart';
    const status = error?.name === 'ZodError' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
