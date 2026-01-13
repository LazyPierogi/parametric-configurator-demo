# Artist Pipeline Testing Guide

Quick guide to test the artist-authored texture pipeline with mock textures.

## 1. Generate Mock Textures

```bash
npm run textures:mock
```

**Output:** 16 PNG files in `public/textures/canvas/`
- `wave-drape/` (4 maps)
- `wave-sheer/` (4 maps)
- `flex/` (4 maps)
- `double-flex/` (4 maps)
  
Note: Real assets may include an additional optional `depth.png` (height/relief map) per family.

## 2. Enable Artist Pipeline

Add to `.env.local`:

```bash
NEXT_PUBLIC_EXPERIMENTAL_TEXTURES=artist
NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1
```

## 3. Start Dev Server

```bash
npm run dev
```

## 4. Test Flow

1. **Upload photo** on `/estimate`
2. **Mark wall** and proceed to `/configure`
3. **Select fabrics:**
   - Sheer/Voile → uses `wave-sheer`
   - Linen/Cotton → uses `wave-drape` (wave) or `flex` (flex)
   - Velvet/Formal → uses `double-flex`
4. **Change pleat type:**
   - Wave → `wave-drape` or `wave-sheer`
   - Flex → `flex`
   - Double-Flex → `double-flex`
5. **Check console** for loading confirmation:
   ```
  [Canvas Renderer] Preloaded 4/5 artist maps for wave-drape
  [Artist Pipeline] Render complete { family: 'wave-drape', ... }
  ```

## 5. Visual Checks

### Wave-Drape vs Wave-Sheer
- **Wave-Drape:** Darker, more opaque (linen-heavy, blackout)
- **Wave-Sheer:** Brighter, more translucent (sheer, voile)

### Flex
- Should show X-pinch pattern in header (top ~12%)
- Sharper contrast than wave

### Double-Flex
- Much tighter pleat spacing (17 vs 9)
- Darker overall, minimal variation

## 6. Debug Controls

With `NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1`, you'll see sliders:

- **Shadow Strength** → affects pleatRamp intensity
- **Occlusion Strength** → affects AO darkness
- **Weave Strength** → material texture overlay
- **Transmission Strength** → translucency (needs background)
- **Specular Strength** → surface highlights (from normal map)
- **Artist Variant** → (1 for mocks, will support 1-3 when real textures arrive)
 - **Height Map Strength** → influence from `depth.png` if present

## 7. Expected Behavior

✅ **Pipeline loads without errors**  
✅ **Curtains render with pleat patterns**  
✅ **Switching fabrics/pleats changes texture family**  
✅ **Multiple segments tile seamlessly**  
✅ **Console shows artist map loading**  
✅ **Fallback to tokens works if maps missing**

## 8. Performance Check

**First render:** 90–140 ms (load + composite)  
**Cached render:** 8–15 ms  
**Segment drag:** Instant (tiling only, no re-render)

Check console for render timings:
```
[Canvas Renderer] Complete { renderTimeMs: '87.42', pipeline: 'artist', ... }
```

## 9. Common Issues

**"Missing core maps for family X"**
→ Run `npm run textures:mock` again

**"Artist pipeline failed, falling back to tokens"**
→ Check browser console for specific error
→ Verify PNG files exist in correct folders

**Textures look flat/unrealistic**
→ Expected! These are mocks (simple gradients)
→ Final Blender assets will be photorealistic

**Pipeline not activating**
→ Verify `NEXT_PUBLIC_EXPERIMENTAL_TEXTURES=artist` in `.env.local`
→ Restart dev server after env change

## 10. Comparing Pipelines

Test different pipelines side-by-side:

```bash
# Artist (mock textures)
NEXT_PUBLIC_EXPERIMENTAL_TEXTURES=artist

# Tokens (procedural)
NEXT_PUBLIC_EXPERIMENTAL_TEXTURES=tokens

# Tokens + Translucent (auto-select)
NEXT_PUBLIC_EXPERIMENTAL_TEXTURES=tokens+translucent
```

Reload page after each change.

---

## Next: Replace Mocks with Real Textures

When 3D artist delivers final assets:

1. Drop PNG files into same folders (overwrite mocks)
2. Verify naming: `pleatRamp.png`, `occlusion.png`, `translucency.png`, `normal.png`, optionally `depth.png`
3. Check resolution: 1024×2048
4. Test in `/configure` with various colors
5. Pipeline automatically uses new textures (no code changes)

If `depth.png` is provided, the Debug UI exposes a "Height Map Strength" slider under Pleating Presets.

See `docs/MOCK-ARTIST-TEXTURES.md` for full details.
