import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { errorMonitor } from '@/services/errorMonitor';
import { ApiMonitoringService } from '@/services/apiMonitoring';
import { InterfaceMetricsService } from '@/services/interfaceMetrics';
import { healthCheckService } from '@/services/HealthCheckService';

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  lastCheck: string;
  services: ServiceStatus[];
}

export interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'degraded';
  responseTime?: number;
  errorRate?: number;
  lastError?: string;
}

export interface InterfaceMetrics {
  interface: string;
  activeUsers: number;
  transactions: number;
  errors: number;
  performance: number;
}

export interface AutoFix {
  id: string;
  error_pattern: string;
  fix_description: string;
  fix_type: string;
  times_applied: number;
  success_rate: number;
  is_active: boolean;
}

export interface PdgStats {
  totalErrors: number;
  criticalErrors: number;
  autoFixedErrors: number;
  pendingErrors: number;
  systemHealth: number;
  activeInterfaces: number;
  totalTransactions: number;
  avgResponseTime: number;
}

export function usePdgMonitoring() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    status: 'healthy',
    uptime: 0,
    lastCheck: new Date().toISOString(),
    services: []
  });

  const [interfaceMetrics, setInterfaceMetrics] = useState<InterfaceMetrics[]>([]);
  const [autoFixes, setAutoFixes] = useState<AutoFix[]>([]);
  const [stats, setStats] = useState<PdgStats>({
    totalErrors: 0,
    criticalErrors: 0,
    autoFixedErrors: 0,
    pendingErrors: 0,
    systemHealth: 100,
    activeInterfaces: 0,
    totalTransactions: 0,
    avgResponseTime: 0
  });

  const [loading, setLoading] = useState(false);
  const [realTimeEnabled, setRealTimeEnabled] = useState(true);
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);

  // Charger les données de monitoring
  const loadMonitoringData = useCallback(async (force: boolean = false) => {
    // Éviter les rechargements trop fréquents (moins de 5 secondes)
    const now = Date.now();
    if (!force && now - lastLoadTime < 5000) {
      console.log('⏭️ [PDG] Rechargement ignoré (trop récent)');
      return;
    }

    setLoading(true);
    setLastLoadTime(now);
    try {
      // Charger les stats globales via la fonction RPC sécurisée
      const globalStats = await InterfaceMetricsService.getGlobalStats();

      // Charger les erreurs système
      const errorStats = await errorMonitor.getErrorStats();

      // Charger les connexions API
      const apiConnections = await ApiMonitoringService.getAllApiConnections();

      // Charger les auto-fixes
      const { data: fixesData } = await supabase
        .from('auto_fixes')
        .select('*')
        .eq('is_active', true);

      if (fixesData) {
        setAutoFixes(fixesData);
      }

      // Charger la santé système
      const { data: _healthData } = await supabase
        .from('system_health')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10);

      // Charger les vraies métriques des interfaces depuis la vue sécurisée
      const metrics = await InterfaceMetricsService.getAllMetrics();
      setInterfaceMetrics(metrics);

      // Statut des services depuis le VRAI moteur de health-checks (pings réels),
      // plus aucune valeur hardcodée ni service fictif (Firebase n'était pas utilisé).
      let services: ServiceStatus[] = [];
      try {
        const report = await healthCheckService.performHealthChecks();
        const mapStatus = (s: string): ServiceStatus['status'] =>
          s === 'healthy' ? 'online' : s === 'critical' ? 'offline' : 'degraded';
        services = (report.checks || []).map((c) => ({
          name: c.name,
          status: mapStatus(c.status),
          responseTime: Math.round(c.responseTime ?? 0),
          errorRate: 0, // latence mesurée réellement ; pas de taux d'erreur par service inventé
        }));
      } catch {
        services = [];
      }

      // Calculer la santé globale via la fonction RPC intelligente
      let adjustedHealthScore = 100;
      let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

      try {
        const { data: healthResult } = await supabase.rpc('calculate_system_health');
        if (healthResult && typeof healthResult === 'object' && !Array.isArray(healthResult)) {
          const result = healthResult as { health_score?: number; health_status?: string };
          adjustedHealthScore = result.health_score ?? 100;
          healthStatus = (result.health_status as 'healthy' | 'warning' | 'critical') || 'healthy';
        }
      } catch (_e) {
        // Fallback au calcul local si RPC échoue
        const criticalCount = errorStats?.critical || 0;
        const pendingCount = errorStats?.pending || 0;
        adjustedHealthScore = Math.max(0, 100 - (criticalCount * 10) - (pendingCount * 0.5));
        healthStatus = adjustedHealthScore >= 80 ? 'healthy' : adjustedHealthScore >= 50 ? 'warning' : 'critical';
      }

      setSystemHealth({
        status: healthStatus,
        uptime: 99.9,
        lastCheck: new Date().toISOString(),
        services
      });

      // Utiliser les stats globales si disponibles
      const totalTransactions = globalStats?.total_orders ||
        metrics.reduce((sum, m) => sum + m.transactions, 0);

      // Calculer les statistiques globales
      setStats({
        totalErrors: errorStats?.total || 0,
        criticalErrors: errorStats?.critical || 0,
        autoFixedErrors: errorStats?.fixed || 0,
        pendingErrors: errorStats?.pending || 0,
        systemHealth: adjustedHealthScore,
        activeInterfaces: metrics.length,
        totalTransactions: totalTransactions,
        avgResponseTime: services.reduce((sum, s) => sum + (s.responseTime || 0), 0) / services.length
      });

    } catch (error: any) {
      console.error('Erreur chargement monitoring:', error);
      toast.error('Erreur lors du chargement des données de monitoring');
    } finally {
      setLoading(false);
    }
  }, [lastLoadTime]);

  // Activer la surveillance en temps réel
  useEffect(() => {
    if (!realTimeEnabled) return;

    // Charger les données initiales (sans forcer si chargées récemment)
    loadMonitoringData(false);

    // Intervalle de 30s - forcer le rechargement
    const interval = setInterval(() => loadMonitoringData(true), 30000);

    // Écouter les changements en temps réel - forcer le rechargement
    const errorsChannel = supabase
      .channel('system-errors-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'system_errors'
      }, () => {
        loadMonitoringData(true);
      })
      .subscribe();

    const healthChannel = supabase
      .channel('system-health-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'system_health'
      }, () => {
        loadMonitoringData(true);
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(errorsChannel);
      supabase.removeChannel(healthChannel);
    };
  }, [realTimeEnabled, loadMonitoringData]);

  // Analyser une erreur avec l'IA
  const analyzeErrorWithAI = async (errorId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-error-analyzer', {
        body: {
          error: { id: errorId },
          context: { stats, systemHealth }
        }
      });

      if (error) throw error;

      toast.success('Analyse IA terminée');
      await loadMonitoringData();
      return data;
    } catch (error: any) {
      console.error('Erreur analyse IA:', error);
      toast.error('Erreur lors de l\'analyse IA');
      return null;
    }
  };

  // Exécuter une correction automatique
  const runAutoFix = async (errorId: string) => {
    try {
      // D'abord analyser avec l'IA
      const analysis = await analyzeErrorWithAI(errorId);

      if (analysis?.analysis?.autoFixable) {
        // Appliquer le fix automatique
        const { data, error } = await supabase.functions.invoke('fix-error', {
          body: { errorId }
        });

        if (error) throw error;

        toast.success('Correction automatique appliquée avec succès');
        await loadMonitoringData();
        return data;
      } else {
        toast.warning('Cette erreur nécessite une intervention manuelle');
        return analysis;
      }
    } catch (error: any) {
      console.error('Erreur auto-fix:', error);
      toast.error('Erreur lors de la correction automatique');
      return null;
    }
  };

  // Demander de l'aide à l'IA copilote
  const askAICopilot = async (query: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-copilot', {
        body: {
          query,
          context: {
            stats,
            systemHealth,
            recentErrors: await errorMonitor.getRecentErrors(10)
          }
        }
      });

      if (error) {
        // Vérifier si c'est une erreur de crédits ou rate limit
        if (error.message?.includes('402') || error.context?.status === 402) {
          toast.error('Crédits IA insuffisants. Rechargez vos crédits dans Paramètres > Workspace > Usage.');
          return { error: 'INSUFFICIENT_CREDITS' };
        }
        if (error.message?.includes('429') || error.context?.status === 429) {
          toast.error('Limite de requêtes atteinte. Réessayez dans quelques instants.');
          return { error: 'RATE_LIMITED' };
        }
        throw error;
      }
      return data;
    } catch (error: any) {
      console.error('Erreur AI copilot:', error);
      toast.error('Erreur lors de la consultation de l\'IA');
      return null;
    }
  };

  // Analyser les anomalies
  const detectAnomalies = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('detect-anomalies', {
        body: {
          metrics: interfaceMetrics,
          health: systemHealth
        }
      });

      if (error) throw error;

      if (data?.anomalies && data.anomalies.length > 0) {
        toast.warning(`${data.anomalies.length} anomalie(s) détectée(s)`);
      } else {
        toast.success('Aucune anomalie détectée');
      }

      return data;
    } catch (error: any) {
      console.error('Erreur détection anomalies:', error);
      toast.error('Erreur lors de la détection d\'anomalies');
      return null;
    }
  };

  return {
    systemHealth,
    interfaceMetrics,
    autoFixes,
    stats,
    loading,
    realTimeEnabled,
    setRealTimeEnabled,
    loadMonitoringData,
    runAutoFix,
    analyzeErrorWithAI,
    askAICopilot,
    detectAnomalies
  };
}
