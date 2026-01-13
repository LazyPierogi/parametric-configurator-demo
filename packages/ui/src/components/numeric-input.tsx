import {
  forwardRef,
  InputHTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useState,
  ChangeEvent,
} from 'react';
import { cn } from '../utils/cn';
import { usePrefersReducedMotion } from '../utils/use-prefers-reduced-motion';

export interface UINumericInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'value' | 'defaultValue' | 'onChange' | 'step' | 'min' | 'max' | 'inputMode'
  > {
  value: number;
  onValueChange?: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  density?: 'comfortable' | 'compact';
  fullWidth?: boolean;
  inputClassName?: string;
}

const densityClasses: Record<NonNullable<UINumericInputProps['density']>, string> = {
  comfortable: 'h-12 text-base',
  compact: 'h-10 text-sm',
};

const clampValue = (value: number, min?: number, max?: number) => {
  let next = value;
  if (typeof min === 'number') {
    next = Math.max(min, next);
  }
  if (typeof max === 'number') {
    next = Math.min(max, next);
  }
  return next;
};

const isPartialNumeric = (value: string) => value === '' || value === '-' || value === '.' || value === '-.';

export const UINumericInput = forwardRef<HTMLInputElement, UINumericInputProps>(
  (
    {
      value,
      onValueChange,
      step = 1,
      min,
      max,
      density = 'comfortable',
      fullWidth = false,
      className,
      inputClassName,
      disabled,
      ...props
    },
    ref,
  ) => {
    const prefersReducedMotion = usePrefersReducedMotion();
    const [displayValue, setDisplayValue] = useState<string>(String(value ?? ''));

    useEffect(() => {
      if (Number.isFinite(value)) {
        setDisplayValue(String(value));
      }
    }, [value]);

    const motionClass = prefersReducedMotion ? 'duration-0' : 'duration-200';

    const handleRawChange = useCallback(
      (event: ChangeEvent<HTMLInputElement>) => {
        const raw = event.target.value;
        setDisplayValue(raw);

        if (isPartialNumeric(raw)) {
          return;
        }

        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) {
          return;
        }
        const next = clampValue(parsed, min, max);
        onValueChange?.(next);
        if (next !== parsed) {
          setDisplayValue(String(next));
        }
      },
      [max, min, onValueChange, value],
    );

    const commitValue = useCallback(() => {
      if (isPartialNumeric(displayValue)) {
        setDisplayValue(String(value));
        return;
      }

      const parsed = Number(displayValue);
      if (!Number.isFinite(parsed)) {
        setDisplayValue(String(value));
        return;
      }

      const next = clampValue(parsed, min, max);
      setDisplayValue(String(next));
      if (typeof onValueChange === 'function' && next !== value) {
        onValueChange(next);
      }
    }, [displayValue, max, min, onValueChange, value]);

    const nudge = useCallback(
      (direction: 1 | -1) => {
        if (disabled || typeof onValueChange !== 'function') {
          return;
        }

        const base = Number.isFinite(value) ? value : 0;
        const next = clampValue(base + direction * step, min, max);
        onValueChange(next);
        setDisplayValue(String(next));
      },
      [disabled, max, min, onValueChange, step, value],
    );

    const decrementDisabled = useMemo(
      () => disabled || (typeof min === 'number' && Number.isFinite(value) && value <= min),
      [disabled, min, value],
    );
    const incrementDisabled = useMemo(
      () => disabled || (typeof max === 'number' && Number.isFinite(value) && value >= max),
      [disabled, max, value],
    );

    return (
      <div
        data-cw-component="NumericInput"
        data-cw-density={density}
        className={cn(
          'inline-flex items-stretch rounded-2xl border border-active-border bg-active-bg text-active-text shadow-low',
          'focus-within:ring-2 focus-within:ring-active-accent/40 focus-within:ring-offset-2',
          fullWidth && 'w-full',
          disabled && 'opacity-60',
          className,
        )}
      >
        <button
          type="button"
          aria-label="Decrease value"
          disabled={decrementDisabled}
          className={cn(
            'px-3 text-lg font-semibold text-active-text/80 transition-all ease-out',
            densityClasses[density],
            motionClass,
            decrementDisabled ? 'cursor-not-allowed opacity-40' : 'hover:text-active-text',
          )}
          onClick={() => nudge(-1)}
        >
          −
        </button>
        <input
          ref={ref}
          inputMode="decimal"
          {...props}
          disabled={disabled}
          className={cn(
            'flex-1 border-0 bg-transparent text-center font-semibold outline-none',
            densityClasses[density],
            inputClassName,
          )}
          value={displayValue}
          onChange={handleRawChange}
          onBlur={commitValue}
        />
        <button
          type="button"
          aria-label="Increase value"
          disabled={incrementDisabled}
          className={cn(
            'px-3 text-lg font-semibold text-active-text/80 transition-all ease-out',
            densityClasses[density],
            motionClass,
            incrementDisabled ? 'cursor-not-allowed opacity-40' : 'hover:text-active-text',
          )}
          onClick={() => nudge(1)}
        >
          +
        </button>
      </div>
    );
  },
);

UINumericInput.displayName = 'UINumericInput';
