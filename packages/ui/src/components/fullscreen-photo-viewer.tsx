import { CSSProperties, ReactNode, Ref, RefObject, forwardRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../utils/cn';

export interface FullscreenPhotoViewerProps {
  open: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
  /**
   * Optional animation duration for enter transition.
   * Pass app motion token-adjusted value to keep consistency.
   */
  durationMs?: number;
  /**
   * Optional ref to underlying <img> element (for measurement in callers)
   */
  imageRef?: RefObject<HTMLImageElement | null>;
  /**
   * Renders above the image, clipped to rounded container (e.g., polygon overlay).
   */
  overlay?: ReactNode;
  /**
   * Busy overlay shown above everything inside image card (e.g., HEIC converting spinner).
   */
  busyOverlay?: ReactNode;
  /**
   * Footer area below the image (e.g., back button row).
   */
  footer?: ReactNode;
  /** Additional classes for outer fixed container */
  className?: string;
}

export const FullscreenPhotoViewer = forwardRef<HTMLDivElement, FullscreenPhotoViewerProps>(
  ({ open, onClose, src, alt, durationMs, imageRef, overlay, busyOverlay, footer, className }, ref) => {
    const style: CSSProperties | undefined = durationMs
      ? { animationDuration: `${durationMs}ms` }
      : undefined;

    // Lock page scroll while fullscreen is open; restore when closed/unmounted
    useEffect(() => {
      if (!open) return;
      if (typeof document === 'undefined') return;
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      const originalHtmlOverscroll = (document.documentElement.style as any).overscrollBehaviorY;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      (document.documentElement.style as any).overscrollBehaviorY = 'contain';
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
        (document.documentElement.style as any).overscrollBehaviorY = originalHtmlOverscroll;
      };
    }, [open]);

    // Safety: ensure scroll is unlocked whenever viewer is closed (including if cleanup skipped)
    useEffect(() => {
      if (open) return;
      if (typeof document === 'undefined') return;
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      (document.documentElement.style as any).overscrollBehaviorY = '';
    }, [open]);

    // Close on Escape
    useEffect(() => {
      if (!open) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          try { e.preventDefault(); } catch {}
          onClose();
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [onClose, open]);

    if (!open) {
      return null;
    }

    const content = (
      <div
        ref={ref}
        className={cn('fixed inset-0 z-50 flex flex-col bg-active-bg animate-in fade-in zoom-in-95', className)}
        style={style}
        role="dialog"
        aria-modal="true"
        data-cw-component="FullscreenPhotoViewer"
        onClick={() => onClose()}
      >
        <div className="flex-1 flex flex-col items-center justify-end px-2 pb-6 pt-4 overflow-y-auto">
          <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
            <img
              ref={imageRef as any}
              src={src}
              alt={alt ?? ''}
              className="w-full h-auto rounded-2xl shadow-high select-none"
              draggable={false}
            />

            {busyOverlay}

            {overlay && (
              <div className="absolute inset-0 z-20 rounded-2xl overflow-hidden">
                {overlay}
              </div>
            )}
          </div>
          {footer && (
            <div className="w-full px-2 mt-3 sticky bottom-0" onClick={(e) => e.stopPropagation()}>
              {footer}
            </div>
          )}
        </div>
      </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(content, document.body);
  },
);

FullscreenPhotoViewer.displayName = 'FullscreenPhotoViewer';
