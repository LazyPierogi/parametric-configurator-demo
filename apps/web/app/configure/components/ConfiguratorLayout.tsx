import { ReactNode, useMemo, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ConfiguratorLayoutProps {
  isMobile: boolean;
  providerId: string | null;
  children: ReactNode;
  /** Optional: use fit-to-height layout (Task 1.4) */
  useMobileFirstLayout?: boolean;
  /** When true (desktop), expand the glass card to fit hero + configurator */
  isExpanded?: boolean;
}

export const ConfiguratorLayout = forwardRef<HTMLDivElement, ConfiguratorLayoutProps>(function ConfiguratorLayout({
  isMobile,
  providerId,
  children,
  useMobileFirstLayout = false,
  isExpanded = false,
}, ref) {
  const tokens = useMemo(
    () => ({
      overlayGradient: 'var(--cw-config-overlay-gradient)',
      blur: 'var(--cw-config-overlay-blur)',
      saturate: 'var(--cw-config-overlay-saturate)',
      glassAlpha: 'var(--cw-config-glass-alpha)',
    }),
    [],
  );
  const widthClass = cn(
    'w-full mx-auto transition-[max-width] duration-500 ease-out',
    isMobile ? 'max-w-full' : (isExpanded ? 'max-w-[1380px]' : 'max-w-[56rem]')
  );

  // Mobile-first fit-to-height layout (Task 1.4)
  if (useMobileFirstLayout) {
    return (
      <div ref={ref} className="relative flex flex-col">
        {/* Background gradient (fixed) */}
        <div
          aria-hidden
          className="fixed inset-0 z-0 pointer-events-none"
          style={{ background: tokens.overlayGradient }}
        />
        
        {/* Glass container with flexbox layout - allows scrolling */}
        <div
          className={cn(
            'relative z-10 flex flex-col my-5',
            widthClass,
            'rounded-[18px] border border-white/45 shadow-[0_24px_48px_rgba(15,23,42,0.25)]',
            isMobile ? 'p-3.5' : 'p-5'
          )}
          data-catalog-provider={providerId ?? undefined}
          style={{
            background: `rgba(var(--cw-surface-glass-rgb) / ${tokens.glassAlpha})`,
            backdropFilter: `saturate(${tokens.saturate}) blur(${tokens.blur})`,
            WebkitBackdropFilter: `saturate(${tokens.saturate}) blur(${tokens.blur})`,
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  // Legacy layout (original behavior)
  return (
    <div ref={ref} className="relative">
      {/*<div
        aria-hidden
        className="fixed inset-0 -z-10 bg-[url('/api/static?p=images/configure-bg.webp')] bg-cover bg-center bg-no-repeat transform-gpu"
      />*/}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: tokens.overlayGradient }}
      />
      <div
        className={cn(
          'relative z-10 mt-5 mb-7 rounded-[18px] border border-white/45 shadow-[0_24px_48px_rgba(15,23,42,0.25)]',
          widthClass,
          isMobile ? 'p-3.5' : 'p-5'
        )}
        data-catalog-provider={providerId ?? undefined}
        style={{
          background: `rgba(var(--cw-surface-glass-rgb) / ${tokens.glassAlpha})`,
          backdropFilter: `saturate(${tokens.saturate}) blur(${tokens.blur})`,
          WebkitBackdropFilter: `saturate(${tokens.saturate}) blur(${tokens.blur})`,
        }}
      >
        {children}
      </div>
    </div>
  );
});
