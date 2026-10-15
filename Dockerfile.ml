# ==============================================================================
# RailMadad Cloud-API Multimodal AI Service Dockerfile
# Ultra-lightweight (No in-memory PyTorch models - 100% Cloud API powered)
# ==============================================================================

FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Install FFmpeg, OpenGL libraries for OpenCV headless, and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements-ml.txt ./

RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements-ml.txt

COPY ml_service.py ./
COPY backend/agents ./backend/agents

EXPOSE 8000

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "ml_service.py"]
