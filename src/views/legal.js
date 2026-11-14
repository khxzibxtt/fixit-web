/**
 * Pure-JS informational, partner, and enterprise-grade legal pages:
 * (/services, /partner, /about, /terms, /privacy, /cookies, /refunds, /aup, /disclaimer, /delete-account, /warranty).
 * Grounded in full codebase technical & data audit. Zero emojis, zero speculative OMR figures, zero banned strings.
 */

const { ICONS, renderPage } = require("./layout");

const ALL_SERVICE_SCOPES = [
  ["AC Repair & HVAC", ["Gas refill check", "Split AC deep clean", "Thermostat & sensor", "Compressor repair"]],
  ["Electrical", ["Breaker panel reset", "Short circuit tracing", "Wall outlets & switches", "Water heater wiring"]],
  ["Plumbing", ["Pipe leak seal", "Water pump repair", "Tank float valve", "Sink & drain clearing"]],
  ["Salalah Taxi", ["Point-to-point ride", "Airport transfer", "Family Van booking", "Instant city trip"]],
  ["Roadside Breakdown", ["Battery jump-start", "Emergency fuel/lockout", "On-site diagnostics", "Quick electrical start"]],
  ["Flatbed Tow Truck", ["Sedan recovery", "4x4 / SUV transport", "Industrial workshop drop", "Long-distance recovery"]],
  ["Car Mechanic", ["No-start troubleshooting", "Brakes & pads", "Engine light scan", "Alternator & starter"]],
  ["Tire & Puncture", ["Flat tire plug/patch", "Spare wheel swap", "Valve stem replacement", "Mobile inflation"]],
  ["Home Cleaning", ["Deep home clean", "Post-renovation clean", "Sofa & carpet wash", "Move-in preparation"]],
  ["Movers & Pickup", ["Furniture shifting", "Appliance hauling", "Packing & loading", "Salalah city pickup"]],
  ["Carpentry", ["Door & lock alignment", "Wardrobe & hinges", "Custom shelving", "Wooden frame repair"]],
  ["Painting", ["Interior room coat", "Crack & damp putty", "Exterior refresh", "Moisture-seal primer"]],
  ["Pest Control", ["Cockroach & ant gel", "Termite barrier", "Outdoor garden spray", "Follow-up visit"]],
  ["Locksmith", ["Home door unlock", "Cylinder replacement", "Car key lockout", "Smart lock setup"]],
  ["Home Appliances", ["Washing machine repair", "Fridge & freezer", "Oven & cooker", "Microwave servicing"]],
  ["Water & Gas", ["Potable water tanker", "Cooking gas refill", "Tank refill delivery", "Urgent dispatch"]]
];

function servicesPage() {
  const body = `
    <section class="fx-section" style="padding-top:38px">
      <div class="fx-wrap">
        <span class="fx-pill">${ICONS.wrench}<span>16 Verified Categories · App-Exclusive Quotes</span></span>
        <h1 class="fx-h1" style="font-size:36px">Service Categories &amp; Job Scopes</h1>
        <p class="fx-lead">
          Every home, vehicle, or breakdown job is unique. Define your exact scope inside the FixIt app so nearby technicians can send accurate custom offers without fixed web estimates.
        </p>

        <div class="fx-grid-4">
          ${ALL_SERVICE_SCOPES.map(([title, items]) => `
            <div class="fx-card" style="display:flex;flex-direction:column;justify-content:space-between;gap:12px">
              <div>
                <h3 style="margin:0 0 10px;font-size:16px;font-weight:800">${title}</h3>
                <ul style="margin:0;padding-left:18px;font-size:13.5px;color:var(--mu);display:flex;flex-direction:column;gap:4px">
                  ${items.map(it => `<li>${it}</li>`).join("")}
                </ul>
              </div>
              <a href="/open?screen=book" style="font-size:13px;font-weight:700;color:var(--o);display:inline-flex;align-items:center;gap:4px">
                <span>Book scope in app</span>
                ${ICONS.arrowRight}
              </a>
            </div>
          `).join("")}
        </div>
      </div>
    </section>
  `;
  return renderPage({
    title: "100+ On-Demand Services in Salalah & Dhofar",
    description: "Browse 100+ verified home repair, Split AC servicing, electrical, plumbing, handyman, towing, and breakdown services with live pro quotes.",
    activePath: "/services",
    body
  });
}

function partnerPage() {
  const body = `
    <section class="fx-section" style="padding-top:38px">
      <div class="fx-wrap fx-grid-2">
        <div>
          <span class="fx-pill">${ICONS.wrench}<span>FixIt Pro · For Workshops &amp; Fleet Owners</span></span>
          <h1 class="fx-h1" style="font-size:36px">Grow your workshop across Salalah &amp; Oman.</h1>
          <p class="fx-lead">
            Receive real nearby repair requests with customer photos, videos, and pinned GPS coordinates. Quote only on the jobs that match your crew and Commercial Registration (CR).
          </p>
          <div style="display:flex;flex-wrap:wrap;gap:12px">
            <a href="/downloads/FixIt-Vendor.apk" class="fx-btn fx-btn-primary fx-btn-lg">
              ${ICONS.download}
              <span>Download FixIt Pro Vendor APK</span>
            </a>
            <a href="/support" class="fx-btn fx-btn-outline fx-btn-lg">
              ${ICONS.mail}
              <span>Partner Inquiry</span>
            </a>
          </div>
        </div>

        <div class="fx-card">
          <h3 style="margin:0 0 12px;font-size:18px">What Registered Partners Get</h3>
          <ul style="margin:0;padding-left:20px;color:var(--mu);display:flex;flex-direction:column;gap:10px;font-size:14.5px">
            <li>Live radar feed of customer repair scopes with GPS distance and photos.</li>
            <li>Commercial Registration (CR) verification and trade specialty filters.</li>
            <li>Direct in-app chat and WhatsApp arrival coordination with customers.</li>
            <li>Protected payments and digital before-and-after job photo verification.</li>
          </ul>
        </div>
      </div>
    </section>
  `;
  return renderPage({
    title: "Become a FixIt Pro Partner · Workshop & Technician Enrollment",
    description: "Join FixIt Pro in Salalah. Receive live customer repair scopes, dispatch technicians with GPS radar, and receive guaranteed digital payouts.",
    activePath: "/partner",
    body
  });
}

function aboutPage() {
  const body = `
    <section class="fx-section" style="padding-top:38px">
      <div class="fx-wrap" style="max-width:860px">
        <div class="fx-card" style="display:flex;align-items:center;gap:18px;margin-bottom:20px;padding:24px;background:linear-gradient(135deg,#FFF7ED,#FFFFFF);border:1.5px solid #FED7AA">
          <img src="/logo.png" alt="FixIt Oman Logo" style="width:76px;height:76px;border-radius:20px;object-fit:cover;box-shadow:0 8px 24px rgba(255,90,0,.22);flex-shrink:0" />
          <div>
            <span class="fx-pill" style="margin-bottom:6px">${ICONS.globe}<span>Salalah &amp; Dhofar, Sultanate of Oman</span></span>
            <h1 class="fx-h1" style="font-size:32px;margin:0">FixIt · فيكس إت</h1>
            <div style="font-size:13.5px;color:var(--mu);font-weight:700;margin-top:2px">https://fixit-now.xyz · Official On-Demand Maintenance &amp; Roadside Marketplace</div>
          </div>
        </div>
        <div class="fx-card" style="display:flex;flex-direction:column;gap:16px">
          <p style="margin:0;font-size:15.5px;color:var(--mu)">
            FixIt (fixit-now.xyz) is an independent mobile-first service marketplace connecting homeowners, tenants, and drivers across Salalah and the Governorate of Dhofar with verified local workshops, mechanics, and technicians.
          </p>
          <p style="margin:0;font-size:15.5px;color:var(--mu)">
            Unlike flat-rate directories, FixIt lets you describe the exact scope of work, attach live camera photos or video, and review multiple competitive quotes in Omani Rial before selecting a technician.
          </p>
          <div style="background:#FFF7ED;border:1px solid #FDBA74;border-radius:12px;padding:12px 14px;font-size:13.5px;color:#9A3412">
            <b>Independent Brand Notice:</b> FixIt is an independent Omani platform and is <b>NOT affiliated with, endorsed by, sponsored by, or connected in any kind of relation to Talabat, Delivery Hero SE, Uber</b>, or any other third-party delivery or ridesharing brand.
          </div>
          <div style="border-top:1px solid var(--line);padding-top:14px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;font-size:14px">
            <div><b>Service Region</b><br /><span style="color:var(--mu)">Salalah &amp; Governorate of Dhofar, Oman</span></div>
            <div><b>Official Care</b><br /><span style="color:var(--mu)">WhatsApp Care +968 9595 6361</span></div>
          </div>
        </div>
      </div>
    </section>
  `;
  return renderPage({
    title: "About FixIt Oman · Marketplace Standards & Mission",
    description: "Learn about FixIt (fixit-now.xyz), Oman's mobile-first maintenance marketplace connecting residents with licensed workshops in Salalah and Dhofar.",
    activePath: "/about",
    body
  });
}

function legalNavPills(activePath) {
  const links = [
    ["/terms", "Terms of Service"],
    ["/privacy", "Privacy Policy"],
    ["/cookies", "Cookie & Storage Policy"],
    ["/refunds", "Refund & Billing Policy"],
    ["/aup", "Acceptable Use Policy"],
    ["/disclaimer", "Disclaimers & Ads"],
    ["/delete-account", "Account Deletion"],
    ["/warranty", "14-Day Warranty"]
  ];
  return `
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">
      ${links.map(([href, label]) => `
        <a href="${href}" style="padding:7px 13px;border-radius:99px;font-size:12.5px;font-weight:700;text-decoration:none;border:1px solid ${activePath === href ? "#FF5A00" : "#CBD5E1"};background:${activePath === href ? "#FF5A00" : "#FFFFFF"};color:${activePath === href ? "#FFFFFF" : "#334155"}">${label}</a>
      `).join("")}
    </div>
  `;
}

function legalDocPage({ title, path, badge, subtitle, sections }) {
  const body = `
    <section class="fx-section" style="padding-top:38px">
      <div class="fx-wrap" style="max-width:920px">
        ${legalNavPills(path)}
        <span class="fx-pill">${ICONS.shield}<span>${badge}</span></span>
        <h1 class="fx-h1" style="font-size:34px;margin-bottom:8px">${title}</h1>
        ${subtitle ? `<p class="fx-lead" style="font-size:14px;margin-bottom:20px">${subtitle}</p>` : ""}
        <div class="fx-card" style="display:flex;flex-direction:column;gap:22px;padding:28px 24px">
          ${sections.map(([heading, copy]) => `
            <div style="border-bottom:1px solid #F1F5F9;padding-bottom:18px">
              <h2 style="margin:0 0 8px;font-size:17.5px;font-weight:800;color:#0F172A">${heading}</h2>
              <div style="margin:0;font-size:14.2px;line-height:1.68;color:#334155">${copy}</div>
            </div>
          `).join("")}
        </div>
      </div>
    </section>
  `;
  const defaultDesc = subtitle || `Review the official ${title} for FixIt Oman (fixit-now.xyz) on-demand service marketplace.`;
  return renderPage({ title, description: defaultDesc, activePath: path, body });
}

function termsPage() {
  return legalDocPage({
    title: "Terms of Service",
    path: "/terms",
    badge: "Master Platform Agreement · Sultanate of Oman",
    subtitle: "Effective Date: November 14, 2026 · Governing Jurisdiction: Salalah, Governorate of Dhofar, Sultanate of Oman",
    sections: [
      [
        "1. Acceptance of Terms, Eligibility & Legal Authority",
        `<p>These Terms of Service ("Terms", "Agreement") constitute a legally binding contract between you ("User", "Customer", "Consumer", "Vendor", "Partner", or "Technician") and FixIt Oman ("FixIt", "Platform", "we", "us", or "our"), operating the website <b>https://fixit-now.xyz</b> and the native Android mobile applications <b>FixIt</b> (package identifier <code>com.khxzi.fixit</code>) and <b>FixIt Pro</b> (package identifier <code>com.khxzi.fixitvendor</code>). By downloading, installing, accessing, browsing, registering for, or using any part of the Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms, our <a href="/privacy" style="color:#FF5A00;font-weight:700">Privacy Policy</a>, our <a href="/cookies" style="color:#FF5A00;font-weight:700">Cookie &amp; Local Storage Policy</a>, our <a href="/refunds" style="color:#FF5A00;font-weight:700">Refund &amp; Billing Policy</a>, and our <a href="/aup" style="color:#FF5A00;font-weight:700">Acceptable Use Policy</a>.</p>
         <p style="margin-top:8px"><b>Strict Age Eligibility (18+):</b> You must be at least eighteen (18) years of age and possess the legal authority, right, and capacity under the laws of the Sultanate of Oman (or your applicable home jurisdiction if visiting as an international tourist) to enter into binding contracts. If you are registering a workshop or business entity on FixIt Pro, you represent and warrant that you hold valid authority to bind that commercial entity and its Commercial Registration (CR) to these Terms.</p>`
      ],
      [
        "2. Explicit Non-Affiliation & Independent Brand Disclaimer",
        `<p><b>STRICT NON-AFFILIATION WITH TALABAT OR THIRD-PARTY BRANDS:</b> FixIt (<code>fixit-now.xyz</code>) is an independent Omani home maintenance, roadside assistance, and local service marketplace. <b>FixIt is NOT affiliated with, endorsed by, sponsored by, partnered with, owned by, or connected in ANY kind of relation whatsoever to Talabat, Delivery Hero SE, Uber Technologies Inc., Grab, Careem, or any other third-party food delivery, ridesharing, or marketplace company.</b> All third-party brand names or trademarks mentioned anywhere in comparative documentation belong solely to their respective owners.</p>`
      ],
      [
        "3. Account Registration, WhatsApp OTP, Google OAuth & Biometric Security",
        `<p>To book services as a Consumer or bid on jobs as a Vendor, you must establish an authenticated account through our Backend-for-Frontend (BFF) security gateway at <code>https://fixit-now.xyz</code>:</p>
         <ul style="margin:8px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
           <li><b>WhatsApp-Only One-Time Password (OTP) Verification:</b> Phone verification is performed exclusively via encrypted WhatsApp verification codes delivered to valid Omani mobile numbers (8-digit mobile numbers beginning with 7 or 9 under country code +968) or supported international tourist mobile numbers. Standard SMS and voice call OTP channels are permanently disabled. You are solely responsible for maintaining control over your WhatsApp account and mobile device.</li>
           <li><b>Google OAuth 2.0 Sign-In:</b> Users may authenticate using Google OAuth 2.0 (<code>/api/auth/google/start</code>, <code>/api/auth/google/callback</code>, and <code>/api/auth/google/exchange</code>). When signing in with Google, first-time users must complete phone number verification and profile onboarding before placing or accepting orders.</li>
           <li><b>Hardware Biometric &amp; Device Credential Login:</b> The Android applications support optional hardware-backed biometric authentication (fingerprint and facial recognition via Android <code>BiometricPrompt</code> and <code>KeyguardManager</code> device credentials). When enabled, a cryptographic 256-bit biometric token is stored inside private Android app storage (<code>SharedPreferences</code> mode private) and verified via SHA-256 hash matching against <code>/api/auth/biometric/login</code>. Biometric biometric templates never leave your device hardware.</li>
           <li><b>Session Integrity &amp; Automatic Over-The-Air (OTA) Updates:</b> Authenticated sessions issue rotating session codes (<code>fxs_*</code>) hashed with SHA-256 in our <code>auth_sessions</code> database table with a 30-day sliding window. Furthermore, the Android applications automatically synchronize verified Over-The-Air (OTA) interface bundles from <code>https://fixit-now.xyz/api/app/ota-bundle</code> directly into internal application storage so your app stays current without requiring manual APK re-installation.</li>
         </ul>`
      ],
      [
        "4. Description of Marketplace Service, Dual Consumer/Vendor Flows & Role Separation",
        `<p>FixIt provides a digital technology platform that enables two distinct, role-separated user journeys:</p>
         <ul style="margin:8px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
           <li><b>Consumer Flow:</b> Consumers select from sixteen (16) service categories (including AC Repair &amp; HVAC, Electrical, Plumbing, Salalah Taxi, Roadside Breakdown, Flatbed Tow Truck, Car Mechanic, Tire &amp; Puncture, Home Cleaning, Movers &amp; Pickup, Carpentry, Painting, Pest Control, Locksmith, Home Appliances, and Water &amp; Gas), describe their exact repair scope, attach live camera verification photos or video, pin their service address in Salalah or Dhofar, review custom bids submitted by nearby Vendors, complete in-app protected payment, track technician arrival, inspect before-and-after job photos, and rate completed work.</li>
           <li><b>Vendor (FixIt Pro) Flow:</b> Independent workshops and technicians complete Shop &amp; Commercial Registration (CR) onboarding, toggle their live radar availability, review nearby open repair leads sorted by distance and customer priority, submit competitive quotes in Omani Rial (to three decimal places), navigate to the customer location, upload mandatory Before Repair and After Repair camera photos, and receive net payouts into their Vendor wallet.</li>
           <li><b>Independent Contractor Relationship:</b> FixIt is a technology marketplace venue and is <b>not</b> an employer, general contractor, or carrier. All Vendors and Technicians operating on FixIt Pro act as independent contractors bearing sole legal and operational responsibility for their tools, licensing, safety practices, vehicles, and workmanship.</li>
         </ul>`
      ],
      [
        "5. Acceptable Use Policy & Prohibited Conduct",
        `<p>You agree to use the Platform strictly for lawful purposes in accordance with the laws of the Sultanate of Oman. You are strictly prohibited from engaging in any of the following activities (see also our standalone <a href="/aup" style="color:#FF5A00;font-weight:700">Acceptable Use Policy</a>):</p>
         <ul style="margin:8px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
           <li><b>Off-Platform Poaching &amp; Fee Circumvention:</b> Sharing telephone numbers, WhatsApp links, external payment links, or off-platform contact details inside pre-payment chat messages in an attempt to bypass FixIt checkout. Our deterministic anti-poaching filter (<code>sanitizePrePaymentChat</code>) automatically masks contact details prior to confirmed order payment.</li>
           <li><b>Fraudulent Verification Photos or GPS Spoofing:</b> Uploading stock images, pre-existing gallery screenshots where live camera capture is required, falsified Commercial Registration (CR) signboards, or manipulated GPS coordinates.</li>
           <li><b>Predatory Bid Dumping:</b> Submitting artificial low-ball bids below our statistical bid-floor guard (forty percent of the category median) with the intent to demand unapproved surcharges upon arrival.</li>
           <li><b>Multi-Account Promo Abuse:</b> Creating duplicate Consumer or Vendor accounts using multiple SIM cards or emulators to repeatedly claim launch promotions, referral credits, or discount vouchers (monitored via SHA-256 device and network fingerprinting).</li>
           <li><b>Unauthorized API Access, Scraping &amp; Privilege Escalation:</b> Attempting to access non-allowlisted database tables, spoofing session headers (<code>X-FixIt-Session</code> or <code>X-FixIt-Role</code>), modifying another user's records via <code>/api/app/rest/*</code>, reverse-engineering APK binaries, or launching automated denial-of-service floods against our endpoints.</li>
           <li><b>Harassment &amp; Unsafe Conduct:</b> Threatening, abusing, discriminating against, or endangering any customer, technician, or support representative.</li>
         </ul>`
      ],
      [
        "6. User-Generated Content, Verification Media & License Grant",
        `<p>When you upload or submit job scope descriptions, voice notes, repair videos, Before Repair and After Repair verification photographs (stored in <code>job_photos</code>), shop signboard photographs, chat messages (stored in <code>messages</code> and <code>chat_messages</code>), support tickets (<code>support_tickets</code>), or technician reviews (<code>reviews</code>) (collectively, "User-Generated Content" or "UGC"), you retain ownership of your original content.</p>
         <p style="margin-top:8px">By submitting UGC to the Platform, you grant FixIt a worldwide, non-exclusive, royalty-free, transferable, sub-licensable license to host, store, cache, reproduce, process, translate (including automated bilingual Arabic/English translation), display to matched Consumers/Vendors, and review such UGC for the purposes of operating the marketplace, verifying job completion, adjudicating 14-day warranty claims, enforcing platform safety, and complying with legal obligations. You warrant that you own or control all rights to the UGC you upload and that your UGC does not violate the privacy, publicity, or intellectual property rights of any third party.</p>`
      ],
      [
        "7. Intellectual Property Rights & Platform Feedback",
        `<p>All software, source code, deterministic dispatch and pricing engines (<code>pricingEngine.js</code>, <code>dispatchEngine.js</code>, <code>referralEngine.js</code>, <code>rewardEngine.js</code>), user interface layouts, native Android Java bridges (<code>MainActivity.java</code>, <code>FixItNotificationService.java</code>), visual assets, logos, and documentation on the Platform are the exclusive intellectual property of FixIt Oman and are protected by Omani and international copyright, trademark, and trade secret laws. Any suggestions, bug reports, or feature feedback you voluntarily submit may be used by FixIt without restriction or compensation.</p>`
      ],
      [
        "8. Fees, In-App Payments, Protected Payment Holds, Subscriptions & Refunds",
        `<p>All financial calculations on the Platform are denominated in Omani Rial to three decimal places (baisa precision) and processed through our in-app checkout and wallet ledger (<code>wallets</code> and <code>wallet_transactions</code>):</p>
         <ul style="margin:8px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
           <li><b>No Upfront Fee to Post a Job:</b> Consumers post repair scopes and receive Vendor quotes free of charge. Payment is collected only when the Consumer accepts a Vendor's bid.</li>
           <li><b>In-App PayPal Card &amp; Account Checkout:</b> Payments for accepted bids, wallet top-ups, and optional FixIt Pro memberships are processed directly inside the app via our server-side PayPal REST v2 payment gateway (<code>/api/payments/paypal/checkout</code>) using debit/credit cards (Visa, Mastercard, OmanNet) or linked PayPal accounts, or via existing FixIt Wallet balance, without redirecting you to an external web browser. FixIt never stores raw full card numbers (PAN) or CVV security codes on its servers.</li>
           <li><b>Protected Payment Hold &amp; 24-Hour Auto-Confirm:</b> When a Consumer pays for an accepted bid, funds are held in a Protected Payment state (<code>JOB_FUND_HOLD</code>). Once the Vendor completes the repair and uploads the mandatory After Repair photo, the Consumer may release the payment immediately or, if no dispute is filed within twenty-four (24) hours of After photo upload, our background worker (<code>autoConfirmCron.js</code>) automatically confirms completion and releases net earnings to the Vendor's wallet.</li>
           <li><b>Progressive Vendor Commission Ladder:</b> Vendor payouts are subject to FixIt's transparent progressive commission ladder calculated deterministically by <code>pricingEngine.js</code> based on job value and Partner tier.</li>
           <li><b>Optional FixIt Pro Membership &amp; One-Tap Cancellation:</b> Consumers may subscribe to FixIt Pro for instant member discounts and waived visit fees. You may cancel your FixIt Pro membership at any time with a single tap inside Account Settings or the Refund Policy screen with zero cancellation penalty. Full refund and warranty terms are detailed in our <a href="/refunds" style="color:#FF5A00;font-weight:700">Refund &amp; Billing Policy</a>.</li>
         </ul>`
      ],
      [
        "9. Third-Party Services, Subprocessors & A-Ads Advertising Disclosure",
        `<p>The Platform integrates carefully selected third-party infrastructure providers ("Subprocessors") to deliver core functionality, including Supabase (cloud PostgreSQL database), PayPal (payment processing), Google OAuth 2.0 (identity verification), OpenStreetMap / Leaflet / OSRM (interactive map tiles and routing), and MyMemory API (automated bilingual translation).</p>
         <p style="margin-top:8px"><b>Third-Party Advertisements (A-Ads):</b> To keep platform fees low and support our free-tier infrastructure, the Platform displays clearly labeled third-party advertisement banners powered by <b>A-Ads (Acceptable Ads / <code>acceptable.a-ads.com</code>, Ad Unit ID <code>2461953</code>)</b> inside a dedicated horizontal <b>"ADVERTISEMENT"</b> container. FixIt does not endorse, warrant, or guarantee any third-party product, service, or website advertised inside A-Ads banners. A-Ads operates as an independent privacy-focused ad network that does not use invasive personal tracking cookies. You may review the official A-Ads Terms of Service at <a href="https://aads.com/terms_of_service" target="_blank" rel="noopener noreferrer" style="color:#FF5A00;font-weight:700">https://aads.com/terms_of_service</a> and the A-Ads Privacy Policy at <a href="https://aads.com/privacy_policy" target="_blank" rel="noopener noreferrer" style="color:#FF5A00;font-weight:700">https://aads.com/privacy_policy</a>.</p>`
      ],
      [
        "10. Account Termination, Warranty Strikes & Suspension Rights",
        `<p>FixIt reserves the right, in its sole discretion, to suspend, restrict, lock, or permanently terminate your account or revoke your active sessions (<code>revokeSession</code>) immediately and without prior notice if: (a) you breach any provision of these Terms or our Acceptable Use Policy; (b) as a Vendor, you fail to respond to a verified 14-day warranty claim within the mandatory 24-hour response window or accumulate warranty strikes; (c) you initiate fraudulent payment chargebacks; or (d) we are required to do so by Omani law enforcement or regulatory authorities. You may also voluntarily request permanent account and data deletion at any time via in-app Settings or at <a href="/delete-account" style="color:#FF5A00;font-weight:700">https://fixit-now.xyz/delete-account</a>.</p>`
      ],
      [
        "11. Disclaimers of Warranties ('AS IS' and 'AS AVAILABLE')",
        `<p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW IN THE SULTANATE OF OMAN AND INTERNATIONALLY, THE FIXIT PLATFORM, MOBILE APPLICATIONS, WEBSITE, OVER-THE-AIR UPDATES, AND ALL RELATED SERVICES ARE PROVIDED ON AN <b>"AS IS"</b> AND <b>"AS AVAILABLE"</b> BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WITHOUT LIMITATION ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, OR UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE OPERATION.</p>
         <p style="margin-top:8px">WHILE FIXIT VERIFIES COMMERCIAL REGISTRATION (CR) DETAILS SUBMITTED BY PARTNER WORKSHOPS AND FACILITATES A 14-DAY WORKMANSHIP WARRANTY PROCESS, FIXIT DOES NOT WARRANT OR GUARANTEE THE QUALITY, SAFETY, TIMELINESS, LEGALITY, OR SUITABILITY OF ANY INDEPENDENT VENDOR, TECHNICIAN, OR CUSTOMER. ANY RELIANCE ON AUTOMATED BILINGUAL TRANSLATIONS OR DISTANCE ESTIMATES IS AT YOUR OWN RISK.</p>`
      ],
      [
        "12. Limitation of Liability & Indemnification",
        `<p><b>LIMITATION OF LIABILITY:</b> TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT SHALL FIXIT OMAN, ITS FOUNDERS, OPERATORS, AFFILIATES, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, GOODWILL, PROPERTY DAMAGE, OR PERSONAL INJURY ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE PLATFORM OR THE ACTIONS OR OMISSIONS OF ANY INDEPENDENT VENDOR OR CUSTOMER. IN ALL CASES, FIXIT'S AGGREGATE LIABILITY FOR ANY CLAIM SHALL NOT EXCEED THE TOTAL PLATFORM FEES ACTUALLY PAID BY YOU TO FIXIT FOR THE SPECIFIC ORDER GIVING RISE TO THE CLAIM OR ONE HUNDRED PERCENT REIMBURSEMENT OF THE DISPUTED ORDER AMOUNT HELD IN PROTECTED PAYMENT.</p>
         <p style="margin-top:8px"><b>INDEMNIFICATION:</b> You agree to defend, indemnify, and hold harmless FixIt Oman and its operators from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or connected with: (a) your use or misuse of the Platform; (b) repair services performed or requested by you; (c) your violation of these Terms or any applicable law; or (d) your User-Generated Content.</p>`
      ],
      [
        "13. Governing Law, Dispute Resolution & Exclusive Jurisdiction",
        `<p>These Terms and any dispute or claim arising out of or in connection with them or their subject matter shall be governed by and construed in accordance with the laws and Royal Decrees of the <b>Sultanate of Oman</b>. Before initiating formal legal proceedings, both parties agree to attempt good-faith informal resolution for at least fourteen (14) calendar days by contacting FixIt Support via our <a href="/support" style="color:#FF5A00;font-weight:700">Online Support Portal</a> or WhatsApp Care (+968 9595 6361). Any dispute that cannot be resolved amicably shall be subject to the exclusive jurisdiction of the competent courts of <b>Salalah, Governorate of Dhofar, Sultanate of Oman</b>.</p>`
      ],
      [
        "14. Severability, Waiver, Entire Agreement & Contact Information",
        `<p>If any provision of these Terms is held to be invalid or unenforceable by a court of competent jurisdiction, the remaining provisions shall remain in full force and effect. No waiver of any term shall be deemed a further or continuing waiver of such term. These Terms, together with the Privacy Policy, Cookie Policy, Refund Policy, Acceptable Use Policy, and 14-Day Warranty Policy, constitute the entire agreement between you and FixIt regarding the Platform.</p>
         <p style="margin-top:8px"><b>Official Contact Channels:</b><br />
         Platform Domain: <code>https://fixit-now.xyz</code><br />
         Online Support &amp; Legal Desk: <a href="/support" style="color:#FF5A00;font-weight:700">https://fixit-now.xyz/support</a><br />
         Direct WhatsApp Care: <a href="https://wa.me/96895956361" target="_blank" rel="noopener noreferrer" style="color:#15803D;font-weight:700">+968 9595 6361</a><br />
         Operations Hub: Salalah, Governorate of Dhofar, Sultanate of Oman</p>`
      ]
    ]
  });
}

function privacyPage() {
  return legalDocPage({
    title: "Privacy Policy & Technical Data Audit",
    path: "/privacy",
    badge: "Oman PDPL (Royal Decree 6/2022) · GDPR · CCPA · Google Play Data Safety",
    subtitle: "Last Updated: November 14, 2026 · Complete Technical & Subprocessor Disclosure for FixIt (com.khxzi.fixit) and FixIt Pro (com.khxzi.fixitvendor)",
    sections: [
      [
        "1. Introduction, Data Controller & Scope",
        `<p>FixIt Oman ("FixIt", "we", "us", or "our"), operating <b>https://fixit-now.xyz</b> and the Android mobile applications <b>FixIt</b> (<code>com.khxzi.fixit</code>) and <b>FixIt Pro</b> (<code>com.khxzi.fixitvendor</code>), is committed to full transparency and strict data protection in compliance with the Sultanate of Oman Personal Data Protection Law (Royal Decree No. 6/2022), the EU General Data Protection Regulation (GDPR), the California Consumer Privacy Act (CCPA), and Google Play Store Data Safety requirements.</p>
         <p style="margin-top:8px"><b>Independent Entity Notice:</b> FixIt is an independent platform and is <b>not affiliated in any way with Talabat, Delivery Hero SE, or Uber</b>. This Privacy Policy details every database table, authentication token, device permission, local storage key, and third-party subprocessor present in our production codebase.</p>`
      ],
      [
        "2. Information We Collect (Grounded in Our Database Schema & Codebase)",
        `<p>We collect only the minimum personal and technical data necessary to authenticate users, dispatch nearby technicians, verify workmanship, and process payments:</p>
         <p style="margin-top:8px"><b>2.1 Information You Provide Directly (Database Tables):</b></p>
         <ul style="margin:6px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:5px">
           <li><b>Account &amp; Profile Records (<code>users</code>, <code>user_settings</code>):</b> Full name, verified phone number (E.164 format, e.g., +968XXXXXXXX), email address, account role (<code>consumer</code>, <code>vendor</code>), preferred language (Arabic or English), optional date of birth, optional gender, profile avatar image, and explicit consent flags (18+ age confirmation, optional offers/newsletter opt-in, and biometric key metadata).</li>
           <li><b>Service Addresses &amp; Pinned Locations (<code>user_addresses</code>):</b> Address label (Apartment, Villa, Office), neighborhood/area name in Salalah/Dhofar, building/floor/street details, and PostGIS EWKB geographic coordinates (<code>lat</code>, <code>lng</code>, <code>geom</code>).</li>
           <li><b>Repair Scopes, Bids &amp; Verification Media (<code>jobs</code>, <code>bids</code>, <code>job_photos</code>, <code>reviews</code>):</b> Service category ID, written repair description, customer and vendor Before Repair and After Repair camera photos (<code>CUSTOMER_BEFORE</code>, <code>VENDOR_BEFORE</code>, <code>VENDOR_AFTER</code>, <code>CUSTOMER_AFTER</code>), optional short repair videos, bid amounts, and post-job star ratings and written reviews.</li>
           <li><b>Vendor Shop &amp; Commercial Registration Data (<code>vendor_profiles</code>, <code>vendor_availability</code>):</b> Workshop name, Commercial Registration (CR) number, branch area, trade activities, shop signboard verification photo, and live online/offline availability status.</li>
           <li><b>In-App Communications &amp; Support (<code>messages</code>, <code>chat_messages</code>, <code>support_tickets</code>, <code>support_messages</code>):</b> Order coordination messages between Consumer and Vendor, and customer care inquiries submitted via the app or website support form.</li>
           <li><b>Wallet &amp; Transaction Ledger (<code>wallets</code>, <code>wallet_transactions</code>, <code>coupons</code>, <code>referrals</code>):</b> Wallet balance, protected payment holds, transaction references, PayPal order IDs, last-4 digits and card brand of used payment cards (never full card numbers or CVV), applied voucher codes, and referral attribution codes.</li>
         </ul>
         <p style="margin-top:10px"><b>2.2 Information Collected Automatically:</b></p>
         <ul style="margin:6px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:5px">
           <li><b>Foreground GPS Coordinates:</b> Collected via Android <code>ACCESS_FINE_LOCATION</code> and <code>ACCESS_COARSE_LOCATION</code> only when you pin a service address, calculate distance to nearby jobs, or share live technician arrival location.</li>
           <li><b>Session, Device &amp; Security Audit Metadata (<code>auth_sessions</code>, <code>user_devices</code>):</b> Device identifier (<code>device_id</code>), SHA-256 hashed session token (<code>refresh_token_hash</code>), IP address, user-agent string, and request timestamps to prevent unauthorized access and enforce rate limiting.</li>
           <li><b>Website Support Intake Security Telemetry (<code>ipDetector.js</code>):</b> When you submit a web support ticket on <code>/support</code> or <code>/contact</code>, our server records request IP, approximate city/region/country, ISP/network name, and browser/OS headers solely to block automated spam and assist our support team. This network telemetry is never displayed on user-facing app screens.</li>
         </ul>
         <p style="margin-top:10px"><b>2.3 Information from Third Parties:</b></p>
         <ul style="margin:6px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:5px">
           <li><b>Google OAuth 2.0:</b> If you choose "Continue with Google", we receive your verified Google email address, display name, profile picture URL, and Google account subject identifier (<code>sub</code>).</li>
           <li><b>PayPal Payment Confirmation:</b> When you complete an in-app payment via <code>/api/payments/paypal/checkout</code>, we receive payment authorization status and the PayPal transaction reference ID.</li>
         </ul>`
      ],
      [
        "3. How & Why We Use Your Information (Legal Bases)",
        `<p>We process your information under the following legal bases under Omani PDPL and GDPR Article 6:</p>
         <ul style="margin:8px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
           <li><b>Contractual Necessity:</b> To authenticate your account via WhatsApp OTP, Google OAuth, or hardware biometrics; match Consumers with nearby Vendors; calculate road distances; process in-app payments and vendor payouts; and administer the 14-Day Workmanship Warranty.</li>
           <li><b>Legitimate Interests &amp; Platform Security:</b> To enforce per-user ownership access controls on <code>/api/app/rest/:table</code>, prevent multi-account promo abuse via SHA-256 fingerprinting, filter pre-payment off-platform poaching attempts, and maintain server uptime.</li>
           <li><b>Explicit Consent:</b> For optional marketing offers, email newsletters, precise GPS location access, camera/microphone capture, and biometric login enrollment (all revocable at any time in device or app Settings).</li>
           <li><b>Legal Compliance:</b> To maintain financial transaction records and respond to lawful requests from competent Omani authorities.</li>
         </ul>`
      ],
      [
        "4. How We Share & Disclose Information (Complete Subprocessor Audit & A-Ads Links)",
        `<p><b>WE DO NOT SELL YOUR PERSONAL DATA.</b> We share limited data strictly with the following technical subprocessors integrated into our codebase:</p>
         <ul style="margin:8px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:8px">
           <li><b>1. Supabase Inc. (Cloud PostgreSQL Database &amp; Storage):</b> Hosts our encrypted database tables over HTTPS/TLS. Only our backend gateway (<code>fixit-now.xyz</code>) holds the service key; no database credentials ship inside our Android APKs.</li>
           <li><b>2. WhatsApp / Baileys Encrypted Socket (<code>whatsappWeb.js</code> &amp; <code>otp.js</code>):</b> Delivers bilingual Arabic/English 6-digit One-Time Passwords (OTPs) directly to your WhatsApp number during sign-in.</li>
           <li><b>3. Google LLC (Google OAuth 2.0 &amp; Map Tiles):</b> Processes optional Google Sign-In authentication and serves map tiles for pinning service locations.</li>
           <li><b>4. PayPal Holdings Inc. (In-App Payment Gateway):</b> Processes in-app card and PayPal payments via <code>/api/payments/paypal/checkout</code>. Raw card numbers and CVV codes are never stored in FixIt databases.</li>
           <li><b>5. OpenStreetMap, Leaflet &amp; OSRM:</b> Renders interactive street maps and calculates driving routes between Technicians and Consumers in Salalah.</li>
           <li><b>6. MyMemory Translation API:</b> Translates repair descriptions and chat strings between Arabic and English so Arabic-speaking and English-speaking users and technicians can communicate seamlessly.</li>
           <li><b>7. A-Ads / Acceptable Ads (<code>acceptable.a-ads.com</code>, Unit ID <code>2461953</code>):</b> Displays clearly marked third-party advertisement banners inside a horizontal <b>"ADVERTISEMENT"</b> block within the app and website. A-Ads is our external advertising provider and does not receive your FixIt name, phone number, email, or GPS coordinates, nor does it use invasive behavioral tracking cookies. You can review the official A-Ads Privacy Policy at <a href="https://aads.com/privacy_policy" target="_blank" rel="noopener noreferrer" style="color:#FF5A00;font-weight:700">https://aads.com/privacy_policy</a> and the A-Ads Terms of Service at <a href="https://aads.com/terms_of_service" target="_blank" rel="noopener noreferrer" style="color:#FF5A00;font-weight:700">https://aads.com/terms_of_service</a>.</li>
         </ul>`
      ],
      [
        "5. Cookies, Local Storage, IndexedDB & SWR Cache Keys",
        `<p>The FixIt website does not set third-party behavioral tracking cookies. Inside the FixIt and FixIt Pro Android applications, we use local device storage (<code>localStorage</code>, <code>IndexedDB</code> database <code>fixit_v3_db</code>, and private Android <code>SharedPreferences</code>) strictly for essential session persistence, Stale-While-Revalidate (SWR) 0ms startup caching, and offline retry queues. Exact keys include <code>fx3_*_auth_state</code>, <code>fx3_*_profile</code>, <code>fx3_*_jobs</code>, <code>fx3_*_bids</code>, <code>fx3_*_addresses</code>, <code>fx3_*_wallet</code>, <code>fx3_*_txns</code>, <code>fx3_*_bgQueue</code>, <code>fx3_bio_enabled_*</code>, and <code>fixit_bio_vault</code>. Full technical details are listed in our <a href="/cookies" style="color:#FF5A00;font-weight:700">Cookie &amp; Storage Policy</a>.</p>`
      ],
      [
        "6. Data Retention Schedules & Security Architecture",
        `<p><b>Data Retention:</b> Active account profiles and saved addresses are retained while your account remains active. Job verification photos (<code>job_photos</code>) and chat logs are retained for the 14-day warranty period plus ninety (90) days for dispute resolution. Financial ledger entries (<code>wallet_transactions</code>) are retained as required by Omani commercial and tax regulations. Expired OTP codes are purged from memory immediately upon verification or after ten (10) minutes.</p>
         <p style="margin-top:8px"><b>Security Measures:</b> All network traffic is encrypted via HTTPS/TLS (with <code>android:usesCleartextTraffic="false"</code> enforced in all Android manifests). Session tokens and biometric tokens are hashed using SHA-256 before database storage, pending onboarding tokens are signed with HMAC-SHA256, and every <code>/api/app/rest/:table</code> request enforces strict per-user ownership and role validation. In the event of a confirmed personal data breach, we notify affected users and competent authorities within seventy-two (72) hours.</p>`
      ],
      [
        "7. International Data Transfers",
        `<p>While FixIt operates primarily in Salalah and the Governorate of Dhofar, Sultanate of Oman, our cloud hosting and database infrastructure (Render Frankfurt EU region and Supabase cloud infrastructure) processes data on secure servers located outside Oman. By using the Platform, you consent to the encrypted transfer and processing of your data across these secure cloud regions under standard contractual and technical safeguards.</p>`
      ],
      [
        "8. Your Privacy Rights, JSON Data Export & Account Deletion Controls",
        `<p>Under Omani Royal Decree 6/2022, GDPR, and CCPA, you have the right to access, rectify, export, restrict, or permanently delete your personal data:</p>
         <ul style="margin:8px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
           <li><b>Instant Profile Editing:</b> Update your name, email, language, and consent preferences anytime under <b>Account &rarr; Account Info</b>.</li>
           <li><b>One-Tap JSON Data Portability Export:</b> Export a complete machine-readable JSON archive of your profile, addresses, orders, wallet, and consent settings inside the app.</li>
           <li><b>Biometric Revocation:</b> Disable Fingerprint &amp; Face Login in one tap under <b>Settings</b>, which immediately wipes your device vault and calls <code>/api/auth/biometric/revoke</code>.</li>
           <li><b>Permanent Account &amp; Data Deletion:</b> Tap <b>"Request Account &amp; Data Deletion"</b> inside the app under <b>Account Info</b>, or submit a web deletion request without opening the app at <a href="/delete-account" style="color:#FF5A00;font-weight:700">https://fixit-now.xyz/delete-account</a>. Verified deletion requests permanently erase your personal profile, addresses, sessions, and biometric tokens within thirty (30) days.</li>
         </ul>`
      ],
      [
        "9. Children's Privacy (Strict 18+ Mandate & COPPA)",
        `<p>FixIt is strictly intended for adults aged eighteen (18) and older. We do not knowingly collect, solicit, or process personal information from anyone under the age of 18 (or under 13 under COPPA). If we discover that an account has been created by a minor, we will immediately terminate the account and purge all associated personal data.</p>`
      ],
      [
        "10. Changes to This Policy & Data Protection Contact",
        `<p>We may update this Privacy Policy periodically to reflect new features or regulatory requirements. Material updates will be posted at <code>https://fixit-now.xyz/privacy</code> and inside the mobile apps with an updated effective date. For any privacy inquiry, data access request, or deletion request, contact our Data Protection Desk via <a href="/support" style="color:#FF5A00;font-weight:700">https://fixit-now.xyz/support</a> or WhatsApp Care at <a href="https://wa.me/96895956361" target="_blank" rel="noopener noreferrer" style="color:#15803D;font-weight:700">+968 9595 6361</a>.</p>`
      ]
    ]
  });
}

function cookiesPage() {
  return legalDocPage({
    title: "Cookie, LocalStorage & SWR Cache Policy",
    path: "/cookies",
    badge: "Technical Storage Disclosure · GDPR & ePrivacy",
    subtitle: "Exact client storage keys, session tokens, and third-party ad banner disclosures for FixIt Web & Android.",
    sections: [
      [
        "1. Zero Behavioral Tracking Cookies on FixIt Web",
        `<p>The FixIt informational website (<code>https://fixit-now.xyz</code>) does not set first-party or third-party behavioral advertising cookies, cross-site tracking pixels, or browser fingerprinting scripts.</p>`
      ],
      [
        "2. LocalStorage & IndexedDB Keys Inside the FixIt Apps",
        `<p>Inside the FixIt Consumer and FixIt Pro Vendor apps, we use HTML5 <code>localStorage</code> and <code>IndexedDB</code> (database name <code>fixit_v3_db</code>, object store <code>kv</code>) scoped per user ID and role exclusively to provide 0ms Stale-While-Revalidate (SWR) startup speed and offline resilience:</p>
         <ul style="margin:8px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
           <li><code>fx3_{role}_{userId}_auth_state</code>: Stores your active session code (<code>fxs_*</code>), session expiration timestamp, verified phone number, and onboarding state.</li>
           <li><code>fx3_{role}_{userId}_profile</code> &amp; <code>addresses</code>: Caches your display name, language preference (<code>fx3_lang</code>), consent toggles, and saved Salalah service addresses.</li>
           <li><code>fx3_{role}_{userId}_jobs</code>, <code>bids</code>, <code>photos</code>, <code>wallet</code>, <code>txns</code>: Caches your active orders, quotes, and wallet history for instant offline viewing.</li>
           <li><code>fx3_{role}_{userId}_bgQueue</code>: Stores pending offline mutations so actions automatically sync when mobile connectivity returns.</li>
           <li><code>fx3_bio_enabled_{role}</code> &amp; Android <code>fixit_bio_vault</code>: Tracks whether hardware biometric sign-in is enabled on your device and stores your encrypted biometric token in private Android storage.</li>
         </ul>`
      ],
      [
        "3. A-Ads Banner Framing Disclosure",
        `<p>Our embedded ad banner (<code>/ad.html</code> and in-app <code>.fx-ad-slot</code> containers) loads unit <code>2461953</code> from <code>https://acceptable.a-ads.com</code> inside a sandboxed iframe with a horizontal <b>"ADVERTISEMENT"</b> backing block. A-Ads is specifically chosen because it operates without invasive personal tracking cookies. Review A-Ads policies at <a href="https://aads.com/privacy_policy" target="_blank" rel="noopener noreferrer" style="color:#FF5A00;font-weight:700">https://aads.com/privacy_policy</a>.</p>`
      ]
    ]
  });
}

function refundsPage() {
  return legalDocPage({
    title: "Refund, Cancellation & Subscription Billing Policy",
    path: "/refunds",
    badge: "Protected Payments · Fair Cancellation · 14-Day Warranty",
    subtitle: "Clear rules governing order cancellations, Protected Payment releases, FixIt Pro subscriptions, and warranty claims.",
    sections: [
      [
        "1. Free Order Cancellation Before Work Begins (100% Refund)",
        `<p>Consumers may cancel an open job request at any time before accepting a Vendor's bid at zero cost. If you have already accepted a bid and completed in-app payment, you may still cancel for a full one hundred percent refund to your FixIt Wallet or original payment method at any time <b>before</b> the assigned technician arrives and starts the repair (status <code>IN_PROGRESS</code>).</p>`
      ],
      [
        "2. Protected Payment Hold & Completion Verification",
        `<p>When you pay for an accepted quote via In-App PayPal Card/Account Checkout or FixIt Wallet, your payment is held safely in a Protected Payment state. Funds are only released to the Vendor after: (a) the Vendor uploads the mandatory Before Repair and After Repair camera verification photos and you confirm job completion, or (b) twenty-four (24) hours elapse after the After Repair photo is uploaded without a dispute being opened.</p>`
      ],
      [
        "3. 14-Day Workmanship Warranty & Dispute Refunds",
        `<p>Every repair booked and paid inside the FixIt app includes our 14-Day Workmanship Warranty against repeat defects in the same repaired component. If the issue recurs within 14 days, submit a warranty claim with photo evidence via the in-app Support Center. The assigned Vendor has twenty-four (24) hours to arrange a free warranty revisit; if the Vendor fails to resolve a verified defect, FixIt Support will issue a wallet credit, refund, or replacement technician dispatch.</p>`
      ],
      [
        "4. FixIt Pro Membership Billing & Instant One-Tap Cancellation",
        `<p>Optional FixIt Pro memberships provide instant member discounts on accepted quotes and waived visit fees. You may cancel your FixIt Pro membership at any time with a single tap inside <b>Settings &rarr; Cancel FixIt Pro Membership</b> or inside the in-app Refund Policy screen. Cancellation takes effect immediately with zero penalty and no future recurring charges.</p>`
      ]
    ]
  });
}

function aupPage() {
  return legalDocPage({
    title: "Acceptable Use Policy (AUP)",
    path: "/aup",
    badge: "Platform Integrity & Safety Rules",
    subtitle: "Mandatory conduct standards for all Consumers, Vendors, Workshops, and Visitors on FixIt.",
    sections: [
      [
        "1. Prohibited Marketplace Manipulation & Off-Platform Poaching",
        `<p>Users must not use FixIt to solicit off-platform cash transactions after matching through the Platform, exchange masked phone numbers in pre-payment chat, submit fake bids, or manipulate technician ratings and reviews (strictly one verified review is permitted per completed order).</p>`
      ],
      [
        "2. Prohibited Technical & Security Abuse",
        `<p>Users must not probe, scan, or test the vulnerability of <code>fixit-now.xyz</code>, attempt to bypass <code>requireAppSession</code> or <code>/api/app/rest/:table</code> ownership rules, send automated OTP floods, or upload malicious payloads, scripts, or unlawful media.</p>`
      ],
      [
        "3. Commercial Registration (CR) & Field Safety Compliance",
        `<p>Vendors must maintain accurate Commercial Registration (CR) records, perform only trade categories they are qualified to handle, capture authentic on-site Before and After photos, and treat customer homes, vehicles, and property in Salalah and Dhofar with professional care.</p>`
      ]
    ]
  });
}

function disclaimerPage() {
  return legalDocPage({
    title: "Platform, Advertising & Non-Affiliation Disclaimers",
    path: "/disclaimer",
    badge: "Important Legal Notices",
    subtitle: "Non-affiliation with third-party brands, third-party advertisement disclosures, and automated translation notices.",
    sections: [
      [
        "1. Strict Non-Affiliation with Talabat & Third-Party Trademarks",
        `<p><b>FixIt (fixit-now.xyz) is a 100% independent Omani platform. FixIt is NOT affiliated with, endorsed by, sponsored by, or connected in ANY kind of relation to Talabat, Delivery Hero SE, Uber, Careem, or any other third-party company.</b></p>`
      ],
      [
        "2. Third-Party Advertisements (A-Ads) Disclaimer",
        `<p>All advertisement banners displayed inside the horizontal <b>"ADVERTISEMENT"</b> blocks across the FixIt app and website are served by <b>A-Ads (<code>acceptable.a-ads.com</code>, Unit <code>2461953</code>)</b>, an independent third-party advertising provider. FixIt does not select, endorse, or assume liability for any third-party advertiser or product shown in those banners. Review A-Ads Terms of Service at <a href="https://aads.com/terms_of_service" target="_blank" rel="noopener noreferrer" style="color:#FF5A00;font-weight:700">https://aads.com/terms_of_service</a> and Privacy Policy at <a href="https://aads.com/privacy_policy" target="_blank" rel="noopener noreferrer" style="color:#FF5A00;font-weight:700">https://aads.com/privacy_policy</a>.</p>`
      ],
      [
        "3. Automated Bilingual Translation & Diagnostic Disclaimer",
        `<p>Bilingual Arabic/English translations of repair descriptions and chat messages are generated automatically to assist communication and may not always be exact. Furthermore, scope descriptions and quotes on FixIt are for service coordination only and do not constitute certified engineering, legal, or financial advice.</p>`
      ]
    ]
  });
}

function deleteAccountPage() {
  return legalDocPage({
    title: "Account & Personal Data Deletion Portal",
    path: "/delete-account",
    badge: "Google Play Data Safety · Omani PDPL & GDPR Right to Erasure",
    subtitle: "How to permanently delete your FixIt or FixIt Pro account and all associated personal data.",
    sections: [
      [
        "1. Option A: Instant In-App Account Deletion",
        `<p>Open the <b>FixIt</b> or <b>FixIt Pro</b> Android app, navigate to <b>Account &rarr; Account Info</b>, scroll to the bottom, and tap <b>"Request Account &amp; Data Deletion"</b>. Your active session and biometric tokens are revoked immediately and your deletion ticket is queued for permanent erasure.</p>`
      ],
      [
        "2. Option B: Web Account Deletion Request (No App Required)",
        `<p>If you have uninstalled the app, you may submit a verified account deletion request directly on the web without logging into the app:</p>
         <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:12px">
           <a href="/support" class="fx-btn fx-btn-primary">Submit Web Deletion Request</a>
           <a href="https://wa.me/96895956361?text=Please%20delete%20my%20FixIt%20account%20and%20personal%20data" target="_blank" rel="noopener noreferrer" class="fx-btn fx-btn-outline">Request Deletion via WhatsApp Care</a>
         </div>`
      ],
      [
        "3. What Data Is Deleted vs. Retained for Statutory Accounting",
        `<p>Upon verifying ownership of your phone number or email address, we permanently delete your <code>users</code> profile, <code>user_settings</code>, <code>user_addresses</code>, <code>auth_sessions</code>, and hardware biometric hashes within thirty (30) days. Anonymized financial ledger entries (<code>wallet_transactions</code>) required for statutory accounting and fraud prevention are retained solely as required by Omani law.</p>`
      ]
    ]
  });
}

function warrantyPage() {
  return legalDocPage({
    title: "14-Day Workmanship Warranty",
    path: "/warranty",
    badge: "Quality Assurance · Salalah & Dhofar",
    subtitle: "Every completed repair booked and paid inside the FixIt app carries 14 days of verified workmanship protection.",
    sections: [
      ["1. Coverage Scope", "<p>Completed repairs booked and confirmed inside the FixIt App carry fourteen (14) days of workmanship support against repeat defects in the exact same repaired component.</p>"],
      ["2. Photo Evidence Requirement", "<p>Before-and-after job photos captured in the app verify the initial state and completed repair, allowing our support team to mediate warranty claims fairly and transparently.</p>"],
      ["3. Filing a Claim & 24-Hour Vendor Response Window", "<p>Open your completed order in the app or submit your order reference through the <a href=\"/support\" style=\"color:#FF5A00;font-weight:700\">Online Support Portal</a> within 14 days of job completion. The assigned Vendor is given 24 hours to schedule a free warranty revisit, backed by FixIt Support protection.</p>"]
    ]
  });
}

module.exports = {
  servicesPage,
  partnerPage,
  aboutPage,
  termsPage,
  privacyPage,
  cookiesPage,
  refundsPage,
  aupPage,
  disclaimerPage,
  deleteAccountPage,
  warrantyPage
};
