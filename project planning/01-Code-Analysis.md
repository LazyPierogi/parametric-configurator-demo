# Curtain Wizard — Code Analysis

Purpose: unify two PoCs into a single production-ready Curtain Wizard with a split-ready architecture. Below is a concise analysis of what to reuse, what to retire, and why.

## Summary
- Reuse the strongest server-side segmentation path (Python FastAPI Mask2Former) and the robust Node post-processing pipeline.
- Reuse ZaslonAIzer’s UI flow (Estimation Wizard + Curtain Configurator), Genkit flow for AI #1, and canvas renderer.
- Remove browser/client-side depth/segmentation PoC, Xenova/ORT assets, and MMSeg code paths.
- Default to GPU-first local Mask2Former. Fallback to HF Mask2Former, then HF SegFormer.

## Repository Findings

### curtain-visualizer
- Strengths:
  - Node post-processing (`lib/segmentation.ts`) for union of wall/window/attached with tunable heuristics (hole filling, wall merge, contact-based inclusion, smoothing, support gating).
  - Next.js API routes for segmentation including batch debug tools.
  - Local GPU segmentation service (now `services/segmentation`, previously `local-infer/`) with Mask2Former and MMSeg support.
  - Clear diagnostics and env-driven behavior.
- Weaknesses / To change:
  - Multiple model families and thresholds sprinkled across client/server. For the new pipeline we’ll always fetch RAW per-class masks and do all post-processing in Node.
  - MMSeg support no longer needed.
- Status: legacy `curtain-visualizer` source folder was removed after Tasks 1001/1003; keep references confined to docs.

### ZaslonAIzer
- Strengths:
  - Complete UI flow: upload, AI measurement, curtain configuration with 4-corner selection and layered render.
  - Genkit integration for AI #1 with a clean, structured prompt returning JSON.
  - Solid set of UI components (ShadCN/Tailwind) and UX affordances.
- Weaknesses / To change:
  - Client-side segmentation PoC (Depth Anything + ONNX wall model + matting) is superseded.
  - Various ORT runtime files and models are not needed in the production path.

## What We Will Reuse
- UI/UX from ZaslonAIzer (pages/components, canvas curtain rendering, wizard flow).
- Genkit flow for AI #1 (dimension estimation). Extend to multi-provider and keep strict schema.
- FastAPI Mask2Former service (GPU) now under `services/segmentation` (Mask2Former-only).
- Node post-processing pipeline at packages/core/src/lib/segmentation.ts (retains all key parameters; runs after fetching RAW masks).

## What We Will Remove (carefully)
- Client-side depth/segmentation and ONNX web assets in ZaslonAIzer: `src/lib/depth/*`, `src/services/segmentation.ts`, `/public/ort*`, `/public/models/*`, and `app/api/local-seg/route.ts`. (Removed during Tasks 1001/1003 cleanup.)
- MMSeg, UPerNet, and related code paths from Python service.
- Xenova/ORT-based fallbacks.

## Target Segmentation Flow
1) Upload image to Next API `/api/segment`.
2) Next fetches RAW per-class masks (wall/window/attached) from local FastAPI Mask2Former.
3) Node `segmentation.ts` composes and post-processes the final alpha PNG using environment-controlled parameters (no server-side thresholding).
4) Fallback order when local is unavailable or fails: HF Mask2Former → HF SegFormer.

## Gaps / Open Points
- Confirm default post-processing parameters (fill holes, merge radius, contact fraction, long-side resize).
- Confirm hosting for the GPU service (Docker + NVIDIA runtime) and where it will run (same VPC/host).
- Confirm preferred default AI #1 provider and model IDs.

## Risks & Mitigations
- Risk: Later need to expose a public API to partners.
  - Mitigation: implement Next as a BFF but keep business logic in `packages/core`; routes remain thin.
- Risk: GPU service availability.
  - Mitigation: health checks, retries, and well-documented HF fallbacks with rate/timeouts.
- Risk: Over-cleaning code during pruning.
  - Mitigation: branch and remove in phases with a rollback plan and smoke tests.
