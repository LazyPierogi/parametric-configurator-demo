/**
 * Mappers to convert storefront product data to internal catalog types
 */

import type {
  Fabric,
  FabricType,
  PleatOption,
  HemOption,
  ServiceOption,
  ChildItem,
  ColorCategoryId,
} from '../types';
import type { StorefrontProduct, StorefrontProductList } from './types';
import {
  DEFAULT_ALLOWANCES_CM,
  DEFAULT_FULLNESS_BY_PLEAT,
  DEFAULT_MIN_ORDER_INCREMENT_CM,
  DEFAULT_SHRINKAGE_PCT,
} from '../lib/domainDefaults';

/**
 * Map a storefront product to a Fabric
 * Accepts any category values from Magento dynamically (no validation against hardcoded enums)
 */
export function mapStorefrontProductToFabric(product: StorefrontProduct, typeId: string): Fabric {
  const attrs = product.attributes ?? {};

  const rawChildItems = (attrs.childItems ?? []) as ChildItem[];
  const normalizedChildItems = rawChildItems.map((item) => {
    const colorLabel = item.color_label ?? item.color ?? item.name ?? '';
    
    // Resolve color categories (plural support)
    const rawCategory =
      item.colorCategory ??
      attrs.colorCategoryByColor?.[colorLabel] ??
      (item.color ? attrs.colorCategoryByColor?.[item.color] : undefined) ??
      attrs.colorCategory;
    
    // Normalize to array of categories
    let categories: string[] = [];
    if (Array.isArray(rawCategory)) {
      categories = rawCategory.filter((c): c is string => typeof c === 'string' && c.length > 0);
    } else if (typeof rawCategory === 'string' && rawCategory.length > 0) {
      // Split by common delimiters if string contains multiple categories
      categories = rawCategory.split(/[\s,|]+/).filter((c): c is string => c.length > 0);
    }

    return {
      ...item,
      color_label: colorLabel,
      colorCategory: categories[0] ?? null, // Primary category for backward compatibility
      colorCategories: categories, // Full list for multi-category support
    };
  });

  // Build color category map (support arrays)
  const colorCategoryByColor: Record<string, ColorCategoryId> = {};
  const colorCategoriesByColor: Record<string, ColorCategoryId[]> = {};

  for (const [key, value] of Object.entries(attrs.colorCategoryByColor ?? {})) {
    if (Array.isArray(value)) {
      colorCategoriesByColor[key] = value.filter((c): c is string => typeof c === 'string' && c.length > 0);
      colorCategoryByColor[key] = colorCategoriesByColor[key][0] ?? '';
    } else if (typeof value === 'string' && value.length > 0) {
      const split = value.split(/[\s,|]+/).filter((c): c is string => c.length > 0);
      colorCategoriesByColor[key] = split;
      colorCategoryByColor[key] = split[0] ?? '';
    }
  }

  for (const item of normalizedChildItems) {
    if (item.colorCategories && item.colorCategories.length > 0) {
      if (item.color_label) {
        colorCategoriesByColor[item.color_label] = item.colorCategories;
        colorCategoryByColor[item.color_label] = item.colorCategories[0] ?? '';
      }
      if (item.color) {
        colorCategoriesByColor[item.color] = item.colorCategories;
        colorCategoryByColor[item.color] = item.colorCategories[0] ?? '';
      }
    }
  }

  const childColorLabels = normalizedChildItems
    .map((item) => item.color_label ?? item.color)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  const colors =
    (attrs.colors && attrs.colors.length ? attrs.colors : childColorLabels) ??
    [];

  // Determine fabric-level categories (single fallback only)
  let fabricCategory: string | null = null;
  if (typeof attrs.colorCategory === 'string' && attrs.colorCategory.length > 0) {
    fabricCategory = attrs.colorCategory.split(/[\s,|]+/)[0] ?? null; // Use first category as fallback
  }

  return {
    id: product.sku, // Use SKU as internal ID
    typeId: product.typeId ?? attrs.fabricTypeId ?? 'heavy',
    name: product.name,
    sku: product.sku,

    style: attrs.fabricStyleId,
    materialFamily: attrs.materialFamily,
    pattern: attrs.pattern ?? 'plain',
    short_description: attrs.short_description,
    colors,
    childItems: normalizedChildItems,
    colorSkuByColor: attrs.colorSkuByColor,
    colorCategory: fabricCategory ?? undefined,
    colorCategoryByColor,
    colorCategoriesByColor,
    swatchUrl: attrs.swatchUrl,
    thumbnails:
      (attrs.thumbnailUrls && attrs.thumbnailUrls.length
        ? attrs.thumbnailUrls
        : normalizedChildItems
            .map((item) => item.thumbnail)
            .filter((url): url is string => !!url)) ?? [],
    textureUrl: attrs.textureUrl ?? normalizedChildItems.find((item) => item.thumbnail)?.thumbnail,
    textureByColor: normalizedChildItems.reduce((acc, item) => {
      if (item.color_label && item.thumbnail) {
        acc[item.color_label] = item.thumbnail;
      }
      if (item.color && item.thumbnail) {
        acc[item.color] = item.thumbnail;
      }
      return acc;
    }, {} as Record<string, string>),
    textureDefaults: attrs.textureDefaults,
    
    // Fabric specifications
    fabricWidthCm: attrs.fabricWidthCm ?? 150,
    isDoubleWidth: (attrs.fabricWidthCm ?? 150) >= 280, // Deprecated field
    isRailroadable: false, // Deprecated field - all fabrics cut vertically
    verticalRepeatCm: attrs.verticalRepeatCm ?? 0,
    repeatType: attrs.repeatType ?? 'straight',
    minOrderIncrementCm: attrs.minOrderIncrementCm ?? DEFAULT_MIN_ORDER_INCREMENT_CM,
    
    allowancesCm: {
      top: attrs.allowancesTopCm ?? DEFAULT_ALLOWANCES_CM.top,
      bottom: attrs.allowancesBottomCm ?? DEFAULT_ALLOWANCES_CM.bottom,
    },
    shrinkagePct: attrs.shrinkagePct ?? DEFAULT_SHRINKAGE_PCT,
    fullnessByPleat: attrs.fullnessByPleat ?? DEFAULT_FULLNESS_BY_PLEAT,
    hemSurchargeMinor: attrs.hemSurchargeMinor,
    pleatSurchargePerSegmentMinor: attrs.pleatSurchargePerSegmentMinor,
    
    compatiblePleats: attrs.compatiblePleats,
    availableHems: attrs.availableHems,
    
    // Pricing (if provided by storefront)
    pricePerMLinearMinor: product.price,
    priceBandMinor: product.price
      ? { min: product.price, max: product.price, currency: product.currency ?? 'PLN' }
      : undefined,
    
    providerMetadata: {
      storefrontProduct: product,
      ridex: {
        price_flex: typeof attrs.price_flex === 'string' ? attrs.price_flex : null,
        price_double_flex: typeof attrs.price_double_flex === 'string' ? attrs.price_double_flex : null,
        price_wave: typeof attrs.price_wave === 'string' ? attrs.price_wave : null,
      },
      ...(product.metadata ?? {}),
    },
  };
}

/**
 * Extract fabric types from product list
 * Groups products by their type/category
 */
export function extractFabricTypes(productList: StorefrontProductList): FabricType[] {
  // Guard against undefined/null productList
  if (!productList || typeof productList !== 'object') {
    console.error('[Mappers] extractFabricTypes received invalid productList:', productList);
    return [{
      id: 'default',
      label: 'All Fabrics',
      description: 'Default category',
      default: true,
    }];
  }

  // Use categories if provided by storefront
  if (productList.categories && productList.categories.length > 0) {
    return productList.categories.map((cat, idx) => ({
      id: cat.id,
      label: cat.name,
      description: cat.description,
      default: idx === 0, // First category is default
    }));
  }

  // Otherwise, infer types from products
  if (!productList.products || !Array.isArray(productList.products)) {
    console.error('[Mappers] productList.products is missing or invalid:', productList);
    return [{
      id: 'default',
      label: 'All Fabrics',
      description: 'Default category',
      default: true,
    }];
  }

  const typeMap = new Map<string, { name: string; count: number }>();
  let totalCount = 0;

  for (const product of productList.products.filter((f) => !((f.sku ?? '').includes('SERVICE')))) {
    const typeId = product.attributes?.fabricTypeId ?? 'default';
    const existing = typeMap.get(typeId);
    
    if (existing) {
      existing.count++;
    } else {
      typeMap.set(typeId, { name: product.attributes?.fabricTypeId  ?? 'All Fabrics', count: 1 });
    }
    totalCount++;
  }

  // Add 'All Fabrics' item at the start with total count
  const allFabricsType: FabricType = {
    id: 'all',
    label: 'All Fabrics',
    description: 'Browse all fabric types',
    count: totalCount,
    default: true,
  };

  return [allFabricsType, ...Array.from(typeMap.entries()).map(([id, { name, count }]) => ({
    id,
    label: name,
    count,
    default: false,
  }))];
}

/**
 * Parse pleat options from product attributes
 * Returns standard pleat types if not provided by storefront
 */
export function extractPleatOptions(products: StorefrontProduct[]): PleatOption[] {
  const pleatSet = new Set<string>();

  for (const product of products) {
    const pleats = product.attributes?.compatiblePleats ?? [];
    pleats.forEach((p) => pleatSet.add(p));
  }

  // If no pleats found, return standard options
  if (pleatSet.size === 0) {
    return [
      { id: 'wave', label: 'Wave', description: 'Soft, even waves along the rail.' },
      { id: 'flex', label: 'Flex', description: 'Premium flex system for thick drapes.' },
      { id: 'doubleFlex', label: 'Double Flex', description: 'Premium double flex system for thick drapes.' },
    ];
  }

  return Array.from(pleatSet).map((id) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
  }));
}

/**
 * Parse hem options from product attributes
 * Returns standard hem types if not provided by storefront
 */
export function extractHemOptions(products: StorefrontProduct[]): HemOption[] {
  const hemSet = new Set<string>();

  for (const product of products) {
    const hems = product.attributes?.availableHems ?? [];
    hems.forEach((h) => hemSet.add(h));
  }

  // If no hems found, return standard options
  if (hemSet.size === 0) {
    return [
      { id: 'hem-5cm', label: '5 cm', description: 'Standard hem for most curtains.' },
    ];
  }

  return Array.from(hemSet).map((id) => ({
    id,
    label: id.replace('hem-', '').replace('cm', ' cm'),
  }));
}

/**
 * Map service products to ServiceOptions
 * Filters products marked as services by SKU or __typename
 */
export function extractServices(productList: StorefrontProductList): ServiceOption[] {

  const toCents = (amount: number): number => Math.round(amount * 100);

  // Look for products marked as services by SKU or GraphQL typename
  const serviceProducts = productList.products.filter(
    (p) => p.type === 'service' || p.sku.includes('SERVICE')
  );

  return serviceProducts.map((product) => ({
    id: product.sku,
    label: product.name,
    description: product.attributes?.pattern, // Repurpose pattern field for description
    priceMinor: toCents(product.price as number),
    currency: product.currency ?? 'PLN',
    providerMetadata: product.metadata,
  }));
}
