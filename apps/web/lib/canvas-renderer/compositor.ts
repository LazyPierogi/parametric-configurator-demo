/**
 * Canvas Compositor
 * Task 1010+ - Canvas-based curtain rendering system
 * 
 * Core 2D compositing operations: blending modes, texture sampling,
 * and layer composition.
 */

import { lerp, clamp } from './color-utils';

/**
 * Blend modes for layer composition
 */
export type BlendMode = 
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'color-dodge'
  | 'add';

/**
 * Apply blend mode between base and overlay colors
 * All values in 0-1 range
 */
export function blend(base: number, overlay: number, mode: BlendMode, alpha = 1.0): number {
  let result: number;
  
  switch (mode) {
    case 'normal':
      result = overlay;
      break;
      
    case 'multiply':
      result = base * overlay;
      break;
      
    case 'screen':
      result = 1 - (1 - base) * (1 - overlay);
      break;
      
    case 'overlay':
      result = base < 0.5
        ? 2 * base * overlay
        : 1 - 2 * (1 - base) * (1 - overlay);
      break;
      
    case 'soft-light':
      // Pegtop formula (simpler than Photoshop)
      result = (1 - 2 * overlay) * base * base + 2 * overlay * base;
      break;
      
    case 'color-dodge':
      result = base === 1 ? 1 : Math.min(1, overlay / (1 - base));
      break;
      
    case 'add':
      result = base + overlay;
      break;
      
    default:
      result = overlay;
  }
  
  // Apply alpha blending
  return lerp(base, result, alpha);
}

/**
 * Sample texture at normalized UV coordinates
 * Returns luminance value (0-1)
 */
export function sampleTexture(
  imageData: ImageData,
  u: number,
  v: number,
  mode: 'clamp' | 'repeat' = 'repeat'
): number {
  const width = imageData.width;
  const height = imageData.height;
  
  // Handle UV wrapping
  let x: number, y: number;
  
  if (mode === 'repeat') {
    x = ((u % 1) + 1) % 1; // Wrap to 0-1
    y = ((v % 1) + 1) % 1;
  } else {
    x = clamp(u, 0, 1);
    y = clamp(v, 0, 1);
  }
  
  // Convert to pixel coordinates
  const px = Math.floor(x * (width - 1));
  const py = Math.floor(y * (height - 1));
  
  const idx = (py * width + px) * 4;
  
  // Return luminance value from texture
  const r = imageData.data[idx] / 255;
  
  return r;
}

/**
 * Create offscreen canvas for intermediate operations
 */
export function createOffscreenCanvas(width: number, height: number): HTMLCanvasElement {
  // Try OffscreenCanvas first (better performance), fallback to regular canvas
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const offscreen = new OffscreenCanvas(width, height);
      // Convert to HTMLCanvasElement for compatibility
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(offscreen as any, 0, 0);
      return canvas;
    } catch (e) {
      // Fallback if OffscreenCanvas fails
    }
  }
  
  // Regular canvas fallback
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Apply Gaussian blur to canvas
 * Used for background processing
 */
export function applyBlur(
  sourceCanvas: HTMLCanvasElement,
  blurRadius: number
): HTMLCanvasElement {
  const canvas = createOffscreenCanvas(sourceCanvas.width, sourceCanvas.height);
  const ctx = canvas.getContext('2d')!;
  
  // Use CSS filter for efficient blur
  ctx.filter = `blur(${blurRadius}px)`;
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.filter = 'none';
  
  return canvas;
}

/**
 * Extract region of interest from canvas
 */
export function extractROI(
  sourceCanvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = createOffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  
  ctx.drawImage(
    sourceCanvas,
    x, y, width, height,  // Source rect
    0, 0, width, height   // Dest rect
  );
  
  return canvas;
}

/**
 * Composite two canvases with blend mode
 */
export function compositeCanvases(
  base: HTMLCanvasElement,
  overlay: HTMLCanvasElement,
  blendMode: BlendMode,
  alpha = 1.0
): HTMLCanvasElement {
  const canvas = createOffscreenCanvas(base.width, base.height);
  const ctx = canvas.getContext('2d')!;
  
  // Draw base
  ctx.drawImage(base, 0, 0);
  
  // Set blend mode and alpha
  ctx.globalCompositeOperation = mapBlendModeToComposite(blendMode);
  ctx.globalAlpha = alpha;
  
  // Draw overlay
  ctx.drawImage(overlay, 0, 0);
  
  // Reset
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1.0;
  
  return canvas;
}

/**
 * Map our blend mode enum to Canvas composite operation
 */
function mapBlendModeToComposite(mode: BlendMode): GlobalCompositeOperation {
  const mapping: Record<BlendMode, GlobalCompositeOperation> = {
    'normal': 'source-over',
    'multiply': 'multiply',
    'screen': 'screen',
    'overlay': 'overlay',
    'soft-light': 'soft-light',
    'color-dodge': 'color-dodge',
    'add': 'lighter',
  };
  
  return mapping[mode] || 'source-over';
}

/**
 * Fill canvas with solid color
 */
export function fillCanvas(
  canvas: HTMLCanvasElement,
  color: string
): void {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Load image and return as HTMLImageElement
 */
export async function loadImage(url: string): Promise<HTMLImageElement> {
  const loadHtmlImage = (src: string, crossOrigin?: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      if (crossOrigin) {
        img.crossOrigin = crossOrigin;
      }
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });

  const validateCanvasAccessibility = (img: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }

    try {
      ctx.drawImage(img, 0, 0);
    } catch (error) {
      throw new Error(
        `Failed to draw image to canvas during validation: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    try {
      ctx.getImageData(0, 0, 1, 1);
    } catch (error) {
      throw new Error(
        `Canvas is tainted or image is not accessible due to CORS/security restrictions: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  };

  let lastError: unknown;

  try {
    const img = await loadHtmlImage(url, 'anonymous');
    validateCanvasAccessibility(img);
    return img;
  } catch (error) {
    lastError = error;
  }

  try {
    const corsImg = await loadHtmlImage(url);
    validateCanvasAccessibility(corsImg);
    return corsImg;
  } catch (error) {
    lastError = error;
  }

  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status} for URL: ${url}`);
    }

    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Invalid content-type ${contentType} for URL: ${url}`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    try {
      const img = await loadHtmlImage(blobUrl, 'anonymous');
      if (typeof img.decode === 'function') {
        await img.decode();
      }

      validateCanvasAccessibility(img);
      return img;
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch (error) {
    const primaryMessage =
      error instanceof Error ? error.message : `Unknown error: ${String(error)}`;
    const fallbackMessage =
      lastError instanceof Error ? lastError.message : lastError
        ? String(lastError)
        : '';

    throw new Error(
      `Failed to load and validate image: ${url}, error: ${primaryMessage}${
        fallbackMessage ? `; previous attempt: ${fallbackMessage}` : ''
      }`
    );
  }
}

/**
 * Draw image to canvas and return ImageData
 */
export function imageToImageData(img: HTMLImageElement): ImageData {
  const canvas = createOffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d')!;
  try {
    ctx.drawImage(img, 0, 0);
  } catch (error) {
    throw new Error(
      `Failed to draw image to canvas for ImageData conversion: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  return ctx.getImageData(0, 0, img.width, img.height);
}
 
