---
name: toss-design-system
description: >-
  Production mobile design system inspired by Toss, Konsta UI, and Framework7.
  Enforces strict 4px/8px spacing, clean bottom sheets, 44px+ touch targets,
  native typography, and first-class Arabic RTL alignment.
---

# Toss-Style Mobile Design System (Konsta & Framework7 Standard)

> **Philosophy:**
> High contrast, uncluttered surfaces, generous whitespace, fluid bottom sheets, and zero visual friction.

---

## 1. Spatial Grid & Metrics (8pt Grid)

All spacing, margins, and paddings must follow the standard 4px/8px rhythmic scale:
- `4px`: Micro gap between inline icon and label.
- `8px`: Compact padding inside chips, pills, and small input fields.
- `12px`: Standard card inner padding (compact) or list item gap.
- `16px`: Default screen horizontal padding (`pad`), standard card padding, and button padding.
- `20px` – `24px`: Section gaps and header bottom margins.
- `32px`: Screen footer bottom padding (accounting for Android system navigation bar / iOS home indicator).

---

## 2. Card & Surface Architecture

- **Backgrounds:**
  - Base Screen: `#F8FAFC` (light slate) or `#0B0F19` (dark mode).
  - Cards & Sheets: `#FFFFFF` (pure white) with `border-radius: 14px` (or `16px`).
- **Borders & Dividers:**
  - Card Border: `1px solid rgba(0, 0, 0, 0.06)` or `1px solid #E2E8F0`. Never use thick or heavy borders.
  - Dividers: `1px solid rgba(0, 0, 0, 0.05)` with `margin: 8px 0`.
- **Shadows:**
  - Subtle elevation: `box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03);`.
  - Avoid heavy, dark 90s drop-shadows.

---

## 3. Bottom Sheets Over Full-Page Modals

Whenever a user selects an option, views details, or completes an action:
- **Use Slide-Up Bottom Sheets:** Follow `gorhom/react-native-bottom-sheet` and `framework7` patterns.
- **Header:** Centered pill drag handle (`width: 36px`, `height: 4px`, `background: #CBD5E1`, `border-radius: 99px`), followed by a 1–3 word title.
- **Backdrop:** Dimmed overlay `background: rgba(0, 0, 0, 0.45)` with tap-to-dismiss and hardware Back button listener.

---

## 4. Typography Hierarchy

Use system native fonts (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif`):
- **Display / Top Balance:** `22px – 24px`, font-weight `800` or `900`.
- **Card Title / Heading:** `16px – 18px`, font-weight `700`.
- **Body Text:** `14px – 15px`, font-weight `400` or `500`, line-height `1.5`.
- **Metadata / Caption:** `11.5px – 13px`, font-weight `600`, color `var(--mu)` / `#64748B`.

---

## 5. Input Masking & Localization (Oman / Middle East)

- **Currency (OMR):**
  - Always 3 decimal places: `0.300 OMR`, `1.500 OMR`, `10.000 OMR`.
  - Currency label: `OMR` (en) or `ر.ع.` (ar).
- **Phone Numbers (+968):**
  - Format: `+968 9XXX XXXX` or `+968 7XXX XXXX`.
  - Prefix fixed: `+968` pre-filled or locked, user enters 8 digits.
- **RTL (Arabic) Alignment:**
  - Chevrons and direction arrows reverse direction automatically (`dir="rtl"`).
  - Numbers and currency maintain readable LTR block formatting where appropriate.
