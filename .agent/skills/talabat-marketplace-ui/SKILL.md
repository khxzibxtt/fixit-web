---
name: talabat-marketplace-ui
description: >-
  Marketplace and on-demand delivery UI patterns inspired by Talabat, Uber, and Grab.
  Enforces dual-flow (Consumer/Vendor), clean category grids, order status steppers,
  and human-friendly service tracking.
---

# Talabat & Uber On-Demand Marketplace UI Standards

> **Reference Architectures:**
> `ahmed-elshorbagy/Talabat-Clone`, `SimCoderYoutube/UberClone`, `MindorksOpenSource/ridesharing-uber-lyft-app`, `skydoves/Pokedex`.

---

## 1. Dual Flow Separation

FixIt operates on two distinct, clean user journeys:
1. **Consumer Flow:**
   - Home catalog $\rightarrow$ Select category $\rightarrow$ Enter issue description $\rightarrow$ Pin location $\rightarrow$ Post bounty or receive vendor bids $\rightarrow$ Accept bid $\rightarrow$ Live order status $\rightarrow$ Inspect job photos $\rightarrow$ Release payment & rate.
2. **Vendor (Pro / Shop) Flow:**
   - Nearby job radar $\rightarrow$ Review job details & distance $\rightarrow$ Submit bid or accept bounty $\rightarrow$ "On My Way" dispatch $\rightarrow$ Arrive & upload "Before" photo $\rightarrow$ Complete repair & upload "After" photo $\rightarrow$ Receive payout to withdrawable balance.

---

## 2. Category & Service Catalog Grid

- **Layout:** 2-column or 3-column / 4-column compact cards on mobile.
- **Card Anatomy:**
  - Centered icon in a soft circular container (e.g., `#FFF3E0` for HVAC/AC, `#E0F2FE` for Plumbing, `#FEF3C7` for Towing/Auto).
  - 1–2 word category label (`font-size: 13.5px`, `font-weight: 700`, `line-height: 1.25`).
  - Optional subtle starting price badge (e.g., `From 5.000 OMR`).
  - No text clipping, no ellipsis truncation on primary labels.

---

## 3. Order Status Tracking Stepper

Replace cluttered text with a 5-step visual tracking component:
```
[ Requested ] ─── [ Accepted ] ─── [ On The Way ] ─── [ In Progress ] ─── [ Completed ]
```
- **Active Step:** Highlighted in primary brand orange (`#FF5A00`) with pulsing dot or checkmark.
- **Pending Step:** Soft gray (`#CBD5E1`).
- **Status Card:** Displays technician photo, name, rating (`⭐ 4.9`), and direct WhatsApp button (`#15803D`).

---

## 4. Service Location Card

- **Pin Display:** Show neighborhood and landmark (`📍 Al Saada, Salalah · Oman`), never raw floating coordinates.
- **Edit Action:** A clean `"Change"` link opening the interactive map picker.
- **Map Viewport:** Map stays inside its dedicated container; never overlaps header bars or bottom navigation tabs.

---

## 5. Before & After Job Photos

- **Grid:** 2 equal tiles side-by-side: `"Before Repair"` and `"After Repair"`.
- **States:**
  - Empty: Clean camera icon with `"Tap to attach photo"`.
  - Captured: Photo thumbnail with green checkmark badge (`"Verified"`).
- **Enforcement:** Both consumer and vendor see the exact same job photos before payment is released.
