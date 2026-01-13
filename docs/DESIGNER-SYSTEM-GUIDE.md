# Curtain Wizard — Designer System Guide

## What Ships Where
- **Tokens & atoms** live in `packages/ui`. Edit tokens via `packages/ui/scripts/generate-tokens.ts` (or run `npm run generate:tokens`) and keep Tailwind/globals in sync with `npm run check:tokens`.
- **App usage** always flows kit → shim → page. Import components from `apps/web/components/ui/*`; if something is missing, land it in the kit first, then expose it via the shim.
- **Empty states + motion** are centralized in kit components (e.g. `UploadDropzone`, `Toggle`, `NumericInput`). Any tweaks to copy, easing, or handles go through the kit so both `/estimate` and `/configure` stay aligned.

## Ladle Playground (Optional)
- Use Ladle when you introduce **new reusable kit components** or make **larger visual/motion changes** that affect many screens.
- Start it with `npm run storybook:ui` (root script) and use it mainly to sanity‑check edge states and capture reference screenshots/GIFs.
- For small, targeted tweaks on existing components, it is fine to skip Ladle and validate directly in the app.

## Typical Workflow (Prompt‑First)
1. **Describe the change in a prompt** — treat your prompt as the “user story” (what, where, why).
2. **Kit first (when shared)** — if this is a reusable pattern, implement or adjust it in `packages/ui` (tokens + component), then expose it via the shim in `apps/web/components/ui/*`.
3. **App‑only (when local)** — if this is a one‑off layout tweak or wiring change, adjust the page/layout in `apps/web` while still consuming kit components where possible.
4. **Validate in the app** — run `npm run dev`, exercise `/estimate` + `/configure` in both flow modes and check for regressions.
5. **Optionally backfill a Ladle story** when a one‑off pattern proves useful and should graduate into the shared kit.

## Quick References
- **Tokens:** `packages/ui/tokens` (source), `packages/ui/tokens/generated` (outputs consumed by Tailwind/globals).
- **Upload Shells:** `packages/ui/src/components/upload-dropzone.tsx` → shim `apps/web/components/ui/UploadDropzone.tsx`.
- **Motion Hooks:** `packages/ui/src/motion` (used by Toggle/NumericInput) — reuse instead of ad-hoc `useEffect`.
- **Automation Handles:** Always add `data-cw-component`, `data-cw-state`, or flow-specific IDs at the kit layer so QA tools don’t drift.

### Your day-to-day loop

For most work you described (refactor legacy→new, improve UX, add features with low regression risk):

1. Write the prompt (“user story”): what screen, what change, how it should feel.
2. Decide scope:
   - Global visual rule? → tokens path.
   - Component look/behavior? → kit component path.
   - Flow/layout? → app glue path.
3. Apply change in the right layer (tokens / kit / app).
4. Run dev + smoke test:
   - /estimate upload → measure.
   - /configure in both legacy and new flows (flags).
5. Optionally backfill a Ladle story if the new thing is reusable and worth having a playground for.

Ping Badass in `docs/UI-UX_Overhaul_TaskList.md` before adding brand‑new components so we can keep the kit + Ladle coverage ahead of app integration.
