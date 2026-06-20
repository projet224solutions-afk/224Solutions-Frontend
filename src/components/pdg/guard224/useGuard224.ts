/**
 * Hook dashboard 224Guard (PDG).
 * - Charge la synthèse + les alertes via le backend (RLS admin).
 * - Poll périodique + écoute l'événement local `224guard:alert` (feedback instantané
 *   de la session courante, même avant qu'Ably/Supabase ne propagent).
 * - Actions admin : changer le statut d'une alerte (ACK/RESOLVED/FALSE_POSITIVE).
 */

import { useCallback, useEffect, useState } from 'react';
import { backendFetch } from '@/services/backendApi';

export type GuardSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface GuardAlertRow {
  id: string;
  client_id?: string;
  type: string;
  severity: GuardSeverity;
  pattern_key: string;
  label?: string;
  key_hash?: string;
  masked?: string;
  sources?: string[];
  locations?: string[];
  count?: number;
  status: string;
  created_at: string;
}

export interface GuardSummary {
  open_alerts: number;
  critical_open: number;
  alerts_last_hour: number;
  alerts_last_day: number;
  last_alert_at: string | null;
  current_risk_score: number | null;
}

function mapLocal(d: any): GuardAlertRow {
  return {
    id: d.id, type: d.type, severity: d.severity, pattern_key: d.patternKey,
    label: d.label, key_hash: d.keyHash, masked: d.masked, sources: d.sources,
    locations: d.locations, count: d.count, status: 'OPEN',
    created_at: new Date(d.createdAt || Date.now()).toISOString(),
  };
}

export function useGuard224(pollMs = 20_000) {
  const [summary, setSummary] = useState<GuardSummary | null>(null);
  const [alerts, setAlerts] = useState<GuardAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        backendFetch<unknown>('/api/v2/guard224/summary', { method: 'GET' }),
        backendFetch<unknown>('/api/v2/guard224/alerts', { method: 'GET' }),
      ]);
      if (s.success) setSummary((s as any).summary ?? null);
      if (a.success) setAlerts(((a as any).alerts as GuardAlertRow[]) ?? []);
      if (!s.success && !a.success) setError(s.error || a.error || 'Erreur de chargement');
      else setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), pollMs);
    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.id) return;
      setAlerts((prev) => {
        if (prev.some((x) => x.client_id === detail.id || x.id === detail.id)) return prev;
        return [mapLocal(detail), ...prev].slice(0, 500);
      });
    };
    window.addEventListener('224guard:alert', onLocal);
    return () => { clearInterval(id); window.removeEventListener('224guard:alert', onLocal); };
  }, [load, pollMs]);

  const setStatus = useCallback(async (id: string, status: string) => {
    await backendFetch(`/api/v2/guard224/alert/${id}/status`, { method: 'POST', body: { status } });
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }, []);

  /** Clôture en masse les faux positifs (défaut : entropie). Renvoie le nombre purgé. */
  const purge = useCallback(async (body: { pattern_key?: string; type?: string } = {}) => {
    const res = await backendFetch<{ purged: number }>('/api/v2/guard224/purge', { method: 'POST', body });
    await load();
    return res.success ? ((res as any).purged ?? 0) : 0;
  }, [load]);

  return { summary, alerts, loading, error, reload: load, setStatus, purge };
}
