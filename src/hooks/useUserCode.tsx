/**
 * HOOK POUR RÉCUPÉRER LE CODE ID DE L'UTILISATEUR CONNECTÉ
 * Source de vérité unique: profiles.public_id
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useUserCode() {
  const { user } = useAuth();
  const [userCode, setUserCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setUserCode(null);
      setLoading(false);
      return;
    }

    const fetchUserCode = async () => {
      try {
        setLoading(true);

        // Source unique: profiles.public_id (ID standardisé)
        const { data: profileData } = await supabase
          .from('profiles')
          .select('public_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profileData?.public_id) {
          setUserCode(profileData.public_id);
        } else {
          console.warn('⚠️ Aucun public_id trouvé pour user:', user.id);
          setUserCode(null);
        }
      } catch (error) {
        console.error('Erreur récupération code utilisateur:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserCode();
  }, [user?.id]);

  return { userCode, loading };
}
