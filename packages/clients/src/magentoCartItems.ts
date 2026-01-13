import type { StorefrontCartItem } from '@curtain-wizard/core/src/catalog';

export type MagentoCartItemInput = {
  parent_sku: string;
  qty: number;
  child_sku?: string;
  entered_options?: Array<{ uid: string; value: string }>;
  custom_price?: number;
};

export function buildMagentoCartItems(cartItem: StorefrontCartItem, totalPriceMinor?: number): MagentoCartItemInput[] {
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

  const serviceItems = (cartItem.services ?? []).map((svc) => ({
    parent_sku: svc.sku,
    qty: svc.quantity,
  }));

  return [primaryItem, ...serviceItems];
}
