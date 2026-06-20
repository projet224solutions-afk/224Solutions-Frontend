/**
 * 👥🛡️ HOOK GESTION AGENTS - VERSION ENTERPRISE ROBUSTE
 * Gestion complète des agents avec protection et récupération automatique
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { circuitBreaker, CircuitState } from '@/lib/circuitBreaker';
import { retryWithBackoff, RetryConfig } from '@/lib/retryWithBackoff';
import { toast } from 'sonner';

export interface Role {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Permission {
  id: string;
  role_id: string;
  action: string;
  allowed: boolean;
  created_at: string;
}

export interface Agent {
  id: string;
  seller_id: string;
  user_id: string;
  role_id: string;
  status: 'active' | 'inactive';
  created_at: string;
  role?: Role;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Configuration robuste
const RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true
};

const MUTATION_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 2,
  initialDelayMs: 1500,
  maxDelayMs: 8000,
  backoffMultiplier: 2,
  jitter: true
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const useAgentManagementRobust = () => {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [circuitState, setCircuitState] = useState<CircuitState>('CLOSED');

  // Caches
  const rolesCacheRef = useRef<CacheEntry<Role[]> | null>(null);
  const permissionsCacheRef = useRef<CacheEntry<Permission[]> | null>(null);
  const agentsCacheRef = useRef<CacheEntry<Agent[]> | null>(null);

  // Circuit breaker name
  const circuitName = 'agent-management';

  // Subscribe to circuit state changes
  useEffect(() => {
    const unsubscribe = circuitBreaker.subscribe(circuitName, (state) => {
      setCircuitState(state);
      if (state === 'OPEN') {
        toast.warning('Service agents temporairement indisponible');
      }
    });
    return unsubscribe;
  }, []);

  // Vérifier le cache
  const isCacheValid = <T,>(cache: CacheEntry<T> | null): boolean => {
    return cache !== null && Date.now() - cache.timestamp < CACHE_TTL;
  };

  // Charger les rôles
  const fetchRoles = useCallback(async (forceRefresh = false): Promise<Role[]> => {
    // Vérifier le cache
    if (!forceRefresh && isCacheValid(rolesCacheRef.current)) {
      return rolesCacheRef.current!.data;
    }

    try {
      const result = await circuitBreaker.execute(circuitName, async () => {
        return await retryWithBackoff(async () => {
          const { data, error } = await supabase
            .from('roles')
            .select('*')
            .order('name');

          if (error) throw error;

          return (data || []).map((role: any) => ({
            id: role.id,
            name: role.name,
            description: role.description,
            created_at: role.created_at
          }));
        }, RETRY_CONFIG);
      });

      if (result) {
        setRoles(result);
        rolesCacheRef.current = { data: result, timestamp: Date.now() };
      }

      return result || [];

    } catch (err: any) {
      console.error('❌ Erreur chargement rôles:', err);
      setError(err.message);

      // Retourner les données du cache même si stale
      if (rolesCacheRef.current) {
        return rolesCacheRef.current.data;
      }
      return [];
    }
  }, []);

  // Charger les permissions
  const fetchPermissions = useCallback(async (forceRefresh = false): Promise<Permission[]> => {
    if (!forceRefresh && isCacheValid(permissionsCacheRef.current)) {
      return permissionsCacheRef.current!.data;
    }

    try {
      const result = await circuitBreaker.execute(circuitName, async () => {
        return await retryWithBackoff(async () => {
          const { data, error } = await supabase
            .from('permissions')
            .select('*');

          if (error) throw error;

          return (data || []).map((permission: any) => ({
            id: permission.id,
            role_id: permission.role_id,
            action: permission.action,
            allowed: permission.allowed,
            created_at: permission.created_at
          }));
        }, RETRY_CONFIG);
      });

      if (result) {
        setPermissions(result);
        permissionsCacheRef.current = { data: result, timestamp: Date.now() };
      }

      return result || [];

    } catch (err: any) {
      console.error('❌ Erreur chargement permissions:', err);
      setError(err.message);

      if (permissionsCacheRef.current) {
        return permissionsCacheRef.current.data;
      }
      return [];
    }
  }, []);

  // Charger les agents
  const fetchAgents = useCallback(async (forceRefresh = false): Promise<Agent[]> => {
    if (!user) return [];

    if (!forceRefresh && isCacheValid(agentsCacheRef.current)) {
      setAgents(agentsCacheRef.current!.data);
      setLoading(false);
      return agentsCacheRef.current!.data;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await circuitBreaker.execute(circuitName, async () => {
        return await retryWithBackoff(async () => {
          const { data, error } = await supabase
            .from('agents')
            .select(`
              *,
              roles (*)
            `)
            .eq('seller_id', user.id)
            .order('created_at', { ascending: false });

          if (error) throw error;

          return (data || []).map((agent: any) => ({
            id: agent.id,
            seller_id: agent.seller_id,
            user_id: agent.user_id,
            role_id: agent.role_id,
            status: agent.status,
            created_at: agent.created_at,
            role: agent.roles ? {
              id: agent.roles.id,
              name: agent.roles.name,
              description: agent.roles.description,
              created_at: agent.roles.created_at
            } : undefined
          }));
        }, RETRY_CONFIG);
      });

      if (result) {
        setAgents(result);
        agentsCacheRef.current = { data: result, timestamp: Date.now() };
      }

      return result || [];

    } catch (err: any) {
      console.error('❌ Erreur chargement agents:', err);
      setError(err.message);

      // Retourner le cache stale si disponible
      if (agentsCacheRef.current) {
        setAgents(agentsCacheRef.current.data);
        toast.warning('Données agents potentiellement obsolètes');
        return agentsCacheRef.current.data;
      }
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Créer un agent
  const createAgent = useCallback(async (agentData: {
    user_id: string;
    role_id: string;
  }): Promise<Agent | null> => {
    if (!user) {
      toast.error('Non authentifié');
      return null;
    }

    setProcessing(true);
    setError(null);

    try {
      const result = await retryWithBackoff(async () => {
        const { data, error } = await supabase
          .from('agents')
          .insert([{
            seller_id: user.id,
            ...agentData
          }])
          .select(`
            *,
            roles (*)
          `)
          .single();

        if (error) throw error;
        return data;
      }, MUTATION_RETRY_CONFIG);

      if (result) {
        const newAgent: Agent = {
          id: result.id,
          seller_id: result.seller_id,
          user_id: result.user_id,
          role_id: result.role_id,
          status: (result.status as 'active' | 'inactive') || 'active',
          created_at: result.created_at,
          role: result.roles ? {
            id: result.roles.id,
            name: result.roles.name,
            description: result.roles.description,
            created_at: result.roles.created_at
          } : undefined
        };

        setAgents(prev => [newAgent, ...prev]);

        // Invalider le cache
        agentsCacheRef.current = null;

        toast.success('Agent créé avec succès');
        return newAgent;
      }

      return null;

    } catch (err: any) {
      console.error('❌ Erreur création agent:', err);
      setError(err.message);
      toast.error(`Erreur: ${err.message}`);
      return null;
    } finally {
      setProcessing(false);
    }
  }, [user]);

  // Mettre à jour le statut d'un agent
  const updateAgentStatus = useCallback(async (
    agentId: string,
    status: 'active' | 'inactive'
  ): Promise<boolean> => {
    setProcessing(true);
    setError(null);

    try {
      await retryWithBackoff(async () => {
        const { error } = await supabase
          .from('agents')
          .update({ status })
          .eq('id', agentId);

        if (error) throw error;
      }, MUTATION_RETRY_CONFIG);

      // Mettre à jour localement
      setAgents(prev => prev.map(agent =>
        agent.id === agentId ? { ...agent, status } : agent
      ));

      // Invalider le cache
      agentsCacheRef.current = null;

      toast.success(`Agent ${status === 'active' ? 'activé' : 'désactivé'}`);
      return true;

    } catch (err: any) {
      console.error('❌ Erreur mise à jour statut:', err);
      setError(err.message);
      toast.error(`Erreur: ${err.message}`);
      return false;
    } finally {
      setProcessing(false);
    }
  }, []);

  // Supprimer un agent
  const deleteAgent = useCallback(async (agentId: string): Promise<boolean> => {
    setProcessing(true);
    setError(null);

    try {
      await retryWithBackoff(async () => {
        const { error } = await supabase
          .from('agents')
          .delete()
          .eq('id', agentId);

        if (error) throw error;
      }, MUTATION_RETRY_CONFIG);

      // Supprimer localement
      setAgents(prev => prev.filter(agent => agent.id !== agentId));

      // Invalider le cache
      agentsCacheRef.current = null;

      toast.success('Agent supprimé');
      return true;

    } catch (err: any) {
      console.error('❌ Erreur suppression agent:', err);
      setError(err.message);
      toast.error(`Erreur: ${err.message}`);
      return false;
    } finally {
      setProcessing(false);
    }
  }, []);

  // Mettre à jour le rôle d'un agent
  const updateAgentRole = useCallback(async (
    agentId: string,
    roleId: string
  ): Promise<boolean> => {
    setProcessing(true);
    setError(null);

    try {
      await retryWithBackoff(async () => {
        const { error } = await supabase
          .from('agents')
          .update({ role_id: roleId })
          .eq('id', agentId);

        if (error) throw error;
      }, MUTATION_RETRY_CONFIG);

      // Trouver le nouveau rôle
      const newRole = roles.find(r => r.id === roleId);

      // Mettre à jour localement
      setAgents(prev => prev.map(agent =>
        agent.id === agentId
          ? { ...agent, role_id: roleId, role: newRole }
          : agent
      ));

      // Invalider le cache
      agentsCacheRef.current = null;

      toast.success('Rôle mis à jour');
      return true;

    } catch (err: any) {
      console.error('❌ Erreur mise à jour rôle:', err);
      setError(err.message);
      toast.error(`Erreur: ${err.message}`);
      return false;
    } finally {
      setProcessing(false);
    }
  }, [roles]);

  // Obtenir les permissions d'un rôle
  const getRolePermissions = useCallback((roleId: string): Permission[] => {
    return permissions.filter(p => p.role_id === roleId);
  }, [permissions]);

  // Vérifier si un agent a une permission spécifique
  const hasPermission = useCallback((agentId: string, action: string): boolean => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return false;

    const rolePerms = getRolePermissions(agent.role_id);
    const permission = rolePerms.find(p => p.action === action);

    return permission?.allowed ?? false;
  }, [agents, getRolePermissions]);

  // Invalider tous les caches
  const invalidateCache = useCallback(() => {
    rolesCacheRef.current = null;
    permissionsCacheRef.current = null;
    agentsCacheRef.current = null;
  }, []);

  // Charger toutes les données
  const loadAllData = useCallback(async (forceRefresh = false) => {
    if (!user) return;

    await Promise.all([
      fetchRoles(forceRefresh),
      fetchPermissions(forceRefresh),
      fetchAgents(forceRefresh)
    ]);
  }, [user, fetchRoles, fetchPermissions, fetchAgents]);

  // Initialisation
  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user, loadAllData]);

  // Actualisation périodique en arrière-plan
  useEffect(() => {
    const interval = setInterval(() => {
      loadAllData(false);
    }, 3 * 60 * 1000); // Toutes les 3 minutes

    return () => clearInterval(interval);
  }, [loadAllData]);

  return {
    // Données
    agents,
    roles,
    permissions,

    // États
    loading,
    error,
    processing,
    circuitState,

    // Actions CRUD
    createAgent,
    updateAgentStatus,
    updateAgentRole,
    deleteAgent,

    // Utilitaires
    getRolePermissions,
    hasPermission,

    // Rafraîchissement
    refetch: () => loadAllData(true),
    invalidateCache,

    // Helpers
    isHealthy: circuitState === 'CLOSED',
    agentCount: agents.length,
    activeAgentCount: agents.filter(a => a.status === 'active').length
  };
};

export default useAgentManagementRobust;
