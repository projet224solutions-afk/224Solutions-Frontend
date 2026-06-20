import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getPermissionCandidates } from '@/lib/agent-permissions';

/**
 * Hook pour protéger les routes en vérifiant les permissions d'un agent
 * @param requiredPermission - La permission requise pour accéder à la route
 * @param redirectTo - La route vers laquelle rediriger si l'accès est refusé (par défaut: '/pdg')
 */
export const usePermissionGuard = (
  requiredPermission: string,
  redirectTo: string = '/pdg'
) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      if (!user) {
        setHasAccess(false);
        setLoading(false);
        navigate('/auth');
        return;
      }

      try {
        setLoading(true);

        // Récupérer l'agent connecté
        const { data: agent, error: agentError } = await supabase
          .from('agents_management')
          .select('id, is_active')
          .eq('user_id', user.id)
          .single();

        if (agentError || !agent) {
          console.log('Utilisateur n\'est pas un agent');

          // Autoriser uniquement les rôles globaux PDG/Admin/CEO.
          const role = (profile?.role || '').toString().toLowerCase();
          const isGlobalManager = role === 'pdg' || role === 'ceo' || role === 'admin';

          setHasAccess(isGlobalManager);
          setLoading(false);
          if (!isGlobalManager) {
            navigate(redirectTo);
          }
          return;
        }

        if (!agent.is_active) {
          toast.error('Votre compte agent est suspendu');
          setHasAccess(false);
          setLoading(false);
          navigate(redirectTo);
          return;
        }

        // Vérifier la permission via RPC
        const permissionCandidates = getPermissionCandidates(requiredPermission);
        let hasPermission = false;

        for (const candidate of permissionCandidates) {
          const { data: permission, error: permError } = await supabase
            .rpc('check_agent_permission' as any, {
              p_agent_id: agent.id,
              p_permission_key: candidate,
            });

          if (permError) {
            console.warn('Erreur vérification candidate permission:', candidate, permError);
            continue;
          }

          if (permission) {
            hasPermission = true;
            break;
          }
        }

        if (!hasPermission) {
          toast.error('Permission refusée pour cet agent');
          setHasAccess(false);
          navigate(redirectTo);
        } else {
          setHasAccess(true);
        }
      } catch (error: any) {
        console.error('Erreur vérification permission:', error);
        toast.error('Erreur lors de la vérification des permissions');
        setHasAccess(false);
        navigate(redirectTo);
      } finally {
        setLoading(false);
      }
    };

    checkPermission();
  }, [user, profile?.role, requiredPermission, navigate, redirectTo]);

  return { hasAccess, loading };
};
