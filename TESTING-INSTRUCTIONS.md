# 🧪 Testing Instructions - Palette System

**Feature:** Dual Palette System (Havinic Harmony + CW Signature)  
**Status:** ✅ Fixed & Ready to Re-Test  
**Date:** October 23, 2025 (Updated 11:45pm)

## 🔧 What Was Fixed & Updated

**Issue #1:** Visual changes not visible ✅ **FIXED & FULLY ENHANCED**
- ✅ Button component uses `active-*` tokens (all variants adapt)
- ✅ Body background uses `active-bg-base` (smooth transitions)
- ✅ Typography colors use `active-text-*` tokens (headings + paragraphs)
- ✅ Input component uses `active-*` tokens (background, border, focus states)
- ✅ Select component uses `active-*` tokens (dropdowns adapt)
- ✅ Card component uses `active-*` tokens (fabric cards, all cards transition)
- ✅ **NEW:** Chip component uses `active-*` tokens (filter chips like "All Styles", "Light", etc.)
- ✅ **NEW:** RangeSlider uses `active-*` tokens (segment slider bar + handles)
- ✅ Debug panels use `active-*` tokens (Configure page debug UI)
- ✅ Estimate page modals/panels use `active-*` tokens
- ✅ Version badge uses `active-*` tokens

**Issue #2:** Palette switcher missing on some pages ✅ **FIXED**
- Created `GlobalPaletteDebug` component
- Now appears on ALL pages: `/estimate`, `/configure` (all stages)
- Bottom-left corner, collapsible design

---

## 🚀 How to Test

### Step 1: Start the Server

```bash
cd /Users/mario/Repo/Curtain\ Wizard
npm run dev
```

### Step 2: Verify Debug UI is Enabled

Check your `.env.local` file has:

```bash
NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1
```

### Step 3: Look for Global Palette Switcher

**NEW:** The palette switcher now appears on **ALL pages** in the **bottom-left corner** when debug UI is enabled.

- Small collapsible widget with 🎨 icon
- Click to expand and see palette dropdown
- Works on `/estimate`, `/configure`, and all stages

### Step 4: Test Palette Switching

**Dropdown options:**
- **Signature** - Default, cool tones
- **Havinic** - Warm tones
- **Hybrid** - Blend mode

**Try switching between palettes and observe:**
- ✅ **Background color changes** (white → warm linen for Havinic)
- ✅ **Button colors change** (Sage/Lilac → Honey Oak)
- ✅ **Text colors shift** slightly
- ✅ Smooth 300ms transition
- ✅ "Transitioning..." message appears while switching
- ✅ Preference persists after page reload

---

## 🎨 What You Should See

### Signature Palette (Default)
- **Background:** Cool frost white (#FAFAFB)
- **Accents:** Sage green + Lilac purple
- **Feel:** Modern, premium, minimal

### Havinic Palette
- **Background:** Warm linen white (#F9F8F6)
- **Accents:** Honey oak + Soft taupe
- **Feel:** Tactile, cozy, natural

### Hybrid Palette
- **Mix of both palettes**
- Used for checkout transitions

---

## ✅ Success Criteria

**The palette system works if:**

1. ✅ Dropdown shows all 3 palette options
2. ✅ Selecting a palette triggers smooth color transition
3. ✅ Colors visibly change (background, accents, text)
4. ✅ Transition takes ~300ms (not instant, not slow)
5. ✅ Selected palette persists after page reload
6. ✅ No console errors
7. ✅ Dropdown is disabled during transition

---

## 🐛 If Something Breaks

**Check:**
1. Browser console for errors
2. Is `PaletteProvider` in `layout.tsx`?
3. Is debug UI enabled in `.env.local`?
4. Try clearing localStorage: `localStorage.clear()` in console

**Report:**
- What palette were you switching to?
- What happened vs. what you expected?
- Any console errors?
- Screenshot if possible

---

## 📚 Documentation

- **Full Guide:** `docs/PALETTE-SYSTEM-GUIDE.md`
- **Testing Details:** `docs/PALETTE-TESTING-GUIDE.md`
- **Task List:** `docs/UI-UX_Overhaul_TaskList.md`

---

## 🎯 What's Next

After validating the palette system:

1. Update existing components to use `active-*` tokens
2. Install Lucide React for icons
3. Continue with Phase 2 (Core Components)

---

**Ready to test!** 🚀

Let me know if you see any issues or if everything works smoothly!
