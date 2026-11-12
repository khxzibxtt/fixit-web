/**
 * Home view: Talabat-style app redirector landing page (zero web ordering, zero prices).
 */

const { ICONS, renderPage } = require("./layout");

const SERVICES = [
  { name: "AC Repair & Cooling", icon: "snowflake", scope: "Split & central AC servicing, gas refill inspection, compressor & thermostat diagnostics." },
  { name: "Electrical Services", icon: "bolt", scope: "Breaker panels, short-circuit tracing, outlets, water heaters, and lighting installation." },
  { name: "Plumbing & Leaks", icon: "drop", scope: "Pipe leak repair, water pumps, tank floats, mixers, and drain clearing." },
  { name: "Roadside & Recovery", icon: "car", scope: "Salalah breakdown assistance, flatbed tow trucks, battery jump-start, and tire puncture help." },
  { name: "Carpentry & Painting", icon: "wrench", scope: "Door hinges, custom cabinets, interior wall prep, and Khareef moisture treatment." },
  { name: "Home Care & Pest Control", icon: "shield", scope: "Deep cleaning, sofa sanitization, locksmith access, and licensed pest treatment." }
];

function homePage({ reqHost }) {
  const origin = reqHost ? `https://${reqHost}` : "https://fixit-web.onrender.com";

  const body = `
    <section class="fx-hero">
      <div class="fx-wrap fx-grid-2">
        <div>
          <span class="fx-pill">${ICONS.smartphone}<span>App-Only Ordering Platform · Salalah &amp; Dhofar</span></span>
          <h1 class="fx-h1">Trusted home &amp; roadside pros, booked directly in the FixIt App.</h1>
          <p class="fx-lead">
            Describe your repair scope with live camera photos inside the FixIt app, receive competitive offers directly from nearby verified workshops, and stay protected with 14-day workmanship coverage.
          </p>
          <div style="display:flex;flex-wrap:wrap;gap:12px">
            <a href="/open" class="fx-btn fx-btn-primary fx-btn-lg">
              ${ICONS.smartphone}
              <span>Open FixIt App</span>
              ${ICONS.arrowRight}
            </a>
            <a href="/downloads/FixIt-Consumer.apk" class="fx-btn fx-btn-outline fx-btn-lg">
              ${ICONS.download}
              <span>Download Android APK (v3.3.5)</span>
            </a>
          </div>
          <p style="font-size:13px;color:var(--mu2);margin-top:14px">
            No orders are placed on the website. Service quotes vary by job scope and are submitted inside the app by verified local pros.
          </p>
        </div>

        <div class="fx-card" style="background:#fff;border:1.5px solid #FED7AA">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div class="fx-ic-box">${ICONS.tag}</div>
            <div>
              <div style="font-weight:800;font-size:17px">Have a Friend or Promo Code?</div>
              <div style="font-size:13px;color:var(--mu)">Open your code directly inside the FixIt App or generate a shareable link.</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
            <input id="promoLaunchInp" class="fx-input" style="flex:1;min-width:170px;text-transform:uppercase;font-weight:700" placeholder="Enter code (e.g. SALALAH25)" value="SALALAH25" />
            <button id="promoOpenBtn" class="fx-btn fx-btn-primary" type="button">Launch in App</button>
          </div>
          <div style="margin-top:12px;padding:10px 12px;border-radius:10px;background:var(--surface);border:1px solid var(--line);font-size:13px;color:var(--mu)">
            Share link: <code id="promoShareUrl" style="font-weight:700;color:var(--ink)">${origin}/r/SALALAH25</code>
          </div>
        </div>
      </div>
    </section>

    <section class="fx-section">
      <div class="fx-wrap">
        <div style="display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:24px">
          <div>
            <h2 class="fx-section-title">Available Service Categories</h2>
            <p class="fx-section-sub" style="margin-bottom:0">Select your exact scope inside the FixIt app to get tailored offers from nearby pros.</p>
          </div>
          <a href="/services" class="fx-btn fx-btn-outline">Explore all 16 scopes</a>
        </div>

        <div class="fx-grid-3">
          ${SERVICES.map(s => `
            <div class="fx-card">
              <div class="fx-ic-box" style="margin-bottom:14px">${ICONS[s.icon]}</div>
              <h3 style="margin:0 0 6px;font-size:17px;font-weight:800">${s.name}</h3>
              <p style="margin:0 0 14px;font-size:14px;color:var(--mu)">${s.scope}</p>
              <a href="/open?screen=book" style="font-size:13.5px;font-weight:700;color:var(--o);display:inline-flex;align-items:center;gap:5px">
                <span>Request inside App</span>
                ${ICONS.arrowRight}
              </a>
            </div>
          `).join("")}
        </div>
      </div>
    </section>

    <section class="fx-section fx-section-muted">
      <div class="fx-wrap">
        <h2 class="fx-section-title">How FixIt Works</h2>
        <p class="fx-section-sub">Built for fast dispatch across Salalah and Dhofar with full transparency.</p>
        <div class="fx-grid-4">
          <div class="fx-card">
            <span class="fx-pill">Step 1</span>
            <h3 style="margin:12px 0 6px;font-size:16px">Define Job Scope</h3>
            <p style="margin:0;font-size:14px;color:var(--mu)">Choose property or vehicle type, select specific tasks, and capture live photos in the app.</p>
          </div>
          <div class="fx-card">
            <span class="fx-pill">Step 2</span>
            <h3 style="margin:12px 0 6px;font-size:16px">Compare Real Quotes</h3>
            <p style="margin:0;font-size:14px;color:var(--mu)">Nearby verified pros inspect your scope and submit direct quotes in Omani Rial inside the app.</p>
          </div>
          <div class="fx-card">
            <span class="fx-pill">Step 3</span>
            <h3 style="margin:12px 0 6px;font-size:16px">Track &amp; Coordinate</h3>
            <p style="margin:0;font-size:14px;color:var(--mu)">Confirm your pro with PayPal or in-app settlement and coordinate via WhatsApp or live chat.</p>
          </div>
          <div class="fx-card">
            <span class="fx-pill">Step 4</span>
            <h3 style="margin:12px 0 6px;font-size:16px">14-Day Protection</h3>
            <p style="margin:0;font-size:14px;color:var(--mu)">Before/after job photos document completed work for 14-day workmanship support.</p>
          </div>
        </div>
      </div>
    </section>
  `;

  const scripts = `
    <script>
      (function () {
        var inp = document.getElementById("promoLaunchInp");
        var out = document.getElementById("promoShareUrl");
        var btn = document.getElementById("promoOpenBtn");
        var origin = window.location.origin;
        function cleanCode() {
          return String((inp && inp.value) || "SALALAH25").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "") || "SALALAH25";
        }
        if (inp && out) {
          inp.addEventListener("input", function () {
            out.textContent = origin + "/r/" + cleanCode();
          });
        }
        if (btn) {
          btn.addEventListener("click", function () {
            window.location.href = "/r/" + encodeURIComponent(cleanCode());
          });
        }
      })();
    </script>
  `;

  return renderPage({
    title: "Home",
    activePath: "/",
    body,
    scripts
  });
}

module.exports = {
  homePage
};
