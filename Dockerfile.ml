# ==============================================================================
# RailMadad Multimodal AI & ML Service Dockerfile
# Python Flask + Whisper + BLIP + Vision LLM
# ==============================================================================

FROM python:3.10-slim

# Prevent Python from writing .pyc and buffer outputs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Install required system dependencies: FFmpeg, OpenGL, curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirement definition
COPY requirements-ml.txt ./

# Upgrade pip and install Python packages
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements-ml.txt

# Copy ML service script and verification agent package
COPY ml_service.py ./
COPY backend/agents ./backend/agents

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "ml_service.py"]
