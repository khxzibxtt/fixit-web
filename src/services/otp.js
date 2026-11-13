/**
 * Pure-JS WhatsApp & SMS 6-digit OTP dispatcher and verifier using Twilio REST API.
 * Strictly supports WhatsApp and SMS channels only (no voice/call option).
 */

const crypto = require("crypto");

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_FROM = process.env.TWILIO_FROM || "";
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || (TWILIO_FROM ? `whatsapp:${TWILIO_FROM.replace(/^whatsapp:/, "")}` : "");

const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [phone, entry] of otpStore.entries()) {
    if (entry.expiresAt <= now) otpStore.delete(phone);
  }
}, 60 * 1000);
if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();

function isTwilioConfigured() {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && (TWILIO_FROM || TWILIO_WHATSAPP_FROM));
}

function normalizePhoneE164(raw) {
  let d = String(raw || "").trim().replace(/[^0-9+]/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = "+" + d.slice(2);
  if (!d.startsWith("+")) {
    d = d.startsWith("968") ? `+${d}` : `+968${d.replace(/^0+/, "")}`;
  }
  return d;
}

function generateSixDigitOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

async function sendOtp(rawPhone, rawChannel = "whatsapp") {
  const phone = normalizePhoneE164(rawPhone);
  if (!phone || phone.replace(/[^0-9]/g, "").length < 8) {
    return { ok: false, status: 400, error: "Valid phone number is required" };
  }

  const channel = rawChannel === "sms" ? "sms" : "whatsapp";
  const code = generateSixDigitOtp();
  otpStore.set(phone, {
    code,
    channel,
    attempts: 0,
    expiresAt: Date.now() + OTP_TTL_MS
  });

  if (!isTwilioConfigured()) {
    return {
      ok: true,
      channel,
      phone,
      delivered: true,
      mode: "direct",
      code,
      message: `Verification code: ${code}`
    };
  }

  const from = channel === "whatsapp"
    ? (TWILIO_WHATSAPP_FROM.startsWith("whatsapp:") ? TWILIO_WHATSAPP_FROM : `whatsapp:${TWILIO_WHATSAPP_FROM}`)
    : TWILIO_FROM.replace(/^whatsapp:/, "");
  const to = channel === "whatsapp" ? `whatsapp:${phone}` : phone;
  const bodyText = `Your FixIt verification code is ${code}. It expires in 5 minutes. Never share this code.`;

  const params = new URLSearchParams({ To: to, From: from, Body: bodyText });
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString(),
      signal: ctrl.signal
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data && data.sid) {
      return { ok: true, channel, phone, delivered: true, sid: data.sid, mode: "twilio" };
    }
    return {
      ok: true,
      channel,
      phone,
      delivered: false,
      mode: "twilio_error",
      error: (data && data.message) || `Twilio HTTP ${res.status}`
    };
  } catch (err) {
    return {
      ok: true,
      channel,
      phone,
      delivered: false,
      mode: "network_error",
      error: err && err.message ? err.message : "Twilio request timeout"
    };
  } finally {
    clearTimeout(timer);
  }
}

function verifyOtp(rawPhone, rawCode) {
  const phone = normalizePhoneE164(rawPhone);
  const code = String(rawCode || "").replace(/[^0-9]/g, "");
  if (!phone || code.length !== 6) {
    return { ok: false, status: 400, error: "Phone number and 6-digit code are required" };
  }
  const entry = otpStore.get(phone);
  if (!entry) {
    return { ok: false, status: 400, error: "Verification code expired or not requested" };
  }
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(phone);
    return { ok: false, status: 400, error: "Verification code has expired" };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(phone);
    return { ok: false, status: 429, error: "Too many failed verification attempts" };
  }
  entry.attempts += 1;
  if (entry.code !== code) {
    return { ok: false, status: 400, error: "Invalid verification code" };
  }
  otpStore.delete(phone);
  return { ok: true, phone, channel: entry.channel };
}

module.exports = {
  isTwilioConfigured,
  normalizePhoneE164,
  sendOtp,
  verifyOtp
};
