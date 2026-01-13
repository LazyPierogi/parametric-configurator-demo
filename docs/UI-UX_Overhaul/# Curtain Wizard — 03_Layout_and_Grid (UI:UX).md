# Curtain Wizard — 03_Layout_and_Grid.md  
*(UI/UX Guidelines – Section 3)*  

---

## TL;DR  
Curtain Wizard uses a **mobile-first, single-column flow** inspired by natural motion — like fabric unfolding vertically.  
We design with an **8px grid**, fluid spacing, and clear separation between “photo area” and “control area.”  
Our grid isn’t just structure — it’s rhythm.  

---

## 1. Core Layout Philosophy  

Every screen is built around **two visual zones**:

1. **Experience Zone** → where the magic happens (user photo + curtain render).  
2. **Interaction Zone** → where user choices live (panels, carousels, buttons).  

The design hierarchy flows vertically:
> *Photo → Preview → Panel → CTA.*

Each step should feel **continuous**, not like switching screens.

💡 *Design Intent Note:*  
The curtain preview must never feel like a thumbnail — it’s the hero, the “living” part of the interface.

---

## 2. Grid System  

### Base Grid  
- **8px grid** for all spacing, padding, and component sizing.  
- Primary increments: 8 / 16 / 24 / 32 px.  
- Rounded radii: 12px (cards), 16px (modals, panels).  
- Always maintain consistent rhythm between sections (e.g., padding 16–24px).  

### Viewport & Breakpoints  

| Device | Width | Layout Behavior |
|---------|--------|----------------|
| Mobile S | 360–400 px | Core design target |
| Mobile M | 414 px (iPhone 13–15) | Default preview ratio |
| Mobile L / Small Tablet | 430–600 px | Panels widen slightly; carousel expands to 3–4 visible items |
| Desktop | ≥1024 px | Centered column (max 680 px), liquid-glass panel floats in middle |

All components must gracefully scale up — **never stretch horizontally**.  
Desktop version uses the same vertical rhythm with horizontal whitespace margins (≥80px).

---

## 3. Vertical Flow  

Each stage follows a **single-scroll vertical journey**, usually within one viewport height.  
When content extends beyond screen height (e.g., configuration filters), bottom CTA remains sticky with 12px margin from screen edge.

**Stage layout pattern:**

[Top Bar]
↓
[Photo + Curtains]  → hero layer, responsive height
↓
[Interaction Panel] → glass panel / content zone
↓
[CTA Button]        → sticky or floating

### Safe Areas  
- Maintain 24px safe margin top/bottom for iOS/Android bars.  
- Floating CTA buttons should sit 16–24px above bottom safe area.

During AI processing, the Experience Zone remains dimmed with a shimmering overlay; the Interaction Zone stays inactive but visible to prevent a sense of disconnection.

---

## 4. Panel Structure  

### Primary Panel (Configurator, Summary, etc.)
- **Background:** translucent glass (rgba(255,255,255,0.55), blur 20px).  
- **Padding:** 24px top / 16px sides / 32px bottom.  
- **Corner radius:** 24px top corners (if docked), 16px all sides (if floating).  
- **Shadow:** 0 2px 6px rgba(0,0,0,0.08).  
- **Scroll behavior:** smooth inertia scroll, fade top shadow when scrolling begins.

### Floating Elements  
Use **cards on glass**: white 80–90% with blur, small shadow.  
Keep z-index layering subtle; maximum of three vertical stack levels at once (panel → modal → alert).

---

## 5. Navigation & Bars  

### Top Bar  
- Transparent over photo at first, solidifies into glass when scrolling.  
- Elements:
  - Left: back/close  
  - Center: current stage label  
  - Right: info/help icon  

### Progress Indicator  
Instead of progress bars, use **step title transitions** (“1 of 6 → Upload your photo”).  
Each new step title gently fades in.  
Optional thin line indicator (2px, 20% accent gradient) at bottom edge for subtle feedback.

---

## 6. Carousels & Scroll Areas  

### Fabric Carousel  
- Horizontal scroll; 16px spacing between items.  
- Center item enlarges 8% for focus.  
- “Snap to item” behavior; show partial next card for affordance.  
- Each item: 72×72px swatch + label beneath.  
- Tap opens detail modal (full screen).  

### Filter Rows  
- Chips use pill shapes, 12px padding, accent when active.  
- Filter rows scroll horizontally; no more than two visible rows at once.

### Modals  
- Slide up from bottom (200ms ease-out).  
- Full height on fabric details or checkout; medium height on confirmations.  
- Dismiss with downward swipe.

---

## 7. Adaptive Scaling  

| Element | Mobile | Desktop |
|----------|--------|---------|
| Font base | 16px | 18px |
| Panel padding | 16px | 24px |
| Carousel items | 72×72 | 96×96 |
| CTA button | 56px height | 60px height |
| Top bar height | 56px | 64px |

Panels should maintain **optical balance** — never fill more than 60% of screen height unless modal context.

---

## 8. Breakpoint Behavior Example  

### Example: Step 4 – Configurator Panel  
**Mobile:**  
- Panel bottom-docked, 56% of screen height.  
- Carousel + options scroll within.  

**Desktop:**  
- Photo centered (max 900px width).  
- Panel floats right side (max width 380px).  
- Same 8px grid, just wider rhythm.

💡 *Design Intent Note:*  
Curtain Wizard doesn’t “switch to desktop mode” — it expands gracefully, maintaining mobile familiarity.

---

## 9. Full-Bleed vs. Glass Panels  

| Mode | Use Case | Design Rule |
|------|-----------|-------------|
| **Glass Mode** | Default configuration & feedback | Always show photo behind; translucency 55–65%. |
| **Full-Bleed Mode** | Fabric detail modal, checkout summary | Solid background, no translucency; focus mode. |
| **Hybrid** | Step transitions | Panels morph from glass → solid (animate opacity + blur). |

Transitions should **feel like opening a layer of light**, not jumping to a new page.

---

## 10. Layout Keywords  

- *Flow, not frame.*  
- *Glass, not box.*  
- *Stage, not screen.*  

We build Curtain Wizard like a play unfolding: each act blends into the next, always under the same light.  

---

**Next section:**  
👉 [04_Components_and_Interactions.md](04_Components_and_Interactions.md)