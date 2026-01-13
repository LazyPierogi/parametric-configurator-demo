import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { cn } from '../utils/cn';

export interface UIRangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  step?: number;
  disabled?: boolean;
  onChange: (next: [number, number]) => void;
  onCommit?: (next: [number, number]) => void;
  className?: string;
}

type DragState = {
  type: 'min' | 'max' | null;
  active: boolean;
  pointerId: number | null;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const roundToStep = (value: number, step: number, base: number) => {
  const buckets = Math.round((value - base) / step);
  return base + buckets * step;
};

export function UIRangeSlider({
  min,
  max,
  value,
  step = 1,
  disabled,
  onChange,
  onCommit,
  className,
}: UIRangeSliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState>({ type: null, active: false, pointerId: null });
  const lastPairRef = useRef<[number, number]>(value);

  useEffect(() => {
    lastPairRef.current = value;
  }, [value]);

  const [lo, hi] = value;
  const span = useMemo(() => Math.max(1e-6, max - min), [max, min]);
  const loPct = useMemo(() => ((lo - min) / span) * 100, [lo, min, span]);
  const hiPct = useMemo(() => ((hi - min) / span) * 100, [hi, min, span]);

  const commitIfNeeded = useCallback(() => {
    if (typeof onCommit === 'function') {
      onCommit(lastPairRef.current ?? value);
    }
  }, [onCommit, value]);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      let nextValue = min + ratio * span;
      nextValue = roundToStep(nextValue, step, min);
      const [currentLo, currentHi] = lastPairRef.current ?? value;

      if (dragRef.current.type === 'min') {
        const nextLo = clamp(Math.min(nextValue, currentHi), min, currentHi);
        const next: [number, number] = [nextLo, currentHi];
        lastPairRef.current = next;
        onChange(next);
      } else if (dragRef.current.type === 'max') {
        const nextHi = clamp(Math.max(nextValue, currentLo), currentLo, max);
        const next: [number, number] = [currentLo, nextHi];
        lastPairRef.current = next;
        onChange(next);
      }
    },
    [max, min, onChange, span, step, value],
  );

  const releasePointer = useCallback(
    (target?: EventTarget | null) => {
      if (dragRef.current.pointerId != null && target instanceof Element) {
        try {
          target.releasePointerCapture(dragRef.current.pointerId);
        } catch {
          // ignore release failures
        }
      }
      dragRef.current.type = null;
      dragRef.current.active = false;
      dragRef.current.pointerId = null;
      commitIfNeeded();
    },
    [commitIfNeeded],
  );

  const attachWindowListeners = useCallback(() => {
    const handleMove = (event: PointerEvent) => {
      if (dragRef.current.active) {
        updateFromClientX(event.clientX);
      }
    };
    const handleUp = (event: PointerEvent) => {
      releasePointer(event.target);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }, [releasePointer, updateFromClientX]);

  const beginDrag = useCallback(
    (type: 'min' | 'max', pointerId: number) => {
      dragRef.current = { type, active: true, pointerId };
      attachWindowListeners();
    },
    [attachWindowListeners],
  );

  const onHandlePointerDown = useCallback(
    (event: ReactPointerEvent, type: 'min' | 'max') => {
      if (disabled) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      lastPairRef.current = value;
      beginDrag(type, event.pointerId);
    },
    [beginDrag, disabled, value],
  );

  const onHandlePointerMove = useCallback(
    (event: ReactPointerEvent) => {
      if (disabled || !dragRef.current.type) return;
      updateFromClientX(event.clientX);
    },
    [disabled, updateFromClientX],
  );

  const onHandlePointerUp = useCallback(
    (event: ReactPointerEvent) => {
      if (disabled) return;
      releasePointer(event.currentTarget);
    },
    [disabled, releasePointer],
  );

  const onTrackPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      event.preventDefault();
      const track = trackRef.current;
      if (!track) return;
      track.setPointerCapture(event.pointerId);
      lastPairRef.current = value;

      const rect = track.getBoundingClientRect();
      const ratio = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      let nextValue = min + ratio * span;
      nextValue = roundToStep(nextValue, step, min);
      const [currentLo, currentHi] = lastPairRef.current ?? value;
      const chooseMin = Math.abs(nextValue - currentLo) <= Math.abs(nextValue - currentHi);
      const type: 'min' | 'max' = chooseMin ? 'min' : 'max';

      if (type === 'min') {
        const nextLo = clamp(Math.min(nextValue, currentHi), min, currentHi);
        const next: [number, number] = [nextLo, currentHi];
        lastPairRef.current = next;
        onChange(next);
      } else {
        const nextHi = clamp(Math.max(nextValue, currentLo), currentLo, max);
        const next: [number, number] = [currentLo, nextHi];
        lastPairRef.current = next;
        onChange(next);
      }

      dragRef.current = { type, active: true, pointerId: event.pointerId };
      attachWindowListeners();
    },
    [attachWindowListeners, disabled, max, min, onChange, span, step, value],
  );

  const nudgeHandle = useCallback(
    (type: 'min' | 'max', direction: 1 | -1) => {
      const [currentLo, currentHi] = value;
      if (type === 'min') {
        const nextLo = clamp(roundToStep(currentLo + direction * step, step, min), min, currentHi);
        const next: [number, number] = [Math.min(nextLo, currentHi), currentHi];
        lastPairRef.current = next;
        onChange(next);
        commitIfNeeded();
      } else {
        const nextHi = clamp(roundToStep(currentHi + direction * step, step, min), currentLo, max);
        const next: [number, number] = [currentLo, Math.max(nextHi, currentLo)];
        lastPairRef.current = next;
        onChange(next);
        commitIfNeeded();
      }
    },
    [commitIfNeeded, max, min, onChange, step, value],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent, type: 'min' | 'max') => {
      if (disabled) return;
      const { key } = event;
      if (key === 'ArrowLeft' || key === 'ArrowDown') {
        event.preventDefault();
        nudgeHandle(type, -1);
      } else if (key === 'ArrowRight' || key === 'ArrowUp') {
        event.preventDefault();
        nudgeHandle(type, 1);
      } else if (key === 'Home') {
        event.preventDefault();
        const next: [number, number] =
          type === 'min' ? [min, value[1]] : [value[0], max];
        lastPairRef.current = next;
        onChange(next);
        commitIfNeeded();
      } else if (key === 'End') {
        event.preventDefault();
        const next: [number, number] =
          type === 'min' ? [value[1], value[1]] : [value[0], max];
        lastPairRef.current = next;
        onChange(next);
        commitIfNeeded();
      }
    },
    [commitIfNeeded, disabled, max, min, nudgeHandle, onChange, value],
  );

  return (
    <div
      data-cw-component="RangeSlider"
      data-cw-disabled={disabled ? 'true' : 'false'}
      className={cn('w-full', className)}
    >
      <div
        ref={trackRef}
        className={cn(
          'relative h-2 w-full select-none rounded-full bg-active-text/10',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        )}
        onPointerDown={onTrackPointerDown}
      >
        <div
          className="absolute inset-y-0 rounded-full bg-active-accent shadow-low"
          style={{
            left: `${loPct}%`,
            width: `${Math.max(0, hiPct - loPct)}%`,
          }}
        />
        <button
          type="button"
          role="slider"
          aria-valuemin={min}
          aria-valuemax={hi}
          aria-valuenow={lo}
          aria-disabled={disabled || undefined}
          tabIndex={disabled ? -1 : 0}
          data-cw-variant="handle"
          className={cn(
            'absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-white bg-active-accent text-transparent shadow-low transition-transform',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab',
          )}
          style={{ left: `calc(${loPct}% - 12px)` }}
          onPointerDown={(event) => onHandlePointerDown(event, 'min')}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          onKeyDown={(event) => handleKeyDown(event, 'min')}
        />
        <button
          type="button"
          role="slider"
          aria-valuemin={lo}
          aria-valuemax={max}
          aria-valuenow={hi}
          aria-disabled={disabled || undefined}
          tabIndex={disabled ? -1 : 0}
          data-cw-variant="handle"
          className={cn(
            'absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border border-white bg-active-accent text-transparent shadow-low transition-transform',
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-grab',
          )}
          style={{ left: `calc(${hiPct}% - 12px)` }}
          onPointerDown={(event) => onHandlePointerDown(event, 'max')}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          onKeyDown={(event) => handleKeyDown(event, 'max')}
        />
      </div>
    </div>
  );
}
