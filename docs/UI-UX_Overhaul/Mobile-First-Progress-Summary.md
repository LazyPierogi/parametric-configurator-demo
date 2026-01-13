# Mobile-First Layout Implementation — Progress Summary

**Task:** 1.4 Grid & Layout (Mobile-first fit-to-height improvements)  
**Status:** ✅ Foundation Complete (Phases 1-4 ✅) + Modal Pattern Fixed  
**Date:** October 24, 2025

---

## ✅ What's Been Completed

### Phase 1: CSS Foundation ✅ **DONE**

**Files Modified:**
- `apps/web/app/globals.css`
- `apps/web/tailwind.config.ts`

**Deliverables:**
1. **CSS Custom Properties** for viewport-aware dimensions:
   - `--vh-full`, `--vh-safe` (visual viewport)
   - `--safe-top/bottom/left/right` (iOS notch/home bar)
   - `--hero-max-height`, `--panel-min-height`, `--panel-max-height`
   - `--available-height`, `--fullscreen-hero-height`

2. **Modern Viewport Units** with iOS Safari support:
   ```css
   @supports (height: 100dvh) {
     :root {
       --vh-full: 1dvh;
       --available-height: calc(100dvh - var(--safe-top) - var(--safe-bottom) - var(--cta-height));
     }
   }
   ```

3. **Tailwind Utilities**:
   - `h-dvh`, `h-svh` (dynamic/small viewport height)
   - `h-screen-safe`, `h-screen-safe-dvh` (safe-area aware)
   - `h-hero`, `h-hero-full` (photo area sizing)
   - `h-panel-min`, `h-panel-max` (bottom sheet)
   - Matching `minHeight` and `maxHeight` utilities

4. **iOS Safari Compatibility**:
   - Prevents overscroll bounce with `overscroll-behavior: none`
   - Respects `env(safe-area-inset-*)` for notch/home bar
   - Falls back gracefully to `vh` units on older browsers

---

### Phase 2: Layout Hook ✅ **DONE**

**File Created:**
- `apps/web/app/configure/hooks/useMobileFirstLayout.ts`

**API:**
```typescript
interface MobileFirstLayoutState {
  // Viewport metrics
  viewportHeight: number;      // Visual viewport (dvh equivalent)
  safeHeight: number;          // Minus safe-area insets
  availableHeight: number;     // Minus top bar + sticky CTA
  
  // Layout zones
  heroMaxHeight: number;       // 72-80% of available height
  panelMinHeight: number;      // 20% of viewport (collapsed)
  panelMaxHeight: number;      // 35% of viewport (expanded)
  panelCurrentHeight: number;  // Current panel height
  
  // States
  isCollapsed: boolean;
  isFullScreen: boolean;
  
  // Actions
  toggleCollapse: () => void;
  toggleFullScreen: () => void;
  setCollapsed: (collapsed: boolean) => void;
  
  // Platform detection
  isIOS: boolean;
  isMobile: boolean;           // < 768px
  isLandscape: boolean;
}
```

**Features:**
- ✅ Detects iOS Safari using UA + standalone check
- ✅ Uses `visualViewport` API when available (iOS Safari 13+)
- ✅ Calculates safe-area insets from CSS variables
- ✅ Listens for resize, scroll, orientation change events
- ✅ Auto-collapses panel when keyboard opens (viewport < 500px)
- ✅ Adjusts hero height for landscape (80% vs 75%)
- ✅ Provides collapse/fullscreen state management

---

### Phase 3: ConfiguratorLayout Refactor ✅ **DONE**

**File Modified:**
- `apps/web/app/configure/components/ConfiguratorLayout.tsx`

**Changes:**
1. **Added opt-in mobile-first mode** via `useMobileFirstLayout` prop
2. **New layout structure** when enabled:
   ```tsx
   <div className="h-screen-safe-dvh flex flex-col overflow-hidden">
     <div className="flex flex-col h-full max-w-[1100px]">
       {children}
     </div>
   </div>
   ```
3. **Backward compatible** — preserves original `min-h-screen` layout by default
4. **Flexbox column layout** for proper height distribution

**Key Decision:** Feature flag approach allows gradual rollout and easy rollback if issues arise.

---

---

### Phase 4: Photo Hero + Modal Pattern ✅ **DONE**

**Files Modified:**
- `apps/web/app/estimate/page.tsx`
- `apps/web/app/configure/page.tsx`

**Deliverables:**
1. **Height-constrained photo container**:
   - Uses `max-height: var(--hero-max-height)` 
   - Image scales with `object-contain` (letterboxing allowed)
   - Preserves curtain texture pixel-perfect positioning

2. **CRITICAL: Separate Mobile/Desktop Modal Pattern**:
   - **Mobile modals**: `fixed inset-0` positioned OUTSIDE photo container
     - Slides from bottom screen edge
     - Full viewport coverage
     - Proper iOS Safari behavior
   - **Desktop modals**: `absolute inset-0` positioned INSIDE photo wrapper  
     - Centers over photo
     - Contained within image bounds
     - Photo-relative positioning

**Technical Implementation**:
```tsx
// Desktop modal (inside photo wrapper)
{confirmOpen && !isMobile && (
  <div className="absolute inset-0 z-50 flex items-center justify-center">
    {/* Modal content */}
  </div>
)}

// Mobile modal (outside, after main container)
{confirmOpen && isMobile && (
  <div className="fixed inset-0 z-50 flex items-end">
    {/* Modal content */}
  </div>
)}
```

**Why This Matters**:
- Mobile needs `fixed` for proper slide-from-bottom UX
- Desktop needs `absolute` for photo-relative centering
- Conditional rendering prevents layout conflicts at breakpoint

---

## 🚧 What's Next (Phases 5-11)

### Phase 5: Collapsible Bottom Sheet ⏳ **NEXT UP**

**Goal:** Replace `<img className="w-full h-auto">` with height-constrained container

**Required Changes in `apps/web/app/configure/page.tsx`:**
```tsx
// OLD (width-based, forces vertical scroll):
<img ref={imgRef} src={previewUrl} className="block w-full h-auto rounded-lg" />

// NEW (height-constrained, letterbox if needed):
<div className="relative flex items-center justify-center" 
     style={{ height: 'var(--hero-max-height)' }}>
  <img 
    ref={imgRef}
    src={previewUrl}
    className="max-w-full max-h-full object-contain"
    style={{ maxHeight: 'var(--hero-max-height)' }}
  />
</div>
```

**Critical Considerations:**
- ⚠️ **MUST preserve curtain texture positioning** (see memories about `backgroundSize` and `backgroundPosition`)
- ⚠️ Overlay/wallBox positioning needs adjustment for `object-contain` letterboxing
- ⚠️ Corner markers must stay within image bounds
- ⚠️ Stitch lines use pixel calculations tied to `imgSize.h` — must not break!

---

### Phase 5: Collapsible Bottom Sheet ⏳ **PENDING**

**Files to Modify:**
- `apps/web/app/configure/components/SummaryPanel.tsx`
- `apps/web/app/configure/components/FiltersPanel.tsx`

**Features:**
- Drag handle at top for expand/collapse
- Adaptive height: 20% collapsed, 35% expanded
- Auto-collapse during wall-marking step
- Sticky CTA always visible

---

### Phase 6: Full-Screen Photo Toggle ⏳ **PENDING**

**Features:**
- Toggle button (Maximize/Minimize icon)
- Hero expands to 90-95% dvh
- Panel becomes floating button
- Optional top bar auto-hide

---

### Phase 7: Pinch-Zoom & Pan ⏳ **PENDING**

**New File:** `apps/web/app/configure/hooks/usePhotoZoom.ts`

**Features:**
- Touch gestures: pinch-to-zoom, pan when zoomed
- Bounds checking for markers
- Coordinate transforms for zoom state
- 60 FPS performance target

---

### Phase 8: Mini-Toolbar ⏳ **PENDING**

**New Component:** `apps/web/app/configure/components/ZoomToolbar.tsx`

**Features:**
- Auto-appears when zoom > 1.2×
- Reset View button
- Zoom level indicator
- Auto-hide after 5s

---

### Phase 9-11: Platform Quirks, Accessibility, Telemetry ⏳ **PENDING**

See detailed plan in `Mobile-First-Implementation-Plan.md`

---

## 📊 Testing Requirements

### Must Test On:
- [ ] iPhone SE (375×667px) — smallest target
- [ ] iPhone 13/15 Pro Max (390×844px, 430×932px)
- [ ] Android Pixel 6/8 (412×915px)
- [ ] 13" MacBook Air (1440×900px)

### Acceptance Criteria:
- [ ] Wall marking step: No vertical scroll needed
- [ ] All 4 corners + CTA visible without scrolling
- [ ] iOS Safari: No layout shift on toolbar show/hide
- [ ] Keyboard open: Panel compresses, hero doesn't jump
- [ ] Landscape: Hero scales to height, CTA reachable
- [ ] 60 FPS during corner dragging

---

## 🔧 How to Enable

### For Testing (Manual Toggle):

In `apps/web/app/configure/page.tsx`, pass the flag to ConfiguratorLayout:

```tsx
<ConfiguratorLayout
  isMobile={isMobile}
  providerId={providerId}
  useMobileFirstLayout={true}  // ← Enable new layout
>
  {/* ... */}
</ConfiguratorLayout>
```

### For Production (Env Toggle):

Add to `.env.local`:
```bash
NEXT_PUBLIC_MOBILE_FIRST_LAYOUT=1
```

Then in page:
```tsx
const MOBILE_FIRST_ENABLED = process.env.NEXT_PUBLIC_MOBILE_FIRST_LAYOUT === '1';

<ConfiguratorLayout useMobileFirstLayout={MOBILE_FIRST_ENABLED}>
```

---

## 📁 Files Inventory

### New Files Created:
1. ✅ `apps/web/app/configure/hooks/useMobileFirstLayout.ts`
2. 📝 `docs/UI-UX_Overhaul/Mobile-First-Implementation-Plan.md`
3. 📝 `docs/UI-UX_Overhaul/Mobile-First-Progress-Summary.md` (this file)

### Modified Files:
1. ✅ `apps/web/app/globals.css` (CSS variables + dvh support)
2. ✅ `apps/web/tailwind.config.ts` (viewport utilities)
3. ✅ `apps/web/app/configure/components/ConfiguratorLayout.tsx` (flex layout)
4. ✅ `docs/UI-UX_Overhaul/UI-UX_Overhaul_TaskList.md` (task tracking)

### Files Pending Modification:
- `apps/web/app/configure/page.tsx` (photo hero, Phase 4)
- `apps/web/app/configure/components/SummaryPanel.tsx` (Phase 5)
- `apps/web/app/configure/components/FiltersPanel.tsx` (Phase 5)

---

## 🎯 Immediate Next Steps

### For You (User Decision):
1. **Test the foundation** — Dev server should already be running
2. **Review the layout hook API** — Does it cover your needs?
3. **Approve Phase 4 approach** — Photo hero refactor is critical

### For Me (Implementation):
1. 🔄 **Phase 4**: Refactor photo container with height constraints
2. ⚠️ **CRITICAL**: Preserve curtain texture positioning logic
3. 🧪 Test on iPhone Safari simulator (if available)
4. 📝 Update `.env.example` with new variables

---

## ⚠️ Critical Warnings

### DO NOT BREAK:
1. **Curtain texture rendering**:
   - `backgroundSize: '${texScale}px ${wallBoxHeight}px'`
   - `backgroundPosition: '0px ${topOfWallBox}px'`
   - `backgroundRepeat: 'repeat-x'`
   - These are pixel-perfect calculations anchored to Wall Box

2. **Corner marker coordinate system**:
   - Uses normalized coordinates (0-1 range)
   - Transformed to pixels via `imgSize.w` / `imgSize.h`
   - Must account for `object-contain` letterboxing

3. **Overlay mask positioning**:
   - Wall mask URL with `WebkitMaskImage`
   - Clip-path polygons for wall boundaries
   - All tied to absolute pixel positions

---

## 📚 Related Documentation

- 📋 [Full Implementation Plan](./Mobile-First-Implementation-Plan.md)
- 📋 [Task List](./UI-UX_Overhaul_TaskList.md) (updated with 1.4 progress)
- 📋 [Layout Requirements](./# Mobile-first Grid & Layout improvements.md) (original spec)

---

**Status:** Foundation complete, ready for photo hero integration  
**Risk:** Medium (curtain texture logic must be preserved)  
**Confidence:** High (backward compatible, can rollback easily)  

---

*Last Updated: October 24, 2025, 12:46 PM*  
*Maintained by: Badass (Full Stack Developer)*
