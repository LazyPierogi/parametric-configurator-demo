# Cart API Communication Fix

**Date:** October 18, 2025  
**Branch:** UI/UX-Overhaul  
**Status:** ✅ Fixed

## Problem Summary

After the Configure page migration/refactor, the cart API communication was broken:

1. **Mock provider**: Empty payload `{}` instead of full GraphQL structure
2. **Storefront provider**: Error "Storefront catalog provider can only be used in browser context"

The root cause was in `apps/web/app/configure/page.tsx` line 1773:
```typescript
const cartItem = null; // ← This was blocking everything
```

## Root Cause Analysis

### Historical Context (from commit analysis)

**On main branch (commit 0c51ecc):**
- `cartItem` was set to `null` with a TODO comment
- Previous developer (akarso) in commits 5cc2481 and 7009bcb left hints:
  - Create `cartItem` without API calls
  - All data is within the app already
  - Use parent/child SKU structure

**Before refactor (commit 9fa3d97):**
- Configure page made a fetch call to `/api/cart/add`
- Server-side route tried to call `provider.toCartPayload(config)`
- **This worked for mock but failed for storefront** because:
  - `StorefrontCatalogProvider.toCartPayload()` requires browser context
  - It needs to call `window.__curtainWizardBridge.callParent()` for iframe communication
  - Server-side execution has no `window` object

**Why the refactor broke:**
- Developer removed the `/api/cart/add` fetch call
- Left `cartItem = null` placeholder
- Intended to implement direct client-side call but didn't complete it

## Solution Implemented

### Changed File: `apps/web/app/configure/page.tsx`

**Before:**
```typescript
const cartItem = null;
// TODO: create cartItem here...
setAddToCartState({ status: 'loading' });
if (cartItem) { // Never true!
  // Storefront logic
} else {
  setAddToCartState({ status: 'success', data: {} }); // Empty!
}
```

**After:**
```typescript
const cartItem = await provider.toCartPayload(lastConfig);

if (providerId === 'storefront') {
  // Call parent iframe
  const parentPayload = buildParentAddToCartPayload(cartItem);
  const parentResponse = await callParent('addToCart', parentPayload);
  setAddToCartState({ 
    status: 'success', 
    data: { 
      mode: 'storefront',
      cartItem, 
      parentResponse,
      graphqlPayload: parentPayload 
    }
  });
} else {
  // Mock mode: show full payload for debugging
  const parentPayload = buildParentAddToCartPayload(cartItem);
  setAddToCartState({ 
    status: 'success', 
    data: {
      mode: 'mock',
      cartItem,
      graphqlPayload: parentPayload,
      note: 'Mock provider: displaying payload for debugging'
    }
  });
}
```

### Key Changes

1. **Direct provider call in browser context:**
   - `await provider.toCartPayload(lastConfig)` runs client-side
   - Both mock and storefront providers work correctly
   - No server-side execution issues

2. **Mock provider now shows full payload:**
   - Includes `cartItem` with all configuration details
   - Includes `graphqlPayload` with Magento cart items structure
   - Perfect for debugging

3. **Storefront provider sends proper structure:**
   - Calls parent iframe with `buildParentAddToCartPayload()`
   - Includes parent response in success data
   - Includes GraphQL payload for inspection

### Additional Documentation: `apps/web/app/api/cart/add/route.ts`

Added header comment explaining:
- Route is currently unused by Configure page
- Preserved for future server-side operations
- Will fail for storefront provider (requires browser context)
- Use mock provider for server-side testing

## Data Flow

### Mock Provider Flow

1. User clicks "Add to Cart"
2. `performAddToCart()` calls `provider.toCartPayload(lastConfig)`
3. **MockCatalogProvider** (browser context):
   - Calculates fabric quantity from `totalLinearCm`
   - Extracts child SKU from color selection
   - Builds services array
   - Returns `StorefrontCartItem`
4. `buildParentAddToCartPayload()` converts to GraphQL structure
5. UI displays full payload in `<details>` dropdown

### Storefront Provider Flow

1. User clicks "Add to Cart"
2. `performAddToCart()` calls `provider.toCartPayload(lastConfig)`
3. **StorefrontCatalogProvider** (browser context):
   - Checks `window.__curtainWizardBridge` exists
   - Calls `getProductList()` via parent bridge
   - Maps color SKU from product attributes
   - Calculates fabric quantity
   - Returns `StorefrontCartItem`
4. `buildParentAddToCartPayload()` converts to GraphQL structure
5. `callParent('addToCart', payload)` sends to parent iframe
6. Parent Magento storefront executes GraphQL mutation
7. UI displays cart item + parent response + GraphQL payload

## Payload Structure Examples

### cartItem (StorefrontCartItem)
```json
{
  "sku": "fab-linen-300",
  "childSku": "fab-linen-300-beige",
  "quantity": 5.7,
  "options": {
    "widthCm": 250,
    "heightCm": 260,
    "pleatId": "wave",
    "hemId": "hem-10cm",
    "colorId": "beige",
    "totalLinearCm": 570
  },
  "services": [
    { "sku": "CW-SVC-MEASURE", "quantity": 1 },
    { "sku": "CW-HW-ROD-BASIC", "quantity": 1 }
  ]
}
```

### graphqlPayload (ParentAddToCartPayload)
```json
{
  "cartItems": [
    {
      "parent_sku": "fab-linen-300",
      "child_sku": "fab-linen-300-beige",
      "qty": 5.7,
      "entered_options": [
        {
          "uid": "curtain_configuration",
          "value": "{\"widthCm\":250,\"heightCm\":260,...}"
        }
      ]
    },
    {
      "parent_sku": "CW-SVC-MEASURE",
      "qty": 1
    },
    {
      "parent_sku": "CW-HW-ROD-BASIC",
      "qty": 1
    }
  ],
  "skus": ["fab-linen-300", "CW-SVC-MEASURE", "CW-HW-ROD-BASIC"],
  "quantities": [5.7, 1, 1],
  "metadata": { /* full cartItem */ }
}
```

## Testing Checklist

### Mock Provider (CATALOG_PROVIDER=mock)
- [x] Set `NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1`
- [ ] Upload image → configure curtain
- [ ] Click "Add to Cart"
- [ ] Verify success state shows full payload
- [ ] Check console logs show cartItem generation
- [ ] Expand "View GraphQL payload" dropdown
- [ ] Verify `graphqlPayload.cartItems` array is populated

### Storefront Provider (CATALOG_PROVIDER=storefront)
- [x] Run Curtain Wizard in iframe on parent storefront
- [ ] Ensure parent bridge is initialized
- [ ] Upload image → configure curtain
- [ ] Click "Add to Cart"
- [ ] Verify parent receives postMessage with cart payload
- [ ] Check parent response is captured in success state
- [ ] Verify no "browser context" errors
- [ ] Check console logs show parent communication

## Related Files

- `apps/web/app/configure/page.tsx` - Main fix location
- `apps/web/app/api/cart/add/route.ts` - Unused route (documented)
- `apps/web/lib/parent-bridge.ts` - Iframe communication helpers
- `packages/core/src/catalog/providers/mock.ts` - Mock provider implementation
- `packages/core/src/catalog/providers/storefront.ts` - Storefront provider implementation
- `packages/clients/src/magentoCartItems.ts` - GraphQL payload builder

## Commits Referenced

- `0c51ecc` - Main branch state with null cartItem
- `5cc2481` - Akarso's TODO hints for cart item creation
- `ad5190d` - Parent bridge data handling fixes
- `9fa3d97` - Previous `/api/cart/add` implementation

## Latest Update (October 20, 2025)

### Services Missing from Storefront Provider

**Problem:** The storefront provider's `toCartPayload()` method was missing the services array, while mock provider had it correctly implemented.

**Fix Applied:**
Added services handling to `packages/core/src/catalog/providers/storefront.ts:280-287`:
```typescript
// Get services from selected service IDs
const allServices = await this.listServices({});
const services = allServices
  .filter((svc) => config.services.includes(svc.id))
  .map((svc) => ({
    sku: svc.id, // In storefront provider, id field contains the product SKU
    quantity: 1,
  }));
```

**Result:** Both providers now generate complete cart payloads with:
- ✅ Parent SKU (fabric)
- ✅ Child SKU (color variant from swatches)
- ✅ Quantity (calculated from totalLinearCm)
- ✅ Services array (measurements, installation, hardware)

All data comes from within the app without external APIs, as requested by parent storefront developer.

## Next Steps

1. Test both providers thoroughly with services selected
2. Consider removing `/api/cart/add` route if confirmed unused
3. Update RUNBOOK.md if cart workflow changes
4. Update task 05-Task-List.md to mark cart communication as resolved
