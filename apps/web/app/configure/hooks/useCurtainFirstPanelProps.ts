"use client";

import type { CurtainConfiguratorPanelProps } from '@/features/configurator/components/CurtainConfiguratorPanel';

const noop = () => {};
const noopSchedule = (_ms?: number) => {};
const noopSetHoverTextureUrl = (_url: string | null) => {};

type UseCurtainFirstPanelPropsArgs = {
  isMobile: boolean;
  isReady: boolean;
  t: any;
  locale: string;
  formatNumber: (value: number, opts?: Intl.NumberFormatOptions) => string;
  formatCurrency: (minor: number, currency: string, locale: string) => string;
  providerId: string | null;
  quote: any;

  segmentCount: number;
  onSegmentCountChange: (v: number) => void;

  catalogError: any;
  catalogLoading: boolean;
  sectionsOrder: any;

  BUDGET_MIN_PLN: number;
  BUDGET_MAX_PLN: number;
  budgetUiMinPln: number;
  budgetUiMaxPln: number;
  isNoFilterUi: boolean;
  isAnyPriceUi: boolean;
  setUiRange: (...args: any[]) => void;
  commitRange: (...args: any[]) => void;

  fabricTypes: any;
  selectedFabricTypeId: any;
  setSelectedFabricTypeId: (v: any) => void;
  fabricCountByType: any;

  fabrics: any;
  selectedFabricId: any;
  setSelectedFabricId: (v: any) => void;
  selectedColor: any;
  setSelectedColor: (v: any) => void;
  setSelectedChildItem: (v: any) => void;
  getFilteredColors: any;
  getChildItems: any;
  ensureImage: any;
  cancelHoverClear?: any;
  scheduleHoverClear?: any;
  resetHoverBaseUrl?: any;
  setHoverTextureUrl?: any;
  setHoveredChipKey: any;
  hoveredChipKey: any;
  setStitchChipHovering: any;
  availableStyles: any;
  fabricCountByStyle: any;
  selectedStyle: any;
  setSelectedStyle: any;
  availableColorCategories: any;
  fabricCountByColorCategory: any;
  selectedColorCategory: any;
  setSelectedColorCategory: any;

  pleats: any;
  selectedPleatId: any;
  setSelectedPleatId: (v: any) => void;

  hems: any;
  selectedHemId: any;
  setSelectedHemId: (v: any) => void;

  serviceOptions: any;
  selectedServices: any;
  toggleService: any;
  setConsultUrl: (url: string | null) => void;

  handleOpenExitDialog: () => void;
};

export function useCurtainFirstPanelProps({
  isMobile,
  isReady,
  t,
  locale,
  formatNumber,
  formatCurrency,
  providerId,
  quote,
  segmentCount,
  onSegmentCountChange,
  catalogError,
  catalogLoading,
  sectionsOrder,
  BUDGET_MIN_PLN,
  BUDGET_MAX_PLN,
  budgetUiMinPln,
  budgetUiMaxPln,
  isNoFilterUi,
  isAnyPriceUi,
  setUiRange,
  commitRange,
  fabricTypes,
  selectedFabricTypeId,
  setSelectedFabricTypeId,
  fabricCountByType,
  fabrics,
  selectedFabricId,
  setSelectedFabricId,
  selectedColor,
  setSelectedColor,
  setSelectedChildItem,
  getFilteredColors,
  getChildItems,
  ensureImage,
  cancelHoverClear,
  scheduleHoverClear,
  resetHoverBaseUrl,
  setHoverTextureUrl,
  setHoveredChipKey,
  hoveredChipKey,
  setStitchChipHovering,
  availableStyles,
  fabricCountByStyle,
  selectedStyle,
  setSelectedStyle,
  availableColorCategories,
  fabricCountByColorCategory,
  selectedColorCategory,
  setSelectedColorCategory,
  pleats,
  selectedPleatId,
  setSelectedPleatId,
  hems,
  selectedHemId,
  setSelectedHemId,
  serviceOptions,
  selectedServices,
  toggleService,
  setConsultUrl,
  handleOpenExitDialog,
}: UseCurtainFirstPanelPropsArgs): CurtainConfiguratorPanelProps {
  const cancelHoverClearSafe = cancelHoverClear ?? noop;
  const scheduleHoverClearSafe = scheduleHoverClear ?? noopSchedule;
  const resetHoverBaseUrlSafe = resetHoverBaseUrl ?? noop;
  const setHoverTextureUrlSafe = setHoverTextureUrl ?? noopSetHoverTextureUrl;

  return {
    isMobile,
    isReady,
    t,
    locale,
    formatNumber,
    formatCurrency,
    providerId,
    quote,
    segmentCount,
    onSegmentCountChange,
    catalogError,
    catalogLoading,
    sectionsOrder,
    budget: {
      min: BUDGET_MIN_PLN,
      max: BUDGET_MAX_PLN,
      valueMin: budgetUiMinPln,
      valueMax: budgetUiMaxPln,
      isNoFilter: isNoFilterUi,
      isAnyPrice: isAnyPriceUi,
      setUiRange,
      commitRange,
    },
    fabricType: {
      fabricTypes,
      selectedFabricTypeId,
      onSelect: setSelectedFabricTypeId,
      fabricCountByType,
    },
    fabricCatalog: {
      fabrics,
      selectedFabricId,
      onSelectFabric: setSelectedFabricId,
      selectedColor,
      onSelectColor: (color: any) => setSelectedColor(color),
      onSelectChildItem: (childItem: any) => setSelectedChildItem(childItem),
      getFilteredColors,
      getChildItems,
      ensureImage,
      cancelHoverClear: cancelHoverClearSafe,
      scheduleHoverClear: scheduleHoverClearSafe,
      resetHoverBaseUrl: resetHoverBaseUrlSafe,
      setHoverTextureUrl: setHoverTextureUrlSafe,
      enableTextureHoverPreview: false,
      setHoveredChipKey,
      hoveredChipKey,
      setStitchChipHovering,
      availableStyles,
      fabricCountByStyle,
      selectedStyle,
      setSelectedStyle,
      availableColorCategories,
      fabricCountByColorCategory,
      selectedColorCategory,
      setSelectedColorCategory,
    },
    pleating: {
      pleats,
      selectedPleatId,
      onSelect: setSelectedPleatId,
    },
    hems: {
      hems,
      selectedHemId,
      onSelect: setSelectedHemId,
    },
    services: {
      serviceOptions,
      selectedServices,
      toggleService,
      onOpenConsultation: (url: string) => setConsultUrl(url),
    },
    onExitRequested: handleOpenExitDialog,
  };
}
