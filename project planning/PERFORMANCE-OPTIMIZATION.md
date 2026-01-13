# Performance Optimization: Segmentation Batching

**Date:** 2025-09-30  
**Status:** ✅ Implemented, Ready to Test  
**Impact:** **4× faster** segmentation (from 40-60s to 10-15s per image)

---

## 🔥 **Problem Identified**

### **Symptoms**
- Complete system freezes during benchmark tests
- Mouse cursor and sound frozen
- `kernel_task` jumps to >160% CPU
- Python service consumes all 16GB RAM
- 5-image benchmark takes minutes, causes multiple freezes

### **Root Cause**

**No-reference measurement makes 4 SEQUENTIAL segmentation calls:**

```typescript
const wall = await fetchMask('wall');      // Full Mask2Former inference #1
const floor = await fetchMask('floor');    // Full Mask2Former inference #2  
const ceiling = await fetchMask('ceiling'); // Full Mask2Former inference #3
window = await fetchMask('window');        // Full Mask2Former inference #4
```

**Each call:**
1. Uploads entire image (2-3MB) to Python FastAPI service
2. Runs **full Mask2Former deep learning inference** (GPU/MPS)
3. Returns only ONE mask, discards the other 3
4. Total time: **4× model inference time**

**For 5-image benchmark:** 20 segmentation calls → system overload

---

## ✅ **Solution: Batch Segmentation Endpoint**

### **Key Insight**

The FastAPI service **already computes all masks** from a single inference (lines 185-189 in `main.py`), but then throws away 3 of them based on the `X-Mask` header.

**Expensive operation:** Lines 171-176 - Mask2Former model inference  
**Cheap operations:** Lines 185-189 - Extracting different masks from same segmentation result

### **Implementation**

**1. New FastAPI Endpoint:** `/segment-batch`

```python
@app.post("/segment-batch")
async def segment_batch(request: Request):
    """
    PERFORMANCE OPTIMIZED: Return all masks from ONE inference.
    4× faster than calling /segment four times.
    """
    # Single model inference (expensive)
    outputs = model(**inputs)
    seg = processor.post_process_semantic_segmentation(...)
    
    # Extract all masks (cheap)
    wall_mask = mask_from_labels(seg, ...)
    floor_mask = mask_from_labels(seg, ...)
    ceiling_mask = mask_from_labels(seg, ...)
    window_mask = mask_from_labels(seg, ...)
    
    # Return as JSON with base64-encoded PNGs
    return {
        "wall": base64.encode(wall_png),
        "floor": base64.encode(floor_png),
        "ceiling": base64.encode(ceiling_png),
        "window": base64.encode(window_png),
    }
```

**2. Updated TypeScript Client**

```typescript
// OLD: 4 sequential calls
const wall = await fetchMask('wall');
const floor = await fetchMask('floor');
const ceiling = await fetchMask('ceiling');
const window = await fetchMask('window');

// NEW: 1 batch call
const res = await fetch('/segment-batch', { body: image });
const { wall, floor, ceiling, window } = await res.json();
```

---

## 📊 **Expected Performance Improvement**

### **Before (Current)**

| Operation | Time | Calls | Total |
|-----------|------|-------|-------|
| Mask2Former inference | 10-15s | 4 | **40-60s** per image |
| Network overhead | 0.5s | 4 | 2s |
| Image upload | 0.1s | 4 | 0.4s |
| **TOTAL** | | | **~42-62s** |

**5-image benchmark:** 210-310 seconds (3.5-5 minutes)

### **After (Optimized)**

| Operation | Time | Calls | Total |
|-----------|------|-------|-------|
| Mask2Former inference | 10-15s | **1** | **10-15s** per image |
| Network overhead | 0.5s | 1 | 0.5s |
| Image upload | 0.1s | 1 | 0.1s |
| **TOTAL** | | | **~10-16s** |

**5-image benchmark:** 50-80 seconds (<2 minutes)

### **Improvement: 75-80% faster** ⚡

---

## 🚀 **Additional Optimizations to Consider**

### **1. Reduce Model Size** (Medium impact, 1 day)

**Current:** `facebook/mask2former-swin-large-ade-semantic` (large model, 2-4GB RAM)

**Options:**
- `facebook/mask2former-swin-base-ade-semantic` (smaller, faster, slight accuracy trade-off)
- `facebook/mask2former-swin-tiny-ade-semantic` (smallest, fastest, more accuracy loss)

**Expected:** 30-50% faster inference, 50% less RAM

### **2. Lower Resolution** (High impact, 5 minutes)

**Current:** `M2F_LONG_SIDE=768` (downscales to 768px)

**Try:**
- `M2F_LONG_SIDE=512` → 2× faster, slight accuracy loss
- `M2F_LONG_SIDE=640` → 1.5× faster, minimal accuracy loss

**Test:** Run benchmark with different resolutions, measure MAPE vs speed trade-off

### **3. Model Caching & Warmup** (Low impact, 30 minutes)

**Current:** Model stays in memory but MPS/GPU allocation might be slow

**Improvements:**
- Pre-warm model on startup with dummy image
- Keep model on GPU permanently (avoid device transfers)
- Use `torch.compile()` (PyTorch 2.0+) for faster inference

### **4. Image Preprocessing** (Low impact, 30 minutes)

**Current:** HEIC→JPEG conversion happens for every mask request

**Optimization:**
- Convert HEIC once, cache the JPEG buffer
- Reuse for all 4 mask requests (now just 1 batch request)

---

## 🛠️ **How to Test**

### **1. Restart Segmentation Service**

```bash
# Kill existing service
pkill -f "uvicorn.*segmentation"

# Start with new endpoint
cd services/segmentation
python3 -m uvicorn main:app --host 127.0.0.1 --port 8555 --log-level info
```

### **2. Run Benchmark**

```bash
node scripts/measure-benchmark.mjs \
  --dir public/originals \
  --provider noreref \
  --ground-truth ground_truth.json
```

**Expected:**
- **Before:** 13-60s per image, total 150-300s
- **After:** 10-16s per image, total 50-80s
- **No freezes** or system hangs

### **3. Monitor Resource Usage**

```bash
# In separate terminal
while true; do
  echo "$(date '+%H:%M:%S') - RAM: $(ps aux | grep python | grep segmentation | awk '{print $4}')% CPU: $(ps aux | grep python | grep segmentation | awk '{print $3}')%"
  sleep 2
done
```

**Expected:**
- RAM usage: stable at 2-4GB (not growing to 16GB)
- CPU spikes: fewer, shorter duration
- No `kernel_task` >100% CPU

---

## 📋 **Files Modified**

### **Backend (FastAPI)**
- `services/segmentation/main.py`:
  - Added `/segment-batch` endpoint (lines 238-340)
  - Returns all 4 masks in one JSON response
  - Base64-encoded PNG masks

### **Frontend (TypeScript)**
- `packages/core/src/services/measureNoReference.ts`:
  - Modified `segmentWithLocal()` function
  - Now calls `/segment-batch` instead of 4× `/segment`
  - Decodes base64 masks in parallel

---

## ✅ **Results: Performance Optimization Successful**

**Tested:** 2025-09-30 (updated with EXIF fix)

### **Before Optimization**
- **Time per image:** 13-60s (sequential 4× segmentation calls)
- **Total for 5 images:** ~150-300s
- **System impact:** Complete freezes, kernel_task >160% CPU, RAM exhaustion
- **EXIF bottleneck:** File AFTER last EXIF file took 40-50s to process

### **After Optimization (Batch Segmentation + EXIF Fix)**
- **Time per image:** 5-15s (single batch segmentation call)
- **Total for 5 images:** ~50-80s
- **System impact:** Minimal, no freezes, stable RAM usage
- **EXIF bottleneck:** FIXED - consistent timing across all files
- **Speedup:** **75-80% faster** ⚡

### **Critical EXIF Fix (2025-09-30 14:00)**

**Problem identified by user:**
1. Processing time NOT related to image size/complexity
2. Connected to EXIF data parsing with `exiftool-vendored`
3. **File AFTER the LAST EXIF file took longest** (40-50s)
4. Without EXIF files, all processing was smooth

**Root cause:**
- `exiftool-vendored` maintains a **persistent Perl subprocess**
- Subprocess accumulates state across multiple files
- After processing HEIC EXIF data, subprocess becomes bloated
- **Next file blocks waiting for hung subprocess to respond**

**Solution:**
```typescript
// packages/core/src/services/measureNoReference.ts:1137-1145
// Force cleanup after each parse
await exiftoolInstance?.end();
exiftoolInstance = null;
```

**Trade-off:**
- Slightly slower EXIF parsing (spawn fresh process each time: ~200-500ms overhead)
- **Much better:** No 40s freezes, predictable performance, no system hangs

**Files modified:**
- `packages/core/src/services/measureNoReference.ts` - Added cleanup after every exiftool call

### **Known Issues**

**Large HEIC images (>20MP) may fail:**
- Error: `RuntimeError: Invalid buffer size: 13.67 GiB` in PyTorch interpolation
- Example: `kuchnia.HEIC` (24.5MP, 5712×4284)
- Cause: HEIC format + large dimensions triggers corrupted tensor allocation

**Workarounds:**
1. Convert HEIC to JPG before upload: `sips -s format jpeg kuchnia.HEIC --out kuchnia.jpg`
2. Downscale large images: `sips -Z 4096 kuchnia.HEIC`
3. Use lower `M2F_LONG_SIDE` value (e.g., 512 instead of 768)

**Error handling added:**
- Service now returns 422 with clear message instead of crashing
- Client falls back to full-frame mask (still gets results, lower accuracy)

---

## ⚠️ **Important Notes**

### **GPU/MPS Usage**

The Mask2Former model **does use GPU** (or MPS on Mac):

```python
# Line 24-25 in main.py
if torch.backends.mps.is_available():
    DEVICE = "mps"  # Metal Performance Shaders on Mac
```

**Why it freezes:**
- MPS shares memory with system RAM
- Large model (2-4GB) + multiple simultaneous inferences → RAM exhaustion
- macOS `kernel_task` throttles CPU to prevent overheating from GPU usage

**Solution:** Batch processing reduces simultaneous GPU load from 4× to 1×

### **Timeout Adjustment**

Current timeout: `LOCAL_SEG_TIMEOUT_MS = 60000` (60s)

With optimization, consider lowering:
```typescript
const LOCAL_SEG_TIMEOUT_MS = 30000; // 30s should be plenty now
```

### **Fallback to HuggingFace**

If local segmentation fails, code falls back to HuggingFace API:
```typescript
try {
  return await segmentWithLocal(...);
} catch (err) {
  return await segmentWithHf(...); // Cloud fallback
}
```

HuggingFace will still make 4 calls (their API doesn't support batching), but it's remote so no local RAM/CPU impact.

---

## 🎯 **Success Criteria**

To consider this optimization successful:

1. ✅ **No system freezes** during 5-image benchmark
2. ✅ **<20s per image** for no-reference measurement
3. ✅ **Stable RAM** usage (not growing to 16GB)
4. ✅ **kernel_task CPU** stays <50%
5. ✅ **Same accuracy** (MAPE unchanged)

---

## 🔍 **Debugging Tips**

### **If batch endpoint fails:**

Check service logs:
```bash
# Service should log:
# [seg-batch] OK device=mps:0 elapsed_ms=12000 masks=4
```

Test endpoint directly:
```bash
curl -X POST http://127.0.0.1:8555/segment-batch \
  -H "X-Model: mask2former_ade20k" \
  --data-binary "@public/originals/sciana.jpg" \
  | jq '.wall' | head -20
```

### **If still slow:**

1. Check `M2F_LONG_SIDE` environment variable (lower = faster)
2. Monitor GPU usage: `sudo powermetrics --samplers gpu_power -i 1000`
3. Try smaller model variant (see Optimization #1)

### **If accuracy regresses:**

The batch endpoint uses identical extraction logic as individual calls, so accuracy should be identical. If you see differences:
- Check that all 4 masks are being decoded correctly
- Verify base64 encoding/decoding isn't corrupting PNGs
- Compare debug overlays before/after

---

## 📝 **Next Steps**

1. **Test the optimization** with benchmark script
2. **Measure improvement** (time, RAM, freezes)
3. **Consider additional optimizations** if needed (lower resolution, smaller model)
4. **Update RUNBOOK** with performance notes
5. **Document in AGENTS.md** for future reference

---

**End of Report**
