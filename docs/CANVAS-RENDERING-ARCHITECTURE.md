# Canvas Rendering Architecture

**Task 1010+** — Realistic curtain texture rendering system

---

## Overview

The Canvas rendering system generates realistic curtain previews using layered 2D canvas operations instead of CSS filters. This approach provides:

✅ **Accurate colors** across all color categories (whites, grays, darks, vibrant)  
✅ **Minimal asset overhead** (12 base textures vs hundreds)  
✅ **Material-aware rendering** via fabric family tokens  
✅ **Real-time parameter tuning** with live debug controls  

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Magento Storefront                                     │
│  └── Fabric Data                                        │
│      ├── materialFamily: 'linen' | 'sheer' | ...       │
│      ├── colorCategory: 'bright' | 'grey' | 'dark' | 'colored' | 'patterned' | 'intensive' | 'natural' | 'brown' │
│      └── customProperties (future)                     │
└─────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│  Canvas Renderer (apps/web/lib/canvas-renderer/)        │
│  ├── Color Category Presets (color-presets.ts)         │
│  ├── Material Tokens (material-tokens.ts)              │
│  └── Rendering Pipelines                               │
│      ├── tokens.ts (default)                           │
│      ├── translucent.ts (whites/sheers)                │
│      └── lut.ts (brand consistency)                    │
└─────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────┐
│  Texture Assets (public/textures/canvas/)               │
│  ├── wave/                                              │
│  │   ├── pleatRamp.png (shadow map)                    │
│  │   ├── weaveDetail.png (fabric texture)              │
│  │   ├── translucencyMask.png (light transmission)     │
│  │   └── occlusion.png (ambient occlusion)             │
│  ├── flex/ (same 4 files)                              │
│  └── doubleFlex/ (same 4 files)                        │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Color Category Presets

### Purpose
Map color categories to optimal rendering parameters, ensuring curtains look realistic across:
- **bright**: whites, creams, pastels
- **grey**: silvers, grays, charcoals
- **dark**: navy, black, deep colors  
- **colored**: vibrant colors
- **patterned**: special handling for patterns

### Implementation
**File**: `apps/web/lib/canvas-renderer/color-presets.ts`

```typescript
export const COLOR_CATEGORY_PRESETS: Record<ColorCategory, ColorCategoryPreset> = {
  bright: {
    shadowStrength: 0.70,       // Visible but gentle pleat shadows
    occlusionStrength: 0.40,     // Subtle depth
    contrastBoost: 0.00,         // No contrast boost (keeps whites bright)
  },
  // ... other categories
};
```

> ℹ️ `weaveStrength` now comes from `material-presets.ts`, so color presets focus solely on shadow, occlusion, and contrast tuning.

### Magento Integration
- **Fabric-level**: `fabric.colorCategory` → applies to all colors
- **Per-color**: `fabric.colorCategoryByColor[colorLabel]` → color-specific overrides
- **Fallback**: defaults to `'colored'` if not specified

---

## 2. Pleating Visualization

### Purpose
Visualize curtain folds and depth using pleat shadow maps.

### Implementation
**Asset**: `pleatRamp.png` (512×2048px grayscale)
- Vertical gradient representing pleat shadows from fold valleys to highlights
- Applied via soft-light blend mode
- Strength controlled by `shadowStrength` parameter

### Properties
- **wave**: Gentle S-curve pleats (classic drapery)
- **flex**: Flexible wave pattern
- **doubleFlex**: Double wave pattern (more pleats)
- **pleatTaper**: Multiplies top-to-bottom gather (0 = flat header, 1 = preset taper)

### Rendering
```typescript
applyPleatRamp(
  ctx, 
  pleatRamp, 
  canvasWidth, 
  canvasHeight, 
  materialToken.shadowGain * renderParams.shadowStrength, 
  1.0,
  pleatingPreset.pleatTextureScale,
  renderParams.flipTexture,
  pleatJitterStrength,
  pleatTaperStrength
);
```

---

## 3. Fabric Texture & Surface Properties

### Purpose
Simulate fabric weave, surface texture, and light interaction.

### 3.1 Weave Detail (`weaveDetail.png`)
**What it is**: 256×256px tileable fabric weave pattern  
**Purpose**: Adds realistic fabric texture visible at close range  
**Implementation**: Overlay blend mode with strength control  

**Current behavior**: Subtle noise/texture overlay  
**Future enhancement**: Per-materialFamily weave patterns (linen vs silk vs cotton)

```typescript
applyWeaveDetail(
  ctx, 
  weaveDetail, 
  canvasWidth, 
  canvasHeight, 
  materialToken.weaveStrength * renderParams.weaveStrength, 
  materialToken.weaveScale
);
```

### 3.2 Translucency Mask (`translucencyMask.png`)
**What it is**: Soft-edge alpha mask for light transmission  
**Purpose**: Used in translucent pipeline for sheer fabrics  
**Use case**: Bright colors + sheer materials  

### 3.3 Ambient Occlusion (`occlusion.png`)
**What it is**: Darkness map for pleat valleys and fold crevices  
**Purpose**: Adds depth and shadow complexity  
**Blend**: Multiply mode with strength control  

---

## 4. Noise/Displacement for Natural Look

### Purpose
Add subtle variation to break up uniform color fills and create organic fabric appearance.

### Implementation ✅
**Status**: Implemented using fractal noise  
**Approach**:
- Multi-octave noise (3 frequencies combined)
- Color variation within tolerance (±3% at full strength)
- Deterministic pattern (repeatable per coordinates)

**Algorithm**:
```typescript
// Sample noise at 3 frequencies
noise1 = simpleNoise(x * 0.05, y * 0.05) * 1.0
noise2 = simpleNoise(x * 0.10, y * 0.10) * 0.5
noise3 = simpleNoise(x * 0.20, y * 0.20) * 0.25
combined = (noise1 + noise2 + noise3) / 1.75

// Apply as subtle color variation
colorFactor = 1.0 + (combined * strength * 0.03)
```

### Debug Control
```typescript
noiseStrength: 0.05  // 0 = none, 0.2 = strong
```

**Use cases**:
- Break up solid color "flatness"
- Simulate natural fabric irregularities
- Add visual interest without overwhelming texture
- Creates organic wrinkling/variation effect

---

## Texture Flip Option

### Purpose
Swap pleat orientation (horizontal ↔ vertical).

### Implementation ✅
**Status**: Implemented in pleat ramp sampling logic  

**Default behavior (flipTexture = false)**:
- **Vertical pleats** (correct for curtains)
- Ramp tiles **horizontally** (repeat across width)
- Ramp samples **vertically** (full height gradient)
- UV calculation: `u = (x / textureScale) % 1`, `v = y / height`

**Flipped behavior (flipTexture = true)**:
- **Horizontal pleats** (edge case)
- Ramp tiles **vertically** (repeat across height)
- Ramp samples **horizontally** (full width gradient)
- UV calculation: `u = x / width`, `v = (y / textureScale) % 1`

```typescript
flipTexture: boolean  // false = vertical pleats (default), true = horizontal
```

**Fix applied**: Initial implementation was sampling incorrectly, causing horizontal pleats. Now fixed to render vertical pleats by default.

---

## Production Flow

### 1. Magento → Curtain Wizard Data Fetch
```typescript
{
  materialFamily: 'linen',           // → Material tokens
  colorCategory: 'bright',           // → Color preset
  colorCategoryByColor: {            // → Per-color overrides
    'cream': 'bright',
    'charcoal': 'dark'
  },
  customProperties: {                // Future: fabric-specific
    weavePattern: 'herringbone',
    surfaceFinish: 'matte',
    displacement: 'subtle'
  }
}
```

### 2. Rendering Pipeline Selection
1. **Check colorCategory** → load preset
2. **Check materialFamily** → load material tokens
3. **Merge with user overrides** (from debug UI)
4. **Render canvas** with combined parameters

### 3. Fallback Strategy
- Missing `colorCategory` → defaults to `'colored'`
- Missing `materialFamily` → defaults to `'linen'`
- Missing textures → solid color fill

---

## Debug UI Controls

Located in **🎛️ Live Render Controls** section:

| Control | Range | Purpose |
|---------|-------|---------|
| **Shadow Strength** | 0-1 | Pleat shadow intensity |
| **Weave Strength** | 0-1 | Fabric texture visibility |
| **Occlusion Strength** | 0-1 | Ambient darkening in folds |
| **Contrast Boost** | 0-0.5 | Overall contrast enhancement |
| **Noise Strength** | 0-0.2 | Natural variation/displacement |
| **Flip Texture** | checkbox | Rotate pleats 90° |

---

## Tuning Guide

### For Different Color Categories

#### Bright (Whites, Creams)
```
shadowStrength: 0.70
occlusionStrength: 0.40
contrastBoost: 0.00
```
✅ Keeps whites bright  
✅ Subtle shadows preserve cleanliness  

#### Dark (Navy, Black)
```
shadowStrength: 0.75
occlusionStrength: 0.40
contrastBoost: 0.26
```
✅ Strong contrast prevents flatness  
✅ Deep shadows add dimension  

#### Grey (Silvers, Charcoals)
```
shadowStrength: 0.75
occlusionStrength: 0.45
contrastBoost: 0.04
```
✅ Balanced depth and clarity  

---

## Performance Optimizations (2025-10-30)

### ✅ Implemented Optimizations

1. **Single-Pass Compositing** (~30-40ms saved)
   - Merged pleat ramp, weave detail, and occlusion into one loop
   - Eliminated 3× canvas `getImageData`/`putImageData` cycles
   - Reduces canvas I/O overhead by 66%

2. **Enhanced Zero-Strength Guards** (~15-25ms saved when effects disabled)
   - Skip pixel loops entirely if strength ≤ 0.001
   - Early exit if no effects enabled
   - Threshold-based activation per effect

3. **Noise Pattern Caching** (~10-15ms saved)
   - Pre-compute and cache fractal noise patterns per resolution
   - LRU cache (max 5 resolutions)
   - Reuses deterministic patterns across renders

4. **Render Debouncing** (~60-80% fewer renders during UI interaction)
   - 16ms debounce for slider changes
   - Immediate render for fabric/color/pleat switches
   - Prevents render spam during rapid parameter changes

5. **Lazy Translucent Pipeline** (~15-20ms saved when no background)
   - Only applies translucent blending if `backgroundImage` provided
   - Falls back to tokens pipeline immediately

**Expected Performance**: **80-176ms → 40-80ms** (~50% faster)

6. **Render Result Caching** (~instant on cache hit!)
   - Stores completed renders as data URLs indexed by config hash
   - LRU cache keeps last 20 renders (5-minute TTL)
   - Cache hit = ~2-5ms (image decode only)
   - Cache miss = normal render + store

7. **Pre-Warming Adjacent Colors** (~5-10 instant switches)
   - Background pre-renders up to 5 adjacent color variants
   - Uses `requestIdleCallback` for non-blocking pre-warming
   - Pre-warms at typical segment width for accurate cache hits
   - First color switch feels instant (cache hit)

**With Caching**: **First render 40-80ms → subsequent <5ms** (~10-15× faster on hits)

8. **Cached Texture Tiling** (image-like behavior)
   - Renders curtain texture once at canonical width (~3 tiles)
   - Caches rendered texture independently of canvas width
   - **CRITICAL**: Separate `useEffect` for width changes (tiles only, immediate)
   - Main effect excludes `width` from dependencies to prevent re-renders during resize
   - Re-renders only when fabric/color/pleat/params actually change
   - Behaves exactly like CSS background-image tiling
   - **DO NOT add `width` to main effect dependencies** - causes flickering!

### Performance Monitoring

Enable debug mode to see render metrics:
```typescript
renderParams={{ ..., debug: true }}
```

Console output includes:
- Total render time (ms)
- Individual pipeline timings
- Effect strengths applied
- Asset cache stats

### Next Steps

#### Short-term
1. ✅ Color category presets
2. ✅ Noise/displacement parameter
3. ✅ Texture flip option
4. ✅ Single-pass compositing
5. ✅ Noise pattern caching

#### Medium-term
6. ⏭️ Magento custom properties integration
7. ⏭️ Per-fabric weave texture assets
8. ⏭️ Advanced displacement maps
9. ⏭️ Color category auto-detection (if missing)

#### Long-term (Future Consideration)
10. ⏭️ Resolution scaling (0.75× render, CSS upscale)
11. ⏭️ WebWorker offloading for parallelism
12. ⏭️ WebGL acceleration
13. ⏭️ Real-time lighting simulation
14. ⏭️ AI-tuned parameters per fabric SKU

---

## FAQ

### Q: What is `weaveDetail.png`?
**A**: Fabric surface texture. Currently a subtle noise pattern; future versions will have per-materialFamily weave patterns (linen herringbone, silk smooth, etc.).

### Q: Why are pleats horizontal?
**A**: Pleat ramps tile **horizontally** (repeat-x) to create **vertical** pleats. The gradient runs vertically (top-to-bottom of the ramp image), and this pattern repeats across the width to show multiple pleats side-by-side.

### Q: When to use `flipTexture`?
**A**: If your pleat ramp assets are authored with horizontal gradients (should be vertical), flip will rotate them 90° for correct display.

### Q: How does color category preset work with debug sliders?
**A**: 
- **Without debug UI**: Uses color category preset automatically
- **With debug UI**: Starts with preset, but user can override any parameter live
- **Reset button**: Restores default preset values

---

## See Also
- **Playbook**: `docs/Curtain-Texture-Experiments/curtain-preview-rendering-playbook.md`
- **Module README**: `apps/web/lib/canvas-renderer/README.md`
- **Color Presets**: `apps/web/lib/canvas-renderer/color-presets.ts`
- **Material Tokens**: `apps/web/lib/canvas-renderer/material-tokens.ts`
