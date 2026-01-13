'use client';

import { ReactNode, useRef, useState, useCallback, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface DraggableDebugPanelProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}

export function DraggableDebugPanel({ open, onClose, title, children }: DraggableDebugPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  // Only render portal on client
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMouseDown = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      setIsDragging(true);
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;
      
      // Keep panel within viewport bounds
      const maxX = window.innerWidth - (panelRef.current?.offsetWidth || 400);
      const maxY = window.innerHeight - 50; // Leave some room at bottom
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Handle Escape key
  useEffect(() => {
    if (!open) return;
    
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      data-cw-component="DraggableDebugPanel"
      className={cn(
        'fixed z-[9999] w-[420px] max-h-[80vh] overflow-hidden',
        'rounded-xl shadow-2xl border border-active-border bg-active-bg',
        'flex flex-col',
        isDragging && 'cursor-grabbing select-none'
      )}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {/* Draggable Header */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'flex items-center justify-between gap-3 px-4 py-3',
          'border-b border-active-border bg-neutral-100',
          'cursor-grab select-none',
          isDragging && 'cursor-grabbing'
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-neutral-400 text-sm">⋮⋮</span>
          <h3 className="text-sm font-semibold text-active-text m-0">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200 transition-colors"
          aria-label="Close panel"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {children}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
