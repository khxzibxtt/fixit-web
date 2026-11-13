# FixIt Oman — Web Backend, Auth Gateway & Deep-Link Server

Official Node.js / Express v5 server for **FixIt (Salalah & Oman)** powering the Backend-for-Frontend (BFF) mobile API gateway (`/api/auth/*`, `/api/app/*`), public landing website, Android Digital Asset Links (`/.well-known/assetlinks.json`), Universal App Link redirector (`/open`, `/r/:code`), rate-limited support forwarding, and WhatsApp Web OTP endpoints.

## Architecture

- **Zero-Secret Mobile Gateway (`src/routes/appApi.js`):** Consumer, Vendor, and Admin Android apps never embed Supabase `service_role` keys. Every DB read/write routes through `https://fixit-now.xyz/api/app/*` authenticated by a per-user sliding `sessionCode` (`X-FixIt-Session`), with server-enforced role authorization.
- **Sliding Session Codes & Audit Logs (`src/services/authSession.js`):** Issues 256-bit `sessionCode` tokens stored in Supabase `auth_sessions`, extends `expires_at` and updates `users.updated_at` / `user_devices.last_seen_at` on activity/heartbeat, and filters out routine polling noise.
- **Phone Validation & Anti-Abuse (`src/services/phoneValidator.js`):** Enforces strict Oman (`+968`) numbers (`^[79]\d{7}$`, exact 8 digits starting with `9` or `7`), supports all international tourist dial codes in E.164 format, throttles OTP sends/verifies by IP + phone (`HTTP 429`), and rejects duplicate phone linking on Google Sign-Up (`409 PHONE_ALREADY_LINKED`).
- **Mandatory Post-Signup Onboarding (`src/routes/appApi.js`):**
  - New Google users get `pendingToken` + Google profile (`fullName`, `email`, `avatarUrl`), confirm details + Google PFP (kept until changed), and verify a unique phone number before receiving a session.
  - New Phone OTP users verify WhatsApp OTP and complete required profile details via `POST /api/auth/profile/complete`. Returning verified users with saved profiles bypass onboarding and sign straight in.
- **Biometric Device Login (`src/routes/appApi.js`):** Consumer and Vendor apps support Fingerprint / Face Unlock via `POST /api/auth/biometric/register`, `POST /api/auth/biometric/login`, and `POST /api/auth/biometric/revoke`, storing SHA-256 hashed 256-bit device tokens in `user_settings` and returning fresh `sessionCode` credentials after OS `BiometricPrompt` verification.
- **Pure-JS Server-Rendered Views (`src/views/*.js`) & Web App (`public/app.html`):** Server-rendered marketing/legal routes plus `/app` SPA, `/auth/callback` role-aware app deep-linking (`fixit://` vs `fixitvendor://`), and `/ad.html` frameable banner slot (`frame-ancestors *`).
- **No Admin Exposure:** Only `FixIt-Consumer.apk` and `FixIt-Vendor.apk` are distributed via `/downloads/:file`; `FixIt-Admin.apk` is strictly excluded (`404`).

## Project Layout

```text
server.js                     Express v5 entrypoint (`createApp`, 600kb JSON limit, BFF mounted before 404 splat)
render.yaml                   Render.com Blueprint (Node >=20, health check `/api/health`)
src/
  middleware/rateLimit.js     Sliding-window IP + keyGenerator rate limiter (HTTP 429 JSON/HTML)
  routes/api.js               `/.well-known/assetlinks.json`, `/api/health`, `/api/ip`, `/api/support`, `/api/mail`, `/api/otp/*`
  routes/appApi.js            `/api/auth/*` (WhatsApp OTP, Google OAuth, biometrics, profile complete, admin code, heartbeat, logout) & `/api/app/*` (`bootstrap`, `notifications`, `audit-logs`, `rest/:table`)
  routes/web.js               Pure-JS HTML routes, `/ad.html`, `/auth/callback`, `/app`, & strict APK download whitelist
  services/authSession.js     Rotating/sliding `sessionCode` lifecycle, DB role check, heartbeat touch & quiet polling audit filter
  services/ipDetector.js      Client IP, UA parsing, geo/ISP lookup
  services/otp.js             WhatsApp Web bilingual 6-digit SHA-256 OTP dispatcher, cooldowns & Supabase DB fallback
  services/phoneValidator.js  Strict Oman `+968` (`^[79]\d{7}$`) & international E.164 parser/validator
  services/supabase.js        Server-side Supabase REST + Auth `/auth/v1/user` client
  views/*.js                  Modular layout, home, support/contact, legal, and deep-link views
scripts/verify.js             Automated HTTP, BFF auth, biometrics & rate-limit regression suite
public/
  downloads/                  `FixIt-Consumer.apk` & `FixIt-Vendor.apk` only (no Admin APK)
  fonts/, icons/, logo.png, manifest.json
```

## Local Verification

```bash
npm install
npm test      # Runs scripts/verify.js on ephemeral localhost ports
npm start     # Starts server on 127.0.0.1:3000 (or $HOST:$PORT)
```

## Render.com Environment Variables

Configure the following secret environment variables in **Render Dashboard -> Service -> Environment**:

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | `10000` |
| `SUPABASE_URL` | Yes | Supabase project URL (`https://<ref>.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase `service_role` JWT (kept server-side only; never shipped in APKs) |
| `SESSION_SECRET` | Yes | High-entropy HMAC secret used for Google `pendingToken` and session security |
| `ADMIN_ACCESS_CODE` | Yes | Secret operator login code for `FixIt-Admin` (`POST /api/auth/admin-login`) |
| `ADMIN_USER_ID` | Recommended | Target Admin UUID receiving website support alerts |
| `WEB_SUPPORT_USER_ID` | Recommended | Fallback `user_id` assigned to web-originated tickets |
| `GOOGLE_CLIENT_ID` / `GOOGLE_ANDROID_CLIENT_ID` | Optional | Allowed Google OAuth Client IDs for audience verification |
| `GOOGLE_CLIENT_SECRET` & `ENABLE_DIRECT_GOOGLE_OAUTH` | Optional | Set `ENABLE_DIRECT_GOOGLE_OAUTH=1` + Web Client Secret if using direct Google OAuth instead of Supabase OAuth |
| `PLAY_APP_SHA256` | Optional | Comma-separated extra Google Play signing SHA-256 fingerprints for `assetlinks.json` |
