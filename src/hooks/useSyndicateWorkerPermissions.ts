import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Permissions disponibles pour les membres du bureau syndicat
// Organisées par catégorie correspondant aux onglets de l'interface
export const SYNDICATE_WORKER_PERMISSIONS = {
  // ===== DASHBOARD =====
  view_dashboard: 'Accéder au Dashboard',
  view_statistics: 'Voir les statistiques globales',
  view_recent_activity: 'Voir l\'activité récente',

  // ===== SOS & ALERTES =====
  view_sos_alerts: 'Voir les alertes SOS',
  respond_sos: 'Répondre aux SOS',
  manage_sos_alerts: 'Gérer/Clôturer les alertes SOS',
  call_sos_driver: 'Appeler le conducteur en SOS',
  view_sos_location: 'Voir la localisation SOS',

  // ===== MEMBRES DU BUREAU =====
  view_members: 'Voir les membres du bureau',
  add_members: 'Ajouter des membres',
  edit_members: 'Modifier les membres',
  delete_members: 'Supprimer les membres',
  manage_member_permissions: 'Gérer les permissions des membres',
  toggle_member_status: 'Activer/Désactiver les membres',

  // ===== TAXI-MOTARDS =====
  view_drivers: 'Voir les taxi-motards',
  add_drivers: 'Ajouter des taxi-motards',
  edit_drivers: 'Modifier les taxi-motards',
  delete_drivers: 'Supprimer des taxi-motards',
  view_driver_details: 'Voir les détails d\'un taxi-motard',
  generate_driver_badge: 'Générer les badges taxi-motard',
  manage_driver_wallet: 'Gérer le wallet des taxi-motards',

  // ===== VÉHICULES & MOTOS =====
  view_vehicles: 'Voir les véhicules',
  add_vehicles: 'Enregistrer des véhicules',
  edit_vehicles: 'Modifier les véhicules',
  delete_vehicles: 'Supprimer des véhicules',
  manage_stolen_vehicles: 'Gérer les véhicules volés',
  declare_stolen: 'Déclarer un véhicule volé',
  recover_vehicle: 'Récupérer un véhicule volé',
  view_vehicle_security_log: 'Voir l\'historique sécurité véhicules',

  // ===== TICKETS DE TRANSPORT =====
  view_tickets: 'Voir les tickets',
  generate_tickets: 'Générer des tickets',
  print_tickets: 'Imprimer les tickets',
  export_tickets: 'Exporter les tickets en PDF',
  manage_ticket_history: 'Gérer l\'historique des tickets',
  upload_bureau_stamp: 'Uploader le tampon du bureau',

  // ===== TRÉSORERIE & WALLET =====
  view_wallet: 'Voir le portefeuille',
  view_balance: 'Voir le solde',
  view_transactions: 'Voir les transactions',
  make_transfers: 'Effectuer des transferts',
  receive_transfers: 'Recevoir des transferts',
  manage_cotisations: 'Gérer les cotisations',
  export_transactions: 'Exporter les transactions',

  // ===== GESTION & PARAMÈTRES =====
  view_settings: 'Voir les paramètres',
  edit_settings: 'Modifier les paramètres',
  manage_bureau_info: 'Modifier les infos du bureau',
  edit_bureau_photo: 'Modifier la photo du bureau',
  edit_bureau_contact: 'Modifier les contacts du bureau',

  // ===== ANALYTICS & RAPPORTS =====
  view_analytics: 'Accéder aux analytics',
  view_performance_reports: 'Voir les rapports de performance',
  view_financial_reports: 'Voir les rapports financiers',
  export_reports: 'Exporter les rapports',

  // ===== COMMUNICATION =====
  send_notifications: 'Envoyer des notifications',
  manage_communications: 'Gérer les communications',
  use_communication_widget: 'Utiliser le widget de communication',

  // ===== BADGES =====
  view_badges: 'Voir les badges',
  generate_badges: 'Générer des badges',
  print_badges: 'Imprimer les badges',
  download_badges: 'Télécharger les badges',
} as const;

export type SyndicateWorkerPermissionKey = keyof typeof SYNDICATE_WORKER_PERMISSIONS;

export interface SyndicateWorkerPermissions {
  [key: string]: boolean;
}

export const useSyndicateWorkerPermissions = (workerId?: string) => {
  const [permissions, setPermissions] = useState<SyndicateWorkerPermissions>({});
  const [loading, setLoading] = useState(false);

  const loadPermissions = useCallback(async () => {
    if (!workerId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_syndicate_worker_permissions', {
        p_worker_id: workerId
      });

      if (error) {
        console.error('Error loading worker permissions:', error);
        return;
      }

      // Cast data to SyndicateWorkerPermissions
      const permissionsData = (data && typeof data === 'object' && !Array.isArray(data))
        ? data as SyndicateWorkerPermissions
        : {};
      setPermissions(permissionsData);
    } catch (err) {
      console.error('Error in loadPermissions:', err);
    } finally {
      setLoading(false);
    }
  }, [workerId]);

  const setWorkerPermissions = useCallback(async (newPermissions: SyndicateWorkerPermissions) => {
    if (!workerId) {
      toast.error('ID du membre non trouvé');
      return false;
    }

    try {
      const { data, error } = await supabase.rpc('set_syndicate_worker_permissions', {
        p_worker_id: workerId,
        p_permissions: newPermissions
      });

      if (error) {
        console.error('Error setting worker permissions:', error);
        toast.error('Erreur lors de la sauvegarde des permissions');
        return false;
      }

      setPermissions(newPermissions);
      toast.success('Permissions mises à jour');
      return true;
    } catch (err) {
      console.error('Error in setWorkerPermissions:', err);
      toast.error('Erreur lors de la sauvegarde des permissions');
      return false;
    }
  }, [workerId]);

  const hasPermission = useCallback((key: SyndicateWorkerPermissionKey): boolean => {
    return permissions[key] === true;
  }, [permissions]);

  useEffect(() => {
    if (workerId) {
      loadPermissions();
    }
  }, [workerId, loadPermissions]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!workerId) return;

    const channel = supabase
      .channel(`worker_permissions_${workerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'syndicate_worker_permissions',
          filter: `worker_id=eq.${workerId}`
        },
        () => {
          loadPermissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workerId, loadPermissions]);

  return {
    permissions,
    loading,
    setWorkerPermissions,
    hasPermission,
    reload: loadPermissions,
  };
};
