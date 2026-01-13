# Experimental Local CV Branch

## Overview

The `experimental/local-cv` branch contains A4-based computer vision measurement code (tasks 890-899) that was **removed from `main`** to restore core segmentation performance.

## Why was it moved?

Since task 890 (commit `56eb5da`), the segmentation service accumulated **529 lines** of experimental CV code:
- A4 sheet detection with perspective correction
- Homography and rectification
- HEIC/EXIF processing
- Window masking and floor/ceiling filtering
- Complex multi-pass algorithms

**Impact:** Segmentation performance degraded from **4s → 40s**, with system freezes and artifacts.

**Solution:** Experimental code moved to this branch; main branch restored to **fast, stable segmentation**.

## What's in this branch?

- `/measure` endpoint in `services/segmentation/main.py` (full implementation)
- A4-based wall measurement with:
  - Perspective rectification via homography
  - Window masking to avoid detection interference
  - Ceiling/floor clamping for accuracy
  - Connected component filtering
  - Robust percentile trimming
- HEIC/HEIF support with EXIF focal length extraction
- Benchmark scripts and ground-truth testing (`scripts/measure-benchmark.mjs`)
- Debug payload generation

## How to use this branch

### Switch to experimental branch

```bash
git checkout experimental/local-cv
```

### Run the measurement service

The `/measure` endpoint will be available alongside `/segment` and `/segment-batch`:

```bash
# Start the service
docker-compose up segmentation

# Or locally
cd services/segmentation
uvicorn main:app --reload --port 8001
```

### Test measurement endpoint

```bash
curl -X POST http://localhost:8001/measure \
  -H "Content-Type: application/octet-stream" \
  -H "X-Debug: 1" \
  --data-binary @your-photo-with-a4.jpg
```

### Dependencies

The experimental branch requires **OpenCV** for A4 detection and perspective correction:

```bash
# Required in services/segmentation/requirements.txt
opencv-python-headless>=4.9.0.80
```

**Note:** This dependency has been **removed from main branch** to eliminate performance interference with core segmentation (EXIF processing overhead).

### Environment variables

```bash
# Rectification toggle (default: enabled)
MEASURE_RECTIFY_ENABLED=1

# Percentile trimming for outliers
MEASURE_RECTIFY_TRIM_LOWER=2.0
MEASURE_RECTIFY_TRIM_UPPER=98.0

# Ceiling/floor clamping
MEASURE_WALL_CLAMP_ENABLED=1
MEASURE_WALL_CLAMP_MARGIN_PCT=0.0075
```

## Performance expectations

- **GPU (MPS/CUDA):** 3-8 seconds
- **CPU:** 10-25 seconds (depending on image size)
- **Accuracy:** ~±5cm with good A4 detection and lighting

## Merging back to main

When the measurement code is production-ready:

1. Performance must be <5s on GPU
2. No interference with core segmentation
3. Consider splitting into separate service container
4. Add comprehensive error handling
5. Update RUNBOOK with operational guidelines

## Reference

- **Tasks:** 890-899 (Local CV measurement experiments)
- **Commit range:** `56eb5da..0a2f2fd` (before cleanup)
- **Design docs:** `project planning/07-Local-Measurement-Proposal.md`, `899-No-Reference-Design.md`
- **Benchmark script:** `scripts/measure-benchmark.mjs`

---

**Last updated:** 2025-09-30  
**Reason for split:** Core segmentation performance restoration (40s→4s)
