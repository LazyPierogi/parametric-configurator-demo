/**
 * Mask Heuristics for Curtain Wizard
 * 
 * Analyzes post-processed segmentation masks to derive wall boundaries.
 * Used in conjunction with Qwen wall measurement to compute accurate polygon dimensions.
 * 
 * Key assumption: In the PNG mask, the opposite wall is represented by
 * TRANSPARENCY (alpha = 0). Non-wall areas (ceiling, floor, side walls) are opaque.
 */

export type WallBoundsFromMask = {
  /** Top edge of wall in normalized coordinates (0-1) */
  top: number;
  /** Bottom edge of wall in normalized coordinates (0-1) */
  bottom: number;
  /** Left edge of wall in normalized coordinates (0-1) */
  left: number;
  /** Right edge of wall in normalized coordinates (0-1) */
  right: number;
  /** Height fraction of wall (bottom - top) */
  heightFrac: number;
  /** Width fraction of wall (right - left) */
  widthFrac: number;
  /** Confidence in the bounds (0-1) based on mask quality */
  confidence: number;
  /** Debug info about how bounds were computed */
  debug?: {
    sampledColumns: number;
    validColumns: number;
    topValues: number[];
    bottomValues: number[];
  };
};

export type PolygonWithinWallBounds = {
  /** Polygon width as fraction of the wall width */
  widthFrac: number;
  /** Polygon height as fraction of the wall height */
  heightFrac: number;
  /** Final curtain width in cm */
  curtainWidthCm: number;
  /** Final curtain height in cm */
  curtainHeightCm: number;
  /** Whether heuristics were applied successfully */
  heuristicsApplied: boolean;
  /** Warning messages if any */
  warnings: string[];
};

/**
 * Analyzes a post-processed PNG mask to find wall boundaries.
 * 
 * The mask uses alpha=0 for the opposite wall (transparent area).
 * We sample the CENTRAL region (30-70% width) to avoid side wall bleed,
 * and use MEDIAN of multiple columns to avoid noise from ceiling/floor bleed.
 * 
 * @param maskPngBlob - The post-processed mask PNG as a Blob
 * @returns Wall bounds in normalized coordinates, or null if analysis fails
 */
export async function analyzeWallMaskPng(
  maskPngBlob: Blob
): Promise<WallBoundsFromMask | null> {
  try {
    // Create an OffscreenCanvas or fallback to regular canvas
    const bitmap = await createImageBitmap(maskPngBlob);
    const width = bitmap.width;
    const height = bitmap.height;
    
    if (width < 10 || height < 10) {
      console.warn('[mask-heuristics] Mask too small:', width, height);
      return null;
    }
    
    // Use OffscreenCanvas if available (works in Web Workers too)
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      ctx = canvas.getContext('2d')!;
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext('2d')!;
    }
    
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data; // RGBA array
    
    // Sample wider region (10-90% of width) to better detect full wall
    // We use median later to filter out side wall bleed
    const leftBound = Math.floor(width * 0.1);
    const rightBound = Math.floor(width * 0.9);
    const numSampleColumns = Math.min(40, rightBound - leftBound);
    const step = Math.max(1, Math.floor((rightBound - leftBound) / numSampleColumns));
    
    console.log('[mask-heuristics] Sampling mask:', { width, height, leftBound, rightBound, numSampleColumns, step });
    
    const topValues: number[] = [];
    const bottomValues: number[] = [];
    
    // For each sampled column, find where wall (alpha=0) starts and ends
    for (let x = leftBound; x < rightBound; x += step) {
      let wallTop: number | null = null;
      let wallBottom: number | null = null;
      
      // Scan from top to find first transparent pixel (wall start)
      for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        if (alpha < 128) { // Transparent = wall
          wallTop = y;
          break;
        }
      }
      
      // Scan from bottom to find first transparent pixel (wall end)
      for (let y = height - 1; y >= 0; y--) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        if (alpha < 128) { // Transparent = wall
          wallBottom = y;
          break;
        }
      }
      
      if (wallTop !== null && wallBottom !== null && wallBottom > wallTop) {
        topValues.push(wallTop / height);
        bottomValues.push(wallBottom / height);
      }
    }
    
    if (topValues.length < 3) {
      console.warn('[mask-heuristics] Not enough valid columns:', topValues.length);
      return null;
    }
    
    // Sort values for analysis
    const sortedTop = [...topValues].sort((a, b) => a - b);
    const sortedBottom = [...bottomValues].sort((a, b) => a - b);
    
    // STRATEGY: Use percentile-based extremes to find the FULL wall extent
    // The issue: some columns have furniture cutting into the wall (giving shorter heights)
    // Solution: Use 10th percentile for top (highest point) and 90th for bottom (lowest point)
    // This finds the full wall extent while ignoring outlier columns with bleed
    const p10Idx = Math.floor(sortedTop.length * 0.1);
    const p90Idx = Math.min(sortedTop.length - 1, Math.floor(sortedTop.length * 0.9));
    
    // Top: use 10th percentile (smallest value = highest point in image)
    // Bottom: use 90th percentile (largest value = lowest point in image)  
    const top = sortedTop[p10Idx];
    const bottom = sortedBottom[p90Idx];
    
    // Also calculate median for comparison
    const medianIdx = Math.floor(sortedTop.length / 2);
    const medianTop = sortedTop[medianIdx];
    const medianBottom = sortedBottom[medianIdx];
    
    // Log all detected values for debugging
    console.log('[mask-heuristics] Wall detection:', {
      validColumns: topValues.length,
      topRange: { min: sortedTop[0], p10: top, median: medianTop, max: sortedTop[sortedTop.length - 1] },
      bottomRange: { min: sortedBottom[0], median: medianBottom, p90: bottom, max: sortedBottom[sortedBottom.length - 1] },
      wallHeight: { usingP10P90: bottom - top, usingMedian: medianBottom - medianTop }
    });
    
    // For horizontal bounds, scan rows in the middle vertical section
    const middleY = Math.floor(height * 0.5);
    const scanRows = [
      Math.floor(height * 0.4),
      Math.floor(height * 0.5),
      Math.floor(height * 0.6),
    ];
    
    const leftValues: number[] = [];
    const rightValues: number[] = [];
    
    for (const y of scanRows) {
      let wallLeft: number | null = null;
      let wallRight: number | null = null;
      
      // Scan from left
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        if (alpha < 128) {
          wallLeft = x;
          break;
        }
      }
      
      // Scan from right
      for (let x = width - 1; x >= 0; x--) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        if (alpha < 128) {
          wallRight = x;
          break;
        }
      }
      
      if (wallLeft !== null && wallRight !== null && wallRight > wallLeft) {
        leftValues.push(wallLeft / width);
        rightValues.push(wallRight / width);
      }
    }
    
    // Default to full width if horizontal detection fails (less critical)
    let left = 0;
    let right = 1;
    if (leftValues.length >= 2) {
      const sortedLeft = [...leftValues].sort((a, b) => a - b);
      const sortedRight = [...rightValues].sort((a, b) => a - b);
      const midIdx = Math.floor(sortedLeft.length / 2);
      left = sortedLeft[midIdx];
      right = sortedRight[midIdx];
    }
    
    const heightFrac = Math.max(0, Math.min(1, bottom - top));
    const widthFrac = Math.max(0, Math.min(1, right - left));
    
    // Sanity checks
    if (heightFrac < 0.1 || heightFrac > 0.98) {
      console.warn('[mask-heuristics] Height fraction out of range:', heightFrac);
      return null;
    }
    
    // Confidence based on how many columns we successfully sampled
    const confidence = Math.min(1, topValues.length / numSampleColumns);
    
    return {
      top,
      bottom,
      left,
      right,
      heightFrac,
      widthFrac,
      confidence,
      debug: {
        sampledColumns: numSampleColumns,
        validColumns: topValues.length,
        topValues: sortedTop.slice(0, 5),
        bottomValues: sortedBottom.slice(0, 5),
      },
    };
  } catch (err) {
    console.error('[mask-heuristics] Failed to analyze mask:', err);
    return null;
  }
}

/**
 * Computes polygon dimensions within wall bounds.
 * 
 * Given:
 * - User-drawn polygon (normalized 0-1 coordinates in image space)
 * - Wall bounds from mask analysis
 * - Qwen measurement of the full wall (cm)
 * 
 * Returns the polygon dimensions in centimeters.
 * 
 * @param polygon - User-drawn polygon corners [{x, y}, ...]
 * @param wallBounds - Wall bounds from analyzeWallMaskPng
 * @param wallMeasurement - Qwen's measurement {wallWidthCm, wallHeightCm}
 */
export function computePolygonDimensionsWithHeuristics(
  polygon: Array<{ x: number; y: number }>,
  wallBounds: WallBoundsFromMask | null,
  wallMeasurement: { wallWidthCm: number; wallHeightCm: number }
): PolygonWithinWallBounds {
  const warnings: string[] = [];
  
  if (!polygon || polygon.length < 3) {
    return {
      widthFrac: 1,
      heightFrac: 1,
      curtainWidthCm: wallMeasurement.wallWidthCm,
      curtainHeightCm: wallMeasurement.wallHeightCm,
      heuristicsApplied: false,
      warnings: ['No valid polygon provided'],
    };
  }
  
  // Compute polygon bounding box
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  const polyLeft = Math.min(...xs);
  const polyRight = Math.max(...xs);
  const polyTop = Math.min(...ys);
  const polyBottom = Math.max(...ys);
  const polyWidth = polyRight - polyLeft;
  const polyHeight = polyBottom - polyTop;
  
  // If no wall bounds from mask, fall back to simple bbox scaling
  if (!wallBounds) {
    warnings.push('mask:heuristics_unavailable');
    return {
      widthFrac: polyWidth,
      heightFrac: polyHeight,
      curtainWidthCm: Math.round(wallMeasurement.wallWidthCm * polyWidth * 10) / 10,
      curtainHeightCm: Math.round(wallMeasurement.wallHeightCm * polyHeight * 10) / 10,
      heuristicsApplied: false,
      warnings,
    };
  }
  
  // Log detailed values for debugging
  console.log('[mask-heuristics] Computing polygon dimensions:', {
    polygon: { left: polyLeft, right: polyRight, top: polyTop, bottom: polyBottom, width: polyWidth, height: polyHeight },
    wall: { 
      left: wallBounds.left, right: wallBounds.right, 
      top: wallBounds.top, bottom: wallBounds.bottom,
      confidence: wallBounds.confidence
    },
    qwen: wallMeasurement
  });
  
  // Low confidence warning
  if (wallBounds.confidence < 0.5) {
    warnings.push(`mask:low_confidence (${(wallBounds.confidence * 100).toFixed(0)}%)`);
  }
  
  // Compute polygon position WITHIN the wall bounds
  // Clamp polygon to wall bounds (in case polygon extends beyond detected wall)
  const clampedPolyTop = Math.max(polyTop, wallBounds.top);
  const clampedPolyBottom = Math.min(polyBottom, wallBounds.bottom);
  const clampedPolyLeft = Math.max(polyLeft, wallBounds.left);
  const clampedPolyRight = Math.min(polyRight, wallBounds.right);
  
  // Wall dimensions in normalized image coordinates
  const wallHeightNorm = wallBounds.bottom - wallBounds.top;
  const wallWidthNorm = wallBounds.right - wallBounds.left;
  
  let heightFrac: number;
  let widthFrac: number;
  
  // Calculate polygon as fraction of WALL (not image!)
  // This is critical: image contains ceiling/floor which distort proportions
  if (wallHeightNorm > 0.05) {
    const polyHeightInWall = clampedPolyBottom - clampedPolyTop;
    heightFrac = Math.max(0, Math.min(1, polyHeightInWall / wallHeightNorm));
    console.log('[mask-heuristics] Height: wall-relative', { polyHeightInWall, wallHeightNorm, heightFrac });
  } else {
    // Wall bounds too narrow - mask detection likely failed
    heightFrac = polyHeight;
    warnings.push('mask:wall_height_too_small');
    console.log('[mask-heuristics] Height: FALLBACK (wall too small)', { wallHeightNorm, heightFrac });
  }
  
  if (wallWidthNorm > 0.05) {
    const polyWidthInWall = clampedPolyRight - clampedPolyLeft;
    widthFrac = Math.max(0, Math.min(1, polyWidthInWall / wallWidthNorm));
    console.log('[mask-heuristics] Width: wall-relative', { polyWidthInWall, wallWidthNorm, widthFrac });
  } else {
    // Wall bounds too narrow horizontally - mask detection likely failed
    widthFrac = polyWidth;
    warnings.push('mask:wall_width_too_small');
    console.log('[mask-heuristics] Width: FALLBACK (wall too small)', { wallWidthNorm, widthFrac });
  }
  
  // Compute final dimensions in cm
  const curtainWidthCm = Math.round(wallMeasurement.wallWidthCm * widthFrac * 10) / 10;
  const curtainHeightCm = Math.round(wallMeasurement.wallHeightCm * heightFrac * 10) / 10;
  
  console.log('[mask-heuristics] Final result:', { widthFrac, heightFrac, curtainWidthCm, curtainHeightCm });
  
  return {
    widthFrac,
    heightFrac,
    curtainWidthCm,
    curtainHeightCm,
    heuristicsApplied: true,
    warnings,
  };
}
