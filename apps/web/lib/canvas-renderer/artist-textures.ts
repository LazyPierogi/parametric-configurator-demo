import specs from '../../../../blender/texture-specs.json';

export type ArtistTextureFamily = keyof typeof specs.families;

export type ArtistTextureMap = 'pleatRamp' | 'occlusion' | 'translucency' | 'normal' | 'depth';

type VariantInfo = {
  variantCount: number;
  pleatsPerTile: number;
  headerBandPct: number;
  textureScalePx: number;
};

type ArtistTextureSpec = VariantInfo & {
  materials?: string[];
  notes?: string;
  translucencyHint?: string;
  transitionBandPct?: number;
};

export const ARTIST_TEXTURE_EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg'] as const;

const rawArtistTextureBase = (process.env.NEXT_PUBLIC_ARTIST_TEXTURES_BASE_URL ?? '').trim();

const ARTIST_TEXTURE_BASE_PATH = (() => {
  if (!rawArtistTextureBase || rawArtistTextureBase === '/') {
    // Local development default: Next.js serves from apps/web/public
    return '/media/textures/canvas';
  }
  return rawArtistTextureBase.replace(/\/+$/, '');
})();

export function getArtistFamilies(): ArtistTextureFamily[] {
  return Object.keys(specs.families) as ArtistTextureFamily[];
}

export function getArtistTextureSpec(family: ArtistTextureFamily): ArtistTextureSpec {
  const spec = specs.families[family] as any;
  return {
    variantCount: spec.variantCount ?? 1,
    pleatsPerTile: spec.pleatsPerTile,
    headerBandPct: spec.headerBandPct,
    textureScalePx: spec.textureScalePx,
    notes: spec.notes,
    materials: spec.materials,
    translucencyHint: spec.translucencyHint,
    transitionBandPct: spec.transitionBandPct,
  };
}

export function getArtistTexturePath(
  family: ArtistTextureFamily,
  map: ArtistTextureMap,
  variant = 1
): string[] {
  const spec = getArtistTextureSpec(family);
  const base = `${ARTIST_TEXTURE_BASE_PATH}/${family}`;

  if (spec.variantCount > 1) {
    const variantSlug = variant.toString().padStart(2, '0');
    return ARTIST_TEXTURE_EXTENSIONS.map(ext => `${base}/variant-${variantSlug}/${map}.${ext}`);
  }

  return ARTIST_TEXTURE_EXTENSIONS.map(ext => `${base}/${map}.${ext}`);
}

export function clampVariant(family: ArtistTextureFamily, requested: number): number {
  const { variantCount } = getArtistTextureSpec(family);
  if (!variantCount || variantCount <= 1) return 1;
  if (requested < 1) return 1;
  if (requested > variantCount) return variantCount;
  return requested;
}
