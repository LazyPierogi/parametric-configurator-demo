import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '../utils/cn';

export type UICardVariant = 'default' | 'selectable' | 'elevated';

export interface UICardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: UICardVariant;
  selected?: boolean;
  hoverable?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const variantClasses: Record<UICardVariant, string> = {
  default: 'bg-active-bg border border-active-border shadow-sm',
  selectable: 'bg-active-bg border border-active-border cursor-pointer',
  elevated: 'bg-active-bg border border-active-border shadow-md',
};

const paddingClasses: Record<NonNullable<UICardProps['padding']>, string> = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const UICard = forwardRef<HTMLDivElement, UICardProps>(
  (
    {
      variant = 'default',
      selected = false,
      hoverable = false,
      padding = 'md',
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const selectableClasses =
      variant === 'selectable'
        ? selected
          ? 'border-active-accent bg-active-accent/5 shadow-md'
          : 'hover:border-active-accent/40 hover:shadow-sm'
        : null;

    return (
      <div
        ref={ref}
        data-cw-component="Card"
        data-cw-variant={variant}
        data-cw-selected={selected ? 'true' : 'false'}
        className={cn(
          'rounded-lg transition-all duration-200 ease-out',
          'w-full', // mobile-first: cards stretch unless constrained by parent
          variantClasses[variant],
          paddingClasses[padding],
          hoverable && 'hover:shadow-md',
          selectableClasses,
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

UICard.displayName = 'UICard';
