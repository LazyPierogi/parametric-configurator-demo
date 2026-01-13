# Complete Cart Payload Structure

**Date:** October 20, 2025  
**Status:** ✅ Complete

## Overview

Both mock and storefront providers now generate complete cart payloads with all necessary data from within the app, without external API calls.

## Data Flow

```
User selects in Configurator:
├─ Fabric: "fab-linen-300"
├─ Color: "beige" (from swatches)
├─ Dimensions: 250cm × 260cm
├─ Pleat: "wave"
├─ Hem: "hem-10cm"
└─ Services:
   ├─ Professional Measurement
   ├─ Rod Hardware
   └─ Installation

       ↓

StorefrontCatalogProvider.toCartPayload(config)
├─ Calls priceQuote() → gets totalLinearCm
├─ Calls getProductList() → finds color SKU mapping
├─ Calls listServices() → gets service SKUs
└─ Builds StorefrontCartItem:
   ├─ sku: "fab-linen-300" (parent SKU)
   ├─ childSku: "fab-linen-300-beige" (from colorSkuByColor)
   ├─ quantity: 5.7 (570cm × 0.01)
   └─ services: [
        { sku: "CW-SVC-MEASURE", quantity: 1 },
        { sku: "CW-HW-ROD-BASIC", quantity: 1 },
        { sku: "CW-SVC-INSTALL", quantity: 1 }
      ]

       ↓

buildParentAddToCartPayload(cartItem)
└─ Converts to Magento GraphQL format

       ↓

callParent('addToCart', payload)
└─ Sends to parent storefront via postMessage
```

## Complete Payload Example

### StorefrontCartItem (Internal)

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
    "segmentWidthsCm": [250],
    "totalLinearCm": 570
  },
  "services": [
    { "sku": "CW-SVC-MEASURE", "quantity": 1 },
    { "sku": "CW-HW-ROD-BASIC", "quantity": 1 },
    { "sku": "CW-SVC-INSTALL", "quantity": 1 }
  ],
  "providerMetadata": {
    "curtainConfig": { /* full config */ },
    "quote": { /* price breakdown */ }
  }
}
```

### ParentAddToCartPayload (GraphQL)

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
          "value": "{\"widthCm\":250,\"heightCm\":260,\"pleatId\":\"wave\",\"hemId\":\"hem-10cm\",\"colorId\":\"beige\",\"segmentWidthsCm\":[250],\"totalLinearCm\":570}"
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
    },
    {
      "parent_sku": "CW-SVC-INSTALL",
      "qty": 1
    }
  ],
  "skus": [
    "fab-linen-300",
    "CW-SVC-MEASURE",
    "CW-HW-ROD-BASIC",
    "CW-SVC-INSTALL"
  ],
  "quantities": [5.7, 1, 1, 1],
  "metadata": {
    /* Full StorefrontCartItem for debugging */
  }
}
```

## Key Features

### ✅ Parent SKU (Fabric Base)
- Always the fabric's base SKU (e.g., `fab-linen-300`)
- Required for Magento configurable products

### ✅ Child SKU (Color Variant)
- Extracted from fabric's `colorSkuByColor` mapping
- Example: `colorSkuByColor: { "beige": "fab-linen-300-beige" }`
- Used to specify exact variant in parent's catalog

### ✅ Quantity (Fabric Consumption)
- Calculated from `totalLinearCm` in pricing logic
- Format: 1cm = 0.01qty (570cm → 5.7qty)
- Magento understands this as meters of fabric

### ✅ Services Array
- **Storefront provider:** Uses `listServices()` to get service products
- **Mock provider:** Uses internal catalog data
- Each service mapped to: `{ sku: string, quantity: number }`
- Includes measurement, hardware, installation as separate line items

### ✅ Configuration Options
- Stored in `entered_options[0].value` as JSON string
- Contains all configurator selections for order fulfillment
- Parent can deserialize to display/process order

## Implementation Notes

### Storefront Provider (packages/core/src/catalog/providers/storefront.ts)

```typescript
async toCartPayload(config: CurtainConfig): Promise<StorefrontCartItem> {
  // 1. Get fabric consumption from pricing
  const quote = await this.priceQuote(config);
  const totalLinearCm = quote.providerMetadata?.totalLinearCm;
  
  // 2. Get color SKU mapping from product list
  const productList = await this.getProductList();
  const product = productList.products.find((p) => p.sku === config.fabricId);
  const childSku = config.colorId && product?.attributes?.colorSkuByColor?.[config.colorId]
    ? product.attributes.colorSkuByColor[config.colorId]
    : undefined;
  
  // 3. Calculate quantity (1cm = 0.01qty)
  const fabricQuantity = typeof totalLinearCm === 'number' 
    ? Number((totalLinearCm * 0.01).toFixed(2))
    : config.segments;
  
  // 4. Get services from selections
  const allServices = await this.listServices({});
  const services = allServices
    .filter((svc) => config.services.includes(svc.id))
    .map((svc) => ({
      sku: svc.id, // In storefront provider, id = product SKU
      quantity: 1,
    }));
  
  // 5. Build complete cart item
  return {
    sku: config.fabricId,
    childSku,
    quantity: fabricQuantity,
    options: { /* ... */ },
    services: services.length ? services : undefined,
    providerMetadata: { curtainConfig: config, quote },
  };
}
```

### Key Differences Between Providers

| Aspect | Mock Provider | Storefront Provider |
|--------|--------------|---------------------|
| **Services data source** | `this.catalog.services` (internal) | `this.listServices()` (from parent) |
| **Service SKU field** | `svc.sku` (dedicated property) | `svc.id` (mapped from product SKU) |
| **Color SKU mapping** | `fabric.colorSkuByColor` | `product.attributes.colorSkuByColor` |
| **Product data** | Static JSON catalog | Dynamic from parent storefront |

## Testing

### Mock Provider
```bash
# Set environment
CATALOG_PROVIDER=mock
NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1

# Test flow:
1. Upload image → configure curtain
2. Select color swatch
3. Select services (measurement, rod, installation)
4. Click "Add to Cart"
5. Inspect console logs and debug UI
6. Verify payload has parent_sku, child_sku, qty, and 3 service items
```

### Storefront Provider
```bash
# Set environment
CATALOG_PROVIDER=storefront
NEXT_PUBLIC_STOREFRONT_ORIGIN=https://www.zaslony.com

# Test flow:
1. Run in iframe on parent storefront
2. Configure curtain with services
3. Click "Add to Cart"
4. Verify parent receives postMessage with complete cartItems array
5. Check parent console for received payload
6. Confirm all SKUs match parent's catalog
```

## Related Files

- `packages/core/src/catalog/providers/storefront.ts` - Storefront provider implementation
- `packages/core/src/catalog/providers/mock.ts` - Mock provider implementation
- `packages/clients/src/magentoCartItems.ts` - GraphQL payload builder
- `apps/web/lib/parent-bridge.ts` - Parent communication layer
- `apps/web/app/configure/page.tsx` - Add to cart handler

## Commits

- **Oct 18, 2025** - Initial cart communication fix (parent SKU + child SKU)
- **Oct 20, 2025** - Added services array to storefront provider
