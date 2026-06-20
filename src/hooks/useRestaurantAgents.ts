/**
 * Hook : gestion des AGENTS de restaurant par le restaurateur (propriétaire du service).
 * Calqué sur useVendorAgentsData, adapté au professional_service_id + permissions par module.
 * Tout passe par le backend `/api/v2/restaurant/agents` (compte auth créé serveur, propriété vérifiée).
 */
import { useState, useCallback, useEffect } from 'react';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';

export interface RestaurantAgentPermissions {
  manage_orders?: boolean;
  access_pos?: boolean;
  manage_menu?: boolean;
  manage_tables?: boolean;
  manage_reservations?: boolean;
  manage_promotions?: boolean;
  view_analytics?: boolean;
  manage_settings?: boolean;
  manage_media?: boolean;
}

export interface RestaurantAgent {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  permissions: RestaurantAgentPermissions;
  is_active: boolean;
  created_at: string;
}

export const RESTAURANT_AGENT_MODULES: { key: keyof RestaurantAgentPermissions; label: string }[] = [
  { key: 'manage_orders', label: 'Commandes' },
  { key: 'access_pos', label: 'Caisse (POS)' },
  { key: 'manage_menu', label: 'Menu' },
  { key: 'manage_tables', label: 'Tables' },
  { key: 'manage_reservations', label: 'Réservations' },
  { key: 'manage_promotions', label: 'Promotions' },
  { key: 'view_analytics', label: 'Analytics' },
  { key: 'manage_settings', label: 'Configuration' },
  { key: 'manage_media', label: 'Galerie médias' },
];

export function useRestaurantAgents(serviceId: string) {
  const [agents, setAgents] = useState<RestaurantAgent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await backendFetch<any>(`/api/v2/restaurant/agents?service_id=${encodeURIComponent(serviceId)}`, { method: 'GET' });
      if (res.success) setAgents(((res as any).data ?? []) as RestaurantAgent[]);
      else toast.error((res as any).error || 'Chargement des agents impossible');
    } catch { toast.error('Chargement des agents impossible'); }
    finally { setLoading(false); }
  }, [serviceId]);

  useEffect(() => { void load(); }, [load]);

  const createAgent = useCallback(async (input: {
    name: string; email: string; phone?: string; password: string; permissions: RestaurantAgentPermissions;
  }): Promise<boolean> => {
    const res = await backendFetch<any>('/api/v2/restaurant/agents', {
      method: 'POST',
      body: { professional_service_id: serviceId, ...input },
    });
    if (!res.success) { toast.error((res as any).error || 'Création impossible'); return false; }
    toast.success('Agent créé');
    await load();
    return true;
  }, [serviceId, load]);

  const updateAgent = useCallback(async (id: string, patch: Partial<Pick<RestaurantAgent, 'permissions' | 'is_active' | 'name' | 'phone'>>) => {
    const res = await backendFetch<any>(`/api/v2/restaurant/agents/${id}`, { method: 'PATCH', body: patch });
    if (!res.success) { toast.error((res as any).error || 'Mise à jour impossible'); return; }
    await load();
  }, [load]);

  const deleteAgent = useCallback(async (id: string) => {
    const res = await backendFetch<any>(`/api/v2/restaurant/agents/${id}`, { method: 'DELETE' });
    if (!res.success) { toast.error((res as any).error || 'Suppression impossible'); return; }
    toast.success('Agent supprimé');
    await load();
  }, [load]);

  return { agents, loading, reload: load, createAgent, updateAgent, deleteAgent };
}
