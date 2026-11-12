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
let workerTimer = null;

/**
 * Executes one single auto-confirm and sweep cycle against Supabase.
 *
 * @returns {Promise<{ ok: boolean, autoConfirmed?: object, sweptCredits?: object, error?: string }>}
 */
async function runAutoConfirmCycle() {
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

/**
 * Starts the 15-minute background auto-confirm cron worker.
 */
function startAutoConfirmCron() {
  if (workerTimer) return;

  workerTimer = setInterval(async () => {
    try {
      await runAutoConfirmCycle();
    } catch (_) {}
  }, WORKER_INTERVAL_MS);

  if (typeof workerTimer.unref === "function") {
    workerTimer.unref(); // Ensure timer doesn't prevent Node process termination during tests
  }
}

/**
 * Stops the background auto-confirm worker.
 */
function stopAutoConfirmCron() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}

module.exports = {
  runAutoConfirmCycle,
  startAutoConfirmCron,
  stopAutoConfirmCron
};
