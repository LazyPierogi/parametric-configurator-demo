# Curtain Wizard — UI/UX Audit & Final Sprint

**Date:** December 1, 2025  
**Status:** Single Source of Truth for MVP Launch  
**Decision:** Desktop = current layout (no carousel), Mobile = clean, scrollable filters/chips (simple horizontal scroll; dedicated carousel component is post-MVP)

---

## 📊 Current State Summary

### What's Been Built Since Last UI/UX Session

| Workstream | Status | Key Deliverables |
|------------|--------|------------------|
| **Design System** | ✅ 80% | `packages/ui` with tokens, Ladle, Button/Card/Chip/Dialog/Input/Toggle/NumericInput |
| **Measurement Pipeline** | ✅ 85% | Qwen wall-first, mask heuristics, FlowState canonical measurement, diagnostics |
| **New Flow (Curtain-First)** | ✅ 75% | `/estimate` polygon marking, parallel segmentation, `/configure` restore |

### UI/UX Overhaul Phase Status

| Phase | Progress | Notes |
|-------|----------|-------|
| 1. Foundation & Theme | 95% | Dual palette, typography, shadows, blur, grid, mobile-first layout done |
| 2. Core Components | 35% | Button/Card/Chip/Dialog done, Carousel/Toggle variants pending |
| 3. Motion System | 15% | Basic CSS animations; Framer Motion not installed |
| 4. Stage Implementations | 30% | Upload/WallBox partial, Config/AddOns/Summary partial |
| 5. Backend & Integration | 50% | State management partial, AI integration done, Parent bridge done |
| 6. Polish & Edge Cases | 15% | Some perf work done, testing/docs pending |

---

## 🛡️ Guardrails for This Sprint

- **Flow safety:** Keep both `legacy` and `new` configure flows working; do not change the measurement pipeline or mask heuristics in this sprint.
- **Design system first:** Shared visual changes go via the `packages/ui` kit → shim → app pattern; only one-off layout/wiring tweaks live directly in `apps/web`.
- **Mobile-first:** Prioritize mobile usability (`/configure` polygon and segment dragging, scrolling) before desktop-only polish.
- **Low complexity:** Prefer simple horizontal scroll / responsive layouts over new complex components (full carousel, advanced motion) for MVP.

---

## 🚨 Regressions to Fix (MUST-HAVES)

### R1. Desktop Layout Broken — Summary Misplaced ✅ FIXED
**Symptom:** Summary panel appears between Hero and FiltersPanel instead of below  
**Expected:** Desktop = Hero+Summary column left, FiltersPanel right  
**File:** `apps/web/app/configure/page.tsx`  
**Fix:** 
- Summary now renders inside Hero column (same width as Hero)
- Reduced gap between columns (`lg:gap-6` → `lg:gap-4`)
- Panel closer to Hero+Summary

### R2. Mobile Touch Drag Not Working ✅ FIXED
**Symptom:**  
- Wall-box/polygon handles only respond to click, not smooth drag on mobile.  
- On mobile, dragging a corner moves it only a short distance and then stops (feels more like a step/tap than continuous drag).  
- Drag can start even when tapping outside the photo/hero image area (overlay), which should **not** initiate handle drag.  
**Expected:** Touch-drag should move handles smoothly like desktop mouse drag, and only when the user starts the gesture on the photo/overlay region.  
**Files:** `apps/web/app/configure/components/HeroSurface.tsx`, `apps/web/app/configure/page.tsx`  
**Status:** ✅ DONE — fixed in Sprint 1 (R2).  
**Fix (high level):**
- Restrict drag start to the image/overlay hit area; ignore pointer-down that begins outside the hero.  
- Keep drag active as long as `pointermove` events fire (window-level listeners), without prematurely clearing `dragIx`.  
- Ensure consistent behavior for corner handles, wall-box moves, and segment drag on mobile, while preserving desktop behavior.  

### R3. Color Chips Spacing & Selection Shape ✅ FIXED
**Symptom:** 
- Chips have excessive gap between them (looking "rozstrzelone")  
- Selected state shows elliptical ring instead of perfect circle  
**Expected:** Compact gaps, circular selection ring matching chip shape  
**File:** `packages/ui/src/components/chip.tsx` (swatch variant)  
**Status:** ✅ DONE — fixed in Sprint 1 (R3).
**Fix:**
- Reduced flex gap in `FiltersPanel.tsx` (`gap-2` → `gap-1`)
- Added `flex-shrink-0` to swatch variant to prevent elliptical deformation
- Adjusted ring offset (`ring-offset-2` → `ring-offset-1`) for tighter selection ring  

### R4. Button Radius Inconsistency
**Symptom:** Some buttons use `rounded-lg`, others use different radii  
**Expected:** Consistent `rounded-lg` (8px) across all buttons  
**File:** `packages/ui/src/components/button.tsx` — already uses `rounded-lg`  
**Root Cause:** Ad-hoc button styling in pages/components bypassing kit  

### R5. Exit/Warning Dialog Positioning
**Symptom:** Exit dialog appears off to the side instead of centered  
**Expected:** Centered like WelcomeModal (consistent modal placement for mock + iframe)  
**File:** `packages/ui/src/components/dialog.tsx`  
**Root Cause:** Dialog uses `flex items-center justify-center` but without explicit centering on all screen sizes  

### R6. Estimate→Configure Transition Flash
**Symptom:** "4 corners marked" popup briefly flashes during page transition  
**Expected:** Smooth fade-out from `/estimate`, fade-in reveal of `/configure` visualization  
**Files:** `apps/web/app/estimate/page.tsx`, `apps/web/lib/motion-utils.ts`  
**Root Cause:** No exit animation; state carries over causing overlay to render momentarily  

### R7. Havinic Palette Not Default
**Symptom:** App loads with Signature palette instead of Havinic Harmony  
**Expected:** Havinic should be default (especially in storefront/iframe context)  
**File:** `apps/web/lib/palette-context.tsx`  
**Root Cause:** Default set to `'signature'` instead of `'havinic'`  

---

## ✅ Must-Haves for MVP Launch

### Layout & Navigation
- [x] **R1-FIX:** Move Summary rendering outside Hero column (desktop) ✅
- [x] **R2-FIX:** Continuous mobile touch-drag for wall-box/polygon/segment handles (only when dragging on photo) ✅
- [ ] **R6-FIX:** Add exit animation on `/estimate` before navigating to `/configure`

### Visual Consistency
- [x] **R3-FIX:** Reduce color chip gaps in fabric cards (gap-1.5 or gap-1) ✅
- [x] **R3-FIX:** Fix swatch selection ring to be circular (adjust ring-offset or sizing) ✅
- [ ] **R4-FIX:** Audit all buttons for consistent radius usage
- [ ] **R5-FIX:** Center dialogs consistently (check viewport positioning)
- [ ] **R7-FIX:** Change default palette to Havinic

### Mobile Priority
- [x] Mobile polygon marking works (already OK)
- [x] Mobile wall-box corner manipulation via touch-drag
- [x] Mobile segment handle manipulation via touch-drag
- [x] Mobile-friendly Summary panel scrolling
- [ ] Touch-friendly button sizing (min 44px hit targets)
- [ ] **Simple horizontal scroll for mobile filters/chips** (dedicated carousel component is post-MVP)

### Transitions & Feedback
- [ ] Page transitions: `/estimate` → `/configure` with fade-out/fade-in
- [ ] No flash of "4 corners marked" during transition
- [ ] Loading states visible during segmentation/measurement

### Production Readiness
- [ ] Curtain-first flow tested end-to-end
- [ ] Both mock and storefront providers working
- [ ] Error states have recovery paths
- [ ] Exit/back navigation shows warning dialog

---

## 🎯 Nice-to-Haves (Post-MVP)

### Motion System Upgrade
- [ ] Install Framer Motion
- [ ] Stage transitions with proper choreography
- [ ] Button press feedback (scale 0.98)
- [ ] Card hover lift effect
- [ ] Chip selection morph animation

### Component Polish
- [ ] Shimmer loading overlays
- [ ] Flash success animations
- [ ] Shake error feedback
- [ ] Idle breathing animation

### Advanced UX
- [ ] AI progress indicators with real progress binding
- [ ] Low-light photo detection prompt
- [ ] Offline banner with recovery

### Accessibility
- [ ] ARIA live regions for AI feedback
- [ ] Keyboard navigation improvements
- [ ] Screen reader announcements
- [ ] Focus management polish

### Performance
- [ ] Lazy load heavy components
- [ ] Preload curtain textures
- [ ] IntersectionObserver for off-screen content

---

## 📋 Implementation Order (Recommended Sprint)

### Sprint 1: Critical Fixes (2-3 days)
1. **Desktop Layout** — Fix Summary placement (R1)
2. **Mobile Touch** — Wire touch-drag for handles (R2)
3. **Color Chips** — Fix spacing + selection shape (R3)

### Sprint 2: Visual Consistency (1-2 days)
4. **Button Radius** — Audit and unify (R4)
5. **Dialog Centering** — Fix positioning (R5)
6. **Default Palette** — Switch to Havinic (R7)

### Sprint 3: Transitions (1-2 days)
7. **Page Transition** — Add exit animation on `/estimate` (R6)
8. **Loading States** — Ensure visible feedback during async ops

### Sprint 4: QA & Polish (2-3 days)
9. Full end-to-end testing both flows
10. Mobile testing on real devices
11. Storefront iframe testing
12. Documentation updates

---

## 🔧 Technical Notes

### Files Requiring Changes

| Regression | Primary File | Secondary Files |
|------------|--------------|-----------------|
| R1 | `apps/web/app/configure/page.tsx` | — |
| R2 | `apps/web/app/configure/components/HeroSurface.tsx` | `apps/web/app/estimate/page.tsx` |
| R3 | `packages/ui/src/components/chip.tsx` | `apps/web/app/configure/components/FiltersPanel.tsx` |
| R4 | `packages/ui/src/components/button.tsx` | Audit all page files |
| R5 | `packages/ui/src/components/dialog.tsx` | — |
| R6 | `apps/web/app/estimate/page.tsx` | `apps/web/lib/motion-utils.ts` |
| R7 | `apps/web/lib/palette-context.tsx` | — |

### Feature Flags to Validate
- `NEXT_PUBLIC_TEXTURES_PIPELINE=artist` — canvas renderer
- `NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1` — debug panel (disable for prod)
- `CATALOG_PROVIDER=mock|storefront` — catalog source

### Design System Integration
- All new UI changes must go through kit → shim → app pattern
- Run `npm run check:tokens` after any token changes
- Test with both palettes (Havinic + Signature)

---

## 📚 Reference Documents

- `docs/DESIGN-SYSTEM-IMPLEMENTATION-PLAN.md` — Kit architecture
- `docs/DESIGNER-SYSTEM-GUIDE.md` — Workflow for designers
- `project planning/Measurement-Pipeline-Overhaul.md` — Measurement checklist
- `project planning/NEW-FLOW-PLAN.md` — Curtain-first flow milestones
- `docs/UI-UX_Overhaul/UI-UX_Overhaul_TaskList.md` — Original task list (historical)

---

## ✏️ Status Legend

- ✅ **DONE** — Completed and tested
- 🔄 **PARTIAL** — Started but needs more work
- ⏳ **PENDING** — Not started
- 🚨 **REGRESSION** — Was working, now broken

---

**Next Action:** R1 (Desktop Layout) and R2 (Mobile Touch) are complete; focus now on R3 (Color Chips) within Sprint 1.

*Last Updated: December 1, 2025*
