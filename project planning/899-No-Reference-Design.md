# Task 899 — No-Reference Measurement Prototype

## Objective
Introduce an experimental measurement provider that estimates the opposite wall dimensions from a single photo without the A4 reference sheet. The prototype should stay debuggable, opt-in, and reversible while giving us a baseline to iterate on confidence scoring and UX warnings.

## Constraints & Assumptions
- **Zero user input.** Customers should not have to enter ceiling height or camera details. We rely on EXIF metadata when available and ship sensible fallbacks.
- **Manhattan-ish rooms.** Walls, floor, and ceiling meet at near-right angles; we assume the camera roughly faces the opposite wall with limited roll.
- **Camera height prior.** For distance recovery we assume a handheld camera at 150 cm above the floor (override via env if needed).
- **Environment first.** Provider wiring lives in `packages/core`; adapters expose a `provider: 'noreref'` option. Env validation extends `AI1_PROVIDER` and `MEASURE_CAMERA_HEIGHT_CM` (new) with defaults.
- **Segmentation reuse.** We reuse the existing semantic segmentation helpers instead of introducing a second stack. When the GPU service is offline we fall back to the HF pipeline just like the curtain preview.
- **Debug visibility.** The prototype returns `confidencePct` and a `warnings[]` list so designers can evaluate telemetry without exposing raw heuristics to customers.

## Proposed Pipeline (899b)
1. **Decode & EXIF.** Convert the data URI to a buffer, sniff EXIF via `exifr`. Derive focal length in pixels using: `f_px = (FocalLength35mm / 36mm) * imageWidthPx` when available, else a 60° horizontal FOV fallback (`f_px = 0.5*W / tan(30°)`).
2. **Scene segmentation.** Call a new helper `segmentScene()` that requests the local Mask2Former FastAPI first, then HF fallbacks. The helper returns binary masks for wall, floor, and ceiling at the original resolution plus convenience stats.
3. **Floor/ceiling bands.** Within the masks compute:
   - `ceilingY`: the lowest row that still belongs to the ceiling mask after morphological closing.
   - `floorY`: the highest row that belongs to the floor mask.
   If either band is missing, fall back to histogram peaks in the upper/lower thirds of the grayscale image and flag a warning.
4. **Wall extent.** Restrict the wall mask to the band `[ceilingY, floorY]` and find the dominant connected component (Keeps us on the opposite wall). Compute its width span (`leftX`, `rightX`) and pixel height `wallPx`.
5. **Camera distance.** Assume camera height `Hc` (150 cm default). With principal point at `cy = H/2`, estimate distance: `distanceCm = Hc * f_px / max(1, floorY - cy)`. Clamp distance to `[100, 800]` cm to avoid wild values. Missing floor band -> drop to heuristic distance `defaultDistance = 300` cm with warning.
6. **Metric scale.** Convert pixels to centimeters: `scale = distanceCm / f_px`. Output estimates:
   - `wallHeightCm = wallPx * scale`
   - `wallWidthCm = (rightX - leftX) * scale`
   Clamp with fabric constraints helper to match UI behaviour (gentle toasts downstream).
7. **Confidence model.** Start at 1.0 and subtract penalties:
   - −0.35 if either floor or ceiling band missing.
   - −0.2 if EXIF focal length missing.
   - −0.15 if wall component touches the frame edges (likely angled shot).
   - −0.1 if segmentation fell back beyond the local Mask2Former.
   Final `confidencePct = clamp(0, 100, round((base - penalties) * 100))`.
   Populate `warnings` with plain-language reasons whenever penalties apply.
8. **Debug payload.** Return optional debug info mirroring the local CV structure (`bands`, `scale`, `distanceCm`, `focalPx`, `providerFallback`, thumbnails when debug flag enabled) so we can compare runs via benchmark script.

## API & Wiring (899c)
- Extend `measureFromImage` to accept `provider: 'noreref'` and route to the new pipeline.
- `/api/measure` body schema and env validator recognise the new provider.
- `scripts/measure-benchmark.mjs` gets `--provider noreref` plus prints confidence/warnings in the run table.
- Debug UI keeps the option behind `NEXT_PUBLIC_MEASURE_ENGINE_DEBUG` (NOReref shows only when flag and debug dropdown enabled).

## Risks & Mitigations
- **No EXIF:** Fallback FOV may misrepresent ultrawide photos. We log a warning and cap confidence at ≤55 %.
- **Segment noise:** Without A4 the wall selection may drift to side walls. Dominant-component filtering + frame-edge penalty reduces impact; we can add a colour-hue prior in later iterations.
- **Camera pitched heavily:** Distance formula breaks if floor band sits above the principal point. We clamp the denominator and warn when `floorY <= cy`.
- **Performance:** Hugging Face fallback adds latency. Calls reuse existing env toggles (`SEG_LONG_SIDE`, etc.), and debug thumbnails are gated by a `NOREREF_DEBUG=1` env so we stay opt-in.

## Testing & Validation
- Update `scripts/measure-benchmark.mjs` to ingest the new confidence + warnings. Provide a preset command in the RUNBOOK:
  ```bash
  node scripts/measure-benchmark.mjs \
    --files public/originals/scianas.jpg public/originals/sypialnias.jpg public/originals/zaslonys.jpg \
    --provider noreref --ground-truth ground_truth.json --summary table
  ```
- Record baseline error metrics (MAE, RMSE, P95) for the three sample photos and track improvements alongside confidence.

## Next Iteration Ideas
1. Replace the simple floor/ceiling heuristics with vanishing-line detection (Hough transforms) to better handle steep camera pitch.
2. Blend monocular depth (MiDaS) to refine the distance estimate instead of a single height prior.
3. Train a lightweight regression head that learns scale directly from the segmented wall/floor features using our curated dataset.
4. Surface confidence-driven UX copy (e.g., “Looks like an angled photo—we might be off by ±15 %”) once telemetry stabilises.

