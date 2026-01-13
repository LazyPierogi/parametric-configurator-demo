import { forwardRef, HTMLAttributes, useMemo } from 'react';
import { cn } from '../utils/cn';

export type UIProgressSize = 'sm' | 'md' | 'lg';
export type UIProgressTone = 'accent' | 'success' | 'warning' | 'error';

export interface UIProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  size?: UIProgressSize;
  tone?: UIProgressTone;
  showLabel?: boolean;
}

const sizeMap: Record<UIProgressSize, string> = {
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2',
};

const toneMap: Record<UIProgressTone, string> = {
  accent: 'bg-active-accent',
  success: 'bg-success-border',
  warning: 'bg-warning-border',
  error: 'bg-active-error',
};

export const UIProgress = forwardRef<HTMLDivElement, UIProgressProps>(
  ({ value, max = 100, size = 'md', tone = 'accent', showLabel = false, className, ...props }, ref) => {
    const percentage = useMemo(() => {
      if (!Number.isFinite(value) || !Number.isFinite(max) || max === 0) {
        return 0;
      }
      return Math.max(0, Math.min(100, (value / max) * 100));
    }, [value, max]);

    return (
      <div ref={ref} data-cw-component="Progress" data-cw-size={size} className={cn('w-full', className)} {...props}>
        {showLabel ? (
          <div className="mb-1 flex items-center justify-between text-xs text-active-text/70">
            <span>{percentage.toFixed(0)}%</span>
          </div>
        ) : null}
        <div
          className={cn('w-full overflow-hidden rounded-full bg-active-bg/60', sizeMap[size])}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        >
          <div
            className={cn('h-full rounded-full transition-all duration-300 ease-out', toneMap[tone])}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  },
);

UIProgress.displayName = 'UIProgress';
