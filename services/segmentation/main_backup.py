import io
import os
import time
from typing import List, Optional, Optional

import numpy as np
from fastapi import FastAPI, Request, Response, HTTPException
from PIL import Image
import base64
import cv2

# Lazy globals
processor = None
model = None
loaded_key = None

app = FastAPI(title="Segmentation Service (Mask2Former)", version="0.2.0")

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


def _b64_png(img_arr: np.ndarray) -> str:
    try:
        if img_arr.ndim == 2:
            mode = "L"
        elif img_arr.shape[2] == 3:
            mode = "RGB"
        else:
            mode = "RGBA"
        pil = Image.fromarray(img_arr, mode=mode)
        buf = io.BytesIO()
        pil.save(buf, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception:
        return ""


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
    except Exception:
        long_side = 768
    long_side = int(long_side)

    assert processor is not None and model is not None
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


def _largest_component_bbox(binary: np.ndarray) -> tuple:
    nb, _, stats, _ = cv2.connectedComponentsWithStats((binary > 0).astype(np.uint8), connectivity=8)
    if nb <= 1:
        return (0, 0, binary.shape[1], binary.shape[0])
    areas = stats[1:, cv2.CC_STAT_AREA]
    idx = 1 + int(np.argmax(areas))
    x = int(stats[idx, cv2.CC_STAT_LEFT])
    y = int(stats[idx, cv2.CC_STAT_TOP])
    w = int(stats[idx, cv2.CC_STAT_WIDTH])
    h = int(stats[idx, cv2.CC_STAT_HEIGHT])
    return (x, y, w, h)


def _order_corners_clockwise(pts: np.ndarray) -> np.ndarray:
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).reshape(-1)
    tl = np.argmin(s)
    br = np.argmax(s)
    tr = np.argmin(diff)
    bl = np.argmax(diff)
    ordered = np.array([pts[tl], pts[tr], pts[br], pts[bl]], dtype=np.float32)
    return ordered


def _detect_a4_quad(img_bgr: np.ndarray, roi_mask: np.ndarray) -> Optional[np.ndarray]:
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    if roi_mask is not None:
        gray = cv2.bitwise_and(gray, gray, mask=roi_mask)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 50, 150)
    cnts, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    best_score = -1.0
    area_lo = 0.002 * (w * h)
    area_hi = 0.4 * (w * h)
    R_LONG = 297 / 210.0
    R_SHORT = 210 / 297.0
    for c in cnts:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) != 4:
            continue
        quad = approx.reshape(-1, 2).astype(np.float32)
        if not cv2.isContourConvex(approx):
            continue
        area = abs(cv2.contourArea(approx))
        if area < area_lo or area > area_hi:
            continue
        def edge_len(a, b):
            return float(np.hypot(a[0]-b[0], a[1]-b[1]))
        e01 = edge_len(quad[0], quad[1])
        e12 = edge_len(quad[1], quad[2])
        e23 = edge_len(quad[2], quad[3])
        e30 = edge_len(quad[3], quad[0])
        width_px = 0.5 * (e01 + e23)
        height_px = 0.5 * (e12 + e30)
        if width_px < 10 or height_px < 10:
            continue
        ratio = width_px / max(1e-6, height_px)
        d_long = abs(ratio - R_LONG)
        d_short = abs(ratio - R_SHORT)
        ratio_score = -min(d_long, d_short)
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.drawContours(mask, [approx], -1, 255, thickness=-1)
        if roi_mask is not None:
            mask = cv2.bitwise_and(mask, roi_mask)
        mean_val = cv2.mean(gray, mask=mask)[0]
        white_score = (mean_val / 255.0)
        score = ratio_score + 0.5 * white_score
        if score > best_score:
            best_score = score
            best = quad
    if best is not None:
        ordered = _order_corners_clockwise(best)
        return ordered
    return None


@app.post("/measure")
async def measure(request: Request):
    t0 = time.time()
    raw = await request.body()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty body (expected image bytes)")
    try:
        img = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot decode image: {e}")

    global loaded_key
    if loaded_key != "mask2former_ade20k" or model is None or processor is None:
        load_mask2former_ade20k()
        loaded_key = "mask2former_ade20k"

    try:
        scale_hdr = request.headers.get("X-Scale-Long-Side")
        env_long = int(os.environ.get("M2F_LONG_SIDE", "768"))
        long_side = int(scale_hdr) if scale_hdr is not None and str(scale_hdr).strip() != "" else env_long
    except Exception:
        long_side = 768
    long_side = int(max(64, long_side))

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

    wall_mask = mask_from_labels(seg, model.config.id2label, list(WALLISH))
    window_mask = mask_from_labels(seg, model.config.id2label, list(WINDOWISH))
    attached_mask = mask_from_labels(seg, model.config.id2label, list(ATTACHED))
    combined = np.where((wall_mask > 0) | (window_mask > 0) | (attached_mask > 0), 255, 0).astype(np.uint8)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=1)
    try:
        inv = cv2.bitwise_not(closed)
        flood = inv.copy()
        h_, w_ = inv.shape
        mask = np.zeros((h_ + 2, w_ + 2), np.uint8)
        cv2.floodFill(flood, mask, (0, 0), 0)
        filled = cv2.bitwise_not(flood)
    except Exception:
        filled = closed
    x, y, bw, bh = _largest_component_bbox(filled)

    img_bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    roi = np.zeros_like(combined)
    cv2.rectangle(roi, (x, y), (x + bw, y + bh), 255, thickness=-1)
    roi = cv2.bitwise_and(roi, filled)
    a4 = _detect_a4_quad(img_bgr, roi)
    if a4 is None:
        raise HTTPException(status_code=422, detail="A4 not detected; ensure a visible A4 sheet on the wall with moderate skew and contrast.")

    def dist(a, b):
        return float(np.hypot(a[0]-b[0], a[1]-b[1]))
    e01 = dist(a4[0], a4[1])
    e12 = dist(a4[1], a4[2])
    e23 = dist(a4[2], a4[3])
    e30 = dist(a4[3], a4[0])
    width_px = 0.5 * (e01 + e23)
    height_px = 0.5 * (e12 + e30)
    ratio = width_px / max(1e-6, height_px)
    R_LONG = 297/210.0
    R_SHORT = 210/297.0
    d_long = abs(ratio - R_LONG)
    d_short = abs(ratio - R_SHORT)
    if d_long <= d_short:
        px_per_cm = ((width_px / 29.7) + (height_px / 21.0)) / 2.0
    else:
        px_per_cm = ((width_px / 21.0) + (height_px / 29.7)) / 2.0
    if not np.isfinite(px_per_cm) or px_per_cm <= 0:
        raise HTTPException(status_code=422, detail="Scale computation failed (invalid pxPerCm)")

    w_px = max(0, (x + bw) - x)
    h_px = max(0, (y + bh) - y)
    w_cm = round((w_px / px_per_cm) * 2) / 2.0
    h_cm = round((h_px / px_per_cm) * 2) / 2.0
    if not (w_cm > 0 and h_cm > 0):
        raise HTTPException(status_code=422, detail="Computed non-positive dimensions")

    payload = {
        "wallWidthCm": float(w_cm),
        "wallHeightCm": float(h_cm),
    }

    x_debug = (request.headers.get("X-Debug") or "0").strip().lower() in {"1", "true", "yes", "on"}
    if x_debug:
        overlay = img_bgr.copy()
        a4_int = a4.astype(int)
        cv2.polylines(overlay, [a4_int], isClosed=True, color=(0, 255, 0), thickness=2)
        cv2.rectangle(overlay, (x, y), (x + bw, y + bh), (255, 0, 0), 2)
        payload["debug"] = {
            "a4Corners": a4.astype(float).tolist(),
            "wallBounds": {"left": int(x), "top": int(y), "right": int(x + bw), "bottom": int(y + bh)},
            "pxPerCm": float(px_per_cm),
            "thumbs": {
                "maskWall": _b64_png(wall_mask),
                "maskWindow": _b64_png(window_mask),
                "maskAttached": _b64_png(attached_mask),
                "maskCombined": _b64_png(combined),
                "a4Overlay": _b64_png(cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB)),
            },
        }

    headers = {}
    try:
        headers["X-Device"] = _device_string()
        headers["X-Elapsed-MS"] = str(int((time.time() - t0) * 1000))
        headers["X-Scale-Long-Side"] = str(long_side)
        print(f"[measure] OK device={headers.get('X-Device','?')} elapsed_ms={headers['X-Elapsed-MS']} w_cm={w_cm} h_cm={h_cm}")
    except Exception:
        pass
    import json as _json
    return Response(content=_json.dumps(payload).encode("utf-8"), media_type="application/json", headers=headers)


@app.get("/")
async def root():
    return {"ok": True, "device": _device_string(), "loaded": loaded_key}
