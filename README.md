# Parametric Configurator Demo

Photo → segmentation + measurement → a parametric, cart-ready configuration (with a real-time material/pleat preview).

![Hero Screenshot](docs/images/hero.png)

## What This Is

This repo is a production-style demo of a **parametric product configurator** for made-to-measure curtains:

- User uploads a room photo
- The system segments the window/wall + estimates dimensions
- The UI lets the user choose fabric, color, pleat style, hems, and add-ons
- The app produces a configuration payload that can be priced and forwarded to a storefront/cart flow

## What I Built (My Scope)

- End-to-end configurator UX (upload → analysis → configuration → summary → add-to-cart payload)
- CV/VLM pipeline integration (measurement provider switching, fallbacks, caching, safety guards)
- Segmentation service integration (local FastAPI service + HF fallback path)
- “Artist pipeline” preview rendering flow (texture-based canvas rendering with environment-controlled fallbacks)
- Optional storefront integration hooks (GraphQL provider, postMessage bridge, cart handoff)

## Key Features

- **Mock catalog by default** (`CATALOG_PROVIDER=mock`) so the demo runs locally without external services
- **Optional real storefront provider** via GraphQL (`CATALOG_PROVIDER=storefront`)
- **Provider-switchable measurement** (`qwen` / `googleai` / `openai` / `localcv` / `noreref`)
- **Local segmentation service** (`services/segmentation`) with a clean HTTP contract
- **Configurable, env-driven UX toggles** for experimentation (safe mode, debug drawer, rendering pipeline)

## Architecture (High Level)

```
                   +-----------------------------+
                   |   apps/web (Next.js 14)     |
                   |  React UI + API routes      |
                   +--------------+--------------+
                                  |
                 upload photo     |  /api/* (BFF)
                                  v
          +-----------------------+------------------------+
          |     packages/core (domain + pipeline)          |
          |  catalog provider | measurement | segmentation |
          +-----------+-------------------+----------------+
                      |                   |
           mock/storefront provider       | HTTP
                      |                   v
                      |        +--------------------------+
                      |        | services/segmentation     |
                      |        | FastAPI (local)           |
                      |        +--------------------------+
                      |
                      v
           (optional) Magento GraphQL / parent bridge
```

![Flow](docs/gifs/flow.gif)

## Tech Stack

- **Frontend / BFF:** Next.js 14 (App Router), React 18, TypeScript
- **Styling:** Tailwind CSS
- **Config validation:** Zod
- **AI orchestration:** Genkit (Google AI + OpenAI plugins)
- **Segmentation fallback:** Hugging Face Inference API (optional)
- **Local segmentation service:** FastAPI (Dockerized)

## Performance & Optimization

Real-world optimization work is documented in `docs/PERFORMANCE-OPTIMIZATIONS.md`.

- **Segmentation speedup:** ~60–90s → ~4–5s on 4032×3024 images (kept processing at inference resolution)
- **Measurement cost/speed control:** automatic VLM resize via `MEASURE_LONG_SIDE` (default 1536px)

## Quick Start (Local)

### 1) Prereqs

- Node.js `>=18`
- Docker (optional, for local segmentation service)

### 2) Install

```bash
npm install
```

### 3) Configure env

Create a local env file (not committed):

```bash
cp .env.example .env.local
```

Minimum config for a “UI-only” run:

- `CATALOG_PROVIDER=mock`

Optional (enables the full pipeline):

- VLM measurement: set one of `QWEN_API_KEY`, `GOOGLE_GENAI_API_KEY`, `OPENAI_API_KEY`
- Local segmentation: run the service below (or set `HF_TOKEN` for HF fallback)

### 4) Run the web app

```bash
npm run dev
```

Open `http://localhost:3010`.

### 5) (Optional) Run segmentation locally

```bash
docker compose up --build
```

The service exposes `http://127.0.0.1:8000/segment` (wired via `LOCAL_SEG_URL`).

## Demo Flow (What to Click)

1. Open `/configure`
2. Upload a photo (there are sample images under `apps/web/public/originals/`)
3. Let the app generate segmentation + measurement
4. Switch fabrics / pleats / hems and review the summary
5. Click “Add to cart” (mock mode shows payload; storefront mode forwards)

## Configuration (Env Vars)

This repo intentionally uses env vars everywhere; no secrets are committed.

Core toggles:

- `CATALOG_PROVIDER` = `mock` | `storefront`
- `NEXT_PUBLIC_TEXTURES_PIPELINE` = `artist` | `off`

AI measurement:

- `AI1_PROVIDER` = `qwen` | `googleai` | `openai` | `localcv` | `noreref`
- `QWEN_API_KEY`, `GOOGLE_GENAI_API_KEY`, `OPENAI_API_KEY` (set at least one depending on provider)
- `MEASURE_LONG_SIDE` (default `1536`)

Segmentation:

- `LOCAL_SEG_URL` (default `http://127.0.0.1:8000/segment`)
- `LOCAL_SEG_LONG_SIDE` (default `768`)
- `HF_TOKEN` (optional fallback)

Storefront (optional):

- `NEXT_PUBLIC_GRAPHQL_ENDPOINT` (GraphQL endpoint for `CATALOG_PROVIDER=storefront`)
- `NEXT_PUBLIC_STOREFRONT_ORIGIN` (parent origin allowlist for postMessage; can be comma-separated)
- `NEXT_PUBLIC_STOREFRONT_CART_URL` (cart/checkout URL template; supports `{cartId}`)

Screenshot upload (optional, server-side only):

- `MAGENTO_ORDER_SCREENSHOT_URL`
- `MAGENTO_OAUTH_CONSUMER_KEY`
- `MAGENTO_OAUTH_CONSUMER_SECRET`
- `MAGENTO_OAUTH_ACCESS_TOKEN`
- `MAGENTO_OAUTH_ACCESS_TOKEN_SECRET`

## Security & Secrets

- Secrets are not stored in the repo; use `.env.local` for local development.
- CI/deploy workflows use GitHub Secrets (see `.github/workflows/`).
- If you rotate credentials, also rotate any storefront tokens and third-party AI keys you may have used previously.

## Repo Structure

- `apps/web` — Next.js app (UI + API routes)
- `packages/core` — domain logic (catalog, measurement, segmentation, pricing helpers)
- `packages/shared` — shared env schema
- `services/segmentation` — local segmentation service (FastAPI, Docker)
- `docs/` — technical notes and runbooks

## Roadmap / Next Steps

- Add a minimal synthetic test corpus for segmentation/measurement regressions
- Improve masking robustness on reflective windows / curtains with patterns
- Add a “calibration object picker” flow (manual fallback when A4/reference fails)
- Expand storefront integration into a provider-agnostic adapter layer
- Add a lightweight analytics/telemetry layer (opt-in) for funnel drop-offs

## License

MIT — see `LICENSE`.

