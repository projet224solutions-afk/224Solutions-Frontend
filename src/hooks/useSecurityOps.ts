// 🛡️ Hook pour Security Operations
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SecurityIncident {
  id: string;
  incident_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
  title: string;
  description?: string;
  source_ip?: string;
  target_service?: string;
  detected_at: string;
  created_at: string;
}

export interface SecurityAlert {
  id: string;
  incident_id: string | null;
  alert_type: string;
  severity: string;
  message: string;
  description?: string;
  acknowledged: boolean;
  source: string | null;
  created_at: string;
  auto_actions?: any;
}

export interface BlockedIP {
  id: string;
  ip_address: string;
  reason: string;
  blocked_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export interface SecurityStats {
  total_incidents: number;
  critical_incidents: number;
  open_incidents: number;
  incidents_24h: number;
  total_alerts: number;
  pending_alerts: number;
  blocked_ips: number;
  active_blocks: number;
  avg_mttr_minutes: number;
  keys_need_rotation: number;
}

export function useSecurityOps(autoLoad?: boolean) {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [stats, setStats] = useState<SecurityStats>({
    total_incidents: 0,
    critical_incidents: 0,
    open_incidents: 0,
    incidents_24h: 0,
    total_alerts: 0,
    pending_alerts: 0,
    blocked_ips: 0,
    active_blocks: 0,
    avg_mttr_minutes: 0,
    keys_need_rotation: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Charger les incidents - gestion silencieuse des erreurs RLS
      const { data: incidentsData, error: incidentsError } = await supabase
        .from('security_incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      // Si erreur RLS ou réseau, retourner des données vides sans erreur
      if (incidentsError) {
        const isSilentError = incidentsError.message?.includes('permission') ||
                              incidentsError.message?.includes('policy') ||
                              incidentsError.message?.includes('Failed to fetch') ||
                              incidentsError.message?.includes('NetworkError') ||
                              incidentsError.code === '42501' ||
                              incidentsError.code === 'PGRST301';
        if (!isSilentError) {
          console.error('Erreur incidents:', incidentsError);
        }
      }

      const mappedIncidents: SecurityIncident[] = (incidentsData || []).map(i => ({
        id: i.id,
        incident_type: i.incident_type,
        severity: i.severity as 'critical' | 'high' | 'medium' | 'low',
        status: i.status as 'open' | 'investigating' | 'contained' | 'resolved' | 'closed',
        title: i.title,
        description: i.description || undefined,
        source_ip: (i.source_ip as string) || undefined,
        target_service: (i as any).target_service || undefined,
        detected_at: i.detected_at,
        created_at: i.created_at,
      }));
      setIncidents(mappedIncidents);

      // Charger les alertes
      const { data: alertsData, error: alertsError } = await supabase
        .from('security_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (alertsError) {
        const isSilentError = alertsError.message?.includes('permission') ||
                              alertsError.message?.includes('policy') ||
                              alertsError.message?.includes('Failed to fetch') ||
                              alertsError.message?.includes('NetworkError') ||
                              alertsError.code === '42501' ||
                              alertsError.code === 'PGRST301';
        if (!isSilentError) {
          console.error('Erreur alertes:', alertsError);
        }
      }

      const mappedAlerts: SecurityAlert[] = (alertsData || []).map(a => ({
        id: a.id,
        incident_id: a.incident_id,
        alert_type: a.alert_type,
        severity: a.severity,
        message: a.description,
        description: a.description,
        acknowledged: a.acknowledged,
        source: a.source,
        created_at: a.created_at,
        auto_actions: a.auto_actions
      }));
      setAlerts(mappedAlerts);

      // Charger les IPs bloquées - utiliser blocked_at (pas created_at)
      const { data: blockedData, error: blockedError } = await supabase
        .from('blocked_ips')
        .select('*')
        .order('blocked_at', { ascending: false })
        .limit(50);

      if (blockedError) {
        const isSilentError = blockedError.message?.includes('permission') ||
                              blockedError.message?.includes('policy') ||
                              blockedError.message?.includes('column') ||
                              blockedError.message?.includes('Failed to fetch') ||
                              blockedError.message?.includes('NetworkError') ||
                              blockedError.code === '42501' ||
                              blockedError.code === 'PGRST301' ||
                              blockedError.code === '42703';
        if (!isSilentError) {
          console.error('Erreur IPs bloquées:', blockedError);
        }
      }

      const mappedBlocked: BlockedIP[] = (blockedData || []).map(b => ({
        id: b.id,
        ip_address: String(b.ip_address),
        reason: b.reason,
        blocked_at: b.blocked_at,
        expires_at: b.expires_at,
        is_active: b.is_active
      }));
      setBlockedIPs(mappedBlocked);

      // Calculer les statistiques manuellement
      const totalIncidents = mappedIncidents.length;
      const criticalIncidents = mappedIncidents.filter(i => i.severity === 'critical').length;
      const openIncidents = mappedIncidents.filter(i => i.status === 'open').length;
      const incidents24h = mappedIncidents.filter(i => {
        const created = new Date(i.created_at);
        const now = new Date();
        return (now.getTime() - created.getTime()) < 24 * 60 * 60 * 1000;
      }).length;

      setStats({
        total_incidents: totalIncidents,
        critical_incidents: criticalIncidents,
        open_incidents: openIncidents,
        incidents_24h: incidents24h,
        total_alerts: mappedAlerts.length,
        pending_alerts: mappedAlerts.filter(a => !a.acknowledged).length,
        blocked_ips: mappedBlocked.length,
        active_blocks: mappedBlocked.filter(b => {
          if (!b.expires_at) return true;
          return new Date(b.expires_at) > new Date();
        }).length,
        avg_mttr_minutes: 0,
        keys_need_rotation: 0,
      });

      // Ne pas afficher de toast de succès (trop verbeux)
    } catch (err: any) {
      // Ne pas afficher de toast pour les erreurs RLS (utilisateur non-admin) ou réseau
      const errorMessage = err?.message || 'Erreur inconnue';
      const isSilentError = errorMessage.includes('permission') ||
                            errorMessage.includes('policy') ||
                            errorMessage.includes('RLS') ||
                            errorMessage.includes('Failed to fetch') ||
                            errorMessage.includes('NetworkError') ||
                            errorMessage.includes('fetch') ||
                            err?.code === '42501' ||
                            err?.code === 'PGRST301';

      if (!isSilentError) {
        console.error('Erreur chargement données sécurité:', err);
        toast.error('Erreur lors du chargement des données de sécurité');
      }
      setError(isSilentError ? null : errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      loadData();
    }
  }, [autoLoad, loadData]);

  const loadSecurityData = loadData;

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('security_alerts')
        .update({ acknowledged: true })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(alerts.map(a =>
        a.id === alertId ? { ...a, acknowledged: true } : a
      ));

      toast.success('Alerte reconnue');
      return true;
    } catch (err: any) {
      console.error('Erreur reconnaissance alerte:', err);
      toast.error('Erreur lors de la reconnaissance de l\'alerte');
      return false;
    }
  };

  const createIncident = async (data: any) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('security-incident-response', {
        body: {
          action: 'create',
          ...data
        }
      });

      if (error) throw error;

      toast.success('Incident créé avec succès');
      await loadData();
      return result;
    } catch (err: any) {
      console.error('Erreur création incident:', err);
      toast.error('Erreur lors de la création de l\'incident');
      return null;
    }
  };

  const containIncident = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke('security-incident-response', {
        body: {
          action: 'contain',
          incidentId: id
        }
      });

      if (error) throw error;

      setIncidents(incidents.map(i =>
        i.id === id ? { ...i, status: 'contained' as const } : i
      ));

      toast.success('Incident contenu');
      return true;
    } catch (err: any) {
      console.error('Erreur containment incident:', err);
      toast.error('Erreur lors du containment de l\'incident');
      return false;
    }
  };

  const resolveIncident = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke('security-incident-response', {
        body: {
          action: 'resolve',
          incidentId: id
        }
      });

      if (error) throw error;

      setIncidents(incidents.map(i =>
        i.id === id ? { ...i, status: 'resolved' as const } : i
      ));

      toast.success('Incident résolu');
      return true;
    } catch (err: any) {
      console.error('Erreur résolution incident:', err);
      toast.error('Erreur lors de la résolution de l\'incident');
      return false;
    }
  };

  const blockIP = async (ip: string, reason: string) => {
    try {
      // Upsert direct (ip_address UNIQUE ; le RPC block_ip_address est désynchronisé du schéma réel).
      const { error } = await supabase.from('blocked_ips').upsert({
        ip_address: ip,
        reason,
        is_active: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'ip_address' });

      if (error) throw error;

      toast.success(`IP ${ip} bloquée`);
      await loadData();
      return true;
    } catch (err: any) {
      console.error('Erreur blocage IP:', err);
      toast.error('Erreur lors du blocage de l\'IP');
      return false;
    }
  };

  const unblockIP = async (id: string) => {
    try {
      const { error } = await supabase
        .from('blocked_ips')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setBlockedIPs(blockedIPs.filter(b => b.id !== id));
      toast.success('IP débloquée');
      return true;
    } catch (err: any) {
      console.error('Erreur déblocage IP:', err);
      toast.error('Erreur lors du déblocage de l\'IP');
      return false;
    }
  };

  const detectAnomaly = async (data?: any) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('security-detect-anomaly', {
        body: data || {}
      });

      if (error) throw error;

      if (result?.detected) {
        toast.warning('Anomalie détectée !');
      } else {
        toast.success('Aucune anomalie détectée');
      }

      await loadData();
      return result;
    } catch (err: any) {
      console.error('Erreur détection anomalie:', err);
      toast.error('Erreur lors de la détection d\'anomalie');
      return null;
    }
  };

  return {
    incidents,
    alerts,
    blockedIPs,
    stats,
    loading,
    error,
    loadData,
    loadSecurityData,
    acknowledgeAlert,
    createIncident,
    containIncident,
    resolveIncident,
    blockIP,
    unblockIP,
    detectAnomaly,
  };
}
