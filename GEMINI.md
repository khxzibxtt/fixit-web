# FixIt Mobile UI & Engineering Guidelines

> [!IMPORTANT]
> This repository enforces the **Talabat / Uber / Toss Mobile UI Design Standards**.
> All modifications must adhere to clean mobile aesthetics, zero AI slop, and strict design systems.

---

## 1. Active Skills Reference

The following specialized skills are saved and active for this project:
- **`mobile-ui-antislop`** (`.agent/skills/mobile-ui-antislop/SKILL.md`): Step-by-step layout inspection, zero fake telemetry/mock data, and human copywriting.
- **`toss-design-system`** (`.agent/skills/toss-design-system/SKILL.md`): 8pt spatial grid, bottom sheets, 44px+ touch targets, and OMR currency / +968 phone masking.
- **`talabat-marketplace-ui`** (`.agent/skills/talabat-marketplace-ui/SKILL.md`): Consumer/Vendor dual flow, compact category grids, order status steppers, and job photo verification.
- **`lucide-material-icons`** (`.agent/skills/lucide-material-icons/SKILL.md`): Standard 24x24 Lucide/Tabler/Material vector icons with strict ban on custom inline SVGs.

---

## 2. Core Mobile UI Guardrails

1. **Inspect Before Modifying:** Always inspect DOM nesting and CSS styles before editing.
2. **Zero Fake Telemetry / Mock Data:** No IP addresses, ISPs, raw GPS coordinates (`17.0227...`), internal IDs (`FX-WRK-...`, `FX-SHP-...`), or debug test buttons on user screens.
3. **Short Human Copy (Talabat Style):**
   - Headings: 1–4 words maximum.
   - Subtitles: 1 short sentence maximum.
   - Use plain language: `"Protected Payment"`, `"Job Photos"`, `"Our support team"`, `"Commercial Registration (CR)"`.
4. **Standard Iconography:** Only use standard Lucide / Tabler / Google Material Design 24x24 SVG vectors.
