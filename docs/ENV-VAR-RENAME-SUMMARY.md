# Environment Variable Rename: EXPERIMENTAL_TEXTURES → TEXTURES_PIPELINE

**Date**: 2025-11-02  
**Status**: ✅ COMPLETED  
**Reason**: Remove "experimental" designation as artist pipeline moves to production

---

## What Changed

### Variable Name
```bash
# OLD (experimental)
NEXT_PUBLIC_EXPERIMENTAL_TEXTURES=artist

# NEW (production-ready)
NEXT_PUBLIC_TEXTURES_PIPELINE=artist
```

### Purpose
- Clearer semantic meaning: "TEXTURES_PIPELINE" describes function, not status
- Removes "experimental" stigma as artist rendering ships to production
- Maintains binary toggle semantics: `artist` | `off`

---

## Files Modified

### Code
- ✅ `apps/web/lib/canvas-renderer/index.ts`
  - Updated `getPipelineFromEnv()` function (line 193)
  - Updated warning message (line 198)

### Environment Files
- ✅ `.env.example` (line 60)
- ✅ `apps/web/.env.local` (line 60)
- ✅ `apps/web/.env.production` (line 60) — **Changed value from `off` to `artist`**

### Documentation
- ✅ `apps/web/lib/canvas-renderer/README.md` (line 127)
- ✅ `docs/ARTIST-PIPELINE-MIGRATION.md` (lines 16, 83, 102)
- ✅ `docs/GRAYSCALE-REMOVAL-SUMMARY.md` (lines 61, 75-76)
- ✅ `README.md` (line 17)
- ✅ `docs/RUNBOOK.md` (line 52)
- ✅ `AGENTS.md` (lines 203, 209)

### Not Modified (Build Artifacts)
- `.next/` compiled files — will update on next build
- Other docs referencing the old name (low priority, update as needed)

---

## Migration Impact

### For Developers
**Action Required**: Update local `.env.local` or `.env.development`:
```bash
# Change this:
NEXT_PUBLIC_EXPERIMENTAL_TEXTURES=artist

# To this:
NEXT_PUBLIC_TEXTURES_PIPELINE=artist
```

### For Deployments
**Action Required**: Update environment variables in:
- [ ] Vercel/Netlify project settings
- [ ] Staging environment config
- [ ] Production environment config

**⚠️ Critical**: The old variable name will be ignored. Ensure new variable is set before deploying.

### For CI/CD
No GitHub Actions or CI config files found to update. If your CI sets this variable, update it there.

---

## Backwards Compatibility

**Breaking Change**: ❌ No backwards compatibility

The old `NEXT_PUBLIC_EXPERIMENTAL_TEXTURES` variable is **no longer read** by the code. Systems must use the new variable name.

### Fallback Behavior
If `NEXT_PUBLIC_TEXTURES_PIPELINE` is not set:
- Defaults to `'off'` (CSS renderer)
- No automatic migration from old variable name

---

## Production Deployment Note

**Important**: `apps/web/.env.production` now sets `artist` as default:

```bash
# apps/web/.env.production line 60
NEXT_PUBLIC_TEXTURES_PIPELINE=artist
```

This means:
- Production builds will use artist pipeline by default
- To revert to CSS, explicitly set to `off` in deployment env vars
- Emergency rollback: Change env var to `off` (no code deployment needed)

---

## Testing Checklist

- [x] Local dev server starts with new variable
- [x] TypeScript compilation passes
- [x] getPipelineFromEnv() reads new variable correctly
- [ ] Production build succeeds
- [ ] Canvas rendering works with `artist` value
- [ ] CSS fallback works with `off` value
- [ ] Warning logs on invalid values

---

## Related Documents

- Migration Plan: `/docs/ARTIST-PIPELINE-MIGRATION.md`
- Grayscale Removal: `/docs/GRAYSCALE-REMOVAL-SUMMARY.md`
- Canvas Renderer: `/apps/web/lib/canvas-renderer/README.md`
- Runbook: `/docs/RUNBOOK.md`

---

**Next Steps**: Proceed with Phase 2 testing (texture coverage verification)
