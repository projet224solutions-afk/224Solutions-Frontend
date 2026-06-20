/**
 * 📊 SERVICE DE MONITORING API - 224SOLUTIONS
 * Surveillance intelligente des API connectées avec détection d'anomalies
 */

import { supabase } from '@/integrations/supabase/client';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';

export interface ApiConnection {
  id: string;
  api_name: string;
  api_provider: string;
  api_type: 'payment' | 'sms' | 'email' | 'storage' | 'other';
  api_key_encrypted: string;
  encryption_iv: string;
  api_secret_encrypted?: string;
  base_url?: string;
  status: 'active' | 'suspended' | 'expired' | 'error';
  tokens_limit?: number;
  tokens_used: number;
  tokens_remaining?: number;
  last_request_at?: string;
  expires_at?: string;
  metadata?: any;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiUsageLog {
  id: string;
  api_connection_id: string;
  endpoint: string;
  method: string;
  status_code?: number;
  response_time_ms?: number;
  tokens_consumed: number;
  error_message?: string;
  request_metadata?: any;
  created_at: string;
}

export interface ApiAlert {
  id: string;
  api_connection_id: string;
  alert_type: 'quota_exceeded' | 'suspicious_activity' | 'api_error' | 'expiring_soon';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  is_read: boolean;
  is_resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  metadata?: any;
  created_at: string;
}

export interface GuardAnalysisResult {
  apiId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  anomalies: string[];
  recommendations: string[];
  source: 'edge' | 'local';
}

export class ApiMonitoringService {
  /**
   * Récupère toutes les API connectées
   */
  static async getAllApiConnections(): Promise<ApiConnection[]> {
    try {
      const { data, error } = await supabase
        .from('api_connections')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ApiConnection[];
    } catch (error) {
      console.error('❌ Erreur récupération API:', error);
      toast.error('Erreur lors de la récupération des API');
      return [];
    }
  }

  /**
   * Ajoute une nouvelle connexion API
   */
  static async addApiConnection(connection: Partial<ApiConnection>): Promise<ApiConnection | null> {
    try {
      const { data, error } = await supabase
        .from('api_connections')
        .insert([connection as any])
        .select()
        .single();

      if (error) throw error;

      toast.success(`✅ API ${connection.api_name} ajoutée avec succès`);
      return data as ApiConnection;
    } catch (error) {
      console.error('❌ Erreur ajout API:', error);
      toast.error('Erreur lors de l\'ajout de l\'API');
      return null;
    }
  }

  /**
   * Met à jour une connexion API
   */
  static async updateApiConnection(id: string, updates: Partial<ApiConnection>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('api_connections')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast.success('✅ API mise à jour');
      return true;
    } catch (error) {
      console.error('❌ Erreur mise à jour API:', error);
      toast.error('Erreur lors de la mise à jour');
      return false;
    }
  }

  /**
   * Supprime une connexion API
   */
  static async deleteApiConnection(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('api_connections')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('✅ API supprimée');
      return true;
    } catch (error) {
      console.error('❌ Erreur suppression API:', error);
      toast.error('Erreur lors de la suppression');
      return false;
    }
  }

  /**
   * Récupère les logs d'utilisation d'une API
   */
  static async getApiUsageLogs(apiConnectionId: string, limit = 100): Promise<ApiUsageLog[]> {
    try {
      const { data, error } = await supabase
        .from('api_usage_logs')
        .select('*')
        .eq('api_connection_id', apiConnectionId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Erreur récupération logs:', error);
      return [];
    }
  }

  /**
   * Enregistre l'utilisation d'une API
   */
  static async logApiUsage(log: Partial<ApiUsageLog>): Promise<void> {
    try {
      const { error } = await supabase
        .from('api_usage_logs')
        .insert([log as any]);

      if (error) throw error;

      // Mettre à jour le compteur de tokens
      if (log.api_connection_id && log.tokens_consumed) {
        await this.incrementTokensUsed(log.api_connection_id, log.tokens_consumed);
      }
    } catch (error) {
      console.error('❌ Erreur log usage:', error);
    }
  }

  /**
   * Incrémente le nombre de tokens utilisés
   */
  private static async incrementTokensUsed(apiConnectionId: string, tokens: number): Promise<void> {
    try {
      const { data: connection } = await supabase
        .from('api_connections')
        .select('tokens_used')
        .eq('id', apiConnectionId)
        .single();

      if (connection) {
        await supabase
          .from('api_connections')
          .update({
            tokens_used: connection.tokens_used + tokens,
            last_request_at: new Date().toISOString()
          })
          .eq('id', apiConnectionId);
      }
    } catch (error) {
      console.error('❌ Erreur incrémentation tokens:', error);
    }
  }

  /**
   * Récupère les alertes non résolues
   */
  static async getUnresolvedAlerts(): Promise<ApiAlert[]> {
    try {
      const { data, error } = await supabase
        .from('api_alerts')
        .select('*')
        .eq('is_resolved', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ApiAlert[];
    } catch (error) {
      console.error('❌ Erreur récupération alertes:', error);
      return [];
    }
  }

  /**
   * Crée une nouvelle alerte
   */
  static async createAlert(alert: Partial<ApiAlert>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('api_alerts')
        .insert([alert as any]);

      if (error) throw error;

      // Afficher une notification selon la sévérité
      if (alert.severity === 'critical') {
        toast.error(`🚨 ${alert.title}`);
      } else if (alert.severity === 'high') {
        toast.warning(`⚠️ ${alert.title}`);
      }

      return true;
    } catch (error) {
      console.error('❌ Erreur création alerte:', error);
      return false;
    }
  }

  /**
   * Marque une alerte comme résolue
   */
  static async resolveAlert(alertId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('api_alerts')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: userId
        })
        .eq('id', alertId);

      if (error) throw error;
      toast.success('✅ Alerte résolue');
    } catch (error) {
      console.error('❌ Erreur résolution alerte:', error);
      toast.error('Erreur lors de la résolution');
    }
  }

  /**
   * 224Guard - Détection d'activité suspecte
   * Utilise le backend Node.js (guard:backend-first) avec fallback local
   */
  static async detect224GuardAnomalies(apiConnectionId: string): Promise<GuardAnalysisResult> {
    // 1) Preferred path: backend Node.js API
    try {
      const response = await backendFetch<GuardAnalysisResult>(
        `/api/v2/monitoring/guard-analyze?apiId=${encodeURIComponent(apiConnectionId)}`
      );
      if (response.success && response.data) {
        return { ...response.data, source: 'edge' };
      }
    } catch {
      // fall through to local analysis
    }

    // 2) Fallback path: local heuristic analysis to avoid total outage
    return this.detect224GuardAnomaliesFallback(apiConnectionId);
  }

  private static async detect224GuardAnomaliesFallback(apiConnectionId: string): Promise<GuardAnalysisResult> {
    try {
      // Récupérer les derniers logs
      const logs = await this.getApiUsageLogs(apiConnectionId, 100);

      if (logs.length === 0) {
        return {
          apiId: apiConnectionId,
          riskScore: 0,
          riskLevel: 'low',
          anomalies: [],
          recommendations: ['Aucune donnée de logs disponible pour analyse.'],
          source: 'local',
        };
      }

      let riskScore = 0;
      const anomalies: string[] = [];
      const recommendations: string[] = [];

      // Analyse 1: Taux d'erreur élevé (> 30%)
      const errorCount = logs.filter(log => log.status_code && log.status_code >= 400).length;
      const errorRate = (errorCount / logs.length) * 100;

      if (errorRate > 30) {
        const created = await this.createAlert({
          api_connection_id: apiConnectionId,
          alert_type: 'api_error',
          severity: 'high',
          title: '224Guard: Taux d\'erreur élevé détecté',
          message: `${errorRate.toFixed(1)}% d'erreurs détectées sur les 100 dernières requêtes`
        });
        if (created) {
          anomalies.push(`Taux d'erreur élevé: ${errorRate.toFixed(1)}%`);
          recommendations.push('Inspecter les endpoints en erreur et corriger les credentials/API keys.');
          riskScore += 40;
        }
      }

      // Analyse 2: Temps de réponse anormal
      const avgResponseTime = logs
        .filter(log => log.response_time_ms)
        .reduce((sum, log) => sum + (log.response_time_ms || 0), 0) / logs.length;

      if (avgResponseTime > 5000) { // > 5 secondes
        const created = await this.createAlert({
          api_connection_id: apiConnectionId,
          alert_type: 'suspicious_activity',
          severity: 'medium',
          title: '224Guard: Performances dégradées',
          message: `Temps de réponse moyen: ${avgResponseTime.toFixed(0)}ms`
        });
        if (created) {
          anomalies.push(`Temps de réponse élevé: ${avgResponseTime.toFixed(0)}ms`);
          recommendations.push('Réduire la latence réseau et vérifier la disponibilité du fournisseur API.');
          riskScore += 20;
        }
      }

      // Analyse 3: Consommation excessive de tokens
      const recentTokens = logs
        .filter(log => {
          const logDate = new Date(log.created_at);
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return logDate > oneDayAgo;
        })
        .reduce((sum, log) => sum + log.tokens_consumed, 0);

      if (recentTokens > 10000) {
        const created = await this.createAlert({
          api_connection_id: apiConnectionId,
          alert_type: 'suspicious_activity',
          severity: 'high',
          title: '224Guard: Consommation anormale détectée',
          message: `${recentTokens} tokens consommés en 24h`
        });
        if (created) {
          anomalies.push(`Consommation anormale: ${recentTokens} tokens/24h`);
          recommendations.push('Vérifier le throttling et les scripts automatiques consommateurs de quotas.');
          riskScore += 30;
        }
      }

      const riskLevel: GuardAnalysisResult['riskLevel'] =
        riskScore >= 80 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 20 ? 'medium' : 'low';

      return {
        apiId: apiConnectionId,
        riskScore,
        riskLevel,
        anomalies,
        recommendations,
        source: 'local',
      };
    } catch (error) {
      console.error('❌ Erreur 224Guard:', error);
      throw new Error('224Guard indisponible: impossible d\'analyser cette API pour le moment');
    }
  }

  /**
   * Vérifie les API qui vont expirer bientôt
   */
  static async checkExpiringApis(): Promise<void> {
    try {
      const { data: apis } = await supabase
        .from('api_connections')
        .select('*')
        .not('expires_at', 'is', null);

      if (!apis) return;

      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      for (const api of apis) {
        const expiresAt = new Date(api.expires_at!);

        if (expiresAt < sevenDaysFromNow && expiresAt > now) {
          const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          await this.createAlert({
            api_connection_id: api.id,
            alert_type: 'expiring_soon',
            severity: daysRemaining <= 3 ? 'critical' : 'medium',
            title: `API ${api.api_name} expire bientôt`,
            message: `Expire dans ${daysRemaining} jour(s)`
          });
        }
      }
    } catch (error) {
      console.error('❌ Erreur vérification expirations:', error);
    }
  }
}
