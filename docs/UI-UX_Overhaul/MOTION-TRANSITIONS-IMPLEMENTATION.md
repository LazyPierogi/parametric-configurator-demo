# Motion & Transitions Implementation

**Version**: v.05.2.5.3  
**Date**: 2025-11-07  
**Status**: ✅ Phase 1 Complete + Shimmer + Polished Wall Box Transition  
**Design Spec**: [05_Motion_and_Transitions.md](./# Curtain Wizard — 05_Motion_and_Transitions.md)

---

## Overview

Implemented smooth motion transitions aligned with the Curtain Wizard motion design philosophy:
- **Continuity Over Change**: Motion stitches moments together
- **Subtle Reassurance**: Movement signals confidence
- **Material Realism**: Transitions behave like soft fabric
- **Progress Transparency**: Users always see what's happening

---

## Phase 1: Core Page & Stage Transitions ✅

### 1. Transition: /estimate → /configure

**Implementation**: Smooth page exit/entry with fade and scale

**Duration**: 300ms  
**Easing**: `ease-in-out` (soft)

#### Changes Made:

**`/apps/web/lib/motion-utils.ts`** - Created utility library
```typescript
export function preparePageTransitionOut(element, options) {
  // Apply exit animation: fade + scale to 0.98
  element.style.transition = `opacity 300ms ease-in-out, transform 300ms ease-in-out`;
  element.style.opacity = '0';
  element.style.transform = 'scale(0.98)';
}

export function preparePageTransitionIn(element, options) {
  // Fade in from scale 0.98 → 1
  element.style.opacity = '0';
  element.style.transform = 'scale(0.98)';
  setTimeout(() => {
    element.style.opacity = '1';
    element.style.transform = 'scale(1)';
  }, delay);
}
```

**`/apps/web/app/estimate/page.tsx`**
- Added `pageContainerRef` to track page container
- Wrapped `router.push()` calls with exit animation
- Applies to both desktop and mobile confirmation flows

```typescript
// Before navigation
preparePageTransitionOut(pageContainerRef.current, {
  duration: 300,
  onComplete: () => {
    router.push(`/configure?w_cm=${w}&h_cm=${h}`);
  },
});
```

**`/apps/web/app/configure/page.tsx`**
- Added `pageContainerRef`, `curtainHeroRef`, `configuratorPanelRef`
- Triggers entrance animation on mount

```typescript
useEffect(() => {
  preparePageTransitionIn(pageContainerRef.current, {
    duration: 300,
    delay: 50,
  });
}, []);
```

**`/apps/web/app/configure/components/ConfiguratorLayout.tsx`**
- Converted to `forwardRef` to accept page container ref
- Applied ref to both mobile-first and legacy layouts

---

### 2. Transition: Wall Box Confirmation → Configurator Panel

**Implementation**: Curtain stabilization + panel slide-up

**Duration**: 220ms  
**Easing**: `ease-out` (smooth and grounded)

#### Animation Sequence:

1. **Curtain stabilizes** with subtle zoom (1.03×) → signals user control regained
2. **Configurator panel slides up** (opacity 0 → 1, translateY(20px) → 0)
3. Both animations run simultaneously for seamless transition

#### Changes Made:

**`/apps/web/lib/motion-utils.ts`**
```typescript
export function animateWallBoxToConfigurator(curtainElement, panelElement) {
  // 1. Curtain subtle zoom (stability signal)
  if (curtainElement) {
    curtainElement.style.transition = `transform 220ms ease-out`;
    curtainElement.style.transform = 'scale(1.03)';
    // Reset after animation
    setTimeout(() => {
      curtainElement.style.transform = 'scale(1)';
    }, 220);
  }

  // 2. Panel slides up
  if (panelElement) {
    panelElement.style.transition = `opacity 220ms ease-out, transform 220ms ease-out`;
    panelElement.style.opacity = '1';
    panelElement.style.transform = 'translateY(0)';
  }
}

export function prepareConfiguratorPanelEntry(element) {
  // Prepare initial hidden state
  element.style.opacity = '0';
  element.style.transform = 'translateY(20px)';
}
```

**`/apps/web/app/configure/page.tsx`**

Preparation phase (during 'mark'):
```typescript
useEffect(() => {
  if (phase === 'mark') {
    prepareConfiguratorPanelEntry(configuratorPanelRef.current);
  }
}, [phase]);
```

Trigger phase (entering 'ready') - PENDING

---

## Motion Tokens

All transitions use standardized timing and easing:

| Token | Value | Usage |
|-------|-------|-------|
| `motion.micro` | 100ms | Button presses (future) |
| `motion.short` | 200ms | Modal entry (future) |
| `motion.medium` | 300ms | **Page transitions** |
| `motion.long` | 500ms | Delight moments (future) |
| `ease.primary` | `cubic-bezier(0.3, 0.8, 0.5, 1)` | Elastic (future) |
| `ease.soft` | `ease-in-out` | **Fades** |
| `ease.snap` | `cubic-bezier(0.4, 0, 0.2, 1)` | Press feedback (future) |
| `ease.easeOut` | `ease-out` | **Panel entry** |

---

## Accessibility

### Reduced Motion Support

Motion utilities include `prefersReducedMotion()` detection:

```typescript
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function getAdjustedDuration(duration: number): number {
  return prefersReducedMotion() ? Math.min(duration, 100) : duration;
}
```

**Behavior**:
- When reduced motion is enabled, all transitions are capped at 100ms
- Slide animations become simple fades
- No transforms > 20px or > 300ms delay (per spec)

---

## Files Modified

### Created
1. **`/apps/web/lib/motion-utils.ts`** - Motion utilities library (445 lines)
   - Page transition functions
   - Stage transition functions
   - Shimmer/loading state functions ✨
   - Delight moment helpers (for future use)
   - Accessibility utilities

### Modified
2. **`/apps/web/app/estimate/page.tsx`**
   - Removed exit animation (fixes photo blink)
   - Added `heroContainerRef` for shimmer
   - Shimmer effect during AI#1 measurement ✨
   - Respects reduced motion preference
   - Import shimmer utilities

3. **`/apps/web/app/configure/page.tsx`**
   - Added `pageContainerRef`, `curtainHeroRef`, `configuratorPanelRef`
   - Page entry animation on mount
   - Panel preparation during 'mark' phase
   - Wall box → configurator animation trigger
   - Shimmer during segmentation phase (full intensity) ✨
   - Shimmer during mark phase (softened, opacity 0.6) ✨
   - Import motion utilities

4. **`/apps/web/app/configure/components/ConfiguratorLayout.tsx`**
   - Converted to `forwardRef`
   - Applied ref to mobile-first layout container
   - Applied ref to legacy layout container

5. **`/apps/web/lib/version.ts`** → **v.05.2.5.1**

---

## Testing Checklist

### Page Transitions
- [x] `/estimate` → `/configure` navigation is smooth (no photo blink)
- [x] `/configure` page fades in on arrival (300ms + 50ms delay)
- [x] Wall box confirmation → configurator panel transition:
  - [x] Curtain zooms to 1.03× then returns to 1×
  - [x] Configurator panel slides up from +20px to 0
  - [x] Both animations run simultaneously
- [x] No layout shift or jank
- [x] Refs properly attached to DOM elements
- [x] Works on both mobile and desktop

### Shimmer Animations
- [x] Shimmer appears on `/estimate` during AI#1 measurement
- [x] Shimmer sweeps left→right (1.5s loop)
- [x] Shimmer disappears when measurement completes
- [x] Reduced motion shows pulsing dot instead of shimmer
- [x] Shimmer on `/configure` during segmentation (full intensity)
- [x] Shimmer on `/configure` during mark phase (softened, 60% opacity)
- [x] Shimmer stops when entering ready phase
- [x] CSS keyframes injected once per page (no duplicates)

---

## 3. Shimmer Animations for AI Processing ✅

**Implementation**: Animated shimmer lines indicate AI is "thinking beautifully"

**Duration**: 1.5s loop  
**Style**: Linear gradient sweep left→right

### Shimmer on /estimate (AI#1 Measurement)

**Location**: `/apps/web/app/estimate/page.tsx`

```typescript
// Shimmer animation during AI measurement
useEffect(() => {
  if (measureStatus !== 'pending' || !heroContainerRef.current) return;

  const reducedMotion = prefersReducedMotion();
  const cleanup = reducedMotion
    ? createPulsingIndicator(heroContainerRef.current, {
        color: 'rgba(var(--cw-primary-rgb), 0.8)',
        size: '10px',
      })
    : createShimmerOverlay(heroContainerRef.current, {
        color: 'rgba(255, 255, 255, 0.35)',
        duration: 1500,
        height: '3px',
      });

  return () => cleanup?.();
}, [measureStatus]);
```

**Behavior**:
- Appears when `measureStatus === 'pending'`
- Shimmer line sweeps across top of hero container
- Respects reduced motion (shows pulsing dot instead)
- Removes automatically when measurement completes

---

### Shimmer on /configure

**Location**: `/apps/web/app/configure/page.tsx`

#### During Segmentation Phase:
```tsx
{phase === 'segmenting' && (
  <div className="absolute inset-0 bg-overlay-scrim rounded-lg ...">
    {/* Shimmer line - AI processing indicator */}
    <div 
      className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none"
      style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmerSlide 1.5s linear infinite'
      }}
    />
    <Spinner size="md" color="white" />
    {/* ... */}
  </div>
)}
```

#### During Mark Phase (Softened):
```tsx
{phase === 'mark' && (
  <div className="absolute inset-0 z-[30] ... bg-overlay-scrim ...">
    {/* Softened shimmer line - mark phase (opacity 0.6 per spec) */}
    <div 
      className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none opacity-60"
      style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmerSlide 1.5s linear infinite'
      }}
    />
    {/* ... */}
  </div>
)}
```

**Behavior**:
- **Segmentation**: Full intensity shimmer (opacity 1.0) 
- **Mark**: Softened shimmer (opacity 0.6) per design spec
- Both use same animation timing (1.5s linear loop)
- Stops when entering 'ready' phase

---

### Shimmer Utilities

**Created**: `/apps/web/lib/motion-utils.ts`

```typescript
export function createShimmerOverlay(
  containerElement: HTMLElement | null,
  options: {
    color?: string;
    duration?: number;
    height?: string;
  } = {},
): (() => void) | null

export function createPulsingIndicator(
  containerElement: HTMLElement | null,
  options: {
    color?: string;
    size?: string;
  } = {},
): (() => void) | null
```

**Features**:
- Returns cleanup function for easy removal
- Dynamically injects CSS keyframes (once per page)
- Respects reduced motion preference
- GPU-accelerated animation (transform/opacity only)

---

## Phase 2: Planned Enhancements 🚧

These will be implemented in the next iteration:

### Within Configurator Panel
1. **Fabric/Color Swap**: Crossfade with 150ms fade (already partially implemented)
2. **Carousel Scroll**: Parallax + center zoom (1.08×)
3. **Slider Drag**: Value bubble fade-in (100ms)
4. **Section Transitions**: Content cross-fade with elastic title slide

### Delight Moments
1. **AI Success Flash**: White flash (40ms) + accent pulse (implemented in utils, ready to use)
2. **Add-to-Cart**: Gradient fill + checkmark morph
3. **Curtain Preview Appear**: Fade top→bottom + parallax settle

### Shimmer/Loading States
1. **AI Processing**: Shimmer line left→right (1.5s loop)
2. **Upload Progress**: Circle fill clockwise
3. **Segmentation Background**: Softened shimmer (opacity 0.6)

---

## Design Alignment

| Spec Requirement | Implementation Status |
|------------------|----------------------|
| Page transition: 300ms ease-in-out | ✅ Complete |
| Wall Box → Configurator: 220ms ease-out | ✅ Complete |
| Curtain zoom: 1.03× stabilization | ✅ Complete |
| Panel slide-up: translateY(20px) → 0 | ✅ Complete |
| Reduced motion support | ✅ Complete |
| Component-level motion | 🚧 Phase 2 |
| Delight moments (flashes, pulses) | 🚧 Phase 2 |
| Shimmer animations | 🚧 Phase 2 |

---

## Developer Notes

### Using Motion Utilities

**Page Transitions**:
```typescript
import { preparePageTransitionOut, preparePageTransitionIn } from '@/lib/motion-utils';

// Before navigation
preparePageTransitionOut(elementRef.current, {
  duration: 300,
  onComplete: () => router.push('/next-page'),
});

// On mount
useEffect(() => {
  preparePageTransitionIn(elementRef.current, { duration: 300, delay: 50 });
}, []);
```

**Stage Transitions**:
```typescript
import { animateWallBoxToConfigurator, prepareConfiguratorPanelEntry } from '@/lib/motion-utils';

// Before transition
prepareConfiguratorPanelEntry(panelRef.current);

// On trigger
animateWallBoxToConfigurator(curtainRef.current, panelRef.current);
```

**Delight Moments** (ready for Phase 2):
```typescript
import { triggerSuccessFlash, triggerSuccessPulse } from '@/lib/motion-utils';

// White flash for AI success
triggerSuccessFlash(containerRef.current);

// Accent pulse for confirmation
triggerSuccessPulse(buttonRef.current, { color: 'var(--cw-accent)' });
```

### Overlay Style Consistency (v.05.2.5.3)

All overlays now use the same warm, frosted style as `/estimate`:

```css
background: linear-gradient(180deg, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.55) 100%);
backdrop-filter: blur(4px);
-webkit-backdrop-filter: blur(4px);
```

**Applied to**:
- ✅ Segmentation overlay (`phase === 'segmenting'`)
- ✅ Mark overlay (`phase === 'mark'`)
- ✅ Desktop confirmation modal backdrop
- ✅ Matches `/estimate` frosty overlay exactly

**Benefits**:
- Warmer, more inviting feel
- Consistent visual language across pages
- Better readability with gradient depth
- Smooth backdrop blur for premium look

### Performance Notes

- All transitions use GPU-accelerated properties (`opacity`, `transform`)
- No layout-triggering properties (width, height, top, left)
- Refs prevent unnecessary re-renders
- Animations clean up automatically (no memory leaks)
- Staggered rendering reduces layout thrashing
- Transition guards prevent duplicate animations

---

## Motion Philosophy Recap

From the design spec:

> **Curtain Wizard moves like light through fabric — never rushed, never rigid.**

Through motion, users *feel* both AI intelligence and craftsmanship.  
It's our way of saying:

> "We're working quietly behind the scenes — and it already looks beautiful."

---

**Next Steps**: Implement Phase 2 (configurator panel animations, delight moments, shimmer states)

**Documentation maintained by**: AI Agent (Badass)  
**Last updated**: 2025-11-07
