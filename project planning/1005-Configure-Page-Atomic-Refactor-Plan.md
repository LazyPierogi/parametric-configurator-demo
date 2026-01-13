# Task 1005 — `/configure/page.tsx` Atomic Refactor Plan (Curtain‑First, Artist Pipeline)

**Status:** In progress (Curtain-first route shell is thin/new-only; curtain-first orchestrator is still monolithic)  
**Owner:** Engineering + Principal Designer  
**Related docs:**  
- `project planning/1005-REFACTOR-STRATEGY-ENHANCED.md` (high‑level architecture)  
- `project planning/NEW-FLOW-PLAN.md` (Curtain‑first flow)  
- `project planning/PERFORMANCE-OPTIMIZATION.md` (segmentation perf)  
- `docs/SUMMARY-PANEL-SPEC.md` (Summary behaviour + `NEXT_PUBLIC_SUMMARY_FIELDS`)  
 - `project planning/1005-Curtain-Renderer-Performance-Plan.md` (canvas/artist renderer perf)

---

## 1. Goals & Guardrails

### 1.1 Objectives
- Reduce the curtain-first configure **orchestrator** (currently `ConfigurePageContent` in `apps/web/app/configure/LegacyConfigurePage.tsx`) from ~3.5k lines to **~800–1200 lines**:
  - Route composition & providers  
  - Layout shell & providers  
  - Wiring into shared hooks and feature modules  
- Keep **Curtain‑first + artist pipeline** as the **only supported** `/estimate` → `/configure` path.
- Improve **runtime performance** and diagnosability:
  - Throttled scroll/resize for sticky hero tracking.
  - Safer image/texture loading with cancellation.
  - Fewer global `setState` calls from scroll/resize and hover.
- Make the configurator **testable in isolation** (per‑feature hooks/components) without touching the entire page tree.

### 1.2 Hard Constraints
- Renderer pipeline stays on `artist` (no CSS renderer path in the supported configure flow).
- Curtain-first flow must remain the single source of truth for wall/curtain measurement.
- Do not break:
  - `CanvasCurtainLayer` semantics (render caching, texture tiling, render guards).
  - Dynamic texture positioning (pixel math for `backgroundSize`/`backgroundPosition`).
  - Storefront bridge (Options & Pricing panel, parent iframe messaging).
  - Layout rules for `/estimate` and `/configure` (no `h-screen` / `100vh`, single scroll root, Hero sticky owned by the configure layout shell, and desktop Summary uses the compact `CollapsibleSummary` attached to the Hero).
- All new UI surfaces go via `packages/ui` + shims; this plan only **reorganizes** configurator logic and the shared Sticky Hero + Summary shell (no brand‑new visual primitives in `apps/web`).

---

## 2. High‑Level Strategy

The existing Task 1005 strategy introduces a full **features/** layer and reducer-based state machine. This plan refines it for an **atomic, low-risk rollout** focused on:

1. **Flow separation without behaviour change** — put legacy and new flows behind distinct modules so the Curtain-first + artist path can be optimized without touching legacy.
2. **Sticky hero + global effects isolation** — extract scroll/resize/beforeunload/popstate listeners into a dedicated hook with throttling/guards. ✅ Hooks landed (`useSmartSticky`, `useConfigureGuards`).
3. **Texture pipeline + image loading isolation** — move cache/prime/preload logic out of the page component and add cancellation.  ✅ `useTexturePreload` with AbortController/LRU shipped.
4. **Curtain-first orchestrator** — introduce a slimmer page for the `new` path that delegates to feature modules and the existing canvas/summary components.
5. **Retiring legacy & CSS paths** — remove dead code and docs as the new-only flow stabilizes.

Each step is designed to be shippable in a small PR with feature flags preserved and an easy rollback path.

---

## 3. Phase 0 — Baseline & Safety Net

**Goal:** Capture current behaviour and performance so regressions are easy to spot.

- Record current `configure` behaviour for the curtain-first flow with the artist pipeline.
- Capture:
  - Screenshots of hero + Summary and sticky transitions (desktop), plus full mobile scroll.
  - React Profiler snapshot for `/configure` (upload → mark → configure → add to cart).
  - Notes on known issues (mask heuristics, furniture occlusion, etc.) so we don’t mis‑attribute them to refactor work.
- Add a short “pre‑refactor” note to `project planning/1005-REFACTOR-STRATEGY-ENHANCED.md` pointing at this atomic plan.

**Exit criteria:**
- Documented baseline for hero/summary sticky, canvas interactions, and curtain‑first measurement behaviour.
- Easy manual scenario list for QA to replay after each phase.

---

## 3.1 Risks & Watchpoints

- **Hook ordering / Suspense & SSR**
  - Flow split must preserve the relative ordering of hooks inside the configure tree; new wrappers around `ConfigurePageContent` cannot introduce conditional hooks or re‑mount inner components in a way that double‑registers effects.
  - After Phase 1, verify in dev tools that:
    - Global listeners (scroll/resize, beforeunload, popstate) are attached once per mount.
    - Suspense/SSR hydration does not cause duplicate mount/unmount cycles for the core page node.
- **Sticky fidelity**
  - The configure layout shell must:
    - Own Hero sticky behaviour (with light `requestAnimationFrame` throttling).
    - Only call `setHeroStuck` when the stuck boolean actually changes to avoid extra renders.
    - Preserve layout composition rules (desktop two-column vs mobile single-column) without introducing nested scroll roots.
    - Desktop: use `CollapsibleSummary` attached to the Hero block (collapsed by default, expands based on `NEXT_PUBLIC_SUMMARY_FIELDS`).
    - Mobile: keep full `SummaryPanel` as the last section (Hero → Configurator → Summary).
- **Texture pipeline cancellation**
  - New `primeBlobUrl` using `AbortController` must be covered by tests that simulate rapid hover/scroll:
    - No leaked fetches or unhandled rejections when components unmount or URLs change quickly.
    - Cache/LRU eviction behaves as before (no regressions in hover preview responsiveness).
- **Configurator provider churn**
  - When introducing the configurator reducer/provider, use memoized selectors or split contexts so local updates (e.g. a single slider) do not re‑render the entire page.
  - Measure re‑render counts before/after migration for a few hot interactions (segment drag, fabric change).
- **Storefront bridge**
  - `useConfigureGuards` must keep iframe height + `postMessage` logic **single‑instanced**:
    - Only one `ResizeObserver` and height sender active per mount.
    - No duplicate messages on scroll/resize.
  - Embedded `/configure` in storefront must continue to show the Options & Pricing panel and respond to container height changes.

---

## 3.2 Subpage Mode (Iframe Retirement Prep)

- Default posture: `/estimate` and `/configure` run as first‑class subpages (no parent iframe). Embed support becomes **opt‑in**.
- Remove layout‑level iframe bootstrap (StorefrontBridgeInitializer) and gate any remaining `postMessage` height sync or `scrollParent` calls behind an explicit `isEmbed` flag (env + runtime check `window.self !== window.top`).
- Fold embed‑only listeners (`beforeunload`/`popstate` exit traps tied to parent, iframe height postMessage) into `useConfigureGuards` so subpage mode keeps native navigation and natural scroll.
- Storefront data path: prefer direct Magento GraphQL client; keep `parent-bridge` only as a lazy, flagged fallback for legacy embeds. Ensure Options & Pricing continues to render via HTTP when embed is off.
- QA: validate subpage mode on cf.zaslony.com (no parent messaging) and embed regression on legacy container (height updates, pricing) once the guard hook lands.

---

## 4. Phase 1 — Route Shell (Curtain‑First Only)

**Goal:** Ensure `/configure` is a thin curtain-first route shell that composes stable modules.

### 4.1 Split by Flow Mode at the Route Level
- Implemented: `apps/web/app/configure/page.tsx` renders `CurtainFirstConfigurePage` directly.
- Current state:
  - `CurtainFirstConfigurePageContent.tsx` renders `CurtainFirstConfigureOrchestrator.tsx` directly.
  - Curtain-first no longer routes through `LegacyConfigurePage.tsx`.

### 4.2 Guard Texture Pipelines by Flow
- Ensure the configure experience uses the canvas (artist) pipeline:
  - In `CurtainFirstConfigurePage`, hard‑require the canvas (artist) pipeline:
    - `const USE_CANVAS_RENDERER = shouldUseCanvasRenderer(renderPipeline)` with `renderPipeline` chosen from env but defaulting to artist.
    - Short‑circuit any CSS texture paths early in the new flow so they are never touched at runtime.
- This reduces the state space for the new flow to:
  - `flowMode='new'`, `texturesPipeline='artist'`.

**Exit criteria:**
- `page.tsx` acts only as a `Suspense` shell plus curtain-first composition.
- Curtain-first does not depend on `LegacyConfigurePage.tsx` as its implementation module.

---

## 5. Phase 2 — Sticky Hero & Global Effects Isolation

**Goal:** Make scroll/resize/beforeunload/popstate logic self‑contained, throttled, and safe.

### 5.1 Extract Sticky Hero Tracking into a Hook
- `apps/web/app/configure/hooks/useSmartSticky.ts` owns:
  - `heroStickyRef` and `heroStuck` state.
  - Scroll/resize listeners coalesced via `requestAnimationFrame`.
  - `setHeroStuck` only fires when the boolean changes.
- Desktop summary behaviour is now CSS/layout-driven (no JS pinning):
  - `CollapsibleSummary` is attached to the Hero block and therefore moves/sticks identically.
  - Collapsed by default; expands based on `NEXT_PUBLIC_SUMMARY_FIELDS`.
- Mobile continues to use the full `SummaryPanel` rendered after the Configurator.

### 5.2 Extract Navigation Guards & Iframe Height Logic
- Create `apps/web/app/configure/hooks/useConfigureGuards.ts` for:
  - `beforeunload` warning (Curtain‑first flow only).
  - `popstate` interception and exit dialog scheduling.
  - Iframe height postMessage + `ResizeObserver` wiring.
- Ensure:
  - All listeners are registered once per mount and cleaned up on unmount.
  - No dependencies cause effect re‑runs that re‑attach listeners unnecessarily.

**Exit criteria:**
- No scroll/resize logic lives inline in `LegacyConfigurePage` / `CurtainFirstConfigurePage` other than passing refs.
- Sticky behaviour matches the updated spec in `AGENTS.md` (Hero sticky + desktop collapsible summary attached to Hero; mobile full summary at the bottom; single scroll root).
- React re-renders from scroll/resize are minimized (heroStuck only changes when threshold is crossed).

---

## 6. Phase 3 — Texture & Image Loading Isolation

**Goal:** Move image/texture preloading into dedicated hooks with cancellation and reuse across flows.

### 6.1 Extract Image Ensure/Preload
- Create `apps/web/app/configure/hooks/useTexturePreload.ts`:
  - Holds `imgCache` and `addPreload` logic.
  - Exposes `ensureImage(url)` and `ensureImageForLegacy(url)` with identical semantics to the current implementation.
  - Guards:
    - No preload work when using the canvas renderer (artist pipeline).
    - No direct DOM mutations outside controlled helpers.

### 6.2 Extract Blob URL Cache with AbortController
- In the same hook or a second one (`useBlobUrlCache`), move:
  - `blobUrlCacheRef`, LRU eviction, and `getRenderableUrl`.
  - `primeBlobUrl(url, opts?)`:
    - Use `AbortController` for `fetch` so rapid hover changes or route transitions can cancel in‑flight requests.
    - Short‑circuit when the component unmounts.
- Update callers in both flows to use the new hook return values instead of local refs.

**Exit criteria:**
- All texture preload and blob URL logic lives in hooks (no duplication between legacy and new flows).
- `primeBlobUrl` is cancellable and no longer risks leaving hanging fetches on fast hover/scroll.
- No behaviour change for hover previews or texture switching.

---

## 7. Phase 4 — Curtain‑First Orchestrator & Modularization

**Goal:** Slim down the `CurtainFirstConfigurePage` component to 800–1200 lines by delegating to feature modules, reusing the high‑level 1005 strategy.

### 7.1 Adopt Shared Flow Hooks (from Task 1005)
- Under `apps/web/features/flow/hooks/`, introduce:
  - `usePhotoFlow` — upload/validation/signature/preview.
  - `useSegmentationJob` — `/segment` + cache + retry.
  - `useMeasurementJob` — `/measure` + curtain‑first heuristics, FlowState integration.
- Replace in the **Curtain‑first** code path only:
  - Local `file`, `previewUrl`, cache lookup, and measurement orchestration.
  - Keep legacy flow temporarily on the existing in‑page logic to minimize simultaneous changes.

### 7.2 Configurator State Provider for Curtain‑First
- Introduce `apps/web/features/configurator/CurtainFirstConfiguratorProvider.tsx`:
  - Reducer state covers:
    - Workflow phase (`idle` → `segmenting` → `mark` → `ready`).
    - Wall box geometry (corners, base cm, `baseBoxRatio`).
    - Segments, pricing, fabric selection, canvas params.
    - Curtain‑first measurement metadata (`flowMeasurementMeta`).
  - Actions mirror existing implicit transitions (no new behaviour).
- Wrap `CurtainFirstConfigurePage` with the provider and migrate `useState` clusters gradually to reducer state (small PRs).

### 7.3 Component Extraction (Curtain‑First Path)
- Move non‑trivial UI blocks into memoized components under `apps/web/features/configurator/components/`:
  - `CurtainPhotoHero` (hero + wall box overlay wiring into `CanvasCurtainLayer`).
  - `CurtainConfiguratorPanel` (filters, sections, options).
  - `CurtainSummaryShell` (shell around `SummaryPanel` + add‑to‑cart).
- All components:
  - Consume state via context/selectors to avoid re‑rendering unrelated sections.
  - Reuse existing shims from `apps/web/components/ui`.

### 7.4 Transmission Alignment Fix (Hero ↔ Original Photo)
- Goal: Transmission blur must always match what is **actually under a given segment** in the source photo, regardless of viewport scaling (now scaling breaks it!) or HeroSurface layout.
- Implementation:
  - Centralize wall‑box and segment geometry for transmission in a single utility so:
    - `wallBoxPixels` and segment bounds are always computed in original image pixel coordinates.
    - `TransmissionLayer` receives a consistent `backgroundImage` + `wallBox` + `segmentBounds` triplet, and internal scaling is purely from **original image space → canonical canvas**.
  - Audit and correct rotation/transform order:
    - Ensure that the combination of `texOrient.angleRad` rotation on the segment wrapper + `counterRotateRad` in `TransmissionLayer` yields a one‑to‑one mapping of pixels between the rotated hero view and the original wall box slice.
  - Add at least one automated or snapshot test (dev‑only) that:
    - draws a known synthetic background with simple shapes,
    - applies wall‑box + segments,
    - and verifies that transmission under each segment shows the same shapes as in the original background region across desktop + mobile hero configurations.
- Exit criteria:
  - On all supported layouts, the blurred background visible through transmission under a segment corresponds exactly to the same area of the original image that the segment covers (no drift when resizing HeroSurface or changing viewport).

**Exit criteria:**
- `CurtainFirstConfigurePage` is reduced to orchestration (providers + layout + wiring), ~800–1200 lines.
- Legacy configure component remains unchanged apart from shared hooks for sticky/texture/guards.
- Curtain-first flow behaviour (including FlowState restore and diagnostics) is unchanged.

---

## 8. Phase 5 — Legacy & CSS Path Retirement (Post Milestone D)

**Goal:** Once Curtain‑first + artist pipeline is proven, remove dead code without losing the ability to resurrect legacy if needed.

### 8.1 Archive Strategy
- When analytics + QA confirm Milestone D:
  - Snapshot the legacy implementation into:
    - A dedicated `legacy` folder in the repo (e.g. `apps/web/app/configure/legacy/`) **or**
    - A long‑lived Git tag/branch `legacy-configure-202X-YY-DD`.
  - Document how to restore the legacy path in `docs/RUNBOOK.md`.

### 8.2 Code Simplification
- On `main`, after archive:
  - Remove `LegacyConfigurePage` from the route; `page.tsx` simply renders `CurtainFirstConfigurePage`.
  - Remove CSS textures branches and `NEXT_PUBLIC_TEXTURES_PIPELINE` handling from the Curtain‑first path; keep env only for backward compatibility in case storefront needs it.
  - Update New‑Flow docs:
    - `project planning/NEW-FLOW-PLAN.md` — mark “Reversible rollout” as satisfied with archive strategy.
    - `project planning/04-Development-Plan.md` — note flag flip and dead‑code cleanup.
    - `README.md`, `.env.example`, `AGENTS.md`, `RUNBOOK.md` — document that Curtain‑first + artist pipeline is the supported default.

**Exit criteria:**
- Production traffic uses only Curtain‑first + artist pipeline.
- Legacy + CSS code lives only in archive (no longer imported in App Router).

---

## 9. Testing & QA Plan

### 9.1 Automated Tests
- Unit tests:
  - `useSmartSticky` — scroll/resize threshold behaviour and cleanup.
  - `useConfigureGuards` — back‑button and beforeunload guards.
  - `useTexturePreload` / `useBlobUrlCache` — caching, cancellation, and LRU eviction.
  - Configurator reducer — state transitions for upload → segment → mark → ready.
- Integration tests:
  - Curtain‑first flow: upload → segmentation cache hit/miss → polygon confirm → configure → add to cart.
- Where possible, reuse or extend Task 1005 test scaffolding instead of inventing new patterns.

### 9.2 Manual QA Scenarios
- Desktop:
  - Hero + Summary sticky behaviour matches current spec at different viewport widths.
  - Scroll performance remains smooth during fast scroll; no layout thrash.
  - Texture hover and selection still feel instant with artist pipeline.
- Mobile:
  - No sticky hero/summary; page scroll remains natural with no `overflow-hidden` traps.
  - Curtain‑first navigation guards (beforeunload/back) behave as before.
- Storefront:
  - Embedded `/configure` iframe still resizes correctly and shows Options & Pricing.

---

## 10. Success Criteria

- `apps/web/app/configure/page.tsx`:
  - Acts purely as a flow router + shell for providers (after flow split and hook extraction).
  - File length reduced to **~800–1200 lines** combined for both flows.
  - No inline scroll/resize listeners; sticky hero tracking and guards live in shared hooks.
- New Curtain‑first orchestrator:
  - Localized state changes do not re‑render the entire page tree.
  - Scroll/resize handlers are throttled via `requestAnimationFrame` or ~16–32ms timers and do not mutate the DOM when measured values are unchanged.
  - Curtain‑first path is effectively locked to the artist pipeline.
- Measurement + segmentation:
  - Continue to succeed local‑first (upload → measure → segment → curtain preview) with all AI fallbacks intact.
- Documentation:
  - Task 1005 in `project planning/05-Task-List.md` links to this plan.
  - `04-Development-Plan.md` references this refactor as part of the final performance cleanup.

---

## 11. Implementation Status & Next Steps (Jan 2026)

**Done so far (partial atomic rollout):**
- **Curtain-first route shell**: `/configure/page.tsx` renders `CurtainFirstConfigurePage` directly, forcing the artist/canvas pipeline.
- **Shared hooks**: `useSmartSticky`, `useConfigureGuards`, and `useTexturePreload` extracted and wired into the configure implementation.
- **Sticky Hero + Summary (desktop)**: Desktop now uses a sticky Hero with a compact `CollapsibleSummary` attached to the Hero block (collapsed by default; expands based on `NEXT_PUBLIC_SUMMARY_FIELDS`). Mobile continues to render the full `SummaryPanel` below the Configurator.

**Recent work (Jan 2026):**
- **Fat cut #2 (Curtain-first)**: removed the CSS-texture hover/crossfade/preload world from `CurtainFirstConfigureOrchestrator.tsx` (Curtain-first is canvas-only; hero already renders `CanvasCurtainLayer` when active).
- **FiltersPanel hover-preview (Curtain-first)**: added `enableTextureHoverPreview` to `FiltersPanel` and disabled hover preview work in curtain-first (no `ensureImage()` / `setHoverTextureUrl()` calls), while keeping `hoveredChipKey` for scale-on-hover UX.
- **Atomization (Curtain-first)**: extracted debug stack JSX into `apps/web/app/configure/components/CurtainFirstDebugStack.tsx` and moved Debug UI palette/env snippet runtime into `apps/web/app/configure/hooks/useCurtainFirstDebugUi.ts`.
- **Atomization (Curtain-first)**: extracted stitch lines UI state (toggle + timers + opacity) into `apps/web/app/configure/hooks/useCurtainFirstStitchLinesUi.ts`.
- **Atomization (Curtain-first)**: extracted lighting enablement + ROI + `useLightingEstimate` wiring into `apps/web/app/configure/hooks/useCurtainFirstLighting.ts`.
- **Atomization (Curtain-first)**: centralized curtain-first texture preview stubs into `apps/web/app/configure/hooks/useCurtainFirstTexturePreviewDisabled.ts`.
- **Atomization**: extracted shared embed/back plumbing into hooks:
  - `apps/web/app/configure/hooks/useIsEmbed.ts`
  - `apps/web/app/configure/hooks/useConfigureBackEvent.ts`
  and removed duplicated `isEmbed` + `cw-configure-back` listener blocks from both orchestrators.
- **Atomization**: extracted reduced-data detection into `apps/web/app/configure/hooks/useReducedData.ts` and removed duplicated `reducedData` state/effect blocks from both orchestrators.
- **Atomization**: extracted shared formatters into `apps/web/app/configure/lib/formatters.ts` and removed duplicated inline formatter helpers from both orchestrators.
- **Atomization**: extracted Curtain-first `file/preview/phase state machine` (upload → segmenting → mark → ready) into `apps/web/app/configure/hooks/useCurtainFirstPhaseMachine.ts` and updated `apps/web/app/configure/CurtainFirstConfigureOrchestrator.tsx` to consume this hook.
- **Atomization**: extracted Curtain-first env/flags + derived booleans into `apps/web/app/configure/hooks/useCurtainFirstConfigureFlags.ts`.
- **Atomization**: extracted Curtain-first quote/pricing config building + `provider.priceQuote()` into `apps/web/app/configure/hooks/useCurtainFirstQuote.ts`.
- **Atomization**: extracted Curtain-first Add-to-Cart + coverage warning flow into `apps/web/app/configure/hooks/useCurtainFirstAddToCart.ts` and wired it into `apps/web/app/configure/CurtainFirstConfigureOrchestrator.tsx` (preserves mock/storefront behaviour, dynamic Magento import, and redirect).

**Fix (Jan 2026):**
- Summary panel now correctly respects `NEXT_PUBLIC_SUMMARY_FIELDS`, including `services`.
- `services` displays as a count (`configure.summary.servicesSelected` / `configure.summary.servicesNone`) to avoid duplicating line items already shown in the price breakdown, per `docs/SUMMARY-PANEL-SPEC.md`.

**Status:**
- This plan’s Phase 4 (Curtain-first orchestrator modularization) is complete enough to ship and iterate.

**Remaining gap (follow-up candidate):**
- Further polish: visual spacing + responsive details inside `CollapsibleSummary` for very small desktop heights.
