/**
 * JSON API & Android Digital Asset Links routes.
 * Handles health telemetry, visitor IP/ISP detection, rate-limited website support/mail
 * forwarding to Supabase Admin Inbox, Twilio WhatsApp/SMS OTP, and App Links verification.
 */

const express = require("express");
const { createRateLimiter } = require("../middleware/rateLimit");
const { detectVisitorDetails } = require("../services/ipDetector");
const { isConfigured: isSupabaseConfigured, saveWebsiteSupportTicket } = require("../services/supabase");
const { isTwilioConfigured, sendOtp, verifyOtp } = require("../services/otp");

const DEFAULT_CONSUMER_SHA256 =
  "A3:82:E0:E8:59:28:15:7D:A2:0C:95:23:32:43:AD:96:32:28:90:8B:2D:5D:23:51:84:85:4B:B1:FE:41:DA:B5";

function positiveIntEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getConsumerFingerprints() {
  const extra = String(process.env.PLAY_APP_SHA256 || "")
    .split(",")
    .map(s => s.trim().toUpperCase())
    .filter(s => /^[0-9A-F:]{95}$/.test(s));
  return Array.from(new Set([DEFAULT_CONSUMER_SHA256, ...extra]));
}

function validateSupportPayload(raw) {
  const body = raw && typeof raw === "object" ? raw : {};
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const phone = String(body.phone || "").trim();
  const topic = String(body.topic || "Customer Support").trim();
  const subject = String(body.subject || "").trim();
  const message = String(body.message || "").trim();
  const sourceTag = body.sourceTag === "WEBSITE MAIL" ? "WEBSITE MAIL" : "WEBSITE";

  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: "Please enter your name (2-80 characters)." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (phone.length > 30) {
    return { ok: false, error: "Phone / WhatsApp number is too long." };
  }
  if (subject.length < 2 || subject.length > 140) {
    return { ok: false, error: "Please enter a short subject (2-140 characters)." };
  }
  if (message.length < 5 || message.length > 3000) {
    return { ok: false, error: "Please enter full details (5-3000 characters)." };
  }

  return {
    ok: true,
    data: {
      sourceTag,
      name,
      email,
      phone,
      topic: topic.slice(0, 40) || "Customer Support",
      subject,
      message
    }
  };
}

function createApiRouter() {
  const router = express.Router();

  const ipLimiter = createRateLimiter({
    name: "api-ip",
    windowMs: 60 * 1000,
    max: positiveIntEnv("TEST_IP_RATE_MAX", 60),
    message: "Too many IP lookup requests. Please wait a minute."
  });

  const supportLimiter = createRateLimiter({
    name: "api-support",
    windowMs: 60 * 1000,
    max: positiveIntEnv("TEST_SUPPORT_RATE_MAX", 10),
    message: "Too many support requests submitted from this IP. Please retry in a minute."
  });

  const otpLimiter = createRateLimiter({
    name: "api-otp",
    windowMs: 60 * 1000,
    max: positiveIntEnv("TEST_OTP_RATE_MAX", 6),
    message: "Too many verification attempts. Please wait a minute before retrying."
  });

  router.get("/.well-known/assetlinks.json", (req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.json([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.khxzi.fixit",
          sha256_cert_fingerprints: getConsumerFingerprints()
        }
      }
    ]);
  });

  router.get("/api/health", (req, res) => {
    return res.json({
      ok: true,
      service: "fixit-web",
      version: "3.3.5",
      supabaseConfigured: isSupabaseConfigured(),
      twilioConfigured: isTwilioConfigured(),
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });

  router.get("/api/ip", ipLimiter, async (req, res) => {
    const skipExternalLookup = req.query.fast === "1";
    const visitor = await detectVisitorDetails(req, { skipExternalLookup });
    return res.json({ ok: true, visitor });
  });

  function handleSupport(defaultTag) {
    return async (req, res) => {
      const checked = validateSupportPayload(req.body);
      if (!checked.ok) {
        return res.status(400).json({ ok: false, error: checked.error });
      }

      const skipExternalLookup = req.headers["x-skip-geo"] === "1";
      const visitor = await detectVisitorDetails(req, { skipExternalLookup });
      const visitorSummary = {
        ip: visitor.ip,
        city: visitor.city,
        region: visitor.region,
        country: visitor.country,
        isp: visitor.isp,
        os: visitor.os,
        browser: visitor.browser,
        deviceType: visitor.deviceType
      };

      const saved = await saveWebsiteSupportTicket({
        ...checked.data,
        sourceTag: checked.data.sourceTag === "WEBSITE MAIL" ? "WEBSITE MAIL" : defaultTag,
        visitor
      });

      if (saved.ok) {
        return res.status(201).json({
          ok: true,
          savedToDb: true,
          ticketId: saved.ticketId,
          subject: saved.subject,
          createdAt: saved.createdAt,
          visitor: visitorSummary
        });
      }

      return res.status(503).json({
        ok: false,
        savedToDb: false,
        error: saved.error || "Support service is temporarily unavailable.",
        visitor: visitorSummary
      });
    };
  }

  router.post("/api/support", supportLimiter, handleSupport("WEBSITE"));
  router.post("/api/mail", supportLimiter, handleSupport("WEBSITE MAIL"));

  router.post("/api/otp/send", otpLimiter, async (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const phone = body.phone || body.to || "";
    const rawChannel = String(body.channel || "whatsapp").trim().toLowerCase();

    if (rawChannel === "call" || rawChannel === "voice") {
      return res.status(400).json({
        ok: false,
        error: "Voice call verification is not supported. Choose WhatsApp or SMS."
      });
    }
    if (rawChannel !== "whatsapp" && rawChannel !== "sms") {
      return res.status(400).json({
        ok: false,
        error: "Unsupported OTP channel. Choose whatsapp or sms."
      });
    }

    const result = await sendOtp(phone, rawChannel);
    const status = result.status || (result.ok ? 200 : 400);
    return res.status(status).json(result);
  });

  router.post("/api/otp/verify", otpLimiter, async (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const phone = body.phone || body.to || "";
    const code = body.code || body.otp || "";
    const result = await verifyOtp(phone, code);
    const status = result.status || (result.ok ? 200 : 400);
    return res.status(status).json(result);
  });

  router.use("/api/{*splat}", (req, res) => {
    return res.status(404).json({ ok: false, error: "API endpoint not found" });
  });

  return router;
}

module.exports = {
  createApiRouter,
  DEFAULT_CONSUMER_SHA256
};
