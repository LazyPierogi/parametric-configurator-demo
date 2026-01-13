# Curtain Wizard — Design System Implementation Plan

**Owner:** Badass (AI agent)  
**Partner:** Principal Designer  
**Decision date:** November 2025  
**Status:** Approved — execution in progress

---

## Goals
- Establish a reusable UI kit so the designer can preview/tweak visuals and motion before code ships.
- Centralize theme/motion tokens and eliminate the globals.css vs Tailwind drift.
- Support the curtain-first `/estimate` → `/configure` flow with the `artist` renderer, with all shared UI surfaces authored via `packages/ui` + shims.
- Maintain a stable build baseline on **Next.js 14.2.13 + React 18.2** until the upstream App Router regression (React error #31 during `/404` prerender) is resolved. See `BUILD-FIXES-SUMMARY.md` for context; the stack lock is part of this plan so design-system work can continue without CI failures.

---

## Current Baseline & Constraints
- `packages/ui` exists with TS config + Ladle scaffolding, but only core primitives are wired; range slider, upload banners, and filters remain on the legacy stack.
- Initial RangeSlider refactor scoped out cleanly, but the app still runs with the legacy slider until we can swap to the shim + kit without breaking filter UX.
- Upload hero drop zone now runs through the kit `UploadDropzone` component on both `/estimate` and `/configure`, so future styling/motion tweaks must be made inside the kit to keep the hero shell balanced.
- New shared UI work (atoms, molecules, or page-level shells used in multiple places) should originate inside `packages/ui` + shims; one-off layout glue can live in `apps/web` as long as it only composes kit pieces and does not reimplement atoms.
- Token generator + drift check already run through `npm run generate:tokens` / `npm run check:tokens`; we must keep these scripts source-of-truth and gate merges on deterministic diffs.
- Toggle + NumericInput live in the kit and are imported via the shim, so any future atoms must follow the same pattern (kit → shim → app usage) to keep `legacy` and `new` flow parity.
- Configure + Upload rely on shared kit primitives (Button/Input/Dialog/etc.) and the `artist` renderer path; keep migrations scoped to the shim layer so product code stays compositional.
- The build is locked to Next.js 14.2.13 / React 18.2; any design-system work that touches the app shell must remain compatible with that stack until the upstream regression is resolved.

---

## Scope & Deliverables
1. **packages/ui** workspace  
   - Exports typed tokens (`tokens.ts` → CSS vars + Tailwind `extend`).  
   - Provides atomic components (Button, Card, Chip, Dialog, Panel, Feedback primitives).  
   - Ships motion tokens + preset hooks (`motionTokens`, `useStageShellMotion`).  
   - Includes Storybook (or Ladle) so designers validate states outside `/configure`.
2. **Adoption adapters** inside `apps/web`  
   - Replace legacy styles with kit imports (starting with shared atoms).  
   - Provide deterministic `data-cw-*` handles for automation/agents.  
   - Prefer kit-first authoring for shared surfaces: when new reusable UI is required, land it in `packages/ui` + shim exports before wiring it into `apps/web`; keep per-page glue in `apps/web` thin and compositional.
3. **Flag flip readiness**  
   - Ensure the kit covers Configurator + Upload flow, and keep the renderer pipeline on `artist`.  
   - Update RUNBOOK + README with rollout instructions.

Out of scope: rewriting AI services, segmentation pipeline changes, or storefront bridge logic.

---

## Phases & Milestones

| Phase | Target window | Key tasks | Exit criteria |
| --- | --- | --- | --- |
| **0. Baseline Audit** | Week 0 | Inventory tokens in `globals.css` & Tailwind, map to overhaul specs | Tracker doc updated with source-of-truth mapping |
| **1. Token Generator** | Week 1 | Create `packages/ui/tokens`; script to emit CSS vars + Tailwind config + JSON for designer | `npm run generate:tokens` produces deterministic outputs; Tailwind consumes kit |
| **2. UI Kit MVP** | Weeks 1–2 | Build atoms (Button, Card, Chip, Input, Slider, Dialog, Feedback primitives) with Storybook stories + motion tokens | Designers can preview + tweak via Storybook; components replace legacy ones in `/components/ui` |
| **3. Flow Integration** | Weeks 2–3 | Swap Configurator/Upload shared surfaces to kit, add `data-cw-*` handles | `/estimate` and `/configure` render via kit with no regressions |
| **4. Release Prep** | Week 4 | Complete stage-specific components, finalize QA, update RUNBOOK/README, confirm `NEXT_PUBLIC_TEXTURES_PIPELINE=artist` | Successful regression pass |

---

## Execution Details

### Tokens & Tooling
- Translate the Havinic + Signature palettes, neutral ramps, spacing, typography, elevation, and motion semantics into strongly typed definitions under `packages/ui/tokens/schema.ts`.
- Generator outputs: `tokens.css` (CSS vars consumed by global styles), `tokens.tailwind.ts` (Tailwind `extend` entry point), and `tokens.json` (designer handoff / Storybook controls). All three artifacts must stem from the same hash-safe source file.
- Tailwind inside `apps/web` imports generated config only; ad-hoc overrides are prohibited and `npm run check:tokens` blocks merges when `packages/ui/tokens/generated/**` diverges.
- Globals audit checklist lives in `UI-UX_Overhaul_TaskList.md` and is updated whenever tokens change; drift detection happens both through lint + CI script logs.
- Motion tokens expose both default and `prefers-reduced-motion` aware values so Toggle/NumericInput hooks stay aligned with accessibility expectations.

### Component Library
- Build atoms in `packages/ui/src/components` using the generated Tailwind theme + motion hooks; each component exports `data-cw-component` and `data-cw-variant` metadata for automation.
- Variants, slots, and states follow `docs/UI-UX_Overhaul/04_Components_and_Interactions.md`; each prop surface must include designer notes + control knobs in Ladle stories.
- Accessibility gates: run `npm run lint:a11y` plus manual keyboard/screen-reader smoke tests on Button, Input, Chip, Dialog, Toggle, NumericInput, Select, Spinner, Progress, and future additions (Range slider, SwitchGroup, Upload dropzone).
- Ladle playground (`npm run storybook:ui`) is the canonical preview. Each component ships with: default story, stress state (loading/error/disabled), motion preview, and design token knobs for palette/mode experiments.
- Publish snapshot links (Chromatic optional) for the designer each milestone and capture diffs in `/docs/ui-previews/README.md`.

### Integration & Refactor
- `apps/web/components/ui` is the only import surface for app code; shims map kit components to host-specific overrides (e.g., storefront icon packs).
- Migration order: Buttons → Cards → Inputs → Panels → Feedback → Range slider shell → Upload experience → Filters. After each swap run `/configure` smoke test with `NEXT_PUBLIC_CONFIGURE_DEBUG_UI` toggled on.
- Before we swap the drop zone to `UploadDropzone`, extract the hero shell into dedicated `HeroSurface` components (`apps/web/app/configure/components/HeroSurface.tsx` and `apps/web/app/estimate/components/HeroSurface.tsx`) so the logic-heavy canvas, overlay, and segmentation helpers remain untouched; the kit swap then replaces only the wrapping shell.
- Introduce `useStageShell` hook mapping `WizardState.stage` to layout density + motion tokens (stage transitions, drawers, summary panel). Hook lives in `packages/ui` with a thin shim for app-specific data.
- Update instrumentation by attaching deterministic `data-cw-*` handles from the shim layer; log updates in RUNBOOK so automation scripts remain stable.
- Track completed surfaces + pending ones in `UI-UX_Overhaul_TaskList.md` and link PRs for traceable progress.

### Rollout & Flags
- Before flag flip run regression matrix (mock + storefront providers) and document results in RUNBOOK/README. Checklist includes upload → measure → segment → configure + summary export.
- `.env.example`, `.env.production`, and infra secrets in `packages/shared/src/env.ts` must reflect the supported defaults (`NEXT_PUBLIC_TEXTURES_PIPELINE=artist`, related AI toggles untouched).
- Post-flip, announce in AGENTS.md, README, RUNBOOK, and `project planning/04-Development-Plan.md`; highlight rollback instructions (env var switch + redeploy) for reversibility.
- Record feature flag history in `docs/feature-flags.md` (new doc) or existing RUNBOOK section so we keep audit trail of when defaults changed and why.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Token drift during migration | Inconsistent UI, regressions | Generator as single source + CI check comparing emitted files |
| Storybook adds maintenance overhead | Slower builds | Use Ladle or on-demand Storybook command; run only in CI as needed |
| Surface parity drift | Inconsistent UX across stages/pages | Keep shared UI primitives and styles centralized in `packages/ui` + shims |
| Designer feedback loop slow | Delays shipping | Provide hosted Storybook build + token JSON export early in Phase 2 |

---

## QA & Validation
- Automated: `npm run lint`, `npm run lint:a11y`, `npm run test:ui`, `npm run check:tokens`, and Ladle visual regression (optional Chromatic). CI must fail on any drift between generated tokens and Tailwind extend outputs.
- Manual: Run `/configure` end-to-end (upload → measure → segment → configure), toggling `NEXT_PUBLIC_CONFIGURE_DEBUG_UI` to validate diagnostics drawer and kit styling. Capture screenshots for each stage.
- Accessibility: Keyboard traversal + screen reader announcements for Buttons, Dialogs, and NumericInput; verify reduced-motion settings propagate (especially in Toggle, NumericInput, drawer transitions).
- Storybook/Ladle review: Designer signs off on each component via the hosted preview link per milestone; approvals are logged in `docs/ui-previews/README.md`.

---

## Dependencies & Coordination
- Designer references: `docs/UI-UX_Overhaul/04_Components_and_Interactions.md`, `docs/SUMMARY-PANEL-SPEC.md`, and measurement flow briefs. Keep these synced with kit prop definitions.
- Dev references: `project planning/05-Task-List.md` (IDs 051–058), `project planning/04-Development-Plan.md`, and RUNBOOK flag procedures. Update these whenever kit coverage or rollout status changes.
- Infra: GPU segmentation + Genkit measurement must remain untouched; only UI env vars change. Coordination with infra happens before toggling `.env.production`.
- Stakeholder check-ins: weekly sync (designer + Badass) to review Storybook diffs, plus pre-flag flip walkthrough with Principal Designer + storefront partner.

---

## Success Metrics
- Designers can preview key components and flows in Ladle without running `/configure`.
- 0 ad-hoc color/spacing definitions left in `globals.css` outside generated tokens.
- Designers ship visual tweaks by editing token JSON / component stories, not touching app code.
- Swapping palettes or motion easings requires no component rewrites.
- `NEXT_PUBLIC_TEXTURES_PIPELINE=artist`, with parity confirmed across mock + storefront providers.

---

## Tracking
- Task breakdown mirrored in `project planning/05-Task-List.md` under “Phase 0 — UI Platform Foundation”.
- Progress recorded in weekly status notes + Storybook snapshots.  
- All flag changes documented in RUNBOOK + README before rollout.
