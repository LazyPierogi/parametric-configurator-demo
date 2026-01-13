export type CatalogProviderId = 'mock' | 'storefront';

/**
 * Dynamic style and color category types
 * These accept any string from Magento, not limited to predefined values
 * 
 * Known values are kept as reference for development but do NOT restrict runtime values
 */

// Known style values (for reference only - not enforced at runtime)
export const KNOWN_STYLE_VALUES = ['basic', 'natural'] as const;

// Style filter includes 'all' for UI
export type StyleFilterId = 'all' | string;
export type FabricStyleId = string;

// Known color category values (for reference only - not enforced at runtime)
export const KNOWN_COLOR_CATEGORIES = [
  'bright',
  'grey',
  'dark',
  'colored',
  'patterned',
  'intensive',
  'natural',
  'brown',
] as const;

// Dynamic types that accept any string from Magento
export type ColorCategoryId = string;
export type ColorFilterId = 'all' | string;

export type CatalogFilter = {
  locale?: string;
  currency?: string;
  priceRangeMinor?: { min: number; max: number };
  search?: string;
  // Filter by style ('all' shows everything, specific value filters)
  style?: StyleFilterId;
  // Filter by color category ('all' shows everything, specific value filters)
  colorCategory?: ColorFilterId;
  debug?: Record<string, unknown>;
};

export type FabricType = {
  id: string;
  label: string;
  description?: string;
  count?: number;
  compatiblePleats?: string[];
  fabricWidthCm?: number;
  /** @deprecated No longer used - fabrics can be stitched to any width */
  isDoubleWidth?: boolean;
  /** @deprecated No longer used - all fabrics are cut vertically */
  isRailroadable?: boolean;
  verticalRepeatCm?: number;
  repeatType?: 'straight' | 'half-drop';
  minOrderIncrementCm?: number;
  allowancesCm?: { top: number; bottom: number; side?: number; stitch?: number };
  default?: boolean;
  providerMetadata?: Record<string, unknown>;
};

export type Fabric = {
  hemSurchargeMinor?: number;
  pleatSurchargePerSegmentMinor?: number;
  id: string;
  typeId?: string;
  name: string;
  pattern?: string;
  short_description?: string;
  childItems?: ChildItem[];
  colors?: string[];
  // Optional per-color SKU mapping (colorId -> child SKU)
  // Used for parent/child SKU structure when adding to cart (Task 957)
  colorSkuByColor?: Record<string, string>;
  // New filter fields (Task 904)
  style?: FabricStyleId;
  materialFamily?: string;
  colorCategory?: ColorCategoryId;
  // Multi-category support for fabrics
  colorCategories?: ColorCategoryId[];
  // Per-color category mapping (overrides fabric-level colorCategory for specific colors)
  colorCategoryByColor?: Record<string, ColorCategoryId>;
  colorCategoriesByColor?: Record<string, ColorCategoryId[]>;
  swatchUrl?: string;
  thumbnails?: string[];
  // Seamless texture tile for visualizer (repeat-x). If absent, UI falls back to thumbnails[0] or a default.
  textureUrl?: string;
  // Optional per-color texture overrides (color code -> URL)
  textureByColor?: Record<string, string>;
  // Optional per-fabric defaults for preview texture rendering
  // tileWidthPx controls horizontal tile size (px) for repeat-x; opacityPct controls final texture opacity (0-100)
  textureDefaults?: { tileWidthPx?: number; opacityPct?: number };
  dimensions?: { minWidthCm: number; maxWidthCm: number };
  compatiblePleats?: string[];
  availableHems?: string[];
  sku: string;
  priceBandMinor?: { min: number; max: number; currency: string };

  fabricWidthCm: number;
  /** @deprecated No longer used - fabrics can be stitched to any width */
  isDoubleWidth: boolean;
  /** @deprecated No longer used - all fabrics are cut vertically */
  isRailroadable: boolean;
  verticalRepeatCm: number;
  repeatType: 'straight' | 'half-drop';
  minOrderIncrementCm: number;
  allowancesCm?: { top: number; bottom: number; side?: number; stitch?: number };
  shrinkagePct?: number;
  fullnessByPleat?: Record<string, number>;
  pricePerCm?: number;
  pricePerMLinearMinor?: number;

  providerMetadata?: Record<string, unknown>;
};

export type PleatOption = {
  id: string;
  label: string;
  description?: string;
  techImg?: string;
  providerMetadata?: Record<string, unknown>;
};

export type HemOption = {
  id: string;
  label: string;
  description?: string;
  providerMetadata?: Record<string, unknown>;
};

export type ServiceOption = {
  id: string;
  label: string;
  description?: string;
  priceMinor?: number; // Price in minor units (cents), e.g., 14900 = 149.00 PLN
  currency?: string;
  availabilityRegion?: string;
  externalLink?: string;
  providerMetadata?: Record<string, unknown>;
};

export type CurtainConfig = {
  fabricId: string;
  pleatId: string;
  hemId: string;
  // Optional color selection for fabrics with variants
  colorId?: string;
  widthCm: number;
  heightCm: number;
  segments: number;
  // Optional per-segment widths for asymmetric panels (if provided, overrides equal division of widthCm)
  segmentWidthsCm?: number[];
  // Material reuse optimization: calculate total bolts by cumulative usage instead of per-segment
  materialReuseEnabled?: boolean;
  services: string[];
  locale?: string;
  currency?: string;
  extras?: Record<string, unknown>;
};

export type CurtainOption = {
  fabricId: string;
  pleatId: string;
  hemId: string;
  widthCm: number;
  heightCm: number;
  segments: number;
  services: string[];
  textureUrl?: string;
  providerMetadata?: Record<string, unknown>;
};

export type PriceBreakdownItem = {
  id: string;
  label: string;
  amountMinor: number;
  currency: string;
  type: 'base' | 'service' | 'discount' | 'surcharge' | 'tax' | 'total';
  providerMetadata?: Record<string, unknown>;
};

export type ChildItem = {
  color: string;
  color_label: string;
  sku: string;
  name: string;
  price?: number;
  thumbnail?: string;
  categories?: string[];
  colorCategory?: ColorCategoryId;
  colorCategories?: ColorCategoryId[];
  // Material family override per color variant (Task 1010+)
  // Falls back to parent Fabric.materialFamily if not specified
  materialFamily?:
    | 'sheer'
    | 'linen'
    | 'blackout'
    | 'blackout-basic'
    | 'cotton'
    | 'velvet'
    | 'silk'
    | 'curtain-linen'
    | 'sheer-linen'
    | 'curtain-basic'
    | 'sheer-basic';
  pricePerMLinearMinor?: number;
  pleatSurchargePerSegmentMinor?: number;
  hemSurchargeMinor?: number;
};

export type VirtualProduct = {
  id: string; // magento `sku`
  label: string; // magento `title` attribute
  description?: string;
  priceMinor: number; // magento `price` attribute
  currency: 'PLN', // TODO - FIXME
  sku: string; // magento `sku`
}

export type PriceQuote = {
  currency: string;
  subtotalMinor: number;
  servicesMinor?: number;
  totalMinor: number;
  breakdown: PriceBreakdownItem[];
  providerMetadata?: Record<string, unknown>;
};

export type StorefrontCartService = {
  sku: string;
  quantity: number;
  providerMetadata?: Record<string, unknown>;
};

export type StorefrontCartItem = {
  // Parent SKU (fabric base SKU)
  sku: string;
  // Child SKU (color variant SKU) - optional, used for configurable products
  childSku?: string;
  quantity: number;
  options?: Record<string, unknown>;
  services?: StorefrontCartService[];
  providerMetadata?: Record<string, unknown>;
};
