# Curtain Wizard — 04_Components_and_Interactions.md  
*(UI/UX Guidelines – Section 4)*  

---

## TL;DR  
Every element in Curtain Wizard should feel **alive but calm** — touch-responsive, effortless, and visually consistent across both palettes.  
We build interactions that feel like *brushing soft fabric*: smooth, precise, and always under control.

---

## 1. Design Philosophy for Components  

| Principle | Description |
|------------|-------------|
| **Tactile Feedback** | Every action gives a small, visual or motion cue — a pulse, shimmer, or ripple — to confirm touch. |
| **Simplicity** | Fewer visible controls = clearer flow. The user should never wonder “what next?” |
| **Continuity** | Panels and buttons share one motion language — same easing, same blur depth, same feedback speed. |
| **Emotion through Subtlety** | Small changes in light and motion create trust. Avoid bright color pops or “gaming” effects. |

💡 *Design Intent Note:*  
A button doesn’t just *change color*; it *feels pressed* — like touching a soft, responsive surface.

---

## 2. Buttons  

### Primary Button  
- **Use:** main action of each screen (e.g. “Upload Photo”, “Continue”, “Add to Cart”).  
- **Shape:** rounded 16px radius, full-width on mobile.  
- **Height:** 56px (mobile), 60px (desktop).  
- **Typography:** SF Pro Text, 500 weight, 16px.  
- **States:**

| State | Style |
|--------|--------|
| Default | “Morning Light” gradient (Sage → Lilac), white text |
| Hover/Press | Slight darken of gradient + 2% scale down |
| Disabled | Frost white bg `rgba(255,255,255,0.3)` + gray text |
| Loading | Gradient background → animated shimmer line (1500 ms loop) |

### Secondary Button  
- Transparent or glass outline, accent-colored text.  
- Use for secondary actions (e.g. “Back”, “See details”).  
- Press = accent fill + white text (brief pulse).  

### Ghost / Floating Button  
- Circular (56×56px), glass surface, drop shadow (2 px × 6 px × 0.08).  
- Used for actions like “Add”, “Info”, “Help”.  
- Hover → glow ring (accent color at 30% opacity).

---

## 3. Chips & Toggles  

Used for filters (fabric type, pleat style, hem length, etc.).

- **Shape:** pill, 12px padding, 32–40px height.  
- **Default:** glass surface, accent text.  
- **Active:** filled accent (Sage or Honey Oak) + white text.  
- **Hover:** subtle gradient ring.  
- **Group Behavior:** horizontal scroll with snap alignment.  

💡 *Behavior Tip:*  
If more than one chip can be active, animate their activation with a short ripple from center (80 ms ease-out).

---

## 4. Carousels (Fabric Selector Core)  

The carousel is the *visual centerpiece* of Stage 4 — it drives exploration and delight.

### Shared Rules  
- **Snap scroll** with 16px gap.  
- **Center-focused magnification:** active item +8 % scale.  
- **Soft shadow (0 2 8 rgba(0,0,0,0.08))** for depth.  
- **Progress indicator bar** (2px accent gradient) below carousel when more than one row.  

---

### Variant A — Minimal Carousel (Primary Default)  
**Use:** quick selection from ~20 fabrics.  

| Element | Spec |
|----------|------|
| Swatch size | 72×72px (mobile), 96×96 (desktop) |
| Label | 14px, truncated after 12 chars |
| Info icon | top-right corner (16px) |
| Tap | select with glow ring + soft “press” scale-in |
| Long-press | opens detailed modal |

💡 *Design Intent:*  
Feels like browsing color tiles in a daylight showroom.

---

### Variant B — Expandable Grid  
**Use:** when more filtering is needed or the user explores deeply.  
- Grid: 2 columns (mobile), 3–4 columns (tablet/desktop).  
- Tap expands to reveal second line (pleats, pattern tags).  
- Use progressive disclosure animation (height morph 240 ms).  
- Scrollable within panel; CTA sticky at bottom.  

---

### Variant C — Progressive Modal Picker  
**Use:** full-screen “fabric detail” mode.  
- Opens from carousel tap → slides up.  
- Top half: high-res photo gallery (swipeable).  
- Bottom half: fabric info (care, specs, matching products).  
- CTA: “Use This Fabric” → slides modal down smoothly into configurator.  

💡 *Visual cue:*  
Modal inherits the accent color from selected fabric (subtle gradient tint on top bar).

---

## 5. Cards  

### Summary Card  
- **Used in:** Stage 6 summary.  
- **Content:** thumbnail, fabric name, SKU, pleat type, price.  
- **Structure:** glass panel with 12px padding, 8px corner radius.  
- **Visual cues:** small divider line (1px Mist Gray / 0.2 opacity).  
- **Motion:** appear with fade-up 150 ms staggered.  

### Add-On Card  
- Icon + title + price, tap to toggle.  
- Selected state = accent background + checkmark appear animation.  
- Ripple animation: expanding soft glow, 120 ms ease-out.  

---

## 6. Modals  

| Type | Description |
|------|--------------|
| **Info Modal** | Fabric details or instructions. 75 % height, glass background, scrollable. |
| **Confirmation Modal** | For measurement confirmation or retry. Compact (50 % height). |
| **Error Modal** | Solid background (Blush Red @ 5 % opacity overlay), concise message + “Try Again” button. |
| **Checkout Modal** | Full-height, no translucency, leads into Storefront. |

### Motion  
Slide Up / Down 200 ms ease-out.  
Blur-in background overlay 150 ms ease-in.  
Closing → reverse order (opacity → position).

---

## 7. Sliders & Numeric Inputs  

**Use:** measurement adjustments, brightness, pattern scale.

- **Track:** 2px line, accent gradient fill.  
- **Thumb:** 20px circle, glass blur + subtle shadow.  
- **Feedback:** value bubble appears above thumb while dragging (fade in 100 ms).  
- **Motion physics:** easing cubic(0.3, 0.8, 0.5, 1).  

Numeric inputs (width/height cm):
- Rounded input field (48px height), centered text, spinner arrows fade in on focus.  

---

## 8. States & Feedback  

| State | Visual | Motion |
|--------|---------|---------|
| **Loading** | shimmer line, 30 % accent tint | continuous, 1.5 s loop |
| **Success** | soft scale-up, accent glow pulse | 200 ms ease-out |
| **Error** | micro-shake (5 px left–right), red underline | 300 ms cubic |
| **Disabled** | reduced opacity 0.4, no shadow | none |
| **Hover/Focus** | 2 % scale-in + highlight border | 100 ms ease-out |

Animations must feel **instant but organic** — like cloth settling, not mechanical movement.

---

## 9. Microinteractions  

### Upload Step  
- Tap → button shimmer + icon pulse.  
- When AI detects photo → progress circle around icon fills clockwise (2 s).  
- Completion → ripple pulse in accent gradient.  

### Measurement Confirmation  
- Crosshair points fade in one by one (stagger 150 ms).  
- When confirmed → checkmark morphs from last crosshair.  

### Configurator Filters  
- When user selects incompatible combination → chips wiggle subtly, tooltip: “Try a compatible fabric.”  
- Compatible alternatives slide in below (chip row 2).  

### Checkout Hand-Off  
- “Finalize Purchase” button glows once before transition.  
- Screen fades from Signature palette to Havinic Harmony in 300 ms cross-fade.  

---

## 10. Interaction Sound & Haptic (optional future layer)  

- **Soft tap tone** (sub-60 Hz) for major confirmations.  
- **Tiny haptic pulse** when AI completes processing.  
- No background sounds or music.  
→ These cues exist to reassure, not entertain.  

---

## 11. Consistency Rules  

| Component | Color Source | Motion Timing | Shadow Level |
|------------|---------------|----------------|---------------|
| Buttons | Accent / CTA Gradient | 150–200 ms | L1 |
| Chips | Accent Primary | 80–120 ms | None |
| Panels | Glass Surface | 200–300 ms | L2 |
| Modals | Solid White / Blur | 200 ms | L3 |

Maintain one motion rhythm per screen. No element should outshine the curtain preview.

---

## 12. Emotional Mapping (Components ↔ Feeling)  

| Component | Emotion | Feedback Type |
|------------|----------|---------------|
| Carousel | Curiosity | Scroll, glide |
| Button | Confidence | Press, pulse |
| Card | Clarity | Pop-in, shadow |
| Modal | Focus | Slide, fade |
| Slider | Control | Smooth drag |

---

**Next section:**  
👉 [05_Motion_and_Transitions.md](05_Motion_and_Transitions.md)