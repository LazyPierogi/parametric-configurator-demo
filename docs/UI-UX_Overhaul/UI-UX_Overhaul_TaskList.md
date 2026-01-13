# Curtain Wizard — UI/UX Overhaul Task List

**Version:** 1.1  
**Created:** October 23, 2025  
**Updated:** December 1, 2025  
**Foundation Status:** ✅ 85% Complete (Tailwind, 15+ components, 50+ tokens)  
**Organization:** Implementation Order (Foundation → Components → Stages)

> ⚠️ **IMPORTANT:** For MVP launch priorities and current regressions, see:  
> **[UI-UX-AUDIT-AND-FINAL-SPRINT.md](./UI-UX-AUDIT-AND-FINAL-SPRINT.md)** — Single Source of Truth  
>  
> This document remains the historical task reference. The audit document tracks:
> - 7 active regressions to fix
> - Must-haves vs nice-to-haves for MVP
> - Recommended sprint order

---

## 📊 Overview

- **Total Tasks:** ~85
- **Design Docs:** /docs/UI-UX_Overhaul/
- **Phases:** 6 (Foundation, Components, Motion, Stages, Backend, Polish)
- **Approach:** Build on existing foundation, implement dual palettes, add motion, refine stages
- **Priority:** Minimal Carousel variant first, test as we go (no dedicated QA phase)
- **Design System:** @designer-system-implementation-plan.md + @designer-system-guide.md
- **Measurement Pipeline:** @measurement-pipeline-overhaul.md
- **New Flow:** @new-flow-plan.md

---

## 🎯 Phase 1: Foundation & Theme System

### 1.1 Dual Palette Implementation

- **T1.1.1** ✔️ **DONE** - Audit current token system vs. new palette requirements
- **T1.1.2** ✔️ **DONE** - Add Havinic Harmony palette tokens to `globals.css`
  - Linen White (#F9F8F6), Graphite (#2E2E2E), Honey Oak (#D6A354), etc.
- **T1.1.3** ✔️ **DONE** - Add Curtain Wizard Signature palette tokens
  - Base (#FAFAFB), Sage (#A8C3A1), Lilac (#D9C2F0), glass variables
- **T1.1.4** ✔️ **DONE** - Create PaletteContext provider in `lib/palette-context.tsx`
  - API: `usePalette()` → `{ current, setPalette, isTransitioning }`
  - Includes localStorage persistence
- **T1.1.5** ✔️ **DONE** - Build `usePaletteSwitch` hook for CSS variable updates
  - 300ms cross-fade transition with callbacks
  - Specialized hooks: `useAutoDetectPalette`, `useCheckoutPaletteTransition`
- **T1.1.6** ✔️ **DONE** - Extend `tailwind.config.ts` with dual palette aliases
  - Added semantic "active-*" tokens for palette-aware components
- **T1.1.7** ✔️ **DONE** - Update existing components to use palette-aware tokens
  - ✔️ Wired palette switcher into debug UI (NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1)
  - ✔️ Added PaletteProvider to root layout
  - ✔️ Created GlobalPaletteDebug component (appears on ALL pages)
  - ✔️ Updated Button component to use active-* tokens
  - ✔️ Updated body background and typography to use active-* tokens
  - ✔️ Updated Input component to use active-* tokens
  - ✔️ Updated Select component to use active-* tokens
  - ✔️ Updated Card component (including selectable variant) to use active-* tokens
  - ✔️ Updated Chip component (filter chips) to use active-* tokens
  - ✔️ Updated RangeSlider component (segment slider) to use active-* tokens
  - ✔️ Updated Debug panel backgrounds to use active-* tokens
  - ✔️ Updated Estimate page modals/panels to use active-* tokens

### 1.2 Typography & Icons

- **T1.2.1** ✔️ **DONE** - Audit typography scale vs. design spec
- **T1.2.2** ✔️ **DONE** - Add typography tokens (primary 18px, body 16px, etc.)
- **T1.2.3** ⏳ Install Lucide React: `npm install lucide-react`
- **T1.2.4** ⏳ Create `Icon.tsx` wrapper component

### 1.3 Shadow & Blur

- **T1.3.1** ✔️ **DONE** - Refine shadow tokens (low/medium/high/glass)
- **T1.3.2** ✔️ **DONE** - Add blur tokens (light 12px, medium 20px, heavy 32px)

### 1.4 Grid & Layout

- **T1.4.1** ✅ **DONE** - Document 8px grid system (Tailwind covers this)
- **T1.4.2** ✅ **DONE** - Confirm viewport breakpoints (mobile 360px, tablet 768px, desktop 1200px)
- **T1.4.3** ✔️ **DONE** - Add mobile-first viewport-aware CSS utilities (dvh/svh, safe-area support)
  - Added CSS variables for dynamic viewport units and safe-area insets
  - Extended Tailwind with h-dvh, h-svh, h-screen-safe utilities
  - iOS Safari compatible with @supports detection
- **T1.4.4** ✔️ **DONE** - Create useMobileFirstLayout hook
  - Provides viewport metrics, safe-area calculations
  - Manages collapse/fullscreen states
  - Platform detection (iOS, mobile, landscape)
- **T1.4.5** ✔️ **DONE** - Refactor ConfiguratorLayout for fit-to-height
  - Added opt-in mobile-first layout mode
  - Preserves legacy layout (backward compatible)
  - Uses flexbox with h-screen-safe-dvh
- **T1.4.6** ✔️ **DONE** - Refactor photo hero container with height constraints
  - Changed drop zone from min-h-[320px] to max-height: var(--hero-max-height)
  - Image uses object-contain with max-w-full max-h-full
  - Wrapper uses inline-block to shrink-wrap image (preserves overlay alignment)
  - Curtain texture positioning preserved (pixel-perfect)
- **T1.4.7** ✔️ **DONE** - Unified bottom-slide confirmation modal
  - Replaced inline buttons with bottom-slide modal (matches estimate page)
  - Mobile: slides up from bottom (rounded-t-2xl)
  - Desktop: centered modal (rounded-[14px])
  - Added i18n keys: configure.mark.confirmed, configure.mark.subtitle
- **T1.4.8** ✔️ **DONE** - Pre-Phase 5 polish improvements
  - Modal: added backdrop blur + smooth slide/zoom animations (120ms ease-out)
  - Wall box: changed outline from blue (#4a67ff) to sage green (rgb(139, 186, 139))
  - Rectangle correction: fixed to apply on "Mark Again" (reset normalization flag)
  - Estimate modal: added "Back" button in left corner (ghost variant)
  - Glass cards: replaced all dashed borders with frosted glass design
    - Gradient background: from-surface-glass/80 to-surface-glass/60
    - Border: white/30 with hover white/40
    - Shadow: shadow-glass with hover shadow-glass-hover
    - Upload icons: gallery + cloud upload in circular badges
    - Smooth transitions: 200ms ease-out with scale transforms

---

## 🧩 Phase 2: Core Components

### 2.1 Buttons

- **T2.1.1** 🔄 Verify ghost button variant exists, polish
- **T2.1.2** ⏳ Add tactile feedback (scale on press, ripple)
- **T2.1.3** ⏳ Support icon + text layout

### 2.2 Chips & Toggles

- **T2.2.1** ⏳ Enhance chip hover states (shadow + scale)
- **T2.2.2** ⏳ Create `Toggle.tsx` component (iOS-style)
- **T2.2.3** ⏳ Create `ChipGroup.tsx` wrapper

### 2.3 Carousel (Minimal Variant)

- **T2.3.1** ⏳ Build Minimal carousel in `components/ui/Carousel.tsx`
  - Horizontal scroll, minimal UI, no arrows
- **T2.3.2** ⏳ Implement CSS snap scrolling
- **T2.3.3** ⏳ Add keyboard navigation + ARIA attributes

### 2.4 Cards

- **T2.4.1** 🔄 Extract glass card variant from Configure page
- **T2.4.2** ⏳ Create `ServiceCard.tsx` for add-ons
  - Icon + title + description + price + select button
- **T2.4.3** ⏳ Create `SummaryCard.tsx` for checkout
  - Thumbnail + fabric details + quantity + price

### 2.5 Modals

- **T2.5.1** ✅ Audit existing `Dialog.tsx` (backdrop blur, fade-in, focus trap)
- **T2.5.2** ⏳ Add `variant="info"` for fabric detail modals
- **T2.5.3** ⏳ Add `variant="confirm"` for destructive actions
- **T2.5.4** ⏳ Add `variant="error"` for error recovery

### 2.6 Sliders & Inputs

- **T2.6.1** 🔄 Polish existing range slider (custom thumb, accent fill)
- **T2.6.2** ⏳ Create `NumericInput.tsx` with +/- stepper buttons

### 2.7 Feedback Components

- **T2.7.1** ⏳ Create `Shimmer.tsx` overlay (left→right sweep, 1.5s loop)
- **T2.7.2** ⏳ Create `Flash.tsx` (white flash 200ms + accent pulse 300ms)
- **T2.7.3** ⏳ Create `Pulse.tsx` (accent gradient pulse)
- **T2.7.4** ⏳ Create shake animation keyframes in `globals.css`

---

## 🎬 Phase 3: Motion System

### 3.1 Motion Foundation

- **T3.1.1** ⏳ Install Framer Motion: `npm install framer-motion`
- **T3.1.2** ⏳ Create `lib/motion-tokens.ts`
  - Durations: micro (0.1s), short (0.2s), medium (0.3s), long (0.5s)
  - Easings: easePrimary, easeSoft
- **T3.1.3** ⏳ Create `lib/motion-presets.ts` (fadeIn, slideUp, zoomIn, etc.)

### 3.2 Stage Transitions

- **T3.2.1** ⏳ Upload → AI: Photo zoom (1.03×) + shimmer fade-in (300ms)
- **T3.2.2** ⏳ AI → Wall Box: Blur reduces (32px→16px), markers fade in (150ms stagger)
- **T3.2.3** ⏳ Wall Box → Config: Shimmer sweep + panel slide-up (220ms)
- **T3.2.4** ⏳ Config → Add-Ons: Panel cross-fade + title slide (300ms)
- **T3.2.5** ⏳ Add-Ons → Summary: Blur deepens, cards fade-up stagger (60ms)
- **T3.2.6** ⏳ Summary → Checkout: Palette cross-fade (Signature→Havinic 300ms)

### 3.3 Component Motion

- **T3.3.1** ⏳ Button press: Scale to 0.98 on tap, spring back
- **T3.3.2** ⏳ Card hover: Lift -4px Y, shadow increase (150ms)
- **T3.3.3** ⏳ Chip selection: Fill + checkmark morph (200ms)

---

## 🚀 Phase 4: Stage Implementations

### 4.1 Stage 1: Upload

- **T4.1.1** ✅ Audit `estimate/page.tsx` vs. Stage 1 spec
- **T4.1.2** ⏳ Add success animation (flash + pulse)
- **T4.1.3** ⏳ Add error shake animation
- **T4.1.4** ⏳ Add preview zoom-in (1.02×, 300ms)

### 4.2 Stage 2: AI Processing

- **T4.2.1** ⏳ Full-screen shimmer overlay during AI
- **T4.2.2** ⏳ Progress circle around upload icon
- **T4.2.3** ⏳ Phase transition (shimmer opacity 0.8→0.6 for seg)
- **T4.2.4** ⏳ Success flash (same for both AI #1 and #2)

### 4.3 Stage 3: Wall Box

- **T4.3.1** ⏳ Markers fade in sequentially (150ms stagger)
- **T4.3.2** ⏳ Elastic lines between markers (spring physics)
- **T4.3.3** ⏳ Confirmation ripple + zoom-out (400ms)

### 4.4 Stage 4: Configurator

- **T4.4.1** ✅ Audit `configure/page.tsx` vs. Stage 4 spec
- **T4.4.2** ⏳ Panel slide-up from bottom (220ms ease-out)
- **T4.4.3** ⏳ Curtain zoom (1.03×, 300ms)
- **T4.4.4** ⏳ Filters progressive fade-up (60ms stagger)
- **T4.4.5** ⏳ Incompatible chip wiggle + tooltip
- **T4.4.6** ⏳ Curtain update shimmer (200ms)

### 4.5 Stage 5: Add-Ons

- **T4.5.1** ⏳ Build `AddOnsPanel.tsx` component
- **T4.5.2** ⏳ Service cards stagger animation (60ms)
- **T4.5.3** ⏳ Selection animation (fill + checkmark morph)

### 4.6 Stage 6: Summary

- **T4.6.1** 🔄 Enhance existing `SummaryPanel.tsx`
- **T4.6.2** ⏳ Summary cards fade-up (80ms stagger)
- **T4.6.3** ⏳ Price count-up animation (0→value, 1s)
- **T4.6.4** ⏳ Finalize CTA pulse (500ms glow)
- **T4.6.5** ⏳ Palette cross-fade to Havinic on checkout

---

## 🔌 Phase 5: Backend & Integration

### 5.1 State Management

- **T5.1.1** ⏳ Create wizard state machine in `lib/wizard-state.ts`
  - States: upload | ai_measurement | ai_segmentation | wall_box | config | addons | summary | checkout
- **T5.1.2** ⏳ Create `useStageTransition` hook
- **T5.1.3** 🔄 Expand localStorage persistence to full wizard state

### 5.2 AI Integration

- **T5.2.1** ⏳ Update AI clients to expose `.progress` and `.status`
- **T5.2.2** ⏳ Bind shimmer/progress circle to real AI progress
- **T5.2.3** ⏳ Build `AIErrorModal.tsx` (try again / continue manually)

### 5.3 Parent Iframe

- **T5.3.1** ✅ Audit `parent-bridge.ts` for postMessage protocol
- **T5.3.2** ⏳ Send palette-change messages to parent frame
- **T5.3.3** ⏳ Polish cart handoff animation (slide-up panel)

### 5.4 Accessibility

- **T5.4.1** ⏳ Add ARIA live regions for AI feedback (`role="status"`, `aria-live="polite"`)
- **T5.4.2** ⏳ Keyboard navigation for stages (Cmd+Arrow keys)
- **T5.4.3** ⏳ Focus management on modals and stage transitions
- **T5.4.4** ⏳ Screen reader announcements for stage changes

### 5.5 i18n for New Components

- **T5.5.1** ⏳ Add i18n keys for all new UI strings (shimmer text, feedback messages, tooltips)
- **T5.5.2** ⏳ Update catalog with motion/feedback vocabulary

---

## ✨ Phase 6: Polish & Edge Cases

### 6.1 Global States

- **T6.1.1** ⏳ Idle breathing animation (accent gradient, 6s threshold)
- **T6.1.2** ⏳ Network offline banner with recovery UI
- **T6.1.3** ⏳ Low-light photo detection + retry prompt

### 6.2 Performance

- **T6.2.1** ⏳ Debounce slider updates (300ms)
- **T6.2.2** ⏳ Lazy load heavy components (carousel, modals)
- **T6.2.3** ⏳ Preload curtain textures with IntersectionObserver

### 6.3 Testing

- **T6.3.1** ⏳ Manual test all 6 stages on mobile (360px width)
- **T6.3.2** ⏳ Test palette switching (Signature ↔ Havinic ↔ Hybrid)
- **T6.3.3** ⏳ Test keyboard navigation across all stages
- **T6.3.4** ⏳ Test screen reader flow with VoiceOver/NVDA

### 6.4 Documentation

- **T6.4.1** ⏳ Update `UI-UX-OVERHAUL-MASTER.md` with new components
- **T6.4.2** ⏳ Document palette system in MASTER
- **T6.4.3** ⏳ Document motion tokens in MASTER
- **T6.4.4** ⏳ Update `.env.example` with any new variables
- **T6.4.5** ⏳ Update `RUNBOOK.md` with motion/palette setup instructions

---

## 📋 Task Status Legend

- ✅ **READY** - Can start immediately (audit/review task)
- 🔄 **PARTIAL** - Foundation exists, needs polish/extraction
- ⏳ **PENDING** - Not started, depends on other tasks
- 🚧 **IN PROGRESS** - Currently being worked on
- ✔️ **DONE** - Completed and tested

---

## 🗓️ Suggested Sprint Plan (For Reference)

### Sprint 1: Foundation (Week 1)
- Phase 1 tasks (dual palette, typography, icons, shadows)
- Goal: Theme system ready, components palette-aware

### Sprint 2: Core Components (Week 2)
- Phase 2 tasks (buttons, chips, carousel, cards, modals, feedback)
- Goal: All UI components built and styled

### Sprint 3: Motion (Week 3)
- Phase 3 tasks (Framer Motion setup, transitions, component animations)
- Goal: Smooth transitions between stages

### Sprint 4: Stages (Week 4-5)
- Phase 4 tasks (refine all 6 stages with new components + motion)
- Goal: Full flow working end-to-end

### Sprint 5: Backend (Week 6)
- Phase 5 tasks (state management, AI integration, accessibility)
- Goal: Production-ready integration

### Sprint 6: Polish (Week 7)
- Phase 6 tasks (edge cases, performance, testing, docs)
- Goal: Ship-ready quality

---

## 🎓 Notes for Implementation

### Palette Strategy
- Default: **Curtain Wizard Signature** (standalone app mode)
- Switch to **Havinic Harmony** when embedded in storefront iframe
- **Hybrid mode** for checkout handoff (Signature → Havinic cross-fade)

### Carousel Priority
- Start with **Minimal variant (A)** as specified
- Expandable Grid and Progressive Modal variants are **optional future enhancements**

### Motion Philosophy
- **Continuity** - Same animation for similar actions (e.g., flash for all successes)
- **No setTimeout** - Always derive transitions from state changes
- **Material realism** - Use spring physics for natural feel (Framer Motion defaults are good)

### Testing Approach
- User validates as we go (no dedicated QA phase)
- Focus on **mobile-first** testing (360px width)
- Test both **palettes** after each component

### Backend Integration
- **API changes** tracked alongside UI tasks (e.g., AI progress reporting)
- **Catalog updates** for i18n strings happen in Phase 5
- **Parent bridge** changes tested in iframe context

---

## 🚀 Getting Started

1. **Review this task list** with the user to confirm priorities
2. **Start with Phase 1.1** (Dual Palette System)
3. **Work incrementally** - complete, test, commit, move forward
4. **Update task status** as we progress (✅→🚧→✔️)
5. **Ask questions** if anything is unclear or conflicts with existing code

---

**End of Task List**

*Last Updated: October 23, 2025*  
*Maintained by: Badass (Full Stack Developer)*  
*For: Mario (Principal Designer)*
