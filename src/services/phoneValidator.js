/**
 * Strict international & Oman phone validation helper.
 * Oman (+968) enforces 8 national digits starting only with 9 or 7.
 * All other countries validate E.164 digit length & country dial prefix.
 */

const COUNTRY_RULES = {
  OM: { dial: "+968", minLen: 8, maxLen: 8, regex: /^[79]\d{7}$/, name: "Oman", nameAr: "عُمان" },
  AE: { dial: "+971", minLen: 9, maxLen: 9, regex: /^5\d{8}$/, name: "United Arab Emirates", nameAr: "الإمارات" },
  SA: { dial: "+966", minLen: 9, maxLen: 9, regex: /^5\d{8}$/, name: "Saudi Arabia", nameAr: "السعودية" },
  QA: { dial: "+974", minLen: 8, maxLen: 8, regex: /^[3567]\d{7}$/, name: "Qatar", nameAr: "قطر" },
  KW: { dial: "+965", minLen: 8, maxLen: 8, regex: /^[4569]\d{7}$/, name: "Kuwait", nameAr: "الكويت" },
  BH: { dial: "+973", minLen: 8, maxLen: 8, regex: /^[36]\d{7}$/, name: "Bahrain", nameAr: "البحرين" },
  YE: { dial: "+967", minLen: 9, maxLen: 9, regex: /^7\d{8}$/, name: "Yemen", nameAr: "اليمن" },
  US: { dial: "+1", minLen: 10, maxLen: 10, regex: /^[2-9]\d{9}$/, name: "United States", nameAr: "الولايات المتحدة" },
  CA: { dial: "+1", minLen: 10, maxLen: 10, regex: /^[2-9]\d{9}$/, name: "Canada", nameAr: "كندا" },
  GB: { dial: "+44", minLen: 10, maxLen: 10, regex: /^7\d{9}$/, name: "United Kingdom", nameAr: "المملكة المتحدة" },
  IN: { dial: "+91", minLen: 10, maxLen: 10, regex: /^[6-9]\d{9}$/, name: "India", nameAr: "الهند" },
  PK: { dial: "+92", minLen: 10, maxLen: 10, regex: /^3\d{9}$/, name: "Pakistan", nameAr: "باكستان" },
  EG: { dial: "+20", minLen: 10, maxLen: 10, regex: /^1\d{9}$/, name: "Egypt", nameAr: "مصر" },
  JO: { dial: "+962", minLen: 9, maxLen: 9, regex: /^7\d{8}$/, name: "Jordan", nameAr: "الأردن" }
};

const KNOWN_DIALS = Array.from(new Set(Object.values(COUNTRY_RULES).map(r => r.dial.slice(1))))
  .sort((a, b) => b.length - a.length);

function stripNonDigits(val) {
  return String(val || "").replace(/[^0-9]/g, "");
}

function normalizeDial(rawDial) {
  const digits = stripNonDigits(rawDial);
  return digits ? `+${digits}` : "";
}

function inferCountryByE164(e164) {
  const clean = String(e164 || "").trim();
  if (!clean.startsWith("+")) return "";
  if (clean.startsWith("+968")) return "OM";
  for (const [iso, rule] of Object.entries(COUNTRY_RULES)) {
    if (clean.startsWith(rule.dial)) return iso;
  }
  return "";
}

/**
 * Validates and normalizes phone input into E.164 format.
 * Supports separate (dialCode + nationalNumber) or combined E.164/local string.
 */
function parseAndValidatePhone({ phone = "", countryIso = "", dialCode = "", nationalNumber = "" } = {}) {
  const isoUpper = String(countryIso || "").trim().toUpperCase();
  const explicitRule = COUNTRY_RULES[isoUpper] || null;
  let resolvedDial = normalizeDial(dialCode || (explicitRule ? explicitRule.dial : ""));

  let rawNational = stripNonDigits(nationalNumber);
  const rawCombined = String(phone || "").trim();

  if (!rawNational && rawCombined) {
    let cleaned = rawCombined.replace(/[^0-9+]/g, "");
    if (cleaned.startsWith("00")) cleaned = "+" + cleaned.slice(2);
    if (cleaned.startsWith("+")) {
      const digitsAfterPlus = cleaned.slice(1);
      if (resolvedDial && digitsAfterPlus.startsWith(resolvedDial.slice(1))) {
        rawNational = digitsAfterPlus.slice(resolvedDial.slice(1).length);
      } else {
        const matchedDial = KNOWN_DIALS.find(d => digitsAfterPlus.startsWith(d));
        if (matchedDial) {
          resolvedDial = `+${matchedDial}`;
          rawNational = digitsAfterPlus.slice(matchedDial.length);
        } else {
          // Generic international +<cc><subscriber>
          if (digitsAfterPlus.length < 8 || digitsAfterPlus.length > 15 || /^0+$/.test(digitsAfterPlus)) {
            return {
              ok: false,
              error: "Please enter a valid international phone number.",
              errorAr: "يرجى إدخال رقم هاتف دولي صحيح."
            };
          }
          return {
            ok: true,
            e164: `+${digitsAfterPlus}`,
            dialCode: resolvedDial || "",
            nationalDigits: digitsAfterPlus,
            countryIso: isoUpper || inferCountryByE164(`+${digitsAfterPlus}`)
          };
        }
      }
    } else {
      const digitsOnly = stripNonDigits(cleaned);
      const dialDigits = resolvedDial ? resolvedDial.slice(1) : "968";
      if (!resolvedDial) resolvedDial = "+968";
      // Only strip leading country code if user pasted full international digits (> local 8 digits)
      if (digitsOnly.startsWith(dialDigits) && digitsOnly.length > 8) {
        rawNational = digitsOnly.slice(dialDigits.length);
      } else {
        rawNational = digitsOnly.replace(/^0+(?=\d)/, "");
      }
    }
  }

  if (!resolvedDial) resolvedDial = "+968";
  const dialDigits = resolvedDial.slice(1);

  // Strip leading trunk zero if present (unless Oman strict denial below)
  if (rawNational.startsWith("0") && resolvedDial !== "+968") {
    rawNational = rawNational.replace(/^0+/, "");
  }

  // Strict Oman Rule: +968 must be EXACTLY 8 digits starting ONLY with 9 or 7
  if (resolvedDial === "+968" || isoUpper === "OM") {
    if (!/^[79]\d{7}$/.test(rawNational)) {
      return {
        ok: false,
        error: "Oman phone numbers must be exactly 8 digits starting with 9 or 7.",
        errorAr: "يجب أن يتكون رقم الهاتف العُماني من 8 أرقام ويبدأ بـ 9 أو 7 فقط."
      };
    }
    return {
      ok: true,
      e164: `+968${rawNational}`,
      dialCode: "+968",
      nationalDigits: rawNational,
      countryIso: "OM"
    };
  }

  const rule = explicitRule || COUNTRY_RULES[inferCountryByE164(`+${dialDigits}${rawNational}`)];
  if (rule) {
    if (rawNational.length < rule.minLen || rawNational.length > rule.maxLen || !rule.regex.test(rawNational)) {
      return {
        ok: false,
        error: `Please enter a valid ${rule.name} mobile number (${rule.minLen === rule.maxLen ? rule.minLen : `${rule.minLen}-${rule.maxLen}`} digits).`,
        errorAr: `يرجى إدخال رقم جوال صحيح (${rule.nameAr}).`
      };
    }
  } else {
    if (rawNational.length < 6 || rawNational.length > 12 || /^0+$/.test(rawNational)) {
      return {
        ok: false,
        error: "Please enter a valid mobile number for the selected country.",
        errorAr: "يرجى إدخال رقم هاتف صحيح للدولة المختارة."
      };
    }
  }

  const totalDigits = `${dialDigits}${rawNational}`;
  if (totalDigits.length < 7 || totalDigits.length > 15) {
    return {
      ok: false,
      error: "Phone number length is out of valid range.",
      errorAr: "طول رقم الهاتف غير صالح."
    };
  }

  return {
    ok: true,
    e164: `+${totalDigits}`,
    dialCode: resolvedDial,
    nationalDigits: rawNational,
    countryIso: isoUpper || inferCountryByE164(`+${totalDigits}`)
  };
}

module.exports = {
  COUNTRY_RULES,
  parseAndValidatePhone
};
