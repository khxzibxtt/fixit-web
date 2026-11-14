/**
 * FixIt Background Auto-Confirm & Expiry Worker
 * Runs every 15 minutes to:
 * 1. Auto-complete orders in AWAITING_PHOTOS where After photo was uploaded >= 24 hours ago.
 * 2. Sweep expired bonus credit entries (7-day micro-rewards, 14-day streaks, 30-day VIP credits).
 *
 * ZERO AI / ZERO LLMs: Pure deterministic database RPC sweep.
 */

const { isConfigured: isSupabaseConfigured, supabaseRequest } = require("../services/supabase");

const WORKER_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes (prevents Render 15m free-tier spin-down)
let workerTimer = null;
let keepAliveTimer = null;

const monitorState = {
  startedAt: new Date().toISOString(),
  totalPings: 0,
  externalPings: 0,
  selfPings: 0,
  lastPingAt: null,
  lastPingSource: "boot",
  lastSelfPingStatus: "IDLE",
  lastWorkerRunAt: null
};

function recordMonitorPing(source = "external") {
  monitorState.totalPings += 1;
  if (source === "self") {
    monitorState.selfPings += 1;
  } else {
    monitorState.externalPings += 1;
  }
  monitorState.lastPingAt = new Date().toISOString();
  monitorState.lastPingSource = String(source || "external").slice(0, 60);
  return monitorState;
}

function getUptimeMonitorStats() {
  const mem = process.memoryUsage();
  return {
    ok: true,
    service: "fixit-web",
    plan: "free-always-on",
    uptimeSec: Math.round(process.uptime()),
    startedAt: monitorState.startedAt,
    totalPings: monitorState.totalPings,
    externalPings: monitorState.externalPings,
    selfPings: monitorState.selfPings,
    lastPingAt: monitorState.lastPingAt || monitorState.startedAt,
    lastPingSource: monitorState.lastPingSource,
    lastSelfPingStatus: monitorState.lastSelfPingStatus,
    lastWorkerRunAt: monitorState.lastWorkerRunAt,
    selfPingIntervalSec: Math.round(KEEP_ALIVE_INTERVAL_MS / 1000),
    selfPingActive: Boolean(keepAliveTimer),
    supabaseConfigured: isSupabaseConfigured(),
    memoryMb: {
      rss: Math.round((mem.rss / 1048576) * 10) / 10,
      heapUsed: Math.round((mem.heapUsed / 1048576) * 10) / 10,
      heapTotal: Math.round((mem.heapTotal / 1048576) * 10) / 10
    },
    monitorEndpoints: {
      ping: "https://fixit-now.xyz/ping",
      uptime: "https://fixit-now.xyz/api/uptime",
      health: "https://fixit-now.xyz/api/health"
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Executes one single auto-confirm and sweep cycle against Supabase.
 *
 * @returns {Promise<{ ok: boolean, autoConfirmed?: object, sweptCredits?: object, error?: string }>}
 */
async function runAutoConfirmCycle() {
  monitorState.lastWorkerRunAt = new Date().toISOString();
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured. Skipping worker cycle." };
  }

  try {
    // 1. Trigger Supabase RPC: auto_confirm_completed_orders
    const confirmRes = await supabaseRequest("/rpc/auto_confirm_completed_orders", "POST", {});
    
    // 2. Trigger Supabase RPC: sweep_expired_bonus_credits
    const sweepRes = await supabaseRequest("/rpc/sweep_expired_bonus_credits", "POST", {});

    const ok = confirmRes.ok && sweepRes.ok;
    return {
      ok,
      autoConfirmed: confirmRes.data || null,
      sweptCredits: sweepRes.data || null,
      error: ok ? undefined : (confirmRes.error || sweepRes.error)
    };
  } catch (err) {
    return {
      ok: false,
      error: err && err.message ? err.message : "Auto-confirm worker cycle failed"
    };
  }
}

async function runKeepAliveSelfPing() {
  recordMonitorPing("self");
  const targets = [
    process.env.RENDER_EXTERNAL_URL ? `${String(process.env.RENDER_EXTERNAL_URL).replace(/\/+$/, "")}/ping?src=self` : null,
    "https://fixit-now.xyz/ping?src=self",
    "https://fixit-web.onrender.com/ping?src=self"
  ].filter(Boolean);

  for (const url of targets) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": "FixIt-KeepAlive-Watchdog/1.0" },
        signal: ctrl.signal
      });
      monitorState.lastSelfPingStatus = `HTTP ${res.status} (${new URL(url).hostname})`;
      if (res.ok) break;
    } catch (err) {
      monitorState.lastSelfPingStatus = `ERR (${err && err.message ? err.message.slice(0, 40) : "timeout"})`;
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Starts the 15-minute background auto-confirm cron worker and 4-minute keep-alive pinger.
 */
function startAutoConfirmCron() {
  if (!workerTimer) {
    workerTimer = setInterval(async () => {
      try {
        await runAutoConfirmCycle();
      } catch (_) {}
    }, WORKER_INTERVAL_MS);

    if (typeof workerTimer.unref === "function") {
      workerTimer.unref();
    }
  }

  if (!keepAliveTimer && process.env.NODE_ENV !== "test") {
    keepAliveTimer = setInterval(() => {
      runKeepAliveSelfPing().catch(() => {});
    }, KEEP_ALIVE_INTERVAL_MS);

    if (typeof keepAliveTimer.unref === "function") {
      keepAliveTimer.unref();
    }
  }
}

/**
 * Stops the background auto-confirm worker and keep-alive pinger.
 */
function stopAutoConfirmCron() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

module.exports = {
  runAutoConfirmCycle,
  runKeepAliveSelfPing,
  recordMonitorPing,
  getUptimeMonitorStats,
  startAutoConfirmCron,
  stopAutoConfirmCron
};
