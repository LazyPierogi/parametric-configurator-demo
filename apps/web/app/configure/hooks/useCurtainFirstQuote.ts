"use client";

import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import type { CatalogProvider, CurtainConfig, PriceQuote } from '@curtain-wizard/core/src/catalog';
import type { AddToCartState } from '../types';

type SegmentLayout = { offsetPercent: number; widthPercent: number };

type UseCurtainFirstQuoteArgs = {
  provider: CatalogProvider;

  selectedFabricId: string | null;
  selectedPleatId: string | null;
  selectedHemId: string | null;
  selectedServices: string[];
  selectedColor: string | null;
  selectedChildItem: unknown | null;

  dims: { wCm: number; hCm: number };
  coverageRatio: number;
  segmentCount: number;
  segments: SegmentLayout[];

  corners: { x: number; y: number }[] | null;

  materialReuseEnabled: boolean;

  setAddToCartState: Dispatch<SetStateAction<AddToCartState>>;
};

export function useCurtainFirstQuote({
  provider,
  selectedFabricId,
  selectedPleatId,
  selectedHemId,
  selectedServices,
  selectedColor,
  selectedChildItem,
  dims,
  coverageRatio,
  segmentCount,
  segments,
  corners,
  materialReuseEnabled,
  setAddToCartState,
}: UseCurtainFirstQuoteArgs): {
  quote: PriceQuote | null;
  lastConfig: CurtainConfig | null;
} {
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [lastConfig, setLastConfig] = useState<CurtainConfig | null>(null);
  const [lastConfigSignature, setLastConfigSignature] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!selectedFabricId || !selectedPleatId || !selectedHemId) {
      setQuote(null);
      return undefined;
    }

    if (!corners || corners.length < 3) {
      setQuote(null);
      return undefined;
    }

    const effectiveWidth = Math.max(1, dims.wCm * Math.max(coverageRatio, 0.05));

    const segmentWidthsCm = segments.map((seg) => {
      const widthCm = (seg.widthPercent / 100) * dims.wCm;
      return Math.max(1, widthCm);
    });

    const config: CurtainConfig = {
      fabricId: selectedFabricId,
      pleatId: selectedPleatId,
      hemId: selectedHemId,
      colorId: selectedColor ?? undefined,
      widthCm: effectiveWidth,
      heightCm: Math.max(1, dims.hCm),
      segments: Math.max(1, segmentCount),
      segmentWidthsCm,
      materialReuseEnabled,
      services: selectedServices,
      extras: selectedColor ? { color: selectedColor, selectedChildItem: selectedChildItem } : undefined,
    };

    const nextConfig: CurtainConfig = {
      ...config,
      services: [...config.services],
    };

    const nextSignature = JSON.stringify(nextConfig);

    if (lastConfigSignature !== nextSignature) {
      setLastConfig(nextConfig);
      setLastConfigSignature(nextSignature);
      setAddToCartState((prev) => (prev.status === 'loading' ? prev : { status: 'idle' }));
    }

    const fetchQuote = async () => {
      try {
        const pricingModel = String(process.env.NEXT_PUBLIC_PRICING_MODEL ?? 'internal').toLowerCase();

        const newQuote = pricingModel === 'ridex'
          ? await provider.priceQuote(config)
          : await (async () => {
              const fabricMultiplier = process.env.NEXT_PUBLIC_PRICE_FABRIC_MULTIPLIER
                ? Number(process.env.NEXT_PUBLIC_PRICE_FABRIC_MULTIPLIER)
                : 1.0;
              const laborMultiplier = process.env.NEXT_PUBLIC_PRICE_LABOR_MULTIPLIER
                ? Number(process.env.NEXT_PUBLIC_PRICE_LABOR_MULTIPLIER)
                : 1.0;
              return provider.priceQuote(config, { fabricMultiplier, laborMultiplier });
            })();

        if (!cancelled) setQuote(newQuote);
      } catch (error) {
        if (!cancelled) {
          console.error('[configure] priceQuote failed', error);
          setQuote(null);
        }
      }
    };

    void fetchQuote();

    return () => {
      cancelled = true;
    };
  }, [
    provider,
    selectedFabricId,
    selectedPleatId,
    selectedHemId,
    selectedServices,
    selectedColor,
    dims.wCm,
    dims.hCm,
    segmentCount,
    segments,
    coverageRatio,
    corners,
  ]);

  return { quote, lastConfig };
}
