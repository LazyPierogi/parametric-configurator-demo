'use client';

import { useEffect, useCallback } from 'react';
import { usePalette, type Palette } from '@/lib/palette-context';

interface PaletteSwitchOptions {
  /**
   * Duration of the cross-fade transition in milliseconds
   * @default 300
   */
  duration?: number;
  
  /**
   * Easing function for the transition
   * @default 'ease'
   */
  easing?: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
  
  /**
   * Callback fired when transition starts
   */
  onTransitionStart?: (from: Palette, to: Palette) => void;
  
  /**
   * Callback fired when transition completes
   */
  onTransitionEnd?: (palette: Palette) => void;
}

/**
 * usePaletteSwitch Hook
 * 
 * Advanced hook for palette switching with transition control and callbacks.
 * Builds on top of usePalette() to provide smooth cross-fade animations.
 * 
 * @example
 * ```tsx
 * function CheckoutButton() {
 *   const { switchTo, isTransitioning } = usePaletteSwitch({
 *     duration: 300,
 *     onTransitionEnd: (palette) => {
 *       console.log('Switched to:', palette);
 *     }
 *   });
 *   
 *   const handleCheckout = () => {
 *     // Signature → Havinic transition for storefront handoff
 *     switchTo('havinic');
 *   };
 *   
 *   return (
 *     <button onClick={handleCheckout} disabled={isTransitioning}>
 *       Finalize Purchase
 *     </button>
 *   );
 * }
 * ```
 */
export function usePaletteSwitch(options: PaletteSwitchOptions = {}) {
  const {
    duration = 300,
    easing = 'ease',
    onTransitionStart,
    onTransitionEnd,
  } = options;

  const { current, setPalette, isTransitioning } = usePalette();

  // Apply transition timing to root element
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const root = document.documentElement;
    root.style.transition = `background-color ${duration}ms ${easing}, color ${duration}ms ${easing}`;
    
    return () => {
      root.style.transition = '';
    };
  }, [duration, easing]);

  /**
   * Switch to a new palette with transition callbacks
   */
  const switchTo = useCallback(
    (targetPalette: Palette) => {
      if (current === targetPalette) return;
      
      // Fire transition start callback
      onTransitionStart?.(current, targetPalette);
      
      // Trigger palette change
      setPalette(targetPalette);
      
      // Fire transition end callback after duration
      setTimeout(() => {
        onTransitionEnd?.(targetPalette);
      }, duration);
    },
    [current, setPalette, duration, onTransitionStart, onTransitionEnd]
  );

  /**
   * Transition to hybrid mode (useful for checkout flow)
   */
  const transitionToHybrid = useCallback(() => {
    switchTo('hybrid');
  }, [switchTo]);

  /**
   * Transition from hybrid back to signature or havinic
   */
  const transitionFromHybrid = useCallback(
    (targetPalette: 'signature' | 'havinic') => {
      if (current !== 'hybrid') {
        console.warn('transitionFromHybrid called but current palette is not hybrid');
      }
      switchTo(targetPalette);
    },
    [current, switchTo]
  );

  return {
    current,
    switchTo,
    transitionToHybrid,
    transitionFromHybrid,
    isTransitioning,
  };
}

/**
 * useAutoDetectPalette Hook
 * 
 * Automatically detect and set palette based on context (iframe vs standalone).
 * Useful for apps that need to adapt to their embedding environment.
 * 
 * @example
 * ```tsx
 * function App() {
 *   useAutoDetectPalette({
 *     iframeDetected: 'havinic',
 *     standalone: 'signature'
 *   });
 *   
 *   return <YourApp />;
 * }
 * ```
 */
export function useAutoDetectPalette(config: {
  iframeDetected: Palette;
  standalone: Palette;
}) {
  const { setPalette } = usePalette();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect if running in iframe
    const isIframe = window.self !== window.top;
    
    // Set appropriate palette
    const targetPalette = isIframe ? config.iframeDetected : config.standalone;
    setPalette(targetPalette);
  }, [config.iframeDetected, config.standalone, setPalette]);
}

/**
 * useCheckoutPaletteTransition Hook
 * 
 * Specialized hook for the checkout flow palette transition.
 * Handles the Signature → Hybrid → Havinic sequence automatically.
 * 
 * @example
 * ```tsx
 * function SummaryPanel() {
 *   const { startCheckoutTransition } = useCheckoutPaletteTransition();
 *   
 *   const handleFinalizePurchase = () => {
 *     startCheckoutTransition(() => {
 *       // Hand off to storefront cart
 *       window.parent.postMessage({ type: 'add-to-cart', ... }, '*');
 *     });
 *   };
 *   
 *   return <button onClick={handleFinalizePurchase}>Finalize Purchase</button>;
 * }
 * ```
 */
export function useCheckoutPaletteTransition() {
  const { switchTo } = usePaletteSwitch({
    duration: 300,
    easing: 'ease-out',
  });

  /**
   * Execute the checkout palette transition sequence:
   * 1. Signature → Hybrid (150ms)
   * 2. Hybrid → Havinic (150ms)
   * 3. Execute callback (e.g., cart handoff)
   */
  const startCheckoutTransition = useCallback(
    (onComplete?: () => void) => {
      // Step 1: Transition to hybrid
      switchTo('hybrid');
      
      // Step 2: After 150ms, transition to havinic
      setTimeout(() => {
        switchTo('havinic');
        
        // Step 3: After another 150ms, execute callback
        setTimeout(() => {
          onComplete?.();
        }, 150);
      }, 150);
    },
    [switchTo]
  );

  return { startCheckoutTransition };
}
