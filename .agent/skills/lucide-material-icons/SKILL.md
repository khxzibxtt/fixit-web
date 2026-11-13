---
name: lucide-material-icons
description: >-
  Strict iconography standards using official Lucide, Tabler, and Google Material Design SVG paths.
  Strictly bans AI from drawing custom, broken, or inconsistent inline SVGs.
---

# Official Lucide & Material Iconography Standard

> **Strict Rule:**
> NEVER draw arbitrary custom SVGs or invent random bezier curves.
> ALWAYS use standard, proven 24x24 SVG vectors from Lucide (`lucide-icons/lucide`), Tabler (`tabler/tabler-icons`), or Google Material Design.

---

## 1. Universal SVG Spec

Every SVG icon rendered in HTML/JS must adhere to this exact specification:
```html
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- paths here -->
</svg>
```
- **Size tiers:**
  - `16px × 16px`: Inside chips, small pills, table cells, or inline text.
  - `20px × 20px`: Standard button icons, list item prefixes, input field icons.
  - `24px × 24px`: Bottom navigation bar tabs, top header icons, category circular badges.
- **Coloring:** Always use `stroke="currentColor"` so the icon inherits text color dynamically or accepts CSS color variables.

---

## 2. Standard Service Category Icons

Use these verified vector paths for home services:

### AC / HVAC (`wind`)
```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/>
  <path d="M9.6 4.6A2 2 0 1 1 11 8H2"/>
  <path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>
</svg>
```

### Plumbing (`wrench` / `droplet`)
```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
</svg>
```

### Electrical (`zap`)
```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
</svg>
```

### Towing & Recovery (`truck`)
```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="1" y="3" width="15" height="13"/>
  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
  <circle cx="5.5" cy="18.5" r="2.5"/>
  <circle cx="18.5" cy="18.5" r="2.5"/>
</svg>
```

### Location Pin (`map-pin`)
```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
  <circle cx="12" cy="10" r="3"/>
</svg>
```

### Protected Payment / Shield (`shield-check`)
```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20 13c0 5-8 9-8 9s-8-4-8-9V5l8-3 8 3v8z"/>
  <path d="m9 12 2 2 4-4"/>
</svg>
```

### Wallet (`wallet`)
```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
  <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
  <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
</svg>
```

### Camera (`camera`)
```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
  <circle cx="12" cy="13" r="3"/>
</svg>
```
