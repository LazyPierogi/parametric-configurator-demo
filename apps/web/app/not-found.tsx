'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-active-bg px-4 text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-active-text/60">404</p>
      <h1 className="text-3xl font-semibold text-active-text">Page not found</h1>
      <p className="max-w-lg text-sm text-active-text/70">
        It looks like you followed a broken link. Go back home or explore the curtain configurator.
      </p>
      <div className="flex gap-3">
        <Link href="/" className="rounded-lg bg-active-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
          Home
        </Link>
        <Link href="/configure" className="rounded-lg border border-active-border px-4 py-2 text-sm font-semibold text-active-text transition hover:bg-neutral-50">
          Configure
        </Link>
      </div>
    </div>
  );
}
