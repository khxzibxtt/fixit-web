/**
 * Visitor IP, geo/ISP lookup, and browser/OS detection for security audit and web support tickets.
 */

const { getClientIp } = require("../middleware/rateLimit");

function isPrivateOrLoopbackIp(ip) {
  if (!ip || ip === "unknown") return true;
  if (ip === "::1" || ip === "127.0.0.1" || ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  const m172 = ip.match(/^172\.(\d+)\./);
  if (m172 && Number(m172[1]) >= 16 && Number(m172[1]) <= 31) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:")) return true;
  return false;
}

function parseUserAgent(uaRaw) {
  const ua = String(uaRaw || "");
  let os = "Unknown OS";
  if (/Android/i.test(ua)) {
    const v = ua.match(/Android\s([\d.]+)/i);
    os = v ? `Android ${v[1]}` : "Android";
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = "iOS";
  } else if (/Windows NT/i.test(ua)) {
    os = "Windows";
  } else if (/Mac OS X/i.test(ua)) {
    os = "macOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  let browser = "Unknown Browser";
  if (/Edg\//i.test(ua)) browser = "Microsoft Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/wv\)|; wv\)/i.test(ua)) browser = "Android WebView";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";
  else if (/curl\//i.test(ua)) browser = "curl";

  const deviceType = /Mobile|Android|iPhone/i.test(ua)
    ? "Mobile"
    : /iPad|Tablet/i.test(ua)
      ? "Tablet"
      : /bot|crawl|spider|curl|wget|node/i.test(ua)
        ? "Automated/CLI"
        : "Desktop";

  return { os, browser, deviceType, userAgent: ua.slice(0, 320) };
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function detectVisitorDetails(req, { skipExternalLookup = false } = {}) {
  const ip = getClientIp(req);
  const uaInfo = parseUserAgent(req.headers["user-agent"]);
  const cfCountry = req.headers["cf-ipcountry"] || req.headers["x-vercel-ip-country"] || "";
  const cfCity = req.headers["cf-ipcity"] || "";

  const base = {
    ip,
    forwardedFor: String(req.headers["x-forwarded-for"] || "").slice(0, 180) || null,
    country: cfCountry || (isPrivateOrLoopbackIp(ip) ? "Local Network" : "Unknown"),
    countryCode: cfCountry || "",
    region: "",
    city: cfCity || "",
    isp: isPrivateOrLoopbackIp(ip) ? "Loopback / LAN" : "Unknown",
    org: "",
    asn: "",
    timezone: "",
    proxy: false,
    browser: uaInfo.browser,
    os: uaInfo.os,
    deviceType: uaInfo.deviceType,
    language: String(req.headers["accept-language"] || "").split(",")[0] || "en",
    referer: String(req.headers.referer || "").slice(0, 200) || null,
    userAgent: uaInfo.userAgent,
    detectedAt: new Date().toISOString()
  };

  if (skipExternalLookup || isPrivateOrLoopbackIp(ip)) {
    return base;
  }

  // Primary free HTTPS geo+ISP lookup
  const whois = await fetchJsonWithTimeout(`https://ipwho.is/${encodeURIComponent(ip)}`, 1600);
  if (whois && whois.success) {
    base.country = whois.country || base.country;
    base.countryCode = whois.country_code || base.countryCode;
    base.region = whois.region || "";
    base.city = whois.city || base.city;
    base.isp = (whois.connection && (whois.connection.isp || whois.connection.org)) || base.isp;
    base.org = (whois.connection && whois.connection.org) || "";
    base.asn = (whois.connection && whois.connection.asn) ? String(whois.connection.asn) : "";
    base.timezone = (whois.timezone && whois.timezone.id) || "";
    base.proxy = Boolean(whois.security && (whois.security.vpn || whois.security.proxy || whois.security.tor));
    return base;
  }

  // Secondary fallback lookup
  const ipapi = await fetchJsonWithTimeout(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city,isp,org,as,timezone,proxy,hosting`, 1500);
  if (ipapi && ipapi.status === "success") {
    base.country = ipapi.country || base.country;
    base.countryCode = ipapi.countryCode || base.countryCode;
    base.region = ipapi.regionName || "";
    base.city = ipapi.city || base.city;
    base.isp = ipapi.isp || base.isp;
    base.org = ipapi.org || "";
    base.asn = ipapi.as || "";
    base.timezone = ipapi.timezone || "";
    base.proxy = Boolean(ipapi.proxy || ipapi.hosting);
  }

  return base;
}

module.exports = {
  detectVisitorDetails,
  isPrivateOrLoopbackIp,
  parseUserAgent
};
