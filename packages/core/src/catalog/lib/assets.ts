import { loadEnv } from '@curtain-wizard/shared/src/env';

function getCatalogAssetBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const clientBase = (process.env.NEXT_PUBLIC_CATALOG_ASSET_BASE_URL ?? '').trim();
    if (clientBase) {
      return clientBase;
    }
  }
  const env = loadEnv();
  return (env.CATALOG_ASSET_BASE_URL ?? '').trim();
}

const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

const trimSlashes = (value: string, { leading, trailing }: { leading?: boolean; trailing?: boolean } = {}): string => {
  let result = value;
  if (leading) {
    result = result.replace(/^\/+/, '');
  }
  if (trailing) {
    result = result.replace(/\/+$/, '');
  }
  return result;
};

export function resolveCatalogAssetUrl(relativePath: string): string {
  const cleanPath = trimSlashes(relativePath, { leading: true });
  
  // When using artist pipeline, return empty URLs for legacy texture/thumbnail/swatch assets
  // to prevent network requests and 404 errors
  if (typeof window !== 'undefined') {
    const texturesPipeline = process.env.NEXT_PUBLIC_TEXTURES_PIPELINE;
    if (texturesPipeline === 'artist' && (
      cleanPath.startsWith('textures/') || 
      cleanPath.startsWith('thumbs/') || 
      cleanPath.startsWith('swatches/')
    )) {
      return '';
    }
  }
  
  const base = getCatalogAssetBaseUrl();

  if (!base) {
    return `/${cleanPath}`;
  }

  if (ABSOLUTE_URL_PATTERN.test(base)) {
    const normalizedBase = trimSlashes(base, { trailing: true });
    return `${normalizedBase}/${cleanPath}`;
  }

  if (base.startsWith('/')) {
    const normalizedBase = '/' + trimSlashes(base, { leading: true, trailing: true });
    if (normalizedBase === '/') {
      return `/${cleanPath}`;
    }
    const segment = normalizedBase.slice(1);
    if (segment && cleanPath.startsWith(`${segment}/`)) {
      return `${normalizedBase}/${cleanPath.slice(segment.length + 1)}`;
    }
    return `/${cleanPath}`;
  }

  const normalizedBase = trimSlashes(base, { leading: true, trailing: true });
  if (!normalizedBase) {
    return `/${cleanPath}`;
  }

  return `/${normalizedBase}/${cleanPath}`;
}
