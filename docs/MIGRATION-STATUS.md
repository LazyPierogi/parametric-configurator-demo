# UI/UX Migration Status

**Last updated:** October 18, 2025  
**Owner:** Curtain Wizard UI task force

---

## Current Snapshot
- **Tailwind + PostCSS are installed** and loaded via `globals.css`; token coverage is comprehensive for overlays, debug handles, and static styling.
- **Reusable UI kit exists** (`Button`, `Card`, `Chip`, `Dialog`, `Input`, `Progress`, `Select`, `Spinner`); repeated feature patterns (banners, empty states, carts) still need promotion into shared components.
- **Configurator now split into dedicated view components**: `ConfiguratorLayout.tsx`, `SummaryPanel.tsx`, `DebugControls.tsx`, `ServicesSection.tsx`, and `FiltersPanel.tsx` live under `apps/web/app/configure/components/`, with all strings (including debug tooling copy) resolved from the shared i18n catalog. Remaining inline styles are geometry-driven (curtain transforms, SVG overlays).
- **Overlay + debug colors now flow through tokens**: glass overlays, scrims, clamp/stitch toasts, and debug handles read from CSS variables/Tailwind aliases (`overlay.scrim*`, `surface.config`, `shadow-config-panel`, etc.), so future palette swaps only touch the token map.
- **Configurator filters extracted**: the entire sidebar/filter panel now lives in `FiltersPanel.tsx`, leaving `page.tsx` focused on orchestration instead of UI structure. Coverage warning dialog is also modularised (`CoverageWarningDialog.tsx`) so confirmation UX can iterate independently.
- **Estimate page** retains one inline positional block for the photo picker menu; everything else uses Tailwind utilities.
- **Runtime CSS injection eliminated** ✅: Keyframes (`cwspin`, `cwbar`) and debug handle styles (`.cw-handle`) now live in `globals.css`. Runtime debug API (`window.cwDebug.set()`) preserved for live CSS variable overrides when `NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1`.

---

## Phase Progress

| Phase | Status | Notes |
| --- | --- | --- |
| **1. Foundation** | ✅ Completed | Tailwind, PostCSS, `globals.css`, `cn()` helper, base fonts wired through layout. Token coverage comprehensive. |
| **2. Component Library** | ✅ Core Complete | Core primitives complete: Banner, Toast, Button, Card, Chip, Dialog, Input, Progress, Select, Spinner. Optional: EmptyState, RadioGroup, ListGroup, Badge. |
| **3. Page Migration** | 🚧 In Progress | Static layout/colour styles on Configure + Estimate are Tailwind-powered; geometry-only inline styles remain by design. Key configurator sections (layout shell, summary panel, debug tools, services list, filters panel) are separate components. |
| **4. Documentation** | 🚧 In Progress | Quickstart and migration guides updated to outline real status (see below). Keep docs synced as each section converts. |
| **5. Validation** | ⏳ Pending | Full regression pass blocked until inline styles are removed and shared tokens are confirmed. |

---

## Outstanding Work Before UI/UX Overhaul
1. **Step 1 – Design Token Alignment (In Progress)**  
   - Collect brand-approved palette (primary, neutrals, success/warning/error, glass overlays).  
   - Move overlay gradients, glass backgrounds, stitch line colours, and debug handle chrome into Tailwind theme or CSS variables.  
   - Confirm spacing and shadow scales with designer.

2. **Step 2 – Remove Static Inline Styles**  
   - ✅ Replace static layout/colour styles on Configure + Estimate with Tailwind classes.  
   - ✅ Update slider and modal controls to rely on shared classes rather than inline colour values.  
   - ✅ Extract configurator layout shell, summary panel, debug tools, and services list into dedicated components; remaining sidebar filters to follow.  
   - 🔄 Revisit CornerSelector SVG colours once brand tokens are defined.

3. **Step 3 – Centralise Dynamic Styling** ✅ COMPLETED  
   - ✅ Eliminated runtime `<style>` injection: keyframes and debug handle styles now in `globals.css`.  
   - ✅ Preserved `window.cwDebug.set()` runtime API for live CSS variable overrides.  
   - 🔄 Document debug API usage in `docs/RUNBOOK.md` (pending).

4. **Step 4 – Expand UI Kit** ✅ CORE COMPLETED  
   - ✅ Created **Banner** component (info, warning, error, success variants) for inline notifications.
   - ✅ Created **Toast** component (top, center, bottom positions) for overlay messages.
   - ✅ Added 13 semantic color tokens to `globals.css` (info, warning, error, success palettes).
   - 🔄 Optional: EmptyState, RadioGroup, ListGroup, Badge components can be added as needed.
   - 📖 Full documentation in `docs/UI-KIT-EXPANSION.md`.

---

## Next Checkpoints
- ✅ Gather colour/gradient inventory (see `docs/UI-UX-OVERHAUL-AUDIT.md`).  
- 🔄 Produce canonical token proposal for designer approval.  
- 🔄 Update `.env.example` / documentation if new feature flags are introduced during refactor.  
- ⏳ Run end-to-end flow (upload → measure → segment → preview) once static styles are removed to confirm no regressions.

---

## References
- `docs/UI-UX-OVERHAUL-AUDIT.md` – comprehensive issue list.  
- `docs/UI-PREP-QUICKSTART.md` – phased action plan (kept in sync with this status file).  
- `docs/CONFIGURE-MIGRATION-GUIDE.md` – implementation checklist for the configurator page.  
- `apps/web/tailwind.config.ts` – current token source of truth.  
- `apps/web/app/globals.css` – base typography, forms, and utility layers.
