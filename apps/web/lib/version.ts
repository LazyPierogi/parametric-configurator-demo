/**
 * Curtain Wizard Application Version
 * 
 * Update this version number with each deployment to help track
 * which version is running in the parent storefront iframe.
 * 
 * Version format: vYY.MM.patch
 * - YY: Year (2 digits)
 * - MM: Month (2 digits)
 * - patch: Sequential patch number within the month
 */
export const APP_VERSION = 'v.05.3.3';

const RAW_PUBLIC_ENV = {
  NEXT_PUBLIC_CONFIGURE_DEBUG_UI: process.env.NEXT_PUBLIC_CONFIGURE_DEBUG_UI,
  NEXT_PUBLIC_CONFIGURE_FALLBACK_LATEST: process.env.NEXT_PUBLIC_CONFIGURE_FALLBACK_LATEST,
  NEXT_PUBLIC_MAX_IMAGE_MB: process.env.NEXT_PUBLIC_MAX_IMAGE_MB,
  NEXT_PUBLIC_FLOW_AUTO_RETRIES: process.env.NEXT_PUBLIC_FLOW_AUTO_RETRIES,
  NEXT_PUBLIC_MEASURE_ENGINE_DEBUG: process.env.NEXT_PUBLIC_MEASURE_ENGINE_DEBUG,
  NEXT_PUBLIC_LIGHTING_ENABLED: process.env.NEXT_PUBLIC_LIGHTING_ENABLED,
  NEXT_PUBLIC_LIGHTING_MODE: process.env.NEXT_PUBLIC_LIGHTING_MODE,
  NEXT_PUBLIC_LIGHTING_OPACITY: process.env.NEXT_PUBLIC_LIGHTING_OPACITY,
  NEXT_PUBLIC_LIGHTING_GRID_X: process.env.NEXT_PUBLIC_LIGHTING_GRID_X,
  NEXT_PUBLIC_LIGHTING_GRID_Y: process.env.NEXT_PUBLIC_LIGHTING_GRID_Y,
  NEXT_PUBLIC_LIGHTING_THROTTLE_MS: process.env.NEXT_PUBLIC_LIGHTING_THROTTLE_MS,
  NEXT_PUBLIC_MATERIAL_REUSE_ENABLED: process.env.NEXT_PUBLIC_MATERIAL_REUSE_ENABLED,
  NEXT_PUBLIC_HANDLE_BG: process.env.NEXT_PUBLIC_HANDLE_BG,
  NEXT_PUBLIC_HANDLE_BORDER_HEX: process.env.NEXT_PUBLIC_HANDLE_BORDER_HEX,
  NEXT_PUBLIC_HANDLE_BORDER_OPACITY: process.env.NEXT_PUBLIC_HANDLE_BORDER_OPACITY,
  NEXT_PUBLIC_HANDLE_OPACITY: process.env.NEXT_PUBLIC_HANDLE_OPACITY,
  NEXT_PUBLIC_RING_HEX: process.env.NEXT_PUBLIC_RING_HEX,
  NEXT_PUBLIC_RING_OPACITY: process.env.NEXT_PUBLIC_RING_OPACITY,
  NEXT_PUBLIC_WALL_STROKE: process.env.NEXT_PUBLIC_WALL_STROKE,
  NEXT_PUBLIC_WALL_STROKE_OPACITY: process.env.NEXT_PUBLIC_WALL_STROKE_OPACITY,
  NEXT_PUBLIC_CATALOG_ASSET_BASE_URL: process.env.NEXT_PUBLIC_CATALOG_ASSET_BASE_URL,
  NEXT_PUBLIC_STOREFRONT_ORIGIN: process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN,
  NEXT_PUBLIC_STOREFRONT_CART_URL: process.env.NEXT_PUBLIC_STOREFRONT_CART_URL,
  NEXT_PUBLIC_STOREFRONT_TIMEOUT_MS: process.env.NEXT_PUBLIC_STOREFRONT_TIMEOUT_MS,
  NEXT_PUBLIC_SUMMARY_FIELDS: process.env.NEXT_PUBLIC_SUMMARY_FIELDS,
  NEXT_PUBLIC_CONFIGURATOR_SECTIONS: process.env.NEXT_PUBLIC_CONFIGURATOR_SECTIONS,
} satisfies Partial<Record<string, string | undefined>>;

export const PUBLIC_ENV = Object.fromEntries(
  Object.entries(RAW_PUBLIC_ENV).filter(([, value]) => typeof value !== 'undefined'),
) as Record<string, string>;

/**
 * Get all active environment variables for debugging.
 * Only includes NEXT_PUBLIC_* variables that are accessible client-side.
 */
export function getActiveEnvVariables(): Record<string, string> {
  const envVars: Record<string, string> = { ...PUBLIC_ENV };

  if (typeof window !== 'undefined') {
    const nextDataEnv = (window as any)?.__NEXT_DATA__?.env as Record<string, unknown> | undefined;
    if (nextDataEnv) {
      for (const [key, value] of Object.entries(nextDataEnv)) {
        if (key.startsWith('NEXT_PUBLIC_') && typeof value !== 'undefined') {
          envVars[key] = String(value);
        }
      }
    }

    const runtimeEnv = (window as any)?.__ENV__ as Record<string, unknown> | undefined;
    if (runtimeEnv) {
      for (const [key, value] of Object.entries(runtimeEnv)) {
        if (key.startsWith('NEXT_PUBLIC_') && typeof value !== 'undefined') {
          envVars[key] = String(value);
        }
      }
    }
  }

  return Object.fromEntries(
    Object.entries(envVars).filter(([, value]) => value !== undefined && value !== null),
  );
}

/**
 * Format environment variables as a readable string for display
 */
export function formatEnvVariables(vars: Record<string, string>): string {
  const sorted = Object.entries(vars).sort(([a], [b]) => a.localeCompare(b));
  return sorted.map(([key, value]) => `${key}=${value}`).join('\n');
}
