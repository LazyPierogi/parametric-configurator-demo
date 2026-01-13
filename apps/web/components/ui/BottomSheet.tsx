'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

export interface BottomSheetProps {
  /** Height when collapsed (CSS value, e.g., '20vh', '200px') */
  collapsedHeight: string;
  
  /** Height when expanded (CSS value, e.g., '50vh', '400px') */
  expandedHeight: string;
  
  /** Default collapsed state */
  defaultCollapsed?: boolean;
  
  /** Controlled collapsed state */
  collapsed?: boolean;
  
  /** Callback when collapsed state changes */
  onToggle?: (collapsed: boolean) => void;
  
  /** Sheet content */
  children: React.ReactNode;
  
  /** Optional className */
  className?: string;
  
  /** Show drag handle */
  showHandle?: boolean;
  
  /** Enable swipe gestures */
  enableSwipe?: boolean;
}

/**
 * Mobile bottom sheet with drag handle and swipe gestures
 * 
 * Features:
 * - Smooth spring animation
 * - Drag handle for manual control
 * - Swipe up/down gestures
 * - Glass panel aesthetic
 * - Backdrop blur when expanded
 * 
 * @example
 * ```tsx
 * <BottomSheet
 *   collapsedHeight="20vh"
 *   expandedHeight="50vh"
 *   defaultCollapsed={true}
 * >
 *   <SummaryPanel />
 *   <FiltersPanel />
 * </BottomSheet>
 * ```
 */
export function BottomSheet({
  collapsedHeight,
  expandedHeight,
  defaultCollapsed = true,
  collapsed: controlledCollapsed,
  onToggle,
  children,
  className,
  showHandle = true,
  enableSwipe = true,
}: BottomSheetProps) {
  // Controlled vs uncontrolled state
  const isControlled = controlledCollapsed !== undefined;
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const collapsed = isControlled ? controlledCollapsed : internalCollapsed;

  const sheetRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);

  /**
   * Toggle collapsed state
   */
  const toggleCollapsed = useCallback(() => {
    const newCollapsed = !collapsed;

    if (!isControlled) {
      setInternalCollapsed(newCollapsed);
    }

    onToggle?.(newCollapsed);
  }, [collapsed, isControlled, onToggle]);

  /**
   * Touch/Mouse drag handlers
   */
  const handleDragStart = (clientY: number) => {
    if (!enableSwipe) return;
    setIsDragging(true);
    setStartY(clientY);
    setCurrentY(clientY);
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return;
    setCurrentY(clientY);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const deltaY = currentY - startY;
    const threshold = 50; // pixels

    // Swipe down → collapse
    if (deltaY > threshold && !collapsed) {
      toggleCollapsed();
    }
    // Swipe up → expand
    else if (deltaY < -threshold && collapsed) {
      toggleCollapsed();
    }

    setStartY(0);
    setCurrentY(0);
  };

  /**
   * Mouse events
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    handleDragStart(e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleDragMove(e.clientY);
  };

  const handleMouseUp = () => {
    handleDragEnd();
  };

  /**
   * Touch events
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  /**
   * Calculate drag offset for visual feedback
   */
  const dragOffset = isDragging ? currentY - startY : 0;
  const clampedOffset = collapsed
    ? Math.max(0, dragOffset) // Can only drag up when collapsed
    : Math.min(0, dragOffset); // Can only drag down when expanded

  return (
    <div
      ref={sheetRef}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'bg-white/90 backdrop-blur-lg',
        'border-t border-neutral-200/50',
        'rounded-t-3xl',
        'shadow-[0_-4px_24px_rgba(0,0,0,0.12)]',
        'transition-all duration-300 ease-out',
        className
      )}
      style={{
        height: collapsed ? collapsedHeight : expandedHeight,
        transform: `translateY(${clampedOffset}px)`,
        transition: isDragging ? 'none' : undefined,
      }}
    >
      {/* Drag Handle */}
      {showHandle && (
        <div
          role="button"
          tabIndex={0}
          onClick={toggleCollapsed}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleCollapsed();
            }
          }}
          className={cn(
            'w-full flex items-center justify-center',
            'py-3 cursor-grab active:cursor-grabbing',
            'focus:outline-none focus:ring-2 focus:ring-accent-sage/30 focus:ring-inset'
          )}
        >
          {/* Handle bar */}
          <div
            className={cn(
              'w-12 h-1.5 rounded-full',
              'bg-neutral-300',
              'transition-all duration-200',
              'hover:bg-neutral-400 hover:w-16'
            )}
          />
        </div>
      )}

      {/* Content */}
      <div className="overflow-y-auto h-[calc(100%-48px)] px-4 pb-safe">
        {children}
      </div>
    </div>
  );
}
