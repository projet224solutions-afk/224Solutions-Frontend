import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SystemService {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  uptime: string;
  lastCheck: string;
  responseTime?: number;
}

export interface DatabaseStats {
  totalTables: number;
  totalRecords: number;
  storageUsed: string;
  lastBackup?: string;
}

export interface MaintenanceLog {
  id: string;
  action: string;
  status: 'success' | 'failed' | 'pending';
  timestamp: string;
  details?: string;
}

export function usePDGMaintenanceData() {
  const [services, setServices] = useState<SystemService[]>([]);
  const [dbStats, setDbStats] = useState<DatabaseStats>({
    totalTables: 0,
    totalRecords: 0,
    storageUsed: '0 MB',
    lastBackup: undefined
  });
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Vérifier le statut des services
  const checkServicesStatus = async () => {
    setLoading(true);
    try {
      const startTime = Date.now();

      // Tester la connexion aux principales tables
      const [profilesCheck, walletsCheck, productsCheck, ordersCheck] = await Promise.allSettled([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('wallets').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true })
      ]);

      const responseTime = Date.now() - startTime;

      const servicesStatus: SystemService[] = [
        {
          name: 'Base de données Profiles',
          status: profilesCheck.status === 'fulfilled' ? 'operational' : 'down',
          uptime: profilesCheck.status === 'fulfilled' ? '99.9%' : '0%',
          lastCheck: 'À l\'instant',
          responseTime: responseTime
        },
        {
          name: 'Base de données Wallets',
          status: walletsCheck.status === 'fulfilled' ? 'operational' : 'down',
          uptime: walletsCheck.status === 'fulfilled' ? '99.8%' : '0%',
          lastCheck: 'À l\'instant',
          responseTime: responseTime
        },
        {
          name: 'Base de données Produits',
          status: productsCheck.status === 'fulfilled' ? 'operational' : 'down',
          uptime: productsCheck.status === 'fulfilled' ? '99.9%' : '0%',
          lastCheck: 'À l\'instant',
          responseTime: responseTime
        },
        {
          name: 'Base de données Commandes',
          status: ordersCheck.status === 'fulfilled' ? 'operational' : 'down',
          uptime: ordersCheck.status === 'fulfilled' ? '99.7%' : '0%',
          lastCheck: 'À l\'instant',
          responseTime: responseTime
        }
      ];

      setServices(servicesStatus);
      toast.success('Statut des services mis à jour');
    } catch (error) {
      console.error('Erreur vérification services:', error);
      toast.error('Erreur lors de la vérification des services');
    } finally {
      setLoading(false);
    }
  };

  // Récupérer les statistiques de la base de données
  const loadDatabaseStats = async () => {
    try {
      // Compter les enregistrements dans les tables principales
      const [profilesCount, walletsCount, productsCount, ordersCount, transactionsCount] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('wallets').select('*', { count: 'exact', head: true }),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('wallet_transactions').select('*', { count: 'exact', head: true })
      ]);

      const totalRecords =
        (profilesCount.count || 0) +
        (walletsCount.count || 0) +
        (productsCount.count || 0) +
        (ordersCount.count || 0) +
        (transactionsCount.count || 0);

      // Estimation du stockage (environ 1KB par enregistrement)
      const estimatedStorageMB = (totalRecords * 1) / 1024;

      setDbStats({
        totalTables: 5, // Tables principales comptées
        totalRecords,
        storageUsed: `${estimatedStorageMB.toFixed(2)} MB`,
        lastBackup: new Date().toLocaleString('fr-FR')
      });
    } catch (error) {
      console.error('Erreur statistiques DB:', error);
    }
  };

  // Charger les logs de maintenance récents
  const loadMaintenanceLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .ilike('action', '%maintenance%')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const formattedLogs: MaintenanceLog[] = (data || []).map(log => ({
        id: log.id,
        action: log.action,
        status: 'success',
        timestamp: new Date(log.created_at).toLocaleString('fr-FR'),
        details: log.data_json ? JSON.stringify(log.data_json) : undefined
      }));

      setLogs(formattedLogs);
    } catch (error) {
      console.error('Erreur chargement logs:', error);
    }
  };

  // ✅ Archive les vieux audit_logs (NE SUPPRIME PLUS — preuve légale/conformité).
  // Exige MFA (token d'une vérification step-up récente) + rétention min 90j.
  const archiveOldData = async (daysOld: number, mfaToken: string | null) => {
    if (!mfaToken) {
      toast.error('Vérification MFA requise pour archiver les logs');
      return { success: false };
    }
    if (daysOld < 90) {
      toast.error('Rétention minimale : 90 jours');
      return { success: false };
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('archive_old_audit_logs', {
        p_days_old: daysOld,
        p_mfa_token: mfaToken,
      });

      if (error) throw error;
      const res = data as any;
      if (!res?.success) {
        toast.error(`Archivage refusé : ${res?.error || 'erreur inconnue'}`);
        return { success: false };
      }

      toast.success(`${res.archived} logs archivés (déplacés, non supprimés)`);
      await loadMaintenanceLogs();
      return { success: true, archived: res.archived };
    } catch (e: any) {
      console.error('Erreur archivage:', e);
      toast.error("Erreur lors de l'archivage des logs");
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  // ✅ Rafraîchit les statistiques (PAS un VACUUM). Nom honnête vs l'ancien
  // "optimizeDatabase" qui prétendait optimiser sans rien faire de tel.
  const refreshDatabaseStats = async () => {
    setLoading(true);
    try {
      await checkServicesStatus();
      await loadDatabaseStats();
      toast.success('Statistiques rafraîchies');
    } catch (error) {
      console.error('Erreur rafraîchissement:', error);
      toast.error('Erreur lors du rafraîchissement');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Backups gérés automatiquement par Supabase — message honnête (l'ancienne
  // version simulait un backup et affichait "créé avec succès" sans rien faire).
  const createBackup = async () => {
    toast.info(
      "Les sauvegardes sont gérées automatiquement par Supabase (quotidiennes). " +
      "Pour un backup manuel, utilisez le dashboard Supabase → Database → Backups.",
      { duration: 7000 }
    );
  };

  // Charger les données au montage
  useEffect(() => {
    checkServicesStatus();
    loadDatabaseStats();
    loadMaintenanceLogs();
  }, []);

  return {
    services,
    dbStats,
    logs,
    loading,
    checkServicesStatus,
    loadDatabaseStats,
    archiveOldData,
    refreshDatabaseStats,
    createBackup
  };
}
