/**
 * HOOK DONNÉES CLIENT - DONNÉES RÉELLES
 * Gestion des données réelles pour le dashboard client
 * 224Solutions - Interface Client Opérationnelle
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Order {
  id: string;
  productName: string;
  status: string;
  total: number;
  date: string;
  seller: string;
}

export function useClientData() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Charger les favoris depuis la table wishlists
  const loadFavorites = useCallback(async (userId: string) => {
    try {
      const { data, error: wishlistError } = await supabase
        .from('wishlists')
        .select('product_id')
        .eq('user_id', userId);

      if (wishlistError) {
        console.error('❌ Erreur chargement favoris:', wishlistError);
        return;
      }

      setFavorites((data || []).map(w => w.product_id));
    } catch (err) {
      console.error('❌ Erreur chargement favoris:', err);
    }
  }, []);

  // Charger les commandes de l'utilisateur
  const loadOrders = useCallback(async (userId: string) => {
    try {
      // Récupérer d'abord le customer_id à partir du user_id
      const { data: customerData } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!customerData) {
        console.log('ℹ️ Aucun profil client trouvé');
        return;
      }

      // Charger uniquement les commandes en ligne (source='online')
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at, vendor_id, order_number, source')
        .eq('customer_id', customerData.id)
        .eq('source', 'online')
        .order('created_at', { ascending: false })
        .limit(20);

      if (ordersError) {
        console.error('❌ Erreur chargement commandes:', ordersError);
        throw ordersError;
      }

      // Récupérer les détails des commandes
      const formattedOrders: Order[] = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { data: items } = await supabase
            .from('order_items')
            .select('product_id, products(name)')
            .eq('order_id', order.id)
            .limit(1)
            .maybeSingle();

          let vendorName = 'Vendeur';
          if (order.vendor_id) {
            const { data: vendor } = await supabase
              .from('vendors')
              .select('business_name')
              .eq('id', order.vendor_id)
              .maybeSingle();
            vendorName = vendor?.business_name || 'Vendeur';
          }

          return {
            id: order.id,
            productName: (items?.products as any)?.name || 'Commande',
            status: order.status,
            total: order.total_amount,
            date: new Date(order.created_at).toLocaleDateString('fr-FR'),
            seller: vendorName
          };
        })
      );

      setOrders(formattedOrders);
    } catch (err) {
      console.error('❌ Erreur chargement commandes:', err);
      setError('Erreur lors du chargement des commandes');
    }
  }, []);

  // Toggle favori avec persistance dans wishlists
  const toggleFavorite = useCallback(async (productId: string, userId?: string) => {
    if (!userId) {
      toast.error('Connectez-vous pour gérer vos favoris');
      return;
    }

    const isFavorite = favorites.includes(productId);

    // Optimistic update
    setFavorites(prev =>
      isFavorite ? prev.filter(id => id !== productId) : [...prev, productId]
    );

    try {
      if (isFavorite) {
        const { error: deleteError } = await supabase
          .from('wishlists')
          .delete()
          .eq('user_id', userId)
          .eq('product_id', productId);

        if (deleteError) throw deleteError;
        toast.success('Retiré des favoris');
      } else {
        const { error: insertError } = await supabase
          .from('wishlists')
          .insert({ user_id: userId, product_id: productId, priority: 3 });

        if (insertError) {
          if (insertError.code === '23505') {
            toast.info('Déjà dans vos favoris');
          } else {
            throw insertError;
          }
        } else {
          toast.success('Ajouté aux favoris');
        }
      }
    } catch (err) {
      // Rollback on error
      setFavorites(prev =>
        isFavorite ? [...prev, productId] : prev.filter(id => id !== productId)
      );
      console.error('❌ Erreur toggle favori:', err);
      toast.error('Erreur lors de la mise à jour des favoris');
    }
  }, [favorites]);

  // Contacter un vendeur via edge function
  const contactVendor = useCallback(async (vendorUserId: string, vendorName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Veuillez vous connecter pour contacter le vendeur');
        return null;
      }

      const { data, error: fnError } = await supabase.functions.invoke('create-conversation', {
        body: {
          participants: [session.user.id, vendorUserId],
          type: 'private',
          name: `Discussion avec ${vendorName}`
        }
      });

      if (fnError) {
        console.error('❌ Erreur création conversation:', fnError);
        throw fnError;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erreur lors de la création de la conversation');
      }

      toast.success(data.existing ? 'Conversation trouvée' : 'Conversation créée');
      return data.conversation.id;
    } catch (err) {
      console.error('❌ Erreur création conversation:', err);
      toast.error('Erreur lors de la création de la conversation');
      return null;
    }
  }, []);

  // Charger toutes les données
  const loadAllData = useCallback(async (userId?: string) => {
    try {
      setLoading(true);
      setError(null);

      if (userId) {
        await Promise.all([
          loadOrders(userId),
          loadFavorites(userId)
        ]);
      }

      console.log('✅ Données client chargées avec succès');
    } catch (err) {
      console.error('❌ Erreur chargement données client:', err);
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [loadOrders, loadFavorites]);

  return {
    orders,
    favorites,
    loading,
    error,
    toggleFavorite,
    contactVendor,
    loadAllData,
    refetch: loadAllData
  };
}
