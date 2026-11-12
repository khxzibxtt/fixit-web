/**
 * FixIt Two-Sided Referral & Viral VIP Engine
 * Handles deep links (/r/:code, /reward), 6-character unique codes, 48h VIP Unlock
 * (0.300 OMR -> 30d Pro + 1.000 OMR bonus with min_order = 5.000 OMR),
 * 5% passive commission (90 days), Vendor-to-Vendor +15d Pro, and Vendor-to-Consumer 0% fee.
 *
 * All financial amounts in Oman Rial (OMR, 3 decimals).
 * ZERO AI / ZERO LLMs: Pure deterministic logic.
 */

const crypto = require("crypto");

const REFERRAL_CONFIG = {
  VIP_PRICE_OMR: 0.300,        // 0.300 OMR = 300 bz upfront unlock
  VIP_PRO_DAYS: 30,            // 30 days of Pro/Plus
  VIP_BONUS_CREDIT_OMR: 1.000, // 1.000 OMR bonus credit
  MIN_ORDER_FOR_CREDIT_OMR: 5.000, // 5.000 OMR minimum order threshold to redeem credit
  REV_SHARE_RATE: 0.050,       // 5% passive commission
  REV_SHARE_WINDOW_DAYS: 90,   // 90 days from signup
  V2V_BOOST_DAYS: 15           // +15 days Pro when referred vendor completes 1st job
};

/**
 * Generates a clean, readable 6-character uppercase alphanumeric referral code (e.g. FIX842).
 * Excludes ambiguous characters (0, O, 1, I).
 *
 * @param {string} [prefix="FIX"] - Optional 2-3 char prefix
 * @returns {string} 6-character unique code
 */
function generateReferralCode(prefix = "FIX") {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const p = String(prefix || "FIX").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "FIX";
  const needed = Math.max(3, 6 - p.length);
  const bytes = crypto.randomBytes(needed);
  let suffix = "";
  for (let i = 0; i < needed; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
  return (p + suffix).slice(0, 6);
}

/**
 * Calculates 5% passive referral commission with 3-decimal OMR precision.
 * E.g., 10.000 OMR -> 0.500 OMR.
 *
 * @param {number} transactionAmount - Gross order or top-up amount in OMR
 * @param {number} [rate=0.050] - Commission percentage
 * @returns {number} Commission amount in OMR (rounded to 3 decimal places)
 */
function calculateReferralCommission(transactionAmount, rate = REFERRAL_CONFIG.REV_SHARE_RATE) {
  const amount = Math.max(0, Number(transactionAmount) || 0);
  const pct = Math.max(0, Math.min(1, Number(rate) || REFERRAL_CONFIG.REV_SHARE_RATE));
  return Math.round(amount * pct * 1000) / 1000;
}

/**
 * Validates if a referral relationship is still within the active 90-day passive commission window.
 *
 * @param {string|Date} signupDate - User signup timestamp
 * @param {string|Date} [expiryDate] - Explicit referral expiry timestamp
 * @returns {boolean} True if within 90-day window
 */
function isReferralActive(signupDate, expiryDate = null) {
  const now = Date.now();
  if (expiryDate) {
    return new Date(expiryDate).getTime() > now;
  }
  if (!signupDate) return false;
  const start = new Date(signupDate).getTime();
  const maxWindowMs = REFERRAL_CONFIG.REV_SHARE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return now <= start + maxWindowMs;
}

/**
 * Evaluates whether a new order qualifies for the Vendor-to-Consumer 0.0% fee boost.
 * If a consumer books a vendor using that vendor's personal referral code, fee is 0.0%.
 *
 * @param {string} orderReferralCode - Code used when placing order
 * @param {string} vendorReferralCode - Vendor's personal referral code
 * @param {number} consumerCompletedOrdersCount - Total previous completed orders by this consumer
 * @returns {{ isZeroFeeEligible: boolean, appliedFeeRate: number }}
 */
function evaluateVendorToConsumerBoost(orderReferralCode, vendorReferralCode, consumerCompletedOrdersCount = 0) {
  const cleanOrderCode = String(orderReferralCode || "").trim().toUpperCase();
  const cleanVendorCode = String(vendorReferralCode || "").trim().toUpperCase();

  if (cleanOrderCode && cleanVendorCode && cleanOrderCode === cleanVendorCode && consumerCompletedOrdersCount === 0) {
    return {
      isZeroFeeEligible: true,
      appliedFeeRate: 0.0000, // 0.0% platform fee on first order booked through vendor's link
      description: "Vendor-to-Consumer Referral: 0% Platform Fee applied"
    };
  }

  return {
    isZeroFeeEligible: false,
    appliedFeeRate: null
  };
}

module.exports = {
  REFERRAL_CONFIG,
  generateReferralCode,
  calculateReferralCommission,
  isReferralActive,
  evaluateVendorToConsumerBoost
};
