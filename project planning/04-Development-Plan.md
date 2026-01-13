# Curtain Wizard — Development Plan (Phased)

This plan assumes a Next.js BFF now, split-ready via `packages/core` and `packages/clients` from day one.

## Phase 0 — UI Platform Foundation *(in progress)*
- Stand up `packages/ui` per `docs/DESIGN-SYSTEM-IMPLEMENTATION-PLAN.md` so palette/motion tokens and atomic components live outside `apps/web`.
- Export generated tokens into Tailwind + CSS to eliminate globals divergence; enforce via CI check.
- Provide Storybook/Ladle previews so the Principal Designer can validate UI/UX Overhaul work before integration.
- Toggle + NumericInput ships from the kit (prefers-reduced-motion aware) and `/configure` uses the shims for the segments control + services toggles.
- Adapter strategy: `apps/web/components/ui` re-exports kit components so app code imports a single surface.
- Exit criteria: Configurator shared surfaces render via the kit, automation handles (`data-cw-*`) exist, and the renderer pipeline stays on `artist`.

## Phase 1 — Monorepo & Imports
- Scaffold `apps/web`, `services/segmentation`, `packages/{core,clients,shared}`.
- Import ZaslonAIzer UI, actions, and assets into `apps/web`.
- Import Node segmentation pipeline (`lib/segmentation.ts`) and adapt to the RAW-first flow.
- Import FastAPI Mask2Former service (only) into `services/segmentation`.
- Once merged, remove the legacy `(deprecated)` PoC folders so contributors only touch the Turborepo workspaces and services/segmentation.

## Phase 2 — AI #1 (Genkit) Provider Switch
- Add provider routing (GoogleAI default, OpenAI alternative) via env.
- Tighten prompt + JSON schema validation. Add retry + timeouts.

## Phase 3 — AI #2 (GPU Mask2Former) & Fallbacks
- Expose `/healthz` and RAW per-class mask endpoints on FastAPI; Dockerize with GPU.
- Implement `SegmentationService` to:
  1) Call local FastAPI and fetch RAW wall/window/attached.
  2) Fallback to HF Mask2Former; synthesize RAW.
  3) Fallback to HF SegFormer; derive labels.
- Post-process only in Node using env parameters. No server thresholds.

## Phase 4 — API Routes & UI Wiring
- `/api/measure` → `MeasureService` (Genkit).
- `/api/segment` → `SegmentationService` → final PNG alpha.
- Wire Estimation Wizard and Configurator to the endpoints. Keep “Upload mask” debug option.
- Clamp configurator wall boxes and panel drags to fabric-derived maxima so users see a toast instead of provider errors when a fabric can’t support the requested dimensions.
- Store the configurator wall-box baseline as normalized ratios (`baseBoxRatio`) so resizing the hero/viewport after marking the wall never changes centimetre outputs or pricing. QA guidance added to the Phase 5 docs and RUNBOOK (Task 865).
- Provide a production-safe `NEXT_PUBLIC_STITCH_LINES_ENABLED` flag so seam guides can be hidden without enabling the Debug UI (Task 865a).
- Expose the FastAPI `/measure` CV path via a thin Node client (`measureLocalCV`) for local testing.
- `/api/measure` schema now honours `provider: 'localcv'` and forwards optional local overrides.
- Local CV pipeline rectifies the wall plane using the detected A4 sheet; guardrails via `MEASURE_RECTIFY_ENABLED` and percentile trims keep the change reversible.
- Clamp the filtered wall mask between detected ceiling/floor bands so the blue polygon stays on the opposite wall; expose env toggles (`MEASURE_WALL_CLAMP_ENABLED`, `MEASURE_WALL_CLAMP_MARGIN_PCT`) for tuning.
- HEIC uploads convert automatically via client `heic2any` with a `/api/convert-heic` (`heic-convert`) server fallback, and the Estimate picker ignores stale in-flight conversions so rapid reselection never restores the previous photo.
- When the GPU service is unreachable, HF fallbacks automatically downscale and recompress uploads (`SEG_FALLBACK_LONG_SIDE`, `SEG_FALLBACK_JPEG_QUALITY`, `SEG_FALLBACK_MAX_BYTES`) so remote inference never receives multi-megabyte HEIC-to-JPEG conversions, and the API surfaces the resized byte size via `X-Input-Bytes`.
- Magento storefront rollout introduced per-color child SKUs; the mock catalog now mirrors this by deriving `childItems` from its color list so local development (`CATALOG_PROVIDER=mock`) remains in lockstep with production data structures.
- Harden A4 detection by excluding window pixels from the search mask, rejecting undersized quads, dropping glass-heavy candidates, surfacing candidate scores in debug payloads, and auto-falling back to a no-penalty search when the paper lives entirely on glass.
- Measurement benchmark script (`scripts/measure-benchmark.mjs`) exercises the BFF for local tuning, timing capture, and optional ground-truth error reporting. It now accepts `--provider noreref` and surfaces confidence/warning columns for the experimental flow.
- Experimental no-reference provider (`provider: 'noreref'`) lives in `packages/core`. It reuses segmentation outputs, EXIF-derived focal length, and gradient fallbacks to estimate scale, returning `confidencePct`, warnings, and debug payloads. Tunables live in env (`MEASURE_CAMERA_HEIGHT_CM`, `MEASURE_DEFAULT_FOV_DEG`), and the option stays behind the debug dropdown in `apps/web`.
- Validation rule of thumb: only trust centimetre outputs when the filtered wall mask (blue outline) isolates the opposite wall and the A4 sheet is detected—use the debug bundle to verify both before tuning numbers.

## Phase 5 — Storefront Stub & Observability
- Add Magento GraphQL client placeholder; simple SKU query example.
- Add pino logger and request IDs; minimal metrics and timing.

## Phase 6 — Cleanup, Perf, and Docs
- Carefully remove client-side depth/seg, ORT assets, MMSeg code paths and their dependencies.
- Author RUNBOOK: GPU setup, Docker, envs, fallback policy, parameter tuning.
- Add a small `/debug/seg` page for QA (optional in production).
- Performance pass (late stage): target end‑to‑end segmentation latency < 5s on M‑series Macs with default settings. Defer until features are stable; use benchmarks to guide changes (pre‑resize, warmup, model/device tuning, I/O overlap).
- Ensure segmentation cache writes stay awaited even after UI optimisations so `/configure` can restore offline; update docs whenever the cache flow changes.
- Canvas renderer iteration (2025-10-29): cache per-pleat jitter seeds, precompute pleat sample grids shared by ramp/occlusion/translucent passes, and rebalance the vertical envelope so the curtain header stays taut while the hem meanders organically.
- Flex pleat texture generation (2025-10-31): `scripts/generate-flex25d.mjs` now treats a Flex fold as a 2.5D model, producing aligned tone, AO, translucency, and normal maps (served from `public/textures/canvas/flex25d/`) so the X-pinched header and belly bloom stay consistent without hand-painted assets.
- Artist pipeline scaffolding (2025-11-01): front-end recognises `NEXT_PUBLIC_EXPERIMENTAL_TEXTURES=artist`, selects `wave-drape` vs `wave-sheer` automatically based on material family, and tiles using wall-aligned offsets while falling back to the token renderer until the artist delivers final PNGs (`apps/web/lib/canvas-renderer/pipelines/artist.ts`, `blender/ARTIST-BRIEF*.md`).
- Artist weave blending (2025-11-02): Multiply is now the default mix for artist weave textures, with an Overlay fallback exposed through the Debug drawer to keep fabrics from washing out during QA tuning (`apps/web/lib/canvas-renderer/pipelines/artist.ts`, `apps/web/app/configure/components/DebugControls.tsx`).
- Artist pipeline hardening (2025-11-04): Canvas renderer now defends against stale async renders, reuses memoised tile canvases on width-only drags, and fingerprints cache entries with background signatures so sheer blends refresh when the hero photo changes. Noise seeding is deterministic to stop flicker between renders (`apps/web/app/configure/components/CanvasCurtainLayer.tsx`, `apps/web/lib/canvas-renderer/render-cache.ts`, `apps/web/lib/canvas-renderer/pipelines/artist.ts`, `apps/web/lib/canvas-renderer/key-utils.ts`).
- Material family sync (2025-11-08): Added `blackout-basic` presets + weave assets to `apps/web/lib/canvas-renderer/material-presets.ts` and both catalog providers so Premium 280 blackout fabrics load the coated weave in mock and storefront flows.
- Curtain-first integration (2025-11-05): `/configure` triggers AI #1 with the selected polygon, logs progress, and surfaces inline errors; accuracy tuning pending. (`apps/web/app/configure/page.tsx`, `apps/web/lib/flow-state.ts`, `project planning/NEW-FLOW-PLAN.md`)
- Curtain-first diagnostics (2025-11-08): AI #1 responses now persist locally with polygon coverage stats and prompt snapshots; designers can export or clear entries from the configure debug drawer to accelerate accuracy reviews. (`apps/web/lib/measurement-observer.ts`, `apps/web/app/configure/components/MeasurementDiagnosticsPanel.tsx`)
- Curtain-box measurement guard (2025-11-20): `/configure` derives curtain-box cm from the AI #1 wall result using bbox fractions and optional wall mask vertical bounds; a hard `MASK_HEIGHT_RATIO_MIN/MAX` guard falls back to full-frame height fractions when the mask would overcorrect height, and Measurement Diagnostics now records a secondary observation (`source: 'configure-box'`) with geometry summaries and mask warnings for tuning. (`apps/web/app/configure/page.tsx`, `project planning/NEW-FLOW-PLAN.md`, `README.md`)

- Curtain-first Measurement Pipeline — Stage 1 (2025-11-24): `/estimate` in `new` flow now segments on upload only, triggers AI #1 measurement from the confirmed curtain polygon, and uses a versioned measurement cache key that incorporates the photo signature, polygon hash, flow mode, and provider/model. The user‑confirmed cm and curtain polygon are stored in FlowState and handed off to `/configure`, which treats this FlowState measurement as the single source of truth (no additional `/api/measure` calls in production curtain-first flow). Measurement Diagnostics records the cache key alongside polygon and prompt metadata for each estimate. (Refs: `apps/web/app/estimate/page.tsx`, `apps/web/app/configure/page.tsx`, `apps/web/lib/flow-state.ts`, `apps/web/lib/measurement-cache.ts`, `apps/web/lib/measurement-observer.ts`, `project planning/Measurement-Pipeline-Overhaul.md`)

## Split-Ready Practices Throughout
- Business logic in `packages/core`; API routes are thin.
- Typed clients in `packages/clients` for Python service and HF.
- Shared env schema in `packages/shared`.

## Success Criteria
- Upload → measure → segment → layered preview works locally with GPU.
- HF fallbacks work with clear logs and timeouts.
- Clean repo without obsolete PoC code; docs enable a fresh dev to run stack in <30 minutes.

## UI/UX Overhaul Prep (2025-10-18)
- Stage 2 inline-style cleanup is underway: static layout/colour styling on Configure + Estimate now uses Tailwind; remaining inline styles are geometry-only.
- Range slider + confirmation modals moved to shared utilities; docs (`UI-PREP-QUICKSTART.md`, `MIGRATION-STATUS.md`) outline next steps for token alignment and component extraction.
- Configurator shell (`ConfiguratorLayout.tsx`), summary panel (`SummaryPanel.tsx`), debug tools (`DebugControls.tsx`), and services list (`ServicesSection.tsx`) now live in dedicated components under `apps/web/app/configure/components/`; remaining sidebar filters will be modularised after token alignment and all copy flows through the shared i18n catalog.
- Desktop hero lock (Task 884d, 2025-10-25): `/estimate` and `/configure` now share the 768×576 hero frame (`cw-hero-shell`). `ConfiguratorLayout` keeps the glass card compact until the wall box is confirmed, then animates to `max-w-[1380px]` so the hero slides left—same size—while the configurator panel appears. Docs updated with QA expectations (`docs/UI-UX_Overhaul/Phase-5-Revised-Design.md`, `docs/UI-UX_Overhaul/Phase-5-Implementation-Summary.md`, `docs/RUNBOOK.md`).
- Summary column & single scroll (Task 884e, 2025-10-25): Desktop summary sits directly under the sticky hero (same width) and the configurator panel no longer runs its own scrollbar; page scroll now drives the experience. A follow-up smart-sticky refinement keeps the Summary “Total” row and Add to Cart button visible under the hero while the right column continues scrolling. (`apps/web/app/configure/page.tsx`, `apps/web/app/configure/components/FiltersPanel.tsx`).

## Storefront Catalog Alignments (2025-10-30)
- Catalog color filters now cover the full Magento palette (`bright`, `grey`, `dark`, `colored`, `patterned`, `intensive`, `natural`, `brown`) and dynamically hide style/color chips that would produce empty results. Providers (mock + storefront) share the same availability logic so QA parity holds. (Refs: `apps/web/app/configure/hooks/useCatalogOptions.ts`, `packages/core/src/catalog/types.ts`)
- Storefront mapper normalizes child variant metadata (labels, per-color categories, texture thumbnails) so swatches respect the active filter without leaking unavailable colors. (Refs: `packages/core/src/catalog/storefront/mappers.ts`)

## Upcoming — Configure Page Atomic Refactor (Task 1005)
- Status: DONE (2026-01-09) — see `project planning/1005-Configure-Page-Atomic-Refactor-Plan.md`.
- Goal: Reduce `apps/web/app/configure/page.tsx` to an orchestration layer (~800–1200 lines) for the curtain-first flow, and keep the artist pipeline as the supported renderer.
- Scope (no immediate behaviour change):
  - Extract sticky hero tracking, navigation guards, and texture/image preload logic into shared hooks for both flows.
  - Introduce a slimmer Curtain-first orchestrator that delegates to feature modules and existing components, with exhaustive tests before any flag flips or legacy/CSS retirement.
