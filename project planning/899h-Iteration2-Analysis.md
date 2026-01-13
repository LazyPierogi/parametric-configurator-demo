# Iteration 2 Analysis: Scene-Adaptive Measurement

## Progress Summary

| Iteration | sciana | scianas | sypialnias | zaslonys | Width MAPE |
|-----------|--------|---------|------------|----------|------------|
| **Phase 2 (baseline)** | 479cm ✅ | 177cm ❌ | 112cm ❌ | 336cm ✅ | **29.25%** |
| Iter 2a (full-frame) | 1474cm ❌ | 589cm ❌ | 650cm 🎯 | 838cm ❌ | 121% |
| Iter 2b (generous) | 960cm ❌ | 354cm 🎯 | 362cm 🎯 | 503cm ❌ | 58% |
| **Iter 2c (adaptive)** | 640cm ❌ | 236cm 🎯 | 260cm 🎯 | 335cm ✅ | **33.81%** |

## Key Learnings

### **1. The sciana.HEIC/jpg Challenge**

These photos measure perfectly in Phase 2 (479cm vs 480cm actual) but over-measure in all Iteration 2 variants (640cm+).

**Why?**
- Phase 2 used 15% threshold + strict minimum span (30%)
- Photos likely have side walls visible at edges
- Even scene-adaptive "strict" mode (peakSharpness > 2.5) still picks up side walls

**Possible explanations:**
1. **Camera angle**: Photo may be slightly angled, showing parts of left/right walls
2. **Room geometry**: The actual room may have walls that extend beyond the main opposite wall
3. **Histogram spread**: Wall continues further than Phase 2 detected, and that's correct for curtain sizing

**Critical question**: Are these photos taken at an angle showing side walls, or is 640cm the correct full wall extent?

Need to **visually inspect** sciana.HEIC to understand room geometry.

### **2. scianas.jpg and sypialnias.jpg Improvement**

| File | Phase 2 | Iter 2c | Expected | Progress |
|------|---------|---------|----------|----------|
| scianas.jpg | 177cm | **236cm** | 480cm | +33% better (but still -51% short) |
| sypialnias.jpg | 112cm | **260cm** | 470cm | +132% better (but still -45% short) |

**Analysis:**
- Scene-adaptive logic correctly identified these as "complex" (peakSharpness < 1.8)
- Applied generous threshold (22%) and minimum span (40%)
- **Still under-measuring** - need even more generous approach

**Why still short?**
- Histogram may be very fragmented (windows, furniture break wall into sections)
- 22% threshold still misses sections with lower pixel density
- Need to consider: measure multiple wall sections and sum them?

### **3. zaslonys.jpg Remains Stable** ✅

- Phase 2: 336cm (-7%)
- Iter 2c: 335cm (-7%)
- Expected: 360cm

Consistently good across all iterations. Likely a well-framed photo with clear opposite wall.

---

## Current Scene-Adaptive Logic

```typescript
const peakSharpness = maxDensity / avgDensity;

if (peakSharpness > 2.5) {
  // Simple: sciana.HEIC/jpg, zaslonys.jpg
  threshold = 15%, minSpan = 30%
} else if (peakSharpness > 1.8) {
  // Moderate
  threshold = 18%, minSpan = 35%
} else {
  // Complex: scianas.jpg, sypialnias.jpg
  threshold = 22%, minSpan = 40%
}
```

**Issue**: This helps complex scenes but regresses simple ones.

---

## Hypotheses to Test

### **Hypothesis A: sciana photos are correctly wider**

Maybe 640cm IS the correct full wall extent, and Phase 2's 479cm was under-measuring?

**Test**: Visually inspect sciana.HEIC - does the opposite wall extend 640cm, or are we including side walls?

**If true**: Iteration 2c is actually more correct! Ground truth may be wrong or measuring different thing.

**If false**: Need stricter logic for sharp peaks.

### **Hypothesis B: Complex scenes need multi-region measurement**

scianas.jpg/sypialnias.jpg have fragmented histograms (multiple peaks). Current algorithm picks the strongest peak and expands - but misses other wall sections.

**Solution**: Detect ALL significant peaks, measure each, and sum them:

```typescript
const peaks = findAllPeaks(histogram, threshold=0.3*maxPeak);
const wallSections = peaks.map(p => measureSection(p));
const totalWidth = sum(wallSections.map(s => s.width));
```

**Expected impact**: scianas 236→400cm, sypialnias 260→400cm

### **Hypothesis C: FOV is still wrong**

Even with 74° horizontal FOV, scale might be off. The fact that:
- sciana with EXIF: 479cm ✅ (perfect)
- scianas without EXIF: 236cm ❌ (off by 2×)

Suggests FOV fallback is still not quite right.

**Test**: What if we use 80° or 85° instead of 74°?

---

## Recommended Next Steps

### **Option 1: Visual Inspection First** (5 min) 🔍

Open `sciana.HEIC` and check:
- Is the opposite wall ~480cm or ~640cm wide?
- Are side walls visible in the photo?
- What's the camera angle?

This will tell us if Iteration 2c is actually MORE correct than Phase 2.

### **Option 2: Multi-Peak Detection** (30 min) 🎯

Implement fragmented wall measurement:
1. Find all histogram peaks > 30% of max
2. Measure each section independently
3. Sum total width

**Expected**: scianas/sypialnias improve to ~400-450cm

### **Option 3: Hybrid Approach** (15 min) ⚖️

Keep Phase 2 logic for sharp peaks (>2.5), use Iteration 2c for complex (<2.0):

```typescript
if (peakSharpness > 2.5) {
  // Use Phase 2 exact logic (known to work for sciana)
  return phase2Measurement();
} else {
  // Use Iteration 2c adaptive logic
  return adaptiveMeasurement();
}
```

**Expected**: Best of both worlds - sciana stays at 479cm, scianas/sypialnias improve.

---

## My Recommendation

**Start with Option 3 (Hybrid)** to preserve what works (sciana) while improving what doesn't (scianas/sypialnias).

Then, if needed, add Option 2 (Multi-Peak) for the complex scenes that are still under-measuring.

**Expected final results:**
- sciana.HEIC/jpg: 479cm ✅ (Phase 2 logic)
- scianas.jpg: 350-450cm 🎯 (adaptive + multi-peak)
- sypialnias.jpg: 400-470cm 🎯 (adaptive + multi-peak)
- zaslonys.jpg: 335cm ✅ (adaptive works)

**Target MAPE: <15%** (from current 33.81%)

---

## Implementation Priority

1. ✅ **Done**: FOV fix (85° → 74°)
2. ✅ **Done**: Scene-adaptive thresholds
3. 🔄 **Next**: Hybrid approach (preserve Phase 2 for sharp peaks)
4. 📋 **Then**: Multi-peak detection for fragmented scenes
5. 📋 **Future**: Window/object detection for wall plane identification

We're making progress - each iteration teaches us more about the problem space! 🚀
