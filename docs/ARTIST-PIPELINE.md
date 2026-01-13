# Artist Rendering Pipeline

Real-time curtain rendering with artist-authored textures (2025-11-04).

## Overview
- Enable with `NEXT_PUBLIC_EXPERIMENTAL_TEXTURES=artist`.
- Auto-selects texture family based on material weight + pleat type:
  - `wave-sheer` for light/sheer fabrics
  - `wave-drape` for heavy/blackout fabrics  
  - `flex` for flex pleats
  - `double-flex` for double flex pleats
- Each family needs 4–5 maps in `public/textures/canvas/{family}/` (1024×2048):
  - `pleatRamp.{webp,png,jpg,jpeg}` - shadow depth in pleats
  - `occlusion.{webp,png,jpg,jpeg}` - ambient occlusion darkness
  - `translucency.{webp,png,jpg,jpeg}` - light transmission mask
  - `normal.{webp,png,jpg,jpeg}` - specular highlight normals
  - `depth.{webp,png,jpg,jpeg}` (optional) - height/relief map to enhance fold shading
- **Format priority:** renderer now requests **WEBP first**, then falls back to PNG/JPEG if unavailable. Always ship `.webp` versions (smaller + alpha), but keep the same filenames so fallback works on older drops.
- Weave textures from `public/textures/canvas/texture-details/`:
  - `sheer-weave.{webp,png,jpg,jpeg}`, `linen-weave.{webp,png,jpg,jpeg}`, `blackout-weave.{webp,png,jpg,jpeg}`, etc.
- Fallback to procedural pipeline when maps missing.

## Realistic Rendering Approach
**Multi-layer compositing** for photorealistic fabric:
1. **Base color** → **Pleat shadows** (soft-light blend)
2. **Ambient occlusion** → depth in folds
3. **Weave texture** → material detail (multiply/overlay)
4. **Specular highlights** → sheen from normal map
5. **Transmission** → light passing through fabric
6. **Post-processing** → opacity, contrast, noise

**Material-specific presets** control blend strength:
- Sheer: high transmission, subtle shadows, low opacity
- Linen: medium shadows, natural weave variation
- Blackout: deep shadows, no transmission, full opacity
- Velvet: pronounced pile texture, moderate sheen
- Silk: smooth weave, high specular highlights

## Rendering Flow
1. Canvas renders single tile at canonical width (cached)
2. Artist maps scaled + cached per size (`family#variant#map#WxH`)
3. Weave texture scaled by `textureScale` parameter
4. During resize: cached tile re-tiled (no re-render, no flicker)
5. Optional passes: transmission (needs wall photo), specular (needs normals)

## Performance Targets
- First render: 90-140ms (M2 MacBook Air)
- Cached render: 8-15ms
- Edge drag: 0ms (tiling only)

## Debug Controls (`NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1`)
**Material Presets:** Texture Scale, Opacity, Noise Strength, Transmission, Shadow Gain, Highlight Clamp, Specular Boost, Weave Scale, Weave Blend Mode (multiply/overlay)
**Color Presets:** Shadow Strength, Occlusion Strength, Contrast Boost
**Pleating Presets:** Tile Width (px), Height Map Strength (depth.png influence)
**Shared:** Weave Strength

## Artist Handoff
1. Export 4 maps per family to `public/textures/canvas/{family}/`
2. Export weave textures to `public/textures/canvas/texture-details/`
3. Update `blender/texture-specs.json` with dimensions, variant count
4. Update `material-presets.ts` with material-specific values
5. Restart dev server (asset caching at boot)
6. Test all materials + pleats + wall photos in `/configure`

See also:
- `docs/ARTIST-PIPELINE-TESTING.md` - QA checklist
- `docs/ARTIST-PIPELINE-OPTIMIZATION.md` - performance notes
- `blender/ARTIST-BRIEF*.md` - texture production guidelines
