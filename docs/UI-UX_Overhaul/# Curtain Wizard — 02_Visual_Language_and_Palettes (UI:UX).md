# Curtain Wizard — 02_Visual_Language_and_Palettes.md  
*(UI/UX Guidelines – Section 2)*  

---

## TL;DR  
Curtain Wizard’s visual language blends **calm sophistication with human warmth**.  
Two style systems guide our identity:  

1. **Havinic Harmony** – complements the WebFlow storefront’s aesthetic: soft neutrals, tactile whites, and gentle contrast.  
2. **Curtain Wizard Signature** – our elevated “liquid glass” look: crisp translucency, lilac-sage highlights, subtle gradients of light and air.  

Both are interchangeable at component level; the app should be skinnable via theme tokens.  

---

## 1. Visual Identity Principles  

- **Light = Trust.** Use brightness and diffusion to create calm and confidence.  
- **Color = Emotion.** Accent hues should invite, not distract.  
- **Texture = Tactility.** Gradients, blurs, and transparency create the feeling of glass surfaces and fabric depth.  
- **Consistency = Comfort.** Every control feels part of one family, even when states change dynamically.  

💡 *Design Intent Note:* The UI should never compete with the user’s photo — our role is to frame it beautifully, like a transparent display case.  

---

## 2. Palette A — *Havinic Harmony*  

**Purpose:** Seamlessly integrate with the storefront’s existing WebFlow visuals (Havinic template).  
**Mood:** Clean, tactile, slightly warm, subtly textured.  

| Color Role | Name | HEX | Notes |
|-------------|------|------|-------|
| Background Base | Linen White | `#F9F8F6` | Gentle off-white for calm contrast. |
| Text Primary | Graphite | `#2E2E2E` | Deep gray, never harsh black. |
| Text Secondary | Warm Slate | `#6B6B6B` | Softer for body text and hints. |
| Accent Primary | Honey Oak | `#D6A354` | Matches Havinic’s warm tone. Used for CTA highlights. |
| Accent Secondary | Soft Taupe | `#BFA68A` | Complementary for hover/focus states. |
| Borders & Dividers | Mist Gray | `#E1E1E1` | Minimal, used only when separation is required. |
| Success | Forest Tint | `#5BAA7E` | Calm green; matches natural material vibe. |
| Error | Clay Red | `#C96557` | Muted, natural error tone. |

Use shadows sparingly — prefer **elevation via light** (top gradients, blurs, transparency).

---

## 3. Palette B — *Curtain Wizard Signature*  

**Purpose:** Our own identity — more emotional, modern, and “liquid.”  
**Mood:** Minimal, airy, premium; inspired by *glass, fabric, and daylight.*  

| Color Role | Name | HEX | Notes |
|-------------|------|------|-------|
| Background Base | Frost White | `#FAFAFB` | Frosted surface; perfect for glass overlay. |
| Glass Surface | Translucent Ice | `rgba(255,255,255,0.55)` | Base of the “liquid glass” panels. |
| Glass Blur | Blur radius | 18–24px | Standard blur across panels & drawers. |
| Text Primary | Deep Ink | `#1E1E1F` | Balanced contrast on bright layers. |
| Text Secondary | Cloud Gray | `#7A7A7A` | Subdued for descriptions. |
| Accent Primary | Sage Mist | `#A8C3A1` | Calm, botanical tone (buttons, sliders). |
| Accent Secondary | Lily Lilac | `#D9C2F0` | Adds a delicate premium note for highlights. |
| CTA Gradient | “Morning Light” | `linear-gradient(135deg, #A8C3A1 0%, #D9C2F0 100%)` | Used for main CTAs or confirm moments. |
| Error | Blush Red | `#E57373` | Light, friendly warning color. |
| Success | Dew Green | `#8FD3B2` | Positive but unobtrusive. |

💡 *Design Intent Note:*  
This palette supports **dark overlay text** on glass surfaces and **light text** on accent buttons. Always check legibility at 70% opacity backgrounds.

---

## 4. Typography  

### Type Family
**Primary Typeface:** *SF Pro Display / SF Pro Text* (or Inter for web parity).  
→ clean, modern, neutral — perfect match for Apple-like feel.  

| Usage | Font | Weight | Size (mobile) | Line Height |
|--------|------|---------|----------------|-------------|
| Title / Header | SF Pro Display | 600 | 22–26 px | 130% |
| Section Head | SF Pro Text | 500 | 18–20 px | 135% |
| Body | SF Pro Text | 400 | 15–16 px | 150% |
| Labels / Buttons | SF Pro Text | 500 | 14 px | 140% |
| Caption / Hints | SF Pro Text | 400 | 13 px | 140% |

### Typography Guidelines
- Titles breathe — never wrap tightly.  
- Buttons use **Title Case**, not ALL CAPS.  
- Numeric values (measurements, prices) use **tabular figures** for alignment.  
- Always maintain clear hierarchy: title → subtitle → content → hint.  

---

## 5. Iconography & Imagery  

### Icon Style
- Simple line icons (2px stroke, rounded caps).  
- Consistent optical size (24×24px on mobile).  
- Fill only for emphasis (e.g., “add to cart” confirmed).  

### Image Treatment
- User’s photo remains unfiltered, true-to-life.  
- Rendered curtain overlays subtly match scene lighting.  
- When showing thumbnails (e.g., fabric swatches), use soft-shadow 4px radius and rounded 8px corners.  

---

## 6. Overlays & Transparency  

### Layering System  

| Layer | Use | Opacity / Blur | Z-Index Range |
|-------|------|----------------|----------------|
| 0 | User photo | 100% visible | 0 |
| 1 | Curtain render | 100% | 10 |
| 2 | Wall mask overlay | 0.9–0.95 | 20 |
| 3 | UI panels / drawers | `rgba(255,255,255,0.55)` + blur(20px) | 30–40 |
| 4 | Modals / alerts | solid white 90% + stronger blur | 50+ |

Visual transitions (between layers 2→3) use fade/scale with 200–300ms easing.  

---

## 7. Shadows, Depth & Elevation  

Keep elevation **subtle and physical** — like sunlight filtering through sheer fabric.  

| Element | Shadow / Elevation |
|----------|--------------------|
| Floating buttons | 0 2px 6px rgba(0,0,0,0.10) |
| Panels / cards | 0 1px 4px rgba(0,0,0,0.08) |
| Modals | 0 8px 24px rgba(0,0,0,0.12) |
| No inner shadows — ever. Only outer diffused light. |

---

## 8. Brand Personality Through Visuals  

| Trait | Visual Translation |
|--------|--------------------|
| **Professional** | clean type, even spacing, neutral whites |
| **Friendly** | rounded corners (12–16px), warm motion |
| **Playful** | accent gradients, soft transitions |
| **Premium** | refined light, balanced contrast, gentle glass effects |

---

## 9. Palette Application Examples  

| Context | Primary Palette | Notes |
|----------|------------------|-------|
| Integrated in storefront (iframe child) | **Havinic Harmony** | Feels native inside Havinic environment. |
| Stand-alone Curtain Wizard app | **Curtain Wizard Signature** | Our full identity mode. |
| Checkout / summary | **Hybrid Mode** | Start with Signature, fade to Harmony for Storefront hand-off. |

---

## 10. The “Light Through Fabric” Rule  

Whenever in doubt, imagine how **sunlight diffuses through sheer curtains**:  
soft, natural gradients, nothing harsh, nothing flat.  
That’s Curtain Wizard’s light logic.  

---

**Next section:**  
👉 [03_Layout_and_Grid.md](03_Layout_and_Grid.md)