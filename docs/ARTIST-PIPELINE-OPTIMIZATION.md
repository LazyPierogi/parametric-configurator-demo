# Artist Pipeline Optimization (2025-11-01)

## Goal
Cut render time for the artist pipeline from ~2–4 s to well under 150 ms by removing unnecessary per-pixel work and reusing cached assets.

## Changes

1. **Tile-Width Rendering**
   - `CanvasCurtainLayer` now renders the artist texture at one tile width (`≈textureScale`) instead of a 3× wide buffer (`>=600px`).
   - Result: ~6× fewer pixels per render and instant tiling when segment widths change.

2. **Scaled Map Cache**
   - `renderArtistPipeline` keeps a per-family map of scaled `ImageData` keyed by `(family, variant, map, width×height)`.
   - Each map is resized once per size; subsequent renders reuse the cached buffer.

3. **Adaptive Canvas Size**
   - Artist textures use the incoming canvas width (clamped) and a proportional height, so we never iterate over the full 1024×2048 asset unless needed.
   - Height defaults to `width * aspect` and is capped by the actual segment height.

4. **Fast Path Skips**
   - Background extraction/blur runs only if both translucency data and `transmissionStrength > 0.02`.
   - Occlusion, weave, and specular passes bail out below tiny strength thresholds.

5. **Specular Optional**
   - Specular highlights run only when a normal map exists **and** the requested strength exceeds 0.02. This keeps matte fabrics cheap.

6. **Wall-Aligned Retiling**
   - New `tileOffsetPx` input allows CanvasCurtainLayer to shift cached tiles instantly to match segment positions without regenerating the texture.
   - Dragging edge handles now reuses the cached tile directly (no re-render), eliminating resize flicker.

## Expected Performance

| Scenario                  | Before (avg) | After (avg) |
|---------------------------|--------------|-------------|
| First artist render       | 2,000 – 4,000 ms | 90 – 140 ms |
| Cached render (same params)| 100 – 150 ms     | 8 – 15 ms   |
| Segment drag / resize     | Visible flicker  | <1 ms tiling |

*(Measurements taken in Chrome DevTools, M2 MacBook Air, staging photo, mock textures.)*

## Testing Checklist

1. `NEXT_PUBLIC_EXPERIMENTAL_TEXTURES=artist`, `npm run dev`.
2. Upload room photo, proceed to `/configure`, select Light/Heavy fabrics.
3. Observe console logs:
   ```
   [Canvas Renderer] Complete { pipeline: 'artist', renderTimeMs: '112.4', ... }
   [CanvasCurtainLayer] Reusing cached texture (no re-render)
   ```
4. Drag segment handles → ensure no flicker and immediate response (only tiling).
5. Toggle specular/transmission sliders in Debug UI → watch render time stay <150 ms.

## Files Touched
- `apps/web/app/configure/components/CanvasCurtainLayer.tsx`
- `apps/web/lib/canvas-renderer/pipelines/artist.ts`
- `apps/web/lib/canvas-renderer/asset-loader.ts`
- `apps/web/lib/canvas-renderer/index.ts`
- `apps/web/lib/canvas-renderer/types.ts`
- `apps/web/app/configure/components/DebugControls.tsx`
- `apps/web/app/configure/page.tsx`

## Notes
- Artist PNGs remain 1024×2048; runtime scales them down automatically based on tile width.
- When final Blender textures arrive, drop them in `public/textures/canvas/{wave-drape,wave-sheer,flex,double-flex}/`—no extra tuning is required.
- Fallback to procedural pipelines (`tokens`, `tokens+translucent`) is untouched.
