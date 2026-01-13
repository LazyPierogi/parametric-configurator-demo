"use client";

import { useEffect, useRef, useState } from 'react';
import type { ClipboardEvent, Dispatch, DragEvent, MouseEvent, MutableRefObject, RefObject, SetStateAction } from 'react';
import type { FlowState } from '@/lib/flow-state';
import type { MeasurementCacheEntry, MeasurementProvider } from '@/lib/measurement-cache';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { UploadDropzone } from '@/components/ui/UploadDropzone';
import { FullscreenPhotoViewer } from '@/components/ui/FullscreenPhotoViewer';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import { prefersReducedMotion, motionTokens, getAdjustedDuration } from '@/lib/motion-utils';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

type MeasureOut = {
  wallWidthCm: number;
  wallHeightCm: number;
  confidencePct?: number;
  warnings?: string[];
};
type RequestStatus = 'idle' | 'pending' | 'success' | 'error';
type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

type HeroSurfaceProps = {
  isMobile: boolean;
  dropRef: MutableRefObject<HTMLDivElement | null>;
  heroContainerRef: MutableRefObject<HTMLDivElement | null>;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLDivElement>) => void;
  onClickDrop: (event: MouseEvent<HTMLDivElement>) => void;
  confirmOpen: boolean;
  preview: string | null;
  t: TranslateFn;
  confirmW: string;
  setConfirmW: Dispatch<SetStateAction<string>>;
  confirmH: string;
  setConfirmH: Dispatch<SetStateAction<string>>;
  wInvalid: boolean;
  hInvalid: boolean;
  confirmError: string | null;
  setConfirmError: Dispatch<SetStateAction<string | null>>;
  setConfirmOpen: (open: boolean) => void;
  setFile: Dispatch<SetStateAction<File | null>>;
  setPreview: Dispatch<SetStateAction<string | null>>;
  setResult: Dispatch<SetStateAction<MeasureOut | null>>;
  setMeasureStatus: Dispatch<SetStateAction<RequestStatus>>;
  setSegStatus: Dispatch<SetStateAction<RequestStatus>>;
  currentFileRef: MutableRefObject<File | null>;
  lastSignatureRef: MutableRefObject<string | null>;
  segStatus: RequestStatus;
  segmentKey: string | null;
  photoName: string | null;
  bypassCache: boolean;
  provider: MeasurementProvider;
  model: string;
  elapsed: number | null;
  flowMode: 'legacy' | 'new';
  saveMeasurementToCache: (payload: MeasurementCacheEntry) => void;
  storeFlowState: (payload: FlowState) => void;
  router: AppRouterInstance;
  imgRef: RefObject<HTMLImageElement | null>;
  markPicks: { x: number; y: number }[];
  onOverlayClick: (clientX: number, clientY: number) => void;
  onHandlePointerDown: (index: number) => void;
  measurementCacheKey: string | null;
  curtainPolygon: { x: number; y: number }[] | null;
  heicConverting: boolean;
  cornerConfirmOpen: boolean;
  onConfirmCorners: () => void;
  onConfirmCornersReset: () => void;
  onBackToUpload: () => void;
};

export function HeroSurface(props: HeroSurfaceProps) {
  const {
    isMobile,
    dropRef,
    heroContainerRef,
    onDrop,
    onPaste,
    onClickDrop,
    confirmOpen,
    preview,
    t,
    confirmW,
    setConfirmW,
    confirmH,
    setConfirmH,
    wInvalid,
    hInvalid,
    confirmError,
    setConfirmError,
    setConfirmOpen,
    setFile,
    setPreview,
    setResult,
    setMeasureStatus,
    setSegStatus,
    currentFileRef,
    lastSignatureRef,
    segStatus,
    segmentKey,
    photoName,
    bypassCache,
    provider,
    model,
    elapsed,
    flowMode,
    saveMeasurementToCache,
    storeFlowState,
    router,
    imgRef,
    markPicks,
    onOverlayClick,
    onHandlePointerDown,
    measurementCacheKey,
    curtainPolygon,
    heicConverting,
    cornerConfirmOpen,
    onConfirmCorners,
    onConfirmCornersReset,
    onBackToUpload,
  } = props;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastPreviewRef = useRef<string | null>(null);
  const autoOpenedRef = useRef(false);

  const isFullscreenMobileNew = isMobile && flowMode === 'new' && !!preview && isFullscreen;

  useEffect(() => {
    if (!isMobile || flowMode !== 'new') {
      setIsFullscreen(false);
      lastPreviewRef.current = null;
      autoOpenedRef.current = false;
      return;
    }
    if (!preview) {
      setIsFullscreen(false);
      lastPreviewRef.current = null;
      autoOpenedRef.current = false;
      return;
    }

    if (preview !== lastPreviewRef.current) {
      lastPreviewRef.current = preview;
      autoOpenedRef.current = false;
    }

    if (autoOpenedRef.current) return;

    const openDelay = fullscreenDurationMs;
    const timer = window.setTimeout(() => {
      setIsFullscreen(true);
      autoOpenedRef.current = true;
    }, 360);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isMobile, flowMode, preview]);

  useEffect(() => {
    if (!isMobile || flowMode !== 'new') return;
    if (confirmOpen && isFullscreen) {
      setIsFullscreen(false);
    }
  }, [confirmOpen, isFullscreen, isMobile, flowMode]);

  const isMarkingCurtain = flowMode === 'new' && !!preview && markPicks.length < 4 && !cornerConfirmOpen && !confirmOpen;
  const frostBgClass = isMarkingCurtain
    ? 'bg-black/20'
    : (isMobile ? 'bg-black/45' : 'bg-black/50');
  const fullscreenDurationMs = getAdjustedDuration(motionTokens.duration.medium);

  return (
    <>
      {preview && (
        <FullscreenPhotoViewer
          open={isFullscreenMobileNew}
          onClose={() => {
            setIsFullscreen(false);
          }}
          src={preview}
          alt={t('estimate.previewAlt')}
          durationMs={fullscreenDurationMs}
          imageRef={imgRef as React.RefObject<HTMLImageElement>}
          busyOverlay={
            heicConverting ? (
              <div className="absolute inset-0 z-40 flex items-center justify-center rounded-2xl bg-black/60 text-white text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <Spinner size="sm" color="light" />
                  {t('estimate.heicConverting')}
                </div>
              </div>
            ) : undefined
          }
          overlay={
            flowMode === 'new' ? (
              <>
                {markPicks.length > 0 && (
                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox="0 0 1000 1000"
                    preserveAspectRatio="none"
                  >
                    <polygon
                      points={markPicks.map((p) => `${p.x * 1000},${p.y * 1000}`).join(' ')}
                      fill="var(--active-accent-primary)"
                      fillOpacity={0.08}
                      stroke="var(--active-accent-primary)"
                      strokeWidth={6}
                    />
                  </svg>
                )}
                {markPicks.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onHandlePointerDown(idx);
                    }}
                    className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-md outline-none ring-2"
                    style={{
                      left: `${p.x * 100}%`,
                      top: `${p.y * 100}%`,
                      backgroundColor: 'var(--active-accent-primary)',
                      borderColor: 'rgba(255,255,255,0.85)',
                      boxShadow: '0 0 0 2px rgba(var(--cw-ring-rgb), var(--cw-ring-opacity)), var(--cw-debug-handle-shadow)',
                    }}
                  />
                ))}
                {markPicks.length < 4 && (
                  <div
                    className="absolute inset-0 cursor-crosshair rounded-2xl border border-white/40"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOverlayClick(e.clientX, e.clientY);
                    }}
                    aria-hidden="true"
                  />
                )}
                {markPicks.length < 4 && !confirmOpen && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="max-w-xs rounded-2xl bg-black/60 px-4 py-3 text-center text-white shadow-high">
                      <div className="text-sm font-semibold">
                        {t('estimate.polygon.title')}
                      </div>
                      <div className="mt-1 text-xs text-neutral-200">
                        {t('estimate.polygon.subtitle')}
                      </div>
                    </div>
                  </div>
                )}
                {cornerConfirmOpen && !confirmOpen && (
                  <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-[2px]">
                    <div
                      className="cw-modal-scope mx-4 max-w-sm rounded-2xl bg-active-bg px-5 py-4 shadow-high border border-active-border"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-base font-semibold mb-1.5">
                        {t('estimate.polygon.confirmTitle')}
                      </div>
                      <div className="text-sm text-neutral-600 mb-3">
                        {t('estimate.polygon.confirmSubtitle')}
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="shrink-0"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onConfirmCornersReset();
                          }}
                        >
                          {t('estimate.polygon.confirmAgain')}
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          className="shrink-0"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onConfirmCorners();
                          }}
                        >
                          {t('estimate.polygon.confirmAccept')}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : undefined
          }
          footer={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-0 text-sm font-medium text-active-text hover:bg-transparent"
              onClick={() => {
                setIsFullscreen(false);
                onBackToUpload();
              }}
            >
              ← {t('common.back')}
            </Button>
          }
        />
      )}

      <div className={cn('cw-hero-shell w-full mt-4', !isMobile && 'mx-auto')}>
        <UploadDropzone
          ref={(el) => {
            dropRef.current = el;
            heroContainerRef.current = el;
          }}
          onDrop={onDrop}
          onPaste={onPaste}
          onClick={(e) => {
            if (confirmOpen) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            if (flowMode === 'new' && preview) {
              if (isMobile) {
                e.preventDefault();
                e.stopPropagation();
                setIsFullscreen(true);
                return;
              }
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            onClickDrop(e);
          }}
          onKeyDown={(e) => {
            if (confirmOpen || (flowMode === 'new' && preview)) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClickDrop(e as any);
            }
          }}
          role="button"
          tabIndex={0}
          title={t('estimate.tapToUpload')}
          description={t('estimate.tapHint')}
          icon={
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/50 bg-white/40 shadow-sm backdrop-blur-sm">
              <svg className="h-8 w-8 text-accent-sage" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          }
          isEmpty={!preview}
          className={cn(
            'relative flex min-h-[220px] cursor-pointer items-center justify-center overflow-hidden rounded-2xl p-6 text-center',
            'transition-all duration-200 ease-out',
          )}
          style={{
            background: preview
              ? undefined
              : 'linear-gradient(135deg, rgba(var(--cw-surface-glass-rgb), 0.8) 0%, rgba(var(--cw-surface-glass-rgb), 0.6) 100%)'
          }}
        >
        {preview && !isFullscreenMobileNew ? (
          <div className={cn('relative', isFullscreenMobileNew && 'flex h-full w-full items-center justify-center')}>
            <img
              ref={imgRef as React.RefObject<HTMLImageElement>}
              src={preview}
              alt={t('estimate.previewAlt')}
              className={cn(
                'max-w-full h-auto rounded-lg',
                isFullscreenMobileNew && 'max-h-[88vh] w-auto rounded-2xl shadow-[0_18px_44px_rgba(0,0,0,0.36)]'
              )}
            />

            {heicConverting && (
              <div className="absolute inset-0 z-40 flex items-center justify-center rounded-lg bg-black/60 text-white text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <Spinner size="sm" color="light" />
                  {t('estimate.heicConverting')}
                </div>
              </div>
            )}

            {flowMode === 'new' && (!isMobile || isFullscreen) && (
              <div
                className={cn(
                  'absolute inset-0 z-20',
                  isFullscreen ? 'top-12 bottom-0' : undefined,
                )}
              >
                {markPicks.length > 0 && (
                  <svg
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    viewBox="0 0 1000 1000"
                    preserveAspectRatio="none"
                  >
                    <polygon
                      points={markPicks.map((p) => `${p.x * 1000},${p.y * 1000}`).join(' ')}
                      fill="var(--active-accent-primary)"
                      fillOpacity={0.08}
                      stroke="var(--active-accent-primary)"
                      strokeWidth={6}
                    />
                  </svg>
                )}
                {markPicks.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onHandlePointerDown(idx);
                    }}
                    className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-md outline-none ring-2 pointer-events-auto"
                    style={{
                      left: `${p.x * 100}%`,
                      top: `${p.y * 100}%`,
                      backgroundColor: 'var(--active-accent-primary)',
                      borderColor: 'rgba(255,255,255,0.85)',
                      boxShadow: '0 0 0 2px rgba(var(--cw-ring-rgb), var(--cw-ring-opacity)), var(--cw-debug-handle-shadow)',
                    }}
                  />
                ))}
                {markPicks.length < 4 && (
                  <div
                    className="absolute inset-0 cursor-crosshair rounded-lg border border border-white/40 pointer-events-auto"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOverlayClick(e.clientX, e.clientY);
                    }}
                    aria-hidden="true"
                  />
                )}

                {/* Centered helper copy while marking corners (no CTA button) */}
                {markPicks.length < 4 && !confirmOpen && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                      className={cn(
                        'max-w-xs rounded-2xl bg-black/60 px-4 py-3 text-center text-white shadow-high transition-opacity duration-200',
                        markPicks.length > 0 && 'opacity-80'
                      )}
                    >
                      <div className="text-sm font-semibold">
                        {t('estimate.polygon.title')}
                      </div>
                      <div className="mt-1 text-xs text-neutral-200">
                        {t('estimate.polygon.subtitle')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {flowMode === 'new' && cornerConfirmOpen && !confirmOpen && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-[2px]">
                <div
                  className="mx-4 max-w-sm rounded-2xl bg-active-bg px-5 py-4 shadow-high border border-active-border"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-base font-semibold mb-1.5">
                    {t('estimate.polygon.confirmTitle')}
                  </div>
                  <div className="text-sm text-neutral-600 mb-3">
                    {t('estimate.polygon.confirmSubtitle')}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onConfirmCornersReset();
                      }}
                    >
                      {t('estimate.polygon.confirmAgain')}
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      className="shrink-0"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onConfirmCorners();
                      }}
                    >
                      {t('estimate.polygon.confirmAccept')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Frosty overlay - appears immediately when photo uploaded, until confirmation modal */}
            {!confirmOpen && (
              <div
                className={cn(
                  'absolute inset-0 pointer-events-none rounded-lg',
                  'animate-in fade-in duration-300',
                  frostBgClass,
                )}
                aria-hidden="true"
              />
            )}

            {/* Desktop modal: positioned over preview (absolute) */}
              {confirmOpen && !isMobile && (
                <div
                  role="dialog"
                  aria-modal="true"
                  className="absolute inset-0 z-50 flex px-3 bg-black/50 items-center justify-center py-3 animate-in fade-in duration-200 rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    onKeyDown={(e) => { if (e.key === 'Enter') { (document.getElementById('cw-confirm-btn') as HTMLButtonElement | null)?.click(); } }}
                    onClick={(e) => e.stopPropagation()}
                    className="cw-modal-scope bg-active-bg border border-active-border p-4 w-full max-w-[560px] rounded-[14px] shadow-[0_18px_44px_rgba(0,0,0,0.18)] animate-in duration-200 ease-out slide-in-from-bottom-4 zoom-in-95"
                  >
                    <div className="text-lg font-bold mb-1.5">{t('estimate.confirm.title')}</div>
                    <div className="text-sm text-neutral-600 mb-3">{t('estimate.confirm.subtitle')}</div>
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex w-full max-w-[240px] flex-col gap-1">
                        <label className="text-xs text-neutral-800">{t('estimate.confirm.widthLabel')}</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="off"
                          step={1}
                          min={50}
                          max={1000}
                          value={confirmW}
                          onChange={(e) => {
                            const digits = (e.target.value || '').replace(/\D+/g, '');
                            if (digits.length > 4) return;
                            setConfirmW(digits);
                          }}
                          onBlur={(e) => {
                            const num = Number((e.target.value || '').replace(/\D+/g, ''));
                            if (!Number.isFinite(num) || num === 0) return;
                            const clamped = Math.max(50, Math.min(1000, Math.round(num)));
                            setConfirmW(String(clamped));
                          }}
                          onFocus={(e) => { try { (e.target as HTMLInputElement).select(); } catch {} }}
                          aria-invalid={wInvalid || undefined}
                          className={cn(
                            'w-full max-w-full',
                            wInvalid ? 'border-error text-error-text' : 'border-neutral-300'
                          )}
                        />
                        <div className={cn('text-2xs', wInvalid ? 'text-error-text' : 'text-neutral-500')}>
                          {t('estimate.confirm.rangeHint')}
                        </div>
                      </div>
                      <div className="flex w-full max-w-[240px] flex-col gap-1">
                        <label className="text-xs text-neutral-800">{t('estimate.confirm.heightLabel')}</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoComplete="off"
                          step={1}
                          min={50}
                          max={1000}
                          value={confirmH}
                          onChange={(e) => {
                            const digits = (e.target.value || '').replace(/\D+/g, '');
                            if (digits.length > 4) return;
                            setConfirmH(digits);
                          }}
                          onBlur={(e) => {
                            const num = Number((e.target.value || '').replace(/\D+/g, ''));
                            if (!Number.isFinite(num) || num === 0) return;
                            const clamped = Math.max(50, Math.min(1000, Math.round(num)));
                            setConfirmH(String(clamped));
                          }}
                          onFocus={(e) => { try { (e.target as HTMLInputElement).select(); } catch {} }}
                          aria-invalid={hInvalid || undefined}
                          className={cn(
                            'w-full max-w-full',
                            hInvalid ? 'border-error text-error-text' : 'border-neutral-300'
                          )}
                        />
                        <div className={cn('text-2xs', hInvalid ? 'text-error-text' : 'text-neutral-500')}>
                          {t('estimate.confirm.rangeHint')}
                        </div>
                      </div>
                    </div>
                    {confirmError && <div className="text-error-text text-xs mt-2">{confirmError}</div>}
                    <div className="flex justify-between items-center gap-2 mt-3.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onBackToUpload();
                        }}
                      >
                        ← {t('common.back')}
                      </Button>
                      <Button
                        id="cw-confirm-btn"
                        variant="primary"
                        disabled={segStatus === 'pending'}
                        onClick={() => {
                          let w = Number(String(confirmW).replace(',', '.'));
                          let h = Number(String(confirmH).replace(',', '.'));
                          if (!Number.isFinite(w) || !Number.isFinite(h)) {
                            setConfirmError(t('estimate.confirm.error'));
                            return;
                          }
                          // Round to full cm and clamp within sane bounds
                          w = Math.max(50, Math.min(1000, Math.round(w)));
                          h = Math.max(50, Math.min(1000, Math.round(h)));
                          if (w < 50 || w > 1000 || h < 50 || h > 1000) {
                            setConfirmError(t('estimate.confirm.error'));
                            return;
                          }
                          if (segStatus === 'pending') {
                            setConfirmError(t('estimate.confirm.waitSegmentation'));
                            toast.error(t('estimate.toastWaitSegmentation'));
                            return;
                          }
                          if (segStatus !== 'success' || !segmentKey) {
                            setConfirmError(t('estimate.confirm.retrySegmentation'));
                            toast.error(t('estimate.toastNeedSegmentation'));
                            return;
                          }
                          setConfirmError(null);
                          const key = segmentKey;
                          const photoLabel = photoName ?? undefined;
                          const flowPhotoUrl = preview ?? null;
                          const flowPhotoType = currentFileRef.current?.type ?? null;
                          const flowPhotoSize = currentFileRef.current?.size ?? null;
                          const measurementKey = measurementCacheKey ?? lastSignatureRef.current ?? key ?? null;
                          if (key) {
                            // Persist user-confirmed dimensions to cache so next load uses them
                            if (!bypassCache && measurementKey) {
                              try {
                                saveMeasurementToCache({ key: measurementKey, provider, model, wallWidthCm: w, wallHeightCm: h, elapsedMs: elapsed ?? undefined, createdAt: Date.now() });
                              } catch {}
                            }
                            storeFlowState({
                              measurement: {
                                wallWidthCm: w,
                                wallHeightCm: h,
                                provider,
                                model,
                                elapsedMs: elapsed ?? undefined,
                                confidencePct: undefined,
                                warnings: undefined,
                                usedFallback: undefined,
                                fallbackProvider: undefined,
                              },
                              segmentKey: key,
                              photoName: photoLabel,
                              photoUrl: flowPhotoUrl,
                              photoType: flowPhotoType,
                              photoSize: flowPhotoSize,
                              createdAt: Date.now(),
                              bypassCache,
                              flowMode,
                              curtainPolygon: flowMode === 'new' ? curtainPolygon ?? undefined : undefined,
                            });
                          }
                          setConfirmOpen(false);
                          
                          // Use View Transitions API for smooth page transition (if supported)
                          const doc = document as any;
                          if (typeof doc.startViewTransition === 'function' && !prefersReducedMotion()) {
                            doc.startViewTransition(() => {
                              router.push(`/configure?w_cm=${w.toFixed(0)}&h_cm=${h.toFixed(0)}`);
                            });
                          } else {
                            router.push(`/configure?w_cm=${w.toFixed(0)}&h_cm=${h.toFixed(0)}`);
                          }
                        }}
                      >
                        {segStatus === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <Spinner size="sm" color="light" />
                            {t('estimate.confirm.confirmButton')}
                          </div>
                        ) : (
                          t('estimate.confirm.confirmButton')
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </UploadDropzone>
      </div>
    </>
  );
}
