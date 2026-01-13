/**
 * Cache Recovery Utilities
 * 
 * Provides tools to diagnose and recover from cache-related issues,
 * particularly IndexedDB corruption or blob URL failures in Safari/Opera.
 */

import { clearSegmentCache } from './segment-cache';
import { isOperaBrowser, isSafariBrowser } from './blob-url-fallback';

export type CacheHealthStatus = {
  healthy: boolean;
  issues: string[];
  recommendations: string[];
};

/**
 * Check if IndexedDB is accessible and working
 */
async function testIndexedDb(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return false;
  }

  try {
    const testDbName = 'cw-health-check';
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(testDbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('test')) {
          db.createObjectStore('test');
        }
      };
    });

    db.close();
    indexedDB.deleteDatabase(testDbName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if blob URLs work correctly
 */
async function testBlobUrls(): Promise<boolean> {
  try {
    // Create a test blob
    const testBlob = new Blob(['test'], { type: 'text/plain' });
    const blobUrl = URL.createObjectURL(testBlob);

    // Try to fetch it
    const response = await fetch(blobUrl);
    const text = await response.text();

    URL.revokeObjectURL(blobUrl);
    return text === 'test';
  } catch {
    return false;
  }
}

/**
 * Perform comprehensive cache health check
 */
export async function checkCacheHealth(): Promise<CacheHealthStatus> {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Test IndexedDB
  const idbOk = await testIndexedDb();
  if (!idbOk) {
    issues.push('IndexedDB is not accessible or corrupted');
    recommendations.push('Clear browser data for this site');
  }

  // Test blob URLs
  const blobOk = await testBlobUrls();
  if (!blobOk) {
    issues.push('Blob URLs are not working correctly');
    recommendations.push('Try a different browser (Chrome or Firefox)');
  }

  // Detect browsers with known IndexedDB blob URL bugs
  const opera = isOperaBrowser();
  const safari = isSafariBrowser();
  if (safari) {
    issues.push('Safari/WebKit browser detected (IndexedDB blob URL limitations present)');
    recommendations.push('If possible, use Chrome or Firefox until Apple ships a fix');
  }
  if (opera) {
    issues.push('Opera browser detected (known blob URL compatibility issues)');
    recommendations.push('Consider using Chrome or Firefox for best experience');
  }

  return {
    healthy: issues.length === 0,
    issues,
    recommendations,
  };
}

/**
 * Clear all caches and storage for recovery
 */
export async function performCacheRecovery(): Promise<void> {
  const errors: Error[] = [];

  // Clear segment cache
  try {
    await clearSegmentCache();
  } catch (err) {
    errors.push(err as Error);
  }

  // Clear session storage flow state
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const keysToRemove = ['curtain-wizard:flow-state', 'curtain-wizard:last-uploaded-key'];
      keysToRemove.forEach(key => {
        try {
          sessionStorage.removeItem(key);
        } catch {}
      });
    }
  } catch (err) {
    errors.push(err as Error);
  }

  // Suggest browser cache clear
  if (errors.length > 0) {
    console.warn('[cache-recovery] Some cleanup operations failed:', errors);
    throw new Error(`Recovery partially failed: ${errors.map(e => e.message).join(', ')}`);
  }
}

/**
 * Log cache health status to console (for debugging)
 */
export async function logCacheHealth(): Promise<void> {
  const health = await checkCacheHealth();

  console.group('[cache-recovery] Cache Health Check');
  console.log('Status:', health.healthy ? '✅ Healthy' : '⚠️ Issues detected');

  if (health.issues.length > 0) {
    console.group('Issues:');
    health.issues.forEach(issue => console.warn('•', issue));
    console.groupEnd();
  }

  if (health.recommendations.length > 0) {
    console.group('Recommendations:');
    health.recommendations.forEach(rec => console.info('•', rec));
    console.groupEnd();
  }

  console.groupEnd();
}

/**
 * Expose cache recovery to window for manual debugging
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as any).curtainWizardCacheRecovery = {
    checkHealth: checkCacheHealth,
    performRecovery: performCacheRecovery,
    logHealth: logCacheHealth,
  };

  console.info(
    '[cache-recovery] Manual recovery available:\n' +
    '  window.curtainWizardCacheRecovery.logHealth()\n' +
    '  window.curtainWizardCacheRecovery.performRecovery()'
  );
}
