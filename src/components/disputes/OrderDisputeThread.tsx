/**
 * Wrapper : à partir d'une commande, retrouve le litige escrow associé et affiche
 * le fil tripartite avec le bon rôle (client ou vendeur). N'affiche rien s'il n'y
 * a pas de litige pour la commande. Lecture seule si le litige est résolu.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EscrowDisputeThread, DisputeParty } from './EscrowDisputeThread';
import { ShieldAlert } from 'lucide-react';

interface OrderDisputeThreadProps {
  orderId: string;
  /** 'client' (acheteur) ou 'vendor' (vendeur). */
  currentParty: Extract<DisputeParty, 'client' | 'vendor'>;
  className?: string;
}

export function OrderDisputeThread({ orderId, currentParty, className }: OrderDisputeThreadProps) {
  const [dispute, setDispute] = useState<{ id: string; status: string } | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      try {
        const { data: escrow } = await supabase
          .from('escrow_transactions')
          .select('id')
          .eq('order_id', orderId)
          .maybeSingle();
        if (!escrow?.id) { if (!cancelled) setChecked(true); return; }
        const { data: d } = await supabase
          .from('escrow_disputes')
          .select('id, status')
          .eq('escrow_id', escrow.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        setDispute(d as any);
        setChecked(true);

        // Temps réel : suit le STATUT du litige (open → resolved) sans quitter la page
        // de suivi de commande, pour que l'en-tête bascule en « Litige résolu » et que
        // le fil passe en lecture seule dès que le PDG tranche.
        if (d?.id) {
          channel = supabase
            .channel(`order-dispute-status-${d.id}`)
            .on('postgres_changes',
              { event: 'UPDATE', schema: 'public', table: 'escrow_disputes', filter: `id=eq.${d.id}` },
              (payload) => { if (!cancelled) setDispute((payload.new as any) ?? null); },
            )
            .subscribe();
        }
      } catch {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [orderId]);

  if (!checked || !dispute) return null;

  return (
    <div className={className}>
      <div className="flex items-center gap-2 text-sm font-medium text-[#ff4000] mb-2">
        <ShieldAlert className="w-4 h-4" />
        {dispute.status === 'resolved' ? 'Litige résolu' : 'Litige en cours'}
      </div>
      <EscrowDisputeThread
        escrowDisputeId={dispute.id}
        currentParty={currentParty}
        readOnly={dispute.status === 'resolved'}
      />
    </div>
  );
}

export default OrderDisputeThread;
