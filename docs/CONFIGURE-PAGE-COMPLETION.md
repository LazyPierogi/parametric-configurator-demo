# Configure Page Migration — Work in Progress

**Last updated:** October 18, 2025  
**Status:** ⚙️ Partially migrated — geometry-only inline styling remains

---

## Overview
Static layout and colour styles have been moved to Tailwind classes. Remaining inline styling is limited to geometry-driven logic (curtain textures, SVG overlays, draggable handles) plus the existing debug CSS injection. Two runtime `<style>` blocks (`cwspin`/`cwbar` keyframes, debug handle palette) still need to be relocated during Stage 3.

> Tokens are still pending. Treat the configurator as **partially ready**: styling is centralised, but the file needs further decomposition and token integration before the overhaul.

---

## What’s Done
- Tailwind + PostCSS configured and loaded globally.  
- Base UI kit components available in `apps/web/components/ui`.  
- Static inline styles in Configure + Estimate replaced with Tailwind utilities.  
- Range slider + success banners now use shared classes instead of hard-coded colours.  
- Configurator shell (`ConfiguratorLayout.tsx`), summary panel (`SummaryPanel.tsx`), debug controls (`DebugControls.tsx`), services list (`ServicesSection.tsx`), sidebar filters (`FiltersPanel.tsx`), and the coverage warning dialog (`CoverageWarningDialog.tsx`) extracted into dedicated components with shared i18n copy.  
- Overlay scrims, glass panels, clamp toasts, and debug handles now pull colours/shadows from CSS variables/Tailwind tokens, so the upcoming palette swap only touches the token map.  
- Curtain rendering logic isolated and documented.  
- Critical sections to preserve logged in `docs/CONFIGURE-MIGRATION-GUIDE.md`.

---

## What’s Outstanding
1. **Token pass** – glass overlay, debug palettes, stitch lines still depend on literal rgba values (awaiting Step 1).  
2. **Debug handle CSS** – move runtime `<style>` injection to a managed stylesheet / CSS variables.  
3. **Story/state coverage** – promote frequently reused UI (service rows, toast/banner patterns) into the shared component library for consistency.  
4. **Testing & docs** – run full flow verification once tokens are applied; update `RUNBOOK.md` with new styling hooks.

---

## Next Steps
- Finish Step 1 (design token alignment) so gradients and override colours can move into tokens.  
- Replace remaining runtime CSS injection with configurable variables.  
- Update docs/tests after tokens land and regression pass is complete.
