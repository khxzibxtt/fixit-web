/**
 * Subdomain Router Middleware for FixIt.
 * Inspired by https://github.com/khxzibxtt/express-subdomain-router
 * Dynamically resolves subdomains natively across localhost, Render (*.onrender.com), and custom domains (*.fixit-now.xyz).
 */

const path = require("path");
const fs = require("fs");
const { installHubPage } = require("../views/installHub");
const { partnerPage } = require("../views/legal");
const { installAppPage, generateScanPngBuffer, generateScanSvg } = require("../views/install");

function parseSubdomain(req) {
  const rawHost = String(req.get("x-forwarded-host") || req.get("host") || "fixit-now.xyz").split(",")[0].trim();
  const hostname = rawHost.split(":")[0].toLowerCase();
  const port = rawHost.includes(":") ? `:${rawHost.split(":")[1]}` : "";
  const parts = hostname.split(".");

  let subdomain = null;

  // Check if IP address (e.g. 127.0.0.1, ::1)
  const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname === "::1" || hostname === "localhost";

  if (!isIp) {
    // 1. Localhost subdomains (e.g. install.localhost:3000, partner.localhost:3000)
    if (parts.length === 2 && parts[1] === "localhost") {
      subdomain = parts[0];
    }
    // 2. Render subdomains (e.g. install.fixit-web.onrender.com)
    else if (hostname.endsWith(".onrender.com")) {
      if (parts.length > 3) {
        subdomain = parts.slice(0, -3).join(".");
      }
    }
    // 3. Custom domains (e.g. install.fixit-now.xyz, partner.fixit-now.xyz)
    else if (parts.length > 2) {
      subdomain = parts.slice(0, -2).join(".");
    }
  }

  // Treat 'www' as apex root
  if (subdomain === "www") {
    subdomain = null;
  }

  // Determine base domain (e.g. localhost, fixit-web.onrender.com, fixit-now.xyz)
  let baseDomain = hostname;
  if (subdomain) {
    baseDomain = hostname.slice(subdomain.length + 1);
  }

  return {
    rawHost,
    hostname,
    port,
    subdomain,
    baseDomain,
    proto: req.protocol || (req.get("x-forwarded-proto") === "https" ? "https" : "http")
  };
}

function createSubdomainRouter({ publicDir }) {
  const downloadsDir = path.join(publicDir, "downloads");

  return async (req, res, next) => {
    const info = parseSubdomain(req);
    req.subdomainInfo = info;
    req.subdomain = info.subdomain;

    const sub = info.subdomain;
    const reqPath = req.path;

    // Bypass API routes and static asset paths to avoid breaking API or core assets
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

    // ==========================================
    // 1. INSTALL SUBDOMAIN (install.fixit-now.xyz)
    // ==========================================
    if (sub === "install") {
      // Direct APK download routes
      if (reqPath === "/download/consumer" || reqPath === "/consumer.apk" || reqPath === "/FixIt-Consumer.apk") {
        return sendApk(res, downloadsDir, "FixIt-Consumer.apk");
      }
      if (reqPath === "/download/vendor" || reqPath === "/vendor.apk" || reqPath === "/FixIt-Vendor.apk") {
        return sendApk(res, downloadsDir, "FixIt-Vendor.apk");
      }

      // Dynamic QR code generation
      if (reqPath === "/qr/consumer.png" || reqPath === "/qr/consumer.svg") {
        const url = `${info.proto}://${info.rawHost}/download/consumer`;
        if (reqPath.endsWith(".png")) {
          const buf = await generateScanPngBuffer(url, 480);
          return res.type("png").send(buf);
        } else {
          const svg = await generateScanSvg(url, 240);
          return res.type("image/svg+xml").send(svg);
        }
      }
      if (reqPath === "/qr/vendor.png" || reqPath === "/qr/vendor.svg") {
        const url = `${info.proto}://${info.rawHost}/download/vendor`;
        if (reqPath.endsWith(".png")) {
          const buf = await generateScanPngBuffer(url, 480);
          return res.type("png").send(buf);
        } else {
          const svg = await generateScanSvg(url, 240);
          return res.type("image/svg+xml").send(svg);
        }
      }

      // Consumer specific install page
      if (reqPath === "/consumer") {
        const html = await installAppPage({
          role: "consumer",
          reqHost: info.rawHost,
          downloadsDir
        });
        return res.type("html").send(html);
      }

      // Vendor specific install page
      if (reqPath === "/vendor") {
        const html = await installAppPage({
          role: "vendor",
          reqHost: info.rawHost,
          downloadsDir
        });
        return res.type("html").send(html);
      }

      // Redirect to Web App or Partner Portal if requested on install domain
      if (reqPath === "/app" || reqPath === "/order") {
        const appHost = `app.${info.baseDomain}${info.port}`;
        return res.redirect(`${info.proto}://${appHost}`);
      }
      if (reqPath === "/partner") {
        const partnerHost = `partner.${info.baseDomain}${info.port}`;
        return res.redirect(`${info.proto}://${partnerHost}`);
      }

      // Default Install Hub on root /
      const hubHtml = await installHubPage({
        reqHost: info.rawHost,
        downloadsDir,
        proto: info.proto
      });
      return res.type("html").send(hubHtml);
    }

    // ==========================================
    // 2. PARTNER / VENDOR SUBDOMAIN (partner.fixit-now.xyz)
    // ==========================================
    if (sub === "partner" || sub === "vendor" || sub === "pro") {
      // Direct access to Vendor App
      if (reqPath === "/app" || reqPath === "/portal") {
        const vendorAppPath = path.join(publicDir, "vendor.html");
        if (fs.existsSync(vendorAppPath)) {
          return res.sendFile(vendorAppPath);
        }
        return res.sendFile(path.join(publicDir, "app.html"));
      }

      // Direct APK download for vendor
      if (reqPath === "/download" || reqPath === "/apk") {
        return sendApk(res, downloadsDir, "FixIt-Vendor.apk");
      }

      // Redirect install requests to install subdomain
      if (reqPath.startsWith("/install")) {
        const installHost = `install.${info.baseDomain}${info.port}`;
        return res.redirect(`${info.proto}://${installHost}/vendor`);
      }

      // Render Partner Hub on root /
      if (reqPath === "/" || reqPath === "") {
        return res.type("html").send(partnerPage({ reqHost: info.rawHost }));
      }
    }

    // ==========================================
    // 3. ADMIN SUBDOMAIN (admin.fixit-now.xyz)
    // ==========================================
    if (sub === "admin") {
      // Direct APK download for admin ONLY on admin subdomain
      if (reqPath === "/download" || reqPath === "/apk" || reqPath === "/download/admin" || reqPath === "/FixIt-Admin.apk") {
        return sendApk(res, downloadsDir, "FixIt-Admin.apk");
      }

      // Serve Admin SPA console
      const adminHtmlPath = path.join(publicDir, "admin.html");
      if (fs.existsSync(adminHtmlPath)) {
        return res.sendFile(adminHtmlPath);
      }
      return res.sendFile(path.join(publicDir, "app.html"));
    }

    // ==========================================
    // 4. APP / ORDER SUBDOMAIN (app.fixit-now.xyz)
    // ==========================================
    if (sub === "app" || sub === "order" || sub === "book" || sub === "client") {
      if (reqPath === "/consumer" || reqPath === "/consumer.html") {
        const consumerHtmlPath = path.join(publicDir, "consumer.html");
        if (fs.existsSync(consumerHtmlPath)) {
          return res.sendFile(consumerHtmlPath);
        }
      }
      if (reqPath === "/vendor" || reqPath === "/vendor.html") {
        const vendorHtmlPath = path.join(publicDir, "vendor.html");
        if (fs.existsSync(vendorHtmlPath)) {
          return res.sendFile(vendorHtmlPath);
        }
      }
      // Serve Customer Talabat Web Application
      const appHtmlPath = path.join(publicDir, "app.html");
      if (fs.existsSync(appHtmlPath)) {
        return res.sendFile(appHtmlPath);
      }
      return next();
    }

    // ==========================================
    // 5. APEX DOMAIN PATH REDIRECTS & SHUTTLES
    // ==========================================
    // If on apex domain and user visits /install: render Install Hub
    if (reqPath === "/install" || reqPath === "/install/") {
      const hubHtml = await installHubPage({
        reqHost: info.rawHost,
        downloadsDir,
        proto: info.proto
      });
      return res.type("html").send(hubHtml);
    }

    // Direct download routes on apex domain (Consumer and Vendor only; Admin blocked on apex)
    if (reqPath === "/download/consumer") {
      return sendApk(res, downloadsDir, "FixIt-Consumer.apk");
    }
    if (reqPath === "/download/vendor") {
      return sendApk(res, downloadsDir, "FixIt-Vendor.apk");
    }

    // Continue to standard routes for apex domain
    next();
  };
}

function sendApk(res, downloadsDir, fileName) {
  const filePath = path.join(downloadsDir, fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).type("text/plain").send("APK file not found on server.");
  }
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Cache-Control", "no-cache, must-revalidate");
  return res.sendFile(filePath);
}

module.exports = {
  parseSubdomain,
  createSubdomainRouter
};
