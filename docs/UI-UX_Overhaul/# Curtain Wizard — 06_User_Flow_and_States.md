# Curtain Wizard — 06_User_Flow_and_States.md  
*(UI/UX Guidelines – Section 6)*  

---

## TL;DR  
Curtain Wizard is a **guided vertical story** in six acts — each one flowing seamlessly into the next.  
From “take a photo” to “add to cart,” users never leave the scene.  
AI assists silently in the background while the interface provides clear, human reassurance at every step.

---

## 1. Overview  

| Stage | Goal | Key Feeling |
|--------|------|--------------|
| 1. Upload | Start, trust, curiosity | “Let’s begin.” |
| 2. AI Measurement & Segmentation | Intelligence working quietly | “It’s analyzing — feels calm.” |
| 3. Wall Box Confirmation | Control and collaboration | “I’m helping it get perfect.” |
| 4. Configurator | Creativity and empowerment | “Now I make it mine.” |
| 5. Add-ons | Completeness | “Nice touch — let’s finish strong.” |
| 6. Summary & Checkout | Confidence and closure | “That was easy.” |

Each stage follows the same rule: **one clear task, one dominant visual, one primary action.**

---

## 2. Global UX Rules  

- **Photo is always visible** in the background except during checkout or full modals.  
- **Back navigation** never resets progress — only steps back one layer.  
- **Loading or AI actions** are transparent; the user always sees progress through shimmer, pulse, or text feedback.  
- **All transitions** follow motion spec from Section 05.  

---

## 3. Stage 1 — Upload  

### Goal  
User uploads or takes a photo with A4 sheet reference visible.  

### UX Flow  
1. CTA: “Take or Upload Photo.”  
2. File validation (aspect ratio, clarity).  
3. Photo preview loads instantly with subtle zoom-in.  
4. Shimmer overlay appears: *“Analyzing…”*  

### Feedback States  

| State | Visual | Message |
|--------|--------|---------|
| Uploading | Shimmer overlay + progress circle | “Uploading…” |
| Success | White flash + accent pulse | “Photo ready!” |
| Error | Micro-shake + red hint | “Please try again.” |

💡 *Design Intent:*  
No empty screens — even during upload, show the evolving preview.

---

## 4. Stage 2 — AI#1 Measurement & AI#2 Segmentation  

### Goal  
System measures and detects window area automatically.  
Both AI models run in sequence but feel like one calm process.

### UX Flow  
1. Overlay fades in with shimmer line moving left→right (1.5 s loop).  
2. Progress circle fills around upload icon.  
3. Text: *“Taking measurements…”*  
4. Measurement success → **white flash + accent pulse.**  
5. “Understanding your space…” appears as segmentation runs quietly in background.  
6. On segmentation success → **same flash + pulse** to preserve continuity.  
7. Transition into Wall Box Confirmation.

### Edge States  

| Case | UI Behavior |
|------|--------------|
| Low-confidence measurement | Prompt: “Help us adjust wall corners.” (skips to Stage 3) |
| Segmentation error | Retry overlay with “Re-analyze photo” button |
| User abort | Progress cancels immediately; returns to Stage 1 photo view |

💡 *Visual cue:*  
Shimmer overlay opacity drops slightly (0.8→0.6) when AI shifts from measurement to segmentation — user perceives “phase change” without new screen.

---

## 5. Stage 3 — Wall Box Confirmation  

### Goal  
User validates detected wall area and helps refine geometry.  

### UX Flow  
1. Overlay lightens (blur ↓ to 16 px).  
2. Text prompt: *“Mark your wall corners.”*  
3. Crosshair markers fade in sequentially (150 ms each).  
4. On user tap/drag → lines animate elastically between points.  
5. “Confirm” CTA appears bottom-center.  
6. Tap → shimmer line runs left→right; loading curtain preview begins beneath.  

### Feedback  

| State | Visual |
|--------|--------|
| Marker adjustment | Glow feedback at touch points |
| Confirmation | Accent ripple + soft zoom-out |
| Retry | “Reset wall” button slides in from right |

💡 *Design Intent:*  
Feels collaborative — like tracing fabric edges with the app.

---

## 6. Stage 4 — Configurator  

### Goal  
User customizes curtain type, fabric, pleat, and hem — instantly previewed.  

### UX Flow  
1. Curtain render stabilizes and gently zooms (1.03×).  
2. Configurator panel slides up (220 ms ease-out).  
3. First carousel visible: “Choose Fabric.”  
4. Subsequent filters appear progressively below.  
5. Every change updates render instantly; incompatible options gray out and animate wiggle.  

### Key Components  
- **Carousel Variant A** (default).  
- “(i)” icon opens full-screen modal with Havinic fabric details.  
- “Add Another Curtain” as secondary CTA when more segments available.  

### Feedback States  

| State | Visual / Motion | Copy |
|--------|-----------------|------|
| Loading | Curtain shimmer overlay | “Updating…” |
| Success | Curtain fade refresh | “Looks great!” |
| Incompatible | Chips wiggle | “Not available for this fabric.” |

---

## 7. Stage 5 — Add-Ons  

### Goal  
User selects optional services easily, without upsell friction.  

### UX Flow  
1. Panel cross-fades; title slides +10 px then back.  
2. Add-on cards appear with 60 ms stagger fade-up.  
3. Selected card fills with accent color + checkmark morph.  
4. Running total updates in real time.  

### Optional Items  
- Professional measurement visit  
- Curtain rod  
- Installation service  
- Design consultation  

### Feedback States  

| State | Visual | Copy |
|--------|--------|------|
| Selected | Accent fill + pulse | “Added” |
| Deselected | Fade-out check | “Removed” |
| Service unavailable | Card dims, tooltip: “Coming soon in your area.” |

---

## 8. Stage 6 — Summary & Checkout  

### Goal  
Show all choices clearly and pass configuration to Storefront cart.  

### UX Flow  
1. Background blur deepens (24 px).  
2. Summary cards fade-up one by one.  
3. Total price animates count-up from 0 → value (1 s).  
4. CTA “Finalize Purchase” glows once before palette transition.  
5. Signature → Havinic color cross-fade (300 ms).  
6. Storefront cart slides in from bottom; hand-off complete.  

### Summary Card Data  
- Fabric thumbnail, name, SKU  
- Pleating & hem details  
- Services & price breakdown  
- “Configure another curtain” (secondary CTA)

### Feedback States  

| State | Visual |
|--------|---------|
| Success | Pulse + accent glow |
| Error (Storefront) | Modal with “Retry checkout” |
| Continue shopping | Slide-back motion, restores previous wizard state |

💡 *Design Intent:*  
Checkout feels like stepping from app to boutique counter — same light, new focus.

---

## 9. Global System States  

| State | Behavior |
|--------|-----------|
| **Loading** | Shimmer overlay + activity copy |
| **Processing (AI)** | Dim overlay + looping shimmer line |
| **Success** | Flash + accent pulse |
| **Error** | Red glow + retry CTA |
| **Disabled** | 0.4 opacity + no shadow |
| **Idle** | Gentle breathing of accent gradient (if idle > 6 s) |

---

## 10. Edge-Case Behaviors  

| Scenario | User Feedback | Recovery |
|-----------|----------------|-----------|
| Poor-light photo | Prompt retake | Auto-adjust brightness suggestion |
| Missing A4 reference | Tooltip + visual sample overlay | User can continue manually |
| Network dropout | “Offline mode” banner, cached state preserved | Retry button visible |
| Interrupted AI process | Keeps last safe frame; resumes automatically | “Resuming analysis…” |

---

## 11. Emotion Through Flow  

| Stage | Dominant Emotion | Reinforcement |
|--------|------------------|---------------|
| Upload | Curiosity | Bright CTA, motion-in |
| Measurement | Trust | Shimmer + steady pace |
| Wall Box | Control | User marking motion |
| Configurator | Creativity | Live preview & color |
| Add-ons | Completion | Sequential fade-up |
| Summary | Satisfaction | Palette cross-fade, calm pulse |

---

## 12. Summary  

> **“From photo to checkout, nothing breaks the spell.”**

Curtain Wizard’s flow mirrors the real-world process of hanging curtains:  
measure → adjust → choose → admire.  
But here, it happens in minutes — with empathy, precision, and beauty.

---

**Next section:**  
👉 [07_Developer_Handoff_Notes.md](07_Developer_Handoff_Notes.md)