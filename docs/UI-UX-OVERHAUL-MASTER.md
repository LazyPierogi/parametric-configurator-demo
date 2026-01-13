# Curtain Wizard UI/UX Overhaul - Master Documentation

**Document Version:** 1.0  
**Last Updated:** October 18, 2025  
**Status:** ✅ Phase 1-4 Complete, Production Ready  
**Target Audience:** Senior Developers & UI/UX Designers

---

## 📋 Executive Summary

This document serves as the **single source of truth** for the Curtain Wizard UI/UX overhaul project. It consolidates all architectural decisions, component patterns, token systems, and implementation guidelines for future development work.

### Current State
- ✅ **Foundation Complete:** Tailwind CSS + PostCSS fully integrated
- ✅ **Component Library:** 10 production-ready components with comprehensive variants
- ✅ **Token System:** 40+ CSS variables for consistent theming
- ✅ **Zero Runtime Injection:** All styles load statically via CSS bundle
- ✅ **Architecture:** Clean separation of concerns, component extraction complete
- 🚧 **Testing:** Core functionality validated, comprehensive E2E testing pending

### Migration Progress: **75% Complete**

---

## 🎯 Project Goals

### Primary Objectives (Achieved)
1. **Eliminate inline styles** → Use Tailwind utilities and CSS variables
2. **Create reusable component library** → Consistent UX patterns
3. **Centralize design tokens** → Easy theme customization
4. **Improve maintainability** → Clear separation of concerns
5. **Performance optimization** → Static CSS loading, no runtime injection

### Secondary Objectives (In Progress)
6. **Comprehensive testing** → E2E validation of all flows
7. **Accessibility audit** → WCAG AA compliance verification
8. **Documentation** → Component usage guidelines and examples

---

## 🏗️ Architecture Overview

### Tech Stack
```
Frontend Framework: Next.js 14 (App Router)
Styling: Tailwind CSS 3.x + PostCSS
Component Pattern: React Server/Client Components
Type Safety: TypeScript 5.x
State Management: React Hooks + Context
Build Tool: Turborepo (monorepo)
```

### Directory Structure
```
apps/web/
├── app/
│   ├── globals.css           # Master stylesheet with tokens
│   ├── configure/
│   │   ├── page.tsx          # Main configurator (refactored)
│   │   ├── components/       # Page-specific components
│   │   │   ├── ConfiguratorLayout.tsx
│   │   │   ├── SummaryPanel.tsx
│   │   │   ├── DebugControls.tsx
│   │   │   ├── FiltersPanel.tsx
│   │   │   └── CoverageWarningDialog.tsx
│   │   └── hooks/            # Custom hooks
│   └── estimate/
│       └── page.tsx          # Measurement page
├── components/
│   └── ui/                   # Shared component library ⭐
│       ├── Banner.tsx        # NEW: Notifications
│       ├── Toast.tsx         # NEW: Overlay messages
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Chip.tsx
│       ├── Dialog.tsx
│       ├── Input.tsx
│       ├── Progress.tsx
│       ├── Select.tsx
│       ├── Spinner.tsx
│       └── index.ts
├── lib/
│   ├── utils.ts             # cn() helper for classNames
│   ├── parent-bridge.ts     # Iframe communication
│   └── segment-cache.ts     # Client-side caching
├── tailwind.config.ts       # Tailwind configuration
└── postcss.config.mjs       # PostCSS plugins

packages/
├── core/                    # Business logic
│   └── src/
│       ├── catalog/         # Product catalog & pricing
│       └── i18n/            # Internationalization
└── shared/                  # Shared utilities
    └── src/
        └── env.ts           # Environment configuration
```

---

## 🎨 Design Token System

### Token Philosophy
All visual properties (colors, spacing, shadows, etc.) are defined as CSS variables in `globals.css`, then aliased in `tailwind.config.ts` for use via Tailwind utilities.

**Benefits:**
- Single source of truth for design values
- Runtime customization via JavaScript when needed
- Easy theme switching (light/dark mode ready)
- Consistent visual language across the app

### Token Categories

#### 1. Color Tokens

**Primary Brand Colors**
```css
--color-primary: #4a67ff;           /* Main brand blue */
--color-primary-dark: #1f2b6c;      /* Dark variant */
--color-primary-light: #eef2ff;     /* Light variant */
```

**Semantic Colors (Banners, Alerts)**
```css
/* Info - Blue */
--info-bg: #eff6ff;
--info-border: #bfdbfe;
--info-text: #1e40af;

/* Warning - Amber */
--warning-bg: #fef3c7;
--warning-border: #fbbf24;
--warning-text: #92400e;

/* Error - Red */
--error-bg: #fee2e2;
--error-border: #fca5a5;
--error-text: #991b1b;

/* Success - Green */
--success-bg: #d1fae5;
--success-border: #6ee7b7;
--success-text: #065f46;
```

**Overlay & Glass Effects**
```css
--cw-overlay-scrim: rgba(2, 6, 23, 0.65);
--cw-overlay-scrim-strong: rgba(24, 27, 45, 0.82);
--cw-surface-glass-rgb: 248, 250, 252;
--cw-config-glass-alpha: 0.55;
```

**Frosted Overlay Utilities** (CSS Classes)
```css
.cw-frosted-overlay {
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.55) 100%);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.cw-frosted-overlay-strong {
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.65) 100%);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
```

**Usage Examples:**
```tsx
// Standard frosted overlay (segmenting, mark, confirm modal)
<div className="cw-frosted-overlay" />

// Stronger variant for busy backgrounds (toasts)
<div className="cw-frosted-overlay-strong" />
```

**Debug Handle Tokens** (Runtime customizable)
```css
--cw-handle-bg: #e5e7eb;
--cw-handle-border: rgba(0, 0, 0, 0.15);
--cw-handle-opacity: 1;
--cw-wall-stroke: #e5e7eb;
--cw-wall-stroke-opacity: 1;
```

#### 2. Shadow Tokens
```css
--shadow-default: 0 6px 16px rgba(15, 23, 42, 0.08);
--cw-config-panel-shadow: 0 12px 30px rgba(57, 88, 209, 0.12);
--cw-overlay-toast-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
--cw-debug-handle-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
--cw-chip-hover-shadow: inset 0 0 0 2px rgba(74, 103, 255, 0.35);
--cw-chip-focus-shadow: 0 0 0 2px rgba(74, 103, 255, 0.2);
```

#### 3. Spacing & Layout
```css
--radius-default: 10px;
--cw-config-overlay-blur: 8px;
--cw-config-overlay-saturate: 140%;
```

#### 4. Gradient Tokens
```css
--cw-overlay-gradient-light: linear-gradient(135deg, rgba(2,6,23,0.25) 0%, rgba(2,6,23,0.15) 35%, rgba(2,6,23,0.06) 100%);
--cw-overlay-gradient-medium: linear-gradient(135deg, rgba(2,6,23,0.45) 0%, rgba(2,6,23,0.25) 35%, rgba(2,6,23,0.12) 100%);
--cw-overlay-gradient-dark: linear-gradient(135deg, rgba(2,6,23,0.60) 0%, rgba(2,6,23,0.40) 35%, rgba(2,6,23,0.20) 100%);
```

### Using Tokens

**Via Tailwind Classes:**
```tsx
<div className="bg-primary text-white border-info-border" />
```

**Via CSS Variables:**
```tsx
<div style={{ background: 'var(--cw-handle-bg)' }} />
```

**Runtime Customization (Debug Mode):**
```javascript
// Browser console when NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1
window.cwDebug.set({
  handleBg: '#3b82f6',
  ringOpacity: 0.5,
  wallStroke: '#10b981'
});
```

---

## 🧩 Component Library

### Component Principles

1. **Single Responsibility** - Each component does one thing well
2. **Composition Over Configuration** - Combine simple components
3. **Accessibility First** - ARIA attributes, keyboard navigation
4. **Type Safety** - Full TypeScript definitions
5. **Consistent API** - Similar props across components

### Components Reference

#### Banner (Inline Notifications)
```tsx
import { Banner } from '@/components/ui';

// Info variant
<Banner variant="info">
  Cache restored from offline storage
</Banner>

// Warning with dismiss
<Banner 
  variant="warning" 
  onDismiss={() => console.log('dismissed')}
>
  Configuration exceeds recommended dimensions
</Banner>

// Error with icon
<Banner variant="error" icon={<AlertIcon />}>
  Failed to load configuration
</Banner>

// Success
<Banner variant="success">
  Order placed successfully
</Banner>
```

**Props:**
- `variant`: `'info' | 'warning' | 'error' | 'success'`
- `children`: ReactNode (message content)
- `icon?`: ReactNode (optional icon element)
- `onDismiss?`: () => void (makes banner dismissible)
- `className?`: string (additional styles)

**Use Cases:**
- Cache restoration notices
- Configuration warnings
- Error messages
- Success confirmations

---

#### Toast (Overlay Messages)
```tsx
import { Toast } from '@/components/ui';

// Center toast
<Toast show={showMessage} position="center">
  Curtain width clamped to maximum fabric size
</Toast>

// Stacked toasts
<Toast show={!!clampNotice} position="center">
  {clampNotice?.message}
</Toast>
<Toast 
  show={!!stitchNotice} 
  position="center" 
  offsetY={64}  // Stack 64px below first toast
>
  {stitchNotice}
</Toast>

// Top position
<Toast show={uploading} position="top">
  Uploading image...
</Toast>
```

**Props:**
- `show?`: boolean (default: true)
- `position?`: `'top' | 'center' | 'bottom'`
- `offsetY?`: number (vertical offset for stacking)
- `children`: ReactNode (message content)
- `className?`: string (additional styles)

**Use Cases:**
- Temporary notifications
- Contextual messages over content
- Dimension clamp warnings
- Fabric stitch notifications

---

#### Button (Actions)
```tsx
import { Button } from '@/components/ui';

// Variants
<Button variant="primary">Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="tertiary">Learn More</Button>
<Button variant="ghost">Close</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium (default)</Button>
<Button size="lg">Large</Button>

// States
<Button disabled>Disabled</Button>
<Button loading>Loading...</Button>
```

**Props:**
- `variant`: `'primary' | 'secondary' | 'tertiary' | 'ghost'`
- `size`: `'sm' | 'md' | 'lg'`
- `loading?`: boolean
- `disabled?`: boolean
- `onClick?`: () => void
- `children`: ReactNode

---

#### Card (Containers)
```tsx
import { Card } from '@/components/ui';

<Card>
  <h3>Card Title</h3>
  <p>Card content goes here</p>
</Card>

// With hover effect
<Card variant="hover">
  Interactive card content
</Card>
```

---

#### Chip (Selection Tags)
```tsx
import { Chip } from '@/components/ui';

<Chip 
  selected={selectedColor === 'beige'}
  onClick={() => setColor('beige')}
>
  Beige
</Chip>
```

---

#### Dialog (Modals)
```tsx
import { Dialog } from '@/components/ui';

<Dialog
  open={showDialog}
  onClose={() => setShowDialog(false)}
  title="Confirm Action"
>
  <p>Are you sure you want to proceed?</p>
  <div className="flex gap-2 mt-4">
    <Button onClick={handleConfirm}>Confirm</Button>
    <Button variant="secondary" onClick={() => setShowDialog(false)}>
      Cancel
    </Button>
  </div>
</Dialog>
```

---

#### Input, Select, Progress, Spinner
See `apps/web/components/ui/*.tsx` for full API documentation.

---

## 🔧 Implementation Patterns

### 1. Component Extraction Pattern

**When to extract a component:**
- Repeated UI patterns (3+ uses)
- Self-contained functionality
- Testable in isolation
- Potential for reuse

**Example: SummaryPanel**
```tsx
// Before: Inline in page.tsx (200+ lines)
<div className="...">
  {/* Summary logic */}
</div>

// After: Extracted component
import { SummaryPanel } from './components/SummaryPanel';

<SummaryPanel
  config={config}
  quote={quote}
  onAddToCart={handleAddToCart}
/>
```

### 2. Conditional Rendering Pattern

```tsx
// Use show prop for Toast
<Toast show={!!message} position="center">
  {message}
</Toast>

// Use conditional && for Banner
{cacheNotice && (
  <Banner variant="info">{cacheNotice}</Banner>
)}

// Use ternary for variants
<Banner variant={isError ? 'error' : 'info'}>
  {message}
</Banner>
```

### 3. CSS Variable Override Pattern

```tsx
// Static styling via className
<div className="bg-primary text-white" />

// Dynamic styling via CSS variables
<div
  style={{
    background: 'var(--cw-handle-bg)',
    opacity: 'var(--cw-handle-opacity)'
  }}
/>

// Runtime override (debug mode)
useEffect(() => {
  if (DEBUG_MODE) {
    document.documentElement.style.setProperty(
      '--cw-handle-bg',
      customColor
    );
  }
}, [customColor]);
```

### 4. Token-First Styling

```tsx
// ❌ Avoid: Hard-coded values
<div className="bg-[#eff6ff] border-[#bfdbfe]" />

// ✅ Good: Use semantic tokens
<div className="bg-info-bg border-info-border" />

// ✅ Better: Use component with variant
<Banner variant="info">{message}</Banner>
```

---

## 🎨 Styling Guidelines

### Tailwind Utilities vs CSS Variables

**Use Tailwind for:**
- Static layout (padding, margin, gap)
- Typography (text size, weight, color)
- Borders and shadows (standard values)
- Responsive design (breakpoints)

**Use CSS Variables for:**
- Theme-able colors
- Runtime customization
- Complex gradients
- Debug handle styles

### Class Naming Conventions

```tsx
// Component-specific classes (if needed)
.summary-row { }       // Utility class in globals.css
.panel-heading { }     // Reusable pattern

// Avoid component-scoped CSS modules
// Use Tailwind classes instead

// Use cn() for conditional classes
import { cn } from '@/lib/utils';

<div className={cn(
  'base-class',
  isActive && 'active-class',
  variant === 'primary' && 'primary-class'
)} />
```

### Responsive Design

```tsx
// Mobile-first approach
<div className={cn(
  'flex-col gap-3',           // Mobile default
  'md:flex-row md:gap-5'      // Desktop override
)}>
```

---

## 🧪 Testing Strategy

### Component Testing (Future)

```tsx
// Example: Banner.test.tsx
import { render, screen } from '@testing-library/react';
import { Banner } from './Banner';

test('renders info variant correctly', () => {
  render(<Banner variant="info">Test message</Banner>);
  expect(screen.getByText('Test message')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveClass('bg-info-bg');
});

test('calls onDismiss when close button clicked', () => {
  const handleDismiss = jest.fn();
  render(
    <Banner variant="info" onDismiss={handleDismiss}>
      Test
    </Banner>
  );
  fireEvent.click(screen.getByLabelText('Dismiss'));
  expect(handleDismiss).toHaveBeenCalled();
});
```

### Integration Testing Checklist

- [ ] Upload → Segment → Preview flow
- [ ] Banner appears on cache restore
- [ ] Toasts stack correctly (clamp + stitch)
- [ ] Debug handles drag/resize
- [ ] Parent iframe messaging
- [ ] Add to cart workflow

### E2E Testing Scenarios

1. **Happy Path**
   - Upload image
   - Auto-segment
   - Configure curtain
   - Add to cart

2. **Error Handling**
   - Upload oversized image
   - Network failure during segment
   - Invalid configuration

3. **Accessibility**
   - Keyboard navigation
   - Screen reader announcements
   - Focus management

---

## 🚀 Deployment & Build

### Environment Variables

```bash
# Required
CATALOG_PROVIDER=mock|storefront
NEXT_PUBLIC_SEGMENT_URL=http://localhost:8001

# Optional Debug
NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1
NEXT_PUBLIC_MEASURE_ENGINE_DEBUG=1

# Storefront Integration
STOREFRONT_MAGENTO_URL=https://...
STOREFRONT_MAGENTO_TOKEN=...
STOREFRONT_MAGENTO_CART_ID=...
```

### Build Commands

```bash
# Development
npm run dev

# Production build
npm run build

# Type check
npm run type-check

# Lint
npm run lint
```

### Performance Optimizations

1. **CSS Bundle** - All styles load statically (no runtime injection)
2. **Component Code Splitting** - Lazy load heavy components
3. **Image Optimization** - Next.js automatic image optimization
4. **Server Components** - Use RSC where possible

---

## 📊 Migration Checklist

### ✅ Completed (Phase 1-4)

**Foundation**
- [x] Tailwind CSS + PostCSS installed
- [x] `globals.css` with comprehensive tokens
- [x] `cn()` utility helper
- [x] Base typography styles

**Component Library**
- [x] Banner component (4 variants)
- [x] Toast component (3 positions)
- [x] Button, Card, Chip, Dialog
- [x] Input, Progress, Select, Spinner
- [x] TypeScript types for all components
- [x] Accessible ARIA attributes

**Token System**
- [x] 40+ CSS variables defined
- [x] Semantic color palette
- [x] Debug handle tokens
- [x] Overlay/glass effects
- [x] Shadow scales

**Architecture**
- [x] ConfiguratorLayout extracted
- [x] SummaryPanel extracted
- [x] DebugControls extracted
- [x] FiltersPanel extracted
- [x] ServicesSection extracted
- [x] CoverageWarningDialog extracted

**Runtime Optimization**
- [x] Eliminated CSS injection
- [x] Keyframes in `globals.css`
- [x] Debug handle styles centralized
- [x] Runtime API preserved

**Refactoring**
- [x] Configure page uses Banner component
- [x] Configure page uses Toast component
- [x] Inline styles minimized to geometry-only

### 🔄 In Progress (Phase 5)

**Testing**
- [ ] E2E test suite
- [ ] Component unit tests
- [ ] Integration tests
- [ ] Accessibility audit

**Documentation**
- [ ] RUNBOOK.md update (debug API)
- [ ] Component Storybook (optional)
- [ ] Usage examples

### ⏳ Future Enhancements

**Optional Components**
- [ ] EmptyState component
- [ ] RadioGroup/SegmentedControl
- [ ] ListGroup component
- [ ] Badge/Pill component

**Advanced Features**
- [ ] Dark mode support
- [ ] Theme customization UI
- [ ] Animation system
- [ ] Micro-interactions

---

## 🎓 Onboarding Guide for New Developers

### Day 1: Setup & Orientation

1. **Clone and Install**
   ```bash
   git clone <repo>
   cd apps/web
   npm install
   ```

2. **Read Core Documentation**
   - This master document (you're here!)
   - `docs/RUNBOOK.md` - Local development guide
   - `README.md` - Project overview

3. **Run Locally**
   ```bash
   npm run dev
   # Visit http://localhost:3000
   ```

4. **Explore Component Library**
   - Check `apps/web/components/ui/`
   - Review `globals.css` for tokens
   - Test Banner and Toast components

### Day 2: First Contribution

1. **Pick a Component**
   - Start with Banner or Toast
   - Review implementation
   - Understand props and usage

2. **Make a Small Change**
   - Add a test
   - Update documentation
   - Submit PR

### Week 1: Deep Dive

1. **Configure Page Architecture**
   - Understand component extraction
   - Review hook patterns
   - Study state management

2. **Token System**
   - Learn CSS variable usage
   - Experiment with runtime API
   - Try customizing debug handles

3. **Build a Feature**
   - Implement EmptyState component
   - Or add RadioGroup component
   - Follow established patterns

---

## 🎨 Design System for UI/UX Designers

### Design Tokens

All tokens are documented in `globals.css`. Use these values in your designs:

**Primary Blue:** `#4a67ff`  
**Semantic Colors:** See Token section above  
**Shadows:** Documented in Token section  
**Border Radius:** `10px` default  
**Spacing:** Follow Tailwind scale (4, 8, 12, 16, 24, 32...)

### Component States

**Interactive Elements:**
- Default state
- Hover state (use `hover:` Tailwind classes)
- Focus state (ring with `--cw-ring-*` tokens)
- Disabled state (opacity 0.5, cursor not-allowed)
- Loading state (spinner + disabled)

**Notifications:**
- Banner: Persistent, dismissible
- Toast: Temporary, auto-dismissible
- Use semantic variants consistently

### Figma Integration (Future)

Consider creating:
1. Component library in Figma
2. Token plugin for syncing values
3. Design specs with token references

---

## 🔒 Best Practices

### Do's ✅

- **Use shared components** from `@/components/ui`
- **Use semantic tokens** (info, warning, error, success)
- **Extract repeated patterns** into components
- **Type everything** with TypeScript
- **Add ARIA attributes** for accessibility
- **Test on mobile** and desktop
- **Document component APIs** with JSDoc
- **Use `cn()` helper** for conditional classes

### Don'ts ❌

- **Don't hard-code colors** - use tokens
- **Don't inject styles** at runtime (use `globals.css`)
- **Don't duplicate component logic** - extract to shared
- **Don't ignore TypeScript errors** - fix them
- **Don't skip accessibility** - it's required
- **Don't commit without testing** - verify locally
- **Don't create inline styles** unless geometry-driven
- **Don't skip documentation** for new components

---

## 📞 Support & Resources

### Documentation
- **This Document:** Single source of truth
- **RUNBOOK.md:** Local development setup
- **UI-KIT-EXPANSION.md:** Component details
- **RUNTIME-INJECTION-ELIMINATION.md:** Architecture changes

### Code References
- **Component Examples:** `apps/web/components/ui/*.tsx`
- **Token Definitions:** `apps/web/app/globals.css`
- **Tailwind Config:** `apps/web/tailwind.config.ts`
- **Type Definitions:** `packages/core/src/catalog/types.ts`

### External Resources
- [Tailwind CSS Docs](https://tailwindcss.com)
- [Next.js App Router](https://nextjs.org/docs/app)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app)

---

## 🗺️ Roadmap

### Short Term (Next Sprint)
1. Complete E2E testing suite
2. Accessibility audit and fixes
3. Update RUNBOOK.md with debug API
4. Performance benchmarks

### Medium Term (Next Quarter)
1. EmptyState component
2. RadioGroup component
3. Dark mode support
4. Comprehensive Storybook

### Long Term (Future)
1. Design system documentation site
2. Component playground
3. Theme builder UI
4. Animation library

---

## 📈 Success Metrics

### Technical Metrics
- ✅ **0 Runtime CSS Injections** (achieved)
- ✅ **10 Production Components** (achieved)
- ✅ **42+ Design Tokens** (achieved - added frosted overlay utilities)
- 🎯 **100% Test Coverage** (target)
- 🎯 **WCAG AA Compliance** (target)
- 🎯 **<3s Page Load** (target)

### Developer Experience Metrics
- ⏱️ **Time to add new component:** <1 hour
- 🐛 **Bugs related to styling:** Near zero
- 📖 **Onboarding time:** <1 week
- 🔄 **PR review time:** <1 day

---

## 🎉 Conclusion

The Curtain Wizard UI/UX overhaul has successfully established a **modern, maintainable, and scalable** foundation. With 75% completion, the core architecture is production-ready, featuring:

- **Zero runtime CSS injection** for optimal performance
- **10 production-ready components** with consistent APIs
- **Comprehensive token system** for easy theming
- **Clean architecture** with clear separation of concerns
- **Type-safe** implementation throughout

The remaining 25% consists primarily of testing and optional enhancements that can be completed incrementally.

**This project is ready to ship.** 🚀

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | Nov 7, 2025 | Added frosted overlay utilities documentation |
| 1.0 | Oct 18, 2025 | Initial master documentation |

---

**For questions or clarifications, refer to the code directly or consult the detailed documentation in `docs/` folder.**

**Happy coding!** 💙
