# Curtain Preview Rendering — Playbook (Next.js + Tailwind + Canvas/iFrame)

# Original problem definition
We have an issue in our Curtain Wizard app connected to textures that visualize curtains. Currently, we use a separate texture per fabric color, which is a child SKU. This means that if we have 10 fabrics and 10 colors each, we have 100 textures to render, but furthermore, we want those textures to be different also depending on the pleating, whether it's a wave or flex or double flex. This multiplies into hundreds of textures, and this is just not sustainable. It's very tricky to render them in the same quality, etc. We want to try a different approach, where we will be able to render all curtain textures (in 3 pleating variants wave, flex, and double flex) with minimal resources. They have to be realistic, consistent, across colors and fabric families (sheer/voile, suede, cotton linen, blackout etc.) without exploding the number of textures. 

> Goal: **Realistic, consistent curtain previews** across colors and fabric families (sheer/voile, linen, blackout) without exploding the number of textures.

## Stack Context
- Host: **Next.js + Tailwind**
- Preview: **HTML Canvas (2D)** rendered **inline** within the Configure page
  - *(Note: "iframe" refers to how the entire Curtain Wizard app is embedded within the parent Magento storefront, not the canvas rendering implementation)*
- Assets: a *minimal* set per pleat style (wave / flex / double flex)

---

## Top 3 Rendering Pipelines

### 1) Translucent Sheer Pipeline (for whites & light colors)
**When:** `fabric === 'sheer'` **or** color luminance `Y > 0.7` (bright colors).  
**Why:** Pure tint-over-grayscale makes whites look dull/gray. Simulating **transmission** (background bleeding through fabric) keeps whites bright and believable.

**Layers (bottom → top):**
1. **Blurred Background** (offscreen canvas snapshot) × **Translucency Mask** (0..1)
2. **Tint Layer** (`screen` / `color-dodge`) with alpha depending on luminance
3. **Pleat Shadow Ramp** (`multiply`) with a **clip** for bright colors
4. **Subtle Specular/Highlight** (add)

**Heuristics:**
```js
const Y = relativeLuminance(hex); // 0..1 (sRGB → linearized)
const useTranslucent = fabric === 'sheer' || Y > 0.7;
const tintBlend  = Y > 0.7 ? 'screen' : 'soft-light';
const tintAlpha  = Y > 0.7 ? 0.35 : 0.2;
const shadowClip = Y > 0.85 ? 0.90 : 1.0; // don't dirty whites
```

**Why it works:** Light colors preserve brightness because shadows are clipped and the background contributes real-world light through the fabric.

---

### 2) Parametric “Material Tokens” + 3–4 maps per pleat
**When:** Default for most fabrics/colors.  
**Why:** Flexible, highly consistent, **zero textures per color**. You define fabric “character” via parameters instead of assets.

**Per-pleat assets (max 3–4):**
- `pleatRamp` — grayscale ramp (or 1D LUT) mapping pleat shading.
- `weaveDetail` — small, seamless weave pattern (tile 256–512px).
- `translucencyMask` — per-pixel transmission for sheer.
- *(optional)* `occlusion` — soft self-occlusion multiplier.

**Material Token (JSON) example:**
```json
{
  "fabric": "linen",
  "transmission": 0.05,
  "weaveScale": 1.6,
  "weaveStrength": 0.25,
  "shadowGain": 0.18,
  "highlightClamp": 0.20,
  "specBoost": 0.05
}
```

**Render order (Canvas 2D):**
1. Base **tint(hex)** on empty layer.
2. `soft-light` with **pleatRamp** (volumetric feel without “dirtying” whites).
3. `overlay` with **weaveDetail** at `alpha = weaveStrength` (fabric character).
4. If `fabric === 'sheer'`: mix with blurred background by `transmission × translucencyMask`.
5. Apply tone curve based on luminance (keeps contrast stable across colors).

**Tone heuristics (simple & effective):**
```js
const Y = relativeLuminance(hex);
const shadowGain     = lerp(0.12, 0.30, 1.0 - Y); // darker colors tolerate deeper shadows
const highlightClamp = lerp(0.30, 0.15, 1.0 - Y); // bright colors clamp highlights more
const contrast       = 1.0 + lerp(0.05, 0.18, 1.0 - Y);
```

---

### 3) Mini-LUT “Brand Look” per fabric family
**When:** You want **repeatable, on-brand** output regardless of input color.  
**Why:** A small LUT normalizes tone & saturation, protecting whites and keeping a stable studio look.

**How:** Implement a lightweight post-process LUT:  
- Use a **1D luminance LUT** (256 entries) + a small **saturation LUT** (256 entries).  
- Keep hue intact; remap luminance and saturation by index `Y*255`.

**Pseudo:**
```js
const y  = luma(rgb);
const y2 = lutY[(y*255)|0];
const s2 = sat(rgb) * lutSat[(y*255)|0];
const out = fromYSh(rgbHue(rgb), y2, s2); // hue preserved
```

**Result:** Consistent “voile/linen/blackout” signatures with minimal cost.

---

## Feature Flags (Runtime Switch)
Controlled via environment variable:
```
NEXT_PUBLIC_EXPERIMENTAL_TEXTURES = off | grayscale | tokens | tokens+translucent | tokens+translucent+lut
```
- `off` = Legacy CSS textures (current production default)
- `grayscale` = Existing CSS filter system
- `tokens` = Pipeline #2 (parametric material tokens)
- `tokens+translucent` = #2 + #1 (auto for bright/sheers)
- `tokens+translucent+lut` = #2 + #1 + #3 (brand LUT)

Debug UI logs per render: color hex, luminance `Y`, chosen ramp ID, shadowGain, highlightClamp, FPS.

---

## Minimal Asset Pack (per pleat style)
- **pleatRamp.png** (grayscale 1K or a 256×1 1D LUT ramp)
- **weaveDetail.png** (tileable 256–512px, seamless)
- **translucencyMask.png** (for sheers; grayscale 0..1)
- *(optional)* **occlusion.png** (broad AO, subtle)

**Notes**
- Use **linear color space** when sampling ramps.
- Keep weave detail **neutral-gray** so tint governs color.
- For sheers, translucencyMask usually correlates with pleat shadows (thicker folds = less transmission).

---

## Canvas 2D Implementation Sketch

**Blend helpers (concept):**
```js
function blendScreen(base, tint, a){ return lerp(base, 1 - (1-base)*(1-tint), a); }
function blendSoftLight(base, map){ /* standard soft-light formula */ }
function blendOverlay(base, map, a){ /* overlay formula with alpha */ }
```

**Translucency (Sheer):**
```js
const bg = sampleBlurredBG(x, y);             // offscreen snapshot + small blur
const m  = sampleMask(translucencyMask, u, v);// 0..1
const transmitted = mix(base, bg, m * transmission);
```

**Shadow clip for bright colors:**
```js
const ramp = sampleRamp(pleatRamp, u, v); // 0..1
const shaded = clamp( mix(base, base*ramp, shadowGain), 0.0, shadowClip );
```

---

## QA & Tuning Checklist
- **Golden set**: 6 colors (very light, light, mid, mid-warm, dark, very dark) × 3 pleats × 3 fabrics.
- Compare **legacy vs pipeline** at equal zoom/lighting.
- Validate **white point**: sheer white should be near UI background white but still show folds.
- Check **tile seams** on weaveDetail (rotate/offset test).
- Perf: offscreen blur ≤ 6 px; reuse blurred BG between frames unless camera moves.

---

## Example Token Presets
```json
{
  "sheer":  { "transmission": 0.45, "weaveScale": 1.2, "weaveStrength": 0.12, "shadowGain": 0.10, "highlightClamp": 0.28, "specBoost": 0.04 },
  "linen":  { "transmission": 0.05, "weaveScale": 1.6, "weaveStrength": 0.25, "shadowGain": 0.18, "highlightClamp": 0.20, "specBoost": 0.05 },
  "blackout": { "transmission": 0.00, "weaveScale": 1.3, "weaveStrength": 0.18, "shadowGain": 0.26, "highlightClamp": 0.16, "specBoost": 0.03 }
}
```

---

## References & Useful Docs (concepts, APIs, assets)
- Canvas compositing modes — MDN: `globalCompositeOperation`: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation?utm_source=chatgpt.com
- Relative luminance (WCAG) and linearization formula: https://www.w3.org/WAI/GL/wiki/Relative_luminance?utm_source=chatgpt.com
- PBR Fabric texture sources (CC0): ambientCG, Poly Haven
- Transmission / alpha maps: three.js docs (conceptual parity with Canvas pipeline)
- Intro to LUTs for consistent looks: https://www.bromptontech.com/what-is-a-3d-lut/?utm_source=chatgpt.com

(See the companion links in the chat message for clickable sources.)

---

*Author: Mario’s tech stack notes — curtain preview rendering v1*
