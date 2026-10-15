# 🚀 RailMadad 2.0 - Production Deployment Guide

This guide provides end-to-end instructions for deploying the **RailMadad AI-Powered Railway Grievance & Assistance Platform** to production environments (AWS, GCP, Azure, DigitalOcean, Linux VPS, or on-premises servers).

---

## 🏗️ Architecture & Services Overview

The RailMadad platform consists of modular microservices coordinated via a centralized REST API and a unified Nginx ingress gateway:

```
                          Internet / Clients
                                  │
                                  ▼
               ┌─────────────────────────────────────┐
               │       Nginx Gateway (Port 80)       │
               │  • /         → Passenger Portal     │
               │  • /officer/ → Officer Dashboard    │
               │  • /staff/   → Staff Portal         │
               │  • /api/     → Backend REST API     │
               │  • /ml/      → Multimodal AI Service│
               └──────────────────┬──────────────────┘
                                  │
      ┌───────────────────────────┼───────────────────────────┐
      ▼                           ▼                           ▼
┌──────────────┐           ┌──────────────┐           ┌──────────────┐
│  Passenger   │           │   Officer    │           │    Staff     │
│  UI (5173)   │           │   UI (5174)  │           │   UI (5175)  │
└──────────────┘           └──────────────┘           └──────────────┘
                                  │
                                  ▼
                    ┌────────────────────────────┐
                    │    Backend REST API (5000) │
                    │    Node.js / Express       │
                    └──────┬──────┬──────┬───────┘
                           │      │      │
          ┌────────────────┘      │      └────────────────┐
          ▼                       ▼                       ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Multimodal AI   │    │  Classification  │    │ Staff Assignment │
│  Service (8000)  │    │   Agent (8001)   │    │   Agent (8002)   │
│ Whisper+BLIP+NIM │    │   Llama-3.3 LLM  │    │ Nemotron Triage  │
└──────────────────┘    └──────────────────┘    └──────────────────┘
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  ▼
                    ┌────────────────────────────┐
                    │      MongoDB (27017)       │
                    │   Complaints, Staff, Users │
                    └────────────────────────────┘
```

### Services & Port Mappings

| Service | Technology | Port | Path / Endpoint | Healthcheck |
| :--- | :--- | :--- | :--- | :--- |
| **Gateway (Nginx)** | Nginx Alpine | `80` (or `443`) | `/` | `GET /gateway-health` |
| **Backend API** | Node.js Express | `5000` | `/api` | `GET /api/health` |
| **Multimodal ML** | Python Flask + PyTorch | `8000` | `/ml` | `GET /health` |
| **Classification Agent** | Python Flask | `8001` | Direct / Internal | `GET /health` |
| **Staff Assignment Agent**| Python Flask | `8002` | Direct / Internal | `GET /health` |
| **Passenger Portal** | Vite + React + Tailwind | `5173` | `/` | `GET /` |
| **Officer Dashboard** | Vite + React + Tailwind | `5174` | `/officer/` | `GET /` |
| **Staff Portal** | Vite + React + Tailwind | `5175` | `/staff/` | `GET /` |
| **MongoDB** | MongoDB 7.0 | `27017` | Direct | `adminCommand('ping')` |
| **Twilio Voice** *(optional)* | Python Flask | `6000` | Webhook | `GET /health` |
| **Twilio WhatsApp** *(optional)*| Python Flask | `6001` | Webhook | `GET /health` |

---

## ⚡ Quick Deployment (Docker Compose) - Recommended

Docker Compose is the fastest, cleanest, and most reliable way to run RailMadad in production.

### Step 1: Clone Repository & Setup Environment

```bash
git clone https://github.com/bhavikajhanwar24-tech/RailMadad.git
cd RailMadad

# Copy template environment file
cp .env.example .env
```

Edit `.env` with your production API keys:
```env
# Database
MONGO_URI=mongodb://mongodb:27017/railmadad
JWT_SECRET=use_a_long_random_secure_key_here

# AI Models
NVIDIA_NIM_API_KEY=nvapi-your-key-here
OPENROUTER_API_KEY=sk-or-v1-your-key-here
HF_TOKEN=hf_your_key_here
RAILRADAR_API_KEY=rg_your_key_here
```

### Step 2: Build & Start All Services

```bash
docker compose up -d --build
```

To include Twilio Voice and WhatsApp services:
```bash
docker compose --profile telephony up -d --build
```

### Step 3: Verify Container Health

```bash
docker compose ps
```
You should see all containers running with `healthy` status.

### Step 4: Access Applications

- **Unified Portal Gateway**: `http://<your-server-ip>/`
- **Officer Dashboard**: `http://<your-server-ip>/officer/` (or port `5174`)
- **Staff Portal**: `http://<your-server-ip>/staff/` (or port `5175`)
- **Backend API Docs/Health**: `http://<your-server-ip>/api/health`

---

## 🖥️ Alternative Deployment: Linux VPS (Ubuntu / Debian with PM2)

If deploying directly onto a virtual machine (EC2, Droplet, Lightsail, Compute Engine):

### 1. Install Prerequisites

```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 & Git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential

# Install Python 3.10+, pip, and FFmpeg
sudo apt install -y python3 python3-pip python3-venv ffmpeg libgl1 libglib2.0-0

# Install PM2 globally
sudo npm install -g pm2
```

### 2. Install MongoDB (or connect to MongoDB Atlas)

```bash
# Ubuntu MongoDB 7.0 Community Edition
sudo apt install -y gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
```

### 3. Install Dependencies & Build Frontends

```bash
# Backend dependencies
cd backend && npm install --production && cd ..

# Python ML & Agent dependencies
pip install -r requirements-ml.txt
pip install -r classification/requirements.txt
pip install -r staff_assignment/requirements.txt

# Build all three frontends
npm run install:all
npm run build:all
```

### 4. Start Microservices with PM2

```bash
# Start all services defined in ecosystem.config.js
pm2 start ecosystem.config.js

# Setup PM2 to restart on server reboot
pm2 startup
pm2 save
```

Monitor your services:
```bash
pm2 status
pm2 logs
```

### 5. Host Nginx & Free SSL with Let's Encrypt

Install Nginx:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Copy the Nginx configuration or create `/etc/nginx/sites-available/railmadad`:
```nginx
server {
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 100M;

    # API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ML Service Proxy
    location /ml/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Officer Portal
    location /officer/ {
        alias /var/www/railmadad/rail-madad-frontend/frontend-officer/dist/;
        try_files $uri $uri/ /officer/index.html;
    }

    # Staff Portal
    location /staff/ {
        alias /var/www/railmadad/rail-madad-frontend/frontend-staff/dist/;
        try_files $uri $uri/ /staff/index.html;
    }

    # Passenger Portal (Root)
    location / {
        root /var/www/railmadad/rail-madad-frontend/frontend-passenger/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

Enable site & get SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/railmadad /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Install free Let's Encrypt SSL
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## ☁️ Cloud PaaS Deployments

### Render / Railway / Fly.io

Each service can be deployed independently:
1. **Backend**:
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && node server.js`
   - Env Vars: `MONGO_URI`, `JWT_SECRET`, `ML_SERVICE_URL`
2. **ML Service**:
   - Dockerfile: `Dockerfile.ml`
   - Env Vars: `NVIDIA_NIM_API_KEY`, `OPENROUTER_API_KEY`
3. **Frontends (Vercel / Netlify / Render Static)**:
   - Root directory: `rail-madad-frontend/frontend-passenger` (or officer/staff)
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Environment Variable: `VITE_API_URL=https://your-backend.onrender.com/api`

---

## 🛡️ Production Checklist

- [x] **Secure Database**: Changed default passwords, enabled MongoDB TLS/SSL.
- [x] **CORS Configuration**: Restrict `CORS_ORIGIN` to your official domain(s) in `.env`.
- [x] **JWT Secret**: Generated a cryptographically strong 64+ char secret.
- [x] **SSL / HTTPS**: Configured TLS certificate via Let's Encrypt or Cloudflare.
- [x] **Upload Limits**: Set Nginx client body size to `100M` for video evidence.
- [x] **Automated Restarts**: Containers configured with `restart: unless-stopped`.
- [x] **Telemetry & Logging**: Log rotation enabled via Docker or PM2.

---

## 🔍 Maintenance & Useful Commands

| Task | Command |
| :--- | :--- |
| **Check logs for all containers** | `docker compose logs -f` |
| **Check specific service log** | `docker compose logs -f backend` |
| **Restart specific service** | `docker compose restart ml-service` |
| **Stop entire stack** | `docker compose down` |
| **Backup MongoDB data** | `docker exec -t railmadad-mongodb mongodump --out /data/db/backup` |
| **Restore MongoDB data** | `docker exec -t railmadad-mongodb mongorestore /data/db/backup` |
