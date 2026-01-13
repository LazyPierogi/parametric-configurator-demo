import { forwardRef, SelectHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

export interface UISelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  fullWidth?: boolean;
  density?: 'comfortable' | 'compact';
}

const densityClasses: Record<NonNullable<UISelectProps['density']>, string> = {
  comfortable: 'h-11 text-base',
  compact: 'h-10 text-sm',
};

export const UISelect = forwardRef<HTMLSelectElement, UISelectProps>(
  ({ error = false, fullWidth = false, density = 'comfortable', className, children, ...props }, ref) => (
    <select
      ref={ref}
      data-cw-component="Select"
      data-cw-density={density}
      data-cw-state={error ? 'error' : 'default'}
      className={cn(
        'appearance-none rounded-lg border bg-active-bg px-3 pr-10 font-medium text-active-text shadow-sm transition-all duration-200 ease-out',
        'bg-[length:1.5em_1.5em] bg-[right_0.5rem_center] bg-no-repeat',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none'%3E%3Cpath d='M6 8l4 4 4-4' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")]",
        'focus:outline-none focus:ring-2 focus:ring-active-accent/40 focus:border-active-accent',
        'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500',
        error
          ? 'border-active-error text-active-error focus:ring-active-error/40 focus:border-active-error'
          : 'border-active-border',
        densityClasses[density],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);

UISelect.displayName = 'UISelect';
