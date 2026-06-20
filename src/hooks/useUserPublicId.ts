/**
 * 🔑 HOOK UNIFIÉ POUR L'IDENTIFIANT PUBLIC UTILISATEUR
 *
 * Ce hook garantit l'utilisation de profiles.public_id comme source unique
 * pour tous les identifiants utilisateur affichés dans l'application.
 *
 * Remplace l'utilisation incohérente de:
 * - user_ids.custom_id
 * - vendors.vendor_code
 * - taxi_drivers.driver_code
 * etc.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PublicIdResult {
  publicId: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook pour obtenir le public_id d'un utilisateur
 * Source de vérité: profiles.public_id
 */
export function useUserPublicId(userId: string | null | undefined): PublicIdResult {
  const [publicId, setPublicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setPublicId(null);
      setLoading(false);
      return;
    }

    const fetchPublicId = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('public_id')
          .eq('id', userId)
          .single();

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        setPublicId(data?.public_id || null);
      } catch (err) {
        console.error('Erreur récupération public_id:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
        setPublicId(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicId();
  }, [userId]);

  return { publicId, loading, error };
}

/**
 * Hook pour obtenir plusieurs public_ids en batch
 * Optimisé pour les listes d'utilisateurs
 */
export function useUserPublicIds(userIds: string[]): {
  publicIds: Record<string, string>;
  loading: boolean;
  error: string | null;
} {
  const [publicIds, setPublicIds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userIds.length) {
      setPublicIds({});
      setLoading(false);
      return;
    }

    const fetchPublicIds = async () => {
      try {
        setLoading(true);
        setError(null);

        // Filtrer les IDs uniques
        const uniqueIds = [...new Set(userIds.filter(Boolean))];

        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('id, public_id')
          .in('id', uniqueIds);

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        const idsMap: Record<string, string> = {};
        (data || []).forEach(profile => {
          if (profile.public_id) {
            idsMap[profile.id] = profile.public_id;
          }
        });

        setPublicIds(idsMap);
      } catch (err) {
        console.error('Erreur récupération public_ids:', err);
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    fetchPublicIds();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIds.join(',')]); // Recalculer uniquement si la liste change

  return { publicIds, loading, error };
}

/**
 * Fonction utilitaire pour résoudre un public_id à partir d'un user_id
 * À utiliser dans les services ou fonctions non-composant
 */
export async function resolvePublicId(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('public_id')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data?.public_id || null;
  } catch (err) {
    console.error('Erreur résolution public_id:', err);
    return null;
  }
}

/**
 * Fonction utilitaire pour résoudre un user_id à partir d'un public_id
 * Recherche inversée
 */
export async function resolveUserIdFromPublicId(publicId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('public_id', publicId.toUpperCase())
      .single();

    if (error) throw error;
    return data?.id || null;
  } catch (err) {
    console.error('Erreur résolution user_id:', err);
    return null;
  }
}
