/**
 * Hook unifié pour les permissions d'agent
 * Combine les permissions de la table agent_permissions avec les permissions legacy du JSON
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AVAILABLE_PERMISSIONS, PermissionKey } from './useAgentPermissions';
import { hasPermissionWithAliases } from '@/lib/agent-permissions';

export interface UnifiedAgentPermissions {
  permissions: Record<string, boolean>;
  loading: boolean;
  hasPermission: (key: string) => boolean;
  reload: () => Promise<void>;
}

/**
 * Hook pour charger et vérifier les permissions d'un agent
 * @param agentId - L'ID de l'agent
 */
export function useAgentPermissionsUnified(agentId: string | undefined): UnifiedAgentPermissions {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  // Suffixe unique par instance : évite la collision de canal realtime si le hook
  // est monté à plusieurs endroits avec le même agentId.
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));

  const loadPermissions = useCallback(async () => {
    if (!agentId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Étape 1: RPC get_agent_permissions (SECURITY DEFINER, accessible anon + authenticated)
      // Depuis la migration 20260507200000, cette RPC fusionne déjà agent_permissions + legacy column
      let permissionsFromRpc: Record<string, boolean> | null = null;
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_agent_permissions', {
          p_agent_id: agentId,
        });

        if (!rpcError && rpcData && typeof rpcData === 'object') {
          permissionsFromRpc = rpcData as Record<string, boolean>;
        } else if (rpcError) {
          console.warn('[Permissions] RPC get_agent_permissions error, trying fallbacks:', rpcError.message);
        }
      } catch (e) {
        console.warn('[Permissions] RPC exception, trying fallbacks:', e);
      }

      // Étape 2: Fallback SELECT direct sur agent_permissions
      // (fonctionne si la policy "anon_read_agent_permissions" est active)
      let permissionsFromTable: Record<string, boolean> = {};
      if (!permissionsFromRpc) {
        const { data } = await supabase
          .from('agent_permissions')
          .select('permission_key, permission_value')
          .eq('agent_id', agentId);

        if (data && data.length > 0) {
          (data as Array<{ permission_key: string; permission_value: boolean | null }>)
            .forEach(p => {
              permissionsFromTable[p.permission_key] = p.permission_value ?? false;
            });
        }
      }

      // Étape 3: Colonne legacy agents_management.permissions (toujours lue comme filet de sécurité)
      const { data: agentRow } = await supabase
        .from('agents_management')
        .select('permissions')
        .eq('id', agentId)
        .single();

      const legacyPerms: Record<string, boolean> = {};
      if (agentRow?.permissions) {
        const raw = agentRow.permissions as any;
        if (Array.isArray(raw)) {
          // Format tableau: ["view_finance", "manage_users"]
          raw.forEach((perm: string) => { legacyPerms[perm] = true; });
        } else if (typeof raw === 'object') {
          // Format objet: {view_finance: true, manage_users: false}
          Object.entries(raw).forEach(([k, v]) => { legacyPerms[k] = Boolean(v); });
        }
      }

      // Fusion OR: une permission est vraie si N'IMPORTE QUELLE source dit true.
      // Un false dans agent_permissions ne révoque PAS un true de la colonne legacy.
      // Cela évite que des entrées false "périmées" dans agent_permissions masquent
      // les permissions accordées via agents_management.permissions.
      const allSources = [legacyPerms, permissionsFromTable, permissionsFromRpc ?? {}];
      const allKeys = new Set(allSources.flatMap(s => Object.keys(s)));
      const merged: Record<string, boolean> = {};
      allKeys.forEach(key => {
        merged[key] = allSources.some(s => s[key] === true);
      });

      setPermissions(merged);
    } catch (error) {
      console.error('[Permissions] Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  /**
   * Vérifie si l'agent a une permission donnée
   * Implémente l'héritage: manage_* implique automatiquement view_*
   */
  const hasPermission = useCallback((key: string): boolean => {
    return hasPermissionWithAliases(permissions, key);
  }, [permissions]);

  // Charger au montage et écouter les changements
  useEffect(() => {
    if (!agentId) return;

    loadPermissions();

    /**
     * IMPORTANT:
     * Selon la session (agent public via token, sans auth), le realtime sur agent_permissions
     * peut ne pas être fiable (ou filtré). On écoute donc aussi agents_management (id) et
     * on recharge les permissions à chaque update.
     */
    const channelAgentPermissions = supabase
      .channel(`agent-permissions-unified-${agentId}-${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_permissions',
          filter: `agent_id=eq.${agentId}`,
        },
        () => {
          console.log('📋 [Permissions] Changement agent_permissions → reload');
          loadPermissions();
        }
      )
      .subscribe();

    const channelAgentRow = supabase
      .channel(`agent-row-unified-${agentId}-${instanceIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agents_management',
          filter: `id=eq.${agentId}`,
        },
        () => {
          console.log('📋 [Permissions] Changement agents_management → reload');
          loadPermissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelAgentPermissions);
      supabase.removeChannel(channelAgentRow);
    };
  }, [agentId, loadPermissions]);

  return {
    permissions,
    loading,
    hasPermission,
    reload: loadPermissions
  };
}

// Re-export pour compatibilité
export { AVAILABLE_PERMISSIONS, type PermissionKey };
