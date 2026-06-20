import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Agent {
  id: string;
  pdg_id: string;
  agent_code: string;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  permissions: string[];
  commission_rate: number;
  can_create_sub_agent: boolean;
  type_agent?: string;
  access_token?: string;
  created_at: string;
  updated_at?: string;
  total_users_created?: number;
  total_commissions_earned?: number;
  country_code?: string;
  country_name?: string;
  currency?: string;
}

export interface PDGProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  permissions: string[];
  is_active: boolean;
}

export interface AgentStats {
  totalAgents: number;
  activeAgents: number;
  inactiveAgents: number;
  averageCommission: number;
  totalCommissionsEarned: number;
}

export const usePDGAgentsData = () => {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pdgProfile, setPdgProfile] = useState<PDGProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AgentStats>({
    totalAgents: 0,
    activeAgents: 0,
    inactiveAgents: 0,
    averageCommission: 0,
    totalCommissionsEarned: 0,
  });

  // Charger le profil PDG
  const loadPDGProfile = useCallback(async () => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('pdg_management')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (error) {
        // Si pas de profil PDG, créer automatiquement
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, first_name, last_name, phone')
          .eq('id', user.id)
          .single();

        if (profile) {
          const { data: newPdg, error: createError } = await supabase
            .from('pdg_management')
            .insert({
              user_id: user.id,
              name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
              email: profile.email,
              phone: profile.phone,
              permissions: ['all'],
              is_active: true,
            })
            .select()
            .single();

          if (createError) throw createError;

          const pdg: PDGProfile = {
            id: newPdg.id,
            user_id: newPdg.user_id,
            name: newPdg.name,
            email: newPdg.email,
            phone: newPdg.phone || undefined,
            permissions: Array.isArray(newPdg.permissions) ? (newPdg.permissions as string[]) : ['all'],
            is_active: newPdg.is_active,
          };
          setPdgProfile(pdg);
          toast.success('Profil PDG créé automatiquement');
          return pdg;
        }
      } else {
        const pdg: PDGProfile = {
          id: data.id,
          user_id: data.user_id,
          name: data.name,
          email: data.email,
          phone: data.phone || undefined,
          permissions: Array.isArray(data.permissions) ? (data.permissions as string[]) : ['all'],
          is_active: data.is_active,
        };
        setPdgProfile(pdg);
        return pdg;
      }
    } catch (error) {
      console.error('Erreur chargement PDG:', error);
      toast.error('Erreur lors du chargement du profil PDG');
    }
    return null;
  }, [user?.id]);

  // Charger les agents
  const loadAgents = useCallback(async () => {
    if (!pdgProfile?.id) return;

    try {
      setLoading(true);

      // Récupérer les agents
      const { data: agentsData, error: agentsError } = await supabase
        .from('agents_management')
        .select('*')
        .eq('pdg_id', pdgProfile.id)
        .order('created_at', { ascending: false });

      if (agentsError) throw agentsError;

      // Récupérer les statistiques pour chaque agent
      // 🚀 Batch: load all agent IDs' stats in parallel instead of N+1
      const agentIds = (agentsData || []).map(a => a.id);

      const [usersCountResult, commissionsResult] = await Promise.all([
        // Batch count users per agent
        supabase
          .from('agent_created_users')
          .select('agent_id')
          .in('agent_id', agentIds),
        // Batch sum commissions per agent from the REAL source of truth
        supabase
          .from('agent_commissions_log')
          .select('agent_id, amount')
          .in('agent_id', agentIds),
      ]);

      // Build lookup maps
      const usersCountMap = new Map<string, number>();
      (usersCountResult.data || []).forEach(row => {
        usersCountMap.set(row.agent_id, (usersCountMap.get(row.agent_id) || 0) + 1);
      });

      const commissionsMap = new Map<string, number>();
      (commissionsResult.data || []).forEach(row => {
        commissionsMap.set(row.agent_id, (commissionsMap.get(row.agent_id) || 0) + (row.amount || 0));
      });

      const agentsWithStats: Agent[] = (agentsData || []).map((agent) => ({
        id: agent.id,
        pdg_id: agent.pdg_id,
        agent_code: agent.agent_code,
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        is_active: agent.is_active,
        permissions: Array.isArray(agent.permissions) ? (agent.permissions as string[]) : [],
        commission_rate: Number(agent.commission_rate) || 0,
        can_create_sub_agent: Boolean(agent.can_create_sub_agent),
        access_token: agent.access_token,
        created_at: agent.created_at,
        updated_at: agent.updated_at || undefined,
        total_commissions_earned: commissionsMap.get(agent.id) || 0,
        total_users_created: usersCountMap.get(agent.id) || 0,
      }));

      setAgents(agentsWithStats);

      // Calculer les statistiques globales
      const activeAgents = agentsWithStats.filter(a => a.is_active).length;
      const totalCommissions = agentsWithStats.reduce(
        (sum, a) => sum + (a.total_commissions_earned || 0),
        0
      );
      const avgCommission = agentsWithStats.length > 0
        ? agentsWithStats.reduce((sum, a) => sum + (Number(a.commission_rate) || 0), 0) / agentsWithStats.length
        : 0;

      setStats({
        totalAgents: agentsWithStats.length,
        activeAgents,
        inactiveAgents: agentsWithStats.length - activeAgents,
        averageCommission: avgCommission,
        totalCommissionsEarned: totalCommissions,
      });
    } catch (error) {
      console.error('Erreur chargement agents:', error);
      toast.error('Erreur lors du chargement des agents');
    } finally {
      setLoading(false);
    }
  }, [pdgProfile?.id]);

  // Créer un agent
  const createAgent = useCallback(async (agentData: {
    name: string;
    email: string;
    phone: string;
    permissions: string[];
    commission_rate?: number;
    can_create_sub_agent?: boolean;
  }) => {
    if (!pdgProfile?.id) {
      toast.error('Profil PDG non trouvé');
      return null;
    }

    try {
      // Appeler l'Edge Function pour créer l'agent avec authentification
      const { data, error } = await supabase.functions.invoke('create-pdg-agent', {
        body: {
          name: agentData.name,
          email: agentData.email,
          phone: agentData.phone,
          permissions: agentData.permissions,
          commission_rate: agentData.commission_rate || 10,
          can_create_sub_agent: agentData.can_create_sub_agent || false,
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erreur lors de la création');

      toast.success('Agent créé avec succès (compte + wallet créés)');
      await loadAgents(); // Recharger la liste
      return data.agent;
    } catch (error: any) {
      console.error('Erreur création agent:', error);
      toast.error(error.message || 'Erreur lors de la création');
      return null;
    }
  }, [pdgProfile?.id, loadAgents]);

  // Mettre à jour un agent
  const updateAgent = useCallback(async (agentId: string, updates: Partial<Agent>) => {
    try {
      // Convertir le tableau permissions en jsonb si présent
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
        throw new Error(result.error || 'Erreur lors de la mise à jour');
      }

      toast.success(result.message || 'Agent mis à jour avec succès');
      await loadAgents(); // Recharger la liste
      return true;
    } catch (error: any) {
      console.error('Erreur mise à jour agent:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour');
      return false;
    }
  }, [loadAgents]);

  // Supprimer un agent définitivement (hard delete)
  const deleteAgent = useCallback(async (agentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-pdg-agent', {
        body: { agent_id: agentId }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erreur lors de la suppression');
      }

      toast.success(data.message || 'Agent supprimé définitivement');
      await loadAgents(); // Recharger la liste
      return true;
    } catch (error: any) {
      console.error('Erreur suppression agent:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
      return false;
    }
  }, [loadAgents]);

  // Activer/Désactiver un agent
  const toggleAgentStatus = useCallback(async (agentId: string, isActive: boolean) => {
    try {
      const { data, error } = await supabase
        .rpc('toggle_agent_status' as any, {
          p_agent_id: agentId,
          p_is_active: isActive
        });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; message?: string };

      if (!result.success) {
        throw new Error(result.error || 'Erreur lors du changement de statut');
      }

      toast.success(result.message || 'Statut modifié avec succès');
      await loadAgents(); // Recharger la liste
      return true;
    } catch (error: any) {
      console.error('Erreur changement statut agent:', error);
      toast.error(error.message || 'Erreur lors du changement de statut');
      return false;
    }
  }, [loadAgents]);

  // Charger les données au montage
  useEffect(() => {
    const init = async () => {
      const pdg = await loadPDGProfile();
      if (pdg) {
        await loadAgents();
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Recharger les agents quand le PDG change
  useEffect(() => {
    if (pdgProfile?.id) {
      loadAgents();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdgProfile?.id]);

  // Écouter les changements en temps réel sur les agents
  useEffect(() => {
    if (!pdgProfile?.id) return;

    const channel = supabase
      .channel('agents-realtime-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agents_management',
          filter: `pdg_id=eq.${pdgProfile.id}`
        },
        (payload) => {
          console.log('Agent realtime change:', payload);
          loadAgents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pdgProfile?.id, loadAgents]);

  return {
    agents,
    pdgProfile,
    loading,
    stats,
    createAgent,
    updateAgent,
    deleteAgent,
    toggleAgentStatus,
    refetch: loadAgents,
  };
};
