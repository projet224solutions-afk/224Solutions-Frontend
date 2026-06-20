/**
 * 🆔 HOOK: GESTION DES IDs STANDARDISÉS 224SOLUTIONS
 * Format universel: 224-XXX-XXX (224 + 3 chiffres + 3 chiffres)
 */

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Mapping des scopes vers les préfixes
 */
export const SCOPE_PREFIX_MAP: Record<string, string> = {
  'users': 'CLT',
  'user': 'CLT',
  'vendors': 'VND',
  'vendor': 'VND',
  'pdg': 'PDG',
  'agents': 'AGT',
  'agent': 'AGT',
  'sub_agents': 'SAG',
  'sub_agent': 'SAG',
  'syndicats': 'BST',
  'syndicat': 'BST',
  'bureau': 'BST',
  'bureaus': 'BST',
  'drivers': 'DRV',
  'driver': 'DRV',
  'clients': 'CLT',
  'client': 'CLT',
  'customers': 'CLT',
  'customer': 'CLT',
  'products': 'PRD',
  'product': 'PRD',
  'orders': 'ORD',
  'order': 'ORD',
  'transactions': 'TXN',
  'transaction': 'TXN',
  'wallets': 'WLT',
  'wallet': 'WLT',
  'messages': 'MSG',
  'message': 'MSG',
  'conversations': 'CNV',
  'conversation': 'CNV',
  'deliveries': 'DLV',
  'delivery': 'DLV',
  'general': 'GEN',
};

export interface StandardIdResult {
  id: string | null;
  prefix: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook principal pour gérer les IDs standardisés 224SOLUTIONS
 */
export const useStandardId = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Génère un ID standardisé séquentiel (ex: CLT0001, VND0002)
   */
  const generateStandardId = async (
    scope: string,
    showToast = true
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      const prefix = SCOPE_PREFIX_MAP[scope.toLowerCase()] || 'CLT';

      // Utiliser l'Edge Function pour générer un ID séquentiel
      const { data, error: funcError } = await supabase.functions.invoke(
        'generate-unique-id',
        {
          body: { scope, prefix, batch: 1 }
        }
      );

      if (funcError) {
        console.error('Edge function error:', funcError);
        // Fallback: générer localement basé sur user_ids
        return await generateLocalSequentialId(prefix);
      }

      if (!data?.success || !data?.ids || data.ids.length === 0) {
        console.error('Invalid response from edge function:', data);
        return await generateLocalSequentialId(prefix);
      }

      const generatedId = data.ids[0];

      if (showToast) {
        toast.success(`ID généré: ${generatedId}`, {
          description: `Format séquentiel ${prefix}XXXX`
        });
      }

      return generatedId;
    } catch (err: any) {
      const errorMsg = err.message || 'Erreur génération ID';
      setError(errorMsg);
      console.error('Erreur génération ID:', err);

      // Fallback local
      const prefix = SCOPE_PREFIX_MAP[scope.toLowerCase()] || 'CLT';
      return await generateLocalSequentialId(prefix);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Génère un ID séquentiel localement en vérifiant user_ids
   */
  const generateLocalSequentialId = async (prefix: string): Promise<string | null> => {
    try {
      // Chercher le dernier ID avec ce préfixe dans user_ids
      const { data: lastIds, error } = await supabase
        .from('user_ids')
        .select('custom_id')
        .ilike('custom_id', `${prefix}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching last IDs:', error);
      }

      let nextNumber = 1;

      if (lastIds && lastIds.length > 0) {
        // Trouver le plus grand numéro
        for (const item of lastIds) {
          const numPart = item.custom_id.replace(prefix, '');
          const num = parseInt(numPart, 10);
          if (!isNaN(num) && num >= nextNumber) {
            nextNumber = num + 1;
          }
        }
      }

      // Générer l'ID avec 4 chiffres (CLT0001)
      const newId = `${prefix}${nextNumber.toString().padStart(4, '0')}`;

      // Vérifier que l'ID n'existe pas déjà
      const { data: existing } = await supabase
        .from('user_ids')
        .select('custom_id')
        .eq('custom_id', newId)
        .maybeSingle();

      if (existing) {
        // ID existe, incrémenter
        return `${prefix}${(nextNumber + 1).toString().padStart(4, '0')}`;
      }

      console.log(`✅ ID local généré: ${newId}`);
      return newId;
    } catch (err) {
      console.error('Erreur génération locale:', err);
      // Dernier fallback avec timestamp
      const timestamp = Date.now().toString().slice(-4);
      return `${prefix}${timestamp}`;
    }
  };

  /**
   * Génère plusieurs IDs en batch
   */
  const generateBatchStandardIds = async (
    scope: string,
    count: number,
    showToast = true
  ): Promise<string[]> => {
    if (count > 10) {
      toast.error('Maximum 10 IDs par requête');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const prefix = SCOPE_PREFIX_MAP[scope.toLowerCase()] || 'GEN';

      const { data, error: funcError } = await supabase.functions.invoke(
        'generate-unique-id',
        {
          body: { scope, prefix, batch: count }
        }
      );

      if (funcError) throw funcError;

      if (!data?.success || !data?.ids) {
        throw new Error('Génération IDs échouée');
      }

      if (showToast) {
        toast.success(`${data.ids.length} IDs générés`, {
          description: `Préfixe: ${prefix} • ${data.ids[0]} ... ${data.ids[data.ids.length - 1]}`
        });
      }

      return data.ids;
    } catch (err: any) {
      const errorMsg = err.message || 'Erreur génération IDs';
      setError(errorMsg);

      if (showToast) {
        toast.error('Échec génération IDs', {
          description: errorMsg
        });
      }

      return [];
    } finally {
      setLoading(false);
    }
  };

  /**
   * Valide le format d'un ID standardisé 224Solutions
   */
  const validateStandardId = (id: string): boolean => {
    // Format: 224-XXX-XXX (224 suivi de - puis 3 chiffres - 3 chiffres)
    // Accepte aussi l'ancien format pour la rétrocompatibilité
    return /^224-\d{3}-\d{3}$/.test(id) || /^[A-Z]{3}\d{4,}$/.test(id);
  };

  /**
   * Extrait le préfixe d'un ID
   */
  const extractPrefix = (id: string): string | null => {
    if (!validateStandardId(id)) return null;
    return id.substring(0, 3);
  };

  /**
   * Extrait le numéro séquentiel d'un ID
   */
  const extractNumber = (id: string): number | null => {
    if (!validateStandardId(id)) return null;
    const numStr = id.substring(3);
    return parseInt(numStr, 10);
  };

  /**
   * Obtient un aperçu du prochain ID sans l'incrémenter
   */
  const previewNextId = async (scope: string): Promise<string | null> => {
    try {
      const prefix = SCOPE_PREFIX_MAP[scope.toLowerCase()] || 'GEN';

      const { data, error } = await supabase
        .rpc('preview_next_id', { p_prefix: prefix });

      if (error) throw error;
      return data;
    } catch (err: any) {
      console.error('Erreur preview ID:', err);
      return null;
    }
  };

  /**
   * Obtient les statistiques d'un préfixe
   */
  const getPrefixStats = async (prefix: string) => {
    try {
      const { data, error } = await supabase
        .from('id_counters')
        .select('*')
        .eq('prefix', prefix)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Erreur stats préfixe:', err);
      return null;
    }
  };

  /**
   * Formate un ID pour l'affichage
   */
  const formatStandardId = (id: string): string => {
    if (!id) return '';
    return id.toUpperCase().trim();
  };

  return {
    generateStandardId,
    generateBatchStandardIds,
    validateStandardId,
    extractPrefix,
    extractNumber,
    previewNextId,
    getPrefixStats,
    formatStandardId,
    loading,
    error,
    SCOPE_PREFIX_MAP
  };
};

export default useStandardId;
