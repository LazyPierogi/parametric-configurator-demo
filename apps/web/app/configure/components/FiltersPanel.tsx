import { useState, type CSSProperties } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { RangeSlider } from '@/components/ui/RangeSlider';
import { ServicesSection } from './ServicesSection';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { HorizontalCarousel } from '@/components/ui/HorizontalCarousel';
import { Button } from '@/components/ui/Button';
import type {
  Fabric,
  FabricType,
  HemOption,
  PleatOption,
  ServiceOption,
  PriceQuote,
  ChildItem,
  ColorFilterId,
  StyleFilterId,
} from '@curtain-wizard/core/src/catalog';

type StyleOption = StyleFilterId;
type ColorCategoryOption = ColorFilterId;

type BudgetSectionProps = {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  isNoFilter: boolean;
  isAnyPrice: boolean;
  setUiRange: (range: [number, number]) => void;
  commitRange: (range: [number, number]) => void;
};

type FabricTypeSectionProps = {
  fabricTypes: FabricType[];
  selectedFabricTypeId: string | null;
  onSelect: (id: string) => void;
  fabricCountByType?: Record<string, number>;
};

type FabricCatalogProps = {
  fabrics: Fabric[];
  selectedFabricId: string | null;
  onSelectFabric: (id: string) => void;
  selectedColor: string | null;
  onSelectColor: (color: string) => void;
  onSelectChildItem: (childItem: ChildItem) => void;
  getFilteredColors: (fabric: Fabric) => string[];
  getChildItems: (fabric: Fabric) => ChildItem[];
  ensureImage: (url: string | null) => Promise<boolean>;
  cancelHoverClear: () => void;
  scheduleHoverClear: (ms?: number) => void;
  resetHoverBaseUrl: () => void;
  setHoverTextureUrl: (url: string | null) => void;
  enableTextureHoverPreview?: boolean;
  setHoveredChipKey: (value: string | null) => void;
  hoveredChipKey: string | null;
  setStitchChipHovering: (value: boolean) => void;
  availableStyles: StyleOption[];
  fabricCountByStyle: Record<string, number>;
  selectedStyle: StyleOption | null;
  setSelectedStyle: (style: StyleOption) => void;
  availableColorCategories: ColorCategoryOption[];
  fabricCountByColorCategory: Record<string, number>;
  selectedColorCategory: ColorCategoryOption | null;
  setSelectedColorCategory: (category: ColorCategoryOption) => void;
};

type PleatingProps = {
  pleats: PleatOption[];
  selectedPleatId: string | null;
  onSelect: (id: string) => void;
};

type HemProps = {
  hems: HemOption[];
  selectedHemId: string | null;
  onSelect: (id: string) => void;
};

type ServicesProps = {
  serviceOptions: ServiceOption[];
  selectedServices: string[];
  toggleService: (id: string) => void;
  onOpenConsultation: (url: string) => void;
};

export type FiltersPanelProps = {
  isMobile: boolean;
  isReady: boolean;
  t: (key: string, params?: Record<string, any>) => string;
  locale: string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (minor: number, currency: string, locale: string) => string;
  providerId: string | null;
  quote: PriceQuote | null;
  segmentCount: number;
  onSegmentCountChange: (value: number) => void;
  catalogError: string | null;
  catalogLoading: boolean;
  sectionsOrder: string[];
  budget: BudgetSectionProps;
  fabricType: FabricTypeSectionProps;
  fabricCatalog: FabricCatalogProps;
  pleating: PleatingProps;
  hems: HemProps;
  services: ServicesProps;
  onExitRequested?: () => void;
};

export function FiltersPanel(props: FiltersPanelProps) {
  const {
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
    budget,
    fabricType,
    fabricCatalog,
    pleating,
    hems,
    services,
    onExitRequested,
  } = props;

  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: quote?.currency ?? 'PLN',
  });

  return (
    <aside
      className={cn(
        'flex-shrink-0 rounded-xl border border-border-panel bg-surface-glass/90 shadow-config-panel',
        isMobile
          ? 'w-full p-3'
          : 'w-full p-5',
      )}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-base font-bold text-active-text">{t('configure.summary.optionsPricing')}</div>
        <div className="text-lg font-bold text-active-text">
          {quote ? formatCurrency(quote.totalMinor, quote.currency, locale) : '—'}
        </div>
      </div>
      {catalogError && (
        <div className="mb-3 rounded-lg border border-error-border bg-error-bg px-2.5 py-2 text-xs text-error-text">
          {catalogError}
        </div>
      )}
      {catalogLoading ? (
        <div className="text-sm font-medium text-active-text">{t('configure.loadingOptions')}</div>
      ) : isReady ? (
        <div>
          <SegmentsControl
            segmentCount={segmentCount}
            formatNumber={formatNumber}
            onSegmentCountChange={onSegmentCountChange}
            t={t}
          />
          {sectionsOrder.map((sectionKey) => {
            switch (sectionKey) {
              case 'budgetPerMeter':
                return (
                  <BudgetPerMeterSection
                    key="budgetPerMeter"
                    t={t}
                    formatter={currencyFormatter}
                    budget={budget}
                  />
                );
              case 'fabricType':
                return (
                  <FabricTypeSection
                    key="fabricType"
                    t={t}
                    isMobile={isMobile}
                    fabricTypes={fabricType.fabricTypes}
                    selectedFabricTypeId={fabricType.selectedFabricTypeId}
                    onSelect={fabricType.onSelect}
                    fabricCountByType={fabricType.fabricCountByType}
                  />
                );
              case 'fabrics':
                return (
                  <FabricsSection
                    key="fabrics"
                    t={t}
                    fabricCatalog={fabricCatalog}
                  />
                );
              case 'style':
                return (
                  <StyleSection
                    key="style"
                    t={t}
                    availableStyles={fabricCatalog.availableStyles}
                    fabricCountByStyle={fabricCatalog.fabricCountByStyle}
                    selectedStyle={fabricCatalog.selectedStyle}
                    setSelectedStyle={fabricCatalog.setSelectedStyle}
                  />
                );
              case 'colorCategory':
                return (
                  <ColorCategorySection
                    key="colorCategory"
                    t={t}
                    availableColorCategories={fabricCatalog.availableColorCategories}
                    fabricCountByColorCategory={fabricCatalog.fabricCountByColorCategory}
                    selectedColorCategory={fabricCatalog.selectedColorCategory}
                    setSelectedColorCategory={fabricCatalog.setSelectedColorCategory}
                  />
                );
              case 'pleating':
                return (
                  <PleatingSection
                    key="pleating"
                    t={t}
                    pleats={pleating.pleats}
                    selectedPleatId={pleating.selectedPleatId}
                    onSelect={pleating.onSelect}
                  />
                );
              case 'hem':
                return (
                  <HemSection
                    key="hem"
                    t={t}
                    hems={hems.hems}
                    selectedHemId={hems.selectedHemId}
                    onSelect={hems.onSelect}
                  />
                );
              case 'services':
                return (
                  <ServicesSection
                    key="services"
                    t={t}
                    formatCurrency={formatCurrency}
                    serviceOptions={services.serviceOptions}
                    selectedServices={services.selectedServices}
                    toggleService={services.toggleService}
                    quote={quote ?? null}
                    providerId={providerId}
                    locale={locale}
                    onOpenConsultation={services.onOpenConsultation}
                  />
                );
              default:
                return null;
            }
          })}
        </div>
      ) : (
        <div className="text-xs text-neutral-600">{t('configure.instructions.markCorners')}</div>
      )}
    </aside>
  );
}

function SegmentsControl({
  segmentCount,
  onSegmentCountChange,
  formatNumber,
  t,
}: {
  segmentCount: number;
  onSegmentCountChange: (value: number) => void;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  t: FiltersPanelProps['t'];
}) {
  const minSegments = 1;
  const maxSegments = 4;
  const sliderPercent = ((segmentCount - minSegments) / Math.max(1, maxSegments - minSegments)) * 100;
  const sliderStyle = {
    accentColor: 'var(--active-accent)',
    '--slider-progress': `${sliderPercent}%`,
  } as CSSProperties & Record<string, string>;

  return (
    <div className="mb-[18px]">
      <div className="panel-heading">{t('configure.controls.segmentsLabel', { count: formatNumber(segmentCount) })}</div>
      <input
        type="range"
        min={minSegments}
        max={maxSegments}
        step={1}
        value={segmentCount}
        onChange={(e) => onSegmentCountChange(Number(e.target.value))}
        className="cw-slider mt-2 w-full"
        style={sliderStyle}
      />
    </div>
  );
}

function BudgetPerMeterSection({
  t,
  formatter,
  budget,
}: {
  t: FiltersPanelProps['t'];
  formatter: Intl.NumberFormat;
  budget: BudgetSectionProps;
}) {
  const { min, max, valueMin, valueMax, isNoFilter, isAnyPrice, setUiRange, commitRange } = budget;
  const lo = Math.min(valueMin, valueMax);
  const hi = Math.max(valueMin, valueMax);

  const label = isNoFilter
    ? t('configure.budget.anyPrice')
    : isAnyPrice
    ? t('configure.budget.highPerM', { min: formatter.format(lo) })
    : t('configure.budget.rangePerM', { min: formatter.format(lo), max: formatter.format(hi) });

  return (
    <div className="mb-[18px]">
      <div className="panel-heading">{t('configure.panel.budgetPerMeter')}</div>
      <div className="mb-2 flex flex-wrap items-center gap-2.5">
        <div className="text-xs font-semibold text-[#1e293b]">{label}</div>
      </div>
      <RangeSlider
        min={min}
        max={max}
        step={5}
        value={[Math.min(valueMin, valueMax), Math.max(valueMin, valueMax)]}
        onChange={([loVal, hiVal]) => {
          const sorted: [number, number] = [Math.min(loVal, hiVal), Math.max(loVal, hiVal)];
          setUiRange(sorted);
        }}
        onCommit={([loVal, hiVal]) => {
          const sorted: [number, number] = [Math.min(loVal, hiVal), Math.max(loVal, hiVal)];
          commitRange(sorted);
        }}
      />
    </div>
  );
}

function FabricTypeSection({
  t,
  fabricTypes,
  selectedFabricTypeId,
  onSelect,
  isMobile,
  fabricCountByType,
}: FabricTypeSectionProps & { t: FiltersPanelProps['t']; isMobile: boolean }) {
  const selectedIndex = fabricTypes.findIndex((type) => type.id === selectedFabricTypeId);
  const selectedType = fabricTypes.find((type) => type.id === selectedFabricTypeId);

  return (
    <div className="mb-[18px]">
      <CollapsibleSection
        title={t('configure.panel.fabricType')}
        itemCount={fabricTypes.length}
        defaultCollapsed={false}
      >
        {isMobile ? (
          <HorizontalCarousel
            items={fabricTypes}
            visibleCount={fabricTypes.length >= 5 ? 5 : 3}
            selectedIndex={selectedIndex >= 0 ? selectedIndex : 0}
            onSelect={(type) => onSelect(type.id)}
            itemSize={96}
            gap={12}
            renderItem={(type, idx, isCenter, scale) => {
              const labelKey = `configure.fabricTypes.catalog.${type.id}.label`;
              const descriptionKey = `configure.fabricTypes.catalog.${type.id}.description`;
              const translatedLabel = t(labelKey);
              const translatedDescription = t(descriptionKey);
              const displayLabel = translatedLabel === labelKey ? type.label : translatedLabel;
              const displayDescription = translatedDescription === descriptionKey ? type.description ?? '' : translatedDescription;
              const count = fabricCountByType?.[type.id] ?? 0;

              return (
                <Chip
                  selected={isCenter}
                  onClick={() => onSelect(type.id)}
                  title={displayDescription || displayLabel}
                  className="transition-transform duration-200"
                >
                  {displayLabel} <span className="opacity-60 text-[0.9em]">({count})</span>
                </Chip>
              );
            }}
          />
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {fabricTypes.map((type) => {
              const labelKey = `configure.fabricTypes.catalog.${type.id}.label`;
              const descriptionKey = `configure.fabricTypes.catalog.${type.id}.description`;
              const translatedLabel = t(labelKey);
              const translatedDescription = t(descriptionKey);
              const displayLabel = translatedLabel === labelKey ? type.label : translatedLabel;
              const displayDescription = translatedDescription === descriptionKey ? type.description ?? '' : translatedDescription;
              const count = fabricCountByType?.[type.id] ?? 0;

              return (
                <Chip
                  key={type.id}
                  selected={type.id === selectedFabricTypeId}
                  onClick={() => onSelect(type.id)}
                  title={displayDescription || displayLabel}
                  className="transition-transform duration-200"
                >
                  {displayLabel} <span className="opacity-60 text-[0.9em]">({count})</span>
                </Chip>
              );
            })}
          </div>
        )}
        {selectedType && (() => {
          const descriptionKey = `configure.fabricTypes.catalog.${selectedType.id}.description`;
          const translatedDescription = t(descriptionKey);
          const displayDescription =
            translatedDescription === descriptionKey ? selectedType.description ?? '' : translatedDescription;
          if (!displayDescription) return null;
          return <div className="mt-2 text-xs text-neutral-600">{displayDescription}</div>;
        })()}
      </CollapsibleSection>
    </div>
  );
}

function FabricsSection({
  t,
  fabricCatalog,
}: {
  t: FiltersPanelProps['t'];
  fabricCatalog: FabricCatalogProps;
}) {
  const {
    fabrics,
    selectedFabricId,
    onSelectFabric,
    selectedColor,
    onSelectColor,
    onSelectChildItem,
    getChildItems,
    ensureImage,
    cancelHoverClear,
    scheduleHoverClear,
    resetHoverBaseUrl,
    setHoverTextureUrl,
    enableTextureHoverPreview = true,
    setHoveredChipKey,
    hoveredChipKey,
    setStitchChipHovering,
  } = fabricCatalog;

  // @ts-ignore
  return (
    <div className="mb-[18px]">
      <CollapsibleSection
        title={t('configure.panel.fabrics')}
        itemCount={fabrics.length}
        defaultCollapsed={false}
      >
        {fabrics.length === 0 ? (
          <div className="text-xs text-neutral-500">{t('configure.panel.noFabricsForBudget')}</div>
        ) : (
          <div
            className="flex flex-col gap-2.5"
            onMouseEnter={() => {
              cancelHoverClear();
            }}
            onMouseLeave={() => {
              scheduleHoverClear(80);
              setHoveredChipKey(null);
              setStitchChipHovering(false);
            }}
            >
            {fabrics
            .filter((f) => !((f.sku ?? '').includes('SERVICE')))
            .map((fabric) => {
              const filteredColors = getChildItems(fabric);
              return (
                <FabricCard
                  key={fabric.id}
                  fabric={fabric}
                  filteredColors={filteredColors}
                  selectedFabricId={selectedFabricId}
                  selectedColor={selectedColor}
                  onSelectFabric={onSelectFabric}
                  onSelectColor={onSelectColor}
                  onSelectChildItem={onSelectChildItem}
                  cancelHoverClear={cancelHoverClear}
                  resetHoverBaseUrl={resetHoverBaseUrl}
                  ensureImage={ensureImage}
                  setHoverTextureUrl={setHoverTextureUrl}
                  enableTextureHoverPreview={enableTextureHoverPreview}
                  setHoveredChipKey={setHoveredChipKey}
                  hoveredChipKey={hoveredChipKey}
                  setStitchChipHovering={setStitchChipHovering}
                  t={t}
                />
              );
            })}
        </div>
        )}
      </CollapsibleSection>
    </div>
  );
}

function FabricCard({
  fabric,
  filteredColors,
  selectedFabricId,
  selectedColor,
  onSelectFabric,
  onSelectColor,
  onSelectChildItem,
  cancelHoverClear,
  resetHoverBaseUrl,
  ensureImage,
  setHoverTextureUrl,
  enableTextureHoverPreview,
  setHoveredChipKey,
  hoveredChipKey,
  setStitchChipHovering,
  t,
}: {
  fabric: Fabric;
  filteredColors: ChildItem[];
  selectedFabricId: string | null;
  selectedColor: string | null;
  onSelectFabric: (id: string) => void;
  onSelectColor: (color: string) => void;
  onSelectChildItem: (childItem: ChildItem) => void;
  cancelHoverClear: () => void;
  resetHoverBaseUrl: () => void;
  ensureImage: (url: string | null) => Promise<boolean>;
  setHoverTextureUrl: (url: string | null) => void;
  enableTextureHoverPreview: boolean;
  setHoveredChipKey: (value: string | null) => void;
  hoveredChipKey: string | null;
  setStitchChipHovering: (value: boolean) => void;
  t: FiltersPanelProps['t'];
}) {
  const [showInfo, setShowInfo] = useState(false);
  const shortDesc = fabric.short_description?.replace(/<[^>]*>/g, '').trim();
  const description = shortDesc || ((typeof fabric.pattern === 'string' || (fabric.pattern as any) instanceof String) ? (fabric.pattern as any).replace(/\b\w/g, (c: any) => c.toUpperCase()) : t('configure.panel.patternPlain'));

  return (
    <div
      role="button"
      tabIndex={0}
      data-fabric-card={fabric.id}
      className="rounded-lg border border-neutral-200/60 bg-white/40 p-3 transition-all hover:border-neutral-300/80 hover:bg-white/50 cursor-pointer"
      onClick={() => {
        const firstColor = filteredColors[0];
        if (firstColor) {
          onSelectFabric(fabric.id);
          onSelectColor(firstColor.color_label);
          onSelectChildItem(firstColor);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const firstColor = filteredColors[0];
          if (firstColor) {
            onSelectFabric(fabric.id);
            onSelectColor(firstColor.color_label);
            onSelectChildItem(firstColor);
          }
        }
      }}
      onMouseEnter={() => {
        cancelHoverClear();
        if (!enableTextureHoverPreview) return;
        const defaultChildColor = filteredColors[0]?.color_label ?? fabric.colors?.[0] ?? null;
        const baseColor = fabric.id === selectedFabricId && selectedColor ? selectedColor : defaultChildColor;
        const preferred =
          (baseColor && fabric.textureByColor?.[baseColor]) || fabric.textureUrl || fabric.thumbnails?.[0] || null;
        if (fabric.colors && fabric.colors.length) {
          for (const c of fabric.colors) {
            const u = fabric.textureByColor?.[c] || fabric.textureUrl || fabric.thumbnails?.[0] || null;
            void ensureImage(u);
          }
        } else {
          void ensureImage(fabric.textureUrl || fabric.thumbnails?.[0] || null);
        }
        resetHoverBaseUrl();
        if (preferred) {
          void ensureImage(preferred);
        }
      }}
    >
      {/* Row 1: Name + Info icon + Color swatches - all in one flex-wrap row */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {/* Name + Info icon group - stays together, doesn't wrap between them */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="font-semibold text-sm text-neutral-900">{fabric.name}</span>
          {description && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowInfo(!showInfo);
              }}
              className={cn(
                'flex-shrink-0 -ml-0.5 w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-active-accent/40',
                showInfo
                  ? 'bg-active-accent text-white'
                  : 'bg-neutral-100/20 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900'
              )}
              aria-label={t('configure.panel.toggleInfo')}
            >
              <Info size={18} strokeWidth={1.25} aria-hidden="true" />
            </button>
          )}
        </div>
        {/* Color swatches - wrap to next line if needed */}
        <div className="flex flex-wrap gap-0.5 items-center">
          {filteredColors.map((childItem) => {
            const isSelected = fabric.id === selectedFabricId && childItem.color_label === selectedColor;
            return (
              <Chip
                key={childItem.color_label}
                sku={childItem.sku}
                name={childItem.name}
                variant="swatch"
                selected={isSelected}
                className="transition-all"
                style={{
                  transform: hoveredChipKey === `${fabric.id}:${childItem.color_label}` ? 'scale(1.08)' : undefined,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (enableTextureHoverPreview) setHoverTextureUrl(null);
                  setHoveredChipKey(null);
                  onSelectFabric(fabric.id);
                  onSelectColor(childItem.color_label);
                  onSelectChildItem(childItem);
                }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setStitchChipHovering(true);
                  setHoveredChipKey(`${fabric.id}:${childItem.color_label}`);
                  if (!enableTextureHoverPreview) return;
                  if (isSelected) {
                    setHoverTextureUrl(null);
                    return;
                  }
                  const url =
                    fabric.textureByColor?.[childItem.color_label] || fabric.textureUrl || fabric.thumbnails?.[0] || null;
                  void ensureImage(url).then((ok) => {
                    if (ok) setHoverTextureUrl(url);
                  });
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  setStitchChipHovering(false);
                  if (enableTextureHoverPreview) setHoverTextureUrl(null);
                  setHoveredChipKey(null);
                }}
              >
                <span
                  className="inline-block w-6 h-6 rounded-full"
                  style={{ backgroundColor: childItem.color }}
                  title={childItem.name}
                />
              </Chip>
            );
          })}
        </div>
      </div>
      {/* Row 2: Description - full width below name and swatches */}
      {showInfo && description && (
        <div className="text-[11px] text-neutral-500 mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {description}
        </div>
      )}
    </div>
  );
}

function StyleSection({
  t,
  availableStyles,
  fabricCountByStyle,
  selectedStyle,
  setSelectedStyle,
}: {
  t: FiltersPanelProps['t'];
  availableStyles: StyleOption[];
  fabricCountByStyle: Record<string, number>;
  selectedStyle: StyleOption | null;
  setSelectedStyle: (style: StyleOption) => void;
}) {
  const totalCount = availableStyles.length - 1;
  
  return (
    <div className="mb-[18px]">
      <CollapsibleSection
        title={t('configure.panel.style')}
        itemCount={totalCount}
        defaultCollapsed={false}
      >
        <div className="flex flex-wrap gap-2">
          {availableStyles.map((style) => {
            const count = fabricCountByStyle[style] ?? 0;
            const labelKey = `configure.styles.${style}` as const;
            const label = t(labelKey);
            return (
              <Chip
                key={style}
                selected={selectedStyle === style}
                onClick={() => setSelectedStyle(style)}
                title={label}
              >
                {label} <span className="opacity-60 text-[0.9em]">({count})</span>
              </Chip>
            );
          })}
        </div>
      </CollapsibleSection>
    </div>
  );
}

function ColorCategorySection({
  t,
  availableColorCategories,
  fabricCountByColorCategory,
  selectedColorCategory,
  setSelectedColorCategory,
}: {
  t: FiltersPanelProps['t'];
  availableColorCategories: ColorCategoryOption[];
  fabricCountByColorCategory: Record<string, number>;
  selectedColorCategory: ColorCategoryOption | null;
  setSelectedColorCategory: (category: ColorCategoryOption) => void;
}) {
  const totalCount = availableColorCategories.length - 1;
  
  return (
    <div className="mb-[18px]">
      <CollapsibleSection
        title={t('configure.panel.colorCategory')}
        itemCount={totalCount}
        defaultCollapsed={false}
      >
        <div className="flex flex-wrap gap-2">
          {availableColorCategories.map((category) => {
            const count = fabricCountByColorCategory[category] ?? 0;
            const labelKey = `configure.colorCategories.${category}` as const;
            const label = t(labelKey);
            return (
              <Chip
                key={category}
                selected={selectedColorCategory === category}
                onClick={() => setSelectedColorCategory(category)}
                title={label}
              >
                {label} <span className="opacity-60 text-[0.9em]">({count})</span>
              </Chip>
            );
          })}
        </div>
      </CollapsibleSection>
    </div>
  );
}

function PleatingSection({
  t,
  pleats,
  selectedPleatId,
  onSelect,
}: PleatingProps & { t: FiltersPanelProps['t'] }) {
  return (
    <div className="mb-[18px]">
      <CollapsibleSection
        title={t('configure.panel.pleating')}
        itemCount={pleats.length}
        defaultCollapsed={false}
      >
        <div className="flex flex-wrap gap-2">
          {pleats.map((pleat) => {
            const labelKey = `configure.pleats.catalog.${pleat.id}.label` as const;
            const translatedLabel = t(labelKey);
            const displayLabel = translatedLabel === labelKey ? pleat.label : translatedLabel;
            return (
              <Chip
                key={pleat.id}
                selected={pleat.id === selectedPleatId}
                onClick={() => onSelect(pleat.id)}
              >
                {displayLabel}
              </Chip>
            );
          })}
        </div>
      </CollapsibleSection>
    </div>
  );
}

function HemSection({
  t,
  hems,
  selectedHemId,
  onSelect,
}: HemProps & { t: FiltersPanelProps['t'] }) {
  return (
    <div className="mb-[18px]">
      <CollapsibleSection
        title={t('configure.panel.hem')}
        itemCount={hems.length}
        defaultCollapsed={false}
      >
        {hems.length === 0 ? (
          <div className="text-xs text-neutral-500">{t('configure.panel.noOptions')}</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {hems.map((hem) => (
              <Chip
                key={hem.id}
                selected={hem.id === selectedHemId}
                onClick={() => onSelect(hem.id)}
              >
                {hem.label}
              </Chip>
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
