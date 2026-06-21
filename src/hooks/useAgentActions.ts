/**
 * AGENT ACTIONS HOOK - 224SOLUTIONS
 * Hook pour toutes les actions de l'agent (création utilisateurs, sous-agents, etc.)
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { secureRandomString } from '@/lib/security/inputSanitizer';

export interface CreateUserData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password?: string; // Mot de passe optionnel, généré automatiquement si non fourni
  role: 'client' | 'vendeur' | 'livreur' | 'taxi' | 'transitaire' | 'syndicat' | 'prestataire';
  country: string;
  country_code?: string;
  city: string;
  // Données spécifiques selon le rôle
  syndicatData?: {
    bureau_code: string;
    prefecture: string;
    commune: string;
    full_location: string;
  };
  vendeurData?: {
    business_name: string;
    service_type?: string;
    business_description?: string;
    business_address?: string;
  };
  driverData?: {
    license_number: string;
    vehicle_type: string;
    vehicle_brand?: string;
    vehicle_model?: string;
    vehicle_year?: string;
    vehicle_plate?: string;
  };
}

export interface CreateSubAgentData {
  name: string;
  email: string;
  phone: string;
  commission_rate: number;
  can_create_sub_agent: boolean;
  permissions: string[];
  agentType?: string;
  pdgId?: string;
  accessToken?: string;
}

interface UseAgentActionsOptions {
  onUserCreated?: () => void;
  onSubAgentCreated?: () => void;
  onSubAgentUpdated?: () => void;
  onSubAgentDeleted?: () => void;
}

export const useAgentActions = (options: UseAgentActionsOptions = {}) => {
  /**
   * Créer un utilisateur
   */
  const createUser = async (
    userData: CreateUserData,
    agentId: string,
    agentCode: string,
    accessToken?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // Vérifier l'authentification AVANT tout
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error('❌ [useAgentActions] Pas de session active:', sessionError);
        return {
          success: false,
          error: '🔒 Session expirée. Veuillez vous reconnecter.'
        };
      }

      console.log('✅ [useAgentActions] Session active:', {
        userId: session.user.id,
        email: session.user.email
      });

      // Validation basique
      if (!userData.firstName || !userData.email || !userData.phone) {
        return { success: false, error: 'Veuillez remplir tous les champs obligatoires' };
      }

      // Validation spécifique selon le rôle
      if (userData.role === 'syndicat') {
        if (!userData.syndicatData?.bureau_code || !userData.syndicatData?.prefecture || !userData.syndicatData?.commune) {
          return { success: false, error: 'Veuillez remplir tous les champs du bureau syndical' };
        }
      } else if (userData.role === 'vendeur') {
        if (!userData.vendeurData?.business_name || !userData.vendeurData?.service_type) {
          return { success: false, error: "Veuillez renseigner le type de service et le nom de l'entreprise" };
        }
      } else if (userData.role === 'taxi' || userData.role === 'livreur') {
        if (!userData.driverData?.license_number) {
          return { success: false, error: 'Veuillez remplir le numéro de permis' };
        }
      }

      // Préparer les données pour l'edge function
      // Utiliser le mot de passe fourni ou en générer un automatiquement
      const password = userData.password && userData.password.length >= 8
        ? userData.password
        : secureRandomString(12) + 'Aa1!';

      const requestBody: any = {
        email: userData.email,
        password: password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        role: userData.role,
        country: userData.country,
        country_code: userData.country_code,
        city: userData.city,
        agentId: agentId,
        agentCode: agentCode,
        access_token: accessToken,
      };

      // Ajouter les données spécifiques selon le rôle
      if (userData.syndicatData) {
        requestBody.syndicatData = userData.syndicatData;
      }
      if (userData.vendeurData) {
        requestBody.vendeurData = userData.vendeurData;
      }
      if (userData.driverData) {
        requestBody.driverData = userData.driverData;
      }

      // Créer l'utilisateur via le BACKEND Node (migré depuis l'edge create-user-by-agent)
      // → atomique avec rollback complet côté serveur (pas de compte orphelin).
      console.log('[useAgentActions] Appel backend /api/agents/users avec:', {
        agentId,
        agentCode,
        role: userData.role,
        email: userData.email,
        hasSession: true
      });

      const { backendFetch } = await import('@/services/backendApi');
      const resp = await backendFetch<{ user: any }>('/api/agents/users', {
        method: 'POST',
        body: requestBody,
      });

      console.log('[useAgentActions] Réponse backend:', resp);

      if (!resp.success) {
        return { success: false, error: resp.error || "Erreur lors de la création de l'utilisateur" };
      }

      toast.success(`Utilisateur ${userData.role} créé avec succès!`);
      options.onUserCreated?.();
      return { success: true };
    } catch (error: any) {
      console.error('[useAgentActions] Create user error:', error);
      return { success: false, error: error.message || "Erreur lors de la création de l'utilisateur" };
    }
  };

  /**
   * Créer un sous-agent via edge function
   */
  const createSubAgent = async (
    subAgentData: CreateSubAgentData & { pdgId?: string; accessToken?: string; agentType?: string },
    parentAgentId: string
  ): Promise<{ success: boolean; error?: string; subAgent?: any }> => {
    try {
      // Validation
      if (!subAgentData.name || !subAgentData.email || !subAgentData.phone) {
        return { success: false, error: 'Veuillez remplir tous les champs obligatoires' };
      }

      if (subAgentData.commission_rate < 0 || subAgentData.commission_rate > 100) {
        return { success: false, error: 'Le taux de commission doit être entre 0 et 100%' };
      }

      // Vérifier la session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.error('❌ [useAgentActions] Pas de session pour createSubAgent');
        return {
          success: false,
          error: '🔒 Session expirée. Veuillez vous reconnecter.'
        };
      }

      // Générer un code agent unique
      const agentCode = `SA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Générer un mot de passe temporaire sécurisé
      const tempPassword = secureRandomString(14) + 'Aa1!';

      console.log('📤 [useAgentActions] Appel edge function create-sub-agent:', {
        parentAgentId,
        email: subAgentData.email,
        name: subAgentData.name
      });

      // Appeler l'edge function pour créer le sous-agent
      const { data, error } = await supabase.functions.invoke('create-sub-agent', {
        body: {
          pdg_id: subAgentData.pdgId,
          parent_agent_id: parentAgentId,
          agent_code: agentCode,
          name: subAgentData.name,
          email: subAgentData.email,
          phone: subAgentData.phone,
          agent_type: 'sous_agent',
          type_agent: 'sous_agent',
          agent_role: subAgentData.agentType || 'sales',
          password: tempPassword,
          permissions: subAgentData.permissions || ['create_users'],
          commission_rate: subAgentData.commission_rate || 5,
          access_token: subAgentData.accessToken
        }
      });

      if (error) {
        console.error('[useAgentActions] Edge function create-sub-agent error:', error);
        return {
          success: false,
          error: error.message || 'Erreur lors de la création du sous-agent'
        };
      }

      if (!data?.success) {
        console.error('[useAgentActions] Create sub-agent failed:', data);
        return {
          success: false,
          error: data?.error || 'Erreur lors de la création du sous-agent'
        };
      }

      toast.success(`Sous-agent ${subAgentData.name} créé avec succès!`);
      options.onSubAgentCreated?.();
      return { success: true, subAgent: data.agent };
    } catch (error: any) {
      console.error('[useAgentActions] Create sub-agent error:', error);
      return { success: false, error: error.message || 'Erreur lors de la création du sous-agent' };
    }
  };

  /**
   * Mettre à jour un sous-agent
   */
  const updateSubAgent = async (
    subAgentId: string,
    updates: Partial<CreateSubAgentData>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const updateData: any = {};
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.phone !== undefined) updateData.phone = updates.phone;
      if (updates.commission_rate !== undefined) updateData.commission_rate = updates.commission_rate;
      if (updates.can_create_sub_agent !== undefined) updateData.can_create_sub_agent = updates.can_create_sub_agent;
      if (updates.permissions !== undefined) updateData.permissions = updates.permissions;

      const { error } = await supabase
        .from('agents_management')
        .update(updateData)
        .eq('id', subAgentId);

      if (error) {
        console.error('[useAgentActions] Update sub-agent error:', error);
        return { success: false, error: error.message };
      }

      // Synchroniser les permissions dans agent_permissions table si modifiées
      if (updates.permissions) {
        await supabase.from('agent_permissions').delete().eq('agent_id', subAgentId);
        if (updates.permissions.length > 0) {
          await supabase.from('agent_permissions').insert(
            updates.permissions.map(perm => ({
              agent_id: subAgentId,
              permission_key: perm,
              permission_value: true
            }))
          );
        }
      }

      toast.success('Sous-agent mis à jour avec succès!');
      options.onSubAgentUpdated?.();
      return { success: true };
    } catch (error: any) {
      console.error('[useAgentActions] Update sub-agent error:', error);
      return { success: false, error: error.message || 'Erreur lors de la mise à jour du sous-agent' };
    }
  };

  /**
   * Désactiver un sous-agent
   */
  const deleteSubAgent = async (subAgentId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Désactiver plutôt que supprimer (soft delete)
      const { error } = await supabase
        .from('agents_management')
        .update({ is_active: false })
        .eq('id', subAgentId);

      if (error) {
        console.error('[useAgentActions] Delete sub-agent error:', error);
        return { success: false, error: error.message };
      }

      toast.success('Sous-agent désactivé avec succès!');
      options.onSubAgentDeleted?.();
      return { success: true };
    } catch (error: any) {
      console.error('[useAgentActions] Delete sub-agent error:', error);
      return { success: false, error: error.message || 'Erreur lors de la désactivation du sous-agent' };
    }
  };

  /**
   * Assigner des permissions à un agent
   */
  const assignPermissions = async (
    agentId: string,
    permissions: string[]
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Mettre à jour le JSON legacy dans agents_management
      const { error: legacyError } = await supabase
        .from('agents_management')
        .update({ permissions })
        .eq('id', agentId);

      if (legacyError) {
        console.error('[useAgentActions] Legacy permissions update error:', legacyError);
        return { success: false, error: legacyError.message };
      }

      // 2. Synchroniser avec agent_permissions table (source de vérité)
      // D'abord supprimer les anciennes permissions
      const { error: deleteError } = await supabase
        .from('agent_permissions')
        .delete()
        .eq('agent_id', agentId);

      if (deleteError) {
        console.warn('[useAgentActions] Delete old permissions warning:', deleteError);
      }

      // Puis insérer les nouvelles
      if (permissions.length > 0) {
        const permRows = permissions.map(perm => ({
          agent_id: agentId,
          permission_key: perm,
          permission_value: true
        }));

        const { error: insertError } = await supabase
          .from('agent_permissions')
          .insert(permRows);

        if (insertError) {
          console.error('[useAgentActions] Insert permissions error:', insertError);
          // Non bloquant - le JSON legacy est déjà mis à jour
          console.warn('⚠️ agent_permissions table non synchronisée, JSON legacy OK');
        }
      }

      toast.success('Permissions mises à jour avec succès!');
      return { success: true };
    } catch (error: any) {
      console.error('[useAgentActions] Assign permissions error:', error);
      return { success: false, error: error.message || 'Erreur lors de la mise à jour des permissions' };
    }
  };

  /**
   * Mettre à jour le taux de commission
   */
  const updateCommissionRate = async (
    agentId: string,
    rate: number
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      if (rate < 0 || rate > 100) {
        return { success: false, error: 'Le taux de commission doit être entre 0 et 100%' };
      }

      const { error } = await supabase
        .from('agents_management')
        .update({ commission_rate: rate })
        .eq('id', agentId);

      if (error) {
        console.error('[useAgentActions] Update commission rate error:', error);
        return { success: false, error: error.message };
      }

      toast.success('Taux de commission mis à jour avec succès!');
      return { success: true };
    } catch (error: any) {
      console.error('[useAgentActions] Update commission rate error:', error);
      return { success: false, error: error.message || 'Erreur lors de la mise à jour du taux de commission' };
    }
  };

  return {
    createUser,
    createSubAgent,
    updateSubAgent,
    deleteSubAgent,
    assignPermissions,
    updateCommissionRate
  };
};
