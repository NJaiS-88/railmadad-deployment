# 🚆 Deploying RailMadad: Vercel (Frontend) + Render (Backend & ML)

This simple, step-by-step guide will walk you through deploying:
- **Backend & ML AI Service** ➔ **[Render](https://render.com)**
- **Frontends (Passenger, Officer, Staff)** ➔ **[Vercel](https://vercel.com)**

---

## 📋 Prerequisites Checklist

Before you begin, have these ready:
1. **GitHub Repository**: Push your RailMadad project code to GitHub.
2. **MongoDB Atlas URI**: Your cloud MongoDB connection string (e.g., `mongodb+srv://user:pass@cluster.mongodb.net/railmadad`).
3. **OpenRouter API Key**: (From your `.env` file).
4. Free accounts on **[Render.com](https://render.com)** and **[Vercel.com](https://vercel.com)**.

---

## 🟢 PART 1: Deploy ML & Backend to Render

You have two easy ways to deploy on Render. **Method A (Blueprint)** is one click. **Method B (Manual)** gives step-by-step dashboard control.

---

### Method A: One-Click Render Blueprint (Recommended)

1. Go to **[dashboard.render.com](https://dashboard.render.com)**.
2. Click **New +** ➔ **Blueprint**.
3. Select your GitHub repository (`RailMadad`).
4. Render will read [`render.yaml`](render.yaml) and automatically prepare two web services:
   - `railmadad-ml-service` (Docker container with FFmpeg & PyTorch)
   - `railmadad-backend` (Node.js API)
5. Fill in the prompted secret variables:
   - `MONGO_URI`: Your MongoDB Atlas URI.
   - `OPENROUTER_API_KEY`: Your OpenRouter key (e.g. `sk-or-v1-...`).
6. Click **Apply**.
7. Once deployed, note your two service URLs:
   - Backend URL: e.g. `https://railmadad-backend.onrender.com`
   - ML Service URL: e.g. `https://railmadad-ml-service.onrender.com`

---

### Method B: Manual Setup on Render

#### Step 1: Deploy Python ML Service (`Dockerfile.ml`)
1. In Render Dashboard, click **New +** ➔ **Web Service**.
2. Connect your GitHub repository.
3. Configure the settings:
   - **Name**: `railmadad-ml-service`
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `./Dockerfile.ml`
   - **Docker Build Context Directory**: `.`
   - **Instance Type**: `Starter` (or `Free`)
4. Under **Environment Variables**, add:
   - `PORT` = `8000`
   - `OPENROUTER_API_KEY` = your OpenRouter key (`sk-or-v1-...`)
5. Click **Create Web Service**.
6. When deployment finishes, copy its public URL:
   `https://railmadad-ml-service.onrender.com`

#### Step 2: Deploy Backend REST API (Node.js)
1. In Render Dashboard, click **New +** ➔ **Web Service**.
2. Connect the same repository.
3. Configure:
   - **Name**: `railmadad-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. Under **Environment Variables**, add:
   - `PORT` = `5000`
   - `NODE_ENV` = `production`
   - `MONGO_URI` = `mongodb+srv://...` (your MongoDB connection string)
   - `JWT_SECRET` = `railmadad_jwt_secret_key_super_secure_2026`
   - `CORS_ORIGIN` = `*`
   - `ML_SERVICE_URL` = `https://railmadad-ml-service.onrender.com` (from Step 1)
5. Click **Create Web Service**.
6. When deployment finishes, copy the Backend URL:
   `https://railmadad-backend.onrender.com`
   *(Test health check in browser: `https://railmadad-backend.onrender.com/api/health`)*

---

## 🔺 PART 2: Deploy ALL Frontends at Once to Vercel (Unified Suite)

You can deploy the **Passenger Portal**, **Officer Dashboard**, and **Staff Field Portal** all together under a **single Vercel project and URL**:

### Step 1: Deploy on Vercel

1. Go to **[vercel.com/dashboard](https://vercel.com/dashboard)**.
2. Click **Add New…** ➔ **Project**.
3. Import your `railmadad-deployment` GitHub repository.
4. In the configuration screen:
   - **Project Name**: `railmadad` (or your choice)
   - **Framework Preset**: `Other` (or `Vite`)
   - Click **Edit** next to **Root Directory** and select:
     ```
     rail-madad-frontend
     ```
     *(Or leave as `./` root — both will build all 3 frontends automatically!)*
   - **Build Command**: `node build-all.js`
   - **Output Directory**: `dist`
5. Expand **Environment Variables** and add:
   - **`VITE_API_URL`**: `https://railmadad-backend.onrender.com/api` (your Render backend URL)
   - **`VITE_ML_URL`**: `https://railmadad-ml-service.onrender.com` (your Render ML URL)
6. Click **Deploy**.

---

### Step 2: Access All 3 Portals Under Your Single Vercel URL! 🎉

Once deployed, your single Vercel domain hosts all 3 portals with seamless client-side routing and top-header switcher buttons:

* 🚆 **Passenger Portal**: `https://your-app.vercel.app/`
* 👮 **Officer Dashboard**: `https://your-app.vercel.app/officer`
* 👷 **Staff Field App**: `https://your-app.vercel.app/staff`

## 🧪 Testing Your Live Deployment

1. **Open your Vercel URL**: `https://railmadad-passenger.vercel.app`
2. **File a Grievance**:
   - Upload a photo, audio, or video.
   - The multimodal AI will transcribe audio/vision via your Render ML service.
   - Click Submit: Complaint is stored in MongoDB Atlas, classified, and assigned.
3. **Verify Status Tracking**:
   - Refresh the page on `/track` (handled cleanly by `vercel.json` without 404s).

---

## 💡 Troubleshooting Tips

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **CORS error in browser console** | Backend didn't allow Vercel origin | In Render backend environment variables, ensure `CORS_ORIGIN=*` or your Vercel domain. |
| **Render ML service takes 50s on first call** | Render free tier puts inactive services to sleep | Free tier services sleep after 15 min of inactivity; the first request wakes it up. Upgrade to Starter or use a cron ping (like UptimeRobot) if you need instant cold starts. |
| **404 on page refresh on Vercel** | SPA routing not configured | The newly added `vercel.json` in each frontend directory fixes this automatically. |
| **MongoDB connection timeout** | Atlas Network Access IP Whitelist | In MongoDB Atlas, go to **Network Access** ➔ add `0.0.0.0/0` (Allow Access from Anywhere) so Render servers can connect. |
