'use client';

import {
  HTMLAttributes,
  ReactNode,
  forwardRef,
  useEffect,
  useRef,
  useCallback,
  MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../utils/cn';

export type UIDialogSize = 'sm' | 'md' | 'lg' | 'xl';
export type UIDialogVariant = 'default' | 'info' | 'confirm' | 'error';

export interface UIDialogProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  size?: UIDialogSize;
  variant?: UIDialogVariant;
  footer?: ReactNode;
}

const sizeClasses: Record<UIDialogSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const variantClasses: Record<UIDialogVariant, string> = {
  default: 'bg-active-bg border border-active-border',
  info: 'bg-info.bg border border-info.border text-info.text',
  confirm: 'bg-active-bg border border-active-border',
  error: 'bg-error.bg border border-error.border text-error.text',
};

export const UIDialog = forwardRef<HTMLDivElement, UIDialogProps>(
  (
    {
      open,
      onClose,
      title,
      footer,
      size = 'md',
      variant = 'default',
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const previousActiveElement = useRef<Element | null>(null);

    useEffect(() => {
      if (open) {
        previousActiveElement.current = document.activeElement;
        const handleKey = (event: KeyboardEvent) => {
          if (event.key === 'Escape') {
            onClose?.();
          }
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
      }

      return () => {};
    }, [open, onClose]);

    useEffect(() => {
      if (!open && previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    }, [open]);

    const handleBackdropClick = useCallback(
      (event: MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      },
      [onClose],
    );

    if (!open) return null;

    if (typeof document === 'undefined') return null;

    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        data-cw-component="Dialog"
        data-cw-variant={variant}
        className="fixed inset-0 z-modal flex items-center justify-center p-4 sm:p-6"
        onClick={handleBackdropClick}
      >
        <div className="absolute inset-0 bg-neutral-900/45 backdrop-blur-glass-scrim" aria-hidden="true" />

        <div
          ref={ref}
          className={cn(
            'relative w-full rounded-2xl shadow-high max-h-[90vh] overflow-y-auto animate-[fadeIn_200ms_ease-out]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-active-accent/40',
            'transition-transform duration-200 ease-out',
            sizeClasses[size],
            variantClasses[variant],
            className,
          )}
          {...props}
        >
          {(title || onClose) && (
            <div className="flex items-center justify-between gap-3 p-5 border-b border-active-border">
              {title && (
                <h2 className="text-lg font-semibold text-active-text m-0" data-cw-element="title">
                  {title}
                </h2>
              )}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-active-text/70 hover:text-active-text hover:bg-active-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-active-accent/40"
                  aria-label="Close dialog"
                >
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </div>
          )}
          <div className="p-5 space-y-4" data-cw-element="body">
            {children}
          </div>
          {footer && (
            <div className="p-4 border-t border-active-border bg-active-bg/80" data-cw-element="footer">
              {footer}
            </div>
          )}
        </div>
      </div>,
      document.body,
    );
  },
);

UIDialog.displayName = 'UIDialog';
