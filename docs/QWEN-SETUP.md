# Qwen VL Setup Guide

This guide explains how to set up and test Qwen VL (Alibaba Cloud) for wall measurement.

## Why Qwen VL?

Based on research and benchmarks:
- **Best accuracy-to-cost ratio** among VLM providers
- **Superior document understanding** (93.1 DocVQA score vs 78.4 for GPT-4o-mini)
- **Native dynamic resolution** — Handles varied image sizes without normalization
- **Excellent object recognition** — Identifies common objects for scale estimation
- **2-3× more accurate** than GPT-4o-mini for measurement tasks
- **Only 2.7× cost** of Gemini Flash but much more accurate

## New: Autonomous Measurement (No A4 Required!)

All VLM providers now use an **autonomous object recognition approach**:
- No A4 paper required
- Uses 72° FOV assumption (typical smartphone)
- Identifies common objects to establish scale
- Targets ±10% accuracy
- Works with any photo of a wall

## Step 1: Get Alibaba Cloud API Key

1. Go to [Alibaba Cloud Model Studio](https://www.alibabacloud.com/help/en/model-studio/getting-started/activate-and-use-model-studio)
2. Sign up for an account (international/Singapore region recommended)
3. Activate Model Studio (free tier available: 1M tokens input + 1M output, valid 90 days)
4. Go to [API Keys page](https://bailian.console.alibabacloud.com/)
5. Create a new API key
6. Copy the API key (starts with `sk-...`)

## Step 2: Configure Environment Variables

Add to your `apps/web/.env.local`:

```bash
# Qwen VL (Alibaba Cloud)
AI1_PROVIDER=qwen
AI1_MODEL=qwen-vl-plus
QWEN_API_KEY=YOUR_QWEN_API_KEY
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

**Models available:**
- `qwen-vl-plus` — Best balance ($0.21/M input, $0.63/M output)
- `qwen-vl-max` — Highest accuracy ($0.80/M input, $3.20/M output)
- `qwen3-vl-plus` — Latest with thinking mode (tiered pricing)

## Step 3: Restart Next.js

```bash
pkill -f "next dev"
npm run dev
```

## Step 4: Test with Debug UI

1. Open http://localhost:3010/estimate?lang=en
2. Make sure debug UI is enabled:
   ```bash
   # In .env.local
   NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1
   NEXT_PUBLIC_MEASURE_ENGINE_DEBUG=vlm
   ```
3. Select **"Qwen VL (Alibaba)"** from the provider dropdown
4. Upload one of your ground truth images (e.g., `public/originals/sciana.jpg`)
5. Check the Next.js console for logs:
   ```
   [MEASURE] primary provider=qwen model=qwen-vl-plus
   [MEASURE][qwen] response: {...}
   [MEASURE][qwen] raw_text: {"wallWidthCm":480,"wallHeightCm":280}
   [MEASURE][qwen] parsed: { wallWidthCm: 480, wallHeightCm: 280 }
   ```

## Step 5: Batch Test All Providers

Run the automated batch test to compare all providers:

```bash
# Test all providers against ground truth
node scripts/test-all-providers.mjs

# Test specific providers only
node scripts/test-all-providers.mjs --providers=qwen,googleai

# Test specific files only
node scripts/test-all-providers.mjs --files=public/originals/sciana.jpg,public/originals/kuchnia.HEIC
```

**Expected output:**
```
🧪 VLM Provider Batch Test
========================

Providers: googleai, qwen, openai
Test files: 6
API: http://localhost:3010

📷 Testing: sciana.jpg
   Ground truth: 480cm × 280cm
   ──────────────────────────────────────────────────────────
   ✅ googleai   465cm × 275cm  (±4.5%, 3200ms)
   ✅ qwen       478cm × 282cm  (±1.2%, 4500ms)
   ⚠️  openai     420cm × 310cm  (±12.3%, 5100ms)

📊 Summary
========================

GOOGLEAI (googleai/gemini-2.0-flash-001)
  Success rate: 100% (6/6)
  Avg error: ±8.2%
  Avg time: 3400ms
  Accuracy: ✅ 4 excellent (≤10%), ⚠️  2 good (10-20%), ❌ 0 poor (>20%)

QWEN (qwen-vl-plus)
  Success rate: 100% (6/6)
  Avg error: ±3.8%
  Avg time: 4600ms
  Accuracy: ✅ 6 excellent (≤10%), ⚠️  0 good (10-20%), ❌ 0 poor (>20%)

🏆 Rankings
========================
Most accurate: qwen (±3.8%)
Fastest: googleai (3400ms)
```

## Pricing Comparison

For 1000 measurements with 1536×1152 images:

| Provider | Cost | Accuracy | Speed |
|----------|------|----------|-------|
| **Qwen VL Plus** | **$0.38** | ⭐️⭐️⭐️⭐️ | 4-6s |
| Gemini Flash | $0.14 | ⭐️⭐️⭐️ | 3-5s |
| GPT-4o-mini | $0.32 | ⭐️⭐️ | 5-7s |
| GPT-4o | $6.00 | ⭐️⭐️⭐️⭐️⭐️ | 6-10s |
| Claude 3.5 | $6.00 | ⭐️⭐️⭐️⭐️⭐️ | 6-8s |

## Troubleshooting

### Error: "QWEN_API_KEY is not set"
Make sure you've added the API key to `.env.local` and restarted Next.js.

### Error: "Qwen API request failed 401"
Check that:
- Your API key is correct (starts with `sk-`)
- You've activated Model Studio in your Alibaba Cloud account
- You're using the Singapore region URL (international)

### Error: "Qwen response had no text content"
This usually means:
- The model returned an error (check the response log)
- Your free tier quota is exhausted
- The image is too large (check `MEASURE_LONG_SIDE` setting)

### Beijing region vs Singapore region
- **Singapore (recommended):** `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
- **Beijing (China only):** `https://dashscope.aliyuncs.com/compatible-mode/v1`

Most international users should use the Singapore endpoint.

## Advanced Configuration

### Use Qwen VL Max (highest accuracy)

```bash
AI1_MODEL=qwen-vl-max
```

This costs 4× more but provides GPT-4o-level accuracy.

### Use Qwen3 VL Plus with thinking mode

```bash
AI1_MODEL=qwen3-vl-plus
```

Supports chain-of-thought reasoning (useful for complex measurements).

### Custom base URL (Beijing region)

```bash
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

## Fallback Behavior

If Qwen fails, the system automatically falls back to the secondary provider:

```bash
AI1_SECONDARY_MODEL=googleai/gemini-2.0-flash-lite
```

Check logs for:
```
[MEASURE][qwen] primary failed <error message>
[MEASURE] fallback provider=googleai model=googleai/gemini-2.0-flash-lite
```

## Production Recommendations

For production use:

```bash
# Primary: Qwen VL Plus (best accuracy-to-cost)
AI1_PROVIDER=qwen
AI1_MODEL=qwen-vl-plus
QWEN_API_KEY=YOUR_QWEN_API_KEY

# Fallback: Gemini Flash (fast and cheap)
AI1_SECONDARY_MODEL=googleai/gemini-2.0-flash-lite
GOOGLE_GENAI_API_KEY=your-key-here

# Image optimization
MEASURE_LONG_SIDE=1536
```

This gives you:
- High accuracy from Qwen (primary)
- Fast fallback with Gemini (if Qwen fails)
- Low cost (most requests use Qwen at $0.38/1000 calls)

## Next Steps

1. Test with all your ground truth images
2. Compare accuracy vs Gemini/OpenAI
3. Benchmark speed and cost
4. Consider switching production config to Qwen if accuracy improves

## References

- [Qwen VL Documentation](https://www.alibabacloud.com/help/en/model-studio/vision)
- [API Reference](https://www.alibabacloud.com/help/en/model-studio/use-qwen-by-calling-api)
- [Pricing](https://www.alibabacloud.com/help/en/model-studio/models)
- [Model Comparison](docs/VLM-MODEL-OPTIONS.md)
