/**
 * Data types for parent storefront communication
 *
 * These types define the shape of product data received from the parent
 * Magento storefront via postMessage communication.
 */

import { ChildItem, type ColorCategoryId, type FabricStyleId } from '../types';

/**
 * Storefront product representing a curtain fabric SKU
 */
export type StorefrontProduct = {
  sku: string;
  name: string;
  type?: string; // fabric type ID or category (deprecated)
  typeId?: string; // fabric type ID or category
  __typename?: string; // GraphQL typename (e.g., "VirtualProduct" for services)
  price?: number; // price in minor units (cents)
  currency?: string;

  thumbnails?: string[];
  pricePerMLinearMinor?: number;
  
  // Fabric attributes
  attributes?: {
    fabricTypeId?: string;
    fabricStyleId?: FabricStyleId;
    hemSurchargeMinor?: number;
    pleatSurchargePerSegmentMinor?: number;
    childItems?: ChildItem[];
    fabricWidthCm?: number;
    verticalRepeatCm?: number;
    repeatType?: 'straight' | 'half-drop';
    pattern?: string;
    short_description?: string;
    colors?: string[];
    colorCategory?: ColorCategoryId | ColorCategoryId[] | string;
    colorCategories?: ColorCategoryId[] | string;
    colorCategoryByColor?: Record<string, ColorCategoryId | ColorCategoryId[] | string>;
    colorSkuByColor?: Record<string, string>;
    compatiblePleats?: string[];
    availableHems?: string[];
    allowancesTopCm?: number;
    allowancesBottomCm?: number;
    shrinkagePct?: number;
    fullnessByPleat?: Record<string, number>;
    minOrderIncrementCm?: number;

    price_flex?: string;
    price_double_flex?: string;
    price_wave?: string;
    
    // Visual assets
    style?: FabricStyleId;
    typeId?: string;
    materialFamily?: string;
    swatchUrl?: string;
    thumbnailUrls?: string[];
    textureUrl?: string;
    textureByColor?: Record<string, string>;
    textureDefaults?: {
      tileWidthPx?: number;
      opacityPct?: number;
    };
  };
  
  // Magento metadata
  metadata?: Record<string, unknown>;
};

/**
 * Storefront product list response
 */
export type StorefrontProductList = {
  products: StorefrontProduct[];
  categories?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  metadata?: {
    totalCount?: number;
    currency?: string;
    locale?: string;
  };
};

/**
 * Storefront cart addition response
 */
export type StorefrontCartResponse = {
  success: boolean;
  cartId?: string;
  items?: Array<{
    sku: string;
    quantity: number;
  }>;
  error?: string;
  metadata?: Record<string, unknown>;
};
