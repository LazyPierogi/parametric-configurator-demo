# Cache Busting Guide for Parent Storefront Integration

## Problem

When deploying Curtain Wizard updates, the parent storefront (zaslony.com) may serve cached versions of:
- Static assets (CSS, JS bundles)
- HTML documents
- Environment variables baked into the build
- API responses

This causes users to see **old UI, old behavior, and old integration logic** even after deploying a new version.

## Symptoms

- Version number updated (e.g., v.05.01) but UI looks old
- Debug handles show old colors (red instead of green)
- New features don't appear
- Environment variables don't match `.env.local`
- Parent bridge communication fails with new payloads

## Cache Layers (What Gets Cached)

### 1. Browser Cache
**What:** Static assets (JS, CSS, images), HTML documents  
**Lifetime:** Based on `Cache-Control` headers (typically 1 hour - 1 year)  
**Impact:** Users see old version until cache expires or manual refresh

### 2. CDN/Edge Cache
**What:** Entire responses cached at CDN edge servers  
**Lifetime:** Configured per CDN (e.g., Cloudflare: auto, Fastly: custom)  
**Impact:** All users globally get stale version

### 3. Service Worker Cache
**What:** Offline-first PWA cache  
**Lifetime:** Until service worker updates (next page load after network check)  
**Impact:** Aggressive caching, hard to bypass

### 4. Reverse Proxy Cache
**What:** Server-side cache (nginx, Varnish, etc.)  
**Lifetime:** Configured at server level  
**Impact:** All users get stale version from server

### 5. Build-Time Cache
**What:** Environment variables, static generation, bundled code  
**Lifetime:** Until rebuild + redeploy  
**Impact:** Old env vars, old feature flags, old API keys

## Solutions

### Immediate Fix (Manual Refresh)

**For Development/Testing:**
```bash
# Hard refresh in browser
Mac: Cmd + Shift + R
Windows: Ctrl + Shift + R
Linux: Ctrl + F5

# Or open DevTools
Right-click → Inspect → Network tab → Check "Disable cache"

# Or use incognito/private window
```

**For Production (Parent Storefront):**

The parent storefront must update the iframe URL with a cache-busting parameter:

```html
<!-- ❌ BAD: Will cache forever -->
<iframe src="https://curtain-wizard.vercel.app/configure"></iframe>

<!-- ✅ GOOD: Cache-busted by version -->
<iframe src="https://curtain-wizard.vercel.app/configure?v=05.01"></iframe>

<!-- ✅ BETTER: Cache-busted by timestamp -->
<iframe src="https://curtain-wizard.vercel.app/configure?t=<?= time() ?>"></iframe>

<!-- ✅ BEST: Cache-busted by deployment hash -->
<iframe src="https://curtain-wizard.vercel.app/configure?v=<?= CURTAIN_WIZARD_VERSION ?>"></iframe>
```

### Long-Term Fix (Automatic Cache Busting)

#### Option 1: Versioned Deployment URLs

Deploy each version to a unique subdomain or path:

```
https://v05-01.curtain-wizard.app/configure
https://v05-02.curtain-wizard.app/configure
```

Update parent storefront config:
```php
// zaslony.com config
define('CURTAIN_WIZARD_URL', 'https://v05-01.curtain-wizard.app');
```

**Pros:** Complete isolation, easy rollback  
**Cons:** Multiple deployments, DNS management

#### Option 2: Query String Version Parameter

Automatically inject version into iframe src:

```javascript
// zaslony.com integration script
const CURTAIN_WIZARD_VERSION = '05.01'; // Update on each deploy

const iframe = document.createElement('iframe');
iframe.src = `https://curtain-wizard.app/configure?v=${CURTAIN_WIZARD_VERSION}`;
document.getElementById('cw-container').appendChild(iframe);
```

**Pros:** Simple, works with existing deployment  
**Cons:** Requires parent storefront code update

#### Option 3: Embed Version in Parent Bridge

Use the parent bridge to fetch and validate version:

```typescript
// apps/web/lib/init-parent-bridge.ts (already exists)
export async function initParentBridge() {
  // Send version to parent on load
  callParent('versionCheck', { version: APP_VERSION });
  
  // Parent can display warning if version mismatch
}
```

Parent storefront checks:
```javascript
// zaslony.com listener
window.addEventListener('message', (event) => {
  if (event.data.type === 'versionCheck') {
    const cwVersion = event.data.payload.version;
    const expectedVersion = '05.01'; // From storefront config
    
    if (cwVersion !== expectedVersion) {
      console.warn(`CW version mismatch: got ${cwVersion}, expected ${expectedVersion}`);
      // Optionally reload iframe with cache-bust
      reloadCurtainWizard();
    }
  }
});
```

**Pros:** Automatic version validation  
**Cons:** Requires parent storefront implementation

#### Option 4: HTTP Headers (Server-Side)

Configure Next.js to send proper cache headers:

```javascript
// apps/web/next.config.mjs
export default {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate', // Always revalidate
          },
        ],
      },
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // Cache hashed assets forever
          },
        ],
      },
    ];
  },
};
```

**Pros:** Browser respects cache directives  
**Cons:** Doesn't help with CDN/proxy cache

#### Option 5: Service Worker Update Strategy

If using a service worker, implement version checking:

```javascript
// service-worker.js
const CACHE_VERSION = 'v05.01';

self.addEventListener('install', (event) => {
  // Force immediate activation on version change
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clear old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    })
  );
});
```

**Pros:** Offline-first apps stay fresh  
**Cons:** Only needed if using PWA

## Deployment Checklist

When deploying a new Curtain Wizard version:

### 1. Update Version Number
```bash
# apps/web/lib/version.ts
export const APP_VERSION = 'v.05.02'; # Increment
```

### 2. Build & Deploy
```bash
npm run build
# Deploy to Vercel/hosting
```

### 3. Notify Parent Storefront
Send email/Slack to zaslony.com team:
```
Subject: Curtain Wizard v.05.02 Deployed

New version deployed: v.05.02
Iframe URL: https://curtain-wizard.app/configure?v=05.02

Action required:
1. Update iframe src to include ?v=05.02
2. Clear CDN cache (if applicable)
3. Test in staging environment

Breaking changes: [list any]
New features: [list any]
```

### 4. Verify Deployment
- [ ] Check version badge on /estimate
- [ ] Check version badge on /configure
- [ ] Verify env variables in Debug UI
- [ ] Test parent bridge communication
- [ ] Check handle colors match (debug UI)
- [ ] Confirm all new features visible

### 5. Monitor for Cache Issues
- Check browser DevTools Network tab for 304 (cached) vs 200 (fresh)
- Verify correct assets loaded (check filenames contain new hashes)
- Test in incognito to bypass browser cache

## Debugging Cache Issues

### Check if Assets Are Cached

**Browser DevTools (Network Tab):**
```
Status 200 = Fresh from server
Status 304 = Not Modified (cached)
Status 200 (from disk cache) = Browser cache
Status 200 (from ServiceWorker) = SW cache
```

**Check asset hashes:**
```html
<!-- Old build -->
<script src="/_next/static/chunks/main-abc123.js"></script>

<!-- New build (different hash) -->
<script src="/_next/static/chunks/main-xyz789.js"></script>
```

If hash matches old deployment → HTML document is cached

### Bypass All Caches

**Option 1: DevTools**
```
F12 → Network → ✓ Disable cache
```

**Option 2: URL parameter**
```
https://curtain-wizard.app/configure?nocache=1729425600
```

**Option 3: Clear browser data**
```
Chrome: Settings → Privacy → Clear browsing data → Cached images and files
Firefox: Settings → Privacy → Clear Data → Cached Web Content
Safari: Develop → Empty Caches
```

### Check CDN Cache

**Cloudflare:**
```bash
# Purge cache via API
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

**Vercel:**
```bash
# Redeploy triggers automatic cache invalidation
vercel --prod
```

## Environment Variable Debugging

### Check Active Env Vars

1. Enable debug mode: `NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1`
2. Navigate to `/configure`
3. Click "Show Env" in Debug UI
4. Compare with your `.env.local`

### Common Mismatches

**Localhost vs Production:**
- Localhost reads from `.env.local`
- Production reads from hosting platform env vars (Vercel/Netlify dashboard)

**Solution:** Ensure production env vars match `.env.local`:
```bash
# Vercel
vercel env pull .env.production.local

# Compare
diff .env.local .env.production.local
```

## Parent Storefront Communication

### Version Mismatch Detection

Add version check to parent bridge initialization:

```typescript
// apps/web/lib/init-parent-bridge.ts
import { APP_VERSION } from './version';

export async function initParentBridge() {
  // Existing bridge init...
  
  // Send version on load
  callParent('cwVersionNotify', { version: APP_VERSION });
  
  // Listen for version check response
  window.addEventListener('message', (event) => {
    if (event.data.type === 'versionCheckResponse') {
      const { expectedVersion, match } = event.data.payload;
      if (!match) {
        console.error(`Version mismatch: CW=${APP_VERSION}, Parent expects=${expectedVersion}`);
        // Optionally show warning to user
      }
    }
  });
}
```

Parent storefront:
```javascript
// zaslony.com
const EXPECTED_CW_VERSION = '05.01';

window.addEventListener('message', (event) => {
  if (event.data.type === 'cwVersionNotify') {
    const cwVersion = event.data.payload.version;
    const match = cwVersion === EXPECTED_CW_VERSION;
    
    // Send response
    iframe.contentWindow.postMessage({
      type: 'versionCheckResponse',
      payload: { expectedVersion: EXPECTED_CW_VERSION, match }
    }, '*');
    
    if (!match) {
      console.warn(`Curtain Wizard version mismatch: ${cwVersion} !== ${EXPECTED_CW_VERSION}`);
      // Optionally reload iframe with cache-bust
    }
  }
});
```

## Related Documentation

- `docs/APP-VERSIONING.md` - Version numbering and display
- `docs/PRODUCTION-DEPLOYMENT.md` - Deployment procedures
- `docs/STOREFRONT-INTEGRATION-TROUBLESHOOTING.md` - Integration debugging
- `docs/PARENT-BRIDGE-TODOS.md` - Parent bridge implementation
