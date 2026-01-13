# Curtain Wizard — Palette System Guide

**Version:** 1.0  
**Created:** October 23, 2025  
**Status:** ✅ Implemented & Ready to Use

---

## 📋 Overview

The Curtain Wizard palette system supports **dual color schemes** that can be switched at runtime:

1. **Havinic Harmony** - Warm, tactile palette for storefront integration
2. **Curtain Wizard Signature** - Premium, liquid glass palette for standalone app
3. **Hybrid Mode** - Transition palette for checkout handoff

---

## 🎨 Available Palettes

### Havinic Harmony (Storefront Integration)
**Use when:** Embedded in storefront iframe  
**Mood:** Clean, tactile, slightly warm

| Token | Color | Usage |
|-------|-------|-------|
| `--havinic-bg-base` | #F9F8F6 | Background |
| `--havinic-text-primary` | #2E2E2E | Primary text |
| `--havinic-text-secondary` | #6B6B6B | Secondary text |
| `--havinic-accent-primary` | #D6A354 | CTA buttons |
| `--havinic-accent-secondary` | #BFA68A | Hover states |
| `--havinic-success` | #5BAA7E | Success messages |
| `--havinic-error` | #C96557 | Error messages |

### Curtain Wizard Signature (Standalone)
**Use when:** Running as standalone app  
**Mood:** Minimal, airy, premium (liquid glass)

| Token | Color | Usage |
|-------|-------|-------|
| `--cw-sig-bg-base` | #FAFAFB | Background |
| `--cw-sig-text-primary` | #1E1E1F | Primary text |
| `--cw-sig-text-secondary` | #7A7A7A | Secondary text |
| `--cw-sig-accent-sage` | #A8C3A1 | Primary accent |
| `--cw-sig-accent-lilac` | #D9C2F0 | Secondary accent |
| `--cw-sig-accent-gradient` | Sage→Lilac | CTA gradient |
| `--cw-sig-success` | #8FD3B2 | Success messages |
| `--cw-sig-error` | #E57373 | Error messages |

---

## 🚀 Quick Start

### 1. Wrap Your App with PaletteProvider

```tsx
// apps/web/app/layout.tsx
import { PaletteProvider } from '@/lib/palette-context';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <PaletteProvider initialPalette="signature">
          {children}
        </PaletteProvider>
      </body>
    </html>
  );
}
```

### 2. Use Palette-Aware Tokens in Components

**Option A: Use Tailwind Classes (Recommended)**

```tsx
// Components automatically adapt to active palette
<div className="bg-active-bg text-active-text">
  <h1 className="text-active-accent">Welcome</h1>
  <button className="bg-active-accent text-white">
    Get Started
  </button>
</div>
```

**Option B: Use CSS Variables Directly**

```tsx
<div style={{ 
  background: 'var(--active-bg-base)',
  color: 'var(--active-text-primary)' 
}}>
  Content
</div>
```

### 3. Switch Palettes Programmatically

```tsx
import { usePalette } from '@/lib/palette-context';

function MyComponent() {
  const { current, setPalette } = usePalette();
  
  return (
    <button onClick={() => setPalette('havinic')}>
      Switch to Havinic
    </button>
  );
}
```

---

## 🔧 Advanced Usage

### Auto-Detect Palette Based on Context

```tsx
import { useAutoDetectPalette } from '@/hooks/usePaletteSwitch';

function App() {
  // Automatically use Havinic in iframe, Signature standalone
  useAutoDetectPalette({
    iframeDetected: 'havinic',
    standalone: 'signature'
  });
  
  return <YourApp />;
}
```

### Checkout Palette Transition

```tsx
import { useCheckoutPaletteTransition } from '@/hooks/usePaletteSwitch';

function SummaryPanel() {
  const { startCheckoutTransition } = useCheckoutPaletteTransition();
  
  const handleFinalizePurchase = () => {
    // Smooth Signature → Hybrid → Havinic transition
    startCheckoutTransition(() => {
      // Hand off to storefront cart
      window.parent.postMessage({ type: 'add-to-cart', ... }, '*');
    });
  };
  
  return (
    <button onClick={handleFinalizePurchase}>
      Finalize Purchase
    </button>
  );
}
```

### Custom Transition Callbacks

```tsx
import { usePaletteSwitch } from '@/hooks/usePaletteSwitch';

function MyComponent() {
  const { switchTo, isTransitioning } = usePaletteSwitch({
    duration: 300,
    easing: 'ease-out',
    onTransitionStart: (from, to) => {
      console.log(`Transitioning from ${from} to ${to}`);
    },
    onTransitionEnd: (palette) => {
      console.log(`Transition complete: ${palette}`);
    }
  });
  
  return (
    <button 
      onClick={() => switchTo('havinic')}
      disabled={isTransitioning}
    >
      Switch Palette
    </button>
  );
}
```

---

## 📦 Available Tailwind Classes

### Background Colors
- `bg-active-bg` - Active palette background
- `bg-havinic-bg` - Havinic background
- `bg-cw-sig-bg` - Signature background

### Text Colors
- `text-active-text` - Active palette primary text
- `text-active-text-secondary` - Active palette secondary text
- `text-havinic-text` - Havinic primary text
- `text-cw-sig-text` - Signature primary text

### Accent Colors
- `bg-active-accent` - Active palette primary accent
- `bg-active-accent-secondary` - Active palette secondary accent
- `bg-havinic-accent` - Havinic accent (Honey Oak)
- `bg-cw-sig-sage` - Signature sage accent
- `bg-cw-sig-lilac` - Signature lilac accent

### Semantic Colors
- `text-active-success` - Success color
- `text-active-error` - Error color
- `text-active-warning` - Warning color
- `border-active-border` - Border color

---

## 🎯 Best Practices

### ✅ Do's

1. **Use semantic "active-*" tokens** for components that should adapt to palette changes
   ```tsx
   <button className="bg-active-accent text-white">Click Me</button>
   ```

2. **Use specific palette tokens** when you need a fixed palette
   ```tsx
   <div className="bg-havinic-bg">Always Havinic</div>
   ```

3. **Wrap your app** with `PaletteProvider` at the root level

4. **Test both palettes** during development using `<PaletteSwitcher />`

5. **Use the checkout transition hook** for smooth storefront handoff

### ❌ Don'ts

1. **Don't hard-code colors** - always use tokens
   ```tsx
   // ❌ Bad
   <div style={{ background: '#F9F8F6' }}>
   
   // ✅ Good
   <div className="bg-active-bg">
   ```

2. **Don't mix palette-specific tokens** in the same component
   ```tsx
   // ❌ Bad - mixing Havinic and Signature
   <div className="bg-havinic-bg text-cw-sig-text">
   
   // ✅ Good - use active tokens
   <div className="bg-active-bg text-active-text">
   ```

3. **Don't forget to handle transitions** - use `isTransitioning` to disable actions during palette changes

---

## 🧪 Testing Palettes

### Development Mode

Add the `PaletteSwitcher` component to test palettes:

```tsx
// apps/web/app/page.tsx
import { PaletteSwitcher } from '@/components/ui/PaletteSwitcher';

export default function Page() {
  return (
    <>
      {process.env.NODE_ENV === 'development' && <PaletteSwitcher />}
      <YourContent />
    </>
  );
}
```

This adds a floating palette switcher in the bottom-right corner during development.

### Manual Testing Checklist

- [ ] Test Signature palette (standalone mode)
- [ ] Test Havinic palette (storefront mode)
- [ ] Test Hybrid palette (checkout transition)
- [ ] Verify smooth 300ms transitions
- [ ] Check localStorage persistence
- [ ] Test iframe auto-detection
- [ ] Verify all components adapt correctly

---

## 📚 API Reference

### PaletteProvider Props

```tsx
interface PaletteProviderProps {
  children: ReactNode;
  initialPalette?: 'havinic' | 'signature' | 'hybrid'; // Default: 'signature'
  persistToStorage?: boolean; // Default: true
}
```

### usePalette() Return Value

```tsx
{
  current: 'havinic' | 'signature' | 'hybrid';
  setPalette: (palette: Palette) => void;
  isTransitioning: boolean;
}
```

### usePaletteSwitch() Options

```tsx
interface PaletteSwitchOptions {
  duration?: number; // Default: 300ms
  easing?: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
  onTransitionStart?: (from: Palette, to: Palette) => void;
  onTransitionEnd?: (palette: Palette) => void;
}
```

### usePaletteSwitch() Return Value

```tsx
{
  current: Palette;
  switchTo: (palette: Palette) => void;
  transitionToHybrid: () => void;
  transitionFromHybrid: (target: 'signature' | 'havinic') => void;
  isTransitioning: boolean;
}
```

---

## 🔍 Troubleshooting

### Palette not switching?
- Ensure `PaletteProvider` wraps your app
- Check browser console for errors
- Verify you're using `active-*` tokens, not hard-coded colors

### Transitions feel janky?
- Check if other CSS transitions are conflicting
- Verify `duration` is set appropriately (300ms recommended)
- Ensure no layout shifts during transition

### localStorage not persisting?
- Check `persistToStorage` prop is `true`
- Verify browser allows localStorage
- Check for localStorage quota errors

---

## 🎓 Examples

See the following files for implementation examples:

- **Provider Setup:** `apps/web/app/layout.tsx` (to be implemented)
- **Basic Usage:** `apps/web/components/ui/PaletteSwitcher.tsx`
- **Advanced Hooks:** `apps/web/hooks/usePaletteSwitch.ts`
- **Context Implementation:** `apps/web/lib/palette-context.tsx`

---

**Questions?** Refer to the design spec in `docs/UI-UX_Overhaul/# Curtain Wizard — 02_Visual_Language_and_Palettes (UI:UX).md`

**Last Updated:** October 23, 2025
