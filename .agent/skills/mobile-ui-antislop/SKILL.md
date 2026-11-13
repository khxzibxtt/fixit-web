---
name: mobile-ui-antislop
description: >-
  Strict anti-AI-slop mobile engineering and UI verification skill. Enforces layout
  inspection before editing, eliminates fake telemetry/mock data, and guarantees
  production-grade mobile web and native Android quality.
---

# Mobile UI Anti-AI-Slop Engineering Standard

> **Core Mandate:**
> Stop AI-generated clutter, fake telemetry, robotic sci-fi phrasing, and broken mobile layouts.
> All UI must feel like a production app built by senior mobile engineers at Talabat, Uber, or Toss.

---

## 1. Inspect Before Editing (Gravitas / Superpowers Pattern)

Never modify a screen or component blindly:
1. **Inspect Existing DOM & CSS:** View the target file's existing structure, CSS variables, and layout hierarchy before writing replacement code.
2. **Preserve Layout Context:** Do not wrap existing elements in unnecessary new `<div>` containers that break flex/grid alignments or cause overflow bugs.
3. **Validate Syntax & Regressions:** After any change, run syntax validation (`node -e ...`) and project tests (`npm test`) immediately.

---

## 2. Zero AI Telemetry & Clutter Ban

Strictly forbidden from any customer or vendor screen:
- **NO Fake Telemetry:** Never display IP addresses, ISP names, device user-agents, raw network roundtrip times, or debug status feeds.
- **NO Raw GPS Coordinates:** Never show floating-point coordinates like `17.0227° N, 54.0928° E` on user screens. Always display clean city/neighborhood names (e.g. `Al Saada, Salalah · Oman`).
- **NO Internal IDs:** Never expose internal database IDs (e.g., `FX-WRK-884101`, `FX-SHP-104821`) on badges, titles, or toasts. Use human roles: `"Verified Professional"`, `"Team Member"`.
- **NO Debug Buttons:** Never leave `"Test Gate Lock"`, `"Trigger Webhook"`, or raw admin debug triggers in production views.

---

## 3. Human-First Copywriting (Toss / Talabat Standard)

Write like a friendly, professional human product designer:
- **Headings:** 1 to 4 words maximum (e.g., `"Job Photos"`, `"Help & Support"`, `"Service Location"`).
- **Subtitles:** 1 short sentence maximum (e.g., `"Take before and after photos to confirm completion."`).
- **Banned Robotic Words:**
  - Replace `"Escrow"` $\rightarrow$ `"Protected Payment"` or `"Safe Pay"`.
  - Replace `"4-Side Live Camera Verification (GPS + Timestamp)"` $\rightarrow$ `"Job Photos"`.
  - Replace `"Algorithm"`, `"Protocol"`, `"Gate Lock"`, `"Ledger"` $\rightarrow$ `"Payment"`, `"Verification"`, `"Wallet"`, or remove the technical label.
  - Replace `"Admin console support queue"` $\rightarrow$ `"Our support team"`.
  - Replace `"MOCIIP Technical License"` $\rightarrow$ `"Commercial Registration (CR)"`.
- **Zero Backend Disclosures:** Never explain database locking, hash functions, or webhook dispatching to the end user.

---

## 4. Performance & Touch Ergonomics

- **Touch Targets:** All interactive buttons, chips, and icons must have at least `44px × 44px` clickable area.
- **Loading States:** Use clean, subtle CSS shimmer skeletons (`facebook/shimmer-android` style) instead of jarring layout shifts or mock text placeholders.
- **Smooth Feedback:** Every tap must have immediate visual feedback (active state, subtle scale `0.98`, or ripple).
