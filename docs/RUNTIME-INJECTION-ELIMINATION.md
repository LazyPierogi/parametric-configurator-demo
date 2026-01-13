# Runtime CSS Injection Elimination

**Date:** October 18, 2025  
**Status:** ✅ Completed  
**Migration Step:** Step 3 - Centralise Dynamic Styling

---

## Summary

Successfully eliminated all runtime CSS injection (`document.createElement('style')`) from the Configure page. All keyframes and debug handle styles now load statically from `globals.css`, improving performance and maintainability.

## What Changed

### Before
```typescript
// Configure page had 2 useEffect hooks injecting <style> tags:

// Hook 1: Inject keyframes
useEffect(() => {
  const s = document.createElement('style');
  s.textContent = `@keyframes cwspin { ... } @keyframes cwbar { ... }`;
  document.head.appendChild(s);
}, []);

// Hook 2: Inject debug handle styles
useEffect(() => {
  const s = document.createElement('style');
  s.textContent = `
    :root { --cw-handle-bg: #e5e7eb; ... }
    .cw-handle { background: var(--cw-handle-bg); ... }
    .cw-handle:hover { ... }
    ...
  `;
  document.head.appendChild(s);
}, []);
```

### After
```css
/* apps/web/app/globals.css */

:root {
  /* Debug handle CSS variables */
  --cw-handle-bg: #e5e7eb;
  --cw-handle-opacity: 1;
  --cw-wall-stroke: #e5e7eb;
  --cw-wall-stroke-opacity: 1;
}

@keyframes cwspin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes cwbar {
  0% { transform: translateX(-60%); }
  50% { transform: translateX(-10%); }
  100% { transform: translateX(120%); }
}

.cw-handle {
  background: var(--cw-handle-bg);
  border: 1px solid var(--cw-handle-border);
  box-shadow: var(--cw-debug-handle-shadow);
  opacity: var(--cw-handle-opacity, 1);
  transition: box-shadow 120ms ease, transform 120ms ease;
}

.cw-handle:hover {
  box-shadow: 0 0 0 3px rgba(var(--cw-ring-rgb), var(--cw-ring-opacity)),
              var(--cw-debug-handle-shadow);
}

.cw-handle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(var(--cw-ring-rgb), var(--cw-ring-opacity)),
              var(--cw-debug-handle-shadow);
}

.cw-handle--grab { cursor: grab; }
.cw-handle--move { cursor: move; }
.cw-handle--ew { cursor: ew-resize; }
```

## Files Changed

1. **`apps/web/app/globals.css`**
   - Added CSS variables for debug handles (lines 39-43)
   - Added `@keyframes cwspin` and `cwbar` (lines 169-188)
   - Added `.cw-handle` class styles (lines 204-232)

2. **`apps/web/app/configure/page.tsx`**
   - Removed 2 runtime style injection useEffect hooks (~60 lines)
   - Kept minimal runtime API for CSS variable overrides (lines 1525-1550)

3. **`docs/CONFIGURE-MIGRATION-GUIDE.md`**
   - Updated Current Snapshot (runtime injections eliminated)
   - Marked Step C as completed
   - Updated checklist (debug handle styles ✅)
   - Added Runtime Debug API documentation

4. **`docs/MIGRATION-STATUS.md`**
   - Updated Current Snapshot
   - Marked Step 3 as completed

## Runtime Debug API (Preserved)

The debug variable override API is still available when `NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1`:

```javascript
// In browser console:
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

This allows live customization during development without rebuilding.

## Benefits

### Performance
- ✅ **Faster page load**: Styles load once with CSS bundle instead of client-side injection
- ✅ **No FOUC risk**: Styles available immediately, no flash of unstyled handles
- ✅ **Reduced JavaScript**: ~60 lines of runtime code removed

### Maintainability
- ✅ **Single source of truth**: All styles in `globals.css`, easier to find and modify
- ✅ **Better caching**: CSS bundled with other static assets
- ✅ **Easier debugging**: Inspect styles in DevTools without generated `<style>` tags
- ✅ **Version control friendly**: Changes tracked in git diffs

### Developer Experience
- ✅ **Hot reload works**: Changes to `globals.css` hot-reload during development
- ✅ **Type safety**: CSS variables documented in one place
- ✅ **Runtime API preserved**: Still allows live customization when needed

## Testing Checklist

- [ ] Upload image → configure curtain
- [ ] Verify debug handles render correctly (grey background, hover effects)
- [ ] Test handle dragging (grab cursor, focus rings)
- [ ] Verify keyframe animations work (`cwspin`, `cwbar`)
- [ ] Test debug API: `window.cwDebug.set({ handleBg: '#ff0000' })`
- [ ] Check mobile responsiveness
- [ ] Verify no console errors related to styles

## CSS Variables Reference

All debug handle CSS variables defined in `globals.css`:

| Variable | Default | Description |
|----------|---------|-------------|
| `--cw-handle-bg` | `#e5e7eb` | Handle background color |
| `--cw-handle-border` | `rgba(0,0,0,0.15)` | Handle border color |
| `--cw-handle-opacity` | `1` | Handle opacity (0-1) |
| `--cw-ring-rgb` | `74, 103, 255` | Focus ring RGB values |
| `--cw-ring-opacity` | `0.35` | Focus ring opacity (0-1) |
| `--cw-wall-stroke` | `#e5e7eb` | Wall box outline color |
| `--cw-wall-stroke-opacity` | `1` | Wall outline opacity (0-1) |
| `--cw-debug-handle-shadow` | `0 1px 2px rgba(0,0,0,0.25)` | Handle shadow |

## Next Steps

1. **RUNBOOK update** - Document the debug API usage for developers
2. **Testing** - Complete the testing checklist above
3. **Step 4** - Expand UI Kit (promote recurring patterns to shared components)

## Related Documentation

- `docs/CONFIGURE-MIGRATION-GUIDE.md` - Full migration guide
- `docs/MIGRATION-STATUS.md` - Overall migration status
- `apps/web/app/globals.css` - Styles source of truth
- `apps/web/app/configure/page.tsx` - Configure page implementation

---

**Migration Step 3 Status:** ✅ COMPLETED  
**Next Priority:** Step 4 - Expand UI Kit
