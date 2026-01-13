# Storefront Integration Guide — Curtain Wizard ↔ Magento

**Last Updated:** 2025-12-16  
**Status:** Production Ready  
**Task Reference:** #950

---

## Overview

This document describes the integration between Curtain Wizard (configurator) and the Magento storefront at `https://www.zaslony.com`.

**Current Architecture (Subpage Mode):**
- **Curtain Wizard** runs as a subpage on the storefront domain (not an iframe)
- **Product data** is fetched directly via Magento GraphQL API (`magentoClient` in `apps/web/lib/magento-client.ts`)
- **Cart operations** use Magento GraphQL mutations directly
- **No postMessage required** — the app has direct access to Magento APIs

**Legacy Architecture (Iframe Mode — Deprecated):**
- Curtain Wizard ran as an iframe child embedded in the parent storefront
- Communication happened via `postMessage` API (see `apps/web/lib/parent-bridge.ts` — deprecated)
- Product data flowed from parent → child via postMessage relay

> **Note:** The iframe/postMessage approach is deprecated. The `parent-bridge.ts` and `storefront-bridge.ts` files remain for backwards compatibility but are no longer used in production.

---

## Communication Protocol

### Message Format

**Child → Parent (Request):**
```typescript
{
  id: string;              // Unique message ID (timestamp + random)
  source: 'curtain-wizard'; // Identifies sender
  action: string;          // Action name (see below)
  payload: object;         // Action-specific data
}
```

**Parent → Child (Response):**
```typescript
{
  id: string;              // Same ID as request (for correlation)
  source: 'storefront';    // Identifies sender
  data?: any;              // Response data (if successful)
  error?: string;          // Error message (if failed)
}
```

### Supported Actions

| Action | Description | Payload | Response |
|--------|-------------|---------|----------|
| `getProductList` | Fetch all fabrics | `{ locale?, currency? }` | `StorefrontProductList` |
| `getProducts` | Fetch specific fabrics by SKU | `{ skus: string[] }` | `StorefrontProductList` |
| `getPriceQuote` | Calculate price for config (optional) | `{ config: CurtainConfig }` | `PriceQuote` |
| `addToCart` | Add configured curtain to cart | `{ skus: string[], quantities: number[], metadata }` | `StorefrontCartResponse` |

### Security

- **Origin checking:** Both sides verify `event.origin` matches expected domain
- **Message ID correlation:** Responses must include matching request ID
- **Source verification:** Messages must identify their source (`curtain-wizard` or `storefront`)
- **Timeout:** Requests timeout after 15 seconds (configurable)

---

## Magento Product Structure

Based on actual Magento GraphQL response format:

### ConfigurableProduct (Fabric with Color Variants)

```json
{
  "sku": "test1-parent",
  "name": "Test Fabric",
  "__typename": "ConfigurableProduct",
  "variants": [
    {
      "product": {
        "sku": "test1-child-white",
        "name": "Test Fabric - White",
        "color": 10,
        "price_range": {
          "maximum_price": {
            "final_price": {
              "currency": "PLN",
              "value": 240
            }
          }
        },
        "__typename": "SimpleProduct"
      }
    }
  ]
}
```

### Mapping to Curtain Wizard Types

| Magento Field | Maps To | Notes |
|---------------|---------|-------|
| `sku` (parent) | `Fabric.id` | Use parent SKU as fabric ID |
| `name` | `Fabric.name` | Fabric display name |
| `variants[].product.sku` | Color variant SKU | For cart operations |
| `variants[].product.color` | Color option ID | Numeric color code |
| `price_range.maximum_price.final_price.value` | `pricePerMLinearMinor` | Price in minor units (grosze) |

**Important:** Prices in Magento are in full currency units (PLN). Curtain Wizard uses minor units (grosze). Conversion: `priceMinor = priceValue * 100`.

---

## Parent-Side Implementation

### Quick Start: Use the Ready-Made Script

The easiest way to integrate is to use the provided parent listener script:

1. **Copy** `scripts/parent-listener.js` to your storefront
2. **Configure** the origin and Magento settings
3. **Include** it on pages with the iframe:

```html
<!-- On your storefront page -->
<script src="/path/to/parent-listener.js"></script>
<iframe 
  src="https://your-wizard-domain.com/configure" 
  allow="clipboard-write"
  style="width: 100%; height: 100vh; border: none;"
></iframe>
```

See `docs/STOREFRONT-QUICKSTART.md` for step-by-step instructions.

### Manual Implementation

If you prefer to implement the listener yourself:

### 1. Embed Curtain Wizard Iframe

```html
<iframe 
  src="https://your-wizard-domain.com/configure" 
  allow="clipboard-write"
  style="width: 100%; height: 100vh; border: none;"
></iframe>
```

### 2. Implement Message Listener

```javascript
window.addEventListener('message', async function(event) {
  // Security: Verify origin
  if (event.origin !== 'https://your-wizard-domain.com') {
    console.warn('Rejected message from untrusted origin:', event.origin);
    return;
  }

  const { id, source, action, payload } = event.data || {};
  
  // Verify source
  if (source !== 'curtain-wizard') return;

  console.log('[Storefront] Received action:', action, payload);

  try {
    let responseData;

    switch (action) {
      case 'getProductList':
        // Fetch fabrics from Magento GraphQL
        responseData = await fetchMagentoProducts(payload.locale, payload.currency);
        break;

      case 'getProducts':
        // Fetch specific products by SKU
        responseData = await fetchMagentoProductsBySku(payload.skus);
        break;

      case 'getPriceQuote':
        // Optional: calculate price on parent side
        // Or let Curtain Wizard handle it (recommended)
        responseData = {
          currency: 'PLN',
          subtotalMinor: 0,
          totalMinor: 0,
          breakdown: [],
          note: 'Price calculated in Curtain Wizard'
        };
        break;

      case 'addToCart':
        // Add items to Magento cart
        const cartResult = await addToMagentoCart(
          payload.skus,
          payload.quantities,
          payload.metadata
        );
        responseData = {
          success: true,
          cartId: cartResult.cartId,
          items: cartResult.items
        };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Send success response
    event.source.postMessage({
      id,
      source: 'storefront',
      data: responseData
    }, event.origin);

  } catch (error) {
    // Send error response
    console.error('[Storefront] Error handling action:', action, error);
    event.source.postMessage({
      id,
      source: 'storefront',
      error: error.message || 'Internal error'
    }, event.origin);
  }
});

console.log('[Storefront] Curtain Wizard message listener initialized');
```

### 3. Fetch Products from Magento

```javascript
async function fetchMagentoProducts(locale = 'pl', currency = 'PLN') {
  // Your Magento GraphQL query
  const query = `
    query GetFabrics {
      products(filter: { category_id: { eq: "123" } }) {
        items {
          sku
          name
          __typename
          ... on ConfigurableProduct {
            variants {
              product {
                sku
                name
                color
                price_range {
                  maximum_price {
                    final_price {
                      currency
                      value
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch('https://www.zaslony.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  const result = await response.json();

  // Transform to Curtain Wizard format
  return {
    products: result.data.products.items.map(transformMagentoProduct),
    metadata: { locale, currency, totalCount: result.data.products.items.length }
  };
}

function transformMagentoProduct(magentoProduct) {
  if (magentoProduct.__typename === 'ConfigurableProduct') {
    // Extract colors from variants
    const colors = magentoProduct.variants.map(v => v.product.color);
    const firstVariant = magentoProduct.variants[0]?.product;

    return {
      sku: magentoProduct.sku,
      name: magentoProduct.name,
      type: 'fabric', // Or derive from category
      price: firstVariant?.price_range.maximum_price.final_price.value * 100, // Convert to minor
      currency: firstVariant?.price_range.maximum_price.final_price.currency || 'PLN',
      attributes: {
        colors: colors,
        // Add other fabric attributes from Magento custom attributes
        fabricWidthCm: 150, // From Magento attribute
        // ... other attributes
      },
      metadata: {
        variants: magentoProduct.variants
      }
    };
  }

  // Handle SimpleProduct
  return {
    sku: magentoProduct.sku,
    name: magentoProduct.name,
    // ...
  };
}
```

---

## Curtain Wizard Configuration

### Environment Variables

```bash
# Enable storefront mode
CATALOG_PROVIDER=storefront

# Parent domain (security - must match!)
NEXT_PUBLIC_STOREFRONT_ORIGIN=https://www.zaslony.com

# Response timeout (milliseconds)
NEXT_PUBLIC_STOREFRONT_TIMEOUT_MS=30000
```

### Initialization

The parent bridge initializes automatically when `CATALOG_PROVIDER=storefront`. No additional setup needed in Curtain Wizard code.

### Route Entrypoint

Curtain Wizard uses Next.js App Router file-based routing. The file `apps/web/app/configure/page.tsx` exports the `ConfigurePage` component, and Next.js automatically mounts it at `/configure`. No manual import is required anywhere else in the project; embedding the iframe at `https://your-wizard-domain.com/configure` loads this page.

---

## Testing

### Local Testing (Mock Parent)

```bash
# 1. Set environment
echo "CATALOG_PROVIDER=storefront" >> .env.local
echo "NEXT_PUBLIC_STOREFRONT_ORIGIN=https://www.zaslony.com" >> .env.local

# 2. Start dev server
npm run dev

# 3. Open http://localhost:3000/configure
# 4. Open browser console and run:
window.__startParentMock()

# 5. Use configurator - it fetches from mock
```

### Testing with Real Magento

Use the test script to connect to production Magento:

```bash
node scripts/test-storefront-connection.mjs
```

This script will:
1. Open a local server with a mock parent page
2. Embed Curtain Wizard iframe
3. Implement the message listener
4. Fetch real data from https://www.zaslony.com

---

## Data Flow

### 1. Product List Flow

```
User opens configurator
  ↓
Curtain Wizard calls getProductList
  ↓
Parent fetches from Magento GraphQL
  ↓
Parent transforms to Curtain Wizard format
  ↓
Parent sends products via postMessage
  ↓
Curtain Wizard displays fabrics in UI
```

### 2. Add to Cart Flow

```
User configures curtain
  ↓
User clicks "Add to Cart"
  ↓
Curtain Wizard calls /api/cart/add (internal)
  ↓
API detects storefront mode
  ↓
Curtain Wizard calls parent.addToCart
  ↓
Parent adds to Magento cart
  ↓
Parent confirms via postMessage
  ↓
Curtain Wizard shows success
```

---

## Troubleshooting

### Issue: "Parent bridge not available"

**Cause:** Curtain Wizard is not running inside an iframe, or parent bridge failed to initialize.

**Solution:**
- Verify Curtain Wizard is embedded as iframe
- Check `NEXT_PUBLIC_STOREFRONT_ORIGIN` matches parent domain
- Open console and check for initialization logs

### Issue: "Timeout waiting for parent response"

**Cause:** Parent is not responding to messages, or origin mismatch.

**Solution:**
- Verify parent message listener is running
- Check origin verification on both sides
- Increase timeout: `NEXT_PUBLIC_STOREFRONT_TIMEOUT_MS=30000`
- Check browser console for errors on both parent and child

### Issue: Products not loading

**Cause:** Parent is not sending correct product format.

**Solution:**
- Check parent console for GraphQL errors
- Verify product transformation logic
- Compare response against `StorefrontProductList` type
- Use browser DevTools Network tab to inspect messages

---

## API Reference

### StorefrontProduct Type

```typescript
type StorefrontProduct = {
  sku: string;              // Parent or child SKU
  name: string;             // Display name
  type?: string;            // Category or fabric type
  price?: number;           // Price in minor units (grosze)
  currency?: string;        // Currency code (PLN)
  attributes?: {
    fabricWidthCm?: number;
    verticalRepeatCm?: number;
    repeatType?: 'straight' | 'half-drop';
    pattern?: string;
    colors?: string[];      // Color option IDs
    compatiblePleats?: string[];
    availableHems?: string[];
    swatchUrl?: string;
    thumbnailUrls?: string[];
    textureUrl?: string;
    textureByColor?: Record<string, string>;
  };
  metadata?: Record<string, unknown>; // Magento-specific data
};
```

### StorefrontProductList Type

```typescript
type StorefrontProductList = {
  products: StorefrontProduct[];
  categories?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  metadata?: {
    totalCount?: number;
    currency?: string;
    locale?: string;
  };
};
```

### StorefrontCartResponse Type

```typescript
type StorefrontCartResponse = {
  success: boolean;
  cartId?: string;
  items?: Array<{
    sku: string;
    quantity: number;
  }>;
  error?: string;
  metadata?: Record<string, unknown>;
};
```

---

## Implementation Files

### Communication Layer
- `apps/web/lib/parent-bridge.ts` — Core `callParent()` function
- `apps/web/lib/init-parent-bridge.ts` — Browser initialization
- `apps/web/lib/parent-bridge-mock.ts` — Development mock

### Catalog Provider
- `packages/core/src/catalog/providers/storefront.ts` — Provider implementation
- `packages/core/src/catalog/storefront/types.ts` — TypeScript types
- `packages/core/src/catalog/storefront/mappers.ts` — Data transformation

### Integration Points
- `apps/web/app/providers/catalog-provider.tsx` — Bridge initialization
- `apps/web/app/configure/page.tsx` — Cart communication
- `apps/web/app/api/cart/add/route.ts` — Server-side detection

### Testing & Documentation
- `scripts/test-parent-bridge.mjs` — Manual testing guide
- `scripts/test-storefront-connection.mjs` — Real Magento connection test
- `docs/Proposed Magento Response Format.md` — Actual API response example

---

## Next Steps

1. **Deploy Curtain Wizard** to a domain accessible by Magento
2. **Implement parent listener** on https://www.zaslony.com
3. **Test product fetching** with real Magento GraphQL
4. **Verify cart integration** end-to-end
5. **Add custom attributes** mapping for fabric specifications

---

## Support

For questions or issues:
- Review browser console logs (both parent and child windows)
- Check `docs/Proposed Magento Response Format.md` for API structure
- Run `node scripts/test-storefront-connection.mjs` for diagnostics
- See `project planning/05-Task-List.md` section 950 for implementation details
