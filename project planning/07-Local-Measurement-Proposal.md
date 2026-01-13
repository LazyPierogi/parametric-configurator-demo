# Local Measurement (OpenCV + Mask2Former) — Proposal

## Context & Goals
- Add an optional, local Computer Vision path to estimate wall width/height in centimeters from a single photo with an A4 reference (210×297 mm).
- Keep current VLM-based `/api/measure` (Genkit → OpenAI/Gemini) intact; introduce a parallel local path toggleable in debug.
- Reuse `services/segmentation` FastAPI (Mask2Former ADE20K) for semantic cues; implement robust A4 detection with OpenCV.
- Return strict JSON with positive numbers; keep debug artifacts server-side only (for now).
- Targets: CPU ≤ 10s; GPU ideally < 3s for one photo.

## High-Level Architecture
- Service: `services/segmentation` adds `POST /measure` that accepts image bytes and returns `{ wallWidthCm, wallHeightCm }` (+ optional debug payload gated by header).
- Clients: `packages/clients` adds a thin `measureLocalCV()` adapter.
- Core: `packages/core/src/services/measure.ts` routes by a debug switch (per-request override) to local CV vs existing VLM.
- API (BFF): `apps/web/app/api/measure` remains thin; accepts `provider: 'openai'|'googleai'|'localcv'` for debug switching.

## Debug Switching Strategy (PoC-friendly)
- Do NOT introduce a new global “AI1 engine” env yet.
- Use per-request override: `/api/measure` body already supports `provider`; extend it to accept `'localcv'` for experimental path.
- Optionally, a dev-only client env `NEXT_PUBLIC_MEASURE_ENGINE_DEBUG=vlm|localcv|auto` to steer the frontend request. This is client-safe and avoids server-wide behavior changes.
- Server-side fallback policy (if we add `auto` later): try localcv → fallback to VLM with clear logs. For PoC we can keep explicit provider choice.

## Service API — `POST /measure`
- Request: `application/octet-stream` body (image bytes).
- Headers:
  - `X-Debug: 1` (optional) — include debug artifacts in JSON.
  - `X-Scale-Long-Side` (optional) — scale for inference (e.g., 640–1024). Defaults from env (`M2F_LONG_SIDE`).
- Response (200):
  - `{ wallWidthCm: number>0, wallHeightCm: number>0, debug?: { a4Corners, wallBounds, pxPerCm, thumbs?: {...}, timings?: {...} } }`
- Response (4xx): structured `{ error, details? }`; never return zero/negative sizes.

## CV Pipeline (Service)
1) Decode image (PIL → NumPy).
2) Segmentation (reuse Mask2Former ADE20K): build masks for `wall | window | attached`.
3) Morphology on combined mask: close, hole fill, keep largest component → axis-aligned `wallBounds`.
4) A4 detection (OpenCV):
   - Preprocess: convert to Lab/HSV; optional white balance; restrict search to wall region.
   - Edges/contours: blur → Canny → `findContours` → `approxPolyDP`.
   - Candidate filtering: convex quad, area within plausible range, “paperish” brightness, side-length ratio near 1.414 or 0.707 ± tolerance, angles near 90° ± tolerance.
   - Score + choose best; order corners clockwise from top-left.
5) Scale: compute average of opposite side lengths (pixels). Decide orientation by ratio closeness (29.7×21 vs 21×29.7). `pxPerCm = mean(widthPx/cmW, heightPx/cmH)`.
6) Wall size: `wPx = right-left`, `hPx = bottom-top`, convert to cm, round to 0.5 cm. Validate positive.
7) Debug (if `X-Debug`): include corners, bounds, `pxPerCm`, device, elapsed, and PNG thumbnails as data URIs (mask layers, overlays).

## Performance Tuning
- CPU: set `X-Scale-Long-Side` ≈ 640–768; small morphology kernels (e.g., 3×3/5×5) and adaptive thresholds. Aim ≤ 10s.
- GPU/MPS: allow 896–1024 long side; slightly larger kernels; aim < 3s.
- Avoid recomputing segmentation for repeated A4 detection (single pass per image).

## Integration Plan (Split‑Ready)
- Service: add `/measure` endpoint reusing the Mask2Former loader. Keep status/timing headers (`X-Device`, `X-Elapsed-MS`, `X-Scale-Long-Side`).
- Clients: `packages/clients/src/measurement.ts` with `measureLocalCV(image: Buffer, opts) → { wallWidthCm, wallHeightCm, debug? }`.
- Core: extend `measureFromImage()` to route to local CV when `provider==='localcv'` (per-request override); otherwise follow existing VLM flow.
- API: accept `provider: 'localcv'` in `apps/web/app/api/measure` BodySchema. Keep adapter thin.
- Env (for PoC):
  - `LOCAL_MEASURE_URL` (default `http://127.0.0.1:8000/measure`).
  - `MEASURE_DEBUG` (server-side on/off for `X-Debug`).
  - `NEXT_PUBLIC_MEASURE_ENGINE_DEBUG` (optional, dev-only; client picks provider).

## Security & Validation
- Strict payload validation in BFF; reject non-image input in service.
- Positive-number guarantees; never emit zero/negative measurements.
- Keep debug artifacts server-only for now.

## Rollout Phases
1) PoC service endpoint `/measure` with debug artifacts; local script for benchmarks; no web/UI changes.
2) Add Node client + core routing (provider `localcv`) and a dev toggle in the frontend.
3) Tune performance (CPU/GPU) and finalize defaults; add RUNBOOK guidance.
4) Optional: add `auto` fallback policy.

## “No Reference Object” Path (Experimental)
- Constraint: monocular scale ambiguity; need priors.
- Proposed approach (behind a debug flag):
  - Use segmentation to find room layout cues (floor/ceiling/wall) and vanishing lines (Manhattan-world assumption).
  - Use EXIF metadata (focal length 35mm eq., FOV approximation) + assumed ceiling height prior (default 300 cm; configurable) to infer absolute scale.
  - Derive wall width/height by projecting the wall plane and measuring the wall-box ROI.
  - Output with low-confidence band (e.g., ±20–35%) and always mark as “experimental”.
- Tradeoffs: sensitive to camera tilt, lens metadata accuracy, and room geometry.

## Risks & Mitigations
- A4 detection false negatives: mitigate via wall-mask restriction, brightness/ratio checks, and fallback messages.
- Performance on CPU: cap long-side, reduce kernels, and short-circuit early if contours explode.
- Ambiguity in “opposite wall” detection: relying on largest connected wall-ish region (with attached/window union) + ROI consistency.

## Next Steps (Recommended Order)
1) Implement `/measure` in FastAPI (service-only PoC) + bench script to validate speed and detection quality.
2) Add Node client + core routing with per-request `provider: 'localcv'` override; keep VLM as default.
3) Wire dev-only frontend toggle (client env or localStorage) to switch provider for testing.
4) Tune performance and add RUNBOOK updates.
5) Design doc + prototype for “no reference” mode (EXIF + 300cm prior) under a debug flag.

## Open Decisions (aligned)
- Debug artifacts remain server-only.
- CPU/GPU targets as above; long-side and kernel sizes will be tuned per platform.
- We’ll prefer per-request provider override for PoC; we can revisit a global engine env after validation.

