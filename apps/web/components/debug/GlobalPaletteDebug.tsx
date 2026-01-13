'use client';

import { usePalette, type Palette } from '@/lib/palette-context';
import { useState } from 'react';

/**
 * GlobalPaletteDebug
 * 
 * Floating palette switcher that appears on ALL pages when debug UI is enabled.
 * Shows current palette and allows switching between palettes.
 * 
 * Usage: Add to layout.tsx when NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1
 */
export function GlobalPaletteDebug() {
  const { current, setPalette, isTransitioning } = usePalette();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="fixed bottom-4 left-4 z-[9999] flex flex-col gap-2">
      {collapsed ? (
        // Collapsed state - just a button
        <button
          onClick={() => setCollapsed(false)}
          className="bg-neutral-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg hover:bg-neutral-800 transition-colors font-mono"
        >
          🎨 {current}
        </button>
      ) : (
        // Expanded state - full palette switcher
        <div className="bg-white/95 backdrop-blur-md border border-neutral-300 rounded-lg shadow-xl p-3 min-w-[180px]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-neutral-700">
              🎨 Palette
            </div>
            <button
              onClick={() => setCollapsed(true)}
              className="text-xs text-neutral-500 hover:text-neutral-700 px-1"
            >
              ✕
            </button>
          </div>
          
          <select
            value={current}
            onChange={(e) => setPalette(e.target.value as Palette)}
            disabled={isTransitioning}
            className="w-full text-xs rounded border border-neutral-300 bg-white px-2 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="signature">Signature</option>
            <option value="havinic">Havinic</option>
            <option value="hybrid">Hybrid</option>
          </select>
          
          {isTransitioning && (
            <div className="text-[10px] text-neutral-500 mt-1.5 text-center animate-pulse">
              Transitioning...
            </div>
          )}
          
          <div className="text-[10px] text-neutral-500 mt-2 pt-2 border-t border-neutral-200">
            Active: <span className="font-semibold">{current}</span>
          </div>
        </div>
      )}
    </div>
  );
}
