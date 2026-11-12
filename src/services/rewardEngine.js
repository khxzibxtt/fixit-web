/**
 * FixIt Post-Job Micro-Reward & Streak Engine
 * Drives repeat booking frequency using deterministic 7-day rotating micro-rewards
 * (0.100, 0.200, 0.300 OMR) and a monthly 3-job streak bonus (1.000 OMR with 14-day expiry).
 *
 * All financial amounts in Oman Rial (OMR, 3 decimals).
 * ZERO AI / ZERO LLMs: Pure deterministic math.
 */

const REWARD_CONFIG = {
  MICRO_REWARD_CYCLE: [0.100, 0.200, 0.300], // 100 bz, 200 bz, 300 bz rotating
  MICRO_REWARD_EXPIRY_DAYS: 7,               // 7-day expiry to drive immediate repeat booking
  MONTHLY_STREAK_THRESHOLD: 3,               // 3 completed jobs in calendar month
  MONTHLY_STREAK_BONUS_OMR: 1.000,           // 1.000 OMR bonus credit
  MONTHLY_STREAK_EXPIRY_DAYS: 14             // 14-day expiry for streak reward
};

/**
 * Returns deterministic rotating micro-reward for a completed job.
 *
 * @param {number} totalCompletedJobsCount - Cumulative count of completed jobs by consumer
 * @returns {{ amountOmr: number, expiryDays: number, description: string }}
 */
function getRotatingMicroReward(totalCompletedJobsCount) {
  const count = Math.max(0, Number.parseInt(totalCompletedJobsCount, 10) || 0);
  const cycleIndex = count % REWARD_CONFIG.MICRO_REWARD_CYCLE.length;
  const amount = REWARD_CONFIG.MICRO_REWARD_CYCLE[cycleIndex];

  return {
    amountOmr: amount,
    expiryDays: REWARD_CONFIG.MICRO_REWARD_EXPIRY_DAYS,
    description: `Repeat booking reward: ${amount.toFixed(3)} OMR bonus credit (expires in 7 days)`
  };
}

/**
 * Checks whether consumer has hit the monthly streak threshold (3 completed jobs in month).
 *
 * @param {number} jobsInCurrentMonth - Count of jobs completed in current calendar month
 * @returns {{ qualifiesForStreak: boolean, bonusOmr: number, expiryDays: number, description?: string }}
 */
function evaluateMonthlyStreak(jobsInCurrentMonth) {
  const count = Math.max(0, Number.parseInt(jobsInCurrentMonth, 10) || 0);
  const qualifies = count === REWARD_CONFIG.MONTHLY_STREAK_THRESHOLD;

  return {
    qualifiesForStreak: qualifies,
    bonusOmr: qualifies ? REWARD_CONFIG.MONTHLY_STREAK_BONUS_OMR : 0.000,
    expiryDays: REWARD_CONFIG.MONTHLY_STREAK_EXPIRY_DAYS,
    description: qualifies
      ? `3-Job Streak Achieved! ${REWARD_CONFIG.MONTHLY_STREAK_BONUS_OMR.toFixed(3)} OMR bonus credit unlocked (expires in 14 days)`
      : `${count} of ${REWARD_CONFIG.MONTHLY_STREAK_THRESHOLD} jobs toward your 1.000 OMR monthly streak.`
  };
}

module.exports = {
  REWARD_CONFIG,
  getRotatingMicroReward,
  evaluateMonthlyStreak
};
