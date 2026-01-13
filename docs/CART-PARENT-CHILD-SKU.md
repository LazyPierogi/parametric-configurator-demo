# Parent/Child SKU Implementation (Tasks 956-958)

**Date:** 2025-10-10  
**Status:** ✅ Complete

## Overview

Implemented parent/child SKU structure for Magento cart integration where:
- **Parent SKU** = Fabric base product (e.g., `CW-FAB-LINEN-300`)
- **Child SKU** = Color variant (e.g., `CW-FAB-LINEN-300-SAGE`)
- **Quantity** = Fabric consumption in centimeters converted to Magento format (1cm = 0.01 qty)

## Example Output

```javascript
{
  parent_sku: 'CW-FAB-LINEN-300',
  child_sku: 'CW-FAB-LINEN-300-SAGE',
  qty: 4.50  // 450cm of fabric
}
```

## Implementation Details

### 1. Catalog Types (`packages/core/src/catalog/types.ts`)

**Fabric type** now includes:
```typescript
export type Fabric = {
  // ... existing fields
  sku: string;  // Parent SKU
  colorSkuByColor?: Record<string, string>;  // Color variant mapping
  // Example: { sage: 'CW-FAB-LINEN-300-SAGE', lilly: 'CW-FAB-LINEN-300-LILLY' }
}
```

**StorefrontCartItem type** updated:
```typescript
export type StorefrontCartItem = {
  sku: string;          // Parent SKU (fabric)
  childSku?: string;    // Child SKU (color variant)
  quantity: number;     // Fabric consumption in Magento format
  options?: Record<string, unknown>;
  services?: StorefrontCartService[];
}
```

### 2. Mock Data (`packages/core/src/catalog/mock/data.ts`)

All fabrics now have color SKU mappings:

```typescript
{
  id: 'fab-linen-300',
  sku: 'CW-FAB-LINEN-300',
  colors: ['sage', 'lilly', 'sand'],
  colorSkuByColor: {
    sage: 'CW-FAB-LINEN-300-SAGE',
    lilly: 'CW-FAB-LINEN-300-LILLY',
    sand: 'CW-FAB-LINEN-300-SAND',
  },
  // ... other fields
}
```

### 3. Cart Payload Generation

**Mock Provider** (`packages/core/src/catalog/providers/mock.ts`):
```typescript
async toCartPayload(config: CurtainConfig): Promise<StorefrontCartItem> {
  const quote = await this.priceQuote(config);
  const fabric = this.findFabric(config.fabricId);
  const totalLinearCm = quote.providerMetadata?.totalLinearCm;
  
  // Get child SKU from color selection
  const childSku = config.colorId && fabric.colorSkuByColor?.[config.colorId]
    ? fabric.colorSkuByColor[config.colorId]
    : undefined;
  
  // Calculate fabric quantity: 1cm = 0.01 qty
  const fabricQuantity = typeof totalLinearCm === 'number' 
    ? Number((totalLinearCm * 0.01).toFixed(2))
    : Math.max(config.segments, 1);
  
  return {
    sku: fabric.sku,
    childSku,
    quantity: fabricQuantity,
    options: { /* ... */ },
    services: [ /* ... */ ],
  };
}
```

**Storefront Provider** (`packages/core/src/catalog/providers/storefront.ts`):
- Fetches quote from parent to get `totalLinearCm`
- Looks up color SKU mapping from product attributes
- Same calculation logic as mock provider

### 4. Magento GraphQL Mutation

**Before** (old format):
```typescript
{
  sku: 'CW-FAB-LINEN-300-SAGE',
  quantity: 2,  // number of panels
}
```

**After** (new format):
```typescript
{
  parent_sku: 'CW-FAB-LINEN-300',
  child_sku: 'CW-FAB-LINEN-300-SAGE',
  qty: 4.50,  // fabric consumption in Magento format
  entered_options: [
    {
      uid: 'curtain_configuration',
      value: JSON.stringify({ widthCm: 300, heightCm: 250, ... })
    }
  ]
}
```

## Quantity Calculation

The quantity represents fabric consumption, not panel count:

| Total Linear Fabric | Magento Quantity |
|---------------------|------------------|
| 100 cm              | 1.00             |
| 250 cm              | 2.50             |
| 450 cm              | 4.50             |
| 1000 cm             | 10.00            |

**Formula:** `qty = totalLinearCm * 0.01`

Example calculation:
- Curtain: 300cm wide × 250cm high
- 2 segments with wave pleat (2.2x fullness)
- Fabric width: 300cm
- Allowances: +15cm (top + bottom)
- Shrinkage: +2%
- **Result:** ~450cm fabric → **4.50 qty**

## Testing

### Run the test script:
```bash
npm run test:cart
```

This validates:
- ✅ Parent SKU is set correctly
- ✅ Child SKU matches color selection
- ✅ Quantity is calculated from fabric consumption
- ✅ Services array is populated
- ✅ Options include all configuration details

### Manual testing in browser console:

1. Open the configurator page
2. Select a fabric with color options
3. Choose a color
4. Open browser DevTools console
5. Test cart payload generation:

```javascript
// Get the catalog provider
const { createCatalogProvider } = await import('/packages/core/src/catalog/index.js');
const provider = createCatalogProvider('mock');

// Test configuration
const config = {
  fabricId: 'fab-linen-300',
  colorId: 'sage',
  pleatId: 'wave',
  hemId: 'hem-2cm',
  widthCm: 300,
  heightCm: 250,
  segments: 2,
  services: [],
};

// Generate cart payload
const payload = await provider.toCartPayload(config);
console.log('Cart Payload:', payload);

// Verify structure
console.assert(payload.sku === 'CW-FAB-LINEN-300', 'Parent SKU mismatch');
console.assert(payload.childSku === 'CW-FAB-LINEN-300-SAGE', 'Child SKU mismatch');
console.assert(payload.quantity > 0, 'Quantity invalid');
```

## Storefront Integration

For storefront mode, the parent Magento site must:

1. **Provide product data** with color SKU mapping:
```javascript
{
  sku: 'CW-FAB-LINEN-300',
  attributes: {
    colors: ['sage', 'lilly', 'sand'],
    colorSkuByColor: {
      sage: 'CW-FAB-LINEN-300-SAGE',
      lilly: 'CW-FAB-LINEN-300-LILLY',
      sand: 'CW-FAB-LINEN-300-SAND',
    }
  }
}
```

2. **Accept cart payload** via `postMessage`:
```javascript
window.addEventListener('message', (event) => {
  if (event.data.action === 'addToCart') {
    const { sku, childSku, quantity, options } = event.data.payload;
    // Add to Magento cart with parent_sku/child_sku/qty structure
  }
});
```

## Files Modified

- `packages/core/src/catalog/types.ts`
- `packages/core/src/catalog/mock/data.ts`
- `packages/core/src/catalog/providers/mock.ts`
- `packages/core/src/catalog/providers/storefront.ts`
- `packages/core/src/catalog/storefront/types.ts`
- `packages/core/src/catalog/storefront/mappers.ts`
- `packages/clients/src/magento.ts`
- `scripts/test-cart-payload.mjs` (new)
- `package.json`
- `project planning/05-Task-List.md`
- `AGENTS.md`

## Backward Compatibility

- If `colorId` is not provided, `childSku` remains `undefined`
- If `totalLinearCm` is unavailable, quantity falls back to segment count
- Existing mock data continues to work without color variants

## Future Considerations

1. **Pleat/Hem variants:** Could extend to `pleatSkuByPleat` and `hemSkuByHem` if needed
2. **Service SKUs:** Already using parent_sku/qty structure for services
3. **Quantity precision:** Currently 2 decimal places (e.g., 4.50), adjust if more precision needed

## Questions?

If something is unclear or you need adjustments:
1. Run `npm run test:cart` to see current behavior
2. Check the console output for detailed validation results
3. Review the example payload structure in the test script
