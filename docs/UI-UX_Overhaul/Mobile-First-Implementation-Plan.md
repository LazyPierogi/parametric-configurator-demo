# Mobile-First Grid & Layout Implementation Plan

**Goal:** Make `/configure` truly mobile-first with fit-to-height layout that works without vertical scrolling on all devices from iPhone SE to 13" laptops. Must ensure that Mobile and desktop have separate positioning strategies — mobile always uses fixed for proper viewport behavior, desktop uses absolute for photo-relative centering.

---

## Current State Analysis

### Problems Identified
1. **Width-only scaling** - Current layout uses `min-h-screen` and `w-full h-auto` which forces vertical scrolling on small viewports
2. **No viewport height awareness** - Uses traditional `vh` units which don't account for browser chrome
3. **Fixed panel layout** - Bottom sheet (SummaryPanel/FiltersPanel) has fixed positioning that doesn't adapt to viewport
4. **No safe-area support** - Doesn't respect iOS notch/home bar insets
5. **Missing zoom/pan controls** - Wall marking step lacks pinch-zoom for precision on small screens

### Current Structure
```
ConfiguratorLayout (min-h-screen wrapper)
  └─ Glass container (max-w-[1100px])
       ├─ Photo area (width-based: w-full h-auto)
       ├─ Overlay (wall box + curtain preview)
       ├─ Corner markers (Stage 3)
       └─ SummaryPanel/FiltersPanel (bottom sheet)
```

---

## Implementation Plan

### Phase 1: Foundation — Viewport-Aware CSS Utilities ✅
**Files:** `apps/web/app/globals.css`, `tailwind.config.ts`

**Tasks:**
1. Add CSS custom properties for viewport dimensions
   - `--vh-full`, `--vh-safe` (accounting for browser chrome)
   - `--vw-full`, `--vw-safe`
   - Safe-area insets for iOS notch/home bar
   
2. Add Tailwind utilities for dynamic viewport units
   - `h-dvh`, `h-svh`, `min-h-dvh`, `max-h-dvh`
   - `h-screen-safe` (100dvh - safe-area-inset)
   
3. Add responsive breakpoint helpers
   - Mobile: 360-767px
   - Tablet: 768-1199px
   - Desktop: 1200px+

**Deliverable:** CSS foundation that respects platform quirks

---

### Phase 2: Layout Hook — useMobileFirstLayout ✅
**File:** `apps/web/app/configure/hooks/useMobileFirstLayout.ts`

**Purpose:** Centralized layout calculations for fit-to-height approach

**API:**
```typescript
interface MobileFirstLayout {
  // Viewport metrics
  viewportHeight: number;      // Visual viewport (dvh)
  safeHeight: number;          // Minus safe-area insets
  availableHeight: number;     // Minus top bar + sticky CTA
  
  // Layout zones
  heroMaxHeight: number;       // 72-80% of available height
  panelMinHeight: number;      // 20% of viewport
  panelMaxHeight: number;      // 35% of viewport
  
  // States
  isCollapsed: boolean;
  isFullScreen: boolean;
  
  // Actions
  toggleCollapse: () => void;
  toggleFullScreen: () => void;
  
  // Platform detection
  isIOS: boolean;
  isMobile: boolean;           // < 768px
}
```

**Logic:**
- Detect iOS Safari and use `visualViewport` API
- Calculate safe zones accounting for notch/home bar
- Provide collapse/fullscreen state management
- Handle keyboard appearance (viewport resize)

**Deliverable:** Reusable hook for responsive layout

---

### Phase 3: ConfiguratorLayout Refactor 🚧
**File:** `apps/web/app/configure/components/ConfiguratorLayout.tsx`

**Changes:**
1. Replace `min-h-screen` with `h-dvh` or `h-screen-safe`
2. Use flexbox column layout with defined zones:
   ```
   Container (h-screen-safe flex flex-col)
     ├─ Top Bar (h-12 flex-none) — optional, can hide on small screens
     ├─ Hero Area (flex-1 min-h-0) — contains photo + overlays
     └─ Bottom Sheet (h-[var(--panel-height)] flex-none) — adaptive height
   ```
3. Add CSS variables for dynamic heights:
   ```css
   --hero-max-h: 75vh;
   --panel-min-h: 20vh;
   --panel-max-h: 35vh;
   --panel-current-h: var(--panel-min-h);
   ```

**Deliverable:** Shell that fits viewport without scrolling

---

### Phase 4: Photo Hero with Fit-to-Height ✅ **COMPLETE**
**File:** `apps/web/app/configure/page.tsx`

**Changes:**
1. Replace `<img className="block w-full h-auto" />` with constrained container:
   ```tsx
   <div className="relative flex items-center justify-center" 
        style={{ height: `var(--hero-max-h)` }}>
     <img 
       ref={imgRef}
       src={previewUrl}
       alt={t('configure.previewAlt')}
       className="max-w-full max-h-full object-contain"
       style={{ maxHeight: 'var(--hero-max-h)' }}
     />
   </div>
   ```

2. Update overlay/wallBox positioning to work with `object-contain` letterboxing
3. Ensure corner markers stay within image bounds

**Deliverable:** Photo scales to height, letterboxed if needed

---

### Phase 5: Collapsible Bottom Sheet 🚧
**Files:** 
- `apps/web/app/configure/components/SummaryPanel.tsx`
- `apps/web/app/configure/components/FiltersPanel.tsx`

**Features:**
1. Adaptive height based on content and viewport:
   - Collapsed: 20% viewport (shows summary + CTA only)
   - Expanded: 35% viewport (shows filters/services)
   - Wall-marking step: Collapsed by default
   
2. Collapse/expand controls:
   - Drag handle at top of panel
   - Double-tap to toggle
   - Auto-collapse when marking corners
   
3. Sticky CTA button:
   - Always visible above safe-area
   - Moves with panel expansion
   
**Deliverable:** Panel that adapts without blocking photo

---

### Phase 6: Full-Screen Photo Toggle 🚧
**File:** `apps/web/app/configure/page.tsx`

**Feature:**
- Toggle button (icon: Maximize/Minimize)
- Full-screen mode:
  - Hero expands to 90-95% dvh
  - Panel becomes floating button at bottom
  - Top bar auto-hides
  - Exit full-screen restores layout
  
**Use case:** Wall marking on small screens needs maximum photo area

**Deliverable:** Optional full-screen for precision work

---

### Phase 7: Pinch-Zoom and Pan Support 🚧
**File:** `apps/web/app/configure/hooks/usePhotoZoom.ts` (new)

**Features:**
1. Touch gestures:
   - Pinch to zoom (2-finger)
   - Pan when zoomed (1-finger drag)
   - Double-tap to reset
   
2. Bounds checking:
   - Markers stay within zoomed image bounds
   - Prevent panning beyond edges
   - Smooth spring animation on release
   
3. Integration with corner dragging:
   - Zoom state persists during marker adjustment
   - Coordinate transforms account for zoom/pan
   
**Library:** Consider `use-gesture` from `@use-gesture/react` or native touch events

**Deliverable:** 60 FPS zoom/pan for mobile precision

---

### Phase 8: Mini-Toolbar for Zoomed State 🚧
**File:** `apps/web/app/configure/components/ZoomToolbar.tsx` (new)

**Features:**
- Auto-appears when zoom > 1.2x
- Floating toolbar with:
  - Reset View button (returns to fit)
  - Zoom level indicator (e.g., "1.5×")
  - Optional grid toggle for alignment
  
- Dismissible with timer (5s auto-hide)
- Positioned in safe area (top-right corner)

**Deliverable:** Helper UI for navigating zoomed photo

---

### Phase 9: Platform Quirks & Safe Areas 🚧
**Files:** `apps/web/app/globals.css`, layout components

**iOS Safari Fixes:**
1. Use `dvh`/`svh` units instead of `vh`
2. Respect `safe-area-inset-*` for notch/home bar
3. Prevent body scroll: `body { position: fixed; }` when app is active
4. Handle dynamic toolbar show/hide with `visualViewport` API

**CSS:**
```css
@supports (height: 100dvh) {
  .h-screen-safe {
    height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  }
}
```

**Deliverable:** No layout shift on iOS scroll/keyboard events

---

### Phase 10: Reduced Motion & Accessibility 🚧

**Features:**
1. Respect `prefers-reduced-motion`:
   - Replace slide/zoom animations with instant fades
   - Disable spring physics on panel collapse
   
2. ARIA announcements:
   - "Photo full-screen mode activated"
   - "Panel collapsed"
   - "Zoom level 1.5x"
   
3. Keyboard navigation:
   - Escape to exit full-screen
   - Tab through controls even when collapsed

**Deliverable:** Accessible to all users

---

### Phase 11: Telemetry & Metrics 📊

**Events to Track:**
```typescript
// Viewport metrics
logEvent('configure_viewport_metrics', {
  width: window.innerWidth,
  height: window.innerHeight,
  safeHeight: visualViewport.height,
  device: 'iPhone SE' | 'iPhone 15' | 'MacBook Air',
});

// User actions
logEvent('configure_fullscreen_toggle', { enabled: true });
logEvent('configure_panel_collapsed', { step: 'wall_marking' });
logEvent('configure_zoom_used', { maxZoom: 2.3 });

// Abandon tracking
logEvent('configure_abandon', { 
  step: 'wall_marking',
  hadVerticalScroll: true, // Key metric!
});
```

**Goal:** Validate that vertical scroll is eliminated

---

## QA Checklist

### Devices to Test
- [ ] iPhone SE (375×667px)
- [ ] iPhone 13 (390×844px)
- [ ] iPhone 15 Pro Max (430×932px)
- [ ] Pixel 6 (412×915px)
- [ ] Pixel 8 (412×915px)
- [ ] 13" MacBook Air (1440×900px, 2880×1800px retina)

### Test Scenarios
- [ ] Wall marking step: No vertical scroll needed to see all 4 corners + CTA
- [ ] Rotate to landscape: Hero scales to height, CTA remains reachable
- [ ] Keyboard open (input fields): Panel compresses, hero doesn't jump
- [ ] Full-screen mode: Photo expands, panel becomes floating button
- [ ] Pinch-zoom: 60 FPS, markers stay in bounds
- [ ] iOS Safari: No layout shift on toolbar show/hide
- [ ] Reduced motion: Transitions fall back to fades

---

## File Manifest

### New Files
- `apps/web/app/configure/hooks/useMobileFirstLayout.ts`
- `apps/web/app/configure/hooks/usePhotoZoom.ts`
- `apps/web/app/configure/components/ZoomToolbar.tsx`
- `docs/UI-UX_Overhaul/Mobile-First-Implementation-Plan.md` (this file)

### Modified Files
- `apps/web/app/globals.css` — Add viewport utilities
- `apps/web/tailwind.config.ts` — Add dvh/svh utilities
- `apps/web/app/configure/components/ConfiguratorLayout.tsx` — Refactor to fit-to-height
- `apps/web/app/configure/page.tsx` — Update photo container, add zoom support
- `apps/web/app/configure/components/SummaryPanel.tsx` — Make collapsible
- `apps/web/app/configure/components/FiltersPanel.tsx` — Make collapsible
- `docs/UI-UX_Overhaul/UI-UX_Overhaul_TaskList.md` — Mark 1.4 complete

---

## Success Criteria

✅ **Primary Goal:** No vertical scroll needed on any target device during wall-marking step
✅ **Performance:** 60 FPS during zoom/pan and corner dragging
✅ **Platform Support:** Works on iOS Safari with dynamic toolbar
✅ **Accessibility:** Keyboard navigation and screen reader support
✅ **User Validation:** Lower abandon rate on Stage 3 (wall marking)

---

## Implementation Order

1. ✅ Phase 1: CSS utilities (foundation)
2. ✅ Phase 2: Layout hook (calculations)
3. 🚧 Phase 3: ConfiguratorLayout refactor (shell)
4. 🚧 Phase 4: Photo hero fit-to-height (core fix)
5. 🚧 Phase 5: Collapsible bottom sheet (space management)
6. Phase 6: Full-screen toggle (optional power-user feature)
7. Phase 7: Zoom/pan (mobile precision)
8. Phase 8: Mini-toolbar (UX polish)
9. Phase 9: Platform quirks (iOS Safari fixes)
10. Phase 10: Accessibility (inclusive design)
11. Phase 11: Telemetry (validation)

---

## ✅ Completed Work (October 24, 2025)

### Phase 1-4: Foundation Complete ✅
- **Phase 1:** CSS utilities (dvh/svh, safe-area variables) ✅
- **Phase 2:** `useMobileFirstLayout` hook ✅
- **Phase 3:** ConfiguratorLayout refactor ✅
- **Phase 4:** Photo hero fit-to-height ✅

### Additional Polish Improvements ✅
1. **Modal UX Enhancement**
   - **CRITICAL PATTERN:** Separate mobile/desktop modal implementations
   - **Mobile:** `fixed inset-0` positioned OUTSIDE photo container, slides from bottom screen edge
   - **Desktop:** `absolute inset-0` positioned INSIDE photo wrapper, centers over image
   - Added backdrop blur (`backdrop-blur-sm`)
   - Smooth animations: slide-in-from-bottom, zoom-in, fade-in (200ms)
   
2. **Visual Design Updates**
   - Wall box outline: Changed from blue (#4a67ff) to sage green (rgb(139, 186, 139))
   - Glass cards: Replaced dashed borders with frosted glass design
   - Upload zone icon: Single photo icon with clearer glass background
   - Shadows: Added `shadow-glass-hover` with sage green accent
   
3. **Interaction Improvements**
   - Rectangle correction: Applies on every "Mark Again" (fixed normalization flag reset)
   - Back button: Clears uploaded photo and resets to upload step (not just close modal)
   - Smooth micro-interactions: scale transforms on hover/active states
   
4. **Technical Refinements**
   - Glass card backgrounds: `from-surface-glass/80 to-surface-glass/60`
   - Icon badge: `bg-white/40 backdrop-blur-sm border-white/50`
   - Transitions: `duration-200 ease-out` for all interactive elements

---

**Status:** ✅ Foundation Complete + Polish  
**Next Phase:** Phase 5 (Collapsible Bottom Panel)  
**Last Updated:** October 24, 2025, v.05.1.0
