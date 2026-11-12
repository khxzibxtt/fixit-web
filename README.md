# FixIt Oman — Pure-JS Web Backend & App Deep-Link Gateway

Official Node.js / Express v5 server for **FixIt (Salalah & Oman)** powering the public landing website, Android Digital Asset Links (`/.well-known/assetlinks.json`), Universal App Link redirector (`/open`, `/r/:code`), rate-limited support and mail forwarding to the Admin app, and Twilio WhatsApp/SMS OTP endpoints.

## Architecture

- **100% Pure-JS Server-Rendered Views (`src/views/*.js`):** Zero static `.html` files. Every HTML page is generated dynamically with semantic styling, SVG iconography (no emojis), zero speculative pricing, and responsive navigation.
- **No Web Ordering & No Admin Exposure:** All home services and pro dispatch run inside the native Android apps. Only `FixIt-Consumer.apk` and `FixIt-Vendor.apk` are distributed via `/downloads/:file`; `FixIt-Admin` is strictly excluded.
- **Security & Rate Limiting (`src/middleware/rateLimit.js`):** Sliding-window per-IP throttling across all routes (`120 req/min` global, `60 req/min` IP telemetry, `10 req/min` support/mail, `6 req/min` OTP), HTTP security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`), and Express v5 404/error boundaries.
- **Visitor Telemetry (`src/services/ipDetector.js`):** Detects real client IP, forwarded headers, browser/OS/device type, and geo/ISP details for `/support`, `/contact`, and `/api/ip`.
- **Admin Support & Mail Bridge (`src/services/supabase.js`):** Validates `/api/support` and `/api/mail` payloads, records `[WEBSITE]` / `[WEBSITE MAIL]` tickets in Supabase `support_tickets`, and posts live Admin `notifications`.
- **OTP Verification (`src/services/otp.js`):** Twilio REST API integration supporting **WhatsApp and SMS channels only** (voice calls explicitly rejected).

## Project Layout

```text
server.js                     Express v5 entrypoint (`createApp`)
render.yaml                   Render.com Blueprint (Node >=20, health check `/api/health`)
src/
  middleware/rateLimit.js     Sliding-window in-memory rate limiter (HTTP 429 JSON/HTML)
  routes/api.js               `/.well-known/assetlinks.json`, `/api/health`, `/api/ip`, `/api/support`, `/api/mail`, `/api/otp/*`
  routes/web.js               Pure-JS HTML routes & strict APK download whitelist
  services/ipDetector.js      Client IP, UA parsing, geo/ISP lookup
  services/otp.js             Twilio WhatsApp/SMS 6-digit OTP store & verifier
  services/supabase.js        Supabase REST persistence for tickets & admin alerts
  views/*.js                  Modular layout, home, support/contact, legal, and deep-link views
scripts/verify.js             Automated HTTP & rate-limit regression suite
public/
  downloads/                  `FixIt-Consumer.apk` & `FixIt-Vendor.apk` (no Admin APK)
  fonts/, icons/, logo.png, manifest.json
```

## Local Verification

```bash
npm install
npm test      # Runs scripts/verify.js on ephemeral localhost ports
npm start     # Starts server on 127.0.0.1:3000 (or $HOST:$PORT)
```

## Render.com Environment Variables

Configure the following environment variables in **Render Dashboard -> Service -> Environment**:

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | `10000` |
| `SUPABASE_URL` | Yes | Supabase project URL (`https://<ref>.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase `service_role` JWT for inserting `support_tickets` & `notifications` |
| `ADMIN_USER_ID` | Recommended | Target Admin UUID receiving website support alerts |
| `WEB_SUPPORT_USER_ID` | Recommended | Fallback `user_id` assigned to web-originated tickets |
| `TWILIO_ACCOUNT_SID` | For live OTP | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | For live OTP | Twilio Auth Token |
| `TWILIO_FROM` | For SMS OTP | Twilio E.164 SMS sender number |
| `TWILIO_WHATSAPP_FROM` | For WhatsApp OTP | Twilio WhatsApp sender (`whatsapp:+1...`) |
| `PLAY_APP_SHA256` | Optional | Comma-separated extra Google Play signing SHA-256 fingerprints for `assetlinks.json` |
