/**
 * Sliding-window in-memory rate limiter middleware.
 * Prevents request floods (e.g. 10k req/min) with automatic stale bucket cleanup.
 */

const stores = new Map();

function getClientIp(req) {
  const cf = req.headers["cf-connecting-ip"];
  const xff = req.headers["x-forwarded-for"];
  const xri = req.headers["x-real-ip"];
  const raw = cf || (typeof xff === "string" ? xff.split(",")[0] : "") || xri || req.ip || (req.socket && req.socket.remoteAddress) || "unknown";
  return String(raw).trim().replace(/^::ffff:/, "");
}

function createRateLimiter({
  name = "global",
  windowMs = 60000,
  max = 120,
  message = "Too many requests. Please slow down.",
  keyGenerator = null
} = {}) {
  const buckets = new Map();
  stores.set(name, buckets);

  const sweepTimer = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, timestamps] of buckets.entries()) {
      const fresh = timestamps.filter(ts => ts > cutoff);
      if (fresh.length === 0) buckets.delete(key);
      else buckets.set(key, fresh);
    }
  }, Math.max(15000, windowMs));
  if (typeof sweepTimer.unref === "function") sweepTimer.unref();

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const key = String((typeof keyGenerator === "function" ? keyGenerator(req) : getClientIp(req)) || getClientIp(req));
    const cutoff = now - windowMs;
    const prev = buckets.get(key) || [];
    const active = prev.filter(ts => ts > cutoff);

    if (active.length >= max) {
      const oldest = active[0] || now;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      res.setHeader("RateLimit-Limit", String(max));
      res.setHeader("RateLimit-Remaining", "0");
      res.setHeader("RateLimit-Reset", String(retryAfterSec));

      if (req.path.startsWith("/api/") || (req.headers.accept && req.headers.accept.includes("application/json"))) {
        return res.status(429).json({
          ok: false,
          error: message,
          limiter: name,
          retryAfterSec
        });
      }
      return res.status(429).type("html").send(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>429 Too Many Requests | FixIt</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#F8FAFC;color:#0F172A;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}.card{max-width:440px;background:#fff;border:1px solid #E2E8F0;border-radius:18px;padding:28px;text-align:center}h1{margin:0 0 8px;color:#FF5A00}p{color:#475569;line-height:1.5}</style></head><body><div class="card"><h1>Rate Limit Reached</h1><p>${message}</p><p>Retry in ${retryAfterSec}s.</p></div></body></html>`
      );
    }

    active.push(now);
    buckets.set(key, active);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - active.length)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
    return next();
  };
}

module.exports = {
  createRateLimiter,
  getClientIp
};
