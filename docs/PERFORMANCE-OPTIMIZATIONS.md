# Performance Optimizations — 2025-09-30

## Summary

Two critical performance optimizations implemented to handle high-resolution smartphone photos (4000×3000px+):

### 1. AI #2 Segmentation (Task 907 + 908a)
**Problem:** 4032×3024 images took 60-90 seconds to segment  
**Root cause:** Python service was upscaling masks back to original resolution before sending to Node.js

**Solution:**
- Removed `opencv-python-headless` from requirements.txt (EXIF overhead)
- Added `LOCAL_SEG_LONG_SIDE=768` env variable
- Python resizes images to 768px before inference (~2.8s on MPS)
- Segmentation mask stays at inference resolution (768×576)
- Node.js post-processing happens at low resolution (fast)
- Final PNG output at 768×576 (sufficient for curtain placement)

**Results:**
- **Before:** 60-90 seconds for 4032×3024 images
- **After:** 4-5 seconds for same images
- **18× speedup**

**Files modified:**
- `services/segmentation/requirements.txt` — removed opencv
- `services/segmentation/main.py` — use inference size for post-processing
- `packages/shared/src/env.ts` — added LOCAL_SEG_LONG_SIDE schema
- `packages/core/src/lib/segmentation.ts` — debug logging

**Env variables:**
```bash
LOCAL_SEG_LONG_SIDE=768  # Default: 768px
SEG_DEBUG=1              # Enable debug logs (0 to disable)
```

---

### 2. AI #1 Measurement (Task 908b)
**Problem:** Large images sent to VLM providers cause slow responses and high API costs  
**Solution:** Automatic resize before sending to Google AI / OpenAI

**Implementation:**
- Added `MEASURE_LONG_SIDE=1536` env variable (default: 1536px)
- Resize happens after HEIC conversion, before VLM call
- Uses Sharp with `fit: 'inside'` to preserve aspect ratio
- JPEG quality: 92% (preserves A4 sheet details)
- Debug logging shows original → resized dimensions

**Benefits:**
- Faster VLM responses (less data to process)
- Lower API costs (smaller images = fewer tokens)
- Reduced network transfer time
- 1536px still sufficient for A4 detection and wall measurement

**Files modified:**
- `packages/core/src/services/measure.ts` — added resize logic to `normalizeImageBuffer()`
- `packages/shared/src/env.ts` — added MEASURE_LONG_SIDE schema
- `.env.example` — documented new variable

**Env variables:**
```bash
MEASURE_LONG_SIDE=1536   # Default: 1536px, VLM providers
```

---

## Testing

### Segmentation
```bash
# Test with large image (should be ~5s)
npm run stress:seg -- --file public/originals/sciana.jpg --total 5

# Expected output in Next.js console:
[SEG-DEBUG] LOCAL_SEG_LONG_SIDE=768 will be sent as X-Scale-Long-Side header
[SEG-DEBUG] local:mask2former COMBINED -> X-Labels="" X-Threshold=0.6

# Expected output in Python console:
[seg] X-Scale-Long-Side header: 768, env M2F_LONG_SIDE: not set, using: 768
[seg] Original image size: 4032x3024
[seg] Resized to: 768x576
[seg] OK model=mask2former_ade20k device=mps:0 elapsed_ms=2867
```

### Measurement
```bash
# Test with large image
node scripts/test-measure-resize.mjs public/originals/sciana.jpg googleai

# Expected output in Next.js console:
[MEASURE] Max image size: 1536px
[MEASURE] Resizing image from 4032x3024 (long side: 4032) to max 1536px
[MEASURE] Resized to 1536x1152
[MEASURE] primary provider=googleai model=googleai/gemini-2.0-flash-001
```

---

## Configuration

### Production Recommendations

**For VLM measurement (googleai/openai):**
- `MEASURE_LONG_SIDE=1536` — Good balance of quality and speed
- Higher values (2048) for better A4 detection if needed
- Lower values (1024) for faster responses if A4 is large in frame

**For local CV measurement (experimental):**
- Not affected by MEASURE_LONG_SIDE (uses full resolution + A4 homography)

**For segmentation:**
- `LOCAL_SEG_LONG_SIDE=768` — Optimal for Mask2Former on MPS/GPU
- Higher values (1024) if you need more detail in curtain mask edges
- Lower values (512) only if GPU memory constrained

**Debug mode:**
- `SEG_DEBUG=1` — Enable segmentation debug logs
- `MEASURE_DEBUG=1` — Enable measurement debug logs
- Disable in production (adds ~5-10% overhead)

---

## Architecture Notes

### Why 768px for segmentation?
- Mask2Former was trained on resolutions ~512-1024
- 768px balances quality and speed on Apple Silicon MPS
- Curtain placement doesn't need pixel-perfect edges
- UI can handle lower-res masks (segment boundaries are forgiving)

### Why 1536px for measurement?
- A4 sheet (21×29.7cm) needs enough pixels for detection
- VLM models (GPT-4o, Gemini) have token limits tied to image size
- 1536px provides ~400-500 pixels across typical A4 in photo
- Higher than segmentation because A4 corners need precision

### Why different values?
- Segmentation: Output resolution matters (mask used by frontend)
- Measurement: Only JSON output matters (image is intermediate)
- Segmentation runs locally (no cost to high-res inference)
- Measurement calls paid APIs (cost scales with image size)

---

## Rollback Instructions

If issues arise, revert with:

```bash
# Restore old segmentation behavior (full-size processing)
# In .env.local:
LOCAL_SEG_LONG_SIDE=0  # 0 disables resize

# Restore old measurement behavior (no resize)
# In .env.local:
MEASURE_LONG_SIDE=8192  # Set very high to effectively disable
```

Or:
```bash
git revert HEAD~2  # Revert last 2 commits
```

---

## Future Work

1. **Adaptive sizing:** Detect A4 size in frame and adjust MEASURE_LONG_SIDE dynamically
2. **Progressive enhancement:** Start with low-res measurement, retry high-res if A4 not found
3. **Client-side resize:** Resize before upload to save bandwidth (needs EXIF preservation)
4. **Smart caching:** Cache resized images by hash to avoid repeated resizes

---

## References

- Task 907: Segmentation performance restoration
- Task 908: Image resizing for measurement and segmentation
- CLEANUP-STATUS.md: Detailed opencv removal notes
- EXPERIMENTAL-LOCAL-CV.md: Local CV measurement (unaffected by these changes)
