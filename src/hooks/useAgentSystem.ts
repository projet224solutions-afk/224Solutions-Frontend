/**
 * 🎣 Hooks pour le Système de Gestion d'Agents
 * Hooks React optimisés pour la gestion des agents, sous-agents et commissions
 */

import { useState, useEffect, useCallback } from 'react';
import { agentService, AgentManagement, SubAgentManagement, AgentCreatedUser, AgentCommission, CommissionSettings } from '@/services/agentService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// =====================================================
// HOOK PRINCIPAL PDG
// =====================================================

export function usePDGManagement() {
  const { user } = useAuth();
  const [pdgData, setPdgData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPDGData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await agentService.getPDGByUserId(user.id);
      setPdgData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPDGData();
  }, [fetchPDGData]);

  const createPDG = useCallback(async (data: {
    name: string;
    email: string;
    phone?: string;
    permissions?: string[];
  }) => {
    if (!user) throw new Error('Utilisateur non connecté');

    const newPDG = await agentService.createPDG({
      user_id: user.id,
      ...data
    });

    setPdgData(newPDG);
    return newPDG;
  }, [user]);

  return {
    pdgData,
    loading,
    error,
    createPDG,
    refetch: fetchPDGData
  };
}

// =====================================================
// HOOK GESTION AGENTS
// =====================================================

export function useAgentManagement(pdgId?: string) {
  const [agents, setAgents] = useState<AgentManagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    if (!pdgId) return;

    try {
      setLoading(true);
      const data = await agentService.getAgentsByPDG(pdgId);
      setAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [pdgId]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const createAgent = useCallback(async (data: {
    name: string;
    email: string;
    phone: string;
    can_create_sub_agent?: boolean;
    permissions?: string[];
  }) => {
    if (!pdgId) throw new Error('PDG ID requis');

    const newAgent = await agentService.createAgent({
      pdg_id: pdgId,
      ...data
    });

    setAgents(prev => [newAgent, ...prev]);
    return newAgent;
  }, [pdgId]);

  const updateAgent = useCallback(async (agentId: string, updates: Partial<AgentManagement>) => {
    await agentService.updateAgent(agentId, updates, pdgId);
    setAgents(prev => prev.map(agent =>
      agent.id === agentId ? { ...agent, ...updates } : agent
    ));
  }, [pdgId]);

  const deleteAgent = useCallback(async (agentId: string) => {
    await agentService.updateAgent(agentId, { is_active: false });
    setAgents(prev => prev.filter(agent => agent.id !== agentId));
    toast.success('✅ Agent désactivé');
  }, []);

  return {
    agents,
    loading,
    error,
    createAgent,
    updateAgent,
    deleteAgent,
    refetch: fetchAgents
  };
}

// =====================================================
// HOOK GESTION SOUS-AGENTS
// =====================================================

export function useSubAgentManagement(agentId?: string) {
  const [subAgents, setSubAgents] = useState<SubAgentManagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubAgents = useCallback(async () => {
    if (!agentId) return;

    try {
      setLoading(true);
      const data = await agentService.getSubAgentsByAgent(agentId);
      setSubAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchSubAgents();
  }, [fetchSubAgents]);

  const createSubAgent = useCallback(async (data: {
    name: string;
    email: string;
    phone: string;
    permissions?: string[];
  }) => {
    if (!agentId) throw new Error('Agent ID requis');

    const newSubAgent = await agentService.createSubAgent({
      parent_agent_id: agentId,
      ...data
    });

    setSubAgents(prev => [newSubAgent, ...prev]);
    return newSubAgent;
  }, [agentId]);

  return {
    subAgents,
    loading,
    error,
    createSubAgent,
    refetch: fetchSubAgents
  };
}

// =====================================================
// HOOK GESTION UTILISATEURS CRÉÉS
// =====================================================

export function useAgentCreatedUsers(creatorId?: string) {
  const [users, setUsers] = useState<AgentCreatedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!creatorId) return;

    try {
      setLoading(true);
      const data = await agentService.getUsersByCreator(creatorId);
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [creatorId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const createUser = useCallback(async (data: {
    creator_type: 'agent' | 'sub_agent';
    name: string;
    email?: string;
    phone?: string;
  }) => {
    if (!creatorId) throw new Error('Creator ID requis');

    const newUser = await agentService.createUserByAgent(creatorId, {
      creator_type: data.creator_type,
      name: data.name,
      email: data.email,
      phone: data.phone
    });

    setUsers(prev => [newUser, ...prev]);
    return newUser;
  }, [creatorId]);

  return {
    users,
    loading,
    error,
    createUser,
    refetch: fetchUsers
  };
}

// =====================================================
// HOOK GESTION COMMISSIONS
// =====================================================

export function useCommissionManagement(recipientId?: string, recipientType?: 'agent' | 'sub_agent') {
  const [commissions, setCommissions] = useState<AgentCommission[]>([]);
  const [settings, setSettings] = useState<CommissionSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommissions = useCallback(async () => {
    if (!recipientId || !recipientType) return;

    try {
      setLoading(true);
      const data = await agentService.getCommissionsByRecipient(recipientId);
      setCommissions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [recipientId, recipientType]);

  const fetchSettings = useCallback(async () => {
    try {
      const data: Record<string, unknown> = await agentService.getCommissionSettings();
      setSettings(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setSettings([]);
    }
  }, []);

  useEffect(() => {
    fetchCommissions();
    fetchSettings();
  }, [fetchCommissions, fetchSettings]);

  const updateSetting = useCallback(async (settingKey: string, value?: unknown) => {
    try {
      if (typeof value !== 'number') {
        throw new Error('La valeur doit être un nombre');
      }

      const { data, error } = await supabase
        .from('commission_settings')
        .update({
          setting_value: value,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', settingKey)
        .select()
        .single();

      if (error) throw error;

      // Rafraîchir settings
      await fetchSettings();

      console.log('✅ Paramètre mis à jour:', settingKey, value);
      return data;
    } catch (err) {
      console.error('❌ Erreur mise à jour paramètre:', err);
      throw err;
    }
  }, [fetchSettings]);

  const processTransaction = useCallback(async (data: {
    userId: string;
    transactionAmount: number;
    netRevenue: number;
    transactionType: string;
    metadata?: unknown;
  }) => {
    const result = await agentService.processTransaction(data);
    // Rafraîchir les commissions après traitement
    fetchCommissions();
    return result;
  }, [fetchCommissions]);

  return {
    commissions,
    settings,
    loading,
    error,
    updateSetting,
    processTransaction,
    refetch: fetchCommissions
  };
}

// =====================================================
// HOOK STATISTIQUES AGENT
// =====================================================

export function useAgentStats(agentId?: string) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalCommissions: 0,
    monthlyCommissions: 0,
    subAgents: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!agentId) return;

    try {
      setLoading(true);
      const data: Record<string, unknown> = await agentService.getAgentStats(agentId);
      setStats({
        totalUsers: data?.totalUsers || 0,
        activeUsers: data?.activeUsers || data?.totalUsers || 0,
        totalCommissions: data?.totalCommissions || 0,
        monthlyCommissions: data?.monthlyCommissions || data?.totalCommissions || 0,
        subAgents: data?.subAgents || 0
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      // Utiliser des valeurs par défaut en cas d'erreur
      setStats({
        totalUsers: 0,
        activeUsers: 0,
        totalCommissions: 0,
        monthlyCommissions: 0,
        subAgents: 0
      });
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats
  };
}

// =====================================================
// HOOK ACTIVATION UTILISATEUR
// =====================================================

export function useUserActivation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activateUser = useCallback(async (invitationToken: string, _deviceType: 'mobile' | 'pc' | 'tablet') => {
    try {
      setLoading(true);
      setError(null);

      const result: unknown = await agentService.activateUser(invitationToken);

      // Retourner un objet par défaut
      return result || { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    activateUser,
    loading,
    error
  };
}

// =====================================================
// HOOK GLOBAL POUR TOUTES LES DONNÉES AGENTS
// =====================================================

export function useAgentSystemOverview(pdgId?: string) {
  const { agents, loading: agentsLoading } = useAgentManagement(pdgId);
  const { settings, loading: settingsLoading } = useCommissionManagement();

  const [overview, setOverview] = useState({
    totalAgents: 0,
    activeAgents: 0,
    totalSubAgents: 0,
    totalUsers: 0,
    totalCommissions: 0,
    averageCommissionRate: 0
  });

  useEffect(() => {
    if (agents.length > 0) {
      const activeAgents = agents.filter(a => a.is_active);
      const totalSubAgents = agents.reduce((sum, a) => sum + (a.total_users_created || 0), 0);
      const totalUsers = agents.reduce((sum, a) => sum + (a.total_users_created || 0), 0);
      const totalCommissions = agents.reduce((sum, a) => sum + (a.total_commissions_earned || 0), 0);

      const baseCommissionSetting: unknown = settings.find((s: unknown) => (s.setting_key || s.key) === 'base_user_commission');
      const averageCommissionRate = baseCommissionSetting ? ((baseCommissionSetting.setting_value || baseCommissionSetting.value || 0.2) * 100) : 20;

      setOverview({
        totalAgents: agents.length,
        activeAgents: activeAgents.length,
        totalSubAgents,
        totalUsers,
        totalCommissions,
        averageCommissionRate
      });
    }
  }, [agents, settings]);

  return {
    overview,
    loading: agentsLoading || settingsLoading
  };
}
