/**
 * Version Check - Detects stale cached HTML and forces refresh
 * 
 * Problem: Browser caches HTML with references to old JS chunks.
 * When new JS loads, it may be incompatible and crash the page.
 * 
 * Solution: Store current version in sessionStorage after successful load.
 * If the loaded version doesn't match stored version, force hard refresh.
 */

import { APP_VERSION } from './version';

const VERSION_KEY = 'cw-loaded-version';
const REFRESH_ATTEMPTED_KEY = 'cw-refresh-attempted';

/**
 * Check if the page needs a hard refresh due to version mismatch.
 * Call this early in the app lifecycle (e.g., in layout.tsx useEffect).
 * 
 * Returns true if refresh was triggered (page will reload).
 */
export function checkVersionAndRefresh(): boolean {
  if (typeof window === 'undefined') return false;
  
  try {
    const storedVersion = sessionStorage.getItem(VERSION_KEY);
    const refreshAttempted = sessionStorage.getItem(REFRESH_ATTEMPTED_KEY);
    
    // First visit or version matches - all good
    if (!storedVersion || storedVersion === APP_VERSION) {
      sessionStorage.setItem(VERSION_KEY, APP_VERSION);
      sessionStorage.removeItem(REFRESH_ATTEMPTED_KEY);
      return false;
    }
    
    // Version mismatch detected!
    // Prevent infinite refresh loop - only try once
    if (refreshAttempted === 'true') {
      console.warn(
        `[CW Version] Refresh already attempted. Stored: ${storedVersion}, Current: ${APP_VERSION}. ` +
        'Continuing with potentially mismatched version.'
      );
      sessionStorage.setItem(VERSION_KEY, APP_VERSION);
      sessionStorage.removeItem(REFRESH_ATTEMPTED_KEY);
      return false;
    }
    
    // Attempt hard refresh
    console.warn(
      `[CW Version] Version mismatch detected! Stored: ${storedVersion}, Current: ${APP_VERSION}. ` +
      'Forcing hard refresh to clear cache...'
    );
    
    sessionStorage.setItem(REFRESH_ATTEMPTED_KEY, 'true');
    
    // Hard refresh bypasses cache
    window.location.reload();
    return true;
  } catch (e) {
    // sessionStorage may be blocked in some contexts
    console.warn('[CW Version] Could not access sessionStorage:', e);
    return false;
  }
}

/**
 * Clear the version tracking (useful for debugging or forced refresh).
 */
export function clearVersionTracking(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(VERSION_KEY);
    sessionStorage.removeItem(REFRESH_ATTEMPTED_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Get debug info about version tracking state.
 */
export function getVersionTrackingInfo(): {
  currentVersion: string;
  storedVersion: string | null;
  refreshAttempted: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      currentVersion: APP_VERSION,
      storedVersion: null,
      refreshAttempted: false,
    };
  }
  
  try {
    return {
      currentVersion: APP_VERSION,
      storedVersion: sessionStorage.getItem(VERSION_KEY),
      refreshAttempted: sessionStorage.getItem(REFRESH_ATTEMPTED_KEY) === 'true',
    };
  } catch {
    return {
      currentVersion: APP_VERSION,
      storedVersion: null,
      refreshAttempted: false,
    };
  }
}
