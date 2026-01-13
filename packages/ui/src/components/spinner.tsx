import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '../utils/cn';

export type UISpinnerSize = 'sm' | 'md' | 'lg';
export type UISpinnerColor = 'light' | 'accent' | 'neutral';

export interface UISpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: UISpinnerSize;
  color?: UISpinnerColor;
}

const sizeClasses: Record<UISpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-12 w-12 border-4',
};

const colorClasses: Record<UISpinnerColor, string> = {
  light: 'border-white/40 border-t-white',
  accent: 'border-active-accent/30 border-t-active-accent',
  neutral: 'border-active-border border-t-active-text',
};

export const UISpinner = forwardRef<HTMLDivElement, UISpinnerProps>(
  ({ size = 'md', color = 'accent', className, ...props }, ref) => (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      data-cw-component="Spinner"
      data-cw-size={size}
      className={cn(
        'inline-block animate-spin rounded-full border-solid transition-opacity',
        sizeClasses[size],
        colorClasses[color],
        className,
      )}
      {...props}
    >
      <span className="sr-only">Loading</span>
    </div>
  ),
);

UISpinner.displayName = 'UISpinner';
