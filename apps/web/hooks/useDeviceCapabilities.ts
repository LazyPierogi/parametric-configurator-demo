import { useState, useEffect } from 'react';

/**
 * Device capabilities detected via feature queries (not pixel-based breakpoints)
 */
export interface DeviceCapabilities {
  /** Touch screen available (any touch points) */
  hasTouch: boolean;
  
  /** Precise hover capability (mouse/trackpad) */
  hasHover: boolean;
  
  /** Coarse pointer input (touch/stylus - less precise) */
  hasCoarsePointer: boolean;
  
  /** Fine pointer input (mouse - precise) */
  hasFinePointer: boolean;
  
  /** Viewport width < 768px */
  isSmallScreen: boolean;
  
  /** Viewport width < 1024px */
  isMediumScreen: boolean;
  
  /** Prefers reduced motion (accessibility) */
  prefersReducedMotion: boolean;
  
  /** 
   * Recommended: Use compact/mobile layout
   * True when: Small screen OR (touch-only device without hover)
   */
  useCompactLayout: boolean;
}

const SSR_DEFAULT_CAPABILITIES: DeviceCapabilities = {
  hasTouch: true,
  hasHover: false,
  hasCoarsePointer: true,
  hasFinePointer: false,
  isSmallScreen: true,
  isMediumScreen: true,
  prefersReducedMotion: false,
  useCompactLayout: true,
};

/**
 * Hook: Detect device capabilities using modern feature queries
 * 
 * @example
 * ```tsx
 * const { hasTouch, hasHover, useCompactLayout } = useDeviceCapabilities();
 * 
 * // Layout decision
 * return useCompactLayout ? <MobileLayout /> : <DesktopLayout />;
 * 
 * // Interaction tuning
 * const tapTargetSize = hasTouch ? 48 : 32;
 * const showHoverEffects = hasHover;
 * ```
 * 
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@media/hover
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@media/pointer
 */
export function useDeviceCapabilities(): DeviceCapabilities {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>(
    () => SSR_DEFAULT_CAPABILITIES,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Re-detect on mount (hydration)
    setCapabilities(detectCapabilities());

    // Media queries to monitor
    const queries = {
      hover: window.matchMedia('(hover: hover)'),
      coarse: window.matchMedia('(pointer: coarse)'),
      fine: window.matchMedia('(pointer: fine)'),
      smallScreen: window.matchMedia('(max-width: 767px)'),
      mediumScreen: window.matchMedia('(max-width: 1023px)'),
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)'),
    };

    // Update handler
    const updateCapabilities = () => {
      setCapabilities(detectCapabilities());
    };

    // Attach listeners (rare but possible: external monitor, dock/undock, etc.)
    Object.values(queries).forEach((query) => {
      // Modern API
      if (query.addEventListener) {
        query.addEventListener('change', updateCapabilities);
      } else {
        // Legacy fallback
        query.addListener(updateCapabilities);
      }
    });

    // Cleanup
    return () => {
      Object.values(queries).forEach((query) => {
        if (query.removeEventListener) {
          query.removeEventListener('change', updateCapabilities);
        } else {
          query.removeListener(updateCapabilities);
        }
      });
    };
  }, []);

  return capabilities;
}

/**
 * Internal: Detect current device capabilities
 */
function detectCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    // SSR fallback
    return SSR_DEFAULT_CAPABILITIES;
  }

  // Feature detection via media queries (modern standard)
  const hasHover = window.matchMedia('(hover: hover)').matches;
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
  const isSmallScreen = window.matchMedia('(max-width: 767px)').matches;
  const isMediumScreen = window.matchMedia('(max-width: 1023px)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Touch detection (multiple methods for broad compatibility)
  const hasTouch =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore - Legacy IE/Edge
    (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0);

  // Decide layout strategy
  // Compact layout when:
  // - Medium screen (< 1024px), OR
  // - Touch-only device (has touch but no hover capability)
  const useCompactLayout = isMediumScreen || (hasTouch && !hasHover);

  return {
    hasTouch,
    hasHover,
    hasCoarsePointer,
    hasFinePointer,
    isSmallScreen,
    isMediumScreen,
    prefersReducedMotion,
    useCompactLayout,
  };
}
