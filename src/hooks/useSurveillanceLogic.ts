/**
 * HOOK REACT - SYSTÈME DE SURVEILLANCE LOGIQUE
 * Gère la détection, alertes, et corrections
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export interface LogicAnomaly {
  id: string;
  rule_id: string;
  domain: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  expected_value: Record<string, any>;
  actual_value: Record<string, any>;
  affected_entities?: Record<string, any>[];
  detected_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  resolution_type?: 'AUTO' | 'MANUAL' | 'IGNORED';
}

export interface SystemHealth {
  overall_status: 'OK' | 'WARNING' | 'CRITICAL';
  total_rules: number;
  total_anomalies: number;
  critical_anomalies: number;
  recent_anomalies_24h: number;
  resolution_rate: number;
}

export interface Correction {
  id: string;
  anomaly_id: string;
  old_state: Record<string, any>;
  new_state: Record<string, any>;
  status: 'PENDING' | 'APPLIED' | 'REVERTED';
  applied_at?: string;
}

export function useSurveillanceLogic() {
  const { user, profile } = useAuth();
  const [anomalies, setAnomalies] = useState<LogicAnomaly[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Vérifier les permissions (PDG = admin, ceo, ou pdg role)
  const userRole = (profile?.role || '').toString().toLowerCase();
  const isPDG = ['admin', 'ceo', 'pdg'].includes(userRole);

  // Charger les anomalies
  const loadAnomalies = useCallback(async () => {
    if (!isPDG) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('logic_anomalies')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      // Cast les données pour correspondre au type LogicAnomaly
      setAnomalies((data || []).map((item: any) => ({
        ...item,
        severity: item.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
        expected_value: item.expected_value || {},
        actual_value: item.actual_value || {},
        affected_entities: item.affected_entities || []
      })));
    } catch (error: any) {
      console.error('Erreur chargement anomalies:', error);
      toast.error('Impossible de charger les anomalies');
    } finally {
      setLoading(false);
    }
  }, [isPDG]);

  // Charger la santé du système
  const loadSystemHealth = useCallback(async () => {
    if (!isPDG) return;

    try {
      const { data, error } = await supabase.rpc('get_system_health');

      if (error) throw error;
      if (data && data.length > 0) {
        // Cast pour correspondre au type SystemHealth
        const healthData = data[0] as any;
        setSystemHealth({
          overall_status: healthData.overall_status as 'OK' | 'WARNING' | 'CRITICAL',
          total_rules: healthData.total_rules || 0,
          total_anomalies: healthData.total_anomalies || 0,
          critical_anomalies: healthData.critical_anomalies || 0,
          recent_anomalies_24h: healthData.recent_anomalies_24h || 0,
          resolution_rate: healthData.resolution_rate || 0
        });
      }
    } catch (error: any) {
      console.error('Erreur santé système:', error);
    }
  }, [isPDG]);

  // Détection d'anomalies manuelles
  const detectAnomalies = useCallback(
    async (domain?: string, severity?: string) => {
      if (!isPDG) {
        toast.error('Vous n\'avez pas les permissions');
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase.rpc('detect_all_anomalies', {
          p_domain_filter: domain || null,
          p_severity_filter: severity || null
        });

        if (error) throw error;

        toast.success(`Détection complétée: ${data?.length || 0} domaines vérifiés`);
        await loadAnomalies();
        await loadSystemHealth();
      } catch (error: any) {
        console.error('Erreur détection:', error);
        toast.error('Erreur lors de la détection');
      } finally {
        setLoading(false);
      }
    },
    [isPDG, loadAnomalies, loadSystemHealth]
  );

  // Appliquer une correction
  const applyCorrection = useCallback(
    async (
      anomalyId: string,
      correctionType: 'AUTO' | 'MANUAL_APPROVED',
      newValue: Record<string, any>,
      reason?: string
    ) => {
      if (!isPDG) {
        toast.error('Vous n\'avez pas les permissions');
        return null;
      }

      try {
        setLoading(true);
        const targetAnomaly = anomalies.find((a) => a.id === anomalyId);
        if (!targetAnomaly) {
          toast.error('Anomalie introuvable');
          return null;
        }

        // Vérifier l'état de la règle avant correction
        const { data: verifyData, error: verifyError } = await supabase.rpc('verify_logic_rule', {
          p_rule_id: targetAnomaly.rule_id,
          p_params: null
        });

        if (verifyError) {
          throw verifyError;
        }

        const verifyResult = verifyData?.[0];
        if (verifyResult?.is_valid) {
          toast.info('Anomalie déjà résolue - correction annulée');
          await loadAnomalies();
          await loadSystemHealth();
          return null;
        }

        const { data, error } = await supabase.rpc('apply_correction', {
          p_anomaly_id: anomalyId,
          p_correction_type: correctionType,
          p_new_value: newValue,
          p_reason: reason || null
        });

        if (error) throw error;

        if (data?.[0]?.success) {
          toast.success('Correction appliquée avec succès');
          await loadAnomalies();
          await loadSystemHealth();
          return data[0].correction_id;
        } else {
          throw new Error(data?.[0]?.message || 'Correction échouée');
        }
      } catch (error: any) {
        console.error('Erreur correction:', error);
        toast.error(error.message || 'Erreur lors de la correction');
        return null;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPDG, loadAnomalies, loadSystemHealth]
  );

  // S'abonner aux anomalies en temps réel
  useEffect(() => {
    if (!isPDG) return;

    // Charger les données initiales
    loadAnomalies();
    loadSystemHealth();

    // Souscrire aux changements en temps réel
    const channels: any[] = [];

    // Canal pour les nouvelles anomalies
    const anomaliesChannel = supabase
      .channel(`logic_anomalies:pdg`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'logic_anomalies'
        },
        (payload) => {
          console.log('🚨 Nouvelle anomalie:', payload.new);
          const newAnomaly = payload.new as LogicAnomaly;

          // Toast immédiat si CRITICAL
          if (newAnomaly.severity === 'CRITICAL') {
            toast.error(`🚨 ANOMALIE CRITIQUE: ${newAnomaly.rule_id}`, {
              description: `Domain: ${newAnomaly.domain}`,
              action: {
                label: 'Voir',
                onClick: () => {
                  // Scroller vers l'anomalie
                  const el = document.getElementById(`anomaly-${newAnomaly.id}`);
                  el?.scrollIntoView({ behavior: 'smooth' });
                }
              }
            });
          } else {
            toast.info(`Anomalie détectée: ${newAnomaly.rule_id}`);
          }

          // Recharger les données
          loadAnomalies();
          loadSystemHealth();
        }
      )
      .subscribe((status) => {
        console.log('📡 Real-time status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    channels.push(anomaliesChannel);

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [isPDG, loadAnomalies, loadSystemHealth]);

  // Agréger anomalies par domain
  const anomaliesByDomain = anomalies.reduce(
    (acc, anomaly) => {
      if (!acc[anomaly.domain]) {
        acc[anomaly.domain] = [];
      }
      acc[anomaly.domain].push(anomaly);
      return acc;
    },
    {} as Record<string, LogicAnomaly[]>
  );

  // Agréger anomalies par severity
  const anomaliesBySeverity = anomalies.reduce(
    (acc, anomaly) => {
      acc[anomaly.severity] = (acc[anomaly.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Statistiques
  const stats = {
    total: anomalies.length,
    critical: anomalies.filter((a) => a.severity === 'CRITICAL').length,
    high: anomalies.filter((a) => a.severity === 'HIGH').length,
    unresolved: anomalies.filter((a) => !a.resolved_at).length,
    resolved: anomalies.filter((a) => a.resolved_at).length
  };

  return {
    anomalies,
    anomaliesByDomain,
    anomaliesBySeverity,
    systemHealth,
    stats,
    loading,
    isConnected,
    isPDG,
    detectAnomalies,
    applyCorrection,
    loadAnomalies,
    loadSystemHealth
  };
}
