/**
 * Talabat-Style Pure-JS HTML layout shell, Smart App Banner, TT Commons typography,
 * responsive navbar, inline SVG icons, and authentic footer (zero fake CRs/LLCs/emails).
 */

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ICONS = {
  menu: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  close: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  arrowRight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
  download: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  shield: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
  whatsapp: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l1.7-3.9a9 9 0 1 1 3.4 2.9L3 21z"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/></svg>',
  mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
  smartphone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2.5"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
  tag: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  wrench: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  snowflake: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M17 5l-5 4-5-4M17 19l-5-4-5 4M2 12h20M5 7l4 5-4 5M19 7l-4 5 4 5"/></svg>',
  bolt: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  drop: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.5c-3.5 4.5-6 7.8-6 11.2a6 6 0 0 0 12 0c0-3.4-2.5-6.7-6-11.2z"/></svg>',
  car: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 17h14M3 13l2-6h14l2 6v4H3z"/><circle cx="7.5" cy="14.5" r="1"/><circle cx="16.5" cy="14.5" r="1"/></svg>',
  taxi: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="8" rx="2"/><path d="M5 11l2-5h10l2 5M9 6V4h6v2M7 16h.01M17 16h.01"/></svg>',
  sparkles: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m12 3 1.9 4.9L19 10l-5.1 2.1L12 17l-1.9-4.9L5 10l5.1-2.1zM5 3l.8 2.2L8 6l-2.2.8L5 9l-.8-2.2L2 6l2.2-.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
  key: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 9-9 3 3-2 2-2-2-2 2-2-2-2 2"/></svg>',
  search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  globe: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
};

const NAV_ITEMS = [
  { href: "/", label: "Overview", key: "home" },
  { href: "/services", label: "Services", key: "services" },
  { href: "/partner", label: "Become a Partner", key: "partner" },
  { href: "/support", label: "Help & Support", key: "support" },
  { href: "/about", label: "About", key: "about" }
];

function renderPage({ title, description = "", activePath = "/", body = "", headExtra = "", scripts = "" }) {
  const safeTitle = escapeHtml(title ? `${title} | FixIt Oman` : "FixIt Oman | Professional On-Demand Repairs, Breakdown, & Technicians");
  const safeDesc = escapeHtml(description || "FixIt connects homeowners, drivers, and property managers in Salalah and Oman with verified technicians and breakdown recovery through transparent pro bidding.");

  const navLinks = NAV_ITEMS.map(item => {
    const isActive = item.href === activePath;
    return `<a href="${item.href}" class="talabat-nav-link${isActive ? " is-active" : ""}">${item.label}</a>`;
  }).join("");

  const mobileLinks = NAV_ITEMS.map(item => {
    const isActive = item.href === activePath;
    return `<a href="${item.href}" class="talabat-drawer-link${isActive ? " is-active" : ""}">${item.label}</a>`;
  }).join("");

  const currentUrl = `https://fixit-now.xyz${activePath}`;
  const ogImageUrl = "https://fixit-now.xyz/og-image.png";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#FF5A00" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}" />

  <!-- OpenGraph / WhatsApp / Telegram / Social Preview -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="FixIt · فيكس إت" />
  <meta property="og:url" content="${currentUrl}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:secure_url" content="${ogImageUrl}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="FixIt Oman" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:locale:alternate" content="ar_OM" />

  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@FixItOman" />
  <meta name="twitter:url" content="${currentUrl}" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image" content="${ogImageUrl}" />

  <link rel="icon" type="image/png" href="/logo.png" />
  <link rel="apple-touch-icon" href="/logo.png" />
  <link rel="manifest" href="/manifest.json" />
  ${headExtra}
  <style>
    @font-face { font-family: 'TT Commons'; src: url('/fonts/TTCommonsPro-Normal.otf') format('opentype'); font-weight: 400; font-display: swap; }
    @font-face { font-family: 'TT Commons'; src: url('/fonts/TTCommonsPro-DemiBold.otf') format('opentype'); font-weight: 600; font-display: swap; }
    @font-face { font-family: 'TT Commons'; src: url('/fonts/TTCommonsPro-Bold.otf') format('opentype'); font-weight: 700; font-display: swap; }
    @font-face { font-family: 'TT Commons'; src: url('/fonts/TTCommonsPro-Black.otf') format('opentype'); font-weight: 900; font-display: swap; }
    @font-face { font-family: 'Noto Sans Arabic'; src: url('/fonts/NotoSansArabic-Regular.otf') format('opentype'); font-weight: 400; font-display: swap; }
    @font-face { font-family: 'Noto Sans Arabic'; src: url('/fonts/NotoSansArabic-Bold.otf') format('opentype'); font-weight: 700; font-display: swap; }

    :root {
      --primary: #FF5A00;
      --primary-hover: #E04E00;
      --primary-light: #FFF1E8;
      --neutral-black: #262626;
      --neutral-white: #FFFFFF;
      --neutral-gray: #6B6B6B;
      --neutral-light: #F5F5F5;
      --neutral-border: #E5E5E5;
      --success-green: #05A437;
      --success-bg: #EBF4E5;
      --shadow: 0 4px 18px rgba(0, 0, 0, 0.06);
      --font-en: 'TT Commons', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-ar: 'Noto Sans Arabic', sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; outline: none; }
    html, body {
      font-family: var(--font-en);
      color: var(--neutral-black);
      background-color: var(--neutral-white);
      -webkit-font-smoothing: antialiased;
      line-height: 1.45;
      overflow-x: hidden;
    }
    a { text-decoration: none; color: inherit; }
    button { cursor: pointer; border: none; background: none; font: inherit; }

    /* ========== SMART APP BANNER (MOBILE FIRST) ========== */
    .talabat-smart-banner {
      background: #111827;
      color: #fff;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      position: relative;
      z-index: 1001;
    }
    .smart-open-btn {
      background: var(--primary);
      color: #fff;
      font-weight: 800;
      font-size: 13px;
      padding: 8px 16px;
      border-radius: 8px;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .smart-open-btn:hover { background: var(--primary-hover); }

    /* ========== TALABAT TOP NAVBAR ========== */
    .talabat-nav {
      height: 72px;
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--neutral-border);
      background: #FFFFFF;
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    .nav-left { display: flex; align-items: center; gap: 32px; }
    .brand-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 900;
      font-size: 26px;
      color: var(--primary);
      letter-spacing: -0.5px;
    }
    .brand-logo img { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; }
    .talabat-nav-links { display: flex; align-items: center; gap: 24px; font-size: 16px; font-weight: 600; color: var(--neutral-black); }
    .talabat-nav-link:hover { color: var(--primary); }
    .talabat-nav-link.is-active { color: var(--primary); font-weight: 800; }
    @media (max-width: 860px) { .talabat-nav-links { display: none; } }

    .nav-right { display: flex; align-items: center; gap: 14px; }
    .lang-switcher {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 99px;
      font-size: 13.5px;
      font-weight: 700;
      background: var(--neutral-light);
      color: var(--neutral-black);
    }
    .btn-get-app {
      background: var(--primary);
      color: #fff;
      font-weight: 800;
      font-size: 14.5px;
      padding: 10px 22px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    .btn-get-app:hover { background: var(--primary-hover); }
    .nav-burger {
      display: none;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: var(--neutral-light);
      color: var(--neutral-black);
      place-items: center;
    }
    @media (max-width: 860px) { .nav-burger { display: grid; } }

    /* Mobile Drawer */
    .talabat-drawer {
      display: none;
      position: fixed;
      top: 72px;
      left: 0;
      right: 0;
      background: #fff;
      border-bottom: 1px solid var(--neutral-border);
      padding: 16px 24px 24px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.1);
      z-index: 999;
    }
    .talabat-drawer.open { display: block; }
    .talabat-drawer-grid { display: flex; flex-direction: column; gap: 12px; }
    .talabat-drawer-link { font-size: 16px; font-weight: 700; color: var(--neutral-black); padding: 8px 0; border-bottom: 1px solid #f1f1f1; }
    .talabat-drawer-link.is-active { color: var(--primary); }

    /* ========== TALABAT FOOTER ========== */
    .talabat-footer {
      background: #FFFFFF;
      border-top: 1px solid var(--neutral-border);
      padding: 48px 24px 32px;
      margin-top: 40px;
    }
    .footer-container { max-width: 1140px; margin: 0 auto; }
    .footer-grid {
      display: grid;
      grid-template-columns: 2fr repeat(3, 1fr);
      gap: 32px;
      margin-bottom: 40px;
    }
    @media (max-width: 860px) { .footer-grid { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 520px) { .footer-grid { grid-template-columns: 1fr; } }
    .footer-col h4 { font-size: 15px; font-weight: 900; margin-bottom: 16px; color: var(--neutral-black); text-transform: uppercase; letter-spacing: 0.04em; }
    .footer-col ul { list-style: none; display: flex; flex-direction: column; gap: 10px; }
    .footer-col a { color: var(--neutral-gray); font-size: 14.5px; transition: color 0.15s; }
    .footer-col a:hover { color: var(--primary); }
    .footer-brand p { font-size: 14px; color: var(--neutral-gray); line-height: 1.5; margin-top: 12px; max-width: 360px; }

    .footer-bottom {
      border-top: 1px solid var(--neutral-border);
      padding-top: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 13.5px;
      color: var(--neutral-gray);
    }
  </style>
</head>
<body>

  <!-- Smart App Banner -->
  <div class="talabat-smart-banner" id="talabatSmartBanner">
    <div style="display:flex;align-items:center;gap:10px">
      <img src="/logo.png" alt="FixIt" style="width:36px;height:36px;border-radius:9px;object-fit:cover" />
      <div>
        <div style="font-weight:900;font-size:14px;color:#fff">FixIt Oman</div>
        <div style="font-size:11.5px;color:rgba(255,255,255,0.85)">Get bids in minutes · Salalah &amp; Dhofar</div>
      </div>
    </div>
    <button onclick="openApp()" class="smart-open-btn">OPEN APP</button>
  </div>

  <!-- Talabat Main Top Navigation -->
  <nav class="talabat-nav">
    <div class="nav-left">
      <a href="/" class="brand-logo" aria-label="FixIt Home">
        <img src="/logo.png" alt="FixIt Logo" />
        <span>FixIt</span>
      </a>
      <div class="talabat-nav-links">
        ${navLinks}
      </div>
    </div>
    <div class="nav-right">
      <button class="lang-switcher" type="button" onclick="alert('Arabic &amp; English are fully supported inside the FixIt Android App.')">
        <span>العربية</span>
      </button>
      <button class="btn-get-app" type="button" onclick="openApp()">
        ${ICONS.smartphone}
        <span>Open App</span>
      </button>
      <button id="talabatBurgerBtn" class="nav-burger" type="button" aria-label="Toggle navigation">
        ${ICONS.menu}
      </button>
    </div>
  </nav>

  <!-- Mobile Drawer -->
  <div id="talabatMobileDrawer" class="talabat-drawer" aria-hidden="true">
    <div class="talabat-drawer-grid">
      ${mobileLinks}
      <button onclick="openApp()" class="btn-get-app" style="justify-content:center;margin-top:10px">
        ${ICONS.smartphone}
        <span>Open FixIt App</span>
      </button>
      <a href="/downloads/FixIt-Consumer.apk" style="display:inline-flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:700;color:var(--neutral-gray);padding:10px 0">
        ${ICONS.download}
        <span>Direct APK Download (v3.3.5)</span>
      </a>
    </div>
  </div>

  <main>${body}</main>

  <!-- Talabat Footer -->
  <footer class="talabat-footer">
    <div class="footer-container">
      <div class="footer-grid">
        <div class="footer-brand">
          <div class="brand-logo">
            <img src="/logo.png" alt="FixIt" />
            <span>FixIt</span>
          </div>
          <p>
            FixIt connects customers in Salalah and across Oman with skilled independent technicians and workshops. Describe your exact problem, compare competitive bids, and pay safely only after accepting.
          </p>
          <div style="margin-top:14px">
            <a href="https://wa.me/96895956361" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:#15803D">
              ${ICONS.whatsapp}
              <span>Direct WhatsApp Care: +968 9595 6361</span>
            </a>
          </div>
        </div>

        <div class="footer-col">
          <h4>Popular Services</h4>
          <ul>
            <li><a href="javascript:void(0)" onclick="openApp('AC_REPAIR')">AC Repair &amp; Maintenance</a></li>
            <li><a href="javascript:void(0)" onclick="openApp('BREAKDOWN')">Car Breakdown &amp; Towing</a></li>
            <li><a href="javascript:void(0)" onclick="openApp('ELECTRICIAN')">Master Electrician</a></li>
            <li><a href="javascript:void(0)" onclick="openApp('PLUMBING')">Plumbing &amp; Water Pumps</a></li>
            <li><a href="javascript:void(0)" onclick="openApp('TAXI')">Salalah City Taxi</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h4>Platform</h4>
          <ul>
            <li><a href="/about">About FixIt</a></li>
            <li><a href="/partner">Become a Pro Partner</a></li>
            <li><a href="/support">Help &amp; Support Queue</a></li>
            <li><a href="/api/health">System Status</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h4>Legal &amp; Trust</h4>
          <ul>
            <li><a href="/terms">Terms of Service</a></li>
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><a href="/cookies">Cookie &amp; Storage Policy</a></li>
            <li><a href="/refunds">Refund &amp; Billing Policy</a></li>
            <li><a href="/aup">Acceptable Use Policy</a></li>
            <li><a href="/disclaimer">Platform &amp; Ad Disclaimers</a></li>
            <li><a href="/delete-account">Account &amp; Data Deletion</a></li>
            <li><a href="/warranty">14-Day Workmanship Warranty</a></li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <div>© 2026 FixIt Oman (fixit-now.xyz). All rights reserved. Independent Omani platform — NOT affiliated with, endorsed by, or connected in any way to Talabat or Delivery Hero SE.</div>
        <div style="display:flex;gap:18px;align-items:center">
          <a href="https://wa.me/96895956361" target="_blank" rel="noopener noreferrer" style="color:#15803D;font-weight:700">WhatsApp: +968 9595 6361</a>
          <span>·</span>
          <span>Salalah, Dhofar Governorate, Oman</span>
        </div>
      </div>
    </div>
  </footer>

  <script>
    (function () {
      var burger = document.getElementById("talabatBurgerBtn");
      var drawer = document.getElementById("talabatMobileDrawer");
      if (burger && drawer) {
        burger.addEventListener("click", function () {
          var open = drawer.classList.toggle("open");
          burger.setAttribute("aria-expanded", String(open));
          drawer.setAttribute("aria-hidden", String(!open));
        });
      }
    })();

    // Universal Android intent / custom scheme app opener
    function openApp(service) {
      var isAndroid = /Android/i.test(navigator.userAgent || "");
      var qs = [];
      if (service) qs.push("service=" + encodeURIComponent(service));
      var qStr = qs.length ? ("?" + qs.join("&")) : "";
      var fallbackUrl = window.location.origin + "/downloads/FixIt-Consumer.apk";
      var intentUrl = "intent://open" + qStr + "#Intent;scheme=fixit;package=com.khxzi.fixit;S.browser_fallback_url=" + encodeURIComponent(fallbackUrl) + ";end";
      var schemeUrl = "fixit://open" + qStr;

      if (isAndroid) {
        window.location.href = intentUrl;
      } else {
        window.location.href = schemeUrl;
        setTimeout(function () {
          window.location.href = fallbackUrl;
        }, 1400);
      }
    }
  </script>
  ${scripts}
</body>
</html>`;
}

module.exports = {
  ICONS,
  escapeHtml,
  renderPage
};
