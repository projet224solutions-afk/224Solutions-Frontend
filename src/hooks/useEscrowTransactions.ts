import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { backendFetch } from '@/services/backendApi';
import { toast } from 'sonner';

export interface EscrowLog {
  id: string;
  escrow_id: string;
  action: string;
  performed_by: string | null;
  note: string | null;
  metadata: any;
  created_at: string;
}

export interface EscrowTransaction {
  id: string;
  order_id: string;
  payer_id: string;
  receiver_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'held' | 'released' | 'refunded' | 'dispute';
  commission_percent: number;
  commission_amount: number;
  transaction_id?: string;
  available_to_release_at?: string;
  released_by?: string;
  auto_release_enabled: boolean;
  dispute_reason?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
  receiver?: {
    id: string;
    business_name: string;
    user_id: string;
  };
  order?: {
    id: string;
    order_number: string;
  };
}

/** 'admin' = PDG (toutes les transactions) ; 'mine' = vendeur/client (les siennes uniquement). */
type EscrowScope = 'admin' | 'mine';

export function useEscrowTransactions(options?: { scope?: EscrowScope }) {
  const scope: EscrowScope = options?.scope ?? 'mine';
  const [transactions, setTransactions] = useState<EscrowTransaction[]>([]);
  const [logs, setLogs] = useState<Record<string, EscrowLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = async () => {
    try {
      setLoading(true);

      // ⚠️ Chargement via le BACKEND NODE (service_role) qui contourne la RLS de
      // escrow_transactions (payer_id/receiver_id = auth.uid()) :
      //  - scope 'admin' → /api/admin/escrow/transactions : TOUTES les transactions (PDG only).
      //  - scope 'mine'  → /api/orders/escrow/my-transactions : SEULEMENT celles de l'utilisateur
      //    (vendeur=receiver / acheteur=payer). Indispensable car la route admin est réservée
      //    au PDG (403) et cassait l'escrow du vendeur. Enrichi serveur (order + litige) = rapide.
      const endpoint = scope === 'admin'
        ? '/api/admin/escrow/transactions'
        : '/api/orders/escrow/my-transactions';
      const res = await backendFetch<any[]>(endpoint, { method: 'GET' });
      if (!res.success) throw new Error(res.error || 'Erreur');
      const enrichedData = (res.data || []).map((t: any) => ({
        ...t,
        // Normalisation à la source : certaines lignes ont des montants NULL en base.
        // On garantit des nombres pour que .toLocaleString()/reduce() ne crashent jamais
        // (l'onglet plantait sur "Cannot read properties of null (reading 'toLocaleString')").
        amount: Number(t.amount) || 0,
        commission_amount: Number(t.commission_amount) || 0,
        commission_percent: Number(t.commission_percent) || 0,
        currency: t.currency || 'GNF',
        receiver: t.vendor || undefined, // compat avec l'UI existante
      }));

      setTransactions(enrichedData as EscrowTransaction[]);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      toast.error('Erreur lors du chargement des transactions escrow');
      console.error('Erreur chargement escrow:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (escrowId: string) => {
    try {
      const { data, error } = await supabase
        .from('escrow_logs')
        .select('*')
        .eq('escrow_id', escrowId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(prev => ({ ...prev, [escrowId]: (data || []) as EscrowLog[] }));
    } catch (err: any) {
      console.error('Erreur lors du chargement des logs:', err);
    }
  };

  const initiateEscrow = async (
    orderId: string,
    payerId: string,
    receiverId: string,
    amount: number,
    currency: string = 'GNF'
  ) => {
    try {
      const { data, error } = await supabase.rpc('initiate_escrow', {
        p_order_id: orderId,
        p_payer_id: payerId,
        p_receiver_id: receiverId,
        p_amount: amount,
        p_currency: currency
      });

      if (error) throw error;
      toast.success('Transaction escrow initiée avec succès');
      await loadTransactions();
      return data;
    } catch (err: any) {
      toast.error('Erreur lors de l\'initiation de l\'escrow');
      throw err;
    }
  };

  // ⚠️ Libération / remboursement / litige passent désormais par des routes Node ATOMIQUES
  // (RPC release_escrow / refund_order_escrow + insert escrow_disputes). Les anciennes
  // edge-functions 'escrow-release/refund/dispute' étaient des STUBS (release ne faisait RIEN ;
  // refund flippait un statut sur la MAUVAISE table sans créditer l'acheteur).
  const releaseEscrow = async (escrowId: string, _notes?: string) => {
    try {
      const res = await backendFetch(`/api/admin/escrow/${escrowId}/release`, { method: 'POST' });
      if (!res.success) throw new Error(res.error || 'Erreur inconnue');
      toast.success('Fonds libérés avec succès');
      await loadTransactions();
      return res.data;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la libération des fonds');
      throw err;
    }
  };

  const refundEscrow = async (escrowId: string, _reason?: string) => {
    try {
      const res = await backendFetch(`/api/admin/escrow/${escrowId}/refund`, { method: 'POST' });
      if (!res.success) throw new Error(res.error || 'Erreur inconnue');
      toast.success('Remboursement effectué avec succès');
      await loadTransactions();
      return res.data;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du remboursement');
      throw err;
    }
  };

  const disputeEscrow = async (escrowId: string, reason?: string) => {
    try {
      const res = await backendFetch<{ dispute_id: string }>(`/api/admin/escrow/${escrowId}/dispute`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      if (!res.success) {
        const errorMsg = res.error || 'Erreur inconnue';
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }
      toast.success('Litige ouvert avec succès');
      await loadTransactions();
      return res.data;
    } catch (err: any) {
      const errorMsg = err.message || 'Erreur lors de l\'ouverture du litige';
      if (!errorMsg.includes('déjà ouvert')) {
        toast.error(errorMsg);
      }
      throw err;
    }
  };

  const requestRelease = async (escrowId: string) => {
    try {
      // Passe par le BACKEND NODE : journalise ET notifie le client + le PDG.
      // (L'ancienne version ne faisait que log_escrow_action → personne n'était notifié.)
      const res = await backendFetch<{ notified: number }>(
        `/api/orders/escrow/${escrowId}/request-release`,
        { method: 'POST' }
      );
      if (!res.success) throw new Error(res.error || 'Erreur');
      toast.success('Demande de libération envoyée (client et PDG notifiés)');
      await loadTransactions();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la demande');
      throw err;
    }
  };

  // Nom de canal UNIQUE par instance du hook : deux composants (page vendeur + PDG, ou
  // double-montage StrictMode) qui réutilisaient le même nom 'escrow_transactions_changes'
  // provoquaient « cannot add postgres_changes callbacks ... after subscribe() ».
  const channelIdRef = useRef(`escrow_tx_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    loadTransactions();

    // S'abonner aux changements en temps réel (canal propre à cette instance)
    const channel = supabase
      .channel(channelIdRef.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'escrow_transactions' },
        () => {
          loadTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    transactions,
    logs,
    loading,
    error,
    initiateEscrow,
    releaseEscrow,
    refundEscrow,
    disputeEscrow,
    requestRelease,
    loadLogs,
    refresh: loadTransactions
  };
}
