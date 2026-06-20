/**
 * 🔍 HOOK: RECHERCHE PAR ID STANDARDISÉ
 * Recherche utilisateurs par ID (USR0001, VND0001, etc.) ou 224-XXX-XXX
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { UserProfile } from '@/types/communication.types';
import {
  buildPhoneSearchTerms,
  isSupportedDirectUserSearch,
  parseUserSearchInput,
  stripPhoneToDigits,
} from '@/lib/communication/userSearch';

interface _SearchByIdResult {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

export function useSearchUserId() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Valider le format de l'ID
   */
  const validateIdFormat = useCallback((id: string): boolean => {
    return isSupportedDirectUserSearch(id);
  }, []);

  /**
   * Rechercher un utilisateur par ID
   */
  const searchById = useCallback(async (
    searchId: string
  ): Promise<UserProfile | null> => {
    setLoading(true);
    setError(null);

    try {
      const trimmedId = searchId.trim();
      const parsed = parseUserSearchInput(trimmedId);

      // Valider le format
      if (!validateIdFormat(trimmedId)) {
        throw new Error('Format invalide. Formats acceptés: USR0001, 224-123-456, email ou téléphone');
      }

      let profile: any = null;

      // Détection du type de recherche
      if (parsed.kind === 'uuid') {
        const { data, error: searchError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, public_id, role, phone')
          .eq('id', trimmedId)
          .maybeSingle();
        if (searchError && searchError.code !== 'PGRST116') throw searchError;
        profile = data;
      } else if (parsed.kind === 'email') {
        // Recherche par email exact d'abord, puis partiel
        const { data: exactData, error: exactError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, public_id, role, phone')
          .ilike('email', trimmedId)
          .limit(1)
          .maybeSingle();
        if (!exactError) {
          profile = exactData;
        }
        if (!profile) {
          const { data: partialData, error: partialError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, avatar_url, public_id, role, phone')
            .ilike('email', `%${trimmedId}%`)
            .limit(1)
            .maybeSingle();
          if (partialError && partialError.code !== 'PGRST116') throw partialError;
          profile = partialData;
        }
      } else if (parsed.kind === 'phone') {
        // Recherche par téléphone
        const phoneFilters = buildPhoneSearchTerms(trimmedId)
          .map((term) => `phone.ilike.%${term}%`)
          .join(',');
        const { data, error: searchError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, public_id, role, phone')
          .or(phoneFilters)
          .limit(1)
          .maybeSingle();
        if (searchError && searchError.code !== 'PGRST116') throw searchError;
        profile = data;

        if (!profile) {
          const referenceDigits = stripPhoneToDigits(trimmedId).replace(/^224/, '');
          const looseTerm = referenceDigits.slice(-4);
          const { data: loosePhoneData, error: looseSearchError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, email, avatar_url, public_id, role, phone')
            .ilike('phone', `%${looseTerm}%`)
            .limit(20);
          if (looseSearchError) throw looseSearchError;

          profile = (loosePhoneData || []).find((candidate) => {
            const candidateDigits = stripPhoneToDigits(candidate.phone || '').replace(/^224/, '');
            return candidateDigits && (candidateDigits.includes(referenceDigits) || referenceDigits.includes(candidateDigits));
          });
        }
      } else {
        // Recherche par public_id (format code)
        const upperId = parsed.upper;
        const { data, error: searchError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, public_id, role, phone')
          .eq('public_id', upperId)
          .maybeSingle();
        if (searchError && searchError.code !== 'PGRST116') throw searchError;
        profile = data;

        // Fallback: chercher dans user_ids.custom_id
        if (!profile) {
          const { data: uidData } = await supabase
            .from('user_ids')
            .select('user_id')
            .eq('custom_id', upperId)
            .maybeSingle();
          if (uidData?.user_id) {
            const { data: pData } = await supabase
              .from('profiles')
              .select('id, first_name, last_name, email, avatar_url, public_id, role, phone')
              .eq('id', uidData.user_id)
              .maybeSingle();
            profile = pData;
          }
        }
      }

      if (!profile) {
        throw new Error('Aucun utilisateur trouvé');
      }

      toast.success('Utilisateur trouvé!', {
        description: `${profile.first_name || ''} ${profile.last_name || ''} (${profile.public_id || profile.email || ''})`
      });

      return profile as UserProfile;
    } catch (err: any) {
      const errorMessage = err.message || 'Erreur lors de la recherche';
      setError(errorMessage);

      toast.error('Recherche échouée', {
        description: errorMessage
      });

      return null;
    } finally {
      setLoading(false);
    }
  }, [validateIdFormat]);

  /**
   * Rechercher plusieurs utilisateurs par IDs
   */
  const searchByIds = useCallback(async (
    ids: string[]
  ): Promise<UserProfile[]> => {
    setLoading(true);
    setError(null);

    try {
      const validIds = ids
        .map(id => id.trim().toUpperCase())
        .filter(id => validateIdFormat(id));

      if (validIds.length === 0) {
        throw new Error('Aucun ID valide fourni');
      }

      const { data: profiles, error: searchError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url, public_id, role, phone')
        .in('public_id', validIds);

      if (searchError) throw searchError;

      toast.success(`${profiles?.length || 0} utilisateur(s) trouvé(s)`);

      return (profiles as UserProfile[]) || [];
    } catch (err: any) {
      const errorMessage = err.message || 'Erreur lors de la recherche';
      setError(errorMessage);

      toast.error('Recherche échouée', {
        description: errorMessage
      });

      return [];
    } finally {
      setLoading(false);
    }
  }, [validateIdFormat]);

  /**
   * Rechercher utilisateurs par préfixe (USR, VND, DRV, etc.)
   */
  const searchByPrefix = useCallback(async (
    prefix: string
  ): Promise<UserProfile[]> => {
    setLoading(true);
    setError(null);

    try {
      const upperPrefix = prefix.trim().toUpperCase();

      if (upperPrefix.length !== 3) {
        throw new Error('Le préfixe doit contenir exactement 3 lettres');
      }

      const { data: profiles, error: searchError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url, public_id, role, phone')
        .like('public_id', `${upperPrefix}%`)
        .limit(50);

      if (searchError) throw searchError;

      return (profiles as UserProfile[]) || [];
    } catch (err: any) {
      const errorMessage = err.message || 'Erreur lors de la recherche';
      setError(errorMessage);

      toast.error('Recherche échouée', {
        description: errorMessage
      });

      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    searchById,
    searchByIds,
    searchByPrefix,
    validateIdFormat,
    loading,
    error
  };
}
