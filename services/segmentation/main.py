"""
Curtain Wizard Segmentation Service - Core AI #2
-------------------------------------------------
Fast, reliable Mask2Former segmentation for curtain visualization.

Endpoints:
  POST /segment       - Single mask (wall+window+attached union)  
  POST /segment-batch - All masks in one inference (4x faster)
  GET  /              - Health check
  GET  /device        - Device info

IMPORTANT: Experimental /measure endpoint moved to experimental/local-cv branch
           to preserve core segmentation performance (40s→4s restoration).
"""

import io
import os
import time
from typing import List

import numpy as np
from fastapi import FastAPI, Request, Response, HTTPException
from PIL import Image
import base64

# Lazy globals
processor = None
model = None
loaded_key = None

app = FastAPI(title="Segmentation Service (Mask2Former)", version="0.3.0")

# Device selection: CUDA → MPS → CPU
import torch
try:
    if torch.cuda.is_available():
        DEVICE = "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        DEVICE = "mps"
    else:
        DEVICE = "cpu"
except Exception:
    DEVICE = "cpu"


WALLISH = {"wall"}
WINDOWISH = {"window", "windowpane", "glass", "sliding door", "french door", "patio door", "balcony door", "balcony window", "door"}
ATTACHED = {
    "curtain", "curtains", "drape", "drapery", "blinds", "shade", "roller blind", "venetian blind", "rod", "hanger",
    "sconce", "lamp", "socket", "switch", "outlet", "radiator", "heater", "vent", "air conditioner",
    "mirror", "painting", "paintings", "picture", "pictures", "poster", "posters", "frame", "frames", "clock", "tv",
    "shelf", "shelves", "bookcase", "bookcases", "bookshelf", "bookshelves",
    "plant", "plants", "potted plant"
}
FLOORISH = {
    "floor", "floor-wood", "floor-marble", "floor-tile", "floor-stone", "floor-mat", "floor-other",
    "rug", "carpet", "mat", "carpet tile", "floor mat"
}
CEILINGISH = {
    "ceiling", "ceiling-white", "roof", "ceiling-other"
}


def _device_string() -> str:
    try:
        if DEVICE == "cuda" and torch.cuda.is_available():
            idx = torch.cuda.current_device() if torch.cuda.device_count() > 0 else 0
            name = torch.cuda.get_device_name(idx)
            return f"cuda:{idx} ({name})"
        if DEVICE == "mps" and hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps:0"
    except Exception:
        pass
    return DEVICE or "cpu"


def mask_from_labels(seg: np.ndarray, id2label: dict, keep: List[str]) -> np.ndarray:
    keep_set = {str(k).lower() for k in keep}
    h, w = seg.shape
    out = np.zeros((h, w), dtype=np.uint8)
    label2ids = {}
    for k, v in id2label.items():
        name = str(v).lower()
        label2ids.setdefault(name, []).append(int(k))
    keep_ids = set()
    for name in keep_set:
        if name in label2ids:
            keep_ids.update(label2ids[name])
    for idx in keep_ids:
        out[seg == idx] = 255
    return out


def rgba_png_from_binary_mask(mask: np.ndarray) -> bytes:
    if mask.dtype != np.uint8:
        mask = mask.astype(np.uint8)
    h, w = mask.shape
    rgba = np.ones((h, w, 4), dtype=np.uint8) * 255
    rgba[..., 3] = np.where(mask > 0, 0, 255).astype(np.uint8)
    img = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def load_mask2former_ade20k():
    global processor, model
    from transformers import AutoImageProcessor, Mask2FormerForUniversalSegmentation
    ckpt = os.environ.get("MASK2FORMER_CKPT", "facebook/mask2former-swin-large-ade-semantic")
    processor = AutoImageProcessor.from_pretrained(ckpt)
    model = Mask2FormerForUniversalSegmentation.from_pretrained(ckpt).to(DEVICE).eval()
    try:
        _ = next(model.parameters()).device
        print(f"[load] Mask2Former loaded to {_device_string()}")
    except Exception:
        print(f"[load] Mask2Former loaded to {_device_string()}")


@app.post("/segment")
async def segment(request: Request):
    global loaded_key
    t0 = time.time()
    model_key = (request.headers.get("X-Model") or "").strip()
    reload_flag = (request.headers.get("X-Reload") or "0").strip().lower() in {"1", "true", "yes", "on"}
    x_mask = (request.headers.get("X-Mask") or "combined").strip().lower()
    labels_header = (request.headers.get("X-Labels") or "").strip()
    if not model_key:
        raise HTTPException(status_code=400, detail="Missing X-Model header")
    if model_key != "mask2former_ade20k":
        raise HTTPException(status_code=400, detail=f"Unknown model '{model_key}' (only 'mask2former_ade20k' is supported)")

    raw = await request.body()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty body (expected image bytes)")
    try:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot decode image: {e}")

    if reload_flag or loaded_key != model_key:
        load_mask2former_ade20k()
        loaded_key = model_key

    # Optional long-side pre-scale for inference (header overrides env). 0 disables.
    try:
        scale_hdr = request.headers.get("X-Scale-Long-Side")
        env_long = int(os.environ.get("M2F_LONG_SIDE", "768"))
        long_side = int(scale_hdr) if scale_hdr is not None and str(scale_hdr).strip() != "" else env_long
        print(f"[seg] X-Scale-Long-Side header: {scale_hdr}, env M2F_LONG_SIDE: {os.environ.get('M2F_LONG_SIDE', 'not set')}, using: {long_side}")
    except Exception as e:
        long_side = 768
        print(f"[seg] Scale header parse error: {e}, using default: {long_side}")
    long_side = int(long_side)

    assert processor is not None and model is not None
    with torch.inference_mode():
        infer_img = img
        print(f"[seg] Original image size: {img.width}x{img.height}")
        if long_side > 0:
            LW = max(img.width, img.height)
            target = max(64, long_side)
            print(f"[seg] Long side={LW}, target={target}, will_resize={LW > target}")
            if LW > target:
                if img.width >= img.height:
                    new_w, new_h = target, max(1, round(img.height * target / img.width))
                else:
                    new_h, new_w = target, max(1, round(img.width * target / img.height))
                try:
                    infer_img = img.resize((int(new_w), int(new_h)), Image.LANCZOS)
                    print(f"[seg] Resized to: {infer_img.width}x{infer_img.height}")
                except Exception as e:
                    infer_img = img
                    print(f"[seg] Resize failed: {e}")
        else:
            print(f"[seg] Scaling disabled (long_side={long_side})")

        inputs = processor(images=infer_img, return_tensors="pt").to(DEVICE)
        outputs = model(**inputs)
        # Use inference size for post-processing, not original size (much faster)
        seg_list = processor.post_process_semantic_segmentation(
            outputs, target_sizes=[(infer_img.height, infer_img.width)]
        )
        seg = seg_list[0].cpu().numpy()
        print(f"[seg] Segmentation output size: {seg.shape}")

    def _parse_labels(lbls: str):
        return [x.strip() for x in lbls.split(',') if x.strip()]

    wall_set = _parse_labels(labels_header) if labels_header and x_mask == "wall" else list(WALLISH)
    window_set = _parse_labels(labels_header) if labels_header and x_mask == "window" else list(WINDOWISH)
    attached_set = _parse_labels(labels_header) if labels_header and x_mask == "attached" else list(ATTACHED)

    wall_mask = mask_from_labels(seg, model.config.id2label, wall_set)
    window_mask = mask_from_labels(seg, model.config.id2label, window_set)
    attached_mask = mask_from_labels(seg, model.config.id2label, attached_set)

    if x_mask == "wall":
        out_mask = wall_mask
    elif x_mask == "window":
        out_mask = window_mask
    elif x_mask == "attached":
        out_mask = attached_mask
    else:
        out_mask = np.where((wall_mask > 0) | (window_mask > 0) | (attached_mask > 0), 255, 0).astype(np.uint8)

    png_bytes = rgba_png_from_binary_mask(out_mask)

    try:
        _mdev = str(next(model.parameters()).device)
    except Exception:
        _mdev = "unknown"
    try:
        _idev = str(inputs.get("pixel_values").device if hasattr(inputs, "get") else inputs["pixel_values"].device)
    except Exception:
        _idev = "unknown"
    headers = {
        "X-Device": _device_string(),
        "X-ModelDevice": _mdev,
        "X-InputDevice": _idev,
    }
    try:
        headers["X-Scale-Applied"] = "1" if infer_img is not img else "0"
        if infer_img is not img:
            headers["X-Scale-Size"] = f"{infer_img.width}x{infer_img.height}"
            headers["X-Scale-Long-Side"] = str(max(infer_img.width, infer_img.height))
        else:
            headers["X-Scale-Long-Side"] = str(max(img.width, img.height))
    except Exception:
        pass
    try:
        headers["X-Elapsed-MS"] = str(int((time.time() - t0) * 1000))
        print(f"[seg] OK model={model_key} device={headers.get('X-Device','?')} elapsed_ms={headers['X-Elapsed-MS']}")
    except Exception:
        pass
    return Response(content=png_bytes, media_type="image/png", headers=headers)


@app.post("/segment-batch")
async def segment_batch(request: Request):
    """
    PERFORMANCE OPTIMIZED: Return all masks (wall, floor, ceiling, window) from ONE inference.
    This is 4× faster than calling /segment four times sequentially.
    
    Returns JSON with base64-encoded PNG masks instead of a single PNG response.
    """
    global loaded_key
    t0 = time.time()
    model_key = (request.headers.get("X-Model") or "").strip()
    reload_flag = (request.headers.get("X-Reload") or "0").strip().lower() in {"1", "true", "yes", "on"}
    
    if not model_key:
        raise HTTPException(status_code=400, detail="Missing X-Model header")
    if model_key != "mask2former_ade20k":
        raise HTTPException(status_code=400, detail=f"Unknown model '{model_key}' (only 'mask2former_ade20k' is supported)")

    raw = await request.body()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty body (expected image bytes)")
    
    # Safety check: reject uploads >50MB to prevent memory issues
    if len(raw) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Image too large: {len(raw)/(1024*1024):.1f}MB (max 50MB)")
    
    try:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
        # Verify image dimensions are reasonable
        if img.width * img.height > 50_000_000:  # ~7000x7000 pixels max
            raise ValueError(f"Image dimensions too large: {img.width}x{img.height} pixels")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot decode image: {e}")

    if reload_flag or loaded_key != model_key:
        load_mask2former_ade20k()
        loaded_key = model_key

    # Optional long-side pre-scale for inference
    try:
        scale_hdr = request.headers.get("X-Scale-Long-Side")
        env_long = int(os.environ.get("M2F_LONG_SIDE", "768"))
        long_side = int(scale_hdr) if scale_hdr is not None and str(scale_hdr).strip() != "" else env_long
    except Exception:
        long_side = 768
    long_side = int(long_side)

    assert processor is not None and model is not None
    
    # SINGLE MODEL INFERENCE - this is the expensive operation
    try:
        with torch.inference_mode():
            infer_img = img
            if long_side > 0:
                LW = max(img.width, img.height)
                target = max(64, long_side)
                if LW > target:
                    if img.width >= img.height:
                        new_w, new_h = target, max(1, round(img.height * target / img.width))
                    else:
                        new_h, new_w = target, max(1, round(img.width * target / img.height))
                    try:
                        infer_img = img.resize((int(new_w), int(new_h)), Image.LANCZOS)
                    except Exception:
                        infer_img = img
            
            inputs = processor(images=infer_img, return_tensors="pt").to(DEVICE)
            outputs = model(**inputs)
            seg_list = processor.post_process_semantic_segmentation(
                outputs, target_sizes=[(img.height, img.width)]
            )
            seg = seg_list[0].cpu().numpy()
    except RuntimeError as e:
        if "Invalid buffer size" in str(e) or "out of memory" in str(e).lower():
            raise HTTPException(status_code=422, detail=f"Image caused GPU/memory error - try smaller image or different format: {e}")
        raise HTTPException(status_code=500, detail=f"Model inference failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Segmentation processing failed: {e}")

    # Extract all masks from the SAME segmentation result (cheap operations)
    try:
        wall_mask = mask_from_labels(seg, model.config.id2label, list(WALLISH))
        window_mask = mask_from_labels(seg, model.config.id2label, list(WINDOWISH))
        floor_mask = mask_from_labels(seg, model.config.id2label, list(FLOORISH))
        ceiling_mask = mask_from_labels(seg, model.config.id2label, list(CEILINGISH))
        
        # Sanity check mask dimensions
        for name, mask in [("wall", wall_mask), ("window", window_mask), ("floor", floor_mask), ("ceiling", ceiling_mask)]:
            if mask.shape[0] != img.height or mask.shape[1] != img.width:
                raise ValueError(f"{name} mask dimension mismatch: {mask.shape} vs image {img.height}x{img.width}")
            if mask.nbytes > 100 * 1024 * 1024:  # 100MB sanity check
                raise ValueError(f"{name} mask too large: {mask.nbytes/(1024*1024):.1f}MB")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mask extraction failed: {e}")

    # Convert to PNG bytes
    try:
        wall_png = rgba_png_from_binary_mask(wall_mask)
        window_png = rgba_png_from_binary_mask(window_mask)
        floor_png = rgba_png_from_binary_mask(floor_mask)
        ceiling_png = rgba_png_from_binary_mask(ceiling_mask)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PNG encoding failed: {e}")

    # Return all masks as JSON with base64-encoded PNGs
    import json as _json
    try:
        payload = {
            "wall": base64.b64encode(wall_png).decode("utf-8"),
            "floor": base64.b64encode(floor_png).decode("utf-8"),
            "ceiling": base64.b64encode(ceiling_png).decode("utf-8"),
            "window": base64.b64encode(window_png).decode("utf-8"),
            "width": int(img.width),
            "height": int(img.height),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Base64 encoding failed: {e}")

    elapsed_ms = int((time.time() - t0) * 1000)
    try:
        print(f"[seg-batch] OK device={_device_string()} elapsed_ms={elapsed_ms} masks=4")
    except Exception:
        pass

    headers = {
        "X-Device": _device_string(),
        "X-Elapsed-MS": str(elapsed_ms),
    }
    
    return Response(
        content=_json.dumps(payload).encode("utf-8"),
        media_type="application/json",
        headers=headers
    )


@app.get("/")
async def root():
    return {"ok": True, "device": _device_string(), "loaded": loaded_key}


@app.get("/device")
async def device_info():
    try:
        import torch as _torch
        cuda = bool(_torch.cuda.is_available())
        mps = bool(hasattr(_torch.backends, "mps") and _torch.backends.mps.is_available())
        cuda_name = None
        cuda_index = None
        if cuda:
            try:
                cuda_index = _torch.cuda.current_device() if _torch.cuda.device_count() > 0 else 0
                cuda_name = _torch.cuda.get_device_name(cuda_index)
            except Exception:
                pass
        return {
            "device": _device_string(),
            "backend": DEVICE,
            "cuda": cuda,
            "cudaIndex": cuda_index,
            "cudaName": cuda_name,
            "mps": mps,
            "loadedModel": loaded_key,
        }
    except Exception:
        return {"device": _device_string(), "backend": DEVICE, "loadedModel": loaded_key}
