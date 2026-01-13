# Configure Page Migration Guide

**Status:** 🚧 In Progress — awaiting token alignment (Phase 1)  
**Last updated:** October 18, 2025

This guide tracks the work needed to migrate `apps/web/app/configure/page.tsx` away from ad-hoc inline styling toward Tailwind classes, shared tokens, and reusable components.

Important: this migration is not a drop-in replacement for the existing page. It is a refactoring of the page to make it more maintainable and easier to update. The purpose is not to change the appearance of the page or lock any design choices and values, but to make a scaffolding/architecture that will make it easier to update the page in the future.

---

## Critical Sections to Preserve

### 1. Curtain Rendering Logic (lines ~2600-2800)
Keep all geometry-dependent inline styles that control curtain textures, transforms, and background sizing. These values respond to user input and must remain dynamic until they can read from CSS variables.

### 2. Debug Handle Behaviour (lines ~1500-1600)
Current implementation injects CSS to style `.cw-handle` elements. During refactor, migrate this CSS into a managed stylesheet (or CSS variables) without changing pointer/drag behaviour.

---

## Current Snapshot
- **Static inline styles remaining:** limited to geometry-driven rendering (curtain textures, SVG overlays, drag handle positioning).  
- **Runtime style injections:** ✅ ELIMINATED - all keyframes and debug handle styles now in `globals.css`.  
- **Components already in use:** `Button`, `Card`, `Chip`, `Dialog`, `Progress`, `Spinner`, `Select`.  
- **Configurator modules extracted:** `ConfiguratorLayout.tsx`, `SummaryPanel.tsx`, `DebugControls.tsx`, `ServicesSection.tsx`, and `FiltersPanel.tsx` now live in `apps/web/app/configure/components/`, with all copy sourced from the shared i18n catalog.  
- **Token status:** overlay gradients, glass surfaces, clamp/stitch toasts, cache banners, and debug handles now share CSS variables/Tailwind aliases; remaining inline values are limited to geometry-driven curtain rendering and lighting gradients.

---

## Migration Strategy
### Step A — Unlock Tailwind Adoption
1. **Break the page into presentational modules** (`ConfiguratorLayout`, `UploadPanel`, `PreviewCanvas`, `SummaryPanel`, `DebugControls`, `ServicesSection`, etc.) to make styling manageable. Keep these under `apps/web/app/configure/components/` so shared styling stays focused and i18n-driven.  
2. **Adopt Tailwind classes** for static layout/typography borders (padding, gap, font sizing).  
3. **Replace repeated inline styles** (e.g., dropzone border, card backgrounds) with utility classes or CSS variables.

### Step B — Tokenise Colours & Gradients
1. Map every hard-coded hex/rgba value to a token from Phase 1.  
2. Expose needed CSS variables (for SVG overlays, stitch lines, debug handles) in `globals.css`.  
3. Replace literal gradients (`overlayGradient`, glass background) with token references once defined.
4. Configure page glass/overlay appearance now reads from `--cw-config-overlay-*` tokens; adjust those variables for future palette changes instead of `.env`.

### Step C — Tidy Dynamic Styling ✅ COMPLETED
1. ✅ Moved `cwspin` and `cwbar` keyframes into `globals.css`.  
2. ✅ Migrated debug handle `.cw-handle` styles from runtime `<style>` injection to `globals.css` with CSS variables.  
3. ✅ Runtime API preserved: `window.cwDebug.set()` allows live variable overrides when `NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1`.  
4. Runtime API documented below (RUNBOOK update pending).

### Step D — Promote Shared Components
1. Migrate service rows, budget banners, coverage confirmation modal, and info chips into `apps/web/components/ui`.  
2. Keep i18n keys in place; components should accept translated labels as props.

---

## Checklist (Update as You Go)

### Layout Shell
- [ ] Glass overlay + background use tokens (no raw rgba).  
- [x] Shell padding, margins, and shadows expressed with Tailwind classes.  
- [~] Debug notice banner uses shared banner component (currently Tailwind-styled inline).

### Upload + Preview Area
- [x] Dropzone border/hover states use Tailwind utilities or tokens.  
- [x] Empty state copy styled with utility classes.  
- [x] Loading overlay uses `<Spinner>` and `<Progress>` components with Tailwind layout classes.

### Summary + Config Panels
- [x] Summary rows use `.summary-row` utility class.  
- [x] Panel headings use `.panel-heading`.  
- [x] Chips/Cards use component props for selected/hover states (no inline overrides).  
- [x] Services list uses shared layout component.

### Debug & Modals
- [x] Debug toolbar buttons use `Button` variants only.  
- [~] Coverage warning modal uses `<Dialog>` with Tailwind classes (still needs token pass).  
- [x] Debug handle styles migrated to CSS variables in `globals.css` (no runtime injection).

### Dynamic Geometry (leave inline until later phases)
- [x] Curtain texture transforms.  
- [x] Wall box overlays and stitch lines (pending variable integration).  
- [x] Slider handle positioning/size (but colour should come from token).

---

## Runtime Debug API

When `NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1`, the configure page exposes `window.cwDebug.set()` for live CSS variable customization:

```javascript
// Example: change debug handle appearance in browser console
window.cwDebug.set({
  handleBg: '#3b82f6',           // blue background
  handleBorder: 'rgba(0,0,0,0.3)', // darker border
  ringRgb: '59, 130, 246',       // blue focus ring
  ringOpacity: 0.5,              // more visible ring
  handleOpacity: 0.8,            // slightly transparent
  wallStroke: '#10b981',         // green wall outline
  wallStrokeOpacity: 1
});
```

**Available CSS Variables:**
- `--cw-handle-bg` - handle background color
- `--cw-handle-border` - handle border color
- `--cw-ring-rgb` - focus ring RGB values (e.g., "74, 103, 255")
- `--cw-ring-opacity` - focus ring opacity (0-1)
- `--cw-handle-opacity` - handle opacity (0-1)
- `--cw-wall-stroke` - wall box outline color
- `--cw-wall-stroke-opacity` - wall outline opacity (0-1)

All variables are defined in `apps/web/app/globals.css` with defaults.

---

## Testing Requirements
- [ ] Upload → segment → preview flow (desktop + mobile).  
- [ ] Lighting modes (env-controlled) still render as expected.  
- [ ] Stitch lines visible when `widthsPerSegment > 1`.  
- [ ] Debug controls (cache bypass, provider switch) functional.  
- [ ] Parent iframe messaging unaffected.  
- [ ] Keyboard/focus states preserved for accessibility.

---

## Reporting
Update the following after each migration milestone:
- `docs/MIGRATION-STATUS.md`  
- `docs/UI-PREP-QUICKSTART.md`  
- `docs/RUNBOOK.md` (if controls/toggles move)  
- `project planning/05-Task-List.md` (mark appropriate tasks)  
- `AGENTS.md` (summaries for other agents)
