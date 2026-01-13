# Curtain Wizard — Runbook

This runbook explains how to run the project locally with the GPU segmentation service and the Next.js BFF.

### Design System Workstream (Phase 0)
- UI tokens and shared components live in `packages/ui` per `docs/DESIGN-SYSTEM-IMPLEMENTATION-PLAN.md`.
- Run `npm run generate:tokens` after editing token sources; this regenerates CSS variables plus the Tailwind extend module consumed by `apps/web`.
- CI/local guard: `npm run check:tokens` to ensure generated artifacts are committed.
- Designer playground: `npm run storybook:ui` (Ladle) serves the kit stories from `packages/ui/stories/*` so you can preview Button/Card/Input/Chip/Dialog plus the new Toggle/NumericInput states before touching `/configure`.
- Toggle + NumericInput honour `prefers-reduced-motion`, expose `data-cw-*` handles, and ship via `apps/web/components/ui/{Toggle,NumericInput}` so app imports stay stable.
- Segments control (slider) and the services list in `/configure` already consume the shims, which keeps both `legacy` and `new` flow variants visually identical during the migration.
- **Stack baseline:** `apps/web` is currently pinned to Next.js 14.2.13 + React 18.2.0 + `client-only@0.0.1` (per `BUILD-FIXES-SUMMARY.md`) so that CI avoids the React 19 App Router `/404` prerender bug while the design-system rollout continues. Keep this lock until the upstream issue is resolved.

### CI / Deployment Guardrails
- GitHub Actions workflow `.github/workflows/deploy.yml` is re-enabled end-to-end: checkout → Node 20 setup → `npm ci` → SFTP deploy (the actual `npm run build` is triggered on the remote host when the SSH hook runs, so we skip the redundant CI build).
- The post-deploy SSH hook now runs `git pull`, `npm install`, `npm run build`, and manages a PM2 process called `curtain-wizard-web` from `/var/www/configurator/Curtain-Wizard/apps/web`.
- If PM2 is missing on the host, the workflow logs the skip instead of failing; when PM2 is present but the app is absent, it will bootstrap the process via `pm2 start npm -- --prefix apps/web run start` and `pm2 save`.
- To troubleshoot remote deployments manually, mimic the workflow script on the server, then check `pm2 ls` for `curtain-wizard-web`.
- The production PM2 process now runs `npm run start`, which listens on **port 3010** (see `apps/web/package.json`), so make sure nginx proxies there instead of 3000.

### Local Dev Scripts
- Default dev server now runs via `npm -w apps/web run dev` → `next dev -p 3010` to maximise compatibility with both Next.js 14 and older global CLIs that may not recognize Turbopack flags (this was causing the remote `unknown option '--turbopack'` crash and nginx 502s).
- Turbopack remains opt-in through `npm -w apps/web run dev:turbopack` for engineers who want the faster refresh path locally.

## 1) Prerequisites
- Node.js 20+
- Docker 24+ and Docker Compose v2+
- NVIDIA GPU with drivers + NVIDIA Container Toolkit (for the segmentation service)
- Hugging Face token (optional, only for HF fallbacks)
- **exiftool** (required for HEIC EXIF extraction in no-reference measurement):
  ```bash
  # macOS
  brew install exiftool
  
  # Ubuntu/Debian
  sudo apt-get install libimage-exiftool-perl
  ```

## 2) Environment
Copy and adjust environment for the BFF (Next.js):

```
cp .env.example apps/web/.env.local
```

Key vars:
- AI #1 defaults: `AI1_PROVIDER=openai`, `AI1_MODEL=openai/gpt-4o-mini`, `AI1_SECONDARY_MODEL=googleai/gemini-2.0-flash-lite`
- Provider keys: set `OPENAI_API_KEY` or `GOOGLE_GENAI_API_KEY` depending on your provider
- Optional local measurement service (CV path): `LOCAL_MEASURE_URL=http://127.0.0.1:8000/measure`, `MEASURE_DEBUG=0|1`
- Experimental no-reference heuristics: `MEASURE_CAMERA_HEIGHT_CM=150` (prior for camera height), `MEASURE_DEFAULT_FOV_DEG=60` (fallback horizontal FOV when EXIF is missing)
- Frontend debug switch for measurement provider: `NEXT_PUBLIC_MEASURE_ENGINE_DEBUG=vlm|localcv|noreref|auto`
- HEIC/HEIF uploads are supported: the BFF converts them to JPEG automatically (client `heic2any` with automatic `/api/convert-heic` server fallback via `heic-convert`) so iPhone photos flow through measurement and benchmarking without extra tooling.
  - HEIC optimization settings: `HEIC_MAX_DIMENSION=2048` (max px), `HEIC_JPEG_QUALITY=82` (0-100), and client equivalents `NEXT_PUBLIC_HEIC_MAX_DIMENSION`, `NEXT_PUBLIC_HEIC_JPEG_QUALITY`
  - Lower quality/dimension = smaller files & faster uploads on slow networks; defaults (2048px, 82%) balance quality and performance
- When `NEXT_PUBLIC_MEASURE_ENGINE_DEBUG` exposes the “Bypass local cache” toggle, remember that turning it on will force `/configure` to regenerate the wall mask—expect the progress bar even though the preview stays visible.
- Segmentation success appears immediately, but the handler still waits for the IndexedDB entry to finish writing before it navigates; that keeps offline restore reliable on `/configure`, especially after HEIC uploads on slow devices.
- Segmentation service URL: `LOCAL_SEG_URL=http://127.0.0.1:8000/segment`
- `SEG_M2F_COMPOSE_FROM_RAW` defines if local (heavy for now) postprocessing is used or not. To skip postprocessing, set to `0`.
      - Post-process parameters: `SEG_*` (hole fill, merge radius, etc.)
- `/api/segment` exposes `X-Segment-Backend` (`local-mask2former`, `hf-mask2former`, `hf-segformer`) plus `X-Input-Bytes`/`X-Input-Type` so you can quickly confirm whether a request hit the GPU service or fell back to Hugging Face. The JSON debug payload (`layers=1`) mirrors these fields.
- When the call falls back to Hugging Face, uploads are re-encoded with `SEG_FALLBACK_LONG_SIDE`, `SEG_FALLBACK_JPEG_QUALITY`, and `SEG_FALLBACK_MAX_BYTES` (all optional) so big HEIC/JPEG files never overwhelm the remote model. Defaults keep the long side ≤768px and the payload under ~0.8 MB, and the response header `X-Input-Bytes` mirrors the actual payload that was sent upstream.
- `CATALOG_PROVIDER=mock` for local development. Set to `CATALOG_PROVIDER=storefront` for production.
- Mock catalog now auto-builds `childItems` from the color list so local testing stays aligned with Magento’s child SKU structure. If a new mock fabric is added, populate both `colors` and (optionally) `colorSkuByColor`; the UI will derive the rest.
- Storefront filters now recognize extended color categories (`bright`, `grey`, `dark`, `colored`, `patterned`, `intensive`, `natural`, `brown`). For Magento data, make sure each configurable variant exposes `colorCategory` or `colorCategoryByColor` so color chips stay in sync with the active filter.
- Style and color chips update together: when you narrow by style, only color categories that still have fabrics remain visible (and vice versa). If “No fabrics” appears, re-check the source data rather than expecting hidden combinations.
- Catalog assets:
  - `CATALOG_ASSET_BASE_URL` — server-side base URL for catalog textures, swatches, thumbs, and tech diagrams. Default is empty (serves from local Next.js `public/` paths).
  - `NEXT_PUBLIC_CATALOG_ASSET_BASE_URL` — client-visible override. For local assets set it to `/` so both server and browser resolve to local files.
  - `NEXT_PUBLIC_CANVAS_TEXTURES_BASE_URL` — base URL for canvas renderer textures (pleat maps, material weaves). 
    - Production: set to `/texture_img` to use nginx static files
    - Local dev: set to `/` to serve from `/public` via Next.js routes
    - New blackout SKUs use `blackout-basic-weave.*` under `apps/web/public/media/textures/canvas/texture-details/`; drop additional weave files in the same folder and clear the canvas asset cache from the Debug drawer when testing new materials.
  - Local development serves assets from repo-root `public/` via Next routes `app/textures/[...asset]/route.ts`, `app/swatches/[...asset]/route.ts` (thumbs/tech share the same root).
  - To revert to remote CDN, set both env vars to the CDN origin and restart the dev server.
- Storefront integration: `STOREFRONT_MAGENTO_URL`, `STOREFRONT_MAGENTO_TOKEN`, `STOREFRONT_MAGENTO_CART_ID`, `NEXT_PUBLIC_STOREFRONT_CART_URL`
- Curtain renderer pipeline: `NEXT_PUBLIC_TEXTURES_PIPELINE=artist` enables the artist-authored pleat textures (production default). Set to `off` for CSS fallback. Make sure `/public/textures/canvas/{wave-drape,wave-sheer,flex,double-flex}/` contains the exported WEBPs (pleatRamp/occlusion/translucency/normal, optionally `depth`). PNG/JPEG copies are still loaded as a fallback, but the pipeline requests WEBP first. If `depth.*` is present, the Debug UI exposes a Pleating Preset slider: "Height Map Strength".
- The artist pipeline now fingerprints renders with `apps/web/lib/canvas-renderer/key-utils.ts`; when adding new pipeline params, extend the helper so cache keys stay in sync, and keep the request-id guard in `CanvasCurtainLayer` so late promises cannot stomp the latest tile.
- UI appearance (Configure page) is now token-driven; adjust glass/overlay values via CSS variables (`--cw-config-overlay-gradient`, `--cw-config-overlay-blur`, etc.) instead of env flags.
- Measurement stability (Task 865): Wall-box baselines now live in normalized ratios, so resizing the browser or rotating a simulator after marking the wall must leave the centimetre readout and price untouched. QA this anytime you tweak layout — measure once, resize, confirm the numbers remain identical.
- Desktop hero parity (2025-10-25): `/estimate` and `/configure` now share the same 768×576 hero frame (`cw-hero-shell` + `hero-frame-height`). When you tweak Phase 5 layouts, verify the hero stays centred and identically sized from upload → mark; once the wall box is confirmed (`phase=ready`), confirm the glass card expands and the hero slides left without resizing.
- Summary alignment (2025-10-25): The desktop summary card matches the hero width and sits directly below the sticky hero; the configurator panel no longer uses its own scrollbar. QA: scroll the page and confirm the hero stays pinned while the summary remains immediately under it, with the right panel moving naturally.
- Stitch-line overlay (Task 865b): Set `NEXT_PUBLIC_STITCH_LINES_ENABLED=0` when you want to hide seam guides in production builds where the debug panel is disabled.
- Lighting (Task 881):
     - `NEXT_PUBLIC_LIGHTING_ENABLED` — `1` to enable, `0` to disable (env-only toggle)
     - `NEXT_PUBLIC_LIGHTING_MODE` — `off | lite | enhanced` (default `lite`)
     - `NEXT_PUBLIC_LIGHTING_OPACITY` — overall strength `0.0–1.0` (default `0.35`)
     - `NEXT_PUBLIC_LIGHTING_GRID_X` / `NEXT_PUBLIC_LIGHTING_GRID_Y` — estimator sampling grid (default `48` / `32`)
     - `NEXT_PUBLIC_LIGHTING_THROTTLE_MS` — defer estimator start by N ms (default `120`)
  - Configure fallback (safe by default):
    - `NEXT_PUBLIC_CONFIGURE_FALLBACK_LATEST` — `1` to enable fallback on `/configure` when no session flow handoff is present. Behavior: prefer the session's last uploaded key; if missing, fall back to the most recently cached segment. Default `0` (no auto-restore).
  Curtain-first flow:
  - `/estimate` segments on upload and measures from the confirmed curtain polygon; the user‑confirmed cm and polygon are stored in FlowState, and `/configure` restores this measurement as the single source of truth (no additional `/api/measure` calls in production curtain-first flow).
  - Toast/Banner messaging on `/estimate` and `/configure` surfaces the AI #1 status inline.

  Behaviour:
  - Lighting applies only to curtain segments (masked/clipped by the wall box overlay) and never changes the room photo.
  - Lite mode uses a subtle CSS `filter` inferred from the wall‑box ROI (average luminance/saturation).
  - Enhanced mode adds a soft directional gradient per segment (`mix-blend-mode: soft-light`), angle compensated for texture rotation.
  - Save‑Data/reduced‑data automatically disables lighting.
  - The estimator runs once per photo (+ ROI) and is cached by file signature; it does not recompute while dragging.

  **Browser Compatibility & Cache Recovery:**
  - Safari and Opera (WebKit) have a known issue with blob URLs from IndexedDB (`WebKitBlobResource error 1`). The app now forces base64 data URLs on these browsers to avoid the failure.
    - **Safari:** Fails only with cached images; fresh uploads work correctly
    - **Opera:** Fails with all scenarios (both cached and fresh images)
  - In development mode, cache health diagnostics run on `/configure` mount and expose manual recovery tools via `window.curtainWizardCacheRecovery`:
    - `window.curtainWizardCacheRecovery.logHealth()` — Check cache status
    - `window.curtainWizardCacheRecovery.performRecovery()` — Clear corrupted cache
  - If users report gray rectangles or missing images on `/configure`, recommend:
    1. Try a different browser (Chrome or Firefox preferred; Safari works for fresh uploads)
    2. Clear site data in browser settings
    3. In dev console: run `window.curtainWizardCacheRecovery.performRecovery()`
  - The blob URL fallback system is in `apps/web/lib/blob-url-fallback.ts` and cache recovery tools in `apps/web/lib/cache-recovery.ts`.
- UI styling (2025-10-18 update):
  - Configure + Estimate pages now use Tailwind classes for static layout and colour values; remaining inline styles only cover geometry/math for the curtain preview. Key configurator sections (`ConfiguratorLayout.tsx`, `SummaryPanel.tsx`, `DebugControls.tsx`, `ServicesSection.tsx`, `FiltersPanel.tsx`) live in `apps/web/app/configure/components/` and source their copy from the shared i18n catalog. Glass overlays, scrims, clamp toasts, and debug handles pick up colours/shadows from shared CSS variables (`overlay.scrim*`, `surface.config`, `shadow-config-panel`, etc.) so palette swaps only touch token definitions.
  - When adjusting UI tokens, update `apps/web/tailwind.config.ts` and `apps/web/app/globals.css`; shared components live under `apps/web/components/ui`.
  - Debug handle styles are still injected at runtime and will move to CSS variables during Stage 3; keep that in mind if you change env toggles.

## 3) Start the Segmentation Service

Option A — docker compose (requires GPU support):

```
docker compose up segmentation -d
```

This builds `services/segmentation` and exposes `http://127.0.0.1:8000/segment`.

Option B — docker run manually:

```
cd services/segmentation
docker build -t cw-segmentation:gpu .
docker run --rm --gpus all -p 8000:8000 cw-segmentation:gpu
```

Option C — Apple Silicon/CPU (no NVIDIA):

```
cd services/segmentation
python3 -m venv .venv
. .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Note: Apple M‑series is supported via PyTorch MPS. The service auto‑selects `mps` when available; otherwise it runs on CPU.

Faster macOS setup (Transformers‑only, skips mmcv/mmseg):

```
npm run seg:venv:setup -- --transformers-only
npm run seg:venv:start
```
This installs `services/segmentation/requirements.txt` and supports `X-Model: mask2former_ade20k`.
All `npm run seg:*` helpers now target `services/segmentation` exclusively; the legacy `(deprecated) curtain-visualizer/local-infer` path has been removed from the repo.

Tuning (speed vs quality):
- The segmentation service supports a pre‑resize header `X-Scale-Long-Side` (e.g., 768). It downscales the long side before inference and upsamples outputs to original size. Set to `0` to disable. Default can be set via env `M2F_LONG_SIDE` (default 768).
- From the BFF, you can set `LOCAL_SEG_LONG_SIDE=768` in `apps/web/.env.local` to forward this header automatically.

## 3b) Local Measurement (OpenCV + Mask2Former)

Goal: Optional local path to estimate wall width/height (cm) from a single photo containing an A4 sheet (210×297 mm). Implemented in the same FastAPI service. Node code calls it through `packages/clients/src/measurement.ts` (`measureLocalCV`).

Setup (from repo root):

```
python3 -m venv services/segmentation/.venv
source services/segmentation/.venv/bin/activate
pip install --upgrade pip
pip install -r services/segmentation/requirements.txt
```

Run the service:

```
cd services/segmentation
uvicorn main:app --host 127.0.0.1 --port 8000
```

Test the /measure endpoint (from repo root):

```
curl -s -X POST http://127.0.0.1:8000/measure \
  -H 'Content-Type: application/octet-stream' \
  --data-binary @public/originals/scianas.jpg | python -m json.tool
```

Include server-only debug artifacts (masks and overlays) and tune pre-scale for performance:

```
curl -s -X POST http://127.0.0.1:8000/measure \
  -H 'Content-Type: application/octet-stream' \
  -H 'X-Debug: 1' \
  -H 'X-Scale-Long-Side: 768' \
  --data-binary @public/originals/scianas.jpg | python -m json.tool
```

- Rectification & tuning:
  - The service rectifies the wall plane by solving a homography from the detected A4 corners. Floor and ceiling semantic classes are removed before computing the wall ROI, and only connected components that touch the detected A4 survive so the opposite wall drives the measurement. Disable rectification with `MEASURE_RECTIFY_ENABLED=0` to revert to the legacy axis-aligned estimator.
  - A ceiling/floor clamp keeps the blue wall polygon inside the band defined by the lowest detected ceiling pixels and the top edge of the floor. Toggle with `MEASURE_WALL_CLAMP_ENABLED` and adjust the retained padding via `MEASURE_WALL_CLAMP_MARGIN_PCT` (fraction of image height, default 0.0075 ≈ 0.75%). When the clamp removes everything, the service falls back to the original mask and reports the skip reason in the debug payload.
  - The A4 finder now searches the wall ROI after stripping window pixels (dilated once for safety), rejects tiny quads, drops high-overlap glass hits, records the top scoring candidates in the debug JSON, and automatically retries without the window penalty if all other passes fail so we can still detect sheets taped to glass.
  - Measurements are only trustworthy when both prerequisites are met: the filtered wall mask (blue polygon in `a4Overlay.png`) must cover only the opposite wall, and the A4 sheet must be detected correctly. Use the debug bundle (`maskFilteredWall.png`, `a4Overlay.png`) to confirm both before relying on the centimetre output.
  - Trim stray segmentation pixels before measuring with `MEASURE_RECTIFY_TRIM_LOWER` / `MEASURE_RECTIFY_TRIM_UPPER` (percentiles, defaults 2 / 98). Increase the lower percentile if small artifacts inflate the width; decrease it if valid features vanish.
  - Debug payloads include `mode` (`rectified` or `axisAligned`), the rectified bounding box in centimetres, the optional clamp summary, and axis-aligned fallback estimates so you can compare both paths quickly.
  - A4 detection first looks inside the wall ROI, then retries with the combined mask, then the whole frame. If all attempts fail, ensure the sheet is fully visible and reasonably contrasted.

### Experimental No-Reference Measurement
- Provider id: `noreref`. Implemented in `packages/core/src/services/measureNoReference.ts` and wired through `/api/measure` behind the usual provider flag.
- Inputs: standard photo upload (no A4). The pipeline reuses segmentation masks (local FastAPI → HF → gradient) plus EXIF focal length (fallback: `MEASURE_DEFAULT_FOV_DEG`, default 60°) and a camera-height prior (`MEASURE_CAMERA_HEIGHT_CM`, default 150 cm) to estimate scale.
- Output: `{ wallWidthCm, wallHeightCm, confidencePct, warnings[] }` with a debug payload describing bands, scale, and distance assumptions. Treat it as experimental guidance, not production truth.
- Enable in the UI by toggling the debug dropdown (`NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1`) and selecting “No reference (experimental)” on `/estimate`. You can also set `AI1_PROVIDER=noreref` (server-side default) when you want to benchmark the heuristics end-to-end.
- Benchmark via:
  ```bash
  node scripts/measure-benchmark.mjs --dir public/originals --ground-truth ground_truth.json --rectify off --debug-dir measure-debug --no-cache --provider noreref
  ```
  The script now prints `confidencePct` and concatenated warnings so you can compare heuristic tweaks between runs.

Flip rectification per run (without restarting) by sending `X-Rectify-Enabled: 0|1` to the FastAPI service. Through the BFF, include `"localRectifyEnabled": false` or `true` in the JSON body. Export `MEASURE_RECTIFY_ENABLED=0` before launching `uvicorn` if you want the legacy axis-aligned numbers for all calls:

```
export MEASURE_RECTIFY_ENABLED=0
uvicorn main:app --host 127.0.0.1 --port 8000

(.venv) mario@MacBook-Air-Mariusz segmentation % 
source .venv/bin/activate
export MEASURE_WALL_CLAMP_ENABLED=0 # disable clamp
export MEASURE_WALL_CLAMP_MARGIN_PCT=0.01 # clamp margin
uvicorn main:app --host 127.0.0.1 --port 8000
```

Performance targets and tips:
- CPU: aim ≤ 10s; use `X-Scale-Long-Side: 640–768`.
- GPU/MPS: aim < 3s; `X-Scale-Long-Side: 896–1024` works well.
- First request may download the model; subsequent calls are faster.

## 4) Start the Next.js BFF

```
npm install
npm run dev
# Next BFF available at http://localhost:3010
```

## Canvas Renderer (2025-10-29 Pleat Jitter Update)
- The pleat renderer now caches per-pleat seeds and precomputes a pleat sample grid per frame. Debug sliders still drive live renders, but the work per update is lower and mobile devices should no longer stutter or overheat when scrubbing.
- Expect a tighter header: jitter envelopes bias toward reduced movement near the curtain heading while keeping the hem relaxed. If you need the older behaviour for QA, set the debug slider `Pleat Taper` below `1.0`.
- Occlusion, ramp, and translucent passes reuse the same sample grid. If render timings spike, clear the canvas cache from the Debug drawer, then re-render to rebuild the grid with the current canvas size.
- Flex pleat assets live in `public/textures/canvas/flex25d/`. Regenerate them with `node scripts/generate-flex25d.mjs` after tweaking the fold parameters; the 2.5D generator emits aligned `pleatRamp_flex`, `occlusion_flex`, `translucency_flex`, plus `normal_flex` so the X-pinched header and belly bloom stay consistent.
- Artist weave detail now multiplies onto the base colour by default; use the Debug drawer select `Weave Blend Mode` to switch to Overlay when reviewing artist maps that assume additive highlights.
- Transmission blur now counter-rotates under the segment mask, so the blurred wall-box stays anchored even when the top handles tilt the curtain; only the mask follows the rotation.

Health check:

```
curl http://localhost:3010/api/healthz
```

## 5) Test the APIs

Measurement (AI #1):

```
curl -X POST http://localhost:3010/api/measure \
  -H 'Content-Type: application/json' \
  -d '{"photoDataUri":"data:image/jpeg;base64,...."}'
```
Include "provider":"localcv" in the JSON body to force the local CV pipeline; the BFF forwards the call to MeasureService, which now invokes the FastAPI /measure endpoint through measureLocalCV().
Enable the dev UI (`NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1`) to reveal the measurement provider dropdown on /estimate, which now includes the Local CV option.
Use the “Bypass local cache” checkbox (debug UI) to rerun measurement + segmentation without reading/writing IndexedDB; helpful when tuning the same photo repeatedly.
The configure debug drawer now includes a **Measurement Diagnostics** panel when `NEXT_PUBLIC_CONFIGURE_DEBUG_UI` is enabled. It records the latest 40 AI #1 responses with polygon summaries, prompt copies, elapsed time, warnings, and the measurement cache key (covering both `source: 'estimate-curtain'` and `source: 'configure-box'` entries). Use it to export JSON snapshots while iterating on prompt accuracy; clear the log from the same panel when switching photos.

Benchmark helper (supports `localcv`, `noreref`, `googleai`, `openai`):

```
node scripts/measure-benchmark.mjs --files path/to/room.jpg --provider noreref
```

The script calls `/api/measure` for each image, logs elapsed time and dimensions (defaults to Local CV), and accepts:
- `--ground-truth path/to.csv|json` — attach expected wall widths/heights for error stats (bias, MAE, RMSE, P95, MAPE)
- `--rectify on|off` — force rectification on/off without touching env vars (default `auto`)
- `--debug-dir debug/runs` — store every debug PNG + metadata JSON automatically (implies Local CV debug mode)
- `--repeat`, `--endpoint`, `--scale`, `--no-cache`, `--save`, `--summary json` — as before; JSON summary still returns `{ results, metrics }`

Segmentation (AI #2):

```
curl -X POST http://localhost:3010/api/segment \
  -F image=@/path/to/room.jpg \
  --output final_mask.png
```

Debug layers:

```
curl -X POST http://localhost:3010/api/segment -F image=@/path/to/room.jpg -F layers=1
```

## 6) Notes
- If the GPU service is unavailable, the BFF falls back to HF Mask2Former → HF SegFormer (requires `HF_TOKEN`).
- Tweak SEG_* in `.env` to adjust post-processing.
- Curtain sizing respects fabric constraints: when a fabric is railroaded double-width, the ready height is capped by the usable bolt width; for 150 cm fabrics each panel is capped at 150 cm. The UI now clamps drags to these maxima and surfaces a toast when a limit is hit.
- Configure `STOREFRONT_MAGENTO_URL`/`STOREFRONT_MAGENTO_TOKEN` (and optionally `STOREFRONT_MAGENTO_CART_ID`) to let `/api/cart/add` forward the GraphQL mutation. Without them the route returns the payload only. `NEXT_PUBLIC_STOREFRONT_CART_URL` controls the “Finalize purchase” link in the UI.
- Localization: the UI reads copy from `packages/core/src/i18n/messages.ts`. Use the language switcher in the top-right corner (PL/EN/UK) or set `?lang=xx` in the URL to preview a locale. Update the message catalog when adding copy.
- Flow handoff & caches:
  - `/estimate` fingerprints uploads and writes a session handoff payload (`segmentKey`, measurement). `/configure` restores strictly by this key.
  - The most recent user upload per tab is tracked in sessionStorage as the last uploaded key. With the fallback flag enabled, `/configure` prefers this key when opened without a handoff; if unavailable, it falls back to the latest cached segment. With the flag disabled, `/configure` remains idle until a photo is uploaded.
  - Dev helper: use `getPreferredRestoreRecord(readLastUploadedKey, { preferLastUploaded })` from `apps/web/lib/segment-cache.ts` to implement consistent restore policy in new views. Call it with `() => getLastUploadedKey()` from `apps/web/lib/flow-state.ts`.
- For production, run Next.js as a container with `npm run build && npm run start` and the GPU service on a separate host/VM with a fixed URL.
 - Fabric color variants are attributes of a single fabric, not separate items. The UI renders color chips inside each fabric card and pricing can vary by color via rules. The cart payload includes `options.colorId` for storefront display; SKU stays the same as the parent fabric.

## 7) One‑shot helpers

- `npm run start:seg` — tries Docker on Linux/NVIDIA; on macOS/Windows suggests or starts local Python venv.
- `npm run seg:venv:setup` — prepare Python venv for the segmentation service.
- `npm run seg:venv:start` — start the local FastAPI server with uvicorn.
- `npm run check:status` — check both services’ health.
- `npm run test:seg -- --file path/to.jpg` — run a segmentation request via BFF and save `mask.png`.
- `npm run test:measure -- --file path/to.jpg` — run a measurement request via BFF and print JSON.
- `npm run stress:seg -- --file path/to.jpg --total 100 --concurrency 4 --layers 0` — run a segmentation stress test via BFF with multiple concurrent requests and report throughput/latency. Use `--layers 1` to include debug JSON and per-request server timing.

### macOS HEIC rebuild checklist

- **Install libheif**
  ```bash
  brew install libheif
  ```
- **Reinstall vips against libheif**
  ```bash
  brew reinstall vips
  ```
- **Export pkg-config path before rebuilding**
  ```bash
  export PKG_CONFIG_PATH="$(brew --prefix libheif)/lib/pkgconfig"
  ```
- **Rebuild sharp for the web workspace**
  ```bash
  npm rebuild sharp --workspace apps/web --force --build-from-source
  ```

The env export applies to the current shell. Repeat it whenever you open a fresh terminal before invoking the rebuild command.

## 8) i18n Operations

### Switching

{{ ... }}
- To switch languages, simply click on the desired language and the UI will update accordingly.

### Lazy-load API

- The i18n API is lazy-loaded, meaning that it only loads the necessary language files when the user switches languages.
- This is done to improve performance and reduce the amount of data transferred.

### Persistence

- The selected language is persisted across page reloads and sessions.
- This is done using local storage, so the user's language preference is remembered even after they close their browser.

### QA Steps

- To test the i18n functionality, follow these steps:
  1. Switch to a different language using the language switcher.
  2. Verify that the UI updates correctly and displays the translated text.
  3. Switch back to the original language and verify that the UI updates correctly again.
  4. Repeat steps 1-3 for each supported language.
