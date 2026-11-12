/**
 * FixIt Pricing & Anti-Sabotage Engine
 * Pure deterministic algorithms for fee ladders, bid floor guards, SHA-256 device
 * fingerprinting, and pre-payment anti-poaching regex filters.
 *
 * All financial amounts are in Oman Rial (OMR) with 3 decimal places (e.g. 0.300 OMR = 300 bz).
 * ZERO AI / ZERO LLMs: 100% deterministic math & regular expressions.
 */

const crypto = require("crypto");

// ----------------------------------------------------------------------------
// Configurable Constants (Mirrors Supabase platform_config table)
// ----------------------------------------------------------------------------
const CONFIG = {
  // Vendor Fee Ladder Thresholds
  LADDER_TIER_1_MAX_JOBS: 5,   // 0 to 5 completed jobs
  LADDER_TIER_1_FEE: 0.010,    // 1.0% fee (Vendor keeps 99.0%)

  LADDER_TIER_2_MAX_JOBS: 15,  // 6 to 15 completed jobs
  LADDER_TIER_2_FEE: 0.050,    // 5.0% fee

  LADDER_TIER_3_MAX_JOBS: 30,  // 16 to 30 completed jobs
  LADDER_TIER_3_FEE: 0.100,    // 10.0% fee

  LADDER_TIER_4_PRO_FEE: 0.150,  // 31+ jobs with FixIt Pro active: 15.0%
  LADDER_TIER_4_FREE_FEE: 0.200, // 31+ jobs on Free tier: 20.0%

  // Bid Floor Guard
  BID_FLOOR_RATIO: 0.400, // Reject bids < 40% of recent 20-job median
  MIN_BASE_PRICE_FALLBACK: 3.000 // 3.000 OMR fallback if no history
};

/**
 * Calculates progressive vendor fee rate based on completed jobs count, Pro status,
 * and optional custom negotiated fee override.
 *
 * @param {number} completedJobsCount - Total verified completed jobs
 * @param {boolean} isPro - Whether vendor has active FixIt Pro entitlement
 * @param {number|null} [customFeeRate] - Custom negotiated fee rate (e.g. 0.08 for 8%)
 * @returns {number} applied fee rate (e.g. 0.010, 0.050, 0.100, 0.150, 0.200)
 */
function calculateProgressiveFeeRate(completedJobsCount, isPro, customFeeRate = null) {
  if (customFeeRate !== null && customFeeRate !== undefined && !Number.isNaN(Number(customFeeRate))) {
    const rate = Number(customFeeRate);
    if (rate >= 0 && rate <= 1) return Math.round(rate * 10000) / 10000;
  }

  const jobs = Math.max(0, Number.parseInt(completedJobsCount, 10) || 0);

  if (jobs <= CONFIG.LADDER_TIER_1_MAX_JOBS) {
    return CONFIG.LADDER_TIER_1_FEE; // 1%
  }
  if (jobs <= CONFIG.LADDER_TIER_2_MAX_JOBS) {
    return CONFIG.LADDER_TIER_2_FEE; // 5%
  }
  if (jobs <= CONFIG.LADDER_TIER_3_MAX_JOBS) {
    return CONFIG.LADDER_TIER_3_FEE; // 10%
  }
  return isPro ? CONFIG.LADDER_TIER_4_PRO_FEE : CONFIG.LADDER_TIER_4_FREE_FEE; // 15% or 20%
}

/**
 * Calculates deterministic platform cut and vendor payout with 3-decimal OMR precision.
 *
 * @param {number} jobAmount - Gross job amount in OMR
 * @param {number} appliedFeeRate - Snapshot fee rate on order
 * @returns {{ platformCut: number, vendorPayout: number, jobAmount: number, feeRate: number }}
 */
function calculateVendorPayout(jobAmount, appliedFeeRate) {
  const amount = Math.max(0, Math.round(Number(jobAmount) * 1000) / 1000);
  const rate = Math.max(0, Math.min(1, Number(appliedFeeRate)));
  const platformCut = Math.round(amount * rate * 1000) / 1000;
  const vendorPayout = Math.max(0, Math.round((amount - platformCut) * 1000) / 1000);

  return {
    jobAmount: amount,
    feeRate: rate,
    platformCut,
    vendorPayout
  };
}

/**
 * Deterministic statistical bid floor check.
 * Rejects bids < 40% of median of last 20 jobs (or fallback category base price).
 *
 * @param {number} proposedBid - Vendor's proposed bid in OMR
 * @param {number[]|number} medianOrHistory - Either precomputed median or array of amounts
 * @param {number} [fallbackPrice=3.000] - Category min base price
 * @returns {{ allowed: boolean, minAllowedBid: number, medianPrice: number, ratio: number, reason?: string }}
 */
function validateBidFloor(proposedBid, medianOrHistory, fallbackPrice = CONFIG.MIN_BASE_PRICE_FALLBACK) {
  const bid = Math.round(Number(proposedBid) * 1000) / 1000;
  let median = fallbackPrice;

  if (Array.isArray(medianOrHistory) && medianOrHistory.length > 0) {
    const sorted = medianOrHistory
      .map(n => Number(n))
      .filter(n => Number.isFinite(n) && n > 0)
      .sort((a, b) => a - b);
    if (sorted.length > 0) {
      const mid = Math.floor(sorted.length / 2);
      median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
  } else if (typeof medianOrHistory === "number" && medianOrHistory > 0) {
    median = medianOrHistory;
  }

  median = Math.round(median * 1000) / 1000;
  const minAllowedBid = Math.round(median * CONFIG.BID_FLOOR_RATIO * 1000) / 1000;

  if (bid < minAllowedBid) {
    return {
      allowed: false,
      proposedBid: bid,
      medianPrice: median,
      ratio: CONFIG.BID_FLOOR_RATIO,
      minAllowedBid,
      reason: `Bid too low: minimum allowed bid is ${minAllowedBid.toFixed(3)} OMR (40% of recent median ${median.toFixed(3)} OMR).`
    };
  }

  return {
    allowed: true,
    proposedBid: bid,
    medianPrice: median,
    ratio: CONFIG.BID_FLOOR_RATIO,
    minAllowedBid
  };
}

/**
 * Generates SHA-256 multi-account fingerprint from phone, Android device ID, and IP subnet.
 * Masks last octet of IPv4 (/24) or last 80 bits of IPv6 (/48) for stable subnet hashing.
 *
 * @param {string} phone - User phone number
 * @param {string} [deviceId] - Android hardware device ID or client identifier
 * @param {string} [ip] - Client IP address
 * @returns {string} SHA-256 hexadecimal hash
 */
function generateDeviceFingerprint(phone, deviceId = "", ip = "") {
  const cleanPhone = String(phone || "").replace(/[^0-9]/g, "");
  const cleanDeviceId = String(deviceId || "").trim().toLowerCase();

  // Normalize IP to subnet (/24 for IPv4, /48 for IPv6)
  let subnet = "0.0.0.0";
  const cleanIp = String(ip || "").trim();
  if (cleanIp.includes(".")) {
    const parts = cleanIp.split(".");
    subnet = parts.slice(0, 3).join(".") + ".0";
  } else if (cleanIp.includes(":")) {
    const parts = cleanIp.split(":");
    subnet = parts.slice(0, 3).join(":") + "::";
  }

  const rawSeed = `${cleanPhone}|${cleanDeviceId}|${subnet}`;
  return crypto.createHash("sha256").update(rawSeed, "utf8").digest("hex");
}

/**
 * Anti-Poach Chat & Message Filter.
 * Before an order is in 'ACTIVE_PAID' status, blocks phone numbers, Arabic numerals,
 * spelled out digit words, and WhatsApp strings to prevent disintermediation.
 *
 * @param {string} messageText - The user or vendor chat text
 * @param {string} orderStatus - Current order status
 * @returns {{ cleanText: string, intercepted: boolean, reason?: string }}
 */
function sanitizePrePaymentChat(messageText, orderStatus = "OPEN") {
  const isPaid = (orderStatus === "ACTIVE_PAID" || orderStatus === "IN_PROGRESS" || orderStatus === "AWAITING_PHOTOS" || orderStatus === "COMPLETED");
  if (isPaid) {
    return { cleanText: messageText, intercepted: false };
  }

  const text = String(messageText || "");
  let intercepted = false;

  // Patterns for Omani phone numbers: 9xxxxxxx, 7xxxxxxx, +968, 00968, spaced digits
  const OMAN_PHONE_REGEX = /(?:\+?968\s*|00968\s*)?[97]\s*\d\s*\d\s*\d\s*\d\s*\d\s*\d\s*\d/g;
  
  // Generic 8+ consecutive digits
  const GENERIC_DIGITS_REGEX = /\b\d[\d\s\-\.]{6,}\d\b/g;

  // Eastern Arabic numerals (٠-٩)
  const ARABIC_NUMERALS_REGEX = /[٠-٩]{6,}/g;

  // WhatsApp variations & direct links
  const WHATSAPP_REGEX = /(?:whatsapp|what's\s*app|whats\s*app|واتساب|واتس|wa\.me|api\.whatsapp\.com)/gi;

  // Number words in English / Arabic (e.g. "nine five nine...", "تسعة خمسة...")
  const NUMBER_WORDS_REGEX = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine)\s+(?:zero|one|two|three|four|five|six|seven|eight|nine)\s+(?:zero|one|two|three|four|five|six|seven|eight|nine)\b/gi;
  const ARABIC_WORDS_REGEX = /(?:صفر|واحد|اثنان|ثلاثة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة)\s+(?:صفر|واحد|اثنان|ثلاثة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة)\s+(?:صفر|واحد|اثنان|ثلاثة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة)/g;

  let sanitized = text;

  if (OMAN_PHONE_REGEX.test(sanitized)) {
    intercepted = true;
    sanitized = sanitized.replace(OMAN_PHONE_REGEX, "[Contact hidden until Protected Job Pay is placed]");
  }
  if (GENERIC_DIGITS_REGEX.test(sanitized)) {
    intercepted = true;
    sanitized = sanitized.replace(GENERIC_DIGITS_REGEX, "[Contact hidden until Protected Job Pay is placed]");
  }
  if (ARABIC_NUMERALS_REGEX.test(sanitized)) {
    intercepted = true;
    sanitized = sanitized.replace(ARABIC_NUMERALS_REGEX, "[رقم الهاتف محجوب حتى تأكيد الدفع المحمي]");
  }
  if (WHATSAPP_REGEX.test(sanitized)) {
    intercepted = true;
    sanitized = sanitized.replace(WHATSAPP_REGEX, "[WhatsApp blocked pre-payment]");
  }
  if (NUMBER_WORDS_REGEX.test(sanitized)) {
    intercepted = true;
    sanitized = sanitized.replace(NUMBER_WORDS_REGEX, "[Spelled number blocked]");
  }
  if (ARABIC_WORDS_REGEX.test(sanitized)) {
    intercepted = true;
    sanitized = sanitized.replace(ARABIC_WORDS_REGEX, "[أرقام نصية محجوبة قبل الدفع]");
  }

  return {
    cleanText: sanitized,
    intercepted,
    reason: intercepted ? "Direct contact information is blocked until Protected Job Pay is secured." : undefined
  };
}

module.exports = {
  CONFIG,
  calculateProgressiveFeeRate,
  calculateVendorPayout,
  validateBidFloor,
  generateDeviceFingerprint,
  sanitizePrePaymentChat
};
