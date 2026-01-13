/**
 * Motion & Transitions Utilities
 * Based on: docs/UI-UX_Overhaul/# Curtain Wizard — 05_Motion_and_Transitions.md
 * 
 * Motion Philosophy:
 * - Continuity Over Change: Motion stitches moments together
 * - Subtle Reassurance: Movement signals confidence
 * - Material Realism: Transitions behave like soft fabric
 * - Progress Transparency: Users always see what AI is doing
 */

// ========================================
// Motion Tokens
// ========================================

export const motionTokens = {
  duration: {
    micro: 100, // taps, button presses
    short: 200, // panels, modals
    medium: 300, // stage transitions
    long: 500, // delight moments
  },
  easing: {
    primary: 'cubic-bezier(0.3, 0.8, 0.5, 1)', // elastic, reassuring
    soft: 'ease-in-out', // fades
    snap: 'cubic-bezier(0.4, 0, 0.2, 1)', // press feedback
    easeOut: 'ease-out', // smooth and grounded
    // Single-arc rubber-band for panels/containers: quick pull + soft settle.
    rubberBand: 'cubic-bezier(0.18, 0.9, 0.3, 1)',
  },
} as const;

// ========================================
// Page Transition Utilities
// ========================================

/**
 * Prepare page for smooth transition OUT (before navigation)
 * Used when transitioning FROM /estimate TO /configure
 */
export function preparePageTransitionOut(
  element: HTMLElement | null,
  options: {
    duration?: number;
    onComplete?: () => void;
  } = {},
): void {
  if (!element) return;

  const duration = options.duration ?? motionTokens.duration.medium;

  // Apply exit animation
  element.style.transition = `opacity ${duration}ms ${motionTokens.easing.soft}, transform ${duration}ms ${motionTokens.easing.soft}`;
  element.style.opacity = '0';
  element.style.transform = 'scale(0.98)';

  if (options.onComplete) {
    setTimeout(options.onComplete, duration);
  }
}

/**
 * Prepare page for smooth transition IN (after navigation)
 * Used when transitioning TO /configure FROM /estimate
 */
export function preparePageTransitionIn(
  element: HTMLElement | null,
  options: {
    duration?: number;
    delay?: number;
  } = {},
): void {
  if (!element) return;

  const duration = options.duration ?? motionTokens.duration.medium;
  const delay = options.delay ?? 0;

  // Start invisible
  element.style.opacity = '0';
  element.style.transform = 'scale(0.98)';

  // Fade in after delay
  setTimeout(() => {
    element.style.transition = `opacity ${duration}ms ${motionTokens.easing.soft}, transform ${duration}ms ${motionTokens.easing.soft}`;
    element.style.opacity = '1';
    element.style.transform = 'scale(1)';
  }, delay);
}

// ========================================
// Stage Transition Utilities
// ========================================

/**
 * Animate Wall Box Confirmation → Configurator transition
 * - Curtain stabilizes and zooms slightly (1.03×)
 * - Configurator panel slides up (220 ms ease-out)
 * - Background blur locks to 20px
 */
export function animateWallBoxToConfigurator(
  curtainElement: HTMLElement | null,
  panelElement: HTMLElement | null,
  options: {
    onComplete?: () => void;
  } = {},
): void {
  const duration = getConfigureEntryDurationMs();

  // Animate curtain stabilization with subtle zoom
  if (curtainElement) {
    curtainElement.style.transition = `transform ${duration}ms ${motionTokens.easing.easeOut}`;
    curtainElement.style.transform = 'scale(1.03)';
    
    // Reset after animation
    setTimeout(() => {
      curtainElement.style.transition = `transform ${motionTokens.duration.medium}ms ${motionTokens.easing.soft}`;
      curtainElement.style.transform = 'scale(1)';
    }, duration);
  }

  // Animate panel slide up
  if (panelElement) {
    panelElement.style.transition = `opacity ${duration}ms ${motionTokens.easing.easeOut}, transform ${duration}ms ${motionTokens.easing.easeOut}`;
    panelElement.style.opacity = '1';
    panelElement.style.transform = 'translateY(0)';
  }

  if (options.onComplete) {
    setTimeout(options.onComplete, duration);
  }
}

/**
 * Prepare configurator panel for slide-up entrance
 * Call this before the wall box is confirmed to set initial state
 */
export function prepareConfiguratorPanelEntry(element: HTMLElement | null): void {
  if (!element) return;

  element.style.opacity = '0';
  element.style.transform = 'translateY(20px)';
}

// ========================================
// Delight Moments
// ========================================

/**
 * Success pulse animation
 * Used for: AI measurement success, segmentation success, add-to-cart
 */
export function triggerSuccessPulse(
  element: HTMLElement | null,
  options: {
    color?: string;
    duration?: number;
  } = {},
): void {
  if (!element) return;

  const duration = options.duration ?? 400;
  const color = options.color ?? 'var(--cw-accent)';

  // Store original styles
  const originalBoxShadow = element.style.boxShadow;

  // Apply pulse
  element.style.transition = `box-shadow ${duration}ms cubic-bezier(0.17, 0.67, 0.83, 0.67)`;
  element.style.boxShadow = `0 0 0 0 ${color}, 0 0 20px 0 ${color}`;

  // Animate pulse out
  setTimeout(() => {
    element.style.boxShadow = `0 0 0 8px transparent, 0 0 0 0 transparent`;
  }, 50);

  // Reset to original
  setTimeout(() => {
    element.style.boxShadow = originalBoxShadow;
  }, duration);
}

/**
 * White flash for AI success moments
 * Used for: Measurement success, segmentation success
 */
export function triggerSuccessFlash(containerElement: HTMLElement | null): void {
  if (!containerElement) return;

  const flash = document.createElement('div');
  flash.style.position = 'absolute';
  flash.style.inset = '0';
  flash.style.backgroundColor = 'white';
  flash.style.opacity = '0.4';
  flash.style.pointerEvents = 'none';
  flash.style.zIndex = '9999';
  flash.style.transition = 'opacity 40ms ease-out';

  containerElement.style.position = 'relative';
  containerElement.appendChild(flash);

  // Fade out
  requestAnimationFrame(() => {
    flash.style.opacity = '0';
  });

  // Remove after animation
  setTimeout(() => {
    flash.remove();
  }, 100);
}

// ========================================
// Shimmer / Loading States
// ========================================

/**
 * Create shimmer animation overlay - AI scanning beam effect
 * Used for: AI processing, segmentation, measurement
 * Returns cleanup function to remove shimmer
 * 
 * CUSTOMIZATION OPTIONS:
 * - color: Shimmer beam color (default: bright white with high opacity)
 * - duration: Animation speed in ms (default: 1500ms for 1.5s loop)
 * - height: Beam thickness (default: '6px' for visibility)
 * - opacity: Beam intensity 0-1 (default: 0.8 for strong visibility)
 * - glowSize: Shadow blur radius (default: '16px' for glow effect)
 * - beamWidth: Width of bright center (default: '30%' of gradient)
 */
export function createShimmerOverlay(
  containerElement: HTMLElement | null,
  options: {
    color?: string;
    duration?: number;
    height?: string;
    opacity?: number;
    glowSize?: string;
    beamWidth?: string;
  } = {},
): (() => void) | null {
  if (!containerElement) return null;

  // Enhanced defaults for AI scanning beam look
  const color = options.color ?? 'rgba(255, 255, 255, 1)';
  const duration = options.duration ?? 1500;
  const height = options.height ?? '6px';
  const opacity = options.opacity ?? 0.8;
  const glowSize = options.glowSize ?? '16px';
  const beamWidth = options.beamWidth ?? '30%';

  // Create shimmer element
  const shimmer = document.createElement('div');
  shimmer.className = 'cw-shimmer-line';
  shimmer.style.position = 'absolute';
  shimmer.style.top = '0';
  shimmer.style.left = '0';
  shimmer.style.right = '0';
  shimmer.style.height = height;
  shimmer.style.opacity = String(opacity);
  
  // AI scanning beam: bright center with soft edges + glow
  shimmer.style.background = `linear-gradient(90deg, 
    transparent 0%, 
    transparent calc(50% - ${beamWidth}), 
    ${color} 50%, 
    transparent calc(50% + ${beamWidth}), 
    transparent 100%)`;
  shimmer.style.backgroundSize = '200% 100%';
  shimmer.style.pointerEvents = 'none';
  shimmer.style.zIndex = '100';
  shimmer.style.animation = `shimmerSlide ${duration}ms linear infinite`;
  
  // Add glow effect for "scanning" look
  shimmer.style.boxShadow = `0 0 ${glowSize} ${color}, 0 0 calc(${glowSize} / 2) ${color}`;
  shimmer.style.filter = `blur(0.5px)`;
  
  // Add keyframes if not already present
  if (!document.getElementById('cw-shimmer-keyframes')) {
    const style = document.createElement('style');
    style.id = 'cw-shimmer-keyframes';
    style.textContent = `
      @keyframes shimmerSlide {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
    `;
    document.head.appendChild(style);
  }

  containerElement.appendChild(shimmer);

  // Return cleanup function
  return () => {
    shimmer.remove();
  };
}

export function createVerticalSweepOverlay(
  containerElement: HTMLElement | null,
  options: {
    color?: string;
    duration?: number;
    height?: string;
    opacity?: number;
    glowSize?: string;
    zIndex?: number;
    mixBlendMode?: 'normal' | 'screen' | 'soft-light' | 'overlay' | 'lighten';
  } = {},
): (() => void) | null {
  if (!containerElement) return null;

  const computedPosition = typeof window !== 'undefined' ? window.getComputedStyle(containerElement).position : '';
  const prevPosition = containerElement.style.position;
  const mustSetRelative = computedPosition === 'static' || computedPosition === '';
  if (mustSetRelative) {
    containerElement.style.position = 'relative';
  }

  const color = options.color ?? 'rgba(255, 255, 255, 1)';
  const duration = options.duration ?? 2200;
  const height = options.height ?? '180px';
  const opacity = options.opacity ?? 0.18;
  const glowSize = options.glowSize ?? '18px';
  const zIndex = options.zIndex ?? 25;
  const mixBlendMode = options.mixBlendMode ?? 'soft-light';

  const sweep = document.createElement('div');
  sweep.className = 'cw-vertical-sweep';
  sweep.style.position = 'absolute';
  sweep.style.inset = '0';
  sweep.style.pointerEvents = 'none';
  sweep.style.zIndex = String(zIndex);
  sweep.style.opacity = String(opacity);
  sweep.style.mixBlendMode = mixBlendMode;
  sweep.style.setProperty('--cw-sweep-height', height);
  sweep.style.setProperty('--cw-sweep-color', color);
  sweep.style.background = `linear-gradient(180deg,
    transparent 0%,
    rgba(255, 255, 255, 0.0) 18%,
    var(--cw-sweep-color) 50%,
    rgba(255, 255, 255, 0.0) 82%,
    transparent 100%)`;
  sweep.style.backgroundRepeat = 'no-repeat';
  sweep.style.backgroundSize = '100% var(--cw-sweep-height)';
  sweep.style.backgroundPosition = `0 calc(var(--cw-sweep-height) * -1)`;
  sweep.style.filter = `blur(0.6px)`;
  sweep.style.boxShadow = `0 0 ${glowSize} ${color}`;
  sweep.style.animation = `cwSweepY ${duration}ms ${motionTokens.easing.soft} infinite`;

  if (!document.getElementById('cw-sweep-keyframes')) {
    const style = document.createElement('style');
    style.id = 'cw-sweep-keyframes';
    style.textContent = `
      @keyframes cwSweepY {
        0% { background-position: 0 calc(var(--cw-sweep-height) * -1); }
        100% { background-position: 0 calc(100% + var(--cw-sweep-height)); }
      }
    `;
    document.head.appendChild(style);
  }

  containerElement.appendChild(sweep);

  return () => {
    sweep.remove();
    if (mustSetRelative) {
      containerElement.style.position = prevPosition;
    }
  };
}

/**
 * Create pulsing shimmer effect (for static progress indication)
 * Used when reduced motion is preferred
 */
export function createPulsingIndicator(
  containerElement: HTMLElement | null,
  options: {
    color?: string;
    size?: string;
  } = {},
): (() => void) | null {
  if (!containerElement) return null;

  const color = options.color ?? 'rgba(255, 255, 255, 0.6)';
  const size = options.size ?? '8px';

  const indicator = document.createElement('div');
  indicator.className = 'cw-pulse-indicator';
  indicator.style.position = 'absolute';
  indicator.style.top = '12px';
  indicator.style.right = '12px';
  indicator.style.width = size;
  indicator.style.height = size;
  indicator.style.borderRadius = '50%';
  indicator.style.background = color;
  indicator.style.pointerEvents = 'none';
  indicator.style.zIndex = '100';
  indicator.style.animation = 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite';
  
  // Add keyframes if not already present
  if (!document.getElementById('cw-pulse-keyframes')) {
    const style = document.createElement('style');
    style.id = 'cw-pulse-keyframes';
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
    `;
    document.head.appendChild(style);
  }

  containerElement.appendChild(indicator);

  return () => {
    indicator.remove();
  };
}

// ========================================
// Accessibility
// ========================================

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get adjusted duration based on reduced motion preference
 */
export function getAdjustedDuration(duration: number): number {
  return prefersReducedMotion() ? Math.min(duration, 100) : duration;
}

export function getConfigureEntryDurationMs(): number {
  return getAdjustedDuration(motionTokens.duration.long + motionTokens.duration.short);
}

/**
 * Get adjusted easing based on reduced motion preference
 */
export function getAdjustedEasing(easing: string): string {
  return prefersReducedMotion() ? 'ease-out' : easing;
}
