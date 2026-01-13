# Curtain Wizard — Curtain-First Flow Plan

## Goal
- Replace the legacy “wall-first” measurement flow with a curtain-first experience.
- Reuse existing wall box data model; UI copy will call it “curtain box”.


## Guiding Principles
- **Single geometry:** The polygon the user marks is the canonical wall/curtain box everywhere in the codebase.
- **Measurement-first update:** Ensure `MeasureService` can measure the selected polygon before refactoring UI flow (service contract proven before UI churn).
- **Reversible rollout:** Keep rollback options focused on renderer pipeline and provider fallbacks.
- **Deterministic state:** Flow state must survive refresh, offline restore, and navigation retries.

## Workstream Overview
0. **Baseline Audit (Pre-Implementation)**
   - Document current `/estimate` flow state (has polygon UI? segmentation timing?)
   - Inventory existing polygon-related code and shared state
   - Test current VLM accuracy baseline (20 sample images)
   - Confirm HeroPoint/CurtainPolygon type compatibility across packages

1. **Domain**
   - Curtain-first is the only supported `/estimate` → `/configure` flow.
   - Extend shared flow state (`CurtainConfig`, IndexedDB schema) to track:
     - `curtainPolygon` as **normalized** `[0,1]` float points in original image space (min 3 points, simple non‑self‑intersecting validation).
     - `measurementStatus`, `segmentationStatus`.
     - Timestamp / signatures for conflict detection.
   - Include `schemaVersion` and a short `debugSummary` (provider, model, vertex count, measurement) on each cached record to simplify migrations and diagnostics.
   - Document flag usage in `README.md`, `RUNBOOK.md`, and `AGENTS.md`.
   - take into account docs/UI-UX_Overhaul/MOTION-TRANSITIONS-IMPLEMENTATION.md

2. **Measurement Service (Priority 0)**
   - Keep existing API: `measureFromImage(photoDataUri, { curtainPolygon?: CurtainPolygon, ... })` (no discriminated union).
   - Provider strategy when `curtainPolygon` is present:
     - **Qwen (qwen3-vl-plus / qwen3-vl-flash)** — *wall-first + geometric rectangle* (**prod-default AI #1**):
       - Treat Qwen as the canonical opposite-wall estimator: first measure the full wall (no polygon) to obtain `wallWidthCm` / `wallHeightCm`.
       - Derive rectangle measurements by scaling the wall result by the polygon’s normalized bounding-box fractions (width/height in `[0,1]`).
       - This keeps Qwen in the task it excels at (wall scale) while still honoring the curtain polygon as the single geometry.
       - Local compute / frame compute (`localcv` / `noreref` segmentation + EXIF) remains available as an additional geometry signal for diagnostics and offline/local-first flows; Genkit (Gemini/OpenAI) acts as a fallback/legacy AI1 provider when explicitly configured, as Qwen remains the primary cm source.
     - **VLM (googleai/openai)** — *polygon specialists*:
       - Use `buildPolygonAwarePrompt()` to describe the polygon as an ROI with bbox % and vertex count.
       - In hybrid mode, allow configuring VLM as a secondary “rectangle provider” that receives the same `photoDataUri` + `curtainPolygon` and returns polygon-focused dimensions while Qwen provides the global wall scale.
     - **`localcv`**:
       - Already sends polygons via `X-Curtain-Polygon` header; remains the local, frame-based measurement path (no change needed).
       - Its cm output may be used as a comparison signal against Qwen/Genkit in QA and debugging, but not as the sole source of truth in storefront mode unless explicitly configured.
     - **`noreref`**:
       - Already constrains wall detection to the polygon (no change needed).
   - Add `packages/core/src/lib/polygon.ts`:
     - `isSimplePolygon(points)`: validate non-self-intersecting.
     - `normalizePolygonFromPx(pointsPx, imgSize)`: shared normalization.
   - Add `packages/core/src/services/measureFallback.ts`:
     - `measureWithFallback()`:
       - If a provider’s native polygon measurement reports confidence <50%, fall back to full-wall cm scaled to the polygon bbox (same geometry used in the benchmarks).
       - For Qwen, treat the "wall × bbox" path as the **primary** rectangle strategy and only experiment with native polygon prompts behind an internal flag.
       - Optionally support a hybrid provider fallback: if Qwen/Genkit polygon output is missing or clearly degenerate, call a configured VLM (e.g. Gemini) in polygon mode and record `fallbackProvider`.
       - Return `{ ...MeasureOutput, usedFallback: boolean }` and append a clear warning to `warnings[]` (including whether the fallback was geometric or cross-provider).
   - Update `measurePrompt.ts`:
     - `buildPolygonAwarePrompt(polygon)`: inject polygon constraint into prompt with bbox % and vertex count (used by googleai/openai and any experimental Qwen polygon mode).
     - `polygonInstructions(summary)`: reusable constraint text.
   - Regression tests: polygon vs no-polygon, Qwen wall→rect scaling, hybrid-provider fallback, validation edge cases.
   - `/api/measure`: validate polygon server-side (min 3 points, simple check).
   - Configure page: ensure any on-demand measurement requests use a normalized polygon.

### Current status — Measurement Service (Milestone A baseline)
- Qwen **wall-first + geometric rectangle** is implemented in `measureFromImage` (`packages/core/src/services/measure.ts`): full-wall cm first, then rectangle cm via polygon bbox fractions when `curtainPolygon` is present.
- `polygon.ts`, `measureFallback.ts`, and `buildPolygonAwarePrompt()` are wired; geometric fallbacks are enabled, but hybrid cross-provider polygon fallback remains **disabled** for now.
- Qwen-only batch benchmarks (wall and polygon rectangles) are tracked in `QWEN_Only-batch_tests_wPolygon` and can be reproduced with `scripts/measure-benchmark.mjs` using `--provider qwen`, `--ground-truth ./ground_truth.json`, and `--poly-box`.
- A legacy "debug measurement after wall box" path still exists for early experiments and should be removed or gated once the curtain-first flow progresses through Milestones B/C.

### Current status — Configure curtain box (Measurement accuracy)
- The `/configure` page now scales the **curtain box** dimensions directly from the wall measurement in `FlowState` (no extra `/api/measure` call). Width and height are derived via geometric `wall × bbox` scaling.
- Final wall segmentation mask is sampled in a central vertical band to estimate robust `wallTop`/`wallBottom` bounds; when the mask passes basic span checks, the curtain-box height is reinterpreted as a **fraction of wall height**, not full frame height.
- A hard mask-height ratio guard (`MASK_HEIGHT_RATIO_MIN/MAX`) compares the wall-fraction height to the full-frame bbox fraction; if the ratio falls outside the safe band (e.g. wall mask severely shortens the wall), the flow **falls back to full-frame bbox height** for curtain-box cm, effectively ignoring the mask in that case.
- Measurement Diagnostics logs a second observation with `source: 'configure-box'`, `usedFallback: true`, and `fallbackProvider: 'geometry:bbox'` plus a geometry summary string and mask-related warnings (e.g. `mask:height_ratio_out_of_range`, `mask:span_out_of_range`, `mask:fracWall<=0`) so analytics and designers can see exactly when the guard triggered.

### Future accuracy optimizations (Configure curtain box)
- Tighten or relax `MASK_HEIGHT_RATIO_MIN/MAX` per benchmark runs (`scripts/measure-benchmark.mjs --provider qwen --ground-truth ./ground_truth.json --poly-box`) to trade off aggressiveness vs. stability.
- Combine mask span/coverage heuristics with the ratio guard (e.g. ignore masks that cover too little of the frame or have fragmented wall runs) for edge cases with heavy occlusions.
- Feed EXIF-based FOV estimates and/or multi-model ensembles (see `project planning/900-Accuracy-Quick-Wins.md`) back into the wall-scale step to improve the underlying cm baseline before bbox scaling.

3. **Segmentation & Cache Pipeline**
   - Segmentation timing: trigger **full image** segmentation immediately on upload (no modal wait), in parallel with polygon marking and measurement.
   - Polygon marking is available as soon as the photo loads; do not block it on segmentation.
   - Measurement is driven by the polygon; segmentation masks are used for overlays/diagnostics only and must not gate or delay measurement.
   - Cache structure: `photoSignature → { fullMask?, polygon?, measurement? }`.
   - Cache/migration (stealth phase): acceptable to clear or rebuild measurement/segmentation caches when schema changes; no complex IndexedDB migration required.
   - Ensure offline restore tolerates both flows where supported (fallback to wallBox from polygon bbox if needed).

4. **/estimate UI & Flow**
   - Curtain-first flow:
     - Start segmentation on upload; display progress banner.
     - Show polygon tool immediately once the photo loads (same timing as the current wall-box corner step); segmentation runs in parallel and does not block interaction.
        - IMPLEMENTED (2025-11-XX): Polygon tool appears on upload with four-corner validation, reset, and “Measure” CTA; runs against `/api/measure` with `curtainPolygon` payload.
     - "Measure Selected Area" CTA reuses the existing wall box corners measurement logic for enabling/disabling and error states.
     - Client-side validation reuses the current wall-box validation rules (rather than introducing a new pattern).
     - After measurement: show confirmation card with height/width/confidence.
     - If confidence <70%: warning banner "Low confidence. Try including a door or window."
     - "Reset Area" button to clear polygon and redraw.
   - Allow polygon reset + re-measure; surface errors with retry guidance.
   - Integration tests: polygon validation, fallback triggers.

5. **Navigation to `/configure`**
   - Require: segmentation mask, curtain polygon, measurement payload.
   - Persist data in shared store before navigating.
   - `/configure` on initial mount:
     - First tries `FlowState` (fresh nav from `/estimate`).
     - If FlowState is missing or stale, falls back to the standard 3-level cache restore (`lastUploadedKey` → latest cached segment when enabled).
     - Only when **none** of these restore paths succeed does it redirect to `/estimate` (to start a fresh measurement flow).
   - This allows accidental reloads, back/forward navigation, or direct URL revisits to reopen the **last valid session** when cache exists, while still preventing a truly empty new-flow `/configure` from starting without running `/estimate` first.
   - Add guard rails:
     - If required data is missing (e.g., opened in a brand-new session with no cache), show an inline repair state with a clear CTA to go back to `/estimate` to pick an area and re-measure, instead of silently attempting to reconstruct state.

6. **Configurator Integration**
   - Update geometry consumers (pricing, coverage, stitch lines) to rely on `curtainPolygon`.
   - Audit expectations in `packages/core/src/catalog/lib/*`, summary panel, and coverage warnings.
   - Ensure measurement metadata (height, widths) is mapped consistently to existing APIs.

7. **Documentation & QA**
   - Update RUNBOOK, README, AGENTS with new flow instructions and troubleshooting.
   - Add QA checklist covering: fresh flow, polygon edits, measurement retry, offline restore.
   - Provide analytics hooks to compare completion rates across releases/providers.

## Sequencing & Milestones
0. **Phase 0: Baseline Audit (1-2 days)**
   - Document current `/estimate` flow (screenshots, state machine).
   - Inventory existing polygon UI (if any).
   - Test current VLM accuracy on 20-image test set (establish baseline).

1. **Milestone A: Service Contract Proof (3-5 days)**
   - Feature flag + env validation (already partially done).
   - Polygon helpers: `isSimplePolygon()`, `normalizePolygonFromPx()`.
   - VLM prompt: `buildPolygonAwarePrompt()` with bbox context.
   - `measureWithFallback()` with confidence gating.
   - Unit tests: polygon vs no-polygon, fallback triggers.
   - Manual validation: 20 images with hand-drawn polygons vs legacy accuracy.

2. **Milestone B: Data Layer (2-3 days)**
   - Cache structure update for curtain-first flow (may include clearing existing caches; no complex IndexedDB migration needed in stealth phase).
   - Analytics/logging hooks (provider, model, confidence, fallback events).

3. **Milestone C: UI Beta (5-7 days)**
   - `/estimate` polygon tool with realtime validation.
   - Measurement confidence display + low-confidence warnings.
   - `/configure` guard rails for missing data.
   - Integration tests for both flow modes.

4. **Milestone D: Rollout (3-5 days)**
   - Full QA checklist.
   - Analytics review (confidence distribution, completion rates by flow mode).
   - Gradual rollout: 10% → 50% → 100% traffic.
   - Feature flag default switched to `new` only after go/no-go review.

## Risk Register & Mitigations
- **State Desync**: Segmentation ready but measurement missing → enforce gating before navigation; show inline alerts.
- **Cache Reset (Stealth Phase)**: Schema changes may clear stealth-session caches → acceptable before public launch; revisit simple migrations only after GA if needed.
- **Provider Limits**: If polygon-based measurement fails, fall back to full-wall measurement + scale heuristics; log events for tuning and clearly surface fallback in UI.
- **Performance**: Immediate segmentation may stall UI on low-end devices → retain progress UI, allow user to skip if running long (falls back to legacy timing).
- **Accuracy Regression**: Polygon measurement may be less accurate if:
  - User draws polygon too tight (cuts reference objects).
  - VLM has less context (smaller ROI, fewer landmarks).
  - Polygon includes non-wall elements (furniture, lamps).
  - **Mitigation**: Run A/B comparison (polygon vs full-wall) on test dataset before rollout; add confidence gating (<50% triggers fallback); UI warning if confidence <70%; analytics track confidence distribution by provider/polygon size.

## Acceptance Checklist (per milestone)
- 0: Baseline documented; test set defined; accuracy target set (e.g., 85% within 10% error).
- A: Unit tests pass; `measureWithFallback()` triggers correctly; manual test shows polygon accuracy ≥ baseline; legacy callers unaffected.
- B: Offline restore works for both flows; v2→v3 migration runs without crashes; TTL cleanup removes stale records.
- C: Curtain-first flow completes end-to-end; polygon validation prevents invalid shapes; confidence warnings display; measurement and pricing match expected values.
- D: Documentation updated (RUNBOOK, README, AGENTS); analytics shows completion rates + confidence distribution; A/B comparison reviewed; flag flipped only after go/no-go review.
