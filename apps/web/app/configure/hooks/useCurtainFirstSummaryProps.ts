"use client";

import { useMemo } from 'react';
import type { PriceQuote, ServiceOption } from '@curtain-wizard/core/src/catalog';
import type { ChildItem, Fabric } from '@curtain-wizard/core/src/catalog/types';
import type { SummaryConfig, SummaryFieldKey } from '@curtain-wizard/core/src/catalog/lib/summaryConfig';
import type { AddToCartState, TranslateFn } from '../types';
import type { CurtainSummaryShellProps } from '@/features/configurator/components/CurtainSummaryShell';
import type { CollapsibleSummaryProps } from '../components/CollapsibleSummary';

type UseCurtainFirstSummaryPropsArgs = {
  isReady: boolean;
  t: TranslateFn;
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

  debugUiEnabled: boolean;
};

export function useCurtainFirstSummaryProps({
  isReady,
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
  debugUiEnabled,
}: UseCurtainFirstSummaryPropsArgs): {
  totalPriceMinor: number | undefined;
  summaryProps: CurtainSummaryShellProps;
  collapsibleSummaryProps: CollapsibleSummaryProps;
} {
  const totalPriceMinor = useMemo(() => {
    if (!quote?.breakdown) return undefined;
    const totalItem = quote.breakdown.find((item) => item.type === 'total');
    return totalItem?.amountMinor;
  }, [quote]);

  const summaryProps = useMemo<CurtainSummaryShellProps>(() => ({
    isReady,
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
    debugUiEnabled,
    totalPriceMinor,
  }), [
    isReady,
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
    debugUiEnabled,
    totalPriceMinor,
  ]);

  const collapsibleSummaryProps = useMemo<CollapsibleSummaryProps>(() => ({
    isReady,
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
  }), [
    isReady,
    t,
    formatNumber,
    formatCurrency,
    summaryConfig,
    isFieldEnabled,
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
    providerId,
    locale,
    addToCartState,
    handleResetAddToCart,
    storefrontCartUrl,
    handleAddToCart,
    addToCartDisabled,
    totalPriceMinor,
    debugUiEnabled,
  ]);

  return { totalPriceMinor, summaryProps, collapsibleSummaryProps };
}
