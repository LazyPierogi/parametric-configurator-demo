# Task 900: Measurement Accuracy Quick Wins

**Goal:** Improve VLM accuracy from 11-15% error to <10% (target 5-8%)  
**Status:** IN_PROGRESS  
**Date:** 2025-10-01

---

## Current Baseline
- **GoogleAI:** 16.8% avg error, 1951ms
- **Qwen:** 15.0% avg error, 2466ms  
- **OpenAI:** 22.8% avg error, 3038ms

---

## Quick Win 1: Improved Prompt (Chain-of-Thought) ✅ DONE

**Current issues:**
- Too directive on FOV assumptions
- Vague "standardized dimensions" 
- No step-by-step reasoning
- Missing common reference objects

**Improvements:**
- Add explicit reasoning steps
- List concrete reference objects (doors: 200cm, windows: 120-150cm, outlets, switches)
- Add typical room constraints (230-300cm height)
- Mention perspective distortion awareness

**Results (2025-10-01):**
- GoogleAI: **16.8% → 12.0%** (4.8% improvement) ✅
- Qwen: 15.0% → 15.4% (within variance)
- OpenAI: 22.8% → 23.6% (no improvement)
- **GoogleAI now hits ≤10% on 3/6 test images**

**Time cost:** 0ms  
**Risk:** NONE  
**Status:** DEPLOYED

---

## Quick Win 2: EXIF Focal Length (Safe Path)

**Why safe now:**
- Your codebase already uses `exifr` library in `measureNoReference.ts`
- No OpenCV dependency (that was the problem in experimental branch)
- Proven timeouts: 7s regular, 15s HEIC
- Pure JavaScript, no segmentation service impact

**Approach:**
1. Extract focal length from EXIF (if available)
2. Calculate actual FOV from focal length
3. Pass calculated FOV to prompt instead of assuming 72°

**Expected:** -1 to -3% error (for photos with EXIF)  
**Time cost:** +500ms  
**Risk:** LOW

---

## Quick Win 3: Ensemble Averaging (When Models Agree)

**Strategy:**
- Call GoogleAI + Qwen in parallel
- If results within 10% of each other → average them
- If disagree → use primary

**Expected:** -2 to -3% error  
**Time cost:** 0ms (parallel)  
**Risk:** LOW

---

## Phase 1 Target: ±7-10% error (under 3s)

---

## Phase 2: Depth + Segmentation (Future, +2-3s budget)

- Depth-Anything V2 for monocular depth maps
- Background removal using existing Mask2Former
- Combined: target ±5-7% error

---

**Implementation Order:**
1. Prompt improvements (today)
2. EXIF integration (this week)
3. Ensemble (this week)
4. Validate with benchmarks
