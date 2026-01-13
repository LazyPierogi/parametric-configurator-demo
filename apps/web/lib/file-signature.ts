export async function fingerprintBlob(blob: Blob): Promise<string> {
  // crypto.subtle requires secure context (HTTPS or localhost)
  // Fallback to simple signature when not available (e.g., HTTP on mobile)

  async function fallbackSignature(): Promise<string> {
    // Simple fallback: use size + type + sample bytes
    const sampleSize = Math.min(1024, blob.size);
    const sample = await blob.slice(0, sampleSize).arrayBuffer();
    const sampleArray = Array.from(new Uint8Array(sample));
    const sampleSum = sampleArray.reduce((a, b) => a + b, 0);
    return `fallback-${blob.size}-${sampleSum}:${blob.type}:${blob.size}`;
  }

  // On insecure HTTP (e.g., iOS Safari hitting http://MacMario.local) skip Web Crypto entirely.
  if (typeof window !== 'undefined' && window.location.protocol !== 'https:') {
    console.warn('[file-signature] non-secure context (non-HTTPS), using fallback');
    return fallbackSignature();
  }

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    console.warn('[file-signature] crypto.subtle not available (non-secure context), using fallback');
    return fallbackSignature();
  }

  const buffer = await blob.arrayBuffer();
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hashHex}:${blob.type}:${blob.size}`;
  } catch (err) {
    console.warn('[file-signature] crypto.subtle.digest failed, using fallback', err);
    return fallbackSignature();
  }
}

export async function fingerprintFile(file: File): Promise<string> {
  return fingerprintBlob(file);
}
