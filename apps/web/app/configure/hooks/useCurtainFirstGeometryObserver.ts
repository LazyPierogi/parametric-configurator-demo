import { useEffect, type MutableRefObject } from 'react';
import { recordMeasurementObservation } from '@/lib/measurement-observer';
import type { FlowMeasurement } from '@/lib/flow-state';

type Point = { x: number; y: number };

type BoxRatio = { w: number; h: number };

type BaseCm = { w: number; h: number };

type WallBoxBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
};

type WallVerticalBounds = { top: number; bottom: number };

type Args = {
  DEBUG_UI_ENABLED: boolean;
  USE_CURTAIN_FIRST_FLOW: boolean;
  corners: Point[] | null;
  dims: { wCm: number; hCm: number };
  flowMeasurementMeta: FlowMeasurement | null;
  fileSignature: string | null;
  CONFIGURE_FLOW_MODE: 'legacy' | 'new';
  boxRatio: BoxRatio;
  baseCm: BaseCm;
  wallBoxBounds: WallBoxBounds | null;
  wallVerticalBounds: WallVerticalBounds | null;
  CURTAIN_BOX_HEIGHT_SOURCE: 'auto' | 'mask' | 'full';
  MASK_HEIGHT_RATIO_MIN: number;
  MASK_HEIGHT_RATIO_MAX: number;
  lastCurtainBoxLogRef: MutableRefObject<string | null>;
};

export function useCurtainFirstGeometryObserver({
  DEBUG_UI_ENABLED,
  USE_CURTAIN_FIRST_FLOW,
  corners,
  dims,
  flowMeasurementMeta,
  fileSignature,
  CONFIGURE_FLOW_MODE,
  boxRatio,
  baseCm,
  wallBoxBounds,
  wallVerticalBounds,
  CURTAIN_BOX_HEIGHT_SOURCE,
  MASK_HEIGHT_RATIO_MIN,
  MASK_HEIGHT_RATIO_MAX,
  lastCurtainBoxLogRef,
}: Args) {
  useEffect(() => {
    if (!DEBUG_UI_ENABLED) return;
    if (!USE_CURTAIN_FIRST_FLOW) return;
    if (!corners || corners.length < 3) return;
    if (!flowMeasurementMeta) return;

    let geomWarnings: string[] | undefined;
    let geomSummary: string | null = null;

    try {
      const widthFraction = Math.max(0, Math.min(1, boxRatio.w));
      const fullHeightFraction = Math.max(0, Math.min(1, boxRatio.h));
      let effectiveHeightFraction = fullHeightFraction;
      let usedMask = false;
      let wallTop: number | null = null;
      let wallBottom: number | null = null;
      let polyTopNorm: number | null = null;
      let polyBottomNorm: number | null = null;
      let polyTopWithinWall: number | null = null;
      let polyBottomWithinWall: number | null = null;

      let polyHeightFraction: number | null = null;
      if (corners && corners.length >= 2) {
        const ys = corners.map((pt) => pt.y);
        const polyTop = Math.max(0, Math.min(1, Math.min(...ys)));
        const polyBottom = Math.max(0, Math.min(1, Math.max(...ys)));
        const spanPoly = polyBottom - polyTop;
        if (spanPoly > 0) {
          polyHeightFraction = Math.max(0, Math.min(1, spanPoly));
        }
      }

      const localWarnings: string[] = [];

      if (CURTAIN_BOX_HEIGHT_SOURCE !== 'full' && wallVerticalBounds && wallBoxBounds) {
        wallTop = wallVerticalBounds.top;
        wallBottom = wallVerticalBounds.bottom;
        const span = wallBottom - wallTop;
        if (span > 0.2 && span < 0.95) {
          const denom = Math.max(1e-6, span);
          polyTopNorm = wallBoxBounds.minY;
          polyBottomNorm = wallBoxBounds.maxY;
          polyTopWithinWall = Math.max(0, Math.min(1, (polyTopNorm - wallTop) / denom));
          polyBottomWithinWall = Math.max(0, Math.min(1, (polyBottomNorm - wallTop) / denom));
          const fracWall = Math.max(0, Math.min(1, polyBottomWithinWall - polyTopWithinWall));
          if (fracWall > 0) {
            if (CURTAIN_BOX_HEIGHT_SOURCE === 'mask') {
              effectiveHeightFraction = fracWall;
              usedMask = true;
            } else if (fullHeightFraction > 0) {
              const safeFull = Math.max(fullHeightFraction, 1e-6);
              const ratio = fracWall / safeFull;
              if (ratio >= MASK_HEIGHT_RATIO_MIN && ratio <= MASK_HEIGHT_RATIO_MAX) {
                effectiveHeightFraction = fracWall;
                usedMask = true;
              } else if (polyHeightFraction != null) {
                effectiveHeightFraction = polyHeightFraction;
                localWarnings.push(`mask:height_ratio_out_of_range (${ratio.toFixed(4)})`);
                localWarnings.push('mask:fallback_poly_only');
              } else {
                localWarnings.push(`mask:height_ratio_out_of_range (${ratio.toFixed(4)})`);
              }
            }
          } else if (polyHeightFraction != null) {
            effectiveHeightFraction = polyHeightFraction;
            localWarnings.push(`mask:fracWall<=0 (${fracWall.toFixed(4)})`);
            localWarnings.push('mask:fallback_poly_only');
          } else {
            localWarnings.push(`mask:fracWall<=0 (${fracWall.toFixed(4)})`);
          }
        } else if (polyHeightFraction != null) {
          effectiveHeightFraction = polyHeightFraction;
          localWarnings.push(`mask:span_out_of_range (${span.toFixed(4)})`);
          localWarnings.push('mask:fallback_poly_only');
        } else {
          localWarnings.push(`mask:span_out_of_range (${span.toFixed(4)})`);
        }
      } else if (CURTAIN_BOX_HEIGHT_SOURCE !== 'full' && polyHeightFraction != null) {
        effectiveHeightFraction = polyHeightFraction;
        localWarnings.push('mask:fallback_poly_only');
      } else {
        localWarnings.push('mask:missing_or_rejected');
      }

      geomSummary = [
        `wf=${widthFraction.toFixed(4)}`,
        `hf_full=${fullHeightFraction.toFixed(4)}`,
        `hf_eff=${effectiveHeightFraction.toFixed(4)}`,
        wallTop != null ? `wallTop=${wallTop.toFixed(4)}` : 'wallTop=null',
        wallBottom != null ? `wallBottom=${wallBottom.toFixed(4)}` : 'wallBottom=null',
        polyTopNorm != null ? `polyTop=${polyTopNorm.toFixed(4)}` : 'polyTop=null',
        polyBottomNorm != null ? `polyBottom=${polyBottomNorm.toFixed(4)}` : 'polyBottom=null',
        polyTopWithinWall != null ? `polyTopW=${polyTopWithinWall.toFixed(4)}` : 'polyTopW=null',
        polyBottomWithinWall != null ? `polyBottomW=${polyBottomWithinWall.toFixed(4)}` : 'polyBottomW=null',
        `usedMask=${usedMask ? '1' : '0'}`,
        `wCm=${dims.wCm.toFixed(1)}`,
        `hCm=${dims.hCm.toFixed(1)}`,
        `baseH=${baseCm.h.toFixed(1)}`,
        `heightSource=${CURTAIN_BOX_HEIGHT_SOURCE}`,
      ].join('; ');

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[Configure] curtain-box geometry debug', {
          summary: geomSummary,
          warnings: localWarnings,
        });
      }

      if (localWarnings.length) {
        geomWarnings = localWarnings;
      }
    } catch (err) {
      geomWarnings = [...(geomWarnings ?? []), 'mask:debug_exception'];
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[Configure] curtain-box geometry debug failed', err);
      }
    }

    const polygon = corners.map((pt) => ({
      x: Number(pt.x.toFixed(6)),
      y: Number(pt.y.toFixed(6)),
    }));
    const polygonKey = JSON.stringify(polygon);
    const logKey = `${polygonKey}|${dims.wCm}|${dims.hCm}|${flowMeasurementMeta.wallWidthCm}|${flowMeasurementMeta.wallHeightCm}`;
    if (lastCurtainBoxLogRef.current === logKey) return;

    lastCurtainBoxLogRef.current = logKey;

    const providerUsed = flowMeasurementMeta.provider ?? 'qwen';
    const modelUsed = flowMeasurementMeta.model ?? undefined;

    const obsWarnings =
      geomWarnings && geomWarnings.length
        ? [...geomWarnings, ...(geomSummary ? [`geom:${geomSummary}`] : [])]
        : geomSummary
        ? [`geom:${geomSummary}`]
        : undefined;

    recordMeasurementObservation({
      status: 'success',
      flowMode: CONFIGURE_FLOW_MODE,
      provider: providerUsed,
      model: modelUsed,
      wallWidthCm: dims.wCm,
      wallHeightCm: dims.hCm,
      photoKey: fileSignature ?? null,
      segmentKey: fileSignature ?? null,
      polygon,
      polygonKey,
      source: 'configure-box',
      usedFallback: true,
      fallbackProvider: 'geometry:bbox',
      ...(obsWarnings ? { warnings: obsWarnings } : {}),
    });
  }, [
    DEBUG_UI_ENABLED,
    USE_CURTAIN_FIRST_FLOW,
    corners,
    dims.wCm,
    dims.hCm,
    flowMeasurementMeta,
    fileSignature,
    CONFIGURE_FLOW_MODE,
    boxRatio.w,
    boxRatio.h,
    baseCm.h,
    wallBoxBounds,
    wallVerticalBounds,
    CURTAIN_BOX_HEIGHT_SOURCE,
    MASK_HEIGHT_RATIO_MIN,
    MASK_HEIGHT_RATIO_MAX,
    lastCurtainBoxLogRef,
  ]);
}
