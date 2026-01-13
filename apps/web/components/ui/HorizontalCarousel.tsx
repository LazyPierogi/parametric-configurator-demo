'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

export interface HorizontalCarouselProps<T> {
  /** Array of items to display */
  items: T[];
  
  /** Render function for each item */
  renderItem: (item: T, index: number, isCenter: boolean, scale: number) => React.ReactNode;
  
  /** Number of visible items (must be ODD: 3, 5, 7, etc.) */
  visibleCount: number;
  
  /** Index of currently selected item */
  selectedIndex: number;
  
  /** Callback when item is selected */
  onSelect: (item: T, index: number) => void;
  
  /** Size of each item in pixels */
  itemSize: number;
  
  /** Gap between items in pixels */
  gap?: number;
  
  /** Maximum scale for center item (default: 1.08 = +8%) */
  maxScale?: number;
  
  /** Enable smooth momentum scrolling */
  momentum?: boolean;
  
  /** Optional className for container */
  className?: string;
  
  /** Optional ID for accessibility */
  id?: string;
}

/**
 * Horizontal carousel with center-focus auto-scroll
 * 
 * Features:
 * - Center-focused: Active item always animates to center
 * - Scale gradient: Items closer to center are larger
 * - Auto-scroll: Selecting item animates it to center position
 * - ODD visible count: Always displays odd number (3, 5, 7)
 * - Touch/Mouse/Trackpad: Drag, scroll wheel, swipe gestures
 * 
 * @example
 * ```tsx
 * <HorizontalCarousel
 *   items={colors}
 *   visibleCount={5}
 *   selectedIndex={activeColorIndex}
 *   onSelect={(color, idx) => setActiveColor(idx)}
 *   itemSize={64}
 *   gap={16}
 *   renderItem={(color, idx, isCenter, scale) => (
 *     <div style={{ transform: `scale(${scale})` }}>
 *       <ColorChip color={color} active={isCenter} />
 *     </div>
 *   )}
 * />
 * ```
 */
export function HorizontalCarousel<T>({
  items,
  renderItem,
  visibleCount,
  selectedIndex,
  onSelect,
  itemSize,
  gap = 16,
  maxScale = 1.08,
  momentum = true,
  className,
  id,
}: HorizontalCarouselProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Ensure visible count is odd
  if (visibleCount % 2 === 0) {
    console.warn(`HorizontalCarousel: visibleCount must be odd, got ${visibleCount}. Using ${visibleCount + 1} instead.`);
    visibleCount = visibleCount + 1;
  }

  /**
   * Calculate scroll position to center a specific item
   */
  const getScrollPositionForIndex = useCallback(
    (index: number): number => {
      if (!containerRef.current) return 0;

      const container = containerRef.current;
      const containerWidth = container.offsetWidth;
      const itemWidth = itemSize + gap;

      // Calculate item's position
      const itemLeft = index * itemWidth;
      
      // Center the item: scroll so item center aligns with container center
      const scrollPosition = itemLeft - (containerWidth / 2) + (itemSize / 2);

      return Math.max(0, scrollPosition);
    },
    [itemSize, gap]
  );

  /**
   * Auto-scroll to center the selected item
   */
  const scrollToIndex = useCallback(
    (index: number, smooth = true) => {
      if (!containerRef.current) return;

      const scrollPosition = getScrollPositionForIndex(index);

      containerRef.current.scrollTo({
        left: scrollPosition,
        behavior: smooth ? 'smooth' : 'auto',
      });
    },
    [getScrollPositionForIndex]
  );

  /**
   * Calculate scale for an item based on distance from center
   */
  const calculateScale = useCallback(
    (itemIndex: number): number => {
      if (!containerRef.current) return 1;

      const container = containerRef.current;
      const containerWidth = container.offsetWidth;
      const containerCenter = containerWidth / 2;
      const scrollOffset = container.scrollLeft;

      // Item's center position relative to viewport
      const itemWidth = itemSize + gap;
      const itemLeft = itemIndex * itemWidth - scrollOffset;
      const itemCenter = itemLeft + itemSize / 2;

      // Distance from container center (normalized 0-1)
      const distance = Math.abs(itemCenter - containerCenter);
      const maxDistance = containerWidth / 2;
      const normalizedDistance = Math.min(distance / maxDistance, 1);

      // Scale: 1.0 at edges, maxScale at center (linear gradient)
      const scale = 1 + (maxScale - 1) * (1 - normalizedDistance);

      return scale;
    },
    [itemSize, gap, maxScale]
  );

  /**
   * Determine which item is currently centered
   */
  const getCenterIndex = useCallback((): number => {
    if (!containerRef.current) return selectedIndex;

    const container = containerRef.current;
    const containerWidth = container.offsetWidth;
    const containerCenter = containerWidth / 2 + container.scrollLeft;
    const itemWidth = itemSize + gap;

    // Find closest item to center
    let closestIndex = 0;
    let closestDistance = Infinity;

    for (let i = 0; i < items.length; i++) {
      const itemCenter = i * itemWidth + itemSize / 2;
      const distance = Math.abs(itemCenter - containerCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }

    return closestIndex;
  }, [items.length, itemSize, gap, selectedIndex]);

  // Auto-scroll to selected item when it changes
  useEffect(() => {
    scrollToIndex(selectedIndex, true);
  }, [selectedIndex, scrollToIndex]);

  // Initial scroll to selected item (no animation)
  useEffect(() => {
    if (containerRef.current) {
      scrollToIndex(selectedIndex, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Mouse drag handlers
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  /**
   * Click handler for item selection
   */
  const handleItemClick = (item: T, index: number) => {
    if (isDragging) return; // Ignore clicks during drag

    onSelect(item, index);
  };

  /**
   * Keyboard navigation
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && selectedIndex > 0) {
      e.preventDefault();
      onSelect(items[selectedIndex - 1], selectedIndex - 1);
    } else if (e.key === 'ArrowRight' && selectedIndex < items.length - 1) {
      e.preventDefault();
      onSelect(items[selectedIndex + 1], selectedIndex + 1);
    }
  };

  // Calculate container width to show exact visible count
  const containerWidth = visibleCount * itemSize + (visibleCount - 1) * gap;

  return (
    <div
      className={cn('relative w-full overflow-hidden', className)}
      style={{ maxWidth: `${containerWidth}px` }}
    >
      <div
        ref={containerRef}
        role="listbox"
        aria-activedescendant={id ? `${id}-item-${selectedIndex}` : undefined}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'flex gap-4 overflow-x-auto scrollbar-hide',
          'scroll-smooth snap-x snap-mandatory',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
          'focus:outline-none focus:ring-2 focus:ring-accent-sage/30 focus:ring-offset-2 rounded-lg'
        )}
        style={{
          gap: `${gap}px`,
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
          WebkitOverflowScrolling: 'touch', // iOS momentum
        }}
      >
        {items.map((item, index) => {
          const scale = calculateScale(index);
          const isCenter = index === selectedIndex;

          return (
            <div
              key={index}
              id={id ? `${id}-item-${index}` : undefined}
              role="option"
              aria-selected={isCenter}
              onClick={() => handleItemClick(item, index)}
              className={cn(
                'flex-shrink-0 snap-center',
                'transition-transform duration-300 ease-out',
                !isDragging && 'hover:scale-105 active:scale-95'
              )}
              style={{
                width: `${itemSize}px`,
                transform: `scale(${scale})`,
              }}
            >
              {renderItem(item, index, isCenter, scale)}
            </div>
          );
        })}
      </div>

      {/* Fade edges for visual affordance */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white/80 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white/80 to-transparent" />
    </div>
  );
}
