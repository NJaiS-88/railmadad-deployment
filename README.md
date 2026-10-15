# 🚆 Rail Madad - AI-Powered Passenger Grievance & Assistance Platform

An end-to-end AI-integrated Railway Grievance Redressal and Assistance Platform designed for Indian Railways. Features multimodal AI complaint generation (Image, Spoken Audio, and Video), live tracking, and staff management portals.

---

## 🌟 Key Features

- **📷 Image → Text AI**: Powered by **OpenRouter AI Multimodal Vision** with cloud API fallback.
- **🎙️ Audio → Text AI**: Powered by **OpenAI Whisper ASR** for automatic speech recognition.
- **🎥 Multimodal Video AI**: Automatic audio transcription + visual scene captioning using FFmpeg transcoding pipelines.
- **🎫 Real-time Tracking & Staff Management**: Integrated Express/MongoDB backend for tracking ticket statuses and staff resolution proof uploads.

---

## 📁 Repository Architecture

```text
RailMadad/
├── backend/                             # Node.js Express REST API server
├── ml_service.py                        # Python Flask Multimodal AI ML Service
├── rail-madad-frontend/
│   ├── frontend-passenger/              # Vite + React Passenger Portal
│   └── frontend-staff/                  # Vite + React Railway Staff Portal
├── .env.example                         # Environment Variables Template
├── .gitignore                           # Git ignore rules for node_modules, .env & media
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: `v18+`
- **Python**: `v3.10+`
- **FFmpeg**: System binary installed and added to your `PATH`.

---

### 2. Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Set your environment keys inside `.env`:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```

---

### 3. Running Services

#### 🐍 A. Python Multimodal AI Service (Port 8000)
```bash
# Install required Python packages
pip install flask flask-cors torch transformers pillow openai imageio-ffmpeg openai-whisper python-dotenv opencv-python

# Run ML Service
python ml_service.py
```

#### 🟢 B. Node.js Express Backend (Port 5000)
```bash
cd backend
npm install
npm run dev
```

#### ⚛️ C. Passenger Frontend Portal
```bash
cd rail-madad-frontend/frontend-passenger
npm install
npm run dev
```

#### 👨‍✈️ D. Staff Frontend Portal
```bash
cd rail-madad-frontend/frontend-staff
npm install
npm run dev
```

#### 🛡️ E. Officer Dashboard Portal
```bash
cd rail-madad-frontend/frontend-officer
npm install
npm run dev
```

---

## 🐳 Production Deployment (One Command)

The entire platform is fully containerized and production-ready with Docker Compose and Nginx Ingress:

```bash
# 1. Setup environment file
cp .env.example .env

# 2. Build and run all microservices with one command
docker compose up -d --build
```

For complete cloud VPS, PM2, MongoDB Atlas, and SSL/HTTPS instructions, read the comprehensive [Production Deployment Guide](DEPLOYMENT.md).

---

## 🛠️ GitHub Push Checklist

Before pushing to GitHub, make sure your `.env` containing sensitive credentials is ignored:

```bash
git status
```
Verify that `.env` is **NOT** listed in untracked files. Then commit and push:

```bash
git add .
git commit -m "feat: complete multimodal Rail Madad platform with OpenRouter AI & Whisper ASR"
git branch -M main
git remote add origin https://github.com/<your-username>/RailMadad.git
git push -u origin main
```
