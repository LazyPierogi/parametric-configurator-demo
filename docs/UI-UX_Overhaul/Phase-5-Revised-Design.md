# Phase 5: Unified UX Patterns — Revised Design

**Date:** October 24, 2025  
**Goal:** Create consistent, platform-aware UX that scales gracefully from touch to desktop

---

## 🎯 Core Principles (from Design Docs)

### 1. "Desktop isn't different mode — it's expanded gracefully"
> Curtain Wizard doesn't "switch to desktop mode" — it expands gracefully, maintaining mobile familiarity.

### 2. Focus on Hero Photo
> The curtain preview must never feel like a thumbnail — it's the hero, the "living" part of the interface.

### 3. Glass, Not Box
> Panels morph from glass → solid (animate opacity + blur). Transitions should feel like opening a layer of light.

### 2025-10-25 Update — Desktop Hero Lock (Task 884d)
- Desktop hero uses the shared `cw-hero-shell` frame (768×576) across `/estimate` and `/configure`, so the photo footprint and position no longer jump when moving from measurement to marking. (`apps/web/app/globals.css`, `apps/web/app/estimate/page.tsx`, `apps/web/app/configure/page.tsx`)
- `ConfiguratorLayout` keeps the glass card at `max-w-[56rem]` until the wall box is confirmed, then animates to `max-w-[1380px]` so the configurator panel can slide in without shrinking the hero. (`apps/web/app/configure/components/ConfiguratorLayout.tsx`, `apps/web/tailwind.config.ts`)
- Motion reference: hero stays centred/sticky while marking, then translates left (same size) when `phase=ready`, matching the flow described in `docs/UI-UX_Overhaul/# Curtain Wizard — 05_Motion_and_Transitions.md`.
- Summary panel matches the hero width and stays under the sticky hero on desktop; the configurator panel now scrolls with the page so there are no nested scrollbars. (`apps/web/app/configure/page.tsx`, `apps/web/app/configure/components/FiltersPanel.tsx`)

---

## ✅ Problem 1: Proper Device Detection

### ❌ Old Approach (BAD)
```tsx
const isMobile = width < 768; // Pixel-based breakpoint
```

**Problems:**
- iPad Pro (1024px) treated as desktop but has touch interface
- Desktop with touchscreen treated as mouse-only
- Doesn't account for input capabilities

### ✅ New Approach (GOOD)
```tsx
const useDeviceCapabilities = () => {
  const [capabilities, setCapabilities] = useState({
    hasTouch: false,      // Touch screen available
    hasHover: false,      // Precise hover (mouse/trackpad)
    hasCoarsePointer: false, // Touch/stylus (less precise)
    isSmallScreen: false, // Viewport < 768px
  });

  useEffect(() => {
    // Feature detection via media queries
    const touchQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
    const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const smallScreenQuery = window.matchMedia('(max-width: 767px)');
    
    setCapabilities({
      hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      hasHover: hoverQuery.matches,
      hasCoarsePointer: touchQuery.matches,
      isSmallScreen: smallScreenQuery.matches,
    });

    // Listen for changes (rare but possible)
    const handlers = [
      { query: touchQuery, handler: updateCapabilities },
      { query: hoverQuery, handler: updateCapabilities },
      { query: smallScreenQuery, handler: updateCapabilities },
    ];
    
    handlers.forEach(({ query, handler }) => {
      query.addEventListener('change', handler);
    });

    return () => {
      handlers.forEach(({ query, handler }) => {
        query.removeEventListener('change', handler);
      });
    };
  }, []);

  return capabilities;
};
```

**Usage:**
```tsx
const { hasTouch, hasHover, isSmallScreen } = useDeviceCapabilities();

// Layout decision: use small screen + touch capabilities
const useCompactLayout = isSmallScreen || (hasTouch && !hasHover);

// Interaction: show hover effects only when hover is available
const showHoverState = hasHover;

// Touch optimization: larger tap targets on touch devices
const tapTargetSize = hasTouch ? 48 : 32;
```

---

## ✅ Problem 2: Shared UX Patterns

### Current State Issues
- Desktop: Static filters panel, no carousels
- Mobile: Different interactions
- No consistency = learning curve

### Target: Unified Patterns

#### Pattern 1: Collapsible Sections (Both Platforms)

**Desktop Before:**
```
┌─────────────────────────┐
│ FABRIC TYPE             │
│ ☐ Sheer ☐ Blackout ... │
│                         │
│ COLORS (40 items)       │
│ [All colors visible]    │
│                         │
│ PLEAT STYLE             │
│ ...                     │
└─────────────────────────┘
```
**Problem:** Cluttered, distracts from hero photo

**Desktop After (Shared Pattern):**
```
┌─────────────────────────┐
│ ▼ FABRIC TYPE           │
│   ☐ Sheer ☐ Blackout   │
│                         │
│ ▶ COLORS (8 visible)    │  ← Collapsed by default
│                         │
│ ▶ PLEAT STYLE           │  ← Collapsed by default
│                         │
└─────────────────────────┘
```
**Benefit:** Cleaner, focuses attention, same pattern as mobile

---

#### Pattern 2: Horizontal Carousels (Both Platforms)

**From Design Docs:**
> Horizontal scroll; 16px spacing between items. Center item enlarges 8% for focus. "Snap to item" behavior; show partial next card for affordance.

**Implementation:**
- ✅ Color chips: Horizontal scroll with snap
- ✅ Fabric swatches: Carousel (72×72 mobile, 96×96 desktop)
- ✅ Pleat styles: Carousel
- ✅ Mouse/Touch/Trackpad support:
  - Touch: Swipe gesture
  - Mouse: Drag with pointer + scroll wheel
  - Trackpad: Two-finger swipe

**Benefits:**
- Consistent interaction model
- Less clutter (show 3-5 items, scroll for more)
- Natural motion
- Works on all input types

---

#### Pattern 3: Glass Panels with Smooth Collapse

**Shared Behavior (Both Platforms):**
```tsx
<CollapsibleSection
  title="Colors"
  defaultCollapsed={true}
  itemCount={colorOptions.length}
>
  <ColorCarousel 
    items={colorOptions}
    snapAlign="start"
    showPartialNext={true}
    itemSize={hasTouch ? 72 : 64}
  />
</CollapsibleSection>
```

**Animation:**
- 300ms ease-out
- Blur transitions (18px → 24px when expanding)
- Glass opacity shifts (55% → 65%)
- "Opening a layer of light" feeling

---

## 📐 Revised Layout Strategy

### Mobile (Touch + Small Screen) - STATUS ✅ IMPLEMENTED!
```
┌────────────────────────┐
│  [Top Bar]             │ ← Always visible
┌────────────────────────│
│ ╔══════════════════╗   │ ← Sticky Hero (top-0)
│ ║   Photo + Drapes ║   │   (glass bg, z-20)
│ ╚══════════════════╝   │   Stays at top when scrolling
├────────────────────────┤
│ Options & Pricing      │ ← Configurator (full width)
│ ▼ Fabric Type          │   scrolls here
│   [Carousel]           │
│                        │
│ ▶ Fabrics (collapsed)  │
│ ▶ Services             │
├────────────────────────┤
│ Summary                │ ← Summary (full width)
│ PLN 443.60             │   scrolls last
│ [Add to Cart]          │
└────────────────────────┘

```

**Implementation:**
- Hero: `sticky top-0 z-20` - sticks to top when page scrolls
- Configurator: Full width, scrolls below Hero
- Summary: Full width, scrolls after Configurator
- Layout: Flexbox column stack with natural document scroll

**Interactions:**
- Filters/Services collapsible independently
- Color chips: Horizontal carousel (swipe)
- Natural page scroll behavior

---

### Desktop (Hover + Large Screen) - STATUS ✅ IMPLEMENTED!
```
┌─────────────────┬──────────────┐
│   Hero Photo    │ Configurator │  ← Hero: sticky top-5 (55% width)
│   + Drapes      │   Panel      │     Configurator: 45% width
│ (Sticky + Glass)│ ▼ Fabrics    │     Side-by-side layout
│                 │ ▶ Services   │
│                 │              │     When Configurator scrolls past,
│                 └──────────────┘     Hero remains visible
│                                 │
│     Summary (full width)       │  ← Summary scrolls below
│     PLN 443.60 [Add to Cart]   │     Can pass under sticky Hero
└─────────────────────────────────┘
```

**Implementation:**
- Hero: `sticky top-5` with `w-[55%]` - remains in place as page scrolls
- Configurator: `w-[45%]` - scrolls naturally with content
- Summary: Full width below both - scrolls up and can pass under Hero
- Layout: Flexbox row for Hero+Configurator, then full-width Summary below
- Never changes Hero size/position - Configurator moves below on narrow viewports

**Interactions:**
- Collapsible sections (same as mobile!)
- Color chips: Horizontal carousel (drag/scroll wheel)
- Hover states on chips/buttons
- Larger tap targets preserved (accessibility)

---

## 🎨 Shared Components Library

### 1. `<CollapsibleSection>`
```tsx
interface CollapsibleSectionProps {
  title: string;
  itemCount?: number;
  defaultCollapsed?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}
```
**Used in:** Filters (both platforms), Services (both platforms)

---

### 2. `<HorizontalCarousel>`
```tsx
interface HorizontalCarouselProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  snapAlign: 'start' | 'center' | 'end';
  itemSize: number;
  gap?: number;
  showPartialNext?: boolean;
  onItemSelect?: (item: T) => void;
}
```
**Used in:** Color chips, Fabric swatches, Pleat styles

**Features:**
- Snap scroll
- Center focus magnification (+8% scale)
- Partial next item visible (affordance)
- Touch/Mouse/Trackpad support
- Smooth momentum scroll

---

### 3. `<BottomSheet>` (Mobile Only)
```tsx
interface BottomSheetProps {
  collapsedHeight: string; // '20vh'
  expandedHeight: string;  // '50vh'
  defaultCollapsed?: boolean;
  children: ReactNode;
}
```
**Features:**
- Drag handle
- Swipe gestures
- Smooth spring animation
- Backdrop blur when expanded

---

### 4. `<GlassPanel>`
```tsx
interface GlassPanelProps {
  blur?: number; // 18-24px
  opacity?: number; // 0.55-0.65
  padding?: number;
  rounded?: boolean;
  children: ReactNode;
}
```
**Used in:** All panels, modals, filters

---

## 🔧 Implementation Plan

### Step 1: Device Capabilities Hook ✅
**File:** `apps/web/hooks/useDeviceCapabilities.ts`
- Feature detection via media queries
- Touch/hover/pointer detection
- Screen size breakpoints

---

### Step 2: Shared Components Library
**Files:**
- `apps/web/components/ui/CollapsibleSection.tsx`
- `apps/web/components/ui/HorizontalCarousel.tsx`
- `apps/web/components/ui/BottomSheet.tsx` (mobile-specific)
- `apps/web/components/ui/GlassPanel.tsx`

---

### Step 3: Refactor Filters Panel
**File:** `apps/web/app/configure/components/FiltersPanel.tsx`

**Changes:**
- Use `<CollapsibleSection>` for each filter group
- Convert color grid → `<HorizontalCarousel>`
- Convert pleat options → `<HorizontalCarousel>`
- Same component works on mobile + desktop!

---

### Step 4: Update Configure Page Layout
**File:** `apps/web/app/configure/page.tsx`

**Changes:**
```tsx
const { hasTouch, isSmallScreen } = useDeviceCapabilities();
const useCompactLayout = isSmallScreen || (hasTouch && !hasHover);

return (
  <ConfiguratorLayout>
    {useCompactLayout ? (
      // Mobile: Photo + BottomSheet
      <>
        <PhotoHero />
        <BottomSheet>
          <SummaryPanel />
          <FiltersPanel /> {/* Same component! */}
        </BottomSheet>
      </>
    ) : (
      // Desktop: Photo + Sidebar + Bottom Summary
      <div className="flex gap-5">
        <PhotoHero />
        <FiltersPanel /> {/* Same component! */}
      </div>
      <SummaryPanel />
    )}
  </ConfiguratorLayout>
);
```

---

## 📊 Benefits Summary

### ✅ Proper Device Detection
- Works on iPad Pro correctly (touch-first)
- Works on touchscreen laptops
- Works on desktop with mouse
- Future-proof (detects capabilities, not pixels)

### ✅ Consistent UX Patterns
- Collapsible sections: Both platforms
- Horizontal carousels: Both platforms
- Glass aesthetics: Both platforms
- Same interaction mental model
- Reduced learning curve

### ✅ Focused Hero Photo
- Less clutter (collapsed sections)
- More breathing room
- Photo stays the focal point
- Aligns with design docs

### ✅ Maintainability
- Shared components = less code duplication
- Platform differences = layout only
- Easier testing (one set of interactions)

---

## ✅ Problem 4: Viewport-Independent Measurements (NEW)

**Why it mattered:** When the browser window was resized after marking the wall box, the hero image scaled to the new viewport width. Our centimetre values were tied to those pixel dimensions, which meant the pixel-to-cm ratio shifted and the quote recalculated — moving the window could change price without the user touching the wall box.

**Fix (2025-10-24):**
- Store the wall-box baseline as normalized percentages (`baseBoxRatio`) instead of raw pixels inside `apps/web/app/configure/page.tsx`.
- Scale user drags by comparing current normalized bounds to that baseline, so UI resizes never affect centimetres or pricing.
- Height clamps now use the same normalized baseline, keeping fabric limits intact even after layout jumps.

**QA playbook:**
1. Upload a room photo, mark the wall box, note the cm readout + summary price.
2. Resize the browser (shrink + expand, rotate on mobile simulators).
3. Confirm the cm values and quote stay identical; only manual handle drags should change them.

---

## 📋 Implementation Decisions (Confirmed)

### 1. Collapsible Sections Default State ✅
- **Mobile:** All collapsed except active section
- **Desktop:** All collapsed except Fabric Type (first section)

### 2. Carousel Configuration ✅
**Center-Focus Auto-Scroll Pattern:**
- Display: **ODD numbers only** (3, 5, 7 items visible)
- Active item: **Always centered** with scale magnification
- Scale gradient: Items closer to center = larger scale
- Auto-scroll on select: Selected item animates to center gracefully
- Example: `[A, B, C*, D, E]` → tap D → animates to `[B, C, D*, E, F]`
- Colors: 5 visible on desktop, 3 on mobile (unless fewer available)
- Fabric swatches: 3 visible on mobile, 5 on desktop

### 3. Bottom Sheet Heights ✅
- **Collapsed:** 20vh (Summary + CTA only)
- **Expanded:** 50vh (Filters + Services visible)
- Drag handle for manual control
- Smooth spring animation

### 4. Mobile Layout Order ✅
```
1. Hero Photo Section
2. Configurator Panel (Filters + Services)  ← First below hero
3. Summary Panel (Price breakdown + CTA)    ← Last
```

---

## ✅ Implementation Status

### Phase 5a: Foundation
- ✅ **DONE:** `useDeviceCapabilities` hook (`apps/web/hooks/useDeviceCapabilities.ts`)
  - Feature detection via media queries
  - SSR-safe with hydration
  - Touch/hover/pointer detection
  - Accessibility (reduced motion)
  - `useCompactLayout` recommendation

### Phase 5b: Shared Components (IN PROGRESS)
- ⏳ `<CollapsibleSection>` component
- ⏳ `<HorizontalCarousel>` component (center-focus, auto-scroll)
- ⏳ `<GlassPanel>` wrapper
- ⏳ `<BottomSheet>` (mobile-specific)

### Phase 5c: Integration (PENDING)
- ⏳ Refactor `FiltersPanel` to use shared components
- ⏳ Update configure page layout logic
- ⏳ Test on multiple devices

---

**Status:** Foundation Complete, Building Shared Components  
**Risk:** Low (backward compatible, feature-flagged rollout)  
**Next:** HorizontalCarousel with center-focus auto-scroll

---

*Aligned with:*
- `# Curtain Wizard — 03_Layout_and_Grid (UI:UX).md`
- `# Curtain Wizard — 04_Components_and_Interactions.md`
- Mobile-first philosophy
- "Desktop isn't different mode" principle
