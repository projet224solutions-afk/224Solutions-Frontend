/**
 * 🛡️ HOOK SECURITY DATA
 * Gestion centralisée des données de sécurité pour l'interface PDG
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AuditLog {
  id: string;
  action: string;
  actor_id: string;
  target_id?: string;
  target_type?: string;
  ip_address?: string;
  user_agent?: string;
  data_json?: any;
  created_at: string;
  actor_profile?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    role?: string;
  };
}

interface FraudLog {
  id: string;
  user_id?: string;
  transaction_id?: string;
  risk_level: string;
  risk_score: number;
  flags: any;
  action_taken?: string;
  reviewed: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  user_profile?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
}

interface SecurityStats {
  total_audit_logs: number;
  total_fraud_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  reviewed_alerts: number;
  pending_alerts: number;
  recent_actions: number;
}

export function useSecurityData(autoLoad: boolean = true) {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [fraudLogs, setFraudLogs] = useState<FraudLog[]>([]);
  const [stats, setStats] = useState<SecurityStats>({
    total_audit_logs: 0,
    total_fraud_alerts: 0,
    critical_alerts: 0,
    high_alerts: 0,
    reviewed_alerts: 0,
    pending_alerts: 0,
    recent_actions: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSecurityData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Charger les logs d'audit - gestion silencieuse des erreurs RLS
      const { data: audit, error: auditError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Gestion silencieuse des erreurs RLS ou réseau pour les non-admins
      if (auditError) {
        const isSilentError = auditError.message?.includes('permission') ||
                              auditError.message?.includes('policy') ||
                              auditError.message?.includes('Failed to fetch') ||
                              auditError.message?.includes('NetworkError') ||
                              auditError.code === '42501' ||
                              auditError.code === 'PGRST301';
        if (!isSilentError) {
          console.error('Erreur audit logs:', auditError);
        }
      }

      // Charger les logs de fraude - gestion silencieuse des erreurs RLS
      const { data: fraud, error: fraudError } = await supabase
        .from('fraud_detection_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (fraudError) {
        const isSilentError = fraudError.message?.includes('permission') ||
                              fraudError.message?.includes('policy') ||
                              fraudError.message?.includes('Failed to fetch') ||
                              fraudError.message?.includes('NetworkError') ||
                              fraudError.code === '42501' ||
                              fraudError.code === 'PGRST301';
        if (!isSilentError) {
          console.error('Erreur fraud logs:', fraudError);
        }
      }

      const auditData = (audit || []) as any;
      const fraudData = (fraud || []) as any;

      setAuditLogs(auditData);
      setFraudLogs(fraudData);

      // Calculer les statistiques
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const recentActions = auditData.filter((log: any) =>
        new Date(log.created_at) > oneDayAgo
      ).length;

      const criticalAlerts = fraudData.filter((log: any) =>
        log.risk_level === 'critical'
      ).length;

      const highAlerts = fraudData.filter((log: any) =>
        log.risk_level === 'high'
      ).length;

      const reviewedAlerts = fraudData.filter((log: any) =>
        log.reviewed === true
      ).length;

      const pendingAlerts = fraudData.filter((log: any) =>
        log.reviewed === false
      ).length;

      const newStats: SecurityStats = {
        total_audit_logs: auditData.length,
        total_fraud_alerts: fraudData.length,
        critical_alerts: criticalAlerts,
        high_alerts: highAlerts,
        reviewed_alerts: reviewedAlerts,
        pending_alerts: pendingAlerts,
        recent_actions: recentActions
      };

      setStats(newStats);
      // Ne pas logger en console pour éviter le bruit
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      // Ne pas afficher de toast pour les erreurs RLS (utilisateur non-admin) ou réseau
      const isSilentError = errorMessage.includes('permission') ||
                            errorMessage.includes('policy') ||
                            errorMessage.includes('RLS') ||
                            errorMessage.includes('Failed to fetch') ||
                            errorMessage.includes('NetworkError') ||
                            errorMessage.includes('fetch') ||
                            (err as any)?.code === '42501' ||
                            (err as any)?.code === 'PGRST301';

      if (!isSilentError) {
        console.error('❌ Erreur chargement sécurité:', err);
        toast.error('Erreur lors du chargement des données de sécurité');
      }
      setError(isSilentError ? null : errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const markFraudAsReviewed = useCallback(async (fraudId: string, actionTaken?: string) => {
    try {
      const { error } = await supabase
        .from('fraud_detection_logs')
        .update({
          reviewed: true,
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          action_taken: actionTaken || 'Reviewed by admin'
        })
        .eq('id', fraudId);

      if (error) throw error;

      toast.success('Alerte marquée comme traitée');
      await loadSecurityData();
    } catch (err) {
      console.error('Erreur mise à jour alerte:', err);
      toast.error('Erreur lors de la mise à jour');
    }
  }, [loadSecurityData]);

  useEffect(() => {
    if (autoLoad) {
      loadSecurityData();
    }
  }, [autoLoad, loadSecurityData]);

  return {
    auditLogs,
    fraudLogs,
    stats,
    loading,
    error,
    refetch: loadSecurityData,
    markFraudAsReviewed
  };
}
