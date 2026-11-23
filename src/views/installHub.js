/**
 * Unified Install & App Download Hub View.
 * Accessible at install.fixit-now.xyz, install.localhost:3000, or /install.
 * Provides direct APK download buttons, live SVG QR codes, and web app links.
 */

const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const { ICONS, escapeHtml, renderPage } = require("./layout");

async function generateQrSvg(targetUrl, size = 180) {
  try {
    return await QRCode.toString(targetUrl, {
      type: "svg",
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: "#0F172A",
        light: "#FFFFFF"
      }
    });
  } catch (_) {
    return `<div style="width:${size}px;height:${size}px;background:#F1F5F9;display:grid;place-items:center;color:#64748B;font-size:12px;border-radius:12px">QR Matrix</div>`;
  }
}

function getApkSizeMb(downloadsDir, fileName) {
  try {
    const p = path.join(downloadsDir, fileName);
    if (fs.existsSync(p)) {
      const bytes = fs.statSync(p).size;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  } catch (_) {}
  return "3.1 MB";
}

async function installHubPage({ reqHost = "fixit-now.xyz", downloadsDir, proto = "https" }) {
  const origin = `${proto}://${reqHost}`;
  const hostNoPort = reqHost.split(":")[0];
  const port = reqHost.includes(":") ? `:${reqHost.split(":")[1]}` : "";

  // Base domain calculation
  let baseDomain = hostNoPort;
  if (hostNoPort.startsWith("install.")) {
    baseDomain = hostNoPort.replace("install.", "");
  }
  const baseOrigin = `${proto}://${baseDomain}${port}`;

  const cDownloadUrl = `/download/consumer`;
  const vDownloadUrl = `/download/vendor`;
  const aDownloadUrl = `/download/admin`;

  const cQrUrl = `${origin}/download/consumer`;
  const vQrUrl = `${origin}/download/vendor`;

  const [cQrSvg, vQrSvg] = await Promise.all([
    generateQrSvg(cQrUrl, 160),
    generateQrSvg(vQrUrl, 160)
  ]);

  const cSize = getApkSizeMb(downloadsDir, "FixIt-Consumer.apk");
  const vSize = getApkSizeMb(downloadsDir, "FixIt-Vendor.apk");
  const aSize = getApkSizeMb(downloadsDir, "FixIt-Admin.apk");

  const body = `
    <style>
      .fx-hub-wrap {
        max-width: 1040px;
        margin: 0 auto;
        padding: 36px 20px 64px;
      }
      .fx-hub-header {
        text-align: center;
        margin-bottom: 40px;
      }
      .fx-hub-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 24px;
        margin-bottom: 36px;
      }
      .fx-apk-card {
        background: #FFFFFF;
        border: 1.5px solid var(--neutral-border, #E2E8F0);
        border-radius: 24px;
        padding: 28px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        box-shadow: 0 4px 20px rgba(0,0,0,0.04);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .fx-apk-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 30px rgba(0,0,0,0.08);
      }
      .fx-apk-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 800;
        padding: 4px 10px;
        border-radius: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .fx-guide-step {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 14px;
        border-radius: 16px;
        background: #F8FAFC;
        border: 1px solid #E2E8F0;
      }
      .fx-step-num {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #FF5A00;
        color: #FFFFFF;
        font-weight: 900;
        font-size: 14px;
        display: grid;
        place-items: center;
        flex-shrink: 0;
      }
    </style>

    <div class="fx-hub-wrap">
      <!-- Header -->
      <div class="fx-hub-header">
        <span class="fx-pill" style="margin-bottom:12px;background:#FFF4ED;color:#FF5A00;border:1px solid #FFE4D6">
          ${ICONS.download || ""} <span>Official App Installation Hub</span>
        </span>
        <h1 class="fx-h1" style="font-size:36px;margin-bottom:12px">
          Download FixIt for Android &amp; Web
        </h1>
        <p class="fx-lead" style="max-width:680px;margin:0 auto;color:#64748B;font-size:16px">
          Direct, verified APK downloads for customers and technicians across Salalah. No Google Play account required.
        </p>
      </div>

      <!-- Main Download Cards Grid -->
      <div class="fx-hub-grid">
        <!-- 1. Customer App Card -->
        <div class="fx-apk-card" style="border-top:4px solid #FF5A00">
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
              <span class="fx-apk-badge" style="background:#FFF4ED;color:#FF5A00">
                Customers &amp; Residents
              </span>
              <span style="font-size:12px;font-weight:700;color:#64748B">${cSize} · v3.2.1</span>
            </div>

            <h2 style="font-size:22px;font-weight:800;color:#0F172A;margin-bottom:8px">
              FixIt Customer App
            </h2>
            <p style="font-size:14px;color:#64748B;line-height:1.5;margin-bottom:20px">
              Book on-demand Split AC maintenance, emergency breakdown towing, plumbing, and electrical work with live pro GPS tracking and escrow protection.
            </p>

            <!-- Scan Matrix Box -->
            <div style="background:#F8FAFC;border:1px dashed #CBD5E1;border-radius:18px;padding:16px;display:flex;align-items:center;gap:16px;margin-bottom:24px">
              <div style="width:100px;height:100px;background:#FFF;border-radius:12px;padding:4px;box-shadow:0 2px 8px rgba(0,0,0,0.05);display:grid;place-items:center;flex-shrink:0">
                ${cQrSvg}
              </div>
              <div style="font-size:12px;color:#475569;line-height:1.4">
                <strong style="color:#0F172A;display:block;margin-bottom:4px">Scan with Camera</strong>
                Point your phone camera to download the APK directly to your device.
              </div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <a href="${cDownloadUrl}" class="fx-btn fx-btn-primary" style="background:#FF5A00;color:#fff;justify-content:center;height:48px;font-size:15px;box-shadow:0 4px 14px rgba(255,90,0,0.3)">
              ${ICONS.download || ""} Download Customer APK (${cSize})
            </a>
            <a href="/app" class="fx-btn fx-btn-outline" style="justify-content:center;height:44px;font-size:14px;border:1.5px solid #E2E8F0">
              Launch Web App in Browser &rarr;
            </a>
          </div>
        </div>

        <!-- 2. FixIt Pro Vendor App Card -->
        <div class="fx-apk-card" style="border-top:4px solid #0F172A">
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
              <span class="fx-apk-badge" style="background:#0F172A;color:#FFFFFF">
                Technicians &amp; Workshops
              </span>
              <span style="font-size:12px;font-weight:700;color:#64748B">${vSize} · v3.2.1</span>
            </div>

            <h2 style="font-size:22px;font-weight:800;color:#0F172A;margin-bottom:8px">
              FixIt Pro (Vendor App)
            </h2>
            <p style="font-size:14px;color:#64748B;line-height:1.5;margin-bottom:20px">
              For licensed workshop teams and freelance pros. Receive nearby job broadcasts, submit live quotes, broadcast live GPS, and receive instant payouts.
            </p>

            <!-- Scan Matrix Box -->
            <div style="background:#F8FAFC;border:1px dashed #CBD5E1;border-radius:18px;padding:16px;display:flex;align-items:center;gap:16px;margin-bottom:24px">
              <div style="width:100px;height:100px;background:#FFF;border-radius:12px;padding:4px;box-shadow:0 2px 8px rgba(0,0,0,0.05);display:grid;place-items:center;flex-shrink:0">
                ${vQrSvg}
              </div>
              <div style="font-size:12px;color:#475569;line-height:1.4">
                <strong style="color:#0F172A;display:block;margin-bottom:4px">Partner Onboarding</strong>
                Scan to install the Pro app directly on your service vehicle's device.
              </div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px">
            <a href="${vDownloadUrl}" class="fx-btn fx-btn-primary" style="background:#0F172A;color:#fff;justify-content:center;height:48px;font-size:15px;box-shadow:0 4px 14px rgba(15,23,42,0.3)">
              ${ICONS.download || ""} Download FixIt Pro APK (${vSize})
            </a>
            <a href="/partner" class="fx-btn fx-btn-outline" style="justify-content:center;height:44px;font-size:14px;border:1.5px solid #E2E8F0">
              View Partner Benefits &amp; Calculator &rarr;
            </a>
          </div>
        </div>
      </div>

      <!-- Installation Guide Section -->
      <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:24px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.03)">
        <h3 style="font-size:20px;font-weight:800;color:#0F172A;margin-bottom:6px">
          How to Install on Android in 30 Seconds
        </h3>
        <p style="font-size:14px;color:#64748B;margin-bottom:20px">
          Because FixIt is distributed directly to bypass app store delays, Android will ask you to confirm:
        </p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:16px">
          <div class="fx-guide-step">
            <div class="fx-step-num">1</div>
            <div>
              <strong style="font-size:14px;color:#0F172A;display:block;margin-bottom:2px">Tap Download</strong>
              <span style="font-size:12px;color:#64748B">Download the APK file directly in Chrome, Samsung Internet, or your browser.</span>
            </div>
          </div>

          <div class="fx-guide-step">
            <div class="fx-step-num">2</div>
            <div>
              <strong style="font-size:14px;color:#0F172A;display:block;margin-bottom:2px">Allow Unknown Apps</strong>
              <span style="font-size:12px;color:#64748B">When prompted, tap <em>Settings</em> and toggle <em>Allow from this source</em>.</span>
            </div>
          </div>

          <div class="fx-guide-step">
            <div class="fx-step-num">3</div>
            <div>
              <strong style="font-size:14px;color:#0F172A;display:block;margin-bottom:2px">Tap Install &amp; Open</strong>
              <span style="font-size:12px;color:#64748B">Tap Install. The app is 100% verified, signed with Google Play Key, and ready.</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Subdomain Switcher Navigation -->
      <div style="margin-top:32px;text-align:center">
        <a href="${baseOrigin}" style="font-size:13px;font-weight:700;color:#64748B;text-decoration:none;display:inline-flex;align-items:center;gap:6px">
          &larr; Return to FixIt Main Portal (${baseDomain})
        </a>
      </div>
    </div>
  `;

  return renderPage({
    title: "Download FixIt Android APK & Web App | Install Hub",
    description: "Official Android APK downloads for FixIt Customer and FixIt Pro Vendor apps in Salalah & Oman.",
    activePath: "/install",
    body
  });
}

module.exports = {
  installHubPage
};
