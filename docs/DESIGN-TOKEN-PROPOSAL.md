# Draft Design Token Proposal

**Purpose:** Provide a baseline token catalogue for the Curtain Wizard web app so the designer can confirm or adjust values before the UI/UX overhaul.

**Last updated:** October 18, 2025  
**Status:** Awaiting designer confirmation

---

## Colour Tokens

| Token (proposed) | Current value(s) in code | Intended usage | Questions |
| --- | --- | --- | --- |
| `--color-primary-500` / `primary.500` | `#4a67ff` | Primary actions, highlights, chips | Confirm this remains the hero colour. |
| `--color-primary-600` / `primary.600` | `#3b5bff` (Tailwind) | Hover/active states | OK to keep or adjust? |
| `--color-primary-700` / `primary.700` | `#1f2b6c` | Text on light backgrounds, strong emphasis | Align with brand palette? |
| `--color-primary-900` / `primary.900` | `#0f172a` | Dark backgrounds, overlay gradients | Keep or swap for updated navy? |
| `--color-neutral-50…900` | `#f8fafc` → `#0f172a` (Tailwind) | Surfaces, divider lines, typography | Any additions (e.g., warm greys)? |
| `--color-success-500` | `#10b981` | Success text/icons | Confirm? |
| `--color-success-600/700` | `#059669`, `#047857`, `#065f46` | Buttons/badges backgrounds | Which values should remain? |
| `--color-warning-100/200` | `#fff7dc`, `#eef3ff` (cache banners) | Background for warnings/info | Provide official warning palette? |
| `--color-warning-500` | `#e6c762` | Border/icon for warning banners | Acceptable saturation? |
| `--color-error-500` | `#ef4444` | Error text/icons | Confirm? |
| `--color-error-600/700` | `#c53030`, `#b91c1c` | Button backgrounds, emphasis | Keep or adjust? |
| `--color-error-bg` | `#fee2e2`, `#fff1f2` | Error background | Choose one canonical tone. |
| `--color-glass-light` | `rgba(248,250,252,0.55)` | Configure shell background | Confirm opacity + tint. |
| `--color-glass-medium` | `rgba(2,6,23,0.45)` | Glass overlay gradient mid-tone | Provide desired range. |
| `--color-glass-dark` | `rgba(2,6,23,0.60)` | Darkest overlay stops | Confirm maximum darkness. |
| `--color-stitch` | Derived from `STITCH_LINE_RGB` | Curtain stitch-line overlay | Provide desired hue/opacity. |
| `--color-debug-handle` | `--cw-handle-bg` (`#e5e7eb`), borders/ring values | Handle chrome for debug UI | Provide neutral palette + focus colour. |

---

## Shadow Tokens

| Token | Proposed value | Usage | Notes |
| --- | --- | --- | --- |
| `--shadow-card` | `0 6px 16px rgba(15, 23, 42, 0.08)` | Base cards | Already used in Tailwind `shadow` extension. |
| `--shadow-card-hover` | `0 18px 44px rgba(0, 0, 0, 0.18)` | Hover states | Confirm intensity. |
| `--shadow-primary` | `0 4px 12px rgba(74, 103, 255, 0.25)` | Primary buttons | Keep or adjust for new palette? |
| `--shadow-modal` | `0 24px 48px rgba(15,23,42,0.35)` | Dialogs | Validate softness. |

---

## Spacing & Radius Tokens

| Token | Current value | Usage | Notes |
| --- | --- | --- | --- |
| `--radius-sm` | `8px` | Chips, inputs | Confirm roundness level. |
| `--radius-md` | `10px` | Buttons, cards | Default radius today. |
| `--radius-lg` | `16px` | Larger panels | Accept or adjust? |
| `--radius-xl` | `24px` | Dialogs | Confirm for overhaul. |
| Spacing scale | Tailwind defaults (`0.5rem…`) + `18(4.5rem)` | Layout gaps | Do we need custom steps (e.g., 14px, 20px) promoted into tokens? |

---

## Typography

| Element | Current setting | Questions |
| --- | --- | --- |
| Base font | Roboto 400/500/700 | Keep Roboto or switch to brand typeface? |
| Heading scale | `h1` 2xl, `h2` xl, `h3` lg, `h4` base (Tailwind) | Should we introduce a semibold/bold mix or new sizes? |
| Body text | `text-base` (16px) | Any desire for 15px or 17px base? |
| Caption | `text-xs` (12px) | Confirm minimum size for accessibility. |

---

## Open Questions
1. Provide the canonical colour palette (hex values + naming) so tokens match brand guidelines.  
2. Confirm whether overlays and glass effects should lean cool (current navy tint) or a different hue.  
3. Decide on success/warning/error scales, including background, border, and icon colours.  
4. Clarify typography choices (font family, size scale, weight usage).  
5. Identify any additional states (focus rings, disabled backgrounds, special banners) that require dedicated tokens.  
6. Should we prepare dark-mode tokens now or focus on light theme only?

Please annotate this document (or reply in chat) with confirmed values before we proceed to Phase 2.

