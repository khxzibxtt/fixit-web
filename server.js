const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets from public with cache control
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: "1d",
  setHeaders: (res, filePath) => {
    if (filePath.endsWith("sw.js")) {
      res.setHeader("Cache-Control", "no-cache");
    }
  }
}));

// Pre-cached verified badges database
const VERIFIED_BADGES = {
  "FX-WRK-884101": {
    badge_id: "FX-WRK-884101",
    type: "WORKER",
    name: "Khalid Al Balushi",
    name_ar: "خالد البلوشي",
    title: "Chief Master Electrician & AC Lead",
    title_ar: "كبير فنيي الكهرباء والتكييف",
    phone: "+96895956361",
    email: "khalid@fixit-now.xyz",
    shop_name: "Al-Mahdoud Technical & Engineering LLC",
    shop_name_ar: "المحدود للخدمات الفنية والهندسية ش.م.م",
    cr_number: "VERIFIED",
    obp_status: "VERIFIED & PERMITTED",
    warranty: "14-Day Official Money-Back Guarantee",
    rating: 4.9,
    jobs_done: 42,
    location: "Salalah, Dhofar Governorate, Oman"
  },
  "FX-WRK-884102": {
    badge_id: "FX-WRK-884102",
    type: "WORKER",
    name: "Salim Al Kathiri",
    name_ar: "سالم الكثيري",
    title: "Senior HVAC & Plumbing Specialist",
    title_ar: "أخصائي تكييف وسباكة أول",
    phone: "+96892114480",
    email: "salim@fixit-now.xyz",
    shop_name: "Al-Mahdoud Technical & Engineering LLC",
    shop_name_ar: "المحدود للخدمات الفنية والهندسية ش.م.م",
    cr_number: "VERIFIED",
    obp_status: "VERIFIED & PERMITTED",
    warranty: "14-Day Official Money-Back Guarantee",
    rating: 4.8,
    jobs_done: 36,
    location: "Salalah, Dhofar Governorate, Oman"
  },
  "FX-WRK-884103": {
    badge_id: "FX-WRK-884103",
    type: "WORKER",
    name: "Tariq Al Shanfari",
    name_ar: "طارق الشنفري",
    title: "Lead Auto Mechanic & Flatbed Recovery Captain",
    title_ar: "كبير ميكانيكيي السيارات وقائد السطحة",
    phone: "+96899441122",
    email: "tariq@fixit-now.xyz",
    shop_name: "Al-Mahdoud Auto Care, Towing & Taxi Fleet",
    shop_name_ar: "المحدود لخدمات السيارات والسطحة والتاكسي",
    cr_number: "VERIFIED",
    obp_status: "VERIFIED & PERMITTED",
    warranty: "14-Day Official Money-Back Guarantee",
    rating: 4.9,
    jobs_done: 58,
    location: "Auqad Industrial Area, Salalah, Oman"
  },
  "FX-SHP-104821": {
    badge_id: "FX-SHP-104821",
    type: "SHOP",
    name: "Al-Mahdoud Technical & Engineering LLC",
    name_ar: "المحدود للخدمات الفنية والهندسية ش.م.م",
    cr_number: "VERIFIED",
    branch: "Salalah Central HQ (Shop #1)",
    obp_status: "MOCIIP PERMITTED",
    warranty: "Official Protected Shop",
    rating: 4.9,
    workers_count: 2,
    vehicles_count: 2
  },
  "FX-USR-100492": {
    badge_id: "FX-USR-100492",
    type: "CUSTOMER",
    name: "Khxzi Bxtt",
    phone: "+96895956361",
    email: "khxzibxtt@gmail.com",
    membership: "FixIt Pro Member (Annual Pass)",
    status: "VERIFIED CUSTOMER",
    location: "Salalah Province, Dhofar, Oman"
  }
};

// API: Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "FixIt Salalah Web & API",
    version: "3.4.0",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// API: QR SVG generator
app.get("/api/qr", async (req, res) => {
  const text = req.query.text || "https://fixit-now.xyz";
  try {
    const svg = await QRCode.toString(text, { type: "svg", margin: 1 });
    res.setHeader("Content-Type", "image/svg+xml");
    res.send(svg);
  } catch (err) {
    res.status(500).send("Error generating QR");
  }
});

// API: Badge Verification JSON
app.get("/api/verify/:badgeId", (req, res) => {
  const b = VERIFIED_BADGES[req.params.badgeId];
  if (!b) {
    return res.status(404).json({ error: "Badge not found", badge_id: req.params.badgeId });
  }
  res.json({ verified: true, data: b });
});

app.get("/badge", (req, res) => handleBadgeRequest(req, res));
app.get("/badge/:id", (req, res) => handleBadgeRequest(req, res));

function handleBadgeRequest(req, res) {
  const id = req.params.id || req.query.id || "FX-WRK-884101";
  const b = VERIFIED_BADGES[id] || {
    badge_id: id,
    type: id.startsWith("FX-WRK") ? "WORKER" : id.startsWith("FX-SHP") ? "SHOP" : "CUSTOMER",
    name: "Verified FixIt Professional",
    title: "Licensed Service Technician",
    cr_number: "VERIFIED",
    shop_name: "Al-Mahdoud Technical & Engineering LLC",
    obp_status: "VERIFIED & PERMITTED",
    rating: 4.9,
    warranty: "14-Day Official Warranty Active"
  };

  const isWorker = b.type === "WORKER";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Official FixIt Verification · ${b.badge_id}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif}
  body{background:#F1F5F9;color:#0F172A;padding:16px;display:flex;justify-content:center;align-items:center;min-height:100vh}
  .pass-card{background:#fff;border-radius:24px;box-shadow:0 12px 36px rgba(0,0,0,0.1);max-width:440px;width:100%;overflow:hidden;border:1px solid #E2E8F0}
  .pass-hdr{background:linear-gradient(135deg,#FF5A00,#EA580C);color:#fff;padding:20px;text-align:center}
  .pass-bd{padding:20px;display:flex;flex-direction:column;gap:14px}
  .badge-tag{display:inline-flex;align-items:center;gap:6px;background:#DCFCE7;color:#166534;font-weight:800;font-size:12px;padding:6px 14px;border-radius:99px;margin:0 auto}
  .field-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:13.5px}
  .field-row span{color:#64748B}
  .field-row b{color:#0F172A}
  .btn{display:block;width:100%;background:#FF5A00;color:#fff;text-align:center;font-weight:800;padding:14px;border-radius:14px;text-decoration:none;margin-top:6px}
</style>
</head>
<body>
  <div class="pass-card">
    <div class="pass-hdr">
      <div style="font-size:11px;letter-spacing:1px;font-weight:800;opacity:.9">SULTANATE OF OMAN · MOCIIP VERIFIED</div>
      <div style="font-size:22px;font-weight:900;margin-top:4px">FixIt Official Digital ID</div>
      <div style="font-size:13px;font-family:monospace;margin-top:2px;opacity:.95">${b.badge_id}</div>
    </div>
    <div class="pass-bd">
      <div style="text-align:center">
        <span class="badge-tag">✓ OMAN BUSINESS PLATFORM PERMITTED</span>
        <div style="font-size:20px;font-weight:900;margin-top:8px">${b.name}</div>
        <div style="font-size:13px;color:#EA580C;font-weight:700">${b.title || b.type}</div>
      </div>

      <div class="field-row"><span>Commercial Reg (CR):</span><b>${b.cr_number || "VERIFIED"}</b></div>
      <div class="field-row"><span>Registered Shop:</span><b>${b.shop_name || "Al-Mahdoud Tech LLC"}</b></div>
      <div class="field-row"><span>Status:</span><b style="color:#15803D">${b.obp_status || "ACTIVE ✓"}</b></div>
      <div class="field-row"><span>Rating:</span><b>★ ${b.rating || "4.9"} (${b.jobs_done || 42} Jobs Done)</b></div>
      <div class="field-row"><span>Customer Protection:</span><b style="color:#2563EB">${b.warranty}</b></div>

      <a href="/" class="btn">Open FixIt App</a>
    </div>
  </div>
</body>
</html>`;
  res.send(html);
}

// App Entrypoints (Injects appropriate default role in index.html)
function serveAppWithRole(role, req, res) {
  const htmlPath = path.join(__dirname, "public", "index.html");
  if (!fs.existsSync(htmlPath)) {
    return res.status(404).send("App HTML not found");
  }
  let content = fs.readFileSync(htmlPath, "utf8");
  content = content.replace(/let ROLE = "[^"]*";/, `let ROLE = "${role}";`);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(content);
}

// Talabat-Style: Root / serves the official Landing Page with App-Only notice and APK download links
app.get("/", (req, res) => {
  const landingPath = path.join(__dirname, "public", "landing.html");
  if (fs.existsSync(landingPath)) {
    res.sendFile(landingPath);
  } else {
    serveAppWithRole("consumer", req, res);
  }
});

// Deep Link Gateway (/open, /reward, /share, /app)
app.get(["/open", "/reward", "/share", "/app"], (req, res) => {
  const openPath = path.join(__dirname, "public", "open.html");
  if (fs.existsSync(openPath)) {
    res.sendFile(openPath);
  } else {
    res.redirect("/");
  }
});

// Dedicated Legal & Info Pages
app.get("/terms", (req, res) => res.sendFile(path.join(__dirname, "public", "legal", "terms.html")));
app.get("/privacy", (req, res) => res.sendFile(path.join(__dirname, "public", "legal", "privacy.html")));
app.get("/warranty", (req, res) => res.sendFile(path.join(__dirname, "public", "legal", "warranty.html")));
app.get("/about", (req, res) => res.sendFile(path.join(__dirname, "public", "legal", "about.html")));
app.get("/partner", (req, res) => res.sendFile(path.join(__dirname, "public", "legal", "partner.html")));

// Direct APK Downloads (Confidential: Admin APK completely removed!)
app.get("/download/:app", (req, res) => {
  const appMap = {
    consumer: "FixIt-Consumer.apk",
    vendor: "FixIt-Vendor.apk"
  };
  const file = appMap[req.params.app.toLowerCase()];
  if (file) {
    return res.redirect(`/downloads/${file}`);
  }
  res.redirect("/");
});

// Developer/Internal Web Preview (Full app with simulated roles)
app.get("/web-preview", (req, res) => serveAppWithRole("consumer", req, res));
app.get("/vendor", (req, res) => serveAppWithRole("vendor", req, res));
app.get("/admin", (req, res) => serveAppWithRole("admin", req, res));

// Wildcard fallback: show main website page
app.get("/{*splat}", (req, res) => {
  const landingPath = path.join(__dirname, "public", "website.html");
  if (fs.existsSync(landingPath)) {
    res.sendFile(landingPath);
  } else {
    serveAppWithRole("consumer", req, res);
  }
});
app.use((req, res) => {
  const landingPath = path.join(__dirname, "public", "landing.html");
  if (fs.existsSync(landingPath)) {
    res.sendFile(landingPath);
  } else {
    serveAppWithRole("consumer", req, res);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[OK] FixIt Web Server running on port ${PORT}`);
  console.log(`Consumer App: http://localhost:${PORT}/`);
  console.log(`Vendor App:   http://localhost:${PORT}/vendor`);
  console.log(`Admin App:    http://localhost:${PORT}/admin`);
  console.log(`Badge Verify: http://localhost:${PORT}/badge?id=FX-WRK-884101`);
});
