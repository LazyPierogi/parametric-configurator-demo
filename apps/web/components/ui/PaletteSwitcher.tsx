'use client';

import { usePalette } from '@/lib/palette-context';
import { cn } from '@/lib/utils';

/**
 * PaletteSwitcher Component
 * 
 * Debug/demo component for testing palette switching.
 * Can be used in development to preview both palettes.
 * 
 * @example
 * ```tsx
 * // Add to your page for testing
 * {process.env.NODE_ENV === 'development' && <PaletteSwitcher />}
 * ```
 */
export function PaletteSwitcher() {
  const { current, setPalette, isTransitioning } = usePalette();

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 p-3 bg-white/90 backdrop-blur-md rounded-lg shadow-high border border-neutral-200">
      <div className="text-xs font-semibold text-neutral-700 mb-1">
        Palette Switcher
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={() => setPalette('signature')}
          disabled={isTransitioning}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded transition-all',
            current === 'signature'
              ? 'bg-cw-sig-sage text-white shadow-sm'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
            isTransitioning && 'opacity-50 cursor-not-allowed'
          )}
        >
          Signature
        </button>
        
        <button
          onClick={() => setPalette('havinic')}
          disabled={isTransitioning}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded transition-all',
            current === 'havinic'
              ? 'bg-havinic-accent text-white shadow-sm'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
            isTransitioning && 'opacity-50 cursor-not-allowed'
          )}
        >
          Havinic
        </button>
        
        <button
          onClick={() => setPalette('hybrid')}
          disabled={isTransitioning}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded transition-all',
            current === 'hybrid'
              ? 'bg-gradient-to-r from-cw-sig-sage to-havinic-accent text-white shadow-sm'
              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
            isTransitioning && 'opacity-50 cursor-not-allowed'
          )}
        >
          Hybrid
        </button>
      </div>
      
      {isTransitioning && (
        <div className="text-xs text-neutral-500 text-center animate-pulse">
          Transitioning...
        </div>
      )}
      
      <div className="text-xs text-neutral-500 mt-1">
        Current: <span className="font-semibold">{current}</span>
      </div>
    </div>
  );
}
