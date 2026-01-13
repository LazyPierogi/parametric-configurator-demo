import type { FabricType, Fabric, PleatOption, HemOption, ServiceOption } from '../types';
import { resolveCatalogAssetUrl } from '../lib/assets';

const asset = (path: string) => resolveCatalogAssetUrl(path);

export type MockPricingRule = {
  id: string;
  fabricId: string;
  colorId?: string;
  pleatId?: string;
  hemId?: string;
  pricePerMLinearMinor?: number; // Price per linear meter in major units (e.g., 76.00 PLN)
  pleatSurchargePerSegmentMinor?: number; // Surcharge per segment in major units (e.g., 1.20 PLN)
  hemSurchargeMinor?: number; // Flat hem surcharge in major units (e.g., 13.00 PLN)
  fabricSurchargeMinor?: number; // Flat fabric surcharge in major units (e.g., 10.00 PLN)
  laborPerWidthMinorByPleat?: Record<string, number>; // Deprecated: use mockCatalog.labor instead
};

type MockPricingModel = {
  currency: string;
  rules: MockPricingRule[];
};

type MockLaborCosts = {
  currency: string;
  perWidthByPleat: Record<string, number>; // Labor cost per width in major units (e.g., 8.00 PLN)
};

export type MockCatalog = {
  fabricTypes: FabricType[];
  fabrics: Fabric[];
  pleats: PleatOption[];
  hems: HemOption[];
  services: (ServiceOption & { sku: string })[];
  pricing: MockPricingModel;
  labor: MockLaborCosts;
  defaults: {
    fabricTypeId: string;
    fabricId: string;
    pleatId: string;
    hemId: string;
  };
};

export const mockCatalog: MockCatalog = {
  fabricTypes: [
    {
      id: 'all',
      label: 'All Fabrics',
      description: 'Browse the entire catalog without filtering by type.',
      default: true,
    },
    {
      id: 'light',
      label: 'Light',
      description: 'Sheers and lightweight drapes that softly filter light.',
      compatiblePleats: ['wave', 'tab', 'ring'],
    },
    {
      id: 'heavy',
      label: 'Heavy',
      description: 'Room-darkening drapes with luxurious texture.',
      compatiblePleats: ['wave', 'flex', 'doubleFlex', 'ring'],
    },
    {
      id: 'blackout',
      label: 'Blackout',
      description: 'Completely blocks light for maximum privacy and darkness.',
      compatiblePleats: ['wave', 'flex', 'doubleFlex', 'ring'],
    },
  ],
  fabrics: [
    {
      id: 'fab-plain-sheer-150',
      typeId: 'light',
      name: 'Plain Sheer 150',
      pattern: 'plain',
      colors: ['snow', 'ivory', 'stone'],
      childItems: [
        {color: '#FFFAFA', color_label: 'snow', sku: 'CW-FAB-PLAIN-SHEER-150-SNOW', name: 'Snow', price: 0, colorCategories: ['bright']},
        {color: '#FFFFF0', color_label: 'ivory', sku: 'CW-FAB-PLAIN-SHEER-150-IVORY', name: 'Ivory', price: 0, colorCategories: ['bright', 'cold']},
        {color: '#B8B8A8', color_label: 'stone', sku: 'CW-FAB-PLAIN-SHEER-150-STONE', name: 'Stone', price: 0, colorCategories: ['grey', 'cold']},
      ],
      colorSkuByColor: {
        snow: 'CW-FAB-PLAIN-SHEER-150-SNOW',
        ivory: 'CW-FAB-PLAIN-SHEER-150-IVORY',
        stone: 'CW-FAB-PLAIN-SHEER-150-STONE',
      },
      style: 'basic',
      colorCategory: 'bright', // Fallback for fabrics without child items
      swatchUrl: asset('swatches/plain-sheer-150.webp'),
      thumbnails: [asset('thumbs/plain-sheer-150.webp')],
      textureByColor: {
        snow: asset('textures/plain-sheer-150-snow.webp'),
        ivory: asset('textures/plain-sheer-150-ivory.webp'),
        stone: asset('textures/plain-sheer-150-stone.webp'),
      },
      textureDefaults: {tileWidthPx: 200, opacityPct: 100},
      materialFamily: 'sheer-basic',
      fabricWidthCm: 150,
      isDoubleWidth: false, // Deprecated: kept for backward compatibility
      isRailroadable: false, // Deprecated: all fabrics now cut vertically
      verticalRepeatCm: 0,
      repeatType: 'straight',
      minOrderIncrementCm: 10,
      allowancesCm: {top: 5, bottom: 2, side: 2, stitch: 2},
      shrinkagePct: 2,
      fullnessByPleat: {wave: 2.2, tab: 2.0, ring: 2.1},
      compatiblePleats: ['wave', 'tab', 'ring'],
      availableHems: ['hem-2cm', 'hem-5cm', 'hem-10cm'],
      sku: 'CW-FAB-PLAIN-SHEER-150',
      hemSurchargeMinor: 0,
      pleatSurchargePerSegmentMinor: 0
    },
    {
      id: 'fab-linen-300',
      typeId: 'heavy',
      name: 'Linen 300',
      pattern: 'plain',
      colors: ['sage', 'lilly', 'sand'],
      childItems: [
        {color: '#9CAF88', color_label: 'sage', sku: 'CW-FAB-LINEN-300-SAGE', name: 'Sage', price: 0, colorCategories: ['colored', 'natural']},
        {color: '#E0BBE4', color_label: 'lilly', sku: 'CW-FAB-LINEN-300-LILLY', name: 'Lilly', price: 0, colorCategories: ['bright', 'warm']},
        {color: '#C2B280', color_label: 'sand', sku: 'CW-FAB-LINEN-300-SAND', name: 'Sand', price: 0, colorCategories: ['grey', 'warm']},
      ],
      colorSkuByColor: {
        sage: 'CW-FAB-LINEN-300-SAGE',
        lilly: 'CW-FAB-LINEN-300-LILLY',
        sand: 'CW-FAB-LINEN-300-SAND',
      },
      style: 'natural',
      colorCategory: 'colored', // Fallback for fabrics without child items
      swatchUrl: asset('swatches/linen-300.webp'),
      thumbnails: [asset('thumbs/linen-300.webp')],
      textureByColor: {
        sage: asset('textures/linen-300-sage.webp'),
        lilly: asset('textures/linen-300-lilly.webp'),
        sand: asset('textures/linen-300-sand.webp'),
      },
      textureDefaults: {tileWidthPx: 200, opacityPct: 95},
      materialFamily: 'curtain-linen',
      fabricWidthCm: 300,
      isDoubleWidth: true, // Deprecated: kept for backward compatibility
      isRailroadable: true, // Deprecated: all fabrics now cut vertically
      verticalRepeatCm: 0,
      repeatType: 'straight',
      minOrderIncrementCm: 10,
      allowancesCm: {top: 5, bottom: 10, side: 2, stitch: 2},
      shrinkagePct: 2,
      compatiblePleats: ['wave', 'flex', 'doubleFlex', 'tunnel', 'ring', 'tab'],
      availableHems: ['hem-2cm', 'hem-5cm', 'hem-10cm'],
      sku: 'CW-FAB-LINEN-300',
      hemSurchargeMinor: 0,
      pleatSurchargePerSegmentMinor: 0
    },
    {
      id: 'fab-pattern-hd-150',
      typeId: 'heavy',
      name: 'Patterned Jacquard 150 (Half-drop)',
      pattern: 'patterned',
      colors: ['midnight', 'silver'],
      childItems: [
        {color: '#191970', color_label: 'midnight', sku: 'CW-FAB-PATTERN-HD-150-MIDNIGHT', name: 'Midnight', price: 0, colorCategories: ['dark']},
        {color: '#C0C0C0', color_label: 'silver', sku: 'CW-FAB-PATTERN-HD-150-SILVER', name: 'Silver', price: 0, colorCategories: ['grey']},
      ],
      colorSkuByColor: {
        midnight: 'CW-FAB-PATTERN-HD-150-MIDNIGHT',
        silver: 'CW-FAB-PATTERN-HD-150-SILVER',
      },
      style: 'natural',
      colorCategory: 'patterned', // Fallback for fabrics without child items
      swatchUrl: asset('swatches/pattern-hd-150.webp'),
      thumbnails: [asset('thumbs/pattern-hd-150.webp')],
      textureByColor: {
        midnight: asset('textures/pattern-hd-150-midnight.webp'),
        silver: asset('textures/pattern-hd-150-silver.webp'),
      },
      textureDefaults: {tileWidthPx: 200, opacityPct: 100},
      materialFamily: 'curtain-basic',
      fabricWidthCm: 150,
      isDoubleWidth: false, // Deprecated: kept for backward compatibility
      isRailroadable: false, // Deprecated: all fabrics now cut vertically
      verticalRepeatCm: 32,
      repeatType: 'half-drop',
      minOrderIncrementCm: 10,
      allowancesCm: {top: 5, bottom: 10, side: 2, stitch: 2},
      shrinkagePct: 2,
      fullnessByPleat: {wave: 2.3, flex: 2.5, ring: 2.2},
      compatiblePleats: ['wave', 'flex', 'ring'],
      availableHems: ['hem-2cm', 'hem-5cm', 'hem-10cm'],
      sku: 'CW-FAB-PATTERN-HD-150',
      hemSurchargeMinor: 0,
      pleatSurchargePerSegmentMinor: 0
    },
    {
      id: 'fab-blackout-280',
      typeId: 'blackout',
      name: 'Blackout Premium 280',
      pattern: 'plain',
      colors: ['charcoal', 'navy', 'cream'],
      childItems: [
        {color: '#36454F', color_label: 'charcoal', sku: 'CW-FAB-BLACKOUT-280-CHARCOAL', name: 'Charcoal', price: 0, colorCategories: ['dark']},
        {color: '#000080', color_label: 'navy', sku: 'CW-FAB-BLACKOUT-280-NAVY', name: 'Navy', price: 0, colorCategories: ['dark']},
        {color: '#FFFDD0', color_label: 'cream', sku: 'CW-FAB-BLACKOUT-280-CREAM', name: 'Cream', price: 0, colorCategories: ['bright']},
      ],
      colorSkuByColor: {
        charcoal: 'CW-FAB-BLACKOUT-280-CHARCOAL',
        navy: 'CW-FAB-BLACKOUT-280-NAVY',
        cream: 'CW-FAB-BLACKOUT-280-CREAM',
      },
      style: 'basic',
      colorCategory: 'dark', // Fallback for fabrics without child items
      swatchUrl: asset('swatches/blackout-280.webp'),
      thumbnails: [asset('thumbs/blackout-280.webp')],
      textureByColor: {
        charcoal: asset('textures/blackout-280-charcoal.webp'),
        navy: asset('textures/blackout-280-navy.webp'),
        cream: asset('textures/blackout-280-cream.webp'),
      },
      textureDefaults: {tileWidthPx: 200, opacityPct: 100},
      materialFamily: 'blackout-basic',
      fabricWidthCm: 280,
      isDoubleWidth: true, // Deprecated: kept for backward compatibility
      isRailroadable: false, // Deprecated: all fabrics now cut vertically
      verticalRepeatCm: 0,
      repeatType: 'straight',
      minOrderIncrementCm: 10,
      allowancesCm: {top: 5, bottom: 10, side: 2, stitch: 2},
      shrinkagePct: 2,
      fullnessByPleat: {wave: 2.0, flex: 2.2, ring: 2.0},
      compatiblePleats: ['wave', 'flex', 'ring'],
      availableHems: ['hem-2cm', 'hem-5cm', 'hem-10cm'],
      sku: 'CW-FAB-BLACKOUT-280',
      hemSurchargeMinor: 0,
      pleatSurchargePerSegmentMinor: 0
    },
  ],
  pleats: [
    { id: 'wave', label: 'Wave', description: 'Soft, even waves along the rail.', techImg: asset('tech/pleat-wave.svg') },
    { id: 'flex', label: 'Flex', description: 'Premium flex system for thick drapes.', techImg: asset('tech/pleat-flex.svg') },
    { id: 'doubleFlex', label: 'Double Flex', description: 'Premium double flex system for thick drapes.', techImg: asset('tech/pleat-flex.svg') },
  ],
  hems: [
    //{ id: 'hem-2cm', label: '2 cm', description: 'Minimal hem for lightweight fabrics.' },
    { id: 'hem-5cm', label: '5 cm', description: 'Standard hem for most curtains.' },
    //{ id: 'hem-10cm', label: '10 cm', description: 'Deep hem for heavy drapes.' },
  ],
  services: [
    {
      id: 'svc-measure',
      label: 'Measurement Visit',
      description: 'Professional onsite measurement to guarantee fit.',
      priceMinor: 14900, // 149.00 PLN in minor units (cents)
      currency: 'PLN',
      sku: 'CW-SVC-MEASURE',
    },
    {
      id: 'svc-install-waw',
      label: 'Pro Installation (Warsaw)',
      description: 'Installation crew available within Warsaw city limits.',
      priceMinor: 24900, // 249.00 PLN in minor units (cents)
      currency: 'PLN',
      availabilityRegion: 'Warsaw',
      sku: 'CW-SVC-INSTALL-WAW',
    },
    {
      id: 'svc-rod-basic',
      label: 'Curtain Rod (Basic)',
      description: 'Powder-coated rod with adjustable width and brackets.',
      priceMinor: 9900, // 99.00 PLN in minor units (cents)
      currency: 'PLN',
      sku: 'CW-HW-ROD-BASIC',
    },
    {
      id: 'svc-stylist',
      label: 'Consult Stylist',
      description: 'Expert consultation on fabric selection and interior design.',
      priceMinor: 19900, // 199.00 PLN in minor units (cents)
      currency: 'PLN',
      sku: 'CW-SVC-STYLIST',
    },
  ],
  pricing: {
    currency: 'PLN',
    rules: [
      {
        id: 'rule-plain-sheer',
        fabricId: 'fab-plain-sheer-150',
        pricePerMLinearMinor: 76.00,
        pleatSurchargePerSegmentMinor: 1.20,
      },
      {
        id: 'rule-linen',
        fabricId: 'fab-linen-300',
        pricePerMLinearMinor: 69.00,
        pleatSurchargePerSegmentMinor: 2.20,
        hemSurchargeMinor: 13.00,
      },
      // Color-specific rule demo: Lilly color carries a slightly higher price per metre
      {
        id: 'rule-linen-lilly',
        fabricId: 'fab-linen-300',
        colorId: 'lilly',
        pricePerMLinearMinor: 139.00,
        pleatSurchargePerSegmentMinor: 2.20,
        hemSurchargeMinor: 13.00,
      },
      {
        id: 'rule-pattern-hd',
        fabricId: 'fab-pattern-hd-150',
        pricePerMLinearMinor: 155.00,
        pleatSurchargePerSegmentMinor: 2.60,
        hemSurchargeMinor: 15.00,
      },
      {
        id: 'rule-blackout',
        fabricId: 'fab-blackout-280',
        pricePerMLinearMinor: 189.00,
        pleatSurchargePerSegmentMinor: 2.80,
        hemSurchargeMinor: 16.00,
      },
    ],
  },
  labor: {
    currency: 'PLN',
    perWidthByPleat: {
      wave: 8.00,
      flex: 9.00,
      ring: 7.50,
      tunnel: 6.00,
      tab: 7.00,
    },
  },
  defaults: {
    fabricTypeId: 'light',
    fabricId: 'fab-plain-sheer-150',
    pleatId: 'wave',
    hemId: 'hem-2cm',
  },
};

// (type already exported above)
