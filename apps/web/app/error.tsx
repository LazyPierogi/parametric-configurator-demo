'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Router error boundary', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="space-y-2">
        <p className="text-2xl font-semibold text-active-text">
          Something went wrong while loading Curtain Wizard.
        </p>
        {error?.message ? (
          <p className="text-sm text-active-text/70">
            {error.message}
          </p>
        ) : null}
        {error?.digest ? (
          <p className="text-xs font-mono text-active-text/60">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-active-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          Try again
        </button>
        <button
          type="button"
          className="rounded-lg border border-active-border bg-active-bg px-4 py-2 text-sm font-medium text-active-text transition hover:bg-neutral-50"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
          }}
        >
          Go to home
        </button>
      </div>
    </div>
  );
}
