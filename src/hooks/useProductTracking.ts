import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { rateLimiter } from '@/lib/rateLimiter';

/**
 * Hook pour tracker automatiquement les vues de produits (comme Amazon)
 * Enregistre dans product_views pour générer des recommandations
 */
export const useProductTracking = (productId: string | undefined) => {
  useEffect(() => {
    if (!productId) return;

    const trackView = async () => {
      // Rate limiting pour éviter les abus
      if (!rateLimiter.check(`track-view-${productId}`, { maxRequests: 1, windowMs: 60000 })) {
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Enregistrer la vue
        await supabase
          .from('product_views')
          .insert({
            user_id: user.id,
            product_id: productId,
            session_id: sessionStorage.getItem('session_id') || crypto.randomUUID(),
            metadata: {
              referrer: document.referrer,
              timestamp: new Date().toISOString()
            }
          });

        console.log('📊 Product view tracked:', productId);
      } catch (error) {
        console.error('Error tracking product view:', error);
      }
    };

    // Tracker après 3 secondes pour éviter les bounces
    const timer = setTimeout(trackView, 3000);

    return () => clearTimeout(timer);
  }, [productId]);
};
