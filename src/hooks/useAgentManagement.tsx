import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

export const useAgentManagement = () => {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name');

      if (error) throw error;
      setRoles((data as unknown[])?.map((role: unknown) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        created_at: role.created_at
      })) || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('*');

      if (error) throw error;
      setPermissions((data as unknown[])?.map((permission: unknown) => ({
        id: permission.id,
        role_id: permission.role_id,
        action: permission.action,
        allowed: permission.allowed,
        created_at: permission.created_at
      })) || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchAgents = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('agents')
        .select(`
          *,
          roles (*)
        `)
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
        setAgents((data as unknown[])?.map((agent: unknown) => ({
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
        })) || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createAgent = async (agentData: {
    user_id: string;
    role_id: string;
  }) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const { data, error } = await supabase
        .from('agents')
        .insert([{
          seller_id: user.id,
          ...agentData
        }])
        .select()
        .single();

      if (error) throw error;
      await fetchAgents(); // Refresh the list
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateAgentStatus = async (agentId: string, status: 'active' | 'inactive') => {
    try {
      const { error } = await supabase
        .from('agents')
        .update({ status })
        .eq('id', agentId);

      if (error) throw error;
      await fetchAgents(); // Refresh the list
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteAgent = async (agentId: string) => {
    try {
      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', agentId);

      if (error) throw error;
      await fetchAgents(); // Refresh the list
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const getRolePermissions = (roleId: string) => {
    return permissions.filter(p => p.role_id === roleId);
  };

  useEffect(() => {
    if (user) {
      Promise.all([
        fetchRoles(),
        fetchPermissions(),
        fetchAgents()
      ]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return {
    agents,
    roles,
    permissions,
    loading,
    error,
    createAgent,
    updateAgentStatus,
    deleteAgent,
    getRolePermissions,
    refetch: fetchAgents
  };
};