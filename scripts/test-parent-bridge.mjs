#!/usr/bin/env node
/**
 * Test script for parent-child iframe communication
 * 
 * This script helps test the postMessage communication between
 * Curtain Wizard (iframe child) and parent storefront.
 * 
 * Usage:
 *   node scripts/test-parent-bridge.mjs
 */

console.log('📡 Curtain Wizard → Storefront Communication Test');
console.log('================================================\n');

console.log('This is a manual test guide for parent-child iframe communication.\n');

console.log('🔧 Setup Instructions:');
console.log('1. Set CATALOG_PROVIDER=storefront in .env');
console.log('2. Set NEXT_PUBLIC_STOREFRONT_ORIGIN to your parent domain (e.g., https://www.zaslony.com)');
console.log('3. Start the Next.js dev server: npm run dev\n');

console.log('🧪 Test Scenarios:\n');

console.log('A. Test with Mock Parent (Development):');
console.log('   1. Open http://localhost:3000/configure in browser');
console.log('   2. Open browser console');
console.log('   3. Run: window.__startParentMock()');
console.log('   4. Use the configurator - it should fetch products from mock parent');
console.log('   5. Try adding to cart - check console for parent communication\n');

console.log('B. Test in Real Iframe (Staging):');
console.log('   1. Deploy Curtain Wizard to staging/production');
console.log('   2. Embed in parent storefront as iframe:');
console.log('      <iframe src="https://your-wizard.com/configure" />');
console.log('   3. Implement parent-side message listener (see example below)\n');

console.log('📄 Parent Storefront Message Listener Example:');
console.log('```javascript');
console.log('window.addEventListener("message", function(event) {');
console.log('  // Security: check origin');
console.log('  if (event.origin !== "https://your-wizard.com") return;');
console.log('  ');
console.log('  const { id, source, action, payload } = event.data;');
console.log('  if (source !== "curtain-wizard") return;');
console.log('  ');
console.log('  // Handle actions');
console.log('  let responseData;');
console.log('  ');
console.log('  switch (action) {');
console.log('    case "getProductList":');
console.log('      responseData = { products: [...], categories: [...] };');
console.log('      break;');
console.log('    case "getProducts":');
console.log('      const skus = payload.skus;');
console.log('      responseData = { products: getProductsBySkus(skus) };');
console.log('      break;');
console.log('    case "addToCart":');
console.log('      addItemsToCart(payload.skus, payload.quantities);');
console.log('      responseData = { success: true, cartId: "..." };');
console.log('      break;');
console.log('  }');
console.log('  ');
console.log('  // Send response back to iframe');
console.log('  event.source.postMessage({');
console.log('    id: id,');
console.log('    source: "storefront",');
console.log('    data: responseData');
console.log('  }, event.origin);');
console.log('});');
console.log('```\n');

console.log('🔍 Expected Actions:');
console.log('- getProductList: Fetch all available fabrics');
console.log('- getProducts: Fetch specific products by SKU');
console.log('- getPriceQuote: Get price quote for configuration (optional)');
console.log('- addToCart: Add configured curtain to parent cart\n');

console.log('📊 Message Format:');
console.log('Child → Parent Request:');
console.log('  { id, source: "curtain-wizard", action, payload }');
console.log('Parent → Child Response:');
console.log('  { id, source: "storefront", data } OR { id, source: "storefront", error }\n');

console.log('✅ Success Indicators:');
console.log('- No "Parent bridge not available" errors in console');
console.log('- Products load in configurator fabric selector');
console.log('- "Add to Cart" succeeds with parent response');
console.log('- Parent cart updates with configured curtain\n');

console.log('❌ Troubleshooting:');
console.log('- Check NEXT_PUBLIC_STOREFRONT_ORIGIN matches parent domain');
console.log('- Verify parent listener is running before iframe loads');
console.log('- Check browser console for CORS or origin mismatch errors');
console.log('- Increase timeout if parent responses are slow (NEXT_PUBLIC_STOREFRONT_TIMEOUT_MS)\n');

console.log('📖 Documentation:');
console.log('- apps/web/lib/parent-bridge.ts - Communication layer');
console.log('- apps/web/lib/parent-bridge-mock.ts - Development mock');
console.log('- packages/core/src/catalog/providers/storefront.ts - Catalog provider');
console.log('- packages/core/src/catalog/storefront/types.ts - Data types\n');

console.log('Done! See docs/RUNBOOK.md for detailed integration guide.');
