import { useCallback, useEffect, useState } from 'react';

/**
 * Mobile-first layout hook for fit-to-height approach
 * Task 1.4: Grid & Layout improvements
 * 
 * Provides viewport-aware calculations and layout state management
 * for the Configurator to work without vertical scrolling on mobile devices.
 */

export interface MobileFirstLayoutState {
  // Viewport metrics
  viewportHeight: number;      // Visual viewport height (dvh equivalent)
  safeHeight: number;          // Minus safe-area insets
  availableHeight: number;     // Minus top bar + sticky CTA
  
  // Layout zones
  heroMaxHeight: number;       // 72-80% of available height
  panelMinHeight: number;      // 20% of viewport (collapsed)
  panelMaxHeight: number;      // 35% of viewport (expanded)
  panelCurrentHeight: number;  // Current panel height
  
  // States
  isCollapsed: boolean;
  isFullScreen: boolean;
  
  // Actions
  toggleCollapse: () => void;
  toggleFullScreen: () => void;
  setCollapsed: (collapsed: boolean) => void;
  
  // Platform detection
  isIOS: boolean;
  isMobile: boolean;           // < 768px
  isLandscape: boolean;
}

/**
 * Detect if running on iOS Safari
 */
function detectIOS(): boolean {
  if (typeof window === 'undefined') return false;
  
  const ua = navigator.userAgent;
  const isIOSDevice = /iPad|iPhone|iPod/.test(ua);
  const isIOSSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/.test(ua);
  
  return isIOSDevice || (isIOSSafari && 'standalone' in navigator);
}

/**
 * Get visual viewport dimensions (accounts for browser chrome)
 */
function getVisualViewport(): { width: number; height: number } {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0 };
  }
  
  // Try modern visualViewport API first (iOS Safari 13+)
  if (window.visualViewport) {
    return {
      width: window.visualViewport.width,
      height: window.visualViewport.height,
    };
  }
  
  // Fallback to innerHeight (less accurate on iOS)
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * Get safe-area insets for iOS notch/home bar
 */
function getSafeAreaInsets(): { top: number; bottom: number; left: number; right: number } {
  if (typeof window === 'undefined' || typeof getComputedStyle === 'undefined') {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
  
  const root = document.documentElement;
  const style = getComputedStyle(root);
  
  const parsePx = (value: string): number => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };
  
  return {
    top: parsePx(style.getPropertyValue('--safe-top')),
    bottom: parsePx(style.getPropertyValue('--safe-bottom')),
    left: parsePx(style.getPropertyValue('--safe-left')),
    right: parsePx(style.getPropertyValue('--safe-right')),
  };
}

export function useMobileFirstLayout(): MobileFirstLayoutState {
  const [isCollapsed, setIsCollapsed] = useState(true); // Default collapsed on mobile
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [isIOS] = useState(detectIOS);
  
  // Update viewport dimensions on resize/scroll/rotate
  const updateViewport = useCallback(() => {
    const viewport = getVisualViewport();
    setViewportHeight(viewport.height);
    setViewportWidth(viewport.width);
  }, []);
  
  // Initialize and listen for viewport changes
  useEffect(() => {
    updateViewport();
    
    const handleResize = () => updateViewport();
    const handleScroll = () => updateViewport();
    const handleOrientationChange = () => {
      // Small delay to let OS finish orientation change
      setTimeout(updateViewport, 100);
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // iOS visualViewport events (more accurate)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('orientationchange', handleOrientationChange);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleScroll);
      }
    };
  }, [updateViewport]);
  
  // Calculate layout metrics
  const isMobile = viewportWidth < 768;
  const isLandscape = viewportWidth > viewportHeight;
  
  const safeInsets = getSafeAreaInsets();
  const safeHeight = Math.max(0, viewportHeight - safeInsets.top - safeInsets.bottom);
  
  // Layout constants (in pixels)
  const TOP_BAR_HEIGHT = isMobile ? 0 : 48; // Hide top bar on mobile
  const CTA_HEIGHT = 56;
  
  const availableHeight = Math.max(200, safeHeight - TOP_BAR_HEIGHT - CTA_HEIGHT);
  
  // Hero area: 72-80% of available space (adjust for landscape)
  const heroHeightRatio = isLandscape ? 0.8 : 0.75;
  const heroMaxHeight = Math.max(200, availableHeight * heroHeightRatio);
  
  // Panel sizing
  const panelMinHeight = Math.max(80, viewportHeight * 0.2);
  const panelMaxHeight = Math.max(120, viewportHeight * 0.35);
  const panelCurrentHeight = isCollapsed ? panelMinHeight : panelMaxHeight;
  
  // Actions
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);
  
  const toggleFullScreen = useCallback(() => {
    setIsFullScreen((prev) => !prev);
  }, []);
  
  const setCollapsedState = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
  }, []);
  
  // Auto-collapse panel on mobile when viewport shrinks (e.g., keyboard open)
  useEffect(() => {
    if (isMobile && viewportHeight < 500) {
      setIsCollapsed(true);
    }
  }, [isMobile, viewportHeight]);
  
  return {
    // Metrics
    viewportHeight,
    safeHeight,
    availableHeight,
    heroMaxHeight: isFullScreen ? safeHeight * 0.95 : heroMaxHeight,
    panelMinHeight,
    panelMaxHeight,
    panelCurrentHeight: isFullScreen ? 0 : panelCurrentHeight,
    
    // States
    isCollapsed,
    isFullScreen,
    
    // Actions
    toggleCollapse,
    toggleFullScreen,
    setCollapsed: setCollapsedState,
    
    // Platform
    isIOS,
    isMobile,
    isLandscape,
  };
}
