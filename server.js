/**
 * FixIt Oman Pure-JS Express v5 Web & API Server.
 * Zero static HTML files, zero web ordering, zero Admin APK exposure,
 * strict rate limiting, visitor telemetry, and Supabase/Twilio integrations.
 */

const path = require("path");
const express = require("express");
const cors = require("cors");
const { createRateLimiter } = require("./src/middleware/rateLimit");
const { createApiRouter } = require("./src/routes/api");
const { createAppApiRouter } = require("./src/routes/appApi");
const { createWebRouter, renderNotFoundPage } = require("./src/routes/web");
const { createEnginesRouter } = require("./src/routes/engines");
const { startAutoConfirmCron } = require("./src/workers/autoConfirmCron");

function positiveIntEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createApp() {
  const app = express();
  const publicDir = path.join(__dirname, "public");

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // Baseline HTTP security headers
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.use(cors());
  app.use(express.json({ limit: "600kb" }));
  app.use(express.urlencoded({ extended: true, limit: "600kb" }));

  // Global sliding-window rate limiter across all HTTP routes
  const globalLimiter = createRateLimiter({
    name: "global",
    windowMs: 60 * 1000,
    max: positiveIntEnv("TEST_RATE_MAX", 120),
    message: "Too many requests from your IP. Please try again shortly."
  });
  app.use(globalLimiter);

  // Deterministic Algorithms & Viral Engines routes
  app.use(createEnginesRouter());

  // App BFF & Session Gateway routes (must run before generic /api 404 catch-all)
  app.use(createAppApiRouter());

  // API & Digital Asset Links routes
  app.use(createApiRouter());

  // Pure-JS rendered HTML pages & whitelisted Consumer/Vendor APK downloads
  app.use(createWebRouter({ publicDir }));

  // Static assets (logo, fonts, icons, manifest) without static HTML or unrestricted /downloads
  app.use((req, res, next) => {
    if (req.path.startsWith("/downloads")) {
      return renderNotFoundPage(req, res);
    }
    return next();
  });
  app.use(express.static(publicDir, {
    dotfiles: "deny",
    index: false,
    maxAge: "1d"
  }));

  // Express v5 wildcard fallback -> clean Pure-JS 404 page
  app.use("/{*splat}", (req, res) => {
    return renderNotFoundPage(req, res);
  });

  // Safe JSON/HTML error boundary without leaking internal stack traces
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err && err.type === "entity.parse.failed") {
      return res.status(400).json({ ok: false, error: "Invalid JSON payload." });
    }
    const status = (err && Number.isInteger(err.status) && err.status >= 400 && err.status < 600) ? err.status : 500;
    if (req.path.startsWith("/api/")) {
      return res.status(status).json({ ok: false, error: status === 413 ? "Request payload too large." : "Server error." });
    }
    return res.status(status).type("text/plain").send("Unexpected server error.");
  });

  return app;
}

if (require.main === module) {
  const PORT = positiveIntEnv("PORT", 3000);
  const HOST = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
  const app = createApp();
  startAutoConfirmCron();
  app.listen(PORT, HOST, () => {
    console.log(`[OK] FixIt Pure-JS server listening on http://${HOST}:${PORT}`);
  });
}

module.exports = {
  createApp
};
