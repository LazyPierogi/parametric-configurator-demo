# Curtain Wizard — 07_Developer_Handoff_Notes.md  
*(UI/UX Guidelines – Section 7)*  

---

## TL;DR  
Curtain Wizard is designed for **clarity, continuity, and modular control**.  
The frontend must feel light like a web app but react like native — every action immediate, every feedback alive.  
Developers should think of it as a **multi-layered canvas**, where UI, motion, and AI pipelines stay visually in sync.

---

## 1. System Architecture Overview  

**Frontend Stack:**  
React / Next.js → Tailwind / ShadCN → WebGL / ONNX Runtime (for AI previews)  

**Integration:**  
- Curtain Wizard runs as a **contained iframe** inside the Storefront (Magento WebFlow).  
- Communication with Storefront via postMessage or GraphQL → cart payload handoff.  
- Same component library and theme tokens across both contexts for seamless blending.

### Visual Layers  

| Layer | Function | Rendering Context |
|--------|-----------|------------------|
| L0 | User Photo | Base HTML `<canvas>` or `<img>` |
| L1 | AI Curtain Render | WebGL canvas / depth estimation |
| L2 | Wall Mask Overlay | Semi-transparent `<canvas>` with alpha |
| L3 | UI Panels / Glass Surfaces | React DOM / CSS blur |
| L4 | Modals, Alerts, Checkout | React Portal (z-index > 40) |

💡 *Design Intent:*  
UI and render stack should be asynchronous but visually synchronized — transitions depend on shared state, not timed delays.

---

## 2. Component Architecture  

Follow **Atomic Design logic** to keep UX consistent and maintainable.

| Level | Example | Purpose |
|--------|----------|----------|
| Atoms | Button, Chip, Input | Base components with theme tokens |
| Molecules | Carousel, Card, Slider | Combine atoms with shared motion hooks |
| Organisms | Configurator Panel, Add-On Panel | Compose molecules; one per stage |
| Templates | Wizard Stages (Upload, Config, etc.) | Contain layout & transitions |
| Pages | CurtainWizard.tsx | Flow orchestration layer |

💡 *Tip:*  
Use Framer Motion or GSAP for stage transitions; all easings and durations are defined in [05_Motion_and_Transitions.md](05_Motion_and_Transitions.md).

---

## 3. State Management  

### Global Store (Zustand / Recoil / Context)  
Shared states for:
- `userPhoto`
- `aiMeasurement`
- `aiSegmentation`
- `wallBox`
- `curtainConfig`
- `addons`
- `summary`
- `checkoutStatus`

### State Sync Contract  
```ts
type WizardState = {
  stage: 'upload' | 'ai_measurement' | 'ai_segmentation' | 'wall_box' | 'config' | 'addons' | 'summary' | 'checkout';
  loading: boolean;
  progress?: number;
  error?: string | null;
};

Key Rule

Every visual transition = state.stage change.
Every shimmer / animation trigger = state.loading = true.

⸻

4. Theme Tokens

Use shared theme variables to support palette switching (Havinic Harmony ↔ Signature).

const theme = {
  palette: {
    base: "#FAFAFB",
    accent: {
      primary: "#A8C3A1",
      secondary: "#D9C2F0",
      gradient: "linear-gradient(135deg,#A8C3A1 0%,#D9C2F0 100%)"
    },
    text: { primary: "#1E1E1F", secondary: "#7A7A7A" },
    blur: { default: "20px" },
  },
  radius: { sm: 8, md: 12, lg: 16, xl: 24 },
  shadow: { low: "0 2px 6px rgba(0,0,0,0.08)", high: "0 8px 24px rgba(0,0,0,0.12)" },
};

The app should be themeable at build time or runtime for storefront alignment.

⸻

5. Motion Implementation

Use Framer Motion for all transitions.
Create a unified motionTokens.ts file referencing Section 05.

export const motionTokens = {
  micro: 0.1,
  short: 0.2,
  medium: 0.3,
  long: 0.5,
  easePrimary: [0.3, 0.8, 0.5, 1],
  easeSoft: [0.25, 0.25, 0.75, 0.75],
};

Motion Triggers:
  • Each stage change → parent <AnimatePresence> handles fade/slide transitions.
  • AI actions trigger shimmer and flash components.
  • “Success” triggers pulse component (animated gradient overlay).
  • “Error” triggers micro-shake and error banner.

💡 Best Practice:
Do not use setTimeout for animation timing — always derive transitions from state.

⸻

6. AI Integration Hooks

Each AI phase runs async, reporting progress to UI via shared store.

| AI Process                           | Input              | Output            | UI Response              |
| ------------------------------------ | ------------------ | ----------------- | ------------------------ |
| AI#1 Measurement                     | User photo         | Window dimensions | Progress shimmer + flash |
| AI#2 Segmentation                    | User photo         | Wall mask PNG     | Dimmed shimmer + flash   |
| AI#3 Curtain Render (optional local) | Wall mask + config | Curtain composite | Curtain preview refresh  |

UX rule:
All AI actions → must expose .progress (0–1) and .status (“idle”, “running”, “done”, “error”).
This drives the shimmer line animation, avoiding fake waits.

⸻

7. Error & Recovery Framework

Each state has an automatic retry and visual fallback:

| Error Type           | Response                                   |
| -------------------- | ------------------------------------------ |
| Upload error         | Toast + Retry Upload CTA                   |
| AI timeout           | Modal “Try again / Continue manually”      |
| Config mismatch      | Incompatible chips animation + suggestion  |
| Storefront API error | Error modal with “Reload checkout”         |
| Network drop         | Banner “Offline — saving progress locally” |

💡 Recovery principle:
Users should never lose progress — partial data persists in localStorage until checkout completes.

⸻

8. Performance & Responsiveness

Maintain <150 ms input latency for touch interactions.

Offload heavy WebGL operations to a Web Worker or requestIdleCallback.

Target 60 fps even on mid-tier devices.

Preload curtain textures via IntersectionObserver as user scrolls.

Implement debounce (300 ms) for slider and drag updates to prevent over-rendering.

⸻

9. Asset Delivery & Optimization
| Asset Type        | Format      | Recommendation              |
| ----------------- | ----------- | --------------------------- |
| Icons             | SVG         | Inline via React components |
| Fabric thumbnails | WebP        | 512 px width max            |
| Curtain renders   | WebP / AVIF | Compressed per scene        |
| Mask data         | PNG alpha   | Cached in localStorage      |
| Fonts             | WOFF2       | Preload critical styles     |

⸻
10. QA / Test Scenarios

Must-Test Interactions

Upload photo with poor lighting → recovery message appears.

Interrupt AI#1 midway → resume flow.

Resize window → layout maintains glass ratios.

Tap multiple filters fast → UI doesn’t freeze.

Switch theme (Harmony ↔ Signature) → all gradients update instantly.

Automated Testing

Playwright for interaction flow (mock catalog).

Jest + Storybook snapshots for visual regressions.

Unit tests verifying identical shapes between mock & storefront providers (see Section 4–6 of User Journey doc).

⸻

11. Deployment & Versioning

Curtain Wizard version tags follow CW_MVP_1.0.x.

Each release includes /design-guidelines/ reference commit hash.

Developers must log UI updates that affect:

Motion tokens

Theme variables

Stage logic

AI hook interface

⸻

12. Closing Note

“The UI is not an interface — it’s a promise.”

When code mirrors these design rules, users will never notice the complexity behind AI, segmentation, or rendering.
They’ll just feel one thing: it works, and it feels beautiful.

Reference docs: docs/UI-UX_Overhaul

End of Curtain Wizard UI/UX Guidelines — v1.0