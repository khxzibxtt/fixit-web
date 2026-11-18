/**
 * Direct Android APK install pages (/install/consumer, /install/vendor)
 * and printable bilingual shop counter posters (/posters, /qr).
 * Zero Play Store dependency, crisp local SVG scan matrices via qrcode.
 */

const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const { ICONS, escapeHtml, renderPage } = require("./layout");

function formatBytesMb(filePath) {
  try {
    if (!fs.existsSync(filePath)) return "2.3 MB";
    const bytes = fs.statSync(filePath).size;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } catch (_) {
    return "2.3 MB";
  }
}

async function generateScanSvg(targetUrl, size = 240) {
  return QRCode.toString(targetUrl, {
    type: "svg",
    width: size,
    margin: 2,
    errorCorrectionLevel: "H",
    color: {
      dark: "#0F172A",
      light: "#FFFFFF"
    }
  });
}

async function generateScanPngBuffer(targetUrl, size = 720) {
  return QRCode.toBuffer(targetUrl, {
    type: "png",
    width: size,
    margin: 3,
    errorCorrectionLevel: "H",
    color: {
      dark: "#0F172A",
      light: "#FFFFFF"
    }
  });
}

function getAppMeta(role, reqHost, downloadsDir) {
  const host = reqHost || "fixit-now.xyz";
  const origin = `https://${host}`;
  const isVendor = role === "vendor";
  const apkName = isVendor ? "FixIt-Vendor.apk" : "FixIt-Consumer.apk";
  const apkPath = downloadsDir ? path.join(downloadsDir, apkName) : "";
  return {
    role: isVendor ? "vendor" : "consumer",
    isVendor,
    appName: isVendor ? "FixIt Pro (Partners)" : "FixIt Oman (Customers)",
    appNameAr: isVendor ? "تطبيق FixIt Pro (للشركاء والفنيين)" : "تطبيق FixIt (للعملاء)",
    taglineEn: isVendor
      ? "Receive nearby repair leads, quote jobs, and get instant wallet payouts."
      : "Book AC repair, breakdown towing, plumbing, electrical & home services across Salalah.",
    taglineAr: isVendor
      ? "استقبل طلبات الصيانة القريبة وقدّم عروضك واستلم أرباحك مباشرة في محفظتك."
      : "اطلب صيانة المكيفات، الأعطال والسطحة، السباكة، والكهرباء في صلالة خلال ثوانٍ.",
    apkName,
    apkSize: formatBytesMb(apkPath),
    version: "v3.4.1",
    packageId: isVendor ? "com.khxzi.fixitvendor" : "com.khxzi.fixit",
    directDownloadUrl: `${origin}/download/${isVendor ? "vendor" : "consumer"}`,
    directApkFileUrl: `${origin}/downloads/${apkName}`,
    directInstallUrl: `${origin}/install/${isVendor ? "vendor" : "consumer"}`,
    scanPngUrl: `${origin}/qr/${isVendor ? "vendor" : "consumer"}.png`,
    scanSvgUrl: `${origin}/qr/${isVendor ? "vendor" : "consumer"}.svg`,
    accent: isVendor ? "#0F172A" : "#FF5A00"
  };
}

async function installAppPage({ role = "consumer", reqHost = "fixit-now.xyz", downloadsDir }) {
  const meta = getAppMeta(role, reqHost, downloadsDir);
  const scanSvg = await generateScanSvg(meta.directInstallUrl, 210);
  const otherRole = meta.isVendor ? "consumer" : "vendor";
  const otherLabel = meta.isVendor ? "Need Customer App instead?" : "Are you a technician or workshop? Get FixIt Pro";

  const body = `
    <style>
      .fx-install-grid {
        max-width: 960px;
        margin: 0 auto;
        padding: 36px 20px 56px;
        display: grid;
        grid-template-columns: 1.35fr 0.95fr;
        gap: 24px;
        align-items: start;
      }
      @media (max-width: 820px) { .fx-install-grid { grid-template-columns: 1fr; padding: 24px 16px 40px; } }
      .fx-inst-card {
        background: #FFFFFF;
        border: 1px solid var(--neutral-border);
        border-radius: 24px;
        padding: 28px;
        box-shadow: var(--shadow);
      }
      .fx-inst-btn {
        width: 100%;
        min-height: 56px;
        border-radius: 14px;
        background: ${meta.accent};
        color: #FFFFFF;
        font-size: 16px;
        font-weight: 900;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
        transition: transform 0.15s, opacity 0.15s;
      }
      .fx-inst-btn:hover { opacity: 0.94; transform: translateY(-1px); }
      .fx-step-row {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 14px;
        background: #F8FAFC;
        border: 1px solid #E2E8F0;
      }
      .fx-step-num {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${meta.accent};
        color: #FFFFFF;
        font-size: 13px;
        font-weight: 900;
        display: grid;
        place-items: center;
        flex-shrink: 0;
      }
      .fx-scan-frame {
        background: #FFFFFF;
        border: 2px solid #0F172A;
        border-radius: 20px;
        padding: 16px;
        display: inline-flex;
        justify-content: center;
        align-items: center;
      }
      .fx-scan-frame svg { width: 210px; height: 210px; display: block; }
      .fx-link-copy {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #F1F5F9;
        border: 1px solid #CBD5E1;
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 12.5px;
        font-weight: 700;
        color: #0F172A;
        word-break: break-all;
      }
    </style>

    <div class="fx-install-grid">
      <div class="fx-inst-card">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px">
          <img src="/logo.png" alt="${escapeHtml(meta.appName)}" style="width:68px;height:68px;border-radius:18px;object-fit:cover;box-shadow:0 8px 20px rgba(255,90,0,0.22);flex-shrink:0" />
          <div>
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:99px;background:#FFF1E8;color:#FF5A00;font-size:11.5px;font-weight:900;margin-bottom:6px">
              ${ICONS.smartphone}
              <span>DIRECT ANDROID APK · ${meta.version} · ${meta.apkSize}</span>
            </span>
            <h1 style="font-size:26px;font-weight:900;line-height:1.15;color:#0F172A">${escapeHtml(meta.appName)}</h1>
            <div dir="rtl" style="font-size:15px;font-weight:800;color:#FF5A00;margin-top:2px">${escapeHtml(meta.appNameAr)}</div>
          </div>
        </div>

        <p style="font-size:15px;color:#475569;line-height:1.5;margin-bottom:10px">${escapeHtml(meta.taglineEn)}</p>
        <p dir="rtl" style="font-size:14px;color:#64748B;line-height:1.55;margin-bottom:20px">${escapeHtml(meta.taglineAr)}</p>

        <a id="directApkBtn" href="/download/${meta.role}" download="${escapeHtml(meta.apkName)}" class="fx-inst-btn">
          ${ICONS.download}
          <span>Download &amp; Install APK (${meta.version})</span>
        </a>

        <div id="downloadStatusMsg" style="text-align:center;font-size:12.5px;font-weight:700;color:#05A437;margin-top:10px">
          Starting automatic APK download... Tap button above if your browser asks to confirm.
        </div>

        <div style="margin-top:22px;display:flex;flex-direction:column;gap:10px">
          <div style="font-size:13.5px;font-weight:900;color:#0F172A;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px">
            <span>Quick 3-Step Direct Install (No Store Required)</span>
            <span dir="rtl">طريقة التثبيت المباشر في 3 خطوات</span>
          </div>
          <div class="fx-step-row">
            <span class="fx-step-num">1</span>
            <div style="flex:1;font-size:13px;color:#334155">
              <b>Tap "Download anyway" if Chrome prompts</b> — the APK comes directly from our official server.<br/>
              <span dir="rtl" style="display:block;margin-top:2px;color:#64748B">اضغط «التنزيل على أي حال» إذا ظهر تنبيه المتصفح.</span>
            </div>
          </div>
          <div class="fx-step-row">
            <span class="fx-step-num">2</span>
            <div style="flex:1;font-size:13px;color:#334155">
              <b>Tap "Open" when the download finishes</b> in the top bar or Android Notifications.<br/>
              <span dir="rtl" style="display:block;margin-top:2px;color:#64748B">اضغط «فتح» فور اكتمال تنزيل الملف من الإشعارات أو المتصفح.</span>
            </div>
          </div>
          <div class="fx-step-row">
            <span class="fx-step-num">3</span>
            <div style="flex:1;font-size:13px;color:#334155">
              <b>Tap "Install"</b> (if asked once, allow Browser to install unknown apps).<br/>
              <span dir="rtl" style="display:block;margin-top:2px;color:#64748B">اضغط «تثبيت» (وإذا طُلب منك مرة واحدة فعّل السماح بالتثبيت من المتصفح).</span>
            </div>
          </div>
        </div>

        <div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--neutral-border);display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center">
          <a href="/install/${otherRole}" style="font-size:13.5px;font-weight:800;color:#FF5A00">${escapeHtml(otherLabel)} →</a>
          <a href="/posters" style="font-size:13.5px;font-weight:800;color:#0F172A">Open Printable Shop Posters →</a>
        </div>
      </div>

      <div class="fx-inst-card" style="text-align:center">
        <div style="font-size:16px;font-weight:900;color:#0F172A;margin-bottom:4px">Scan with Phone Camera</div>
        <div dir="rtl" style="font-size:13.5px;font-weight:700;color:#64748B;margin-bottom:14px">امسح الرمز بكاميرا الهاتف للتثبيت المباشر</div>
        <div class="fx-scan-frame">${scanSvg}</div>
        <div style="margin-top:16px;text-align:left">
          <div style="font-size:11.5px;font-weight:800;color:#64748B;text-transform:uppercase;margin-bottom:6px">Share Direct Install Link</div>
          <div class="fx-link-copy">
            <span id="shareUrlTxt" style="flex:1">${escapeHtml(meta.directInstallUrl)}</span>
            <button type="button" onclick="copyInstallUrl()" style="background:#FF5A00;color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:800">Copy</button>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <a href="/qr/${meta.role}.png" download="FixIt-${meta.role}-scan.png" style="padding:8px 14px;border-radius:10px;background:#F1F5F9;color:#0F172A;font-size:12.5px;font-weight:800">Save Scan PNG</a>
          <a href="/download/${meta.role}" style="padding:8px 14px;border-radius:10px;background:#FFF1E8;color:#FF5A00;font-size:12.5px;font-weight:800">Direct .APK</a>
        </div>
      </div>
    </div>
  `;

  const scripts = `
    <script>
      function copyInstallUrl() {
        var url = ${JSON.stringify(meta.directInstallUrl)};
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            alert("Copied direct install link: " + url);
          }).catch(function () {});
        }
      }
      (function () {
        var isAndroid = /Android/i.test(navigator.userAgent || "");
        var isBot = /bot|crawl|spider/i.test(navigator.userAgent || "");
        if (isAndroid && !isBot) {
          setTimeout(function () {
            var a = document.createElement("a");
            a.href = "/download/${meta.role}";
            a.setAttribute("download", ${JSON.stringify(meta.apkName)});
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }, 550);
        }
      })();
    </script>
  `;

  return renderPage({
    title: `Install ${meta.appName} (${meta.version})`,
    description: `${meta.taglineEn} Direct official Android APK download from FixIt Oman.`,
    activePath: `/install/${meta.role}`,
    body,
    scripts
  });
}

async function postersPage({ reqHost = "fixit-now.xyz", downloadsDir }) {
  const cMeta = getAppMeta("consumer", reqHost, downloadsDir);
  const vMeta = getAppMeta("vendor", reqHost, downloadsDir);
  const cSvg = await generateScanSvg(cMeta.directInstallUrl, 250);
  const vSvg = await generateScanSvg(vMeta.directInstallUrl, 250);

  const body = `
    <style>
      .fx-posters-wrap { max-width: 1080px; margin: 0 auto; padding: 34px 20px 56px; }
      .fx-posters-top { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
      .fx-posters-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
      @media (max-width: 860px) { .fx-posters-grid { grid-template-columns: 1fr; } }
      .fx-poster-card {
        background: #FFFFFF;
        border: 2px solid #0F172A;
        border-radius: 24px;
        overflow: hidden;
        box-shadow: var(--shadow);
        display: flex;
        flex-direction: column;
      }
      .fx-poster-head {
        padding: 22px 24px;
        color: #FFFFFF;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
      }
      .fx-poster-body {
        padding: 24px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
      }
      .fx-poster-svg {
        border: 3px solid #0F172A;
        border-radius: 20px;
        padding: 14px;
        background: #FFFFFF;
      }
      .fx-poster-svg svg { width: 230px; height: 230px; display: block; }
      .fx-poster-url {
        font-family: monospace;
        font-size: 13px;
        font-weight: 800;
        color: #0F172A;
        background: #F1F5F9;
        padding: 8px 14px;
        border-radius: 99px;
      }
      @media print {
        .talabat-smart-banner, .talabat-nav, .talabat-drawer, .talabat-footer, .no-print { display: none !important; }
        body { background: #FFFFFF !important; }
        .fx-posters-wrap { padding: 0; max-width: 100%; }
        .fx-posters-grid { grid-template-columns: 1fr 1fr; gap: 16px; }
        .fx-poster-card { box-shadow: none !important; break-inside: avoid; }
      }
    </style>

    <div class="fx-posters-wrap">
      <div class="fx-posters-top no-print">
        <div>
          <span style="display:inline-block;padding:4px 12px;border-radius:99px;background:#FFF1E8;color:#FF5A00;font-size:12px;font-weight:900;margin-bottom:8px">PRINTABLE SHOP &amp; VENDOR KIT</span>
          <h1 style="font-size:30px;font-weight:900;color:#0F172A">Direct App Install Posters (Customer &amp; Partner)</h1>
          <p style="font-size:14.5px;color:#475569;margin-top:4px">Print and display these two posters in shops, garages, and workshops so anyone can install directly with one scan.</p>
        </div>
        <button type="button" onclick="window.print()" class="fx-btn fx-btn-primary" style="background:#FF5A00;color:#fff;padding:12px 22px;border-radius:12px;font-weight:800">
          ${ICONS.download}
          <span>Print / Save Shop Posters</span>
        </button>
      </div>

      <div class="fx-posters-grid">
        <div class="fx-poster-card">
          <div class="fx-poster-head" style="background:linear-gradient(135deg,#FF5A00,#EA580C)">
            <div>
              <div style="font-size:12px;font-weight:800;opacity:0.9">FOR CUSTOMERS · للعملاء</div>
              <div style="font-size:24px;font-weight:900">FixIt Oman App</div>
            </div>
            <img src="/logo.png" alt="FixIt" style="width:52px;height:52px;border-radius:14px;border:2px solid rgba(255,255,255,0.5)" />
          </div>
          <div class="fx-poster-body">
            <div style="font-size:17px;font-weight:900;color:#0F172A">Scan to Install Customer App (${cMeta.version})</div>
            <div dir="rtl" style="font-size:15px;font-weight:800;color:#FF5A00">امسح لتنزيل تطبيق العملاء (تكييف، كهرباء، سباكة، إنقاذ طرق)</div>
            <div class="fx-poster-svg">${cSvg}</div>
            <div class="fx-poster-url">${escapeHtml(cMeta.directInstallUrl)}</div>
            <div style="font-size:12px;color:#64748B">Direct APK: <b>${escapeHtml(cMeta.directDownloadUrl)}</b></div>
            <div class="no-print" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:6px">
              <a href="/qr/consumer.png" download="FixIt-Consumer-Shop-Scan.png" style="padding:10px 16px;border-radius:10px;background:#0F172A;color:#fff;font-size:13px;font-weight:800">Download Scan PNG</a>
              <a href="/install/consumer" style="padding:10px 16px;border-radius:10px;background:#FFF1E8;color:#FF5A00;font-size:13px;font-weight:800">Open Install Link</a>
            </div>
          </div>
        </div>

        <div class="fx-poster-card">
          <div class="fx-poster-head" style="background:linear-gradient(135deg,#0F172A,#1E293B)">
            <div>
              <div style="font-size:12px;font-weight:800;opacity:0.9">FOR WORKSHOPS &amp; VENDORS · للشركاء والورش</div>
              <div style="font-size:24px;font-weight:900">FixIt Pro Partner App</div>
            </div>
            <img src="/logo.png" alt="FixIt Pro" style="width:52px;height:52px;border-radius:14px;border:2px solid rgba(255,255,255,0.4)" />
          </div>
          <div class="fx-poster-body">
            <div style="font-size:17px;font-weight:900;color:#0F172A">Scan to Install Partner App (${vMeta.version})</div>
            <div dir="rtl" style="font-size:15px;font-weight:800;color:#0F172A">امسح لتثبيت تطبيق الشركاء واستقبال طلبات العملاء في صلالة</div>
            <div class="fx-poster-svg">${vSvg}</div>
            <div class="fx-poster-url">${escapeHtml(vMeta.directInstallUrl)}</div>
            <div style="font-size:12px;color:#64748B">Direct APK: <b>${escapeHtml(vMeta.directDownloadUrl)}</b></div>
            <div class="no-print" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:6px">
              <a href="/qr/vendor.png" download="FixIt-Vendor-Shop-Scan.png" style="padding:10px 16px;border-radius:10px;background:#0F172A;color:#fff;font-size:13px;font-weight:800">Download Scan PNG</a>
              <a href="/install/vendor" style="padding:10px 16px;border-radius:10px;background:#F1F5F9;color:#0F172A;font-size:13px;font-weight:800">Open Install Link</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  return renderPage({
    title: "Shop & Vendor Printable App Install Posters",
    description: "Download or print direct-install Android posters for FixIt Customer App and FixIt Pro Vendor App.",
    activePath: "/posters",
    body
  });
}

module.exports = {
  generateScanSvg,
  generateScanPngBuffer,
  getAppMeta,
  installAppPage,
  postersPage
};
