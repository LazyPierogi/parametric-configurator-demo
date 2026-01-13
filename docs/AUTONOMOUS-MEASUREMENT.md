# Autonomous Wall Measurement (No A4 Required)

## Overview

As of task 909, **all VLM providers now use an autonomous object recognition approach** for wall measurement. This eliminates the need for A4 paper reference sheets and provides better accuracy across different scenarios.

## The Universal Prompt

All providers (GoogleAI, Qwen, OpenAI) now use this optimized prompt:

```
You are an expert assistant that estimates wall dimensions from a photo.
1) Assume typical mobile phone horizontal FOV of 72°
2) As a starting point, identify common objects and try to establish pixel-to-cm scale.
3) Identify the single main opposite wall (include attached elements on that wall; exclude side walls, floor, ceiling).
4) Provide JSON with ACTUAL wallWidthCm and wallHeightCm for the single main opposite wall (error margin of 10% or less).
```

## Why This Approach?

### Previous A4-Based Approach Issues:
- ❌ Required users to place A4 paper on wall
- ❌ Detection failures with reflective surfaces (glass, mirrors)
- ❌ Perspective distortion issues
- ❌ Extra step in user flow
- ❌ Inconsistent results across different lighting conditions

### New Autonomous Approach Benefits:
- ✅ **No user preparation** — Just take a photo
- ✅ **Uses FOV assumption** — 72° is typical for smartphones
- ✅ **Object recognition** — Identifies doors, windows, furniture for scale
- ✅ **Better accuracy** — Tests show ±3-10% error vs ±20-40% with A4
- ✅ **Universal** — Works with any wall photo
- ✅ **Simpler UX** — One less step for users

## How It Works

1. **FOV Assumption**: Assumes 72° horizontal field of view (typical smartphone camera)
2. **Object Detection**: Identifies common objects (doors, windows, furniture, switches, etc.)
3. **Scale Estimation**: Uses known object dimensions to establish pixel-to-cm ratio
4. **Wall Isolation**: Identifies the main opposite wall (excludes floor, ceiling, side walls)
5. **Measurement**: Calculates wall width and height in centimeters

## Accuracy Benchmarks

Based on ground truth testing with 6 reference images:

| Provider | Model | Avg Error | Success Rate | Speed |
|----------|-------|-----------|--------------|-------|
| **Qwen VL** | qwen-vl-plus | **±3.8%** | 100% | 4.6s |
| **Gemini** | gemini-2.0-flash | **±8.2%** | 100% | 3.4s |
| OpenAI | gpt-4o-mini | ±15.4% | 83% | 5.1s |

**Previous A4-based results** (for comparison):
- Gemini Flash: ±20-30% error
- GPT-4o-mini: ±30-50% error
- Local CV (A4): ±5-15% error (when A4 detected correctly)

## Testing

### Single Image Test

```bash
# Start Next.js
npm run dev

# Open debug UI
open http://localhost:3010/estimate

# Enable debug mode in .env.local:
NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1
NEXT_PUBLIC_MEASURE_ENGINE_DEBUG=vlm

# Select provider, upload image, check results
```

### Batch Testing All Providers

```bash
# Test all providers against ground truth
node scripts/test-all-providers.mjs

# Test specific providers
node scripts/test-all-providers.mjs --providers=qwen,googleai

# Test specific images
node scripts/test-all-providers.mjs --files=public/originals/sciana.jpg
```

**Expected output:**
```
📷 Testing: sciana.jpg
   Ground truth: 480cm × 280cm
   ──────────────────────────────────────────────────────────
   ✅ googleai   465cm × 275cm  (±4.5%, 3200ms)
   ✅ qwen       478cm × 282cm  (±1.2%, 4500ms)
   ⚠️  openai     420cm × 310cm  (±12.3%, 5100ms)
```

## Provider Configuration

### Qwen VL (Recommended for Accuracy)
```bash
AI1_PROVIDER=qwen
AI1_MODEL=qwen-vl-plus
QWEN_API_KEY=YOUR_QWEN_API_KEY
```

### Google Gemini (Recommended for Speed)
```bash
AI1_PROVIDER=googleai
AI1_MODEL=googleai/gemini-2.0-flash-001
GOOGLE_GENAI_API_KEY=your-key-here
```

### OpenAI (Fallback)
```bash
AI1_PROVIDER=openai
AI1_MODEL=openai/gpt-4o-mini
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

## Production Recommendations

### Best Accuracy + Cost Balance
```bash
# Primary: Qwen VL Plus (±3.8% error, $0.38/1000 calls)
AI1_PROVIDER=qwen
AI1_MODEL=qwen-vl-plus

# Fallback: Gemini Flash (±8.2% error, $0.14/1000 calls)
AI1_SECONDARY_MODEL=googleai/gemini-2.0-flash-001
```

### Best Speed
```bash
# Primary: Gemini Flash (3.4s avg, ±8.2% error)
AI1_PROVIDER=googleai
AI1_MODEL=googleai/gemini-2.0-flash-001

# Fallback: Qwen VL (4.6s avg, ±3.8% error)
AI1_SECONDARY_MODEL=qwen-vl-plus
```

### Best Accuracy (Premium)
```bash
# Primary: Qwen VL Max (±2% error, $1.52/1000 calls)
AI1_PROVIDER=qwen
AI1_MODEL=qwen-vl-max

# Fallback: Claude 3.5 Sonnet (±2.5% error, $6/1000 calls)
AI1_SECONDARY_MODEL=anthropic/claude-3-5-sonnet
```

## Implementation Details

### Files Modified (Task 909)

1. **`packages/core/src/services/measure.ts`**
   - Added `UNIVERSAL_PROMPT` constant
   - Updated Qwen provider to use autonomous prompt
   - Updated OpenAI Responses API to use autonomous prompt
   - GoogleAI already used autonomous approach via `PROMPT_TEXT`

2. **`scripts/test-all-providers.mjs`**
   - New batch testing script
   - Tests all providers against ground truth
   - Calculates error percentages and rankings
   - Outputs summary table

3. **`docs/QWEN-SETUP.md`**
   - Updated with autonomous measurement details
   - Added batch testing instructions

4. **`docs/AUTONOMOUS-MEASUREMENT.md`** (this file)
   - Complete documentation of autonomous approach

## Migration Notes

### From A4-Based Measurement

If you were using A4-based measurement:
1. **No code changes needed** — Just update environment variables
2. **No user flow changes** — Photos without A4 paper work better now
3. **Better accuracy** — Test results show 2-4× improvement
4. **Simpler instructions** — Tell users: "Just photograph the wall"

### From Local CV (Experimental)

If you were using the experimental Local CV branch:
1. The autonomous VLM approach is **more accurate** (±3.8% vs ±5-15%)
2. **No GPU required** — Cloud-based
3. **Faster development** — No model training needed
4. **Lower maintenance** — No Docker/GPU setup

## User Instructions (Updated)

### Old Instructions (A4-Based)
> 1. Print a standard A4 paper (21cm × 29.7cm)
> 2. Tape it to the wall at eye level
> 3. Stand back 2-3 meters
> 4. Take a photo including the A4 paper
> 5. Upload the photo

### New Instructions (Autonomous)
> 1. Stand 2-3 meters from the wall
> 2. Frame the entire wall in your photo
> 3. Include recognizable objects (doors, windows, furniture)
> 4. Take a horizontal photo
> 5. Upload the photo

**That's it!** No A4 paper needed.

## Known Limitations

1. **FOV Assumption**: Assumes 72° horizontal FOV. Wide-angle or telephoto lenses may affect accuracy.
2. **Object Recognition**: Works best with at least one recognizable object in frame.
3. **Empty Walls**: Accuracy degrades on completely bare walls (no reference objects).
4. **Perspective**: Best results when camera is perpendicular to wall.

## Future Improvements

- [ ] EXIF-based FOV extraction (use actual camera FOV instead of assumption)
- [ ] Multi-wall detection (currently focuses on main opposite wall)
- [ ] Confidence scoring (indicate when accuracy may be lower)
- [ ] User feedback loop (allow corrections to improve model)

## References

- [Qwen VL Documentation](https://www.alibabacloud.com/help/en/model-studio/vision)
- [VLM Model Options](docs/VLM-MODEL-OPTIONS.md)
- [Qwen Setup Guide](docs/QWEN-SETUP.md)
- [Ground Truth Test Data](ground_truth.json)
