/**
 * Blob URL Fallback Utility
 * 
 * Safari (WebKit) and Opera (Chromium/WebKit) have known bugs where blob URLs created
 * from IndexedDB Blobs fail to load with "WebKitBlobResource error 1".
 * 
 * This utility provides automatic fallback to base64 data URLs when
 * blob URLs fail, ensuring compatibility across all browsers.
 */

export type BlobUrlResult = {
  url: string;
  type: 'blob' | 'dataurl';
  revoke: () => void;
};

/**
 * Convert a Blob to base64 data URL
 */
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('FileReader did not return a string'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Create a URL from a Blob with automatic fallback to data URL
 * if blob URL fails (Opera/WebKit bug workaround)
 * 
 * @param blob - The Blob to create URL from
 * @param preferDataUrl - Force data URL instead of blob URL (useful for known problematic browsers)
 * @returns Promise resolving to URL and cleanup function
 */
export async function createSafeObjectUrl(
  blob: Blob,
  options: { preferDataUrl?: boolean; timeout?: number } = {}
): Promise<BlobUrlResult> {
  const { preferDataUrl = false, timeout = 3000 } = options;

  // If explicitly preferring data URL (e.g., in Opera), skip blob URL attempt
  if (preferDataUrl) {
    const dataUrl = await blobToDataUrl(blob);
    return {
      url: dataUrl,
      type: 'dataurl',
      revoke: () => {}, // Data URLs don't need revoking
    };
  }

  // Try blob URL first (faster, lower memory)
  const blobUrl = URL.createObjectURL(blob);

  // Test if blob URL actually works by attempting to load it
  const isValid = await testBlobUrl(blobUrl, timeout);

  if (isValid) {
    return {
      url: blobUrl,
      type: 'blob',
      revoke: () => URL.revokeObjectURL(blobUrl),
    };
  }

  // Blob URL failed - revoke it and fallback to data URL
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[blob-url-fallback] Blob URL failed validation, falling back to data URL');
  }
  URL.revokeObjectURL(blobUrl);

  const dataUrl = await blobToDataUrl(blob);
  return {
    url: dataUrl,
    type: 'dataurl',
    revoke: () => {}, // Data URLs don't need revoking
  };
}

/**
 * Test if a blob URL is actually loadable
 * Uses Image for images, fetch for other types
 */
async function testBlobUrl(url: string, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        img.src = ''; // Clear source
      }
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      resolve(false); // Timeout = failure
    }, timeout);

    img.onload = () => {
      cleanup();
      clearTimeout(timeoutId);
      resolve(true);
    };

    img.onerror = () => {
      cleanup();
      clearTimeout(timeoutId);
      resolve(false);
    };

    try {
      img.src = url;
    } catch {
      cleanup();
      clearTimeout(timeoutId);
      resolve(false);
    }
  });
}

/**
 * Detect if current browser is Opera (Chromium-based)
 */
export function isOperaBrowser(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent;
  // Opera contains "OPR" or "Opera" in user agent
  return /OPR\/|Opera\//.test(ua);
}

/**
 * Detect Safari/WebKit browsers (macOS Safari or any iOS browser)
 */
export function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent;
  const vendor = navigator.vendor ?? '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isMacSafari =
    vendor.includes('Apple') &&
    /Safari/.test(ua) &&
    !/Chrome|CriOS|Edg|OPR|Brave|DuckDuckGo|FxiOS|SamsungBrowser/i.test(ua);
  return isIOS || isMacSafari;
}

/**
 * Check if a Blob is still valid and readable.
 * Safari/iOS can invalidate IndexedDB Blobs between sessions.
 */
export async function isValidBlob(blob: Blob): Promise<boolean> {
  if (!blob || !(blob instanceof Blob)) return false;
  if (blob.size === 0) return false;
  
  try {
    // Try to read the first byte - this will fail if Blob is invalidated
    const slice = blob.slice(0, 1);
    const buffer = await slice.arrayBuffer();
    return buffer.byteLength > 0 || blob.size === 0;
  } catch {
    return false;
  }
}

/**
 * Convenience wrapper that auto-detects WebKit-problematic browsers and uses appropriate strategy
 */
export async function createBrowserCompatibleUrl(blob: Blob): Promise<BlobUrlResult> {
  const isOpera = isOperaBrowser();
  const isSafari = isSafariBrowser();
  const preferDataUrl = isOpera || isSafari;

  if (preferDataUrl && process.env.NODE_ENV !== 'production') {
    const label = isOpera ? 'Opera' : 'Safari/WebKit';
    console.info(`[blob-url-fallback] ${label} detected, using data URL strategy`);
  }

  return createSafeObjectUrl(blob, { preferDataUrl });
}
