# Curtain Wizard — 05_Motion_and_Transitions.md  
*(UI/UX Guidelines – Section 5, updated with refined Stage Transitions)*  

---

## TL;DR  
Curtain Wizard’s motion is not decoration — it’s **narration**.  
Every animation tells the story of what’s happening: AI working quietly, user regaining control, light revealing progress.  
Our updated flow unifies all transitions between the AI stages and the human ones, so the user always feels informed and in control.

---

## 1. Motion Philosophy  

| Principle | Description |
|------------|-------------|
| **Continuity Over Change** | Motion stitches moments together; no hard cuts, no disorientation. |
| **Subtle Reassurance** | Movement signals confidence — fast but never abrupt. |
| **Material Realism** | Transitions behave like soft fabric under gravity, not rigid panels. |
| **Progress Transparency** | Users always “see” what the AI is doing, even when waiting. |

💡 *Design Intent Note:*  
Motion is empathy in pixels — it shows users that something is happening *for them*, not *to them.*

---

## 2. Motion Language Overview  

| Type | Feeling | Example |
|------|----------|---------|
| **Fade** | Calmness & transition | Overlay, step changes |
| **Slide** | Progress & continuity | Panels, modals |
| **Scale** | Control & focus | Buttons, zoom handover |
| **Shimmer** | Life & activity | AI processing |
| **Pulse** | Confirmation | Success or completion |

All transitions share the same softness — no conflicting velocities or easing styles.

---

## 3. Timing & Easing System  

| Use Case | Duration (ms) | Easing Curve | Description |
|-----------|----------------|--------------|--------------|
| Micro-interactions (buttons, chips) | 80–120 | `cubic-bezier(0.4,0,0.2,1)` | Snappy, natural |
| Panel entry / exit | 200–240 | `ease-out` | Smooth and grounded |
| Stage morph (AI → human) | 250–300 | `cubic-bezier(0.3,0.8,0.5,1)` | Elastic, reassuring |
| Full-screen transition | 300 | `ease-in-out` | Calm and steady |
| Success / delight pulse | 400–600 | `cubic-bezier(0.17,0.67,0.83,0.67)` | Soft breathing finish |

---

## 4. Stage Transitions (updated flow)  

### Upload → AI#1 Measurement Processing + AI#2 Segmentation (background)  
- Fade overlay appears with **shimmer line** left→right (1.5 s loop).  
- Upload icon shows **progress circle** filling clockwise.  
- On measurement success → **soft white flash (40 ms)** + **accent pulse**.  
- AI#2 segmentation begins seamlessly in background.

### AI#1 Measurement Confirmation → AI#2 Segmentation  
- **Measurement Confirmation Pop-Up** slides up from bottom with blur increase (20 → 24 px).  
- AI#2 segmentation continues quietly; background shimmer persists but softens (opacity 0.6).  
- On segmentation success → another **white flash + accent pulse**, visually identical to maintain trust.

### Segmentation → Wall Box Confirmation  
- Overlay lightens (blur ↓ to 16 px) to signal hand-over.  
- “Mark your wall corners” message fades in above preview.  
- When user confirms → **shimmer line** plays again left→right, and **curtain preview starts loading beneath** (depth layer shift).

### Wall Box → Configurator  
- Curtain image **stabilizes and zooms slightly (1.03×)** → signals user control regained.  
- Configurator **panel slides up** (220 ms ease-out).  
- Background blur locks to 20 px for consistency.

### Configurator → Add-Ons  
- Curtain preview stays static.  
- Panel content **cross-fades** (150 ms).  
- Title text slides +10 px then back (elastic cue of progression).  
- “Add-ons” heading fades in synchronously (100 ms delay).

### Add-Ons → Summary  
- Background **blur increases (16 → 24 px)** to shift focus upward.  
- Floating CTA button **pulses once in accent gradient** (confidence signal).  
- Subtle upward motion of entire panel (12 px) suggests “completion.”

### Summary → Checkout (Storefront hand-off)  
- **Color cross-fade:** Signature palette → Havinic Harmony (300 ms).  
- UI content slides out upwards as Storefront cart slides in from bottom (dual motion).  
- Maintain 150 ms overlap for cinematic continuity — feels like one ecosystem.

💡 *Design Intent Note:*  
The dual AI phase (measurement + segmentation) must *never feel like waiting*; it feels like the app is “thinking beautifully.”  
The shimmer is the heartbeat of the system.

---

## 5. Component-Level Motion  

| Component | Interaction | Behavior |
|------------|-------------|-----------|
| Button | Press/release | 2 % scale-in, shadow tightens then releases |
| Chip | Toggle | Color fill morph + micro-ripple |
| Carousel | Scroll | Parallax + center zoom (1.08×) |
| Modal | Open/Close | Slide + fade overlay (200 ms) |
| Slider | Drag | Value bubble appears (fade 100 ms), follows thumb |
| Card | Appear | Fade-up + 60 ms stagger |
| Add-On Toggle | Checkmark grows (120 ms), glow pulse (80 ms) |

---

## 6. Depth & Parallax  

| Layer | Motion Ratio | Direction |
|--------|---------------|------------|
| Photo | 1× | static |
| Curtain Render | 1.05× | subtle parallax on scroll |
| Mask Layer | 1.1× | counter-scroll depth |
| Panels / UI | 0.9× | slower movement for anchor feel |

---

## 7. Delight Moments  

| Moment | Animation | UX Purpose |
|---------|------------|------------|
| AI Measurement Success | White flash + accent pulse | Certainty |
| Segmentation Success | Second flash + gentle shimmer end | Continuity |
| Curtain Preview Appear | Fade top→bottom + parallax settle | Beauty |
| Add-to-Cart | Gradient fill + checkmark morph | Reward |
| Checkout Handoff | Palette cross-fade + dual slide | Closure |

---

## 8. Motion Accessibility  

- Respect “Reduce Motion” OS setting (replace slides → fades).  
- No transform > 20 px or > 300 ms delay.  
- Shimmer lines become static progress bars when reduced-motion enabled.  
- Success flashes dimmed to 60 % opacity to avoid glare.

---

## 9. Motion Tokens  

| Token | Value | Purpose |
|--------|--------|----------|
| `motion.micro` | 100 ms | taps |
| `motion.short` | 200 ms | panels |
| `motion.medium` | 300 ms | stages |
| `motion.long` | 500 ms | delight |
| `ease.primary` | `cubic-bezier(0.3,0.8,0.5,1)` | elastic |
| `ease.soft` | `ease-in-out` | fades |
| `ease.snap` | `cubic-bezier(0.4,0,0.2,1)` | press feedback |

---

## 10. Summary  

> **Curtain Wizard moves like light through fabric — never rushed, never rigid.**

Through motion, users *feel* both AI intelligence and craftsmanship.  
It’s our way of saying:  
> “We’re working quietly behind the scenes — and it already looks beautiful.”

---

**Next section:**  
👉 [06_User_Flow_and_States.md](06_User_Flow_and_States.md)