import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export type BannerVariant = 'info' | 'warning' | 'error' | 'success';

export interface BannerProps {
  /** Banner content */
  children: ReactNode;
  /** Visual style variant */
  variant?: BannerVariant;
  /** Optional custom className */
  className?: string;
  /** Optional icon element */
  icon?: ReactNode;
  /** Dismissible banner with close button */
  onDismiss?: () => void;
}

const variantStyles: Record<BannerVariant, string> = {
  info: 'border-info-border bg-info-bg text-info-text',
  warning: 'border-warning-border bg-warning-bg text-warning-text',
  error: 'border-error-border bg-error-bg text-error-text',
  success: 'border-success-border bg-success-bg text-success-text',
};

// Note: Color tokens defined in tailwind.config.ts and globals.css

/**
 * Banner component for inline notifications and status messages.
 * 
 * @example
 * ```tsx
 * <Banner variant="info">
 *   Cache restored from offline storage
 * </Banner>
 * 
 * <Banner variant="warning" onDismiss={() => console.log('dismissed')}>
 *   This configuration exceeds recommended dimensions
 * </Banner>
 * ```
 */
export function Banner({
  children,
  variant = 'info',
  className,
  icon,
  onDismiss,
}: BannerProps) {
  return (
    <div
      className={cn(
        'rounded-[10px] border px-3 py-2 text-sm',
        variantStyles[variant],
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        {icon && <div className="flex-shrink-0 mt-0.5">{icon}</div>}
        <div className="flex-1 min-w-0">{children}</div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 ml-2 -mr-1 rounded p-1 hover:bg-black/5 transition-colors"
            aria-label="Dismiss"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8m0-8l-8 8" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
