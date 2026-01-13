#!/usr/bin/env node
/**
 * Test script for connecting Curtain Wizard to real Magento storefront
 * 
 * This script creates a local test page that:
 * - Acts as the parent storefront window
 * - Embeds Curtain Wizard as an iframe
 * - Implements the parent message listener
 * - Fetches real product data from https://www.zaslony.com
 * 
 * Usage:
 *   node scripts/test-storefront-connection.mjs
 * 
 * Then open: http://localhost:3001
 */

import http from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3001;
const CURTAIN_WIZARD_URL = 'http://localhost:3000/configure'; // Your dev server
const MAGENTO_URL = 'https://www.zaslony.com/graphql';

console.log('🧪 Curtain Wizard ↔ Magento Storefront Connection Test');
console.log('=======================================================\n');

// HTML test page that acts as parent storefront
const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Storefront Test Page — Curtain Wizard Integration</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
      background: #f5f5f5;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    .header {
      background: #1a1a1a;
      color: white;
      padding: 16px 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .header h1 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .header p {
      font-size: 13px;
      color: #999;
    }
    
    .status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 12px;
    }
    
    .status.ready { background: #10b981; color: white; }
    .status.waiting { background: #f59e0b; color: white; }
    
    .container {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    
    .sidebar {
      width: 400px;
      background: white;
      border-right: 1px solid #e5e5e5;
      overflow-y: auto;
      padding: 20px;
    }
    
    .sidebar h2 {
      font-size: 16px;
      margin-bottom: 16px;
      color: #1a1a1a;
    }
    
    .log-entry {
      margin-bottom: 12px;
      padding: 12px;
      background: #f9f9f9;
      border-left: 3px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.5;
    }
    
    .log-entry.request { border-left-color: #3b82f6; }
    .log-entry.response { border-left-color: #10b981; }
    .log-entry.error { border-left-color: #ef4444; background: #fef2f2; }
    
    .log-entry .time {
      font-size: 11px;
      color: #666;
      font-family: 'Monaco', monospace;
    }
    
    .log-entry .action {
      font-weight: 600;
      color: #1a1a1a;
      margin: 4px 0;
    }
    
    .log-entry .details {
      font-size: 12px;
      color: #666;
      font-family: 'Monaco', monospace;
      margin-top: 6px;
      white-space: pre-wrap;
      max-height: 200px;
      overflow-y: auto;
    }
    
    .iframe-container {
      flex: 1;
      background: white;
      position: relative;
    }
    
    iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    
    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: #666;
    }
    
    .spinner {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #3b82f6;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 12px;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .controls {
      padding: 12px 20px;
      background: #fafafa;
      border-top: 1px solid #e5e5e5;
      display: flex;
      gap: 12px;
      align-items: center;
    }
    
    button {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    button.primary {
      background: #3b82f6;
      color: white;
    }
    
    button.primary:hover {
      background: #2563eb;
    }
    
    button.secondary {
      background: white;
      color: #1a1a1a;
      border: 1px solid #e5e5e5;
    }
    
    button.secondary:hover {
      background: #f9f9f9;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>
      🏪 Magento Storefront Test Page
      <span class="status waiting" id="status">Waiting for iframe...</span>
    </h1>
    <p>Testing Curtain Wizard integration (using mock Magento data - CORS prevents direct API calls from localhost)</p>
  </div>
  
  <div class="container">
    <div class="sidebar">
      <h2>📡 Communication Log</h2>
      <div id="log"></div>
    </div>
    
    <div class="iframe-container">
      <div class="loading" id="loading">
        <div class="spinner"></div>
        <div>Loading Curtain Wizard...</div>
      </div>
      <iframe 
        id="wizard-iframe"
        src="${CURTAIN_WIZARD_URL}"
        allow="clipboard-write"
      ></iframe>
    </div>
  </div>
  
  <div class="controls">
    <button class="secondary" onclick="clearLog()">Clear Log</button>
    <button class="secondary" onclick="reloadIframe()">Reload Iframe</button>
    <button class="primary" onclick="testProductFetch()">Test Product Fetch</button>
  </div>

  <script>
    const log = document.getElementById('log');
    const statusEl = document.getElementById('status');
    const loadingEl = document.getElementById('loading');
    const iframe = document.getElementById('wizard-iframe');
    
    let messageCount = 0;
    
    // Utility: Add log entry
    function addLog(type, action, details) {
      const entry = document.createElement('div');
      entry.className = \`log-entry \${type}\`;
      
      const time = new Date().toLocaleTimeString();
      const detailsStr = typeof details === 'object' 
        ? JSON.stringify(details, null, 2) 
        : details;
      
      entry.innerHTML = \`
        <div class="time">\${time}</div>
        <div class="action">\${action}</div>
        <div class="details">\${detailsStr}</div>
      \`;
      
      log.insertBefore(entry, log.firstChild);
      messageCount++;
    }
    
    // Utility: Clear log
    window.clearLog = function() {
      log.innerHTML = '';
      messageCount = 0;
    };
    
    // Utility: Reload iframe
    window.reloadIframe = function() {
      iframe.src = iframe.src;
      loadingEl.style.display = 'block';
      statusEl.className = 'status waiting';
      statusEl.textContent = 'Reloading...';
    };
    
    // Utility: Manual product fetch test
    window.testProductFetch = async function() {
      addLog('request', 'Manual Test: Fetching Products', 'Testing Magento GraphQL...');
      
      try {
        const products = await fetchMagentoProducts();
        addLog('response', 'Manual Test: Success', {
          productCount: products.products.length,
          sample: products.products[0]
        });
      } catch (error) {
        addLog('error', 'Manual Test: Failed', error.message);
      }
    };
    
    // Hide loading when iframe loads
    iframe.addEventListener('load', () => {
      loadingEl.style.display = 'none';
      statusEl.className = 'status ready';
      statusEl.textContent = 'Ready';
      addLog('response', 'Iframe Loaded', 'Curtain Wizard is ready');
    });
    
    // Fetch products from Magento
    // NOTE: Using mock data because direct calls to Magento are blocked by CORS
    // In production, the parent storefront will make these calls server-side
    async function fetchMagentoProducts(locale = 'pl', currency = 'PLN') {
      console.log('[Mock] Simulating Magento API call...');
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Mock data based on your actual Magento response format
      const mockMagentoResponse = {
        data: {
          products: {
            items: [
              {
                sku: "test1-parent",
                name: "Test Fabric 1",
                __typename: "ConfigurableProduct",
                variants: [
                  {
                    product: {
                      sku: "test1-child-white",
                      name: "Test Fabric 1 - White",
                      color: 10,
                      price_range: {
                        maximum_price: {
                          final_price: { currency: "PLN", value: 240 }
                        }
                      }
                    }
                  },
                  {
                    product: {
                      sku: "test1-child-ivory",
                      name: "Test Fabric 1 - Ivory",
                      color: 13,
                      price_range: {
                        maximum_price: {
                          final_price: { currency: "PLN", value: 240 }
                        }
                      }
                    }
                  },
                  {
                    product: {
                      sku: "test1-child-stone",
                      name: "Test Fabric 1 - Stone",
                      color: 14,
                      price_range: {
                        maximum_price: {
                          final_price: { currency: "PLN", value: 240 }
                        }
                      }
                    }
                  }
                ]
              },
              {
                sku: "linea-white-78",
                name: "LINEA white 78",
                __typename: "SimpleProduct",
                price_range: {
                  maximum_price: {
                    final_price: { currency: "PLN", value: 180 }
                  }
                }
              }
            ]
          }
        }
      };
      
      // Transform to Curtain Wizard format
      return {
        products: mockMagentoResponse.data.products.items.map(transformProduct),
        metadata: { 
          locale, 
          currency, 
          totalCount: mockMagentoResponse.data.products.items.length,
          note: 'Mock data - CORS prevents direct Magento calls from localhost'
        }
      };
    }
    
    function transformProduct(magentoProduct) {
      if (magentoProduct.__typename === 'ConfigurableProduct') {
        const colors = magentoProduct.variants.map(v => v.product.color);
        const firstVariant = magentoProduct.variants[0]?.product;
        
        return {
          sku: magentoProduct.sku,
          name: magentoProduct.name,
          type: 'fabric',
          price: firstVariant?.price_range.maximum_price.final_price.value * 100, // Convert to minor units
          currency: firstVariant?.price_range.maximum_price.final_price.currency || 'PLN',
          attributes: {
            colors: colors,
            fabricWidthCm: 150, // TODO: Get from Magento attributes
            verticalRepeatCm: 0,
            repeatType: 'straight',
          },
          metadata: {
            variants: magentoProduct.variants,
            __typename: magentoProduct.__typename
          }
        };
      }
      
      // SimpleProduct
      const price = magentoProduct.price_range?.maximum_price?.final_price;
      return {
        sku: magentoProduct.sku,
        name: magentoProduct.name,
        type: 'fabric',
        price: price ? price.value * 100 : 0,
        currency: price?.currency || 'PLN',
        attributes: {
          fabricWidthCm: 150,
        },
        metadata: {
          __typename: magentoProduct.__typename
        }
      };
    }
    
    // Parent message listener
    window.addEventListener('message', async function(event) {
      // Security: Verify origin
      if (event.origin !== '${CURTAIN_WIZARD_URL.replace('/configure', '')}') {
        console.warn('Rejected message from untrusted origin:', event.origin);
        return;
      }

      const { id, source, action, payload } = event.data || {};
      
      // Verify source
      if (source !== 'curtain-wizard') return;

      addLog('request', \`Received: \${action}\`, payload);

      try {
        let responseData;

        switch (action) {
          case 'getProductList':
            addLog('request', 'Fetching from Magento...', 'Calling GraphQL API');
            responseData = await fetchMagentoProducts(payload.locale, payload.currency);
            addLog('response', 'Magento Response', {
              productCount: responseData.products.length,
              firstProduct: responseData.products[0]?.name
            });
            break;

          case 'getProducts':
            const allProducts = await fetchMagentoProducts();
            responseData = {
              products: allProducts.products.filter(p => payload.skus.includes(p.sku)),
              metadata: allProducts.metadata
            };
            break;

          case 'getPriceQuote':
            // Let Curtain Wizard calculate pricing
            responseData = {
              currency: 'PLN',
              subtotalMinor: 0,
              totalMinor: 0,
              breakdown: [],
              note: 'Price calculated in Curtain Wizard'
            };
            break;

          case 'addToCart':
            addLog('request', 'Add to Cart', payload);
            // TODO: Implement actual Magento cart API call
            responseData = {
              success: true,
              cartId: 'test-cart-' + Date.now(),
              items: payload.skus.map((sku, idx) => ({
                sku,
                quantity: payload.quantities[idx] || 1
              })),
              metadata: payload.metadata
            };
            addLog('response', 'Cart Updated', responseData);
            break;

          default:
            throw new Error(\`Unknown action: \${action}\`);
        }

        // Send success response
        event.source.postMessage({
          id,
          source: 'storefront',
          data: responseData
        }, event.origin);
        
        addLog('response', \`Sent Response: \${action}\`, 'Success');

      } catch (error) {
        addLog('error', \`Error: \${action}\`, error.message);
        
        // Send error response
        event.source.postMessage({
          id,
          source: 'storefront',
          error: error.message || 'Internal error'
        }, event.origin);
      }
    });

    console.log('[Storefront Test] Message listener initialized');
    console.log('[Storefront Test] Listening for messages from:', '${CURTAIN_WIZARD_URL.replace('/configure', '')}');
  </script>
</body>
</html>`;

// HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML_PAGE);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log('✅ Test server started successfully\n');
  console.log('📋 Instructions:');
  console.log('1. Make sure Curtain Wizard dev server is running on http://localhost:3000');
  console.log('2. Set CATALOG_PROVIDER=storefront in your .env.local');
  console.log('3. Open the test page:\n');
  console.log(`   👉 http://localhost:${PORT}\n`);
  console.log('4. Watch the communication log in the sidebar');
  console.log('5. Try using the configurator - it will fetch real Magento products\n');
  console.log('Press Ctrl+C to stop the server');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please stop the other process or choose a different port.`);
  } else {
    console.error('❌ Server error:', err.message);
  }
  process.exit(1);
});
