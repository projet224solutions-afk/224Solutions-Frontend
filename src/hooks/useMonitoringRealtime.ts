/**
 * MONITORING REALTIME HOOK
 * Subscribes to monitoring_alerts and monitoring_service_status via Supabase Realtime
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { healthCheckEngine } from '@/services/monitoring/HealthCheckEngine';
import { backendFetch } from '@/services/backendApi';

export interface MonitoringAlert {
  id: string;
  alert_type: string;
  severity: string;
  source: string;
  title: string;
  message: string;
  metadata: Record<string, any>;
  status: string;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  auto_action_taken: string | null;
  created_at: string;
}

export interface ServiceStatus {
  id: string;
  service_name: string;
  display_name: string;
  status: string;
  last_check_at: string;
  last_healthy_at: string | null;
  response_time_ms: number | null;
  error_rate: number;
  uptime_percent: number;
  metadata: Record<string, any>;
  updated_at: string;
}

export interface MonitoringStats {
  totalAlerts: number;
  criticalAlerts: number;
  highAlerts: number;
  openAlerts: number;
  healthyServices: number;
  degradedServices: number;
  criticalServices: number;
  totalServices: number;
  overallStatus: 'healthy' | 'degraded' | 'critical' | 'unknown';
}

export function useMonitoringRealtime() {
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      const [alertsRes, servicesRes] = await Promise.all([
        supabase.from('monitoring_alerts' as any).select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('monitoring_service_status' as any).select('*').order('service_name'),
      ]);

      if (alertsRes.data) setAlerts(alertsRes.data as unknown as MonitoringAlert[]);
      if (servicesRes.data) setServices(servicesRes.data as unknown as ServiceStatus[]);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('[Monitoring] Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Actions
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    const { error } = await supabase.from('monitoring_alerts' as any).update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: (await supabase.auth.getUser()).data.user?.id,
    }).eq('id', alertId);
    if (!error) {
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'acknowledged', acknowledged_at: new Date().toISOString() } : a));
    }
    return !error;
  }, []);

  const resolveAlert = useCallback(async (alertId: string) => {
    const { error } = await supabase.from('monitoring_alerts' as any).update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: (await supabase.auth.getUser()).data.user?.id,
    }).eq('id', alertId);
    if (!error) {
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'resolved', resolved_at: new Date().toISOString() } : a));
    }
    return !error;
  }, []);

  const forceHealthCheck = useCallback(async () => {
    const response = await backendFetch('/api/core/supervision/run-check', {
      method: 'POST',
    });

    // Fallback client-side check if backend trigger is unavailable.
    if (!response.success) {
      await healthCheckEngine.runAllChecks();
    }

    await loadData();
  }, [loadData]);

  // Computed stats
  const stats: MonitoringStats = {
    totalAlerts: alerts.length,
    criticalAlerts: alerts.filter(a => a.severity === 'critical' && a.status === 'open').length,
    highAlerts: alerts.filter(a => a.severity === 'high' && a.status === 'open').length,
    openAlerts: alerts.filter(a => a.status === 'open').length,
    healthyServices: services.filter(s => s.status === 'healthy').length,
    degradedServices: services.filter(s => s.status === 'degraded').length,
    criticalServices: services.filter(s => s.status === 'critical').length,
    totalServices: services.length,
    overallStatus: services.some(s => s.status === 'critical') ? 'critical'
      : services.some(s => s.status === 'degraded') ? 'degraded'
      : services.every(s => s.status === 'unknown') ? 'unknown'
      : 'healthy',
  };

  useEffect(() => {
    loadData();

    // Start health check engine
    healthCheckEngine.start();

    // Realtime subscription on alerts
    const alertChannel = supabase
      .channel('monitoring-alerts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monitoring_alerts' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAlerts(prev => [payload.new as MonitoringAlert, ...prev].slice(0, 100));
        } else if (payload.eventType === 'UPDATE') {
          setAlerts(prev => prev.map(a => a.id === (payload.new as any).id ? payload.new as MonitoringAlert : a));
        }
        setLastRefresh(new Date());
      })
      .subscribe();

    // Realtime on service status
    const statusChannel = supabase
      .channel('monitoring-services-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monitoring_service_status' }, (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          setServices(prev => {
            const updated = payload.new as ServiceStatus;
            const exists = prev.find(s => s.service_name === updated.service_name);
            if (exists) return prev.map(s => s.service_name === updated.service_name ? updated : s);
            return [...prev, updated];
          });
        }
        setLastRefresh(new Date());
      })
      .subscribe();

    // Polling fallback for metrics (every 15s)
    pollingRef.current = setInterval(loadData, 15_000);

    return () => {
      supabase.removeChannel(alertChannel);
      supabase.removeChannel(statusChannel);
      healthCheckEngine.stop();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadData]);

  return {
    alerts,
    services,
    stats,
    loading,
    lastRefresh,
    acknowledgeAlert,
    resolveAlert,
    forceHealthCheck,
    refreshData: loadData,
  };
}
