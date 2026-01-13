# Parent Bridge TODOs from Storefront Developer

**Date:** October 18, 2025  
**Developer:** akarso  
**Status:** ✅ Services Fixed (Oct 20), ⚠️ Message ID Issue Remains

## Issue: Message ID Coherence

**File:** `apps/web/lib/parent-bridge.ts` lines 149-152

### Current Code
```typescript
// Check if this is a response to our message
if (responseData?.id !== messageId || responseData?.source !== 'storefront') {
  //return;  // ← Commented out!
}
// TODO - make message ids coherent, right now we have this part called 6 times 
// and each one with different messageId, so message handler works only once
```

### Problem

The message ID validation is **commented out**, which means:

1. **No filtering:** All messages from parent are processed, regardless of ID
2. **Race conditions:** If multiple requests are in flight, any parent response will resolve the first waiting promise
3. **Wrong resolution:** Request A might get response for Request B

### Why It Was Commented Out

From commit `20ed3cb` (Oct 15, 2025):
- Parent developer found that "this part called 6 times with different messageId"
- Message handler was only working once
- Temporarily disabled validation to make it work at all

### Root Cause Analysis

The issue isn't in Curtain Wizard code - it's likely in the **parent storefront implementation**:

1. Parent storefront receives postMessage with ID
2. Parent responds with different ID (or no ID)
3. Message validation fails
4. Promise never resolves

### Proper Fix (Needs Parent Storefront Changes)

**Option 1: Fix parent storefront to echo ID**
```typescript
// Parent storefront should do:
window.addEventListener('message', (event) => {
  const { id, action, payload } = event.data;
  
  // Process request...
  const result = await handleAction(action, payload);
  
  // Echo the same ID back
  event.source.postMessage({
    id: id,  // ← SAME ID from request
    source: 'storefront',
    data: result
  }, event.origin);
});
```

**Option 2: Ignore IDs entirely (current workaround)**
```typescript
// If parent can't send IDs back, just trust all messages:
if (responseData?.source !== 'storefront') {
  return;  // Only check source, not ID
}
```

### Security Implications

Without ID validation:
- ✅ Multiple parallel requests to **different actions** should work (different message handlers)
- ⚠️ Multiple parallel requests to **same action** might resolve wrong promises
- ❌ Malicious parent could send fake responses

### Recommended Actions

1. **Test the current workaround:**
   - Send multiple `getProducts` calls simultaneously
   - Send `getProductList` + `addToCart` in parallel
   - Verify each promise resolves with correct data

2. **If workaround fails:**
   - Work with parent storefront developer
   - Ensure parent echoes request IDs in responses
   - Re-enable validation on line 150

3. **If workaround works:**
   - Document the limitation
   - Add comment explaining why validation is disabled
   - Consider sequence numbers instead of random IDs

### Related Commits

- `20ed3cb` - Initial TODO and validation disable
- `249ed0f` - Follow-up data handling fixes
- `ad5190d` - More parent bridge adjustments

### Testing Scenarios

```typescript
// Test 1: Sequential calls (should work)
const products1 = await callParent('getProducts', { skus: ['SKU1'] });
const products2 = await callParent('getProducts', { skus: ['SKU2'] });

// Test 2: Parallel calls to different actions (should work)
const [list, products] = await Promise.all([
  callParent('getProductList', {}),
  callParent('getProducts', { skus: ['SKU1'] })
]);

// Test 3: Parallel calls to same action (MIGHT FAIL)
const [products1, products2] = await Promise.all([
  callParent('getProducts', { skus: ['SKU1'] }),
  callParent('getProducts', { skus: ['SKU2'] })
]);
```

## Other Parent Bridge Observations

### Data Handling Fix (commit ad5190d)
```typescript
// Before:
resolve(responseData.products as T);

// After:
resolve(responseData as T);
```

This was needed because parent returns different shapes:
- `getProductList` → `{ products: [...] }`
- `getProducts` → `{ products: [...] }`
- `addToCart` → direct response object

The fix lets caller handle the shape instead of assuming `.products` exists.

## Summary

The parent bridge currently works with validation disabled. This is acceptable for:
- ✅ Single iframe instance
- ✅ Sequential requests
- ✅ Low-security environment (trusted parent)

But NOT acceptable for:
- ❌ Production security requirements
- ❌ Multiple parallel requests to same action
- ❌ Untrusted parent window

**Recommendation:** Keep current workaround for development, but coordinate with parent storefront developer to implement proper ID echoing before production deployment.

## Issue: Services Missing from Cart Payload

**Date Fixed:** October 20, 2025  
**Status:** ✅ Fixed

### Problem
Parent storefront developer noticed that the `addToCart` payload was missing services (measurement, installation, hardware) in the `cartItems` array. Only the fabric (parent + child SKU) was being sent.

### Root Cause
The storefront provider's `toCartPayload()` method at `packages/core/src/catalog/providers/storefront.ts:257` was not including services, while the mock provider had correct implementation.

### Fix Applied
Added services handling (lines 280-287):
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

Then included in return object:
```typescript
return {
  sku: config.fabricId,
  childSku,
  quantity: fabricQuantity,
  options: { /* ... */ },
  services: services.length ? services : undefined, // ← Added
  providerMetadata: { /* ... */ },
};
```

### Result
Parent now receives complete cart payload with all selected items:
- ✅ Fabric (parent SKU + child SKU from color swatch)
- ✅ Measurement service (e.g., `CW-SVC-MEASURE`)
- ✅ Hardware (e.g., `CW-HW-ROD-BASIC`)
- ✅ Installation service (e.g., `CW-SVC-INSTALL`)

All data comes from within the app without external API calls, exactly as requested by the parent developer.
