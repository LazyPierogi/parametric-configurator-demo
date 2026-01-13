'use client';

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { STORAGE_KEYS } from './storage-keys';

/**
 * Palette types for Curtain Wizard
 * - havinic: Storefront integration (warm, tactile)
 * - signature: Standalone app (liquid glass, premium)
 * - hybrid: Transition mode (used during checkout handoff)
 */
export type Palette = 'havinic' | 'signature' | 'hybrid';

interface PaletteContextValue {
  current: Palette;
  setPalette: (palette: Palette) => void;
  isTransitioning: boolean;
}

const PaletteContext = createContext<PaletteContextValue | undefined>(undefined);

interface PaletteProviderProps {
  children: ReactNode;
  initialPalette?: Palette;
  persistToStorage?: boolean;
}

const STORAGE_KEY = STORAGE_KEYS.PALETTE_PREFERENCE;

/**
 * PaletteProvider
 * 
 * Manages the active color palette for the Curtain Wizard app.
 * Supports runtime switching with smooth 300ms cross-fade transitions.
 * 
 * @example
 * ```tsx
 * // In your root layout or app wrapper
 * <PaletteProvider initialPalette="signature">
 *   <YourApp />
 * </PaletteProvider>
 * ```
 */
export function PaletteProvider({
  children,
  initialPalette,
  persistToStorage = true,
}: PaletteProviderProps) {
  // Use environment variable as fallback if no initialPalette provided
  const defaultPalette = (initialPalette || 
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DEFAULT_PALETTE) || 
    'havinic') as Palette;
  
  const [current, setCurrent] = useState<Palette>(defaultPalette);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Load palette preference from localStorage on mount
  useEffect(() => {
    if (persistToStorage && typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY) as Palette | null;
      if (stored && ['havinic', 'signature', 'hybrid'].includes(stored)) {
        setCurrent(stored);
      }
    }
  }, [persistToStorage]);

  // Apply palette CSS variables when palette changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    setIsTransitioning(true);

    // Apply palette-specific CSS variables
    applyPaletteVariables(root, current);

    // Mark transition complete after 300ms
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [current]);

  const setPalette = (palette: Palette) => {
    setCurrent(palette);
    
    // Persist to localStorage
    if (persistToStorage && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, palette);
    }
  };

  return (
    <PaletteContext.Provider value={{ current, setPalette, isTransitioning }}>
      {children}
    </PaletteContext.Provider>
  );
}

/**
 * usePalette Hook
 * 
 * Access the current palette and palette switching functionality.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { current, setPalette, isTransitioning } = usePalette();
 *   
 *   return (
 *     <button onClick={() => setPalette('havinic')}>
 *       Switch to Havinic {isTransitioning && '...'}
 *     </button>
 *   );
 * }
 * ```
 */
export function usePalette() {
  const context = useContext(PaletteContext);
  
  if (context === undefined) {
    throw new Error('usePalette must be used within a PaletteProvider');
  }
  
  return context;
}

/**
 * Apply palette-specific CSS variables to the root element
 * This function maps semantic tokens to palette-specific values
 */
function applyPaletteVariables(root: HTMLElement, palette: Palette) {
  // Add transition class for smooth cross-fade
  root.style.transition = 'background-color 300ms ease, color 300ms ease';

  switch (palette) {
    case 'havinic':
      // Map Havinic Harmony palette to semantic tokens
      root.style.setProperty('--active-bg-base', 'var(--havinic-bg-base)');
      root.style.setProperty('--active-text-primary', 'var(--havinic-text-primary)');
      root.style.setProperty('--active-text-secondary', 'var(--havinic-text-secondary)');
      root.style.setProperty('--active-accent-primary', 'var(--havinic-accent-primary)');
      root.style.setProperty('--active-accent-secondary', 'var(--havinic-accent-secondary)');
      root.style.setProperty('--active-border', 'var(--havinic-border)');
      root.style.setProperty('--active-success', 'var(--havinic-success)');
      root.style.setProperty('--active-error', 'var(--havinic-error)');
      root.style.setProperty('--active-warning', 'var(--havinic-warning)');
      
      // Set data attribute for CSS selectors
      root.setAttribute('data-palette', 'havinic');
      break;

    case 'signature':
      // Map CW Signature palette to semantic tokens
      root.style.setProperty('--active-bg-base', 'var(--cw-sig-bg-base)');
      root.style.setProperty('--active-text-primary', 'var(--cw-sig-text-primary)');
      root.style.setProperty('--active-text-secondary', 'var(--cw-sig-text-secondary)');
      root.style.setProperty('--active-accent-primary', 'var(--cw-sig-accent-sage)');
      root.style.setProperty('--active-accent-secondary', 'var(--cw-sig-accent-lilac)');
      root.style.setProperty('--active-border', 'rgba(30, 30, 31, 0.1)'); // Subtle border for signature
      root.style.setProperty('--active-success', 'var(--cw-sig-success)');
      root.style.setProperty('--active-error', 'var(--cw-sig-error)');
      root.style.setProperty('--active-warning', '#E39F3A'); // Warm amber
      
      // Set data attribute for CSS selectors
      root.setAttribute('data-palette', 'signature');
      break;

    case 'hybrid':
      // Hybrid mode: blend of both palettes (used during checkout transition)
      // Start with Signature, gradually shift to Havinic
      root.style.setProperty('--active-bg-base', 'var(--cw-sig-bg-base)');
      root.style.setProperty('--active-text-primary', 'var(--havinic-text-primary)');
      root.style.setProperty('--active-text-secondary', 'var(--havinic-text-secondary)');
      root.style.setProperty('--active-accent-primary', 'var(--havinic-accent-primary)');
      root.style.setProperty('--active-accent-secondary', 'var(--cw-sig-accent-lilac)');
      root.style.setProperty('--active-border', 'var(--havinic-border)');
      root.style.setProperty('--active-success', 'var(--havinic-success)');
      root.style.setProperty('--active-error', 'var(--havinic-error)');
      root.style.setProperty('--active-warning', 'var(--havinic-warning)');
      
      // Set data attribute for CSS selectors
      root.setAttribute('data-palette', 'hybrid');
      break;
  }
}
