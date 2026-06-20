/**
 * 🚗 Hooks MOBILITÉ — courses VTC & livraisons (dispatch + suivi temps réel + paiement).
 * Prestataire : créer/suivre/encaisser (espèces ou lien wallet). Client : payer en wallet.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { backendFetch, generateIdempotencyKey } from '@/services/backendApi';
import { toast } from 'sonner';

export type JobStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
export interface MobilityJob {
  id: string; professional_service_id: string; customer_user_id: string | null; customer_name: string | null;
  customer_phone: string | null; job_type: 'course' | 'livraison'; pickup: string | null; destination: string | null;
  vehicle_type: string | null; package_label: string | null; price: number; status: JobStatus;
  payment_method: 'cash' | 'wallet'; paid: boolean; created_at: string; completed_at: string | null;
}

export function useMobilityJobs(serviceId?: string, jobType: 'course' | 'livraison' = 'course') {
  const [jobs, setJobs] = useState<MobilityJob[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    const { data } = await supabase.from('mobility_jobs').select('*')
      .eq('professional_service_id', serviceId).eq('job_type', jobType).order('created_at', { ascending: false });
    setJobs((data as unknown as MobilityJob[]) ?? []);
    setLoading(false);
  }, [serviceId, jobType]);

  useEffect(() => {
    void load();
    if (!serviceId) return;
    const ch = supabase.channel(`mobility-${serviceId}-${jobType}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mobility_jobs', filter: `professional_service_id=eq.${serviceId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [serviceId, jobType, load]);

  const createJob = useCallback(async (payload: Partial<MobilityJob>) => {
    if (!serviceId) return null;
    const { data, error } = await supabase.from('mobility_jobs').insert({ ...payload, professional_service_id: serviceId, job_type: jobType } as any).select().single();
    if (error) { toast.error(error.message); return null; }
    toast.success(jobType === 'course' ? 'Course créée' : 'Livraison créée'); await load(); return data as MobilityJob;
  }, [serviceId, jobType, load]);

  const setStatus = useCallback(async (id: string, status: JobStatus) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)));
    const patch: any = { status };
    if (status === 'completed') patch.completed_at = new Date().toISOString();
    const { error } = await supabase.from('mobility_jobs').update(patch).eq('id', id);
    if (error) { toast.error(error.message); await load(); }
  }, [load]);

  const markCashPaid = useCallback(async (id: string) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, paid: true, status: 'completed' } : j)));
    await supabase.from('mobility_jobs').update({ paid: true, payment_method: 'cash', status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
  }, []);

  const stats = useMemo(() => ({
    active: jobs.filter((j) => ['pending', 'accepted', 'in_progress'].includes(j.status)).length,
    completed: jobs.filter((j) => j.status === 'completed').length,
    revenue: jobs.filter((j) => j.paid).reduce((s, j) => s + (j.price || 0), 0),
  }), [jobs]);

  return { jobs, loading, reload: load, createJob, setStatus, markCashPaid, stats };
}

/** Le client paie une course/livraison en wallet (atomique). */
export async function settleMobilityJob(jobId: string) {
  return backendFetch(`/api/v2/mobility/${jobId}/pay`, { method: 'POST', body: {}, idempotencyKey: generateIdempotencyKey() });
}

export async function getSharedMobilityJob(jobId: string) {
  const { data } = await supabase.rpc('get_shared_mobility_job', { p_job_id: jobId });
  return data as any;
}
