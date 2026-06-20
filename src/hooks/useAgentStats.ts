/**
 * AGENT STATS HOOK - 224SOLUTIONS
 * Hook pour charger les statistiques de l'agent
 * 🚀 Optimisé: requêtes parallèles + agrégation SQL
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AgentStats {
  totalUsersCreated: number;
  usersThisMonth: number;
  totalCommissions: number;
  commissionsThisMonth: number;
  subAgentsCount: number;
  activeSubAgentsCount: number;
  performance: number;
}

export const useAgentStats = (agentId: string | undefined) => {
  const [stats, setStats] = useState<AgentStats>({
    totalUsersCreated: 0,
    usersThisMonth: 0,
    totalCommissions: 0,
    commissionsThisMonth: 0,
    subAgentsCount: 0,
    activeSubAgentsCount: 0,
    performance: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadStats = useCallback(async () => {
    if (!agentId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const monthStart = startOfMonth.toISOString();

      // 🚀 ALL queries in parallel instead of sequential
      const [subAgentsRes, totalUsersRes, monthUsersRes, totalCommRes, monthCommRes] = await Promise.all([
        // Sub-agents
        supabase
          .from('agents_management')
          .select('id, is_active')
          .eq('parent_agent_id', agentId),
        // Total users created (just count, no data)
        supabase
          .from('agent_created_users')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', agentId),
        // Users this month
        supabase
          .from('agent_created_users')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', agentId)
          .gte('created_at', monthStart),
        // Total commissions (only amount column)
        supabase
          .from('agent_commissions_log')
          .select('amount')
          .eq('agent_id', agentId),
        // This month commissions
        supabase
          .from('agent_commissions_log')
          .select('amount')
          .eq('agent_id', agentId)
          .gte('created_at', monthStart),
      ]);

      if (subAgentsRes.error) throw subAgentsRes.error;

      // Also count sub-agents' created users if any
      const subAgents = subAgentsRes.data || [];
      let subAgentUsersTotal = 0;
      let subAgentUsersMonth = 0;

      if (subAgents.length > 0) {
        const subIds = subAgents.map(sa => sa.id);
        const [subTotalRes, subMonthRes] = await Promise.all([
          supabase.from('agent_created_users').select('id', { count: 'exact', head: true }).in('agent_id', subIds),
          supabase.from('agent_created_users').select('id', { count: 'exact', head: true }).in('agent_id', subIds).gte('created_at', monthStart),
        ]);
        subAgentUsersTotal = subTotalRes.count || 0;
        subAgentUsersMonth = subMonthRes.count || 0;
      }

      const totalCommissions = totalCommRes.data?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
      const commissionsThisMonth = monthCommRes.data?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;

      const totalUsersCreated = (totalUsersRes.count || 0) + subAgentUsersTotal;
      const usersThisMonth = (monthUsersRes.count || 0) + subAgentUsersMonth;

      const monthlyTarget = 10;
      const performance = Math.min(Math.round((usersThisMonth / monthlyTarget) * 100), 100);

      setStats({
        totalUsersCreated,
        usersThisMonth,
        totalCommissions,
        commissionsThisMonth,
        subAgentsCount: subAgents.length,
        activeSubAgentsCount: subAgents.filter(sa => sa.is_active).length,
        performance
      });
    } catch (err: any) {
      console.error('[useAgentStats] Error loading stats:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    loading,
    error,
    refetch: loadStats
  };
};
