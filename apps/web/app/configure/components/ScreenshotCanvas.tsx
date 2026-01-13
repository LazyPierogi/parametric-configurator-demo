'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';

export type ScreenshotCanvasRef = {
  getScreenshot: () => Promise<string>;
};

type ScreenshotCanvasProps = {
  imageRef: React.RefObject<HTMLImageElement | null>;
  overlayRef: React.RefObject<HTMLDivElement | null>;
  wallMaskUrl: string | null;
  phase: string;
};

/**
 * Hidden canvas that renders a screenshot-ready composite of the curtain preview
 * Handles mask compositing that CSS can't capture in screenshots
 */
export const ScreenshotCanvas = forwardRef<ScreenshotCanvasRef, ScreenshotCanvasProps>(
  ({ imageRef, overlayRef, wallMaskUrl, phase }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const lastRenderKey = useRef<string>('');

    // Core rendering function
    const renderComposite = useCallback(async () => {
      const img = imageRef.current;
      const canvas = canvasRef.current;
      const overlay = overlayRef.current;
      
      if (!img || !canvas || !overlay) {
        console.warn('[ScreenshotCanvas] Missing refs:', { img: !!img, canvas: !!canvas, overlay: !!overlay });
        return;
      }

      console.log('[ScreenshotCanvas] Starting render with DIRECT CANVAS COPY method...');

      // Match canvas size to image natural size
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      if (!ctx) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Step 1: Draw background image (customer's photo)
      console.log('[ScreenshotCanvas] Drawing background image...');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Step 2: Find all CanvasCurtainLayer canvases inside overlay
      // These are the actual rendered curtain textures
      const curtainCanvases = Array.from(overlay.querySelectorAll('canvas')).filter((c: HTMLCanvasElement) => {
        // Exclude our hidden screenshot canvas (at -9999px)
        const rect = c.getBoundingClientRect();
        return rect.left > -9000 && rect.top > -9000 && c.width > 0 && c.height > 0;
      });

      console.log('[ScreenshotCanvas] Found', curtainCanvases.length, 'curtain canvases');

      if (curtainCanvases.length === 0) {
        console.warn('[ScreenshotCanvas] No curtain canvases found - returning background only');
        return;
      }

      // Step 3: Create temp canvas for curtain composite
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      if (!tempCtx) {
        console.error('[ScreenshotCanvas] Failed to create temp context');
        return;
      }

      // Step 4: Draw each curtain canvas to temp canvas with correct positioning
      const imgRect = img.getBoundingClientRect();
      const scaleX = canvas.width / imgRect.width;
      const scaleY = canvas.height / imgRect.height;

      console.log('[ScreenshotCanvas] Scale factors:', { scaleX, scaleY, imgRect });

      curtainCanvases.forEach((curtainCanvas, idx) => {
        const curtainRect = curtainCanvas.getBoundingClientRect();
        
        // Position relative to background image
        const relX = (curtainRect.left - imgRect.left) * scaleX;
        const relY = (curtainRect.top - imgRect.top) * scaleY;
        const relW = curtainRect.width * scaleX;
        const relH = curtainRect.height * scaleY;

        console.log(`[ScreenshotCanvas] Canvas ${idx}:`, {
          curtainSize: { w: curtainCanvas.width, h: curtainCanvas.height },
          screenRect: curtainRect,
          destPos: { x: relX, y: relY, w: relW, h: relH }
        });

        // Draw curtain canvas pixels directly
        tempCtx.drawImage(curtainCanvas, relX, relY, relW, relH);
      });

      console.log('[ScreenshotCanvas] All curtain canvases drawn to temp canvas');

      // Step 5: Apply wall mask if available
      if (wallMaskUrl) {
        console.log('[ScreenshotCanvas] Loading mask:', wallMaskUrl);
        
        try {
          const maskImg = new Image();
          maskImg.crossOrigin = 'anonymous';
          
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Mask load timeout')), 10000);
            maskImg.onload = () => {
              clearTimeout(timeout);
              console.log('[ScreenshotCanvas] Mask loaded:', maskImg.width, 'x', maskImg.height);
              resolve();
            };
            maskImg.onerror = (err) => {
              clearTimeout(timeout);
              reject(err);
            };
            maskImg.src = wallMaskUrl;
          });

          // Draw mask to get pixel data
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = canvas.width;
          maskCanvas.height = canvas.height;
          const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
          
          if (maskCtx) {
            maskCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
            const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
            const curtainData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);

            // Sample center pixel to check mask orientation
            const centerIdx = (Math.floor(canvas.height / 2) * canvas.width + Math.floor(canvas.width / 2)) * 4;
            console.log('[ScreenshotCanvas] Mask center pixel:', {
              r: maskData.data[centerIdx],
              g: maskData.data[centerIdx + 1],
              b: maskData.data[centerIdx + 2],
              a: maskData.data[centerIdx + 3]
            });

            // Apply mask: multiply curtain alpha by mask alpha
            // Mask format: alpha channel where 255 = visible, 0 = transparent
            for (let i = 0; i < curtainData.data.length; i += 4) {
              const maskAlpha = maskData.data[i + 3]; // Use alpha channel
              curtainData.data[i + 3] = Math.round((curtainData.data[i + 3] * maskAlpha) / 255);
            }

            tempCtx.putImageData(curtainData, 0, 0);
            console.log('[ScreenshotCanvas] Mask applied successfully');
          }
        } catch (error) {
          console.error('[ScreenshotCanvas] Failed to apply mask:', error);
          // Continue without mask
        }
      } else {
        console.log('[ScreenshotCanvas] No mask URL - skipping mask application');
      }

      // Step 6: Composite masked curtains over background
      console.log('[ScreenshotCanvas] Compositing final image...');
      ctx.drawImage(tempCanvas, 0, 0);

      console.log('[ScreenshotCanvas] Screenshot complete!');

      // Find the curtain overlay div (first child of overlay that has mask-image)
      // The structure is: overlay > div (with mask-image) > actual curtain content
      const curtainOverlayDiv = overlay.querySelector('[style*="mask"]') as HTMLElement;
      
      console.log('[ScreenshotCanvas] Curtain overlay div:', curtainOverlayDiv);
      
      if (curtainOverlayDiv) {
        // Create a temporary canvas for the curtain overlay
        const curtainComposite = document.createElement('canvas');
        curtainComposite.width = canvas.width;
        curtainComposite.height = canvas.height;
        const curtainCtx = curtainComposite.getContext('2d');
        
        if (curtainCtx) {
          // Find all canvas elements that are NOT hidden (our ScreenshotCanvas is hidden at -9999px)
          const visibleCanvases = Array.from(curtainOverlayDiv.querySelectorAll('canvas')).filter((c: HTMLCanvasElement) => {
            const rect = c.getBoundingClientRect();
            return rect.left > -9000 && rect.top > -9000; // Not our hidden canvas
          });
          
          console.log('[ScreenshotCanvas] Found', visibleCanvases.length, 'visible curtain canvases');
          
          let drawnCount = 0;
          
          // Draw all visible curtain canvases to the composite
          visibleCanvases.forEach((curtainCanvas, idx) => {
            console.log(`[ScreenshotCanvas] Canvas ${idx}:`, {
              width: curtainCanvas.width,
              height: curtainCanvas.height,
              rect: curtainCanvas.getBoundingClientRect(),
            });
            
            if (curtainCanvas.width > 0 && curtainCanvas.height > 0) {
              // Get canvas position relative to image
              const curtainRect = curtainCanvas.getBoundingClientRect();
              const imgRect = img.getBoundingClientRect();
              
              const relX = (curtainRect.left - imgRect.left) / imgRect.width;
              const relY = (curtainRect.top - imgRect.top) / imgRect.height;
              const relW = curtainRect.width / imgRect.width;
              const relH = curtainRect.height / imgRect.height;

              console.log(`[ScreenshotCanvas] Drawing canvas ${idx} at:`, {
                relX, relY, relW, relH,
                destX: relX * curtainComposite.width,
                destY: relY * curtainComposite.height,
                destW: relW * curtainComposite.width,
                destH: relH * curtainComposite.height,
              });

              // Draw curtain canvas at correct position
              curtainCtx.drawImage(
                curtainCanvas,
                relX * curtainComposite.width,
                relY * curtainComposite.height,
                relW * curtainComposite.width,
                relH * curtainComposite.height
              );
              drawnCount++;
            }
          });

          console.log('[ScreenshotCanvas] Drew', drawnCount, 'curtain canvases');

          // Apply mask to curtain overlay if available
          if (wallMaskUrl) {
            try {
              const maskImg = new Image();
              maskImg.crossOrigin = 'anonymous';

              await new Promise<void>((resolve, reject) => {
                maskImg.onload = () => {
                  console.log('[ScreenshotCanvas] Mask loaded:', maskImg.width, 'x', maskImg.height);
                  resolve();
                };
                maskImg.onerror = () => reject(new Error('Mask load failed'));
                maskImg.src = wallMaskUrl;
              });

              // Create temp canvas for mask
              const maskCanvas = document.createElement('canvas');
              maskCanvas.width = curtainComposite.width;
              maskCanvas.height = curtainComposite.height;
              const maskCtx = maskCanvas.getContext('2d');

              if (maskCtx) {
                // Draw mask
                maskCtx.drawImage(maskImg, 0, 0, maskCanvas.width, maskCanvas.height);
                const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);

                // Get curtain data before masking
                const curtainDataBefore = curtainCtx.getImageData(0, 0, curtainComposite.width, curtainComposite.height);
                
                // Sample some pixels to check mask values
                const centerIdx = (Math.floor(maskCanvas.height / 2) * maskCanvas.width + Math.floor(maskCanvas.width / 2)) * 4;
                console.log('[ScreenshotCanvas] Mask center pixel alpha:', maskData.data[centerIdx + 3]);
                console.log('[ScreenshotCanvas] Curtain center pixel before mask:', {
                  r: curtainDataBefore.data[centerIdx],
                  g: curtainDataBefore.data[centerIdx + 1],
                  b: curtainDataBefore.data[centerIdx + 2],
                  a: curtainDataBefore.data[centerIdx + 3],
                });

                // Apply mask to curtain overlay
                // Note: wallMaskUrl is inverted (wall=opaque, background=transparent)
                // We want curtains to show where mask is opaque
                for (let i = 0; i < curtainDataBefore.data.length; i += 4) {
                  const maskAlpha = maskData.data[i + 3]; // Use mask's alpha channel
                  curtainDataBefore.data[i + 3] = (curtainDataBefore.data[i + 3] * maskAlpha) / 255;
                }

                curtainCtx.putImageData(curtainDataBefore, 0, 0);
                
                console.log('[ScreenshotCanvas] Mask applied to curtain overlay');
              }
            } catch (error) {
              console.error('[ScreenshotCanvas] Failed to apply mask:', error);
            }
          } else {
            console.log('[ScreenshotCanvas] No mask URL provided');
          }

          // Draw the masked curtain composite over the base image
          ctx.drawImage(curtainComposite, 0, 0);
          console.log('[ScreenshotCanvas] Curtain composite drawn over base image');
        }
      } else {
        console.warn('[ScreenshotCanvas] No curtain overlay div found');
      }

      console.log('[ScreenshotCanvas] Composite rendered');
    }, [imageRef, overlayRef, wallMaskUrl]);

    // Expose screenshot method to parent
    useImperativeHandle(ref, () => ({
      getScreenshot: async () => {
        console.log('[ScreenshotCanvas] getScreenshot called');
        if (!canvasRef.current) {
          throw new Error('Canvas not initialized');
        }
        // Always render fresh when screenshot is requested
        await renderComposite();
        return canvasRef.current.toDataURL('image/png');
      },
    }), [renderComposite]);

    // Render composite when dependencies change (for live preview)
    useEffect(() => {
      if (phase !== 'ready' || !imageRef.current || !canvasRef.current) {
        return;
      }

      const renderKey = `${imageRef.current.src}-${wallMaskUrl}-${Date.now()}`;
      if (renderKey === lastRenderKey.current) {
        return;
      }

      renderComposite().then(() => {
        lastRenderKey.current = renderKey;
      }).catch((error) => {
        console.error('[ScreenshotCanvas] Render failed:', error);
      });
    }, [phase, wallMaskUrl, renderComposite]);

    return (
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />
    );
  }
);

ScreenshotCanvas.displayName = 'ScreenshotCanvas';
