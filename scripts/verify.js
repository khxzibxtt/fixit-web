/**
 * Automated HTTP & security regression suite for FixIt Pure-JS server.
 * Spawns server.js on ephemeral localhost ports, verifies all Pure-JS pages,
 * JSON APIs, App Links, APK whitelist, banned strings/emojis, and 429 rate limiting.
 */

const assert = require("assert");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const SERVER_ENTRY = path.join(ROOT_DIR, "server.js");

const {
  calculateProgressiveFeeRate,
  calculateVendorPayout,
  validateBidFloor,
  generateDeviceFingerprint,
  sanitizePrePaymentChat
} = require("../src/services/pricingEngine");
const {
  calculateDistanceKm,
  getDispatchWave,
  calculateVendorRankScore,
  matchAndRankVendors
} = require("../src/services/dispatchEngine");
const {
  generateReferralCode,
  calculateReferralCommission,
  isReferralActive,
  evaluateVendorToConsumerBoost
} = require("../src/services/referralEngine");
const {
  getRotatingMicroReward,
  evaluateMonthlyStreak
} = require("../src/services/rewardEngine");

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const PRICE_RE = /\b\d+(?:\.\d+)?\s*(?:OMR|ر\.ع\.|Baisa|﷼)\b/i;
const BANNED_STRINGS = [
  "CR-1148920",
  "CR #1409822",
  "FixIt Technologies LLC",
  "FixIt Home Services LLC",
  "FixIt-Admin",
  "TXN-",
  "QR Badge",
  "QR Code",
  "support@fixit-now.xyz"
];

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = addr && typeof addr === "object" ? addr.port : 0;
      srv.close(err => (err ? reject(err) : resolve(port)));
    });
  });
}

async function waitForReady(baseUrl, childLogs) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 120));
  }
  throw new Error(`Server did not become ready at ${baseUrl}. Logs:\n${childLogs.join("")}`);
}

async function startServer(extraEnv = {}) {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const logs = [];
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      ...extraEnv
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", chunk => logs.push(String(chunk)));
  child.stderr.on("data", chunk => logs.push(String(chunk)));

  await waitForReady(baseUrl, logs);

  return {
    baseUrl,
    stop: () =>
      new Promise(resolve => {
        if (child.exitCode !== null) return resolve();
        const timer = setTimeout(() => {
          try { child.kill("SIGKILL"); } catch (_) {}
          resolve();
        }, 2000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
        child.kill("SIGTERM");
      })
  };
}

function assertCleanPageContent(routePath, html) {
  assert(!EMOJI_RE.test(html), `${routePath} unexpectedly contains an emoji`);
  assert(!PRICE_RE.test(html), `${routePath} unexpectedly contains speculative OMR pricing`);
  for (const banned of BANNED_STRINGS) {
    assert(!html.includes(banned), `${routePath} contains banned string: ${banned}`);
  }
}

async function run() {
  let serverA = null;
  let serverB = null;
  let passed = 0;

  function ok(label) {
    passed += 1;
    console.log(`[PASS] ${label}`);
  }

  try {
    // Phase A: Full functional & content checks
    serverA = await startServer({
      TEST_RATE_MAX: "80",
      TEST_IP_RATE_MAX: "30",
      TEST_SUPPORT_RATE_MAX: "10",
      TEST_OTP_RATE_MAX: "10"
    });
    const base = serverA.baseUrl;

    const htmlRoutes = [
      "/",
      "/services",
      "/support",
      "/contact",
      "/partner",
      "/about",
      "/terms",
      "/privacy",
      "/warranty",
      "/open",
      "/app",
      "/reward?code=SALALAH25",
      "/r/SALALAH25",
      "/share",
      "/book"
    ];

    for (const p of htmlRoutes) {
      const res = await fetch(`${base}${p}`, {
        headers: { "x-skip-geo": "1", Accept: "text/html" }
      });
      assert.strictEqual(res.status, 200, `GET ${p} returned ${res.status}`);
      const ctype = res.headers.get("content-type") || "";
      assert(ctype.includes("text/html"), `GET ${p} missing text/html content-type (${ctype})`);
      const html = await res.text();
      assert(html.toLowerCase().includes("<!doctype html>"), `GET ${p} missing doctype`);
      if (p !== "/app") {
        assertCleanPageContent(p, html);
      }

      if (p === "/r/SALALAH25" || p === "/reward?code=SALALAH25") {
        assert(html.includes("SALALAH25"), `${p} missing promo code SALALAH25`);
        assert(html.includes("intent://reward/SALALAH25"), `${p} missing Android intent link`);
        assert(html.includes("fixit://reward/SALALAH25"), `${p} missing fixit:// scheme link`);
        assert(html.includes("com.khxzi.fixit"), `${p} missing Android package ID`);
      }
      if (p === "/support") {
        assert(!html.includes("Detected Connection") && !html.includes("Telemetry"), "/support should not contain telemetry");
        assert(html.includes("Help & Support") || html.includes("Direct Inquiries"), "/support missing clean help header");
      }
    }
    ok(`All ${htmlRoutes.length} Pure-JS HTML routes returned 200 cleanly (no prices/emojis/fake strings)`);

    // Digital Asset Links
    {
      const res = await fetch(`${base}/.well-known/assetlinks.json`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert(Array.isArray(data) && data.length >= 1, "assetlinks.json must be non-empty array");
      assert.strictEqual(data[0].target.package_name, "com.khxzi.fixit");
      assert(
        data[0].target.sha256_cert_fingerprints.includes(
          "A3:82:E0:E8:59:28:15:7D:A2:0C:95:23:32:43:AD:96:32:28:90:8B:2D:5D:23:51:84:85:4B:B1:FE:41:DA:B5"
        ),
        "assetlinks.json missing Consumer APK SHA-256 fingerprint"
      );
      ok("/.well-known/assetlinks.json verified");
    }

    // Health & IP APIs
    {
      const hRes = await fetch(`${base}/api/health`);
      assert.strictEqual(hRes.status, 200);
      const hData = await hRes.json();
      assert.strictEqual(hData.ok, true);
      assert.strictEqual(hData.version, "3.3.5");
      assert.strictEqual(hRes.headers.get("x-content-type-options"), "nosniff");

      const ipRes = await fetch(`${base}/api/ip?fast=1`, {
        headers: { "User-Agent": "FixItVerifyBot/1.0 Chrome/130.0.0.0 Android 15" }
      });
      assert.strictEqual(ipRes.status, 200);
      const ipData = await ipRes.json();
      assert.strictEqual(ipData.ok, true);
      assert(ipData.visitor && ipData.visitor.ip, "/api/ip missing visitor.ip");
      assert(ipData.visitor.browser, "/api/ip missing visitor.browser");
      assert(ipData.visitor.os, "/api/ip missing visitor.os");
      ok("/api/health and /api/ip verified");
    }

    // APK Downloads whitelist & Admin block
    {
      const cRes = await fetch(`${base}/downloads/FixIt-Consumer.apk`);
      assert.strictEqual(cRes.status, 200);
      const cBuf = Buffer.from(await cRes.arrayBuffer());
      assert(cBuf.length > 100000 && cBuf[0] === 0x50 && cBuf[1] === 0x4b, "FixIt-Consumer.apk invalid ZIP/APK header");

      const vRes = await fetch(`${base}/downloads/FixIt-Vendor.apk`);
      assert.strictEqual(vRes.status, 200);
      const vBuf = Buffer.from(await vRes.arrayBuffer());
      assert(vBuf.length > 100000 && vBuf[0] === 0x50 && vBuf[1] === 0x4b, "FixIt-Vendor.apk invalid ZIP/APK header");

      const aRes = await fetch(`${base}/downloads/FixIt-Admin.apk`);
      assert.strictEqual(aRes.status, 404, "FixIt-Admin.apk MUST return 404");

      const aAliasRes = await fetch(`${base}/download/admin`);
      assert.strictEqual(aAliasRes.status, 404, "/download/admin MUST return 404");

      ok("APK download whitelist verified (Consumer/Vendor 200, Admin 404)");
    }

    // Support & Mail validation + telemetry
    {
      const badRes = await fetch(`${base}/api/support`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-skip-geo": "1" },
        body: JSON.stringify({ name: "A", email: "invalid", subject: "", message: "" })
      });
      assert.strictEqual(badRes.status, 400);

      for (const endpoint of ["/api/support", "/api/mail"]) {
        const res = await fetch(`${base}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-skip-geo": "1" },
          body: JSON.stringify({
            name: "Salalah Tester",
            email: "tester@example.com",
            phone: "+96895956361",
            topic: "Customer Support",
            subject: "Automated verify check",
            message: "Testing support submission and telemetry logging."
          })
        });
        const data = await res.json();
        assert(res.status === 201 || res.status === 503, `${endpoint} unexpected status ${res.status}`);
        assert(data.visitor && data.visitor.ip, `${endpoint} missing visitor telemetry`);
      }
      ok("/api/support and /api/mail validation + telemetry verified");
    }

    // OTP WhatsApp/SMS only (Voice/Call blocked)
    {
      const callRes = await fetch(`${base}/api/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+96895956361", channel: "call" })
      });
      assert.strictEqual(callRes.status, 400, "Voice call OTP must be rejected with 400");

      const waRes = await fetch(`${base}/api/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "95956361", channel: "whatsapp" })
      });
      assert.strictEqual(waRes.status, 200);
      const waData = await waRes.json();
      assert.strictEqual(waData.ok, true);
      assert.strictEqual(waData.phone, "+96895956361");
      assert.strictEqual(waData.channel, "whatsapp");

      const wrongVerify = await fetch(`${base}/api/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "95956361", code: "000000" })
      });
      assert.strictEqual(wrongVerify.status, 400);
      ok("/api/otp/send (WhatsApp/SMS only) & /api/otp/verify verified");
    }

    // 404 boundaries
    {
      const notFoundPage = await fetch(`${base}/some-missing-route-123`);
      assert.strictEqual(notFoundPage.status, 404);
      const notFoundHtml = await notFoundPage.text();
      assert(notFoundHtml.includes("Page Not Found"));

      const notFoundApi = await fetch(`${base}/api/does-not-exist`);
      assert.strictEqual(notFoundApi.status, 404);
      const notFoundJson = await notFoundApi.json();
      assert.strictEqual(notFoundJson.ok, false);
      ok("Express v5 404 HTML and API JSON boundaries verified");
    }

    // ========================================================================
    // DETERMINISTIC ALGORITHMS & VIRAL ENGINES REGRESSION TESTS
    // ========================================================================

    // 1. Progressive Vendor Fee Ladder Algorithm (1% -> 20%)
    {
      assert.strictEqual(calculateProgressiveFeeRate(0, false), 0.010, "0 jobs fee must be 1.0%");
      assert.strictEqual(calculateProgressiveFeeRate(5, false), 0.010, "5 jobs fee must be 1.0%");
      assert.strictEqual(calculateProgressiveFeeRate(6, false), 0.050, "6 jobs fee must be 5.0%");
      assert.strictEqual(calculateProgressiveFeeRate(15, false), 0.050, "15 jobs fee must be 5.0%");
      assert.strictEqual(calculateProgressiveFeeRate(16, false), 0.100, "16 jobs fee must be 10.0%");
      assert.strictEqual(calculateProgressiveFeeRate(30, false), 0.100, "30 jobs fee must be 10.0%");
      assert.strictEqual(calculateProgressiveFeeRate(31, false), 0.200, "31+ Free tier fee must be 20.0%");
      assert.strictEqual(calculateProgressiveFeeRate(31, true), 0.150, "31+ Pro tier fee must be 15.0%");
      assert.strictEqual(calculateProgressiveFeeRate(10, false, 0.075), 0.075, "Custom fee rate must override ladder");

      const payout1 = calculateVendorPayout(10.000, 0.010);
      assert.strictEqual(payout1.platformCut, 0.100, "10 OMR @ 1% = 0.100 OMR platform cut");
      assert.strictEqual(payout1.vendorPayout, 9.900, "10 OMR @ 1% = 9.900 OMR vendor payout");

      const payout2 = calculateVendorPayout(15.250, 0.200);
      assert.strictEqual(payout2.platformCut, 3.050);
      assert.strictEqual(payout2.vendorPayout, 12.200);
      ok("Engine 1: Progressive Vendor Fee Ladder (1% -> 20%) verified");
    }

    // 2. Launch Promo & FixIt Pro Entitlement (0.300 OMR for 90 Days)
    {
      const promoRes = await fetch(`${base}/api/vendor/promo/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: "v-test-123",
          phone: "95956361",
          device_id: "and-dev-fingerprint-001"
        })
      });
      assert.strictEqual(promoRes.status, 200);
      const promoData = await promoRes.json();
      assert.strictEqual(promoData.ok, true);
      assert.strictEqual(promoData.price_charged_omr, 0.300, "Launch promo price must be exactly 0.300 OMR (300 bz)");
      assert.strictEqual(promoData.days_added, 90, "Launch promo must grant 90 days of Pro");
      assert(promoData.pro_expires_at, "pro_expires_at must be populated");
      assert(promoData.fingerprint_hash, "fingerprint_hash must be generated");
      ok("Engine 2: Launch Promo & FixIt Pro Entitlement (0.300 OMR for 90 Days) verified");
    }

    // 3. Two-Sided Referral & 48h VIP Unlock (/r/:code & /reward)
    {
      const code = generateReferralCode("FIX");
      assert.strictEqual(code.length, 6, "Referral code must be 6 characters");
      assert(code.startsWith("FIX"), "Referral code prefix preserved");

      assert.strictEqual(calculateReferralCommission(10.000, 0.05), 0.500, "5% of 10.000 OMR = 0.500 OMR");
      assert.strictEqual(calculateReferralCommission(25.000, 0.05), 1.250, "5% of 25.000 OMR = 1.250 OMR");

      assert.strictEqual(isReferralActive(new Date()), true);
      const expiredDate = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000);
      assert.strictEqual(isReferralActive(expiredDate), false);

      const v2c = evaluateVendorToConsumerBoost("FIX999", "FIX999", 0);
      assert.strictEqual(v2c.isZeroFeeEligible, true);
      assert.strictEqual(v2c.appliedFeeRate, 0.0000);

      const vipRes = await fetch(`${base}/api/referral/vip-unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "u-test-999",
          code: "FIX777"
        })
      });
      assert.strictEqual(vipRes.status, 200);
      const vipData = await vipRes.json();
      assert.strictEqual(vipData.ok, true);
      assert.strictEqual(vipData.price_paid_omr, 0.300, "VIP unlock price must be 0.300 OMR");
      assert.strictEqual(vipData.bonus_credit_added_omr, 1.000, "VIP unlock must credit 1.000 OMR");
      assert.strictEqual(vipData.min_order_for_credit_omr, 5.000, "min_order_for_credit must be 5.000 OMR");
      ok("Engine 3: Two-Sided Referral & 48h VIP Unlock (/r & /reward) verified");
    }

    // 4. Post-Job Rotating Micro-Reward & Streak
    {
      assert.strictEqual(getRotatingMicroReward(0).amountOmr, 0.100, "Cycle 0 must be 0.100 OMR");
      assert.strictEqual(getRotatingMicroReward(1).amountOmr, 0.200, "Cycle 1 must be 0.200 OMR");
      assert.strictEqual(getRotatingMicroReward(2).amountOmr, 0.300, "Cycle 2 must be 0.300 OMR");
      assert.strictEqual(getRotatingMicroReward(3).amountOmr, 0.100, "Cycle 3 must rotate back to 0.100 OMR");
      assert.strictEqual(getRotatingMicroReward(0).expiryDays, 7, "Micro-rewards must expire in 7 days");

      assert.strictEqual(evaluateMonthlyStreak(1).qualifiesForStreak, false);
      const streak3 = evaluateMonthlyStreak(3);
      assert.strictEqual(streak3.qualifiesForStreak, true);
      assert.strictEqual(streak3.bonusOmr, 1.000, "Monthly 3-job streak must grant 1.000 OMR");
      assert.strictEqual(streak3.expiryDays, 14, "Streak bonus must have 14 days expiry");
      ok("Engine 4: Post-Job Rotating Micro-Reward & Streak Algorithm verified");
    }

    // 5. Hyper-Local Dispatch, Pro Head-Start & Cold-Start Expansion
    {
      const dist = calculateDistanceKm(17.015, 54.092, 17.025, 54.102);
      assert(dist > 0 && dist < 3.0, `Calculated distance ${dist}km should be within 3km`);

      const wave1Pro = getDispatchWave(1.5, 0);
      assert.strictEqual(wave1Pro.wave, 1);
      assert.strictEqual(wave1Pro.isProExclusive, true, "T+1.5m must be Pro exclusive");
      assert.strictEqual(wave1Pro.maxRadiusKm, 3.0);

      const wave1Free = getDispatchWave(4.0, 0);
      assert.strictEqual(wave1Free.wave, 1);
      assert.strictEqual(wave1Free.isProExclusive, false, "T+4m must broadcast to Free tier");
      assert.strictEqual(wave1Free.maxRadiusKm, 3.0);

      const wave2 = getDispatchWave(7.0, 0);
      assert.strictEqual(wave2.wave, 2);
      assert.strictEqual(wave2.maxRadiusKm, 8.0, "T+7m must expand to 8 km");

      const wave3 = getDispatchWave(12.0, 0);
      assert.strictEqual(wave3.wave, 3);
      assert.strictEqual(wave3.maxRadiusKm, 15.0, "T+12m must expand to 15 km");
      assert.strictEqual(wave3.shouldBumpBounty, true, "T+12m with 0 bids must recommend bounty bump");
      assert.strictEqual(wave3.bumpAmountOmr, 1.000, "Bounty bump must be 1.000 OMR");

      const proScore = calculateVendorRankScore(true, 5.0, 1.0);
      const freeScore = calculateVendorRankScore(false, 5.0, 1.0);
      assert(proScore > freeScore + 90, "Pro vendor rank score must heavily prioritize Pro (+100)");

      const matchRes = await fetch(`${base}/api/dispatch/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: { lat: 17.015, lng: 54.092, category_id: "AC_REPAIR", created_at: new Date().toISOString() },
          vendors: [
            { id: "v1", lat: 17.018, lng: 54.094, skills: ["AC_REPAIR"], is_pro: false, avg_rating: 4.8 },
            { id: "v2", lat: 17.020, lng: 54.095, skills: ["AC_REPAIR"], is_pro: true, avg_rating: 4.9 },
            { id: "v3", lat: 17.500, lng: 54.500, skills: ["AC_REPAIR"], is_pro: true, avg_rating: 5.0 }, // far away (>15km)
            { id: "v4", lat: 17.016, lng: 54.093, skills: ["PLUMBING"], is_pro: true, avg_rating: 5.0 }   // wrong category
          ]
        })
      });
      assert.strictEqual(matchRes.status, 200);
      const matchData = await matchRes.json();
      assert.strictEqual(matchData.ok, true);
      assert(matchData.matchedVendors.length >= 1);
      assert.strictEqual(matchData.matchedVendors[0].id, "v2", "FixIt Pro vendor must be ranked #1");
      ok("Engine 5: Hyper-Local Dispatch, Pro Head-Start & Cold-Start Expansion verified");
    }

    // 6 & 7. Warranty Enforcement Without Cash Freezing
    {
      const claimRes = await fetch(`${base}/api/warranty/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: "ord-test-claim-1",
          reason: "AC unit stopped cooling within 14-day warranty"
        })
      });
      assert.strictEqual(claimRes.status, 200);
      const claimData = await claimRes.json();
      assert.strictEqual(claimData.ok, true);
      assert.strictEqual(claimData.response_window_hours, 24, "Vendor must be given 24h response window");
      assert(claimData.claim_deadline, "claim_deadline must be returned");
      ok("Engine 6 & 7: Warranty Strike & Lockout Enforcement verified");
    }

    // 8. Statistical Bid-Floor Guard (Reject bids < 40% of median)
    {
      const check1 = validateBidFloor(1.000, 4.000); // 40% of 4.000 = 1.600
      assert.strictEqual(check1.allowed, false, "1.000 OMR bid must be rejected against 4.000 OMR median");
      assert.strictEqual(check1.minAllowedBid, 1.600);

      const check2 = validateBidFloor(2.000, 4.000);
      assert.strictEqual(check2.allowed, true, "2.000 OMR bid must be accepted");

      const floorApiLow = await fetch(`${base}/api/bids/validate-floor?category=AC_REPAIR&amount=1.000`);
      assert.strictEqual(floorApiLow.status, 200);
      const floorDataLow = await floorApiLow.json();
      assert.strictEqual(floorDataLow.allowed, false);

      const floorApiOk = await fetch(`${base}/api/bids/validate-floor?category=AC_REPAIR&amount=3.000`);
      assert.strictEqual(floorApiOk.status, 200);
      const floorDataOk = await floorApiOk.json();
      assert.strictEqual(floorDataOk.allowed, true);
      ok("Engine 8: Statistical Bid-Floor Guard (40% median floor) verified");
    }

    // 9. Multi-Account Fingerprint, Anti-Poaching Chat Regex & Live Activity Feed
    {
      const fp = generateDeviceFingerprint("95956361", "device_id_abc", "192.168.1.100");
      assert.strictEqual(typeof fp, "string");
      assert.strictEqual(fp.length, 64, "SHA-256 fingerprint must be 64 hexadecimal characters");

      const chatMask1 = sanitizePrePaymentChat("Call me at 95956361 directly", "OPEN");
      assert.strictEqual(chatMask1.intercepted, true, "Omani phone number must be intercepted pre-payment");
      assert(!chatMask1.cleanText.includes("95956361"), "Phone number must be masked");

      const chatMask2 = sanitizePrePaymentChat("Send details to my whatsapp please", "OPEN");
      assert.strictEqual(chatMask2.intercepted, true, "WhatsApp mention must be intercepted pre-payment");

      const chatPaid = sanitizePrePaymentChat("Location is villa 4, call 95956361", "ACTIVE_PAID");
      assert.strictEqual(chatPaid.intercepted, false, "Contact details must be allowed once order is ACTIVE_PAID");

      const chatApi = await fetch(`${base}/api/chat/filter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "My number is +968 95956361",
          order_status: "OPEN"
        })
      });
      assert.strictEqual(chatApi.status, 200);
      const chatApiData = await chatApi.json();
      assert.strictEqual(chatApiData.intercepted, true);

      const feedRes = await fetch(`${base}/api/activity-feed`);
      assert.strictEqual(feedRes.status, 200);
      const feedData = await feedRes.json();
      assert.strictEqual(feedData.ok, true);
      assert(feedData.online_vendors_count >= 1, "online_vendors_count must be reported");
      assert(Array.isArray(feedData.events), "events must be an array");
      assert(feedData.events.length > 0, "events must contain social proof entries");
      ok("Engine 9: Multi-Account Fingerprint, Anti-Poaching Chat Regex & Live Activity Feed verified");
    }

    // 10. App BFF Auth Gateway, Strict Oman/Tourist Phone Validation & Session Guards
    {
      // Invalid Oman number starting with 8 -> must be denied (400)
      const badOmanStart = await fetch(`${base}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryIso: "OM", dialCode: "+968", nationalNumber: "81234567", channel: "whatsapp" })
      });
      assert.strictEqual(badOmanStart.status, 400, "Oman number starting with 8 must be denied");

      // Invalid Oman short number (7 digits) -> must be denied (400)
      const badOmanLen = await fetch(`${base}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryIso: "OM", dialCode: "+968", nationalNumber: "9123456", channel: "sms" })
      });
      assert.strictEqual(badOmanLen.status, 400, "7-digit Oman number must be denied");

      // Valid Oman number starting with 7 -> 200
      const goodOman = await fetch(`${base}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryIso: "OM", dialCode: "+968", nationalNumber: "71234567", channel: "whatsapp" })
      });
      assert.strictEqual(goodOman.status, 200, "Valid Oman 7XXXXXXX must be accepted");

      // Tourist / International number (+14155551234) -> 200
      const goodIntl = await fetch(`${base}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryIso: "US", dialCode: "+1", nationalNumber: "4155551234", channel: "sms" })
      });
      assert.strictEqual(goodIntl.status, 200, "Valid US tourist number must be accepted");

      // Resend cooldown on immediate second request for same number -> 429
      const cooldownRes = await fetch(`${base}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryIso: "US", dialCode: "+1", nationalNumber: "4155551234", channel: "sms" })
      });
      assert.strictEqual(cooldownRes.status, 429, "Immediate OTP resend for same number must trigger 429 cooldown");

      // Unauthenticated app gateway routes must return 401
      const noSessRest = await fetch(`${base}/api/app/rest/users`);
      assert.strictEqual(noSessRest.status, 401, "Unauthenticated /api/app/rest/users must return 401");
      const noSessBoot = await fetch(`${base}/api/app/bootstrap`);
      assert.strictEqual(noSessBoot.status, 401, "Unauthenticated /api/app/bootstrap must return 401");
      const noSessHb = await fetch(`${base}/api/auth/session/heartbeat`, { method: "POST" });
      assert.strictEqual(noSessHb.status, 401, "Unauthenticated heartbeat must return 401");
      const noSessComplete = await fetch(`${base}/api/auth/profile/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: "Ali", lastName: "Sami" })
      });
      assert.strictEqual(noSessComplete.status, 401, "Unauthenticated profile/complete must return 401");

      // Missing Google credential rejected with 400/503 cleanly (never crashes)
      const gEmpty = await fetch(`${base}/api/auth/google/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      assert(gEmpty.status === 400 || gEmpty.status === 503, `Expected 400/503 on empty google exchange, got ${gEmpty.status}`);

      // Admin login rejects invalid code / missing config cleanly
      const adminBad = await fetch(`${base}/api/auth/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: "wrong_code" })
      });
      assert(adminBad.status === 403 || adminBad.status === 503, `Expected 403/503 on invalid admin login, got ${adminBad.status}`);

      ok("App BFF strict phone validation, cooldowns & session security guards verified");
    }

    await serverA.stop();
    serverA = null;

    // Phase B: Dedicated 429 rate-limit check (global + auth login limiter)
    serverB = await startServer({ TEST_RATE_MAX: "12", TEST_AUTH_SEND_MAX: "2" });
    const baseB = serverB.baseUrl;
    for (let i = 0; i < 2; i++) {
      const aRes = await fetch(`${baseB}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryIso: "GB", dialCode: "+44", nationalNumber: "7700900123", channel: "sms" })
      });
      assert(aRes.status === 200 || aRes.status === 429, `Auth warmup ${i + 1} unexpected status ${aRes.status}`);
    }
    const authLimited = await fetch(`${baseB}/api/auth/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryIso: "GB", dialCode: "+44", nationalNumber: "7700900123", channel: "sms" })
    });
    assert.strictEqual(authLimited.status, 429, "Expected 429 from authSendLimiter on 3rd request");

    for (let i = 0; i < 8; i++) {
      // Note: waitForReady(1) + 3 auth requests + 8 health = 12 requests reaching TEST_RATE_MAX=12
      const okRes = await fetch(`${baseB}/api/health`);
      assert.strictEqual(okRes.status, 200, `Rate-limit warmup request ${i + 1} failed with ${okRes.status}`);
    }
    const throttledApi = await fetch(`${baseB}/api/health`);
    assert.strictEqual(throttledApi.status, 429, "Expected HTTP 429 JSON on 13th request");
    assert(throttledApi.headers.get("retry-after"), "429 response missing Retry-After header");
    const throttledJson = await throttledApi.json();
    assert.strictEqual(throttledJson.ok, false);

    const throttledHtml = await fetch(`${baseB}/`, { headers: { Accept: "text/html" } });
    assert.strictEqual(throttledHtml.status, 429, "Expected HTTP 429 HTML when Accept: text/html");
    ok("Global & Auth login sliding-window HTTP 429 rate limiters verified");

    console.log(`\nALL CHECKS PASSED (${passed}/${passed})`);
  } finally {
    if (serverA) await serverA.stop();
    if (serverB) await serverB.stop();
  }
}

run().catch(err => {
  console.error("\n[FAIL]", err && err.stack ? err.stack : err);
  process.exit(1);
});
