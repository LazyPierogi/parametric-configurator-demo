'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface ImageModalProps {
  open: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
  title?: string;
}

/**
 * ImageModal - Full-screen image viewer with pan & pinch-zoom on mobile
 * 
 * Desktop: Fixed 1024x1024px display
 * Mobile: Smaller with touch pan/pinch zoom support
 */
export function ImageModal({ open, onClose, src, alt = '', title }: ImageModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const lastTouchDistance = useRef<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
      lastTouchDistance.current = null;
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Handle touch pinch zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    
    if (e.touches.length === 2) {
      // Start pinch
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastTouchDistance.current = distance;
    } else if (e.touches.length === 1 && scale > 1) {
      // Start pan (only if zoomed)
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return;
    
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      // Pinch zoom
      e.preventDefault();
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = distance / lastTouchDistance.current;
      const newScale = Math.min(Math.max(scale * delta, 1), 4);
      setScale(newScale);
      lastTouchDistance.current = distance;
      
      // Reset position if zooming out to 1
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      // Pan
      e.preventDefault();
      const newX = e.touches[0].clientX - dragStart.x;
      const newY = e.touches[0].clientY - dragStart.y;
      
      // Limit panning based on image size
      const container = containerRef.current;
      const image = imageRef.current;
      if (container && image) {
        const maxX = (image.offsetWidth * scale - container.offsetWidth) / 2;
        const maxY = (image.offsetHeight * scale - container.offsetHeight) / 2;
        setPosition({
          x: Math.min(Math.max(newX, -maxX), maxX),
          y: Math.min(Math.max(newY, -maxY), maxY),
        });
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isMobile) return;
    setIsDragging(false);
    lastTouchDistance.current = null;
  };

  // Handle mouse drag (desktop fallback)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile || scale <= 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isMobile) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    const container = containerRef.current;
    const image = imageRef.current;
    if (container && image) {
      const maxX = (image.offsetWidth * scale - container.offsetWidth) / 2;
      const maxY = (image.offsetHeight * scale - container.offsetHeight) / 2;
      setPosition({
        x: Math.min(Math.max(newX, -maxX), maxX),
        y: Math.min(Math.max(newY, -maxY), maxY),
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Frosty backdrop - unified with measurement confirmation modal */}
      <div
        className={cn(
          'absolute inset-0 backdrop-blur-sm animate-in fade-in duration-200',
          isMobile ? 'bg-black/45' : 'bg-black/50'
        )}
        aria-hidden="true"
      />
      
      {/* Modal content - unified styling */}
      <div
        ref={containerRef}
        className={cn(
          'relative overflow-hidden',
          'animate-in duration-200 ease-out slide-in-from-bottom-4 zoom-in-95',
          isMobile 
            ? 'w-full max-w-[90vw] max-h-[90vh] rounded-2xl bg-white shadow-xl' 
            : 'w-[1024px] h-[1024px] rounded-[14px] bg-white shadow-[0_18px_44px_rgba(0,0,0,0.18)]'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with close button - unified font styling */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-gradient-to-b from-black/50 to-transparent">
          {title && (
            <h2 className="text-white font-bold text-lg drop-shadow-lg">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'ml-auto rounded-full p-2 transition-all',
              'bg-white/90 hover:bg-white',
              'text-neutral-900',
              'shadow-lg hover:shadow-xl',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50'
            )}
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Image container */}
        <div
          className={cn(
            'w-full h-full flex items-center justify-center bg-neutral-100',
            isMobile && scale > 1 && 'cursor-grab',
            isMobile && isDragging && 'cursor-grabbing'
          )}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            className={cn(
              'max-w-full max-h-full object-contain select-none',
              'transition-transform duration-100'
            )}
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center',
            }}
            draggable={false}
          />
        </div>

        {/* Mobile zoom hint */}
        {isMobile && scale === 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/70 text-white text-xs rounded-full backdrop-blur-sm animate-in fade-in duration-300 delay-300">
            Pinch to zoom
          </div>
        )}
      </div>
    </div>
  , document.body);
}
