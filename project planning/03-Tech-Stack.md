# Curtain Wizard — Tech Stack

## Frontend (apps/web)
- Next.js 15 (App Router), Node runtime (not serverless-limited), TypeScript.
- React 18 (upgrade path to 19 after launch), ShadCN UI, Tailwind CSS.
- Canvas-based curtain renderer (from ZaslonAIzer), image upload, 4-corner selection.

## Backend-in-App (BFF)
- Next.js API routes and server actions as thin adapters calling `packages/core`.
- `sharp` and `image-js` for image handling where needed.
- `zod` for request/response validation; `pino` for logging.

## AI #1 (Measurement)
- Genkit with pluggable providers via env:
  - GoogleAI (Gemini 2.x flash-lite) — default.
  - OpenAI o3 family — alternative.
- Strict JSON schema for `{ wallWidthCm, wallHeightCm }`.

## AI #2 (Segmentation)
- Python FastAPI service on GPU (NVIDIA runtime, Docker):
  - Mask2Former ADE20K (Transformers). No MMSeg, no Xenova.
  - Endpoint returns RAW per-class masks (wall/window/attached) as PNGs.
- Fallbacks (when local fails):
  - HF Mask2Former (facebook/mask2former-swin-large-ade-semantic)
  - HF SegFormer (nvidia/segformer-b5-finetuned-ade-640-640)

## Post-Processing (Node)
- Single composition pipeline in Node builds final PNG alpha mask from RAW masks.
- Tunable env params (examples):
  - `SEG_LONG_SIDE`, `SEG_WALL_MERGE_RADIUS`, `SEG_FILL_HOLES`, `SEG_HOLES_MAX_AREA_PCT`,
    `SEG_HOLES_BRIDGE_RADIUS`, `SEG_HOLES_BRIDGE_CAP`, `SEG_ATTACH_CONTACT_PCT`,
    `SEG_CONTACT_ANISO`, `SEG_SMOOTH`, `SEG_BYPASS_SUPPORT`,
    `SEG_MIN_AREA_PCT`, `SEG_MAX_AREA_PCT`, `SEG_HF_MIN_SCORE`.

## Packages & Libraries (indicative)
- Web: `next`, `react`, `typescript`, `tailwindcss`, `zod`, `pino`, `sharp`, `image-js`.
- Genkit: `genkit`, `@genkit-ai/googleai`, `genkitx-openai`.
- Python service: `fastapi`, `uvicorn`, `torch`, `transformers`, `Pillow`, `numpy`.
- Fallback client: `@huggingface/inference` (token via env).

## Build & Deploy
- Docker images for Next and FastAPI.
- `docker compose` for local dev with GPU (`--gpus all`).
- Health checks: Next (`/api/healthz`) and FastAPI (`/healthz`).

## Configuration (shared types)
- Define `Env` (zod) in `packages/shared`: URLs, tokens, model IDs, timeouts, size limits, post-process params.
- Provide `.env.example` and a short RUNBOOK in `/docs`.

