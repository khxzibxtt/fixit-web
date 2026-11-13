/**
 * Authenticated App BFF (Backend-for-Frontend) & Gateway Router.
 * Routes all mobile app authentication, OTP, Google onboarding, profile completion,
 * rotating session codes, activity logs, notifications, and Supabase REST proxy calls
 * cleanly through fixit-now.xyz so ZERO Supabase/Twilio secrets ever ship inside APKs.
 */

const crypto = require("crypto");
const express = require("express");
const { createRateLimiter, getClientIp } = require("../middleware/rateLimit");
const {
  isConfigured: isSupabaseConfigured,
  getSupabaseUrl,
  supabaseRequest,
  supabaseAuthUser
} = require("../services/supabase");
const { sendOtp, verifyOtp } = require("../services/otp");
const { parseAndValidatePhone } = require("../services/phoneValidator");
const {
  createSession,
  validateAndTouchSession,
  revokeSession,
  recordAuditEvent,
  getRecentAuditLogs,
  isTrustedAdminIp,
  isValidAdminAccessCode
} = require("../services/authSession");

const TOKEN_SECRET = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_KEY || "fixit-dev-ephemeral-signing-secret";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "553273760450-q2v3ppbu3jg5n18labob4qpoajl04sjt.apps.googleusercontent.com";
const GOOGLE_ANDROID_CLIENT_ID = "553273760450-a5qrct2a5jeds5a18islmaosvlam8jdo.apps.googleusercontent.com";
const ALLOWED_GOOGLE_AUDS = new Set([GOOGLE_CLIENT_ID, GOOGLE_ANDROID_CLIENT_ID]);
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

const ALLOWLISTED_TABLES = new Set([
  "users",
  "wallets",
  "wallet_transactions",
  "jobs",
  "bids",
  "messages",
  "chat_messages",
  "job_photos",
  "notifications",
  "reviews",
  "vendor_availability",
  "vendor_profiles",
  "user_addresses",
  "user_settings",
  "user_devices",
  "coupons",
  "support_tickets",
  "support_messages",
  "referrals"
]);

function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str) {
  let b = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  return Buffer.from(b, "base64").toString("utf8");
}

function signPendingPayload(payload, ttlMs = 15 * 60 * 1000) {
  const obj = {
    ...payload,
    exp: Date.now() + ttlMs
  };
  const encoded = base64UrlEncode(JSON.stringify(obj));
  const sig = base64UrlEncode(crypto.createHmac("sha256", TOKEN_SECRET).update(encoded).digest());
  return `fxg_${encoded}.${sig}`;
}

function verifyPendingPayload(token) {
  const raw = String(token || "").trim();
  if (!raw.startsWith("fxg_") || !raw.includes(".")) return null;
  const body = raw.slice(4);
  const dot = body.lastIndexOf(".");
  if (dot <= 0) return null;
  const encoded = body.slice(0, dot);
  const sig = body.slice(dot + 1);
  const expected = base64UrlEncode(crypto.createHmac("sha256", TOKEN_SECRET).update(encoded).digest());
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const parsed = JSON.parse(base64UrlDecode(encoded));
    if (!parsed || Number(parsed.exp) <= Date.now()) return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function positiveIntEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}

function isPlaceholderName(name) {
  const clean = String(name || "").trim().toLowerCase();
  return !clean || clean === "fixit customer" || clean === "fixit user" || clean === "new user" || clean === "عميل fixit" || clean === "google user";
}

function splitNameParts(fullName) {
  const clean = String(fullName || "").trim();
  if (!clean) return { firstName: "", lastName: "" };
  const parts = clean.split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ")
  };
}

async function ensureWalletForUser(userId) {
  if (!isSupabaseConfigured() || !userId) return { balance: 0, locked_balance: 0, currency: "OMR" };
  const q = await supabaseRequest(`/wallets?user_id=eq.${encodeURIComponent(userId)}&limit=1`);
  if (q.ok && Array.isArray(q.data) && q.data[0]) return q.data[0];
  const nowIso = new Date().toISOString();
  const created = await supabaseRequest("/wallets", "POST", {
    wallet_id: crypto.randomUUID(),
    user_id: userId,
    balance: 0,
    locked_balance: 0,
    currency: "OMR",
    created_at: nowIso,
    updated_at: nowIso
  });
  return (created.ok && Array.isArray(created.data) && created.data[0])
    ? created.data[0]
    : { user_id: userId, balance: 0, locked_balance: 0, currency: "OMR" };
}

async function getUserSettings(userId) {
  if (!isSupabaseConfigured() || !userId) return {};
  const q = await supabaseRequest(`/user_settings?user_id=eq.${encodeURIComponent(userId)}&limit=1`);
  if (q.ok && Array.isArray(q.data) && q.data[0] && q.data[0].settings) {
    return q.data[0].settings;
  }
  return {};
}

async function upsertUserSettings(userId, patchObj) {
  if (!isSupabaseConfigured() || !userId) return patchObj;
  const existing = await getUserSettings(userId);
  const merged = {
    ...(existing && typeof existing === "object" ? existing : {}),
    ...(patchObj && typeof patchObj === "object" ? patchObj : {})
  };
  await supabaseRequest("/user_settings", "POST", {
    user_id: userId,
    settings: merged,
    updated_at: new Date().toISOString()
  }, { Prefer: "resolution=merge-duplicates,return=representation" }).catch(() => {});
  return merged;
}

function getRequestOrigin(req) {
  const host = String(req.get("x-forwarded-host") || req.get("host") || "fixit-now.xyz").split(",")[0].trim();
  const proto = String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  return `${proto}://${host}`;
}

function phoneRateKey(req) {
  const ip = getClientIp(req);
  const b = req.body && typeof req.body === "object" ? req.body : {};
  const parsed = parseAndValidatePhone({
    phone: b.phone || b.to || "",
    countryIso: b.countryIso || "",
    dialCode: b.dialCode || "",
    nationalNumber: b.nationalNumber || ""
  });
  const suffix = parsed.ok ? parsed.e164 : String(b.email || b.phone || b.nationalNumber || "").trim().toLowerCase().slice(0, 32);
  return `${ip}:${suffix || "anon"}`;
}

function createAppApiRouter() {
  const router = express.Router();

  const authSendLimiter = createRateLimiter({
    name: "auth-otp-send",
    windowMs: 5 * 60 * 1000,
    max: positiveIntEnv("TEST_AUTH_SEND_MAX", 25),
    keyGenerator: phoneRateKey,
    message: "Too many verification code requests. Please wait a minute before retrying."
  });

  const authVerifyLimiter = createRateLimiter({
    name: "auth-login-verify",
    windowMs: 5 * 60 * 1000,
    max: positiveIntEnv("TEST_AUTH_VERIFY_MAX", 40),
    keyGenerator: phoneRateKey,
    message: "Too many login attempts. Please wait a moment."
  });

  const proxyLimiter = createRateLimiter({
    name: "app-rest-proxy",
    windowMs: 60 * 1000,
    max: positiveIntEnv("TEST_PROXY_MAX", 180),
    message: "Request rate limit reached. Slow down briefly."
  });

  async function requireAppSession(req, res, next) {
    const code = req.get("x-fixit-session") || req.query.session_code || "";
    const role = String(req.get("x-fixit-role") || "consumer").trim().toLowerCase();
    const checked = await validateAndTouchSession({
      sessionCode: code,
      role,
      userAgent: req.get("user-agent") || "",
      ip: getClientIp(req),
      path: req.originalUrl || req.path,
      method: req.method,
      forceTouch: req.path.endsWith("/heartbeat"),
      adminCode: req.get("x-admin-code") || ""
    });
    if (!checked.ok) {
      return res.status(checked.status || 401).json({ ok: false, error: checked.error });
    }
    req.fixitSession = checked;
    return next();
  }

  // =========================================================================
  // 1. PHONE OTP SEND & VERIFY (STRICT VALIDATION + ANTI-ABUSE + SESSION)
  // =========================================================================
  router.post("/api/auth/otp/send", authSendLimiter, async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const rawChannel = String(b.channel || "whatsapp").trim().toLowerCase();
    if (rawChannel === "call" || rawChannel === "voice") {
      return res.status(400).json({ ok: false, error: "Voice call OTP is disabled. Choose WhatsApp or SMS." });
    }
    if (rawChannel !== "whatsapp" && rawChannel !== "sms") {
      return res.status(400).json({ ok: false, error: "Unsupported channel. Choose whatsapp or sms." });
    }

    const result = await sendOtp(b.phone || b.to || "", rawChannel, {
      countryIso: b.countryIso || "",
      dialCode: b.dialCode || "",
      nationalNumber: b.nationalNumber || "",
      purpose: "LOGIN"
    });
    recordAuditEvent({
      event: "OTP_SEND",
      role: b.role || "consumer",
      method: "POST",
      path: "/api/auth/otp/send",
      ip: getClientIp(req),
      status: result.status || (result.ok ? 200 : 400),
      note: result.ok ? `${rawChannel} sent` : (result.error || "rejected")
    });
    return res.status(result.status || (result.ok ? 200 : 400)).json(result);
  });

  router.post("/api/auth/otp/verify", authVerifyLimiter, async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const otpRes = await verifyOtp(b.phone || b.to || "", b.code || b.otp || "", {
      countryIso: b.countryIso || "",
      dialCode: b.dialCode || "",
      nationalNumber: b.nationalNumber || ""
    });
    if (!otpRes.ok) {
      recordAuditEvent({
        event: "OTP_VERIFY_FAILED",
        method: "POST",
        path: "/api/auth/otp/verify",
        ip: getClientIp(req),
        status: otpRes.status || 400,
        note: otpRes.error
      });
      return res.status(otpRes.status || 400).json(otpRes);
    }

    const phone = otpRes.phone;
    const roleRaw = String(b.role || "consumer").trim().toLowerCase();
    const dbRole = roleRaw === "vendor" ? "VENDOR" : roleRaw === "admin" ? "ADMIN" : "CONSUMER";
    const lang = b.lang === "ar" ? "ar" : "en";
    const nowIso = new Date().toISOString();

    if (!isSupabaseConfigured()) {
      return res.status(503).json({
        ok: false,
        error: "Server database is not configured yet (SUPABASE_SERVICE_KEY missing on server)."
      });
    }

    // Mode A: Completing Google Sign-Up by linking a unique verified phone number
    if (b.mode === "link_google") {
      const pending = verifyPendingPayload(b.pendingToken);
      if (!pending || !pending.email) {
        return res.status(401).json({
          ok: false,
          error: "Google verification session expired. Please sign in with Google again."
        });
      }

      const confirmedFirst = String(b.firstName || "").trim();
      const confirmedLast = String(b.lastName || "").trim();
      const confirmedName = `${confirmedFirst} ${confirmedLast}`.trim() || pending.fullName || pending.email.split("@")[0];
      const avatarUrl = String(b.avatarUrl || pending.avatarUrl || "").trim();
      const customAvatar = Boolean(b.customAvatar);

      const phoneLookup = await supabaseRequest(`/users?phone_number=eq.${encodeURIComponent(phone)}&select=*&limit=2`);
      const phoneOwner = phoneLookup.ok && Array.isArray(phoneLookup.data) ? phoneLookup.data[0] : null;
      if (phoneOwner && (!pending.existingUserId || phoneOwner.user_id !== pending.existingUserId)) {
        const ownerEmail = normalizeEmail(phoneOwner.email);
        if (!ownerEmail || ownerEmail !== normalizeEmail(pending.email)) {
          recordAuditEvent({
            event: "ANTI_ABUSE_DUPLICATE_PHONE_BLOCKED",
            userId: phoneOwner.user_id,
            role: roleRaw,
            method: "POST",
            path: "/api/auth/otp/verify",
            ip: getClientIp(req),
            status: 409,
            note: `Blocked linking ${phone} to Google ${pending.email}`
          });
          return res.status(409).json({
            ok: false,
            code: "PHONE_ALREADY_LINKED",
            error: "This phone number is already linked to another FixIt account. One verified number per account protects referral rewards.",
            errorAr: "رقم الهاتف هذا مرتبط بحساب آخر بالفعل. مسموح برقم واحد لكل حساب لحماية نظام المكافآت."
          });
        }
      }

      const emailLookup = await supabaseRequest(`/users?email=eq.${encodeURIComponent(normalizeEmail(pending.email))}&select=*&limit=1`);
      const emailOwner = emailLookup.ok && Array.isArray(emailLookup.data) ? emailLookup.data[0] : null;
      if (roleRaw === "admin" && (!emailOwner || emailOwner.role !== "ADMIN")) {
        return res.status(403).json({
          ok: false,
          error: "This Google account is not authorized for FixIt Admin access."
        });
      }
      const targetUserId = (emailOwner && emailOwner.user_id) || pending.existingUserId || crypto.randomUUID();

      let userRow = null;
      if (emailOwner) {
        const patchRes = await supabaseRequest(`/users?user_id=eq.${encodeURIComponent(targetUserId)}`, "PATCH", {
          phone_number: phone,
          full_name: confirmedName,
          preferred_language: lang,
          updated_at: nowIso
        });
        if (!patchRes.ok) {
          return res.status(502).json({ ok: false, error: patchRes.error || "Failed to save verified phone to account" });
        }
        userRow = Array.isArray(patchRes.data) ? patchRes.data[0] : { ...emailOwner, phone_number: phone, full_name: confirmedName };
      } else {
        const insertRes = await supabaseRequest("/users", "POST", {
          user_id: targetUserId,
          phone_number: phone,
          full_name: confirmedName,
          email: normalizeEmail(pending.email),
          role: dbRole,
          preferred_language: lang,
          is_active: true,
          created_at: nowIso,
          updated_at: nowIso
        }, { Prefer: "resolution=merge-duplicates,return=representation" });
        if (!insertRes.ok) {
          return res.status(502).json({ ok: false, error: insertRes.error || "Failed to create verified Google user" });
        }
        userRow = (Array.isArray(insertRes.data) && insertRes.data[0]) || {
          user_id: targetUserId,
          phone_number: phone,
          full_name: confirmedName,
          email: normalizeEmail(pending.email),
          role: dbRole
        };
      }

      const settings = await upsertUserSettings(targetUserId, {
        avatar_url: avatarUrl || undefined,
        custom_avatar: customAvatar,
        auth_provider: "google",
        phone_verified_at: nowIso,
        onboarding_completed_at: nowIso
      });
      const wallet = await ensureWalletForUser(targetUserId);
      const sess = await createSession({
        userId: targetUserId,
        role: roleRaw,
        userAgent: req.get("user-agent") || "",
        ip: getClientIp(req),
        deviceId: b.deviceId || ""
      });

      return res.json({
        ok: true,
        isNewUser: !emailOwner,
        needsProfileConfirm: false,
        needsPhoneVerification: false,
        needsProfileCompletion: false,
        sessionCode: sess.sessionCode,
        sessionExpiresAt: sess.expiresAt,
        user: userRow,
        settings,
        wallet
      });
    }

    // Mode B: Standard Phone OTP Sign-In / Sign-Up
    const foundRes = await supabaseRequest(`/users?phone_number=eq.${encodeURIComponent(phone)}&select=*&limit=1`);
    if (!foundRes.ok) {
      return res.status(502).json({ ok: false, error: foundRes.error || "Database query error" });
    }
    const existing = Array.isArray(foundRes.data) ? foundRes.data[0] : null;

    if (roleRaw === "admin" && (!existing || existing.role !== "ADMIN")) {
      return res.status(403).json({
        ok: false,
        error: "This phone number is not authorized for FixIt Admin access."
      });
    }

    let userRow = existing;
    let isNewUser = false;
    if (!userRow) {
      isNewUser = true;
      const newUid = crypto.randomUUID();
      const created = await supabaseRequest("/users", "POST", {
        user_id: newUid,
        phone_number: phone,
        full_name: "New User",
        role: dbRole,
        preferred_language: lang,
        is_active: true,
        created_at: nowIso,
        updated_at: nowIso
      });
      if (!created.ok) {
        return res.status(502).json({ ok: false, error: created.error || "Could not create user in database" });
      }
      userRow = (Array.isArray(created.data) && created.data[0]) || {
        user_id: newUid,
        phone_number: phone,
        full_name: "New User",
        role: dbRole,
        preferred_language: lang,
        is_active: true,
        created_at: nowIso,
        updated_at: nowIso
      };
    }

    const existingSettings = await upsertUserSettings(userRow.user_id, {
      auth_provider: (await getUserSettings(userRow.user_id)).auth_provider || "phone",
      phone_verified_at: nowIso
    });
    const wallet = await ensureWalletForUser(userRow.user_id);
    const sess = await createSession({
      userId: userRow.user_id,
      role: roleRaw,
      userAgent: req.get("user-agent") || "",
      ip: getClientIp(req),
      deviceId: b.deviceId || ""
    });

    const needsProfileCompletion = isNewUser || isPlaceholderName(userRow.full_name) || !existingSettings.onboarding_completed_at;
    return res.json({
      ok: true,
      isNewUser,
      needsProfileCompletion,
      sessionCode: sess.sessionCode,
      sessionExpiresAt: sess.expiresAt,
      user: userRow,
      settings: existingSettings,
      wallet
    });
  });

  // =========================================================================
  // 2. GOOGLE OAUTH START / CALLBACK / EXCHANGE
  // =========================================================================
  router.get("/api/auth/google/start", authVerifyLimiter, (req, res) => {
    const role = String(req.query.role || "consumer").toLowerCase();
    const origin = getRequestOrigin(req);
    const state = base64UrlEncode(JSON.stringify({ role, ts: Date.now() }));

    if (GOOGLE_CLIENT_SECRET && process.env.ENABLE_DIRECT_GOOGLE_OAUTH === "1") {
      const cb = `${origin}/api/auth/google/callback`;
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: cb,
        response_type: "code",
        scope: "openid email profile",
        access_type: "online",
        prompt: "select_account",
        state
      });
      return res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    }

    const sbUrl = getSupabaseUrl();
    const redirectTo = `${origin}/auth/callback`;
    return res.redirect(302, `${sbUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`);
  });

  router.get("/api/auth/google/callback", authVerifyLimiter, async (req, res) => {
    const code = String(req.query.code || "").trim();
    const err = String(req.query.error || "").trim();
    const origin = getRequestOrigin(req);
    if (err || !code || !GOOGLE_CLIENT_SECRET) {
      const reason = encodeURIComponent(err || "Missing authorization code");
      return res.redirect(302, `${origin}/auth/callback?error=${reason}`);
    }

    try {
      const cb = `${origin}/api/auth/google/callback`;
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: cb,
          grant_type: "authorization_code"
        }).toString()
      });
      const tokenJson = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenJson.access_token) {
        return res.redirect(302, `${origin}/auth/callback?error=${encodeURIComponent("Google token exchange failed")}`);
      }

      const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` }
      });
      const info = await infoRes.json().catch(() => ({}));
      if (!infoRes.ok || !info.email) {
        return res.redirect(302, `${origin}/auth/callback?error=${encodeURIComponent("Could not read Google profile")}`);
      }

      const pendingToken = signPendingPayload({
        email: normalizeEmail(info.email),
        fullName: info.name || `${info.given_name || ""} ${info.family_name || ""}`.trim() || info.email.split("@")[0],
        avatarUrl: info.picture || ""
      });
      return res.redirect(302, `${origin}/auth/callback?pending_token=${encodeURIComponent(pendingToken)}`);
    } catch (_) {
      return res.redirect(302, `${origin}/auth/callback?error=${encodeURIComponent("Google callback network error")}`);
    }
  });

  router.post("/api/auth/google/exchange", authVerifyLimiter, async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const roleRaw = String(b.role || "consumer").trim().toLowerCase();

    if (!isSupabaseConfigured()) {
      return res.status(503).json({
        ok: false,
        error: "Server database is not configured yet (SUPABASE_SERVICE_KEY missing on server)."
      });
    }

    let gEmail = "";
    let gName = "";
    let gPicture = "";

    if (b.pendingToken) {
      const pending = verifyPendingPayload(b.pendingToken);
      if (!pending || !pending.email) {
        return res.status(401).json({ ok: false, error: "Google login session expired. Please try again." });
      }
      gEmail = normalizeEmail(pending.email);
      gName = pending.fullName || "";
      gPicture = pending.avatarUrl || "";
    } else if (b.idToken) {
      try {
        const tiRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(b.idToken))}`);
        const ti = await tiRes.json().catch(() => ({}));
        if (!tiRes.ok || !ti.email || (ti.aud && !ALLOWED_GOOGLE_AUDS.has(ti.aud))) {
          return res.status(401).json({ ok: false, error: "Invalid Google ID token" });
        }
        gEmail = normalizeEmail(ti.email);
        gName = ti.name || "";
        gPicture = ti.picture || "";
      } catch (_) {
        return res.status(502).json({ ok: false, error: "Failed to verify Google ID token" });
      }
    } else if (b.accessToken) {
      const sbUser = await supabaseAuthUser(String(b.accessToken));
      if (!sbUser.ok || !sbUser.data || !sbUser.data.email) {
        // Also try Google userinfo directly in case accessToken is a raw Google OAuth access token
        try {
          const giRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${String(b.accessToken)}` }
          });
          const gi = await giRes.json().catch(() => ({}));
          if (!giRes.ok || !gi.email) {
            return res.status(401).json({ ok: false, error: sbUser.error || "Could not verify Google token" });
          }
          gEmail = normalizeEmail(gi.email);
          gName = gi.name || "";
          gPicture = gi.picture || "";
        } catch (_) {
          return res.status(401).json({ ok: false, error: sbUser.error || "Could not verify Google token" });
        }
      } else {
        const u = sbUser.data;
        const meta = u.user_metadata || {};
        gEmail = normalizeEmail(u.email || meta.email);
        gName = meta.full_name || meta.name || "";
        gPicture = meta.avatar_url || meta.picture || "";
      }
    } else if (b.code) {
      if (!GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({ ok: false, error: "GOOGLE_CLIENT_SECRET not configured on server" });
      }
      try {
        const origin = getRequestOrigin(req);
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code: String(b.code),
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: `${origin}/api/auth/google/callback`,
            grant_type: "authorization_code"
          }).toString()
        });
        const tokenJson = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok || !tokenJson.access_token) {
          return res.status(401).json({ ok: false, error: tokenJson.error_description || "Google authorization code exchange failed" });
        }
        const giRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenJson.access_token}` }
        });
        const gi = await giRes.json().catch(() => ({}));
        if (!giRes.ok || !gi.email) {
          return res.status(401).json({ ok: false, error: "Could not read Google profile" });
        }
        gEmail = normalizeEmail(gi.email);
        gName = gi.name || "";
        gPicture = gi.picture || "";
      } catch (_) {
        return res.status(502).json({ ok: false, error: "Network error exchanging Google code" });
      }
    } else {
      return res.status(400).json({ ok: false, error: "Missing Google authentication credential" });
    }

    if (!gEmail || !gEmail.includes("@")) {
      return res.status(400).json({ ok: false, error: "Valid Google email is required" });
    }

    const userRes = await supabaseRequest(`/users?email=eq.${encodeURIComponent(gEmail)}&select=*&limit=1`);
    if (!userRes.ok) {
      return res.status(502).json({ ok: false, error: userRes.error || "Database query failed" });
    }
    const existing = Array.isArray(userRes.data) ? userRes.data[0] : null;
    if (roleRaw === "admin" && (!existing || existing.role !== "ADMIN")) {
      return res.status(403).json({
        ok: false,
        error: "This Google account is not authorized for FixIt Admin access."
      });
    }
    const validPhoneCheck = existing && existing.phone_number
      ? parseAndValidatePhone({ phone: existing.phone_number })
      : { ok: false };

    // Returning user with verified phone & non-placeholder name -> immediate Home admission!
    if (existing && validPhoneCheck.ok && !isPlaceholderName(existing.full_name)) {
      const curSettings = await getUserSettings(existing.user_id);
      const settings = await upsertUserSettings(existing.user_id, {
        avatar_url: curSettings.custom_avatar ? curSettings.avatar_url : (gPicture || curSettings.avatar_url || ""),
        auth_provider: curSettings.auth_provider || "google"
      });
      const wallet = await ensureWalletForUser(existing.user_id);
      const sess = await createSession({
        userId: existing.user_id,
        role: roleRaw,
        userAgent: req.get("user-agent") || "",
        ip: getClientIp(req),
        deviceId: b.deviceId || ""
      });
      return res.json({
        ok: true,
        status: "COMPLETE",
        needsProfileConfirm: false,
        needsPhoneVerification: false,
        sessionCode: sess.sessionCode,
        sessionExpiresAt: sess.expiresAt,
        user: existing,
        settings,
        wallet
      });
    }

    // New Google user OR existing Google user without verified phone -> Mandatory confirm + phone verification!
    const displayFullName = (existing && !isPlaceholderName(existing.full_name) ? existing.full_name : gName) || gEmail.split("@")[0];
    const parts = splitNameParts(displayFullName);
    const pendingToken = signPendingPayload({
      email: gEmail,
      fullName: displayFullName,
      avatarUrl: gPicture,
      existingUserId: existing ? existing.user_id : ""
    });

    recordAuditEvent({
      event: "GOOGLE_NEEDS_ONBOARDING",
      userId: existing ? existing.user_id : null,
      role: roleRaw,
      method: "POST",
      path: "/api/auth/google/exchange",
      ip: getClientIp(req),
      status: 200,
      note: gEmail
    });

    return res.json({
      ok: true,
      status: "NEEDS_ONBOARDING",
      needsProfileConfirm: true,
      needsPhoneVerification: true,
      pendingToken,
      googleProfile: {
        email: gEmail,
        fullName: displayFullName,
        firstName: parts.firstName,
        lastName: parts.lastName,
        avatarUrl: gPicture
      }
    });
  });

  // =========================================================================
  // 3. POST-SIGNUP DETAILS COMPLETION & SESSION MANAGEMENT
  // =========================================================================
  router.post("/api/auth/profile/complete", requireAppSession, async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const userId = req.fixitSession.userId;
    const firstName = String(b.firstName || "").trim();
    const lastName = String(b.lastName || "").trim();
    const fullName = String(b.fullName || `${firstName} ${lastName}`.trim()).trim();

    if (fullName.length < 2 || fullName.length > 80) {
      return res.status(400).json({
        ok: false,
        error: "Please enter your full name (at least 2 characters).",
        errorAr: "يرجى إدخال اسمك الكامل (حرفين على الأقل)."
      });
    }

    const email = normalizeEmail(b.email);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({
        ok: false,
        error: "Please enter a valid email address.",
        errorAr: "يرجى إدخال بريد إلكتروني صحيح."
      });
    }

    const lang = b.preferredLanguage === "ar" ? "ar" : "en";
    const nowIso = new Date().toISOString();
    const patchBody = {
      full_name: fullName,
      preferred_language: lang,
      updated_at: nowIso
    };
    if (email) patchBody.email = email;

    const patchRes = await supabaseRequest(`/users?user_id=eq.${encodeURIComponent(userId)}`, "PATCH", patchBody);
    if (!patchRes.ok) {
      return res.status(502).json({ ok: false, error: patchRes.error || "Failed to save profile" });
    }
    const updatedUser = (Array.isArray(patchRes.data) && patchRes.data[0]) || { user_id: userId, ...patchBody };

    const settingsPatch = {
      onboarding_completed_at: nowIso
    };
    if (b.dob !== undefined) settingsPatch.dob = String(b.dob || "").trim().slice(0, 32);
    if (b.gender !== undefined) settingsPatch.gender = String(b.gender || "").trim().slice(0, 16);
    if (b.avatarUrl !== undefined && String(b.avatarUrl).length < 400000) {
      settingsPatch.avatar_url = String(b.avatarUrl || "");
      settingsPatch.custom_avatar = Boolean(b.customAvatar);
    }
    const settings = await upsertUserSettings(userId, settingsPatch);

    return res.json({
      ok: true,
      user: updatedUser,
      settings
    });
  });

  router.post("/api/auth/session/heartbeat", requireAppSession, (req, res) => {
    return res.json({
      ok: true,
      userId: req.fixitSession.userId,
      sessionId: req.fixitSession.sessionId,
      expiresAt: req.fixitSession.expiresAt,
      serverTime: req.fixitSession.lastSeenAt
    });
  });

  router.post("/api/auth/logout", async (req, res) => {
    const code = req.get("x-fixit-session") || (req.body && req.body.sessionCode) || "";
    await revokeSession(code);
    return res.json({ ok: true });
  });

  // Admin operator login via server-side ADMIN_ACCESS_CODE (never shipped in APKs) or trusted location IP
  router.post("/api/auth/admin-login", authVerifyLimiter, async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const clientIp = getClientIp(req);
    const trustedIp = isTrustedAdminIp(clientIp);
    const expectedCode = String(process.env.ADMIN_ACCESS_CODE || "").trim();
    const providedCode = String(b.accessCode || req.get("x-admin-code") || "").trim();
    if (!trustedIp) {
      if (!expectedCode) {
        return res.status(503).json({
          ok: false,
          error: "Admin access code login is not configured on the server."
        });
      }
      if (!isValidAdminAccessCode(providedCode)) {
        recordAuditEvent({
          event: "ADMIN_LOGIN_DENIED",
          role: "admin",
          method: "POST",
          path: "/api/auth/admin-login",
          ip: clientIp,
          status: 403
        });
        return res.status(403).json({ ok: false, error: "Invalid admin access code." });
      }
    }
    if (!isSupabaseConfigured()) {
      return res.json({
        ok: true,
        sessionCode: "fixit_admin_master_session",
        sessionExpiresAt: "2099-01-01T00:00:00.000Z",
        user: { user_id: "b3264964-ab0e-4638-8514-62de24ba511f", role: "ADMIN", full_name: "Ops Admin" }
      });
    }
    const adminRes = await supabaseRequest("/users?role=eq.ADMIN&order=created_at.asc&limit=1");
    const adminRow = adminRes.ok && Array.isArray(adminRes.data) ? adminRes.data[0] : null;
    if (!adminRow) {
      return res.json({
        ok: true,
        sessionCode: "fixit_admin_master_session",
        sessionExpiresAt: "2099-01-01T00:00:00.000Z",
        user: { user_id: "b3264964-ab0e-4638-8514-62de24ba511f", role: "ADMIN", full_name: "Ops Admin" }
      });
    }
    const sess = await createSession({
      userId: adminRow.user_id,
      role: "admin",
      userAgent: req.get("user-agent") || "",
      ip: clientIp,
      deviceId: b.deviceId || "admin_device"
    });
    return res.json({
      ok: true,
      sessionCode: sess.sessionCode,
      sessionExpiresAt: sess.expiresAt,
      user: adminRow
    });
  });

  // =========================================================================
  // 4. BOOTSTRAP HYDRATION, REST PROXY & NATIVE NOTIFICATIONS
  // =========================================================================
  router.get("/api/app/bootstrap", proxyLimiter, requireAppSession, async (req, res) => {
    if (!isSupabaseConfigured()) {
      return res.status(503).json({ ok: false, error: "Server database not configured" });
    }
    const uid = req.fixitSession.userId;
    const role = String(req.fixitSession.role || "consumer").toLowerCase();
    const isAdmin = role === "admin";
    const uEnc = encodeURIComponent(uid);

    const queries = [
      supabaseRequest(`/users?user_id=eq.${uEnc}&limit=1`),
      supabaseRequest(`/user_settings?user_id=eq.${uEnc}&limit=1`),
      supabaseRequest(`/wallets?user_id=eq.${uEnc}&limit=1`),
      supabaseRequest(`/wallet_transactions?user_id=eq.${uEnc}&order=created_at.desc&limit=40`),
      supabaseRequest("/jobs?order=created_at.desc&limit=80"),
      supabaseRequest("/messages?order=created_at.desc&limit=300"),
      supabaseRequest("/bids?order=created_at.desc&limit=150"),
      supabaseRequest("/job_photos?order=created_at.desc&limit=80"),
      isAdmin
        ? supabaseRequest("/notifications?order=created_at.desc&limit=50")
        : supabaseRequest(`/notifications?user_id=eq.${uEnc}&order=created_at.desc&limit=50`),
      supabaseRequest("/reviews?order=created_at.desc&limit=50"),
      supabaseRequest("/vendor_availability?limit=30"),
      supabaseRequest("/vendor_profiles?limit=30"),
      supabaseRequest(`/user_addresses?user_id=eq.${uEnc}&order=created_at.desc`),
      supabaseRequest("/coupons?is_active=eq.true"),
      isAdmin
        ? supabaseRequest("/support_tickets?order=created_at.desc&limit=80")
        : supabaseRequest(`/support_tickets?user_id=eq.${uEnc}&order=created_at.desc`),
      isAdmin
        ? supabaseRequest("/support_messages?order=created_at.asc&limit=150")
        : supabaseRequest(`/support_messages?user_id=eq.${uEnc}&order=created_at.asc&limit=150`),
      isAdmin ? supabaseRequest("/users?order=created_at.desc&limit=100") : Promise.resolve({ ok: true, data: [] }),
      isAdmin ? supabaseRequest("/wallets?limit=80") : Promise.resolve({ ok: true, data: [] })
    ];

    const [
      uRes, setRes, wRes, txRes, jobsRes, msgsRes, bidsRes, photosRes,
      notifsRes, revRes, vLocRes, vProfRes, addrRes, cpnRes, tktRes, supMsgRes, allUsersRes, allWalletsRes
    ] = await Promise.all(queries);

    return res.json({
      ok: true,
      serverTime: new Date().toISOString(),
      user: uRes.ok && Array.isArray(uRes.data) ? (uRes.data[0] || null) : null,
      settings: setRes.ok && Array.isArray(setRes.data) && setRes.data[0] ? (setRes.data[0].settings || {}) : {},
      wallet: wRes.ok && Array.isArray(wRes.data) ? (wRes.data[0] || null) : null,
      walletTransactions: txRes.ok && Array.isArray(txRes.data) ? txRes.data : [],
      jobs: jobsRes.ok && Array.isArray(jobsRes.data) ? jobsRes.data : [],
      messages: msgsRes.ok && Array.isArray(msgsRes.data) ? msgsRes.data : [],
      bids: bidsRes.ok && Array.isArray(bidsRes.data) ? bidsRes.data : [],
      jobPhotos: photosRes.ok && Array.isArray(photosRes.data) ? photosRes.data : [],
      notifications: notifsRes.ok && Array.isArray(notifsRes.data) ? notifsRes.data : [],
      reviews: revRes.ok && Array.isArray(revRes.data) ? revRes.data : [],
      vendorLocations: vLocRes.ok && Array.isArray(vLocRes.data) ? vLocRes.data : [],
      vendorProfiles: vProfRes.ok && Array.isArray(vProfRes.data) ? vProfRes.data : [],
      addresses: addrRes.ok && Array.isArray(addrRes.data) ? addrRes.data : [],
      coupons: cpnRes.ok && Array.isArray(cpnRes.data) ? cpnRes.data : [],
      supportTickets: tktRes.ok && Array.isArray(tktRes.data) ? tktRes.data : [],
      supportMessages: supMsgRes.ok && Array.isArray(supMsgRes.data) ? supMsgRes.data : [],
      adminUsers: allUsersRes.ok && Array.isArray(allUsersRes.data) ? allUsersRes.data : [],
      adminWallets: allWalletsRes.ok && Array.isArray(allWalletsRes.data) ? allWalletsRes.data : []
    });
  });

  router.get("/api/app/notifications", proxyLimiter, requireAppSession, async (req, res) => {
    if (!isSupabaseConfigured()) {
      return res.json([]);
    }
    const uid = req.fixitSession.userId;
    const role = String(req.fixitSession.role || "consumer").toLowerCase();
    const path = role === "admin"
      ? "/notifications?order=created_at.desc&limit=8"
      : `/notifications?user_id=eq.${encodeURIComponent(uid)}&order=created_at.desc&limit=8`;
    const dbRes = await supabaseRequest(path);
    if (!dbRes.ok) return res.status(dbRes.status || 502).json([]);
    return res.json(Array.isArray(dbRes.data) ? dbRes.data : []);
  });

  router.get("/api/app/audit-logs", proxyLimiter, requireAppSession, (req, res) => {
    const role = String(req.fixitSession.role || "consumer").toLowerCase();
    const all = getRecentAuditLogs(100);
    if (role === "admin") {
      return res.json({ ok: true, logs: all });
    }
    return res.json({ ok: true, logs: all.filter(l => l.userId === req.fixitSession.userId) });
  });

  // Generic PostgREST proxy for app reads & writes (`app -> fixit-now.xyz -> Supabase`)
  router.all("/api/app/rest/:table", proxyLimiter, requireAppSession, async (req, res) => {
    const table = String(req.params.table || "").trim();
    if (!ALLOWLISTED_TABLES.has(table)) {
      return res.status(403).json({ ok: false, error: `Table '${table}' is not accessible via app gateway.` });
    }
    if (!isSupabaseConfigured()) {
      return res.status(503).json({ ok: false, error: "Server database not configured" });
    }

    const role = String(req.fixitSession.role || "consumer").toLowerCase();
    if (table === "users" && req.method === "DELETE" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "Account deletion requires admin approval" });
    }

    const qIdx = req.originalUrl.indexOf("?");
    const qs = qIdx >= 0 ? req.originalUrl.slice(qIdx) : "";
    const forwardPath = `/${table}${qs}`;
    const extraHeaders = {};
    if (req.get("prefer")) extraHeaders.Prefer = req.get("prefer");

    const method = req.method.toUpperCase();
    const body = (method === "GET" || method === "HEAD") ? undefined : req.body;

    const result = await supabaseRequest(forwardPath, method, body, extraHeaders);
    if (!result.ok) {
      return res.status(result.status || 502).json({
        ok: false,
        error: result.error || "Database request failed",
        details: result.data || null
      });
    }
    return res.status(result.status || 200).json(result.data);
  });

  const appControlState = {
    maintenance: false,
    maintenanceMessage: "We are upgrading FixIt to serve you better.",
    maintenanceUntil: null,
    minVersionCode: 165,
    latestVersionCode: 166,
    forceUpdate: false,
    updatedAt: new Date().toISOString()
  };

  router.get("/api/app/status", (req, res) => {
    if (appControlState.maintenance && appControlState.maintenanceUntil) {
      const untilMs = Date.parse(appControlState.maintenanceUntil);
      if (Number.isFinite(untilMs) && Date.now() >= untilMs) {
        appControlState.maintenance = false;
        appControlState.maintenanceUntil = null;
      }
    }
    const role = String(req.query.role || "consumer").toLowerCase();
    const updateUrl = role === "vendor"
      ? "https://fixit-now.xyz/downloads/FixIt-Vendor.apk"
      : "https://fixit-now.xyz/downloads/FixIt-Consumer.apk";
    return res.json({
      ok: true,
      ...appControlState,
      updateUrl
    });
  });

  router.post("/api/app/admin/control", requireAppSession, (req, res) => {
    const role = String(req.fixitSession.role || "").toLowerCase();
    if (role !== "admin") {
      return res.status(403).json({ ok: false, error: "Admin access required" });
    }
    const b = req.body || {};
    if (typeof b.maintenance === "boolean") {
      appControlState.maintenance = b.maintenance;
    }
    if (typeof b.maintenanceMessage === "string" && b.maintenanceMessage.trim()) {
      appControlState.maintenanceMessage = b.maintenanceMessage.trim().slice(0, 180);
    }
    if (b.durationMinutes !== undefined && b.durationMinutes !== null) {
      const mins = Number(b.durationMinutes);
      appControlState.maintenanceUntil = (Number.isFinite(mins) && mins > 0)
        ? new Date(Date.now() + mins * 60000).toISOString()
        : null;
    } else if (b.maintenanceUntil !== undefined) {
      appControlState.maintenanceUntil = b.maintenanceUntil ? String(b.maintenanceUntil) : null;
    }
    if (!appControlState.maintenance) {
      appControlState.maintenanceUntil = null;
    }
    if (Number.isFinite(Number(b.minVersionCode))) {
      appControlState.minVersionCode = Math.max(1, parseInt(b.minVersionCode, 10));
    }
    if (Number.isFinite(Number(b.latestVersionCode))) {
      appControlState.latestVersionCode = Math.max(1, parseInt(b.latestVersionCode, 10));
    }
    if (typeof b.forceUpdate === "boolean") {
      appControlState.forceUpdate = b.forceUpdate;
    }
    appControlState.updatedAt = new Date().toISOString();
    return res.json({ ok: true, ...appControlState });
  });

  const waWeb = require("../services/whatsappWeb");

  router.get("/api/app/admin/whatsapp-status", requireAppSession, async (req, res) => {
    const role = String(req.fixitSession.role || "").toLowerCase();
    if (role !== "admin") return res.status(403).json({ ok: false, error: "Admin access required" });
    const st = await waWeb.getWhatsAppStatus();
    return res.json(st);
  });

  router.post("/api/app/admin/whatsapp-pair", requireAppSession, async (req, res) => {
    const role = String(req.fixitSession.role || "").toLowerCase();
    if (role !== "admin") return res.status(403).json({ ok: false, error: "Admin access required" });
    const b = req.body || {};
    const phone = b.phone || "";
    const pairRes = await waWeb.requestPairing(phone, { reset: Boolean(b.reset) });
    return res.json(pairRes);
  });

  return router;
}

module.exports = {
  createAppApiRouter,
  signPendingPayload,
  verifyPendingPayload
};
