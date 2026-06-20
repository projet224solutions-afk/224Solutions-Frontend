/**
 * 🏠 Hooks LOCATION — baux, caution escrow et quittances de loyer.
 * Côté bailleur : liste des baux (temps réel) + libération de caution. Côté locataire :
 * démarrage de bail et paiement de loyer (atomiques backend).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { backendFetch, generateIdempotencyKey } from '@/services/backendApi';
import { toast } from 'sonner';

export interface RentalLease {
  id: string; property_id: string; professional_service_id: string; tenant_user_id: string | null;
  tenant_name: string | null; tenant_phone: string | null; monthly_rent: number; deposit_amount: number;
  deposit_status: 'none' | 'held' | 'released' | 'refunded'; start_date: string | null; end_date: string | null;
  lease_terms: string | null; status: 'active' | 'ended' | 'cancelled'; signed_at: string | null; created_at: string;
}
export interface RentPayment { id: string; lease_id: string; period_label: string; amount: number; receipt_code: string | null; paid_at: string; }

/** Baux du bailleur (temps réel) + quittances + libération de caution. */
export function useRentalLeases(serviceId?: string) {
  const [leases, setLeases] = useState<RentalLease[]>([]);
  const [payments, setPayments] = useState<RentPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!serviceId) { setLoading(false); return; }
    const { data: ls } = await supabase.from('rental_leases').select('*').eq('professional_service_id', serviceId).order('created_at', { ascending: false });
    const leaseRows = (ls as unknown as RentalLease[]) ?? [];
    setLeases(leaseRows);
    const ids = leaseRows.map((l) => l.id);
    if (ids.length) {
      const { data: ps } = await supabase.from('rent_payments').select('*').in('lease_id', ids).order('paid_at', { ascending: false });
      setPayments((ps as unknown as RentPayment[]) ?? []);
    } else setPayments([]);
    setLoading(false);
  }, [serviceId]);

  useEffect(() => {
    void load();
    if (!serviceId) return;
    const ch = supabase.channel(`rental-${serviceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rental_leases', filter: `professional_service_id=eq.${serviceId}` }, () => { void load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rent_payments' }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [serviceId, load]);

  const releaseDeposit = useCallback(async (leaseId: string, refund: boolean) => {
    const res = await backendFetch(`/api/v2/realestate/lease/${leaseId}/release-deposit`, { method: 'POST', body: { refund } });
    if (!res.success) { toast.error(res.error || 'Erreur'); return false; }
    toast.success(refund ? 'Caution remboursée au locataire' : 'Caution conservée'); await load(); return true;
  }, [load]);

  const stats = useMemo(() => ({
    active: leases.filter((l) => l.status === 'active').length,
    monthlyRevenue: leases.filter((l) => l.status === 'active').reduce((s, l) => s + (l.monthly_rent || 0), 0),
    depositsHeld: leases.filter((l) => l.deposit_status === 'held').reduce((s, l) => s + (l.deposit_amount || 0), 0),
  }), [leases]);

  return { leases, payments, loading, reload: load, releaseDeposit, stats };
}

/** Démarrer un bail (locataire) — caution escrow + 1er loyer, atomique. */
export async function startRentalLease(propertyId: string, opts: { deposit_months?: number; tenant_name?: string; tenant_phone?: string; start_date?: string; end_date?: string; terms?: string } = {}) {
  return backendFetch<{ lease_id: string; deposit: number; receipt: string }>('/api/v2/realestate/lease/start', {
    method: 'POST', body: { property_id: propertyId, ...opts }, idempotencyKey: generateIdempotencyKey(),
  });
}

/** Payer un loyer mensuel (locataire) — quittance auto. */
export async function payRent(leaseId: string, period: string) {
  return backendFetch<{ receipt: string }>(`/api/v2/realestate/lease/${leaseId}/pay-rent`, {
    method: 'POST', body: { period }, idempotencyKey: generateIdempotencyKey(),
  });
}
