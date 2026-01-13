'use client';

import { RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

export interface CoverageWarningDialogProps {
  open: boolean;
  coverageRatio: number;
  t: (key: string, params?: Record<string, any>) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  onCancel: () => void;
  onConfirm: () => void;
  anchorHeroRef?: RefObject<HTMLElement | null>;
  anchorPanelRef?: RefObject<HTMLElement | null>;
}

export function CoverageWarningDialog({
  open,
  coverageRatio,
  t,
  formatNumber,
  onCancel,
  onConfirm,
  anchorHeroRef,
  anchorPanelRef,
}: CoverageWarningDialogProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Compute desired position between hero and panel, aligned to hero mid-height
  const computePosition = useMemo(() => {
    return () => {
      const heroEl = anchorHeroRef?.current as HTMLElement | null | undefined;
      const panelEl = anchorPanelRef?.current as HTMLElement | null | undefined;
      if (!heroEl) return null;
      const heroRect = heroEl.getBoundingClientRect();
      const panelRect = panelEl ? panelEl.getBoundingClientRect() : null;

      const midY = heroRect.top + heroRect.height / 2;
      let midX: number;
      if (panelRect) {
        // Midpoint between hero right edge and panel left edge
        midX = (heroRect.right + panelRect.left) / 2 - 120;
        // Guard if overlap or panel hidden
        if (Number.isNaN(midX) || panelRect.width === 0) {
          midX = heroRect.right + 24; // fallback: slightly to the right of hero
        }
      } else {
        midX = heroRect.right + 24;
      }
      return { top: midY, left: midX };
    };
  }, [anchorHeroRef, anchorPanelRef]);

  // Keep position in sync with scroll/resize/element resizes
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const p = computePosition();
      if (p) setPos(p);
    };
    update();

    const roHero = anchorHeroRef?.current ? new ResizeObserver(update) : null;
    const roPanel = anchorPanelRef?.current ? new ResizeObserver(update) : null;
    roHero?.observe(anchorHeroRef!.current as Element);
    roPanel?.observe(anchorPanelRef!.current as Element);

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      roHero?.disconnect();
      roPanel?.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [open, computePosition, anchorHeroRef, anchorPanelRef]);

  if (!open || !pos) return null;

  const coveragePercent = Math.round(coverageRatio * 100);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-md shadow-2xl animate-in zoom-in-95 duration-200"
        style={{ position: 'absolute', top: pos.top, left: pos.left, transform: 'translate(-50%, -50%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="text-xl font-bold mb-3 text-active-text">
            {t('configure.coverageWarning.title')}
          </div>
          <div className="mb-5 text-sm text-neutral-600">
            {t('configure.coverageWarning.message', { coverage: formatNumber(coveragePercent) })}
          </div>
          <div className="flex justify-center gap-2.5">
            <Button variant="secondary" onClick={onCancel}>
              {t('configure.coverageWarning.goBack')}
            </Button>
            <Button variant="primary" onClick={onConfirm}>
              {t('configure.coverageWarning.addToCart')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
