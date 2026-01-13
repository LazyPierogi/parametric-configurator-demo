# Canvas Renderer Module

**Task 1010+** — Canvas-based curtain rendering with artist-authored textures.

## Purpose

Provides photorealistic curtain rendering using artist-crafted pleat maps:
- Uses pre-rendered 4-map textures (pleat ramp, weave, occlusion, translucency)
- Material-aware color blending with fabric family tokens
- Supports all pleat types: wave (drape/sheer), flex, doubleFlex

## Architecture

```
apps/web/lib/canvas-renderer/
├── index.ts              # Public API
├── types.ts              # TypeScript definitions
├── artist-textures.ts    # Artist texture family mappings
├── material-tokens.ts    # Material presets per fabric family
├── material-presets.ts   # Color category rendering presets
├── color-presets.ts      # Dynamic color category presets
├── pleating-presets.ts   # Pleat-specific rendering params
├── color-utils.ts        # Color space conversions & luminance
├── compositor.ts         # Canvas 2D blending operations
├── asset-loader.ts       # Texture loading & caching
├── render-cache.ts       # Texture result caching
├── pleat-utils.ts        # Pleat jitter & organic drift
└── pipelines/
    └── artist.ts         # Artist pipeline: 4-map rendering
```

## Usage

### Basic Integration

```typescript
import { renderCurtain } from '@/lib/canvas-renderer';

const config: RenderConfig = {
  pipeline: 'artist',
  fabric: selectedFabric,
  colorHex: '#8B7355',
  pleatId: 'wave',
  canvasWidth: 768,
  canvasHeight: 576,
  textureScale: 200,
  debug: false,
};

const result = await renderCurtain(config);
// result.canvas is ready to render
// result.metrics contains performance data
```

### With Live Rendering Parameters

```typescript
const config: RenderConfig = {
  pipeline: 'artist',
  fabric: selectedFabric,
  colorHex: '#8B7355',
  pleatId: 'wave',
  canvasWidth: 768,
  canvasHeight: 576,
  textureScale: 200,
  renderParams: {
    shadowStrength: 1.0,
    weaveStrength: 0.6,
    occlusionStrength: 0.8,
    artistVariant: 0, // Texture variant index
  },
};
```

## Artist Pipeline

### Rendering Mode
- **Pipeline**: `artist` (production default)
- **Fallback**: `off` (legacy CSS textures)

### 4-Map Texture System
Each pleat family uses artist-authored texture maps:
1. **Pleat Ramp**: Shading across pleat folds
2. **Weave Detail**: Fabric texture patterns
3. **Occlusion**: Shadow accumulation in valleys
4. **Translucency**: Light transmission mask

### Supported Pleat Families
- **wave-drape**: Standard wave pleats (opaque fabrics)
- **wave-sheer**: Wave pleats for sheer materials
- **flex**: Single flex pleating
- **double-flex**: Double flex pleating

### Color Categories
Dynamic presets adjust rendering based on color category:
- **white**: High brightness, minimal shadows
- **light**: Subtle pleat definition
- **colored**: Balanced shading
- **intensive**: Deep shadows, rich tones
- **natural**: Warm, organic appearance
- **brown**: Earthy, grounded tones

## Material Families

Configured in `packages/core/src/catalog/types.ts`:

```typescript
materialFamily:
  | 'sheer'
  | 'linen'
  | 'blackout'
  | 'blackout-basic'
  | 'cotton'
  | 'velvet'
  | 'silk'
  | 'curtain-linen'
  | 'sheer-linen'
  | 'curtain-basic'
  | 'sheer-basic';
```

`blackout-basic` is the new coated weave for entry-level blackout SKUs (`blackout-basic-weave.*` texture). The curated `curtain-*` and `sheer-*` families are design presets layered on top of these base materials so mock and storefront catalogs can point at the same renderer settings.

Each family has predefined rendering parameters in `material-tokens.ts`:
- `transmission`: Light pass-through (0-1)
- `weaveScale`, `weaveStrength`: Fabric texture visibility
- `shadowGain`, `highlightClamp`: Tone mapping curves
- `specBoost`: Surface reflection intensity

### Dynamic Color Presets
Material presets auto-adjust via color category (see `material-presets.ts`):
- Base opacity and texture scale per category
- Shadow/occlusion strength modulation
- Transmission adjustments for sheer fabrics

## Environment Configuration

```bash
# Canvas rendering toggle
NEXT_PUBLIC_TEXTURES_PIPELINE=artist

# Valid values:
# - artist   (Production: artist-authored textures)
# - off      (Fallback: legacy CSS textures)
```

**Critical**: All environments must explicitly set this variable. Invalid values default to `artist` with a console warning.

## Performance

- **Target**: <200ms render time on mobile devices
- **Cache Strategy**: Texture rendered once at canonical width, tiled for segments
- **Width Changes**: Fast tiling path (~1ms) avoids full re-render
- **Optimizations**:
  - Asset preloading & caching (`asset-loader.ts`)
  - Result caching (`render-cache.ts`)
  - Pre-warming visible color variants (`useRenderPreWarming`)
  - Drag operations skip re-render (`isDragging` flag)

## Debug Mode

Enable via `NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1`:
- Canvas debug panel in Configure page
- Live parameter sliders (shadow/weave/occlusion strength)
- Artist variant switcher
- Performance metrics & cache stats
- Material token inspector

## Testing

**Rendering Matrix**: Test all combinations before production
- 3 pleat types (wave, flex, doubleFlex)
- 7 material families (sheer, linen, blackout, blackout-basic, cotton, velvet, silk) + curated `curtain-*`/`sheer-*` variants
- 6 color categories (white, light, colored, intensive, natural, brown)

**Test Procedure**:
1. Run `npm run textures:mock` to regenerate mock textures
2. Smoke test wall tiling offsets during segment drag
3. Verify stitch overlays remain pixel-aligned
4. Mobile performance check (<200ms target)
5. Test graceful degradation when textures missing

## CSS Fallback

Canvas renderer coexists with legacy CSS system:
- `pipeline: 'artist'` → Canvas rendering
- `pipeline: 'off'` → CSS background textures

**Use Case**: Emergency kill-switch in production without code deployment.

**Location**: `apps/web/app/configure/page.tsx` lines 2580+ (CSS branch)

## Future Enhancements

- [ ] Additional artist texture variants per pleat
- [ ] WebGL renderer for hardware acceleration
- [ ] Pattern support (non-solid colors)
- [ ] Real-time lighting integration
- [ ] Mobile-specific texture compression

## Maintenance

**Asset Generation**: `npm run textures:mock`
- Regenerates mock textures for development
- Production textures live in `/public/textures/canvas/{family}/`

**Material Tuning**:
- `material-tokens.ts`: Base material family parameters
- `material-presets.ts`: Color category rendering adjustments
- `pleating-presets.ts`: Pleat-specific parameters
- `color-presets.ts`: Dynamic color category assignments

**Texture Requirements**:
- Format: WEBP (preferred) with automatic PNG/JPEG fallback; keep alpha intact
- Resolution: Match production specs
- Naming: `{family}-{variant}-{map}.{webp|png|jpg}`
  - Example: `wave-drape-0-pleat-ramp.webp`

---

**Migration Guide**: See `/docs/ARTIST-PIPELINE-MIGRATION.md`
