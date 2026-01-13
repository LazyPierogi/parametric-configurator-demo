# Storefront Integration Troubleshooting

**How to diagnose and fix issues with parent storefront communication**

---

## Current Issue: productList is undefined

### Error

```
TypeError: Cannot read properties of undefined (reading 'categories')
at extractFabricTypes (storefront/mappers.ts:71:19)
```

### Root Cause

The parent storefront's `getProductList` response handler is returning `undefined` or malformed data instead of a proper `StorefrontProductList` object.

---

## Diagnostic Steps

### 1. Enable Debug Logs

```bash
# In .env.production or platform environment variables
NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1
```

Rebuild and check console for detailed logs showing exactly what the parent returns.

### 2. Check Parent Response Format

The parent **MUST** return data in this exact format:

```typescript
{
  products: [
    {
      sku: "fabric-001",
      name: "Fabric Name",
      priceMinor: 15000,  // Price in minor units (cents)
      currency: "PLN",
      thumbnails: ["https://..."],
      attributes: {
        fabricWidthCm: 140,
        // ... other attributes
      }
    }
  ],
  categories: [  // Optional
    {
      id: "light",
      name: "Light",
      description: "..."
    }
  ],
  metadata: {
    locale: "pl",
    currency: "PLN",
    totalCount: 25
  }
}
```

### 3. Check Parent Listener Code

In your storefront's `parent-listener.js` (or equivalent):

```javascript
// ❌ WRONG - returns undefined
window.addEventListener('message', (event) => {
  if (event.data.action === 'getProductList') {
    fetchProducts().then(data => {
      // Missing window.postMessage!
    });
  }
});

// ✅ CORRECT - returns data
window.addEventListener('message', (event) => {
  if (event.data.action === 'getProductList') {
    fetchProducts().then(products => {
      window.frames[0].postMessage({
        id: event.data.id,
        source: 'storefront',
        data: {
          products: products,
          metadata: { locale: 'pl', currency: 'PLN' }
        }
      }, event.origin);
    });
  }
});
```

---

## Common Issues & Fixes

### Issue 1: Parent returns `undefined`

**Symptoms:**
```
[StorefrontProvider] Product list received: {
  type: "undefined",
  isNull: false,
  isUndefined: true
}
```

**Cause:** Parent listener forgot to call `postMessage` with response.

**Fix:** Ensure parent sends response:
```javascript
window.frames[0].postMessage({
  id: messageId,
  source: 'storefront',
  data: productList  // ← Must include this!
}, origin);
```

---

### Issue 2: Parent returns empty object `{}`

**Symptoms:**
```
[StorefrontProvider] Missing or invalid products array: {}
```

**Cause:** Parent sends response but without `products` array.

**Fix:** Structure response correctly:
```javascript
const response = {
  products: await fetchProductsFromMagento(),
  metadata: { locale, currency }
};
```

---

### Issue 3: Products array is null/undefined

**Symptoms:**
```
[StorefrontProvider] Missing or invalid products array: { products: null }
```

**Cause:** GraphQL query failed or returned null.

**Fix:** Add error handling in parent:
```javascript
try {
  const result = await graphqlQuery(...);
  if (!result?.data?.products) {
    throw new Error('No products in GraphQL response');
  }
  return result.data.products;
} catch (error) {
  console.error('[Parent] GraphQL error:', error);
  // Send error back to iframe
  window.frames[0].postMessage({
    id: messageId,
    source: 'storefront',
    error: error.message
  }, origin);
}
```

---

### Issue 4: Wrong message origin

**Symptoms:**
```
[CW←Parent] Rejected message from untrusted origin: {
  expected: "https://www.zaslony.com",
  received: "http://localhost:3001"
}
```

**Cause:** Origin mismatch between config and actual parent.

**Fix:** Match origins exactly:
```bash
# Development
NEXT_PUBLIC_STOREFRONT_ORIGIN=http://localhost:3001

# Production
NEXT_PUBLIC_STOREFRONT_ORIGIN=https://www.zaslony.com
```

**Or** use wildcard (less secure):
```bash
NEXT_PUBLIC_STOREFRONT_ORIGIN=*
```

---

## Defensive Code Added

We've added defensive checks to handle malformed responses gracefully:

### In `storefront/mappers.ts`:
- Validates `productList` is not null/undefined
- Validates `products` array exists
- Returns fallback data if invalid
- Logs errors for debugging

### In `storefront.ts` provider:
- Validates response structure before caching
- Logs detailed response info when debug enabled
- Throws clear error messages
- Prevents crashes from bad data

---

## Testing Parent Integration

### 1. Test with Mock Parent

```javascript
// In browser console on storefront page
window.addEventListener('message', (event) => {
  if (event.data.source === 'curtain-wizard' && event.data.action === 'getProductList') {
    console.log('[Mock Parent] Received request:', event.data);
    
    // Send mock response
    event.source.postMessage({
      id: event.data.id,
      source: 'storefront',
      data: {
        products: [
          {
            sku: 'test-001',
            name: 'Test Fabric',
            priceMinor: 10000,
            currency: 'PLN',
            thumbnails: ['https://via.placeholder.com/150'],
            attributes: { fabricWidthCm: 140 }
          }
        ],
        metadata: { locale: 'pl', currency: 'PLN', totalCount: 1 }
      }
    }, event.origin);
  }
});
```

### 2. Verify Response in Iframe

With `NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1`, check console:

```
[CW→Parent] Sending request: { action: "getProductList", ... }
[CW←Parent] Success response: { productCount: 1 }
[StorefrontProvider] Product list received: { productCount: 1, ... }
```

---

## Reference Implementation

### Minimal Parent Listener

```javascript
// parent-listener.js
const CONFIG = {
  iframeOrigin: 'https://curtain-wizard.vercel.app',
  debug: true,
};

window.addEventListener('message', async (event) => {
  // Verify origin
  if (event.origin !== CONFIG.iframeOrigin) {
    if (CONFIG.debug) console.warn('[Parent] Rejected message from:', event.origin);
    return;
  }

  const { id, source, action, payload } = event.data;

  // Only handle curtain-wizard messages
  if (source !== 'curtain-wizard') return;

  if (CONFIG.debug) {
    console.log('[Parent] Received:', { action, payload });
  }

  try {
    let responseData;

    if (action === 'getProductList') {
      // Fetch from your backend
      const products = await fetchProductsFromMagento(payload.locale, payload.currency);
      
      responseData = {
        products: products,
        metadata: {
          locale: payload.locale || 'pl',
          currency: payload.currency || 'PLN',
          totalCount: products.length,
        },
      };
    }

    // Send response back to iframe
    event.source.postMessage(
      {
        id: id,
        source: 'storefront',
        data: responseData,
      },
      event.origin
    );

    if (CONFIG.debug) {
      console.log('[Parent] Sent response:', responseData);
    }
  } catch (error) {
    console.error('[Parent] Error:', error);
    
    // Send error response
    event.source.postMessage(
      {
        id: id,
        source: 'storefront',
        error: error.message,
      },
      event.origin
    );
  }
});
```

---

## Quick Fix Checklist

When you get "Cannot read properties of undefined":

1. ✅ Enable debug logs (`NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1`)
2. ✅ Check what parent actually returns (look for `[StorefrontProvider] Product list received`)
3. ✅ Verify parent listener calls `postMessage` with response
4. ✅ Verify response has `{ products: [...] }` structure
5. ✅ Check origin matches exactly (no trailing slashes!)
6. ✅ Test with mock parent listener first
7. ✅ Check parent console for errors
8. ✅ Verify GraphQL query returns data

---

## Expected Flow

```
1. [CW→Parent] Sending request: getProductList
2. [Parent] Received: getProductList
3. [Parent] Fetching from Magento...
4. [Parent] Sent response: { products: [25 items] }
5. [CW←Parent] Success response: 25 products
6. [StorefrontProvider] Product list received: 25 products
7. [Mappers] extractFabricTypes: 3 categories
✅ Configurator loads successfully
```

---

**Next:** After fixing the response format, remove debug logs and test in production!
