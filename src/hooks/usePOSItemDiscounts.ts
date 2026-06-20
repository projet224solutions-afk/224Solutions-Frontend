/**
 * Hook pour gérer les remises par article dans le POS
 * Calcule automatiquement les profits et détecte les pertes
 */

import { useState, useCallback } from 'react';
import { CartItemDiscount, CartItemWithDiscountData, calculateCartItemWithDiscount } from '@/components/vendor/pos/CartItemWithDiscount';

export interface CartItemWithDiscounts {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  saleType?: 'unit' | 'carton';
  discount: CartItemDiscount;
}

interface UsePOSItemDiscountsReturn {
  itemDiscounts: Map<string, CartItemDiscount>;
  setItemDiscount: (itemId: string, discount: CartItemDiscount) => void;
  removeItemDiscount: (itemId: string) => void;
  clearAllDiscounts: () => void;
  calculateItemData: (
    itemId: string,
    name: string,
    quantity: number,
    unitPrice: number,
    costPrice: number
  ) => CartItemWithDiscountData;
  hasAnyDiscounts: boolean;
  totalDiscountAmount: (items: Array<{id: string; quantity: number; unitPrice: number; costPrice: number}>) => number;
  getDiscountForItem: (itemId: string) => CartItemDiscount;
}

export function usePOSItemDiscounts(): UsePOSItemDiscountsReturn {
  const [itemDiscounts, setItemDiscounts] = useState<Map<string, CartItemDiscount>>(new Map());

  const getDefaultDiscount = (): CartItemDiscount => ({
    type: null,
    value: 0,
    amount: 0,
  });

  const setItemDiscount = useCallback((itemId: string, discount: CartItemDiscount) => {
    setItemDiscounts(prev => {
      const newMap = new Map(prev);
      newMap.set(itemId, discount);
      return newMap;
    });
  }, []);

  const removeItemDiscount = useCallback((itemId: string) => {
    setItemDiscounts(prev => {
      const newMap = new Map(prev);
      newMap.delete(itemId);
      return newMap;
    });
  }, []);

  const clearAllDiscounts = useCallback(() => {
    setItemDiscounts(new Map());
  }, []);

  const getDiscountForItem = useCallback((itemId: string): CartItemDiscount => {
    return itemDiscounts.get(itemId) || getDefaultDiscount();
  }, [itemDiscounts]);

  const calculateItemData = useCallback((
    itemId: string,
    name: string,
    quantity: number,
    unitPrice: number,
    costPrice: number
  ): CartItemWithDiscountData => {
    const discount = getDiscountForItem(itemId);
    return calculateCartItemWithDiscount(itemId, name, quantity, unitPrice, costPrice, discount);
  }, [getDiscountForItem]);

  const hasAnyDiscounts = itemDiscounts.size > 0 &&
    Array.from(itemDiscounts.values()).some(d => d.type !== null && d.value > 0);

  const totalDiscountAmount = useCallback((
    items: Array<{id: string; quantity: number; unitPrice: number; costPrice: number}>
  ): number => {
    return items.reduce((total, item) => {
      const discount = getDiscountForItem(item.id);
      if (!discount.type || discount.value === 0) return total;

      let discountPerUnit = 0;
      if (discount.type === 'percent') {
        discountPerUnit = (item.unitPrice * discount.value) / 100;
      } else {
        discountPerUnit = discount.value;
      }
      return total + (discountPerUnit * item.quantity);
    }, 0);
  }, [getDiscountForItem]);

  return {
    itemDiscounts,
    setItemDiscount,
    removeItemDiscount,
    clearAllDiscounts,
    calculateItemData,
    hasAnyDiscounts,
    totalDiscountAmount,
    getDiscountForItem,
  };
}
