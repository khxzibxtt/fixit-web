/**
 * Shared Pure-JS HTML layout shell, responsive sticky header, inline SVG icons, and full footer.
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
  wrench: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  snowflake: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M17 5l-5 4-5-4M17 19l-5-4-5 4M2 12h20M5 7l4 5-4 5M19 7l-4 5 4 5"/></svg>',
  bolt: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  drop: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.5c-3.5 4.5-6 7.8-6 11.2a6 6 0 0 0 12 0c0-3.4-2.5-6.7-6-11.2z"/></svg>',
  car: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 17h14M3 13l2-6h14l2 6v4H3z"/><circle cx="7.5" cy="14.5" r="1"/><circle cx="16.5" cy="14.5" r="1"/></svg>',
  globe: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
};

const NAV_ITEMS = [
  { href: "/", label: "Overview", key: "home" },
  { href: "/services", label: "Services", key: "services" },
  { href: "/reward", label: "Rewards", key: "reward" },
  { href: "/partner", label: "Partners", key: "partner" },
  { href: "/support", label: "Support", key: "support" },
  { href: "/about", label: "About", key: "about" }
];

function renderPage({ title, description = "", activePath = "/", body = "", headExtra = "", scripts = "" }) {
  const safeTitle = escapeHtml(title ? `${title} | FixIt Oman` : "FixIt Oman — On-Demand Home, AC & Roadside App");
  const safeDesc = escapeHtml(description || "FixIt connects residents across Salalah and Oman with verified repair, maintenance, and roadside pros exclusively through the FixIt Android app.");

  const navLinks = NAV_ITEMS.map(item => {
    const isActive = item.href === activePath;
    return `<a href="${item.href}" class="fx-nav-link${isActive ? " is-active" : ""}">${item.label}</a>`;
  }).join("");

  const mobileLinks = NAV_ITEMS.map(item => {
    const isActive = item.href === activePath;
    return `<a href="${item.href}" class="fx-drawer-link${isActive ? " is-active" : ""}">${item.label}</a>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#FF5A00" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}" />
  <link rel="icon" type="image/png" href="/logo.png" />
  <link rel="manifest" href="/manifest.json" />
  ${headExtra}
  <style>
    :root {
      --o: #FF5A00;
      --o-dark: #E04E00;
      --cream: #FAF6F0;
      --ink: #111827;
      --mu: #4B5563;
      --mu2: #6B7280;
      --line: #E5E7EB;
      --bg: #FFFFFF;
      --surface: #F9FAFB;
      --ok: #15803D;
      --ok-bg: #DCFCE7;
      --radius: 16px;
      --max: 1120px;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--bg); color: var(--ink); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif; line-height: 1.55; -webkit-font-smoothing: antialiased; overflow-x: hidden; }
    a { color: inherit; text-decoration: none; }
    button, input, textarea, select { font: inherit; }
    .fx-wrap { width: 100%; max-width: var(--max); margin: 0 auto; padding: 0 20px; }

    /* Fixed Sticky Header */
    .fx-header {
      position: sticky; top: 0; z-index: 60;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--line);
    }
    .fx-header-inner {
      display: flex; align-items: center; justify-content: space-between;
      height: 68px; gap: 16px;
    }
    .fx-brand {
      display: inline-flex; align-items: center; gap: 10px; flex-shrink: 0;
    }
    .fx-wordmark {
      background: var(--o); color: #fff; font-weight: 900; font-size: 20px;
      letter-spacing: -0.7px; padding: 4px 12px 6px; border-radius: 7px;
      transform: rotate(-1.5deg); display: inline-block; line-height: 1.1;
    }
    .fx-region {
      font-size: 12px; font-weight: 700; color: var(--mu); background: var(--cream);
      border: 1px solid #F3E8D8; padding: 3px 9px; border-radius: 999px;
    }
    .fx-nav {
      display: flex; align-items: center; gap: 6px;
    }
    .fx-nav-link {
      padding: 8px 13px; border-radius: 999px; font-size: 14px; font-weight: 600;
      color: var(--mu); transition: background 0.15s, color 0.15s; white-space: nowrap;
    }
    .fx-nav-link:hover { background: var(--surface); color: var(--ink); }
    .fx-nav-link.is-active { background: #FFF4EE; color: var(--o); font-weight: 700; }
    .fx-header-actions {
      display: flex; align-items: center; gap: 10px; flex-shrink: 0;
    }
    .fx-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      height: 42px; padding: 0 18px; border-radius: 999px; border: 1px solid transparent;
      font-weight: 700; font-size: 14px; cursor: pointer; transition: transform 0.12s, background 0.15s;
      white-space: nowrap;
    }
    .fx-btn:active { transform: scale(0.98); }
    .fx-btn-primary { background: var(--o); color: #fff; }
    .fx-btn-primary:hover { background: var(--o-dark); }
    .fx-btn-outline { background: #fff; color: var(--ink); border-color: #D1D5DB; }
    .fx-btn-outline:hover { background: var(--surface); }
    .fx-btn-lg { height: 50px; padding: 0 24px; font-size: 15px; }
    .fx-burger {
      display: none; width: 42px; height: 42px; border-radius: 10px;
      border: 1px solid var(--line); background: #fff; color: var(--ink);
      align-items: center; justify-content: center; cursor: pointer;
    }
    .fx-drawer {
      display: none; border-top: 1px solid var(--line); background: #fff;
      padding: 12px 20px 20px;
    }
    .fx-drawer.open { display: block; }
    .fx-drawer-grid { display: flex; flex-direction: column; gap: 6px; }
    .fx-drawer-link {
      padding: 11px 14px; border-radius: 12px; font-weight: 600; font-size: 15px; color: var(--ink);
    }
    .fx-drawer-link.is-active { background: #FFF4EE; color: var(--o); font-weight: 700; }

    @media (max-width: 860px) {
      .fx-nav { display: none; }
      .fx-burger { display: inline-flex; }
      .fx-region { display: none; }
    }

    /* Sections & Cards */
    .fx-hero {
      background: linear-gradient(180deg, var(--cream) 0%, #FFFFFF 100%);
      border-bottom: 1px solid var(--line);
      padding: 52px 0 46px;
    }
    .fx-grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px; align-items: center; }
    .fx-grid-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
    .fx-grid-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
    @media (max-width: 860px) {
      .fx-grid-2, .fx-grid-3, .fx-grid-4 { grid-template-columns: 1fr; }
      .fx-hero { padding: 34px 0 32px; }
    }
    .fx-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 700;
      background: #FFF4EE; color: var(--o); border: 1px solid #FED7AA;
    }
    .fx-pill-ok { background: var(--ok-bg); color: var(--ok); border-color: #BBF7D0; }
    .fx-h1 { font-size: clamp(30px, 4.4vw, 46px); font-weight: 900; line-height: 1.12; letter-spacing: -0.02em; margin: 14px 0 14px; }
    .fx-lead { font-size: 17px; color: var(--mu); max-width: 60ch; margin: 0 0 24px; }
    .fx-card {
      background: #fff; border: 1px solid var(--line); border-radius: var(--radius);
      padding: 22px; box-shadow: 0 1px 3px rgba(17, 24, 39, 0.04);
    }
    .fx-ic-box {
      width: 44px; height: 44px; border-radius: 12px; background: #FFF4EE; color: var(--o);
      display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .fx-section { padding: 52px 0; }
    .fx-section-muted { background: var(--surface); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
    .fx-section-title { font-size: 26px; font-weight: 900; margin: 0 0 8px; letter-spacing: -0.015em; }
    .fx-section-sub { font-size: 15px; color: var(--mu); margin: 0 0 28px; }

    /* Forms */
    .fx-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .fx-field label { font-size: 13px; font-weight: 700; color: var(--ink); }
    .fx-input, .fx-select, .fx-textarea {
      width: 100%; border: 1.4px solid #D1D5DB; border-radius: 12px; padding: 11px 14px;
      background: #fff; color: var(--ink); font-size: 15px; transition: border-color 0.15s;
    }
    .fx-input:focus, .fx-select:focus, .fx-textarea:focus { outline: none; border-color: var(--o); }
    .fx-textarea { min-height: 120px; resize: vertical; }

    /* Footer */
    .fx-footer { background: #0F172A; color: #CBD5E1; padding: 48px 0 28px; margin-top: 40px; }
    .fx-footer-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 28px; padding-bottom: 32px; border-bottom: 1px solid rgba(255,255,255,0.1); }
    @media (max-width: 860px) { .fx-footer-grid { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 520px) { .fx-footer-grid { grid-template-columns: 1fr; } }
    .fx-footer h4 { color: #fff; font-size: 14px; font-weight: 800; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .fx-footer ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
    .fx-footer a { font-size: 14px; color: #94A3B8; }
    .fx-footer a:hover { color: #fff; }
    .fx-footer-bottom { padding-top: 22px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; font-size: 13px; color: #94A3B8; }
  </style>
</head>
<body>
  <header class="fx-header">
    <div class="fx-wrap fx-header-inner">
      <div style="display:flex;align-items:center;gap:12px">
        <a href="/" class="fx-brand" aria-label="FixIt Home">
          <span class="fx-wordmark">fixit</span>
        </a>
        <span class="fx-region">Salalah &amp; Oman</span>
      </div>

      <nav class="fx-nav" aria-label="Primary Navigation">
        ${navLinks}
      </nav>

      <div class="fx-header-actions">
        <a href="/open" class="fx-btn fx-btn-primary">
          ${ICONS.smartphone}
          <span>Open App</span>
        </a>
        <button id="fxBurgerBtn" class="fx-burger" type="button" aria-label="Toggle Menu" aria-expanded="false" aria-controls="fxMobileDrawer">
          ${ICONS.menu}
        </button>
      </div>
    </div>

    <div id="fxMobileDrawer" class="fx-drawer" aria-hidden="true">
      <div class="fx-drawer-grid">
        ${mobileLinks}
        <a href="/downloads/FixIt-Consumer.apk" class="fx-btn fx-btn-outline" style="margin-top:8px">
          ${ICONS.download}
          <span>Download Android App</span>
        </a>
      </div>
    </div>
  </header>

  <main>${body}</main>

  <footer class="fx-footer">
    <div class="fx-wrap">
      <div class="fx-footer-grid">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <span class="fx-wordmark">fixit</span>
            <span style="font-size:13px;font-weight:700;color:#fff">Salalah &amp; Dhofar, Oman</span>
          </div>
          <p style="font-size:14px;color:#94A3B8;max-width:34ch;margin:0 0 14px">
            App-only marketplace connecting homeowners and motorists across Oman with verified maintenance technicians and roadside assistance. Quotes and bookings happen inside the FixIt mobile apps.
          </p>
          <div style="display:flex;flex-wrap:wrap;gap:10px">
            <a href="https://wa.me/96895956361" target="_blank" rel="noopener noreferrer" class="fx-btn" style="background:#15803D;color:#fff;height:38px;padding:0 14px;font-size:13px">
              ${ICONS.whatsapp}
              <span>WhatsApp Care</span>
            </a>
            <a href="mailto:support@fixit-now.xyz" class="fx-btn" style="background:rgba(255,255,255,0.1);color:#fff;height:38px;padding:0 14px;font-size:13px">
              ${ICONS.mail}
              <span>support@fixit-now.xyz</span>
            </a>
          </div>
        </div>

        <div>
          <h4>Platform</h4>
          <ul>
            <li><a href="/">Overview</a></li>
            <li><a href="/services">Service Scopes</a></li>
            <li><a href="/open">Launch FixIt App</a></li>
            <li><a href="/reward">Redeem Reward Link</a></li>
            <li><a href="/downloads/FixIt-Consumer.apk">Download Customer APK</a></li>
          </ul>
        </div>

        <div>
          <h4>Partners &amp; Support</h4>
          <ul>
            <li><a href="/partner">Become a FixIt Pro</a></li>
            <li><a href="/downloads/FixIt-Vendor.apk">Download Pro Vendor APK</a></li>
            <li><a href="/support">Online Help Center</a></li>
            <li><a href="/contact">Contact &amp; Mail Form</a></li>
          </ul>
        </div>

        <div>
          <h4>Legal</h4>
          <ul>
            <li><a href="/about">About FixIt</a></li>
            <li><a href="/warranty">14-Day Service Warranty</a></li>
            <li><a href="/terms">Terms of Service</a></li>
            <li><a href="/privacy">Privacy Policy</a></li>
          </ul>
        </div>
      </div>

      <div class="fx-footer-bottom">
        <span>FixIt Marketplace Platform · Salalah, Sultanate of Oman</span>
        <span>All orders and vendor quotes operate exclusively inside the FixIt App.</span>
      </div>
    </div>
  </footer>

  <script>
    (function () {
      var btn = document.getElementById("fxBurgerBtn");
      var drawer = document.getElementById("fxMobileDrawer");
      if (btn && drawer) {
        btn.addEventListener("click", function () {
          var isOpen = drawer.classList.toggle("open");
          btn.setAttribute("aria-expanded", String(isOpen));
          drawer.setAttribute("aria-hidden", String(!isOpen));
        });
      }
    })();
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
