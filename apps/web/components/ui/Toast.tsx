import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export type ToastPosition = 'top' | 'center' | 'bottom';

export interface ToastProps {
  /** Toast message content */
  children: ReactNode;
  /** Position on screen */
  position?: ToastPosition;
  /** Optional custom className */
  className?: string;
  /** Vertical offset in pixels (positive = down, negative = up) */
  offsetY?: number;
  /** Show/hide state */
  show?: boolean;
}

const positionStyles: Record<ToastPosition, string> = {
  top: 'top-[10%]',
  center: 'top-1/2 -translate-y-1/2',
  bottom: 'bottom-[10%]',
};

/**
 * Toast component for temporary overlay notifications.
 * Typically used for contextual messages that appear on top of content.
 * 
 * @example
 * ```tsx
 * <Toast show={showMessage} position="center">
 *   Curtain width clamped to maximum fabric size
 * </Toast>
 * 
 * <Toast show={showStitchNotice} position="center" offsetY={64}>
 *   Fabric will be stitched together
 * </Toast>
 * ```
 */
export function Toast({
  children,
  position = 'center',
  className,
  offsetY = 0,
  show = true,
}: ToastProps) {
  if (!show) return null;

  return (
    <div
      className={cn(
        'pointer-events-none fixed left-1/2 z-[300] max-w-[72%] -translate-x-1/2',
        'rounded-[14px] px-[18px] py-3 cw-frosted-overlay-strong',
        'text-center text-sm font-semibold tracking-[0.2px] text-white',
        'shadow-overlay-toast',
        positionStyles[position],
        className
      )}
      style={offsetY !== 0 ? { transform: `translate(-50%, ${offsetY}px)` } : undefined}
      role="alert"
      aria-live="assertive"
    >
      {children}
    </div>
  );
}
