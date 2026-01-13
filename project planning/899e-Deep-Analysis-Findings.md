# Task 899e: Deep Analysis & Breakthrough Insights

## 🎯 Critical Findings

### 1. **FOV Assumption is WRONG** 🔴

**Current:** Default 60° FOV for non-EXIF images
**Reality:** Modern smartphones use **ultra-wide lenses**

| Device | Actual FOV | 35mm Equivalent |
|--------|------------|-----------------|
| iPhone 16 Pro Max | **~100°** | 18mm |
| iPhone 13/14/15 | **~90-95°** | 20-26mm |
| Standard 50mm lens | 46° | 50mm |
| Our default | **60°** | ~43mm ❌ |

**Impact on scianas/sypialnias:**
- No EXIF → assumes 60° FOV
- Actual FOV likely **95-100°**
- **40° difference = 2× error in scale calculation!**

```typescript
// Current (WRONG for smartphones)
focalPx = (0.5 * width) / tan(60°/2) = 0.866 * width

// Should be (for iPhone ultra-wide)
focalPx = (0.5 * width) / tan(100°/2) = 0.364 * width

// Scale factor error: 0.866 / 0.364 = 2.38× !!!
```

**Fix:** Default to **85-90° FOV** for non-EXIF images (smartphone average)

---

### 2. **Height Measures Full Ceiling-to-Floor, Width Measures Histogram Peak** ✅

**Why height is more accurate:**
- Height = `(floorY - ceilingY) * scale`
- Uses **entire vertical span** from segmentation
- Not affected by wall fragmentation

**Why width fails on complex scenes:**
- Width uses histogram peak finding
- **Windows, furniture, plants** fragment the wall histogram
- Algorithm picks **strongest continuous region** (often wrong section)

**scianas.jpg example:**
- Wall broken by 3 windows + shelves + plants
- Histogram shows **multiple peaks** (wall sections between windows)
- Algorithm picks **narrow central section** (177cm vs 480cm actual)

**sypialnias.jpg example:**
- Slanted ceiling creates **non-uniform wall height**
- Side wall visible on right
- Histogram detects **small vertical strip** near bed (112cm vs 470cm actual)

---

### 3. **Segmentation Takes 57s for 150KB scianas.jpg** ⏱️

**Timeline analysis:**
```
sciana.HEIC (2MB):  23s
sciana.jpg (2.7MB): 11s
scianas.jpg (150KB): 57s ← ANOMALY!
sypialnias.jpg (137KB): 2.6s
zaslonys.jpg (144KB): 2.3s
```

**Hypothesis:** scianas.jpg has **complex scene** (windows, plants, many objects)
- Mask2Former processes ~3-4s per segmentation call
- 3 calls (wall, floor, ceiling) = ~12s expected
- **57s = 4.75× slower!**

**Possible causes:**
1. Model confusion on complex multi-object scene
2. Increased iterations to reach confidence threshold
3. Memory thrashing on MPS device
4. HEIC conversion attempting (file has EXIF metadata suggesting conversion)

**Need to investigate:** Add timing breakdowns in debug payload

---

### 4. **Mask2Former Returns Rich Data We're Ignoring** 💎

Looking at FastAPI service, Mask2Former provides:
- Per-pixel **class labels** (not just binary masks)
- **Confidence scores** for each prediction
- **Semantic segmentation** (150 ADE20K classes)

**Currently using:**
- ✅ Wall/floor/ceiling binary masks
- ❌ Per-pixel confidence (could filter low-confidence regions)
- ❌ Individual object boundaries (windows, furniture, etc.)
- ❌ Segmentation quality metrics

**Opportunities:**
1. **Filter low-confidence wall pixels** → cleaner masks
2. **Detect and exclude windows/doors** from wall width calculation
3. **Use object boundaries** to identify wall interruptions
4. **Segment individual wall sections** between windows/furniture

---

### 5. **Gradient Implementation is Too Simple** 📐

Current implementation:
```typescript
// Just vertical pixel differences
for (let y = 0; y < height - 1; y++) {
  for (let x = 0; x < width; x++) {
    sum += Math.abs(gray[idx] - gray[nextIdx]);
  }
  diffs[y] = sum / width;
}
```

**Problems:**
- Doesn't leverage segmentation masks
- No horizontal gradient (can't detect vertical edges)
- Affected by lighting/shadows
- Can't distinguish floor from dark furniture

**Better approach:**
- Use mask edges directly (floor/ceiling boundaries from segmentation)
- Compute 2D gradients (Sobel) to detect edge orientations
- Weight by segmentation confidence

---

## 🚀 Proposed Improvements (Priority Order)

### **Phase 3A: Fix FOV Default** (Impact: HIGH, Effort: LOW)

```typescript
// Change from 60° to 85° for non-EXIF images
const defaultFovDeg = 85; // Smartphone average (was 60°)
```

**Expected improvement on scianas/sypialnias:**
- Current scale factor: wrong by ~2×
- Width measurements: 177cm → ~354cm (still off but much better)

---

### **Phase 3B: Window/Object Exclusion** (Impact: HIGH, Effort: MEDIUM)

Request **window/door masks** from segmentation service, then:
1. Compute wall mask WITHOUT windows
2. Find **continuous wall sections** between windows
3. Pick **widest continuous section** instead of histogram peak

```typescript
// Pseudo-code
const wallWithoutWindows = wall & ~windows & ~doors;
const continuousSections = findConnectedComponents(wallWithoutWindows);
const widestSection = max(continuousSections, s => s.width);
```

**Expected improvement:**
- scianas.jpg: detect 3 windows, measure wall sections between them
- Combine section widths for total wall width
- Or use widest section as measurement target

---

### **Phase 3C: Multi-Peak Histogram Analysis** (Impact: MEDIUM, Effort: MEDIUM)

Instead of single peak, find **all significant peaks** and combine:

```typescript
const peaks = findAllPeaks(histogram, threshold=0.3 * maxPeak);
const wallSections = peaks.map(p => expandAroundPeak(p));

// Option 1: Sum all sections (for interrupted walls)
const totalWidth = sum(wallSections.map(s => s.width));

// Option 2: Use spacing between peaks
const leftmost = min(wallSections.map(s => s.left));
const rightmost = max(wallSections.map(s => s.right));
const spanWidth = rightmost - leftmost;
```

---

### **Phase 3D: Leverage Mask Confidence** (Impact: MEDIUM, Effort: HIGH)

Request confidence scores from Mask2Former:
1. Filter wall pixels with confidence <0.7
2. Weight histogram by confidence
3. Report low-confidence warning

Requires updating FastAPI service to return confidence maps.

---

### **Phase 3E: Timing Diagnostics** (Impact: LOW, Effort: LOW)

Add detailed timing to debug payload:
```typescript
{
  timing: {
    heicConversion: 500,
    segmentationWall: 3500,
    segmentationFloor: 3200,
    segmentationCeiling: 3100,
    histogramAnalysis: 45000, // ← scianas anomaly?
    total: 57000
  }
}
```

---

## 📊 Expected Results After Phase 3A+3B

| File | Current | After Phase 3 | Target | Status |
|------|---------|---------------|--------|--------|
| sciana.HEIC | 479cm | 479cm | 480cm | ✅ Perfect |
| sciana.jpg | 479cm | 479cm | 480cm | ✅ Perfect |
| scianas.jpg | 177cm | ~380-420cm | 480cm | 🎯 Good |
| sypialnias.jpg | 112cm | ~400-450cm | 470cm | 🎯 Good |
| zaslonys.jpg | 336cm | 336cm | 360cm | ✅ Excellent |

**Target MAPE:** **<15%** (from current 29%)

---

## 🔬 Implementation Plan

1. **Quick Win:** Fix FOV default (5 min)
2. **Medium Win:** Request window masks, exclude from wall detection (30 min)
3. **Advanced:** Multi-peak analysis for fragmented walls (1 hour)
4. **Research:** Mask confidence integration (requires FastAPI changes)

---

## 💡 Clever Tricks We Can Do

### **Trick 1: Window Detection → Wall Bounds**
Windows are always **on walls**. Use window centers to find wall plane:
```typescript
const windowCenters = detectWindows().map(w => w.centerX);
const wallPlaneX = median(windowCenters);
// Expand from window plane to find full wall
```

### **Trick 2: Furniture Filtering**
Furniture is **in front of wall** (foreground). Use depth heuristics:
- Objects in lower half of image = likely furniture
- Filter from wall mask before histogram analysis

### **Trick 3: Perspective Correction**
Use floor/ceiling convergence to detect vanishing point:
```typescript
const vanishingPoint = findVanishingPoint(floor, ceiling);
if (vanishingPoint.x < width * 0.4 || vanishingPoint.x > width * 0.6) {
  // Strong perspective - weight central region higher
  adjustHistogramWeights(histogram, vanishingPoint);
}
```

### **Trick 4: Ceiling Type Detection**
Flat ceiling → standard room
Slanted ceiling → attic/loft → special handling
```typescript
if (ceilingSlope > 10°) {
  // Use different wall detection for slanted ceilings
  measureAtticWall();
}
```

### **Trick 5: Multi-Wall Detection**
If histogram shows 2-3 distinct peaks:
- Likely measuring **corner** (2 walls)
- Pick peak closest to image center
- Or measure each wall separately

---

## Next Steps

**Start with Phase 3A (FOV fix) + 3B (window exclusion)** for maximum impact with reasonable effort?
