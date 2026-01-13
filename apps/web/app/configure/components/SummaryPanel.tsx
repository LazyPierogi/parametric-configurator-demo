import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ImageModal } from '@/components/ui/ImageModal';
import { SummaryCard, SummaryRow } from '@/components/ui/SummaryCard';
import type { PriceQuote, ServiceOption } from '@curtain-wizard/core/src/catalog';
import type { ChildItem, Fabric } from '@curtain-wizard/core/src/catalog/types';
import type { SummaryConfig, SummaryFieldKey } from '@curtain-wizard/core/src/catalog/lib/summaryConfig';
import type { AddToCartState } from '../types';

export interface SummaryPanelProps {
  isReady: boolean;
  t: (key: string, params?: Record<string, any>) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (minor: number, currency: string, locale: string) => string;
  summaryConfig: SummaryConfig;
  isFieldEnabled: (config: SummaryConfig, field: SummaryFieldKey) => boolean;
  selectedFabric: Fabric | null;
  selectedColor: string | null;
  selectedChildItem: ChildItem | null;
  selectedPleatId: string | null;
  selectedPleat: { label?: string } | null;
  selectedHem: { label?: string } | null;
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
  selectedServiceObjects: ServiceOption[];
  providerId: string | null;
  locale: string;
  addToCartState: AddToCartState;
  handleResetAddToCart: () => void;
  storefrontCartUrl: string | null;
  handleAddToCart: (totalPriceMinor?: number) => void;
  addToCartDisabled: boolean;
  totalPriceMinor?: number;
  debugUiEnabled?: boolean;
  /** Hide footer (Total + Add to Cart) - used when footer is rendered separately */
  hideFooter?: boolean;
}

export function SummaryPanel(props: SummaryPanelProps) {
  const [imageModalOpen, setImageModalOpen] = useState(false);
  
  if (!props.isReady) return null;

  const {
    t,
    formatNumber,
    formatCurrency,
    summaryConfig,
    isFieldEnabled,
    selectedFabric,
    selectedColor,
    selectedChildItem,
    selectedPleatId,
    selectedPleat,
    selectedHem,
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
    selectedServiceObjects,
    providerId,
    locale,
    addToCartState,
    handleResetAddToCart,
    storefrontCartUrl,
    handleAddToCart,
    addToCartDisabled,
    totalPriceMinor,
  } = props;

  const servicesLabelKey = 'configure.summary.services' as const;
  const servicesLabelCandidate = t(servicesLabelKey);
  const servicesLabel =
    servicesLabelCandidate !== servicesLabelKey ? servicesLabelCandidate : t('configure.panel.services');
  const servicesCount = selectedServiceObjects.length;
  const servicesValue =
    servicesCount > 0
      ? t('configure.summary.servicesSelected', { count: formatNumber(servicesCount) })
      : t('configure.summary.servicesNone');

  const cartId = typeof window !== 'undefined' && typeof localStorage !== 'undefined' ? localStorage.getItem('cart_id') : null;
  const checkoutHref =
    storefrontCartUrl && cartId
      ? storefrontCartUrl
          .replaceAll('{cartId}', encodeURIComponent(cartId))
          .replaceAll('{cart_id}', encodeURIComponent(cartId))
      : null;

  return (
    <SummaryCard
      title={t('configure.summary.title')}
      providerLabel={
        quote
          ? providerId === 'mock'
            ? t('configure.provider.mock')
            : t('configure.provider.storefront')
          : undefined
      }
    >
      {selectedChildItem?.thumbnail && (
        <>
          <div className="mb-3 flex justify-center">
            <button
              type="button"
              onClick={() => setImageModalOpen(true)}
              className="group relative h-24 w-24 rounded-xl border border-neutral-200 overflow-hidden transition-all hover:border-neutral-400 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-active-accent/50"
              aria-label={t('configure.summary.viewFabricImage')}
            >
              <img
                src={selectedChildItem.thumbnail }
                alt={selectedChildItem.name }
                className="h-full w-full object-cover transition-transform group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            </button>
          </div>
          
          <ImageModal
            open={imageModalOpen}
            onClose={() => setImageModalOpen(false)}
            src={selectedChildItem.thumbnail}
            alt={selectedChildItem.name}
            title={selectedChildItem.name}
          />
        </>
      )}
      {isFieldEnabled(summaryConfig, 'pleat') && (
        <div className="summary-row">
          <span className="font-semibold">{t('configure.summary.pleat')}</span>
          <span>
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
      {isFieldEnabled(summaryConfig, 'hem') && (
        <div className="summary-row">
          <span className="font-semibold">{t('configure.summary.hem')}</span>
          <span>{selectedHem?.label ?? '—'}</span>
        </div>
      )}
      {isFieldEnabled(summaryConfig, 'services') && (
        <div className="summary-row">
          <span className="font-semibold">{servicesLabel}</span>
          <span>{servicesValue}</span>
        </div>
      )}
      {quote && isFieldEnabled(summaryConfig, 'dimensions') && segmentWidthsCmFromQuote && segmentWidthsCmFromQuote.length > 0 && (
        <div className="summary-row">
          <span className="font-semibold">{t('configure.summary.dimensions')}</span>
          <span>
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
      {quote && isFieldEnabled(summaryConfig, 'height') && appliedHeightCm != null && (
        <SummaryRow
          label={t('configure.summary.height')}
          value={t('configure.summary.heightValue', {
            height: formatNumber(appliedHeightCm, { maximumFractionDigits: 0 }),
            unit: t('common.unit.cm'),
          })}
        />
      )}
      {quote && <div className="my-2 border-t border-neutral-200" />}
      {quote && (
        <>
          {isFieldEnabled(summaryConfig, 'boltWidths') && numWidths != null && (
            <SummaryRow
              label={t('configure.summary.boltWidths')}
              value={
                <span className="font-semibold">
                  {formatNumber(numWidths)}
                  {materialReuseActive && numWidthsUnoptimized != null && numWidthsUnoptimized > numWidths && (
                    <span className="ml-1 text-[0.85em] font-normal opacity-70">
                      {t('configure.summary.boltWidthsOptimized', { original: numWidthsUnoptimized })}
                    </span>
                  )}
                </span>
              }
            />
          )}
          {isFieldEnabled(summaryConfig, 'cutDrop') && cutDropCm != null && (
            <div className="summary-row">
              <span className="font-semibold">{t('configure.summary.cutDrop')}</span>
              <span>
                {t('configure.summary.cutDropValue', {
                  value: formatNumber(cutDropCm, { maximumFractionDigits: 0 }),
                  unit: t('common.unit.cm'),
                })}
              </span>
            </div>
          )}
          {isFieldEnabled(summaryConfig, 'allowances') && allowancesSummary && (
            <div className="summary-row">
              <span className="font-semibold">{t('configure.summary.allowances')}</span>
              <span>
                {t('configure.summary.allowancesDetail', {
                  total: formatNumber(allowancesSummary.top + allowancesSummary.bottom, { maximumFractionDigits: 0 }),
                  top: formatNumber(allowancesSummary.top, { maximumFractionDigits: 0 }),
                  bottom: formatNumber(allowancesSummary.bottom, { maximumFractionDigits: 0 }),
                })}
              </span>
            </div>
          )}
          {isFieldEnabled(summaryConfig, 'fullness') && fullnessRatio != null && (
            <div className="summary-row">
              <span className="font-semibold">{t('configure.summary.fullness')}</span>
              <span>
                {t('configure.summary.fullnessValue', {
                  value: formatNumber(fullnessRatio, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                })}
              </span>
            </div>
          )}
          {isFieldEnabled(summaryConfig, 'shrinkage') && shrinkagePct != null && (
            <div className="summary-row">
              <span className="font-semibold">{t('configure.summary.shrinkage')}</span>
              <span>
                {t('configure.summary.shrinkageValue', {
                  value: formatNumber(shrinkagePct, { maximumFractionDigits: 0 }),
                  unit: t('common.unit.percent'),
                })}
              </span>
            </div>
          )}
          {isFieldEnabled(summaryConfig, 'fabricOrdered') && totalLinearMetres != null && (
            <div className="summary-row">
              <span className="font-semibold">{t('configure.summary.fabricOrdered')}</span>
              <span>
                {`${formatNumber(totalLinearMetres, {
                  minimumFractionDigits: totalLinearMetres < 10 ? 2 : 1,
                  maximumFractionDigits: totalLinearMetres < 10 ? 2 : 1,
                })} ${t('common.unit.m')}`}
              </span>
            </div>
          )}
        </>
      )}
      {quote && isFieldEnabled(summaryConfig, 'breakdown') && <div className="my-2 border-t border-neutral-200" />}
      {quote && isFieldEnabled(summaryConfig, 'breakdown') && (
        <>
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
                <SummaryRow
                  key={item.id}
                  label={label ?? item.label ?? ''}
                  value={formatCurrency(item.amountMinor, item.currency, locale)}
                />
              );
            })}
          <div className="my-2 border-t border-neutral-200" />
          {!props.hideFooter && quote.breakdown
            .filter((item) => item.type === 'total')
            .map((item) => (
              <SummaryRow
                key={item.id}
                label={t('configure.summary.breakdown.total')}
                value={formatCurrency(item.amountMinor, item.currency, locale)}
                tone="accent"
              />
            ))}
        </>
      )}
      {!props.hideFooter && (
        <div className="mt-3 flex flex-col gap-2.5">
          {addToCartState.status === 'success' ? (
            <div className="rounded-[10px] border border-[#bbf7d0] bg-[#ecfdf5] px-3 py-2.5 text-[#065f46]">
              <div className="mb-1.5 font-semibold">{t('configure.addedQuotation')}</div>
              {addToCartState.data?.mode === 'storefront' && (
                <div className="mb-1.5 text-sm">{t('configure.redirectingToCart')}</div>
              )}
              {addToCartState.data?.note && props.debugUiEnabled && (
                <div className="mb-1.5 text-xs">{addToCartState.data.note}</div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="border-[#059669] text-[#047857]"
                  onClick={handleResetAddToCart}
                >
                  {t('configure.configureAnother')}
                </Button>
                {addToCartState.data?.mode === 'storefront' ? (
                  <a
                    href={checkoutHref || '#'}
                    className="rounded-lg bg-[#059669] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#047857]"
                  >
                    {t('configure.goToCart')}
                  </a>
                ) : checkoutHref ? (
                  <a
                    href={checkoutHref}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-[#059669] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#047857]"
                  >
                    {t('configure.finalizePurchase')}
                  </a>
                ) : (
                  props.debugUiEnabled && (
                    <button
                      disabled
                      className="rounded-lg border border border-neutral-400 bg-neutral-50 px-3 py-2 text-sm text-neutral-600"
                    >
                      {t('configure.missingCartUrl')}
                    </button>
                  )
                )}
              </div>
              {props.debugUiEnabled && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-xs text-sky-700">{t('configure.viewPayload')}</summary>
                  <pre className="mt-1 max-h-[220px] overflow-auto rounded-lg bg-[#0f172a] p-2.5 text-[13px] text-[#f1f5f9]">
{JSON.stringify(addToCartState.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ) : (
            <Button
              type="button"
              variant="primary"
              className="rounded-[10px] px-3.5 py-2.5 font-semibold"
              disabled={addToCartDisabled}
              onClick={() => handleAddToCart(totalPriceMinor)}
            >
              {addToCartState.status === 'loading' ? t('configure.adding') : t('configure.getQuotation')}
            </Button>
          )}
          {addToCartState.status === 'error' && (
            <div className="rounded-lg border border-error-border bg-error-bg px-2.5 py-2 text-xs text-error-text">
              {addToCartState.message}
            </div>
          )}
        </div>
      )}
    </SummaryCard>
  );
}
