/**
 * Storefront Bridge - Handles communication between parent storefront and configurator
 * Replaces the embedded IIFE script with a type-safe TypeScript module
 */

import html2canvas from 'html2canvas';

interface StorefrontConfig {
  apiUrl: string;
  trustedOrigins: string[];
  debug: boolean;
}

interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{ message: string }>;
}

interface ProductVariant {
  sku: string;
  name: string;
  color: string;
  color_label: string;
  colorCategory: string;
  price: number;
  thumbnail: string;
  pricePerMLinearMinor: number;
  pleatSurchargePerSegmentMinor: number;
  hemSurchargeMinor: number;
}

interface ProductAttributes {
  colors?: string[];
  fabric_id?: string;
  style?: string;
  typeId?: string;
  materialFamily?: string;
  pattern?: string;
  childItems?: ProductVariant[];
  texture_default_tile_width_px?: number;
  texture_default_opacity_pct?: number;
  fabric_width_cm?: number;
  is_double_width?: boolean;
  is_railroadable?: boolean;
  widths_per_panel?: number;
  vertical_repeat_cm?: number;
  repeat_type?: string;
  min_order_increment_cm?: number;
  allowance_cm_top?: number;
  allowance_cm_bottom?: number;
  shrinkage_pct?: number;
  fullness_by_pleat_wave?: Record<string, number>;
  fullness_by_pleat_tape?: Record<string, number>;
  compatible_pleats?: string[];
  available_hems?: string[];
  pleatSurchargePerSegmentMinor?: number;
  hemSurchargeMinor?: number;
}

interface Product {
  sku: string;
  name: string;
  price: number;
  priceMinor: number;
  attributes: ProductAttributes;
}

interface CartItem {
  parent_sku: string;
  child_sku: string;
  qty: number;
}

interface CartResult {
  sku: string;
  name: string;
  price: number;
  quoteItemId?: number;
}

interface MessagePayload {
  id: string;
  action: string;
  payload?: Record<string, any>;
}

interface MessageResponse {
  id: string;
  products?: CartResult[];
  source: string;
  error?: string;
  [key: string]: any;
}

type ActionHandler = (payload: Record<string, any>) => Promise<any>;

declare global {
  interface Window {
    CONFIG?: Partial<StorefrontConfig>;
    configuratorApi?: {
      getProductList: () => Promise<Product[]>;
      getProducts: (options: { skus: string[] }) => Promise<Product[]>;
      addToCart: (options: { cartItems: CartItem[] }) => Promise<CartResult[]>;
    };
  }
}

const DEFAULT_CONFIG: StorefrontConfig = {
  apiUrl: '',
  trustedOrigins: [],
  debug: false,
};

class Logger {
  private debug: boolean;

  constructor(debug: boolean) {
    this.debug = debug;
  }

  log(message: string, data?: any): void {
    if (this.debug) {
      console.log(`[Configurator] ${message}`, data || '');
    }
  }

  error(message: string, error?: any): void {
    console.error(`[Configurator Error] ${message}`, error || '');
  }
}

class GraphQLClient {
  private apiUrl: string;
  private logger: Logger;

  constructor(apiUrl: string, logger: Logger) {
    this.apiUrl = apiUrl;
    this.logger = logger;
  }

  async query<T = any>(
    queryStr: string,
    variables: Record<string, any> = {},
  ): Promise<GraphQLResponse<T>> {
    try {
      if (!this.apiUrl) {
        throw new Error(
          'Storefront GraphQL is not configured. Set NEXT_PUBLIC_GRAPHQL_ENDPOINT (or pass apiUrl to initStorefrontBridge).',
        );
      }
      const authToken = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: queryStr,
          variables,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const message = result?.errors?.[0]?.message || response.statusText;
        throw new Error(`HTTP ${response.status}: ${message}`);
      }

      if (result.errors && result.errors.length) {
        const message = result.errors.map((e: any) => e.message).join('; ');
        throw new Error(message);
      }

      return result;
    } catch (error) {
      this.logger.error('GraphQL query error:', error);
      throw error;
    }
  }

  async mutate<T = any>(
    mutationStr: string,
    variables: Record<string, any> = {},
  ): Promise<GraphQLResponse<T>> {
    return this.query(mutationStr, variables);
  }
}

class StorefrontBridge {
  private config: StorefrontConfig;
  private logger: Logger;
  private graphqlClient: GraphQLClient;
  private messageHandlers: Map<string, ActionHandler> = new Map();

  constructor(config: Partial<StorefrontConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new Logger(this.config.debug);
    this.graphqlClient = new GraphQLClient(this.config.apiUrl, this.logger);

    this.registerHandlers();
    this.setupMessageListener();
  }

  private registerHandlers(): void {
    this.messageHandlers.set('getProductList', () => this.getProductList());
    this.messageHandlers.set('getProducts', (payload: any) => this.getProducts(payload));
    this.messageHandlers.set('addToCart', (payload: any) => this.addToCart(payload));
    this.messageHandlers.set('scrollParent', (payload: any) => this.scrollParent(payload));
    this.messageHandlers.set('pingResponse', () => this.pingResponse());
  }

  private setupMessageListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('message', async (event: MessageEvent) => {
      if (event.data.type === 'configuratorHeight') {
        // Handle height updates if needed
      }

      const sameOrigin = event.origin === window.location.origin;

      // Verify origin. If no trustedOrigins configured, allow only same-origin messages by default.
      if (!sameOrigin && this.config.trustedOrigins.length > 0 && !this.config.trustedOrigins.includes(event.origin)) {
        this.logger.log('Message from untrusted origin:', event.origin);
        return;
      }
      if (!sameOrigin && this.config.trustedOrigins.length === 0) {
        this.logger.log('Message ignored (no trustedOrigins configured):', event.origin);
        return;
      }

      const { id, action, payload }: MessagePayload = event.data || {};
      if (!id || !action) return;

      this.logger.log(`Received action request: ${action}`, payload);

      const handler = this.messageHandlers.get(action);
      if (!handler) {
        event.source?.postMessage(
          { id, error: `Unknown action '${action}'`, source: 'storefront' },
          { targetOrigin: event.origin },
        );
        return;
      }

      try {
        const result = await handler(payload || {});

        if (action === 'scrollParent') {
          return; // no response needed
        }

        if (action === 'pingResponse') {
          event.source?.postMessage({ id, ...result, source: 'storefront' }, { targetOrigin: event.origin });
          return;
        }

        event.source?.postMessage({ id, products: result, source: 'storefront' }, { targetOrigin: event.origin });
      } catch (err: any) {
        event.source?.postMessage(
          {
            id,
            source: 'storefront',
            error: err?.message || 'Parent action failed',
          },
          { targetOrigin: event.origin },
        );
      }
    });
  }

  private async getProductList(): Promise<Product[]> {
    const queryStr = `
      query {
        customProducts(
          filter: {}
          pageSize: 20
          currentPage: 1
        ) {
          items {
            sku
            name
            __typename
            price_flex
            price_double_flex
            price_wave
            fabric_id
            fabric_type_id
            fabric_style_id
            fabric_material_id
            pattern
            texture_default_tile_width_px
            texture_default_opacity_pct
            fabric_width_cm
            is_double_width
            is_railroadable
            widths_per_panel
            vertical_repeat_cm
            repeat_type
            min_order_increment_cm
            allowance_cm_top
            allowance_cm_bottom
            shrinkage_pct
            fullness_by_pleat_wave
            fullness_by_pleat_tape
            compatible_pleats
            available_hems
            pleat_surcharge_per_segment_minor
            hem_surcharge_minor
            price_range {
              minimum_price {
                regular_price {
                  value
                }
              }
            }
            ... on ConfigurableProduct {
              pattern_label
              fabric_type_id_label
              fabric_style_id_label
              fabric_material_id_label
              variants {
                product {
                  sku
                  name
                  color
                  color_hex
                  color_label
                  thumbnail {
                    url
                  }
                  ... on SimpleProduct {
                    name
                    color_categories {
                      name
                    }
                  }
                  price_range {
                    maximum_price {
                      regular_price {
                        currency
                        value
                      }
                      final_price {
                        currency
                        value
                      }
                    }
                    minimum_price {
                      regular_price {
                        currency
                        value
                      }
                      final_price {
                        currency
                        value
                      }
                    }
                  }
                  __typename
                }
              }
            }
          }
        }
      }
    `;

    try {
      const result = await this.graphqlClient.query(queryStr);

      const products: Product[] = (result.data?.customProducts?.items || []).map((item: any) => ({
        sku: item.sku,
        name: item.name,
        price: item.price_range?.minimum_price?.regular_price?.value || 0,
        priceMinor: item.price_range?.minimum_price?.regular_price?.value || 0,
        attributes: {
          colors: item.variants?.map((v: any) => v.product.color_hex),
          fabric_id: item.fabric_id,
          price_wave: item.price_wave,
          price_flex: item.price_flex,
          price_double_flex: item.price_double_flex,
          style: item.fabric_style_id_label,
          typeId: item.fabric_type_id_label,
          materialFamily: item.fabric_material_id_label,
          pattern: item.pattern,
          childItems: item.variants?.map(({ product }: any) => ({
            sku: product.sku,
            name: product.name,
            color: product.color_hex,
            color_label: product.color_label,
            colorCategory: product.color_categories?.map((c: any) => c.name).join(', ') || '',
            price: product.price_range?.minimum_price?.regular_price?.value || 0,
            thumbnail: product.thumbnail?.url || '',
            pricePerMLinearMinor: product.price_range?.minimum_price?.regular_price?.value || 0,
            pleatSurchargePerSegmentMinor: 0,
            hemSurchargeMinor: 0,
          })),
          texture_default_tile_width_px: item.texture_default_tile_width_px,
          texture_default_opacity_pct: item.texture_default_opacity_pct,
          fabric_width_cm: item.fabric_width_cm,
          is_double_width: item.is_double_width,
          is_railroadable: item.is_railroadable,
          widths_per_panel: item.widths_per_panel,
          vertical_repeat_cm: item.vertical_repeat_cm,
          repeat_type: item.repeat_type,
          min_order_increment_cm: item.min_order_increment_cm,
          allowance_cm_top: item.allowance_cm_top,
          allowance_cm_bottom: item.allowance_cm_bottom,
          shrinkage_pct: item.shrinkage_pct,
          fullness_by_pleat_wave: item.fullness_by_pleat_wave,
          fullness_by_pleat_tape: item.fullness_by_pleat_tape,
          compatible_pleats: item.compatible_pleats,
          available_hems: item.available_hems,
          pleatSurchargePerSegmentMinor: item.pleat_surcharge_per_segment_minor,
          hemSurchargeMinor: item.hem_surcharge_minor,
        },
      }));

      return products;
    } catch (error) {
      this.logger.error('Error fetching product list:', error);
      return [];
    }
  }

  private async getProducts(payload: { skus: string[] }): Promise<Product[]> {
    const { skus } = payload;
    if (!skus || !Array.isArray(skus) || skus.length === 0) {
      return [];
    }

    const queryStr = `
      query GetProductsBySku($skus: [String!]!) {
        products(filter: { sku: { in: $skus } }) {
          items {
            sku
            name
            price_range {
              minimum_price {
                final_price {
                  value
                  currency
                }
              }
            }
          }
        }
      }
    `;

    try {
      const result = await this.graphqlClient.query(queryStr, { skus });

      const products: Product[] = (result.data?.products?.items || []).map((item: any) => ({
        sku: item.sku,
        name: item.name,
        price: item.price_range?.minimum_price?.final_price?.value || 0,
        priceMinor: item.price_range?.minimum_price?.final_price?.value || 0,
        attributes: {},
      }));

      return products;
    } catch (error) {
      this.logger.error('Error fetching products by SKU:', error);
      return [];
    }
  }

  private async addToCart(payload: { cartItems: CartItem[] }): Promise<CartResult[]> {
    const { cartItems } = payload;
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return [];
    }

    try {
      // Capture canvas screenshot at the start
      let canvasScreenshotBase64: string | null = null;
      
      if (typeof document !== 'undefined') {
        try {
          // Capture #main_content_inner element screenshot
          const targetElement = document.querySelector('#main_content_inner') as HTMLElement;
          if (targetElement) {
            const canvas = await html2canvas(targetElement, {
              logging: false,
              useCORS: true,
              allowTaint: true,
              backgroundColor: null, // Preserve transparency
              scale: window.devicePixelRatio || 1, // Capture at device resolution
              foreignObjectRendering: false, // Force inline SVG rendering for masks
              removeContainer: true, // Clean up temporary containers
            });
            const dataUrl = canvas.toDataURL('image/png');
            canvasScreenshotBase64 = dataUrl.split(',')[1];
            this.logger.log('#main_content_inner screenshot captured via html2canvas');
          } else {
            // Fallback to full page if element not found
            const canvas = await html2canvas(document.body, {
              logging: false,
              useCORS: true,
              allowTaint: true,
              backgroundColor: null,
              scale: window.devicePixelRatio || 1,
              foreignObjectRendering: false,
              removeContainer: true,
            });
            const dataUrl = canvas.toDataURL('image/png');
            canvasScreenshotBase64 = dataUrl.split(',')[1];
            this.logger.log('Page screenshot captured via html2canvas (element not found)');
          }
        } catch (screenshotError) {
          this.logger.error('Failed to capture screenshot:', screenshotError);
          // Use empty GIF as fallback
          canvasScreenshotBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        }
      }
      
      // Fallback to empty GIF if we couldn't capture anything
      if (!canvasScreenshotBase64) {
        canvasScreenshotBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      }

      const results: CartResult[] = [];

      // Get or create cart ID
      // let cartId = typeof localStorage !== 'undefined' ? localStorage.getItem('cart_id') : null;
      let cartId = null; // always create new one


      if (!cartId) {
        const createCartMutation = `
          mutation {
            createEmptyCart
          }
        `;
        const createCartResult = await this.graphqlClient.mutate(createCartMutation);
        cartId = createCartResult.data?.createEmptyCart;

        if (!cartId) {
          throw new Error('Failed to create cart');
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('cart_id', cartId);
        }
      }

      // Separate items into configurable and virtual
      const configurableItems: any[] = [];
      const virtualItems: any[] = [];

      for (const item of cartItems) {
        if (item.parent_sku.includes('SERVICE')) {
          virtualItems.push({
            data: {
              sku: item.parent_sku,
              quantity: item.qty,
            },
          });
        } else {
          configurableItems.push({
            parent_sku: item.parent_sku,
            variant_sku: item.child_sku,
            data: {
              sku: item.child_sku,
              parent_sku: item.parent_sku,
              quantity: item.qty,
            },
          });
        }
      }

      // Add configurable products
      if (configurableItems.length > 0) {
        const addConfigurableMutation = `
          mutation($input: AddConfigurableProductsToCartInput!) {
            addConfigurableProductsToCart(input: $input) {
              cart {
                items {
                  id
                  quote_item_id
                  product { name sku }
                  quantity
                  prices { price { value currency } }
                }
              }
            }
          }
        `;

        const result = await this.graphqlClient.mutate(addConfigurableMutation, {
          input: { cart_id: cartId, cart_items: configurableItems },
        });

        for (const addedItem of result.data?.addConfigurableProductsToCart?.cart?.items || []) {
          results.push({
            sku: addedItem.product.sku,
            name: addedItem.product.name,
            price: addedItem.prices?.price?.value || 0,
            quoteItemId: addedItem.id,
          });
        }
      }

      // Add virtual products
      if (virtualItems.length > 0) {
        const existingSkus = new Set(results.map((r) => r.sku));
        const uniqueVirtualItems = virtualItems.filter((item) => {
          const sku = item?.data?.sku;
          return sku && !existingSkus.has(sku);
        });

        if (uniqueVirtualItems.length > 0) {
          const addVirtualMutation = `
            mutation($input: AddVirtualProductsToCartInput!) {
              addVirtualProductsToCart(input: $input) {
                cart {
                  items {
                    id
                    product { name sku }
                    quantity
                    prices { price { value currency } }
                  }
                }
              }
            }
          `;

          const result = await this.graphqlClient.mutate(addVirtualMutation, {
            input: { cart_id: cartId, cart_items: uniqueVirtualItems },
          });

          const userErrors = result.data?.addVirtualProductsToCart?.user_errors || [];
          if (userErrors.length > 0) {
            throw new Error(userErrors[0].message);
          }

          for (const addedItem of result.data?.addVirtualProductsToCart?.cart?.items || []) {
            results.push({
              sku: addedItem.product.sku,
              name: addedItem.product.name,
              price: addedItem.prices?.price?.value || 0,
              quoteItemId: addedItem.id,
            });
          }
        } else {
          this.logger.log('All virtual items already added to cart; skipping virtual items');
        }
      }

      // Send order screenshot for each item with quote_item_id
          for (const result of results) {
            if (result.quoteItemId && canvasScreenshotBase64) {
              try {
                const response = await fetch('/api/storefront/order-screenshot', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    quoteItemId: result.quoteItemId,
                    imageData: canvasScreenshotBase64,
                    filename: `order_${result.quoteItemId}.png`,
                  }),
                });

                if (!response.ok) {
                  const errorText = await response.text().catch(() => '');
                  this.logger.error(`Screenshot upload failed with status ${response.status}:`, errorText);
                }
              } catch (screenshotError) {
                this.logger.error(`Failed to send screenshot for order ${result.quoteItemId}:`, screenshotError);
                // Continue even if screenshot upload fails
              }
            }
          }

      return results;
    } catch (error) {
      this.logger.error('Error adding products to cart:', error);
      return [];
    }
  }

  private async scrollParent(payload: { scrollData?: { type: string; deltaX: number; deltaY: number } }): Promise<void> {
    const { scrollData } = payload;
    const { type, deltaX = 0, deltaY = 0 } = scrollData || {};

    if (type === 'iframe-wheel-scroll' && typeof window !== 'undefined') {
      window.scrollBy(deltaX, deltaY);
    }
  }

  private async pingResponse(): Promise<{ status: string }> {
    return { status: 'alive' };
  }

  /**
   * Export public API for external scripts
   */
  public getPublicAPI() {
    return {
      getProductList: () => this.getProductList(),
      getProducts: (options: { skus: string[] }) => this.getProducts(options),
      addToCart: (options: { cartItems: CartItem[] }) => this.addToCart(options),
    };
  }
}

/**
 * Initialize the bridge
 */
export function initStorefrontBridge(config?: Partial<StorefrontConfig>): StorefrontBridge {
  if (typeof window === 'undefined') {
    console.warn('StorefrontBridge: window is not defined, skipping initialization');
    return new StorefrontBridge(config);
  }

  const bridge = new StorefrontBridge(config);

  // Expose public API to window
  if (!window.configuratorApi) {
    window.configuratorApi = bridge.getPublicAPI();
  }

  return bridge;
}

export default StorefrontBridge;
