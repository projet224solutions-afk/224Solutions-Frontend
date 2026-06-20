import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { PermissionKey, AVAILABLE_PERMISSIONS } from './useAgentPermissions';
import {
  hasPermissionWithAliases,
  hasAnyPermissionWithAliases,
  hasAllPermissionsWithAliases,
} from '@/lib/agent-permissions';

export interface CurrentUserPermissions {
  permissions: Record<string, boolean>;
  loading: boolean;
  isAgent: boolean;
  isPDG: boolean;
  agentId: string | null;
  hasPermission: (key: PermissionKey | string) => boolean;
  hasAnyPermission: (keys: (PermissionKey | string)[]) => boolean;
  hasAllPermissions: (keys: (PermissionKey | string)[]) => boolean;
  reload: () => Promise<void>;
}

/**
 * Hook pour obtenir les permissions de l'utilisateur courant
 * - Si PDG/CEO/Admin: accès total (toutes permissions = true)
 * - Si Agent: permissions selon sa configuration dans agent_permissions
 * - Autres rôles: pas d'accès aux fonctionnalités PDG
 */
export const useCurrentUserPermissions = (): CurrentUserPermissions => {
  const { user, profile } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [agentId, setAgentId] = useState<string | null>(null);
  // Identifiant unique par instance du hook : évite la collision de canal realtime
  // quand le hook est monté à plusieurs endroits (ex: PDGNavigation + PDG224Solutions).
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));

  // Déterminer le type d'utilisateur
  const isPDG = useMemo(() => {
    const role = (profile?.role || '').toString().toLowerCase();
    // PDG et CEO sont équivalents dans toute l'app (voir mémoire projet)
    return role === 'ceo' || role === 'admin' || role === 'pdg';
  }, [profile?.role]);

  const isAgent = useMemo(() => {
    const role = (profile?.role || '').toString().toLowerCase();
    return role === 'agent';
  }, [profile?.role]);

  // Charger les permissions
  const loadPermissions = useCallback(async () => {
    if (!user || !profile) {
      setLoading(false);
      return;
    }

    // PDG/CEO/Admin a accès à tout - pas besoin de charger les permissions
    if (isPDG) {
      // Créer un objet avec toutes les permissions à true
      const allPermissions: Record<string, boolean> = {};
      Object.keys(AVAILABLE_PERMISSIONS).forEach(key => {
        allPermissions[key] = true;
      });
      setPermissions(allPermissions);
      setLoading(false);
      return;
    }

    // Si ce n'est pas un agent, pas de permissions PDG
    if (!isAgent) {
      setPermissions({});
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Trouver l'agent correspondant à l'utilisateur
      const { data: agent, error: agentError } = await supabase
        .from('agents_management')
        .select('id, is_active')
        .eq('user_id', user.id)
        .maybeSingle();

      if (agentError) {
        console.error('Erreur recherche agent:', agentError);
        setPermissions({});
        setLoading(false);
        return;
      }

      if (!agent) {
        console.log('Utilisateur n\'est pas un agent enregistré');
        setPermissions({});
        setLoading(false);
        return;
      }

      if (!agent.is_active) {
        console.log('Agent suspendu - pas de permissions');
        setPermissions({});
        setLoading(false);
        return;
      }

      setAgentId(agent.id);

      // Charger les permissions de l'agent via RPC
      const { data, error } = await supabase
        .rpc('get_agent_permissions' as any, {
          p_agent_id: agent.id
        });

      if (error) {
        console.error('Erreur RPC get_agent_permissions:', error);
        // Fallback: charger directement depuis la table
        const { data: directPerms, error: directError } = await supabase
          .from('agent_permissions')
          .select('permission_key, permission_value')
          .eq('agent_id', agent.id);

        if (directError) {
          console.error('Erreur chargement direct permissions:', directError);
          setPermissions({});
        } else {
          const permsObj: Record<string, boolean> = {};
          directPerms?.forEach(p => {
            permsObj[p.permission_key] = p.permission_value;
          });
          setPermissions(permsObj);
        }
      } else {
        setPermissions((data as Record<string, boolean>) || {});
      }
    } catch (error) {
      console.error('Erreur chargement permissions utilisateur:', error);
      setPermissions({});
    } finally {
      setLoading(false);
    }
  }, [user, profile, isPDG, isAgent]);

  // Vérifier une permission spécifique
  const hasPermission = useCallback((permissionKey: PermissionKey | string): boolean => {
    // PDG/CEO/Admin a toutes les permissions
    if (isPDG) return true;

    return hasPermissionWithAliases(permissions, permissionKey);
  }, [permissions, isPDG]);

  // Vérifier si l'utilisateur a au moins une des permissions
  const hasAnyPermission = useCallback((keys: (PermissionKey | string)[]): boolean => {
    if (isPDG) return true;
    return hasAnyPermissionWithAliases(permissions, keys as string[]);
  }, [permissions, isPDG]);

  // Vérifier si l'utilisateur a toutes les permissions
  const hasAllPermissions = useCallback((keys: (PermissionKey | string)[]): boolean => {
    if (isPDG) return true;
    return hasAllPermissionsWithAliases(permissions, keys as string[]);
  }, [permissions, isPDG]);

  // Charger les permissions au montage et lors des changements d'utilisateur
  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  // Écouter les changements en temps réel si c'est un agent
  useEffect(() => {
    if (!agentId || isPDG) return;

    const channel = supabase
      .channel(`current-user-permissions-${agentId}-${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_permissions',
          filter: `agent_id=eq.${agentId}`
        },
        (payload) => {
          console.log('Permission utilisateur mise à jour:', payload);
          loadPermissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId, loadPermissions, isPDG]);

  return {
    permissions,
    loading,
    isAgent,
    isPDG,
    agentId,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    reload: loadPermissions
  };
};

// Export des permissions disponibles pour référence
export { AVAILABLE_PERMISSIONS, type PermissionKey } from './useAgentPermissions';
