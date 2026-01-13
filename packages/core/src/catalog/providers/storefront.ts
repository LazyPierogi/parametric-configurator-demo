import type {
  CatalogFilter,
  CurtainConfig,
  CurtainOption,
  Fabric,
  FabricType,
  HemOption,
  PleatOption,
  PriceQuote,
  PriceBreakdownItem,
  ServiceOption,
  StorefrontCartItem, ChildItem,
} from '../types';
import type { CatalogProvider } from '../provider';
import { registerCatalogProvider } from '../provider';
import type { StorefrontProductList } from '../storefront/types';
import {
  mapStorefrontProductToFabric,
  extractFabricTypes,
  extractPleatOptions,
  extractHemOptions,
  extractServices,
} from '../storefront/mappers';
import { getSelectedFabric } from '@curtain-wizard/core/src/catalog/state/fabricStore';
import {
  DEFAULT_ALLOWANCES_CM,
  DEFAULT_FULLNESS_BY_PLEAT,
  DEFAULT_MIN_ORDER_INCREMENT_CM,
  DEFAULT_SHRINKAGE_PCT,
} from '../lib/domainDefaults';
import { computeFabricConstraints } from '../lib/constraints';
// TODO: will be refactored to product attributes later
import { mockCatalog } from '../mock/data';

/**
 * Helper functions for pricing calculations (matching mock provider logic)
 */
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

const pricingModelFromEnv = (): 'internal' | 'ridex' => {
  const raw = (process.env.NEXT_PUBLIC_PRICING_MODEL ?? 'internal').toLowerCase();
  return raw === 'ridex' ? 'ridex' : 'internal';
};

const parseStringList = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    const out = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    return out.length ? out : undefined;
  }
  if (typeof value === 'string') {
    const out = value
      .split(/[\s,|]+/)
      .map((v) => v.trim())
      .filter(Boolean);
    return out.length ? out : undefined;
  }
  return undefined;
};

/**
 * Production storefront catalog provider that queries Magento GraphQL directly
 *
 * This provider fetches product data from the Magento GraphQL API directly.
 * It only works in browser context.
 *
 * @see packages/core/src/catalog/storefront/types.ts for data formats
 * @see apps/web/lib/magento-client.ts for GraphQL communication
 */
class StorefrontCatalogProvider implements CatalogProvider {
  private productListCache: StorefrontProductList | null = null;
  private productListInFlight: Promise<StorefrontProductList> | null = null;
  private magentoClient: any | null = null;

  constructor() {
    // Lazy-load the Magento client if in browser context
    if (typeof window !== 'undefined') {
      // Dynamically import the client to avoid server-side issues
      try {
        // The client will be lazy-loaded when first needed
        this.magentoClient = null;
      } catch {
        // Client not available, will handle in ensureBrowserContext
      }
    }
  }

  private async getMagentoClient(): Promise<any> {
    if (this.magentoClient) {
      return this.magentoClient;
    }

    if (typeof window === 'undefined') {
      throw new Error('Magento client only available in browser context');
    }

    try {
      // Dynamically import to avoid loading on server
      const { magentoClient } = await import('@curtain-wizard/web/lib/magento-client');
      this.magentoClient = magentoClient;
      return this.magentoClient;
    } catch (error) {
      throw new Error(
        'Failed to load Magento GraphQL client. Ensure NEXT_PUBLIC_MAGENTO_GRAPHQL_URL is configured.'
      );
    }
  }

  private ensureBrowserContext(): void {
    if (typeof window === 'undefined') {
      throw new Error(
        'Storefront catalog provider can only be used in browser context. ' +
          'Use CATALOG_PROVIDER=mock for server-side operations.'
      );
    }
    // Magento GraphQL URL is provided by the client library default. If you need to
    // override it, pass an explicit URL to the magento client or configure your
    // environment during build/SSR. At runtime we avoid reading `process.env`.
  }

  /**
   * Fetch product list from Magento (cached after first call)
   */
  private async getProductList(filter?: CatalogFilter): Promise<StorefrontProductList> {
    this.ensureBrowserContext();

    // Debug flag intentionally disabled for production bundle
    const isDebug = false;

    // Return cached list if available
    if (this.productListCache) {
      if (isDebug) {
        console.log('[StorefrontProvider] Using cached product list:', {
          productCount: this.productListCache.products.length,
          cached: true
        });
      }
      return this.productListCache;
    }

    // If a request is already in flight, await it to prevent multiple API calls
    if (this.productListInFlight) {
      if (isDebug) {
        console.log('[StorefrontProvider] Awaiting in-flight product list request');
      }
      return this.productListInFlight;
    }

    if (isDebug) {
      console.log('[StorefrontProvider] Fetching product list from Magento:', {
        filter,
        cached: false
      });
    }

    // Start single in-flight request and let all concurrent callers await it
    this.productListInFlight = (async () => {
      try {
        const client = await this.getMagentoClient();
        const magentoProducts = await client.getProductList();

        if (!Array.isArray(magentoProducts)) {
          throw new Error('Expected products array from Magento API');
        }

        if (isDebug) {
          console.log('[StorefrontProvider] Product list fetched from Magento:', {
            productCount: magentoProducts.length,
          });
        }

        // Transform Magento products to StorefrontProductList format
        const productList: StorefrontProductList = {
          products: magentoProducts.map((p) => ({
            sku: p.sku,
            name: p.name,
            thumbnails: p.attributes?.childItems?.[0]?.thumbnail ? [p.attributes.childItems[0].thumbnail] : [],
            price: p.priceMinor,
            pricePerMLinearMinor: p.priceMinor,
            attributes: {
              fabricTypeId: p.attributes?.typeId || 'default',
              fabricStyleId: p.attributes?.style || 'default',
              materialFamily: p.attributes?.materialFamily,
              pattern: p.attributes?.pattern,
              short_description: p.attributes?.short_description,
              colors: p.attributes?.colors,
              childItems: p.attributes?.childItems || [],
              fabricWidthCm: p.attributes?.fabricWidthCm,
              verticalRepeatCm: p.attributes?.verticalRepeatCm,
              repeatType: (p.attributes?.repeatType as any) ?? undefined,
              minOrderIncrementCm: p.attributes?.minOrderIncrementCm,
              allowancesTopCm: p.attributes?.allowanceCmTop,
              allowancesBottomCm: p.attributes?.allowanceCmBottom,
              shrinkagePct: p.attributes?.shrinkagePct,
              fullnessByPleat: {
                ...(typeof p.attributes?.fullnessByPleatWave === 'number' ? { wave: p.attributes.fullnessByPleatWave } : {}),
                ...(typeof p.attributes?.fullnessByPleatTape === 'number' ? { tab: p.attributes.fullnessByPleatTape } : {}),
              },
              compatiblePleats: parseStringList(p.attributes?.compatiblePleats),
              availableHems: parseStringList(p.attributes?.availableHems),
              pleatSurchargePerSegmentMinor: p.attributes?.pleatSurchargePerSegmentMinor || 0,
              hemSurchargeMinor: p.attributes?.hemSurchargeMinor || 0,

              price_flex: p.attributes?.price_flex,
              price_double_flex: p.attributes?.price_double_flex,
              price_wave: p.attributes?.price_wave,
            }
          })),
          categories: [],
          metadata: {
            locale: 'en',
            currency: 'PLN',
            totalCount: magentoProducts.length,
          },
        };

        this.productListCache = productList;
        return productList;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isDebug) {
          console.error('[StorefrontProvider] Failed to fetch products from Magento:', message);
        }
        throw new Error(`Failed to fetch product list from Magento: ${message}`);
      } finally {
        this.productListInFlight = null;
      }
    })();

    return this.productListInFlight;
  }

  async getDefaultCurtain(): Promise<CurtainOption> {
    const productList = await this.getProductList();
    // productList.products = productList.products.filter((p) => !((p.sku ?? '').includes('SERVICE')));
    // FIXME - need to filter this in one place, after hydrating services array but before passing
    // to extractFabricTypes and possibly other places.

    if (!productList.products || productList.products.length === 0) {
      throw new Error('No products available from storefront');
    }

    // Use first product as default
    const defaultProduct = productList.products.find(p => !(p.sku || '').includes('SERVICE')) || productList.products[0];
    const types = extractFabricTypes(productList);
    const fabricTypeId = types[0]?.id ?? 'default';
    const fabric = mapStorefrontProductToFabric(defaultProduct, fabricTypeId);

    return {
      fabricId: fabric.id,
      pleatId: fabric.compatiblePleats?.[0] ?? 'wave',
      hemId: fabric.availableHems?.[0] ?? 'hem-1cm',
      widthCm: 120,
      heightCm: 250,
      segments: 2,
      services: [],
      textureUrl: fabric.childItems?.[0]?.thumbnail ?? fabric.thumbnails?.[0],
      providerMetadata: {selectedChildItem: fabric.childItems?.[0] ?? null}
    };
  }

  async listFabricTypes(filter: CatalogFilter): Promise<FabricType[]> {
    const productList = await this.getProductList(filter);
    return extractFabricTypes(productList);
  }

  async listFabrics(params: CatalogFilter & { fabricTypeId: string }): Promise<Fabric[]> {
    const productList = await this.getProductList(params);
    // TODO we have three calls to getProductList, we need only one

    // Filter products by type
    const products = productList.products
      .filter((p) => {
        const requested = params.fabricTypeId;
        if (requested === 'all' || requested === 'default') return true;
        const resolvedTypeId = p.attributes?.fabricTypeId ?? p.typeId ?? 'default';
        return resolvedTypeId === requested;
      })
      .filter((f) => !((f.sku ?? '').includes('SERVICE')));

    return products.map((product) =>
      mapStorefrontProductToFabric(product, params.fabricTypeId)
    );
  }

  async listPleats(params: CatalogFilter & { fabricId: string }): Promise<PleatOption[]> {
    // TODO: will be refactored to product attributes later
    return mockCatalog.pleats;
  }

  async listHems(params: CatalogFilter & { fabricId: string; pleatId: string }): Promise<HemOption[]> {
    // TODO: will be refactored to product attributes later
    return mockCatalog.hems;
  }

  async listServices(filter: CatalogFilter): Promise<ServiceOption[]> {
    const productList = await this.getProductList(filter);
    return extractServices(productList);
  }

  async priceQuote(config: CurtainConfig, options?: { fabricMultiplier?: number; laborMultiplier?: number }): Promise<PriceQuote> {
    this.ensureBrowserContext();

    // Use selectedFabric from fabricStore (drop-in replacement for catalog lookup)
    const selectedFabric = getSelectedFabric();
    if (!selectedFabric) {
      throw new Error('No fabric selected');
    }

    const fabric = selectedFabric;
    const selectedChildItem = config?.extras?.selectedChildItem as any;
    
    // TODO: possibly need to take this from magento store settings
    const currency = selectedFabric?.priceBandMinor?.currency ?? 'PLN';

    if (pricingModelFromEnv() === 'ridex') {
      const roundSegmentWidthsToCm = (raw: number[], totalRoundedCm: number): number[] => {
        const rounded = raw.map((w) => Math.max(1, Math.round(w)));
        const sum = rounded.reduce((a, b) => a + b, 0);
        const diff = totalRoundedCm - sum;
        if (diff === 0) return rounded;
        const out = [...rounded];
        const last = out.length - 1;
        out[last] = Math.max(1, out[last] + diff);
        return out;
      };

      const widthCm = Math.max(1, config.widthCm);
      const heightCm = Math.max(1, config.heightCm);
      const panels = Math.max(1, config.segments);

      const usePerSegmentWidths = Array.isArray(config.segmentWidthsCm) && config.segmentWidthsCm.length === panels;
      const segmentWidths = usePerSegmentWidths ? config.segmentWidthsCm! : Array(panels).fill(widthCm / panels);

      const totalWidthCmRaw = segmentWidths.reduce((sum, w) => sum + Math.max(0, w), 0);
      const totalWidthCm = Math.max(1, Math.round(totalWidthCmRaw));
      const widthMetres = totalWidthCm / 100;

      const segmentWidthsRounded = usePerSegmentWidths
        ? roundSegmentWidthsToCm(segmentWidths, totalWidthCm)
        : undefined;

      const ridex = (fabric.providerMetadata as any)?.ridex as
        | { price_flex?: string | null; price_double_flex?: string | null; price_wave?: string | null }
        | undefined;

      const pleatIdRaw = typeof config.pleatId === 'string' ? config.pleatId : 'wave';
      const pleatKey = pleatIdRaw.toLowerCase();
      const requestedPriceKey = pleatKey === 'doubleflex' || pleatKey === 'double_flex' || pleatKey === 'double-flex'
        ? 'price_double_flex'
        : pleatKey === 'flex'
        ? 'price_flex'
        : 'price_wave';

      const candidateRequested = (ridex as any)?.[requestedPriceKey];
      const candidateWave = ridex?.price_wave;
      const appliedPriceKey =
        typeof candidateRequested === 'string' && candidateRequested.trim().length > 0
          ? requestedPriceKey
          : 'price_wave';

      const candidate = appliedPriceKey === requestedPriceKey ? candidateRequested : candidateWave;
      const priceStr = typeof candidate === 'string' ? candidate : null;
      if (!priceStr) {
        throw new Error(
          `RIDEX pricing missing '${requestedPriceKey}' (and no wave fallback) for fabric '${fabric.id}'.`
        );
      }
      const parsed = Number(String(priceStr).replace(',', '.').trim());
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(
          `RIDEX pricing invalid '${appliedPriceKey}' value '${priceStr}' for fabric '${fabric.id}'.`
        );
      }

      // RIDEX model is authoritative and should not inherit legacy mock multipliers.
      // Price is defined as PLN per 1m curtain width (major units).
      const fabricCostMinor = Math.round(toCents(widthMetres * parsed));

      const allServices = await this.listServices({});
      const selectedServices = allServices.filter((svc) => config.services.includes(svc.id));
      const serviceItems: PriceBreakdownItem[] = selectedServices.map((svc) => ({
        id: `svc-${svc.id}`,
        label: svc.label,
        amountMinor: svc.priceMinor ?? 0,
        currency: svc.currency ?? currency,
        type: 'service',
      }));
      const servicesMinor = serviceItems.reduce((sum, item) => sum + item.amountMinor, 0);

      const subtotalMinor = fabricCostMinor;
      const totalMinor = subtotalMinor + servicesMinor;

      const breakdown: PriceBreakdownItem[] = [
        {
          id: 'fabric',
          label: 'Fabric',
          amountMinor: fabricCostMinor,
          currency,
          type: 'base',
          providerMetadata: {
            pricing: {
              model: 'ridex',
              requestedPriceKey,
              appliedPriceKey,
              pricePerMWidth: parsed,
              priceStr,
            },
          },
        },
        ...serviceItems,
        {
          id: 'total',
          label: 'Total',
          amountMinor: totalMinor,
          currency,
          type: 'total',
        },
      ];

      return {
        currency,
        subtotalMinor,
        servicesMinor,
        totalMinor,
        breakdown,
        providerMetadata: {
          totalLinearCm: totalWidthCm,
          linearMetres: widthMetres,
          segmentWidthsCm: segmentWidthsRounded,
          appliedWidthCm: totalWidthCm,
          appliedHeightCm: heightCm,
          fabric: {
            id: fabric.id,
            name: fabric.name,
          },
          pricing: {
            model: 'ridex',
            requestedPriceKey,
            appliedPriceKey,
            pricePerMWidth: parsed,
            priceStr,
          },
        },
      };
    }

    // Sanitize inputs
    const widthCm = Math.max(1, config.widthCm);
    const heightCm = Math.max(1, config.heightCm);
    const panels = Math.max(1, config.segments);

    // Resolve fullness
    const fullness = fullnessForPleat(fabric, config.pleatId);

    // Compute constraints (returns null for both maxes with new production model)
    const constraints = computeFabricConstraints(fabric);

    // Handle asymmetric segment widths
    const usePerSegmentWidths = Array.isArray(config.segmentWidthsCm) && config.segmentWidthsCm.length === panels;
    const segmentWidths = usePerSegmentWidths ? config.segmentWidthsCm! : Array(panels).fill(widthCm / panels);
    const clampedSegmentWidths = segmentWidths.map(w => 
      constraints?.maxPanelWidthCm ? Math.min(w, constraints.maxPanelWidthCm) : w
    );

    // Determine allowances
    const allowances = fabric.allowancesCm ?? DEFAULT_ALLOWANCES_CM;
    const topAllowance = allowances.top ?? DEFAULT_ALLOWANCES_CM.top;
    
    // Dynamic bottom allowance based on hem selection
    const bottomAllowance = config.hemId === 'hem-2cm' ? 2 
      : config.hemId === 'hem-10cm' ? 10 
      : (allowances.bottom ?? DEFAULT_ALLOWANCES_CM.bottom);

    // Compute cut drop
    const shrinkagePct = fabric.shrinkagePct ?? DEFAULT_SHRINKAGE_PCT;
    const incrementCm = fabric.minOrderIncrementCm ?? DEFAULT_MIN_ORDER_INCREMENT_CM;
    const repeatCm = fabric.verticalRepeatCm ?? 0;
    const repeatType = fabric.repeatType ?? 'straight';

    const finishedDrop = constraints?.maxCurtainHeightCm 
      ? Math.min(heightCm, constraints.maxCurtainHeightCm) 
      : heightCm;
    const cutRaw = finishedDrop + topAllowance + bottomAllowance;
    const cutDrop = repeatCm > 0 ? roundUpToRepeat(cutRaw, repeatCm, repeatType) : cutRaw;

    // Calculate widths per segment with side and stitch allowances
    const sideAllowanceCm = (allowances.side ?? 2) * 2;
    const stitchAllowanceCm = allowances.stitch ?? 2;
    
    const widthsPerSegment = clampedSegmentWidths.map(segWidth => {
      const segWidthWithSides = segWidth + sideAllowanceCm;
      const requiredFlatWidth = segWidthWithSides * fullness;
      const widthsNeeded = Math.max(1, Math.ceil(requiredFlatWidth / fabric.fabricWidthCm));
      const stitchLines = Math.max(0, widthsNeeded - 1);
      const stitchAllowanceTotal = stitchLines * stitchAllowanceCm;
      const requiredFlatWithStitches = (segWidthWithSides + stitchAllowanceTotal) * fullness;
      return Math.max(1, Math.ceil(requiredFlatWithStitches / fabric.fabricWidthCm));
    });

    const numWidths = widthsPerSegment.reduce((sum, w) => sum + w, 0);
    const widthsPerPanel = usePerSegmentWidths ? null : widthsPerSegment[0];
    
    const totalLinearCmRaw = widthsPerSegment.reduce((sum, widths) => sum + (widths * cutDrop), 0);
    const totalLinearCm = roundUp(totalLinearCmRaw * (1 + shrinkagePct / 100), incrementCm);
    const linearMetres = totalLinearCm / 100;

    // Pricing from childItem or fabric (in major units, convert to minor units)
    const pricePerMLinear = selectedChildItem?.pricePerMLinearMinor ?? fabric.pricePerMLinearMinor ?? 0;
    const fabricMultiplier = options?.fabricMultiplier ?? 1.0;
    const fabricCostMinor = Math.round(toCents(linearMetres * pricePerMLinear) * fabricMultiplier);

    // Labor from mockCatalog (TODO: will be refactored to product attributes later)
    const laborPerWidth = mockCatalog.labor.perWidthByPleat[config.pleatId] ?? mockCatalog.labor.perWidthByPleat.tab ?? 7.00;
    const laborMultiplier = options?.laborMultiplier ?? 1.0;
    const laborMinor = Math.round(toCents(laborPerWidth * numWidths) * laborMultiplier);

    // Surcharges (default to 0 if not present, convert to minor units)
    const pleatSurchargeMinor = toCents((selectedFabric?.pleatSurchargePerSegmentMinor ?? 0) * panels);
    const hemSurchargeMinor = toCents(selectedFabric?.hemSurchargeMinor ?? 0);

    // Services
    const allServices = await this.listServices({});
    const selectedServices = allServices.filter(svc => config.services.includes(svc.id));
    const serviceItems: PriceBreakdownItem[] = selectedServices.map(svc => ({
      id: `svc-${svc.id}`,
      label: svc.label,
      amountMinor: svc.priceMinor ?? 0,
      currency: svc.currency ?? currency,
      type: 'service',
    }));
    const servicesMinor = serviceItems.reduce((sum, item) => sum + item.amountMinor, 0);

    const subtotalMinor = fabricCostMinor + laborMinor + pleatSurchargeMinor + hemSurchargeMinor;
    const totalMinor = subtotalMinor + servicesMinor;

    // Build breakdown
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
            top: topAllowance,
            bottom: bottomAllowance,
            side: allowances.side ?? 2,
            stitch: allowances.stitch ?? 2,
          },
          shrinkagePct,
          widthsPerPanel: widthsPerPanel ?? Math.round(numWidths / panels * 10) / 10,
          widthsPerSegment: usePerSegmentWidths ? widthsPerSegment : undefined,
          repeatCm,
          repeatType,
          colorId: config.colorId,
          pricing: {
            effectivePricePerM: pricePerMLinear,
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
        numWidths,
        widthsPerPanel: widthsPerPanel ?? Math.round(numWidths / panels * 10) / 10,
        widthsPerSegment: usePerSegmentWidths ? widthsPerSegment : undefined,
        segmentWidthsCm: usePerSegmentWidths ? clampedSegmentWidths : undefined,
        totalLinearCm,
        linearMetres,
        fullness,
        appliedWidthCm: clampedSegmentWidths.reduce((sum, w) => sum + w, 0),
        appliedHeightCm: finishedDrop,
        cutDropCm: cutDrop,
        fabric: {
          id: fabric.id,
          name: fabric.name,
        },
      },
    };
  }

  async toCartPayload(config: CurtainConfig): Promise<StorefrontCartItem> {
    // Build cart payload for storefront
    // This is used when adding to cart via parent
    
    // Get quote to extract fabric consumption (Task 958)
    const quote = await this.priceQuote(config);
    const totalLinearCm = quote.providerMetadata?.totalLinearCm;
    
    // Fetch product to get color SKU mapping (Task 957)
    const productList = await this.getProductList();
    const product = productList.products.find((p) => p.sku === config.fabricId);
    
    // Determine child SKU from color selection
    const childSku = (config.extras?.selectedChildItem as ChildItem).sku ?? undefined;
    
    // Calculate fabric quantity in Magento format: 1cm = 0.01qty (Task 958)
    // Fallback to segments if totalLinearCm not available
    const fabricQuantity = typeof totalLinearCm === 'number' 
      ? Number((totalLinearCm * 0.01).toFixed(2))
      : config.segments;
    
    // Get services from selected service IDs
    const allServices = await this.listServices({});
    const services = allServices
      .filter((svc) => config.services.includes(svc.id))
      .map((svc) => ({
        sku: svc.id, // In storefront provider, id field contains the product SKU
        quantity: 1,
      }));

    // current price calculation: fabric in meters (can be fractional) + workmanship + pleat surcharge +
    // hem surcharge + (sum of virtual products)
    
    return {
      sku: config.fabricId,
      childSku,
      quantity: fabricQuantity,
      options: {
        widthCm: config.widthCm,
        heightCm: config.heightCm,
        pleatId: config.pleatId,
        hemId: config.hemId,
        colorId: config.colorId,
        segmentWidthsCm: config.segmentWidthsCm,
        totalLinearCm,
      },
      services: services.length ? services : undefined,
      providerMetadata: {
        curtainConfig: config,
        quote,
      },
    };
  }
}

registerCatalogProvider('storefront', () => new StorefrontCatalogProvider());
