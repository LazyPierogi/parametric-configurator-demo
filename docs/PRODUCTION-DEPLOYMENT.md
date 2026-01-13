# Production Deployment Checklist

**Quick reference for deploying Curtain Wizard to production**

---

## ✅ Pre-Deployment Checklist

### 1. Curtain Wizard Configuration

```bash
# .env.production or environment variables
CATALOG_PROVIDER=storefront
NEXT_PUBLIC_STOREFRONT_ORIGIN=https://www.zaslony.com
NEXT_PUBLIC_STOREFRONT_TIMEOUT_MS=30000

# Disable debug features
NEXT_PUBLIC_CONFIGURE_DEBUG_UI=0
NEXT_PUBLIC_MEASURE_ENGINE_DEBUG=vlm
```

### 2. Deploy Curtain Wizard

Deploy to your domain (e.g., `https://curtain-wizard.zaslony.com` or subdomain)

**Verify deployment:**
- ✅ `/configure` page loads
- ✅ No console errors
- ✅ Environment variables are set correctly

---

## 🏪 Storefront Integration

### 1. Copy Parent Listener Script

**File:** `scripts/parent-listener.js`

Copy this file to your storefront codebase at `https://www.zaslony.com`

### 2. Configure the Script

Update these values in `parent-listener.js`:

```javascript
const CONFIG = {
  // IMPORTANT: Must match your Curtain Wizard domain exactly!
  curtainWizardOrigin: 'https://curtain-wizard.zaslony.com',
  
  // Your Magento GraphQL endpoint
  magentoGraphQL: 'https://www.zaslony.com/graphql',
  
  // Fabric category ID in Magento
  fabricCategoryId: '8', // Update if needed
  
  // Enable for testing, disable in production
  debug: false
};
```

### 3. Add to Storefront Page

On any page where you want to embed Curtain Wizard:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Curtain Configurator</title>
</head>
<body>
  <!-- Your storefront content -->
  
  <!-- Curtain Wizard iframe -->
  <iframe 
    id="curtain-wizard"
    src="https://curtain-wizard.zaslony.com/configure" 
    allow="clipboard-write"
    style="width: 100%; height: 100vh; border: none;"
  ></iframe>
  
  <!-- Parent listener script -->
  <script src="/js/parent-listener.js"></script>
</body>
</html>
```

---

## 🧪 Testing Checklist

### Initial Load
- [ ] Iframe loads without errors
- [ ] Console shows: `[Curtain Wizard Parent] Message listener initialized`
- [ ] No CORS errors in console

### Product Loading
- [ ] Fabrics load from Magento
- [ ] Colors display correctly
- [ ] Prices show in PLN
- [ ] Fabric types are categorized

### Configuration
- [ ] User can select fabric
- [ ] User can choose colors
- [ ] User can adjust dimensions
- [ ] Preview updates correctly

### Add to Cart
- [ ] "Add to Cart" button works
- [ ] Item appears in Magento cart
- [ ] Correct SKU and quantity
- [ ] Configuration metadata is preserved

---

## 🔧 Troubleshooting

### Products Not Loading

**Check:**
1. Browser console for errors
2. Network tab for failed GraphQL requests
3. `fabricCategoryId` is correct in config
4. Magento API is accessible

**Debug:**
```javascript
// In browser console on storefront page:
window.__curtainWizardParent.testFetch()
```

### "Origin Mismatch" Errors

**Check:**
1. `curtainWizardOrigin` in `parent-listener.js` matches exactly
2. `NEXT_PUBLIC_STOREFRONT_ORIGIN` in Curtain Wizard matches exactly
3. No trailing slashes in URLs
4. Protocol matches (https vs http)

### Cart Not Updating

**Check:**
1. `addToMagentoCart()` function is implemented
2. Magento cart mutation is correct
3. Cart ID is valid
4. User is authenticated (if required)

---

## 📊 Monitoring

### What to Monitor

1. **Console Logs** (with `debug: true`):
   - Message flow (request/response)
   - Product fetch success/failure
   - Cart operations

2. **Network Tab**:
   - GraphQL requests to Magento
   - Response times
   - Error rates

3. **User Experience**:
   - Page load time
   - Iframe responsiveness
   - Cart integration success rate

### Debug Mode

Enable debug mode for testing:

```javascript
// In parent-listener.js
const CONFIG = {
  // ...
  debug: true
};
```

Then check console:
```javascript
// Test product fetch
window.__curtainWizardParent.testFetch()

// View config
window.__curtainWizardParent.config
```

---

## 🚀 Go-Live Steps

1. **Deploy Curtain Wizard** to production domain
2. **Copy parent-listener.js** to storefront
3. **Update CONFIG** with production values
4. **Set debug: false** in production
5. **Test on staging** environment first
6. **Deploy to production** storefront
7. **Monitor** for 24 hours
8. **Verify** cart integration works end-to-end

---

## 📞 Support

### Documentation
- **Integration Guide**: `docs/Storefront-Integration.md`
- **Quick Start**: `docs/STOREFRONT-QUICKSTART.md`
- **Task Reference**: `project planning/05-Task-List.md` (section 950)

### Common Issues
- **CORS errors**: Expected - parent makes API calls server-side
- **Origin mismatch**: Check CONFIG values match exactly
- **Products not loading**: Verify Magento category ID and GraphQL query

### Files to Review
- `scripts/parent-listener.js` - Parent-side implementation
- `apps/web/lib/parent-bridge.ts` - Child-side communication
- `packages/core/src/catalog/providers/storefront.ts` - Catalog provider

---

## ✨ Success Criteria

Your integration is successful when:

- ✅ Curtain Wizard loads in iframe without errors
- ✅ Products fetch from Magento GraphQL
- ✅ User can configure curtains
- ✅ "Add to Cart" adds items to Magento cart
- ✅ No console errors in production
- ✅ Communication log shows successful message flow (debug mode)

**Congratulations!** 🎉 Your Curtain Wizard is now integrated with Magento!
