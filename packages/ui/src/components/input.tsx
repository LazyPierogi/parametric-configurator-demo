import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '../utils/cn';

export interface UIInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  fullWidth?: boolean;
  density?: 'comfortable' | 'compact';
}

const densityClasses: Record<NonNullable<UIInputProps['density']>, string> = {
  comfortable: 'h-11 px-3',
  compact: 'h-10 px-3',
};

export const UIInput = forwardRef<HTMLInputElement, UIInputProps>(
  ({ error = false, fullWidth = false, density = 'comfortable', className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        data-cw-component="Input"
        data-cw-error={error ? 'true' : 'false'}
        data-cw-density={density}
        className={cn(
          'rounded-lg border bg-active-bg text-active-text placeholder:text-active-text/60',
          'transition-all duration-200 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-active-accent/40 focus:border-active-accent',
          'disabled:bg-neutral-100 disabled:text-neutral-500 disabled:cursor-not-allowed',
          densityClasses[density],
          error &&
            'border-active-error text-active-error focus:ring-active-error/40 focus:border-active-error',
          !error && 'border-active-border',
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      />
    );
  },
);

UIInput.displayName = 'UIInput';
