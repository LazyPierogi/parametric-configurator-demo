# Magento Product Configuration for Curtain Wizard

**Quick guide to configure curtain fabric products in Magento for Curtain Wizard integration.**

---

## Required Product Fields

These fields must be set in Magento Admin for each fabric product:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| **SKU** | Text | ✅ Yes | Unique product identifier (e.g., `CW-FAB-SHEER-150`) |
| **Name** | Text | ✅ Yes | Display name (e.g., "Plain Sheer 150 cm") |
| **Price** | Decimal | ✅ Yes | Price per linear meter in store currency |

---

## Curtain Wizard Custom Attributes

Add these custom attributes to your Magento product type:

### Technical Specifications

| Attribute Code | Type | Required | Default | Example |
|----------------|------|----------|---------|---------|
| `cw_fabric_width_cm` | Integer | ✅ Yes | - | `150` or `280` |
| `cw_vertical_repeat_cm` | Integer | ⚪ No | `0` | `32` (for patterned fabrics) |
| `cw_repeat_type` | Select | ⚪ No | `straight` | `straight` or `half-drop` |
| `cw_pattern` | Text | ⚪ No | `plain` | `plain`, `floral`, `geometric` |
| `cw_shrinkage_pct` | Decimal | ⚪ No | `2.0` | `2.0` (2% shrinkage) |
| `cw_min_order_cm` | Integer | ⚪ No | `50` | `50` (minimum 50cm order) |

### Allowances & Sewing

| Attribute Code | Type | Required | Default | Example |
|----------------|------|----------|---------|---------|
| `cw_allowance_top_cm` | Decimal | ⚪ No | `5` | `5` |
| `cw_allowance_bottom_cm` | Decimal | ⚪ No | `10` | `10` |

### Colors & Variants

| Attribute Code | Type | Required | Default | Example |
|----------------|------|----------|---------|---------|
| `cw_colors` | Multiselect | ⚪ No | - | `snow,stone,ivory` |
| `cw_color_sku_map` | JSON | ⚪ No | - | `{"snow":"CW-FAB-SHEER-150-SNOW"}` |

### Visual Assets

| Attribute Code | Type | Required | Default | Example |
|----------------|------|----------|---------|---------|
| `cw_swatch_url` | Text (URL) | ⚪ No | - | `/media/swatches/sheer-150.webp` |
| `cw_texture_url` | Text (URL) | ⚪ No | - | `/media/textures/sheer-150.webp` |
| `cw_texture_by_color` | JSON | ⚪ No | - | `{"snow":"/media/textures/sheer-snow.webp"}` |
| `cw_texture_tile_px` | Integer | ⚪ No | `200` | `200` (tile width in pixels) |
| `cw_texture_opacity` | Integer | ⚪ No | `100` | `100` (0-100%) |

### Compatibility

| Attribute Code | Type | Required | Default | Example |
|----------------|------|----------|---------|---------|
| `cw_compatible_pleats` | Multiselect | ⚪ No | All | `wave,flex,ring` |
| `cw_available_hems` | Multiselect | ⚪ No | All | `hem-2cm,hem-10cm` |
| `cw_fullness_wave` | Decimal | ⚪ No | `2.0` | `2.0` (fullness factor) |
| `cw_fullness_flex` | Decimal | ⚪ No | `2.2` | `2.2` |
| `cw_fullness_ring` | Decimal | ⚪ No | `2.0` | `2.0` |

---

## Quick Setup Steps

### 1. Create Custom Attributes

In **Magento Admin → Stores → Attributes → Product**:

1. Click **Add New Attribute**
2. Set **Attribute Code**: `cw_fabric_width_cm`
3. Set **Catalog Input Type**: `Text Field`
4. Set **Scope**: `Global`
5. Set **Use in GraphQL**: ✅ Yes
6. Save and repeat for all attributes above

### 2. Add Attributes to Attribute Set

In **Stores → Attribute Sets**:

1. Select your fabric product attribute set
2. Drag custom attributes to **Curtain Wizard** group
3. Save

### 3. Configure Product

In **Catalog → Products → Edit Product**:

```
General Information:
  SKU: CW-FAB-SHEER-150
  Name: Plain Sheer 150 cm
  Price: 89.00 PLN

Curtain Wizard:
  Fabric Width (cm): 150
  Vertical Repeat (cm): 0
  Pattern: plain
  Colors: snow,stone,ivory
  Compatible Pleats: wave,flex,ring
  Available Hems: hem-2cm,hem-10cm
  Swatch URL: /media/catalog/product/s/h/sheer-150-swatch.webp
  Texture URL: /media/catalog/product/s/h/sheer-150-texture.webp
```

### 4. Test GraphQL Query

```graphql
query {
  products(filter: { sku: { eq: "CW-FAB-SHEER-150" } }) {
    items {
      sku
      name
      price_range {
        minimum_price {
          final_price {
            value
            currency
          }
        }
      }
      cw_fabric_width_cm
      cw_colors
      cw_compatible_pleats
      cw_swatch_url
    }
  }
}
```

---

## Example: Complete Product Configuration

### Product: "Blackout Velvet 280 cm - Charcoal"

```
Basic Info:
  SKU: CW-FAB-BLACKOUT-280-CHARCOAL
  Name: Blackout Velvet 280 cm - Charcoal
  Price: 159.00 PLN
  Category: Blackout Fabrics

Technical:
  cw_fabric_width_cm: 280
  cw_vertical_repeat_cm: 0
  cw_repeat_type: straight
  cw_pattern: plain
  cw_shrinkage_pct: 2.5
  cw_min_order_cm: 50

Allowances:
  cw_allowance_top_cm: 5
  cw_allowance_bottom_cm: 10

Colors:
  cw_colors: charcoal,navy,cream
  cw_color_sku_map: {
    "charcoal": "CW-FAB-BLACKOUT-280-CHARCOAL",
    "navy": "CW-FAB-BLACKOUT-280-NAVY",
    "cream": "CW-FAB-BLACKOUT-280-CREAM"
  }

Visuals:
  cw_swatch_url: /media/swatches/blackout-280.webp
  cw_texture_url: /media/textures/blackout-280-charcoal.webp
  cw_texture_by_color: {
    "charcoal": "/media/textures/blackout-280-charcoal.webp",
    "navy": "/media/textures/blackout-280-navy.webp",
    "cream": "/media/textures/blackout-280-cream.webp"
  }
  cw_texture_tile_px: 200
  cw_texture_opacity: 100

Compatibility:
  cw_compatible_pleats: wave,flex,ring
  cw_available_hems: hem-2cm,hem-10cm
  cw_fullness_wave: 2.0
  cw_fullness_flex: 2.2
  cw_fullness_ring: 2.0
```

---

## Pleat & Hem Options

Configure these as separate products or global options in Magento:

### Pleat Options (Styling Systems)

| ID | Label | Description |
|----|-------|-------------|
| `wave` | Wave | Soft, even waves along the rail |
| `flex` | Flex | Premium flex system for thick drapes |
| `doubleFlex` | Double Flex | Premium double flex for extra-thick fabrics |
| `ring` | Ring | Classic curtain rings for versatile styling |
| `tunnel` | Tunnel | Simple rod tunnel for casual styling |
| `tab` | Tab | Tab top pleating for modern look |

### Hem Options

| ID | Label | Description |
|----|-------|-------------|
| `hem-2cm` | 2 cm | Standard hem for most curtains |
| `hem-5cm` | 5 cm | Medium-weight hem |
| `hem-10cm` | 10 cm | Weighted hem for premium drapes |

---

## Common Mistakes

### ❌ Missing Fabric Width
```
Error: "Fabric width required"
Fix: Set cw_fabric_width_cm (150 or 280)
```

### ❌ Invalid Color SKU Map
```
Error: "Color variant not found"
Fix: Ensure color SKU map matches actual child product SKUs
```

### ❌ Wrong Fullness Values
```
Error: "Invalid fullness factor"
Fix: Use 1.5-3.0 range (typical: 2.0-2.5)
```

### ❌ Missing Image URLs
```
Error: "Texture not loading"
Fix: Use absolute paths: /media/... not relative paths
```

### ❌ Incompatible Pleats
```
Error: "Pleat not available for fabric"
Fix: Set cw_compatible_pleats or leave empty for all
```

---

## GraphQL Integration

Curtain Wizard expects Magento products via GraphQL query:

```graphql
query GetCurtainFabrics($categoryId: String!) {
  products(
    filter: { category_id: { eq: $categoryId } }
    pageSize: 100
  ) {
    items {
      sku
      name
      price_range {
        minimum_price {
          final_price {
            value
            currency
          }
        }
      }
      # All cw_* custom attributes
      cw_fabric_width_cm
      cw_vertical_repeat_cm
      cw_repeat_type
      cw_pattern
      cw_colors
      cw_color_sku_map
      cw_compatible_pleats
      cw_available_hems
      cw_swatch_url
      cw_texture_url
      cw_texture_by_color
      cw_texture_tile_px
      cw_texture_opacity
      cw_allowance_top_cm
      cw_allowance_bottom_cm
      cw_shrinkage_pct
      cw_fullness_wave
      cw_fullness_flex
      cw_fullness_ring
      cw_min_order_cm
    }
  }
}
```

### Test Query

Use Magento GraphQL endpoint (`https://your-store.com/graphql`):

```bash
curl -X POST https://your-store.com/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ products(filter: { sku: { eq: \"CW-FAB-SHEER-150\" } }) { items { sku name cw_fabric_width_cm } } }"
  }'
```

---

## Bulk Import (CSV)

Create CSV with columns:

```csv
sku,name,price,cw_fabric_width_cm,cw_colors,cw_compatible_pleats,cw_swatch_url
CW-FAB-SHEER-150,Plain Sheer 150,89.00,150,"snow,stone,ivory","wave,flex,ring",/media/swatches/sheer-150.webp
CW-FAB-BLACKOUT-280,Blackout 280,159.00,280,"charcoal,navy","wave,flex",/media/swatches/blackout-280.webp
```

Import via **System → Import → Products**

---

## Troubleshooting

### Products not appearing in Curtain Wizard

**Check:**
1. Product is **Enabled** and **In Stock**
2. Product assigned to correct **Category**
3. Custom attributes are **GraphQL enabled**
4. GraphQL query includes all `cw_*` fields

**Test:**
```bash
# Check if product appears in GraphQL
curl -X POST https://your-store.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ products(filter: { category_id: { eq: \"8\" } }) { items { sku name } } }"}'
```

### Textures not loading

**Check:**
1. Image URLs are absolute paths: `/media/...`
2. Images exist in `pub/media/` folder
3. CORS headers allow image loading from iframe
4. Image format is `.webp` or `.jpg` (not `.psd` or `.ai`)

### Wrong price displaying

**Check:**
1. Price in correct currency (PLN, EUR, USD)
2. Price in **minor units** for GraphQL (cents) vs **major units** in admin
3. Tax included/excluded settings match
4. Special/tier prices not conflicting

---

## Related Documentation

- **Full Integration Guide**: `docs/Storefront-Integration.md`
- **GraphQL Response Format**: `docs/Proposed Magento Response Format.md`
- **Troubleshooting**: `docs/STOREFRONT-INTEGRATION-TROUBLESHOOTING.md`
- **Testing**: `docs/STOREFRONT-QUICKSTART.md`

---

## Quick Reference Card

**Minimal Product Setup:**
```
✅ SKU (unique)
✅ Name
✅ Price
✅ cw_fabric_width_cm (150 or 280)
✅ cw_swatch_url (image)
⚪ Everything else has defaults
```

**Full-Featured Product:**
```
+ cw_colors (multiselect)
+ cw_texture_url (webp image)
+ cw_compatible_pleats (multiselect)
+ cw_vertical_repeat_cm (for patterns)
+ cw_fullness_* (for pleat types)
```

**Testing Checklist:**
- [ ] Product visible in Magento admin
- [ ] Product returns in GraphQL query
- [ ] All custom attributes populated
- [ ] Images load correctly
- [ ] Price displays in correct currency
- [ ] Product appears in Curtain Wizard fabric selector

---

**Need Help?** Check GraphQL response in browser DevTools → Network tab when loading Curtain Wizard configurator.
