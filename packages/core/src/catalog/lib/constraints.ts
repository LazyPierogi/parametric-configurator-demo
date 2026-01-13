import type { Fabric } from '../types';

export type FabricConstraints = {
  maxCurtainHeightCm: number | null;
  maxPanelWidthCm: number | null;
};

/**
 * Computes fabric constraints for curtain dimensions.
 * 
 * As of the new production model:
 * - Any fabric can be sewn/stitched together multiple times (no width limits)
 * - Fabrics are always cut vertically within their height (no height limits)
 * - isRailroadable and isDoubleWidth are deprecated
 * 
 * This function now returns no constraints, but is kept for backward compatibility
 * and future constraint logic (e.g., minimum dimensions, special fabric rules).
 */
export function computeFabricConstraints(fabric: Fabric): FabricConstraints {
  // No constraints: fabrics can be stitched to any width and cut to any height
  return {
    maxCurtainHeightCm: null,
    maxPanelWidthCm: null,
  };
}
