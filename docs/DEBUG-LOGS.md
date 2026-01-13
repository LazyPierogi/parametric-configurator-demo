# Debug Logs — Storefront Communication

**Complete guide to debugging Curtain Wizard ↔ Storefront communication**

---

## ⚙️ Enable Debug Logs

Debug logs are **disabled by default** in production. To enable them, set:

```bash
# In .env.local or environment variables
NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1
```

Then restart your dev server or rebuild for production.

**Note:** Without this flag, all storefront communication logs are suppressed for cleaner production console output.

---

## Console Log Prefixes

All storefront communication logs use consistent prefixes for easy filtering:

| Prefix | Direction | Description |
|--------|-----------|-------------|
| `[ParentBridge]` | Initialization | Bridge setup and configuration |
| `[CW→Parent]` | Outgoing | Curtain Wizard sending request to parent |
| `[CW←Parent]` | Incoming | Curtain Wizard receiving response from parent |
| `[StorefrontProvider]` | Provider | Catalog provider operations |
| `[Configure]` | UI | Configure page cart operations |

---

## Communication Flow Logs

### 1. Initialization

**When:** App loads with `CATALOG_PROVIDER=storefront`

```javascript
[ParentBridge] ✓ Initialized {
  isInIframe: true,
  parentOrigin: "https://www.zaslony.com",
  timeout: "30000",
  timestamp: "2025-10-07T10:00:00.000Z"
}
```

**What it means:**
- ✅ Parent bridge is ready
- ✅ Running in iframe
- ✅ Will communicate with specified origin
- ✅ 15-second timeout configured

---

### 2. Product List Request

**When:** Configurator loads and needs product data

```javascript
// Step 1: Provider decides to fetch
[StorefrontProvider] Fetching product list from parent: {
  filter: { locale: "pl", currency: "PLN" },
  cached: false
}

// Step 2: Bridge sends request
[CW→Parent] Sending request: {
  id: "cw-1696680000000-abc123",
  action: "getProductList",
  payload: { locale: "pl", currency: "PLN" },
  targetOrigin: "https://www.zaslony.com",
  timestamp: "2025-10-07T10:00:00.000Z"
}

// Step 3: Parent responds (success)
[CW←Parent] Success response: {
  action: "getProductList",
  messageId: "cw-1696680000000-abc123",
  dataPreview: "25 products"
}

// Step 4: Provider processes response
[StorefrontProvider] Product list received: {
  productCount: 25,
  categories: 3,
  metadata: { locale: "pl", currency: "PLN", totalCount: 25 }
}
```

**What it means:**
- ✅ Request sent successfully
- ✅ Parent responded within timeout
- ✅ 25 products received
- ✅ Data cached for future use

---

### 3. Cached Product Access

**When:** Subsequent catalog queries use cached data

```javascript
[StorefrontProvider] Using cached product list: {
  productCount: 25,
  cached: true
}
```

**What it means:**
- ✅ No parent communication needed
- ✅ Using previously fetched data
- ✅ Faster performance

---

### 4. Add to Cart

**When:** User clicks "Add to Cart"

```javascript
// Step 1: Configure page detects storefront mode
[Configure] Storefront mode detected, calling parent addToCart: {
  cartItem: {
    sku: "fabric-123",
    quantity: 2,
    options: { widthCm: 300, heightCm: 250, ... }
  },
  timestamp: "2025-10-07T10:05:00.000Z"
}

// Step 2: Prepare cart payload
[Configure] Sending to parent: {
  skus: ["fabric-123"],
  quantities: [1],
  hasMetadata: true
}

// Step 3: Bridge sends request
[CW→Parent] Sending request: {
  id: "cw-1696680300000-xyz789",
  action: "addToCart",
  payload: {
    skus: ["fabric-123"],
    quantities: [1],
    metadata: { ... }
  },
  targetOrigin: "https://www.zaslony.com",
  timestamp: "2025-10-07T10:05:00.000Z"
}

// Step 4: Parent responds
[CW←Parent] Success response: {
  action: "addToCart",
  messageId: "cw-1696680300000-xyz789",
  dataPreview: "success, cartId, items"
}

// Step 5: Configure page confirms
[Configure] Parent cart response received: {
  success: true,
  cartId: "magento-cart-123",
  items: [{ sku: "fabric-123", quantity: 1 }]
}
```

**What it means:**
- ✅ Cart item sent to parent
- ✅ Parent added to Magento cart
- ✅ Confirmation received
- ✅ User sees success message

---

## Error Scenarios

### Timeout Error

```javascript
[CW→Parent] Timeout: {
  action: "getProductList",
  messageId: "cw-1696680000000-abc123",
  timeoutMs: 30000
}
```

**Cause:** Parent didn't respond within 15 seconds

**Solutions:**
1. Check parent listener is running
2. Verify origin matches exactly
3. Increase timeout: `NEXT_PUBLIC_STOREFRONT_TIMEOUT_MS=30000`
4. Check network tab for errors

---

### Origin Mismatch

```javascript
[CW←Parent] Rejected message from untrusted origin: {
  expected: "https://www.zaslony.com",
  received: "http://localhost:3001"
}
```

**Cause:** Message from wrong origin

**Solutions:**
1. Check `NEXT_PUBLIC_STOREFRONT_ORIGIN` matches parent domain
2. Verify parent is at correct URL
3. No trailing slashes in URLs
4. Protocol must match (https vs http)

---

### Parent Error Response

```javascript
[CW←Parent] Error response: {
  action: "getProductList",
  messageId: "cw-1696680000000-abc123",
  error: "GraphQL query failed: category not found"
}
```

**Cause:** Parent encountered an error

**Solutions:**
1. Check parent console for details
2. Verify Magento category ID
3. Check GraphQL query syntax
4. Verify Magento API is accessible

---

### Provider Fetch Failed

```javascript
[StorefrontProvider] Failed to fetch products: Timeout waiting for parent response to action: getProductList
```

**Cause:** Provider couldn't get data from parent

**Solutions:**
1. Check all previous logs for root cause
2. Verify parent listener is initialized
3. Test with mock parent: `window.__startParentMock()`

---

## Filtering Console Logs

### View All Storefront Communication

```javascript
// In browser console, filter by:
[CW
// or
[Storefront
// or
[Parent
```

### View Only Errors

```javascript
// Filter by log level: Errors only
// Or search for:
Error
Failed
Timeout
Rejected
```

### View Specific Action

```javascript
// Search for:
getProductList
addToCart
getPriceQuote
```

---

## Debug Checklist

When troubleshooting, check logs in this order:

### ✅ 1. Initialization
- [ ] `[ParentBridge] ✓ Initialized` appears
- [ ] `isInIframe: true`
- [ ] `parentOrigin` is correct

### ✅ 2. First Request
- [ ] `[CW→Parent] Sending request` appears
- [ ] `action` and `payload` are correct
- [ ] `targetOrigin` matches parent

### ✅ 3. Parent Response
- [ ] `[CW←Parent] Success response` appears within timeout
- [ ] No "Rejected message" warnings
- [ ] `dataPreview` shows expected data

### ✅ 4. Provider Processing
- [ ] `[StorefrontProvider] Product list received` appears
- [ ] `productCount` > 0
- [ ] No "Failed to fetch" errors

---

## Production Logging

### Disable Debug Logs

Debug logs are **automatically disabled** in production unless explicitly enabled.

**Curtain Wizard side:**
```bash
# Production (logs disabled)
NEXT_PUBLIC_CONFIGURE_DEBUG_UI=0

# Or simply omit the variable (defaults to disabled)
```

**Parent storefront side:**
```javascript
// In parent-listener.js
const CONFIG = {
  // ...
  debug: false  // Disable parent-side logging
};
```

This keeps production console clean while allowing easy debugging when needed.

---

## Testing Tips

### 1. Test with Mock Parent

```javascript
// In browser console at http://localhost:3000/configure
window.__startParentMock()

// Watch logs - should see:
// [Parent Mock] Started with origin: https://www.zaslony.com
// [CW→Parent] Sending request: ...
// [CW←Parent] Success response: ...
```

### 2. Test with Real Parent

```bash
# Run test server
node scripts/test-storefront-connection.mjs

# Open http://localhost:3001
# Watch communication log in sidebar
```

### 3. Monitor Network

Open DevTools → Network tab:
- No GraphQL requests from Curtain Wizard (parent makes them)
- postMessage communication doesn't show in Network tab
- Check parent window's Network tab for Magento calls

---

## Common Log Patterns

### ✅ Healthy Communication

```
[ParentBridge] ✓ Initialized
[StorefrontProvider] Fetching product list from parent
[CW→Parent] Sending request: getProductList
[CW←Parent] Success response: 25 products
[StorefrontProvider] Product list received: 25 products
```

### ❌ Timeout Issue

```
[ParentBridge] ✓ Initialized
[StorefrontProvider] Fetching product list from parent
[CW→Parent] Sending request: getProductList
[CW→Parent] Timeout: 30000ms
[StorefrontProvider] Failed to fetch products
```

### ❌ Origin Mismatch

```
[ParentBridge] ✓ Initialized
[CW→Parent] Sending request: getProductList
[CW←Parent] Rejected message from untrusted origin
[CW→Parent] Timeout: 30000ms
```

---

## Reference

- **Implementation**: `apps/web/lib/parent-bridge.ts`
- **Provider**: `packages/core/src/catalog/providers/storefront.ts`
- **Configure Page**: `apps/web/app/configure/page.tsx`
- **Parent Listener**: `scripts/parent-listener.js`

---

**All logs are timestamped and include message IDs for correlation. Use browser DevTools console filtering to track specific requests through the entire flow.**
