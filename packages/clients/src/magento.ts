import type { StorefrontCartItem } from '@curtain-wizard/core/src/catalog';
import { buildMagentoCartItems } from './magentoCartItems';

type MagentoGraphqlClientOptions = {
  endpoint: string;
  accessToken?: string;
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

export class MagentoGraphqlClient {
  private readonly endpoint: string;
  private readonly accessToken?: string;

  constructor(options: MagentoGraphqlClientOptions) {
    this.endpoint = options.endpoint;
    this.accessToken = options.accessToken;
  }

  async request<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      throw new Error(`Magento GraphQL request failed with status ${res.status}`);
    }

    const json = (await res.json()) as GraphQLResponse<T>;
    if (json.errors && json.errors.length) {
      throw new Error(json.errors.map((e) => e.message ?? 'Unknown Magento GraphQL error').join('\n'));
    }
    if (!json.data) {
      throw new Error('Magento GraphQL response missing data');
    }
    return json.data;
  }
}

export function buildAddToCartMutation(cartItem: StorefrontCartItem, cartId: string, totalPriceMinor?: number) {
  const cartItems = buildMagentoCartItems(cartItem, totalPriceMinor);

  const mutation = /* GraphQL */ `
    mutation AddCurtainWizardItems($cartId: String!, $cartItems: [CartItemInput!]!) {
      addProductsToCart(cartId: $cartId, cartItems: $cartItems) {
        cart {
          id
          items {
            uid
            product { sku name }
            quantity
          }
        }
      }
    }
  `;

  const variables = {
    cartId,
    cartItems,
  };

  return { mutation, variables };
}
