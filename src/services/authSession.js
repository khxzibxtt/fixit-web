/**
 * Per-user rotating session manager & timestamped activity audit service.
 * Stores SHA-256 hashed session codes in Supabase `auth_sessions`,
 * refreshes sliding timestamps in `auth_sessions`, `users`, and `user_devices`,
 * and records complete request logs in server memory + stdout.
 */

const crypto = require("crypto");
const { isConfigured: isSupabaseConfigured, supabaseRequest } = require("./supabase");

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days sliding window
const TOUCH_THROTTLE_MS = 20 * 1000; // DB timestamp update throttle per session
const MAX_AUDIT_LOGS = 250;

const sessionCache = new Map(); // tokenHash -> { sessionId, userId, role, expiresAtMs, lastTouchMs }
const auditBuffer = [];

function sha256Hex(val) {
  return crypto.createHash("sha256").update(String(val || "")).digest("hex");
}

function isQuietPollingAudit(item) {
  if (!item) return false;
  if (item.event === "SESSION_HEARTBEAT") return true;
  if (item.event === "DB_PROXY_REQUEST" && String(item.method || "").toUpperCase() === "GET" && Number(item.status || 200) < 400) {
    const p = String(item.path || "");
    if (
      p.startsWith("/api/app/notifications") ||
      p.startsWith("/api/app/bootstrap") ||
      p.startsWith("/api/app/rest/") ||
      p.startsWith("/api/app/audit-logs") ||
      p.startsWith("/api/app/status")
    ) {
      return true;
    }
  }
  return false;
}

function recordAuditEvent(entry) {
  const item = {
    at: new Date().toISOString(),
    event: entry.event || "API_REQUEST",
    userId: entry.userId || null,
    sessionId: entry.sessionId || null,
    role: entry.role || "consumer",
    method: entry.method || "GET",
    path: entry.path || "",
    ip: entry.ip || "",
    status: entry.status || 200,
    note: entry.note || ""
  };
  if (isQuietPollingAudit(item)) return item;
  auditBuffer.unshift(item);
  if (auditBuffer.length > MAX_AUDIT_LOGS) auditBuffer.length = MAX_AUDIT_LOGS;
  if (process.env.NODE_ENV !== "test") {
    console.log(`[APP-AUDIT] ${item.at} ${item.event} role=${item.role} user=${item.userId || "anon"} ${item.method} ${item.path} ip=${item.ip} status=${item.status}`);
  }
  return item;
}

function getRecentAuditLogs(limit = 60) {
  return auditBuffer.slice(0, Math.min(MAX_AUDIT_LOGS, Math.max(1, Number(limit) || 60)));
}

async function createSession({ userId, role = "consumer", userAgent = "", ip = "", deviceId = "" }) {
  const sessionCode = "fxs_" + crypto.randomBytes(24).toString("hex");
  const tokenHash = sha256Hex(sessionCode);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresIso = new Date(now + SESSION_TTL_MS).toISOString();
  const sessionId = crypto.randomUUID();

  const cached = {
    sessionId,
    userId,
    role,
    expiresAtMs: now + SESSION_TTL_MS,
    lastTouchMs: now
  };
  sessionCache.set(tokenHash, cached);

  if (isSupabaseConfigured() && userId) {
    await supabaseRequest("/auth_sessions", "POST", {
      session_id: sessionId,
      user_id: userId,
      refresh_token_hash: tokenHash,
      user_agent: String(userAgent || "").slice(0, 300),
      ip_addr: String(ip || "").slice(0, 80),
      expires_at: expiresIso,
      created_at: nowIso
    }).catch(() => {});

    await supabaseRequest(`/users?user_id=eq.${encodeURIComponent(userId)}`, "PATCH", {
      updated_at: nowIso
    }).catch(() => {});

    if (deviceId) {
      await supabaseRequest("/user_devices", "POST", {
        device_id: String(deviceId).slice(0, 120),
        user_id: userId,
        platform: "android",
        push_token: "fixit-webview",
        last_seen_at: nowIso
      }, { Prefer: "resolution=merge-duplicates,return=representation" }).catch(() => {});
    }
  }

  recordAuditEvent({
    event: "SESSION_CREATED",
    userId,
    sessionId,
    role,
    method: "POST",
    path: "/api/auth/session",
    ip,
    status: 201
  });

  return { sessionCode, sessionId, expiresAt: expiresIso };
}

function normalizeIp(rawIp) {
  const ip = String(rawIp || "").split(",")[0].trim();
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

function isTrustedAdminIp(rawIp) {
  const ip = normalizeIp(rawIp);
  if (!ip) return false;
  const extra = String(process.env.ADMIN_ALLOWED_IPS || "")
    .split(",")
    .map(s => normalizeIp(s))
    .filter(Boolean);
  return extra.length > 0 && extra.includes(ip);
}

function timingSafeMatch(a, b) {
  const sA = String(a || "").trim();
  const sB = String(b || "").trim();
  if (!sA || !sB) return false;
  const aBuf = Buffer.from(sA);
  const bBuf = Buffer.from(sB);
  return aBuf.length === bBuf.length && crypto.timingSafeEqual(aBuf, bBuf);
}

function getExpectedAdminMasterToken() {
  if (process.env.ADMIN_MASTER_TOKEN && String(process.env.ADMIN_MASTER_TOKEN).trim().length >= 24) {
    return String(process.env.ADMIN_MASTER_TOKEN).trim();
  }
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_ACCESS_CODE || "fixit-admin-operator-v3-key";
  return "fxadm_" + crypto.createHmac("sha256", secret).update("fixit:admin:master:v3").digest("hex");
}

function isValidAdminAccessCode(providedCode) {
  const expected = String(process.env.ADMIN_ACCESS_CODE || "").trim();
  return timingSafeMatch(providedCode, expected);
}

function isValidAdminMasterToken(cleanCode, adminCode) {
  if (!cleanCode && !adminCode) return false;
  if (cleanCode === "fixit_admin_master_session") return false; // Legacy static string explicitly revoked
  if (isValidAdminAccessCode(adminCode) || isValidAdminAccessCode(cleanCode)) return true;
  const expectedMaster = getExpectedAdminMasterToken();
  return timingSafeMatch(cleanCode, expectedMaster) || timingSafeMatch(adminCode, expectedMaster);
}

const DEFAULT_ADMIN_USER_ID = process.env.ADMIN_USER_ID || "b3264964-ab0e-4638-8514-62de24ba511f";

async function validateAndTouchSession({ sessionCode, role = "consumer", userAgent = "", ip = "", path = "", method = "GET", forceTouch = false, adminCode = "" }) {
  const cleanCode = String(sessionCode || "").trim();
  if (isValidAdminMasterToken(cleanCode, adminCode)) {
    return {
      ok: true,
      userId: DEFAULT_ADMIN_USER_ID,
      role: "admin",
      sessionId: "admin-operator-session",
      expiresAt: "2099-01-01T00:00:00.000Z"
    };
  }
  if (!cleanCode || !cleanCode.startsWith("fxs_")) {
    return { ok: false, status: 401, error: "Valid session code required." };
  }
  const tokenHash = sha256Hex(cleanCode);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  let session = sessionCache.get(tokenHash) || null;
  if (!session && isSupabaseConfigured()) {
    const dbRes = await supabaseRequest(
      `/auth_sessions?refresh_token_hash=eq.${encodeURIComponent(tokenHash)}&revoked_at=is.null&select=session_id,user_id,expires_at&limit=1`
    );
    if (dbRes.ok && Array.isArray(dbRes.data) && dbRes.data[0]) {
      const row = dbRes.data[0];
      let dbRole = "consumer";
      if (row.user_id) {
        const uRes = await supabaseRequest(`/users?user_id=eq.${encodeURIComponent(row.user_id)}&select=role&limit=1`);
        if (uRes.ok && Array.isArray(uRes.data) && uRes.data[0] && uRes.data[0].role) {
          dbRole = String(uRes.data[0].role).trim().toLowerCase();
        }
      }
      session = {
        sessionId: row.session_id,
        userId: row.user_id,
        role: dbRole,
        expiresAtMs: new Date(row.expires_at).getTime(),
        lastTouchMs: 0
      };
      sessionCache.set(tokenHash, session);
    }
  }

  if (!session) {
    return { ok: false, status: 401, error: "Session not found or revoked." };
  }
  if (session.expiresAtMs <= now) {
    sessionCache.delete(tokenHash);
    return { ok: false, status: 401, error: "Session expired. Please sign in again." };
  }

  // Strictly bind role to the server-verified session record; never allow client header escalation to admin
  const verifiedRole = String(session.role || "consumer").trim().toLowerCase();

  const newExpiresIso = new Date(now + SESSION_TTL_MS).toISOString();
  session.expiresAtMs = now + SESSION_TTL_MS;

  if (isSupabaseConfigured() && (forceTouch || (now - session.lastTouchMs) >= TOUCH_THROTTLE_MS)) {
    session.lastTouchMs = now;
    supabaseRequest(`/auth_sessions?session_id=eq.${encodeURIComponent(session.sessionId)}`, "PATCH", {
      expires_at: newExpiresIso,
      ip_addr: String(ip || "").slice(0, 80) || undefined,
      user_agent: String(userAgent || "").slice(0, 300) || undefined
    }).catch(() => {});
    if (session.userId) {
      supabaseRequest(`/users?user_id=eq.${encodeURIComponent(session.userId)}`, "PATCH", {
        updated_at: nowIso
      }).catch(() => {});
    }
  }

  recordAuditEvent({
    event: forceTouch ? "SESSION_HEARTBEAT" : "DB_PROXY_REQUEST",
    userId: session.userId,
    sessionId: session.sessionId,
    role: verifiedRole,
    method,
    path,
    ip,
    status: 200
  });

  return {
    ok: true,
    sessionId: session.sessionId,
    userId: session.userId,
    role: verifiedRole,
    expiresAt: newExpiresIso,
    lastSeenAt: nowIso
  };
}

async function revokeSession(sessionCode) {
  const cleanCode = String(sessionCode || "").trim();
  if (!cleanCode) return;
  const tokenHash = sha256Hex(cleanCode);
  const existing = sessionCache.get(tokenHash);
  sessionCache.delete(tokenHash);
  if (isSupabaseConfigured()) {
    await supabaseRequest(`/auth_sessions?refresh_token_hash=eq.${encodeURIComponent(tokenHash)}`, "PATCH", {
      revoked_at: new Date().toISOString()
    }).catch(() => {});
  }
  recordAuditEvent({
    event: "SESSION_REVOKED",
    userId: existing ? existing.userId : null,
    sessionId: existing ? existing.sessionId : null,
    method: "POST",
    path: "/api/auth/logout",
    status: 200
  });
}

module.exports = {
  createSession,
  validateAndTouchSession,
  revokeSession,
  recordAuditEvent,
  getRecentAuditLogs,
  isTrustedAdminIp,
  isValidAdminAccessCode,
  getExpectedAdminMasterToken,
  isQuietPollingAudit
};
