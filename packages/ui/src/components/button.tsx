import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn';

export type UIButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type UIButtonSize = 'sm' | 'md' | 'lg';

export interface UIButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: UIButtonVariant;
  size?: UIButtonSize;
  fullWidth?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

const variantClasses: Record<UIButtonVariant, string> = {
  primary:
    'bg-active-accent text-white shadow-low border border-transparent hover:opacity-90 active:opacity-80',
  secondary:
    'bg-active-bg text-active-accent border border-active-border hover:bg-neutral-50 active:bg-neutral-100',
  ghost:
    'bg-transparent text-active-text border border-transparent hover:bg-neutral-100 active:bg-neutral-200',
  danger:
    'bg-active-error text-white shadow-low border border-transparent hover:opacity-90 active:opacity-80',
};

const sizeClasses: Record<UIButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-base',
  lg: 'h-12 px-6 text-lg',
};

export const UIButton = forwardRef<HTMLButtonElement, UIButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      startIcon,
      endIcon,
      className,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        data-cw-component="Button"
        data-cw-variant={variant}
        data-cw-size={size}
        data-cw-fullwidth={fullWidth ? 'true' : 'false'}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors duration-200 ease-out no-underline hover:!no-underline active:!no-underline',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-active-accent/40 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:pointer-events-none',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {startIcon && <span className="inline-flex items-center">{startIcon}</span>}
        <span className="whitespace-nowrap">{children}</span>
        {endIcon && <span className="inline-flex items-center">{endIcon}</span>}
      </button>
    );
  },
);

UIButton.displayName = 'UIButton';
