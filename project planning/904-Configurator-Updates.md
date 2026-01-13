# Task 904 — Configurator Filters & Hem Calculation Updates

**Date:** 2025-10-07  
**Status:** ✅ Backend Complete — UI Integration Pending  
**Related Tasks:** 902 (Fabric Constraints), 903 (Summary Panel)

## Overview

Updated the Curtain Wizard configurator based on team and vendor feedback to:
1. **Replace fabric type categories** with Light/Heavy/Blackout
2. **Add new filtering options**: Style and Color Category
3. **Rename pleating options** for clarity (Flex, Tab, Ring)
4. **Implement precise hem calculations** with separate allowances for top/bottom/side/stitch
5. **Add configurator section toggle** to show/hide budget slider and other panels
6. **Add new "Consult Stylist" service**

---

## 1. New Fabric Types

### Replaced
- ❌ `sheer-thin` → ✅ `light`
- ❌ `drape-thick` → ✅ `heavy`

### Added
- ✅ `blackout` (new)

### Descriptions
- **Light**: Sheers and lightweight drapes that softly filter light
- **Heavy**: Room-darkening drapes with luxurious texture
- **Blackout**: Completely blocks light for maximum privacy and darkness

**Implementation:**
- Updated in `packages/core/src/catalog/mock/data.ts`
- Translations added to `packages/core/src/i18n/messages.ts`
- Legacy IDs kept for backward compatibility

---

## 2. New Fabric Filters

### Style (New)
- **basic**: Simple, modern designs
- **natural**: Organic, textured materials

**Type Definition:**
```typescript
style?: 'basic' | 'natural';
```

### Color Category (Expanded)
- **bright**: Light colors
- **grey**: Neutral greys
- **dark**: Deep, rich colors
- **colored**: Vibrant colors
- **patterned**: Fabrics with patterns
- **intensive**: High-saturation pigments (emeralds, sapphire)
- **natural**: Earthy/organic palette (sage, sand, linen blends)
- **brown**: Warm browns and taupes

**Type Definition:**
```typescript
colorCategory?: 'bright' | 'grey' | 'dark' | 'colored' | 'patterned' | 'intensive' | 'natural' | 'brown';
```

**Purpose:** Filter-only fields (do not affect pricing)

**Implementation:**
- Added to `Fabric` type in `packages/core/src/catalog/types.ts`
- All mock fabrics assigned values in `data.ts`
- Translations in `messages.ts`: `configure.styles.*`, `configure.colorCategories.*`

---

## 3. Updated Pleating Options

### Renamed
- ❌ `microflex` → ✅ `flex`
- ❌ `tape` → ✅ `tab`

### Added
- ✅ `ring` (new): Classic curtain rings for versatile styling

### Unchanged
- `wave`: Soft, even waves along the rail
- `tunnel`: Simple rod tunnel for casual styling

**Implementation:**
- Updated in `packages/core/src/catalog/lib/domainDefaults.ts`
- New fullness values: `flex: 2.4`, `ring: 2.1`, `tab: 2.0`
- New labor costs: `flex: 900`, `ring: 750`, `tab: 700` (minor currency)
- Translations added to `configure.pleats.catalog.*`

---

## 4. Updated Hem Options

### Changed
- ❌ `hem-1cm` (1 cm) → ✅ `hem-2cm` (2 cm)

### Unchanged
- ✅ `hem-10cm` (10 cm)

**Rationale:** 2cm is the standard hem for most curtains per vendor specification.

---

## 5. New Hem Calculation Logic

### Old System (Pre-Task 904)
```typescript
allowancesCm: {
  top: 10,    // Fixed
  bottom: 10  // Fixed
}
```
- Total fabric height = `finished + 20cm`
- No allowances for sides or stitches

### New System (Task 904)
```typescript
allowancesCm: {
  top: 5,        // Fixed: rod pocket/header
  bottom: 2|10,  // Dynamic: based on user's hem selection
  side: 2,       // Fixed: 2cm per edge (4cm total per segment)
  stitch: 2      // Fixed: 2cm per stitch line
}
```

### Calculation Details

**Height (Drop):**
```typescript
const bottomAllowance = hemId === 'hem-10cm' ? 10 : 2;
const cutDrop = finishedHeight + allowances.top + bottomAllowance + repeatRounding;
```

**Width (Horizontal Fabric):**
```typescript
const sideAllowanceCm = 4; // 2cm left + 2cm right
const stitchAllowanceCm = 2; // 2cm total per stitch line

// For each segment:
1. segWidthWithSides = segmentWidth + 4cm
2. requiredFlat = segWidthWithSides × fullness
3. widthsNeeded = ceil(requiredFlat / fabricWidthCm)
4. stitchLines = widthsNeeded - 1
5. stitchTotal = stitchLines × 2cm
6. requiredFlatWithStitches = (segWidthWithSides + stitchTotal) × fullness
7. finalWidths = ceil(requiredFlatWithStitches / fabricWidthCm)
```

**Example:**
- Segment: 100cm finished width
- Fabric: 150cm wide, 2.2× fullness
- Side allowances: 100 + 4 = 104cm
- Required flat: 104 × 2.2 = 228.8cm
- Preliminary widths: ceil(228.8 / 150) = 2 widths
- Stitch lines: 2 - 1 = 1 line
- Stitch allowance: 1 × 2 = 2cm
- Final width needed: (104 + 2) × 2.2 = 233.2cm
- Final widths: ceil(233.2 / 150) = **2 widths**

**Implementation:**
- Logic in `packages/core/src/catalog/providers/mock.ts` lines 189-218
- Metadata exposed in quote's `providerMetadata.allowancesCm`
- i18n: `configure.summary.allowancesDetailFull`

---

## 6. New Service

### Consult Stylist
- **ID:** `svc-stylist`
- **Label:** "Consult Stylist"
- **Description:** "Expert consultation on fabric selection and interior design"
- **Price:** 199.00 PLN
- **SKU:** `CW-SVC-STYLIST`

**Implementation:**
- Added to `mockCatalog.services` in `data.ts`
- Translations in `messages.ts`: `configure.services.catalog['svc-stylist']`

---

## 7. Configurator Section Toggle

### Purpose
Allow hiding/showing specific configurator panel sections (e.g., budget slider).

### Environment Variable
```bash
NEXT_PUBLIC_CONFIGURATOR_SECTIONS=fabricType,fabrics,pleating,hem,services
```

### Available Sections
- `fabricType` — Fabric type filter (Light/Heavy/Blackout)
- `fabrics` — Fabric grid
- `color` — Color selector
- `style` — Style filter (Basic/Natural)
- `colorCategory` — Color category filter
- `pleating` — Pleat options
- `hem` — Hem options
- `services` — Services checkboxes
- `budgetPerMeter` — Budget slider (hidden by default per requirement)

### Default Behavior
- All sections shown **except** `budgetPerMeter`
- Leave env empty or unset to use defaults

### Implementation
- **File:** `packages/core/src/catalog/lib/configuratorSections.ts` (new)
- **Type:** `ConfiguratorSectionKey`
- **Helpers:** `getConfiguratorSections()`, `isSectionEnabled()`
- **Usage:**
```typescript
import { getConfiguratorSections, isSectionEnabled } from '@curtain-wizard/core/src/catalog/lib/configuratorSections';

const sections = getConfiguratorSections(process.env.NEXT_PUBLIC_CONFIGURATOR_SECTIONS);

if (isSectionEnabled(sections, 'budgetPerMeter')) {
  // Render budget slider
}
```

---

## 8. Sample Fabrics

### Updated Existing
All three existing fabrics updated with:
- New `typeId` (light/heavy instead of sheer-thin/drape-thick)
- New `style` and `colorCategory` fields
- Updated `allowancesCm` structure
- Updated `compatiblePleats` (flex/ring/tab instead of microflex/tape)
- Updated `availableHems` (hem-2cm instead of hem-1cm)

### New Fabric
**Blackout Premium 280:**
- **ID:** `fab-blackout-280`
- **Type:** blackout
- **Width:** 280cm
- **Colors:** charcoal, navy, cream
- **Style:** basic
- **Color Category:** dark
- **Compatible Pleats:** wave, flex, ring
- **SKU:** `CW-FAB-BLACKOUT-280`
- **Price:** 189.00 PLN/m

---

## 9. Files Modified

### Core Types & Logic
1. ✅ `packages/core/src/catalog/types.ts`
   - Extended `allowancesCm` type: `{ top, bottom, side?, stitch? }`
   - Added `style` and `colorCategory` fields to `Fabric` type

2. ✅ `packages/core/src/catalog/mock/data.ts`
   - Replaced fabric types (light/heavy/blackout)
   - Updated pleats (flex/ring/tab)
   - Updated hems (hem-2cm)
   - Added svc-stylist service
   - Updated all fabrics with new fields
   - Added blackout fabric sample

3. ✅ `packages/core/src/catalog/lib/domainDefaults.ts`
   - Updated `DEFAULT_ALLOWANCES_CM`: `{ top: 5, bottom: 10, side: 2, stitch: 2 }`
   - Updated `DEFAULT_FULLNESS_BY_PLEAT`: flex, ring, tab values
   - Updated `DEFAULT_LABOR_PER_WIDTH_MINOR`: flex, ring, tab costs

4. ✅ `packages/core/src/catalog/providers/mock.ts`
   - Implemented dynamic bottom allowance (lines 189-196)
   - Implemented side allowance calculation (lines 200-201)
   - Implemented stitch allowance calculation (lines 207-218)
   - Updated metadata exposure (lines 317-322)

5. ✅ `packages/core/src/catalog/lib/configuratorSections.ts` **(new file)**
   - ConfiguratorSectionKey type
   - defaultConfiguratorSections config
   - parseConfiguratorSectionsFromEnv() function
   - getConfiguratorSections() function
   - isSectionEnabled() helper

### Translations
6. ✅ `packages/core/src/i18n/messages.ts`
   - Added fabric types: light, heavy, blackout
   - Added pleats catalog: wave, flex, ring, tunnel, tab
   - Added styles: basic, natural
   - Added colorCategories: bright, grey, dark, colored, patterned
   - Added svc-stylist service translations
   - Added panel filters: style, colorCategory
   - Added allowancesDetailFull translation

### Documentation
7. ✅ `docs/PRICING.md`
   - Updated Step 4 (Cut Length) with dynamic bottom allowance
   - Updated Step 5 (Widths Calculation) with side/stitch allowances
   - Added Task 904 section with full changelog

8. ✅ `docs/SUMMARY-PANEL-SPEC.md`
   - Added note about extended allowances display
   - Referenced allowancesDetailFull translation

9. ✅ `.env.example`
   - Added `NEXT_PUBLIC_CONFIGURATOR_SECTIONS` variable with documentation

10. ✅ `project planning/904-Configurator-Updates.md` **(this file)**

---

## 10. UI Integration (Pending)

### Required Changes in `apps/web/app/configure/page.tsx`

**1. Hide Budget Slider:**
```typescript
import { getConfiguratorSections, isSectionEnabled } from '@curtain-wizard/core/src/catalog/lib/configuratorSections';

const configuratorSections = useMemo(
  () => getConfiguratorSections(process.env.NEXT_PUBLIC_CONFIGURATOR_SECTIONS),
  []
);

// In render:
{isSectionEnabled(configuratorSections, 'budgetPerMeter') && (
  <div style={panelSectionStyle}>
    {/* Budget slider UI */}
  </div>
)}
```

**2. Add Style Filter:**
```typescript
{isSectionEnabled(configuratorSections, 'style') && (
  <div style={panelSectionStyle}>
    <div style={panelHeadingStyle}>{t('configure.panel.style')}</div>
    {/* Style filter UI: Basic / Natural */}
  </div>
)}
```

**3. Add Color Category Filter:**
```typescript
{isSectionEnabled(configuratorSections, 'colorCategory') && (
  <div style={panelSectionStyle}>
    <div style={panelHeadingStyle}>{t('configure.panel.colorCategory')}</div>
    {/* Color category filter UI: Bright/Grey/Dark/Colored/Patterned */}
  </div>
)}
```

**4. Update Allowances Display:**
```typescript
// In summary panel:
if (allowancesSummary && typeof allowancesSummary.top === 'number' && typeof allowancesSummary.bottom === 'number') {
  const hasExtended = typeof allowancesSummary.side === 'number' || typeof allowancesSummary.stitch === 'number';
  
  if (hasExtended) {
    // Show detailed view
    const details = t('configure.summary.allowancesDetailFull', {
      top: allowancesSummary.top,
      bottom: allowancesSummary.bottom,
      side: allowancesSummary.side ?? 2,
      stitch: allowancesSummary.stitch ?? 2,
    });
    // Render details
  } else {
    // Show simple view (backward compat)
    const total = allowancesSummary.top + allowancesSummary.bottom;
    // Render as before
  }
}
```

**5. Toggle Other Sections:**
Apply the same pattern to all sections:
- `fabricType`
- `fabrics`
- `color`
- `pleating`
- `hem`
- `services`

---

## 11. Testing Checklist

### Backend (Completed)
- ✅ New fabric types load correctly
- ✅ New pleats have correct fullness values
- ✅ New hem options available
- ✅ Dynamic bottom allowance calculated correctly (2cm vs 10cm)
- ✅ Side allowances add 4cm per segment
- ✅ Stitch allowances add 2cm per stitch line
- ✅ Metadata includes extended allowances structure
- ✅ New service (svc-stylist) available
- ✅ Configurator section toggle system works
- ✅ All translations present (EN/PL/UK)
- ✅ Blackout fabric sample loads

### UI (Pending)
- ⏳ Budget slider hidden by default
- ⏳ Style filter displays (Basic/Natural)
- ⏳ Color category filter displays
- ⏳ Allowances show detailed view when available
- ⏳ Section toggle via env variable works
- ⏳ New fabric types selectable
- ⏳ New pleats selectable
- ⏳ New service appears in services list
- ⏳ Fabric filtering by style/colorCategory works
- ⏳ Translations display correctly in all locales

---

## 12. Migration Notes

### Breaking Changes
- Hem ID changed: `hem-1cm` → `hem-2cm`
- Fabric type IDs changed: Use `light`, `heavy`, `blackout`
- Pleat IDs renamed: `microflex` → `flex`, `tape` → `tab`

### Backward Compatibility
- Old fabric types kept in i18n (`sheer-thin`, `drape-thick`)
- Old pleat IDs still work in calculations (mapped internally)
- Simple allowances structure `{ top, bottom }` still supported
- Missing `side` or `stitch` values default to 2cm

### Data Migration
If you have existing orders/configs with old IDs:
1. **Fabric types**: Map `sheer-thin` → `light`, `drape-thick` → `heavy`
2. **Pleats**: Map `microflex` → `flex`, `tape` → `tab`
3. **Hems**: Map `hem-1cm` → `hem-2cm`

---

## 13. Next Steps

1. **UI Implementation:**
   - Integrate configurator section toggle
   - Add style and color category filters
   - Update allowances display
   - Hide budget slider by default

2. **Testing:**
   - Test all filters with real data
   - Verify hem calculations with different selections
   - Test section toggle with various env values
   - Validate translations in all locales

3. **Storefront Integration:**
   - Map new fields to Magento attributes
   - Ensure cart payload includes style/colorCategory
   - Test with real fabric data from storefront

4. **Asset Creation:**
   - Create actual texture images for blackout fabric
   - Create tech diagrams for Ring and Tab pleats
   - Update swatches for new fabric samples

---

## References

- **PRICING.md**: Updated algorithm documentation
- **SUMMARY-PANEL-SPEC.md**: Updated display specifications
- **AGENTS.md**: Agent memory updated with Task 904 details
- **RUNBOOK.md**: No changes needed (catalog-only update)

---

**Status:** ✅ Backend implementation complete. Ready for UI integration.
