import type { TokenTree } from './types';
import { createToken } from './types';

export const tokens: TokenTree = {
  color: {
    palette: {
      havinic: {
        bgBase: createToken('#F9F8F6', {
          description: 'Havinic Harmony linen white background',
          tailwind: [{ group: 'colors', name: 'havinic-bg' }],
        }),
        textPrimary: createToken('#2E2E2E', {
          description: 'Primary copy on Havinic palette',
          tailwind: [{ group: 'colors', name: 'havinic-text.DEFAULT' }],
        }),
        textSecondary: createToken('#6B6B6B', {
          description: 'Secondary copy on Havinic palette',
          tailwind: [{ group: 'colors', name: 'havinic-text.secondary' }],
        }),
        accentPrimary: createToken('#D6A354', {
          description: 'Honey Oak CTA highlight',
          tailwind: [{ group: 'colors', name: 'havinic-accent.DEFAULT' }],
        }),
        accentSecondary: createToken('#BFA68A', {
          description: 'Soft Taupe hover states',
          tailwind: [{ group: 'colors', name: 'havinic-accent.secondary' }],
        }),
        border: createToken('#E1E1E1', {
          description: 'Minimal divider for Havinic theme',
          tailwind: [{ group: 'colors', name: 'havinic-border' }],
        }),
        success: createToken('#5BAA7E', {
          tailwind: [{ group: 'colors', name: 'havinic-success' }],
        }),
        error: createToken('#C96557', {
          tailwind: [{ group: 'colors', name: 'havinic-error' }],
        }),
        warning: createToken('#E39F3A', {
          tailwind: [{ group: 'colors', name: 'havinic-warning' }],
        }),
      },
      signature: {
        bgBase: createToken('#FAFAFB', {
          description: 'Curtain Wizard Signature frosted surface',
          tailwind: [{ group: 'colors', name: 'cw-sig-bg' }],
        }),
        glassSurface: createToken('rgba(255,255,255,0.55)', {
          description: 'Translucent Signature glass panels',
          tailwind: [{ group: 'colors', name: 'cw-sig-glass' }],
        }),
        glassRgb: createToken('250, 250, 251'),
        glassAlpha: createToken('0.55'),
        textPrimary: createToken('#1E1E1F', {
          tailwind: [{ group: 'colors', name: 'cw-sig-text.DEFAULT' }],
        }),
        textSecondary: createToken('#7A7A7A', {
          tailwind: [{ group: 'colors', name: 'cw-sig-text.secondary' }],
        }),
        accentSage: createToken('#A8C3A1', {
          tailwind: [{ group: 'colors', name: 'cw-sig-sage' }],
        }),
        accentLilac: createToken('#D9C2F0', {
          tailwind: [{ group: 'colors', name: 'cw-sig-lilac' }],
        }),
        accentGradient: createToken('linear-gradient(135deg, #A8C3A1 0%, #D9C2F0 100%)'),
        error: createToken('#E57373', {
          tailwind: [{ group: 'colors', name: 'cw-sig-error' }],
        }),
        success: createToken('#8FD3B2', {
          tailwind: [{ group: 'colors', name: 'cw-sig-success' }],
        }),
      },
    },
    semantic: {
      active: {
        bgBase: createToken('var(--cw-sig-bg-base)', {
          tailwind: [{ group: 'colors', name: 'active-bg' }],
        }),
        textPrimary: createToken('var(--cw-sig-text-primary)', {
          tailwind: [{ group: 'colors', name: 'active-text.DEFAULT' }],
        }),
        textSecondary: createToken('var(--cw-sig-text-secondary)', {
          tailwind: [{ group: 'colors', name: 'active-text.secondary' }],
        }),
        accentPrimary: createToken('var(--cw-sig-accent-sage)', {
          tailwind: [{ group: 'colors', name: 'active-accent.DEFAULT' }],
        }),
        accentSecondary: createToken('var(--cw-sig-accent-lilac)', {
          tailwind: [{ group: 'colors', name: 'active-accent.secondary' }],
        }),
        border: createToken('rgba(30, 30, 31, 0.1)', {
          tailwind: [{ group: 'colors', name: 'active-border' }],
        }),
        success: createToken('var(--cw-sig-success)', {
          tailwind: [{ group: 'colors', name: 'active-success' }],
        }),
        error: createToken('var(--cw-sig-error)', {
          tailwind: [{ group: 'colors', name: 'active-error' }],
        }),
        warning: createToken('#E39F3A', {
          tailwind: [{ group: 'colors', name: 'active-warning' }],
        }),
      },
      status: {
        infoBg: createToken('#eef3ff', {
          tailwind: [{ group: 'colors', name: 'info.bg' }],
        }),
        infoBorder: createToken('#cbd9ff', {
          tailwind: [{ group: 'colors', name: 'info.border' }],
        }),
        infoText: createToken('#31437d', {
          tailwind: [{ group: 'colors', name: 'info.text' }],
        }),
        warningBg: createToken('#fff7ed', {
          tailwind: [{ group: 'colors', name: 'warning.bg' }],
        }),
        warningBorder: createToken('#fed7aa', {
          tailwind: [{ group: 'colors', name: 'warning.border' }],
        }),
        warningText: createToken('#7c2d12', {
          tailwind: [{ group: 'colors', name: 'warning.text' }],
        }),
        errorBg: createToken('#fef2f2', {
          tailwind: [{ group: 'colors', name: 'error.bg' }],
        }),
        errorBorder: createToken('#fecaca', {
          tailwind: [{ group: 'colors', name: 'error.border' }],
        }),
        errorText: createToken('#7f1d1d', {
          tailwind: [{ group: 'colors', name: 'error.text' }],
        }),
        successBg: createToken('#f0fdf4', {
          tailwind: [{ group: 'colors', name: 'success.bg' }],
        }),
        successBorder: createToken('#bbf7d0', {
          tailwind: [{ group: 'colors', name: 'success.border' }],
        }),
        successText: createToken('#166534', {
          tailwind: [{ group: 'colors', name: 'success.text' }],
        }),
      },
    },
  },
  radius: {
    sm: createToken('8px', { tailwind: [{ group: 'borderRadius', name: 'sm', mode: 'raw' }] }),
    base: createToken('10px', { tailwind: [{ group: 'borderRadius', name: 'DEFAULT', mode: 'raw' }] }),
    md: createToken('12px', { tailwind: [{ group: 'borderRadius', name: 'md', mode: 'raw' }] }),
    lg: createToken('16px', { tailwind: [{ group: 'borderRadius', name: 'lg', mode: 'raw' }] }),
    xl: createToken('24px', { tailwind: [{ group: 'borderRadius', name: 'xl', mode: 'raw' }] }),
    xxl: createToken('32px', { tailwind: [{ group: 'borderRadius', name: '2xl', mode: 'raw' }] }),
  },
  shadow: {
    low: createToken('0 2px 6px rgba(30, 30, 31, 0.08)', {
      tailwind: [{ group: 'boxShadow', name: 'low', mode: 'raw' }],
    }),
    medium: createToken('0 6px 16px rgba(30, 30, 31, 0.12)', {
      tailwind: [{ group: 'boxShadow', name: 'medium', mode: 'raw' }],
    }),
    high: createToken('0 12px 30px rgba(30, 30, 31, 0.18)', {
      tailwind: [{ group: 'boxShadow', name: 'high', mode: 'raw' }],
    }),
    glass: createToken('0 8px 24px rgba(168, 195, 161, 0.2)', {
      tailwind: [{ group: 'boxShadow', name: 'glass', mode: 'raw' }],
    }),
  },
  blur: {
    light: createToken('12px', { tailwind: [{ group: 'backdropBlur', name: 'light', mode: 'raw' }] }),
    medium: createToken('20px', { tailwind: [{ group: 'backdropBlur', name: 'medium', mode: 'raw' }] }),
    heavy: createToken('32px', { tailwind: [{ group: 'backdropBlur', name: 'heavy', mode: 'raw' }] }),
    glassScrim: createToken('24px', {
      tailwind: [{ group: 'backdropBlur', name: 'glass-scrim', mode: 'raw' }],
    }),
    signature: createToken('18px', {
      tailwind: [{ group: 'backdropBlur', name: 'signature', mode: 'raw' }],
    }),
  },
  motion: {
    duration: {
      micro: createToken('0.1s'),
      short: createToken('0.2s'),
      medium: createToken('0.3s'),
      long: createToken('0.5s'),
    },
    easing: {
      easePrimary: createToken('[0.3, 0.8, 0.5, 1]'),
      easeSoft: createToken('[0.25, 0.25, 0.75, 0.75]'),
    },
  },
};
