Scaling width-only is not good practice—especially on the wall-marking step. On small viewports it forces scrolling to see the whole “hero” + controls, which breaks flow and hurts accuracy. For mobile-first, the primary task must fit above the fold: full photo area in view + guidance + Confirm CTA reachable without scrolling.

⸻

Task: Make /configure truly mobile-first (fit-to-height)

Goal (acceptance criteria)
	•	On iPhone SE–15 Pro Max and 13” laptops, Stage 3 (“Mark wall”) shows:
entire photo hero (letterboxed if needed) + 4 corner handles + instruction text + Confirm CTA without vertical scrolling.
	•	No layout shift when browser chrome shows/hides or keyboard appears.
	•	60 FPS pan/zoom on photo; markers remain reachable.

Layout rules
	•	Use viewport height–aware sizing: prefer dvh/svh over vh.
	•	Compute available height = visual viewport height − safe-area insets − top bar − status hints − sticky CTA (use platform-safe insets).
	•	Hero container: maintain image aspect with contain (letterbox allowed), max height = available height × 0.72–0.8 (tune per device).
	•	Bottom sheet (panel/CTA): adaptive height: min 20%, max 35% of visual viewport; collapsible on wall-marking step (default collapsed).
	•	Keep instruction text overlaid inside the hero; CTA sticky above the safe area.
	•	Provide a “Full screen photo” toggle (expands hero to 90–95% dvh; panel becomes a floating button).

Interaction
	•	Pinch-zoom and pan the photo (markers stay within bounds).
	•	When zooming past fit, auto-reveal temporary mini-toolbar with “Reset view”.
	•	On tiny screens, allow temporary auto-hide of top bar while user is marking.

Platform quirks
	•	iOS Safari: use svh/dvh to avoid the 100vh bug and respect dynamic toolbars.
	•	Respect safe areas (safe-area-inset-*) for notch/home bar.
	•	Avoid scroll-jank: body fixed; scroll only inside the panel when expanded.

QA checklist
	•	iPhone SE/13/15 Pro Max, Pixel 6/8, 13” MacBook Air: no vertical scroll needed to mark + confirm.
	•	Rotate to landscape: hero scales to height, CTA remains reachable.
	•	Keyboard open on inputs: panel compresses; hero does not jump.
	•	Reduced-motion: transitions fall back to fades; no layout pop.

Telemetry
	•	Log viewport metrics and whether user toggled “Full screen photo”. Track abandon on Stage 3 to validate improvement.

⸻

Tiny visual showing the collapsed bottom sheet + fit-to-height hero: docs/UI-UX_Overhaul/mobile_grid.png

## Overview
This document outlines the mobile-first layout improvements for the Curtain Wizard configurator, focusing on viewport-aware design and fit-to-height approach.

## Status: ✅ Foundation Complete (Phase 1-4 + Polish)

**Last Updated:** October 24, 2025  
**Version:** v.05.1.0

---

## Completed Improvements

### Phase 1-3: Foundation ✅
- Viewport-aware CSS utilities (dvh/svh, safe-area)
- `useMobileFirstLayout` hook with platform detection
- ConfiguratorLayout refactored with flexbox fit-to-height

### Phase 4: Photo Hero ✅
- Height-constrained photo container (`max-height: var(--hero-max-height)`)
- `object-contain` scaling with letterboxing
- Curtain texture positioning preserved (pixel-perfect)

### Polish Improvements ✅
- **Modal UX:** Backdrop blur, smooth animations (200ms), centered over photo on desktop
- **Visual Design:** Sage green wall box (brand colors), glass cards with frosted effects
- **Upload Zone:** Single photo icon with glass background, smooth hover transitions
- **Interactions:** Rectangle correction on "Mark Again", Back button resets to upload
- **Animations:** slide-in, zoom-in, fade-in with Tailwind animate utilities

### Technical Highlights
- Modal positioned absolutely within photo container (centers over image on desktop)
- Glass card design: gradient backgrounds, backdrop-blur-md, shadow-glass-hover
- Normalization flag reset ensures rectangle correction applies every marking session
- Back button in estimate modal clears state and returns to upload step

---

## Next Phase: Collapsible Bottom Panel
See `Mobile-First-Implementation-Plan.md` for detailed roadmap.