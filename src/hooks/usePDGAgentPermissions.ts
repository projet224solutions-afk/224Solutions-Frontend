import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AVAILABLE_PERMISSIONS, PermissionKey } from './useAgentPermissions';
import { PERMISSION_CATEGORIES } from '@/constants/agentPermissionCategories';
import {
  hasPermissionWithAliases,
  hasAnyPermissionWithAliases,
  hasAllPermissionsWithAliases,
} from '@/lib/agent-permissions';

export interface PermissionGrant {
  id: string;
  permission_key: string;
  permission_name: string;
  category: string;
  is_active: boolean;
  expires_at: string | null;
  risk_level: string;
  agent_id?: string;
}

export interface AgentPermission {
  permission_key: string;
  permission_name: string;
  description: string;
  category: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  requires_2fa: boolean;
  requires_audit: boolean;
}

// Generate permission catalog from constants
function generatePermissionCatalog(): AgentPermission[] {
  const catalog: AgentPermission[] = [];

  for (const cat of PERMISSION_CATEGORIES) {
    for (const permKey of cat.permissions) {
      catalog.push({
        permission_key: permKey,
        permission_name: AVAILABLE_PERMISSIONS[permKey] || permKey,
        description: AVAILABLE_PERMISSIONS[permKey] || permKey,
        category: cat.label,
        risk_level: permKey.startsWith('manage_') ? 'high' : 'low',
        requires_2fa: permKey.startsWith('manage_'),
        requires_audit: true
      });
    }
  }

  return catalog;
}

export function usePDGAgentPermissions(pdgId: string | null) {
  const [permissions, setPermissions] = useState<PermissionGrant[]>([]);
  const [permissionCatalog] = useState<AgentPermission[]>(generatePermissionCatalog());
  const [loading, setLoading] = useState(false);

  // Charger les permissions déléguées pour un PDG (depuis agent_permissions table)
  const loadPermissions = useCallback(async () => {
    if (!pdgId) return;

    setLoading(true);
    try {
      // Get all agents for this PDG
      const { data: agents, error: agentsError } = await supabase
        .from('agents_management')
        .select('id, name')
        .eq('pdg_id', pdgId);

      if (agentsError) throw agentsError;

      // Get permissions for each agent
      const allPermissions: PermissionGrant[] = [];

      for (const agent of agents || []) {
        const { data: agentPerms, error: permsError } = await supabase
          .from('agent_permissions')
          .select('*')
          .eq('agent_id', agent.id);

        if (!permsError && agentPerms) {
          for (const perm of agentPerms) {
            if (perm.permission_value) {
              const catInfo = PERMISSION_CATEGORIES.find(c =>
                c.permissions.includes(perm.permission_key as PermissionKey)
              );

              allPermissions.push({
                id: perm.id,
                permission_key: perm.permission_key,
                permission_name: AVAILABLE_PERMISSIONS[perm.permission_key as PermissionKey] || perm.permission_key,
                category: catInfo?.label || 'Autre',
                is_active: perm.permission_value || false,
                expires_at: null,
                risk_level: perm.permission_key.startsWith('manage_') ? 'high' : 'low',
                agent_id: agent.id
              });
            }
          }
        }
      }

      setPermissions(allPermissions);
    } catch (error) {
      console.error('Erreur chargement permissions:', error);
      toast.error('Erreur lors du chargement des permissions');
    } finally {
      setLoading(false);
    }
  }, [pdgId]);

  // Accorder une permission à un agent
  const grantPermission = useCallback(async (
    agentId: string,
    permissionKey: string,
    _expiresInDays?: number,
    _scope?: any
  ): Promise<boolean> => {
    try {
      // Check if permission already exists
      const { data: existing } = await supabase
        .from('agent_permissions')
        .select('id')
        .eq('agent_id', agentId)
        .eq('permission_key', permissionKey)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('agent_permissions')
          .update({ permission_value: true, updated_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('agent_permissions')
          .insert({
            agent_id: agentId,
            permission_key: permissionKey,
            permission_value: true
          });

        if (error) throw error;
      }

      toast.success('Permission accordée avec succès');
      await loadPermissions();
      return true;
    } catch (error) {
      console.error('Erreur octroi permission:', error);
      toast.error('Erreur lors de l\'octroi de la permission');
      return false;
    }
  }, [loadPermissions]);

  // Révoquer une permission
  const revokePermission = useCallback(async (
    agentId: string,
    permissionKey: string,
    _reason?: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('agent_permissions')
        .update({ permission_value: false, updated_at: new Date().toISOString() })
        .eq('agent_id', agentId)
        .eq('permission_key', permissionKey);

      if (error) throw error;

      toast.success('Permission révoquée avec succès');
      await loadPermissions();
      return true;
    } catch (error) {
      console.error('Erreur révocation permission:', error);
      toast.error('Erreur lors de la révocation de la permission');
      return false;
    }
  }, [loadPermissions]);

  // Vérifier si un agent a une permission
  const checkAgentPermission = useCallback(async (
    agentId: string,
    permissionKey: string
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('agent_permissions')
        .select('permission_value')
        .eq('agent_id', agentId)
        .eq('permission_key', permissionKey)
        .single();

      if (error) return false;
      return data?.permission_value || false;
    } catch (error) {
      console.error('Erreur vérification permission:', error);
      return false;
    }
  }, []);

  return {
    permissions,
    permissionCatalog,
    loading,
    loadPermissions,
    grantPermission,
    revokePermission,
    checkAgentPermission
  };
}

// Hook pour vérifier les permissions de l'agent actuel
export function useCurrentAgentPermissions() {
  const [agentPermissions, setAgentPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Obtenir l'agent associé à cet utilisateur
        const { data: agent } = await supabase
          .from('agents_management')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (!agent) {
          setLoading(false);
          return;
        }

        // Charger les permissions actives
        const { data: permissions } = await supabase
          .from('agent_permissions')
          .select('permission_key, permission_value')
          .eq('agent_id', agent.id);

        const permSet = new Set(
          permissions?.filter(p => p.permission_value).map(p => p.permission_key) || []
        );
        setAgentPermissions(permSet);
      } catch (error) {
        console.error('Erreur chargement permissions agent:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, []);

  const hasPermission = (permissionKey: string): boolean => {
    return hasPermissionWithAliases(agentPermissions, permissionKey);
  };

  const hasAnyPermission = (keys: string[]): boolean => {
    return hasAnyPermissionWithAliases(agentPermissions, keys);
  };

  const hasAllPermissions = (keys: string[]): boolean => {
    return hasAllPermissionsWithAliases(agentPermissions, keys);
  };

  return {
    agentPermissions,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  };
}

// Alias pour compatibilité
export const useAgentPermissions = useCurrentAgentPermissions;
