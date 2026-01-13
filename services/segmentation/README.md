# Segmentation Service (FastAPI + Mask2Former)

Lightweight FastAPI service that exposes a single `/segment` endpoint backed by Hugging Face Transformers Mask2Former (Swin‑Large, ADE20K). It runs on NVIDIA CUDA, Apple MPS (M‑series), or CPU.

Endpoints
- `GET /` → `{ ok: true, device, loaded }`
- `POST /segment` (octet‑stream body)
  - Headers:
    - `X-Model: mask2former_ade20k`
    - `X-Mask: combined|wall|window|attached` (default: combined)
    - `X-Threshold: 0.6` (not critical for class maps)
    - `X-Scale-Long-Side: 768` (optional) — downscale long side before inference; 0 disables; min 64
    - Optional: `X-Debug: 1`, `X-Reload: 1`, `X-Labels: csv`
  - Response: PNG RGBA where mask=alpha 0, background alpha 255
  - Response headers include diagnostics: `X-Device`, `X-ModelDevice`, `X-InputDevice`, `X-Scale-*`

Local run (Python venv)
- cd services/segmentation
- python3 -m venv .venv
- . .venv/bin/activate
- pip install --upgrade pip
- pip install -r requirements.txt
- uvicorn main:app --host 127.0.0.1 --port 8000 --reload

Docker (CUDA host)
- docker build -t cw-segmentation:gpu .
- docker run --rm --gpus all -p 8000:8000 cw-segmentation:gpu

Notes
- Uses Apple MPS when available (PyTorch `mps`).
- SciPy is required by Mask2Former loss utilities in Transformers; included in `requirements.txt`.
 - Default pre-scale is controlled by env `M2F_LONG_SIDE` (default `768`). Set to `0` to disable. Header `X-Scale-Long-Side` overrides env per request.
