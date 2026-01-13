import type { FlowMeasurement } from '@/lib/flow-state';

type BoxRatio = { w: number; h: number };

type BaseCm = { w: number; h: number };

type Args = {
  flowMeasurementMeta: FlowMeasurement;
  baseCm: BaseCm;
  baseBoxRatio: BoxRatio | null;
  boxRatio: BoxRatio;
};

export function computeCurtainFirstDims({ flowMeasurementMeta, baseCm, baseBoxRatio, boxRatio }: Args) {
  const baseW = Number.isFinite(flowMeasurementMeta.wallWidthCm) ? flowMeasurementMeta.wallWidthCm : baseCm.w;
  const baseH = Number.isFinite(flowMeasurementMeta.wallHeightCm) ? flowMeasurementMeta.wallHeightCm : baseCm.h;

  if (
    baseBoxRatio &&
    baseBoxRatio.w > 0 &&
    baseBoxRatio.h > 0 &&
    boxRatio.w > 0 &&
    boxRatio.h > 0
  ) {
    const scaleW = boxRatio.w / baseBoxRatio.w;
    const scaleH = boxRatio.h / baseBoxRatio.h;

    return {
      wCm: +(baseW * scaleW).toFixed(1),
      hCm: +(baseH * scaleH).toFixed(1),
    };
  }

  return {
    wCm: +baseW.toFixed(1),
    hCm: +baseH.toFixed(1),
  };
}
