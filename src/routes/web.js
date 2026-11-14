/**
 * Pure-JS HTML routes & restricted APK download handler.
 * Serves Home, Services, Partner, Support/Mail, About, Legal pages, Deep-Link
 * open/reward redirectors, and strictly whitelisted Consumer & Vendor APKs.
 */

const path = require("path");
const fs = require("fs");
const express = require("express");
const { detectVisitorDetails } = require("../services/ipDetector");
const { homePage } = require("../views/home");
const { supportPage } = require("../views/support");
const {
  servicesPage,
  partnerPage,
  aboutPage,
  termsPage,
  privacyPage,
  cookiesPage,
  refundsPage,
  aupPage,
  disclaimerPage,
  deleteAccountPage,
  warrantyPage
} = require("../views/legal");
const { openAppPage } = require("../views/open");
const { renderPage } = require("../views/layout");

const ALLOWED_APKS = new Set([
  "FixIt-Consumer.apk",
  "FixIt-Vendor.apk"
]);

function getRequestHost(req) {
  return String(req.get("x-forwarded-host") || req.get("host") || "fixit-web.onrender.com").split(",")[0].trim();
}

function renderNotFoundPage(req, res) {
  const html = renderPage({
    title: "Page Not Found",
    description: "The requested FixIt page could not be found.",
    activePath: "",
    body: `
      <section class="fx-section" style="padding:56px 0">
        <div class="fx-wrap" style="max-width:620px">
          <div class="fx-card" style="text-align:center;padding:34px 26px">
            <span class="fx-pill"><span>404 · Not Found</span></span>
            <h1 class="fx-h1" style="font-size:30px">Page Not Found</h1>
            <p class="fx-lead" style="margin:0 auto 20px;font-size:15px">
              This link is unavailable or has moved. You can jump straight back to FixIt home or open support.
            </p>
            <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">
              <a href="/" class="fx-btn fx-btn-primary">Back to Home</a>
              <a href="/support" class="fx-btn fx-btn-outline">Online Support</a>
            </div>
          </div>
        </div>
      </section>
    `
  });
  return res.status(404).type("html").send(html);
}

function createWebRouter({ publicDir }) {
  const router = express.Router();
  const downloadsDir = path.join(publicDir, "downloads");

  router.get("/", (req, res) => {
    return res.type("html").send(homePage({ reqHost: getRequestHost(req) }));
  });

  router.get("/ad.html", (_req, res) => {
    res.removeHeader("X-Frame-Options");
    res.setHeader("Content-Security-Policy", "frame-ancestors *");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cache-Control", "no-store");
    return res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  html, body {
    width: 100%;
    height: 100%;
    min-height: 76px;
    margin: 0;
    padding: 0;
    overflow: hidden;
    background: #F8FAFC;
    font-family: system-ui, -apple-system, sans-serif;
  }
  body {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    position: relative;
  }
  .ad-bar {
    height: 16px;
    background: #F1F5F9;
    border-bottom: 1px solid #E2E8F0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 1px;
    color: #64748B;
    text-transform: uppercase;
    z-index: 2;
  }
  .ad-backdrop {
    position: absolute;
    inset: 16px 0 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 4px;
    color: #CBD5E1;
    text-transform: uppercase;
    pointer-events: none;
    user-select: none;
    z-index: 0;
  }
  #frame {
    width: 100%;
    flex: 1;
    margin: 0;
    padding: 0;
    position: relative;
    z-index: 1;
  }
</style>
</head>
<body>
<div class="ad-bar">
  <span>ADVERTISEMENT · THIRD-PARTY AD (NOT FIXIT)</span>
  <span>A-ADS</span>
</div>
<div class="ad-backdrop">ADVERTISEMENT</div>
<!-- BEGIN AADS AD UNIT 2461953 -->
<div id="frame">
  <iframe data-aa='2461953' src='https://acceptable.a-ads.com/2461953/?size=Adaptive'
    style='border:0; padding:0; width:100%; height:100%; overflow:hidden; display:block; margin:auto; background:transparent'></iframe>
</div>
<!-- END AADS AD UNIT 2461953 -->
</body>
</html>`);
  });

  router.get("/services", (req, res) => {
    return res.type("html").send(servicesPage());
  });

  router.get("/partner", (req, res) => {
    return res.type("html").send(partnerPage());
  });

  router.get("/about", (req, res) => {
    return res.type("html").send(aboutPage());
  });

  router.get("/terms", (req, res) => {
    return res.type("html").send(termsPage());
  });

  router.get("/privacy", (req, res) => {
    return res.type("html").send(privacyPage());
  });

  router.get("/cookies", (req, res) => {
    return res.type("html").send(cookiesPage());
  });

  router.get("/refunds", (req, res) => {
    return res.type("html").send(refundsPage());
  });

  router.get("/aup", (req, res) => {
    return res.type("html").send(aupPage());
  });

  router.get("/disclaimer", (req, res) => {
    return res.type("html").send(disclaimerPage());
  });

  router.get("/delete-account", (req, res) => {
    return res.type("html").send(deleteAccountPage());
  });

  router.get("/warranty", (req, res) => {
    return res.type("html").send(warrantyPage());
  });

  router.get("/support", async (req, res) => {
    const skipExternalLookup = req.headers["x-skip-geo"] === "1";
    const visitor = await detectVisitorDetails(req, { skipExternalLookup });
    return res.type("html").send(supportPage({ visitor, mode: "support" }));
  });

  router.get("/contact", async (req, res) => {
    const skipExternalLookup = req.headers["x-skip-geo"] === "1";
    const visitor = await detectVisitorDetails(req, { skipExternalLookup });
    return res.type("html").send(supportPage({ visitor, mode: "contact" }));
  });

  router.get("/app", (req, res) => {
    return res.sendFile(path.join(publicDir, "app.html"));
  });

  router.get(["/open", "/reward", "/share", "/book", "/auth/callback"], (req, res) => {
    return res.type("html").send(openAppPage({
      reqHost: getRequestHost(req),
      reqPath: req.path,
      query: req.query
    }));
  });

  router.get("/r/:code", (req, res) => {
    return res.type("html").send(openAppPage({
      reqHost: getRequestHost(req),
      reqPath: req.path,
      query: req.query,
      promoCode: req.params.code
    }));
  });

  router.get("/download/:app", (req, res) => {
    const key = String(req.params.app || "").trim().toLowerCase();
    if (key === "consumer") return res.redirect(302, "/downloads/FixIt-Consumer.apk");
    if (key === "vendor") return res.redirect(302, "/downloads/FixIt-Vendor.apk");
    return renderNotFoundPage(req, res);
  });

  router.get("/downloads/:file", (req, res) => {
    const file = String(req.params.file || "");
    if (!ALLOWED_APKS.has(file)) {
      return renderNotFoundPage(req, res);
    }
    const resolved = path.join(downloadsDir, file);
    if (!fs.existsSync(resolved)) {
      return renderNotFoundPage(req, res);
    }
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", `attachment; filename="${file}"`);
    return res.sendFile(resolved);
  });

  return router;
}

module.exports = {
  createWebRouter,
  renderNotFoundPage,
  ALLOWED_APKS
};
