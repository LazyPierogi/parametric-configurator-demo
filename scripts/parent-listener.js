/**
 * Parent Storefront Message Listener for Curtain Wizard
 * 
 * Copy this script to your parent storefront at https://www.zaslony.com
 * and include it on any page that embeds the Curtain Wizard iframe.
 * 
 * Usage:
 * <script src="/path/to/parent-listener.js"></script>
 * <iframe src="https://your-curtain-wizard-domain.com/configure"></iframe>
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    // Origin of the Curtain Wizard iframe (MUST match exactly!)
    curtainWizardOrigin: 'https://your-curtain-wizard-domain.com', // TODO: Update this!
    
    // Magento GraphQL endpoint
    magentoGraphQL: 'https://www.zaslony.com/graphql',
    
    // Fabric category ID in Magento
    fabricCategoryId: '8', // TODO: Update if needed
    
    // Enable debug logging
    debug: true
  };

  // Utility: Log messages
  function log(message, data) {
    if (CONFIG.debug) {
      console.log('[Curtain Wizard Parent]', message, data || '');
    }
  }

  // Fetch products from Magento GraphQL
  async function fetchMagentoProducts(locale = 'pl', currency = 'PLN') {
    const query = `
      query GetFabrics {
        products(
          filter: { 
            category_id: { eq: "${CONFIG.fabricCategoryId}" }
          }
          pageSize: 50
        ) {
          items {
            sku
            name
            __typename
            ... on ConfigurableProduct {
              variants {
                product {
                  sku
                  name
                  color
                  price_range {
                    maximum_price {
                      final_price {
                        currency
                        value
                      }
                    }
                  }
                }
              }
            }
            ... on SimpleProduct {
              price_range {
                maximum_price {
                  final_price {
                    currency
                    value
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(CONFIG.magentoGraphQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      throw new Error(`Magento API error: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    // Transform to Curtain Wizard format
    return {
      products: result.data.products.items.map(transformProduct),
      metadata: { 
        locale, 
        currency, 
        totalCount: result.data.products.items.length 
      }
    };
  }

  // Transform Magento product to Curtain Wizard format
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
          fabricWidthCm: 150, // TODO: Get from Magento custom attributes
          verticalRepeatCm: 0,
          repeatType: 'straight',
          // Add more attributes from Magento as needed:
          // compatiblePleats: [...],
          // availableHems: [...],
          // swatchUrl: '...',
          // textureUrl: '...',
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

  // Add items to Magento cart
  async function addToMagentoCart(skus, quantities, metadata) {
    // TODO: Implement actual Magento cart mutation
    // This is a placeholder - replace with your actual cart API call
    
    log('Adding to cart:', { skus, quantities, metadata });

    // Example Magento cart mutation (adjust to your setup):
    /*
    const mutation = `
      mutation AddToCart($cartId: String!, $items: [CartItemInput!]!) {
        addProductsToCart(cartId: $cartId, cartItems: $items) {
          cart {
            id
            items {
              id
              product { sku name }
              quantity
            }
          }
        }
      }
    `;

    const variables = {
      cartId: 'your-cart-id',
      items: skus.map((sku, idx) => ({
        sku,
        quantity: quantities[idx] || 1
      }))
    };

    const response = await fetch(CONFIG.magentoGraphQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation, variables })
    });

    const result = await response.json();
    return result.data.addProductsToCart.cart;
    */

    // Placeholder response
    return {
      success: true,
      cartId: 'magento-cart-' + Date.now(),
      items: skus.map((sku, idx) => ({
        sku,
        quantity: quantities[idx] || 1
      }))
    };
  }

  // Main message listener
  window.addEventListener('message', async function(event) {
    // Security: Verify origin
    if (event.origin !== CONFIG.curtainWizardOrigin) {
      if (CONFIG.debug) {
        console.warn('[Curtain Wizard Parent] Rejected message from untrusted origin:', event.origin);
      }
      return;
    }

    const { id, source, action, payload } = event.data || {};

    // Verify source
    if (source !== 'curtain-wizard') {
      return;
    }

    log(`Received action: ${action}`, payload);

    try {
      let responseData;

      switch (action) {
        case 'getProductList':
          log('Fetching products from Magento...');
          responseData = await fetchMagentoProducts(payload?.locale, payload?.currency);
          log('Products fetched:', responseData.products.length);
          break;

        case 'getProducts':
          const allProducts = await fetchMagentoProducts();
          responseData = {
            products: allProducts.products.filter(p => payload.skus.includes(p.sku)),
            metadata: allProducts.metadata
          };
          break;

        case 'getPriceQuote':
          // Optional: Calculate price on parent side
          // For now, let Curtain Wizard handle pricing
          responseData = {
            currency: 'PLN',
            subtotalMinor: 0,
            totalMinor: 0,
            breakdown: [],
            note: 'Price calculated in Curtain Wizard'
          };
          break;

        case 'addToCart':
          log('Adding to cart:', payload);
          const cartResult = await addToMagentoCart(
            payload.skus,
            payload.quantities || [],
            payload.metadata
          );
          responseData = {
            success: true,
            ...cartResult
          };
          log('Cart updated:', responseData);
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      // Send success response
      event.source.postMessage({
        id,
        source: 'storefront',
        data: responseData
      }, event.origin);

      log(`Response sent for: ${action}`);

    } catch (error) {
      log(`Error handling ${action}:`, error.message);

      // Send error response
      event.source.postMessage({
        id,
        source: 'storefront',
        error: error.message || 'Internal error'
      }, event.origin);
    }
  });

  log('Message listener initialized');
  log('Listening for messages from:', CONFIG.curtainWizardOrigin);

  // Expose configuration for debugging
  if (CONFIG.debug) {
    window.__curtainWizardParent = {
      config: CONFIG,
      testFetch: () => fetchMagentoProducts(),
      version: '1.0.0'
    };
    log('Debug mode enabled. Test with: window.__curtainWizardParent.testFetch()');
  }
})();
