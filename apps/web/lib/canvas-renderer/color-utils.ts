/**
 * Color Utilities
 * Task 1010+ - Canvas-based curtain rendering system
 * 
 * Color space conversions, luminance calculations, and blending operations.
 */

/**
 * Parse hex color to RGB components (0-255)
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return { r, g, b };
}

/**
 * RGB to hex string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Calculate relative luminance (WCAG 2.1 formula)
 * Returns value between 0 (black) and 1 (white)
 * 
 * @see https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  
  // Convert to 0-1 range and linearize
  const linearize = (val: number): number => {
    const normalized = val / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };
  
  const R = linearize(r);
  const G = linearize(g);
  const B = linearize(b);
  
  // WCAG luminance formula
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Convert RGB to HSL
 * Returns { h: 0-360, s: 0-1, l: 0-1 }
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    
    if (max === r) {
      h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / delta + 2) / 6;
    } else {
      h = ((r - g) / delta + 4) / 6;
    }
  }
  
  return {
    h: h * 360,
    s,
    l,
  };
}

/**
 * Convert HSL to RGB
 * h: 0-360, s: 0-1, l: 0-1
 * Returns RGB in 0-255 range
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = h / 360;
  
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return {
    r: r * 255,
    g: g * 255,
    b: b * 255,
  };
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Check if color is bright (luminance > threshold)
 * Used to determine if translucent pipeline should be used
 */
export function isBrightColor(hex: string, threshold = 0.7): boolean {
  return relativeLuminance(hex) > threshold;
}

/**
 * Apply tone curve based on luminance
 * Returns adjusted shadow gain and highlight clamp based on color brightness
 */
export function computeToneCurve(luminance: number): {
  shadowGain: number;
  highlightClamp: number;
  contrast: number;
} {
  // Darker colors tolerate deeper shadows
  const shadowGain = lerp(0.12, 0.30, 1.0 - luminance);
  
  // Bright colors clamp highlights more aggressively
  const highlightClamp = lerp(0.30, 0.15, 1.0 - luminance);
  
  // Increase contrast for darker colors
  const contrast = 1.0 + lerp(0.05, 0.18, 1.0 - luminance);
  
  return { shadowGain, highlightClamp, contrast };
}
