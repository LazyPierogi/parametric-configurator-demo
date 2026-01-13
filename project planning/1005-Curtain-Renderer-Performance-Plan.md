# Task 1005 — Curtain Renderer Performance Plan (Artist Pipeline)

**Status:** Ready for implementation  
**Scope:** `/configure` curtain rendering only (artist canvas pipeline)  
**Related docs:**  
- `project planning/1005-Configure-Page-Atomic-Refactor-Plan.md` (page refactor)  
- `apps/web/app/configure/components/CanvasCurtainLayer.tsx`  
- `apps/web/lib/canvas-renderer/*` (`artist` pipeline, cache, assets)  
- `docs/ARTIST-PIPELINE-TESTING.md`, `docs/MOCK-ARTIST-TEXTURES.md`, `DEBUG-PRODUCTION-TEXTURES.md`  

---

## 1. Goals & Non-Goals

### 1.1 Goals
- Reduce perceived curtain render latency on `/configure` (artist pipeline) during:
  - initial load of the curtain,
  - fabric/color/pleat changes,
  - segment/wall-box drags (including stitch/segment changes),
  - lighting / material tweaks from Debug UI.
- Keep **visual output identical** to current implementation:
  - same texture tiling, top-edge anchoring, and tile width,
  - same transmission/blur behaviour,
  - no changes to measurement, pricing, or FlowState.
- Make renderer perf improvements **reusable across the atomic refactor**: changes live in `CanvasCurtainLayer` + `canvas-renderer` API, which the new orchestrator will call unchanged.

### 1.2 Non-Goals
- No restructuring of `/configure/page.tsx` state or layout (covered by `1005-Configure-Page-Atomic-Refactor-Plan.md`).
- No change to CSS-based pipeline or legacy flow (artist-only path is optimized; legacy stays as-is).
- No new visual features; only performance and stability improvements.

---

## 2. Current Behaviour (High Level)

Key pieces:
- `CanvasCurtainLayer.tsx`:
  - Owns:
    - render lifecycle (`performRender`, `debouncedRender`),
    - caching of canonical texture canvas (`cachedTextureRef` + `textureParamsKeyRef`),
    - width-only retile path in `useLayoutEffect` via `drawTexture`,
    - drag-stop behaviour (re-render after dragging), and
    - transmission handling via `hasTransmission`, `backgroundSignature`, `wallBox`, `segmentBounds`.
  - Guarantees:
    - width changes **only re-tile cached textures** (no full renders),
    - render requests are guarded with `renderRequestIdRef` so stale promises do not apply.
- `canvas-renderer/index.ts`:
  - `renderCurtain(config)` chooses artist pipeline, checks `renderCache`, loads assets, and runs artist pipeline.
  - Stores completed renders as data URLs in `renderCache`.
- `render-cache.ts`:
  - Small LRU cache (20 entries, 5 minutes TTL) keyed by fabric, color, pleat, size, scale, pipeline, renderParams, and (when transmission) background+wallbox+segment.

Performance hotspots today:
- Each canonical render:
  - runs the full artist pipeline (height/normal/depth maps, compositing),
  - converts canvas → dataURL for cache storage,
  - may be re-run more often than necessary when only a subset of params changes.
- Width changes are already optimized (tiling-only), but:
  - multi-segment, multi-wall configurations still need careful caching to avoid re-running expensive pipeline work.

---

## 3. Optimizations Safe to Do **Now** (Pre-Refactor)

These changes live entirely in `CanvasCurtainLayer` + `canvas-renderer` and keep `/configure/page.tsx` as-is. They are designed to be fully compatible with the future atomic refactor.

### 3.1 Tighten Render Trigger Conditions in `CanvasCurtainLayer`

**Files:**  
- `apps/web/app/configure/components/CanvasCurtainLayer.tsx`

**Ideas:**
- Audit dependencies of `performRender` and the main `useEffect` trigger:
  - Ensure that only *visually meaningful* changes (fabric, color, pleat, `textureScale`, `backgroundImage`, wallBox, segment, `renderParams`, transmission state) trigger a canonical render.
  - Confirm that height changes go through the main effect (full render), while **width-only** remains in the width effect.
- Avoid full render when only `tileOffsetPx` / `verticalOffsetPx` change:
  - Verify these changes are exclusively handled by `useLayoutEffect` tiling path.
  - If any effect currently includes these offsets as dependencies unnecessarily, relax the deps and rely on the tiling effect only.
- When exiting drag (`isDragging` → `false`):
  - Prefer cached-tiling path when `textureParamsKey` hasn’t changed during drag.
  - Only call `performRender()` if the texture parameters are different (e.g. pleat/fabric change mid-drag), not purely geometry.

**Expected impact:**  
Fewer full-pipeline renders for geometry-only interactions; better responsiveness during wall-box & segment drags.

### 3.2 Improve Debounce Strategy for Slider/Debug Changes

**Files:**  
- `apps/web/app/configure/components/CanvasCurtainLayer.tsx`

**Ideas:**
- Validate that `useDebounce(performRender, 16)` is used only for:
  - fine-grained slider-style changes (e.g. Debug UI material params),
  - not for critical events like fabric/pleat change or first render.
- If needed, introduce **two code paths**:
  - `renderImmediate()` for “coarse” changes: fabric, pleat, color, wallBox/wall mask, segment structure.
  - `renderDebounced()` for small continuous tweaks: opacity, weaveStrength, transmissionStrength, etc.
- Guard debounce with `requestAnimationFrame` when possible to align with frame boundary (optional micro-optimization).

**Expected impact:**  
Smooth sliders without stacking multiple pipeline runs; deterministic response to big changes.

### 3.3 Improve Canonical Width / Cache Reuse

**Files:**  
- `apps/web/app/configure/components/CanvasCurtainLayer.tsx`  
- `apps/web/lib/canvas-renderer/render-cache.ts`

**Ideas:**
- Confirm `ENV_CANONICAL_WIDTH` default (1024) and evaluate if current wall-box widths often exceed it:
  - If typical wall-box width on desktop is significantly smaller (e.g. 700–900px), consider lowering `DEFAULT_CANONICAL_WIDTH` slightly (e.g. 896) to reduce the canvas size without losing detail.
  - Leave upper bound (4096) and env override intact for high-res QA.
- In `render-cache`:
  - Consider making `canvasHeight` less granular in the cache key when vertical scaling can be approximated:
    - e.g. snap height to a small grid (32/64px) to allow more cache hits, **if** this does not alter visual fidelity (requires visual QA).
  - Keep current behaviour for transmission-enabled renders, since they are more sensitive to exact geometry.

**Expected impact:**  
Smaller canonical canvases and potentially higher cache hit rate, especially for repeated fabrics/pleats across similar wall-box sizes.

### 3.4 Avoid Extra Canvas → DataURL Conversions (Where Possible)

**Files:**  
- `apps/web/lib/canvas-renderer/index.ts`  
- `apps/web/lib/canvas-renderer/render-cache.ts`

**Ideas:**
- Evaluate storing cached renders as:
  - **ImageBitmap** or offscreen canvas rather than dataURL, to avoid repeated encode/decode on hot paths.
  - This would require a measured spike investigation and fallback for browsers without `createImageBitmap`.
- If we keep dataURL:
  - Add a fast path in `renderCurtain` where the canonical canvas is still in memory (e.g. reuse `canvas` directly when identical parameters are re-rendered within a short time window), so we don’t always go through dataURL → `Image` → draw.

**Expected impact:**  
Less CPU overhead on repeated renders with identical params; better responsiveness when iterating on presets.

### 3.5 Transmission Layer Performance

**Files:**  
- `apps/web/app/configure/components/CanvasCurtainLayer.tsx` (`TransmissionLayer`)  
- `apps/web/lib/canvas-renderer/pipelines/artist.ts` (blurred wall box)

**Ideas:**
- Ensure `getBlurredWallBox`:
  - caches blurred ROI at appropriate resolution and reuses it across segments (already partially true via `clearBlurredWallBoxCache()`).
  - is not recomputing blur on minor opacity changes (transmissionStrength), only reusing cached blurred canvas.
- In `TransmissionLayer`:
  - Avoid re-drawing when `transmissionStrength` is effectively unchanged (e.g. diff below 1–2%).
  - Consider moving transmission canvas to a shared parent when multiple segments overlap, ensuring there is only one blur per wall-box (already the conceptual design; verify implementation).

**Expected impact:**  
Fewer expensive blur computations; smoother updates when tweaking lighting/transmission.

### 3.6 Renderer-Level Telemetry (Optional, Dev-Only)

**Files:**  
- `apps/web/lib/canvas-renderer/index.ts` (debug logs)  
- `apps/web/app/configure/components/CanvasCurtainLayer.tsx`

**Ideas:**
- Under `process.env.NODE_ENV !== 'production'` + Debug UI enabled:
  - Log `renderTimeMs`, cache hits/misses, and canonical width/height.
  - Optionally expose a small dev-only overlay showing last render time and cache status.
- Use this to guide concrete targets (e.g. “initial artist render < 50ms on M-series”, “cache hit rate > 60% after first interaction”).

**Expected impact:**  
Faster iteration on perf tweaks without guessing where the time goes.

---

## 4. Optimizations During/After Atomic Refactor

Te poniższe działania wymagają już wchodzenia w strukturę `/configure/page.tsx` i są zaplanowane równolegle z `1005-Configure-Page-Atomic-Refactor-Plan.md`.

### 4.1 Granular React Re-Renders Around Canvas

**Dependencies:**  
- Curtain-first orchestrator + `CurtainFirstConfiguratorProvider` (Task 1005 Phase 4).

**Ideas:**
- Wrap `CanvasCurtainLayer` and `TransmissionLayer` in memoized components that receive:
  - tylko **stabilne** propsy (fabric, color, pleat, wall-box geometry, textureScale, opacity, renderParams),
  - bez zbędnych callbacków/obiektów tworzonych inline.
- Use context selectors or split contexts so:
  - dragging a segment or moving wall-box corners updates only the minimal geometry state,
  - global configuration/pref changes do not rerender the entire configure tree.

**Expected impact:**  
React-side work around the canvas drops; canvas is only re-rendered when truly needed.

### 4.2 Explicit Renderer “Phase” Management

**Dependencies:**  
- State machine in configurator provider.

**Ideas:**
- Integrate renderer with flow phase (`segmenting` → `mark` → `ready`):
  - Skip canvas renders altogether in early phases where they are not visible or helpful (e.g. during segmentation / initial upload).
  - Only start artist pipeline when:
    - wall-box is valid,
    - flow is stable enough (phase `ready`),
    - and minimal fabric/color has been selected.
- Defer heavy renders until after critical UX transitions (hero animation and layout stabilization).

**Expected impact:**  
Heavy GPU/CPU work is postponed until the layout is stable and the user can see/use the curtain, improving TTI/first interaction quality.

### 4.3 Cross-Page Asset Warmup (Estimate → Configure)

**Dependencies:**  
- Shared flow hooks (`usePhotoFlow`, `useSegmentationJob`, `useMeasurementJob`) and FlowState.

**Ideas:**
- When user is on `/estimate` and has a stable wall-box + fabric choice:
  - Pre-warm artist textures using `preloadMaterialTexture` and optionally `renderCache.preWarm` based on likely initial configuration.
  - Use FlowState to carry “prewarmed” signatures into `/configure`, so first curtain render on configure is almost instant.

**Expected impact:**  
Near-zero delay for first visible curtain render when arriving from `/estimate`.

### 4.4 Advanced Caching Strategies (Optional, Post-Stabilization)

**Dependencies:**  
- Stable atomic refactor, reliable metrics from 3.6.

**Ideas:**
- Experiment with:
  - per-fabric/pleat “preset” renders at standard canonical sizes stored in IndexedDB, especially for mock catalog use,
  - more aggressive reuse of cached data across sessions in dev / mock mode.
- Keep production mode conservative to avoid unbounded storage and stale-art risks.

**Expected impact:**  
Best-in-class perceived performance for repeat visitors and designers iterating on the same fabrics.

---

## 5. Execution Order & Links to Task 1005

Recommended sequence:

1. **Renderer-only pass (this document)**
   - Implement 3.1–3.5 incrementally, validating metrics via 3.6.
   - No changes to `/configure/page.tsx` structure or flow flags.
2. **Atomic page refactor**
   - Follow `project planning/1005-Configure-Page-Atomic-Refactor-Plan.md` for flow split, smart-sticky hooks, and orchestrator/provider.
   - While doing Phase 4, incorporate 4.1–4.3 to fully exploit renderer improvements.
3. **Optional advanced caching (4.4)**
   - After new architecture is stable and perf baselines are captured.

This keeps renderer work **reusable** and aligned with the broader page refactor, without locking us into the current monolithic page structure.

