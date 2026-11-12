/**
 * FixIt Hyper-Local Dispatch & Expansion Engine
 * Implements 3-Minute Pro Head-Start, Expanding Radius Waves (3km -> 8km -> 15km),
 * Cold-Start bounty bump prompt (+1.000 OMR at T+10m), and deterministic ranking:
 * RankScore = (100 * is_pro) + (10 * avg_rating) - (2 * distance_km).
 *
 * ZERO AI / ZERO LLMs: Pure deterministic math (Haversine distance & weighted scores).
 */

const DISPATCH_CONFIG = {
  PRO_HEADSTART_MINUTES: 3.0, // 3-minute exclusive window for FixIt Pro vendors
  WAVE_1_MAX_MINUTES: 5.0,    // T+3 to T+5 mins: Broadcast to Free vendors within 3km
  WAVE_2_MAX_MINUTES: 10.0,   // T+5 to T+10 mins: Expand to 8km
  WAVE_1_RADIUS_KM: 3.0,      // Wave 1: 3 km
  WAVE_2_RADIUS_KM: 8.0,      // Wave 2: 8 km
  WAVE_3_RADIUS_KM: 15.0,     // Wave 3: 15 km
  BOUNTY_BUMP_AMOUNT_OMR: 1.000 // +1.000 OMR prompt if 0 bids at T+10 mins
};

/**
 * Calculates great-circle distance between two points on the earth using Haversine formula.
 *
 * @param {number} lat1 - Latitude of point 1 in degrees
 * @param {number} lon1 - Longitude of point 1 in degrees
 * @param {number} lat2 - Latitude of point 2 in degrees
 * @param {number} lon2 - Longitude of point 2 in degrees
 * @returns {number} Distance in kilometers (rounded to 2 decimal places)
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const p1Lat = Number(lat1);
  const p1Lon = Number(lon1);
  const p2Lat = Number(lat2);
  const p2Lon = Number(lon2);

  if (!Number.isFinite(p1Lat) || !Number.isFinite(p1Lon) || !Number.isFinite(p2Lat) || !Number.isFinite(p2Lon)) {
    return 999.0; // Return arbitrary high distance if coordinates missing
  }

  const R = 6371; // Earth radius in km
  const dLat = ((p2Lat - p1Lat) * Math.PI) / 180;
  const dLon = ((p2Lon - p1Lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1Lat * Math.PI) / 180) *
      Math.cos((p2Lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;
  return Math.round(dist * 100) / 100;
}

/**
 * Evaluates current dispatch wave, Pro exclusivity, max radius, and cold-start bounty bump.
 *
 * @param {number} orderAgeMinutes - Age of order in minutes since creation
 * @param {number} [existingBidsCount=0] - Number of bids currently placed on order
 * @returns {{ wave: number, isProExclusive: boolean, maxRadiusKm: number, shouldBumpBounty: boolean, bumpAmountOmr: number }}
 */
function getDispatchWave(orderAgeMinutes, existingBidsCount = 0) {
  const age = Math.max(0, Number(orderAgeMinutes) || 0);

  if (age < DISPATCH_CONFIG.PRO_HEADSTART_MINUTES) {
    // Wave 1 (0 to 3 mins): FixIt Pro exclusive within 3 km
    return {
      wave: 1,
      isProExclusive: true,
      maxRadiusKm: DISPATCH_CONFIG.WAVE_1_RADIUS_KM, // 3 km
      shouldBumpBounty: false,
      bumpAmountOmr: 0.000,
      description: "FixIt Pro exclusive head-start (3 km)"
    };
  }

  if (age < DISPATCH_CONFIG.WAVE_1_MAX_MINUTES) {
    // Wave 1 expanded (3 to 5 mins): Broadcast to all vendors within 3 km
    return {
      wave: 1,
      isProExclusive: false,
      maxRadiusKm: DISPATCH_CONFIG.WAVE_1_RADIUS_KM, // 3 km
      shouldBumpBounty: false,
      bumpAmountOmr: 0.000,
      description: "Local broadcast to all vendors (3 km)"
    };
  }

  if (age < DISPATCH_CONFIG.WAVE_2_MAX_MINUTES) {
    // Wave 2 (5 to 10 mins): Expand radius to 8 km
    return {
      wave: 2,
      isProExclusive: false,
      maxRadiusKm: DISPATCH_CONFIG.WAVE_2_RADIUS_KM, // 8 km
      shouldBumpBounty: false,
      bumpAmountOmr: 0.000,
      description: "Radius wave expanded to 8 km"
    };
  }

  // Wave 3 (10+ mins): Expand radius to 15 km. If 0 bids, prompt consumer to bump price by +1.000 OMR.
  const shouldBump = existingBidsCount === 0;
  return {
    wave: 3,
    isProExclusive: false,
    maxRadiusKm: DISPATCH_CONFIG.WAVE_3_RADIUS_KM, // 15 km
    shouldBumpBounty: shouldBump,
    bumpAmountOmr: shouldBump ? DISPATCH_CONFIG.BOUNTY_BUMP_AMOUNT_OMR : 0.000,
    description: "Maximum radius wave (15 km) with bounty bump recommendation"
  };
}

/**
 * Calculates deterministic ranking score for a vendor:
 * RankScore = (100 * is_pro) + (10 * avg_rating) - (2 * distance_km)
 *
 * @param {boolean} isPro - Whether vendor has FixIt Pro active
 * @param {number} avgRating - Average star rating (1.00 to 5.00)
 * @param {number} distanceKm - Distance in km
 * @returns {number} Rank score (higher is prioritized)
 */
function calculateVendorRankScore(isPro, avgRating, distanceKm) {
  const proBonus = isPro ? 100 : 0;
  const ratingScore = Math.max(0, Math.min(5, Number(avgRating) || 5.0)) * 10;
  const distPenalty = Math.max(0, Number(distanceKm) || 0) * 2;
  return Math.round((proBonus + ratingScore - distPenalty) * 100) / 100;
}

/**
 * Matches, filters, and ranks vendors for an order according to current dispatch wave.
 *
 * @param {object} order - Order details ({ lat, lng, category_id, createdAt, bidsCount })
 * @param {object[]} vendors - Candidate vendors array
 * @returns {{ waveInfo: object, matchedVendors: object[], eligibleCount: number, filteredOutCount: number }}
 */
function matchAndRankVendors(order, vendors = []) {
  const orderLat = Number(order.lat || 17.015); // Fallback Salalah Center
  const orderLng = Number(order.lng || 54.092);
  const orderCat = String(order.category_id || order.category || "");
  const createdAtMs = order.created_at ? new Date(order.created_at).getTime() : Date.now();
  const ageMinutes = (Date.now() - createdAtMs) / (60 * 1000);
  const bidsCount = Number(order.bidsCount || order.bids_count || 0);

  const waveInfo = getDispatchWave(ageMinutes, bidsCount);

  let eligible = [];
  let filteredOut = 0;

  for (const v of vendors) {
    // 1. Availability and strike lockout checks
    if (v.is_busy === true || v.bidding_suspended === true || v.is_banned === true) {
      filteredOut++;
      continue;
    }

    // 2. Category / skill matching
    if (orderCat && Array.isArray(v.skills) && v.skills.length > 0) {
      const hasSkill = v.skills.includes(orderCat) || v.skills.includes("*");
      if (!hasSkill) {
        filteredOut++;
        continue;
      }
    }

    const isPro = Boolean(v.is_pro || (v.pro_expires_at && new Date(v.pro_expires_at) > new Date()));

    // 3. Pro head-start exclusivity during 0 to 3 minutes
    if (waveInfo.isProExclusive && !isPro) {
      filteredOut++;
      continue;
    }

    // 4. Distance check against current wave max radius
    const vLat = Number(v.lat || 17.015);
    const vLng = Number(v.lng || 54.092);
    const distanceKm = calculateDistanceKm(orderLat, orderLng, vLat, vLng);

    if (distanceKm > waveInfo.maxRadiusKm) {
      filteredOut++;
      continue;
    }

    // 5. Ranking score calculation
    const rankScore = calculateVendorRankScore(isPro, v.avg_rating || 5.0, distanceKm);

    eligible.push({
      ...v,
      is_pro: isPro,
      distanceKm,
      rankScore
    });
  }

  // Sort descending by rank score (highest score first)
  eligible.sort((a, b) => b.rankScore - a.rankScore);

  return {
    waveInfo,
    matchedVendors: eligible,
    eligibleCount: eligible.length,
    filteredOutCount: filteredOut
  };
}

module.exports = {
  DISPATCH_CONFIG,
  calculateDistanceKm,
  getDispatchWave,
  calculateVendorRankScore,
  matchAndRankVendors
};
