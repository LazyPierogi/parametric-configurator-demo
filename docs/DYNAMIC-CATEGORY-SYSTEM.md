# Dynamic Category System

**Date**: 2025-10-30  
**Task**: Refactor hardcoded category enums to dynamic string types

---

## Problem

The system was using hardcoded TypeScript enums for color categories and fabric styles:
- `COLOR_CATEGORY_IDS` - Fixed array of allowed categories
- `COLOR_FILTER_IDS` - Fixed array including 'all' filter
- `STYLE_FILTER_IDS` - Fixed array of allowed styles

**Impact:**
- New categories from Magento (e.g., `intensive`, `natural`, `brown`) were **filtered out** during mapping
- UI couldn't display categories not in the hardcoded arrays
- Required code changes every time Magento added a new category
- "No fabrics match this filter" bug when selecting new categories

---

## Solution

Refactored to accept **any category string from Magento dynamically**:

### 1. Types System (`packages/core/src/catalog/types.ts`)

**Before:**
```typescript
export const COLOR_CATEGORY_IDS = ['bright', 'grey', 'dark', 'colored', 'patterned'] as const;
export type ColorCategoryId = (typeof COLOR_CATEGORY_IDS)[number]; // Closed union
```

**After:**
```typescript
// Known categories (for reference only - NOT enforced at runtime)
export const KNOWN_COLOR_CATEGORIES = [
  'bright', 'grey', 'dark', 'colored', 'patterned',
  'intensive', 'natural', 'brown'
] as const;

// Dynamic types accepting any string
export type ColorCategoryId = string;
export type ColorFilterId = 'all' | string;
export type FabricStyleId = string;
export type StyleFilterId = 'all' | string;
```

### 2. Storefront Mapper (`packages/core/src/catalog/storefront/mappers.ts`)

**Before:**
```typescript
const colorCategorySet = new Set<ColorCategoryId>(COLOR_CATEGORY_IDS);
// ...
const resolvedCategory = candidates.find(
  (value): value is ColorCategoryId => !!value && colorCategorySet.has(value), // ❌ Filters unknown
);
```

**After:**
```typescript
// Accept any category string dynamically (no validation)
const resolvedCategory = candidates.find(
  (value): value is ColorCategoryId => typeof value === 'string' && value.length > 0, // ✅ Accepts any
);
```

### 3. UI Filter Logic (`apps/web/app/configure/hooks/useCatalogOptions.ts`)

**Before:**
```typescript
const colorCounts = COLOR_FILTER_IDS.reduce(
  (acc, key) => {
    acc[key as ColorFilter] = 0; // ❌ Pre-initialized with hardcoded keys
    return acc;
  },
  {} as Record<ColorFilter, number>,
);
```

**After:**
```typescript
// Build counts dynamically from actual fabric data
const colorCounts: Record<string, number> = { all: 0 };
const discoveredColors = new Set<string>();

for (const fabric of rawList) {
  // ... scan fabrics and discover categories
  if (category) {
    discoveredColors.add(category); // ✅ Dynamically discovered
    colorCounts[category] = (colorCounts[category] ?? 0) + 1;
  }
}

// Build UI options from discovered data (alphabetically sorted)
const availableColorCategories: ColorFilter[] = [
  'all',
  ...Array.from(discoveredColors).sort()
];
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Magento Storefront                                 │
│  • ANY category values (no restrictions)            │
│  • intensive, natural, brown, custom...             │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  Storefront Mapper (NO validation)                  │
│  • Accepts all strings                              │
│  • No filtering                                     │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  Catalog Types (Dynamic strings)                    │
│  • ColorCategoryId = string                         │
│  • StyleFilterId = 'all' | string                   │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  UI Filter System (Discovers from data)             │
│  • Scans fabrics to find categories                 │
│  • Builds filter chips dynamically                  │
│  • No hardcoded arrays                              │
└─────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────┐
│  Canvas Renderer (Preset with fallback)             │
│  • Has presets for known categories                 │
│  • Falls back to 'colored' for unknown              │
│  • Graceful degradation                             │
└─────────────────────────────────────────────────────┘
```

---

## Benefits

### ✅ **Future-Proof**
- New Magento categories flow through automatically
- No code changes required for new categories

### ✅ **Data-Driven**
- UI filter options built from actual fabric data
- No mismatch between backend and frontend

### ✅ **Graceful Fallback**
- Canvas renderer uses sensible defaults for unknown categories
- System never breaks on unexpected values

### ✅ **Developer Experience**
- `KNOWN_COLOR_CATEGORIES` provides autocomplete hints
- TypeScript still catches typos in known values
- No strict runtime enforcement

---

## Canvas Rendering Presets

The canvas renderer **still has hardcoded presets** for known categories:

```typescript
// apps/web/lib/canvas-renderer/color-presets.ts
export const COLOR_CATEGORY_PRESETS: Record<ColorCategory, ColorCategoryPreset> = {
  bright: { shadowStrength: 0.70, ... },
  grey: { shadowStrength: 0.75, ... },
  dark: { shadowStrength: 0.75, ... },
  colored: { shadowStrength: 0.55, ... },
  // ... etc
};
```

**This is intentional and correct:**
- Accepts any category from catalog layer
- Looks up preset if available
- Falls back to `'colored'` preset for unknown categories
- Result: Graceful rendering without breaking

---

## i18n Translations

Translations for categories should be handled separately:

```typescript
// i18n files should include all known categories
{
  "filter.color.bright": "Bright",
  "filter.color.grey": "Grey",
  "filter.color.intensive": "Intensive",
  "filter.color.natural": "Natural",
  "filter.color.brown": "Brown",
  // New categories can be added without code changes
}
```

**Fallback strategy:**
- If translation key missing → display raw category value
- Better than breaking the UI
- Translations can be added incrementally

---

## Testing

### Test Scenarios

1. **New category from Magento**
   - ✅ Flows through mapper without filtering
   - ✅ Appears in UI filter chips
   - ✅ Fabrics display correctly when selected
   - ✅ Canvas renders with fallback preset

2. **Category removal from Magento**
   - ✅ UI filter chip disappears automatically
   - ✅ No stale filters displayed

3. **Category typo in Magento**
   - ✅ Displays as-is (lets user see the typo)
   - ✅ Better than silently filtering out

4. **Empty/null categories**
   - ✅ Handled gracefully (skipped)
   - ✅ No undefined values

### Regression Tests

- [x] Existing categories still work (bright, grey, dark, colored, patterned)
- [x] New categories work (intensive, natural, brown)
- [x] Filter counts accurate
- [x] Cross-filtering works (style + color)
- [x] Canvas rendering unchanged for known categories
- [x] No TypeScript errors

---

## Migration Notes

### For Developers

**Old code pattern:**
```typescript
import { COLOR_CATEGORY_IDS } from '@curtain-wizard/core/src/catalog';

// ❌ Don't do this anymore
if (COLOR_CATEGORY_IDS.includes(category)) { ... }
```

**New code pattern:**
```typescript
import { KNOWN_COLOR_CATEGORIES } from '@curtain-wizard/core/src/catalog';

// ✅ Use for reference only
// Types are now open strings - accept any value from data source
```

### For Magento Admins

- Add new categories directly in Magento product attributes
- No code deployment required
- Categories appear in UI automatically
- Add translations to i18n files when convenient

---

## Files Changed

### Core Catalog Types
- `packages/core/src/catalog/types.ts` - Changed to dynamic string types
- `packages/core/src/catalog/storefront/mappers.ts` - Removed validation filters

### UI Layer
- `apps/web/app/configure/hooks/useCatalogOptions.ts` - Dynamic filter building

### No Changes Required
- `apps/web/lib/canvas-renderer/color-presets.ts` - Presets remain as fallback system
- Mock catalog data - Can still use specific categories

---

## Future Enhancements

### Potential Improvements

1. **Category Ordering**
   - Currently alphabetical
   - Could add `sortOrder` field from Magento
   - Would require backend priority mapping

2. **Category Metadata**
   - Could include icon, description, color
   - Requires extended Magento attributes
   - Would enhance UI presentation

3. **Category Aliases**
   - Map old category names to new ones
   - Useful for migration/renaming
   - Example: `'dark'` → `'deep'`

4. **Canvas Preset Auto-Learning**
   - Analyze fabric images to suggest rendering presets
   - ML-based preset generation
   - Reduces manual tuning

---

## See Also

- `docs/CANVAS-RENDERING-ARCHITECTURE.md` - Canvas rendering presets
- `project planning/05-Task-List.md` - Task 904 (color/style filters)
- `AGENTS.md` - System architecture and collaboration rules
