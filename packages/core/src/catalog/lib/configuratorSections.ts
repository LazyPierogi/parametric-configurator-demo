/**
 * Configurator Section Visibility Configuration (Task 904)
 * 
 * Defines which sections are shown in the configurator panel.
 * Can be overridden via environment variables for A/B testing.
 */

export type ConfiguratorSectionKey =
  | 'fabricType'
  | 'fabrics'
  | 'color'
  | 'style'
  | 'colorCategory'
  | 'pleating'
  | 'hem'
  | 'services'
  | 'budgetPerMeter';

export type ConfiguratorSectionConfig = {
  enabled: boolean;
  order?: number;
};

export type ConfiguratorSectionsConfig = {
  [K in ConfiguratorSectionKey]?: ConfiguratorSectionConfig;
};

/**
 * Default configuration - all sections enabled except budgetPerMeter (hidden per Task 904)
 */
export const defaultConfiguratorSections: ConfiguratorSectionsConfig = {
  fabricType: { enabled: true, order: 1 },
  fabrics: { enabled: true, order: 2 },
  color: { enabled: true, order: 3 },
  style: { enabled: true, order: 4 },
  colorCategory: { enabled: true, order: 5 },
  pleating: { enabled: true, order: 6 },
  hem: { enabled: true, order: 7 },
  services: { enabled: true, order: 8 },
  budgetPerMeter: { enabled: false, order: 9 }, // Hidden per Task 904 requirements
};

/**
 * Parse environment variable override
 * Format: "fabricType,fabrics,color,pleating,hem,services"
 */
export function parseConfiguratorSectionsFromEnv(envValue?: string): ConfiguratorSectionsConfig | null {
  if (!envValue || typeof envValue !== 'string') return null;
  
  const keys = envValue
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  
  if (keys.length === 0) return null;
  
  // Start with all sections disabled
  const config: ConfiguratorSectionsConfig = Object.keys(defaultConfiguratorSections).reduce(
    (acc, key) => {
      acc[key as ConfiguratorSectionKey] = { enabled: false };
      return acc;
    },
    {} as ConfiguratorSectionsConfig
  );
  
  // Enable only specified keys
  keys.forEach((key, index) => {
    if (key in defaultConfiguratorSections) {
      config[key as ConfiguratorSectionKey] = { enabled: true, order: index };
    }
  });
  
  return config;
}

/**
 * Get merged configuration (env override + defaults)
 */
export function getConfiguratorSections(envOverride?: string): ConfiguratorSectionsConfig {
  const envConfig = parseConfiguratorSectionsFromEnv(envOverride);
  return envConfig ?? defaultConfiguratorSections;
}

/**
 * Check if a section is enabled
 */
export function isSectionEnabled(
  config: ConfiguratorSectionsConfig,
  section: ConfiguratorSectionKey
): boolean {
  return config[section]?.enabled ?? false;
}

/**
 * Get enabled sections in display order
 * Returns array of section keys sorted by their order property
 */
export function getEnabledSectionsInOrder(
  config: ConfiguratorSectionsConfig
): ConfiguratorSectionKey[] {
  return (Object.keys(config) as ConfiguratorSectionKey[])
    .filter((key) => config[key]?.enabled)
    .sort((a, b) => {
      const orderA = config[a]?.order ?? 999;
      const orderB = config[b]?.order ?? 999;
      return orderA - orderB;
    });
}
