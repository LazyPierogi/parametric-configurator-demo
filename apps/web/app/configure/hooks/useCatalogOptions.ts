"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  computeFabricConstraints,
  type CatalogFilter,
  type CatalogProvider,
  type ChildItem,
  type ColorCategoryId,
  type ColorFilterId,
  type CurtainOption,
  type Fabric,
  type FabricType,
  type HemOption,
  type PleatOption,
  type ServiceOption,
  type StyleFilterId,
} from '@curtain-wizard/core/src/catalog';
import type { useLocale } from '@/app/providers/locale-context';

type TranslateFn = ReturnType<typeof useLocale>['t'];

type UseCatalogOptionsParams = {
  provider: CatalogProvider;
  providerId: string | null;
  filter: CatalogFilter;
  ensureImage: (url?: string | null) => Promise<boolean>;
  t: TranslateFn;
};

type StyleFilter = StyleFilterId;
type ColorFilter = ColorFilterId;

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

const FABRIC_TYPE_ORDER = [
  'default',
  'all',
  'light',
  'medium',
  'medium-weight',
  'sheer',
  'sheer-thin',
  'sheer-thick',
  'heavy',
  'blackout',
  'thermal',
  'lining',
  'outdoor',
];

const STYLE_FILTER_ORDER = [
  'all',
  'basic',
  'natural',
  'classic',
  'modern',
  'linen',
  'velvet',
  'sheer',
  'patterned',
  'textured',
  'decorative',
];

const COLOR_CATEGORY_ORDER = [
  'all',
  'bright',
  'dark',
  'grey',
  'cold',
  'warm',
  'light',
  'cream',
  'neutral',
  'cool',
  'colored',
  'patterned',
  'black',
  'white',
  'intensive',
  'natural',
  'brown',
  'pastel',
];

const PLEAT_ORDER = [
  'wave',
  'flex',
  'doubleflex',
  'tripleflex',
  'ring',
  'eyelet',
  'tab',
  'tunnel',
  'pencil',
  'box',
  'pinch',
];

const HEM_ORDER = [
  'hem-2cm',
  'hem-3cm',
  'hem-4cm',
  'hem-5cm',
  'hem-7cm',
  'hem-10cm',
  'hem-15cm',
];

const normalizeKey = (key?: string | null) => (key ?? '').toLowerCase();

const getPriorityIndex = (order: string[], key: string) => {
  const idx = order.indexOf(key);
  return idx === -1 ? order.length + 1 : idx;
};

function sortByPriority<T>(
  items: T[],
  order: string[],
  getKey: (item: T) => string | null | undefined,
  getLabel?: (item: T) => string | null | undefined,
): T[] {
  const labelGetter = getLabel ?? ((item: T) => {
    const key = getKey(item);
    return typeof key === 'string' ? key : '';
  });

  return [...items].sort((a, b) => {
    const keyA = normalizeKey(getKey(a));
    const keyB = normalizeKey(getKey(b));
    const priorityA = getPriorityIndex(order, keyA);
    const priorityB = getPriorityIndex(order, keyB);
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return collator.compare(labelGetter(a) ?? '', labelGetter(b) ?? '');
  });
}

const sortFabricTypes = (types: FabricType[]) =>
  sortByPriority(types, FABRIC_TYPE_ORDER, (type) => type.id, (type) => type.label ?? type.id);

const sortFabricsByName = (fabrics: Fabric[]) =>
  [...fabrics].sort((a, b) => collator.compare(a.name ?? '', b.name ?? ''));

const sortPleatsByPriority = (pleats: PleatOption[]) =>
  sortByPriority(pleats, PLEAT_ORDER, (pleat) => pleat.id?.toLowerCase(), (pleat) => pleat.label ?? pleat.id);

const sortHemsByPriority = (hems: HemOption[]) =>
  sortByPriority(hems, HEM_ORDER, (hem) => hem.id?.toLowerCase(), (hem) => hem.label ?? hem.id);

const orderFilterValues = (values: string[], priority: string[]): string[] => {
  const unique = Array.from(new Set(values));
  return unique.sort((a, b) => {
    const keyA = normalizeKey(a);
    const keyB = normalizeKey(b);
    const priorityA = getPriorityIndex(priority, keyA);
    const priorityB = getPriorityIndex(priority, keyB);
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return collator.compare(a, b);
  });
};

type UseCatalogOptionsResult = {
  fabricTypes: FabricType[];
  fabrics: Fabric[];
  pleats: PleatOption[];
  hems: HemOption[];
  serviceOptions: ServiceOption[];
  selectedFabricTypeId: string | null;
  setSelectedFabricTypeId: (id: string | null) => void;
  selectedFabricId: string | null;
  setSelectedFabricId: (id: string | null) => void;
  selectedColor: string | null;
  selectedChildItem: ChildItem | null;
  setSelectedColor: (color: string | null) => void;
  setSelectedChildItem: (childItem: ChildItem | null) => void;
  selectedStyle: StyleFilter;
  setSelectedStyle: (style: StyleFilter) => void;
  selectedColorCategory: ColorFilter;
  setSelectedColorCategory: (category: ColorFilter) => void;
  availableStyles: StyleFilter[];
  availableColorCategories: ColorFilter[];
  fabricCountByStyle: Record<string, number>;
  fabricCountByColorCategory: Record<string, number>;
  fabricCountByType: Record<string, number>;
  getFilteredColors: (fabric: Fabric) => string[];
  getChildItems: (fabric: Fabric) => ChildItem[];
  selectedPleatId: string | null;
  setSelectedPleatId: (id: string | null) => void;
  selectedHemId: string | null;
  setSelectedHemId: (id: string | null) => void;
  selectedServices: string[];
  toggleService: (id: string) => void;
  catalogLoading: boolean;
  catalogError: string | null;
  optionsBusy: boolean;
  selectedFabric: Fabric | null;
  selectedPleat: PleatOption | null;
  selectedHem: HemOption | null;
  selectedServiceObjects: ServiceOption[];
  maxCurtainHeightCm: number;
  maxPanelWidthCm: number;
};

async function resolveFabricTypeForFabric(
  provider: CatalogProvider,
  types: FabricType[],
  fabricId: string,
  filter: CatalogFilter,
): Promise<{ typeId: string; fabrics: Fabric[] } | null> {
  for (const type of types) {
    const fabrics = await provider.listFabrics({ ...filter, fabricTypeId: type.id });
    if (fabrics.filter((f) => !((f.sku ?? '').includes('SERVICE'))).some((fabric) => fabric.id === fabricId)) {
      return { typeId: type.id, fabrics };
    }
  }
  return null;
}

/**
 * Get filtered colors for a fabric based on selected color category
 */
function getFilteredColors(
  fabric: Fabric,
  selectedColorCategory: ColorFilter
): string[] {
  const childItems = deriveChildItems(fabric);
  if (childItems.length) {
    const relevant = selectedColorCategory === 'all'
      ? childItems
      : childItems.filter((item) => {
          // Check primary category first
          if (item.colorCategory === selectedColorCategory) return true;
          // Check if selected category is in multi-category array
          if (item.colorCategories && item.colorCategories.includes(selectedColorCategory)) return true;
          return false;
        });
    return relevant.map((item) => item.color_label).filter((label): label is string => !!label);
  }

  const colors = fabric.colors ?? [];
  if (selectedColorCategory === 'all') {
    return colors;
  }

  return colors.filter((color) => {
    const category = fabric.colorCategoryByColor?.[color] ?? fabric.colorCategory;
    return category === selectedColorCategory;
  });
}

function deriveChildItems(fabric: Fabric): ChildItem[] {
  // Accept any category string dynamically (no validation against hardcoded values)
  const enrich = (items: ChildItem[]): ChildItem[] =>
    items.map((item) => {
      const label = item.color_label ?? item.color ?? item.name ?? '';
      
      // Derive colorCategory from colorCategories[0] for backward compatibility
      const resolvedCategories = item.colorCategories ?? [];
      const resolvedCategory = resolvedCategories[0] ?? fabric.colorCategories?.[0] ?? fabric.colorCategory;

      return {
        ...item,
        color_label: label,
        colorCategory: resolvedCategory,
        colorCategories: resolvedCategories,
      };
    });

  if (fabric.childItems && fabric.childItems.length > 0) {
    return enrich(fabric.childItems as ChildItem[]);
  }

  const colors = fabric.colors ?? [];
  if (colors.length === 0) {
    return [];
  }

  const derived = colors.map((color) => {
    const sku = fabric.colorSkuByColor?.[color] ?? fabric.sku;
    const readableColor = color
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      color,
      color_label: color,
      sku,
      name: readableColor,
    } as ChildItem;
  });

  return enrich(derived);
}

function getChildItems(
    fabric: Fabric,
    selectedColorCategory: ColorFilter
): ChildItem[] {
  const childItems = deriveChildItems(fabric);

  if (childItems.length === 0) {
    return [];
  }

  if (selectedColorCategory === 'all') {
    return childItems;
  }

  return childItems.filter((childItem) => {
    // Check primary category first
    if (childItem.colorCategory === selectedColorCategory) return true;
    // Check if selected category is in multi-category array
    if (childItem.colorCategories && childItem.colorCategories.includes(selectedColorCategory)) return true;
    return false;
  });
}

export function useCatalogOptions({ provider, providerId, filter, ensureImage, t }: UseCatalogOptionsParams): UseCatalogOptionsResult {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlStyle = (searchParams?.get('style') as StyleFilter | null) ?? 'all';
  const urlColorCategory = (searchParams?.get('colorCategory') as ColorFilter | null) ?? 'all';
  
  const [fabricTypes, setFabricTypes] = useState<FabricType[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [pleats, setPleats] = useState<PleatOption[]>([]);
  const [hems, setHems] = useState<HemOption[]>([]);
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);
  const [selectedFabricTypeId, setSelectedFabricTypeId] = useState<string | null>('all');
  const [selectedFabricId, setSelectedFabricId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedChildItem, setSelectedChildItem] = useState<ChildItem | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<StyleFilter>(urlStyle);
  const [selectedColorCategory, setSelectedColorCategory] = useState<ColorFilter>(urlColorCategory);
  const [availableStyles, setAvailableStyles] = useState<StyleFilter[]>(['all']);
  const [availableColorCategories, setAvailableColorCategories] = useState<ColorFilter[]>(['all']);
  const [fabricCountByStyle, setFabricCountByStyle] = useState<Record<string, number>>({});
  const [fabricCountByColorCategory, setFabricCountByColorCategory] = useState<Record<string, number>>({});
  const [fabricCountByType, setFabricCountByType] = useState<Record<string, number>>({});
  const [styleCountByType, setStyleCountByType] = useState<Record<string, Record<string, number>>>({});
  const [selectedPleatId, setSelectedPleatId] = useState<string | null>(null);
  const [selectedHemId, setSelectedHemId] = useState<string | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [optionsBusy, setOptionsBusy] = useState(false);
  const [defaultCurtain, setDefaultCurtain] = useState<CurtainOption | null>(null);

  const serviceStorageKey = useMemo(
    () => (typeof window === 'undefined' ? null : `cw-services-${providerId ?? 'unknown'}`),
    [providerId],
  );

  const lastSelectionKey = useMemo(
    () => (typeof window === 'undefined' ? null : `cw-last-fabric-by-type-${providerId ?? 'unknown'}`),
    [providerId],
  );
  const lastSelectionRef = useRef<Record<string, { fabricId: string; colorId?: string }>>({});
  const lastTypeRef = useRef<string | null>(null);
  // Track initial defaults per type (used to prioritize storefront/product preselection over memory)
  const initialDefaultForTypeRef = useRef<Record<string, string | null>>({});

  useEffect(() => {
    if (!lastSelectionKey) return;
    try {
      const raw = localStorage.getItem(lastSelectionKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          lastSelectionRef.current = parsed as Record<string, { fabricId: string; colorId?: string }>;
        }
      }
    } catch {
      // ignore storage failures
    }
  }, [lastSelectionKey]);

  const rememberSelection = useCallback(
    (typeId: string | null, fabricId: string | null, colorId?: string | null) => {
      if (!typeId || !fabricId) return;
      const cur = lastSelectionRef.current;
      cur[typeId] = { fabricId, ...(colorId ? { colorId } : {}) } as { fabricId: string; colorId?: string };
      if (lastSelectionKey) {
        try {
          localStorage.setItem(lastSelectionKey, JSON.stringify(cur));
        } catch {
          // ignore storage failures
        }
      }
    },
    [lastSelectionKey],
  );

  const initialServiceFilterRef = useRef(filter);

  useEffect(() => {
    let cancelled = false;
    const loadCatalog = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const [types, services, defaults] = await Promise.all([
          provider.listFabricTypes({}),
          provider.listServices(initialServiceFilterRef.current),
          provider.getDefaultCurtain(),
        ]);
        if (cancelled) return;
        setFabricTypes(sortFabricTypes(types));
        setServiceOptions(services);
        setDefaultCurtain(defaults);
        setSelectedChildItem(defaults.providerMetadata?.selectedChildItem as ChildItem);

        let typeId: string | null = null;
        let initialFabrics: Fabric[] = [];

        if (defaults.fabricId) {
          const resolved = await resolveFabricTypeForFabric(provider, types, defaults.fabricId, {} as CatalogFilter);
          if (cancelled) return;
          if (resolved) {
            typeId = resolved.typeId;
            initialFabrics = resolved.fabrics.filter((f) => !((f.sku ?? '').includes('SERVICE')));
          }
        }

        if (!typeId) {
          const fallbackType = types[0];
          if (fallbackType) {
            typeId = fallbackType.id;
            initialFabrics = await provider.listFabrics({ fabricTypeId: fallbackType.id });
            if (cancelled) return;
          }
        }

        setSelectedFabricTypeId(typeId);
        setFabrics(initialFabrics);
        const fabricId = initialFabrics.some((fabric) => fabric.id === defaults.fabricId)
          ? defaults.fabricId
          : initialFabrics[0]?.id ?? null;
        setSelectedFabricId(fabricId);
        if (typeId && fabricId) {
          // Record the initial default for this type and persist it as the remembered selection
          initialDefaultForTypeRef.current[typeId] = fabricId;
          // color is resolved in color-sync effect; remember at least fabric now
          rememberSelection(typeId, fabricId, undefined);
        }
        if (defaults.pleatId) setSelectedPleatId(defaults.pleatId);
        if (defaults.hemId) setSelectedHemId(defaults.hemId);
      } catch (error: any) {
        if (!cancelled) {
          console.error(error);
          setCatalogError(error?.message ?? t('configure.errors.loadCatalog'));
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    };

    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, [provider, t]);

  // Calculate type counts and style counts per type from all fabric types
  useEffect(() => {
    let cancelled = false;
    const calculateTypeCounts = async () => {
      try {
        const allTypesCounts: Record<string, number> = {};
        const allStylesCountByType: Record<string, Record<string, number>> = {};

        // For each fabric type, fetch fabrics and count styles using derived child items
        for (const type of fabricTypes) {
          const typeId = type.id;
          if (typeId === 'all') {
            continue;
          }
          const fabrics = await provider.listFabrics({ ...filter, fabricTypeId: typeId });
          if (cancelled) return;

          // Exclude service SKUs from counts
          const filtered = fabrics.filter((f) => !((f.sku ?? '').includes('SERVICE')));
          const typeCount = filtered.length;
          allTypesCounts[typeId] = typeCount;

          // Count styles for this type
          const styleCountsForType: Record<string, number> = { all: 0 };

          for (const fabric of filtered) {
            const fabricStyle = fabric.style ?? null;
            const childItems = deriveChildItems(fabric);
            if (fabricStyle && childItems.length > 0) {
              styleCountsForType[fabricStyle] = (styleCountsForType[fabricStyle] ?? 0) + childItems.length;
              styleCountsForType.all += childItems.length;
            }
          }

          allStylesCountByType[typeId] = styleCountsForType;
        }

        // Synthetic "All Fabrics" should count parent fabrics across types (not variants / child items)
        allTypesCounts.all = Object.entries(allTypesCounts)
          .filter(([key]) => key !== 'all')
          .reduce((sum, [, value]) => sum + value, 0);

        if (!cancelled) {
          setFabricCountByType(allTypesCounts);
          setStyleCountByType(allStylesCountByType);
        }
      } catch (error: any) {
        if (!cancelled) {
          console.error('[typeCounts] Error calculating counts:', error);
        }
      }
    };

    if (fabricTypes.length > 0) {
      void calculateTypeCounts();
    }

    return () => {
      cancelled = true;
    };
  }, [provider, fabricTypes, filter]);

  useEffect(() => {
    if (!serviceOptions.length) return;
    const stored = serviceStorageKey
      ? (() => {
          try {
            const raw = localStorage.getItem(serviceStorageKey);
            if (!raw) return null;
            return JSON.parse(raw) as string[];
          } catch {
            return null;
          }
        })()
      : null;

    const base = stored ?? defaultCurtain?.services ?? [];
    const filtered = base.filter((id) => serviceOptions.some((svc) => svc.id === id));
    setSelectedServices(filtered);
    if (serviceStorageKey && stored == null) {
      try {
        localStorage.setItem(serviceStorageKey, JSON.stringify(filtered));
      } catch {
        // ignore storage failures
      }
    }
  }, [serviceOptions, defaultCurtain, serviceStorageKey]);

  useEffect(() => {
    if (!serviceOptions.length) return;
    setSelectedServices((prev) => {
      const filtered = prev.filter((id) => serviceOptions.some((svc) => svc.id === id));
      if (serviceStorageKey) {
        try {
          localStorage.setItem(serviceStorageKey, JSON.stringify(filtered));
        } catch {
          // ignore storage failures
        }
      }
      return filtered;
    });
  }, [serviceOptions, serviceStorageKey]);

  useEffect(() => {
    let cancelled = false;
    const fetchFabrics = async () => {
      setOptionsBusy(true);
      try {
        const rawList = await provider.listFabrics({ ...filter, fabricTypeId: selectedFabricTypeId ?? 'all' });
        if (cancelled) return;

        const childItemsMap = new Map<string, ChildItem[]>();
        for (const fabric of rawList) {
          childItemsMap.set(fabric.id, deriveChildItems(fabric));
        }

        // Build counts dynamically from actual fabric data (no hardcoded arrays)
        // Three-level hierarchy: typeCounts → styleCounts → colorCounts
        const typeCounts: Record<string, number> = { all: 0 };
        const styleCounts: Record<string, number> = { all: 0 };
        const colorCounts: Record<string, number> = { all: 0 };
        const discoveredStyles = new Set<string>();
        const discoveredColors = new Set<string>();

        // First pass: discover all styles and color categories from fabrics in selected type
        for (const fabric of rawList) {
          const fabricType = fabric.typeId ?? null;
          const fabricStyle = fabric.style ?? null;
          const childItems = childItemsMap.get(fabric.id) ?? [];

          // Track discovered styles (only from fabrics in this type)
          if (fabricStyle) {
            discoveredStyles.add(fabricStyle);
          }

          // Track discovered color categories from child items (only from fabrics in this type)
          for (const item of childItems) {
            const itemCategories = item.colorCategories ?? (item.colorCategory ? [item.colorCategory] : []);
            for (const category of itemCategories) {
              if (category) {
                discoveredColors.add(category);
              }
            }
          }
        }

        // Second pass: count fabrics/items based on hierarchical filters
        // Styles are filtered ONLY by fabric type (already done via listFabrics call)
        // Colors are filtered by selected style
        for (const fabric of rawList) {
          const fabricStyle = fabric.style ?? null;
          const childItems = childItemsMap.get(fabric.id) ?? [];

          // Check if this fabric matches the selected style filter
          const fabricMatchesSelectedStyle = selectedStyle === 'all' || fabricStyle === selectedStyle;

          // Count child items for color categories (filtered by selected style only)
          for (const item of childItems) {
            if (!fabricMatchesSelectedStyle) continue; // Skip if fabric doesn't match style filter

            const itemCategories = item.colorCategories ?? (item.colorCategory ? [item.colorCategory] : []);

            // Count this child item once for 'all' colors
            colorCounts.all += 1;

            // Count this child item for each category it belongs to
            for (const category of itemCategories) {
              if (category) {
                colorCounts[category] = (colorCounts[category] ?? 0) + 1;
              }
            }
          }

          // Count for styles (filtered by fabric type only, NOT by color category)
          // All child items of this fabric contribute to the style count
          if (fabricStyle && childItems.length > 0) {
            styleCounts.all += childItems.length;
            styleCounts[fabricStyle] = (styleCounts[fabricStyle] ?? 0) + childItems.length;
          }
        }

        // Build available options from discovered values (sorted by priority order)
        // Use styleCounts from current fetch (already filtered by selectedFabricTypeId via rawList)
        const availableStyles: StyleFilter[] = [
          'all',
          ...orderFilterValues(Array.from(discoveredStyles), STYLE_FILTER_ORDER)
            .filter((style) => (styleCounts[style] ?? 0) > 0),
        ];

        const availableColorCategories: ColorFilter[] = [
          'all',
          ...orderFilterValues(Array.from(discoveredColors), COLOR_CATEGORY_ORDER)
            .filter((category) => (colorCounts[category] ?? 0) > 0),
        ];

        setAvailableStyles(availableStyles);
        setAvailableColorCategories(availableColorCategories);
        // Use style counts from current fetch (already type-filtered via rawList)
        setFabricCountByStyle({ ...styleCounts });
        setFabricCountByColorCategory({ ...colorCounts });

        // Auto-fallback if current selection is no longer available
        let effectiveStyle = selectedStyle;
        let effectiveColorCategory = selectedColorCategory;

        if (!availableStyles.includes(effectiveStyle)) {
          effectiveStyle = availableStyles[0] ?? 'all';
          setSelectedStyle(effectiveStyle);
        }

        if (!availableColorCategories.includes(effectiveColorCategory)) {
          effectiveColorCategory = availableColorCategories[0] ?? 'all';
          setSelectedColorCategory(effectiveColorCategory);
        }

        // Auto-select first matching color if current selection is filtered out
        if (selectedFabricId && effectiveColorCategory !== 'all') {
          const currentFabric = rawList.find((f) => f.id === selectedFabricId);
          if (currentFabric) {
            const childItems = childItemsMap.get(currentFabric.id) ?? [];
            const currentSelection = selectedColor
              ? childItems.find((item) => item.color_label === selectedColor)
              : null;

            // Check if current selection matches the effective category (including multi-category support)
            if (currentSelection && (
              currentSelection.colorCategory === effectiveColorCategory ||
              (currentSelection.colorCategories && currentSelection.colorCategories.includes(effectiveColorCategory))
            )) {
              setSelectedChildItem(currentSelection);
            } else {
              // Find a child item that matches the effective category
              const matchingChild = childItems.find(
                (item) => item.colorCategory === effectiveColorCategory ||
                         (item.colorCategories && item.colorCategories.includes(effectiveColorCategory))
              );
              if (matchingChild) {
                setSelectedColor(matchingChild.color_label);
                setSelectedChildItem(matchingChild);
              } else if (childItems.length > 0) {
                const fallbackChild = childItems[0];
                setSelectedColor(fallbackChild?.color_label ?? null);
                setSelectedChildItem(fallbackChild ?? null);
              } else if (currentFabric.colors?.length) {
                setSelectedColor(currentFabric.colors[0]);
                setSelectedChildItem(null);
              } else {
                setSelectedColor(null);
                setSelectedChildItem(null);
              }
            }
          }
        }

        // Apply client-side style and colorCategory filters
        const list = rawList.filter((f) => !((f.sku ?? '').includes('SERVICE'))).filter((fabric) => {
          if (effectiveStyle !== 'all' && fabric.style !== effectiveStyle) return false;

          if (effectiveColorCategory === 'all') {
            return true;
          }

          const childItems = childItemsMap.get(fabric.id) ?? [];
          
          // Check if any child item has the selected color category in its categories
          for (const item of childItems) {
            if (item.colorCategories && item.colorCategories.includes(effectiveColorCategory)) {
              return true;
            }
            if (item.colorCategory === effectiveColorCategory) {
              return true;
            }
          }

          return false;
        });
        
        setFabrics(list);
        if (process.env.NODE_ENV !== 'production') {
          try {
            for (const fabric of list) {
              const log = {
                textureUrl: fabric.textureUrl,
                textureByColor: fabric.textureByColor,
                thumbnails: fabric.thumbnails,
                swatchUrl: fabric.swatchUrl,
              };
              // eslint-disable-next-line no-console
              console.debug('[textures] catalog fabric assets', fabric.id, log);
            }
          } catch {}
        }
        const typeChanged = lastTypeRef.current !== selectedFabricTypeId;
        lastTypeRef.current = selectedFabricTypeId;

        // Compute validity of current selection with the freshly fetched list
        const hasList = list.length > 0;
        const ids = new Set(list.map((f) => f.id));
        const currentValid = !!(selectedFabricId && ids.has(selectedFabricId));

        if (!hasList) {
          setSelectedFabricId(null);
          setSelectedColor(null);
          setSelectedChildItem(null);
          return;
        }

        // If first time loading this type and the current selection equals the provider default for this type,
        // do not override it with memory; instead persist it as the remembered selection.
        const initialDefaultForType = initialDefaultForTypeRef.current[selectedFabricTypeId ?? 'default'] ?? null;
        if (typeChanged && initialDefaultForType && selectedFabricId === initialDefaultForType && ids.has(selectedFabricId)) {
          const chosen = list.find((f) => f.id === selectedFabricId)!;
          const colors = chosen.colors ?? [];
          const filteredColors = getChildItems(chosen, effectiveColorCategory);
          const color = selectedColor && filteredColors.some(c => c.color_label === selectedColor)
            ? selectedColor
            : filteredColors[0]?.color_label ?? colors[0] ?? null;
          rememberSelection(selectedFabricTypeId, selectedFabricId, color);

          // TODO create rememberChildItemSelection class or refactor above to hold childItem instead of string
          setSelectedChildItem(filteredColors[0]);

          return;
        }

        // TODO setSelectedChildItem() now duplicates setting string color value for the sake of backward compatibility
        //  In the end it should replace it completely (color label and hex value reside in selectedChild object
        // Also we could rethink state store here, instead of calling methods eveery now and then

        // If current selection is invalid for this list (e.g., switching categories or filters),
        // restore remembered selection for this type if available; otherwise fall back to first.
        if (!currentValid) {
          const memo = lastSelectionRef.current[selectedFabricTypeId ?? 'default'];
          let nextFabricId: string | null = null;
          let nextColor: string | null = null;
          let nextChild: ChildItem | null = null;
          if (memo && ids.has(memo.fabricId)) {
            nextFabricId = memo.fabricId;
            const chosen = list.find((f) => f.id === memo.fabricId)!;
            const filteredColors = getChildItems(chosen, effectiveColorCategory);
            nextColor = memo.colorId && filteredColors.some(c => c.color_label === memo.colorId)
                    ? memo.colorId
                    : filteredColors[0]?.color_label ?? null;
            nextChild = filteredColors.find((c) => c.color_label === nextColor) ?? filteredColors[0] ?? null;
          } else {
            const first = list[0];
            nextFabricId = first.id;
            const filteredColors = getChildItems(first, effectiveColorCategory);
            nextColor = filteredColors[0]?.color_label ??
                null;
            nextChild = filteredColors[0] ?? null;
          }
          setSelectedFabricId(nextFabricId);
          setSelectedColor(nextColor);
          setSelectedChildItem(nextChild ?? null);
          rememberSelection(selectedFabricTypeId, nextFabricId, nextColor);
        }
      } catch (error: any) {
        if (!cancelled) {
          console.error(error);
          setCatalogError(error?.message ?? t('configure.errors.loadFabrics'));
        }
      } finally {
        if (!cancelled) setOptionsBusy(false);
      }
    };

    void fetchFabrics();
    return () => {
      cancelled = true;
    };
  }, [provider, selectedFabricTypeId, filter, selectedStyle, selectedColorCategory, t]);

  useEffect(() => {
    if (!selectedFabricId) {
      setPleats([]);
      setSelectedPleatId(null);
      return;
    }
    let cancelled = false;
    const fetchPleats = async () => {
      setOptionsBusy(true);
      try {
        const list = await provider.listPleats({ fabricId: selectedFabricId });
        if (cancelled) return;
        setPleats(list);
        let nextPleat = selectedPleatId;
        if (!nextPleat || !list.some((item) => item.id === nextPleat)) {
          const preferred = defaultCurtain?.pleatId && list.some((item) => item.id === defaultCurtain.pleatId)
            ? defaultCurtain.pleatId
            : list[0]?.id ?? null;
          nextPleat = preferred;
        }
        setSelectedPleatId(nextPleat);
      } catch (error: any) {
        if (!cancelled) {
          console.error(error);
          setCatalogError(error?.message ?? t('configure.errors.loadPleats'));
        }
      } finally {
        if (!cancelled) setOptionsBusy(false);
      }
    };

    void fetchPleats();
    return () => {
      cancelled = true;
    };
  }, [provider, selectedFabricId, defaultCurtain, selectedPleatId, t]);

  useEffect(() => {
    if (!selectedFabricId || !selectedPleatId) {
      setHems([]);
      setSelectedHemId(null);
      return;
    }
    let cancelled = false;
    const fetchHems = async () => {
      setOptionsBusy(true);
      try {
        const list = await provider.listHems({ fabricId: selectedFabricId, pleatId: selectedPleatId });
        if (cancelled) return;
        setHems(list);
        let nextHem = selectedHemId;
        if (!nextHem || !list.some((item) => item.id === nextHem)) {
          const preferred = defaultCurtain?.hemId && list.some((item) => item.id === defaultCurtain.hemId)
            ? defaultCurtain.hemId
            : list[0]?.id ?? null;
          nextHem = preferred;
        }
        setSelectedHemId(nextHem);
      } catch (error: any) {
        if (!cancelled) {
          console.error(error);
          setCatalogError(error?.message ?? t('configure.errors.loadHems'));
        }
      } finally {
        if (!cancelled) setOptionsBusy(false);
      }
    };

    void fetchHems();
    return () => {
      cancelled = true;
    };
  }, [provider, selectedFabricId, selectedPleatId, defaultCurtain, selectedHemId, t]);

  const selectedFabric = useMemo(
    () => fabrics.find((fabric) => fabric.id === selectedFabricId) ?? null,
    [fabrics, selectedFabricId],
  );

  // If user explicitly picked a color (e.g., clicking a color chip), remember it
  // so the auto-sync below doesn't overwrite it during the same update tick.
  const explicitColorRef = useRef<string | null>(null);
  const explicitChildItemRef = useRef<ChildItem | null>(null);
  // When user clicks a color chip, UI often sets fabric then color in the same tick.
  // Hold the target fabricId here so color memory associates with the intended fabric.
  const pendingFabricIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedFabric) return;
    const colors = selectedFabric.colors ?? [];
    for (const c of colors) {
      const url = selectedFabric.textureByColor?.[c] || selectedFabric.textureUrl || selectedFabric.thumbnails?.[0] || null;
      void ensureImage(url);
    }
  }, [selectedFabric, ensureImage]);

  useEffect(() => {
    if (!selectedFabric) {
      setSelectedColor(null);
      setSelectedChildItem(null);
      return;
    }
    const allChildItems = deriveChildItems(selectedFabric);
    if (!allChildItems.length) {
      setSelectedColor(null);
      setSelectedChildItem(null);
      return;
    }
    
    // Get filtered colors based on active color category filter
    const filteredColors = getChildItems(selectedFabric, selectedColorCategory);
    const fallbackColors = filteredColors.length ? filteredColors : allChildItems;

    // Respect explicit color choice (e.g., direct color chip click)
   const explicit = explicitColorRef.current;
    if (explicit && fallbackColors.some(c => c.color_label === explicit)) {
      explicitColorRef.current = null;
      setSelectedColor(explicit);
      return;
    }

    const explicitChildItem = explicitChildItemRef.current;
    if (
      explicitChildItem &&
      fallbackColors.some((c) => c.color_label === explicitChildItem.color_label)
    ) {
      explicitColorRef.current = null;
      setSelectedChildItem(explicitChildItem);
      return;
    }

    // Fall back to first FILTERED color, or keep prev if it's in filtered list
    setSelectedColor((prev) => {
      if (prev && fallbackColors.some(c => c.color_label === prev)) return prev;
      return fallbackColors[0]?.color_label ?? null;
    });

    setSelectedChildItem((prev) => {
      if (prev && fallbackColors.some((item) => item.color_label === prev.color_label)) {
        return prev;
      }
      return fallbackColors[0] ?? null;
    });
  }, [selectedFabric, selectedColorCategory]);

  const selectedPleat = useMemo(
    () => pleats.find((pleat) => pleat.id === selectedPleatId) ?? null,
    [pleats, selectedPleatId],
  );

  const selectedHem = useMemo(
    () => hems.find((hem) => hem.id === selectedHemId) ?? null,
    [hems, selectedHemId],
  );

  const selectedServiceObjects = useMemo(
    () => serviceOptions.filter((svc) => selectedServices.includes(svc.id)),
    [serviceOptions, selectedServices],
  );

  const fabricConstraints = useMemo(
    () => (selectedFabric ? computeFabricConstraints(selectedFabric) : null),
    [selectedFabric],
  );

  const maxCurtainHeightCm = fabricConstraints?.maxCurtainHeightCm ?? Number.POSITIVE_INFINITY;
  const maxPanelWidthCm = fabricConstraints?.maxPanelWidthCm ?? Number.POSITIVE_INFINITY;

  const toggleService = useCallback(
    (id: string) => {
      setSelectedServices((prev) => {
        const next = prev.includes(id) ? prev.filter((svc) => svc !== id) : [...prev, id];
        if (serviceStorageKey) {
          try {
            localStorage.setItem(serviceStorageKey, JSON.stringify(next));
          } catch {
            // ignore storage failures
          }
        }
        return next;
      });
    },
    [serviceStorageKey],
  );

  // Wrap setters to persist last selection per category
  const setSelectedFabricIdWithMemory = useCallback(
    (id: string | null) => {
      pendingFabricIdRef.current = id;
      setSelectedFabricId(id);
      if (id) rememberSelection(selectedFabricTypeId, id, undefined);
    },
    [selectedFabricTypeId, rememberSelection],
  );

  const setSelectedColorWithMemory = useCallback(
    (color: string | null) => {
      // mark explicit selection so fabric-change sync won't override it
      explicitColorRef.current = color ?? null;
      setSelectedColor(color);
      const fabricId = selectedFabricId || pendingFabricIdRef.current;
      if (selectedFabricTypeId && fabricId) rememberSelection(selectedFabricTypeId, fabricId, color);
    },
    [selectedFabricTypeId, selectedFabricId, rememberSelection],
  );

  const setSelectedChildItemWithMemory = useCallback((childItem: ChildItem | null) => {
    explicitChildItemRef.current = childItem;
    setSelectedChildItem(childItem);
  }, []);

  useEffect(() => {
    if (!selectedFabric) {
      return;
    }
    const childItems = getChildItems(selectedFabric, selectedColorCategory);
    if (childItems.length === 0) {
      return;
    }

    const desiredLabel = selectedChildItem?.color_label ?? selectedColor ?? null;
    let nextChild = desiredLabel
      ? childItems.find((item) => item.color_label === desiredLabel) ?? null
      : null;

    if (!nextChild) {
      nextChild = childItems[0] ?? null;
    }

    const nextColorLabel = nextChild?.color_label ?? null;

    // Compare by value (color_label) not reference to avoid infinite loop
    if (nextChild && nextChild.color_label !== selectedChildItem?.color_label) {
      setSelectedChildItemWithMemory(nextChild);
    }

    if (nextColorLabel !== selectedColor) {
      setSelectedColorWithMemory(nextColorLabel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedFabric,
    selectedColorCategory,
    selectedChildItem,
    selectedColor,
    // setSelectedChildItemWithMemory and setSelectedColorWithMemory are stable callbacks - DO NOT include in deps
  ]);

  // Sync filter state to URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(searchParams?.toString() ?? '');

    if (selectedStyle === 'all') {
      params.delete('style');
    } else {
      params.set('style', selectedStyle);
    }

    if (selectedColorCategory === 'all') {
      params.delete('colorCategory');
    } else {
      params.set('colorCategory', selectedColorCategory);
    }

    const nextSearch = params.toString();
    if (nextSearch === (searchParams?.toString() ?? '')) return;

    const nextUrl = nextSearch ? `${window.location.pathname}?${nextSearch}` : window.location.pathname;
    router.replace(nextUrl, { scroll: false });
  }, [selectedStyle, selectedColorCategory, router, searchParams]);

  // Once fabricId state settles, clear the pending bridge
  useEffect(() => {
    if (pendingFabricIdRef.current && pendingFabricIdRef.current === selectedFabricId) {
      pendingFabricIdRef.current = null;
    }
  }, [selectedFabricId]);

  const getFilteredColorsForFabric = useCallback(
    (fabric: Fabric) => getFilteredColors(fabric, selectedColorCategory),
    [selectedColorCategory]
  );

  const getChildItemsForFabric = useCallback(
      (fabric: Fabric) => getChildItems(fabric, selectedColorCategory),
      [selectedColorCategory]
  );

  return {
    fabricTypes,
    fabrics,
    pleats,
    hems,
    serviceOptions,
    selectedFabricTypeId,
    setSelectedFabricTypeId,
    selectedFabricId,
    setSelectedFabricId: setSelectedFabricIdWithMemory,
    selectedColor,
    selectedChildItem,
    setSelectedColor: setSelectedColorWithMemory,
    setSelectedChildItem: setSelectedChildItemWithMemory,
    selectedStyle,
    setSelectedStyle,
    selectedColorCategory,
    setSelectedColorCategory,
    availableStyles,
    availableColorCategories,
    fabricCountByStyle,
    fabricCountByColorCategory,
    fabricCountByType,
    getFilteredColors: getFilteredColorsForFabric,
    getChildItems: getChildItemsForFabric,
    selectedPleatId,
    setSelectedPleatId,
    selectedHemId,
    setSelectedHemId,
    selectedServices,
    toggleService,
    catalogLoading,
    catalogError,
    optionsBusy,
    selectedFabric,
    selectedPleat,
    selectedHem,
    selectedServiceObjects,
    maxCurtainHeightCm,
    maxPanelWidthCm,
  };
}
