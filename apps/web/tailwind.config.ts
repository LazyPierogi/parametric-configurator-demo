import type { Config } from 'tailwindcss';
import { tailwindExtend } from '../../packages/ui/tokens/generated/tailwind.extend';

const tokenExtend = tailwindExtend as Config['theme'] extends { extend: infer T } ? T : Record<string, unknown>;

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    // Include packages/ui so Tailwind compiles ring-active-accent and other kit classes
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      ...tokenExtend,
      colors: {
        ...(tokenExtend?.colors ?? {}),
        // ===================================
        // HAVINIC HARMONY PALETTE
        // ===================================
        'havinic-bg': 'var(--havinic-bg-base)',
        'havinic-text': {
          DEFAULT: 'var(--havinic-text-primary)',
          secondary: 'var(--havinic-text-secondary)',
        },
        'havinic-accent': {
          DEFAULT: 'var(--havinic-accent-primary)',
          secondary: 'var(--havinic-accent-secondary)',
        },
        'havinic-border': 'var(--havinic-border)',
        'havinic-success': 'var(--havinic-success)',
        'havinic-error': 'var(--havinic-error)',
        'havinic-warning': 'var(--havinic-warning)',
        
        // ===================================
        // CURTAIN WIZARD SIGNATURE PALETTE
        // ===================================
        'cw-sig-bg': 'var(--cw-sig-bg-base)',
        'cw-sig-glass': 'var(--cw-sig-glass-surface)',
        'cw-sig-text': {
          DEFAULT: 'var(--cw-sig-text-primary)',
          secondary: 'var(--cw-sig-text-secondary)',
        },
        'cw-sig-sage': 'var(--cw-sig-accent-sage)',
        'cw-sig-lilac': 'var(--cw-sig-accent-lilac)',
        'cw-sig-error': 'var(--cw-sig-error)',
        'cw-sig-success': 'var(--cw-sig-success)',
        
        // ===================================
        // ACTIVE PALETTE (Runtime Semantic)
        // Use these in components for automatic palette switching
        // ===================================
        'active-bg': 'var(--active-bg-base)',
        'active-text': {
          DEFAULT: 'var(--active-text-primary)',
          secondary: 'var(--active-text-secondary)',
        },
        'active-accent': {
          DEFAULT: 'var(--active-accent-primary)',
          secondary: 'var(--active-accent-secondary)',
        },
        'active-border': 'var(--active-border)',
        'active-success': 'var(--active-success)',
        'active-error': 'var(--active-error)',
        'active-warning': 'var(--active-warning)',
        
        // ===================================
        // LEGACY PRIMARY BRAND COLORS
        // ===================================
        primary: {
          DEFAULT: '#4a67ff',
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#4a67ff',
          600: '#3b5bff',
          700: '#1f2b6c',
          800: '#1e293b',
          900: '#0f172a',
          light: 'rgba(74, 103, 255, 0.12)',
        },
        // Neutral grays
        neutral: {
          50: '#f8fafc',
          100: '#f3f4f6',
          200: '#f1f1f1',
          300: '#d1d5db',
          400: '#94a3b8',
          500: '#6b7280',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        // Semantic colors
        error: {
          DEFAULT: '#ef4444',
          bg: '#fef2f2',
          border: '#fecaca',
          text: '#7f1d1d',
        },
        warning: {
          bg: '#fff7ed',
          border: '#fed7aa',
          text: '#7c2d12',
        },
        info: {
          bg: '#eef3ff',
          border: '#cbd9ff',
          text: '#31437d',
        },
        success: {
          DEFAULT: '#10b981',
          bg: '#f0fdf4',
          border: '#bbf7d0',
          text: '#166534',
        },
        // Additional UI colors
        border: {
          DEFAULT: '#e2e8f0',
          light: '#d4d4d8',
          dashed: '#bbbbbb',
          panel: 'var(--cw-config-panel-border)',
        },
        surface: {
          config: 'var(--cw-config-panel-bg)',
          glass: 'rgb(var(--cw-surface-glass-rgb) / 1)',
        },
        overlay: {
          scrim: 'var(--cw-overlay-scrim)',
          scrimStrong: 'var(--cw-overlay-scrim-strong)',
        },
        highlight: {
          stroke: 'var(--cw-highlight-stroke)',
          fill: 'var(--cw-highlight-fill)',
        },
      },
      borderRadius: {
        ...(tokenExtend?.borderRadius ?? {}),
        sm: '8px',
        DEFAULT: '10px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
      },
      boxShadow: {
        ...(tokenExtend?.boxShadow ?? {}),
        // New design system shadows (sunlight through fabric)
        low: 'var(--shadow-low)',
        medium: 'var(--shadow-medium)',
        high: 'var(--shadow-high)',
        glass: 'var(--shadow-glass)',
        'glass-hover': '0 16px 40px rgba(139, 186, 139, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08)',
        // Legacy shadows
        xs: '0 1px 2px rgba(0, 0, 0, 0.2)',
        sm: '0 1px 4px rgba(79, 70, 229, 0.2)',
        DEFAULT: '0 6px 16px rgba(15, 23, 42, 0.08)',
        md: '0 10px 22px rgba(74, 103, 255, 0.22)',
        lg: '0 18px 44px rgba(0, 0, 0, 0.18)',
        xl: '0 24px 48px rgba(15, 23, 42, 0.35)',
        primary: '0 4px 12px rgba(74, 103, 255, 0.25)',
        'primary-lg': '0 10px 22px rgba(74, 103, 255, 0.22)',
        'primary-xl': '0 6px 16px rgba(74, 103, 255, 0.18)',
        'config-panel': 'var(--cw-config-panel-shadow)',
        'overlay-toast': 'var(--cw-overlay-toast-shadow)',
        'chip-hover': 'var(--cw-chip-hover-shadow)',
        'chip-focus': 'var(--cw-chip-focus-shadow)',
        'debug-handle': 'var(--cw-debug-handle-shadow)',
      },
      backdropBlur: {
        ...(tokenExtend?.backdropBlur ?? {}),
        light: 'var(--blur-light)',
        medium: 'var(--blur-medium)',
        heavy: 'var(--blur-heavy)',
        'glass-scrim': 'var(--blur-glass-scrim)',
        signature: 'var(--blur-signature)',
      },
      spacing: {
        // Already has Tailwind defaults, but adding common app-specific values
        18: '4.5rem', // 72px
      },
      height: {
        // Mobile-first viewport units (Task 1.4)
        'dvh': '100dvh',              // Dynamic viewport height (iOS Safari compatible)
        'svh': '100svh',              // Small viewport height (excludes browser chrome)
        'screen-safe': 'calc(100vh - var(--safe-top) - var(--safe-bottom))',
        'screen-safe-dvh': 'calc(100dvh - var(--safe-top) - var(--safe-bottom))',
        'hero': 'var(--hero-frame-height)',
        'hero-full': 'var(--fullscreen-hero-height)',
        'panel-min': 'var(--panel-min-height)',
        'panel-max': 'var(--panel-max-height)',
      },
      minHeight: {
        'dvh': '100dvh',
        'svh': '100svh',
        'screen-safe': 'calc(100vh - var(--safe-top) - var(--safe-bottom))',
        'hero': 'var(--hero-frame-height)',
      },
      maxHeight: {
        'dvh': '100dvh',
        'svh': '100svh',
        'screen-safe': 'calc(100vh - var(--safe-top) - var(--safe-bottom))',
        'hero': 'var(--hero-frame-height)',
        'hero-full': 'var(--fullscreen-hero-height)',
      },
      fontFamily: {
        // DM Sans for headings, Outfit for body - loaded via next/font in layout.tsx
        sans: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Extending defaults with app-specific sizes
        '2xs': '0.625rem', // 10px
      },
      zIndex: {
        dropdown: '1000',
        modal: '200',
        toast: '250',
      },
    },
  },
  plugins: [],
};

export default config;
