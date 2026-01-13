import type {
  CatalogFilter,
  CatalogProviderId,
  CurtainConfig,
  CurtainOption,
  Fabric,
  FabricType,
  HemOption,
  PleatOption,
  PriceQuote,
  ServiceOption,
  StorefrontCartItem,
} from './types';

export interface CatalogProvider {
  getDefaultCurtain(): Promise<CurtainOption>;
  listFabricTypes(filter: CatalogFilter): Promise<FabricType[]>;
  listFabrics(params: CatalogFilter & { fabricTypeId: string|null }): Promise<Fabric[]>;
  listPleats(params: CatalogFilter & { fabricId: string }): Promise<PleatOption[]>;
  listHems(params: CatalogFilter & { fabricId: string; pleatId: string }): Promise<HemOption[]>;
  listServices(filter: CatalogFilter): Promise<ServiceOption[]>;
  priceQuote(config: CurtainConfig, options?: { fabricMultiplier?: number; laborMultiplier?: number }): Promise<PriceQuote>;
  toCartPayload(config: CurtainConfig): Promise<StorefrontCartItem>;
}

export type CatalogProviderFactory = () => CatalogProvider;

const factories = new Map<CatalogProviderId, CatalogProviderFactory>();

class UnimplementedCatalogProvider implements CatalogProvider {
  constructor(private readonly providerId: CatalogProviderId) {}

  private reject<T>(): Promise<T> {
    return Promise.reject(
      new Error(`Catalog provider '${this.providerId}' is not implemented yet. Follow-up tasks will supply data.`),
    );
  }

  getDefaultCurtain(): Promise<CurtainOption> {
    return this.reject();
  }

  listFabricTypes(): Promise<FabricType[]> {
    return this.reject();
  }

  listFabrics(): Promise<Fabric[]> {
    return this.reject();
  }

  listPleats(): Promise<PleatOption[]> {
    return this.reject();
  }

  listHems(): Promise<HemOption[]> {
    return this.reject();
  }

  listServices(): Promise<ServiceOption[]> {
    return this.reject();
  }

  priceQuote(): Promise<PriceQuote> {
    return this.reject();
  }

  toCartPayload(): Promise<StorefrontCartItem> {
    return this.reject();
  }
}

const defaultFactories: Record<CatalogProviderId, CatalogProviderFactory> = {
  mock: () => new UnimplementedCatalogProvider('mock'),
  storefront: () => new UnimplementedCatalogProvider('storefront'),
};

export function registerCatalogProvider(id: CatalogProviderId, factory: CatalogProviderFactory): void {
  factories.set(id, factory);
}

export function createCatalogProvider(id: CatalogProviderId): CatalogProvider {
  const factory = factories.get(id) ?? defaultFactories[id];
  if (!factory) {
    throw new Error(`Unknown catalog provider id '${id}'.`);
  }
  return factory();
}

export function clearCatalogProviderRegistry(): void {
  factories.clear();
}
