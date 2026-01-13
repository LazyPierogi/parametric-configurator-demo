# Palette System - Testing Guide

**Created:** October 23, 2025  
**Status:** Ready to Test 🧪

---

## 🚀 Quick Start

### 1. Start the Development Server

```bash
cd apps/web
npm run dev
```

### 2. Enable Debug UI

Make sure your `.env.local` has:

```bash
NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1
```

### 3. Navigate to Configure Page

1. Go to `http://localhost:3000`
2. Upload a photo (or use cached one)
3. Navigate to `/configure` page

### 4. Open Debug Controls

Click **"Show Debug"** button in the debug panel at the bottom of the page.

---

## 🎨 Testing the Palette Switcher

### Location
The palette switcher is in the **Debug Controls** panel under **"🎨 Color Palette"** section.

### Available Palettes

1. **Signature (Standalone)** - Default
   - Frost White background (#FAFAFB)
   - Sage & Lilac accents
   - Premium liquid glass feel

2. **Havinic (Storefront)**
   - Linen White background (#F9F8F6)
   - Honey Oak & Soft Taupe accents
   - Warm, tactile feel

3. **Hybrid (Transition)**
   - Blend of both palettes
   - Used during checkout handoff

---

## ✅ Test Checklist

### Basic Functionality
- [ ] Palette dropdown shows all 3 options
- [ ] Selecting a palette triggers smooth 300ms transition
- [ ] "Transitioning palette..." message appears during transition
- [ ] Palette persists after page reload (localStorage)

### Visual Changes to Verify

**When switching to Havinic:**
- [ ] Background shifts from #FAFAFB → #F9F8F6 (subtle warmer tone)
- [ ] Accent colors change from Sage/Lilac → Honey Oak/Taupe
- [ ] Text colors adjust slightly (Graphite vs Deep Ink)

**When switching to Signature:**
- [ ] Background shifts to cooler Frost White
- [ ] Sage & Lilac accents appear
- [ ] Overall feel becomes more "premium glass"

**When switching to Hybrid:**
- [ ] Mix of both palettes visible
- [ ] Smooth blend effect

### Components to Check

Test these UI elements after switching palettes:

- [ ] **Buttons** - Should use active accent colors
- [ ] **Text** - Primary and secondary text colors update
- [ ] **Borders** - Border colors adjust
- [ ] **Panels** - Background colors transition smoothly
- [ ] **Debug handles** - Should remain functional

---

## 🐛 Known Issues / Expected Behavior

### Expected
- ✅ 300ms smooth transition between palettes
- ✅ Dropdown disabled during transition
- ✅ localStorage saves preference
- ✅ All components adapt automatically (if using `active-*` tokens)

### Not Yet Implemented
- ⏳ Some components still use hard-coded colors (will update in T1.1.7)
- ⏳ Icon library not yet installed (T1.2.3)

---

## 🔍 Debugging Tips

### Check Active Palette in Console

```javascript
// Open browser console
document.documentElement.getAttribute('data-palette')
// Should return: 'signature', 'havinic', or 'hybrid'
```

### Inspect CSS Variables

```javascript
// Check active palette tokens
getComputedStyle(document.documentElement).getPropertyValue('--active-bg-base')
getComputedStyle(document.documentElement).getPropertyValue('--active-accent-primary')
```

### Check localStorage

```javascript
// View saved palette preference
localStorage.getItem('cw-palette-preference')
```

### Force Palette Reset

```javascript
// Clear saved preference
localStorage.removeItem('cw-palette-preference')
// Reload page
location.reload()
```

---

## 📸 What to Look For

### Signature Palette (Default)
- **Background:** Very light gray with cool undertone
- **Accents:** Soft sage green + delicate lilac
- **Feel:** Modern, minimal, premium

### Havinic Palette
- **Background:** Slightly warmer off-white (linen)
- **Accents:** Warm honey oak + soft taupe
- **Feel:** Tactile, natural, cozy

### Transition Quality
- **Smoothness:** Should feel like a gentle cross-fade
- **Duration:** 300ms (not too fast, not too slow)
- **No flicker:** No harsh jumps or flashes

---

## 🎯 Success Criteria

✅ **Pass if:**
- Dropdown works and shows all 3 palettes
- Transitions are smooth (no jarring jumps)
- Colors visibly change when switching
- Preference persists after reload
- No console errors

❌ **Fail if:**
- Dropdown doesn't work or is missing
- Transitions are instant/jarring
- Colors don't change
- Console shows errors
- Page crashes

---

## 📝 Reporting Issues

If you find issues, note:

1. **What palette were you switching from/to?**
2. **What happened vs. what you expected?**
3. **Any console errors?**
4. **Can you reproduce it consistently?**

---

## 🚀 Next Steps After Testing

Once palette system is validated:

1. **T1.1.7** - Update existing components to use `active-*` tokens
2. **T1.2.3** - Install Lucide React for icons
3. **T1.2.4** - Create Icon wrapper component
4. Continue with Phase 2 (Core Components)

---

**Happy Testing!** 🎨✨

*Last Updated: October 23, 2025*
