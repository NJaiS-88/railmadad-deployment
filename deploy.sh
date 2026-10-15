#!/usr/bin/env bash
# ==============================================================================
# RailMadad Automated Production Deployment Script (Linux / macOS)
# ==============================================================================
set -e

echo "🚆 =================================================================="
echo "🚆 Starting RailMadad Production Deployment"
echo "🚆 =================================================================="

# 1. Check for .env file
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "⚠️  No .env file found. Copying from .env.example..."
    cp .env.example .env
    echo "❗ Please edit .env with your real API keys before running in production!"
  else
    echo "❌ Error: Neither .env nor .env.example found."
    exit 1
  fi
fi

# 2. Check for Docker
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "🐳 Docker & Docker Compose detected. Starting containerized deployment..."
  docker compose down --remove-orphans || true
  docker compose build --pull
  docker compose up -d
  echo "✅ Docker deployment completed successfully!"
  echo ""
  echo "Service Endpoints:"
  echo "  • Unified Gateway (Nginx): http://localhost"
  echo "  • Passenger Portal:       http://localhost:5173"
  echo "  • Officer Dashboard:      http://localhost:5174"
  echo "  • Staff Portal:           http://localhost:5175"
  echo "  • Backend REST API:       http://localhost:5000/api"
  echo "  • Multimodal AI (ML):     http://localhost:8000"
  echo "  • AI Classification:      http://localhost:8001"
  echo "  • AI Staff Assignment:    http://localhost:8002"
  echo ""
  echo "To view live logs: docker compose logs -f"
  exit 0
fi

# 3. Fallback: Local / PM2 Deployment
echo "⚠️  Docker not found. Falling back to native PM2 / Node + Python environment..."

# Build frontends
echo "📦 Building Passenger Portal..."
npm --prefix rail-madad-frontend/frontend-passenger run build

echo "📦 Building Officer Dashboard..."
npm --prefix rail-madad-frontend/frontend-officer run build

echo "📦 Building Staff Portal..."
npm --prefix rail-madad-frontend/frontend-staff run build

# Check for PM2
if command -v pm2 >/dev/null 2>&1; then
  echo "🚀 Launching microservices with PM2..."
  pm2 start ecosystem.config.js
  pm2 save
  echo "✅ All services running under PM2!"
  pm2 status
else
  echo "ℹ️  PM2 not found. Install pm2 globally with: npm install -g pm2"
  echo "   Or start services manually using 'npm run start:backend' & Python scripts."
fi

echo "🚆 =================================================================="
echo "🚆 Deployment script finished"
echo "🚆 =================================================================="
