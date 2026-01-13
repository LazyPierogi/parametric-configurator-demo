import { useEffect, type MutableRefObject } from 'react';
import { toast } from 'react-hot-toast';
import { updateSegmentMetadata } from '@/lib/segment-cache';
import { recordMeasurementObservation } from '@/lib/measurement-observer';
import type { FlowMeasurement } from '@/lib/flow-state';
import type { TranslateFn } from '../types';
import { ensureMeasurementPhotoDataUri, type MeasurementPhotoCache } from '../lib/measurementPhotoDataUri';
import {
  formatCurtainMeasurementError,
  requestCurtainMeasurement,
  type MeasureOut,
} from '../lib/curtainMeasurementRequest';

type MeasureState = { status: 'idle' | 'pending' | 'success' | 'error'; polygonKey: string | null };

type Args = {
  enabled: boolean;
  USE_CURTAIN_FIRST_FLOW: boolean;
  CONFIGURE_FLOW_MODE: 'legacy' | 'new';

  phase: 'idle' | 'segmenting' | 'mark' | 'ready' | 'restoring';
  dragIx: number | null;
  corners: Array<{ x: number; y: number }> | null;
  file: File | null;
  previewUrl: string | null;
  fileSignature: string | null;

  flowMeasurementMeta: FlowMeasurement | null;

  curtainMeasureStateRef: MutableRefObject<MeasureState>;
  measurementToastRef: MutableRefObject<string | null>;
  measurementPhotoCacheRef: MutableRefObject<MeasurementPhotoCache>;

  setBaseCm: (next: { w: number; h: number }) => void;
  setElapsed: (next: number | null) => void;
  setFlowMeasurementMeta: (next: FlowMeasurement | null) => void;
  setCurtainMeasureState: (next: MeasureState) => void;
  setCurtainMeasureError: (next: string | null) => void;

  t: TranslateFn;
};

type CoreArgs = Omit<Args, 'enabled' | 'phase' | 'dragIx'>;

export function runCurtainMeasurementOnConfigure({
  USE_CURTAIN_FIRST_FLOW,
  CONFIGURE_FLOW_MODE,
  corners,
  file,
  previewUrl,
  fileSignature,
  flowMeasurementMeta,
  curtainMeasureStateRef,
  measurementToastRef,
  measurementPhotoCacheRef,
  setBaseCm,
  setElapsed,
  setFlowMeasurementMeta,
  setCurtainMeasureState,
  setCurtainMeasureError,
  t,
}: CoreArgs): (() => void) | void {
  if (!USE_CURTAIN_FIRST_FLOW) return;
  if (!corners || corners.length < 3) return;
  if (!file && !previewUrl) return;

  const stateSnapshot = curtainMeasureStateRef.current;

  const polygon = corners.map((pt) => ({
    x: Number(pt.x.toFixed(6)),
    y: Number(pt.y.toFixed(6)),
  }));
  const polygonKey = JSON.stringify(polygon);

  if (stateSnapshot.status === 'pending') {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Configure] Curtain measurement skipped (pending)');
    }
    return;
  }
  if (stateSnapshot.status === 'success' && stateSnapshot.polygonKey === polygonKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Configure] Curtain measurement skipped (already success for polygon)');
    }
    return;
  }
  if (stateSnapshot.status === 'error' && stateSnapshot.polygonKey === polygonKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Configure] Curtain measurement skipped (error already shown for polygon)');
    }
    return;
  }

  let cancelled = false;

  const runMeasurement = async () => {
    const providerForRequest = flowMeasurementMeta?.provider;
    const modelForRequest = flowMeasurementMeta?.model;
    let started = 0;
    try {
      setCurtainMeasureState({ status: 'pending', polygonKey });
      setCurtainMeasureError(null);
      if (!measurementToastRef.current) {
        measurementToastRef.current = toast.loading(t('estimate.loadingMagic'));
      }

      const photoDataUri = await ensureMeasurementPhotoDataUri({
        file,
        previewUrl,
        fileSignature,
        cacheRef: measurementPhotoCacheRef,
      });
      if (cancelled) return;

      const payload: Record<string, unknown> = {
        photoDataUri,
        curtainPolygon: polygon,
      };
      if (providerForRequest) payload.provider = providerForRequest;
      if (modelForRequest) payload.model = modelForRequest;

      if (process.env.NODE_ENV !== 'production') {
        console.info('[Configure] Curtain measurement start', { payload, polygon });
      }

      started = performance.now();
      const result = await requestCurtainMeasurement(payload, { timeoutMs: 20000 });
      const json: MeasureOut = result.json;
      const elapsedMs = result.elapsedMs;
      if (cancelled) return;

      setBaseCm({ w: json.wallWidthCm, h: json.wallHeightCm });
      setElapsed(elapsedMs);
      const providerUsed = providerForRequest ?? flowMeasurementMeta?.provider ?? 'googleai';
      const modelUsed = modelForRequest ?? flowMeasurementMeta?.model ?? 'googleai/gemini-2.0-flash-lite';
      setFlowMeasurementMeta({
        wallWidthCm: json.wallWidthCm,
        wallHeightCm: json.wallHeightCm,
        provider: providerUsed,
        model: modelUsed,
        elapsedMs,
        confidencePct: json.confidencePct ?? null,
        warnings: json.warnings ?? null,
        usedFallback: json.usedFallback,
        fallbackProvider: json.fallbackProvider ?? null,
      });
      recordMeasurementObservation({
        status: 'success',
        flowMode: CONFIGURE_FLOW_MODE,
        provider: providerUsed,
        model: modelUsed,
        elapsedMs,
        wallWidthCm: json.wallWidthCm,
        wallHeightCm: json.wallHeightCm,
        confidencePct: json.confidencePct,
        warnings: json.warnings ?? null,
        photoKey: fileSignature ?? null,
        segmentKey: fileSignature ?? null,
        polygon,
        polygonKey,
        source: 'configure',
        ...(json.usedFallback != null
          ? { usedFallback: json.usedFallback, fallbackProvider: json.fallbackProvider ?? undefined }
          : {}),
      } as any);
      if (fileSignature) {
        void updateSegmentMetadata(fileSignature, {
          flowMode: CONFIGURE_FLOW_MODE,
          curtainPolygon: polygon,
          measurement: {
            wallWidthCm: json.wallWidthCm,
            wallHeightCm: json.wallHeightCm,
            provider: providerUsed,
            model: modelUsed,
            elapsedMs,
            confidencePct: json.confidencePct ?? null,
            warnings: json.warnings ?? null,
            usedFallback: json.usedFallback,
            fallbackProvider: json.fallbackProvider ?? null,
          },
          schemaVersion: 2,
          debugSummary: `measure:${providerUsed}/${modelUsed}|poly=${polygon.length}`,
        });
      }
      setCurtainMeasureState({ status: 'success', polygonKey });
      setCurtainMeasureError(null);
      if (measurementToastRef.current) {
        toast.dismiss(measurementToastRef.current);
        measurementToastRef.current = null;
      }
      if (process.env.NODE_ENV !== 'production') {
        console.info('[Configure] Curtain measurement success', {
          wallWidthCm: json.wallWidthCm,
          wallHeightCm: json.wallHeightCm,
          elapsedMs,
          provider: providerUsed,
          model: modelUsed,
        });
      }
      toast.success(t('estimate.toastEstimated', { time: elapsedMs.toString() }));
    } catch (error) {
      if (cancelled) return;
      const message = formatCurtainMeasurementError(error);
      const elapsedMs = started > 0 ? Math.round(performance.now() - started) : undefined;
      const providerUsed = providerForRequest ?? flowMeasurementMeta?.provider ?? 'googleai';
      const modelUsed = modelForRequest ?? flowMeasurementMeta?.model ?? 'googleai/gemini-2.0-flash-lite';
      recordMeasurementObservation({
        status: 'error',
        flowMode: CONFIGURE_FLOW_MODE,
        provider: providerUsed,
        model: modelUsed,
        elapsedMs,
        error: message,
        photoKey: fileSignature ?? null,
        segmentKey: fileSignature ?? null,
        polygon,
        polygonKey,
        source: 'configure',
      });
      setCurtainMeasureError(message);
      setCurtainMeasureState({ status: 'error', polygonKey });
      if (measurementToastRef.current) {
        toast.dismiss(measurementToastRef.current);
        measurementToastRef.current = null;
      }
      console.error('[Configure] Curtain measurement failed', message, error);
      toast.error(message);
    }
  };

  runMeasurement();

  return () => {
    cancelled = true;
  };
}

export function useCurtainMeasurementOnConfigure({
  enabled,
  USE_CURTAIN_FIRST_FLOW,
  CONFIGURE_FLOW_MODE,
  phase,
  dragIx,
  corners,
  file,
  previewUrl,
  fileSignature,
  flowMeasurementMeta,
  curtainMeasureStateRef,
  measurementToastRef,
  measurementPhotoCacheRef,
  setBaseCm,
  setElapsed,
  setFlowMeasurementMeta,
  setCurtainMeasureState,
  setCurtainMeasureError,
  t,
}: Args) {
  useEffect(() => {
    if (!USE_CURTAIN_FIRST_FLOW) return;
    if (!enabled) return;
    const stateSnapshot = curtainMeasureStateRef.current;
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Configure] Curtain measurement check', {
        phase,
        dragIx,
        hasCorners: !!corners && corners.length,
        hasFile: !!file,
        hasPreview: !!previewUrl,
        status: stateSnapshot.status,
        polygonKey: stateSnapshot.polygonKey,
      });
    }

    if (phase !== 'ready') return;
    if (dragIx != null) return;

    if (
      flowMeasurementMeta &&
      Number.isFinite(flowMeasurementMeta.wallWidthCm) &&
      flowMeasurementMeta.wallWidthCm > 0 &&
      Number.isFinite(flowMeasurementMeta.wallHeightCm) &&
      flowMeasurementMeta.wallHeightCm > 0
    ) {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[Configure] Curtain measurement skipped (using flow.measurement from /estimate)', {
          wallWidthCm: flowMeasurementMeta.wallWidthCm,
          wallHeightCm: flowMeasurementMeta.wallHeightCm,
          provider: flowMeasurementMeta.provider,
        });
      }
      return;
    }

    return runCurtainMeasurementOnConfigure({
      USE_CURTAIN_FIRST_FLOW,
      CONFIGURE_FLOW_MODE,
      corners,
      file,
      previewUrl,
      fileSignature,
      flowMeasurementMeta,
      curtainMeasureStateRef,
      measurementToastRef,
      measurementPhotoCacheRef,
      setBaseCm,
      setElapsed,
      setFlowMeasurementMeta,
      setCurtainMeasureState,
      setCurtainMeasureError,
      t,
    });
  }, [
    USE_CURTAIN_FIRST_FLOW,
    enabled,
    CONFIGURE_FLOW_MODE,
    phase,
    dragIx,
    corners,
    file,
    previewUrl,
    fileSignature,
    flowMeasurementMeta,
    curtainMeasureStateRef,
    measurementToastRef,
    measurementPhotoCacheRef,
    setBaseCm,
    setElapsed,
    setFlowMeasurementMeta,
    setCurtainMeasureState,
    setCurtainMeasureError,
    t,
  ]);
}
