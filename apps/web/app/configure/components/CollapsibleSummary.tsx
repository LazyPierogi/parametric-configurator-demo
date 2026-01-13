"use client";

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ImageModal } from '@/components/ui/ImageModal';
import { SummaryRow } from '@/components/ui/SummaryCard';
import type { PriceQuote, ServiceOption } from '@curtain-wizard/core/src/catalog';
import type { ChildItem } from '@curtain-wizard/core/src/catalog/types';
import type { SummaryConfig, SummaryFieldKey } from '@curtain-wizard/core/src/catalog/lib/summaryConfig';
import type { AddToCartState } from '../types';
import { cn } from '@/lib/utils';

export interface CollapsibleSummaryProps {
  isReady: boolean;
  t: (key: string, params?: Record<string, any>) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (minor: number, currency: string, locale: string) => string;
  summaryConfig: SummaryConfig;
  isFieldEnabled: (config: SummaryConfig, field: SummaryFieldKey) => boolean;
  selectedChildItem: ChildItem | null;
  selectedPleatId: string | null;
  selectedPleat: { label?: string } | null;
  selectedHem: { label?: string } | null;
  selectedServiceObjects?: ServiceOption[];
  quote: PriceQuote | null;
  segmentCount: number;
  segmentWidthsCmFromQuote: readonly number[] | null | undefined;
  appliedHeightCm: number | null;
  materialReuseActive: boolean;
  numWidths: number | null;
  numWidthsUnoptimized: number | null;
  cutDropCm: number | null;
  allowancesSummary: { top: number; bottom: number } | null | undefined;
  fullnessRatio: number | null;
  shrinkagePct: number | null;
  totalLinearMetres: number | null;
  providerId: string | null;
  locale: string;
  addToCartState: AddToCartState;
  handleResetAddToCart: () => void;
  storefrontCartUrl: string | null;
  handleAddToCart: (totalPriceMinor?: number) => void;
  addToCartDisabled: boolean;
  totalPriceMinor?: number;
  debugUiEnabled?: boolean;
}

export function CollapsibleSummary(props: CollapsibleSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  if (!props.isReady) return null;

  const {
    t,
    formatNumber,
    formatCurrency,
    summaryConfig,
    isFieldEnabled,
    selectedChildItem,
    selectedPleatId,
    selectedPleat,
    selectedHem,
    selectedServiceObjects,
    quote,
    segmentCount,
    segmentWidthsCmFromQuote,
    appliedHeightCm,
    materialReuseActive,
    numWidths,
    numWidthsUnoptimized,
    cutDropCm,
    allowancesSummary,
    fullnessRatio,
    shrinkagePct,
    totalLinearMetres,
    providerId,
    locale,
    addToCartState,
    handleResetAddToCart,
    storefrontCartUrl,
    handleAddToCart,
    addToCartDisabled,
    totalPriceMinor,
    debugUiEnabled,
  } = props;

  const servicesLabelKey = 'configure.summary.services' as const;
  const servicesLabelCandidate = t(servicesLabelKey);
  const servicesLabel =
    servicesLabelCandidate !== servicesLabelKey ? servicesLabelCandidate : t('configure.panel.services');
  const servicesCount = (selectedServiceObjects ?? []).length;
  const servicesValue =
    servicesCount > 0
      ? t('configure.summary.servicesSelected', { count: formatNumber(servicesCount) })
      : t('configure.summary.servicesNone');

  const totalItem = quote?.breakdown.find((item) => item.type === 'total');

  return (
    <div className="w-full rounded-xl border-border-panel bg-surface-glass/90 shadow-lg backdrop-blur-md overflow-hidden">
      {/* Collapsed view - always visible */}
      <div className="p-3 flex items-center gap-3">
        {/* Thumbnail */}
        {selectedChildItem?.thumbnail && (
          <>
            <button
              type="button"
              onClick={() => setImageModalOpen(true)}
              className="group relative h-14 w-14 flex-shrink-0 rounded-lg border border-neutral-200 overflow-hidden transition-all hover:border-neutral-400 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-active-accent/50"
              aria-label={t('configure.summary.viewFabricImage')}
            >
              <img
                src={selectedChildItem.thumbnail}
                alt={selectedChildItem.name}
                className="h-full w-full object-cover transition-transform group-hover:scale-110"
              />
              {/* Magnifying glass icon overlay */}
              <div className="absolute inset-0 bg-black/10 opacity-100 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </button>
            <ImageModal
              open={imageModalOpen}
              onClose={() => setImageModalOpen(false)}
              src={selectedChildItem.thumbnail}
              alt={selectedChildItem.name}
              title={selectedChildItem.name}
            />
          </>
        )}

        {/* Total + Details + Expand arrow */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex-1 flex items-center justify-between min-w-0 py-1 px-2 -mx-2 rounded-lg hover:bg-neutral-50 transition-colors"
        >
          <div className="flex flex-col items-start min-w-0">
            <span className="text-xs text-neutral-500 font-medium">{t('configure.summary.breakdown.total')}</span>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-neutral-900 truncate">
                {totalItem ? formatCurrency(totalItem.amountMinor, totalItem.currency, locale) : '—'}
              </span>
            </div>
          </div>
          <div
            className={cn(
              'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors',
              expanded
                ? 'bg-active-accent text-white'
                : 'bg-neutral-100/20 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900'
            )}
            aria-label={t('configure.summary.details')}
          >
            <Info size={18} strokeWidth={1.25} aria-hidden="true" />
          </div>
        </button>

        {/* Add to Cart button */}
        <div className="flex-shrink-0">
          {addToCartState.status === 'success' ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#065f46]">✓</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleResetAddToCart}
              >
                {t('configure.configureAnother')}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="w-full rounded-lg px-3 py-2 text-sm font-semibold"
              disabled={addToCartDisabled}
              onClick={() => handleAddToCart(totalPriceMinor)}
            >
              {addToCartState.status === 'loading' ? t('configure.adding') : t('configure.getQuotation')}
            </Button>
          )}
        </div>
      </div>

      {/* Expanded details - only render when expanded to avoid empty space */}
      {expanded && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="border-t border-neutral-200 p-3 space-y-2">
            {/* Pleat */}
            {isFieldEnabled(summaryConfig, 'pleat') && (
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-neutral-700">{t('configure.summary.pleat')}</span>
                <span className="text-neutral-900">
                  {(() => {
                    if (!selectedPleatId) return '—';
                    const labelKey = `configure.pleats.catalog.${selectedPleatId}.label` as const;
                    const translated = t(labelKey);
                    if (translated !== labelKey) return translated;
                    return selectedPleat?.label ?? '—';
                  })()}
                </span>
              </div>
            )}

            {/* Hem */}
            {isFieldEnabled(summaryConfig, 'hem') && (
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-neutral-700">{t('configure.summary.hem')}</span>
                <span className="text-neutral-900">{selectedHem?.label ?? '—'}</span>
              </div>
            )}

            {/* Services */}
            {isFieldEnabled(summaryConfig, 'services') && (
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-neutral-700">{servicesLabel}</span>
                <span className="text-neutral-900">{servicesValue}</span>
              </div>
            )}

            {/* Dimensions */}
            {quote && isFieldEnabled(summaryConfig, 'dimensions') && segmentWidthsCmFromQuote && segmentWidthsCmFromQuote.length > 0 && (
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-neutral-700">{t('configure.summary.dimensions')}</span>
                <span className="text-neutral-900">
                  {segmentCount === 1
                    ? t('configure.summary.dimensionsSingle', {
                        segments: formatNumber(segmentCount),
                        width: formatNumber(segmentWidthsCmFromQuote[0], { maximumFractionDigits: 0 }),
                        unit: t('common.unit.cm'),
                      })
                    : t('configure.summary.dimensionsDetail', {
                        segments: formatNumber(segmentCount),
                        widths: segmentWidthsCmFromQuote
                          .map((w) => `${formatNumber(w, { maximumFractionDigits: 0 })} ${t('common.unit.cm')}`)
                          .join(' + '),
                      })}
                </span>
              </div>
            )}

            {/* Height */}
            {quote && isFieldEnabled(summaryConfig, 'height') && appliedHeightCm != null && (
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-neutral-700">{t('configure.summary.height')}</span>
                <span className="text-neutral-900">
                  {t('configure.summary.heightValue', {
                    height: formatNumber(appliedHeightCm, { maximumFractionDigits: 0 }),
                    unit: t('common.unit.cm'),
                  })}
                </span>
              </div>
            )}

            {quote && <div className="my-2 border-t border-neutral-100" />}

            {/* Bolt widths */}
            {quote && isFieldEnabled(summaryConfig, 'boltWidths') && numWidths != null && (
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-neutral-700">{t('configure.summary.boltWidths')}</span>
                <span className="text-neutral-900">
                  {formatNumber(numWidths)}
                  {materialReuseActive && numWidthsUnoptimized != null && numWidthsUnoptimized > numWidths && (
                    <span className="ml-1 text-[0.85em] font-normal opacity-70">
                      {t('configure.summary.boltWidthsOptimized', { original: numWidthsUnoptimized })}
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Cut drop */}
            {quote && isFieldEnabled(summaryConfig, 'cutDrop') && cutDropCm != null && (
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-neutral-700">{t('configure.summary.cutDrop')}</span>
                <span className="text-neutral-900">
                  {t('configure.summary.cutDropValue', {
                    value: formatNumber(cutDropCm, { maximumFractionDigits: 0 }),
                    unit: t('common.unit.cm'),
                  })}
                </span>
              </div>
            )}

            {/* Allowances */}
            {quote && isFieldEnabled(summaryConfig, 'allowances') && allowancesSummary && (
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-neutral-700">{t('configure.summary.allowances')}</span>
                <span className="text-neutral-900">
                  {t('configure.summary.allowancesDetail', {
                    total: formatNumber(allowancesSummary.top + allowancesSummary.bottom, { maximumFractionDigits: 0 }),
                    top: formatNumber(allowancesSummary.top, { maximumFractionDigits: 0 }),
                    bottom: formatNumber(allowancesSummary.bottom, { maximumFractionDigits: 0 }),
                  })}
                </span>
              </div>
            )}

            {/* Fullness */}
            {quote && isFieldEnabled(summaryConfig, 'fullness') && fullnessRatio != null && (
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-neutral-700">{t('configure.summary.fullness')}</span>
                <span className="text-neutral-900">
                  {t('configure.summary.fullnessValue', {
                    value: formatNumber(fullnessRatio, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  })}
                </span>
              </div>
            )}

            {/* Shrinkage */}
            {quote && isFieldEnabled(summaryConfig, 'shrinkage') && shrinkagePct != null && (
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-neutral-700">{t('configure.summary.shrinkage')}</span>
                <span className="text-neutral-900">
                  {t('configure.summary.shrinkageValue', {
                    value: formatNumber(shrinkagePct, { maximumFractionDigits: 0 }),
                    unit: t('common.unit.percent'),
                  })}
                </span>
              </div>
            )}

            {/* Fabric ordered */}
            {quote && isFieldEnabled(summaryConfig, 'fabricOrdered') && totalLinearMetres != null && (
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-neutral-700">{t('configure.summary.fabricOrdered')}</span>
                <span className="text-neutral-900">
                  {`${formatNumber(totalLinearMetres, {
                    minimumFractionDigits: totalLinearMetres < 10 ? 2 : 1,
                    maximumFractionDigits: totalLinearMetres < 10 ? 2 : 1,
                  })} ${t('common.unit.m')}`}
                </span>
              </div>
            )}

            {/* Breakdown */}
            {quote && isFieldEnabled(summaryConfig, 'breakdown') && (
              <>
                <div className="my-2 border-t border-neutral-100" />
                {quote.breakdown
                  .filter((item) => item.type !== 'total')
                  .map((item) => {
                    let label = item.label;
                    if (item.id === 'fabric') {
                      label = t('configure.summary.breakdown.fabric');
                    } else if (item.id === 'labor') {
                      const widths = (item.providerMetadata as any)?.numWidths ?? quote.providerMetadata?.numWidths;
                      label = widths != null
                        ? t('configure.summary.breakdown.laborWithWidths', { widths: String(widths) })
                        : t('configure.summary.breakdown.laborWithWidths', { widths: '—' });
                    } else if (item.id === 'pleat-surcharge') {
                      label = t('configure.summary.breakdown.pleatSurcharge');
                    } else if (item.id === 'hem-surcharge') {
                      label = t('configure.summary.breakdown.hemSurcharge');
                    } else if (item.id === 'fabric-surcharge') {
                      label = t('configure.summary.breakdown.fabricSurcharge');
                    }

                    return (
                      <div key={item.id} className="flex justify-between text-xs">
                        <span className="text-neutral-700">{label ?? item.label ?? ''}</span>
                        <span className="text-neutral-900">{formatCurrency(item.amountMinor, item.currency, locale)}</span>
                      </div>
                    );
                  })}
              </>
            )}
          </div>
        </div>
      )}

      {/* Error state */}
      {addToCartState.status === 'error' && (
        <div className="border-t border-error-border bg-error-bg px-3 py-2 text-xs text-error-text">
          {addToCartState.message}
        </div>
      )}

      {/* Success details (debug) */}
      {addToCartState.status === 'success' && debugUiEnabled && (
        <div className="border-t border-neutral-200 p-3">
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-sky-700">{t('configure.viewPayload')}</summary>
            <pre className="mt-1 max-h-[180px] overflow-auto rounded-lg bg-[#0f172a] p-2.5 text-[11px] text-[#f1f5f9]">
              {JSON.stringify(addToCartState.data, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
