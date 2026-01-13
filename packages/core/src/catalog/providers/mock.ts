import { mockCatalog, type MockCatalog, type MockPricingRule } from '../mock/data';
import type { CatalogFilter, CurtainConfig,
  CurtainOption,
  Fabric,
  FabricType,
  HemOption,
  PleatOption,
  PriceBreakdownItem,
  PriceQuote,
  ServiceOption,
  StorefrontCartItem,
  StorefrontCartService,
} from '../types';
import type { CatalogProvider } from '../provider';
import { registerCatalogProvider } from '../provider';
import {
  DEFAULT_ALLOWANCES_CM,
  DEFAULT_FULLNESS_BY_PLEAT,
  DEFAULT_MIN_ORDER_INCREMENT_CM,
  DEFAULT_READY_HEIGHT_CM,
  DEFAULT_SHRINKAGE_PCT,
} from '../lib/domainDefaults';
import { computeFabricConstraints } from '../lib/constraints';

function pricePerMFromRule(rule?: MockPricingRule): number | undefined {
  if (!rule) return undefined;
  if (typeof rule.pricePerMLinearMinor === 'number') return rule.pricePerMLinearMinor;
  return undefined;
}

function derivePriceBandForFabric(rules: MockPricingRule[], fabricId: string): { min: number; max: number } | null {
  const perM = rules
    .filter((r) => r.fabricId === fabricId)
    .map((r) => pricePerMFromRule(r))
    .filter((v): v is number => typeof v === 'number');
  if (!perM.length) return null;
  const min = Math.min(...perM);
  const max = Math.max(...perM);
  return { min, max };
}

function applyPriceRange(fabrics: Fabric[], filter: CatalogFilter, rules: MockPricingRule[]): Fabric[] {
  if (!filter.priceRangeMinor) return fabrics;
  const { min, max } = filter.priceRangeMinor;
  return fabrics.filter((fabric) => {
    const band = derivePriceBandForFabric(rules, fabric.id);
    if (!band) return true;
    const { min: fMin, max: fMax } = band;
    return !(fMax < min || fMin > max);
  });
}

function matchPricingRule(rules: MockPricingRule[], config: CurtainConfig): MockPricingRule | undefined {
  // Filter rules that match required attributes exactly; then prefer most specific
  const candidates = rules.filter((rule) => {
    if (rule.fabricId !== config.fabricId) return false;
    if (rule.colorId != null && rule.colorId !== config.colorId) return false;
    if (rule.pleatId != null && rule.pleatId !== config.pleatId) return false;
    if (rule.hemId != null && rule.hemId !== config.hemId) return false;
    return true;
  });
  if (!candidates.length) return undefined;
  const score = (r: MockPricingRule) => (r.colorId ? 4 : 0) + (r.pleatId ? 2 : 0) + (r.hemId ? 1 : 0);
  candidates.sort((a, b) => score(b) - score(a));
  return candidates[0];
}

const roundUp = (valueCm: number, incrementCm: number): number => Math.ceil(valueCm / incrementCm) * incrementCm;

const roundUpToRepeat = (cutRaw: number, repeatCm: number, type: 'straight' | 'half-drop'): number => {
  const base = roundUp(cutRaw, repeatCm);
  return type === 'half-drop' ? base + repeatCm : base;
};

const toCents = (amount: number): number => Math.round(amount * 100);

const fullnessForPleat = (fabric: Fabric, pleatId: string): number => {
  const fromFabric = fabric.fullnessByPleat?.[pleatId];
  if (typeof fromFabric === 'number') return fromFabric;
  const fromDefaults = DEFAULT_FULLNESS_BY_PLEAT[pleatId];
  return typeof fromDefaults === 'number' ? fromDefaults : 2.0;
};

class MockCatalogProvider implements CatalogProvider {
  constructor(private readonly catalog: MockCatalog) {}

  private findFabric(fabricId: string): Fabric | undefined {
    return this.catalog.fabrics.find((f) => f.id === fabricId);
  }

  async getDefaultCurtain(): Promise<CurtainOption> {
    const { defaults, fabrics } = this.catalog;
    const defaultFabric = fabrics.find((f) => f.id === defaults.fabricId) ?? fabrics[0];
    return {
      fabricId: defaultFabric?.id ?? defaults.fabricId,
      pleatId: defaults.pleatId,
      hemId: defaults.hemId,
      widthCm: defaultFabric?.dimensions?.minWidthCm ?? 120,
      heightCm: DEFAULT_READY_HEIGHT_CM,
      segments: 2,
      services: [],
      textureUrl: defaultFabric?.thumbnails?.[0],
    };
  }

  async listFabricTypes(filter: CatalogFilter): Promise<FabricType[]> {
    const types = this.catalog.fabricTypes;
    if (!filter.priceRangeMinor) return types;
    return types.filter((type) => {
      const fabrics = this.catalog.fabrics.filter((fabric) => fabric.typeId === type.id);
      return applyPriceRange(fabrics, filter, this.catalog.pricing.rules).length > 0;
    });
  }

  async listFabrics(params: CatalogFilter & { fabricTypeId: string }): Promise<Fabric[]> {
    const fabrics = params.fabricTypeId && params.fabricTypeId !== 'all'
      ? this.catalog.fabrics.filter((fabric) => fabric.typeId === params.fabricTypeId)
      : this.catalog.fabrics;
    return applyPriceRange(fabrics, params, this.catalog.pricing.rules);
  }

  async listPleats(params: CatalogFilter & { fabricId: string }): Promise<PleatOption[]> {
    const fabric = this.catalog.fabrics.find((f) => f.id === params.fabricId);
    if (!fabric) return this.catalog.pleats;
    if (fabric.compatiblePleats?.length) {
      return this.catalog.pleats.filter((pleat) => fabric.compatiblePleats?.includes(pleat.id));
    }
    return this.catalog.pleats;
  }

  async listHems(params: CatalogFilter & { fabricId: string; pleatId: string }): Promise<HemOption[]> {
    const fabric = this.catalog.fabrics.find((f) => f.id === params.fabricId);
    if (!fabric) return this.catalog.hems;
    const allowed = fabric.availableHems?.length ? new Set(fabric.availableHems) : null;
    if (!allowed) return this.catalog.hems;
    return this.catalog.hems.filter((hem) => allowed.has(hem.id));
  }

  async listServices(_filter: CatalogFilter): Promise<ServiceOption[]> {
    return this.catalog.services.map(({ sku, ...service }) => service);
  }

  async priceQuote(config: CurtainConfig, options?: { fabricMultiplier?: number; laborMultiplier?: number }): Promise<PriceQuote> {
    const fabric = this.findFabric(config.fabricId);
    if (!fabric) {
      throw new Error(`Fabric ${config.fabricId} not found in catalog`);
    }

    const rule = matchPricingRule(this.catalog.pricing.rules, config);
    const currency = this.catalog.pricing.currency;

    const constraints = computeFabricConstraints(fabric);
    const allowances = fabric.allowancesCm ?? DEFAULT_ALLOWANCES_CM;
    const incrementCm = fabric.minOrderIncrementCm ?? DEFAULT_MIN_ORDER_INCREMENT_CM;
    const shrinkagePct = fabric.shrinkagePct ?? DEFAULT_SHRINKAGE_PCT;

    const panels = Math.max(config.segments, 1);
    const requestedWidth = Math.max(config.widthCm, 1);
    const requestedDrop = Math.max(config.heightCm, 1);

    const maxCurtainHeightCm = constraints.maxCurtainHeightCm;
    const maxPanelWidthCm = constraints.maxPanelWidthCm;

    // Support per-segment widths for asymmetric panels
    const usePerSegmentWidths = config.segmentWidthsCm && config.segmentWidthsCm.length === panels;
    const segmentWidths: number[] = usePerSegmentWidths
      ? config.segmentWidthsCm!.map(w => Math.max(1, w))
      : Array(panels).fill(requestedWidth / panels);

    // Apply constraints per segment
    const clampedSegmentWidths = segmentWidths.map(w => 
      maxPanelWidthCm != null ? Math.min(w, maxPanelWidthCm) : w
    );
    const finishedWidth = clampedSegmentWidths.reduce((sum, w) => sum + w, 0);

    // For backwards compat, report average panel width
    const widthPerPanelRequested = usePerSegmentWidths 
      ? segmentWidths.reduce((sum, w) => sum + w, 0) / panels
      : requestedWidth / panels;
    const widthPerPanel = clampedSegmentWidths.reduce((sum, w) => sum + w, 0) / panels;

    const finishedDrop = maxCurtainHeightCm != null
      ? Math.min(requestedDrop, maxCurtainHeightCm)
      : requestedDrop;

    const heightClamped = finishedDrop + 1e-6 < requestedDrop;
    const widthClamped = finishedWidth + 1e-6 < requestedWidth;

    // Updated hem calculation (Task 904):
    // - Top: fixed (default 5cm)
    // - Bottom: dynamic based on hemId selection (2cm or 10cm)
    const bottomAllowance = config.hemId === 'hem-10cm' ? 10 : 2;
    const cutDropRaw = finishedDrop + allowances.top + bottomAllowance;
    const repeatCm = Math.max(fabric.verticalRepeatCm ?? 0, 0);
    const repeatType = fabric.repeatType ?? 'straight';
    const cutDrop = repeatCm > 0 ? roundUpToRepeat(cutDropRaw, repeatCm, repeatType) : cutDropRaw;

    const fullness = fullnessForPleat(fabric, config.pleatId);
    
    // Side hem allowance: 2cm per segment side (left + right)
    const sideAllowanceCm = (allowances.side ?? 2) * 2;

    // New production model: always cut vertically (no railroad)
    // Fabrics are sewn/stitched together horizontally as needed
    // Calculate per-segment when asymmetric widths are provided
    // Task 904: Add side and stitch allowances to width calculation
    const stitchAllowanceCm = allowances.stitch ?? 2; // 2cm total per stitch line
    const widthsPerSegment = clampedSegmentWidths.map(segWidth => {
      const segWidthWithSides = segWidth + sideAllowanceCm;
      const requiredFlatWidth = segWidthWithSides * fullness;
      const widthsNeeded = Math.max(1, Math.ceil(requiredFlatWidth / fabric.fabricWidthCm));
      // Add stitch allowance: for each stitch line (widthsNeeded - 1), add stitchAllowanceCm
      const stitchLines = Math.max(0, widthsNeeded - 1);
      const stitchAllowanceTotal = stitchLines * stitchAllowanceCm;
      // Recalculate widths needed with stitch allowances
      const requiredFlatWithStitches = (segWidthWithSides + stitchAllowanceTotal) * fullness;
      return Math.max(1, Math.ceil(requiredFlatWithStitches / fabric.fabricWidthCm));
    });
    
    // Material Reuse Optimization (Task 902+)
    // Calculate actual bolt count by tracking cumulative material usage
    const effectiveFabricWidthCm = fabric.fabricWidthCm * (1 - shrinkagePct / 100);
    const finishedWidthPerBolt = effectiveFabricWidthCm / fullness;
    
    let numWidths = widthsPerSegment.reduce((sum, w) => sum + w, 0);
    let numWidthsOptimized: number | null = null;
    let stitchPositionsPerSegment: number[][] | null = null;
    
    if (config.materialReuseEnabled && usePerSegmentWidths) {
      // Calculate optimized bolt count based on total consumption
      const totalFinishedWidth = clampedSegmentWidths.reduce((sum, w) => sum + w, 0);
      numWidthsOptimized = Math.max(1, Math.ceil(totalFinishedWidth / finishedWidthPerBolt));
      
      // Calculate where stitches actually appear within each segment
      stitchPositionsPerSegment = [];
      let remainingInCurrentBolt = finishedWidthPerBolt;
      
      for (const segWidth of clampedSegmentWidths) {
        const stitches: number[] = [];
        let consumedInSegment = 0;
        
        while (consumedInSegment < segWidth) {
          const spaceInBolt = remainingInCurrentBolt;
          const neededFromThisSegment = segWidth - consumedInSegment;
          
          if (neededFromThisSegment > spaceInBolt) {
            // Bolt runs out within this segment - add stitch at that position
            stitches.push(consumedInSegment + spaceInBolt);
            consumedInSegment += spaceInBolt;
            remainingInCurrentBolt = finishedWidthPerBolt; // Start new bolt
          } else {
            // Segment finishes within current bolt
            remainingInCurrentBolt -= neededFromThisSegment;
            consumedInSegment = segWidth;
          }
        }
        
        stitchPositionsPerSegment.push(stitches);
      }
    }
    
    const widthsPerPanel = usePerSegmentWidths ? null : widthsPerSegment[0]; // For backwards compat
    const totalLinearCmRaw = widthsPerSegment.reduce((sum, widths, idx) => {
      return sum + (widths * cutDrop);
    }, 0);

    const totalLinearCm = roundUp(totalLinearCmRaw * (1 + shrinkagePct / 100), incrementCm);
    const linearMetres = totalLinearCm / 100;

    // Resolve price per metre strictly from pricing rules. Prefer the matched rule; fallback to a generic fabric rule.
    const resolvePricePerM = (): number => {
      const direct = pricePerMFromRule(rule);
      if (typeof direct === 'number') return direct;
      // Prefer a generic (no colorId) rule for this fabric
      const generic = this.catalog.pricing.rules.find((r) => r.fabricId === fabric.id && r.colorId == null);
      const pGeneric = pricePerMFromRule(generic);
      if (typeof pGeneric === 'number') return pGeneric;
      // Fallback: any rule for this fabric with a price
      const any = this.catalog.pricing.rules.find((r) => r.fabricId === fabric.id && pricePerMFromRule(r) != null);
      const pAny = pricePerMFromRule(any);
      return typeof pAny === 'number' ? pAny : 0;
    };
    const pricePerM = resolvePricePerM();
    const fabricMultiplier = options?.fabricMultiplier ?? 1.0;
    const fabricCostMinor = Math.round(toCents(linearMetres * pricePerM) * fabricMultiplier);

    const laborPerWidth = rule?.laborPerWidthMinorByPleat?.[config.pleatId] ?? this.catalog.labor.perWidthByPleat[config.pleatId] ?? this.catalog.labor.perWidthByPleat.tab ?? 7.00;
    const laborMultiplier = options?.laborMultiplier ?? 1.0;
    const laborMinor = Math.round(toCents(laborPerWidth * numWidths) * laborMultiplier);

    const pleatSurchargeMinor = toCents((rule?.pleatSurchargePerSegmentMinor ?? 0) * panels);
    const hemSurchargeMinor = toCents(rule?.hemSurchargeMinor ?? 0);
    const fabricSurchargeMinor = toCents(rule?.fabricSurchargeMinor ?? 0);

    const selectedServices = this.catalog.services.filter((svc) => config.services.includes(svc.id));
    const serviceItems: PriceBreakdownItem[] = selectedServices.map((svc) => ({
      id: `svc-${svc.id}`,
      label: svc.label,
      amountMinor: svc.priceMinor ?? 0, // Already in minor units
      currency: svc.currency ?? currency,
      type: 'service',
    }));
    const servicesMinor = serviceItems.reduce((sum, item) => sum + item.amountMinor, 0);

    const subtotalMinor = fabricCostMinor + laborMinor + pleatSurchargeMinor + hemSurchargeMinor + fabricSurchargeMinor;
    const totalMinor = subtotalMinor + servicesMinor;

    const breakdown: PriceBreakdownItem[] = [
      {
        id: 'fabric',
        label: 'Fabric',
        amountMinor: fabricCostMinor,
        currency,
        type: 'base',
        providerMetadata: {
          totalLinearCm,
          linearMetres,
          cutDropCm: cutDrop,
          allowancesCm: {
            top: allowances.top,
            bottom: bottomAllowance,
            side: allowances.side ?? 2,
            stitch: allowances.stitch ?? 2,
          },
          shrinkagePct,
          widthsPerPanel: widthsPerPanel ?? Math.round((numWidthsOptimized ?? numWidths) / panels * 10) / 10, // Average for display
          widthsPerSegment: usePerSegmentWidths ? widthsPerSegment : undefined,
          stitchPositionsPerSegment,
          repeatCm,
          repeatType,
          colorId: config.colorId,
          pricing: {
            ruleId: rule?.id ?? null,
            effectivePricePerMMinor: pricePerM,
          },
        },
      },
      {
        id: 'labor',
        label: `Labor (${numWidths} width${numWidths !== 1 ? 's' : ''})`,
        amountMinor: laborMinor,
        currency,
        type: 'base',
        providerMetadata: {
          laborPerWidth,
          pleatId: config.pleatId,
          numWidths,
        },
      },
    ];

    if (pleatSurchargeMinor) {
      breakdown.push({
        id: 'pleat-surcharge',
        label: 'Pleat surcharge',
        amountMinor: pleatSurchargeMinor,
        currency,
        type: 'surcharge',
      });
    }
    if (hemSurchargeMinor) {
      breakdown.push({
        id: 'hem-surcharge',
        label: 'Hem surcharge',
        amountMinor: hemSurchargeMinor,
        currency,
        type: 'surcharge',
      });
    }
    if (fabricSurchargeMinor) {
      breakdown.push({
        id: 'fabric-surcharge',
        label: 'Fabric surcharge',
        amountMinor: fabricSurchargeMinor,
        currency,
        type: 'surcharge',
      });
    }

    breakdown.push(...serviceItems);
    breakdown.push({
      id: 'total',
      label: 'Total',
      amountMinor: totalMinor,
      currency,
      type: 'total',
    });

    return {
      currency,
      subtotalMinor,
      servicesMinor,
      totalMinor,
      breakdown,
      providerMetadata: {
        numWidths: numWidthsOptimized ?? numWidths,
        numWidthsUnoptimized: numWidthsOptimized != null ? numWidths : undefined,
        widthsPerPanel: widthsPerPanel ?? Math.round(numWidths / panels * 10) / 10, // Average for display
        widthsPerSegment: usePerSegmentWidths ? widthsPerSegment : undefined,
        segmentWidthsCm: usePerSegmentWidths ? clampedSegmentWidths : undefined,
        materialReuseEnabled: config.materialReuseEnabled ?? false,
        stitchPositionsPerSegment,
        finishedWidthPerBolt: config.materialReuseEnabled ? finishedWidthPerBolt : undefined,
        fullness,
        totalLinearCm,
        maxCurtainHeightCm: constraints.maxCurtainHeightCm,
        maxPanelWidthCm: constraints.maxPanelWidthCm,
        requestedWidthCm: requestedWidth,
        requestedHeightCm: requestedDrop,
        requestedPanelWidthCm: widthPerPanelRequested,
        appliedPanelWidthCm: widthPerPanel,
        appliedWidthCm: finishedWidth,
        appliedHeightCm: finishedDrop,
        constraintsHit: {
          width: widthClamped,
          height: heightClamped,
        },
      },
    };
  }

  async toCartPayload(config: CurtainConfig): Promise<StorefrontCartItem> {
    const quote = await this.priceQuote(config);
    const fabric = this.findFabric(config.fabricId);
    if (!fabric) {
      throw new Error(`Unknown fabric ${config.fabricId}`);
    }

    const services: StorefrontCartService[] = this.catalog.services
      .filter((svc) => config.services.includes(svc.id))
      .map((svc) => ({
        sku: svc.sku,
        quantity: 1,
      }));

    const numWidths = quote.providerMetadata?.numWidths;
    const totalLinearCm = quote.providerMetadata?.totalLinearCm;
    const fullness = quote.providerMetadata?.fullness;
    const constraints = computeFabricConstraints(fabric);
    const maxCurtainHeightCm = constraints.maxCurtainHeightCm;
    const maxPanelWidthCm = constraints.maxPanelWidthCm;

    const panels = Math.max(config.segments, 1);
    const requestedWidth = Math.max(config.widthCm, 1);
    const requestedHeight = Math.max(config.heightCm, 1);

    const requestedPanelWidth = requestedWidth / panels;
    const appliedPanelWidth = maxPanelWidthCm != null
      ? Math.min(requestedWidth / panels, maxPanelWidthCm)
      : requestedPanelWidth;
    const appliedWidth = appliedPanelWidth * panels;

    const appliedHeight = maxCurtainHeightCm != null
      ? Math.min(requestedHeight, maxCurtainHeightCm)
      : requestedHeight;

    // Determine child SKU from color selection (Task 957)
    const childSku = config.colorId && fabric.colorSkuByColor?.[config.colorId]
      ? fabric.colorSkuByColor[config.colorId]
      : undefined;

    // Calculate fabric quantity in Magento format: 1cm = 0.01qty (Task 958)
    const fabricQuantity = typeof totalLinearCm === 'number' 
      ? Number((totalLinearCm * 0.01).toFixed(2))
      : Math.max(config.segments, 1);

    return {
      sku: fabric.sku,
      childSku,
      quantity: fabricQuantity,
      options: {
        pleatId: config.pleatId,
        hemId: config.hemId,
        colorId: config.colorId,
        widthCm: config.widthCm,
        heightCm: config.heightCm,
        quoteMinor: quote.totalMinor,
        currency: quote.currency,
        totalLinearCm,
        numWidths,
        fullness,
        maxCurtainHeightCm,
        maxPanelWidthCm,
        requestedWidthCm: requestedWidth,
        requestedHeightCm: requestedHeight,
        requestedPanelWidthCm: requestedPanelWidth,
        appliedWidthCm: appliedWidth,
        appliedHeightCm: appliedHeight,
        appliedPanelWidthCm: appliedPanelWidth,
        constraintsHit: {
          width: appliedWidth + 1e-6 < requestedWidth,
          height: appliedHeight + 1e-6 < requestedHeight,
        },
      },
      services: services.length ? services : undefined,
    };
  }
}

registerCatalogProvider('mock', () => new MockCatalogProvider(mockCatalog));
