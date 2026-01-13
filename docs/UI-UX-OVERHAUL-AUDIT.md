# UI/UX Overhaul Readiness Audit

**Last updated:** October 18, 2025  
**Status:** ❌ **NOT READY** — Substantial styling cleanup required before redesign

---

## Executive Summary
The groundwork for Tailwind is in place, but static inline styles, incomplete design tokens, and ad-hoc gradients still make a UI/UX overhaul risky. Without consolidating styling in one source of truth, every visual change will require repetitive manual edits across the configurator and estimate flows.

**Key blockers:**
- **Tokens are incomplete:** overlays, glass backgrounds, warning states, and stitch-line colours are duplicated as raw hex/rgba values.
- **Component library coverage is partial:** the base UI kit exists but repeated patterns (upload banners, empty states, service rows) still live directly inside feature pages.
- **Dynamic CSS is injected at runtime**, making it difficult to reason about theming, themability, or dark-mode considerations.
- **Configurator still monolithic:** despite Tailwind adoption, the 3.5k-line page needs decomposing into modules before a full redesign.

---

## Current State

### ✅ Strengths
1. **Tailwind + PostCSS configured** (`apps/web/tailwind.config.ts`, `globals.css` imported in `app/layout.tsx`).
2. **Reusable primitives available** in `apps/web/components/ui` (Button, Card, Chip, Dialog, Input, Progress, Select, Spinner).
3. **i18n architecture solid**, so copy changes remain easy during the overhaul.
4. **Monorepo + TypeScript structure** keeps business logic separate from UI, reducing blast radius of styling work.

### ❌ Critical Gaps
1. **Tailwind adoption incomplete** – static layout/colour styles now use Tailwind, but the configurator remains monolithic and some runtime styles (debug handles, overlays) bypass the theme.
2. **Design tokens missing coverage** – gradients, glass overlays, cache notices, and validation states use one-off colour literals instead of tokens.
3. **Runtime CSS injection** – debug handle styles are written into the `<head>` via `useEffect`, bypassing Tailwind and complicating overrides.
4. **Dynamic SVG styling hard-coded** – CornerSelector and range slider handles embed brand colours directly in SVG attributes.
5. **Documentation drift** – previous reports incorrectly marked the migration complete; updated docs now reflect the true state (see `docs/MIGRATION-STATUS.md`).

---

## Inline Style Inventory (October 18)
| File | Static `style={{}}` blocks | Notes |
| --- | --- | --- |
| `apps/web/app/configure/page.tsx` | (geometry only) | Static layout/typography now Tailwind; remaining inline styles drive curtain geometry, SVG overlays, or mask transforms. |
| `apps/web/app/estimate/page.tsx` | 1 | Floating picker menu positioned via pointer coordinates (kept inline). |
| `apps/web/components/ui/Progress.tsx` | 1 | Dynamic width style retained (controls bar fill). |
| _Others_ | 0 | Previously inline-heavy files (`LanguageSwitcher`, `CornerSelector`, debugger page) now mostly use Tailwind but still contain hard-coded colours. |

Two additional `<style>` tags are injected at runtime:
1. Spinner keyframes (`cwspin`, `cwbar`) – could move into `globals.css`.
2. Debug handle palette (`--cw-handle-*`, `--cw-ring-*`) – should migrate to managed CSS variables.

---

## Token Coverage Gaps

| Usage | Current Value | Target Action |
| --- | --- | --- |
| Primary Blue | `#4a67ff` | Already a Tailwind token; confirm it remains the hero colour. |
| Primary Dark | `#1f2b6c`, `#0f172a` | Multiple variants in code; consolidate naming (`primary-700`, `primary-900`). |
| Neutral Greys | `#e5e7eb`, `#d1d5db`, `#94a3b8`, `#475569`, `#334155` | Add to Tailwind theme and CSS variables for consistent usage. |
| Success | `#10b981`, `#059669`, `#047857`, `#065f46` | Normalise to a single success scale. |
| Warning | `#e6c762`, `#fff7dc`, `#7a5b08` | Introduce warning palette tokens; align with brand if different. |
| Error | `#ef4444`, `#b91c1c`, `#c53030`, `#fee2e2`, `#fff1f2`, `#fecaca` | Use Tailwind semantic palette; expose background/border variants. |
| Glass Overlay | `rgba(2,6,23,0.06–0.60)` | Create named tokens for light/medium/dark overlays. |
| Cache Notice Backgrounds | `#eef3ff`, `#fff7dc` | Tokenise banner backgrounds and border colours. |
| Stitch Lines | `rgba(${STITCH_LINE_RGB}, 0/1)` | Provide CSS variable for base stitch colour and opacity ramp. |
| Debug Handles | Values assigned in injected CSS | Move to CSS variables or Tailwind utilities with runtime overrides. |

---

## Component Library Coverage
- **Existing:** Button, Card, Chip, Dialog, Input, Select, Spinner, Progress (with Tailwind-based styling).
- **Configurators:** Layout shell (`ConfiguratorLayout.tsx`), summary panel (`SummaryPanel.tsx`), debug tools (`DebugControls.tsx`), services list (`ServicesSection.tsx`), and filters/sidebar (`FiltersPanel.tsx`) now have dedicated components in `apps/web/app/configure/components/`, with debug copy routed through the shared i18n catalog.
- **Tokens:** Current overlay scrims, glass surfaces, clamp toasts, and debug handle chrome are mirrored into Tailwind/CSS variables so the future palette swap can focus on value changes.
- **Missing:** Upload/empty state banners, budget slider wrapper, coverage warning modal, toast/banner patterns; consider moving new configurator components into the shared UI library once tokens are in place.

---

## Recommended Preparation Plan
Matches the refreshed quickstart guide (`docs/UI-PREP-QUICKSTART.md`).

1. **Phase 1 – Design Token Alignment (In Progress)**  
   - Confirm palette + typography expectations with the designer.  
   - Extend Tailwind theme and CSS variables to cover overlays, warnings, stitches, debug handles.  
   - Document tokens and usage rules.

2. **Phase 2 – Remove Static Inline Styles**  
   - Refactor `ConfigurePage` into smaller presentational components (layout shell, summary, debug tools, services complete; sidebar filters pending).  
   - Replace inline layout/colour styles with Tailwind classes or CSS variables.  
   - Update Estimate page error styling to use tokens.

3. **Phase 3 – Centralise Dynamic Styling**  
   - Move spinner/debug CSS into stylesheet modules with variable overrides.  
   - Expose lighting overlays and stitch-line colours through tokens/env toggles.  
   - Document operational switches in `docs/RUNBOOK.md`.

4. **Phase 4 – Expand UI Kit**  
   - Promote repeated patterns to shared components.  
   - Provide quick preview references (MDX/Storybook or annotated screenshots).

5. **Phase 5 – Validation**  
   - Re-run upload → measure → segment → preview on desktop & mobile.  
   - Confirm debug toggles, storefront bridge, lighting modes still function.  
   - Capture baseline screenshots for the incoming redesign.

---

## Open Questions for Design
1. Confirm the canonical colour palette (hex values + intended usage).  
2. Define overlay/glass tokens and opacity levels required for the configurator shell.  
3. Decide on success/warning/error palette (and whether banners need iconography).  
4. Clarify typography expectations (any new type scale or font changes?).  
5. Identify accessibility goals (contrast, minimum sizes) to encode into tokens.

Documented answers will unblock tokenisation and set the stage for the UI/UX overhaul.
