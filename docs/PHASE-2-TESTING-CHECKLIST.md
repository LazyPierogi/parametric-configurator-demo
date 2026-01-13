# Phase 2: Pre-Production Testing Checklist

**Status**: 🚧 READY TO START  
**Prerequisites**: Phase 1 complete (grayscale removal, env var rename)  
**Reference**: `/docs/ARTIST-PIPELINE-MIGRATION.md`

---

## 2.1 Texture Coverage Verification

### Generate Mock Textures
```bash
cd /Users/mario/Repo/Curtain\ Wizard
npm run textures:mock
```

**Expected Output**:
- 16 PNG files created in `/public/textures/canvas/`:
  - `wave-drape-0/` (4 maps: pleat-ramp, weave, occlusion, translucency)
  - `wave-sheer-0/` (4 maps)
  - `flex-0/` (4 maps)
  - `double-flex-0/` (4 maps)

### Verify Texture Files
- [ ] All 16 files exist
- [ ] Files are valid PNG format
- [ ] File sizes reasonable (not 0 bytes)
- [ ] Maps visually distinguishable in preview

### Test Graceful Degradation
Temporarily delete one texture family:
```bash
rm -rf public/textures/canvas/flex-0
```

- [ ] App still loads without crashing
- [ ] Console shows fallback warning
- [ ] Flex pleats render (fallback to token pipeline)
- [ ] Other pleats (wave/doubleFlex) render with artist maps

**Restore deleted files** before proceeding:
```bash
npm run textures:mock
```

---

## 2.2 Rendering Matrix Test

Test **all combinations**:
- 3 pleat types: wave, flex, doubleFlex
- 7 material families: sheer, linen, blackout, blackout-basic, cotton, velvet, silk
- 6 color categories: white, light, colored, intensive, natural, brown

### Quick Test Procedure

1. **Start dev server**:
   ```bash
   npm run dev
   ```

2. **Upload test image** (use any wall photo from `/public/originals/`)

3. **Mark wall box** and proceed to Configure page

4. **Test Matrix** (sample combinations):

   | Pleat | Material | Color | Status | Notes |
   |-------|----------|-------|--------|-------|
   | wave | linen | white | ⬜ | High brightness, minimal shadows |
   | wave | sheer | light | ⬜ | Translucency visible |
   | flex | cotton | colored | ⬜ | Balanced shading |
   | flex | blackout | intensive | ⬜ | Deep shadows, rich tones |
   | doubleFlex | velvet | natural | ⬜ | Warm, organic appearance |
| doubleFlex | silk | brown | ⬜ | Earthy, grounded tones |
| wave | blackout-basic | dark | ⬜ | New coated blackout weave |

5. **For each combination**:
   - [ ] Curtain renders without errors
   - [ ] Texture appears (not blank/gray)
   - [ ] Pleat definition visible
   - [ ] Color matches selection
   - [ ] No console errors
   - [ ] Render time <200ms (check debug panel)

### Debug UI Verification

Enable debug panel:
```bash
# Already set in .env.local
NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1
```

- [ ] Canvas Rendering section visible in debug panel
- [ ] Pipeline shows: `artist`
- [ ] Material family displays correctly
- [ ] Color hex and luminance accurate
- [ ] Pleat ID matches selection
- [ ] Render parameter sliders work:
  - [ ] Shadow Strength (0-2)
  - [ ] Weave Strength (0-2)
  - [ ] Occlusion Strength (0-2)
  - [ ] Artist Variant (0+)

---

## 2.3 Performance Validation

### Canvas Width Effect (Critical)
**Test edge handle drag** (segment resize):
- [ ] Drag edge handle left/right
- [ ] No flickering during drag
- [ ] No "Rendering..." indicator appears
- [ ] Texture tiles smoothly
- [ ] Performance <1ms per width change

**Test center handle drag** (segment move):
- [ ] Drag center handle left/right
- [ ] Smooth dragging (different code path)
- [ ] No flickering

### Cache Warming
- [ ] Open Configure page
- [ ] Switch between fabrics in same category
- [ ] Subsequent renders faster (cache hits)
- [ ] Check console for cache stats (if debug enabled)

### Drag Operations
- [ ] Enable drag operation (move segment)
- [ ] During drag: rendering skipped (`isDragging` flag)
- [ ] After drag ends: final render executes
- [ ] No infinite re-render loops

### Mobile Performance
**Test on device or simulator**:
- [ ] iPhone/iPad Safari
- [ ] Android Chrome
- [ ] Render time <200ms target
- [ ] No lag during fabric/color switching
- [ ] Smooth scrolling

---

## 2.4 Wall Tiling & Segment Offsets

### Multi-Segment Test
1. Set segment count to 3
2. Mark wall box
3. Configure curtains

**Verify**:
- [ ] All 3 segments render
- [ ] Pattern continuous across segments (no seams)
- [ ] Tiling anchored to wall box left edge
- [ ] Drag segment edge: pattern stays aligned
- [ ] Each segment uses `tileOffsetPx` correctly

### Stitch Overlay Alignment
```bash
# Enable stitch lines (if disabled)
NEXT_PUBLIC_STITCH_LINES_ENABLED=1
```

- [ ] Stitch overlays appear
- [ ] Overlays pixel-aligned with segment boundaries
- [ ] Overlays move with segment drags
- [ ] Overlays hide when flag set to 0

---

## 2.5 Cache Invalidation

### Test Cache Clearing
1. Render curtain with fabric A
2. Switch to fabric B (different material/color)
3. Switch back to fabric A

**Verify**:
- [ ] Fabric B renders correctly (cache miss → new render)
- [ ] Fabric A re-renders (cache still valid)
- [ ] No stale textures shown
- [ ] Console shows cache behavior (if debug)

### Test Parameter Changes
1. Render curtain
2. Open debug panel
3. Adjust shadow/weave/occlusion sliders

**Verify**:
- [ ] Live preview updates immediately
- [ ] Debouncing works (no render per pixel)
- [ ] Cache invalidated on parameter change
- [ ] Performance stays smooth

---

## 2.6 Regression Tests

### Width Effect Regression (Critical)
**DO NOT BREAK**: CanvasCurtainLayer.tsx width effect

Symptoms if broken:
- Flickering during edge handle drag
- "Rendering..." indicator during resize
- Canvas clears and reverts to CSS
- Infinite re-render loop

**Test**:
- [ ] Drag edge handle: smooth, no flicker
- [ ] Drag edge handle: no render logs in console
- [ ] After idle time: canvas persists (doesn't revert to CSS)

### CSS Fallback Regression
Set pipeline to `off`:
```bash
NEXT_PUBLIC_TEXTURES_PIPELINE=off
```

- [ ] App renders with CSS textures
- [ ] No canvas rendering attempted
- [ ] Legacy background tiling works
- [ ] No errors in console

**Restore**:
```bash
NEXT_PUBLIC_TEXTURES_PIPELINE=artist
```

---

## 2.7 Error Handling

### Missing Texture Graceful Fail
1. Delete one texture map:
   ```bash
   rm public/textures/canvas/wave-drape-0/pleat-ramp.png
   ```

2. Attempt to render wave curtain

**Verify**:
- [ ] App doesn't crash
- [ ] Error boundary catches issue OR fallback renders
- [ ] Console shows helpful error message
- [ ] User sees fallback texture or error message

3. **Restore file**:
   ```bash
   npm run textures:mock
   ```

### Invalid Environment Value
Set invalid pipeline:
```bash
NEXT_PUBLIC_TEXTURES_PIPELINE=invalid
```

- [ ] Console shows warning log
- [ ] Defaults to `artist` pipeline
- [ ] App continues to function

**Restore**:
```bash
NEXT_PUBLIC_TEXTURES_PIPELINE=artist
```

---

## Phase 2 Success Criteria

- [ ] All texture files generated successfully
- [ ] All pleat/material/color combinations render
- [ ] Performance <200ms on mobile
- [ ] Width effect fast path working (no flicker)
- [ ] Cache warming and invalidation correct
- [ ] Multi-segment tiling seamless
- [ ] Stitch overlays pixel-aligned
- [ ] CSS fallback works
- [ ] Graceful degradation for missing textures
- [ ] No console errors during normal operation

---

## On Phase 2 Completion

✅ **Document findings**:
- Note any failing combinations
- Record performance metrics
- List any console warnings
- Capture screenshots of issues

✅ **Update migration plan**:
- Mark Phase 2 checklist items complete
- Document any deviations from plan
- Update risk assessment if needed

✅ **Proceed to Phase 3**: Production Deployment Planning

---

**Quick Commands**:
```bash
# Generate textures
npm run textures:mock

# Start dev server
npm run dev

# Production build test
npm run build

# Check environment
node -e "console.log(process.env.NEXT_PUBLIC_TEXTURES_PIPELINE)"
```
