# Production Environment Variables Setup

**How to properly configure environment variables in production**

---

## ⚠️ Important: .env.local is NOT used in production

`.env.local` is **only for local development**. In production, you must set environment variables through your hosting platform.

---

## 🔍 Diagnose Current Configuration

### 1. Check What's Loaded

Visit: `https://your-domain.com/api/debug/env`

This will show:
- Current provider settings
- Which API keys are set (without exposing values)
- Environment mode (development/production)

**⚠️ SECURITY:** Delete or protect this endpoint after debugging!

### 2. Check Browser Console

Client-side variables are visible in browser:
```javascript
// In browser console
console.log({
  CATALOG_PROVIDER: process.env.NEXT_PUBLIC_CATALOG_PROVIDER, // undefined = not set
  STOREFRONT_ORIGIN: process.env.NEXT_PUBLIC_STOREFRONT_ORIGIN,
  DEBUG_UI: process.env.NEXT_PUBLIC_CONFIGURE_DEBUG_UI,
});
```

---

## 🚀 Setting Environment Variables in Production

### Vercel

1. Go to your project → Settings → Environment Variables
2. Add each variable:
   ```
   CATALOG_PROVIDER=storefront
   AI1_PROVIDER=googleai
   GOOGLE_GENAI_API_KEY=your-key-here
   NEXT_PUBLIC_STOREFRONT_ORIGIN=https://www.zaslony.com
   NEXT_PUBLIC_CONFIGURE_DEBUG_UI=0
   ```
3. Select environment: **Production**
4. Redeploy your app

### Netlify

1. Site settings → Environment variables
2. Add variables (same as above)
3. Redeploy

### Docker / VPS

Create `.env.production` file (NOT `.env.local`):
```bash
# .env.production
CATALOG_PROVIDER=storefront
AI1_PROVIDER=googleai
GOOGLE_GENAI_API_KEY=your-key-here
NEXT_PUBLIC_STOREFRONT_ORIGIN=https://www.zaslony.com
```

Or pass via command line:
```bash
CATALOG_PROVIDER=storefront npm run build
CATALOG_PROVIDER=storefront npm start
```

### Railway / Render

1. Dashboard → Environment
2. Add variables
3. Redeploy

---

## 📋 Required Variables for Storefront Mode

### Server-Side (Private)
```bash
# Catalog provider
CATALOG_PROVIDER=storefront

# AI provider for measurement
AI1_PROVIDER=googleai
AI1_MODEL=models/gemini-2.0-flash-lite

# API Keys (at least one)
GOOGLE_GENAI_API_KEY=your-key-here
# or
OPENAI_API_KEY=your-key-here
```

### Client-Side (Public - prefix with NEXT_PUBLIC_)
```bash
# Storefront configuration
NEXT_PUBLIC_STOREFRONT_ORIGIN=https://www.zaslony.com
NEXT_PUBLIC_STOREFRONT_TIMEOUT_MS=30000

# Debug (disable in production)
NEXT_PUBLIC_CONFIGURE_DEBUG_UI=0

# Optional
NEXT_PUBLIC_SUMMARY_FIELDS=fabric,pleat,hem,fabricOrdered,boltWidths,breakdown
```

---

## 🔧 Build-Time vs Runtime Variables

### Build-Time (NEXT_PUBLIC_*)
- Embedded in the JavaScript bundle during build
- **Must be set BEFORE building**
- Visible in browser
- Cannot be changed without rebuilding

```bash
# Set before build
NEXT_PUBLIC_STOREFRONT_ORIGIN=https://www.zaslony.com npm run build
```

### Runtime (Server-Side)
- Read from environment at runtime
- Can be changed without rebuilding
- Never exposed to browser
- Secure for API keys

```bash
# Can be changed anytime
CATALOG_PROVIDER=storefront npm start
```

---

## ✅ Verification Checklist

After setting variables:

### 1. Check Debug Endpoint
```bash
curl https://your-domain.com/api/debug/env
```

Should show:
```json
{
  "success": true,
  "config": {
    "CATALOG_PROVIDER": "storefront",
    "AI1_PROVIDER": "googleai",
    "NEXT_PUBLIC_STOREFRONT_ORIGIN": "https://www.zaslony.com",
    "hasGoogleKey": true
  }
}
```

### 2. Check Browser Console
Open your site, press F12, check console for:
```
[ParentBridge] ✓ Initialized {
  parentOrigin: "https://www.zaslony.com"
}
```

### 3. Test Functionality
- Products should load from storefront (not mock)
- Measurement should use configured AI provider
- No "mock provider" messages

---

## 🐛 Common Issues

### Issue: "Still using mock provider"

**Cause:** `CATALOG_PROVIDER` not set or not set before build

**Fix:**
1. Set `CATALOG_PROVIDER=storefront` in hosting platform
2. Rebuild and redeploy
3. Clear browser cache

### Issue: "NEXT_PUBLIC_* variables undefined"

**Cause:** Variables not set before build, or typo in name

**Fix:**
1. Verify exact variable names (case-sensitive!)
2. Set in hosting platform
3. **Trigger a new build** (not just redeploy)
4. Check `/api/debug/env` endpoint

### Issue: "API key not working"

**Cause:** Key not set, or set with wrong name

**Fix:**
1. Check `/api/debug/env` shows `hasGoogleKey: true`
2. Verify key is valid (test locally first)
3. Check for extra spaces or quotes in value
4. Restart server after setting

### Issue: "Variables work locally but not in production"

**Cause:** Using `.env.local` which is ignored in production

**Fix:**
1. Don't rely on `.env.local` for production
2. Set variables in hosting platform
3. Use `.env.production` for Docker/VPS
4. Rebuild after setting variables

---

## 📝 Environment File Priority

Next.js loads env files in this order (later overrides earlier):

1. `.env` - All environments
2. `.env.production` or `.env.development` - Specific environment
3. `.env.local` - Local overrides (gitignored, **NOT used in production**)
4. Platform environment variables - **Highest priority**

**Production uses:**
- `.env` (if committed)
- `.env.production` (if committed)
- Platform environment variables (recommended)

**Production IGNORES:**
- `.env.local`
- `.env.development.local`

---

## 🎯 Recommended Setup

### For Development
```bash
# .env.local (gitignored)
CATALOG_PROVIDER=mock
AI1_PROVIDER=googleai
GOOGLE_GENAI_API_KEY=your-dev-key
NEXT_PUBLIC_CONFIGURE_DEBUG_UI=1
```

### For Production
**Set in hosting platform:**
```bash
CATALOG_PROVIDER=storefront
AI1_PROVIDER=googleai
GOOGLE_GENAI_API_KEY=your-prod-key
NEXT_PUBLIC_STOREFRONT_ORIGIN=https://www.zaslony.com
NEXT_PUBLIC_CONFIGURE_DEBUG_UI=0
```

### Committed Defaults
```bash
# .env (committed to git)
# Safe defaults that work everywhere
CATALOG_PROVIDER=mock
AI1_PROVIDER=googleai
NEXT_PUBLIC_CONFIGURE_DEBUG_UI=0
```

---

## 🔒 Security Best Practices

1. **Never commit API keys** to git
2. **Never expose keys** in `NEXT_PUBLIC_*` variables
3. **Use platform secrets** for sensitive values
4. **Delete `/api/debug/env`** after debugging
5. **Rotate keys** if accidentally exposed

---

## 📞 Quick Fix Commands

### Vercel CLI
```bash
# Set variable
vercel env add CATALOG_PROVIDER production
# Enter: storefront

# List variables
vercel env ls

# Redeploy
vercel --prod
```

### Docker
```bash
# Build with env
docker build --build-arg NEXT_PUBLIC_STOREFRONT_ORIGIN=https://www.zaslony.com .

# Run with env
docker run -e CATALOG_PROVIDER=storefront -e GOOGLE_GENAI_API_KEY=key your-image
```

### Direct Node
```bash
# Build
NEXT_PUBLIC_STOREFRONT_ORIGIN=https://www.zaslony.com npm run build

# Start
CATALOG_PROVIDER=storefront GOOGLE_GENAI_API_KEY=key npm start
```

---

## ✅ Success Indicators

Your production environment is correctly configured when:

- ✅ `/api/debug/env` shows correct values
- ✅ Browser console shows storefront origin
- ✅ Products load from Magento (not mock)
- ✅ No "using mock provider" messages
- ✅ Measurement uses configured AI provider
- ✅ Parent bridge initializes with correct origin

---

**Remember:** After changing environment variables, you usually need to **rebuild and redeploy** (especially for `NEXT_PUBLIC_*` variables).
