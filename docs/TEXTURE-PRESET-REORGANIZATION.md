# Texture and Preset System Reorganization

**Date**: 2025-10-29  
**Task**: Reorganize canvas texture system into material-family-based and pleating-based presets

---

## Summary

The canvas rendering system has been reorganized to separate concerns between:
1. **Material family** (fabric type: sheer, linen, blackout, etc.)
2. **Pleating style** (wave, flex, doubleFlex)
3. **Color category** (bright, grey, dark, colored, patterned)

This makes the system more maintainable and allows for independent tuning of each aspect.

---

## Changes Made

### 1. Material-Specific Texture Organization

**Created**: `/public/textures/canvas/texture-details/`

Material weave textures are now stored in a dedicated folder and named by material family:
- `sheer-weave.png`
- `linen-weave.png`
- `blackout-weave.png`
- `cotton-weave.png`
- `velvet-weave.png`
- `silk-weave.png`

**Why**: Previously, `weaveDetail.png` was duplicated in each pleat folder (`wave/`, `flex/`, `doubleFlex/`). This was wasteful and made it hard to update material-specific patterns. Now each material has one texture that can be shared across all pleat types.

---

### 2. Material Presets System

**Created**: `apps/web/lib/canvas-renderer/material-presets.ts`

Controls material-specific rendering parameters:

```typescript
export type MaterialPreset = {
  family: MaterialFamily;
  textureScale: number;       // Granularity of weave pattern
  opacity: number;            // Overall curtain opacity (0-1)
  noiseStrength: number;      // Natural fabric variation
  textureAsset: string;       // Texture filename
};
```

**Example**:
```typescript
sheer: {
  family: 'sheer',
  textureScale: 1.8,          // Fine, delicate weave
  opacity: 0.65,              // Semi-transparent
  noiseStrength: 0.03,        // Very subtle variation
  textureAsset: 'sheer-weave',
}
```

**Moved from color-presets**: `noiseStrength` (was previously part of color category)

---

### 3. Pleating Presets System

**Created**: `apps/web/lib/canvas-renderer/pleating-presets.ts`

Controls pleat-specific rendering parameters:

```typescript
export type PleatingPreset = {
  pleatId: PleatId;
  pleatTextureScale: number;  // Scale for pleat-specific textures
  pleatJitter: number;        // Natural pleat variation (0-1)
  label: string;
};
```

**Example**:
```typescript
wave: {
  pleatId: 'wave',
  label: 'Wave Pleat',
  pleatTextureScale: 80,      // Broader wave pattern
  pleatJitter: 0.1,           // Natural wave variation
}
```

**Pleat-specific textures** (still in pleat folders):
- `pleatRamp.png` - Shadow/depth map for pleats
- `occlusion.png` - Ambient occlusion for depth
- `translucencyMask.png` - Light transmission map

**Moved from color-presets**: `pleatJitter` (was previously part of color category)

### 4.5 Artist Texture Families (2025-11-01)

- New artist-authored pipeline lives behind `NEXT_PUBLIC_EXPERIMENTAL_TEXTURES=artist`.
- Asset drop targets: `public/textures/canvas/{wave-drape,wave-sheer,flex,double-flex}/pleatRamp|occlusion|translucency|normal.png`.
- `wave-drape` is used for heavy fabrics (linen, blackout, velvet), `wave-sheer` for light/sheers. Flex and double-flex map 1:1 with pleat selection.
- When assets are absent the renderer automatically falls back to the token pipeline; once maps exist no code changes are required—tile offsets keep segments aligned to the wall box globally.

---

### 4. Updated Color Presets

**Modified**: `apps/web/lib/canvas-renderer/color-presets.ts`

Now **only** controls color-specific rendering:

```typescript
export type ColorCategoryPreset = {
  shadowStrength: number;
  weaveStrength: number;
  occlusionStrength: number;
  contrastBoost: number;
  // REMOVED: noiseStrength (moved to material-presets)
  // REMOVED: pleatJitter (moved to pleating-presets)
};
```

**Why**: Color category should only control how shadows/highlights appear on different colors, not material or pleat behavior.

---

### 5. Updated Asset Loader

**Modified**: `apps/web/lib/canvas-renderer/asset-loader.ts`

**New functions**:
```typescript
preloadMaterialTexture(materialFamily: MaterialFamily): Promise<ImageData>
getCachedMaterialTexture(materialFamily: MaterialFamily): ImageData | null
```

**Updated**:
- `getPleatAssetUrls()` now returns only pleat-specific textures (no weaveDetail)
- Material textures loaded separately from dedicated folder
- Cache tracks both pleat assets and material textures independently

---

### 6. Updated Rendering Pipelines

**Modified**:
- `apps/web/lib/canvas-renderer/pipelines/tokens.ts`
- `apps/web/lib/canvas-renderer/pipelines/translucent.ts`

**Changes**:
- Import and use `getMaterialPreset()` for material parameters
- Import and use `getPleatingPreset()` for pleat parameters
- Load material textures via `getCachedMaterialTexture()`
- Use `materialPreset.textureScale` for weave detail
- Use `pleatingPreset.pleatTextureScale` for pleat-specific textures
- Use `materialPreset.noiseStrength` for fabric variation
- Use `pleatingPreset.pleatJitter` for pleat variation

---

### 7. Updated Main Renderer

**Modified**: `apps/web/lib/canvas-renderer/index.ts`

**Changes**:
- Preload both pleat assets **and** material texture in parallel
- Export new material texture functions

```typescript
await Promise.all([
  preloadPleatAssets(config.pleatId),
  preloadMaterialTexture(materialFamily),
]);
```

---

### 8. Updated Configure Page

**Modified**: `apps/web/app/configure/page.tsx`

**Changes**:
- Load all three preset systems: color, material, pleating
- Combine presets when fabric/color/pleat changes
- `weaveStrength` and `noiseStrength` come from material preset
- `pleatJitter` comes from pleating preset

```typescript
const colorPreset = getColorCategoryPreset(selectedFabric, color);
const materialPreset = getMaterialPreset(fabric.materialFamily);
const pleatingPreset = getPleatingPreset(selectedPleatId);

setCanvasRenderParams({
  shadowStrength: colorPreset.shadowStrength,
  weaveStrength: materialPreset.weaveStrength,
  occlusionStrength: colorPreset.occlusionStrength,
  contrastBoost: colorPreset.contrastBoost,
  noiseStrength: materialPreset.noiseStrength,     // ← From material
  pleatJitter: pleatingPreset.pleatJitter,         // ← From pleating
  flipTexture: false,
});
```

---

## Provider Compatibility

### Mock Catalog
✅ Already has `materialFamily` on fabric items:
- `plain-sheer-150`: `materialFamily: 'sheer'`
- `linen-300`: `materialFamily: 'linen'`
- `blackout-280`: `materialFamily: 'blackout'`

### Storefront Catalog
✅ `materialFamily` field already defined in `packages/core/src/catalog/types.ts`  
✅ Mappers will pass through this field from Magento product attributes

**No changes required** - both providers already support `materialFamily`

---

## Texture Asset Matrix

### Material Textures (Shared Across Pleat Types)
Located in `/public/textures/canvas/texture-details/`

| Material Family | Texture File | Scale | Opacity | Noise |
|----------------|--------------|-------|---------|-------|
| sheer | `sheer-weave.png` | 1.8 | 0.65 | 0.03 |
| linen | `linen-weave.png` | 1.4 | 0.95 | 0.08 |
| blackout | `blackout-weave.png` | 1.2 | 1.0 | 0.06 |
| cotton | `cotton-weave.png` | 1.5 | 0.92 | 0.07 |
| velvet | `velvet-weave.png` | 2.0 | 0.98 | 0.05 |
| silk | `silk-weave.png` | 1.6 | 0.88 | 0.04 |

### Pleat Textures (Material-Agnostic)
Located in `/public/textures/canvas/{pleatId}/`

| Pleat Type | Texture Files | Scale | Jitter |
|------------|--------------|-------|--------|
| wave | `pleatRamp.png`, `occlusion.png`, `translucencyMask.png` | 80 | 0.1 |
| flex | `flex25d/pleatRamp_flex.png`, `flex25d/occlusion_flex.png`, `flex25d/translucency_flex.png` (+ `flex25d/normal_flex.png`) | 180 | 0.1 |
| doubleFlex | `pleatRamp.png`, `occlusion.png`, `translucencyMask.png` | 50 | 0.1 |

---

## Benefits

### 1. Separation of Concerns
- **Material behavior** (fabric type) is independent of **color appearance** and **pleat style**
- Each preset system can be tuned independently

### 2. Reduced Asset Redundancy
- Material weave textures stored once instead of 3× (per pleat type)
- Easier to update/replace material textures

### 3. Easier Customization
- New materials can be added by:
  1. Adding texture to `texture-details/`
  2. Adding preset to `material-presets.ts`
  3. No changes to pleat system required

### 4. Type Safety
- Each preset system has its own TypeScript type
- Compiler catches mistakes when accessing wrong preset properties

### 5. Better Performance
- Material textures loaded in parallel with pleat textures
- Cached separately for optimal reuse

---

## Migration Notes

### For Designers
- Replace material textures in `/public/textures/canvas/texture-details/`
- Adjust `materialPresets` values in `material-presets.ts`
- Adjust `pleatingPresets` values in `pleating-presets.ts`
- Color presets remain in `color-presets.ts`

### For Developers
- Import correct preset system based on what you're configuring:
  - Color appearance → `color-presets.ts`
  - Fabric type → `material-presets.ts`
  - Pleat style → `pleating-presets.ts`
- Material textures now loaded via `getCachedMaterialTexture(materialFamily)`
- Pleat textures still loaded via `getCachedAsset(pleatId, assetName)`

---

## Testing Checklist

- [x] Material textures created for all 6 families
- [x] Material preset system functional
- [x] Pleating preset system functional
- [x] Color presets cleaned up (removed noiseStrength, pleatJitter)
- [x] Asset loader supports material textures
- [x] Tokens pipeline uses new preset system
- [x] Translucent pipeline uses new preset system
- [x] Main renderer preloads material textures
- [x] Configure page combines all three presets
- [x] Mock catalog has materialFamily defined
- [x] No TypeScript errors

### Manual Testing Required

1. **Material switching**: Select different fabric types → verify weave texture changes
2. **Pleat switching**: Select different pleat types → verify pleat pattern changes
3. **Color switching**: Select different colors → verify shadow/contrast changes
4. **Combined**: Switch material + pleat + color → verify independent behavior
5. **Performance**: Monitor asset cache stats → verify no duplicate loading

---

## Files Created

- `/public/textures/canvas/texture-details/sheer-weave.png`
- `/public/textures/canvas/texture-details/linen-weave.png`
- `/public/textures/canvas/texture-details/blackout-weave.png`
- `/public/textures/canvas/texture-details/cotton-weave.png`
- `/public/textures/canvas/texture-details/velvet-weave.png`
- `/public/textures/canvas/texture-details/silk-weave.png`
- `apps/web/lib/canvas-renderer/material-presets.ts`
- `apps/web/lib/canvas-renderer/pleating-presets.ts`

## Files Modified

- `apps/web/lib/canvas-renderer/color-presets.ts`
- `apps/web/lib/canvas-renderer/asset-loader.ts`
- `apps/web/lib/canvas-renderer/pipelines/tokens.ts`
- `apps/web/lib/canvas-renderer/pipelines/translucent.ts`
- `apps/web/lib/canvas-renderer/index.ts`
- `apps/web/app/configure/page.tsx`

---

## Next Steps

1. **Replace placeholder textures**: Current textures are copies of generic `weaveDetail.png`. Replace with actual material-specific patterns.
2. **Fine-tune presets**: Adjust `textureScale`, `opacity`, `noiseStrength`, and `pleatJitter` values based on real fabric samples.
3. **Add Debug UI controls**: Expose material and pleating presets in debug panel for live tuning.
4. **Document for Magento**: Ensure Magento product attributes include `materialFamily` field.
