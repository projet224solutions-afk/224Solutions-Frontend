import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateAgentData {
  name: string;
  email: string;
  phone: string;
  password: string;
  type_agent?: string;
  permissions: string[];
  commission_rate?: number;
  can_create_sub_agent?: boolean;
  country_code?: string;
  country_name?: string;
  currency?: string;
}

interface UpdateAgentData {
  name?: string;
  email?: string;
  phone?: string;
  permissions?: string[];
  commission_rate?: number;
  can_create_sub_agent?: boolean;
}

interface CreateBureauData {
  bureau_code: string;
  prefecture: string;
  commune: string;
  president_name: string;
  president_email: string;
  president_phone: string;
  full_location: string;
}

interface UpdateBureauData {
  bureau_code?: string;
  prefecture?: string;
  commune?: string;
  president_name?: string;
  president_email?: string;
  president_phone?: string;
  full_location?: string;
  status?: string;
}

interface UsePDGActionsOptions {
  onAgentCreated?: () => void;
  onAgentUpdated?: () => void;
  onAgentDeleted?: () => void;
  onBureauCreated?: () => void;
  onBureauUpdated?: () => void;
  onBureauDeleted?: () => void;
  onBureauValidated?: () => void;
}

export function usePDGActions({
  onAgentCreated,
  onAgentUpdated,
  onAgentDeleted,
  onBureauUpdated,
}: UsePDGActionsOptions = {}) {

  // ==================== AGENTS ====================

  const createAgent = useCallback(async (
    agentData: CreateAgentData,
    pdgId: string
  ): Promise<{ success: boolean; error?: string; agent?: any }> => {
    try {
      // Validation
      if (!agentData.name || !agentData.email || !agentData.phone) {
        return { success: false, error: 'Tous les champs obligatoires doivent être remplis' };
      }

      if (!pdgId) {
        return { success: false, error: 'ID PDG manquant' };
      }

      // Appel Edge Function
      const { data, error } = await supabase.functions.invoke('create-pdg-agent', {
        body: {
          name: agentData.name,
          email: agentData.email,
          phone: agentData.phone,
          password: agentData.password,
          type_agent: agentData.type_agent || '',
          permissions: agentData.permissions,
          commission_rate: agentData.commission_rate || 10,
          can_create_sub_agent: agentData.can_create_sub_agent || false,
          country_code: agentData.country_code || 'GN',
          country_name: agentData.country_name || 'Guinée',
          currency: agentData.currency || 'GNF',
        }
      });

      if (error) throw error;

      if (!data.success) {
        const errorMessage = data.error || 'Erreur lors de la création';
        toast.error(errorMessage);
        return { success: false, error: errorMessage };
      }

      toast.success('Agent créé avec succès');
      onAgentCreated?.();

      return { success: true, agent: data.agent };
    } catch (error: any) {
      console.error('[usePDGActions] Erreur création agent:', error);
      const errorMessage = error.message || 'Erreur lors de la création de l\'agent';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [onAgentCreated]);

  const updateAgent = useCallback(async (
    agentId: string,
    updates: UpdateAgentData
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!agentId) {
        return { success: false, error: 'ID agent manquant' };
      }

      const permissionsJsonb = updates.permissions ? updates.permissions : undefined;

      const { data, error } = await supabase
        .rpc('update_agent' as any, {
          p_agent_id: agentId,
          p_name: updates.name,
          p_email: updates.email,
          p_phone: updates.phone,
          p_permissions: permissionsJsonb ? permissionsJsonb as any : null,
          p_commission_rate: updates.commission_rate,
          p_can_create_sub_agent: updates.can_create_sub_agent,
        });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };

      if (!result.success) {
        return { success: false, error: result.error || 'Erreur lors de la mise à jour' };
      }

      toast.success('Agent mis à jour avec succès');
      onAgentUpdated?.();

      return { success: true };
    } catch (error: any) {
      console.error('[usePDGActions] Erreur mise à jour agent:', error);
      const errorMessage = error.message || 'Erreur lors de la mise à jour';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [onAgentUpdated]);

  const deleteAgent = useCallback(async (
    agentId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!agentId) {
        return { success: false, error: 'ID agent manquant' };
      }

      const { data, error } = await supabase.functions.invoke('delete-pdg-agent', {
        body: { agent_id: agentId }
      });

      if (error) throw error;

      if (!data.success) {
        return { success: false, error: data.error || 'Erreur lors de la suppression' };
      }

      toast.success('Agent supprimé avec succès');
      onAgentDeleted?.();

      return { success: true };
    } catch (error: any) {
      console.error('[usePDGActions] Erreur suppression agent:', error);
      const errorMessage = error.message || 'Erreur lors de la suppression';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [onAgentDeleted]);

  const toggleAgentStatus = useCallback(async (
    agentId: string,
    isActive: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!agentId) {
        return { success: false, error: 'ID agent manquant' };
      }

      const { data, error } = await supabase
        .rpc('toggle_agent_status' as any, {
          p_agent_id: agentId,
          p_is_active: isActive
        });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };

      if (!result.success) {
        return { success: false, error: result.error || 'Erreur lors du changement de statut' };
      }

      toast.success(isActive ? 'Agent activé' : 'Agent désactivé');
      onAgentUpdated?.();

      return { success: true };
    } catch (error: any) {
      console.error('[usePDGActions] Erreur changement statut agent:', error);
      const errorMessage = error.message || 'Erreur lors du changement de statut';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [onAgentUpdated]);

  // ==================== BUREAUX SYNDICATS ====================

  const createBureau = useCallback(async (
    bureauData: CreateBureauData
  ): Promise<{ success: boolean; error?: string; bureau?: any }> => {
    try {
      // Validation
      const required = ['bureau_code', 'prefecture', 'commune', 'president_name', 'president_email', 'president_phone'];
      for (const field of required) {
        if (!bureauData[field as keyof CreateBureauData]) {
          return { success: false, error: `Le champ ${field} est requis` };
        }
      }

      // Générer un code unique si nécessaire
      const _bureauCode = bureauData.bureau_code.toUpperCase();

      // Vérifier si le code existe déjà
      // TODO: Créer la table syndicat_bureau dans la base de données
      console.warn('Table syndicat_bureau not found in database');
      const existing = null;
      // const { data: existing } = await supabase
      //   .from('syndicat_bureau')
      //   .select('id')
      //   .eq('bureau_code', bureauCode)
      //   .single();

      if (existing) {
        return { success: false, error: 'Ce code bureau existe déjà' };
      }

      // Créer le bureau
      // TODO: Créer la table syndicat_bureau dans la base de données
      console.warn('Table syndicat_bureau not implemented yet');
      toast.error('Fonctionnalité Bureau de Syndicat en cours de développement');
      return { success: false, error: 'Fonctionnalité Bureau de Syndicat en cours de développement' };

    } catch (error: any) {
      console.error('[usePDGActions] Erreur création bureau:', error);
      const errorMessage = error.message || 'Erreur lors de la création du bureau';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const updateBureau = useCallback(async (
    bureauId: string,
    updates: UpdateBureauData
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!bureauId) {
        return { success: false, error: 'ID bureau manquant' };
      }

      const { error } = await supabase
        .from('bureaus')
        .update(updates)
        .eq('id', bureauId);

      if (error) throw error;

      toast.success('Bureau mis à jour avec succès');
      onBureauUpdated?.();

      return { success: true };
    } catch (error: any) {
      console.error('[usePDGActions] Erreur mise à jour bureau:', error);
      const errorMessage = error.message || 'Erreur lors de la mise à jour';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [onBureauUpdated]);

  const deleteBureau = useCallback(async (
    bureauId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!bureauId) {
        return { success: false, error: 'ID bureau manquant' };
      }

      // Supprimer les données associées d'abord
      // TODO: Créer les tables syndicat dans la base de données
      console.warn('Tables syndicat not implemented yet');
      toast.error('Fonctionnalité Bureau de Syndicat en cours de développement');
      return { success: false, error: 'Fonctionnalité Bureau de Syndicat en cours de développement' };

    } catch (error: any) {
      console.error('[usePDGActions] Erreur suppression bureau:', error);
      const errorMessage = error.message || 'Erreur lors de la suppression';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const validateBureau = useCallback(async (
    bureauId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!bureauId) {
        return { success: false, error: 'ID bureau manquant' };
      }

      // TODO: Créer la table syndicat_bureau dans la base de données
      console.warn('Table syndicat_bureau not implemented yet');
      toast.error('Fonctionnalité Bureau de Syndicat en cours de développement');
      return { success: false, error: 'Fonctionnalité Bureau de Syndicat en cours de développement' };

    } catch (error: any) {
      console.error('[usePDGActions] Erreur validation bureau:', error);
      const errorMessage = error.message || 'Erreur lors de la validation';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  return {
    // Agents
    createAgent,
    updateAgent,
    deleteAgent,
    toggleAgentStatus,

    // Bureaux
    createBureau,
    updateBureau,
    deleteBureau,
    validateBureau,
  };
}
