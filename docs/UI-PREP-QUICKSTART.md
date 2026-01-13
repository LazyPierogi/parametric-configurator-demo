# UI/UX Overhaul Preparation — Quick Start

> **TL;DR:** Tailwind and the base UI kit are already in place, but static inline styles and ad-hoc colour values still block a clean redesign. Step 1 is to align on design tokens and move those values into the shared theme.

---

## Where We Stand (October 18, 2025)
- ✅ Tailwind CSS v3, PostCSS, and `globals.css` are configured and loaded by `app/layout.tsx`.
- ✅ Core primitives live in `apps/web/components/ui` (Button, Input, Card, Chip, Select, Dialog, Progress, Spinner).
- ⚠️ Inline style debt reduced: Configure/Estimate now rely on Tailwind for static layout/colour; remaining inline styles are geometry-driven (curtain rendering, SVG overlays). Debug handle CSS is still injected at runtime.
- ⚠️ Brand colours, gradients, and glass overlays are duplicated inside feature components rather than defined as tokens.
- ❌ Documentation previously marked the migration complete—status has been corrected in `docs/MIGRATION-STATUS.md`.

---

## Phase Plan (Refreshed)

### Phase 1 — Design Token Alignment (In Progress)
1. **Confirm palette with design**  
   - Primary, secondary, neutral greys  
   - Semantic colours (success/warning/error)  
   - Glassmorphism overlays, stitch-line colours, debug handle chrome  
2. **Expand Tailwind theme** (`apps/web/tailwind.config.ts`)  
   - Add missing colours, gradients, box shadows, and spacing values.  
   - Mirror the token names in CSS variables inside `globals.css` so non-Tailwind code (SVG, canvas, shaders) can consume them.  
   - ✅ Current overlay, scrim, and debug-handle colours now live in these tokens so the upcoming palette swap only needs value changes.  
3. **Document tokens**  
   - Update this guide and `docs/RUNBOOK.md` with the agreed palette.  
   - Capture usage guidance (e.g., when to pick `primary-600` vs `primary-700`).  

### Phase 2 — Remove Static Inline Styles
- ✅ Replace static layout/colour styles with utility classes (`ConfigurePage`, `EstimatePage`, success banners, modals).  
- ✅ Update Range Slider + Estimate modal to rely on Tailwind classes rather than hard-coded colours.  
- ✅ Split configurator layout shell (`ConfiguratorLayout.tsx`), summary panel (`SummaryPanel.tsx`), debug tools (`DebugControls.tsx`), services list (`ServicesSection.tsx`), and the sidebar/filter panel (`FiltersPanel.tsx`) into dedicated components with i18n-backed copy.  
- 🔄 Revisit `CornerSelector` SVG fills once palette tokens are approved.

### Phase 3 — Centralise Dynamic Styling
- Replace runtime `<style>` injection used for debug handles with a dedicated stylesheet that manipulates CSS variables.  
- Ensure lighting overlays, gradients, and stitch-line colours are controlled through tokens/env-configured variables, not literals.  
- Document any runtime overrides in `docs/RUNBOOK.md` (how to toggle, expected ranges).

### Phase 4 — Expand UI Kit Coverage
- Promote repeated patterns (upload banners, empty states, service rows, confirmation modals, toast banners) into `apps/web/components/ui`.  
- Provide simple MDX/Storybook snippets (or screenshots) so the design team can review states without digging into code.  
- Keep all user-facing copy in the i18n catalog (already true today—continue the discipline).

### Phase 5 — Validation
- Run end-to-end flow (Upload → Measure → Segment → Preview) on desktop + mobile breakpoints.  
- Exercise debug toggles, lighting modes, storefront iframe communication, and error states.  
- Capture screenshots for the designer once the foundation is stable to accelerate the upcoming overhaul.

---

## Operational Checklist
- [ ] Confirm palette and token names with the designer (see open questions at the bottom).  
- [ ] Extend Tailwind theme and CSS variables with the approved tokens.  
- [~] Extract remaining static inline styles (geometry-only inline styles remain by design; sidebar filters still inline).  
- [ ] Replace runtime style injection with configurable variables.  
- [ ] Expand the UI kit to cover repeated patterns.  
- [ ] Update docs (`MIGRATION-STATUS.md`, `CONFIGURE-MIGRATION-GUIDE.md`, `RUNBOOK.md`) after each milestone.  
- [ ] Re-run the full experience to verify no regressions.

---

## Token Inventory (Needs Confirmation)
| Usage | Current Value (Code) | Notes |
| --- | --- | --- |
| Primary brand | `#4a67ff` | Already in Tailwind config — confirm if this remains the primary blue. |
| Primary dark | `#1f2b6c`, `#0f172a` | Used for text and gradients; ensure naming aligns with brand guidelines. |
| Accent neutrals | `#e5e7eb`, `#d1d5db`, `#94a3b8`, `#475569` | Scattered across upload zone, summary cards, and validation hints. |
| Success | `#10b981`, `#059669`, `#047857` | Mix of Tailwind tokens + inline hex values; needs consolidation. |
| Warning | `#e6c762`, `#fff7dc`, `#7a5b08` | Debug cache notice uses custom yellows; consider official warning palette. |
| Error | `#ef4444`, `#b91c1c`, `#c53030`, `#fee2e2`, `#fff1f2` | Inline fallback borders and backgrounds. |
| Glass overlay | `rgba(2,6,23,0.25–0.60)`, `rgba(248,250,252,0.5–0.62)` | Configure page panel background; should become tokens. |
| Stitch lines | `rgba(${STITCH_LINE_RGB}, 0/1)` | Currently derived in code; expose base colour via variable. |
| Debug handles | CSS injected via `<style>` (`--cw-handle-bg`, `--cw-ring-rgb`, etc.) | Needs to migrate to managed variables/config. |

---

## Open Questions for Design
1. Do we have an updated brand palette (primary/secondary/neutral) beyond what is hard-coded today?  
2. Should the glass overlay follow a named token (e.g., `surface-glass`), and are there multiple opacity levels we must support?  
3. What is the canonical success/warning/error palette (hex values and usage notes)?  
4. Are there typography changes expected for the overhaul (new font family, font-weight mapping)?  
5. Any accessibility targets (contrast ratios, preferred minimum font sizes) we should bake into tokens upfront?  

Document answers in this file once confirmed—this becomes the foundation for the overhaul.
