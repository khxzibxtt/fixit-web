/**
 * Talabat-style App Deep-Link Redirector (/open, /reward, /r/:code, /share, /book).
 * Launches the installed FixIt Android app automatically using Android intent:// + fixit://
 * and passes coupon/promo codes cleanly to the native bridge.
 */

const { ICONS, escapeHtml, renderPage } = require("./layout");

function openAppPage({ reqHost = "fixit-web.onrender.com", reqPath = "/open", query = {}, promoCode = "" }) {
  const origin = `https://${reqHost}`;
  const isAuthCallback = reqPath === "/auth/callback";
  const targetRole = String(query.role || "").trim().toLowerCase() === "vendor" ? "vendor" : "consumer";
  const appScheme = targetRole === "vendor" ? "fixitvendor" : "fixit";
  const androidPackage = targetRole === "vendor" ? "com.khxzi.fixitvendor" : "com.khxzi.fixit";
  const appDisplayName = targetRole === "vendor" ? "FixIt Pro" : "FixIt";
  const apkFileName = targetRole === "vendor" ? "FixIt-Vendor.apk" : "FixIt-Consumer.apk";

  const cleanPromo = isAuthCallback
    ? ""
    : String(promoCode || query.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const cleanScreen = String(query.screen || (cleanPromo ? "coupons" : reqPath === "/book" ? "book" : "")).trim();
  const cleanJobId = String(query.job_id || "").trim();
  const cleanService = String(query.service || "").trim();

  const qs = new URLSearchParams();
  if (cleanPromo) qs.set("code", cleanPromo);
  if (cleanScreen) qs.set("screen", cleanScreen);
  if (cleanJobId) qs.set("job_id", cleanJobId);
  if (cleanService) qs.set("service", cleanService);
  if (isAuthCallback) {
    if (query.pending_token) qs.set("pending_token", String(query.pending_token));
    if (query.error) qs.set("error", String(query.error));
    if (query.error_description) qs.set("error_description", String(query.error_description));
    if (query.access_token) qs.set("access_token", String(query.access_token));
    if (query.id_token) qs.set("id_token", String(query.id_token));
    if (query.code && !query.pending_token) qs.set("code", String(query.code));
    if (targetRole === "vendor") qs.set("role", "vendor");
  }
  const qsStr = qs.toString();

  const customSchemePath = isAuthCallback
    ? "auth/callback"
    : cleanPromo
      ? `reward/${encodeURIComponent(cleanPromo)}`
      : (cleanScreen === "book" ? "book" : "open");
  const customSchemeUrl = `${appScheme}://${customSchemePath}${qsStr ? `?${qsStr}` : ""}`;
  const fallbackWebUrl = `${origin}/downloads/${apkFileName}`;
  const androidIntentUrl = `intent://${customSchemePath}${qsStr ? `?${qsStr}` : ""}#Intent;scheme=${appScheme};package=${androidPackage};S.browser_fallback_url=${encodeURIComponent(fallbackWebUrl)};end`;

  const body = `
    <section class="fx-hero" style="min-height:62vh;display:flex;align-items:center">
      <div class="fx-wrap" style="max-width:600px">
        <div class="fx-card" style="text-align:center;padding:34px 26px">
          <img src="/logo.png" alt="FixIt" style="width:72px;height:72px;border-radius:18px;object-fit:cover;box-shadow:0 6px 18px rgba(255,90,0,.22);display:block;margin:0 auto 16px" />

          ${isAuthCallback ? `
            <span class="fx-pill fx-pill-ok" style="margin-bottom:10px">${ICONS.check}<span>Google Sign-In Verified</span></span>
            <h1 style="margin:6px 0 8px;font-size:28px;font-weight:900">Returning to ${escapeHtml(appDisplayName)}</h1>
            <p style="color:var(--mu);font-size:15px;margin:0 0 20px">
              Tap below if the app did not open automatically.
            </p>
          ` : cleanPromo ? `
            <span class="fx-pill fx-pill-ok" style="margin-bottom:10px">${ICONS.tag}<span>Reward Promo Ready: ${escapeHtml(cleanPromo)}</span></span>
            <h1 style="margin:6px 0 8px;font-size:28px;font-weight:900">Opening Reward Code in FixIt</h1>
            <p style="color:var(--mu);font-size:15px;margin:0 0 20px">
              Code <b>${escapeHtml(cleanPromo)}</b> will be applied automatically inside your FixIt app Coupons &amp; Checkout.
            </p>
          ` : `
            <span class="fx-pill" style="margin-bottom:10px">${ICONS.smartphone}<span>FixIt App Deep Link</span></span>
            <h1 style="margin:6px 0 8px;font-size:28px;font-weight:900">Opening the ${escapeHtml(appDisplayName)} App</h1>
            <p style="color:var(--mu);font-size:15px;margin:0 0 20px">
              If ${escapeHtml(appDisplayName)} is installed on your phone, tap below to jump straight into the app. Otherwise, install the latest Android APK directly.
            </p>
          `}

          <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">
            <a id="launchIntentBtn" href="${escapeHtml(androidIntentUrl)}" class="fx-btn fx-btn-primary fx-btn-lg" style="width:100%">
              ${ICONS.smartphone}
              <span>Open ${escapeHtml(appDisplayName)} App Now</span>
            </a>
            <a id="launchSchemeBtn" href="${escapeHtml(customSchemeUrl)}" class="fx-btn fx-btn-outline" style="width:100%">
              <span>Direct App Link (${escapeHtml(appScheme)}://)</span>
            </a>
            ${cleanPromo ? `
              <button id="copyPromoBtn" type="button" class="fx-btn fx-btn-outline" style="width:100%">
                ${ICONS.check}
                <span>Copy Reward Code: ${escapeHtml(cleanPromo)}</span>
              </button>
            ` : ""}
            <a href="/downloads/${escapeHtml(apkFileName)}" class="fx-btn fx-btn-outline" style="width:100%">
              ${ICONS.download}
              <span>Download ${escapeHtml(appDisplayName)} Android App (v3.3.7)</span>
            </a>
          </div>

          <p id="launchHint" style="margin:18px 0 0;font-size:13px;color:var(--mu2)">
            Attempting to launch ${escapeHtml(appDisplayName)} on your device automatically...
          </p>
        </div>
      </div>
    </section>
  `;

  const scripts = `
    <script>
      (function () {
        var intentUrl = ${JSON.stringify(androidIntentUrl)};
        var schemeUrl = ${JSON.stringify(customSchemeUrl)};
        var isAndroid = /Android/i.test(navigator.userAgent || "");
        var copyBtn = document.getElementById("copyPromoBtn");
        var code = ${JSON.stringify(cleanPromo)};

        if (copyBtn && code) {
          copyBtn.addEventListener("click", function () {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(code).then(function () {
                copyBtn.textContent = "Copied " + code;
              }).catch(function () {});
            }
          });
        }

        function appendExtraParams(rawSuffix) {
          if (!rawSuffix) return;
          var clean = rawSuffix.replace(/^[?#]/, "");
          if (!clean) return;
          var existing = new URLSearchParams((schemeUrl.split("?")[1]) || "");
          var extra = new URLSearchParams(clean);
          var added = [];
          extra.forEach(function (v, k) {
            if (!existing.has(k)) {
              existing.set(k, v);
              added.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
            }
          });
          if (!added.length) return;
          var tail = added.join("&");
          if (intentUrl.indexOf("#Intent;") !== -1) {
            intentUrl = intentUrl.replace("#Intent;", (intentUrl.indexOf("?") !== -1 ? "&" : "?") + tail + "#Intent;");
          } else {
            intentUrl += (intentUrl.indexOf("?") !== -1 ? "&" : "?") + tail;
          }
          schemeUrl += (schemeUrl.indexOf("?") !== -1 ? "&" : "?") + tail;
        }

        appendExtraParams(window.location.search || "");
        appendExtraParams(window.location.hash || "");

        var intentBtn = document.getElementById("launchIntentBtn");
        var schemeBtn = document.getElementById("launchSchemeBtn");
        if (intentBtn) intentBtn.href = intentUrl;
        if (schemeBtn) schemeBtn.href = schemeUrl;

        if (isAndroid) {
          setTimeout(function () {
            window.location.href = intentUrl;
          }, 150);
          setTimeout(function () {
            var h = document.getElementById("launchHint");
            if (h) h.textContent = "Tap 'Open ${escapeHtml(appDisplayName)} App Now' above if your browser paused automatic redirection.";
          }, 1800);
        } else {
          window.location.href = schemeUrl;
        }
      })();
    </script>
  `;

  const openTitle = isAuthCallback ? `Sign In to ${appDisplayName}` : cleanPromo ? `Claim Reward Code ${cleanPromo} · FixIt Oman` : `Open ${appDisplayName} App`;
  const openDesc = cleanPromo
    ? `Use code ${cleanPromo} for special discounts on repairs and maintenance across Salalah & Dhofar on FixIt.`
    : `Launch ${appDisplayName} to book instant home repairs, split AC maintenance, plumbing, electrical, and breakdown service in Oman.`;

  return renderPage({
    title: openTitle,
    description: openDesc,
    activePath: reqPath,
    body,
    scripts
  });
}

module.exports = {
  openAppPage
};
