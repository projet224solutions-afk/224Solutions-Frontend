import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import { toast } from 'sonner';

export interface VendorAgentPermissions {
  view_dashboard?: boolean;
  view_analytics?: boolean;
  access_pos?: boolean;
  manage_products?: boolean;
  manage_orders?: boolean;
  manage_inventory?: boolean;
  manage_warehouse?: boolean;
  manage_suppliers?: boolean;
  manage_agents?: boolean;
  manage_clients?: boolean;
  manage_prospects?: boolean;
  manage_marketing?: boolean;
  access_wallet?: boolean;
  manage_payments?: boolean;
  manage_payment_links?: boolean;
  manage_expenses?: boolean;
  manage_debts?: boolean;
  access_affiliate?: boolean;
  manage_delivery?: boolean;
  access_support?: boolean;
  access_communication?: boolean;
  view_reports?: boolean;
  access_settings?: boolean;
}

export interface VendorAgent {
  id: string;
  vendor_id: string;
  agent_code: string;
  name: string;
  email: string;
  phone: string;
  access_token: string;
  commission_rate: number;
  permissions: VendorAgentPermissions;
  can_create_sub_agent: boolean;
  is_active: boolean;
  agent_type?: 'commercial' | 'logistique' | 'support' | 'administratif' | 'manager' | 'technique';
  total_users_created: number;
  total_commissions_earned: number;
  created_at: string;
  updated_at: string;
}

export interface VendorAgentStats {
  totalAgents: number;
  activeAgents: number;
  totalUsers: number;
  totalCommissions: number;
}

export const useVendorAgentsData = () => {
  const { user } = useAuth();
  const { vendorId: currentVendorId, loading: vendorLoading } = useCurrentVendor();
  const [agents, setAgents] = useState<VendorAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [realVendorId, setRealVendorId] = useState<string | null>(null);
  const [stats, setStats] = useState<VendorAgentStats>({
    totalAgents: 0,
    activeAgents: 0,
    totalUsers: 0,
    totalCommissions: 0,
  });

  // Récupérer le vrai vendor_id depuis la table vendors
  useEffect(() => {
    const fetchVendorId = async () => {
      if (vendorLoading) return;
      if (currentVendorId) {
        setRealVendorId(currentVendorId);
        return;
      }
      if (!user) return;

      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (vendor?.id) {
        console.log('✅ Real vendor_id found:', vendor.id);
        setRealVendorId(vendor.id);
      } else {
        console.warn('⚠️ No vendor found for user, using user.id as fallback');
        setRealVendorId(user.id);
      }
    };

    fetchVendorId();
  }, [user, currentVendorId, vendorLoading]);

  const loadAgents = useCallback(async () => {
    if (!realVendorId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('vendor_agents')
        .select('*')
        .eq('vendor_id', realVendorId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading vendor agents:', error);
        toast.error('Erreur lors du chargement des agents');
        return;
      }

      // Convert Json permissions to VendorAgentPermissions
      const formattedAgents = (data || []).map(agent => ({
        ...agent,
        permissions: agent.permissions as VendorAgentPermissions
      }));

      setAgents(formattedAgents);

      // Calculate stats
      const totalAgents = data?.length || 0;
      const activeAgents = data?.filter(a => a.is_active).length || 0;
      const totalUsers = data?.reduce((sum, a) => sum + (a.total_users_created || 0), 0) || 0;
      const totalCommissions = data?.reduce((sum, a) => sum + (parseFloat(a.total_commissions_earned?.toString() || '0')), 0) || 0;

      setStats({
        totalAgents,
        activeAgents,
        totalUsers,
        totalCommissions,
      });
    } catch (err) {
      console.error('Error in loadAgents:', err);
      toast.error('Erreur lors du chargement des agents');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, realVendorId]);

  const createAgent = useCallback(async (agentData: {
    name: string;
    email: string;
    phone: string;
    password?: string;
    permissions?: VendorAgentPermissions;
    can_create_sub_agent?: boolean;
    agent_type?: 'commercial' | 'logistique' | 'support' | 'administratif' | 'manager' | 'technique';
  }) => {
    if (!realVendorId) {
      toast.error('Vous devez être connecté');
      return null;
    }

    try {
      // Si un mot de passe est fourni → création avec compte auth via le BACKEND Node
      // (migré depuis l'edge function : atomique + propriété de la boutique vérifiée serveur)
      if (agentData.password && agentData.password.length >= 8) {
        console.log('📧 Création agent avec authentification (backend)');

        const { backendFetch } = await import('@/services/backendApi');
        const resp = await backendFetch<{ agent: any }>('/api/vendors/agents', {
          method: 'POST',
          body: {
            name: agentData.name,
            email: agentData.email,
            phone: agentData.phone,
            password: agentData.password,
            agent_type: agentData.agent_type || 'commercial',
            permissions: agentData.permissions || { view_dashboard: true, access_communication: true },
            can_create_sub_agent: agentData.can_create_sub_agent || false,
          },
        });

        if (!resp.success) {
          toast.error(resp.error || 'Erreur lors de la création de l\'agent');
          return null;
        }

        toast.success('Agent créé avec authentification');
        await loadAgents();
        return resp.data?.agent;
      }

      // Création sans authentification (mode legacy avec token)
      const timestamp = Date.now().toString(36).toUpperCase();
      const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      const agentCode = `VAG${timestamp}${randomPart}`;
      const accessToken = crypto.randomUUID();

      const insertData: any = {
        vendor_id: realVendorId,
        agent_code: agentCode,
        access_token: accessToken,
        name: agentData.name,
        email: agentData.email,
        phone: agentData.phone,
        permissions: agentData.permissions || { view_dashboard: true, access_communication: true },
        can_create_sub_agent: agentData.can_create_sub_agent || false,
        agent_type: agentData.agent_type || 'commercial',
        is_active: true,
      };

      const { data, error } = await supabase
        .from('vendor_agents')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating vendor agent:', error);
        toast.error('Erreur lors de la création de l\'agent');
        return null;
      }

      toast.success('Agent créé avec succès');
      await loadAgents();
      return data;
    } catch (err) {
      console.error('Error in createAgent:', err);
      toast.error('Erreur lors de la création de l\'agent');
      return null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, realVendorId, loadAgents]);

  const updateAgent = useCallback(async (agentId: string, updates: Partial<VendorAgent> & { new_email?: string }) => {
    if (!realVendorId) {
      toast.error('Vous devez être connecté');
      return;
    }

    try {
      // Si l'email est modifié, utiliser l'edge function pour synchroniser auth
      if (updates.email || updates.new_email) {
        const newEmail = updates.new_email || updates.email;
        console.log('📧 Mise à jour email agent via backend Node');

        const { backendFetch } = await import('@/services/backendApi');
        const resp = await backendFetch<any>('/api/vendors/agents/update-email', {
          method: 'POST',
          body: {
            agent_id: agentId,
            new_email: newEmail,
          }
        });

        if (!resp.success) {
          toast.error(resp.error || 'Erreur lors de la modification de l\'email');
          return;
        }

        // Mettre à jour les autres champs si nécessaire
        const { email, new_email, ...otherUpdates } = updates;
        if (Object.keys(otherUpdates).length > 0) {
          const updatePayload: any = { ...otherUpdates };
          await supabase
            .from('vendor_agents')
            .update(updatePayload)
            .eq('id', agentId)
            .eq('vendor_id', realVendorId);
        }

        toast.success('Agent modifié (email synchronisé)');
        await loadAgents();
        return;
      }

      // Mise à jour sans changement d'email
      const updatePayload: any = { ...updates };

      const { error } = await supabase
        .from('vendor_agents')
        .update(updatePayload)
        .eq('id', agentId)
        .eq('vendor_id', realVendorId);

      if (error) {
        console.error('Error updating vendor agent:', error);
        toast.error('Erreur lors de la modification de l\'agent');
        return;
      }

      toast.success('Agent modifié avec succès');
      await loadAgents();
    } catch (err) {
      console.error('Error in updateAgent:', err);
      toast.error('Erreur lors de la modification de l\'agent');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, realVendorId, loadAgents]);

  const deleteAgent = useCallback(async (agentId: string) => {
    if (!realVendorId) {
      toast.error('Vous devez être connecté');
      return;
    }

    try {
      // Hard delete: completely remove the agent
      const { error } = await supabase
        .from('vendor_agents')
        .delete()
        .eq('id', agentId)
        .eq('vendor_id', realVendorId);

      if (error) {
        console.error('Error deleting vendor agent:', error);
        toast.error('Erreur lors de la suppression de l\'agent');
        return;
      }

      toast.success('Agent supprimé définitivement');
      await loadAgents();
    } catch (err) {
      console.error('Error in deleteAgent:', err);
      toast.error('Erreur lors de la suppression de l\'agent');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, realVendorId, loadAgents]);

  const toggleAgentStatus = useCallback(async (agentId: string, isActive: boolean) => {
    if (!realVendorId) {
      toast.error('Vous devez être connecté');
      return;
    }

    try {
      const { error } = await supabase
        .from('vendor_agents')
        .update({ is_active: isActive })
        .eq('id', agentId)
        .eq('vendor_id', realVendorId);

      if (error) {
        console.error('Error toggling agent status:', error);
        toast.error('Erreur lors du changement de statut');
        return;
      }

      toast.success(`Agent ${isActive ? 'activé' : 'désactivé'} avec succès`);
      await loadAgents();
    } catch (err) {
      console.error('Error in toggleAgentStatus:', err);
      toast.error('Erreur lors du changement de statut');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, realVendorId, loadAgents]);

  useEffect(() => {
    if (realVendorId) {
      loadAgents();
    }
  }, [realVendorId, loadAgents]);

  return {
    agents,
    loading,
    stats,
    createAgent,
    updateAgent,
    deleteAgent,
    toggleAgentStatus,
    refetch: loadAgents,
  };
};
