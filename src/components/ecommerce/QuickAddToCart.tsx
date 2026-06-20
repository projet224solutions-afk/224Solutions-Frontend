import { Button } from '@/components/ui/button';
import { useTranslation } from "@/hooks/useTranslation";
import { ShoppingCart, Heart } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { rateLimiter } from '@/lib/rateLimiter';

interface QuickAddToCartProps {
  productId: string;
  price: number;
  stock?: number;
  onAddSuccess?: () => void;
}

/**
 * Bouton rapide pour ajouter au panier (style Amazon 1-Click)
 */
export const QuickAddToCart = ({ productId, price, stock = 0, onAddSuccess }: QuickAddToCartProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [inWishlist, setInWishlist] = useState(false);

  const handleAddToCart = async () => {
    if (stock <= 0) {
      toast.error(t('quickAddToCart.produitEnRuptureDeStock'));
      return;
    }

    // Rate limiting
    if (!rateLimiter.check(`quick-cart-${productId}`, { maxRequests: 5, windowMs: 10000 })) {
      toast.error('Trop rapide ! Patientez quelques secondes.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('quickAddToCart.connectezVousPourAjouterAu'));
        return;
      }

      // Utiliser advanced_carts qui existe déjà
      const { data: existingCart } = await supabase
        .from('advanced_carts')
        .select('*')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .maybeSingle();

      if (existingCart) {
        // Incrémenter quantité
        const { error } = await supabase
          .from('advanced_carts')
          .update({ quantity: existingCart.quantity + 1 })
          .eq('id', existingCart.id);

        if (error) throw error;
      } else {
        // Ajouter nouveau
        const { error } = await supabase
          .from('advanced_carts')
          .insert({
            user_id: user.id,
            product_id: productId,
            quantity: 1,
            price_at_add: price,
            vendor_id: '' // TODO: récupérer le vendor_id
          });

        if (error) throw error;
      }

      toast.success(t('quickAddToCart.ajouteAuPanier'));
      onAddSuccess?.();
    } catch (error: any) {
      console.error('Error adding to cart:', error);
      toast.error('Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWishlist = async () => {
    if (!rateLimiter.check(`quick-wishlist-${productId}`, { maxRequests: 5, windowMs: 10000 })) {
      toast.error('Trop rapide !');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('quickAddToCart.connectezVousPourAjouterA'));
        return;
      }

      const { error } = await supabase
        .from('wishlists')
        .insert({
          user_id: user.id,
          product_id: productId,
          priority: 3
        });

      if (error) {
        if (error.code === '23505') {
          toast.info(t('quickAddToCart.dejaDansVotreWishlist'));
        } else {
          throw error;
        }
      } else {
        toast.success(t('quickAddToCart.ajouteALaWishlist'));
        setInWishlist(true);
      }
    } catch (error: any) {
      console.error('Error adding to wishlist:', error);
      toast.error('Erreur: ' + error.message);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleAddToCart}
        disabled={loading || stock <= 0}
        className="flex-1"
      >
        <ShoppingCart className="w-4 h-4 mr-2" />
        {stock <= 0 ? 'Rupture de stock' : 'Ajouter au panier'}
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={handleAddToWishlist}
        disabled={inWishlist}
      >
        <Heart className={inWishlist ? 'w-4 h-4 fill-current' : 'w-4 h-4'} />
      </Button>
    </div>
  );
};
