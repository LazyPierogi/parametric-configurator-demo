# Storefront Integration — Quick Start

**Ready to test!** This guide gets you up and running with the Magento integration in 5 minutes.

---

## 🚀 Quick Test (Local Development)

### 1. Configure Curtain Wizard

```bash
# In your .env.local file
CATALOG_PROVIDER=storefront
NEXT_PUBLIC_STOREFRONT_ORIGIN=https://www.zaslony.com
```

### 2. Start Dev Server

```bash
npm run dev
```

Your dev server should be running at `http://localhost:3000`

### 3. Run Test Script

Open a **new terminal** and run:

```bash
node scripts/test-storefront-connection.mjs
```

This will:
- Start a test page at `http://localhost:3001`
- Act as the parent storefront window
- Embed your local Curtain Wizard as an iframe
- Fetch real products from `https://www.zaslony.com/graphql`
- Show all communication in a live log

### 4. Open Test Page

Visit: **http://localhost:3001**

You should see:
- ✅ Curtain Wizard loaded in an iframe
- ✅ Communication log showing messages
- ✅ Products loading from real Magento

---

## 🧪 What to Test

1. **Product Listing**
   - Open configurator
   - Select fabric type
   - Verify fabrics load from Magento

2. **Product Details**
   - Select a fabric
   - Check if colors are available
   - Verify pricing displays correctly

3. **Add to Cart**
   - Configure a curtain
   - Click "Add to Cart"
   - Watch the communication log for cart messages

---

## 📊 Understanding the Test Page

The test page has three sections:

### Header
- Shows connection status (Ready/Waiting)
- Displays test environment info

### Left Sidebar (Communication Log)
- **Blue entries**: Requests from Curtain Wizard → Parent
- **Green entries**: Responses from Parent → Curtain Wizard
- **Red entries**: Errors

### Center (Iframe)
- Your Curtain Wizard running in iframe mode
- Behaves exactly as it would in production

### Bottom Controls
- **Clear Log**: Reset communication log
- **Reload Iframe**: Restart Curtain Wizard
- **Test Product Fetch**: Manually trigger Magento API call

---

## 🔧 Troubleshooting

### "No products loading"

**Check:**
1. Is your dev server running on `http://localhost:3000`?
2. Is `CATALOG_PROVIDER=storefront` set in `.env.local`?
3. Check browser console for errors
4. Look at the communication log for error messages

**Solution:**
```bash
# Verify dev server is running
curl http://localhost:3000/configure

# Check environment
cat .env.local | grep CATALOG_PROVIDER
```

### "Timeout waiting for parent"

**Check:**
1. Is the test page listening for messages?
2. Is the origin correct?

**Solution:**
- Open browser DevTools (F12)
- Check Console tab for initialization logs
- Should see: `[Storefront Test] Message listener initialized`

### "GraphQL errors"

**Check:**
- Network tab in DevTools
- Look for failed requests to `https://www.zaslony.com/graphql`

**Common causes:**
- Category ID in query may be wrong
- Magento API might be down
- CORS issues (should not happen with postMessage)

---

## 📖 Next Steps

### For Local Development
Continue using the mock parent:
```javascript
// In browser console at http://localhost:3000/configure
window.__startParentMock()
```

### For Staging/Production
See the complete integration guide:
- **Full documentation**: `docs/Storefront-Integration.md`
- **Magento response format**: `docs/Proposed Magento Response Format.md`
- **Task reference**: `project planning/05-Task-List.md` (section 950)

### Need Help?
1. Check browser console (both test page AND iframe)
2. Review communication log in test page sidebar
3. Verify Magento GraphQL query in `scripts/test-storefront-connection.mjs`
4. See troubleshooting section in `docs/Storefront-Integration.md`

---

## 🎯 Production Deployment

When ready to deploy:

### 1. Deploy Curtain Wizard
Deploy to your production domain (e.g., `https://curtain-wizard.zaslony.com`)

### 2. Add Parent Listener to Storefront

Copy `scripts/parent-listener.js` to your storefront and include it on pages with the iframe:

```html
<!-- On your storefront page at https://www.zaslony.com -->
<script src="/path/to/parent-listener.js"></script>
<iframe src="https://curtain-wizard.zaslony.com/configure"></iframe>
```

**Configure the script:**
```javascript
// In parent-listener.js, update these values:
const CONFIG = {
  curtainWizardOrigin: 'https://curtain-wizard.zaslony.com', // Your Curtain Wizard domain
  magentoGraphQL: 'https://www.zaslony.com/graphql',
  fabricCategoryId: '8', // Your fabric category ID
  debug: false // Set to true for testing
};
```

### 3. Test End-to-End
1. Open your storefront page with the iframe
2. Verify products load from Magento
3. Test "Add to Cart" functionality
4. Check browser console for any errors

### 4. Implement Cart Integration
In `parent-listener.js`, replace the placeholder `addToMagentoCart()` function with your actual Magento cart mutation (see TODO comments in the file)

---

**That's it!** You should now have Curtain Wizard talking to real Magento data. 🎉
