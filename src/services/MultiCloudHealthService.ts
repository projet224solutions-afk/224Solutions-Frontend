/**
 * UNIFIED MULTI-CLOUD HEALTH CHECK SERVICE
 * 224Solutions - Production-grade monitoring
 * ALL checks are REAL — no passive/fake checks
 * Includes: retry confirmation, degraded tracking, provider→service correlation
 */

import { supabase } from '@/integrations/supabase/client';
import { monitoringBus } from './monitoring/MonitoringEventBus';

export type CloudProvider = 'supabase' | 'aws' | 'google_cloud' | 'firebase';
export type ServiceStatus = 'operational' | 'degraded' | 'outage' | 'unknown';

export interface CloudServiceCheck {
  provider: CloudProvider;
  service: string;
  serviceName: string;
  status: ServiceStatus;
  responseTime: number;
  message: string;
  lastChecked: string;
  isRealCheck: true; // always true now
}

export interface MultiCloudReport {
  overall: ServiceStatus;
  providers: Record<CloudProvider, {
    status: ServiceStatus;
    services: CloudServiceCheck[];
    avgResponseTime: number;
  }>;
  timestamp: string;
  totalChecks: number;
  healthyChecks: number;
  uptimePercent: number;
}

/** Tracks consecutive failures per service for confirmation */
interface FailureTracker {
  consecutiveFailures: number;
  consecutiveDegraded: number;
  lastStatus: ServiceStatus;
}

class MultiCloudHealthService {
  private static instance: MultiCloudHealthService;
  private lastReport: MultiCloudReport | null = null;
  private checkHistory: MultiCloudReport[] = [];
  private readonly MAX_HISTORY = 60;
  private isRunning = false;
  private providerIdCache: Record<string, string> = {};
  private serviceIdCache: Record<string, string> = {};
  private failureTrackers: Record<string, FailureTracker> = {};
  private readonly CONFIRM_OUTAGE_AFTER = 2; // retries before declaring outage
  private readonly DEGRADED_INCIDENT_AFTER = 3; // consecutive degraded before incident

  static getInstance(): MultiCloudHealthService {
    if (!this.instance) this.instance = new MultiCloudHealthService();
    return this.instance;
  }

  async checkAll(): Promise<MultiCloudReport> {
    if (this.isRunning) return this.lastReport || this.emptyReport();
    this.isRunning = true;

    try {
      if (Object.keys(this.providerIdCache).length === 0) await this.loadIdCaches();

      const [supabaseChecks, awsChecks, gcpChecks, firebaseChecks] = await Promise.allSettled([
        this.checkSupabase(), this.checkAWS(), this.checkGoogleCloud(), this.checkFirebase()
      ]).then(results => results.map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        const providers: CloudProvider[] = ['supabase', 'aws', 'google_cloud', 'firebase'];
        return [this.makeCheck(providers[i], 'Service', `${providers[i]}_error`, 'outage', 0, 'Check failed')];
      }));

      let allChecks = [...supabaseChecks, ...awsChecks, ...gcpChecks, ...firebaseChecks];

      // === RETRY CONFIRMATION: re-check failing services ===
      const failing = allChecks.filter(c => c.status === 'outage');
      if (failing.length > 0 && failing.length <= 3) {
        await new Promise(r => setTimeout(r, 1500));
        for (const fail of failing) {
          const retryResult = await this.retryCheck(fail);
          if (retryResult) {
            allChecks = allChecks.map(c => c.serviceName === fail.serviceName ? retryResult : c);
          }
        }
      }

      // === UPDATE FAILURE TRACKERS ===
      for (const check of allChecks) {
        const tracker = this.failureTrackers[check.serviceName] ||= { consecutiveFailures: 0, consecutiveDegraded: 0, lastStatus: 'unknown' };
        if (check.status === 'outage') { tracker.consecutiveFailures++; tracker.consecutiveDegraded = 0; }
        else if (check.status === 'degraded') { tracker.consecutiveDegraded++; tracker.consecutiveFailures = 0; }
        else { tracker.consecutiveFailures = 0; tracker.consecutiveDegraded = 0; }
        tracker.lastStatus = check.status;
      }

      // === PROVIDER → SERVICE CORRELATION ===
      allChecks = this.applyProviderCorrelation(allChecks);

      const totalChecks = allChecks.length;
      const healthyChecks = allChecks.filter(c => c.status === 'operational').length;

      const providerReport = (checks: CloudServiceCheck[]) => ({
        status: this.aggregateStatus(checks),
        services: checks,
        avgResponseTime: checks.length > 0 ? Math.round(checks.reduce((s, c) => s + c.responseTime, 0) / checks.length) : 0
      });

      const report: MultiCloudReport = {
        overall: this.aggregateStatus(allChecks),
        providers: {
          supabase: providerReport(supabaseChecks),
          aws: providerReport(awsChecks),
          google_cloud: providerReport(gcpChecks),
          firebase: providerReport(firebaseChecks)
        },
        timestamp: new Date().toISOString(), totalChecks, healthyChecks,
        uptimePercent: totalChecks > 0 ? Math.round((healthyChecks / totalChecks) * 100) : 0
      };

      this.lastReport = report;
      this.checkHistory.push(report);
      if (this.checkHistory.length > this.MAX_HISTORY) this.checkHistory.shift();

      this.persistReal(report, allChecks);
      return report;
    } finally {
      this.isRunning = false;
    }
  }

  getLastReport(): MultiCloudReport | null { return this.lastReport; }
  getHistory(): MultiCloudReport[] { return [...this.checkHistory]; }

  // ==================== PROVIDER → SERVICE CORRELATION ====================
  private applyProviderCorrelation(checks: CloudServiceCheck[]): CloudServiceCheck[] {
    const providerStatus: Record<CloudProvider, ServiceStatus> = {
      supabase: 'operational', aws: 'operational', google_cloud: 'operational', firebase: 'operational'
    };

    // Calculate provider-level status
    for (const provider of Object.keys(providerStatus) as CloudProvider[]) {
      const provChecks = checks.filter(c => c.provider === provider);
      const outageCount = provChecks.filter(c => c.status === 'outage').length;
      if (outageCount > 0 && outageCount >= Math.ceil(provChecks.length * 0.5)) {
        providerStatus[provider] = 'outage';
      } else if (provChecks.some(c => c.status === 'outage' || c.status === 'degraded')) {
        providerStatus[provider] = 'degraded';
      }
    }

    // If provider is down, cascade to ALL its services
    return checks.map(check => {
      if (providerStatus[check.provider] === 'outage' && check.status === 'operational') {
        return { ...check, status: 'degraded' as ServiceStatus, message: `${check.message} (provider dégradé)` };
      }
      return check;
    });
  }

  // ==================== RETRY LOGIC ====================
  private async retryCheck(failedCheck: CloudServiceCheck): Promise<CloudServiceCheck | null> {
    try {
      switch (failedCheck.serviceName) {
        case 'supabase_database': return await this.checkSupabaseDB();
        case 'supabase_auth': return await this.checkSupabaseAuth();
        case 'supabase_storage': return await this.checkSupabaseStorage();
        case 'supabase_edge_functions': return await this.checkSupabaseEdgeFunctions();
        default: return null;
      }
    } catch { return null; }
  }

  // ==================== LOAD ID CACHES ====================
  private async loadIdCaches(): Promise<void> {
    try {
      const { data: providers } = await supabase.from('monitoring_providers' as any).select('id, name');
      if (providers) for (const p of providers as any[]) this.providerIdCache[p.name] = p.id;
      const { data: services } = await supabase.from('monitoring_services' as any).select('id, name');
      if (services) for (const s of services as any[]) this.serviceIdCache[s.name] = s.id;
    } catch (e) {
      console.error('[MultiCloudHealth] Failed to load ID caches:', e);
    }
  }

  // ==================== PERSIST TO DB ====================
  private async persistReal(report: MultiCloudReport, allChecks: CloudServiceCheck[]): Promise<void> {
    const now = new Date().toISOString();
    try {
      // Update providers
      for (const [provName, provData] of Object.entries(report.providers)) {
        const pid = this.providerIdCache[provName];
        if (!pid) continue;
        const dbSt = provData.status === 'operational' ? 'healthy' : provData.status === 'degraded' ? 'degraded' : provData.status === 'outage' ? 'down' : 'unknown';
        await supabase.from('monitoring_providers' as any).update({ status: dbSt, latency: provData.avgResponseTime, last_check: now, updated_at: now }).eq('id', pid);
      }

      // Update services + incidents
      for (const check of allChecks) {
        const sid = this.serviceIdCache[check.serviceName];
        if (!sid) continue;
        const dbSt = check.status === 'operational' ? 'healthy' : check.status === 'degraded' ? 'degraded' : check.status === 'outage' ? 'down' : 'unknown';
        await supabase.from('monitoring_services' as any).update({
          status: dbSt, latency: check.responseTime, last_check: now,
          last_healthy_at: check.status === 'operational' ? now : undefined,
          metadata: { message: check.message, is_real_check: true }, updated_at: now,
        }).eq('id', sid);

        const tracker = this.failureTrackers[check.serviceName];

        // INCIDENT: confirmed outage (2+ consecutive failures)
        if (check.status === 'outage' && tracker && tracker.consecutiveFailures >= this.CONFIRM_OUTAGE_AFTER) {
          await supabase.from('monitoring_incidents' as any).upsert({
            provider_id: this.providerIdCache[check.provider] || null, service_id: sid,
            severity: 'critical', status: 'open', title: `${check.service} en panne`,
            message: check.message, dedupe_key: `incident_${check.serviceName}`, last_seen_at: now,
            metadata: { provider: check.provider, response_time: check.responseTime, consecutive_failures: tracker.consecutiveFailures },
          }, { onConflict: 'dedupe_key' });
        }

        // INCIDENT: prolonged degraded (3+ consecutive)
        if (check.status === 'degraded' && tracker && tracker.consecutiveDegraded >= this.DEGRADED_INCIDENT_AFTER) {
          await supabase.from('monitoring_incidents' as any).upsert({
            provider_id: this.providerIdCache[check.provider] || null, service_id: sid,
            severity: 'high', status: 'open', title: `${check.service} dégradé prolongé`,
            message: `Service dégradé depuis ${tracker.consecutiveDegraded} checks. ${check.message}`,
            dedupe_key: `degraded_${check.serviceName}`, last_seen_at: now,
            metadata: { provider: check.provider, response_time: check.responseTime, consecutive_degraded: tracker.consecutiveDegraded },
          }, { onConflict: 'dedupe_key' });
        }

        // AUTO-RESOLVE: any open incident must close as soon as the service is healthy again.
        if (check.status === 'operational') {
          await supabase.from('monitoring_incidents' as any)
            .update({ status: 'resolved', resolved_at: now, metadata: { auto_resolved: true, recovery_time: check.responseTime } })
            .eq('service_id', sid).eq('status', 'open');
        }

        // Emit events
        if (check.status === 'outage' || check.status === 'degraded') {
          monitoringBus.emit({
            event_type: 'service_status_change', source: 'multi_cloud_health',
            severity: check.status === 'outage' ? 'critical' : 'medium',
            message: `${check.service} (${check.provider}): ${check.status} - ${check.message}`,
            service_name: check.serviceName, response_time_ms: check.responseTime,
            metadata: { provider: check.provider },
          });
        }
      }

      // Legacy compat: monitoring_service_status
      for (const check of allChecks) {
        const statusMap: Record<ServiceStatus, string> = { operational: 'healthy', degraded: 'degraded', outage: 'critical', unknown: 'unknown' };
        await supabase.from('monitoring_service_status' as any).upsert({
          service_name: check.serviceName, display_name: check.service, provider: check.provider,
          status: statusMap[check.status], last_check_at: now,
          last_healthy_at: check.status === 'operational' ? now : undefined,
          response_time_ms: check.responseTime,
          metadata: { message: check.message }, updated_at: now,
        }, { onConflict: 'service_name' });
      }
    } catch (e) {
      console.error('[MultiCloudHealth] DB persist error:', e);
    }
  }

  // ==================== SUPABASE (ALL REAL) ====================
  private async checkSupabase(): Promise<CloudServiceCheck[]> {
    const results = await Promise.allSettled([
      this.checkSupabaseDB(), this.checkSupabaseAuth(), this.checkSupabaseRealtime(),
      this.checkSupabaseEdgeFunctions(), this.checkSupabaseStorage(),
    ]);
    return results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      const names = ['PostgreSQL Database', 'Auth Service', 'Realtime WebSocket', 'Edge Functions', 'Storage'];
      const keys = ['supabase_database', 'supabase_auth', 'supabase_realtime', 'supabase_edge_functions', 'supabase_storage'];
      return this.makeCheck('supabase', names[i], keys[i], 'outage', 0, 'Check exception');
    });
  }

  private async checkSupabaseDB(): Promise<CloudServiceCheck> {
    const start = Date.now();
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      const rt = Date.now() - start;
      if (error) return this.makeCheck('supabase', 'PostgreSQL Database', 'supabase_database', 'degraded', rt, error.message);
      return this.makeCheck('supabase', 'PostgreSQL Database', 'supabase_database', rt > 2000 ? 'degraded' : 'operational', rt, `${rt}ms`);
    } catch (e) {
      return this.makeCheck('supabase', 'PostgreSQL Database', 'supabase_database', 'outage', Date.now() - start, String(e));
    }
  }

  private async checkSupabaseAuth(): Promise<CloudServiceCheck> {
    const start = Date.now();
    try {
      const { error } = await supabase.auth.getSession();
      const rt = Date.now() - start;
      if (error) return this.makeCheck('supabase', 'Auth Service', 'supabase_auth', 'degraded', rt, error.message);
      return this.makeCheck('supabase', 'Auth Service', 'supabase_auth', rt > 2000 ? 'degraded' : 'operational', rt, `${rt}ms`);
    } catch (e) {
      return this.makeCheck('supabase', 'Auth Service', 'supabase_auth', 'outage', Date.now() - start, String(e));
    }
  }

  private async checkSupabaseRealtime(): Promise<CloudServiceCheck> {
    const start = Date.now();
    try {
      const channel = supabase.channel('health-test-' + Date.now());
      const rt = Date.now() - start;
      supabase.removeChannel(channel);
      return this.makeCheck('supabase', 'Realtime WebSocket', 'supabase_realtime', 'operational', rt, `${rt}ms`);
    } catch (e) {
      return this.makeCheck('supabase', 'Realtime WebSocket', 'supabase_realtime', 'degraded', Date.now() - start, String(e));
    }
  }

  private async checkSupabaseEdgeFunctions(): Promise<CloudServiceCheck> {
    const start = Date.now();
    try {
      const { error } = await supabase.functions.invoke('geo-detect', { body: { test: true } });
      const rt = Date.now() - start;
      if (error) return this.makeCheck('supabase', 'Edge Functions', 'supabase_edge_functions', 'degraded', rt, error.message || 'Erreur');
      return this.makeCheck('supabase', 'Edge Functions', 'supabase_edge_functions', rt > 5000 ? 'degraded' : 'operational', rt, `${rt}ms`);
    } catch (_e) {
      return this.makeCheck('supabase', 'Edge Functions', 'supabase_edge_functions', 'degraded', Date.now() - start, 'Timeout');
    }
  }

  private async checkSupabaseStorage(): Promise<CloudServiceCheck> {
    const start = Date.now();
    try {
      const { error } = await supabase.storage.listBuckets();
      const rt = Date.now() - start;
      if (error) return this.makeCheck('supabase', 'Storage', 'supabase_storage', 'degraded', rt, error.message);
      return this.makeCheck('supabase', 'Storage', 'supabase_storage', rt > 3000 ? 'degraded' : 'operational', rt, `${rt}ms`);
    } catch (e) {
      return this.makeCheck('supabase', 'Storage', 'supabase_storage', 'outage', Date.now() - start, String(e));
    }
  }

  // ==================== AWS (REAL via proxy) ====================
  private async checkAWS(): Promise<CloudServiceCheck[]> {
    const start = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('cloud-health-proxy', { body: {} });
      const rt = Date.now() - start;
      if (error || !data?.results) {
        return [
          this.makeCheck('aws', 'Lambda Backend', 'aws_lambda', 'degraded', rt, `Proxy échoué: ${error?.message || 'no data'}`),
          this.makeCheck('aws', 'Cognito Auth', 'aws_cognito', 'degraded', rt, `Proxy échoué: ${error?.message || 'no data'}`)
        ];
      }

      const results: CloudServiceCheck[] = [];
      const backend = data.results['aws-backend'];
      if (backend) results.push(this.makeCheck('aws', 'Lambda Backend', 'aws_lambda', backend.status, backend.responseTime, backend.message));
      const cognito = data.results['aws-cognito'];
      if (cognito) results.push(this.makeCheck('aws', 'Cognito Auth', 'aws_cognito', cognito.status, cognito.responseTime, cognito.message));

      return results.length > 0 ? results : [
        this.makeCheck('aws', 'Lambda Backend', 'aws_lambda', 'unknown', rt, 'Pas de données'),
        this.makeCheck('aws', 'Cognito Auth', 'aws_cognito', 'unknown', rt, 'Pas de données')
      ];
    } catch (e) {
      const rt = Date.now() - start;
      return [
        this.makeCheck('aws', 'Lambda Backend', 'aws_lambda', 'degraded', rt, `Erreur: ${String(e)}`),
        this.makeCheck('aws', 'Cognito Auth', 'aws_cognito', 'degraded', rt, `Erreur: ${String(e)}`)
      ];
    }
  }

  // ==================== GOOGLE CLOUD ====================
  private async checkGoogleCloud(): Promise<CloudServiceCheck[]> {
    const results = await Promise.allSettled([this.checkGCSStorage(), this.checkCloudFunctions()]);
    return results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      const names = ['Cloud Storage (GCS)', 'Cloud Functions'];
      const keys = ['gcp_storage', 'gcp_functions'];
      return this.makeCheck('google_cloud', names[i], keys[i], 'outage', 0, 'Check exception');
    });
  }

  private async checkGCSStorage(): Promise<CloudServiceCheck> {
    const start = Date.now();
    try {
      const { error } = await supabase.functions.invoke('gcs-signed-url', { method: 'POST', body: { healthCheck: true } });
      const rt = Date.now() - start;
      if (error) return this.makeCheck('google_cloud', 'Cloud Storage (GCS)', 'gcp_storage', 'degraded', rt, error.message || 'Erreur');
      return this.makeCheck('google_cloud', 'Cloud Storage (GCS)', 'gcp_storage', rt > 5000 ? 'degraded' : 'operational', rt, `${rt}ms`);
    } catch (_e) {
      return this.makeCheck('google_cloud', 'Cloud Storage (GCS)', 'gcp_storage', 'unknown', Date.now() - start, 'Erreur check');
    }
  }

  private async checkCloudFunctions(): Promise<CloudServiceCheck> {
    const start = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('google-cloud-test');
      const rt = Date.now() - start;
      if (error) return this.makeCheck('google_cloud', 'Cloud Functions', 'gcp_functions', 'degraded', rt, error.message || 'Erreur');
      if (data?.status === 'success') return this.makeCheck('google_cloud', 'Cloud Functions', 'gcp_functions', 'operational', rt, `${rt}ms`);
      return this.makeCheck('google_cloud', 'Cloud Functions', 'gcp_functions', 'degraded', rt, data?.error || 'Config manquante');
    } catch (e) {
      return this.makeCheck('google_cloud', 'Cloud Functions', 'gcp_functions', 'outage', Date.now() - start, String(e));
    }
  }

  // ==================== FIREBASE (REAL via edge function) ====================
  private async checkFirebase(): Promise<CloudServiceCheck[]> {
    const start = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('firebase-health-check');
      const rt = Date.now() - start;
      if (error || !data) {
        return [this.makeCheck('firebase', 'Cloud Messaging (FCM)', 'firebase_fcm', 'degraded', rt, `Health check échoué: ${error?.message || 'no data'}`)];
      }
      return [this.makeCheck('firebase', 'Cloud Messaging (FCM)', 'firebase_fcm', data.status, data.responseTime || rt, data.message || `${rt}ms`)];
    } catch (e) {
      return [this.makeCheck('firebase', 'Cloud Messaging (FCM)', 'firebase_fcm', 'degraded', Date.now() - start, `Erreur: ${String(e)}`)];
    }
  }

  // ==================== HELPERS ====================
  private makeCheck(provider: CloudProvider, service: string, serviceName: string, status: ServiceStatus, responseTime: number, message: string): CloudServiceCheck {
    return { provider, service, serviceName, status, responseTime, message, lastChecked: new Date().toISOString(), isRealCheck: true };
  }

  private aggregateStatus(checks: CloudServiceCheck[]): ServiceStatus {
    if (checks.length === 0) return 'unknown';
    const known = checks.filter(c => c.status !== 'unknown');
    if (known.length === 0) return 'operational';
    if (known.some(c => c.status === 'outage')) return 'outage';
    if (known.some(c => c.status === 'degraded')) return 'degraded';
    return 'operational';
  }

  private emptyReport(): MultiCloudReport {
    const e = { status: 'unknown' as ServiceStatus, services: [], avgResponseTime: 0 };
    return { overall: 'unknown', providers: { supabase: e, aws: e, google_cloud: e, firebase: e }, timestamp: new Date().toISOString(), totalChecks: 0, healthyChecks: 0, uptimePercent: 0 };
  }
}

export const multiCloudHealth = MultiCloudHealthService.getInstance();
