# FixIt Salalah — Web App & Realtime Backend

Official web portal, PWA application, and backend service for **FixIt Salalah (fixit-now.xyz)**.

## 🚀 Overview

- **Frontend & PWA:** Talabat-grade UI with Leaflet live maps, Arabic/English RTL support, Service Worker offline caching, and permanent MOCIIP-verified Worker & Customer QR Badges.
- **Backend & APIs:** Express.js REST API with dynamic QR generation (`/api/qr`), badge verification (`/api/verify/:badgeId`), and public credential views (`/badge?id=...`).
- **Multi-Role Routing:**
  - `/` — Consumer App
  - `/vendor` — Pro Vendor Dashboard & Dispatch Center
  - `/admin` — Admin Super-Controller (Login-Free)
  - `/badge?id=FX-WRK-884101` — Digital ID Credential Pass

## 📦 One-Click Deployment to Render.com

This repository includes a native `render.yaml` configuration for immediate deployment:

1. Open [Render.com](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Connect repository: `https://github.com/khxzibxtt/fixit-web`.
4. Render will auto-detect settings:
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Click **Create Web Service**. Your app is live with SSL in seconds!

## 🛡️ License & Compliance

Complies with Sultanate of Oman Ministry of Commerce, Industry and Investment Promotion (MOCIIP) regulations and Oman Business Platform licensing standards.
