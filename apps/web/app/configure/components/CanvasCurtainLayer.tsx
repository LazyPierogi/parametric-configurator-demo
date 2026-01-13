/**
 * Canvas Curtain Layer
 * Task 1010+ - Canvas-based curtain rendering
 * 
 * Renders curtain using Canvas 2D pipelines instead of CSS backgrounds.
 * Maintains position/sizing compatibility with existing CSS layer.
 */

'use client';

import { useEffect, useRef, useState, useCallback, useLayoutEffect, useMemo } from 'react';
import type { Fabric } from '@curtain-wizard/core/src/catalog/types';
import { renderCurtain, getPipelineFromEnv, clearBlurredWallBoxCache, getBlurredWallBox, getCanonicalCanvasWidth } from '@/lib/canvas-renderer';
import type { RenderPipeline } from '@/lib/canvas-renderer';
import { serializeRenderParams, formatWallBox, formatSegmentBounds } from '@/lib/canvas-renderer/key-utils';

const canvasSignatureMap = new WeakMap<HTMLCanvasElement, string>();
let canvasSignatureCounter = 0;

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function getBackgroundSignature(
  backgroundImage: HTMLImageElement | HTMLCanvasElement | undefined,
  enabled: boolean
): string {
  if (!enabled || !backgroundImage) return 'none';

  if (backgroundImage instanceof HTMLImageElement) {
    const src = backgroundImage.currentSrc || backgroundImage.src || 'inline';
    const dims = `${backgroundImage.naturalWidth || backgroundImage.width}x${backgroundImage.naturalHeight || backgroundImage.height}`;
    return `img:${hashString(`${src}|${dims}`)}`;
  }

  const dims = `${backgroundImage.width}x${backgroundImage.height}`;
  let signature = canvasSignatureMap.get(backgroundImage);
  if (!signature || !signature.startsWith(`canvas:${dims}`)) {
    canvasSignatureCounter += 1;
    signature = `canvas:${dims}#${canvasSignatureCounter.toString(36)}`;
    canvasSignatureMap.set(backgroundImage, signature);
  }
  return signature;
}

/**
 * Debounce utility for render optimization
 * Prevents excessive re-renders during rapid parameter changes
 */
function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);
  
  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  return useCallback(
    ((...args: any[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    }) as T,
    [delay]
  );
}

export type CanvasCurtainLayerProps = {
  /** Selected fabric with materialFamily */
  fabric: Fabric;
  /** Selected color hex */
  colorHex: string;
  /** Pleat ID (wave, flex, doubleFlex) */
  pleatId: string;
  /** Canvas dimensions (px) */
  width: number;
  height: number;
  /** Horizontal texture scale (tile width in px) */
  textureScale: number;
  /** Texture opacity (0-100) */
  opacity: number;
  /** Background image for translucent pipeline (uploaded photo) */
  backgroundImage?: HTMLImageElement | HTMLCanvasElement;
  /** Wall box coordinates in pixels (for background blur ROI) */
  wallBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Segment position within Wall Box (for transmission mapping) */
  segmentBounds?: {
    /** Horizontal offset from Wall Box left edge (px) */
    xInWallBox: number;
    /** Segment width (px) */
    width: number;
  };
  /** Disable transmission rendering (for shared transmission layer) */
  disableTransmission?: boolean;
  /** Debug mode */
  debug?: boolean;
  /** Custom pipeline override (for debug UI) */
  pipelineOverride?: RenderPipeline;
  /** Live render parameters for artist pipeline tweaking */
  renderParams?: {
    shadowStrength: number;
    weaveStrength: number;
    occlusionStrength: number;
    transmissionStrength?: number;
    specularStrength?: number;
    artistVariant?: number;
    weaveBlendMode?: 'multiply' | 'overlay';
  };
  /** Skip rendering during active drag operations to prevent flickering */
  isDragging?: boolean;
  /** Global horizontal offset in px for tiling continuity */
  tileOffsetPx?: number;
  /** Vertical offset in px (pre-rotation) to keep top edge anchored */
  verticalOffsetPx?: number;
  /** Notify parent when a heavy render is in progress (cache miss) */
  onRenderStatusChange?: (isRendering: boolean) => void;
  onDidPaint?: () => void;
};

/**
 * Canvas curtain rendering layer
 * Replaces CSS background when canvas pipeline is enabled
 */
export function CanvasCurtainLayer({
  fabric,
  colorHex,
  pleatId,
  width,
  height,
  textureScale,
  opacity,
  backgroundImage,
  wallBox,
  segmentBounds,
  disableTransmission = false,
  debug = false,
  pipelineOverride,
  renderParams,
  isDragging = false,
  tileOffsetPx = 0,
  verticalOffsetPx = 0,
  onRenderStatusChange,
  onDidPaint,
}: CanvasCurtainLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const prevIsDraggingRef = useRef(isDragging);

  const scheduleDidPaint = useCallback(
    (paintRequestId: number) => {
      if (!onDidPaint) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (renderRequestIdRef.current !== paintRequestId) return;
          onDidPaint();
        });
      });
    },
    [onDidPaint],
  );
  
  // Cache the rendered texture pattern (independent of canvas width)
  const cachedTextureRef = useRef<HTMLCanvasElement | null>(null);
  const textureParamsKeyRef = useRef<string>('');
  const renderRequestIdRef = useRef(0);
  const scaledTileCacheRef = useRef<{
    source: HTMLCanvasElement;
    tileWidth: number;
    height: number;
    canvas: HTMLCanvasElement;
  } | null>(null);

  const lastReportedRenderingRef = useRef(false);
  const reportRenderingStatus = useCallback(
    (isRenderingNow: boolean) => {
      if (!onRenderStatusChange) return;
      if (lastReportedRenderingRef.current === isRenderingNow) return;
      lastReportedRenderingRef.current = isRenderingNow;
      onRenderStatusChange(isRenderingNow);
    },
    [onRenderStatusChange],
  );

  // Determine pipeline
  const pipeline = pipelineOverride || getPipelineFromEnv();

  const effectiveRenderParams = useMemo(() => {
    if (!renderParams) return undefined;
    if (!disableTransmission) return renderParams;
    const strength = renderParams.transmissionStrength ?? 0;
    if (strength <= 0.02) return renderParams;
    return { ...renderParams, transmissionStrength: 0 };
  }, [renderParams, disableTransmission]);

  // Serialize renderParams for stable comparison
  const renderParamsKey = serializeRenderParams(effectiveRenderParams);
  
  // Create cache key for texture (excludes width - texture is width-independent)
  // EXCEPTION: Include width and background keys when transmission is active (no tiling allowed)
  const hasTransmission = !disableTransmission && (effectiveRenderParams?.transmissionStrength ?? 0) > 0.02;
  const backgroundSignature = getBackgroundSignature(backgroundImage, hasTransmission);
  const wallBoxKey = hasTransmission && wallBox ? formatWallBox(wallBox) : 'none';
  const segmentKey = hasTransmission && segmentBounds ? formatSegmentBounds(segmentBounds) : 'none';
  const normalizedTextureScale = Math.round(textureScale * 100) / 100;
  const textureKeyParts = [
    `pipe:${pipeline}`,
    `fabric:${fabric.sku}`,
    `color:${colorHex}`,
    `pleat:${pleatId}`,
    `scale:${normalizedTextureScale}`,
    `height:${height}`,
    `params:${renderParamsKey || 'default'}`,
  ];
  if (hasTransmission) {
    textureKeyParts.push(
      `width:${width}`,
      `bg:${backgroundSignature}`,
      `wall:${wallBoxKey}`,
      `seg:${segmentKey}`
    );
  }
  const textureParamsKey = textureKeyParts.join('|');
  
  // Stable tiling function - scales high-res texture to tileWidth before tiling
  // EXCEPTION: When texture is already full-width (transmission mode), draw 1:1 without tiling
  const drawTexture = useCallback(
    (
      textureCanvas: HTMLCanvasElement | null,
      targetWidth: number,
      targetHeight: number,
      tileWidth: number,
      offsetX: number,
      offsetY: number,
    ) => {
      if (!textureCanvas || !canvasRef.current) return;
      if (!Number.isFinite(targetWidth) || !Number.isFinite(targetHeight)) return;
      if (targetWidth <= 0 || targetHeight <= 0) return; // Avoid invalid draw calls on zero-sized canvas
      if (textureCanvas.width <= 0 || textureCanvas.height <= 0) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, targetWidth, targetHeight);

      // If texture canvas is already full-width (transmission mode), draw 1:1
      if (textureCanvas.width === targetWidth) {
        const destY = Math.min(0, offsetY);
        ctx.drawImage(textureCanvas, 0, destY);
        return;
      }

      const actualTileWidth = Math.max(20, tileWidth); // Minimum 20px tile width
      if (actualTileWidth <= 0) return;

      let scaledTileEntry = scaledTileCacheRef.current;
      const needsNewTile =
        !scaledTileEntry ||
        scaledTileEntry.source !== textureCanvas ||
        scaledTileEntry.tileWidth !== actualTileWidth ||
        scaledTileEntry.height !== targetHeight;

      if (needsNewTile) {
      const scaledTile = document.createElement('canvas');
      scaledTile.width = actualTileWidth;
      scaledTile.height = targetHeight;
      const scaledCtx = scaledTile.getContext('2d');
      if (!scaledCtx) return;
      if (textureCanvas.width <= 0 || textureCanvas.height <= 0) return;
      scaledCtx.drawImage(textureCanvas, 0, 0, actualTileWidth, targetHeight);

        scaledTileEntry = {
          source: textureCanvas,
          tileWidth: actualTileWidth,
          height: targetHeight,
          canvas: scaledTile,
        };
        scaledTileCacheRef.current = scaledTileEntry;
      }

      const scaledTile = scaledTileEntry!.canvas;

      // Horizontal tiling with top-anchored vertical placement
      const normalizedOffsetX =
        ((offsetX % actualTileWidth) + actualTileWidth) % actualTileWidth;
      const destY = Math.min(0, offsetY);
      let drawX = -normalizedOffsetX;

      while (drawX < targetWidth) {
        const destX = Math.max(0, drawX);
        if (destX >= targetWidth) break;
        const srcX = destX - drawX;
        const destWidth = Math.min(actualTileWidth - srcX, targetWidth - destX);

        ctx.drawImage(
          scaledTile,
          srcX,
          0,
          destWidth,
          targetHeight,
          destX,
          destY,
          destWidth,
          targetHeight
        );

        drawX += actualTileWidth;
      }
    },
    [],
  );

  // Core render function - renders texture pattern at canonical width
  const performRender = useCallback(async () => {
    if (!canvasRef.current) return;
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    if (width <= 0 || height <= 0) return; // Skip rendering when layout hasn't measured yet

    // Check if we can reuse cached texture (params haven't changed)
    const canReuseCachedTexture =
      cachedTextureRef.current &&
      textureParamsKeyRef.current === textureParamsKey;

    if (canReuseCachedTexture && cachedTextureRef.current) {
      setRenderError(null);
       // Ensure parent knows we're not in a heavy render path
      reportRenderingStatus(false);
      drawTexture(
        cachedTextureRef.current,
        width,
        height,
        textureScale,
        tileOffsetPx,
        verticalOffsetPx,
      );
      scheduleDidPaint(renderRequestIdRef.current);
      setIsRendering(false);
      return;
    }

    const requestId = renderRequestIdRef.current + 1;
    renderRequestIdRef.current = requestId;
    setIsRendering(true);
    reportRenderingStatus(true);
    setRenderError(null);

    try {
      // Render at canonical resolution for artist pipeline (configurable via env).
      // This preserves texture detail before tiling.
      // EXCEPTION: When transmission is active, render at full segment width to prevent tiling artifacts.
      const canonicalWidth = getCanonicalCanvasWidth(pipeline, width, hasTransmission);

      const result = await renderCurtain({
        pipeline,
        fabric,
        colorHex,
        pleatId,
        canvasWidth: canonicalWidth,
        canvasHeight: height,
        textureScale,
        backgroundImage,
        wallBox,
        segmentBounds,
        debug,
        renderParams: effectiveRenderParams,
        backgroundSignature,
      });

      if (renderRequestIdRef.current !== requestId) {
        return;
      }

      const textureCanvas = result.canvas;
      if (!textureCanvas || textureCanvas.width <= 0 || textureCanvas.height <= 0) {
        if (debug) {
          console.warn('[CanvasCurtainLayer] Skipping cache: render returned zero-sized canvas', {
            w: textureCanvas?.width,
            h: textureCanvas?.height,
          });
        }
        setRenderError('Texture canvas has zero size');
        return;
      }

      // Cache the rendered texture
      cachedTextureRef.current = textureCanvas;
      textureParamsKeyRef.current = textureParamsKey;
      scaledTileCacheRef.current = null;

      if (debug) {
        console.log('[CanvasCurtainLayer] Rendered new texture', result.metrics);
      }

      // Tile the texture pattern across the actual canvas width
      drawTexture(
        textureCanvas,
        width,
        height,
        textureScale,
        tileOffsetPx,
        verticalOffsetPx,
      );
      scheduleDidPaint(requestId);
    } catch (error) {
      if (renderRequestIdRef.current !== requestId) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CanvasCurtainLayer] Render failed:', error);
      setRenderError(message);
    } finally {
      if (renderRequestIdRef.current === requestId) {
        setIsRendering(false);
        reportRenderingStatus(false);
      }
    }
  }, [
    pipeline,
    fabric,
    colorHex,
    pleatId,
    textureScale,
    backgroundImage,
    wallBox,
    debug,
    effectiveRenderParams,
    hasTransmission,
    textureParamsKey,
    drawTexture,
    backgroundSignature,
    verticalOffsetPx,
    reportRenderingStatus,
    onDidPaint,
    scheduleDidPaint,
  ]);
  // Note: width, height, tileOffsetPx intentionally excluded - captured from scope.
  // Width changes are handled by separate fast-tiling effect below.

  // Debounced render for slider changes (16ms = ~60fps threshold)
  const debouncedRender = useDebounce(performRender, 16);

  // Effect for texture parameter changes (texture generation)
  // This effect handles everything EXCEPT width changes during drag
  useEffect(() => {
    if (debug) {
      console.log('[CanvasCurtainLayer] Main effect fired', {
        pipeline,
        pleat: pleatId,
        fabric: fabric.sku,
        hasCache: !!cachedTextureRef.current,
      });
    }
    
    // Normal render logic: immediate for major changes, debounced for sliders
    const isRenderParamsOnlyChange = renderParamsKey !== '';
    
    if (isRenderParamsOnlyChange && renderParams) {
      // Debounce slider changes (actual texture re-render)
      debouncedRender();
    } else {
      // Immediate render for major changes (fabric, color, pleat, height, etc.)
      performRender();
    }
  }, [pipeline, fabric, colorHex, pleatId, height, textureScale, backgroundImage, wallBox, debug, renderParamsKey, backgroundSignature]);
  // Note: performRender and debouncedRender intentionally excluded - they are stable callbacks
  // and including them creates an infinite re-render loop
  
  // Separate effect for width/offset changes (tiling only - uses cached texture)
  // CRITICAL: This effect provides the fast path for width changes during resize.
  // It only tiles the cached texture (~1ms) instead of re-rendering (~40-80ms).
  // Height is NOT a dependency - height changes should trigger the main effect for full re-render.
  useLayoutEffect(() => {
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    if (width <= 0 || height <= 0) return;
    if (!cachedTextureRef.current || cachedTextureRef.current.width <= 0 || cachedTextureRef.current.height <= 0) {
      return;
    }
    const hasValidCache =
      cachedTextureRef.current &&
      textureParamsKeyRef.current === textureParamsKey;

    // Skip if no valid cache - main effect will handle initial render
    if (!hasValidCache) {
      if (debug) {
        console.log('[CanvasCurtainLayer] Width effect skipped - no valid cache');
      }
      return;
    }

    if (debug) {
      console.log('[CanvasCurtainLayer] Width effect: tiling cached texture', {
        width,
        tileOffsetPx,
        verticalOffsetPx,
      });
    }

    // Fast path: tile the cached texture
    drawTexture(
      cachedTextureRef.current!,
      width,
      height,
      textureScale,
      tileOffsetPx,
      verticalOffsetPx,
    );
  }, [
    width,
    height,
    tileOffsetPx,
    textureScale,
    textureParamsKey,
    drawTexture,
    debug,
    verticalOffsetPx,
  ]);
  
  // Effect for drag state changes
  useEffect(() => {
    const wasDragging = prevIsDraggingRef.current;
    prevIsDraggingRef.current = isDragging;
    
    // If we just stopped dragging, trigger immediate render to ensure final state
    if (wasDragging && !isDragging) {
      const hasValidCache =
        cachedTextureRef.current &&
        textureParamsKeyRef.current === textureParamsKey;

      if (!hasValidCache) {
        performRender();
      } else if (cachedTextureRef.current) {
        drawTexture(
          cachedTextureRef.current,
          width,
          height,
          textureScale,
          tileOffsetPx,
          verticalOffsetPx,
        );
      }
    }
  }, [isDragging]);
  // Note: performRender intentionally excluded - it's a stable callback

  // Clear blurred Wall Box cache when background image changes
  useEffect(() => {
    clearBlurredWallBoxCache();
  }, [backgroundImage]);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: opacity / 100,
          pointerEvents: 'none',
        }}
      />
      
      {renderError && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(255,0,0,0.8)',
          color: 'white',
          padding: '5px 10px',
          borderRadius: '4px',
          fontSize: '12px',
        }}>
          Canvas render error: {renderError}
        </div>
      )}
      
    </>
  );
}

/**
 * Transmission Layer - renders shared transmission across all curtain segments
 * Should be positioned over the entire Wall Box area
 */
export type TransmissionLayerProps = {
  /** Selected fabric with materialFamily */
  fabric: Fabric;
  /** Selected color hex */
  colorHex: string;
  /** Canvas dimensions (px) - should match Wall Box dimensions */
  width: number;
  height: number;
  /** Background image for transmission (uploaded photo) */
  backgroundImage?: HTMLImageElement | HTMLCanvasElement;
  /** Wall box coordinates in pixels (for background blur ROI) */
  wallBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Transmission strength (0-1) */
  transmissionStrength: number;
  /** Debug mode */
  debug?: boolean;
  /** Counter rotation (rad) to keep blur aligned with background */
  counterRotateRad?: number;
};

export function TransmissionLayer({
  fabric,
  colorHex,
  width,
  height,
  backgroundImage,
  wallBox,
  transmissionStrength,
  debug = false,
  counterRotateRad = 0,
}: TransmissionLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render transmission effect - just draw blurred background with opacity
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!backgroundImage || !wallBox || transmissionStrength <= 0.02) {
      // Clear canvas when no transmission
      ctx.clearRect(0, 0, width, height);
      return;
    }

    // Get cached blurred Wall Box
    const blurred = getBlurredWallBox(backgroundImage, wallBox);
    if (!blurred) return;

    // Draw to canvas with transmission strength as opacity
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = transmissionStrength;
    ctx.drawImage(blurred, 0, 0, width, height);
    ctx.globalAlpha = 1.0;

    if (debug) {
      console.log('[TransmissionLayer] Drew blurred background', { transmissionStrength });
    }
  }, [width, height, backgroundImage, wallBox, transmissionStrength, debug]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        mixBlendMode: 'multiply', // Blend transmission with curtain segments
        transform: counterRotateRad ? `rotate(${-counterRotateRad}rad)` : undefined,
        transformOrigin: counterRotateRad ? '0 0' : undefined,
      }}
    />
  );
}
