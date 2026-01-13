# Curtain Wizard — Task List (Numbered)

Legend: split-ready from day one; IDs are unique and grouped by area.

## 050 — UI Platform Foundation *(see `docs/DESIGN-SYSTEM-IMPLEMENTATION-PLAN.md`)*
- 051: DONE — Scaffolded `packages/ui` workspace with TypeScript config + scripts.
- 052: DONE — Implemented token generator pipeline emitting CSS vars, Tailwind extend, and JSON handoff; available via `npm run generate:tokens`.
- 053: DONE — Tailwind now consumes generated tokens and `npm run check:tokens` enforces drift checks for `packages/ui/tokens/generated/*`.
- 054: DONE — Port Button/Card/Input/Chip/Dialog primitives into the kit with motion tokens + automation handles (`data-cw-component`, `data-cw-variant`).
  - 054a: DONE — Button migrated to `packages/ui` (mobile-aware sizing, `data-cw-*` handles, start/end icons) and re-exported via app shim.
  - 054b: DONE — Card migrated with padding controls + `data-cw-*` handles; shims now proxy to the kit.
  - 054c: DONE — Input migrated with density controls, error state handles, and shimmed into the app.
  - 054d: DONE — Chip (default + swatch) migrated with breakpoint-aware sizing and automation metadata.
  - 054e: DONE — Dialog migrated with variants, responsive sizing, backdrop handling, and automation handles.
  - 054f: DONE — Toggle + NumericInput implemented in `packages/ui` (prefers-reduced-motion aware) and exported via the shim.
- 055: DONE — Published Ladle playground (`npm run storybook:ui`) covering Button/Card/Input/Chip/Dialog stories with shared tokens (see `packages/ui/stories/*`).
- 056: DONE — Shim exports now include Toggle + NumericInput plus Select/Spinner/Progress, the summary panel uses kit cards/rows, the range slider + hero upload drop zone run through the kit, and all net-new UI must be authored in `packages/ui` + shims before landing in `apps/web`.
- 057: ⏳ Once Configurator + Upload rely on the kit, confirm the supported renderer pipeline (`NEXT_PUBLIC_TEXTURES_PIPELINE=artist`) and update README/RUNBOOK with a regression checklist.
- 058: DONE — Stabilized `apps/web` on Next.js 14.2.13 / React 18.2.0 (plus `client-only` / `@swc/counter`) per `BUILD-FIXES-SUMMARY.md` so CI stays green while the App Router prerender bug is triaged upstream.
- 059: PENDING — Standardize `/estimate` confirm modals (polygon confirm + wall size confirm) on UI-kit primitives (Dialog/Sheet) so they inherit tokens/a11y consistently and are resilient to parent storefront/Webflow global CSS. (Current hotfix uses scoped `.cw-modal-scope` styles.)

## 060 — Curtain-First Flow (see `NEW-FLOW-PLAN.md`)
- 061: Baseline audit — document current `/estimate` + `/configure` behaviour (including secondary polygon measurement and diagnostics), confirm which providers honour `curtainPolygon` in prompts, and capture an initial accuracy baseline on a small test set.
- 062: PARTIAL — Measurement service: polygon-aware prompts and `measureWithFallback` for AI #1 providers, plus regression tests for polygon vs full-wall requests (including confidence gating and fallback events), and wiring measurements into the existing diagnostics panel.
  - 062a: DONE (2025-11-20) — Added a hard mask height ratio guard for curtain-box scaling in `/configure` so over-aggressive wall mask bounds fall back to full-frame bbox fractions, and logged detailed geometry/warning data under `source: 'configure-box'` in Measurement Diagnostics for accuracy tuning. (Refs: `apps/web/app/configure/page.tsx`, `apps/web/lib/measurement-observer.ts`, `project planning/NEW-FLOW-PLAN.md`)
  - 062b: DONE (2025-11-28) — Implemented local mask-based heuristics for polygon measurement in `/estimate` (new flow): `analyzeWallMaskPng()` + `computePolygonDimensionsWithHeuristics()` in `apps/web/lib/mask-heuristics.ts`. Qwen measures full wall in parallel with segmentation; on polygon confirm, heuristics compute polygon dimensions as fraction of detected wall bounds (using p10/p90 percentiles to handle furniture occlusion). Results stored in FlowState for `/configure`. Known issue: combined mask includes foreground elements that can restrict wall bounds detection—future fix: use raw `wall` mask instead. (Refs: `apps/web/lib/mask-heuristics.ts`, `apps/web/app/estimate/page.tsx`)
- 063: DONE (2025-11-28) — Flow state + cache now persist `flowMode`, the canonical curtain-first measurement, and curtain polygons into FlowState + IndexedDB. In `new` mode `/estimate` measures from the confirmed curtain polygon, saves the user‑confirmed cm and polygon into FlowState, and `/configure` restores this single source of truth **and explicitly skips `/api/measure`** when `flowMeasurementMeta` already has valid wall dimensions from `/estimate`. The measurement cache key is versioned by polygon + flow mode and wired into Measurement Diagnostics. (Refs: `apps/web/app/estimate/page.tsx`, `apps/web/app/configure/page.tsx`, `apps/web/lib/flow-state.ts`, `apps/web/lib/measurement-cache.ts`, `apps/web/lib/measurement-observer.ts`, `project planning/Measurement-Pipeline-Overhaul.md`)
- 064: DONE (2025-11-21) — `/estimate` in `new` flow shows the curtain polygon tool immediately after upload, runs segmentation in the background, gates measurement + results until the user confirms 4 corners via an inline “4 corners marked” overlay, then shows the dimension confirm modal and navigates to `/configure` with the confirmed cm values.
- 064a: DONE (2026-01-10) — `/configure` restore no longer flashes the legacy “mark corners” helper during estimate → configure, and holds the processing overlay until curtains are ready to render. (Refs: `apps/web/app/configure/hooks/useCurtainFirstRestore.ts`, `apps/web/app/configure/components/HeroSurface.tsx`)
- 064b: DONE (2026-01-10) — Prefill `/configure` hero with FlowState data to avoid the empty hero flash during estimate → configure navigation. (Refs: `apps/web/app/configure/hooks/useCurtainFirstPhaseMachine.ts`)
- 065: Etap 4 / Navigation & repair — implement gating and repair path from `Measurement-Pipeline-Overhaul` Etap 4 for navigation to `/configure`: require canonical measurement (`meas#P`) from Stage 1 + curtain polygon + (when available) segmentation mask before CTA is active; if data is missing or stale, surface inline repair UI that redirects back to `/estimate` instead of showing a half-broken `/configure`.
- 066: Etap 2 / Geometry (mask + polygon) — complete geometry integration from `Measurement-Pipeline-Overhaul` Etap 2: compute curtain height and related geometry in `/configure` from `baseCm` (meas#P) + wall mask + curtain polygon with `CURTAIN_BOX_HEIGHT_SOURCE='mask'` and a guarded fallback (`mask:height_ratio_out_of_range` → `mask:fallback_poly_only`), and propagate the resulting geometry into pricing, coverage, stitch lines, and the summary panel.
- 067: Etap 5 / Diagnostics + QA — sync RUNBOOK/README/AGENTS and QA/analytics with `Measurement-Pipeline-Overhaul` Etap 2–5: document the curtain-first measurement + geometry pipeline (Stages 1–2), define gating/repair rules (Stage 4), and extend Measurement Diagnostics/analytics to cover provider/model/cache key/flowMode/maskStatus/fallback mode and flow completion metrics.

## 100 — Repo & Scaffolding
- 101: DONE — Create turborepo layout (`apps/web`, `services/segmentation`, `packages/{core,clients,shared}`).
- 102: DONE — Add `packages/shared/env.ts` with zod schema + `.env.example`.
- 103: DONE — Base tooling: ESLint/Prettier scripts, Docker files, compose (GPU).

## 200 — Import Web App
- 201: DONE — Import ZaslonAIzer UI and actions into `apps/web`.
- 202: DONE — Port assets (textures, images) and verify paths.
- 203: DONE — Add `/api/healthz` route.

## 300 — Core & Clients (Split‑Ready)
- 301: DONE — Define `MeasureService`, `SegmentationService`, `CurtainPricingService` interfaces in `packages/core`.
- 302: DONE — Implement `SegmentationService` orchestration (RAW-first post-process) in `packages/core`.
- 303: DONE — Implement `SegmentationClient` (FastAPI) and `HfSegmentationClient` in `packages/clients`.
- 304: DONE — Implement `MeasureService` wrapper around Genkit in `packages/core`.

References:
- `packages/core/src/services/segment.ts`
- `packages/core/src/services/measure.ts`
- `packages/shared/src/env.ts`

## 400 — AI #1 (Genkit)
- 401: DONE — Provider switch (env: `AI1_PROVIDER`, `AI1_MODEL`).
- 402: DONE — Harden prompt + strict JSON parsing with zod; add retries.

## 500 — AI #2 (FastAPI Mask2Former)
- 501: DONE — Move FastAPI to `services/segmentation` and strip MMSeg/UPerNet paths.
- 502: DONE — Add `/healthz` and RAW per-class mask endpoints. Confirm output PNG format.
- 503: DONE — Dockerfile + compose with NVIDIA runtime; README for GPU driver setup.
- 504: DONE — Stress test scenario for running segmentation service with multiple concurrent requests; script `scripts/stress-seg.mjs` and npm task `npm run stress:seg`.

References:
- `services/segmentation/Dockerfile`
- `docker-compose.yml`

## 600 — Node Post‑Processing
- 601: DONE — Import `lib/segmentation.ts` into `apps/web` and adapt to RAW-only inputs.
- 602: DONE — Expose env-tuned parameters (long side, hole fill, merge radius, contact, smoothing, min/max area).
- 603: DONE — Implement fallback sequence: local → HF Mask2Former → HF SegFormer.

## 700 — API Routes (BFF)
- 701: DONE — `/api/measure` adapter calling `MeasureService`.
- 702: DONE — `/api/segment` adapter calling `SegmentationService` (returns PNG alpha; `layers=1` debug optional).
- 703: DONE — `/api/curtains` pricing stub; integrate Magento client later.

References:
- `apps/web/app/api/measure/route.ts`
- `apps/web/app/api/segment/route.ts`
- `apps/web/app/api/healthz/route.ts`

## 800 — UI Integration
- 801: DONE — Estimation Wizard calls `/api/measure`, with upload UX, spinner, and measurement readouts.
- 802: DONE — Configurator wired to `/api/segment` with layered PNG preview toggle.
- 803: DONE — Corner selection polish (4-point adjust, snapping); mobile rotation hint and responsive controls.
  - 803a: DONE — Single preview flow; modal overlay for marking; closed polygon; spinner; wall-box drag handles; live dimension readout (debug width=400cm).
  - 803b: DONE — Finalized snapping refinements, mobile rotation hint, and responsive layout polish.
- 804: Debug controls: `layers=1` preview in UI (attached_on_wall, proposal_union, final_mask); show timings from headers/JSON.
- 805: DONE — Client caching with IndexedDB dedupe, offline restore, and 25MB eviction policy.
- 805c: DONE — Restored awaited segment cache writes while keeping the UI instant so offline `/configure` recovery keeps working after the performance optimisation. (Refs: `apps/web/app/estimate/page.tsx`, `docs/PERFORMANCE-OPTIMIZATION.md`)
- 805d: DONE — `/api/segment` surfaces the active backend (`X-Segment-Backend`) and logs fallback timings to debug HEIC slowdowns (Refs: `apps/web/app/api/segment/route.ts`, `packages/core/src/services/segment.ts`)
- 805e: DONE — Hugging Face fallback inputs are auto-resized and recompressed before upload so large HEIC/JPEG files stay sub-MB even when the GPU service is offline, and the API reports the resized payload via `X-Input-Bytes` (Refs: `packages/core/src/lib/segmentation.ts`, `packages/core/src/services/segment.ts`, `.env.example`, `docs/RUNBOOK.md`)
- 806: DONE — Upload validation, drag/drop highlighting, paste support, and upload/processing progress UX.
- 807: DONE — Estimate uploader guards against stale HEIC conversions and adds a `/api/convert-heic` (`heic-convert`) fallback so HEIC photos convert automatically without manual steps. If cache restore misses, `/configure` now regenerates the mask from the in-memory photo to keep the flow unblocked. (Refs: `apps/web/app/estimate/page.tsx`, `apps/web/lib/image-validation.ts`, `apps/web/app/api/convert-heic/route.ts`, `apps/web/app/configure/page.tsx`)

## 810-820 - UI/UX Overhaul
# Complete task list for UI/UX Overhaul will be made following UI/UX Guidelines research and documentation 
- 810: PARTIAL — Stage 2 inline-style cleanup (2025-10-18). Static layout/colour styling on Configure + Estimate now uses Tailwind; geometry-only inline styles remain pending token alignment. (Refs: `docs/MIGRATION-STATUS.md`, `docs/UI-PREP-QUICKSTART.md`.)
- 810b: PARTIAL — Stage 3 component extraction (2025-10-18). Configurator shell (`ConfiguratorLayout.tsx`), summary panel (`SummaryPanel.tsx`), debug controls (`DebugControls.tsx`), services list (`ServicesSection.tsx`), and sidebar filters (`FiltersPanel.tsx`) now live in `apps/web/app/configure/components/` with shared i18n copy. (Refs: `docs/MIGRATION-STATUS.md`, `docs/CONFIGURE-MIGRATION-GUIDE.md`.)

## 830-840 - Code Refactor
- 830: DONE — Move `weaveStrength` tuning from color presets to material presets so weave intensity tracks fabric family instead of hue. (Refs: `apps/web/lib/canvas-renderer/color-presets.ts`, `apps/web/lib/canvas-renderer/material-presets.ts`, `apps/web/app/configure/page.tsx`)

## 850 — Catalog & Checkout Integration
- 851: DONE — `CatalogProvider` interface, env flag, resolver, and React context wired into the app shell.
- 852: DONE — Mock catalog dataset, deterministic pricing calculator, and tsx parity tests.
- 853: DONE — Stage 4 UI wired to provider data with responsive panel and live pricing.
- 854: DONE — Stage 5 services panel with provider-driven selections, pricing, and consultation overlay.
- 857: DONE — Domain defaults module + default curtain height fix (align Mock provider UX guardrails).
- 858: DONE — Mock fabrics carry widths, repeats, allowances, shrinkage, pleat fullness, and per-metre pricing (`packages/core/src/catalog/mock/data.ts`, `packages/core/src/catalog/types.ts`).
- 859: DONE — Provider consumption calc covers allowances, repeats, fullness, railroad logic, labour and surcharges with cart metadata + tests (`packages/core/src/catalog/providers/mock.ts`, `packages/core/tests/catalog-mock.test.ts`).
- 860: DONE — Fabric constraints helper + provider/UI clamps with toasts; pricing metadata + cart payload capture applied sizes (`packages/core/src/catalog/lib/constraints.ts`, `packages/core/src/catalog/providers/mock.ts`, `apps/web/app/configure/page.tsx`, docs updated).
- 860a: DONE — Segment edge handles now raise the centered clamp notice when pushing past fabric width limits; wall-box drags remain silent (`apps/web/app/configure/page.tsx`).
- 861: DONE — Pricing summary surfaces linear metres, bolt widths, fullness, allowances, repeat, and constraint notes from provider metadata; catalog tests cover metadata + friendly errors (`apps/web/app/configure/page.tsx`, `packages/core/tests/catalog-mock.test.ts`).
  - 887: DONE — Configure restore safety + last uploaded priority. Removed implicit auto-restore of latest cached unless `NEXT_PUBLIC_CONFIGURE_FALLBACK_LATEST=1`. Estimate refreshes cached photo on signature mismatch to keep photo–mask pairs consistent. Files: `apps/web/app/{estimate,configure}/page.tsx`, `apps/web/lib/flow-state.ts`.
- 862: DONE — Author PRICING.md and update docs/README with consumption algorithm.
- 865: DONE (2025-10-24) — Lock measurement scaling to normalized wall-box ratios so resizing the viewport after marking the wall no longer shifts cm readouts or pricing. Docs updated with QA guidance (`apps/web/app/configure/page.tsx`, `docs/UI-UX_Overhaul/Phase-5-Revised-Design.md`, `docs/UI-UX_Overhaul/Phase-5-Implementation-Summary.md`, `README.md`, `docs/RUNBOOK.md`).
- 865a: DONE (2025-10-24) — Added `NEXT_PUBLIC_STITCH_LINES_ENABLED` so seam guides can be disabled even when the Debug UI is hidden (production-friendly). Docs + env examples updated (`apps/web/app/configure/page.tsx`, `.env.example`, `README.md`, `docs/RUNBOOK.md`).
- 855: DONE — Stage 6 summary exposes provider metadata, `/api/cart/add` builds Magento GraphQL payload (mock-friendly), and the configurator keeps state after adding to cart (`apps/web/app/configure/page.tsx`, `apps/web/app/api/cart/add/route.ts`, `packages/clients/src/magento.ts`).
- 856: PENDING — QA scaffolding (Storybook/Playwright scenarios in mock mode; staging verifies storefront provider).
- 857: Make sure each fabric has a texture image connected to it and it is visible in the configurator.
 - 858: DONE — Color options visible in configurator; selection affects preview; pricing structure supports `colorId`. (Docs updated: RUNBOOK, PRICING.)
 - 858a: DONE — Added sample color-based pricing rule in mock: `fab-olive-linen-300` with `colorId: 'olive'` uses higher price per metre (`pricePerMLinearMinor: 7400`). Rule matching prioritizes color-specific entries.
- 859: DONE — Create texture presets for fabric specific visual options like opacity and scale.
Reference: `project planning/Curtain Wizard User Journey (Stage 4-6).md`.

## 870 — Localization & Language Support
- 870: DONE — Introduced i18n infrastructure (shared message catalog, translation loader, language context/provider) with defaults for Polish, English, Ukrainian (`packages/core/src/i18n`, `apps/web/app/providers/locale-context.tsx`).
- 871: DONE — Externalized remaining UI strings and ensured i18n usage across pages. Added `estimate.previewAlt` and removed server-origin error texts from user-visible toasts in favor of localized copies. Verified number/currency formatting via `Intl` with active locale.
- 872: DONE — Language switcher polished (desktop dropdown, larger mobile hit targets), preference persisted (localStorage + URL param), and translations lazy-loaded via `/api/i18n/[locale]`. Preserved configurator state on language change.
  - References: `apps/web/app/components/LanguageSwitcher.tsx`, `apps/web/app/providers/locale-context.tsx`, `apps/web/app/api/i18n/[locale]/route.ts`, `apps/web/app/configure/page.tsx`.
- 873: DONE — Update documentation (README, RUNBOOK, i18n guide) and automated coverage to exercise multilingual flows; define translation workflow for new locales.


## 880 — UX Polish
- 881: DONE — Curtain rendering pass 1: add simple lighting and shadows on curtain to better match room photo.
  - 881a: DONE — Define env toggles for lighting (zod-validated in `packages/shared/src/env.ts`, mirrored in `.env.example`):
    - `NEXT_PUBLIC_LIGHTING_MODE` = `off | lite | enhanced` (default: `lite`)
    - `NEXT_PUBLIC_LIGHTING_OPACITY` (0.0–1.0, default: `0.35`)
    - `NEXT_PUBLIC_LIGHTING_GRID_X` / `NEXT_PUBLIC_LIGHTING_GRID_Y` (default: `48` / `32`)
    - `NEXT_PUBLIC_LIGHTING_THROTTLE_MS` (default: `120`)
    - `NEXT_PUBLIC_LIGHTING_ENABLED` (boolean 1/0; env-only on/off switch)
  - 881b: DONE — Implement photo-based lighting estimator hook (whole-photo, idle-queued once per photo; cache by file signature). Later refined to sample the wall-box ROI for better alignment. Compute:
    - Ambient brightness/contrast/saturation for CSS `filter` (Lite mode)
    - Optional dominant gradient direction from a coarse luminance grid (Enhanced mode)
  - 881c: DONE — Integrate Lite mode in `apps/web/app/configure/page.tsx` by applying a single CSS `filter` to the curtain container (masked/ clipped by existing `overlayRef`). Do not modify texture `background*` properties.
  - 881d: DONE — Integrate Enhanced mode by adding one gradient overlay with `mix-blend-mode: soft-light`, positioned within each rotated segment container; masked/clipped to the wall box; angle compensated for rotation.
  - 881e: DONE — Replace UI toggle with env-only switch: `NEXT_PUBLIC_LIGHTING_ENABLED` controls on/off. Slider removed per product decision.
  - 881f: DONE — Performance guards: skip on low-power/`saveData`; throttle updates; recompute only on new photo or env change (do not recompute on wall box/segment drags).
  - 881g: DONE — QA/Acceptance: verify no regression in texture tiling/anchoring, confirm mobile/desktop perf, and validate OFF/LITE/ENHANCED behaviours.
  - 881h: DONE — Documentation: update `README.md` and `docs/RUNBOOK.md` (feature flags, behaviour, perf notes); add recent updates to `AGENTS.md`; cross-link in `project planning/04-Development-Plan.md` if needed.
- 882: DONE — Allow user to controll wall box vertical position by dragging Central segment handle up/down.
- 883: DONE — Deploy mobile web preview to staging.
- 884: DONE — UI styling and polish: curtain preview container, param panel layout, responsive controls, mobile UX.
- 884a: DONE — Configure page appearance defaults now driven by CSS tokens (`--cw-config-overlay-*`) so gradients/glass blur live in the design system rather than env flags.
  - 884b: DONE — Change Budget selector to slider selector with min/max values.
  - 884c: DONE — Persist per-category fabric+color selection across sessions with correct restore semantics; remember direct color-chip selection and honor storefront preselection on first load for a type (higher priority than memory). Add regression coverage.
- 884d: PARTIAL (2025-10-25) — Phase 5 desktop hero lock + glass expansion. `/estimate` and `/configure` now share the `cw-hero-shell` frame (768×576) so the hero photo keeps the same footprint during upload → mark flow, and `ConfiguratorLayout` expands the glass card only after the wall box is confirmed (`phase=ready`). Hero remains sticky while centered pre-confirmation, then docks left with the configurator panel sliding into the newly expanded space. (Refs: `apps/web/app/estimate/page.tsx`, `apps/web/app/configure/page.tsx`, `apps/web/app/configure/components/ConfiguratorLayout.tsx`, `apps/web/app/globals.css`, `apps/web/tailwind.config.ts`)
- 884e: PARTIAL (2025-10-25) — Summary panel realigned with hero width + single-scroll configurator. On desktop the summary now sits directly beneath the sticky hero (same 768px width) while the configurator card scrolls with the page (no sticky/overflow). Mobile order stays hero → configurator → summary. (Refs: `apps/web/app/configure/page.tsx`, `apps/web/app/configure/components/FiltersPanel.tsx`, docs updated)
- 884f: DONE (2025-12-05) — Reused the mobile fullscreen photo popup on `/configure` via an atomic module. A loupe button now opens the viewer over the curtain visualization. The viewer shares the Estimate layout (full-width card, optional helper overlay slot, back button below the image) and respects motion tokens. Follow-up iteration will add pinch‑to‑zoom and pan interactions on the curtain preview. (Refs: `packages/ui/src/components/fullscreen-photo-viewer.tsx`, `apps/web/components/ui/FullscreenPhotoViewer.tsx`, `apps/web/app/estimate/components/HeroSurface.tsx`, `apps/web/app/configure/components/HeroSurface.tsx`)
- 885: Curtain rendering pass 2: lighting, shadows, realistic materials.
- 885a: DONE (2025-10-28) — Fixed pleat ramp orientation/occlusion sampling and boosted noise response so tokens pipeline renders vertical pleats with visible grain. (Refs: `apps/web/lib/canvas-renderer/pipelines/tokens.ts`, `apps/web/lib/canvas-renderer/pipelines/translucent.ts`)
- 885b: DONE (2025-10-28) — Added pleat jitter sampling with eased envelopes so pleat ramps, occlusion, and translucency masks drift like real drapery, plus live debug control for rapid tuning. (Refs: `apps/web/lib/canvas-renderer/pipelines/tokens.ts`, `apps/web/lib/canvas-renderer/pipelines/translucent.ts`, `apps/web/lib/canvas-renderer/pleat-utils.ts`, `apps/web/app/configure/components/DebugControls.tsx`)
- 885c: DONE (2025-10-29) — Refined pleat jitter seeds and vertical envelopes for more organic folds, precomputed pleat sample grids shared across ramps/occlusion/transmission, and cached pleat noise seeds to cut render thrash when scrubbing debug sliders. (Refs: `apps/web/lib/canvas-renderer/pleat-utils.ts`, `apps/web/lib/canvas-renderer/pipelines/tokens.ts`, `apps/web/lib/canvas-renderer/pipelines/translucent.ts`)
- 885d: DONE (2025-10-31) — Rebuilt the flex pleat generator as a 2.5D fold model so `pleatRamp`, `occlusion`, `translucencyMask`, and the new `normal` map stay phase-aligned while preserving the X-pinched header across scales. (Refs: `scripts/generate-flex25d.mjs`, `public/textures/canvas/flex25d/*`, `docs/FLEX-PLEATING-TEXTURES.md`)
- 885e: PARTIAL (2025-10-31) — Wired artist-authored pleat pipeline behind `NEXT_PUBLIC_EXPERIMENTAL_TEXTURES=artist`, added wall-aligned tiling offsets, and prepped Blender docs/specs for `wave-drape`, `wave-sheer`, `flex`, and `double-flex` map drops. **Mock textures now available** via `npm run textures:mock` for testing (16 placeholder PNGs). Pipeline testable; waiting on final photorealistic textures from artist. (Refs: `apps/web/lib/canvas-renderer/pipelines/artist.ts`, `apps/web/app/configure/components/CanvasCurtainLayer.tsx`, `scripts/generate-mock-artist-textures.mjs`, `blender/*`, `docs/MOCK-ARTIST-TEXTURES.md`, `docs/ARTIST-PIPELINE-TESTING.md`)
- 885f: DONE (2025-11-04) — Hardened the artist canvas pipeline for production: added render request guards to prevent stale textures from racing in, made width-only drags re-use cached tiles with a scaled-tile memo, and introduced deterministic noise seeding so repeated renders stay visually stable. Cache fingerprints now include background signatures and wall-box bounds when transmission is active, preventing stale wall blends after image changes. (Refs: `apps/web/app/configure/components/CanvasCurtainLayer.tsx`, `apps/web/lib/canvas-renderer/render-cache.ts`, `apps/web/lib/canvas-renderer/pipelines/artist.ts`, `apps/web/lib/canvas-renderer/key-utils.ts`, `apps/web/app/configure/hooks/useRenderPreWarming.ts`)
- 885g: PARTIAL (2025-11-04) — Curtain-first flow: `/configure` now reuses the customer polygon to re-run AI #1; measurement prompts log progress and surface failures inline, and curtain-box cm are derived from AI #1 wall cm via bbox fractions guarded by the mask height ratio heuristic (`MASK_HEIGHT_RATIO_MIN/MAX`) with detailed geometry logging in Measurement Diagnostics. Further accuracy work (EXIF, ensembles, provider tuning) remains pending. (Refs: `apps/web/app/configure/page.tsx`, `apps/web/lib/flow-state.ts`, `apps/web/lib/measurement-observer.ts`, `project planning/NEW-FLOW-PLAN.md`)
  - 885g.1: DONE (2025-11-08) — Captured AI #1 measurement responses with polygon + prompt context and exposed a local diagnostics panel for analysis. Logs persist in-browser (40 entry ring) and export via debug UI. (Refs: `apps/web/lib/measurement-observer.ts`, `apps/web/app/configure/components/MeasurementDiagnosticsPanel.tsx`, `apps/web/app/configure/page.tsx`)
- 887: DONE User flow: estimation → configurator → checkout.

## 890 — Experiments (Measurement CV) — MOVED TO BRANCH
**Status:** All experimental local CV measurement code (tasks 891-899) has been **moved to `experimental/local-cv` branch** to restore core segmentation performance. See `EXPERIMENTAL-LOCAL-CV.md` for details.

**Reason:** Experimental code caused 10x performance regression (4s→40s segmentation) and system instability. Core AI #2 segmentation is paramount.

**Resolution (2025-09-30):**
- Created `experimental/local-cv` branch preserving all work from commits `56eb5da..0a2f2fd`
- Restored `main` branch to clean segmentation-only service (968→393 lines, 59% reduction)
- Kept `/segment` and `/segment-batch` endpoints (core functionality)
- Removed `/measure` endpoint and all A4/CV dependencies from main
- Performance restored: expected 4s segmentation on GPU

**Experimental branch contents:**
- 891-899: All local CV measurement tasks (DONE/PARTIAL status preserved on branch)
- A4-based wall measurement with perspective rectification
- HEIC/EXIF support, benchmark scripts, debug payloads
- Reference: `EXPERIMENTAL-LOCAL-CV.md`, `experimental/local-cv` branch

**To use experimental features:**
```bash
git checkout experimental/local-cv
docker-compose up segmentation
```

**Future work:** Consider separate microservice for measurement when production-ready.

## 900 — Measurement Accuracy Quick Wins (VLM Improvements)
**Status:** PARTIAL — Prompt improvements DONE, EXIF integration PENDING  
**Date:** 2025-10-01

**Goal:** Improve VLM measurement accuracy from 11-15% error to <10% (target 5-8%)

**Completed:**
- ✅ **Task 900.1:** Enhanced VLM prompt with chain-of-thought reasoning
  - Added explicit 4-step reasoning structure
  - Listed concrete reference objects (doors: 200cm, windows: 120-150cm, outlets, switches)
  - Added typical room constraints and perspective awareness
  - **Result:** GoogleAI improved from 16.8% → **12.0% avg error** (4.8% improvement)
  - **Files changed:** `packages/core/src/services/measure.ts`
  - **Benchmark:** 3 out of 6 images now ≤10% error with GoogleAI

**Pending:**
- ⏳ **Task 900.2:** EXIF focal length integration (safe path using exifr library)
  - Extract camera FOV from EXIF metadata
  - Pass actual FOV to VLM instead of assuming 72°
  - Expected: additional 1-3% error reduction for photos with EXIF
  - Time cost: +300-700ms (under 3s budget)
  - **Safe:** No OpenCV, uses existing `exifr` infrastructure from `measureNoReference.ts`
  - **Design:** See `project planning/901-EXIF-Integration-Strategy.md`

- ⏳ **Task 900.3:** Multi-model ensemble averaging
  - Call GoogleAI + Qwen in parallel
  - Average results when they agree within 10%
  - Expected: 2-3% error reduction when models converge
  - Time cost: 0ms (parallel execution)

**Phase 2 (Future - requires +2-3s budget):**
- Depth estimation with Depth-Anything V2 (standalone service)
- Background segmentation using existing Mask2Former
- Target: ±5-7% error

**References:**
- `project planning/900-Accuracy-Quick-Wins.md` — overview and roadmap
- `project planning/901-EXIF-Integration-Strategy.md` — EXIF safety analysis


## 950 — Storefront Integration & Parent-Child Communication
**Status:** PENDING (2025-10-10)  
**Goal:** Enable Curtain Wizard iframe to communicate with parent Magento storefront for product data and cart operations.

**Summary:**
- Parent-child iframe communication via `postMessage` (secure cross-origin messaging)
- Actions: `getProductList`, `getProducts`, `getPriceQuote`, `addToCart`
- Storefront catalog provider fetches products from Magento parent
- Pricing calculated in Curtain Wizard using parent product prices
- Security: origin checking, message ID correlation, timeout handling

**Tasks Completed:**
- 951: Parent bridge communication layer (`callParent`)
- 952: Storefront catalog provider implementation
- 953: Environment configuration (origin, timeout)
- 954: Mock parent for local testing
- 955: Integration with configure page and cart API

**Completed:**
- ✅ **Task 956:** Adjust Cart API to support Magento GraphQL payload with parent_sku/child_sku/qty structure
- ✅ **Task 957:** Parent/Child SKU's for Fabric (parent SKU) and Color options (child SKU)
  - Added `colorSkuByColor` mapping to Fabric type and mock data
  - Updated `StorefrontCartItem` with optional `childSku` field
  - Modified `toCartPayload()` in both mock and storefront providers to populate childSku from color selection
  - Updated Magento GraphQL mutation builder to use `parent_sku`, `child_sku`, and `qty` fields
  - **Files changed:**
    - `packages/core/src/catalog/types.ts` — Added colorSkuByColor and childSku fields
    - `packages/core/src/catalog/mock/data.ts` — Added color SKUs for all fabrics (e.g., CW-FAB-LINEN-300-SAGE)
    - `packages/core/src/catalog/providers/mock.ts` — Updated toCartPayload with childSku and fabric quantity logic
    - `packages/core/src/catalog/providers/storefront.ts` — Updated toCartPayload with childSku and fabric quantity logic
    - `packages/core/src/catalog/storefront/types.ts` — Added colorSkuByColor to StorefrontProduct attributes
    - `packages/core/src/catalog/storefront/mappers.ts` — Map colorSkuByColor from storefront products
    - `packages/clients/src/magento.ts` — Updated buildAddToCartMutation to use parent_sku/child_sku/qty structure
- ✅ **Task 958:** Add ordered Fabric quantity (qty) to Cart API using formula: 1cm = 0.01qty
  - Cart payload now uses `totalLinearCm * 0.01` as quantity (e.g., 450cm = 4.50 qty)
  - Mock provider calculates from quote metadata
  - Storefront provider requests quote from parent and extracts totalLinearCm
  - Fallback to segment count if totalLinearCm unavailable
- ✅ **Task 959:** Restore mock catalog compatibility with Magento child items
  - Mock fabrics now include `childItems` entries derived from existing `colors` + `colorSkuByColor`
  - Configure UI guards against missing child variants when preloading textures
  - `useCatalogOptions` builds child items when a provider only returns color arrays so storefront data remains untouched
  - References: `packages/core/src/catalog/mock/data.ts`, `apps/web/app/configure/hooks/useCatalogOptions.ts`, `apps/web/app/configure/page.tsx`, `apps/web/app/configure/components/FiltersPanel.tsx`
- ✅ **Task 960 (2025-10-30):** Align storefront filter availability with Magento data
  - Extended catalog color categories with `intensive`, `natural`, and `brown`, and normalized child variant metadata so swatches carry their categories.
  - Configure filters now hide style/color chips that would produce empty fabric lists, eliminating “No fabrics” on valid selections and keeping storefront + mock behaviour identical.
  - References: `packages/core/src/catalog/types.ts`, `packages/core/src/catalog/storefront/{mappers.ts,types.ts}`, `apps/web/app/configure/hooks/useCatalogOptions.ts`

**Configuration:**
```bash
CATALOG_PROVIDER=storefront
NEXT_PUBLIC_STOREFRONT_ORIGIN=https://www.zaslony.com
NEXT_PUBLIC_STOREFRONT_TIMEOUT_MS=30000
```

**Testing:**
- Local: `window.__startParentMock()` in browser console
- Real Magento: `node scripts/test-storefront-connection.mjs`

**Reference:** `docs/Storefront-Integration.md` — Complete integration guide

## 1000 — Cleanup & Perf
- 1001: DONE — Removed `(deprecated) ZaslonAIzer` directory (all client-side depth/seg + ORT assets) and updated docs/scripts so only the shared packages remain referenced.
- 1002: DONE — Pruned MMSeg/UPerNet from Python service (Mask2Former-only).
- 1003: DONE — Deleted `(deprecated) curtain-visualizer` workspace, along with its lockfiles/deps, and pointed all `seg:*` scripts exclusively at `services/segmentation`.
- 1004: is it efficient for the snap to be computed on every drag? 
- 1005: DONE (2026-01-09) — Configure page atomic refactor work is shipped for iteration: curtain-first route shell + shared hooks + curtain-first orchestrator atomization (debug stack, stitch lines UI, lighting, texture-preview-disabled, add-to-cart/coverage flow). Summary panel now respects `NEXT_PUBLIC_SUMMARY_FIELDS` (including `services`) and shows services as a count (details remain in breakdown) per `docs/SUMMARY-PANEL-SPEC.md`. Plan: `project planning/1005-Configure-Page-Atomic-Refactor-Plan.md`.
- 1005f: DONE (2026-01-08) — Curtain-first atomization: extracted Add-to-Cart + coverage warning flow into `apps/web/app/configure/hooks/useCurtainFirstAddToCart.ts` and wired it into `apps/web/app/configure/CurtainFirstConfigureOrchestrator.tsx`.
- 1005g: DONE (2026-01-09) — Curtain-first atomization: extracted debug stack, stitch lines UI, lighting, and texture-preview-disabled utilities into dedicated hooks/components; orchestrator now consumes `useCurtainFirstDebugUi`, `useCurtainFirstStitchLinesUi`, `useCurtainFirstLighting`, `useCurtainFirstTexturePreviewDisabled`, and `CurtainFirstDebugStack`.
- 1005a: DONE — Prepared atomic refactor implementation plan for `/configure/page.tsx` (Curtain-first + artist pipeline, legacy/CSS isolated but preserved) in `project planning/1005-Configure-Page-Atomic-Refactor-Plan.md` (no behaviour change yet).
- 1005b: Curtain renderer performance plan for artist pipeline on `/configure` prepared in `project planning/1005-Curtain-Renderer-Performance-Plan.md` (pre-refactor renderer-only optimizations + post-refactor integration steps).
 - 1005c: Implement shared layout shell sticky behaviour for `/configure` (desktop + mobile) per `AGENTS.md` and `1005-Configure-Page-Atomic-Refactor-Plan.md` Phase 2: `useSmartSticky` tracks the Hero stuck state, keeps a single scroll root, and avoids `vh`-based offsets or nested scroll containers.
 - 1005d: Desktop layout parity — ensure two-column layout with Hero in the left column and Configurator in the right column; Hero pins at the top, and `CollapsibleSummary` is attached to the Hero block (collapsed by default showing thumbnail + Total + Add to Cart; expands via `NEXT_PUBLIC_SUMMARY_FIELDS`).
 - 1005e: Mobile layout parity — ensure single-column layout (Hero → Configurator → Summary) where Hero sticks at the top and everything below scrolls under it; Summary remains the full `SummaryPanel` at the end of the flow (no nested scroll roots or `overflow-hidden` traps that break natural scrolling).
- 1006: Final performance pass: remove unnecessary debug logging, hide all UI debugs behind NEXT_PUBLIC_CONFIGURE_DEBUG_UI env flag.
- 1007: DONE (2025-09-30) — Segmentation performance restored by splitting experimental CV code to separate branch. Core service reduced from 968→393 lines (59%). Removed opencv-python-headless from requirements.txt (EXIF processing overhead eliminated). Expected latency: <5s on M-series GPU. Reference: commits `e3415d2`, `f87a536`; `EXPERIMENTAL-LOCAL-CV.md`.
- 1008: DONE (2025-11-02) — Artist pipeline weave blend mode toggle adds Multiply/Overlay options to stop fabric brightening. Includes debug control select and cache key update so renders stay deterministic. Refs: `apps/web/lib/canvas-renderer/pipelines/artist.ts`, `apps/web/app/configure/components/DebugControls.tsx`, `apps/web/lib/canvas-renderer/render-cache.ts`.
 - 1011: DONE (2025-11-05) — Added support for artist `depth.png` height maps. Pipeline applies optional relief darkening and Designer Preset Editor gains a Pleating slider “Height Map Strength” for QA. Updated docs and runbook. Refs: `apps/web/lib/canvas-renderer/{artist-textures.ts,asset-loader.ts,pipelines/artist.ts,types.ts}`, `apps/web/app/configure/components/DebugControls.tsx`, `docs/ARTIST-PIPELINE*.md`, `README.md`, `project planning/04-Development-Plan.md`.
- 1009: DONE (2025-11-02) — Transmission blur counter-rotates under the mask so the background stays anchored while top handles tilt the curtain. Refs: `apps/web/app/configure/components/CanvasCurtainLayer.tsx`, `apps/web/app/configure/page.tsx`.
- 1012: DONE (2025-11-08) — Added `blackout-basic` material family wired through presets, pleating/color overrides, mock catalog, and docs so both mock + storefront providers can load the new `blackout-basic-weave` asset. Refs: `apps/web/lib/canvas-renderer/{material-presets.ts,color-presets.ts,pleating-presets.ts,types.ts}`, `packages/core/src/catalog/{types.ts,mock/data.ts}`, `apps/web/lib/canvas-renderer/README.md`, `docs/{PHASE-2-TESTING-CHECKLIST.md,ARTIST-PIPELINE-MIGRATION.md,GRAYSCALE-REMOVAL-SUMMARY.md,RUNBOOK.md}`, `README.md`, `project planning/04-Development-Plan.md`.

## 1100 — Observability & Docs
- 1101: pino logger, request IDs, timing in adapters and core.
- 1102: Add QA page `/debug/seg` for previewing diagnostic layers (dev only).
- 1103: Write RUNBOOK covering GPU service, envs, and fallback policy.
