import { ButtonHTMLAttributes, forwardRef, useMemo } from 'react';
import { cn } from '../utils/cn';
import { usePrefersReducedMotion } from '../utils/use-prefers-reduced-motion';

export type UIToggleSize = 'sm' | 'md';

export interface UIToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: UIToggleSize;
  label?: string;
  fullWidth?: boolean;
}

const sizeConfig: Record<
  UIToggleSize,
  {
    track: string;
    knob: string;
    translate: number;
  }
> = {
  sm: {
    track: 'w-10 h-6',
    knob: 'h-5 w-5',
    translate: 16,
  },
  md: {
    track: 'w-12 h-7',
    knob: 'h-6 w-6',
    translate: 20,
  },
};

export const UIToggle = forwardRef<HTMLButtonElement, UIToggleProps>(
  (
    {
      checked,
      onCheckedChange,
      size = 'md',
      label,
      children,
      disabled,
      fullWidth = false,
      className,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const knobTranslate = useMemo(() => (checked ? sizeConfig[size].translate : 0), [checked, size]);
    const motionClass = prefersReducedMotion ? 'duration-0' : 'duration-200';
    const content = children ?? label;

    return (
      <button
        ref={ref}
        type={type}
        role="switch"
        aria-checked={checked}
        aria-pressed={checked}
        data-cw-component="Toggle"
        data-cw-size={size}
        data-cw-state={checked ? 'on' : 'off'}
        className={cn(
          'group inline-flex items-center gap-3 rounded-full text-sm font-medium text-active-text',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-active-accent/50 focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          fullWidth && 'w-full justify-between',
          !fullWidth && 'justify-start',
          className,
        )}
        onClick={(event) => {
          props.onClick?.(event);
          if (event.defaultPrevented || typeof onCheckedChange !== 'function' || disabled) {
            return;
          }

          onCheckedChange(!checked);
        }}
        disabled={disabled}
        {...props}
      >
        <span
          className={cn(
            'relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-colors ease-out',
            'bg-neutral-200 text-transparent',
            checked && 'bg-active-accent/90 shadow-low',
            sizeConfig[size].track,
            motionClass,
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-white shadow-low transition-transform ease-out',
              sizeConfig[size].knob,
              motionClass,
              checked ? 'shadow-medium' : 'shadow-low',
            )}
            style={{
              transform: `translate(${knobTranslate}px, -50%)`,
            }}
          />
        </span>
        {content ? <span className="text-sm text-active-text">{content}</span> : null}
      </button>
    );
  },
);

UIToggle.displayName = 'UIToggle';
