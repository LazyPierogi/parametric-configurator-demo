'use client';

import { useMemo, useState } from 'react';
import type { PriceQuote } from '@curtain-wizard/core/src/catalog';
import type { Fabric } from '@curtain-wizard/core/src/catalog/types';
import { Button } from '@/components/ui/Button';

type PricingDiagnosticsPanelProps = {
  visible: boolean;
  quote: PriceQuote | null;
  selectedFabric: Fabric | null;
  selectedPleatId: string | null;
  fabricMultiplier: number;
  laborMultiplier: number;
};

function formatNumber(value: number | undefined, fractionDigits = 2): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return value.toFixed(fractionDigits);
  }
}

function minorToMajor(minor: number | undefined): number | undefined {
  if (typeof minor !== 'number' || !Number.isFinite(minor)) return undefined;
  return minor / 100;
}

function toMinor(valueMajor: number | undefined): number | undefined {
  if (typeof valueMajor !== 'number' || !Number.isFinite(valueMajor)) return undefined;
  return Math.round(valueMajor * 100);
}

async function copyToClipboard(text: string): Promise<void> {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}

export function PricingDiagnosticsPanel({
  visible,
  quote,
  selectedFabric,
  selectedPleatId,
  fabricMultiplier,
  laborMultiplier,
}: PricingDiagnosticsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const diagnostics = useMemo(() => {
    const quoteMeta = (quote?.providerMetadata ?? {}) as Record<string, any>;
    const fabricLine = quote?.breakdown?.find((item) => item.id === 'fabric');
    const fabricLineMeta = (fabricLine?.providerMetadata ?? {}) as Record<string, any>;

    const pricingFromQuote = (quoteMeta?.pricing ?? fabricLineMeta?.pricing) as
      | {
          model?: string;
          priceKey?: string;
          requestedPriceKey?: string;
          appliedPriceKey?: string;
          pricePerMWidth?: number;
          priceStr?: string;
        }
      | undefined;

    const model = pricingFromQuote?.model ?? '—';
    const requestedPriceKey = pricingFromQuote?.requestedPriceKey ?? pricingFromQuote?.priceKey ?? '—';
    const appliedPriceKey = pricingFromQuote?.appliedPriceKey ?? pricingFromQuote?.priceKey ?? '—';
    const pricePerMWidth = pricingFromQuote?.pricePerMWidth;
    const appliedPriceStr = pricingFromQuote?.priceStr;

    const totalLinearCm = typeof quoteMeta?.totalLinearCm === 'number' ? quoteMeta.totalLinearCm : undefined;
    const widthMetres = typeof totalLinearCm === 'number' ? totalLinearCm / 100 : undefined;

    const ridex = (selectedFabric?.providerMetadata as any)?.ridex as
      | { price_flex?: string | null; price_double_flex?: string | null; price_wave?: string | null }
      | undefined;

    const rawRequested =
      typeof requestedPriceKey === 'string' && (ridex as any)?.[requestedPriceKey] != null
        ? String((ridex as any)[requestedPriceKey])
        : undefined;
    const rawApplied =
      typeof appliedPriceKey === 'string' && (ridex as any)?.[appliedPriceKey] != null
        ? String((ridex as any)[appliedPriceKey])
        : undefined;
    const rawWave = ridex?.price_wave != null ? String(ridex.price_wave) : undefined;

    const isRidex = (pricingFromQuote?.model ?? '').toLowerCase() === 'ridex';
    const effectiveFabricMultiplier = isRidex ? 1 : (Number.isFinite(fabricMultiplier) ? fabricMultiplier : 1);
    const effectiveLaborMultiplier = isRidex ? 1 : (Number.isFinite(laborMultiplier) ? laborMultiplier : 1);

    const expectedFabricMajor =
      typeof widthMetres === 'number' && typeof pricePerMWidth === 'number'
        ? widthMetres * pricePerMWidth * effectiveFabricMultiplier
        : undefined;
    const expectedFabricMinor = toMinor(expectedFabricMajor);

    const actualFabricMinor = typeof fabricLine?.amountMinor === 'number' ? fabricLine.amountMinor : undefined;

    return {
      currency: quote?.currency ?? '—',
      model,
      isRidex,
      pleatId: selectedPleatId ?? '—',
      requestedPriceKey,
      appliedPriceKey,
      rawRequested,
      rawApplied,
      rawWave,
      pricePerMWidth,
      appliedPriceStr,
      totalLinearCm,
      widthMetres,
      fabricMultiplier: effectiveFabricMultiplier,
      laborMultiplier: effectiveLaborMultiplier,
      expectedFabricMinor,
      expectedFabricMajor,
      actualFabricMinor,
      actualFabricMajor: minorToMajor(actualFabricMinor),
      servicesMinor: quote?.servicesMinor,
      subtotalMinor: quote?.subtotalMinor,
      totalMinor: quote?.totalMinor,
      segmentWidthsCm: Array.isArray(quoteMeta?.segmentWidthsCm) ? (quoteMeta.segmentWidthsCm as number[]) : undefined,
    };
  }, [quote, selectedFabric, selectedPleatId, fabricMultiplier, laborMultiplier]);

  if (!visible) return null;

  const showRidex =
    diagnostics.model === 'ridex' ||
    diagnostics.requestedPriceKey !== '—' ||
    diagnostics.appliedPriceKey !== '—' ||
    diagnostics.rawWave != null;

  return (
    <div className="mt-3 rounded-lg border border-active-border bg-active-bg p-4">
      <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="m-0 text-base font-semibold">Pricing Diagnostics</h3>
          <p className="m-0 mt-1 text-xs text-neutral-600">
            Inspect raw Magento attributes and the price computation used by the configurator.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? 'Hide Details' : 'Show Details'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => copyToClipboard(JSON.stringify({ quote, selectedFabric }, null, 2))}
            disabled={!quote && !selectedFabric}
          >
            Copy JSON
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        <div className="flex justify-between gap-2">
          <dt className="font-semibold text-neutral-600">Currency</dt>
          <dd className="text-neutral-800">{diagnostics.currency}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="font-semibold text-neutral-600">Pricing model</dt>
          <dd className="text-neutral-800">{diagnostics.model}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="font-semibold text-neutral-600">Pleat</dt>
          <dd className="text-neutral-800">{diagnostics.pleatId}</dd>
        </div>
      </dl>

      {showRidex && (
        <div className="mt-3 rounded border border-neutral-200 bg-white p-3 text-xs text-neutral-700">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <div className="text-neutral-500">Magento raw (requested)</div>
              <div className="font-mono text-[11px]">
                {diagnostics.requestedPriceKey}: {diagnostics.rawRequested ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-neutral-500">Magento raw (applied)</div>
              <div className="font-mono text-[11px]">
                {diagnostics.appliedPriceKey}: {diagnostics.rawApplied ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-neutral-500">Magento raw (wave fallback)</div>
              <div className="font-mono text-[11px]">price_wave: {diagnostics.rawWave ?? '—'}</div>
            </div>
            <div>
              <div className="text-neutral-500">priceKey</div>
              <div className="font-mono text-[11px]">
                requested={diagnostics.requestedPriceKey} applied={diagnostics.appliedPriceKey}
              </div>
            </div>
            <div>
              <div className="text-neutral-500">Applied pricePerMWidth</div>
              <div className="font-mono text-[11px]">
                {typeof diagnostics.pricePerMWidth === 'number'
                  ? `${formatNumber(diagnostics.pricePerMWidth, 2)} PLN / m`
                  : '—'}
              </div>
            </div>
            <div>
              <div className="text-neutral-500">Applied priceStr (from quote)</div>
              <div className="font-mono text-[11px]">{diagnostics.appliedPriceStr ?? '—'}</div>
            </div>
            <div>
              <div className="text-neutral-500">Total width</div>
              <div className="font-mono text-[11px]">
                {typeof diagnostics.totalLinearCm === 'number'
                  ? `${formatNumber(diagnostics.totalLinearCm, 1)} cm (${formatNumber(diagnostics.widthMetres, 3)} m)`
                  : '—'}
              </div>
            </div>
            <div>
              <div className="text-neutral-500">Multipliers</div>
              <div className="font-mono text-[11px]">
                {diagnostics.isRidex
                  ? '—'
                  : `fabric=${formatNumber(diagnostics.fabricMultiplier, 3)} labor=${formatNumber(diagnostics.laborMultiplier, 3)}`}
              </div>
            </div>
          </div>

          <div className="mt-2 rounded bg-neutral-50 p-2 font-mono text-[11px] text-neutral-700">
            Expected fabric (RIDEX): widthMetres × pricePerMWidth ={' '}
            {typeof diagnostics.expectedFabricMajor === 'number'
              ? `${formatNumber(diagnostics.expectedFabricMajor, 2)} PLN (${diagnostics.expectedFabricMinor} minor)`
              : '—'}
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <div className="text-neutral-500">Actual fabric line</div>
              <div className="font-mono text-[11px]">
                {typeof diagnostics.actualFabricMinor === 'number'
                  ? `${formatNumber(diagnostics.actualFabricMajor, 2)} PLN (${diagnostics.actualFabricMinor} minor)`
                  : '—'}
              </div>
            </div>
            <div>
              <div className="text-neutral-500">Quote totals</div>
              <div className="font-mono text-[11px]">
                subtotal={typeof diagnostics.subtotalMinor === 'number' ? diagnostics.subtotalMinor : '—'} services={
                  typeof diagnostics.servicesMinor === 'number' ? diagnostics.servicesMinor : '—'
                } total={typeof diagnostics.totalMinor === 'number' ? diagnostics.totalMinor : '—'}
              </div>
            </div>
          </div>

          {expanded && (
            <div className="mt-2">
              <details>
                <summary className="cursor-pointer text-neutral-500">Quote breakdown (JSON)</summary>
                <pre className="mt-1 max-h-56 overflow-y-auto whitespace-pre-wrap rounded border border-neutral-200 bg-neutral-50 p-2 text-[11px] leading-snug text-neutral-700">
                  {JSON.stringify(
                    {
                      quote: quote ?? null,
                      quoteProviderMetadata: quote?.providerMetadata ?? null,
                      segmentWidthsCm: diagnostics.segmentWidthsCm ?? null,
                      selectedFabricProviderMetadata: (selectedFabric?.providerMetadata as any) ?? null,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
