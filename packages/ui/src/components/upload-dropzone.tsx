import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn';

export interface UIUploadDropzoneProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  note?: string;
  icon?: ReactNode;
  isEmpty?: boolean;
  dragActive?: boolean;
  contentClassName?: string;
  emptyStateClassName?: string;
}

export const UIUploadDropzone = forwardRef<HTMLDivElement, UIUploadDropzoneProps>(
  (
    {
      title,
      description,
      note,
      icon,
      isEmpty = true,
      dragActive = false,
      children,
      className,
      contentClassName,
      emptyStateClassName,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        data-cw-component="UploadDropzone"
        data-cw-state={isEmpty ? 'empty' : 'filled'}
        data-cw-drag={dragActive ? 'active' : 'idle'}
        className={cn(
          'relative select-none overflow-hidden rounded-[24px] border border-white/30 bg-gradient-to-br from-surface-glass/80 to-surface-glass/60 p-4 text-active-text shadow-glass backdrop-blur-lg transition-all duration-200 ease-out transform-gpu',
          dragActive
            ? 'border-active-accent/60 bg-active-accent/[0.06] shadow-glass-hover ring-1 ring-active-accent/20 scale-[1.01]'
            : 'hover:border-white/40 hover:shadow-glass-hover',
          className,
        )}
        {...props}
      >
        {isEmpty ? (
          <div
            className={cn(
              'flex min-h-[280px] flex-col items-center justify-center gap-2 text-center text-active-text/70',
              emptyStateClassName,
            )}
          >
            {icon ? <div className="text-active-text/50">{icon}</div> : null}
            <div className="text-base font-semibold text-active-text">{title}</div>
            {description ? <div className="text-xs text-active-text/70">{description}</div> : null}
            {note ? <div className="text-[11px] text-active-text/60">{note}</div> : null}
          </div>
        ) : (
          <div className={cn('h-full w-full', contentClassName)}>{children}</div>
        )}
      </div>
    );
  },
);

UIUploadDropzone.displayName = 'UIUploadDropzone';
