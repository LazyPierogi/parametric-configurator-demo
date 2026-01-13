# Mock Artist Textures

**Purpose:** Placeholder textures for testing the artist pipeline before final assets arrive from the 3D artist.

## Quick Start

### Generate Mock Textures

```bash
npm run textures:mock
```

This creates 16 WEBP files (4 families × 4 maps) in `public/textures/canvas/` (PNG/JPEG fallbacks are still accepted):

```
public/textures/canvas/
├── wave-drape/
│   ├── pleatRamp.webp
│   ├── occlusion.webp
│   ├── translucency.webp
│   └── normal.webp
├── wave-sheer/
│   └── (same 4 files)
├── flex/
│   └── (same 4 files)
└── double-flex/
    └── (same 4 files)
```

Note: Final artist drops may include an additional optional `depth.webp`/`depth.png` (height/relief map) alongside the four core maps. The mock generator does not produce `depth`.

### Enable Artist Pipeline

Set in `.env.local`:

```bash
NEXT_PUBLIC_EXPERIMENTAL_TEXTURES=artist
```

Restart dev server:

```bash
npm run dev
```

Navigate to `/configure` and select fabrics/pleats. You should see procedurally generated pleat patterns instead of the old CSS textures.

---

## What Are Mock Textures?

Mock textures are **programmatically generated gradients** that simulate the structure of artist-authored maps:

- **pleatRamp**: Sinusoidal or X-pinch patterns (brightness = fold depth)
- **occlusion**: Darkening in troughs (ambient occlusion)
- **translucency**: Light transmission mask (varies by family)
- **normal**: Surface orientation (RGB tangent space)

They're NOT photorealistic, but they:
- ✅ Test the pipeline logic
- ✅ Verify asset loading
- ✅ Validate rendering parameters
- ✅ Allow UI/integration work to continue

---

## Characteristics by Family

### wave-drape
- 9 pleats, soft sinusoidal wave
- Low translucency (20%)
- Smooth gradients
- **Use for:** linen-heavy, blackout

### wave-sheer
- 9 pleats, soft sinusoidal wave
- High translucency (70%)
- Brighter overall
- **Use for:** sheer, voile

### flex
- 9 pleats, X-pinch header
- Medium translucency (30%)
- Sharp transitions in top 20%
- **Use for:** linen, cotton

### double-flex
- 17 pleats, dense uniform
- Very low translucency (10%)
- Tight spacing
- **Use for:** velvet, formal

---

## Replacing with Real Textures

When the 3D artist delivers final assets:

1. **Drop files** into the same folders (overwrite mocks)
2. **Verify naming** matches exactly:
   - `pleatRamp.webp`, `occlusion.webp`, `translucency.webp`, `normal.webp`, optionally `depth.webp` (PNG/JPEG copies optional as fallback)
3. **Check resolution**: 1024×2048 (mocks are correct size)
4. **Verify formats**:
   - pleatRamp/occlusion/translucency: 16-bit WEBP (lossless) preferred, PNG fallback acceptable, Linear color space
   - normal: 8-bit RGB WEBP (or PNG fallback), OpenGL tangent space
5. **Test** in `/configure` with various colors/fabrics
6. **Delete mock generator** when no longer needed

No code changes required! The pipeline reads from the same paths.

---

## Debug Mode

Enable debug logging to see map load status:

```bash
NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1
```

Then in `/configure`, check the browser console:

```
[Canvas Renderer] Preloaded 4/4 artist maps for wave-drape (variant 1, pleats=9)
[Artist Pipeline] Render complete { family: 'wave-drape', variant: 1, mapsLoaded: {...} }
```

---

## Troubleshooting

**"Missing core maps for family X"**
→ Run `npm run textures:mock` again
→ Check `public/textures/canvas/{family}/` exists

**"Artist pipeline failed, falling back to tokens"**
→ Check browser console for asset load errors
→ Verify WEBP files aren't corrupted (PNG/JPEG fallback also supported)

**"Textures look flat/unrealistic"**
→ Expected! These are mocks. Final textures from Blender will look photorealistic.

**"Pipeline seems slow"**
→ Mocks are small (~13-60KB each), so it's not the textures
→ Check debug timings, may be normal for first render

---

## Script Details

**Location:** `scripts/generate-mock-artist-textures.mjs`

**Dependencies:** Uses `canvas` package (already in devDependencies)

**How it works:**
1. Creates 4 family directories
2. For each family, generates 4 PNG maps using Canvas 2D API
3. pleatRamp uses sinusoidal/X-pinch math based on family spec
4. occlusion, translucency, normal are derived patterns
5. Saves as 8-bit PNG (browser-compatible, fast)

**Regenerate anytime:**
```bash
npm run textures:mock
```

Safe to run multiple times (overwrites old mocks).

---

## Next Steps

1. ✅ Mocks generated → pipeline testable
2. ⏳ Artist models & bakes (7-10 days)
3. 🎨 Replace mocks with final PNGs
4. 🚀 Flip env to `artist` as default

See `blender/ARTIST-BRIEF.pl.md` for artist instructions.
