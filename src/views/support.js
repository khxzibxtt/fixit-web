/**
 * Online Support & Mail Request portal (/support, /contact).
 * Displays live server-detected visitor IP & device info and forwards submissions
 * directly to the FixIt Admin app via Supabase [WEBSITE] support tickets.
 */

const { ICONS, escapeHtml, renderPage } = require("./layout");

function supportPage({ visitor, mode = "support" }) {
  const isMail = mode === "contact";
  const locText = [visitor.city, visitor.region, visitor.country].filter(Boolean).join(", ") || visitor.country;

  const body = `
    <section class="fx-section" style="padding-top:34px">
      <div class="fx-wrap fx-grid-2" style="align-items:start">
        <div>
          <span class="fx-pill">${ICONS.shield}<span>Our Support Team</span></span>
          <h1 class="fx-h1" style="font-size:32px">${isMail ? "Direct Inquiries" : "Help &amp; Support"}</h1>
          <p class="fx-lead" style="font-size:15.5px">
            Have a question or need assistance with a booking? Contact our team anytime.
          </p>

          <div class="fx-card">
            <h3 style="margin:0 0 10px;font-size:16px">WhatsApp Support</h3>
            <div style="display:flex;flex-wrap:wrap;gap:10px">
              <a href="https://wa.me/96895956361" target="_blank" rel="noopener noreferrer" class="fx-btn" style="background:#15803D;color:#fff">
                ${ICONS.whatsapp}
                <span>Message on WhatsApp (+968 9595 6361)</span>
              </a>
            </div>
            <p style="margin:12px 0 0;font-size:13px;color:var(--mu2)">
              Our support team responds across Salalah and Dhofar daily.
            </p>
          </div>
        </div>

        <div class="fx-card" style="padding:26px">
          <h2 style="margin:0 0 6px;font-size:21px;font-weight:900">Send a Message</h2>
          <p style="margin:0 0 18px;font-size:14px;color:var(--mu)">
            Fill in the details below and we will follow up with you shortly.
          </p>

          <form id="fxSupportForm">
            <input type="hidden" name="sourceTag" value="${isMail ? "WEBSITE MAIL" : "WEBSITE"}" />
            <div class="fx-field">
              <label for="supName">Your Name</label>
              <input id="supName" name="name" class="fx-input" required maxlength="80" placeholder="Full name" />
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="fx-field">
                <label for="supEmail">Email Address</label>
                <input id="supEmail" name="email" type="email" class="fx-input" required maxlength="120" placeholder="you@example.com" />
              </div>
              <div class="fx-field">
                <label for="supPhone">WhatsApp / Phone</label>
                <input id="supPhone" name="phone" class="fx-input" maxlength="30" placeholder="+968 9XXX XXXX" />
              </div>
            </div>

            <div class="fx-field">
              <label for="supTopic">Request Type</label>
              <select id="supTopic" name="topic" class="fx-select">
                <option value="Customer Support">Order &amp; Customer Support</option>
                <option value="Warranty Claim">14-Day Warranty Review</option>
                <option value="Mail Inquiry"${isMail ? " selected" : ""}>Official Email / Business Inquiry</option>
                <option value="Partner Onboarding">Workshop &amp; Pro Onboarding</option>
                <option value="Security Report">Security or Bug Report</option>
              </select>
            </div>

            <div class="fx-field">
              <label for="supSubject">Subject</label>
              <input id="supSubject" name="subject" class="fx-input" required maxlength="140" placeholder="Short summary of your request" />
            </div>

            <div class="fx-field">
              <label for="supMessage">Details</label>
              <textarea id="supMessage" name="message" class="fx-textarea" required maxlength="3000" placeholder="Include order number or full details so our team can assist right away."></textarea>
            </div>

            <button id="supSubmitBtn" type="submit" class="fx-btn fx-btn-primary fx-btn-lg" style="width:100%">
              ${ICONS.mail}
              <span>Send Message</span>
            </button>
            <div id="supStatusBox" style="margin-top:14px;display:none;padding:12px 14px;border-radius:12px;font-size:14px;font-weight:600"></div>
          </form>
        </div>
      </div>
    </section>
  `;

  const scripts = `
    <script>
      (function () {
        var form = document.getElementById("fxSupportForm");
        var btn = document.getElementById("supSubmitBtn");
        var box = document.getElementById("supStatusBox");
        if (!form) return;

        form.addEventListener("submit", async function (e) {
          e.preventDefault();
          btn.disabled = true;
          box.style.display = "none";

          var fd = new FormData(form);
          var payload = {
            sourceTag: fd.get("sourceTag"),
            name: fd.get("name"),
            email: fd.get("email"),
            phone: fd.get("phone"),
            topic: fd.get("topic"),
            subject: fd.get("subject"),
            message: fd.get("message")
          };

          try {
            var res = await fetch("/api/support", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            var data = await res.json();
            box.style.display = "block";
            if (res.ok && data.ok) {
              box.style.background = "#DCFCE7";
              box.style.color = "#14532D";
              box.textContent = "Request delivered to FixIt Admin (" + (data.ticketId ? "Ticket " + data.ticketId.slice(0, 8) : "Logged") + ") from IP " + (data.visitor ? data.visitor.ip : "") + ".";
              form.reset();
            } else {
              box.style.background = "#FEE2E2";
              box.style.color = "#991B1B";
              box.textContent = data.error || "Unable to send request right now. Please try WhatsApp Care.";
            }
          } catch (err) {
            box.style.display = "block";
            box.style.background = "#FEE2E2";
            box.style.color = "#991B1B";
            box.textContent = "Network error while sending request. Please use WhatsApp Care (+968 9595 6361).";
          } finally {
            btn.disabled = false;
          }
        });
      })();
    </script>
  `;

  return renderPage({
    title: isMail ? "Contact & Mail" : "Support",
    activePath: "/support",
    body,
    scripts
  });
}

module.exports = {
  supportPage
};
