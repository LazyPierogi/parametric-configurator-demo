/**
 * Magento GraphQL Client
 *
 * Direct client for querying Magento GraphQL API.
 * Replaces parent bridge communication with direct API calls.
 *
 * @module magento-client
 */

// Types
export type MagentoCartItemInput = {
  parent_sku: string;
  qty: number;
  child_sku?: string;
  entered_options?: Array<{ uid: string; value: string }>;
  custom_price?: number;
};

export type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export type MagentoProduct = {
  sku: string;
  name: string;
  price: number;
  priceMinor: number;
  attributes: {
    colors?: string[];
    fabricId?: string;
    style?: string;
    typeId?: string;
    materialFamily?: string;
    pattern?: string;
    short_description?: string;
    childItems?: MagentoChildItem[];
    textureDefaultTileWidthPx?: number;
    textureDefaultOpacityPct?: number;
    fabricWidthCm?: number;
    isDoubleWidth?: boolean;
    isRailroadable?: boolean;
    widthsPerPanel?: number;
    verticalRepeatCm?: number;
    repeatType?: string;
    minOrderIncrementCm?: number;
    allowanceCmTop?: number;
    allowanceCmBottom?: number;
    shrinkagePct?: number;
    fullnessByPleatWave?: number;
    fullnessByPleatTape?: number;
    compatiblePleats?: string[];
    availableHems?: string[];
    pleatSurchargePerSegmentMinor?: number;
    hemSurchargeMinor?: number;
    price_flex?: string;
    price_double_flex?: string;
    price_wave?: string;
  };
};

export type MagentoChildItem = {
  sku: string;
  name: string;
  color?: string;
  colorLabel?: string;
  colorCategory?: string;
  price: number;
  thumbnail?: string;
  pricePerMLinearMinor: number;
  pleatSurchargePerSegmentMinor?: number;
  hemSurchargeMinor?: number;
};

export type CartItemsResponse = {
  sku: string;
  name: string;
  price: number;
  quoteItemId?: number;
};

/**
 * Build Magento cart items from a StorefrontCartItem
 * Converts the internal cart item format to the Magento GraphQL format
 */
export function buildMagentoCartItems(cartItem: any, totalPriceMinor?: number): MagentoCartItemInput[] {
  const primaryItem: MagentoCartItemInput = {
    parent_sku: cartItem.sku,
    qty: cartItem.quantity,
  };

  if (cartItem.childSku) {
    primaryItem.child_sku = cartItem.childSku;
  }

  if (cartItem.options && Object.keys(cartItem.options).length > 0) {
    primaryItem.entered_options = [
      {
        uid: 'curtain_configuration',
        value: JSON.stringify(cartItem.options),
      },
    ];
  }

  // Add custom price if provided (convert from minor units to major units, then divide by quantity)
  // Magento multiplies custom_price by qty, so we need: custom_price * qty = totalPrice
  // Therefore: custom_price = totalPrice / qty
  if (totalPriceMinor != null && cartItem.quantity > 0) {
    primaryItem.custom_price = totalPriceMinor / 100 / cartItem.quantity;
  }

  const serviceItems = (cartItem.services ?? []).map((svc: any) => ({
    parent_sku: svc.sku,
    qty: svc.quantity,
  }));

  return [primaryItem, ...serviceItems];
}

class MagentoClient {
  private apiUrl: string;
  private authToken: string | null = null;

  constructor(apiUrl?: string) {
    const DEFAULT_MAGENTO_GRAPHQL_URL =
      process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT ||
      process.env.NEXT_PUBLIC_MAGENTO_GRAPHQL_URL ||
      '';
    this.apiUrl = apiUrl || DEFAULT_MAGENTO_GRAPHQL_URL;

    // Try to load auth token from storage if in browser
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      this.authToken = localStorage.getItem('magento_auth_token');
    }
  }

  /**
   * Execute a GraphQL query
   */
  async query<T = unknown>(queryStr: string, variables: Record<string, unknown> = {}): Promise<GraphQLResponse<T>> {
    try {
      if (!this.apiUrl) {
        throw new Error(
          'Magento GraphQL endpoint is not configured. Set NEXT_PUBLIC_GRAPHQL_ENDPOINT (or NEXT_PUBLIC_MAGENTO_GRAPHQL_URL), or use CATALOG_PROVIDER=mock.',
        );
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      // Execute GraphQL query

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: queryStr,
          variables,
        }),
      });

      const result: GraphQLResponse<T> = await response.json();

      // Handle HTTP-level errors
      if (!response.ok) {
        const message = result?.errors?.[0]?.message || response.statusText;
        throw new Error(`HTTP ${response.status}: ${message}`);
      }

      // Handle GraphQL errors in the response body
      if (result.errors && result.errors.length > 0) {
        const message = result.errors.map((e) => e.message).join('; ');
        throw new Error(message);
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute a GraphQL mutation
   */
  async mutate<T = unknown>(
    mutationStr: string,
    variables: Record<string, unknown> = {}
  ): Promise<GraphQLResponse<T>> {
    return this.query<T>(mutationStr, variables);
  }

  /**
   * Fetch product list from Magento
   */
  async getProductList(): Promise<MagentoProduct[]> {
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
            short_description {
              html
            }
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
            price_flex
            price_double_flex
            price_wave
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
      const result = await this.query<{ customProducts: { items: unknown[] } }>(queryStr);

      const products = result.data?.customProducts?.items.map((item: any) => ({
        sku: item.sku,
        name: item.name,
        price: item.price_range?.minimum_price?.regular_price?.value || 0,
        priceMinor: item.price_range?.minimum_price?.regular_price?.value || 0,
        attributes: {
          colors: item.variants?.map((variant: any) => variant.product.color_hex),
          fabricId: item.fabric_id,
          price_wave: item.price_wave,
          price_flex: item.price_flex,
          price_double_flex: item.price_double_flex,
          style: item.fabric_style_id_label,
          typeId: item.fabric_type_id_label,
          materialFamily: item.fabric_material_id_label,
          pattern: item.pattern,
          short_description: item.short_description?.html,
          childItems: item.variants?.map(({ product }: any) => ({
            sku: product.sku,
            name: product.name,
            color: product.color_hex,
            colorLabel: product.color_label,
            colorCategory: product.color_categories?.map((cat: any) => cat.name).join(', ') || '',
            price: product.price_range?.minimum_price?.regular_price?.value || 0,
            thumbnail: product.thumbnail?.url,
            pricePerMLinearMinor: product.price_range?.minimum_price?.regular_price?.value || 0,
            pleatSurchargePerSegmentMinor: 0,
            hemSurchargeMinor: 0,
          })),
          textureDefaultTileWidthPx: item.texture_default_tile_width_px,
          textureDefaultOpacityPct: item.texture_default_opacity_pct,
          fabricWidthCm: item.fabric_width_cm,
          isDoubleWidth: item.is_double_width,
          isRailroadable: item.is_railroadable,
          widthsPerPanel: item.widths_per_panel,
          verticalRepeatCm: item.vertical_repeat_cm,
          repeatType: item.repeat_type,
          minOrderIncrementCm: item.min_order_increment_cm,
          allowanceCmTop: item.allowance_cm_top,
          allowanceCmBottom: item.allowance_cm_bottom,
          shrinkagePct: item.shrinkage_pct,
          fullnessByPleatWave: item.fullness_by_pleat_wave,
          fullnessByPleatTape: item.fullness_by_pleat_tape,
          compatiblePleats: item.compatible_pleats,
          availableHems: item.available_hems,
          pleatSurchargePerSegmentMinor: item.pleat_surcharge_per_segment_minor,
          hemSurchargeMinor: item.hem_surcharge_minor,
        },
      })) || [];

      // product list fetched

      return products;
    } catch (error) {
      console.error('[MagentoClient] Error fetching product list:', error);
      throw error;
    }
  }

  /**
   * Fetch products by SKUs
   */
  async getProducts(skus: string[]): Promise<MagentoProduct[]> {
    if (!skus || skus.length === 0) {
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
      const result = await this.query<{ products: { items: unknown[] } }>(queryStr, { skus });

      const products = result.data?.products?.items.map((item: any) => ({
        sku: item.sku,
        name: item.name,
        price: item.price_range?.minimum_price?.final_price?.value || 0,
        priceMinor: item.price_range?.minimum_price?.final_price?.value || 0,
        attributes: {},
      })) || [];

      // products by SKUs fetched

      return products;
    } catch (error) {
      console.error('[MagentoClient] Error fetching products by SKU:', error);
      throw error;
    }
  }

  /**
   * Add items to cart
   */
  async addToCart(cartItems: MagentoCartItemInput[]): Promise<CartItemsResponse[]> {
    if (!cartItems || cartItems.length === 0) {
      return [];
    }

    try {
      // Capture screenshot from pre-rendered canvas
      let canvasScreenshotBase64: string | null = null;
      
      if (typeof window !== 'undefined' && (window as any).__curtainScreenshotCanvas) {
        try {
          console.log('[MagentoClient] Using pre-rendered screenshot canvas');
          const dataUrl = await (window as any).__curtainScreenshotCanvas.getScreenshot();
          canvasScreenshotBase64 = dataUrl.split(',')[1];
          console.log('[MagentoClient] Screenshot captured from pre-rendered canvas');
        } catch (screenshotError) {
          console.error('[MagentoClient] Failed to get screenshot from canvas:', screenshotError);
          canvasScreenshotBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        }
      } else {
        console.warn('[MagentoClient] Screenshot canvas not available');
        canvasScreenshotBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      }
      
      // Fallback to empty GIF if we couldn't capture anything
      if (!canvasScreenshotBase64) {
        canvasScreenshotBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      }

      const results: CartItemsResponse[] = [];

      // Get or create cart ID
      // let cartId = typeof localStorage !== 'undefined' ? localStorage.getItem('magento_cart_id') : null;
      let cartId = null; // always create new one

      if (!cartId) {
        const createCartMutation = `
          mutation {
            createEmptyCart
          }
        `;
        const createCartResult = await this.mutate<{ createEmptyCart: string }>(createCartMutation);
        cartId = createCartResult.data?.createEmptyCart ?? null;

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
          const virtualItem: any = {
            data: {
              sku: item.parent_sku,
              quantity: item.qty,
            },
          };
          if (item.custom_price != null) {
            virtualItem.data.custom_price = item.custom_price;
          }
          virtualItems.push(virtualItem);
        } else {
          const configurableItem: any = {
            parent_sku: item.parent_sku,
            variant_sku: item.child_sku,
            data: {
              sku: item.child_sku,
              parent_sku: item.parent_sku,
              quantity: item.qty,
            },
          };
          if (item.custom_price != null) {
            configurableItem.data.custom_price = item.custom_price;
          }
          if (item.entered_options) {
            configurableItem.data.entered_options = item.entered_options;
          }
          configurableItems.push(configurableItem);
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
        // Note: custom_price is part of ConfigurableProductCartItemInput schema

        const result = await this.mutate<{ addConfigurableProductsToCart: { cart: { items: any[] } } }>(
          addConfigurableMutation,
          { input: { cart_id: cartId, cart_items: configurableItems } }
        );

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
        // Ensure we only add each service (virtual product) once per order
        const existingSkus = new Set(results.map((r) => r.sku));
        const uniqueVirtualItems = virtualItems.filter((item: any) => {
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
          // Note: custom_price is part of VirtualProductCartItemInput schema

          const result = await this.mutate<{ addVirtualProductsToCart: { cart: { items: any[] }; user_errors: any[] } }>(
            addVirtualMutation,
            { input: { cart_id: cartId, cart_items: uniqueVirtualItems } }
          );

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
              console.error(`[MagentoClient] Screenshot upload failed with status ${response.status}:`, errorText);
            }
          } catch (screenshotError) {
            console.error(`[MagentoClient] Failed to send screenshot for order ${result.quoteItemId}:`, screenshotError);
            // Continue even if screenshot upload fails
          }
        }
      }

      // items added to cart

      return results;
    } catch (error) {
      console.error('[MagentoClient] Error adding products to cart:', error);
      throw error;
    }
  }

  /**
   * Set auth token (e.g., after user login)
   */
  setAuthToken(token: string): void {
    this.authToken = token;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('magento_auth_token', token);
    }
  }

  /**
   * Clear auth token and cart
   */
  clearSession(): void {
    this.authToken = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('magento_auth_token');
      localStorage.removeItem('magento_cart_id');
    }
  }
}

// Export singleton instance
export const magentoClient = new MagentoClient();

export default MagentoClient;
