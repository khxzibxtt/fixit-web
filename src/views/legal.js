/**
 * Pure-JS informational, partner, and legal pages (/services, /partner, /about, /terms, /privacy, /warranty).
 * Zero fake CR numbers, zero fake LLCs, zero pricing, zero Admin APK exposure.
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
  return renderPage({ title: "Services", activePath: "/services", body });
}

function partnerPage() {
  const body = `
    <section class="fx-section" style="padding-top:38px">
      <div class="fx-wrap fx-grid-2">
        <div>
          <span class="fx-pill">${ICONS.wrench}<span>FixIt Pro · For Workshops &amp; Fleet Owners</span></span>
          <h1 class="fx-h1" style="font-size:36px">Grow your workshop across Salalah &amp; Oman.</h1>
          <p class="fx-lead">
            Receive real nearby repair requests with customer photos, videos, and pinned GPS coordinates. Quote only on the jobs that match your crew and commercial registration.
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
            <li>Live feed of customer repair scopes with GPS distance and photos.</li>
            <li>Multi-branch shop onboarding and technician roster management.</li>
            <li>Direct in-app chat and WhatsApp arrival coordination with customers.</li>
            <li>Full order records and digital job completion verification.</li>
          </ul>
        </div>
      </div>
    </section>
  `;
  return renderPage({ title: "Become a Partner", activePath: "/partner", body });
}

function aboutPage() {
  const body = `
    <section class="fx-section" style="padding-top:38px">
      <div class="fx-wrap" style="max-width:820px">
        <span class="fx-pill">${ICONS.globe}<span>Salalah &amp; Dhofar, Sultanate of Oman</span></span>
        <h1 class="fx-h1" style="font-size:36px">About FixIt</h1>
        <div class="fx-card" style="display:flex;flex-direction:column;gap:16px">
          <p style="margin:0;font-size:15.5px;color:var(--mu)">
            FixIt is a mobile-first service marketplace connecting homeowners, tenants, and drivers across Salalah and the Governorate of Dhofar with verified local workshops, mechanics, and technicians.
          </p>
          <p style="margin:0;font-size:15.5px;color:var(--mu)">
            Unlike flat-rate directories, FixIt lets you describe the exact scope of work, attach live camera photos or video, and review multiple real-world quotes in Omani Rial before selecting a technician.
          </p>
          <div style="border-top:1px solid var(--line);padding-top:14px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;font-size:14px">
            <div><b>Service Region</b><br /><span style="color:var(--mu)">Salalah &amp; Governorate of Dhofar, Oman</span></div>
            <div><b>Official Care</b><br /><span style="color:var(--mu)">WhatsApp Care +968 9595 6361</span></div>
          </div>
        </div>
      </div>
    </section>
  `;
  return renderPage({ title: "About", activePath: "/about", body });
}

function legalDocPage({ title, path, badge, sections }) {
  const body = `
    <section class="fx-section" style="padding-top:38px">
      <div class="fx-wrap" style="max-width:820px">
        <span class="fx-pill">${ICONS.shield}<span>${badge}</span></span>
        <h1 class="fx-h1" style="font-size:34px">${title}</h1>
        <div class="fx-card" style="display:flex;flex-direction:column;gap:18px">
          ${sections.map(([heading, copy]) => `
            <div>
              <h2 style="margin:0 0 6px;font-size:17px;font-weight:800">${heading}</h2>
              <p style="margin:0;font-size:14.5px;color:var(--mu)">${copy}</p>
            </div>
          `).join("")}
        </div>
      </div>
    </section>
  `;
  return renderPage({ title, activePath: path, body });
}

function termsPage() {
  return legalDocPage({
    title: "Terms of Service",
    path: "/terms",
    badge: "Platform Agreement · Oman",
    sections: [
      ["1. App-Only Ordering", "FixIt operates exclusively through the FixIt Android apps. Website pages provide informational scope guides, deep-link routing, and customer support intake."],
      ["2. Independent Quotes & Pricing", "Estimated costs depend on actual inspection, property or vehicle condition, required parts, and access. Final pricing is quoted directly by verified service partners inside the app before you confirm."],
      ["3. Account Verification", "Users verify their identity using OTP via WhatsApp or SMS, or via Google sign-in. Misuse, spam requests, or abusive submissions may result in suspension."],
      ["4. Governing Law", "These terms are governed by the applicable laws of the Sultanate of Oman."]
    ]
  });
}

function privacyPage() {
  return legalDocPage({
    title: "Privacy Policy",
    path: "/privacy",
    badge: "Data Protection & Transparency",
    sections: [
      ["1. Information We Collect", "When ordering inside the app, FixIt collects your contact number, pinned service location, job scope descriptions, and job photos strictly to dispatch your selected pro."],
      ["2. Online Support & Security Logging", "To protect our servers and investigate support inquiries, requests submitted via the online web support/mail form record your IP address, network/ISP, and browser/OS headers alongside your message."],
      ["3. Zero Third-Party Ad Trackers", "FixIt does not sell personal contact details or serve third-party behavioral advertising cookies."],
      ["4. Data Requests", "Submit an account deletion or data request directly via Settings in the FixIt app or via WhatsApp Care (+968 9595 6361)."]
    ]
  });
}

function warrantyPage() {
  return legalDocPage({
    title: "14-Day Workmanship Warranty",
    path: "/warranty",
    badge: "Quality Assurance",
    sections: [
      ["1. Coverage Scope", "Completed repairs booked and confirmed inside the FixIt App carry 14 days of workmanship support against repeat defects in the same repaired component."],
      ["2. Photo Evidence Requirement", "Before-and-after job photos captured in the app verify the initial state and completed repair, allowing our support team to mediate warranty claims fairly."],
      ["3. Filing a Claim", "Open your completed order in the app or submit your order number through the Online Support portal within 14 days of job completion."]
    ]
  });
}

module.exports = {
  servicesPage,
  partnerPage,
  aboutPage,
  termsPage,
  privacyPage,
  warrantyPage
};
