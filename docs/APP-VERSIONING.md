# App Versioning and Environment Debugging

## Overview

Added app versioning and environment variable inspection to help debug configuration issues when the Curtain Wizard runs in the parent storefront iframe.

## Current Version

**v.05.01**

Location: `apps/web/lib/version.ts`

## Features

### 1. Version Display (Both Pages)

**Visibility:** Only when `NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1`

**Location:** Fixed badge in bottom-right corner

- **`/estimate`:** Small version badge displays continuously
- **`/configure`:** Small version badge displays continuously

**Style:**
- White semi-transparent background
- Monospace font
- Small text (xs)
- Bottom-right positioning with shadow

### 2. Environment Variables Inspector (Configure Page Only)

**Visibility:** Only when `NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1`

**Location:** Inside existing Debug UI panel (collapsible section)

**Features:**
- Click "Show Env" button to expand
- Displays all `NEXT_PUBLIC_*` environment variables
- Sorted alphabetically
- Format: `KEY=VALUE` (one per line)
- Scrollable container (max height: 200px)
- Monospace font for easy reading

## Files Changed

### New File
- `apps/web/lib/version.ts` - Version constant and env utilities

### Modified Files
- `apps/web/app/estimate/page.tsx` - Added version badge
- `apps/web/app/configure/page.tsx` - Added version badge and env vars
- `apps/web/app/configure/components/DebugControls.tsx` - Added env vars section

## Usage

### Enable Debug Mode

Set in your `.env.local`:
```bash
NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1
```

### View Version
1. Navigate to `/estimate` or `/configure`
2. Look at bottom-right corner
3. You'll see: `v.05.01`

### View Environment Variables
1. Navigate to `/configure`
2. Upload a photo and adjust wall box (reach "ready" phase)
3. Debug UI panel appears at bottom of configurator
4. Version displays next to "Debug UI" heading
5. Click "Show Env" button
6. All `NEXT_PUBLIC_*` variables display in scrollable panel

## Updating the Version

When deploying a new version:

1. Open `apps/web/lib/version.ts`
2. Update `APP_VERSION` constant:
   ```typescript
   export const APP_VERSION = 'v.05.02'; // Increment patch
   ```
3. Commit and push
4. Version will display everywhere automatically

**Version Format:** `vYY.MM.patch`
- `YY`: Year (2 digits)
- `MM`: Month (2 digits) 
- `patch`: Sequential number within month

**Examples:**
- `v.05.01` - October 2025, first version
- `v.05.02` - October 2025, second version
- `v.06.01` - November 2025, first version

## Debugging Workflow

### Problem: Parent storefront using wrong version

1. Enable debug mode (`NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1`)
2. Open Curtain Wizard in storefront iframe
3. Check version badge - does it match your repo?
4. If not, storefront may be caching old version

### Problem: Environment variables not matching

1. Enable debug mode
2. Navigate to `/configure`
3. Click "Show Env" in Debug UI
4. Compare displayed values with your `.env.local`
5. If different, check:
   - Build process (env vars must start with `NEXT_PUBLIC_`)
   - Deployment configuration
   - Parent storefront iframe src URL

### Common Issues

**Version not updating:**
- Clear browser cache
- Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
- Check if parent storefront caches iframe URL
- Verify deployment completed successfully

**Env vars empty or wrong:**
- Only `NEXT_PUBLIC_*` variables are accessible client-side
- Server-only variables won't appear
- Check build logs for environment variable loading
- Ensure storefront passes correct iframe URL

## Security Note

Environment variables displayed are **already public** (client-side accessible). This feature only makes them easier to inspect. Never put secrets in `NEXT_PUBLIC_*` variables.

## Examples

### Version Badge Display
```
┌─────────────────────┐
│                     │
│   [Your Content]    │
│                     │
│              v.05.01│ ← Bottom-right corner
└─────────────────────┘
```

### Env Variables Panel
```
Debug UI                           v.05.01
[Show Env] [Save] [Show]

Active Environment Variables:
┌──────────────────────────────────────┐
│ NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1     │
│ NEXT_PUBLIC_CONFIGURE_FALLBACK_L...=0│
│ NEXT_PUBLIC_LIGHTING_ENABLED=1       │
│ NEXT_PUBLIC_LIGHTING_MODE=lite       │
│ NEXT_PUBLIC_MAX_IMAGE_MB=15          │
│ ...                                  │
└──────────────────────────────────────┘
```

## Related Documentation

- `docs/CACHE-FLOW-FIX.md` - Cache system improvements
- `docs/RUNBOOK.md` - Development and deployment guide
- `README.md` - Project overview
