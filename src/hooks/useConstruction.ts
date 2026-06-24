/**
 * 🏗️ Hooks CONSTRUCTION/BTP — projets, journal de chantier (verrou 24h), jalons escrow.
 * Écritures argent (financer/libérer un jalon) via le backend (RPC atomiques durcies).
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';

export interface ConstructionProject {
  id: string; professional_service_id: string; client_user_id: string | null; name: string; client_name: string | null;
  description: string | null; location: string | null; budget: number; spent: number; progress_percent: number;
  status: 'planning' | 'in_progress' | 'late' | 'completed' | 'cancelled'; deadline: string | null; created_at: string;
}
export interface DailyLog {
  id: string; project_id: string; log_date: string; weather: string | null; workers: any[];
  description: string | null; photos: string[]; incidents: string | null; created_at: string;
}
export interface Milestone {
  id: string; project_id: string; title: string; amount: number; order_index: number;
  status: 'pending' | 'funded' | 'released' | 'cancelled'; funded_at: string | null; released_at: string | null;
}

export function useConstructionProjects(serviceId?: string) {
  const [projects, setProjects] = useState<ConstructionProject[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    const { data } = await supabase.from('construction_projects').select('*').eq('professional_service_id', serviceId).order('created_at', { ascending: false });
    setProjects((data as unknown as ConstructionProject[]) ?? []);
    setLoading(false);
  }, [serviceId]);
  useEffect(() => { void load(); }, [load]);

  const createProject = useCallback(async (payload: Partial<ConstructionProject>) => {
    if (!serviceId) return null;
    const { data, error } = await supabase.from('construction_projects').insert({ ...payload, professional_service_id: serviceId } as any).select().single();
    if (error) { toast.error(error.message); return null; }
    toast.success('Projet créé'); await load(); return data as ConstructionProject;
  }, [serviceId, load]);

  const updateProject = useCallback(async (id: string, patch: Partial<ConstructionProject>) => {
    const { error } = await supabase.from('construction_projects').update({ ...patch, updated_at: new Date().toISOString() } as any).eq('id', id);
    if (error) { toast.error(error.message); return false; }
    await load(); return true;
  }, [load]);

  return { projects, loading, reload: load, createProject, updateProject };
}

export function useProjectDetail(projectId?: string) {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    const [{ data: l }, { data: m }] = await Promise.all([
      supabase.from('construction_daily_logs').select('*').eq('project_id', projectId).order('log_date', { ascending: false }),
      supabase.from('construction_milestones').select('*').eq('project_id', projectId).order('order_index', { ascending: true }),
    ]);
    setLogs(((l as unknown as DailyLog[]) ?? []).map((x) => ({ ...x, photos: Array.isArray(x.photos) ? x.photos : [], workers: Array.isArray(x.workers) ? x.workers : [] })));
    setMilestones((m as unknown as Milestone[]) ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void load();
    if (!projectId) return;
    const ch = supabase.channel(`btp-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'construction_milestones', filter: `project_id=eq.${projectId}` }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'construction_daily_logs', filter: `project_id=eq.${projectId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [projectId, load]);

  const addLog = useCallback(async (payload: Partial<DailyLog>) => {
    if (!projectId) return false;
    const { error } = await supabase.from('construction_daily_logs').insert({
      ...payload,
      project_id: projectId,
      // S'assurer que log_date est toujours défini (date du jour si non fourni)
      log_date: payload.log_date || new Date().toISOString().split('T')[0],
    } as any);
    if (error) { toast.error(error.message); return false; }
    toast.success('Journal enregistré'); await load(); return true;
  }, [projectId, load]);

  const addMilestone = useCallback(async (title: string, amount: number, order_index: number) => {
    if (!projectId) return false;
    const { error } = await supabase.from('construction_milestones').insert({ project_id: projectId, title, amount, order_index } as any);
    if (error) { toast.error(error.message); return false; }
    toast.success('Jalon ajouté'); await load(); return true;
  }, [projectId, load]);

  const fundMilestone = useCallback(async (id: string) => {
    const res = await backendFetch(`/api/v2/construction/milestone/${id}/fund`, { method: 'POST', body: {} });
    if (res.success) { toast.success('Jalon financé (sous séquestre)'); await load(); } else toast.error(res.error || 'Erreur');
    return res.success;
  }, [load]);

  const releaseMilestone = useCallback(async (id: string) => {
    const res = await backendFetch(`/api/v2/construction/milestone/${id}/release`, { method: 'POST', body: {} });
    if (res.success) { toast.success('Jalon validé — paiement libéré au prestataire'); await load(); } else toast.error(res.error || 'Erreur');
    return res.success;
  }, [load]);

  return { logs, milestones, loading, reload: load, addLog, addMilestone, fundMilestone, releaseMilestone };
}

/** Un journal est verrouillé après 24h (intégrité juridique). */
export const isLogLocked = (log: DailyLog) => new Date(log.created_at).getTime() < Date.now() - 24 * 3600 * 1000;
