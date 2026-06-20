/**
 * Hook multi-cloud monitoring temps réel
 * Reads from monitoring_providers + monitoring_services + monitoring_incidents via Realtime
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { multiCloudHealth, type MultiCloudReport } from '@/services/MultiCloudHealthService';

export interface DbProvider {
  id: string;
  name: string;
  status: string;
  latency: number | null;
  error_rate: number;
  last_check: string | null;
  uptime_percent: number;
}

export interface DbService {
  id: string;
  name: string;
  display_name: string;
  provider_id: string;
  status: string;
  latency: number | null;
  error_rate: number;
  requests_per_minute: number;
  last_check: string | null;
  last_healthy_at: string | null;
  metadata: Record<string, any>;
}

export interface DbIncident {
  id: string;
  provider_id: string | null;
  service_id: string | null;
  severity: string;
  status: string;
  title: string;
  message: string;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
}

export function useMultiCloudHealth(autoRefreshMs = 30000) {
  const [report, setReport] = useState<MultiCloudReport | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [providers, setProviders] = useState<DbProvider[]>([]);
  const [services, setServices] = useState<DbService[]>([]);
  const [incidents, setIncidents] = useState<DbIncident[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setIsChecking(true);
    try {
      const r = await multiCloudHealth.checkAll();
      setReport(r);
      setLastUpdate(new Date());
    } catch (e) {
      console.error('[MultiCloudHealth] Error:', e);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const loadDb = useCallback(async () => {
    try {
      const [pRes, sRes, iRes] = await Promise.all([
        supabase.from('monitoring_providers' as any).select('*').order('name'),
        supabase.from('monitoring_services' as any).select('*').order('name'),
        supabase.from('monitoring_incidents' as any).select('*').eq('status', 'open').order('last_seen_at', { ascending: false }).limit(20),
      ]);
      if (pRes.data) setProviders(pRes.data as unknown as DbProvider[]);
      if (sRes.data) setServices(sRes.data as unknown as DbService[]);
      if (iRes.data) setIncidents(iRes.data as unknown as DbIncident[]);
    } catch (e) {
      console.error('[MultiCloudHealth] DB load error:', e);
    }
  }, []);

  useEffect(() => {
    refresh();
    loadDb();

    if (autoRefreshMs > 0) intervalRef.current = setInterval(() => { refresh(); loadDb(); }, autoRefreshMs);

    // Realtime on providers
    const provCh = supabase.channel('mc-providers-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monitoring_providers' }, (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          const u = payload.new as DbProvider;
          setProviders(prev => {
            const exists = prev.find(p => p.id === u.id);
            return exists ? prev.map(p => p.id === u.id ? u : p) : [...prev, u];
          });
          setLastUpdate(new Date());
        }
      }).subscribe();

    // Realtime on services
    const svcCh = supabase.channel('mc-services-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monitoring_services' }, (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          const u = payload.new as DbService;
          setServices(prev => {
            const exists = prev.find(s => s.id === u.id);
            return exists ? prev.map(s => s.id === u.id ? u : s) : [...prev, u];
          });
          setLastUpdate(new Date());
        }
      }).subscribe();

    // Realtime on incidents
    const incCh = supabase.channel('mc-incidents-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monitoring_incidents' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const incident = payload.new as DbIncident;
          if (incident.status === 'open') {
            setIncidents(prev => [incident, ...prev.filter(i => i.id !== incident.id)].slice(0, 20));
          }
        } else if (payload.eventType === 'UPDATE') {
          const u = payload.new as DbIncident;
          setIncidents(prev => {
            if (u.status !== 'open') {
              return prev.filter(i => i.id !== u.id);
            }

            const exists = prev.find(i => i.id === u.id);
            return exists ? prev.map(i => i.id === u.id ? u : i) : [u, ...prev].slice(0, 20);
          });
        }
        setLastUpdate(new Date());
      }).subscribe();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      supabase.removeChannel(provCh);
      supabase.removeChannel(svcCh);
      supabase.removeChannel(incCh);
    };
  }, [refresh, autoRefreshMs, loadDb]);

  return {
    report, isChecking, refresh,
    history: multiCloudHealth.getHistory(),
    providers, services, incidents, lastUpdate,
  };
}
