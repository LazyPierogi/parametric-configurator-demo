# Artist Pipeline Migration Plan

**Status**: In Progress  
**Target**: Production deployment of `NEXT_PUBLIC_EXPERIMENTAL_TEXTURES=artist`  
**Fallback**: CSS legacy renderer (pipeline: 'off')

---

## Migration Strategy

Ship artist pipeline as primary renderer while maintaining CSS fallback for:
- Emergency kill-switch in production
- Unsupported browsers
- Missing texture coverage

**Binary toggle**: `NEXT_PUBLIC_TEXTURES_PIPELINE` accepts only `artist` or `off`.

---

## Phase 1: Remove Obsolete Systems ✅ CURRENT

### 1.1 Grayscale CSS System Removal
- [ ] Delete `/apps/web/lib/grayscale-textures.ts` (234 lines)
- [ ] Delete `/public/textures/grayscale/` directory
- [ ] Remove grayscale imports from `page.tsx` (line 34)
- [ ] Remove `GRAYSCALE_TEXTURES_ENABLED` constant and all usage
- [ ] Strip grayscale state variables (lines 551-554)
- [ ] Remove grayscale props from `DebugControls.tsx` (lines 31-53)
- [ ] Clean grayscale references in `page.tsx` (lines 2084-2106, 2611, 2628, 3170-3183)

**Files affected**:
- `apps/web/lib/grayscale-textures.ts` → DELETE
- `apps/web/app/configure/page.tsx` → CLEAN
- `apps/web/app/configure/components/DebugControls.tsx` → CLEAN
- `public/textures/grayscale/` → DELETE

### 1.2 Documentation Cleanup
- [ ] Rewrite `/apps/web/lib/canvas-renderer/README.md` to document only artist pipeline
- [ ] Archive obsolete docs: `GRAYSCALE-*.md`, `CANVAS-RENDERING-ARCHITECTURE.md`
- [ ] Update `.env.example` to remove grayscale/tokens/translucent options
- [ ] Update compositor.ts comments (lines 100-101)

### 1.3 Type & Environment Cleanup
- [ ] Update `RenderPipeline` comments to clarify binary toggle
- [ ] Remove obsolete pipeline references from env documentation
- [ ] Update RUNBOOK.md with artist-only instructions
- [ ] Update AGENTS.md to remove obsolete pipeline references

---

## Phase 2: Pre-Production Testing

### 2.1 Texture Coverage Verification
- [ ] Run `npm run textures:mock` to regenerate mock textures
- [ ] Verify all pleat types have artist textures:
  - [ ] wave (drape + sheer variants)
  - [ ] flex
  - [ ] doubleFlex
- [ ] Test graceful degradation when textures missing
- [ ] Consider adding CSS fallback for missing artist maps

### 2.2 Rendering Matrix Test
Smoke test all combinations:
- [ ] 3 pleat types × 7 material families × 5 color categories
- [ ] Verify render cache warming (`useRenderPreWarming`)
- [ ] Test wall tiling offsets during segment drag
- [ ] Confirm stitch overlays remain pixel-aligned
- [ ] Mobile performance check (<200ms target)

### 2.3 Performance Validation
- [ ] Canvas width effect uses cached textures (no flicker)
- [ ] Drag operations stay smooth (isDragging skip)
- [ ] Cache invalidation works on fabric/color changes
- [ ] No infinite re-render loops (performRender never in deps)

---

## Phase 3: Production Deployment

### 3.1 Environment Configuration
**All environments must explicitly set**:
```bash
NEXT_PUBLIC_TEXTURES_PIPELINE=artist  # or 'off' for fallback
```

- [ ] Staging: `artist`
- [ ] Preview: `artist`
- [ ] Production: `artist`
- [ ] Verify `getPipelineFromEnv()` warning logs trigger on typos

### 3.2 Iframe Integration Test
- [ ] Build with canvas enabled
- [ ] Test against Magento storefront iframe
- [ ] Verify postMessage sizing unaffected
- [ ] Confirm `cw-hero-shell` layout anchors intact
- [ ] Check higher-frequency canvas rerenders don't break parent

### 3.3 Kill-Switch Protocol
**If canvas issues detected in production**:
```bash
# Emergency revert to CSS
NEXT_PUBLIC_TEXTURES_PIPELINE=off
```
Redeploy immediately. CSS legacy renderer continues to work.

---

## Phase 4: Post-Deployment

### 4.1 Monitoring
- [ ] Track render performance metrics (target <200ms)
- [ ] Monitor cache hit rates (`renderCache.getStats()`)
- [ ] Watch for texture loading errors
- [ ] Check browser console for pipeline warnings

### 4.2 Documentation Updates
- [ ] Mark grayscale removal in `05-Task-List.md`
- [ ] Update `AGENTS.md` with artist-only workflow
- [ ] Document CSS fallback protocol in `RUNBOOK.md`
- [ ] Archive migration plan once complete

---

## Architecture Decisions

### Keep Dual Rendering Components
**Decision**: Maintain both CSS (inline) and Canvas (component) renderers.

**Rationale**:
- CSS provides emergency fallback without code deployment
- CanvasCurtainLayer encapsulates complex caching/tiling logic
- Separation enables isolated regression testing
- Inline CSS removal would make width-effect fixes riskier

**Location**:
- Canvas: `apps/web/app/configure/components/CanvasCurtainLayer.tsx`
- CSS: `apps/web/app/configure/page.tsx` lines 2599-2634

### Binary Pipeline Toggle
**Decision**: Only support `'artist' | 'off'`, no intermediate modes.

**Rationale**:
- Simplifies testing matrix (2 states vs 5+)
- Removes maintenance burden of unused pipelines
- Clear operational semantics (canvas on/off)
- Prevents accidental activation of removed code

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Missing artist textures crash app | Add try/catch in CanvasCurtainLayer with CSS fallback |
| Performance regression on mobile | Keep CSS fallback, monitor metrics, tune cache |
| Iframe layout breaks | Test against Magento before prod, verify shell anchors |
| Environment misconfiguration | Explicit validation in all envs, warning logs on typos |
| Emergency rollback needed | CSS fallback via single env var, no code deploy required |
| EnviMeasurement (AI #1) runs through Genkit with provider switching via env (`AI1_PROVIDER`, default Google Gemini 2.x flash-lite; OpenAI fallback). | CSS fallback via single env var, no code deploy required |

---

## Success Criteria

- [ ] Zero grayscale code remains in codebase
- [ ] Artist pipeline renders all pleat/material/color combos
- [ ] Performance <200ms on target devices
- [ ] CSS fallback works without canvas code
- [ ] Documentation reflects artist-only state
- [ ] All environments explicitly configured
- [ ] Iframe integration verified
- [ ] Kill-switch tested and documented

---

**Next Steps**: Execute Phase 1.1 - Remove grayscale system
