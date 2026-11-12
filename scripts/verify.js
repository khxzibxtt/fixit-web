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
  "QR Code"
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
      assertCleanPageContent(p, html);

      if (p === "/r/SALALAH25" || p === "/reward?code=SALALAH25") {
        assert(html.includes("SALALAH25"), `${p} missing promo code SALALAH25`);
        assert(html.includes("intent://reward/SALALAH25"), `${p} missing Android intent link`);
        assert(html.includes("fixit://reward/SALALAH25"), `${p} missing fixit:// scheme link`);
        assert(html.includes("com.khxzi.fixit"), `${p} missing Android package ID`);
      }
      if (p === "/support") {
        assert(html.includes("Detected Connection"), "/support missing telemetry panel");
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

    await serverA.stop();
    serverA = null;

    // Phase B: Dedicated 429 rate-limit check
    serverB = await startServer({ TEST_RATE_MAX: "5" });
    const baseB = serverB.baseUrl;
    for (let i = 0; i < 4; i++) {
      // Note: waitForReady consumed 1 request, so 4 more reach max=5
      const okRes = await fetch(`${baseB}/api/health`);
      assert.strictEqual(okRes.status, 200, `Rate-limit warmup request ${i + 1} failed with ${okRes.status}`);
    }
    const throttledApi = await fetch(`${baseB}/api/health`);
    assert.strictEqual(throttledApi.status, 429, "Expected HTTP 429 JSON on 6th request");
    assert(throttledApi.headers.get("retry-after"), "429 response missing Retry-After header");
    const throttledJson = await throttledApi.json();
    assert.strictEqual(throttledJson.ok, false);

    const throttledHtml = await fetch(`${baseB}/`, { headers: { Accept: "text/html" } });
    assert.strictEqual(throttledHtml.status, 429, "Expected HTTP 429 HTML when Accept: text/html");
    ok("Global sliding-window HTTP 429 rate limiter (JSON & HTML) verified");

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
