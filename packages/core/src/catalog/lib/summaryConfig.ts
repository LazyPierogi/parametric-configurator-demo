/**
 * Summary Panel Configuration
 * 
 * Defines which fields are shown in the configurator summary panel.
 * Can be overridden via environment variables for A/B testing.
 */

export type SummaryFieldKey =
  // Core selection
  | 'fabric'
  | 'color'
  | 'pleat'
  | 'hem'
  | 'services'
  // Dimensions
  | 'dimensions'
  | 'height'
  | 'cutDrop'
  // Material calculation
  | 'fabricOrdered'
  | 'boltWidths'
  | 'fullness'
  | 'widthsPerSegment'
  // Production details
  | 'shrinkage'
  | 'allowances'
  | 'repeat'
  | 'stitchLines'
  // Price breakdown
  | 'breakdown'
  // Constraints
  | 'constraints';

export type SummaryFieldConfig = {
  enabled: boolean;
  order?: number;
};

export type SummaryConfig = {
  [K in SummaryFieldKey]?: SummaryFieldConfig;
};

/**
 * Default configuration - all fields enabled by default
 */
export const defaultSummaryConfig: SummaryConfig = {
  // Core selection (always show)
  fabric: { enabled: true, order: 1 },
  color: { enabled: true, order: 2 },
  pleat: { enabled: true, order: 3 },
  hem: { enabled: true, order: 4 },
  services: { enabled: true, order: 5 },
  
  // Dimensions (detailed view)
  dimensions: { enabled: true, order: 10 },
  height: { enabled: true, order: 11 },
  cutDrop: { enabled: true, order: 12 },
  
  // Material calculation
  fabricOrdered: { enabled: true, order: 20 },
  boltWidths: { enabled: true, order: 21 },
  fullness: { enabled: true, order: 22 },
  widthsPerSegment: { enabled: true, order: 23 },
  
  // Production details
  shrinkage: { enabled: true, order: 30 },
  allowances: { enabled: true, order: 31 },
  repeat: { enabled: true, order: 32 },
  stitchLines: { enabled: true, order: 33 },
  
  // Price breakdown
  breakdown: { enabled: true, order: 40 },
  
  // Constraints
  constraints: { enabled: true, order: 50 },
};

/**
 * Parse environment variable override
 * Format: "fabric,color,pleat,hem,services,fabricOrdered,boltWidths"
 */
export function parseSummaryConfigFromEnv(envValue?: string): SummaryConfig | null {
  if (!envValue || typeof envValue !== 'string') return null;
  
  const keys = envValue
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  
  if (keys.length === 0) return null;
  
  // Start with all fields disabled
  const config: SummaryConfig = Object.keys(defaultSummaryConfig).reduce(
    (acc, key) => {
      acc[key as SummaryFieldKey] = { enabled: false };
      return acc;
    },
    {} as SummaryConfig
  );
  
  // Enable only specified keys
  keys.forEach((key, index) => {
    if (key in defaultSummaryConfig) {
      config[key as SummaryFieldKey] = { enabled: true, order: index };
    }
  });
  
  return config;
}

/**
 * Get merged configuration (env override + defaults)
 */
export function getSummaryConfig(envOverride?: string): SummaryConfig {
  const envConfig = parseSummaryConfigFromEnv(envOverride);
  return envConfig ?? defaultSummaryConfig;
}

/**
 * Check if a field is enabled
 */
export function isFieldEnabled(
  config: SummaryConfig,
  field: SummaryFieldKey
): boolean {
  return config[field]?.enabled ?? false;
}
