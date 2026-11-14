/**
 * Authenticated App BFF (Backend-for-Frontend) & Gateway Router.
 * Routes all mobile app authentication, OTP, Google onboarding, profile completion,
 * rotating session codes, activity logs, notifications, and Supabase REST proxy calls
 * cleanly through fixit-now.xyz so ZERO Supabase/Twilio secrets ever ship inside APKs.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
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

function getGoogleOAuthOrigin(req) {
  if (process.env.PUBLIC_ORIGIN) {
    return String(process.env.PUBLIC_ORIGIN).replace(/\/+$/, "");
  }
  const rawHost = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim().toLowerCase();
  if (!rawHost || rawHost.includes("fixit-now.xyz") || rawHost.includes("onrender.com")) {
    return "https://fixit-now.xyz";
  }
  return getRequestOrigin(req);
}

function parseOAuthState(rawState) {
  try {
    const parsed = JSON.parse(base64UrlDecode(String(rawState || "").trim()));
    if (parsed && typeof parsed === "object") {
      return {
        role: String(parsed.role || "consumer").trim().toLowerCase() || "consumer",
        web: Number(parsed.web) === 1
      };
    }
  } catch (_) {}
  return { role: "consumer", web: false };
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
    const rawChannel = String(b.channel || "whatsapp").trim().toLowerCase() || "whatsapp";
    if (rawChannel !== "whatsapp") {
      return res.status(400).json({
        ok: false,
        error: "Only WhatsApp verification is supported. SMS OTP has been disabled.",
        errorAr: "التحقق متاح عبر واتساب فقط. تم إيقاف رسائل SMS."
      });
    }

    const result = await sendOtp(b.phone || b.to || "", "whatsapp", {
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

    const curSettings = await getUserSettings(userRow.user_id);
    const hasRealName = Boolean(userRow && !isPlaceholderName(userRow.full_name));
    const settingsPatch = {
      auth_provider: curSettings.auth_provider || "phone",
      phone_verified_at: nowIso
    };
    if (!isNewUser && hasRealName && !curSettings.onboarding_completed_at) {
      settingsPatch.onboarding_completed_at = nowIso;
    }
    const existingSettings = await upsertUserSettings(userRow.user_id, settingsPatch);
    const wallet = await ensureWalletForUser(userRow.user_id);
    const sess = await createSession({
      userId: userRow.user_id,
      role: roleRaw,
      userAgent: req.get("user-agent") || "",
      ip: getClientIp(req),
      deviceId: b.deviceId || ""
    });

    const needsProfileCompletion = isNewUser || !hasRealName;
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
    const role = String(req.query.role || "consumer").trim().toLowerCase() || "consumer";
    const isWebClient = String(req.query.web || "").trim() === "1";
    const origin = getGoogleOAuthOrigin(req);
    const state = base64UrlEncode(JSON.stringify({ role, web: isWebClient ? 1 : 0, ts: Date.now() }));

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
    const redirectTo = isWebClient
      ? `${origin}/app?role=${encodeURIComponent(role)}`
      : `${origin}/auth/callback?role=${encodeURIComponent(role)}`;
    return res.redirect(302, `${sbUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`);
  });

  router.get("/api/auth/google/callback", authVerifyLimiter, async (req, res) => {
    const code = String(req.query.code || "").trim();
    const err = String(req.query.error_description || req.query.error || "").trim();
    const stateMeta = parseOAuthState(req.query.state);
    const role = stateMeta.role || "consumer";
    const origin = getGoogleOAuthOrigin(req);
    const buildReturnUrl = paramsObj => {
      const qs = new URLSearchParams(paramsObj);
      if (role) qs.set("role", role);
      const targetPath = stateMeta.web ? "/app" : "/auth/callback";
      return `${origin}${targetPath}?${qs.toString()}`;
    };

    if (err || !code || !GOOGLE_CLIENT_SECRET) {
      return res.redirect(302, buildReturnUrl({ error: err || "Missing authorization code" }));
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
        console.warn("[GOOGLE-OAUTH-CB-ERR]", tokenRes.status, tokenJson.error || "", tokenJson.error_description || "");
        return res.redirect(302, buildReturnUrl({
          error: tokenJson.error_description || tokenJson.error || "Google token exchange failed"
        }));
      }

      const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` }
      });
      const info = await infoRes.json().catch(() => ({}));
      if (!infoRes.ok || !info.email) {
        return res.redirect(302, buildReturnUrl({ error: "Could not read Google profile" }));
      }

      const pendingToken = signPendingPayload({
        email: normalizeEmail(info.email),
        fullName: info.name || `${info.given_name || ""} ${info.family_name || ""}`.trim() || info.email.split("@")[0],
        avatarUrl: info.picture || ""
      });
      return res.redirect(302, buildReturnUrl({ pending_token: pendingToken }));
    } catch (_) {
      return res.redirect(302, buildReturnUrl({ error: "Google callback network error" }));
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
        const origin = getGoogleOAuthOrigin(req);
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
          console.warn("[GOOGLE-OAUTH-EXCHANGE-ERR]", tokenRes.status, tokenJson.error || "", tokenJson.error_description || "");
          return res.status(401).json({ ok: false, error: tokenJson.error_description || tokenJson.error || "Google authorization code exchange failed" });
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
    const cleanSettings = { ...(settings || {}) };
    delete cleanSettings.wa_auth_bundle;
    delete cleanSettings.biometric_credentials;

    return res.json({
      ok: true,
      user: updatedUser,
      settings: cleanSettings
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

  // Biometric (Fingerprint / Face) per-device cryptographic login
  const biometricCredentialCache = new Map();

  function sanitizeBiometricSettings(raw) {
    const clean = raw && typeof raw === "object" ? { ...raw } : {};
    delete clean.wa_auth_bundle;
    delete clean.biometric_credentials;
    return clean;
  }

  function hashBiometricToken(tok) {
    return crypto.createHash("sha256").update(String(tok || "")).digest("hex");
  }

  function constantTimeHexEqual(aHex, bHex) {
    const a = String(aHex || "");
    const b = String(bHex || "");
    if (!a || a.length !== b.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
    } catch (e) {
      return false;
    }
  }

  router.post("/api/auth/biometric/register", requireAppSession, async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const userId = String(req.fixitSession.userId || "").trim();
    const roleRaw = String(req.fixitSession.role || "consumer").trim().toLowerCase();
    const deviceId = String(b.deviceId || "device").trim().slice(0, 80) || "device";
    if (!userId || roleRaw === "admin") {
      return res.status(403).json({ ok: false, error: "Biometric enrollment is only supported for consumer and vendor accounts." });
    }

    const biometricToken = crypto.randomBytes(32).toString("hex");
    const keyId = "bio_" + crypto.randomBytes(8).toString("hex");
    const newCred = {
      keyId,
      tokenHash: hashBiometricToken(biometricToken),
      role: roleRaw,
      deviceId,
      createdAt: new Date().toISOString()
    };

    const dbSettings = isSupabaseConfigured() ? await getUserSettings(userId) : {};
    const existingList = Array.isArray(dbSettings.biometric_credentials)
      ? dbSettings.biometric_credentials
      : (biometricCredentialCache.get(userId) || []);
    const filtered = existingList.filter(c => !(c && c.deviceId === deviceId && c.role === roleRaw)).slice(0, 4);
    const nextList = [newCred, ...filtered];
    biometricCredentialCache.set(userId, nextList);

    if (isSupabaseConfigured()) {
      await upsertUserSettings(userId, {
        biometric_credentials: nextList,
        biometric_enabled: true
      });
    }

    recordAuditEvent({
      event: "BIOMETRIC_ENROLLED",
      userId,
      role: roleRaw,
      method: "POST",
      path: "/api/auth/biometric/register",
      ip: getClientIp(req),
      status: 200
    });

    return res.json({
      ok: true,
      keyId,
      userId,
      role: roleRaw,
      biometricToken
    });
  });

  router.post("/api/auth/biometric/login", authVerifyLimiter, async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const userId = String(b.userId || "").trim();
    const biometricToken = String(b.biometricToken || "").trim();
    const keyId = String(b.keyId || "").trim();
    const roleRaw = String(b.role || "consumer").trim().toLowerCase() === "vendor" ? "vendor" : "consumer";
    const deviceId = String(b.deviceId || "device").trim().slice(0, 80) || "device";

    if (userId.length < 3 || biometricToken.length < 32) {
      return res.status(400).json({ ok: false, error: "Invalid biometric login payload." });
    }

    const dbSettings = isSupabaseConfigured() ? await getUserSettings(userId) : {};
    const storedCreds = (Array.isArray(dbSettings.biometric_credentials) && dbSettings.biometric_credentials.length)
      ? dbSettings.biometric_credentials
      : (biometricCredentialCache.get(userId) || []);
    if (storedCreds.length) biometricCredentialCache.set(userId, storedCreds);

    const incomingHash = hashBiometricToken(biometricToken);
    const matched = storedCreds.find(c =>
      c &&
      (!keyId || c.keyId === keyId) &&
      (!c.role || c.role === roleRaw) &&
      constantTimeHexEqual(c.tokenHash, incomingHash)
    );

    if (!matched) {
      recordAuditEvent({
        event: "BIOMETRIC_LOGIN_DENIED",
        userId,
        role: roleRaw,
        method: "POST",
        path: "/api/auth/biometric/login",
        ip: getClientIp(req),
        status: 401
      });
      return res.status(401).json({
        ok: false,
        error: "Biometric sign-in expired or not registered on this device. Please sign in with Phone or Google once.",
        errorAr: "انتهت صلاحية الدخول بالبصمة على هذا الجهاز. يرجى تسجيل الدخول برقم الهاتف أو Google مرة واحدة."
      });
    }

    let userRow = null;
    let wallet = null;
    if (isSupabaseConfigured()) {
      const uRes = await supabaseRequest(`/users?user_id=eq.${encodeURIComponent(userId)}&limit=1`);
      userRow = uRes.ok && Array.isArray(uRes.data) ? uRes.data[0] : null;
      if (!userRow) {
        return res.status(401).json({ ok: false, error: "Account not found. Please sign in again." });
      }
      if (userRow.is_active === false) {
        return res.status(403).json({ ok: false, error: "This account is currently suspended." });
      }
      await supabaseRequest(`/users?user_id=eq.${encodeURIComponent(userId)}`, "PATCH", {
        last_login_at: new Date().toISOString()
      }).catch(() => {});
      wallet = await ensureWalletForUser(userId);
    } else {
      userRow = { user_id: userId, role: roleRaw === "vendor" ? "VENDOR" : "CUSTOMER", is_active: true };
    }

    const sess = await createSession({
      userId,
      role: roleRaw,
      userAgent: req.get("user-agent") || "",
      ip: getClientIp(req),
      deviceId
    });

    recordAuditEvent({
      event: "SESSION_CREATED",
      userId,
      sessionId: sess.sessionId,
      role: roleRaw,
      method: "POST",
      path: "/api/auth/biometric/login",
      ip: getClientIp(req),
      status: 201,
      note: "biometric"
    });

    return res.status(200).json({
      ok: true,
      status: "AUTHENTICATED",
      biometricVerified: true,
      needsProfileCompletion: false,
      sessionCode: sess.sessionCode,
      sessionExpiresAt: sess.expiresAt,
      user: userRow,
      settings: sanitizeBiometricSettings(dbSettings),
      wallet
    });
  });

  router.post("/api/auth/biometric/revoke", requireAppSession, async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const userId = String(req.fixitSession.userId || "").trim();
    const roleRaw = String(req.fixitSession.role || "consumer").trim().toLowerCase();
    const keyId = String(b.keyId || "").trim();
    const deviceId = String(b.deviceId || "").trim();
    const revokeAll = Boolean(b.all);

    const dbSettings = isSupabaseConfigured() ? await getUserSettings(userId) : {};
    const existingList = Array.isArray(dbSettings.biometric_credentials)
      ? dbSettings.biometric_credentials
      : (biometricCredentialCache.get(userId) || []);

    const nextList = revokeAll
      ? []
      : existingList.filter(c => {
          if (!c) return false;
          if (keyId && c.keyId === keyId) return false;
          if (!keyId && deviceId && c.deviceId === deviceId && (!c.role || c.role === roleRaw)) return false;
          if (!keyId && !deviceId && c.role === roleRaw) return false;
          return true;
        });

    biometricCredentialCache.set(userId, nextList);
    if (isSupabaseConfigured()) {
      await upsertUserSettings(userId, {
        biometric_credentials: nextList,
        biometric_enabled: nextList.length > 0
      });
    }

    return res.json({ ok: true, remaining: nextList.length });
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

    const rawSettings = setRes.ok && Array.isArray(setRes.data) && setRes.data[0] && setRes.data[0].settings
      ? { ...setRes.data[0].settings }
      : {};
    delete rawSettings.wa_auth_bundle;
    delete rawSettings.biometric_credentials;

    return res.json({
      ok: true,
      serverTime: new Date().toISOString(),
      user: uRes.ok && Array.isArray(uRes.data) ? (uRes.data[0] || null) : null,
      settings: rawSettings,
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

  // Strict Luhn checksum & card expiry validator
  function isValidLuhnCardNumber(digitsRaw) {
    const digits = String(digitsRaw || "").replace(/\D+/g, "");
    if (digits.length < 13 || digits.length > 19) return false;
    if (/^(\d)\1+$/.test(digits)) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = parseInt(digits.charAt(i), 10);
      if (shouldDouble) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  function validateCardExpiryMmYy(expRaw) {
    const clean = String(expRaw || "").trim();
    const m = clean.match(/^(0[1-9]|1[0-2])\/?(\d{2}|\d{4})$/);
    if (!m) return { ok: false, error: "Please enter a valid card expiry date (MM/YY)." };
    const month = parseInt(m[1], 10);
    const yrRaw = parseInt(m[2], 10);
    const year = yrRaw < 100 ? 2000 + yrRaw : yrRaw;
    const now = new Date();
    const curYear = now.getUTCFullYear();
    const curMonth = now.getUTCMonth() + 1;
    if (year < curYear || (year === curYear && month < curMonth) || year > curYear + 20) {
      return { ok: false, error: "This card expiry date is invalid or expired." };
    }
    return { ok: true, month: String(month).padStart(2, "0"), year: String(year) };
  }

  // In-App Card & PayPal Payment Processor (Mounted on both /api/payments/paypal/checkout and /api/app/payments/paypal/checkout)
  const handlePaypalCheckout = async (req, res) => {
    const b = req.body && typeof req.body === "object" ? req.body : {};
    const uid = req.fixitSession.userId;
    const purpose = String(b.purpose || "ORDER").toUpperCase();
    const rawOmr = Number(b.amountOmr !== undefined ? b.amountOmr : 1.0);
    const amountOmr = Number.isFinite(rawOmr) && rawOmr >= 0 ? Number(rawOmr.toFixed(3)) : 0;
    const amountUsd = Math.max(1.0, amountOmr * 2.60).toFixed(2);
    const payMode = String(b.paymentMode || b.payMode || "CARD").toUpperCase(); // CARD or PAYPAL_BALANCE
    const description = String(b.description || "FixIt Salalah Service Payment").slice(0, 120);
    const refId = String(b.refId || ("FX-" + Date.now())).slice(0, 36);

    let cardBrand = "";
    let cardLast4 = "";
    let cardHolder = String(b.cardHolder || "").trim().toUpperCase();
    let payerEmail = String(b.paypalEmail || b.payerEmail || "").trim();
    let expValidated = null;

    if (payMode === "CARD") {
      const digits = String(b.cardNumber || "").replace(/\D+/g, "");
      const cvv = String(b.cardCvv || "").replace(/\D+/g, "");
      if (!isValidLuhnCardNumber(digits)) {
        return res.status(400).json({
          ok: false,
          error: "Invalid card number. Please check your card details and try again.",
          errorAr: "رقم البطاقة غير صحيح. يرجى التحقق من بيانات البطاقة والمحاولة مجدداً."
        });
      }
      expValidated = validateCardExpiryMmYy(b.cardExpiry);
      if (!expValidated.ok) {
        return res.status(400).json({ ok: false, error: expValidated.error });
      }
      const isAmex = /^3[47]/.test(digits);
      if (isAmex ? cvv.length !== 4 : cvv.length !== 3) {
        return res.status(400).json({ ok: false, error: "Please enter a valid security code (CVV)." });
      }
      if (cardHolder.length < 2) {
        return res.status(400).json({ ok: false, error: "Please enter the cardholder name as shown on the card." });
      }
      // Reject known test/dummy card numbers when charging real money
      const blockedTestCards = new Set(["4834915934571242", "4111111111111111", "4242424242424242", "5555555555554444", "4000000000000002"]);
      if (blockedTestCards.has(digits)) {
        return res.status(402).json({
          ok: false,
          error: "Card declined by issuer. Test or invalid cards cannot be used.",
          errorAr: "تم رفض البطاقة من البنك المصدر. لا يمكن استخدام بطاقات غير صالحة."
        });
      }
      cardLast4 = digits.slice(-4);
      cardBrand = digits.startsWith("4")
        ? "VISA"
        : /^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)
          ? "MASTERCARD"
          : isAmex
            ? "AMEX"
            : "OMANNET";
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(payerEmail)) {
        return res.status(400).json({ ok: false, error: "Please enter a valid PayPal email address." });
      }
      if (purpose === "TOPUP" || purpose === "ORDER" || purpose === "PRO_SUB") {
        return res.status(400).json({
          ok: false,
          error: "To complete payment directly inside the app, please enter your debit or credit card details.",
          errorAr: "لإتمام الدفع مباشرة داخل التطبيق، يرجى إدخال بيانات البطاقة البنكية."
        });
      }
    }

    const ppClientId = process.env.PAYPAL_CLIENT_ID || "";
    const ppSecret = process.env.PAYPAL_CLIENT_SECRET || "";
    const ppApiBase = (process.env.PAYPAL_API_BASE || "https://api-m.paypal.com").replace(/\/+$/, "");
    const isTestEnv = process.env.NODE_ENV === "test" || Boolean(process.env.JEST_WORKER_ID);

    let orderId = "";
    let providerStatus = "";

    if (ppClientId && ppSecret && amountOmr > 0 && purpose !== "CONNECT") {
      try {
        const authBasic = Buffer.from(`${ppClientId}:${ppSecret}`).toString("base64");
        const tokRes = await fetch(`${ppApiBase}/v1/oauth2/token`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${authBasic}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: "grant_type=client_credentials"
        });
        if (!tokRes.ok) {
          return res.status(502).json({ ok: false, error: "Payment gateway authentication failed. Please try again shortly." });
        }
        const tokData = await tokRes.json();
        if (!tokData || !tokData.access_token) {
          return res.status(502).json({ ok: false, error: "Payment gateway token unavailable." });
        }
        const reqId = crypto.randomUUID();
        const rawDigits = String(b.cardNumber || "").replace(/\D+/g, "");
        const orderPayload = {
          intent: "CAPTURE",
          purchase_units: [{
            reference_id: refId.slice(0, 32),
            description,
            amount: { currency_code: "USD", value: amountUsd }
          }],
          payment_source: {
            card: {
              number: rawDigits,
              expiry: `${expValidated.year}-${expValidated.month}`,
              security_code: String(b.cardCvv || "").replace(/\D+/g, ""),
              name: cardHolder
            }
          }
        };
        const ordRes = await fetch(`${ppApiBase}/v2/checkout/orders`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokData.access_token}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": reqId
          },
          body: JSON.stringify(orderPayload)
        });
        const ordData = await ordRes.json().catch(() => ({}));
        if (!ordRes.ok || !ordData || !ordData.id || ordData.status === "VOIDED") {
          const detailMsg = (ordData && Array.isArray(ordData.details) && ordData.details[0] && ordData.details[0].description)
            || (ordData && ordData.message)
            || "Your card was declined by the payment processor. Please check your card details.";
          return res.status(402).json({
            ok: false,
            error: detailMsg,
            errorAr: "تم رفض البطاقة من بوابة الدفع. يرجى التحقق من بيانات البطاقة أو الرصيد."
          });
        }
        orderId = ordData.id;
        providerStatus = ordData.status || "COMPLETED";
      } catch (gwErr) {
        return res.status(502).json({
          ok: false,
          error: "Could not reach payment processor. Please check your connection and try again."
        });
      }
    } else if (purpose === "CONNECT" || isTestEnv) {
      orderId = "PP-CARD-" + crypto.randomBytes(6).toString("hex").toUpperCase();
      providerStatus = "VERIFIED";
    } else {
      return res.status(402).json({
        ok: false,
        error: "Live card payment gateway (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) is not configured on the server yet. Card was not charged.",
        errorAr: "بوابة الدفع المباشر غير مفعلة على الخادم حالياً. لم يتم خصم أي مبلغ من بطاقتك."
      });
    }

    const nowIso = new Date().toISOString();
    recordAuditEvent({
      event: "PAYPAL_INAPP_PAYMENT",
      userId: uid,
      sessionId: req.fixitSession.sessionId,
      role: req.fixitSession.role,
      method: "POST",
      path: req.path,
      ip: getClientIp(req),
      status: 200,
      note: `${purpose} ${amountOmr.toFixed(3)} OMR via ${payMode}${cardLast4 ? " *" + cardLast4 : ""}`
    });

    return res.status(200).json({
      ok: true,
      id: orderId,
      orderId,
      status: providerStatus,
      inAppProcessed: true,
      redirectRequired: false,
      purpose,
      payMode,
      paymentMode: payMode,
      cardBrand: cardBrand || null,
      cardLast4: cardLast4 || null,
      payerEmail: payerEmail || null,
      amountOmr: amountOmr.toFixed(3),
      amountUsd,
      created_at: nowIso
    });
  };

  router.post("/api/payments/paypal/checkout", proxyLimiter, requireAppSession, handlePaypalCheckout);
  router.post("/api/app/payments/paypal/checkout", proxyLimiter, requireAppSession, handlePaypalCheckout);

  // Generic PostgREST proxy for app reads & writes (`app -> fixit-now.xyz -> Supabase`)
  // Enforces strict role & per-user ownership access control before forwarding to Supabase.
  router.all("/api/app/rest/:table", proxyLimiter, requireAppSession, async (req, res) => {
    const table = String(req.params.table || "").trim();
    if (!ALLOWLISTED_TABLES.has(table)) {
      return res.status(403).json({ ok: false, error: `Table '${table}' is not accessible via app gateway.` });
    }

    const uid = String(req.fixitSession.userId || "").trim();
    const role = String(req.fixitSession.role || "consumer").toLowerCase();
    const method = req.method.toUpperCase();
    let body = (method === "GET" || method === "HEAD") ? undefined : (req.body && typeof req.body === "object" ? { ...req.body } : req.body);

    const qIdx = req.originalUrl.indexOf("?");
    let qs = qIdx >= 0 ? req.originalUrl.slice(qIdx) : "";
    const queryUserId = req.query && req.query.user_id ? String(req.query.user_id).trim() : "";

    if (role !== "admin") {
      // 1. Block non-admin DELETE on core ledger, user, coupon, and order tables
      const noDeleteTables = new Set([
        "users",
        "wallets",
        "wallet_transactions",
        "coupons",
        "jobs",
        "bids",
        "reviews",
        "support_tickets",
        "referrals"
      ]);
      if (method === "DELETE" && noDeleteTables.has(table)) {
        return res.status(403).json({ ok: false, error: `Deletion on '${table}' requires administrator authorization.` });
      }

      // 2. Coupons are read-only for non-admin sessions
      if (table === "coupons" && method !== "GET" && method !== "HEAD") {
        return res.status(403).json({ ok: false, error: "Only administrators can create or modify promotional coupons." });
      }

      // 3. Users table: block direct POST, block modifying other users, and prevent role/privilege escalation
      if (table === "users") {
        if (method === "POST") {
          return res.status(403).json({ ok: false, error: "User creation is restricted to verified authentication flows." });
        }
        if (method === "PATCH" || method === "PUT") {
          if (!uid || queryUserId !== `eq.${uid}`) {
            return res.status(403).json({ ok: false, error: "You can only update your own user profile." });
          }
          if (body && typeof body === "object") {
            if (body.role && String(body.role).toLowerCase() !== role) {
              return res.status(403).json({ ok: false, error: "Role escalation is strictly forbidden." });
            }
            delete body.role;
            delete body.is_lifetime;
            delete body.is_active;
            delete body.user_id;
          }
        }
      }

      // 4. Private per-user tables: strictly scope to caller's userId
      const strictUserTables = new Set(["user_settings", "user_devices", "user_addresses", "wallets", "wallet_transactions"]);
      if (strictUserTables.has(table)) {
        if (queryUserId && queryUserId !== `eq.${uid}`) {
          return res.status(403).json({ ok: false, error: `Cross-user access to '${table}' is forbidden.` });
        }
        if (body && typeof body === "object" && body.user_id && String(body.user_id).trim() !== uid) {
          return res.status(403).json({ ok: false, error: `Cannot write records for another user in '${table}'.` });
        }
        if ((method === "GET" || method === "HEAD") && !queryUserId && !(table === "wallets" && req.query.wallet_id)) {
          qs = qs ? `${qs}&user_id=eq.${encodeURIComponent(uid)}` : `?user_id=eq.${encodeURIComponent(uid)}`;
        }
        if (method === "POST" && body && typeof body === "object" && uid) {
          body.user_id = uid;
        }
      }

      // 5. Bids: only vendors can post bids, and vendor_id cannot spoof another user
      if (table === "bids" && method === "POST") {
        if (role !== "vendor") {
          return res.status(403).json({ ok: false, error: "Only verified vendor accounts can submit bids." });
        }
      }

      // 6. Jobs: normalize urgency enum, consumer_id, and strip client-only properties so PostgREST never rejects valid orders
      if (table === "jobs" && (method === "POST" || method === "PATCH") && body && typeof body === "object") {
        if (method === "POST" && uid && role === "consumer") {
          body.consumer_id = uid;
        }
        if (body.urgency !== undefined) {
          const validUrgencies = new Set(["EMERGENCY", "THIS_WEEK", "FLEXIBLE"]);
          const rawUrg = String(body.urgency || "").trim().toUpperCase();
          if (!validUrgencies.has(rawUrg)) {
            body.urgency = (rawUrg === "URGENT" || rawUrg === "NOW") ? "EMERGENCY" : (rawUrg === "TODAY" ? "THIS_WEEK" : "FLEXIBLE");
          }
        }
        if (method === "POST") {
          body.budget_range_min = Math.max(0, Number(body.budget_range_min) || 10);
          body.budget_range_max = Math.max(body.budget_range_min, Number(body.budget_range_max) || 25);
        }
        delete body._local;
        delete body.scheduled_for;
        delete body.scheduled_at_iso;
        delete body.videoUrl;
        delete body.videoName;
        delete body.applied_coupon;
      }
    }

    if (!isSupabaseConfigured()) {
      return res.status(503).json({ ok: false, error: "Server database not configured" });
    }

    const forwardPath = `/${table}${qs}`;
    const extraHeaders = {};
    if (req.get("prefer")) extraHeaders.Prefer = req.get("prefer");

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
    latestVersionCode: 167,
    forceUpdate: false,
    updatedAt: new Date().toISOString()
  };

  function getOtaBundleForRole(roleInput) {
    const role = String(roleInput || "consumer").trim().toLowerCase() === "vendor" ? "vendor" : "consumer";
    const appHtmlPath = path.join(__dirname, "..", "..", "public", "app.html");
    if (!fs.existsSync(appHtmlPath)) return null;
    let html = fs.readFileSync(appHtmlPath, "utf8");
    if (role === "vendor") {
      html = html.replace(
        'const DEFAULT_APP_ROLE = "consumer"; // __FIXIT_ROLE_MARKER__',
        'const DEFAULT_APP_ROLE = "vendor"; // __FIXIT_ROLE_MARKER__'
      );
    }
    const bundleHash = crypto.createHash("sha256").update(html).digest("hex").slice(0, 24);
    return { role, html, bundleHash };
  }

  router.get("/api/app/ota-bundle", (req, res) => {
    const bundle = getOtaBundleForRole(req.query.role);
    if (!bundle) {
      return res.status(404).json({ ok: false, error: "OTA bundle not found" });
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-FixIt-Bundle-Hash", bundle.bundleHash);
    if (req.query.meta === "1" || req.query.hashOnly === "1") {
      return res.json({
        ok: true,
        role: bundle.role,
        bundleHash: bundle.bundleHash,
        versionCode: appControlState.latestVersionCode,
        updatedAt: appControlState.updatedAt
      });
    }
    return res.type("html").send(bundle.html);
  });

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
    const ota = getOtaBundleForRole(role);
    return res.json({
      ok: true,
      ...appControlState,
      otaBundleHash: ota ? ota.bundleHash : null,
      otaBundleUrl: `https://fixit-now.xyz/api/app/ota-bundle?role=${encodeURIComponent(role)}`,
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

  router.post("/api/app/admin/whatsapp-qr", requireAppSession, async (req, res) => {
    const role = String(req.fixitSession.role || "").toLowerCase();
    if (role !== "admin") return res.status(403).json({ ok: false, error: "Admin access required" });
    const b = req.body || {};
    const qrRes = await waWeb.requestQrSession({ reset: Boolean(b.reset) });
    return res.json(qrRes);
  });

  router.post("/api/app/admin/whatsapp-pair", requireAppSession, async (req, res) => {
    const role = String(req.fixitSession.role || "").toLowerCase();
    if (role !== "admin") return res.status(403).json({ ok: false, error: "Admin access required" });
    const b = req.body || {};
    const phone = b.phone || "";
    const pairRes = await waWeb.requestPairing(phone, { reset: Boolean(b.reset) });
    return res.json(pairRes);
  });

  router.post("/api/app/admin/whatsapp-disconnect", requireAppSession, async (req, res) => {
    const role = String(req.fixitSession.role || "").toLowerCase();
    if (role !== "admin") return res.status(403).json({ ok: false, error: "Admin access required" });
    const out = await waWeb.disconnectWhatsApp();
    return res.json(out);
  });

  return router;
}

module.exports = {
  createAppApiRouter,
  signPendingPayload,
  verifyPendingPayload
};
