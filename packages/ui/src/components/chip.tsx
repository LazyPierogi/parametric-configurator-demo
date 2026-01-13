import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../utils/cn';

export type UIChipVariant = 'default' | 'swatch';

export interface UIChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  variant?: UIChipVariant;
  sku?: string;
  name?: string;
  thumbnail?: string;
}

export const UIChip = forwardRef<HTMLButtonElement, UIChipProps>(
  ({ selected = false, variant = 'default', className, children, ...props }, ref) => {
    if (variant === 'swatch') {
      return (
        <button
          ref={ref}
          type="button"
          data-cw-component="Chip"
          data-cw-variant="swatch"
          data-cw-selected={selected ? 'true' : 'false'}
          data-sku={props.sku}
          data-name={props.name}
          data-thumbnail={props.thumbnail}
          className={cn(
            'inline-flex items-center justify-center rounded-full flex-shrink-0',
            'w-9 h-9 md:w-10 md:h-10',
            'transition-all duration-200 ease-out',
            'no-underline hover:!no-underline active:!no-underline',
            'border-0 bg-transparent p-0 appearance-none',
            'focus-visible:outline-none',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            className,
          )}
          {...props}
        >
          <span
            className={cn(
              'inline-flex items-center justify-center rounded-full flex-shrink-0',
              selected && 'ring-[2px] ring-active-accent ring-offset-[2px]',
            )}
          >
            {children}
          </span>
        </button>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        data-cw-component="Chip"
        data-cw-variant="default"
        data-cw-selected={selected ? 'true' : 'false'}
        data-sku={props.sku}
        data-name={props.name}
        data-thumbnail={props.thumbnail}
        className={cn(
          'inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold',
          'transition-all duration-200 ease-out border',
          'no-underline hover:!no-underline active:!no-underline',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-active-accent/40 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          selected
            ? 'border-active-accent bg-active-accent text-white shadow-[0_8px_16px_rgba(0,0,0,0.12)]'
            : 'border-active-border bg-active-bg text-active-text hover:border-active-accent/40 hover:bg-active-accent/10',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

UIChip.displayName = 'UIChip';
