/**
 * Home view: Authentic Talabat-style responsive landing page for FixIt Oman.
 * Features TT Commons hero search card, 8 popular service categories with app deep-linking,
 * FixIt Pro banner, trust strip, and APK download showcase.
 * Zero speculative prices, zero fake CRs/LLCs, zero emojis, zero fake emails.
 */

const { ICONS, renderPage } = require("./layout");

const CATEGORIES = [
  {
    key: "AC_REPAIR",
    title: "AC & Cooling Fix",
    desc: "Gas refill inspection, split AC repair, filter washing, and master compressor diagnostics.",
    badge: "Direct Bids in OMR",
    icon: "snowflake"
  },
  {
    key: "BREAKDOWN",
    title: "Breakdown & Towing",
    desc: "Flatbed recovery, battery jump-start, fuel delivery, and tire puncture assistance on-site.",
    badge: "24/7 SOS · Fast Dispatch",
    icon: "car"
  },
  {
    key: "ELECTRICIAN",
    title: "Master Electrician",
    desc: "DB box wiring, short circuit isolation, lighting, switches, and water heater power lines.",
    badge: "Verified Pros",
    icon: "bolt"
  },
  {
    key: "PLUMBING",
    title: "Plumbing & Pumps",
    desc: "Pipe leaks, bathroom fittings, water heater tanks, and pressure pump installations.",
    badge: "Fast On-Site Bids",
    icon: "drop"
  },
  {
    key: "TAXI",
    title: "Salalah Taxi & Transport",
    desc: "City rides, airport transfers to Salalah International, and on-demand local dispatch.",
    badge: "City Rides & Airport",
    icon: "taxi"
  },
  {
    key: "CLEANING",
    title: "Home & Villa Cleaning",
    desc: "Deep carpet cleaning, sofa shampoo, post-monsoon freshening, and sanitization.",
    badge: "Verified Teams",
    icon: "sparkles"
  },
  {
    key: "PEST_CONTROL",
    title: "Pest Control & Safety",
    desc: "Safe odorless treatment for villas, apartments, restaurants, and commercial facilities.",
    badge: "14-Day Guarantee",
    icon: "shield"
  },
  {
    key: "LOCKSMITH",
    title: "Locksmith & Security",
    desc: "Emergency door lockout, smart key programming, and lock cylinder replacement.",
    badge: "Emergency Dispatch",
    icon: "key"
  }
];

function homePage({ reqHost }) {
  const origin = reqHost ? `https://${reqHost}` : "https://fixit-web.onrender.com";

  const body = `
    <style>
      /* ========== HERO SECTION (TALABAT WEB ORANGE BANNER) ========== */
      .talabat-hero {
        background: linear-gradient(135deg, #FF5A00 0%, #EA580C 100%);
        color: #fff;
        padding: 48px 24px 64px;
        position: relative;
        overflow: hidden;
      }
      .hero-container { max-width: 1140px; margin: 0 auto; }
      .hero-tagline {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(8px);
        padding: 6px 16px;
        border-radius: 99px;
        font-size: 13.5px;
        font-weight: 800;
        margin-bottom: 16px;
        letter-spacing: 0.3px;
      }
      .hero-title {
        font-size: 42px;
        font-weight: 900;
        line-height: 1.15;
        letter-spacing: -0.8px;
        max-width: 720px;
        margin-bottom: 14px;
      }
      @media (max-width: 768px) { .hero-title { font-size: 30px; } }
      .hero-subtitle {
        font-size: 17px;
        opacity: 0.95;
        max-width: 620px;
        margin-bottom: 28px;
        font-weight: 500;
      }

      /* Talabat Hero Search Card */
      .hero-search-card {
        background: #FFFFFF;
        border-radius: 16px;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.16);
        max-width: 680px;
      }
      .search-pin { padding: 0 12px; color: var(--primary); display: grid; place-items: center; }
      .search-input {
        flex: 1;
        height: 48px;
        font-size: 16px;
        border: none;
        color: var(--neutral-black);
        background: transparent;
      }
      .search-btn {
        background: var(--primary);
        color: #FFFFFF;
        padding: 12px 28px;
        border-radius: 10px;
        font-weight: 800;
        font-size: 15px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: background 0.15s;
      }
      .search-btn:hover { background: var(--primary-hover); }
      @media (max-width: 600px) {
        .hero-search-card { flex-direction: column; gap: 8px; padding: 12px; }
        .search-btn { width: 100%; justify-content: center; }
      }

      /* ========== POPULAR CATEGORIES (TALABAT TILES) ========== */
      .section-wrap { max-width: 1140px; margin: 0 auto; padding: 48px 24px; }
      .section-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; }
      .section-title { font-size: 28px; font-weight: 900; letter-spacing: -0.4px; }
      .section-desc { font-size: 14.5px; color: var(--neutral-gray); margin-top: 4px; }

      .category-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 20px;
        margin-bottom: 48px;
      }
      @media (max-width: 992px) { .category-grid { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 520px) { .category-grid { grid-template-columns: 1fr; } }

      .category-card {
        background: #FFFFFF;
        border: 1px solid var(--neutral-border);
        border-radius: 18px;
        padding: 24px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 190px;
        transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
        cursor: pointer;
        position: relative;
        overflow: hidden;
      }
      .category-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
        border-color: var(--primary);
      }
      .cat-icon-wrap {
        width: 54px;
        height: 54px;
        border-radius: 14px;
        background: var(--primary-light);
        color: var(--primary);
        display: grid;
        place-items: center;
        margin-bottom: 14px;
      }
      .cat-title { font-size: 18px; font-weight: 900; color: var(--neutral-black); margin-bottom: 6px; }
      .cat-desc { font-size: 13.5px; color: var(--neutral-gray); line-height: 1.4; }
      .cat-badge {
        display: inline-block;
        align-self: flex-start;
        margin-top: 14px;
        font-size: 12px;
        font-weight: 800;
        color: var(--primary);
      }

      /* ========== TALABAT PRO BANNER ========== */
      .pro-banner {
        background: linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%);
        color: #fff;
        border-radius: 24px;
        padding: 36px 40px;
        margin: 24px 0 48px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 32px;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      @media (max-width: 820px) { .pro-banner { flex-direction: column; text-align: center; padding: 28px 20px; } }
      .pro-tag {
        background: linear-gradient(135deg, #FF5A00, #EA580C);
        color: #fff;
        font-weight: 900;
        font-size: 12px;
        padding: 4px 12px;
        border-radius: 99px;
        letter-spacing: 0.5px;
        display: inline-block;
        margin-bottom: 12px;
      }
      .pro-title { font-size: 28px; font-weight: 900; line-height: 1.2; margin-bottom: 8px; }
      .pro-subtitle { font-size: 15px; color: #94A3B8; max-width: 540px; line-height: 1.45; }
      .pro-btn {
        background: var(--primary);
        color: #fff;
        font-weight: 900;
        font-size: 15px;
        padding: 14px 28px;
        border-radius: 12px;
        white-space: nowrap;
        transition: background 0.15s;
      }
      .pro-btn:hover { background: var(--primary-hover); }

      /* ========== TRUST STRIP ========== */
      .trust-strip {
        background: var(--neutral-light);
        border-radius: 20px;
        padding: 28px;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
        margin-bottom: 48px;
      }
      @media (max-width: 768px) { .trust-strip { grid-template-columns: 1fr; gap: 16px; } }
      .trust-item { display: flex; align-items: flex-start; gap: 14px; }
      .trust-icon-box {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        background: #FFFFFF;
        color: var(--primary);
        display: grid;
        place-items: center;
        flex-shrink: 0;
        box-shadow: 0 2px 6px rgba(0,0,0,0.06);
      }
      .trust-title { font-weight: 900; font-size: 16px; color: var(--neutral-black); margin-bottom: 2px; }
      .trust-desc { font-size: 13.5px; color: var(--neutral-gray); line-height: 1.4; }

      /* ========== APP DOWNLOAD SHOWCASE ========== */
      .app-showcase {
        background: #FFFFFF;
        border: 1px solid var(--neutral-border);
        border-radius: 24px;
        padding: 40px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 40px;
        margin-bottom: 48px;
        box-shadow: var(--shadow);
      }
      @media (max-width: 860px) { .app-showcase { flex-direction: column; text-align: center; padding: 28px 20px; } }
      .showcase-text h3 { font-size: 28px; font-weight: 900; margin-bottom: 10px; }
      .showcase-text p { font-size: 15px; color: var(--neutral-gray); margin-bottom: 24px; max-width: 520px; line-height: 1.45; }
      .download-btns { display: flex; gap: 14px; flex-wrap: wrap; }
      @media (max-width: 860px) { .download-btns { justify-content: center; } }
      .app-store-btn {
        background: var(--neutral-black);
        color: #fff;
        padding: 12px 20px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: opacity 0.15s;
      }
      .app-store-btn:hover { opacity: 0.9; }
      .app-store-btn.vendor { background: #0F172A; border: 1.5px solid #334155; }
      .as-sub { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8; }
      .as-title { font-size: 14px; font-weight: 800; }
    </style>

    <!-- Talabat Hero Banner -->
    <header class="talabat-hero">
      <div class="hero-container">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;flex-wrap:wrap">
          <img src="/logo.png" alt="FixIt Oman Logo" style="width:56px;height:56px;border-radius:16px;object-fit:cover;border:2px solid rgba(255,255,255,0.45);box-shadow:0 8px 24px rgba(0,0,0,0.18)" />
          <div class="hero-tagline" style="margin-bottom:0">
            ${ICONS.globe}
            <span>FixIt Oman · Sultanate of Oman · Dhofar Governorate</span>
          </div>
        </div>
        <h1 class="hero-title">On-demand repair &amp; breakdown services, right at your doorstep</h1>
        <p class="hero-subtitle">
          From emergency car breakdown and flatbed towing to master AC technicians and home maintenance across Salalah.
        </p>

        <div class="hero-search-card">
          <span class="search-pin">${ICONS.search}</span>
          <input id="heroSearchInp" type="text" class="search-input" placeholder="Search AC repair, tow truck, electrician, or plumbing..." />
          <button class="search-btn" type="button" onclick="openApp()">
            <span>Find Pro Near Me</span>
            ${ICONS.arrowRight}
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="section-wrap" id="services">
      <div class="section-header">
        <div>
          <h2 class="section-title">Popular Services in Salalah</h2>
          <p class="section-desc">Verified independent technicians &amp; workshops with transparent bidding</p>
        </div>
        <a href="javascript:void(0)" onclick="openApp()" style="color:var(--primary);font-weight:800;font-size:14.5px">
          View All in App →
        </a>
      </div>

      <!-- 8 Primary Verticals (Clicking any opens the app) -->
      <div class="category-grid">
        ${CATEGORIES.map(c => `
          <div class="category-card" onclick="openApp('${c.key}')" role="button" tabindex="0">
            <div class="cat-icon-wrap">${ICONS[c.icon]}</div>
            <div>
              <div class="cat-title">${c.title}</div>
              <div class="cat-desc">${c.desc}</div>
            </div>
            <span class="cat-badge">${c.badge} →</span>
          </div>
        `).join("")}
      </div>

      <!-- FixIt Pro Subscription Card -->
      <div class="pro-banner" id="pro">
        <div>
          <span class="pro-tag">FIXIT PRO</span>
          <h3 class="pro-title">Unlimited priority dispatch &amp; zero booking fees</h3>
          <p class="pro-subtitle">
            FixIt Pro members enjoy 15% off every repair, top-of-feed priority for technician bids, and guaranteed 14-day warranty extensions.
          </p>
        </div>
        <button class="pro-btn" type="button" onclick="openApp()">Join FixIt Pro</button>
      </div>

      <!-- Trust & Verification Strip -->
      <div class="trust-strip">
        <div class="trust-item">
          <div class="trust-icon-box">${ICONS.shield}</div>
          <div>
            <div class="trust-title">Verified Local Technicians</div>
            <div class="trust-desc">Every pro and workshop is verified with active local documentation, craft reviews, and background checks.</div>
          </div>
        </div>
        <div class="trust-item">
          <div class="trust-icon-box">${ICONS.check}</div>
          <div>
            <div class="trust-title">14-Day Workmanship Warranty</div>
            <div class="trust-desc">Free revisit and money-back protection if the problem returns within 14 days of job completion.</div>
          </div>
        </div>
        <div class="trust-item">
          <div class="trust-icon-box">${ICONS.wrench}</div>
          <div>
            <div class="trust-title">Protected Payment</div>
            <div class="trust-desc">Funds are protected and released only after you inspect and approve the completed repair.</div>
          </div>
        </div>
      </div>

      <!-- App Download Showcase -->
      <div class="app-showcase">
        <div class="showcase-text">
          <h3>Everything is easier in the FixIt App</h3>
          <p>
            Order in seconds, track your assigned pro live on the map, and chat directly in real-time. Download the official Android APKs below.
          </p>
          <div class="download-btns">
            <a href="/downloads/FixIt-Consumer.apk" class="app-store-btn">
              ${ICONS.smartphone}
              <div>
                <div class="as-sub">Customer App</div>
                <div class="as-title">Download Consumer APK (v3.3.5)</div>
              </div>
            </a>
            <a href="/downloads/FixIt-Vendor.apk" class="app-store-btn vendor">
              ${ICONS.wrench}
              <div>
                <div class="as-sub">Pro Vendor Portal</div>
                <div class="as-title">Download Vendor APK (v3.3.5)</div>
              </div>
            </a>
          </div>
        </div>
        <div>
          <img src="/logo.png" alt="App Preview" style="width:140px;height:140px;border-radius:28px;box-shadow:0 12px 30px rgba(0,0,0,0.12)" />
        </div>
      </div>
      <!-- BEGIN AADS AD UNIT 2461953 -->
      <div style="max-width:760px;margin:28px auto 0;border-radius:14px;border:1px solid #E2E8F0;background:#F8FAFC;overflow:hidden">
        <div style="padding:5px 12px;background:#F1F5F9;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between;font-size:10.5px;font-weight:800;letter-spacing:1.2px;color:#64748B;text-transform:uppercase">
          <span>ADVERTISEMENT · THIRD-PARTY AD (NOT AFFILIATED WITH FIXIT)</span>
          <a href="https://aads.com/privacy_policy" target="_blank" rel="noopener noreferrer" style="color:#64748B;text-decoration:underline">A-Ads Privacy</a>
        </div>
        <div id="frame" style="width:100%;min-height:84px;position:relative;display:flex;align-items:center;justify-content:center;background:#F8FAFC">
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;letter-spacing:5px;color:#CBD5E1;text-transform:uppercase;pointer-events:none;user-select:none;z-index:0">ADVERTISEMENT</div>
          <iframe data-aa='2461953' src='https://acceptable.a-ads.com/2461953/?size=Adaptive'
            style='position:relative;z-index:1;border:0;padding:0;width:100%;height:80px;overflow:hidden;display:block;margin:auto;background:transparent'></iframe>
        </div>
      </div>
      <!-- END AADS AD UNIT 2461953 -->
    </main>
  `;

  return renderPage({
    title: "Professional On-Demand Repairs, Breakdown, & Technicians",
    activePath: "/",
    body
  });
}

module.exports = {
  homePage
};
