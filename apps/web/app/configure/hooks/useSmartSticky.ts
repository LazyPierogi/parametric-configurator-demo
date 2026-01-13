"use client";

import { useEffect, useRef, useState } from 'react';

type SmartStickyArgs = {
  /**
   * Layout mode drives whether Hero sticky tracking is active.
   * - 'desktop'  → two-column layout, Hero sticky tracked
   * - 'compact'  → single-column mobile layout, Hero sticky tracked
   */
  layoutMode: 'desktop' | 'compact';
  /** Threshold in px from top when hero is considered "stuck" */
  thresholdPx?: number;
};

/**
 * Simplified sticky hook that only tracks when Hero becomes stuck.
 * Summary footer is now CSS sticky (bottom: 0) - no JS pinning needed.
 */
export function useSmartSticky({ layoutMode, thresholdPx = 24 }: SmartStickyArgs) {
  const heroStickyRef = useRef<HTMLDivElement | null>(null);
  // Keep summaryStickyRef for backward compatibility but it's no longer used
  const summaryStickyRef = useRef<HTMLDivElement | null>(null);
  const [heroStuck, setHeroStuck] = useState(false);

  useEffect(() => {
    let frame: number | null = null;
    const STUCK_THRESHOLD = thresholdPx;

    const measure = () => {
      const heroEl = heroStickyRef.current;
      if (!heroEl) {
        setHeroStuck(false);
        return;
      }
      const heroRect = heroEl.getBoundingClientRect();
      if (heroRect.width <= 0 || heroRect.height <= 0) {
        setHeroStuck(false);
        return;
      }
      const heroDocked = heroRect.top <= STUCK_THRESHOLD;
      setHeroStuck((prev) => (prev === heroDocked ? prev : heroDocked));
    };

    const onScrollOrResize = () => {
      if (frame != null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        measure();
      });
    };

    measure();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      if (frame != null) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [thresholdPx]);

  return { heroStickyRef, summaryStickyRef, heroStuck };
}
