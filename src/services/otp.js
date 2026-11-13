/**
 * Pure-JS WhatsApp-only 6-digit OTP dispatcher and verifier via WhatsApp Web (Baileys).
 * Enforces strict Oman/international phone rules via phoneValidator,
 * persists SHA-256 hashed OTP codes to Supabase `otp_codes` with memory fallback,
 * enforces cooldown & max verification attempts, and rejects SMS/voice/call channels.
 */

const crypto = require("crypto");
const { parseAndValidatePhone } = require("./phoneValidator");
const { isConfigured: isSupabaseConfigured, supabaseRequest } = require("./supabase");

const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [phone, entry] of otpStore.entries()) {
    if (entry.expiresAt <= now) otpStore.delete(phone);
  }
}, 60 * 1000);
if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();

function sha256Hex(val) {
  return crypto.createHash("sha256").update(String(val || "")).digest("hex");
}

function normalizePhoneE164(raw, opts = {}) {
  const parsed = parseAndValidatePhone({ phone: raw, ...opts });
  return parsed.ok ? parsed.e164 : "";
}

function generateSixDigitOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

async function sendOtp(rawPhone, rawChannel = "whatsapp", opts = {}) {
  const requestedChannel = String(rawChannel || "whatsapp").trim().toLowerCase() || "whatsapp";
  if (requestedChannel !== "whatsapp") {
    return {
      ok: false,
      status: 400,
      error: "Only WhatsApp verification is supported. SMS OTP is disabled.",
      errorAr: "التحقق متاح عبر واتساب فقط. رسائل SMS غير مدعومة."
    };
  }

  const parsed = parseAndValidatePhone({
    phone: rawPhone,
    countryIso: opts.countryIso || "",
    dialCode: opts.dialCode || "",
    nationalNumber: opts.nationalNumber || ""
  });
  if (!parsed.ok) {
    return { ok: false, status: 400, error: parsed.error, errorAr: parsed.errorAr };
  }

  const phone = parsed.e164;
  const now = Date.now();
  const prev = otpStore.get(phone);
  if (prev && prev.expiresAt > now && (now - (prev.sentAt || 0)) < RESEND_COOLDOWN_MS && !opts.skipCooldown) {
    const waitSec = Math.max(1, Math.ceil((RESEND_COOLDOWN_MS - (now - prev.sentAt)) / 1000));
    return {
      ok: false,
      status: 429,
      retryAfterSec: waitSec,
      error: `Please wait ${waitSec}s before requesting a new code.`
    };
  }

  const channel = "whatsapp";
  const purpose = "LOGIN";
  const code = generateSixDigitOtp();
  const codeHash = sha256Hex(`${phone}:${code}`);
  const expiresIso = new Date(now + OTP_TTL_MS).toISOString();
  const otpId = crypto.randomUUID();

  otpStore.set(phone, {
    otpId,
    code,
    codeHash,
    channel,
    attempts: 0,
    sentAt: now,
    expiresAt: now + OTP_TTL_MS
  });

  if (isSupabaseConfigured()) {
    await supabaseRequest("/otp_codes", "POST", {
      otp_id: otpId,
      phone_number: phone,
      code_hash: codeHash,
      purpose,
      expires_at: expiresIso,
      attempt_count: 0,
      created_at: new Date(now).toISOString()
    }).catch(() => {});
  }

  try {
    const waWeb = require("./whatsappWeb");
    if (waWeb.isWhatsAppConnected()) {
      const bodyText = formatWhatsAppOtpMessage(code);
      const waRes = await waWeb.sendWhatsAppMessage(phone, bodyText);
      if (waRes.ok) {
        console.log(`[WA-WEB] OTP delivered directly via WhatsApp Web to ${phone}`);
        return { ok: true, channel, phone, countryIso: parsed.countryIso, delivered: true, id: waRes.id, mode: "wa_web" };
      }
      otpStore.delete(phone);
      return {
        ok: false,
        status: 502,
        channel,
        phone,
        countryIso: parsed.countryIso,
        delivered: false,
        mode: "wa_web_error",
        error: waRes.error || "Could not deliver WhatsApp code. Please verify your WhatsApp number.",
        errorAr: "تعذر إرسال رمز التحقق عبر واتساب. تأكد من أن الرقم مسجل في واتساب."
      };
    }
  } catch (e) {
    console.error("[WA-WEB-ERR]", e);
  }

  if (process.env.NODE_ENV === "test") {
    return {
      ok: true,
      channel,
      phone,
      countryIso: parsed.countryIso,
      delivered: true,
      mode: "direct",
      code,
      message: `Verification code: ${code}`
    };
  }

  otpStore.delete(phone);
  return {
    ok: false,
    status: 503,
    channel,
    phone,
    countryIso: parsed.countryIso,
    delivered: false,
    mode: "wa_disconnected",
    error: "WhatsApp verification service is reconnecting. Please wait a few seconds and try again.",
    errorAr: "خدمة التحقق عبر واتساب قيد الاتصال حالياً. يرجى المحاولة بعد قليل."
  };
}

async function verifyOtp(rawPhone, rawCode, opts = {}) {
  const parsed = parseAndValidatePhone({
    phone: rawPhone,
    countryIso: opts.countryIso || "",
    dialCode: opts.dialCode || "",
    nationalNumber: opts.nationalNumber || ""
  });
  const code = String(rawCode || "").replace(/[^0-9]/g, "");
  if (!parsed.ok || code.length !== 6) {
    return {
      ok: false,
      status: 400,
      error: !parsed.ok ? parsed.error : "Phone number and 6-digit code are required"
    };
  }

  const phone = parsed.e164;
  const codeHash = sha256Hex(`${phone}:${code}`);
  const entry = otpStore.get(phone);

  if (entry) {
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
      if (isSupabaseConfigured() && entry.otpId) {
        supabaseRequest(`/otp_codes?otp_id=eq.${encodeURIComponent(entry.otpId)}`, "PATCH", {
          attempt_count: entry.attempts
        }).catch(() => {});
      }
      return { ok: false, status: 400, error: "Invalid verification code" };
    }
    otpStore.delete(phone);
    if (isSupabaseConfigured() && entry.otpId) {
      await supabaseRequest(`/otp_codes?otp_id=eq.${encodeURIComponent(entry.otpId)}`, "PATCH", {
        consumed_at: new Date().toISOString(),
        attempt_count: entry.attempts
      }).catch(() => {});
    }
    return { ok: true, phone, countryIso: parsed.countryIso, channel: entry.channel };
  }

  // Fallback to Supabase `otp_codes` if server restarted since OTP was requested
  if (isSupabaseConfigured()) {
    const dbRes = await supabaseRequest(
      `/otp_codes?phone_number=eq.${encodeURIComponent(phone)}&consumed_at=is.null&order=created_at.desc&limit=1`
    );
    const row = dbRes.ok && Array.isArray(dbRes.data) ? dbRes.data[0] : null;
    if (!row) {
      return { ok: false, status: 400, error: "Verification code expired or not requested" };
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return { ok: false, status: 400, error: "Verification code has expired" };
    }
    const nextAttempts = (Number(row.attempt_count) || 0) + 1;
    if (nextAttempts > MAX_ATTEMPTS) {
      return { ok: false, status: 429, error: "Too many failed verification attempts" };
    }
    if (row.code_hash !== codeHash) {
      await supabaseRequest(`/otp_codes?otp_id=eq.${encodeURIComponent(row.otp_id)}`, "PATCH", {
        attempt_count: nextAttempts
      }).catch(() => {});
      return { ok: false, status: 400, error: "Invalid verification code" };
    }
    await supabaseRequest(`/otp_codes?otp_id=eq.${encodeURIComponent(row.otp_id)}`, "PATCH", {
      consumed_at: new Date().toISOString(),
      attempt_count: nextAttempts
    }).catch(() => {});
    return { ok: true, phone, countryIso: parsed.countryIso, channel: "whatsapp" };
  }

  return { ok: false, status: 400, error: "Verification code expired or not requested" };
}

function formatWhatsAppOtpMessage(code) {
  const safeCode = String(code || "").trim();
  return (
    `*FixIt* · رمز التحقق الخاص بك\n` +
    `رمز الدخول: *${safeCode}*\n` +
    `*صالح لمدة 5 دقائق* — لا تشاركه مع أحد.\n` +
    `────────────────────\n` +
    `*FixIt* Verification Code\n` +
    `Your code: *${safeCode}*\n` +
    `*Valid for 5 minutes* — Do not share it.`
  );
}

module.exports = {
  normalizePhoneE164,
  formatWhatsAppOtpMessage,
  sendOtp,
  verifyOtp
};
