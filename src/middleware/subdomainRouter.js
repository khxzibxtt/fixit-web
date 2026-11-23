/**
 * Subdomain Router Middleware for FixIt.
 * Dynamically resolves subdomains natively across localhost, Render (*.onrender.com), and custom domains (*.fixit-now.xyz).
 * Wildcard DNS (*.fixit-now.xyz) is handled server-side — unknown subdomains return a clean 404 page.
 */

const path = require("path");
const fs = require("fs");
const { installHubPage } = require("../views/installHub");
const { partnerPage } = require("../views/legal");
const { installAppPage, generateScanPngBuffer, generateScanSvg } = require("../views/install");

// ============================================================
// SUBDOMAIN PARSER
// ============================================================
function parseSubdomain(req) {
  const rawHost = String(req.get("x-forwarded-host") || req.get("host") || "fixit-now.xyz").split(",")[0].trim();
  const hostname = rawHost.split(":")[0].toLowerCase();
  const port = rawHost.includes(":") ? `:${rawHost.split(":")[1]}` : "";
  const parts = hostname.split(".");

  let subdomain = null;

  // IP addresses and bare localhost are never subdomains
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === "::1" || hostname === "localhost";

  if (!isIp) {
    // install.localhost:3000
    if (parts.length === 2 && parts[1] === "localhost") {
      subdomain = parts[0];
    }
    // install.fixit-web.onrender.com
    else if (hostname.endsWith(".onrender.com")) {
      if (parts.length > 3) subdomain = parts.slice(0, -3).join(".");
    }
    // install.fixit-now.xyz
    else if (parts.length > 2) {
      subdomain = parts.slice(0, -2).join(".");
    }
  }

  if (subdomain === "www") subdomain = null;

  let baseDomain = hostname;
  if (subdomain) baseDomain = hostname.slice(subdomain.length + 1);

  return {
    rawHost,
    hostname,
    port,
    subdomain,
    baseDomain,
    proto: req.get("x-forwarded-proto") === "https" ? "https" : (req.protocol || "http")
  };
}

// ============================================================
// ALLOWLIST — anything outside this set → 404 "Page not available"
// ============================================================
const KNOWN_SUBDOMAINS = new Set([
  "install", "partner", "vendor", "pro",
  "admin", "app", "order", "book", "client",
  "go", "link", "ref"
]);

// ============================================================
// UNKNOWN SUBDOMAIN PAGE
// ============================================================
function unknownSubdomainPage(subdomain, baseDomain) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>Page not available — FixIt</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f8fa;min-height:100vh;display:flex;flex-direction:column}
header{background:#fff;border-bottom:1px solid #e8eaed;padding:0 20px;height:56px;display:flex;align-items:center}
.logo{display:flex;align-items:center;gap:8px;text-decoration:none}
.logo-mark{width:32px;height:32px;background:#1a73e8;border-radius:8px;display:flex;align-items:center;justify-content:center}
.logo-mark svg{width:18px;height:18px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.logo-text{font-size:17px;font-weight:700;color:#202124}
main{flex:1;display:flex;align-items:center;justify-content:center;padding:40px 20px}
.card{background:#fff;border-radius:16px;padding:40px 28px;text-align:center;max-width:380px;width:100%;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.icon{width:60px;height:60px;border-radius:50%;background:#fef3f2;display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
.icon svg{width:26px;height:26px;stroke:#e53935;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
h1{font-size:19px;font-weight:700;color:#202124;margin-bottom:8px}
p{font-size:14px;color:#5f6368;line-height:1.6;margin-bottom:28px}
.btn{display:inline-flex;align-items:center;gap:8px;background:#1a73e8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-size:15px;font-weight:600}
.btn svg{width:15px;height:15px;stroke:#fff;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
footer{text-align:center;padding:16px;font-size:12px;color:#9aa0a6}
footer a{color:inherit;text-decoration:none}
</style>
</head>
<body>
<header>
  <a class="logo" href="https://${baseDomain}">
    <div class="logo-mark"><svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div>
    <span class="logo-text">FixIt</span>
  </a>
</header>
<main>
  <div class="card">
    <div class="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
    <h1>Page not available</h1>
    <p><strong>${subdomain}.${baseDomain}</strong> doesn't exist.<br/>It may have been removed or mistyped.</p>
    <a class="btn" href="https://${baseDomain}"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>Go home</a>
  </div>
</main>
<footer>© ${year} FixIt Oman &nbsp;·&nbsp; <a href="https://${baseDomain}/privacy">Privacy</a></footer>
</body>
</html>`;
}

// ============================================================
// DEEP LINK / REFERRAL PAGE  (go.fixit-now.xyz/r/CODE etc.)
//   /r/CODE   → customer referral
//   /v/CODE   → vendor referral
//   /j/JOB_ID → open specific job in app
// ============================================================
function goLinkPage({ code, baseDomain, proto, type }) {
  const appScheme = `fixit://go?code=${encodeURIComponent(code)}&type=${type}`;
  const isVendor = type === "vendor";
  const apkUrl = isVendor
    ? `${proto}://install.${baseDomain}/download/vendor`
    : `${proto}://install.${baseDomain}/download/consumer`;
  const appLabel = isVendor ? "FixIt Vendor" : "FixIt";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>Opening ${appLabel}…</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f7f8fa;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{background:#fff;border-radius:20px;padding:36px 28px;text-align:center;max-width:340px;width:100%;box-shadow:0 2px 12px rgba(0,0,0,.1)}
.spinner{width:48px;height:48px;border:3px solid #e8f0fe;border-top-color:#1a73e8;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 20px}
@keyframes spin{to{transform:rotate(360deg)}}
h1{font-size:19px;font-weight:700;color:#202124;margin-bottom:8px}
p{font-size:14px;color:#5f6368;line-height:1.5;margin-bottom:24px}
.code{display:inline-block;background:#e8f0fe;color:#1a73e8;font-family:monospace;font-size:13px;padding:3px 10px;border-radius:6px;margin-bottom:20px}
.btn{display:block;background:#1a73e8;color:#fff;text-decoration:none;padding:14px;border-radius:12px;font-size:15px;font-weight:600;margin-bottom:10px}
.btn-dl{display:none;background:#f1f3f4;color:#3c4043;text-decoration:none;padding:14px;border-radius:12px;font-size:15px;font-weight:600}
</style>
</head>
<body>
<div class="card">
  <div class="spinner" id="spin"></div>
  <h1>Opening ${appLabel}</h1>
  ${code ? `<div class="code">${code}</div>` : ""}
  <p id="msg">Taking you to the app…</p>
  <a class="btn" href="${appScheme}">Open App</a>
  <a class="btn-dl" id="dl" href="${apkUrl}">Download ${appLabel}</a>
</div>
<script>
window.location.href = ${JSON.stringify(appScheme)};
setTimeout(function(){
  document.getElementById('spin').style.display='none';
  document.getElementById('msg').textContent='App not installed? Download it below.';
  document.getElementById('dl').style.display='block';
}, 2600);
</script>
</body>
</html>`;
}

// ============================================================
// MAIN ROUTER
// ============================================================
function createSubdomainRouter({ publicDir }) {
  const downloadsDir = path.join(publicDir, "downloads");

  return async (req, res, next) => {
    const info = parseSubdomain(req);
    req.subdomainInfo = info;
    req.subdomain = info.subdomain;

    const sub = info.subdomain;
    const reqPath = req.path;

    // Always pass through API, assets, and health routes
    if (
      reqPath.startsWith("/api/") ||
      reqPath === "/ping" ||
      reqPath === "/.well-known/assetlinks.json" ||
      reqPath === "/favicon.ico" ||
      reqPath === "/manifest.json" ||
      reqPath.startsWith("/icons/") ||
      reqPath.startsWith("/fonts/") ||
      reqPath.startsWith("/badges/") ||
      reqPath === "/logo.png" ||
      reqPath === "/og-image.png"
    ) {
      return next();
    }

    // ── 0. UNKNOWN SUBDOMAIN → "Page not available" ─────────────
    if (sub !== null && !KNOWN_SUBDOMAINS.has(sub)) {
      return res.status(404).type("html").send(unknownSubdomainPage(sub, info.baseDomain));
    }

    // ── 1. INSTALL ───────────────────────────────────────────────
    if (sub === "install") {
      if (reqPath === "/download/consumer" || reqPath === "/consumer.apk" || reqPath === "/FixIt-Consumer.apk")
        return sendApk(res, downloadsDir, "FixIt-Consumer.apk");
      if (reqPath === "/download/vendor" || reqPath === "/vendor.apk" || reqPath === "/FixIt-Vendor.apk")
        return sendApk(res, downloadsDir, "FixIt-Vendor.apk");

      if (reqPath === "/qr/consumer.png" || reqPath === "/qr/consumer.svg") {
        const url = `${info.proto}://${info.rawHost}/download/consumer`;
        if (reqPath.endsWith(".png")) return res.type("png").send(await generateScanPngBuffer(url, 480));
        return res.type("image/svg+xml").send(await generateScanSvg(url, 240));
      }
      if (reqPath === "/qr/vendor.png" || reqPath === "/qr/vendor.svg") {
        const url = `${info.proto}://${info.rawHost}/download/vendor`;
        if (reqPath.endsWith(".png")) return res.type("png").send(await generateScanPngBuffer(url, 480));
        return res.type("image/svg+xml").send(await generateScanSvg(url, 240));
      }

      if (reqPath === "/consumer") {
        return res.type("html").send(await installAppPage({ role: "consumer", reqHost: info.rawHost, downloadsDir }));
      }
      if (reqPath === "/vendor") {
        return res.type("html").send(await installAppPage({ role: "vendor", reqHost: info.rawHost, downloadsDir }));
      }
      if (reqPath === "/app" || reqPath === "/order")
        return res.redirect(`${info.proto}://app.${info.baseDomain}${info.port}`);
      if (reqPath === "/partner")
        return res.redirect(`${info.proto}://partner.${info.baseDomain}${info.port}`);

      return res.type("html").send(await installHubPage({ reqHost: info.rawHost, downloadsDir, proto: info.proto }));
    }

    // ── 2. PARTNER / VENDOR ──────────────────────────────────────
    if (sub === "partner" || sub === "vendor" || sub === "pro") {
      if (reqPath === "/app" || reqPath === "/portal") {
        const p = path.join(publicDir, "vendor.html");
        return res.sendFile(fs.existsSync(p) ? p : path.join(publicDir, "app.html"));
      }
      if (reqPath === "/download" || reqPath === "/apk")
        return sendApk(res, downloadsDir, "FixIt-Vendor.apk");
      if (reqPath.startsWith("/install"))
        return res.redirect(`${info.proto}://install.${info.baseDomain}${info.port}/vendor`);
      if (reqPath === "/" || reqPath === "")
        return res.type("html").send(partnerPage({ reqHost: info.rawHost }));
    }

    // ── 3. ADMIN ─────────────────────────────────────────────────
    if (sub === "admin") {
      if (reqPath === "/download" || reqPath === "/apk" || reqPath === "/download/admin" || reqPath === "/FixIt-Admin.apk")
        return sendApk(res, downloadsDir, "FixIt-Admin.apk");
      const p = path.join(publicDir, "admin.html");
      return res.sendFile(fs.existsSync(p) ? p : path.join(publicDir, "app.html"));
    }

    // ── 4. APP ───────────────────────────────────────────────────
    if (sub === "app" || sub === "order" || sub === "book" || sub === "client") {
      if (reqPath === "/consumer" || reqPath === "/consumer.html") {
        const p = path.join(publicDir, "consumer.html");
        if (fs.existsSync(p)) return res.sendFile(p);
      }
      if (reqPath === "/vendor" || reqPath === "/vendor.html") {
        const p = path.join(publicDir, "vendor.html");
        if (fs.existsSync(p)) return res.sendFile(p);
      }
      const p = path.join(publicDir, "app.html");
      if (fs.existsSync(p)) return res.sendFile(p);
      return next();
    }

    // ── 5. GO / LINK / REF — deep links & referrals ─────────────
    //   go.fixit-now.xyz/r/CODE   → customer referral
    //   go.fixit-now.xyz/v/CODE   → vendor referral
    //   go.fixit-now.xyz/j/JOB_ID → open job in app
    if (sub === "go" || sub === "link" || sub === "ref") {
      const parts = reqPath.split("/").filter(Boolean);
      const kind = parts[0] || "r";
      const code = parts[1] || "";
      const type = kind === "j" ? "job" : kind === "v" ? "vendor" : "referral";
      return res.type("html").send(goLinkPage({ code, baseDomain: info.baseDomain, proto: info.proto, type }));
    }

    // ── 6. APEX DOMAIN ───────────────────────────────────────────
    if (reqPath === "/install" || reqPath === "/install/")
      return res.type("html").send(await installHubPage({ reqHost: info.rawHost, downloadsDir, proto: info.proto }));
    if (reqPath === "/download/consumer")
      return sendApk(res, downloadsDir, "FixIt-Consumer.apk");
    if (reqPath === "/download/vendor")
      return sendApk(res, downloadsDir, "FixIt-Vendor.apk");

    next();
  };
}

// ============================================================
// HELPERS
// ============================================================
function sendApk(res, downloadsDir, fileName) {
  const filePath = path.join(downloadsDir, fileName);
  if (!fs.existsSync(filePath))
    return res.status(404).type("text/plain").send("APK file not found on server.");
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Cache-Control", "no-cache, must-revalidate");
  return res.sendFile(filePath);
}

module.exports = { parseSubdomain, createSubdomainRouter };
