-- ============================================================================
-- FixIt Platform Engine Migration
-- File: supabase/migrations/20261113_fixit_engines.sql
-- Description: Deterministic algorithms, viral referral engine, progressive fee ladder,
--              instant-release atomic ledger, bid-floor guard, and warranty enforcement.
-- Currency: Oman Rial (OMR), 3-decimal precision (e.g. 0.300 OMR = 300 baisa).
-- Zero AI / Zero LLMs: 100% deterministic SQL RPC functions and constraints.
-- No "escrow" terminology: uses "Protected Job Pay" and instant release upon completion.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. BASE TABLES (Create if not exist, then alter with required columns)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'consumer', -- 'consumer', 'vendor', 'admin'
  referral_code VARCHAR(12) UNIQUE,
  referred_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  referral_expires_at TIMESTAMPTZ,
  bonus_credit_wallet NUMERIC(10,3) DEFAULT 0.000 NOT NULL CHECK (bonus_credit_wallet >= 0),
  is_pro BOOLEAN DEFAULT false,
  pro_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.categories (
  id VARCHAR(40) PRIMARY KEY,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  min_base_price NUMERIC(10,3) DEFAULT 3.000 NOT NULL, -- Fallback floor in OMR
  is_active BOOLEAN DEFAULT true NOT NULL
);

-- Seed standard FixIt categories if empty
INSERT INTO public.categories (id, name_en, name_ar, min_base_price)
VALUES
  ('AC_REPAIR', 'AC Repair & Maintenance', 'صيانة وإصلاح التكييف', 4.000),
  ('PLUMBING', 'Plumbing & Leak Repair', 'سباكة وكشف التسربات', 3.000),
  ('ELECTRICAL', 'Electrical & Generator', 'كهرباء وتمديدات وتوليد', 3.000),
  ('BREAKDOWN', 'Car Breakdown & Recovery', 'طوارئ سيارات وسطحة ونقل', 5.000),
  ('TAXI', 'Salalah Taxi & City Ride', 'أجرة صلالة وتوصيل مشاوير', 1.000),
  ('APPLIANCE', 'Appliance & Washer Repair', 'صيانة الأجهزة المنزلية والغسالات', 3.500),
  ('LOCKSMITH', 'Locksmith & Car Opening', 'أقفال وفتح سيارات وبرمجة', 3.000),
  ('CLEANING', 'Deep Cleaning & Tank Sanitizing', 'تنظيف شامل وتعقيم خزانات', 5.000)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  business_name VARCHAR(120),
  phone VARCHAR(20),
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  is_busy BOOLEAN DEFAULT false NOT NULL,
  avg_rating NUMERIC(3,2) DEFAULT 5.00 NOT NULL,
  completed_jobs_count INT DEFAULT 0 NOT NULL CHECK (completed_jobs_count >= 0),
  custom_fee_rate NUMERIC(5,4) CHECK (custom_fee_rate >= 0.0000 AND custom_fee_rate <= 1.0000),
  pro_expires_at TIMESTAMPTZ,
  launch_promo_claimed BOOLEAN DEFAULT false NOT NULL,
  withdrawable_balance NUMERIC(10,3) DEFAULT 0.000 NOT NULL CHECK (withdrawable_balance >= 0),
  bonus_credit_wallet NUMERIC(10,3) DEFAULT 0.000 NOT NULL CHECK (bonus_credit_wallet >= 0),
  strikes INT DEFAULT 0 NOT NULL CHECK (strikes >= 0),
  bidding_suspended BOOLEAN DEFAULT false NOT NULL,
  is_banned BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Ensure vendors columns exist if table was pre-existing
DO $$ BEGIN
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS completed_jobs_count INT DEFAULT 0 NOT NULL;
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS custom_fee_rate NUMERIC(5,4);
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMPTZ;
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS launch_promo_claimed BOOLEAN DEFAULT false NOT NULL;
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS withdrawable_balance NUMERIC(10,3) DEFAULT 0.000 NOT NULL;
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS bonus_credit_wallet NUMERIC(10,3) DEFAULT 0.000 NOT NULL;
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS strikes INT DEFAULT 0 NOT NULL;
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS bidding_suspended BOOLEAN DEFAULT false NOT NULL;
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_busy BOOLEAN DEFAULT false NOT NULL;
  ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.vendor_skills (
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  category_id VARCHAR(40) REFERENCES public.categories(id) ON DELETE CASCADE,
  is_approved BOOLEAN DEFAULT true NOT NULL,
  PRIMARY KEY (vendor_id, category_id)
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  category_id VARCHAR(40) REFERENCES public.categories(id) ON DELETE RESTRICT,
  title VARCHAR(200),
  description TEXT,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  amount NUMERIC(10,3) NOT NULL CHECK (amount >= 0.100),
  status VARCHAR(30) DEFAULT 'OPEN' NOT NULL, 
  -- Status flow: 'OPEN', 'BIDDING', 'ACTIVE_PAID', 'IN_PROGRESS', 'AWAITING_PHOTOS', 'COMPLETED', 'DISPUTED', 'CANCELLED'
  applied_fee_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0100, -- Locked snapshot when order is accepted
  agreed_warranty_days INT DEFAULT 14 NOT NULL, -- 14-day standard repair warranty
  bonus_credit_applied NUMERIC(10,3) DEFAULT 0.000 NOT NULL CHECK (bonus_credit_applied >= 0),
  withdrawable_payout NUMERIC(10,3) DEFAULT 0.000 NOT NULL,
  platform_cut NUMERIC(10,3) DEFAULT 0.000 NOT NULL,
  before_photo_url TEXT,
  after_photo_url TEXT,
  after_photo_uploaded_at TIMESTAMPTZ,
  is_disputed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Ensure orders columns exist if table was pre-existing
DO $$ BEGIN
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS applied_fee_rate NUMERIC(5,4) DEFAULT 0.0100 NOT NULL;
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS agreed_warranty_days INT DEFAULT 14 NOT NULL;
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS bonus_credit_applied NUMERIC(10,3) DEFAULT 0.000 NOT NULL;
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS withdrawable_payout NUMERIC(10,3) DEFAULT 0.000 NOT NULL;
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS platform_cut NUMERIC(10,3) DEFAULT 0.000 NOT NULL;
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS after_photo_uploaded_at TIMESTAMPTZ;
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_disputed BOOLEAN DEFAULT false NOT NULL;
  ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. PLATFORM CONFIGURATION (Single-row tuning table for live OMR/Timer tuning)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  
  -- Launch Promo: 0.300 OMR (300 bz) for 90 Days during Month 1
  launch_window_end TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days') NOT NULL,
  launch_pro_price NUMERIC(10,3) DEFAULT 0.300 NOT NULL, -- 0.300 OMR = 300 baisa
  launch_pro_days INT DEFAULT 90 NOT NULL,               -- 90 days entitlement
  standard_pro_price NUMERIC(10,3) DEFAULT 5.000 NOT NULL, -- Standard 1-month Pro price: 5.000 OMR
  standard_pro_days INT DEFAULT 30 NOT NULL,             -- Standard 30 days
  
  -- Referral & VIP Unlock Config
  referral_vip_price NUMERIC(10,3) DEFAULT 0.300 NOT NULL, -- 0.300 OMR unlock fee
  referral_vip_days INT DEFAULT 30 NOT NULL,              -- 30 days Pro/Plus
  referral_vip_bonus NUMERIC(10,3) DEFAULT 1.000 NOT NULL, -- 1.000 OMR bonus credit
  min_order_for_credit NUMERIC(10,3) DEFAULT 5.000 NOT NULL, -- Minimum order to redeem 1.000 OMR credit
  referral_rev_share_rate NUMERIC(5,4) DEFAULT 0.0500 NOT NULL, -- 5% passive commission
  referral_rev_share_days INT DEFAULT 90 NOT NULL,        -- 90 days commission window
  vendor_referral_pro_bonus_days INT DEFAULT 15 NOT NULL, -- +15 days Pro when referred vendor completes 1st job
  
  -- Micro-Reward & Streak
  streak_jobs_threshold INT DEFAULT 3 NOT NULL,           -- 3 completed jobs in calendar month
  streak_reward_credit NUMERIC(10,3) DEFAULT 1.000 NOT NULL, -- 1.000 OMR streak reward
  streak_reward_expiry_days INT DEFAULT 14 NOT NULL,      -- 14 days expiry for streak credit
  micro_reward_expiry_days INT DEFAULT 7 NOT NULL,        -- 7 days expiry for rotating post-job micro-reward
  
  -- Bid Floor Guard
  bid_floor_ratio NUMERIC(5,4) DEFAULT 0.4000 NOT NULL,   -- Reject bids < 40% of median of last 20 jobs
  bid_history_sample_size INT DEFAULT 20 NOT NULL,        -- Sample last 20 completed jobs
  
  -- Warranty & Dispute Policies
  warranty_response_window_hours INT DEFAULT 24 NOT NULL, -- Vendor must respond within 24h
  max_warranty_strikes INT DEFAULT 3 NOT NULL,            -- 3 strikes = permanent ban
  auto_confirm_hours INT DEFAULT 24 NOT NULL,             -- 24h auto-confirm if After photo uploaded
  
  -- Dispatch & Expansion Waves
  pro_headstart_minutes INT DEFAULT 3 NOT NULL,           -- 3-minute Pro head-start
  wave1_radius_km NUMERIC(6,2) DEFAULT 3.00 NOT NULL,     -- T+0 to T+3 mins (Pro), T+3 to T+5 mins (All)
  wave2_radius_km NUMERIC(6,2) DEFAULT 8.00 NOT NULL,     -- T+5 mins
  wave3_radius_km NUMERIC(6,2) DEFAULT 15.00 NOT NULL,    -- T+10 mins
  bounty_bump_amount NUMERIC(10,3) DEFAULT 1.000 NOT NULL,-- +1.000 OMR suggested bounty bump
  
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

INSERT INTO public.platform_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. LEDGER & WALLET LEDGER TABLES
-- ----------------------------------------------------------------------------

-- Platform ledger collecting platform cuts upon instant release
CREATE TABLE IF NOT EXISTS public.platform_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount NUMERIC(10,3) NOT NULL CHECK (amount >= 0),
  fee_rate NUMERIC(5,4) NOT NULL,
  source VARCHAR(50) DEFAULT 'ORDER_FEE' NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Individual bonus credit grants with individual expiry tracking
CREATE TABLE IF NOT EXISTS public.bonus_credit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,3) NOT NULL CHECK (amount > 0),
  remaining_amount NUMERIC(10,3) NOT NULL CHECK (remaining_amount >= 0),
  min_order_amount NUMERIC(10,3) DEFAULT 0.000 NOT NULL,
  source VARCHAR(60) NOT NULL, 
  -- Sources: 'REFERRAL_VIP_UNLOCK', 'REFERRAL_COMMISSION', 'POST_JOB_MICRO_REWARD', 'MONTHLY_STREAK_3', 'ADMIN_GRANT'
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_expired BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bonus_credit_user_active 
  ON public.bonus_credit_entries (user_id, is_expired, expires_at);

-- ----------------------------------------------------------------------------
-- 4. DEVICE FINGERPRINTS & ANTI-ABUSE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.device_fingerprints (
  fingerprint_hash VARCHAR(64) PRIMARY KEY, -- SHA-256 of phone + device_id + ip_subnet
  phone VARCHAR(20) NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  launch_promo_claimed BOOLEAN DEFAULT false NOT NULL,
  is_banned BOOLEAN DEFAULT false NOT NULL,
  ban_reason TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_seen_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fingerprint_phone ON public.device_fingerprints (phone);

-- ----------------------------------------------------------------------------
-- 5. WARRANTY CLAIMS & STRIKE AUDIT
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.warranty_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE NOT NULL,
  consumer_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  claim_reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'OPEN' NOT NULL, -- 'OPEN', 'RESOLVED_BY_VENDOR', 'STRIKE_ISSUED', 'DISMISSED'
  claim_deadline TIMESTAMPTZ NOT NULL, -- created_at + 24 hours
  vendor_response TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_warranty_vendor_status 
  ON public.warranty_claims (vendor_id, status, claim_deadline);

-- ----------------------------------------------------------------------------
-- 6. LIVE ACTIVITY TICKER & SOCIAL PROOF EVENTS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(40) NOT NULL, 
  -- 'JOB_COMPLETED', 'PROMO_CLAIMED', 'REFERRAL_UNLOCKED', 'VENDORS_ONLINE'
  area VARCHAR(80) DEFAULT 'Salalah' NOT NULL,
  anonymized_title TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_events_feed 
  ON public.activity_events (created_at DESC);

-- ============================================================================
-- RPC FUNCTIONS: DETERMINISTIC LOGIC & ATOMIC LEDGER
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RPC 1: get_vendor_fee_rate(p_vendor_id UUID)
-- Progressive Vendor Fee Ladder:
-- 0 - 5 jobs:   1.0% (0.0100) -> vendor keeps 99%
-- 6 - 15 jobs:  5.0% (0.0500)
-- 16 - 30 jobs: 10.0% (0.1000)
-- 31+ jobs:     15.0% (0.1500) if FixIt Pro is active; 20.0% (0.2000) if Free tier
-- Overridden by vendor.custom_fee_rate if explicitly set.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_vendor_fee_rate(p_vendor_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_jobs INT;
  v_custom NUMERIC(5,4);
  v_pro_expires TIMESTAMPTZ;
  v_is_pro BOOLEAN;
BEGIN
  SELECT completed_jobs_count, custom_fee_rate, pro_expires_at
    INTO v_jobs, v_custom, v_pro_expires
    FROM public.vendors
   WHERE id = p_vendor_id;

  IF NOT FOUND THEN
    RETURN 0.2000; -- Default conservative rate for unknown vendor
  END IF;

  -- Custom negotiated rate takes highest precedence
  IF v_custom IS NOT NULL THEN
    RETURN v_custom;
  END IF;

  v_is_pro := (v_pro_expires IS NOT NULL AND v_pro_expires > now());

  IF v_jobs <= 5 THEN
    RETURN 0.0100; -- 1.0%
  ELSIF v_jobs <= 15 THEN
    RETURN 0.0500; -- 5.0%
  ELSIF v_jobs <= 30 THEN
    RETURN 0.1000; -- 10.0%
  ELSE
    IF v_is_pro THEN
      RETURN 0.1500; -- 15.0% (Pro tier discount)
    ELSE
      RETURN 0.2000; -- 20.0% (Free tier standard)
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------------------------
-- RPC 2: claim_launch_pro_promo(p_vendor_id, p_fingerprint_hash)
-- Launch Promo: 0.300 OMR for 90 Days during Month 1.
-- Enforces single-claim per vendor AND single-claim per hardware fingerprint.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_launch_pro_promo(
  p_vendor_id UUID,
  p_fingerprint_hash VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_cfg RECORD;
  v_vendor RECORD;
  v_now TIMESTAMPTZ := now();
  v_is_launch_eligible BOOLEAN;
  v_charged NUMERIC(10,3);
  v_days_granted INT;
  v_new_expiry TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_cfg FROM public.platform_config WHERE id = 1;
  SELECT * INTO v_vendor FROM public.vendors WHERE id = p_vendor_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vendor not found');
  END IF;

  -- Check hardware fingerprint abuse
  IF p_fingerprint_hash IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.device_fingerprints
       WHERE fingerprint_hash = p_fingerprint_hash
         AND launch_promo_claimed = true
         AND user_id != v_vendor.user_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Launch promo already claimed on this device.');
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.device_fingerprints
       WHERE fingerprint_hash = p_fingerprint_hash
         AND is_banned = true
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Device is blacklisted due to warranty strike limit.');
    END IF;
  END IF;

  v_is_launch_eligible := (v_now <= v_cfg.launch_window_end AND v_vendor.launch_promo_claimed = false);

  IF v_is_launch_eligible THEN
    v_charged := v_cfg.launch_pro_price; -- 0.300 OMR
    v_days_granted := v_cfg.launch_pro_days; -- 90 days
    v_new_expiry := GREATEST(v_now, COALESCE(v_vendor.pro_expires_at, v_now)) + (v_days_granted || ' days')::INTERVAL;

    UPDATE public.vendors
       SET pro_expires_at = v_new_expiry,
           launch_promo_claimed = true,
           updated_at = v_now
     WHERE id = p_vendor_id;

    IF v_vendor.user_id IS NOT NULL THEN
      UPDATE public.users
         SET is_pro = true,
             pro_expires_at = v_new_expiry,
             updated_at = v_now
       WHERE id = v_vendor.user_id;
    END IF;

    IF p_fingerprint_hash IS NOT NULL THEN
      INSERT INTO public.device_fingerprints (fingerprint_hash, phone, user_id, launch_promo_claimed, last_seen_at)
      VALUES (p_fingerprint_hash, COALESCE(v_vendor.phone, 'unknown'), v_vendor.user_id, true, v_now)
      ON CONFLICT (fingerprint_hash) DO UPDATE
         SET launch_promo_claimed = true, last_seen_at = v_now;
    END IF;

    -- Log social proof activity
    INSERT INTO public.activity_events (event_type, area, anonymized_title)
    VALUES ('PROMO_CLAIMED', 'Salalah', 'Technician claimed 90-Day FixIt Pro Launch Pack (300 bz)');

    RETURN jsonb_build_object(
      'ok', true,
      'tier', 'LAUNCH_PROMO_90_DAYS',
      'price_charged_omr', v_charged,
      'days_added', v_days_granted,
      'pro_expires_at', v_new_expiry
    );
  ELSE
    -- Standard Pro Renewal: 5.000 OMR for 30 Days
    v_charged := v_cfg.standard_pro_price; -- 5.000 OMR
    v_days_granted := v_cfg.standard_pro_days; -- 30 days
    v_new_expiry := GREATEST(v_now, COALESCE(v_vendor.pro_expires_at, v_now)) + (v_days_granted || ' days')::INTERVAL;

    UPDATE public.vendors
       SET pro_expires_at = v_new_expiry,
           updated_at = v_now
     WHERE id = p_vendor_id;

    IF v_vendor.user_id IS NOT NULL THEN
      UPDATE public.users
         SET is_pro = true,
             pro_expires_at = v_new_expiry,
             updated_at = v_now
       WHERE id = v_vendor.user_id;
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'tier', 'STANDARD_PRO_30_DAYS',
      'price_charged_omr', v_charged,
      'days_added', v_days_granted,
      'pro_expires_at', v_new_expiry
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- RPC 3: claim_referral_vip_offer(p_user_id, p_referral_code)
-- 48-Hour VIP Unlock (Zero-Loss Hook):
-- User pays 0.300 OMR -> gets 1 Month Pro/Plus (30d) + 1.000 OMR in bonus_credit_wallet
-- with min_order_amount = 5.000 OMR constraint.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_referral_vip_offer(
  p_user_id UUID,
  p_referral_code VARCHAR
)
RETURNS JSONB AS $$
DECLARE
  v_cfg RECORD;
  v_user RECORD;
  v_referrer RECORD;
  v_now TIMESTAMPTZ := now();
  v_new_pro_expiry TIMESTAMPTZ;
  v_credit_expiry TIMESTAMPTZ := v_now + INTERVAL '30 days';
BEGIN
  SELECT * INTO v_cfg FROM public.platform_config WHERE id = 1;
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'User not found');
  END IF;

  -- Validate referral code exists and does not belong to self
  SELECT * INTO v_referrer FROM public.users WHERE referral_code = UPPER(TRIM(p_referral_code));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid referral code');
  END IF;
  IF v_referrer.id = p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot use your own referral code');
  END IF;

  -- Link referrer and 90-day passive commission window if not already linked
  IF v_user.referred_by_user_id IS NULL THEN
    UPDATE public.users
       SET referred_by_user_id = v_referrer.id,
           referral_expires_at = v_now + (v_cfg.referral_rev_share_days || ' days')::INTERVAL
     WHERE id = p_user_id;
  END IF;

  -- Extend Plus/Pro by 30 days
  v_new_pro_expiry := GREATEST(v_now, COALESCE(v_user.pro_expires_at, v_now)) + (v_cfg.referral_vip_days || ' days')::INTERVAL;
  
  -- Grant 1.000 OMR bonus credit entry restricted to orders >= 5.000 OMR
  INSERT INTO public.bonus_credit_entries (
    user_id, amount, remaining_amount, min_order_amount, source, expires_at
  ) VALUES (
    p_user_id,
    v_cfg.referral_vip_bonus, -- 1.000 OMR
    v_cfg.referral_vip_bonus,
    v_cfg.min_order_for_credit, -- 5.000 OMR min order threshold
    'REFERRAL_VIP_UNLOCK',
    v_credit_expiry
  );

  -- Update user record with wallet addition and pro status
  UPDATE public.users
     SET bonus_credit_wallet = bonus_credit_wallet + v_cfg.referral_vip_bonus,
         is_pro = true,
         pro_expires_at = v_new_pro_expiry,
         updated_at = v_now
   WHERE id = p_user_id;

  -- If user is also a vendor, sync vendor Pro expiry
  UPDATE public.vendors
     SET pro_expires_at = v_new_pro_expiry,
         bonus_credit_wallet = bonus_credit_wallet + v_cfg.referral_vip_bonus,
         updated_at = v_now
   WHERE user_id = p_user_id;

  -- Log live activity ticker
  INSERT INTO public.activity_events (event_type, area, anonymized_title)
  VALUES ('REFERRAL_UNLOCKED', 'Salalah', 'New member unlocked 1.000 OMR Referral Welcome Credit + 30 Days Pro');

  RETURN jsonb_build_object(
    'ok', true,
    'unlocked', true,
    'price_paid_omr', v_cfg.referral_vip_price, -- 0.300 OMR
    'bonus_credit_added_omr', v_cfg.referral_vip_bonus, -- 1.000 OMR
    'min_order_for_credit_omr', v_cfg.min_order_for_credit, -- 5.000 OMR
    'pro_expires_at', v_new_pro_expiry
  );
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- RPC 4: calculate_bid_floor(p_category_id)
-- Statistical Bid-Floor Guard (Zero AI Anti-Sabotage):
-- Computes median of last 20 completed jobs in category.
-- Rejects any bid < 40% of median (or fallback min_base_price).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_bid_floor(p_category_id VARCHAR)
RETURNS JSONB AS $$
DECLARE
  v_cfg RECORD;
  v_cat RECORD;
  v_median NUMERIC(10,3);
  v_count INT;
  v_min_allowed NUMERIC(10,3);
BEGIN
  SELECT * INTO v_cfg FROM public.platform_config WHERE id = 1;
  SELECT * INTO v_cat FROM public.categories WHERE id = p_category_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Category not found');
  END IF;

  -- Compute statistical median from the last 20 completed jobs in this category
  WITH recent_jobs AS (
    SELECT amount
      FROM public.orders
     WHERE category_id = p_category_id
       AND status = 'COMPLETED'
     ORDER BY completed_at DESC NULLS LAST
     LIMIT v_cfg.bid_history_sample_size
  )
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY amount)::NUMERIC(10,3),
         COUNT(*)
    INTO v_median, v_count
    FROM recent_jobs;

  -- Fall back to category min_base_price if sample size is too small (< 5 jobs)
  IF v_count < 5 OR v_median IS NULL THEN
    v_median := v_cat.min_base_price;
  END IF;

  -- Floor is 40% of median
  v_min_allowed := ROUND(v_median * v_cfg.bid_floor_ratio, 3);

  RETURN jsonb_build_object(
    'ok', true,
    'category_id', p_category_id,
    'sample_count', COALESCE(v_count, 0),
    'median_price_omr', v_median,
    'floor_ratio', v_cfg.bid_floor_ratio, -- 0.4000
    'min_allowed_bid_omr', v_min_allowed
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------------------------
-- RPC 5: complete_and_release_order(p_order_id)
-- Instant-Release Atomic Ledger:
-- 1. Snapshot applied fee rate (e.g. 1% to 20%)
-- 2. platform_cut = ROUND(job_amount * applied_fee_rate, 3)
-- 3. vendor_payout = job_amount - platform_cut
-- 4. Credit vendor_payout to vendors.withdrawable_balance
-- 5. Credit platform_cut to public.platform_ledger
-- 6. Trigger 5% referral rev-share if consumer was referred within 90 days
-- 7. Trigger vendor-to-vendor pro boost (+15 days) on first completed job
-- 8. Trigger consumer post-job micro-reward (0.100 - 0.300 OMR, 7d expiry)
-- 9. Trigger consumer monthly streak (3 jobs = 1.000 OMR, 14d expiry)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_and_release_order(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_cfg RECORD;
  v_order RECORD;
  v_vendor RECORD;
  v_consumer RECORD;
  v_platform_cut NUMERIC(10,3);
  v_vendor_payout NUMERIC(10,3);
  v_now TIMESTAMPTZ := now();
  v_fee_rate NUMERIC(5,4);
  v_referral_commission NUMERIC(10,3) := 0.000;
  v_micro_reward NUMERIC(10,3) := 0.100;
  v_monthly_jobs INT := 0;
  v_streak_granted BOOLEAN := false;
  v_v2v_boost_granted BOOLEAN := false;
BEGIN
  SELECT * INTO v_cfg FROM public.platform_config WHERE id = 1;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'COMPLETED' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order is already completed');
  END IF;

  IF v_order.is_disputed = true THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot release funds while a warranty dispute is open');
  END IF;

  SELECT * INTO v_vendor FROM public.vendors WHERE id = v_order.vendor_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Vendor not assigned to order');
  END IF;

  SELECT * INTO v_consumer FROM public.users WHERE id = v_order.consumer_id FOR UPDATE;

  -- 1. Apply fee rate locked on order
  v_fee_rate := COALESCE(v_order.applied_fee_rate, public.get_vendor_fee_rate(v_vendor.id));
  v_platform_cut := ROUND(v_order.amount * v_fee_rate, 3);
  v_vendor_payout := v_order.amount - v_platform_cut;

  -- 2. Credit vendor withdrawable balance & increment job count
  UPDATE public.vendors
     SET withdrawable_balance = withdrawable_balance + v_vendor_payout,
         completed_jobs_count = completed_jobs_count + 1,
         is_busy = false,
         updated_at = v_now
   WHERE id = v_vendor.id;

  -- 3. Record platform cut in ledger
  INSERT INTO public.platform_ledger (
    order_id, amount, fee_rate, source, description, created_at
  ) VALUES (
    p_order_id,
    v_platform_cut,
    v_fee_rate,
    'ORDER_FEE',
    'Platform Fee (' || (v_fee_rate * 100)::TEXT || '%) for order ' || p_order_id::TEXT,
    v_now
  );

  -- 4. Mark order as COMPLETED
  UPDATE public.orders
     SET status = 'COMPLETED',
         withdrawable_payout = v_vendor_payout,
         platform_cut = v_platform_cut,
         completed_at = v_now,
         updated_at = v_now
   WHERE id = p_order_id;

  -- 5. Referrer 5% Passive Commission (90-day window)
  IF v_consumer.referred_by_user_id IS NOT NULL 
     AND v_consumer.referral_expires_at IS NOT NULL 
     AND v_now <= v_consumer.referral_expires_at THEN
    v_referral_commission := ROUND(v_order.amount * v_cfg.referral_rev_share_rate, 3);
    IF v_referral_commission > 0.000 THEN
      -- Credit referrer non-withdrawable bonus wallet
      UPDATE public.users
         SET bonus_credit_wallet = bonus_credit_wallet + v_referral_commission,
             updated_at = v_now
       WHERE id = v_consumer.referred_by_user_id;

      INSERT INTO public.bonus_credit_entries (
        user_id, amount, remaining_amount, min_order_amount, source, order_id, expires_at
      ) VALUES (
        v_consumer.referred_by_user_id,
        v_referral_commission,
        v_referral_commission,
        0.000,
        'REFERRAL_COMMISSION',
        p_order_id,
        v_now + (v_cfg.referral_rev_share_days || ' days')::INTERVAL
      );
    END IF;
  END IF;

  -- 6. Vendor-to-Vendor Boost (+15 days Pro when referred vendor completes 1st job)
  IF v_vendor.completed_jobs_count = 1 AND v_vendor.user_id IS NOT NULL THEN
    DECLARE
      v_vendor_user RECORD;
    BEGIN
      SELECT * INTO v_vendor_user FROM public.users WHERE id = v_vendor.user_id;
      IF v_vendor_user.referred_by_user_id IS NOT NULL THEN
        -- Extend referring vendor's Pro by 15 days
        UPDATE public.vendors
           SET pro_expires_at = GREATEST(v_now, COALESCE(pro_expires_at, v_now)) + (v_cfg.vendor_referral_pro_bonus_days || ' days')::INTERVAL,
               updated_at = v_now
         WHERE user_id = v_vendor_user.referred_by_user_id;

        UPDATE public.users
           SET is_pro = true,
               pro_expires_at = GREATEST(v_now, COALESCE(pro_expires_at, v_now)) + (v_cfg.vendor_referral_pro_bonus_days || ' days')::INTERVAL,
               updated_at = v_now
         WHERE id = v_vendor_user.referred_by_user_id;

        v_v2v_boost_granted := true;
      END IF;
    END;
  END IF;

  -- 7. Consumer Post-Job Micro-Reward (0.100, 0.200, or 0.300 OMR expiring in 7 days)
  IF v_consumer.id IS NOT NULL THEN
    -- Deterministic rotating reward based on total consumer completed orders
    SELECT COUNT(*) INTO v_monthly_jobs
      FROM public.orders
     WHERE consumer_id = v_consumer.id
       AND status = 'COMPLETED';

    IF v_monthly_jobs % 3 = 1 THEN
      v_micro_reward := 0.100;
    ELSIF v_monthly_jobs % 3 = 2 THEN
      v_micro_reward := 0.200;
    ELSE
      v_micro_reward := 0.300;
    END IF;

    INSERT INTO public.bonus_credit_entries (
      user_id, amount, remaining_amount, min_order_amount, source, order_id, expires_at
    ) VALUES (
      v_consumer.id,
      v_micro_reward,
      v_micro_reward,
      0.000,
      'POST_JOB_MICRO_REWARD',
      p_order_id,
      v_now + (v_cfg.micro_reward_expiry_days || ' days')::INTERVAL
    );

    UPDATE public.users
       SET bonus_credit_wallet = bonus_credit_wallet + v_micro_reward,
           updated_at = v_now
     WHERE id = v_consumer.id;

    -- 8. Consumer Monthly Streak (1.000 OMR at 3 jobs in calendar month, 14-day expiry)
    SELECT COUNT(*) INTO v_monthly_jobs
      FROM public.orders
     WHERE consumer_id = v_consumer.id
       AND status = 'COMPLETED'
       AND completed_at >= date_trunc('month', v_now);

    IF v_monthly_jobs = v_cfg.streak_jobs_threshold THEN
      INSERT INTO public.bonus_credit_entries (
        user_id, amount, remaining_amount, min_order_amount, source, order_id, expires_at
      ) VALUES (
        v_consumer.id,
        v_cfg.streak_reward_credit, -- 1.000 OMR
        v_cfg.streak_reward_credit,
        0.000,
        'MONTHLY_STREAK_3',
        p_order_id,
        v_now + (v_cfg.streak_reward_expiry_days || ' days')::INTERVAL
      );

      UPDATE public.users
         SET bonus_credit_wallet = bonus_credit_wallet + v_cfg.streak_reward_credit,
             updated_at = v_now
       WHERE id = v_consumer.id;

      v_streak_granted := true;
    END IF;
  END IF;

  -- 9. Record public social proof activity
  INSERT INTO public.activity_events (event_type, area, anonymized_title)
  VALUES (
    'JOB_COMPLETED',
    'Salalah',
    'Completed ' || COALESCE(v_order.category_id, 'repair') || ' (' || v_order.amount::TEXT || ' OMR Protected Job Pay Released)'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'job_amount_omr', v_order.amount,
    'applied_fee_rate', v_fee_rate,
    'platform_cut_omr', v_platform_cut,
    'vendor_payout_omr', v_vendor_payout,
    'referral_commission_omr', v_referral_commission,
    'micro_reward_omr', v_micro_reward,
    'streak_granted', v_streak_granted,
    'v2v_boost_granted', v_v2v_boost_granted
  );
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- RPC 6: auto_confirm_completed_orders()
-- 24-Hour Auto-Confirm Worker:
-- Finds orders in AWAITING_PHOTOS where after_photo_uploaded_at >= 24h ago
-- and no dispute is open. Automatically calls complete_and_release_order().
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_confirm_completed_orders()
RETURNS JSONB AS $$
DECLARE
  v_cfg RECORD;
  v_rec RECORD;
  v_count INT := 0;
  v_results JSONB := '[]'::jsonb;
  v_res JSONB;
BEGIN
  SELECT * INTO v_cfg FROM public.platform_config WHERE id = 1;

  FOR v_rec IN
    SELECT id
      FROM public.orders
     WHERE status = 'AWAITING_PHOTOS'
       AND after_photo_uploaded_at IS NOT NULL
       AND after_photo_uploaded_at <= now() - (v_cfg.auto_confirm_hours || ' hours')::INTERVAL
       AND is_disputed = false
     ORDER BY after_photo_uploaded_at ASC
     LIMIT 50
  LOOP
    v_res := public.complete_and_release_order(v_rec.id);
    IF (v_res->>'ok')::BOOLEAN = true THEN
      v_count := v_count + 1;
      v_results := v_results || jsonb_build_object('order_id', v_rec.id, 'payout', v_res->>'vendor_payout_omr');
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'confirmed_count', v_count,
    'orders', v_results
  );
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- RPC 7: file_warranty_claim(p_order_id, p_description)
-- Files a warranty claim within agreed_warranty_days without freezing cash.
-- Gives vendor 24 hours to respond or repair.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.file_warranty_claim(
  p_order_id UUID,
  p_description TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_cfg RECORD;
  v_order RECORD;
  v_now TIMESTAMPTZ := now();
  v_deadline TIMESTAMPTZ;
  v_claim_id UUID;
BEGIN
  SELECT * INTO v_cfg FROM public.platform_config WHERE id = 1;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found');
  END IF;

  IF v_order.status != 'COMPLETED' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Warranty claims only apply to completed orders');
  END IF;

  -- Check if within agreed warranty days
  IF v_now > (v_order.completed_at + (v_order.agreed_warranty_days || ' days')::INTERVAL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Warranty period (' || v_order.agreed_warranty_days || ' days) has expired');
  END IF;

  v_deadline := v_now + (v_cfg.warranty_response_window_hours || ' hours')::INTERVAL;

  INSERT INTO public.warranty_claims (
    order_id, vendor_id, consumer_id, claim_reason, claim_deadline, created_at
  ) VALUES (
    p_order_id, v_order.vendor_id, v_order.consumer_id, p_description, v_deadline, v_now
  ) RETURNING id INTO v_claim_id;

  UPDATE public.orders
     SET is_disputed = true,
         updated_at = v_now
   WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'ok', true,
    'claim_id', v_claim_id,
    'order_id', p_order_id,
    'claim_deadline', v_deadline,
    'response_window_hours', v_cfg.warranty_response_window_hours
  );
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- RPC 8: apply_warranty_strike(p_claim_id)
-- Strike & Lockout Algorithm:
-- If vendor ignores valid warranty claim past 24 hours:
-- 1. Increment vendor strikes
-- 2. Suspend bidding (bidding_suspended = true)
-- 3. At 3 strikes, permanently ban account and blacklist phone & device fingerprint
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_warranty_strike(p_claim_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_cfg RECORD;
  v_claim RECORD;
  v_vendor RECORD;
  v_now TIMESTAMPTZ := now();
  v_new_strikes INT;
  v_is_banned BOOLEAN := false;
BEGIN
  SELECT * INTO v_cfg FROM public.platform_config WHERE id = 1;
  SELECT * INTO v_claim FROM public.warranty_claims WHERE id = p_claim_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Warranty claim not found');
  END IF;

  IF v_claim.status != 'OPEN' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Claim is not in OPEN status');
  END IF;

  SELECT * INTO v_vendor FROM public.vendors WHERE id = v_claim.vendor_id FOR UPDATE;

  v_new_strikes := v_vendor.strikes + 1;
  v_is_banned := (v_new_strikes >= v_cfg.max_warranty_strikes);

  UPDATE public.vendors
     SET strikes = v_new_strikes,
         bidding_suspended = true,
         is_banned = v_is_banned,
         updated_at = v_now
   WHERE id = v_vendor.id;

  UPDATE public.warranty_claims
     SET status = 'STRIKE_ISSUED',
         resolved_at = v_now
   WHERE id = p_claim_id;

  -- If permanently banned, blacklist all associated device fingerprints
  IF v_is_banned THEN
    UPDATE public.device_fingerprints
       SET is_banned = true,
           ban_reason = 'Exceeded 3 warranty non-compliance strikes'
     WHERE user_id = v_vendor.user_id OR phone = v_vendor.phone;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'claim_id', p_claim_id,
    'vendor_id', v_vendor.id,
    'new_strikes', v_new_strikes,
    'bidding_suspended', true,
    'is_banned', v_is_banned
  );
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- RPC 9: sweep_expired_bonus_credits()
-- Sweeps expired bonus credit entries and syncs users.bonus_credit_wallet
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sweep_expired_bonus_credits()
RETURNS JSONB AS $$
DECLARE
  v_count INT := 0;
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    UPDATE public.bonus_credit_entries
       SET is_expired = true,
           remaining_amount = 0.000
     WHERE is_expired = false
       AND expires_at <= now()
     RETURNING user_id
  LOOP
    v_count := v_count + 1;
  END LOOP;

  -- Recompute bonus_credit_wallet sum for affected users
  UPDATE public.users u
     SET bonus_credit_wallet = COALESCE(
       (SELECT SUM(remaining_amount) 
          FROM public.bonus_credit_entries b 
         WHERE b.user_id = u.id 
           AND b.is_expired = false 
           AND b.expires_at > now()),
       0.000
     );

  RETURN jsonb_build_object('ok', true, 'expired_entries_swept', v_count);
END;
$$ LANGUAGE plpgsql;
