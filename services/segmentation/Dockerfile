# GPU-enabled FastAPI segmentation service (Mask2Former only)
# Requires NVIDIA Container Toolkit on host for CUDA
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create venv
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy and install requirements
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt \
    && pip install torch --extra-index-url https://download.pytorch.org/whl/cu121

# Copy app
COPY main.py ./

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

