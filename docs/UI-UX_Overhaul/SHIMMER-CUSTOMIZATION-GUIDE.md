# Shimmer Animation Customization Guide

**Version**: v.05.2.5.2  
**Last Updated**: 2025-11-07

---

## Overview

The shimmer animation creates an "AI scanning beam" effect that shows users the AI is actively processing their photo. This guide shows you how to customize the shimmer appearance.

---

## Quick Tweaks

### Location 1: `/estimate` Page (AI#1 Measurement)

**File**: `/apps/web/app/estimate/page.tsx`  
**Line**: ~105-113

```typescript
createShimmerOverlay(heroContainerRef.current, {
  // ✨ TWEAK THESE VALUES:
  height: '6px',        // Beam thickness (try: '4px' to '12px')
  opacity: 0.85,        // Beam intensity (try: 0.5 to 1.0)
  glowSize: '20px',     // Glow radius (try: '10px' to '30px')
  beamWidth: '30%',     // Width of bright center (try: '20%' to '40%')
  duration: 1500,       // Animation speed in ms (try: 1000 to 2000)
});
```

---

### Location 2: `/configure` Page - Segmentation Phase

**File**: `/apps/web/app/configure/page.tsx`  
**Line**: ~3224-3232

```tsx
<div 
  className="absolute top-0 left-0 right-0 h-[6px] pointer-events-none"
  style={{
    opacity: 0.85,     // ✨ TWEAK: Beam intensity (0-1)
    background: 'linear-gradient(90deg, 
      transparent 0%, 
      transparent 20%,           // ✨ TWEAK: Start fade-in point
      rgba(255, 255, 255, 1) 50%,  // Center brightness
      transparent 80%,           // ✨ TWEAK: End fade-out point
      transparent 100%
    )',
    backgroundSize: '200% 100%',
    animation: 'shimmerSlide 1.5s linear infinite',  // ✨ TWEAK: Speed (1.0s-2.0s)
    boxShadow: '0 0 20px rgba(255, 255, 255, 0.8), 0 0 10px rgba(255, 255, 255, 0.6)',  // ✨ TWEAK: Glow intensity
    filter: 'blur(0.5px)'  // ✨ TWEAK: Soft edge (0px-2px)
  }}
/>
```

---

### Location 3: `/configure` Page - Mark Phase (Softened)

**File**: `/apps/web/app/configure/page.tsx`  
**Line**: ~3264-3272

```tsx
<div 
  className="absolute top-0 left-0 right-0 h-[6px] pointer-events-none"
  style={{
    opacity: 0.5,      // ✨ TWEAK: Lower opacity for subtle effect (0.3-0.7)
    background: 'linear-gradient(90deg, 
      transparent 0%, 
      transparent 20%, 
      rgba(255, 255, 255, 1) 50%, 
      transparent 80%, 
      transparent 100%
    )',
    backgroundSize: '200% 100%',
    animation: 'shimmerSlide 1.5s linear infinite',
    boxShadow: '0 0 16px rgba(255, 255, 255, 0.5), 0 0 8px rgba(255, 255, 255, 0.4)',  // ✨ TWEAK: Softer glow
    filter: 'blur(0.5px)'
  }}
/>
```

---

## Parameter Reference

### `createShimmerOverlay()` Function

**File**: `/apps/web/lib/motion-utils.ts`  
**Line**: ~227-237

| Parameter | Default | Range | Effect |
|-----------|---------|-------|--------|
| `height` | `'6px'` | `'2px'` - `'12px'` | Beam thickness |
| `opacity` | `0.8` | `0.3` - `1.0` | Overall intensity |
| `glowSize` | `'16px'` | `'8px'` - `'40px'` | Glow/shadow blur radius |
| `beamWidth` | `'30%'` | `'15%'` - `'45%'` | Width of bright center |
| `duration` | `1500` | `800` - `2500` | Animation speed (ms) |
| `color` | `'rgba(255, 255, 255, 1)'` | Any CSS color | Beam color |

---

## Common Customizations

### More Subtle Shimmer
```typescript
createShimmerOverlay(container, {
  height: '4px',
  opacity: 0.5,
  glowSize: '12px',
  beamWidth: '20%',
  duration: 1800,
});
```

### More Dramatic Shimmer
```typescript
createShimmerOverlay(container, {
  height: '10px',
  opacity: 1.0,
  glowSize: '30px',
  beamWidth: '40%',
  duration: 1200,
});
```

### Faster Scanning
```typescript
createShimmerOverlay(container, {
  duration: 1000,  // 1 second loop (faster)
});
```

### Slower, More Meditative
```typescript
createShimmerOverlay(container, {
  duration: 2500,  // 2.5 second loop (slower)
});
```

### Colored Beam (e.g., Brand Color)
```typescript
createShimmerOverlay(container, {
  color: 'rgba(214, 163, 84, 1)',  // Honey Oak accent
  glowSize: '24px',
});
```

---

## Inline Style Tweaks (Configure Page)

For the inline shimmers on `/configure`, adjust the following values directly in the JSX:

### Height
```tsx
className="absolute top-0 left-0 right-0 h-[6px] pointer-events-none"
                                              ↑
                                      Change to: h-[8px], h-[4px], etc.
```

### Opacity
```tsx
style={{ opacity: 0.85, ... }}
                  ↑
          Change to: 0.5 (subtle), 1.0 (max)
```

### Beam Width
```tsx
background: 'linear-gradient(90deg, 
  transparent 0%, 
  transparent 20%,    ← Start fade-in (lower = wider beam)
  rgba(255, 255, 255, 1) 50%, 
  transparent 80%,    ← End fade-out (higher = wider beam)
  transparent 100%
)'
```

Try: `10%` / `90%` for very wide beam, or `25%` / `75%` for narrow beam.

### Glow Intensity
```tsx
boxShadow: '0 0 20px rgba(255, 255, 255, 0.8), 0 0 10px rgba(255, 255, 255, 0.6)'
               ↑                         ↑              ↑                      ↑
           Outer blur               Outer opacity   Inner blur           Inner opacity
```

Try: Increase first value (e.g., `30px`) for bigger glow.

### Animation Speed
```tsx
animation: 'shimmerSlide 1.5s linear infinite'
                         ↑
                   Change to: 1.0s (fast), 2.0s (slow)
```

---

## Visual Examples

### Current Default (Enhanced)
- **Height**: 6px
- **Opacity**: 0.85
- **Glow**: 20px
- **Beam Width**: 30%
- **Speed**: 1.5s
- **Result**: Clearly visible AI scanning beam

### Previous Subtle (Old)
- **Height**: 3px
- **Opacity**: 0.35
- **Glow**: 0px
- **Beam Width**: N/A
- **Speed**: 1.5s
- **Result**: Too subtle, hard to see

---

## Design Philosophy

From the motion design spec:

> **"AI is thinking beautifully"**

The shimmer should be:
- ✅ **Visible** - Users should clearly see AI is working
- ✅ **Elegant** - Not harsh or distracting
- ✅ **Reassuring** - Conveys "we're making progress"
- ✅ **Continuous** - Smooth loop, no jumps or stutters

The current enhanced settings achieve this balance. Tweak conservatively!

---

## Accessibility

The shimmer respects `prefers-reduced-motion`:
- **Motion enabled**: Shimmer line sweeps left→right
- **Motion reduced**: Static pulsing dot instead

This is handled automatically by `createShimmerOverlay()` and `prefersReducedMotion()`.

---

## Testing Your Changes

1. **Save the file** after making your tweaks
2. **Reload the page** (hot reload should work)
3. **Upload a photo** on `/estimate` or `/configure`
4. **Observe the shimmer** during AI processing
5. **Adjust values** until you're happy with the look

---

## Troubleshooting

### Shimmer not visible?
- Increase `opacity` (try `1.0`)
- Increase `height` (try `'10px'`)
- Increase `glowSize` (try `'30px'`)
- Check browser console for errors

### Shimmer too intense?
- Decrease `opacity` (try `0.5`)
- Decrease `height` (try `'4px'`)
- Decrease `glowSize` (try `'12px'`)
- Increase `beamWidth` (try `'40%'`) for more diffused look

### Shimmer too fast/slow?
- Adjust `duration` in milliseconds
- Slower: `2000` (2 seconds)
- Faster: `1000` (1 second)

### Shimmer stutters or lags?
- This is GPU-accelerated, should be smooth
- Check if browser supports CSS animations
- Ensure no heavy JavaScript blocking render thread

---

## Future Enhancements

Planned for Phase 3:
- **Progress-based shimmer** - Speed up as processing completes
- **Color transitions** - Shimmer changes color based on phase
- **Multi-line shimmer** - Multiple scanning lines for dramatic effect
- **Particle effects** - Subtle particles trailing the beam

---

**Need help?** Check the implementation in:
- `/apps/web/lib/motion-utils.ts` - Shimmer utility function
- `/apps/web/app/estimate/page.tsx` - Estimate page usage
- `/apps/web/app/configure/page.tsx` - Configure page usage

**Last Updated**: 2025-11-07 by AI Agent (Badass)
