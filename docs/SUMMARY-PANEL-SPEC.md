# Summary Panel Specification (Task 903)

**Updated:** 2025-10-07  
**Replaces:** PRICING.md Section "UI Summary (Task 861)"

## Overview

The configurator summary panel displays quote metadata with full translation support and A/B testing capability. All fields are toggle-able via environment variables.

## Layout & Interaction

### Desktop (two columns)
- Sticky Hero is owned by the `/configure` layout shell.
- Summary is a compact `CollapsibleSummary` attached to the Hero block so it moves/sticks identically.
- Default (collapsed) shows only:
  - Fabric thumbnail
  - Total (`Razem`)
  - Add to cart (`Dodaj do koszyka`)
- Clicking the arrow expands the panel to show additional fields controlled by `NEXT_PUBLIC_SUMMARY_FIELDS`.

### Mobile (single column)
- Order: Hero → Configurator → Summary.
- Mobile uses the full `SummaryPanel` (not the collapsible desktop summary).

## Field Categories

### 1. Core Selection (always enabled by default)

| Field | Source | Display Example | i18n Key |
|-------|--------|-----------------|----------|
| **Fabric** | `selectedFabric.name` | "Linen 300" | `configure.summary.fabric` |
| **Color** | `selectedColor` | "sage" | `configure.summary.color` |
| **Pleat** | `selectedPleat.label` | "Wave" | `configure.summary.pleat` |
| **Hem** | `selectedHem.label` | "1 cm" | `configure.summary.hem` |
| **Services** | `selectedServices` count | "3 selected" | `configure.summary.services` |

**Services Breakdown:**
- Shows each service with translated label and price
- Mock provider: Uses `configure.services.catalog.{svc.id}.label`
- Storefront: Uses `svc.label` from provider

### 2. Dimensions (per-segment detail)

| Field | Source | Display Example | i18n Key |
|-------|--------|-----------------|----------|
| **Dimensions** | `segmentWidthsCm[]` | "2 segments: 50 cm + 222 cm" | `configure.summary.dimensions` |
| **Height** | `appliedHeightCm` | "280 cm" | `configure.summary.height` |
| **Cut Drop** | `cutDropCm` | "290 cm (includes allowances)" | `configure.summary.cutDrop` |

**Notes:**
- Single segment: "1 segment: 272 cm"
- Multiple segments: "2 segments: 50 cm + 222 cm"
- Replaces old "Width × Height" and "Quoted Size" fields

### 3. Material Calculation

| Field | Source | Display Example | i18n Key |
|-------|--------|-----------------|----------|
| **Fabric Ordered** | `totalLinearCm / 100` | "11.0 m" | `configure.summary.fabricOrdered` |
| **Bolt Widths Cut** | `numWidths` | "6 (optimized from 7)" | `configure.summary.boltWidths` |
| **Fullness** | `fullness` | "2.20" | `configure.summary.fullness` |
| **Widths per Segment** | `widthsPerSegment[]` | "1 width(s) sewn together, 2 width(s) sewn together" | `configure.summary.widthsPerSegment` |

**Notes:**
- Optimization note only shows when `materialReuseEnabled === true`
- Widths per segment shows individual bolt counts for asymmetric panels

### 4. Production Details

| Field | Source | Display Example | i18n Key |
|-------|--------|-----------------|----------|
| **Shrinkage Allowance** | `shrinkagePct` | "2%" | `configure.summary.shrinkage` |
| **Hem Allowances** | `allowancesCm` | "20 cm (top 10, bottom 10)" or detailed view | `configure.summary.allowances` |
| **Pattern Repeat** | `repeatCm`, `repeatType` | "32 cm (straight)" | `configure.summary.repeat` |

**Note (Task 904):** Hem allowances now support extended structure:
- **Simple display**: "20 cm (top 10, bottom 10)" — Uses `configure.summary.allowancesDetail`
- **Detailed display**: "top 5 cm, bottom 10 cm, sides 2 cm, stitch 2 cm" — Uses `configure.summary.allowancesDetailFull`

**Notes:**
- Repeat only shows for patterned fabrics (`repeatCm > 0`)
- Type shows "straight" or "half-drop"

### 5. Visual Indicators

| Field | Condition | Display | i18n Key |
|-------|-----------|---------|----------|
| **Stitch Lines** | Any segment has > 1 width | Green notice: "Stitch lines visible in preview" | `configure.summary.stitchLines` |
| **Constraints** | Width or height limit hit | Amber warning with details | `configure.summary.constraint{Width\|Height}` |

### 6. Price Breakdown

All breakdown items are **fully translated**:

| Item ID | Translation Path | Display Example |
|---------|------------------|-----------------|
| `fabric` | `configure.summary.breakdown.fabric` | "Fabric PLN 759.00" |
| `labor` | `configure.summary.breakdown.laborWithWidths` | "Labor (4 widths) PLN 32.00" |
| `pleat-surcharge` | `configure.summary.breakdown.pleatSurcharge` | "Pleat surcharge PLN 4.40" |
| `hem-surcharge` | `configure.summary.breakdown.hemSurcharge` | "Hem surcharge PLN 13.00" |
| `fabric-surcharge` | `configure.summary.breakdown.fabricSurcharge` | "Fabric surcharge PLN 0.00" |
| `svc-*` | `configure.services.catalog.{id}.label` | "Measurement Visit PLN 149.00" |

**Fixed Issues:**
- ✅ Service labels now properly translated in breakdown
- ✅ "optimized from" text now uses i18n key `configure.summary.boltWidthsOptimized`

## Removed Fields

The following fields were removed from the original Task 861 spec:

| Field | Reason | Replacement |
|-------|--------|-------------|
| **Coverage %** | Not meaningful to customers | Hidden; used internally for <95% warning modal |
| **Width × Height (dims)** | Duplicate of provider data | Replaced by "Dimensions" (per-segment) |
| **Quoted Size** | Duplicate | Merged into "Dimensions" |
| **Panel Width (flat)** | Confusing (showed finished width, not flat) | Removed entirely |

## Toggle System

### Environment Variable

Control field visibility with `NEXT_PUBLIC_SUMMARY_FIELDS`:

```bash
# Minimal summary (customer-focused)
NEXT_PUBLIC_SUMMARY_FIELDS="fabric,pleat,hem,services,fabricOrdered,breakdown"

# Technical summary (production-focused)
NEXT_PUBLIC_SUMMARY_FIELDS="fabric,color,pleat,hem,services,dimensions,height,cutDrop,fabricOrdered,boltWidths,fullness,widthsPerSegment,shrinkage,allowances,repeat,stitchLines,breakdown,constraints"

# Default: All fields enabled
# (leave unset or empty)
```

### Configuration File

`packages/core/src/catalog/lib/summaryConfig.ts` defines:
- `SummaryFieldKey` type (all available fields)
- `defaultSummaryConfig` (all enabled by default)
- `getSummaryConfig()` function (merges env with defaults)
- `isFieldEnabled()` helper for component checks

### Usage in Components

```typescript
import { getSummaryConfig, isFieldEnabled } from '@curtain-wizard/core/src/catalog/lib/summaryConfig';

const summaryConfig = useMemo(
  () => getSummaryConfig(process.env.NEXT_PUBLIC_SUMMARY_FIELDS),
  []
);

// In render:
{isFieldEnabled(summaryConfig, 'fabricOrdered') && (
  <div>...</div>
)}
```

## Coverage Warning Modal

### Trigger Condition
When user clicks "Add to Cart" with `coverageRatio < 0.95` (95%)

### Modal Content
- **Title:** "Incomplete wall coverage" (`configure.coverageWarning.title`)
- **Message:** "Your curtains currently cover only {coverage}% of the wall box. Are you sure you don't want to cover the entire wall?" (`configure.coverageWarning.message`)
- **Actions:**
  - **"Back to configurator"** (`configure.coverageWarning.goBack`) — Closes modal, returns to config
  - **"Yes, add to cart"** (`configure.coverageWarning.addToCart`) — Proceeds with order

### Implementation Details
- Coverage calculation: `Math.round(coverageRatio * 100)`
- Coverage ratio source: `sum(segments.widthPercent) / 100`
- Modal only shows once per attempt (state: `showCoverageWarning`)
- User can still order partial coverage after confirmation

## Terminology Unification

**Consistent usage of "segment"** (not "panel") throughout:
- ✅ "2 segments: 50 cm + 222 cm"
- ✅ "Widths per Segment"
- ✅ `segmentWidthsCm[]`
- ✅ `widthsPerSegment[]`

**Rationale:** UI uses draggable "segments" to divide the wall box. Provider metadata uses "segments" for asymmetric calculations. "Panel" was ambiguous and mixed with segments.

## Migration Notes

### From Task 861 → Task 903

**Breaking Changes:**
- `configure.summary.widthHeight` → Removed
- `configure.summary.coverage` → Removed from UI
- `configure.summary.quotedSize` → Replaced by `configure.summary.dimensions`
- `configure.summary.panelWidth` → Removed
- `configure.summary.widthsPerPanel` → Changed to `configure.summary.widthsPerSegment`

**New Keys:**
- `configure.summary.dimensions`
- `configure.summary.dimensionsDetail`
- `configure.summary.dimensionsSingle`
- `configure.summary.height`
- `configure.summary.heightValue`
- `configure.summary.segmentWidths`
- `configure.summary.cutDrop`
- `configure.summary.cutDropValue`
- `configure.summary.boltWidthsOptimized`
- `configure.summary.widthsPerSegment`
- `configure.summary.widthsPerSegmentValue`
- `configure.coverageWarning.*`

### Backward Compatibility
- Old i18n keys kept in catalog (won't break if still referenced)
- Provider metadata structure unchanged
- Only UI display logic updated

## Testing Checklist

- [ ] All fields toggle correctly via `NEXT_PUBLIC_SUMMARY_FIELDS`
- [ ] Service labels translated in both summary and breakdown
- [ ] "optimized from" text translated
- [ ] Asymmetric segments show correct per-segment widths
- [ ] Coverage modal appears at <95% coverage
- [ ] Coverage modal translations work in PL/UK
- [ ] Cut drop displays when available in metadata
- [ ] Single-segment vs multi-segment dimensions format correctly
- [ ] Stitch lines notice appears when widths > 1

## Related Files

- **Summary config:** `packages/core/src/catalog/lib/summaryConfig.ts`
- **i18n catalog:** `packages/core/src/i18n/messages.ts`
- **Summary UI (desktop layout shell):** `apps/web/app/configure/LegacyConfigurePage.tsx`
- **Collapsible summary (desktop):** `apps/web/app/configure/components/CollapsibleSummary.tsx`
- **Summary panel (mobile + shared content):** `apps/web/app/configure/components/SummaryPanel.tsx`
- **Add to cart + pricing orchestration:** `apps/web/app/configure/LegacyConfigurePage.tsx`

## Example Output

**Current implementation shows:**
```
Summary
───────────────────────
Fabric          Linen 300
Color           sage
Pleat           Wave
Hem             1 cm
Services        3 selected
  Measurement Visit      PLN 149.00
  Pro Installation       PLN 249.00
  Curtain Rod (Basic)    PLN 99.00

Dimensions      2 segments: 50 cm + 222 cm
Height          280 cm
Cut Drop        290 cm (includes allowances)

Fabric Ordered  11.0 m
Bolt Widths     6 (optimized from 7)
Fullness        2.20
Widths per Segment  1 width(s) sewn together, 2 width(s) sewn together
  ℹ️ Stitch lines visible in preview

Shrinkage       2%
Hem Allowances  20 cm (top 10, bottom 10)

───────────────────────
Fabric                  PLN 759.00
Labor (4 widths)        PLN 32.00
Pleat surcharge         PLN 4.40
Hem surcharge           PLN 13.00
Measurement Visit       PLN 149.00
Pro Installation        PLN 249.00
Curtain Rod (Basic)     PLN 99.00
```
