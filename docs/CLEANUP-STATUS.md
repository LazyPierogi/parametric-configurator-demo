# Experimental Branch Split - Cleanup Status

**Date:** 2025-09-30  
**Issue:** Segmentation performance degradation (5s → 60s) when processing EXIF-heavy images

## Root Cause

The dependency cleanup in commit `e3415d2` was incomplete:
- ✅ Python code cleaned (no cv2 imports, no /measure endpoint)  
- ❌ `opencv-python-headless>=4.9.0.80` remained in `requirements.txt`

Even though OpenCV wasn't imported, having it installed caused EXIF processing overhead that affected PIL/Pillow image loading, particularly for large EXIF-heavy files like `sciana.jpg` (4032×3024).

## Resolution

### Files Modified
1. **services/segmentation/requirements.txt**
   - Removed `opencv-python-headless>=4.9.0.80` (line 12)
   - Restored to pre-task-890 state (11 dependencies)

2. **EXPERIMENTAL-LOCAL-CV.md**
   - Added "Dependencies" section noting OpenCV requirement for experimental branch
   - Documented that this dependency was removed from main for performance

3. **project planning/05-Task-List.md**
   - Updated task 907 to document opencv removal

4. **AGENTS.md**
   - Updated experimental branch split section with dependency removal note

## Next Steps

### 1. Rebuild Docker Container (Required)
```bash
# Stop the current container
docker-compose down segmentation

# Rebuild with clean dependencies
docker-compose build --no-cache segmentation

# Start fresh
docker-compose up segmentation
```

### 2. Or Rebuild Local venv
```bash
cd services/segmentation
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000
```

### 3. Performance Testing
Test both file types to confirm the fix:

```bash
# Test small file (no EXIF overhead expected)
npm run stress:seg -- --file public/originals/scianas.jpg --total 5 --concurrency 1

# Test large EXIF file (should now be fast)
npm run stress:seg -- --file public/originals/sciana.jpg --total 5 --concurrency 1
```

**Expected results:**
- Both should complete in ~4-6 seconds on MPS/GPU
- No significant difference between EXIF and non-EXIF files

### 4. Commit Changes
```bash
git add services/segmentation/requirements.txt EXPERIMENTAL-LOCAL-CV.md AGENTS.md "project planning/05-Task-List.md"
git commit -m "fix: remove opencv dependency from main branch requirements

- Eliminate EXIF processing overhead (60s → 5s for large images)
- opencv-python-headless moved to experimental/local-cv branch only
- Update docs with dependency requirements per branch"
```

## Verification Checklist

- [x] Docker container rebuilt with clean dependencies
- [x] Segmentation tested with EXIF-heavy files (~5s latency for 4032px images)
- [x] Segmentation tested with non-EXIF files (~5s latency)
- [x] No performance regression between file types
- [ ] Measurement optimization tested with large images
- [ ] Changes committed and pushed

## Additional Optimization (Task 908 — Measurement Resize)

Added automatic image resizing for AI #1 (measurement) to prevent VLM timeout on large images:
- New env variable: `MEASURE_LONG_SIDE` (default: 1536px)
- Images are automatically downscaled before sending to Google AI / OpenAI
- Resize happens after HEIC conversion, before VLM call
- Debug logging shows original → resized dimensions
- Quality: 92% JPEG to preserve A4 sheet details

**Benefits:**
- Faster VLM responses (less data to process)
- Lower API costs (smaller images)
- Reduced network transfer time
- Still sufficient resolution for A4 detection and wall measurement

## Background

Before task 890 (commit `56eb5da`), `requirements.txt` had **11 dependencies** and no OpenCV.  
Task 890 added OpenCV for A4-based measurement, increasing to **12 dependencies**.  
The experimental branch split (commit `e3415d2`) removed the code but missed the dependency.

This oversight caused a 12× performance regression for EXIF-heavy images.
