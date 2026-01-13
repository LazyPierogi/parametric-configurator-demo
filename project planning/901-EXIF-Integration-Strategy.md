# Task 901: Safe EXIF Focal Length Integration

**Goal:** Extract camera focal length from EXIF to improve VLM accuracy  
**Status:** PROPOSAL  
**Date:** 2025-10-01

---

## Why This Is Safe (Unlike Task 890)

### What Went Wrong in Task 890
- Added **OpenCV** (`opencv-python-headless`) to segmentation service
- EXIF extraction via OpenCV caused 10x slowdown (4s → 40s)
- System freezes and performance degradation
- Had to move to experimental branch

### Why This Approach Is Different
1. **No OpenCV dependency** - uses pure JavaScript `exifr` library
2. **Already proven safe** - `measureNoReference.ts` uses this exact approach
3. **Proper timeouts** - 7s for regular images, 15s for HEIC
4. **No segmentation service impact** - runs in Node.js process, not Python
5. **Fast execution** - typically <500ms, only adds delay when EXIF present

---

## Existing Infrastructure (Already Working)

Your codebase already has complete EXIF extraction in `packages/core/src/services/measureNoReference.ts`:

```typescript
// From measureNoReference.ts (lines 1168-1213)
async function resolveFocalLength(candidates: ExifCandidate[], imageWidth: number) {
  // 1. Try HEIC files with exiftool (native HEIC support)
  for (const cand of heicCandidates) {
    const focalPx = await parseWithExiftool(cand, imageWidth, EXIF_HEIC_TIMEOUT_MS);
    if (focalPx) return { focalPx, source: 'exif' };
  }

  // 2. Try non-HEIC with exifr (fast, pure JS)
  const metadata = await withTimeout(exifr.parse(cand.buffer, {
    pick: ['FocalLength', 'FocalLengthIn35mmFilm', 'FocalLengthIn35mmFormat'],
    translateValues: false,
  }), EXIF_TIMEOUT_MS, 'exifr.parse');
  
  // 3. Compute FOV from focal length
  const focalPx = computeFocalPx(metadata, imageWidth);
  
  // 4. Fallback to default 74° FOV
  return { focalPx: defaultFocal, source: 'fallback' };
}
```

**This code is battle-tested and safe.**

---

## Implementation Plan

### Step 1: Extract Reusable EXIF Utility

Create new file: `packages/core/src/lib/exif.ts`

```typescript
import exifr from 'exifr';

export type ExifFovData = {
  fovHorizontalDeg: number;
  fovVerticalDeg: number;
  source: 'exif' | 'fallback';
  confidence: 'high' | 'medium' | 'low';
};

export async function extractFovFromImage(
  buffer: Buffer, 
  imageWidth: number,
  imageHeight: number
): Promise<ExifFovData> {
  const defaultFov = { 
    fovHorizontalDeg: 72, 
    fovVerticalDeg: 55, 
    source: 'fallback' as const,
    confidence: 'low' as const 
  };

  try {
    // Fast path: exifr (works with JPEG, PNG, TIFF)
    const metadata = await Promise.race([
      exifr.parse(buffer, {
        pick: ['FocalLength', 'FocalLengthIn35mmFilm', 'FOV', 'HFOV', 'VFOV'],
        translateValues: false,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('EXIF timeout')), 7000)
      )
    ]);

    if (!metadata) return defaultFov;

    // Option 1: Direct FOV in metadata (rare but best)
    const fovH = metadata.HFOV ?? metadata.FOV;
    const fovV = metadata.VFOV;
    if (fovH && fovH > 0 && fovH < 180) {
      return {
        fovHorizontalDeg: fovH,
        fovVerticalDeg: fovV ?? (fovH * imageHeight / imageWidth),
        source: 'exif',
        confidence: 'high'
      };
    }

    // Option 2: Calculate from focal length
    const focalMm = metadata.FocalLength;
    const focal35 = metadata.FocalLengthIn35mmFilm;
    
    if (focalMm && focal35) {
      const sensorWidthMm = (36 * focalMm) / focal35;
      const sensorHeightMm = sensorWidthMm * (imageHeight / imageWidth);
      
      const fovH = 2 * Math.atan(sensorWidthMm / (2 * focalMm)) * (180 / Math.PI);
      const fovV = 2 * Math.atan(sensorHeightMm / (2 * focalMm)) * (180 / Math.PI);
      
      if (fovH > 30 && fovH < 120) { // Sanity check
        return {
          fovHorizontalDeg: fovH,
          fovVerticalDeg: fovV,
          source: 'exif',
          confidence: 'medium'
        };
      }
    }

    return defaultFov;
  } catch (err) {
    console.warn('[EXIF] Parse failed, using defaults:', err);
    return defaultFov;
  }
}
```

### Step 2: Integrate into measure.ts

```typescript
// In measureFromImage() function, after normalizeImageBuffer

import { extractFovFromImage } from '../lib/exif';

// Extract FOV if available (adds ~500ms when EXIF present, 0ms otherwise)
const fovData = await extractFovFromImage(
  imageBuffer, 
  normalizedImage.width ?? 1536,
  normalizedImage.height ?? 1536
);

// Enhance prompt with actual FOV
const enhancedPrompt = UNIVERSAL_PROMPT.replace(
  'typical mobile phone FOV (65-75° horizontal, 50-60° vertical)',
  fovData.source === 'exif'
    ? `this photo's measured FOV (${fovData.fovHorizontalDeg.toFixed(1)}° horizontal, ${fovData.fovVerticalDeg.toFixed(1)}° vertical, ${fovData.confidence} confidence)`
    : 'typical mobile phone FOV (65-75° horizontal, 50-60° vertical)'
);

// Use enhanced prompt instead of UNIVERSAL_PROMPT
```

### Step 3: Add Toggle Environment Variable

```bash
# .env.example
MEASURE_EXIF_ENABLED=true  # Set to false to disable EXIF extraction
```

### Step 4: Test with Benchmarks

Run before/after benchmarks to measure:
1. Accuracy improvement (expect 1-3% reduction in error)
2. Time impact (expect +300-700ms when EXIF present, 0ms otherwise)

---

## Expected Results

### Photos WITH EXIF (iPhone, modern Android)
- **Before:** VLM guesses 72° FOV (may be wrong)
- **After:** VLM uses actual 68° or 76° (more accurate)
- **Error reduction:** 2-4% for photos with available EXIF

### Photos WITHOUT EXIF (screenshots, edited photos, web downloads)
- **Before:** VLM guesses 72° FOV
- **After:** VLM guesses 72° FOV (no change)
- **Error reduction:** 0%

### Overall improvement
- **Weighted average:** ~1.5-2.5% error reduction
- **Time cost:** +0 to +700ms (avg ~300ms)

---

## Safety Checklist

✅ **No OpenCV** - pure JavaScript library  
✅ **No segmentation service impact** - runs in Node.js BFF  
✅ **Timeout protection** - 7s max, won't hang  
✅ **Graceful fallback** - errors return default FOV  
✅ **Already battle-tested** - used in measureNoReference  
✅ **Toggle available** - can disable via env var  
✅ **Under 3s budget** - typical +300ms well within limits  

---

## Implementation Estimate

- **Effort:** 4-6 hours
- **Risk:** Very low
- **Testing:** 2 hours (benchmark before/after)
- **Total:** 1 day

---

## Next Steps

1. Get approval for this approach
2. Extract utility function
3. Integrate into measure.ts
4. Run benchmarks
5. Document findings
