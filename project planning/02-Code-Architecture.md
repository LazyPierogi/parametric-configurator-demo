# Curtain Wizard — Code Architecture (Split‑Ready Next BFF)

Goal: Keep the agility of a Next.js BFF while making a later split to a standalone Node service low-friction.

## High-Level Architecture
- Frontend (Next.js, React, Canvas)
  - Uploads photo, guides user through measuring and configuration.
  - Displays layers: original photo, curtains (canvas), and masked foreground (PNG alpha mask).
- Backend API (Next.js API routes / server actions)
  - `/api/measure` (AI #1 via Genkit) — returns `{ wallWidthCm, wallHeightCm }`.
  - `/api/segment` (AI #2 orchestration) — returns PNG alpha; may return debug layers.
  - `/api/curtains` (stub) — later: SKU querying and pricing.
- AI #1 service (Genkit wrappers)
  - Pluggable providers (GoogleAI Gemini 2.x flash-lite; OpenAI o3 family), env-selected.
- AI #2 service (Python FastAPI on GPU)
  - Mask2Former ADE20K only. Exposes endpoints to return RAW per-class masks.

## Monorepo Layout (proposed)
```
curtain-wizard/
  apps/
    web/                     # Next.js app (BFF + UI)
  services/
    segmentation/            # FastAPI GPU Mask2Former service (Dockerized)
  packages/
    core/                    # Business logic, service interfaces, validators
    clients/                 # Typed HTTP clients (python seg; future Magento)
    shared/                  # Shared types, env schema, constants
  docs/
  .tooling/                  # CI/CD, compose, infra snippets (optional)
```

## Module Boundaries
- `packages/core`
  - Interfaces:
    - `MeasureService`: `measureFromImage(dataUri: string): Promise<{ widthCm: number; heightCm: number }>`
    - `SegmentationService`: `segment(image: Buffer, opts): Promise<{ png: Buffer; backend: 'local-mask2former' | 'hf-mask2former' | 'hf-segformer' }>`
    - `CurtainPricingService` (stub): `price(config): Promise<PriceBreakdown>`
  - Business rules: post-processing orchestration, parameter validation, fallback policy.
- `packages/clients`
  - `SegmentationClient` (HTTP): talk to FastAPI GPU.
  - `HfSegmentationClient`: talk to HF inference for fallbacks.
  - `MagentoGraphqlClient` (stub): SKU queries.
- `apps/web`
  - Thin API adapters calling `packages/core` services.
  - React UI only; server actions wrap core functions.

## Data Flows
- Measurement (AI #1)
  1) `/api/measure` receives Data URI.
  2) `MeasureService` calls Genkit with selected provider/model; validates JSON output.
  3) Returns `{ widthCm, heightCm }` to UI.

- Segmentation (AI #2)
  1) `/api/segment` receives image bytes.
  2) `SegmentationService` attempts in order:
     - Local FastAPI Mask2Former (RAW per-class masks)
     - HF Mask2Former (synthesize RAW if needed)
     - HF SegFormer (last resort; derive masks by label)
  3) Node post-processing composes final PNG with alpha using env-tuned params.
  4) Returns `final_mask.png` (and optional diagnostics when debug enabled).

## Environment & Config (shared)
- Centralize in `packages/shared/env.ts` (zod-validated): provider IDs, service URLs, timeouts, post-process params, HF token, upload limits.

## Observability
- Single logger (pino) used by adapters and core.
- Request ID propagation; timing and error metrics (OpenTelemetry later if needed).

## Security & Performance Notes
- Run Next on containers/VMs with Node runtime (avoid short serverless timeouts for large images).
- Segment uploads limited (e.g., 15–20 MB), and processing timeouts controlled.
- Rate limit `/api/segment`; cache HF fallbacks.
