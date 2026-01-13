/**
 * Versioned Storage Keys
 * 
 * In development mode, storage keys are suffixed with a hash of APP_VERSION
 * so that each dev restart effectively gets a fresh storage namespace.
 * This prevents stale cached data from mixing with new code.
 * 
 * In production, keys are stable (version-check.ts handles cache invalidation).
 */
import { APP_VERSION } from './version';

// Simple hash for version suffix (short, deterministic)
function hashVersion(version: string): string {
  let hash = 0;
  for (let i = 0; i < version.length; i++) {
    const char = version.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36).slice(0, 6);
}

const VERSION_HASH = hashVersion(APP_VERSION);
const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Get a storage key, optionally versioned for dev mode.
 * @param baseKey - The base key name (e.g., 'cw_flow_payload_v1')
 * @param forceVersioned - If true, version even in production (default: only in dev)
 */
export function storageKey(baseKey: string, forceVersioned = false): string {
  if (IS_DEV || forceVersioned) {
    return `${baseKey}__${VERSION_HASH}`;
  }
  return baseKey;
}

// Pre-computed versioned keys for common use cases
export const STORAGE_KEYS = {
  // Session storage
  FLOW_STATE: storageKey('cw_flow_payload_v1'),
  LAST_UPLOADED: storageKey('cw_last_uploaded_segment_key_v1'),
  VERSION_LOADED: storageKey('cw-loaded-version'),
  REFRESH_ATTEMPTED: storageKey('cw-refresh-attempted'),
  
  // Local storage
  MEASUREMENT_CACHE: storageKey('cw_measure_cache_v1'),
  MEASUREMENT_OBSERVATIONS: storageKey('cw-measurement-observations'),
  PALETTE_PREFERENCE: storageKey('cw-palette-preference'),
  LOCALE_PREFERENCE: storageKey('cw-locale'),
  WELCOME_DISMISSED: storageKey('cw-welcome-dismissed'),
  
  // Segment cache (IndexedDB) - not versioned, uses its own cleanup
  SEGMENT_CACHE_DB: 'cw-segment-cache',
} as const;

// Log version info in dev for debugging
if (IS_DEV && typeof window !== 'undefined') {
  console.log(`[CW Dev] Storage keys versioned with hash: ${VERSION_HASH} (from ${APP_VERSION})`);
}
