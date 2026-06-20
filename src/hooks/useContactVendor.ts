/**
 * useContactVendor — Logique unifiée de contact d'un vendeur depuis le marketplace.
 *
 * Résout l'identifiant utilisateur du vendeur (via vendor_user_id si présent,
 * sinon via vendor_id), envoie un message initial best-effort, puis ouvre la
 * conversation. Utilisé par la grille marketplace ET les carrousels de
 * recommandations pour un comportement identique.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ContactVendorArgs {
  /** Identifiant utilisateur du vendeur (si déjà connu). */
  vendorUserId?: string | null;
  /** Identifiant du vendeur (table vendors) — repli pour résoudre user_id. */
  vendorId?: string | null;
  /** Identifiant du produit — dernier repli (toujours disponible) pour résoudre le vendeur. */
  productId?: string | null;
  /** Nom du produit, pour personnaliser le message initial. */
  productName?: string;
  /** Notifie l'état de chargement (pour afficher un spinner sur le bouton). */
  onLoadingChange?: (loading: boolean) => void;
}

export function useContactVendor() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return useCallback(
    async ({ vendorUserId, vendorId, productId, productName, onLoadingChange }: ContactVendorArgs) => {
      if (!user) {
        toast.error('Veuillez vous connecter pour contacter le vendeur');
        navigate('/auth');
        return;
      }

      onLoadingChange?.(true);
      try {
        // Résoudre l'identifiant utilisateur du vendeur (repli via vendor_id,
        // utile quand la jointure vendors est masquée par RLS côté liste).
        let recipientId = vendorUserId || undefined;

        // Repli 1 : via l'identifiant vendeur (table vendors)
        if (!recipientId && vendorId) {
          const { data } = await supabase
            .from('vendors')
            .select('user_id')
            .eq('id', vendorId)
            .maybeSingle();
          recipientId = data?.user_id || undefined;
        }

        // Repli 2 : via l'identifiant produit (toujours disponible côté reco/grille)
        // produits → vendeur → user_id. Couvre les produits de recommandation IA
        // qui n'exposent ni vendor_user_id ni vendor_id.
        if (!recipientId && productId) {
          const { data } = await supabase
            .from('products')
            .select('vendor_id, vendors(user_id)')
            .eq('id', productId)
            .maybeSingle();
          recipientId = (data?.vendors as { user_id?: string } | null)?.user_id || undefined;
        }

        if (!recipientId) {
          toast.error('Informations du vendeur non disponibles');
          return;
        }
        if (recipientId === user.id) {
          toast.info('Vous ne pouvez pas vous contacter vous-même');
          return;
        }

        // Message initial best-effort (ne bloque jamais l'ouverture de la conversation)
        const initialMessage = `Bonjour, je suis intéressé par "${productName || 'votre produit'}". Pouvez-vous me donner plus d'informations ?`;
        const { error } = await supabase.from('messages').insert({
          sender_id: user.id,
          recipient_id: recipientId,
          content: initialMessage,
          type: 'text',
        });

        if (error) {
          console.warn('[ContactVendor] Message initial non envoyé:', error.message || error);
        } else {
          toast.success('Message envoyé au vendeur !');
        }

        navigate(`/messages?recipientId=${recipientId}`);
      } catch (e) {
        console.warn('[ContactVendor] Erreur:', e);
        toast.error('Impossible de contacter le vendeur');
      } finally {
        onLoadingChange?.(false);
      }
    },
    [user, navigate]
  );
}
