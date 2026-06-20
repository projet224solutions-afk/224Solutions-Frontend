/**
 * POSOrderItemsBuilder - Construit les order_items avec toutes les données de remise et profit
 * Compatible avec les nouvelles colonnes de la migration
 */

import { CartItemDiscount } from '@/components/vendor/pos/POSCartSection';

export interface POSCartItemForOrder {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  costPrice: number;
  saleType?: 'unit' | 'carton';
  discount: CartItemDiscount;
}

export interface OrderItemWithDiscountData {
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  // Nouvelles colonnes de remise et profit
  cost_price: number;
  discount_type: string | null;
  discount_value: number | null;
  discount_amount: number | null;
  original_unit_price: number;
  final_unit_price: number;
  profit_before_discount: number;
  profit_after_discount: number;
  loss_amount: number;
}

/**
 * Construit les données order_items avec calculs de remise et profit
 */
export function buildOrderItems(
  orderId: string,
  cartItems: POSCartItemForOrder[]
): OrderItemWithDiscountData[] {
  return cartItems.map(item => {
    const originalUnitPrice = item.price;
    const costPrice = item.costPrice || 0;
    const quantity = item.quantity;

    // Calcul de la remise par unité
    let discountPerUnit = 0;
    if (item.discount.type === 'percent') {
      discountPerUnit = (originalUnitPrice * item.discount.value) / 100;
    } else if (item.discount.type === 'amount') {
      discountPerUnit = item.discount.value;
    }

    const finalUnitPrice = originalUnitPrice - discountPerUnit;
    const totalDiscountAmount = discountPerUnit * quantity;

    // Calcul des profits
    const profitPerUnitBeforeDiscount = originalUnitPrice - costPrice;
    const profitBeforeDiscount = profitPerUnitBeforeDiscount * quantity;

    const profitPerUnitAfterDiscount = finalUnitPrice - costPrice;
    const profitAfterDiscount = profitPerUnitAfterDiscount * quantity;

    // Perte si prix final < coût
    const isLoss = finalUnitPrice < costPrice;
    const lossAmount = isLoss ? Math.abs(profitAfterDiscount) : 0;

    return {
      order_id: orderId,
      product_id: item.id,
      quantity: quantity,
      unit_price: finalUnitPrice, // Prix final après remise
      total_price: finalUnitPrice * quantity,
      // Données complètes
      cost_price: costPrice,
      discount_type: item.discount.type,
      discount_value: item.discount.value || null,
      discount_amount: totalDiscountAmount > 0 ? totalDiscountAmount : null,
      original_unit_price: originalUnitPrice,
      final_unit_price: finalUnitPrice,
      profit_before_discount: profitBeforeDiscount,
      profit_after_discount: profitAfterDiscount,
      loss_amount: lossAmount,
    };
  });
}

/**
 * Calcule les totaux de profit/perte pour un ensemble d'articles
 */
export function calculateOrderProfitSummary(cartItems: POSCartItemForOrder[]) {
  let totalProfitBeforeDiscount = 0;
  let totalProfitAfterDiscount = 0;
  let totalLossAmount = 0;
  let totalDiscountAmount = 0;
  let hasLossItems = false;

  cartItems.forEach(item => {
    const originalUnitPrice = item.price;
    const costPrice = item.costPrice || 0;
    const quantity = item.quantity;

    let discountPerUnit = 0;
    if (item.discount.type === 'percent') {
      discountPerUnit = (originalUnitPrice * item.discount.value) / 100;
    } else if (item.discount.type === 'amount') {
      discountPerUnit = item.discount.value;
    }

    const finalUnitPrice = originalUnitPrice - discountPerUnit;
    totalDiscountAmount += discountPerUnit * quantity;

    const profitBefore = (originalUnitPrice - costPrice) * quantity;
    const profitAfter = (finalUnitPrice - costPrice) * quantity;

    totalProfitBeforeDiscount += profitBefore;
    totalProfitAfterDiscount += profitAfter;

    if (finalUnitPrice < costPrice) {
      hasLossItems = true;
      totalLossAmount += Math.abs(profitAfter);
    }
  });

  return {
    totalProfitBeforeDiscount,
    totalProfitAfterDiscount,
    totalLossAmount,
    totalDiscountAmount,
    hasLossItems,
    netProfit: totalProfitAfterDiscount - totalLossAmount,
  };
}
