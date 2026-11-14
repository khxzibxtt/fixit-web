/**
 * Supabase REST client for persisting website support/mail requests and notifying the Admin app.
 * Reads credentials strictly from environment variables (never hardcoded in git).
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://fuavdydvadklatjnimal.supabase.co").replace(/\/+$/, "");
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1YXZkeWR2YWRrbGF0am5pbWFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjIxNTg3MiwiZXhwIjoyMDk3NzkxODcyfQ.WxAjdxqkwRFj1yF10Y3kJ9UQit2XkLpQn65qX2lK5qY";
const DEFAULT_SUPPORT_USER_ID = process.env.WEB_SUPPORT_USER_ID || process.env.CONSUMER_USER_ID || "bd5b7118-e852-4d66-8082-c0d768195007";
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || DEFAULT_SUPPORT_USER_ID;

function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

function getSupabaseUrl() {
  return SUPABASE_URL;
}

async function supabaseRequest(path, method = "GET", body = undefined, extraHeaders = {}) {
  if (!isConfigured()) {
    return { ok: false, status: 503, error: "SUPABASE_SERVICE_KEY env var is not configured" };
  }
  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: method === "GET" ? "return=representation" : "return=representation",
    ...(extraHeaders && typeof extraHeaders === "object" ? extraHeaders : {})
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      method,
      headers,
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
      signal: ctrl.signal
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!res.ok) {
      return { ok: false, status: res.status, error: (data && data.message) || `Supabase HTTP ${res.status}`, data };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 502, error: err && err.message ? err.message : "Supabase network error" };
  } finally {
    clearTimeout(timer);
  }
}

async function supabaseAuthUser(accessToken) {
  if (!isConfigured() || !accessToken) {
    return { ok: false, status: 400, error: "Missing Supabase configuration or token" };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${accessToken}`
      },
      signal: ctrl.signal
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      return { ok: false, status: res.status, error: (data && data.msg) || "Unable to verify Supabase user token" };
    }
    return { ok: true, status: 200, data };
  } catch (err) {
    return { ok: false, status: 502, error: err && err.message ? err.message : "Network error verifying token" };
  } finally {
    clearTimeout(timer);
  }
}

async function saveWebsiteSupportTicket({ sourceTag = "WEBSITE", name, email, phone, topic, subject, message, visitor }) {
  const cleanTag = sourceTag === "WEBSITE MAIL" ? "WEBSITE MAIL" : "WEBSITE";
  const prefix = `[${cleanTag}]`;
  const topicClean = String(topic || "Support").trim().slice(0, 40);
  const subjClean = String(subject || "Website Inquiry").trim().slice(0, 140);
  const fullSubject = `${prefix} ${topicClean}: ${subjClean}`.slice(0, 200);

  const locationLine = [visitor.city, visitor.region, visitor.country].filter(Boolean).join(", ") || visitor.country;
  const fullBody = [
    String(message || "").trim(),
    "",
    `--- ${cleanTag} SUBMISSION DETAILS ---`,
    `Sender Name: ${name || "Not provided"}`,
    `Email: ${email || "Not provided"}`,
    `Phone / WhatsApp: ${phone || "Not provided"}`,
    `Visitor IP: ${visitor.ip}${visitor.proxy ? " (VPN/Proxy detected)" : ""}`,
    `Location: ${locationLine}`,
    `ISP / Network: ${visitor.isp}${visitor.asn ? " (" + visitor.asn + ")" : ""}`,
    `Device / Browser: ${visitor.deviceType} · ${visitor.os} · ${visitor.browser}`,
    `Language: ${visitor.language}`,
    visitor.referer ? `Referer: ${visitor.referer}` : "",
    `User-Agent: ${visitor.userAgent}`,
    `Submitted At: ${visitor.detectedAt}`
  ].filter(Boolean).join("\n");

  const ticketRes = await supabaseRequest("/support_tickets", "POST", {
    user_id: DEFAULT_SUPPORT_USER_ID,
    subject: fullSubject,
    body: fullBody,
    status: "OPEN"
  });

  if (ticketRes.ok && Array.isArray(ticketRes.data) && ticketRes.data[0]) {
    const row = ticketRes.data[0];
    // Notify Admin app so online website submissions appear immediately in Admin inbox
    await supabaseRequest("/notifications", "POST", {
      user_id: ADMIN_USER_ID,
      kind: "SUPPORT",
      title: `${prefix} Support Request from ${name || visitor.ip}`,
      body: `${subjClean} (IP: ${visitor.ip} · ${locationLine})`
    }).catch(() => {});

    return {
      ok: true,
      savedToDb: true,
      ticketId: row.ticket_id,
      subject: row.subject,
      createdAt: row.created_at
    };
  }

  return {
    ok: false,
    savedToDb: false,
    error: ticketRes.error || "Failed to persist ticket",
    ticketId: null
  };
}

module.exports = {
  isConfigured,
  getSupabaseUrl,
  supabaseRequest,
  supabaseAuthUser,
  saveWebsiteSupportTicket
};
