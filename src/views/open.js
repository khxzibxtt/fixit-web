/**
 * Talabat-style App Deep-Link Redirector (/open, /reward, /r/:code, /share, /book).
 * Launches the installed FixIt Android app automatically using Android intent:// + fixit://
 * and passes coupon/promo codes cleanly to the native bridge.
 */

const { ICONS, escapeHtml, renderPage } = require("./layout");

function openAppPage({ reqHost = "fixit-web.onrender.com", reqPath = "/open", query = {}, promoCode = "" }) {
  const origin = `https://${reqHost}`;
  const cleanPromo = String(promoCode || query.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const cleanScreen = String(query.screen || (cleanPromo ? "coupons" : reqPath === "/book" ? "book" : "")).trim();
  const cleanJobId = String(query.job_id || "").trim();
  const cleanService = String(query.service || "").trim();

  const qs = new URLSearchParams();
  if (cleanPromo) qs.set("code", cleanPromo);
  if (cleanScreen) qs.set("screen", cleanScreen);
  if (cleanJobId) qs.set("job_id", cleanJobId);
  if (cleanService) qs.set("service", cleanService);
  const qsStr = qs.toString();

  const customSchemePath = cleanPromo
    ? `reward/${encodeURIComponent(cleanPromo)}`
    : (cleanScreen === "book" ? "book" : "open");
  const customSchemeUrl = `fixit://${customSchemePath}${qsStr ? `?${qsStr}` : ""}`;
  const fallbackWebUrl = `${origin}/downloads/FixIt-Consumer.apk`;
  const androidIntentUrl = `intent://${customSchemePath}${qsStr ? `?${qsStr}` : ""}#Intent;scheme=fixit;package=com.khxzi.fixit;S.browser_fallback_url=${encodeURIComponent(fallbackWebUrl)};end`;

  const body = `
    <section class="fx-hero" style="min-height:62vh;display:flex;align-items:center">
      <div class="fx-wrap" style="max-width:600px">
        <div class="fx-card" style="text-align:center;padding:34px 26px">
          <div style="width:68px;height:68px;border-radius:18px;background:var(--o);color:#fff;display:grid;place-items:center;margin:0 auto 16px;font-weight:900;font-size:26px;letter-spacing:-1px">
            fixit
          </div>

          ${cleanPromo ? `
            <span class="fx-pill fx-pill-ok" style="margin-bottom:10px">${ICONS.tag}<span>Reward Promo Ready: ${escapeHtml(cleanPromo)}</span></span>
            <h1 style="margin:6px 0 8px;font-size:28px;font-weight:900">Opening Reward Code in FixIt</h1>
            <p style="color:var(--mu);font-size:15px;margin:0 0 20px">
              Code <b>${escapeHtml(cleanPromo)}</b> will be applied automatically inside your FixIt app Coupons &amp; Checkout.
            </p>
          ` : `
            <span class="fx-pill" style="margin-bottom:10px">${ICONS.smartphone}<span>FixIt App Deep Link</span></span>
            <h1 style="margin:6px 0 8px;font-size:28px;font-weight:900">Opening the FixIt App</h1>
            <p style="color:var(--mu);font-size:15px;margin:0 0 20px">
              If FixIt is installed on your phone, tap below to jump straight into the app. Otherwise, install the latest Android APK directly.
            </p>
          `}

          <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">
            <a id="launchIntentBtn" href="${escapeHtml(androidIntentUrl)}" class="fx-btn fx-btn-primary fx-btn-lg" style="width:100%">
              ${ICONS.smartphone}
              <span>Open FixIt App Now</span>
            </a>
            <a id="launchSchemeBtn" href="${escapeHtml(customSchemeUrl)}" class="fx-btn fx-btn-outline" style="width:100%">
              <span>Direct App Link (fixit://)</span>
            </a>
            ${cleanPromo ? `
              <button id="copyPromoBtn" type="button" class="fx-btn fx-btn-outline" style="width:100%">
                ${ICONS.check}
                <span>Copy Reward Code: ${escapeHtml(cleanPromo)}</span>
              </button>
            ` : ""}
            <a href="/downloads/FixIt-Consumer.apk" class="fx-btn fx-btn-outline" style="width:100%">
              ${ICONS.download}
              <span>Download FixIt Android App (v3.3.5)</span>
            </a>
          </div>

          <p id="launchHint" style="margin:18px 0 0;font-size:13px;color:var(--mu2)">
            Attempting to launch FixIt on your device automatically...
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

        if (isAndroid) {
          setTimeout(function () {
            window.location.href = intentUrl;
          }, 200);
          setTimeout(function () {
            var h = document.getElementById("launchHint");
            if (h) h.textContent = "Tap 'Open FixIt App Now' above if your browser paused automatic redirection.";
          }, 1800);
        } else {
          window.location.href = schemeUrl;
        }
      })();
    </script>
  `;

  return renderPage({
    title: cleanPromo ? `Reward ${cleanPromo}` : "Open FixIt App",
    activePath: "/reward",
    body,
    scripts
  });
}

module.exports = {
  openAppPage
};
