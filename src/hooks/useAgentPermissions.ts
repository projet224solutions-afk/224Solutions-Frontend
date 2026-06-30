import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AgentPermission {
  id: string;
  agent_id: string;
  permission_key: string;
  permission_value: boolean;
  created_at: string;
  updated_at: string;
}

export const AVAILABLE_PERMISSIONS = {
  // ==================== FINANCE ====================
  view_finance: 'Voir Finance & Revenus',
  manage_finance: 'Gérer Finance & Revenus',
  view_banking: 'Voir Système Bancaire',
  manage_banking: 'Gérer Système Bancaire',
  manage_wallet_transactions: 'Gérer les transactions wallet',
  access_pdg_wallet: 'Accès à la caisse PDG (Mon Portefeuille)',
  view_platform_surveillance: 'Voir Surveillance Plateforme',
  view_financial_module: 'Accès au module financier',
  manage_commissions: 'Accès au module de commissions',
  view_payments: 'Voir les paiements internes',
  manage_payments: 'Gérer les paiements internes',

  // ==================== GESTION ====================
  view_users: 'Voir les utilisateurs',
  manage_users: 'Gérer les utilisateurs',
  create_users: 'Créer des utilisateurs',
  view_shareholders: 'Voir les Actionnaires',
  manage_shareholders: 'Gérer les Actionnaires',
  view_products: 'Voir les produits',
  manage_products: 'Gérer les produits',
  view_transfer_fees: 'Voir les frais de transfert',
  manage_transfer_fees: 'Gérer les frais de transfert',
  view_kyc: 'Voir la gestion KYC',
  manage_kyc: 'Gérer le KYC (valider/rejeter)',
  view_service_subscriptions: 'Voir les abonnements services',
  manage_service_subscriptions: 'Gérer les abonnements services',
  view_service_plans: 'Voir les forfaits services',
  manage_service_plans: 'Gérer les forfaits des 15 types de services',

  // ==================== SERVICES PROFESSIONNELS (15 types) ====================
  view_beauty_services: 'Voir services Beauté/Coiffure',
  manage_beauty_services: 'Gérer services Beauté/Coiffure',
  view_fitness_services: 'Voir services Fitness/Sport',
  manage_fitness_services: 'Gérer services Fitness/Sport',
  view_restaurant_services: 'Voir services Restaurant',
  manage_restaurant_services: 'Gérer services Restaurant',
  view_health_services: 'Voir services Santé',
  manage_health_services: 'Gérer services Santé',
  view_education_services: 'Voir services Éducation/Formation',
  manage_education_services: 'Gérer services Éducation/Formation',
  view_transport_services: 'Voir services Transport',
  manage_transport_services: 'Gérer services Transport',
  view_hotel_services: 'Voir services Hôtellerie',
  manage_hotel_services: 'Gérer services Hôtellerie',
  view_event_services: 'Voir services Événementiel',
  manage_event_services: 'Gérer services Événementiel',
  view_repair_services: 'Voir services Réparation/Maintenance',
  manage_repair_services: 'Gérer services Réparation/Maintenance',
  view_legal_services: 'Voir services Juridique',
  manage_legal_services: 'Gérer services Juridique',
  view_finance_services: 'Voir services Financiers',
  manage_finance_services: 'Gérer services Financiers',
  view_tech_services: 'Voir services Tech/IT',
  manage_tech_services: 'Gérer services Tech/IT',
  view_cleaning_services: 'Voir services Nettoyage',
  manage_cleaning_services: 'Gérer services Nettoyage',
  view_real_estate_services: 'Voir services Immobilier',
  manage_real_estate_services: 'Gérer services Immobilier',
  view_agriculture_services: 'Voir services Agriculture',
  manage_agriculture_services: 'Gérer services Agriculture',

  // ==================== OPÉRATIONS ====================
  view_agents: 'Voir les agents',
  manage_agents: 'Gérer les agents',
  create_sub_agents: 'Créer des sous-agents',
  view_syndicat: 'Voir les bureaux syndicaux',
  manage_syndicat: 'Gérer les bureaux syndicaux',
  view_bureau_monitoring: 'Voir le monitoring bureaux',
  manage_bureau_monitoring: 'Gérer le monitoring bureaux',
  view_driver_subscriptions: 'Voir les abonnements chauffeurs',
  manage_driver_subscriptions: 'Gérer les abonnements chauffeurs',
  view_stolen_vehicles: 'Voir les motos volées',
  manage_stolen_vehicles: 'Gérer les motos volées',
  view_orders: 'Voir les commandes',
  manage_orders: 'Gérer les commandes',
  view_support: 'Voir le support technique',   // ✅ permission dédiée (séparée de view_orders)
  view_vendors: 'Voir les vendeurs',
  manage_vendors: 'Gérer les vendeurs',
  view_vendor_kyc: 'Voir la vérification KYC vendeurs',
  manage_vendor_kyc: 'Gérer la vérification KYC vendeurs',
  view_vendor_certification: 'Voir la certification vendeurs',
  manage_vendor_certification: 'Gérer la certification vendeurs',
  view_drivers: 'Voir les livreurs',
  manage_drivers: 'Gérer les livreurs',
  view_quotes_invoices: 'Voir devis & factures',
  manage_quotes_invoices: 'Gérer devis & factures',
  access_communication: 'Accès communication',
  manage_communication: 'Gérer la communication',
  view_broadcasts: 'Voir les diffusions globales',
  manage_broadcasts: 'Gérer les diffusions globales',
  view_agent_wallet_audit: 'Voir audit wallet agents',
  manage_agent_wallet_audit: 'Gérer audit wallet agents',

  // ==================== SYSTÈME ====================
  view_security: 'Voir la sécurité',
  manage_security: 'Gérer la sécurité',
  view_id_normalization: 'Voir l\'audit ID',
  manage_id_normalization: 'Gérer l\'audit ID',
  view_bug_bounty: 'Voir Bug Bounty',
  manage_bug_bounty: 'Gérer Bug Bounty',
  view_config: 'Voir la configuration',
  manage_config: 'Gérer la configuration',
  view_maintenance: 'Voir la maintenance',
  manage_maintenance: 'Gérer la maintenance',
  view_api: 'Voir les API',
  manage_api: 'Gérer les API',
  view_debug: 'Voir Debug & Surveillance',
  manage_debug: 'Gérer Debug & Surveillance',

  // ==================== INTELLIGENCE ====================
  access_ai_assistant: 'Accès Assistant IA',
  access_copilot: 'Accès Copilote IA',
  access_copilot_dashboard: 'Accès Copilote Executive',
  view_copilot_audit: 'Voir Audit Copilote',
  view_reports: 'Voir les rapports',
  manage_reports: 'Gérer les rapports',
  view_statistics: 'Voir les statistiques globales',

  // ==================== SPÉCIAL ====================
  manage_sanctions: 'Gérer les sanctions utilisateurs',
  access_suppliers: 'Accès module fournisseurs',
  manage_deliveries: 'Gestion des livraisons',
} as const;

export type PermissionKey = keyof typeof AVAILABLE_PERMISSIONS;

export const useAgentPermissions = (agentId: string | undefined) => {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Charger les permissions de l'agent
  const loadPermissions = useCallback(async () => {
    if (!agentId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .rpc('get_agent_permissions' as any, {
          p_agent_id: agentId
        });

      if (error) throw error;

      setPermissions((data as Record<string, boolean>) || {});
    } catch (error: any) {
      console.error('Erreur chargement permissions:', error);
      toast.error('Erreur lors du chargement des permissions');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  // Mettre à jour les permissions (triple-save pour robustesse maximale)
  const setAgentPermissions = useCallback(async (newPermissions: Record<string, boolean>) => {
    if (!agentId) return false;

    // Clés actives (true) — pour la colonne legacy agents_management.permissions
    const activeKeys = Object.entries(newPermissions)
      .filter(([key, val]) => val === true && key !== 'create_sub_agents')
      .map(([key]) => key);

    let anySuccess = false;

    // 1. Essayer la RPC set_agent_permissions (SECURITY DEFINER, priorité haute)
    try {
      const { data, error } = await supabase
        .rpc('set_agent_permissions' as any, {
          p_agent_id: agentId,
          p_permissions: newPermissions
        });

      const result = data as { success: boolean; error?: string } | null;
      if (!error && result?.success) {
        anySuccess = true;
      } else {
        console.warn('[Permissions] set_agent_permissions non réussi:', error || result?.error);
      }
    } catch (e) {
      console.warn('[Permissions] Exception set_agent_permissions:', e);
    }

    // 2. Fallback: upsert direct dans agent_permissions (si RLS permet)
    if (!anySuccess) {
      try {
        const upserts = Object.entries(newPermissions)
          .filter(([key]) => key !== 'create_sub_agents')
          .map(([permission_key, permission_value]) => ({
            agent_id: agentId,
            permission_key,
            permission_value,
            updated_at: new Date().toISOString(),
          }));

        if (upserts.length > 0) {
          const { error: upsertErr } = await supabase
            .from('agent_permissions')
            .upsert(upserts, { onConflict: 'agent_id,permission_key' });

          if (!upsertErr) anySuccess = true;
        }
      } catch (e) {
        console.warn('[Permissions] Exception upsert direct:', e);
      }
    }

    // 3. Toujours synchroniser agents_management.permissions via update_agent RPC (garantit le fallback)
    // update_agent est SECURITY DEFINER et vérifie l'ownership PDG — fonctionne toujours pour le PDG
    try {
      const { data: updRes } = await supabase
        .rpc('update_agent' as any, {
          p_agent_id: agentId,
          p_permissions: activeKeys,
        });
      const updResult = updRes as { success: boolean } | null;
      if (updResult?.success) anySuccess = true;
    } catch (e) {
      // Fallback direct si update_agent non disponible (contexte non-PDG)
      try {
        await supabase
          .from('agents_management')
          .update({ permissions: activeKeys as any })
          .eq('id', agentId);
        anySuccess = true;
      } catch (_e2) {
        console.warn('[Permissions] Exception sync legacy:', _e2);
      }
    }

    // 4. Synchroniser can_create_sub_agent si présent
    if ('create_sub_agents' in newPermissions) {
      await supabase
        .from('agents_management')
        .update({ can_create_sub_agent: newPermissions.create_sub_agents })
        .eq('id', agentId);
    }

    if (anySuccess) {
      toast.success('Permissions mises à jour');
      await loadPermissions();
      return true;
    } else {
      toast.error('Impossible de sauvegarder les permissions');
      return false;
    }
  }, [agentId, loadPermissions]);

  // Vérifier une permission spécifique
  const hasPermission = useCallback((permissionKey: string): boolean => {
    return permissions[permissionKey] === true;
  }, [permissions]);

  // Écouter les changements en temps réel
  useEffect(() => {
    if (!agentId) return;

    loadPermissions();

    // S'abonner aux changements en temps réel
    const channel = supabase
      .channel('agent-permissions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_permissions',
          filter: `agent_id=eq.${agentId}`
        },
        (payload) => {
          console.log('Permission updated:', payload);
          loadPermissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId, loadPermissions]);

  return {
    permissions,
    loading,
    setAgentPermissions,
    hasPermission,
    reload: loadPermissions
  };
};
