'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface CollapsibleSectionProps {
  /** Section title */
  title: string;
  
  /** Optional item count to display in title (e.g., "Colors (24)") */
  itemCount?: number;
  
  /** Default collapsed state */
  defaultCollapsed?: boolean;
  
  /** Controlled collapsed state (overrides defaultCollapsed) */
  collapsed?: boolean;
  
  /** Callback when collapsed state changes */
  onToggle?: (collapsed: boolean) => void;
  
  /** Optional icon/component to show before title */
  icon?: React.ReactNode;
  
  /** Section content */
  children: React.ReactNode;
  
  /** Optional className for container */
  className?: string;
  
  /** Optional className for content area */
  contentClassName?: string;
  
  /** Disable collapse/expand (always expanded) */
  disabled?: boolean;
}

/**
 * Collapsible section with smooth expand/collapse animation
 * 
 * Features:
 * - Smooth height animation with CSS transitions
 * - Accessible (ARIA attributes, keyboard support)
 * - Glass panel aesthetic
 * - Item count badge
 * - Controlled or uncontrolled mode
 * 
 * @example
 * ```tsx
 * <CollapsibleSection 
 *   title="Colors" 
 *   itemCount={24}
 *   defaultCollapsed={true}
 * >
 *   <ColorCarousel items={colors} />
 * </CollapsibleSection>
 * ```
 */
export function CollapsibleSection({
  title,
  itemCount,
  defaultCollapsed = false,
  collapsed: controlledCollapsed,
  onToggle,
  icon,
  children,
  className,
  contentClassName,
  disabled = false,
}: CollapsibleSectionProps) {
  // Controlled vs uncontrolled state
  const isControlled = controlledCollapsed !== undefined;
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const collapsed = isControlled ? controlledCollapsed : internalCollapsed;

  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto');

  /**
   * Toggle collapsed state
   */
  const handleToggle = () => {
    if (disabled) return;

    const newCollapsed = !collapsed;

    if (!isControlled) {
      setInternalCollapsed(newCollapsed);
    }

    onToggle?.(newCollapsed);
  };

  /**
   * Measure content height for smooth animation
   */
  useEffect(() => {
    if (!contentRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const element = entry.target;
        const rect = element.getBoundingClientRect();
        setContentHeight(rect.height);
      }
    });

    resizeObserver.observe(contentRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  /**
   * Keyboard support
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div className={cn('rounded-xl overflow-hidden', className)}>
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-expanded={!collapsed}
        className={cn(
          'w-full flex items-center justify-between',
          'px-4 py-3',
          'bg-white/55 backdrop-blur-md',
          'border-b border-neutral-200/50',
          'transition-all duration-200',
          !disabled && 'hover:bg-white/65 active:bg-white/70',
          disabled && 'cursor-default',
          !disabled && 'cursor-pointer focus:outline-none'
        )}
      >
        <div className="flex items-center gap-2">
          {icon && <div className="flex-shrink-0">{icon}</div>}
          
          <span className="font-semibold text-neutral-800 text-sm uppercase tracking-wide">
            {title}
          </span>

          {itemCount !== undefined && itemCount > 0 && (
            <span className="text-xs text-neutral-500 font-normal">
              ({itemCount})
            </span>
          )}
        </div>

        {!disabled && (
          <svg
            className={cn(
              'w-5 h-5 text-neutral-600 transition-transform duration-300 ease-out',
              !collapsed && 'rotate-180'
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Content with smooth height animation */}
      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          height: collapsed ? 0 : contentHeight === 'auto' ? 'auto' : `${contentHeight}px`,
        }}
      >
        <div
          ref={contentRef}
          className={cn(
            'bg-white/40 backdrop-blur-sm',
            'px-4 py-3',
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
