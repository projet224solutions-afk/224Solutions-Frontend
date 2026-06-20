import { useTranslation } from "@/hooks/useTranslation";
import React, { createContext, useContext, useRef, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { useListPersistence } from '@/hooks/useAppPersistence';
import { trackCartAdd } from '@/hooks/useProductRecommendations';
import { usePriceConverter } from '@/hooks/usePriceConverter';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  vendor_id: string;
  vendor_name?: string;
  // Devise source du produit (pour conversion)
  currency?: string;
  // Champs pour produits numériques/affiliés
  item_type?: 'product' | 'digital_product' | 'professional_service';
  product_mode?: 'direct' | 'affiliate';
  affiliate_url?: string;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  // Ref pour éviter les toasts multiples
  const hasShownRestoreToast = useRef(false);

  // Callback mémorisé pour onRestore - évite les re-renders
  const handleRestore = useCallback((items: CartItem[]) => {
    if (items.length > 0 && !hasShownRestoreToast.current) {
      hasShownRestoreToast.current = true;
      toast.success(`🛒 Panier restauré (${items.length} article${items.length > 1 ? 's' : ''})`, {
        duration: 3000
      });
    }
  }, []);

  // Utiliser le hook de persistence universel avec sauvegarde automatique
  const {
    items: cartItems,
    addItem,
    removeItem,
    updateItem,
    clearList,
  } = useListPersistence<CartItem>('marketplace_cart', {
    enabled: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 heures pour le panier
    onRestore: handleRestore,
  });

  // Convertit chaque item depuis SA devise (vendeur) vers la devise d'affichage de l'utilisateur.
  const { convert } = usePriceConverter();

  const addToCart = useCallback((item: Omit<CartItem, 'quantity'>) => {
    if (item.item_type === 'digital_product') {
      toast.info(t('cartContext.lesProduitsNumeriquesNePassent'));
      return;
    }

    const existingItem = cartItems.find(i => i.id === item.id);

    // 🧠 Track pour recommandations
    trackCartAdd(item.id);

    if (existingItem) {
      updateItem(item.id, { quantity: existingItem.quantity + 1 });
      toast.success(t('cartContext.quantiteAugmenteeDansLePanier'));
    } else {
      addItem({ ...item, quantity: 1 });
      toast.success(t('cartContext.produitAjouteAuPanier'));
    }
  }, [cartItems, updateItem, addItem]);

  const removeFromCart = useCallback((itemId: string) => {
    removeItem(itemId);
    toast.info(t('cartContext.produitRetireDuPanier'));
  }, [removeItem]);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      toast.info(t('cartContext.produitRetireDuPanier'));
      return;
    }
    updateItem(itemId, { quantity });
  }, [updateItem, removeItem]);

  const clearCart = useCallback(() => {
    clearList();
    toast.info(t('cartContext.panierVide'));
  }, [clearList]);

  // Total CONVERTI : chaque item est converti depuis SA devise (vendeur) vers la devise d'affichage
  // avant la somme. Avant : somme des prix bruts → faux pour un panier multi-vendeur multi-devise.
  const getCartTotal = useCallback(() => {
    return cartItems.reduce(
      (total, item) => total + convert(item.price, item.currency || 'GNF').convertedAmount * item.quantity,
      0,
    );
  }, [cartItems, convert]);

  const getCartCount = useCallback(() => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  }, [cartItems]);

  // Mémoiser la valeur du contexte pour éviter les re-renders inutiles
  const contextValue = useMemo(() => ({
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartCount,
  }), [cartItems, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal, getCartCount]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
