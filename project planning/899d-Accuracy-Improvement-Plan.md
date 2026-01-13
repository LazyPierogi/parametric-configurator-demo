# Task 899d: No-Reference Measurement Accuracy Improvement

## Current State (Unacceptable)

**Test Results:**
- Width MAPE: **126.81%** (target: <10%)
- Height MAPE: **23.82%** (better but still over target)
- Worst case: sciana.jpg measured **1473.8cm** vs actual **480cm** (+207% error!)
- Confidence miscalibrated: **85% confidence** on 207% error measurement

**Critical Issues:**
1. ❌ Segmentation service failures (timeouts, HF fallback errors)
2. ❌ Wall mask includes side walls/entire frame instead of just opposite wall
3. ❌ Confidence model gives high scores to terrible measurements
4. ❌ Distance estimation breaks without proper floor/ceiling masks
5. ❌ No sanity checks on obviously wrong measurements

## Root Cause Analysis

### Issue 1: Segmentation Infrastructure
```
"Segmentation fallback applied: local→timeout; hf→Cannot read properties of undefined"
```
- Local segmentation service not running
- HF fallback also broken (missing token or arrayBuffer handling)
- Falls back to full-frame mask → measures entire image width

### Issue 2: Wall Isolation Failure
Current algorithm uses `computeWallBounds()` which:
- Takes all wall-classified pixels between ceiling and floor
- Doesn't distinguish frontal wall from side walls
- In perspective view, side walls appear in frame → included in width
- Result: measures 300°+ panoramic view instead of single wall

### Issue 3: Distance Calculation Breaks
```javascript
distanceCm = cameraHeightCm × focalPx / (floorY - cy)
```
When floor/ceiling detection fails:
- Falls back to gradient detection
- "Floor and ceiling bands overlapped" → uses full image height
- Distance calculation becomes meaningless
- Scale factor `distanceCm / focalPx` propagates error to all dimensions

### Issue 4: Confidence Miscalibration
Current penalties:
- No floor mask: -35%
- No ceiling mask: -20%
- No EXIF: -20%
- Edge touching: -15%

**But missing:**
- No penalty for wall mask being too large
- No penalty for unrealistic aspect ratios
- No penalty for distance outside typical room range
- No penalty for measurement exceeding image dimensions

## Improvement Strategy

### Phase 1: Fix Infrastructure (Immediate - Day 1)

#### 1.1 Start Segmentation Service
```bash
cd services/segmentation
docker-compose up -d
```

#### 1.2 Fix HF Fallback
```typescript
// In packages/core/src/services/measureNoReference.ts
// Line ~270: Fix arrayBuffer access
const rawMask = (seg as any)?.mask;
if (rawMask?.arrayBuffer instanceof Function) {
  maskBuf = Buffer.from(await rawMask.arrayBuffer());
} else if (rawMask instanceof Blob) {
  // Add Blob handling
  maskBuf = Buffer.from(await rawMask.arrayBuffer());
}
```

### Phase 2: Add Measurement Sanity Checks (Day 1-2)

#### 2.1 Wall Mask Quality Metrics
```typescript
interface WallMaskQuality {
  sizePct: number;          // % of image covered by wall mask
  edgeTouching: boolean;    // touches left/right edges
  compactness: number;      // actual_pixels / convex_hull_pixels
  aspectRatio: number;      // width:height of bounds
}

function assessWallMask(mask, width, height, bounds): WallMaskQuality {
  const totalPixels = width * height;
  const wallPixels = bounds.pixels;
  const sizePct = (wallPixels / totalPixels) * 100;
  
  const edgeTouching = bounds.left <= 5 || bounds.right >= width - 5;
  
  // Compute convex hull and check compactness
  const convexHullArea = (bounds.width + 1) * (bounds.height + 1);
  const compactness = wallPixels / convexHullArea;
  
  const aspectRatio = bounds.width / Math.max(1, bounds.height);
  
  return { sizePct, edgeTouching, compactness, aspectRatio };
}
```

#### 2.2 Reject Obviously Bad Masks
```typescript
function shouldRejectMask(quality: WallMaskQuality): string | null {
  // Wall mask covers >70% of image → likely includes everything
  if (quality.sizePct > 70) {
    return 'Wall mask too large (>70% of image) - likely includes side walls';
  }
  
  // Wall touches both edges → panoramic view
  if (quality.edgeTouching) {
    return 'Wall mask touches image edges - likely includes side walls';
  }
  
  // Aspect ratio >6:1 → measuring entire room width
  if (quality.aspectRatio > 6.0) {
    return 'Wall aspect ratio too wide - likely measuring panoramic view';
  }
  
  // Very low compactness → scattered pixels, not solid wall
  if (quality.compactness < 0.3) {
    return 'Wall mask fragmented - unreliable measurement';
  }
  
  return null;
}
```

#### 2.3 Measurement Bounds Checks
```typescript
function validateMeasurement(
  wallWidthCm: number,
  wallHeightCm: number,
  imageWidth: number,
  imageHeight: number,
  scale: number
): { valid: boolean; reason?: string; adjustedConfidence: number } {
  
  let confidence = 1.0;
  const issues: string[] = [];
  
  // Typical residential wall dimensions
  const TYPICAL_WIDTH = { min: 200, max: 800 };  // 2m - 8m
  const TYPICAL_HEIGHT = { min: 220, max: 350 }; // 2.2m - 3.5m
  const TYPICAL_ASPECT = { min: 1.2, max: 5.0 };
  
  // Check width bounds
  if (wallWidthCm < TYPICAL_WIDTH.min || wallWidthCm > TYPICAL_WIDTH.max) {
    confidence -= 0.3;
    issues.push(`Width ${wallWidthCm}cm outside typical range (${TYPICAL_WIDTH.min}-${TYPICAL_WIDTH.max}cm)`);
  }
  
  // Check height bounds
  if (wallHeightCm < TYPICAL_HEIGHT.min || wallHeightCm > TYPICAL_HEIGHT.max) {
    confidence -= 0.2;
    issues.push(`Height ${wallHeightCm}cm outside typical range (${TYPICAL_HEIGHT.min}-${TYPICAL_HEIGHT.max}cm)`);
  }
  
  // Check aspect ratio
  const aspect = wallWidthCm / wallHeightCm;
  if (aspect < TYPICAL_ASPECT.min || aspect > TYPICAL_ASPECT.max) {
    confidence -= 0.25;
    issues.push(`Aspect ratio ${aspect.toFixed(1)}:1 unusual`);
  }
  
  // Measured width exceeds image width → impossible
  const imageWidthCm = imageWidth * scale;
  if (wallWidthCm > imageWidthCm * 1.2) {
    confidence -= 0.4;
    issues.push(`Measured width exceeds image width by >20%`);
  }
  
  confidence = Math.max(0, confidence);
  
  return {
    valid: confidence >= 0.3,
    reason: issues.length ? issues.join('; ') : undefined,
    adjustedConfidence: confidence
  };
}
```

### Phase 3: Improve Wall Detection (Day 2-4)

#### 3.1 Frontal Wall Isolation via Gradient Analysis
```typescript
/**
 * Frontal walls have predominantly vertical edges.
 * Side walls in perspective show diagonal edges.
 * Use edge orientation to filter out side walls.
 */
function isolateFrontalWall(
  mask: Uint8Array,
  gray: Uint8Array,
  width: number,
  height: number
): Uint8Array {
  const frontal = new Uint8Array(width * height);
  
  // Compute Sobel gradients
  const gx = new Float32Array(width * height);
  const gy = new Float32Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      
      // Sobel X
      gx[idx] = (
        -gray[(y-1)*width + (x-1)] + gray[(y-1)*width + (x+1)] +
        -2*gray[y*width + (x-1)] + 2*gray[y*width + (x+1)] +
        -gray[(y+1)*width + (x-1)] + gray[(y+1)*width + (x+1)]
      );
      
      // Sobel Y
      gy[idx] = (
        -gray[(y-1)*width + (x-1)] - 2*gray[(y-1)*width + x] - gray[(y-1)*width + (x+1)] +
        gray[(y+1)*width + (x-1)] + 2*gray[(y+1)*width + x] + gray[(y+1)*width + (x+1)]
      );
    }
  }
  
  // For each wall pixel, check if gradient is predominantly vertical
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!mask[idx]) continue;
      
      const mag = Math.sqrt(gx[idx]**2 + gy[idx]**2);
      if (mag < 10) {
        frontal[idx] = mask[idx]; // Low gradient → keep
        continue;
      }
      
      // Compute angle: vertical = 90°, horizontal = 0°
      const angle = Math.abs(Math.atan2(gy[idx], gx[idx])) * 180 / Math.PI;
      
      // Keep pixels with vertical or horizontal edges (frontal wall)
      // Reject diagonal edges (perspective side walls)
      if (
        (angle > 75 && angle < 105) ||  // Vertical edges
        (angle < 15 || angle > 165)     // Horizontal edges
      ) {
        frontal[idx] = mask[idx];
      }
    }
  }
  
  return frontal;
}
```

#### 3.2 Central Region Focus
```typescript
/**
 * In typical room photos, the opposite wall is in the center.
 * Side walls appear at edges. Weight central regions higher.
 */
function focusOnCentralWall(
  mask: Uint8Array,
  width: number,
  height: number
): { left: number; right: number } {
  
  // Compute horizontal histogram
  const histogram = new Float32Array(width);
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = 0; y < height; y++) {
      if (mask[y * width + x]) count++;
    }
    histogram[x] = count;
  }
  
  // Smooth histogram (moving average)
  const smoothed = new Float32Array(width);
  const kernelSize = Math.floor(width * 0.05); // 5% of width
  for (let x = 0; x < width; x++) {
    let sum = 0;
    let count = 0;
    for (let dx = -kernelSize; dx <= kernelSize; dx++) {
      const nx = x + dx;
      if (nx >= 0 && nx < width) {
        sum += histogram[nx];
        count++;
      }
    }
    smoothed[x] = sum / count;
  }
  
  // Find central peak (avoiding edges)
  const margin = Math.floor(width * 0.1); // Ignore outer 10%
  let maxVal = 0;
  let peakX = Math.floor(width / 2);
  
  for (let x = margin; x < width - margin; x++) {
    if (smoothed[x] > maxVal) {
      maxVal = smoothed[x];
      peakX = x;
    }
  }
  
  // Find bounds around peak where histogram drops to 30% of peak
  const threshold = maxVal * 0.3;
  let left = peakX;
  let right = peakX;
  
  while (left > margin && smoothed[left] > threshold) left--;
  while (right < width - margin && smoothed[right] > threshold) right++;
  
  return { left, right };
}
```

### Phase 4: Improve Distance Estimation (Day 4-5)

#### 4.1 Multi-Method Distance Fusion
```typescript
interface DistanceEstimate {
  distanceCm: number;
  confidence: number;
  method: string;
}

function estimateDistance(
  focalPx: number,
  floorY: number | null,
  ceilingY: number | null,
  wallHeightPx: number,
  imageHeight: number,
  cameraHeightCm: number
): DistanceEstimate[] {
  
  const estimates: DistanceEstimate[] = [];
  const cy = imageHeight / 2;
  
  // Method 1: Floor-based (current)
  if (floorY != null && floorY > cy + 10) {
    const dist = cameraHeightCm * focalPx / (floorY - cy);
    if (dist > 120 && dist < 800) {
      estimates.push({
        distanceCm: dist,
        confidence: 0.7,
        method: 'floor-based'
      });
    }
  }
  
  // Method 2: Ceiling-based (inverse)
  if (ceilingY != null && ceilingY < cy - 10) {
    const typicalCeilingHeight = 250; // Assume 2.5m ceiling
    const heightAboveCamera = typicalCeilingHeight - cameraHeightCm;
    const dist = heightAboveCamera * focalPx / (cy - ceilingY);
    if (dist > 120 && dist < 800) {
      estimates.push({
        distanceCm: dist,
        confidence: 0.6,
        method: 'ceiling-based'
      });
    }
  }
  
  // Method 3: Wall height heuristic
  // Typical room height: 250cm
  // If we see full wall height in pixels, estimate distance
  if (wallHeightPx > 0) {
    const typicalWallHeightCm = 250;
    const dist = typicalWallHeightCm * focalPx / wallHeightPx;
    if (dist > 120 && dist < 800) {
      estimates.push({
        distanceCm: dist,
        confidence: 0.5,
        method: 'wall-height-heuristic'
      });
    }
  }
  
  // Method 4: EXIF-based prior
  // Typical room depth for residential: 3-4m
  estimates.push({
    distanceCm: 350,
    confidence: 0.3,
    method: 'typical-room-prior'
  });
  
  return estimates;
}

function fuseDistanceEstimates(estimates: DistanceEstimate[]): { distanceCm: number; confidence: number } {
  if (estimates.length === 0) {
    return { distanceCm: 350, confidence: 0.2 };
  }
  
  // Weighted average by confidence
  let sumWeighted = 0;
  let sumWeights = 0;
  
  for (const est of estimates) {
    sumWeighted += est.distanceCm * est.confidence;
    sumWeights += est.confidence;
  }
  
  const distanceCm = sumWeighted / sumWeights;
  const confidence = sumWeights / estimates.length; // Normalized
  
  return { distanceCm, confidence };
}
```

### Phase 5: Recalibrate Confidence Model (Day 5)

```typescript
function buildConfidenceV2(
  hasFloor: boolean,
  hasCeiling: boolean,
  hasExif: boolean,
  wallQuality: WallMaskQuality,
  distanceConfidence: number,
  measurementValid: boolean,
  fallbackSeg: boolean
): ConfidenceBreakdown {
  
  let base = 1.0;
  let penalties = 0;
  const reasons: string[] = [];
  
  // Segmentation quality
  if (fallbackSeg) {
    penalties += 0.4;
    reasons.push('Segmentation fallback');
  }
  
  if (!hasFloor) {
    penalties += 0.25;
    reasons.push('No floor mask');
  }
  
  if (!hasCeiling) {
    penalties += 0.15;
    reasons.push('No ceiling mask');
  }
  
  // EXIF
  if (!hasExif) {
    penalties += 0.15;
    reasons.push('No EXIF');
  }
  
  // Wall mask quality (NEW)
  if (wallQuality.sizePct > 60) {
    penalties += 0.3;
    reasons.push('Wall mask too large');
  } else if (wallQuality.sizePct > 50) {
    penalties += 0.15;
  }
  
  if (wallQuality.edgeTouching) {
    penalties += 0.25;
    reasons.push('Wall touches edges');
  }
  
  if (wallQuality.compactness < 0.4) {
    penalties += 0.2;
    reasons.push('Wall mask fragmented');
  }
  
  if (wallQuality.aspectRatio > 5.0) {
    penalties += 0.3;
    reasons.push('Aspect ratio too wide');
  } else if (wallQuality.aspectRatio < 1.5) {
    penalties += 0.15;
    reasons.push('Aspect ratio too narrow');
  }
  
  // Distance estimation quality (NEW)
  if (distanceConfidence < 0.5) {
    penalties += 0.2;
    reasons.push('Low distance confidence');
  }
  
  // Measurement validation (NEW)
  if (!measurementValid) {
    penalties += 0.35;
    reasons.push('Measurement outside typical bounds');
  }
  
  penalties = Math.min(base, penalties);
  const confidence = Math.max(0, base - penalties);
  
  return { base, penalties, confidence, reasons };
}
```

## Implementation Priority

### Week 1 (Days 1-2): Critical Fixes
1. ✅ Fix segmentation infrastructure
2. ✅ Add measurement sanity checks
3. ✅ Reject obviously bad masks
4. ✅ Recalibrate confidence model

**Target:** Reduce false confidence, catch catastrophic failures

### Week 2 (Days 3-5): Accuracy Improvements
5. ✅ Implement gradient-based wall filtering
6. ✅ Add central region focus
7. ✅ Multi-method distance fusion
8. ✅ Wall quality metrics

**Target:** Width MAPE < 30%

### Week 3 (Days 6-10): Advanced Features
9. ⏳ Vanishing point detection
10. ⏳ Perspective correction
11. ⏳ Optional reference object mode

**Target:** Width MAPE < 15%

### Week 4: Fine-tuning
12. ⏳ Parameter optimization with ground truth
13. ⏳ Edge case handling
14. ⏳ Documentation and testing

**Target:** Width MAPE < 10%

## Success Metrics

- **Width MAPE**: <10% (currently 126%)
- **Height MAPE**: <8% (currently 24%)
- **Confidence calibration**: High confidence (>70%) only when error <15%
- **Rejection rate**: <20% of valid photos
- **Processing time**: <5s per image

## Testing Strategy

```bash
# Run after each improvement
node scripts/measure-benchmark.mjs \
  --dir public/originals \
  --ground-truth ground_truth.json \
  --provider noreref \
  --debug-dir measure-debug \
  --no-cache

# Diagnostic analysis
node scripts/diagnose-noreref.mjs \
  ground_truth.json \
  measure-debug
```

## Notes

- This is an experimental provider - users should be warned measurements are estimates
- Consider adding UI warning: "No-reference measurements are experimental. For accuracy, use an A4 reference sheet."
- Long-term: hybrid mode that uses reference when available, falls back to no-reference
- Ultimate accuracy will be limited without reference - aim for "good enough for rough estimate" not "precision measurement"
