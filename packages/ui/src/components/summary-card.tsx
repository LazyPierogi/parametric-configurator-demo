import { ReactNode } from 'react';
import { cn } from '../utils/cn';

export interface UISummaryCardProps {
  title: ReactNode;
  providerLabel?: ReactNode;
  thumbnail?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function UISummaryCard({ title, providerLabel, thumbnail, children, className }: UISummaryCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-neutral-200 bg-white/90 p-4 shadow-sm backdrop-blur-sm',
        'flex flex-col gap-3',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
        {providerLabel ? (
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
            {providerLabel}
          </span>
        ) : null}
      </div>
      {thumbnail}
      {children}
    </div>
  );
}

export interface UISummaryRowProps {
  label: ReactNode;
  value: ReactNode;
  tone?: 'default' | 'accent';
}

export function UISummaryRow({ label, value, tone = 'default' }: UISummaryRowProps) {
  return (
    <div
      className={cn(
        'flex w-full items-baseline justify-between gap-3 text-xs text-neutral-800',
        tone === 'accent' && 'text-sm font-semibold text-neutral-900',
      )}
    >
      <span className="font-semibold text-neutral-700">{label}</span>
      <span className="text-right text-neutral-900">{value}</span>
    </div>
  );
}
