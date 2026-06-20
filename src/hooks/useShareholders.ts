// ============================================================================
// Hook: gestion des actionnaires (PDG)
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { shareholderService } from '@/services/shareholderService';
import type {
  Shareholder,
  PDGShareholderStats,
  PercentageSummary,
  ShareholderRevenue,
  ShareholderPayment,
  CreateShareholderDto,
  UpdateShareholderDto,
  PaymentStatus,
} from '@/types/shareholder';
import { toast } from 'sonner';

export function useShareholders() {
  const [shareholders, setShareholders]  = useState<Shareholder[]>([]);
  const [stats, setStats]                = useState<PDGShareholderStats | null>(null);
  const [percentages, setPercentages]    = useState<PercentageSummary[]>([]);
  const [revenues, setRevenues]          = useState<ShareholderRevenue[]>([]);
  const [payments, setPayments]          = useState<ShareholderPayment[]>([]);
  const [loading, setLoading]            = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [shs, st, pct, rev, pay] = await Promise.all([
        shareholderService.listShareholders(),
        shareholderService.getPDGStats(),
        shareholderService.getPercentageSummary(),
        shareholderService.listRevenues(),
        shareholderService.listPayments(),
      ]);
      setShareholders(shs);
      setStats(st);
      setPercentages(pct);
      setRevenues(rev);
      setPayments(pay);
    } catch (err) {
      console.error('useShareholders.load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Supabase Realtime: écouter les changements
  useEffect(() => {
    const channel = supabase
      .channel('shareholders_realtime')
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'shareholders',
      }, () => { load(); })
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'shareholder_revenues',
      }, () => { load(); })
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'shareholder_payments',
      }, () => { load(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  // --------------------------------------------------------------------------
  const createShareholder = useCallback(
    async (data: CreateShareholderDto, createdBy: string) => {
      setActionLoading(true);
      const result = await shareholderService.createShareholder(data, createdBy);
      setActionLoading(false);
      if (result.success) {
        toast.success('Actionnaire créé avec succès');
        await load();
      } else {
        toast.error(result.error || 'Erreur lors de la création');
      }
      return result;
    },
    [load],
  );

  const updateShareholder = useCallback(
    async (id: string, updates: UpdateShareholderDto, actorId: string) => {
      setActionLoading(true);
      const result = await shareholderService.updateShareholder(id, updates, actorId);
      setActionLoading(false);
      if (result.success) {
        const n = result.recalculated_revenues ?? 0;
        toast.success(
          n > 0
            ? `Actionnaire mis à jour — ${n} reçu(s) en attente recalculé(s) à la nouvelle part`
            : 'Actionnaire mis à jour',
        );
        await load();
      } else {
        toast.error(result.error || 'Erreur lors de la mise à jour');
      }
      return result;
    },
    [load],
  );

  const calculateRevenue = useCallback(
    async (assignmentId: string, periodStart: string, periodEnd: string, actorId: string) => {
      setActionLoading(true);
      const result = await shareholderService.calculateRevenue(assignmentId, periodStart, periodEnd);
      if (result && !result.error) {
        const saveResult = await shareholderService.saveRevenue(result, actorId);
        setActionLoading(false);
        if (saveResult.success) {
          toast.success('Revenus calculés et enregistrés');
          await load();
        } else {
          toast.error(saveResult.error || 'Erreur lors de la sauvegarde');
        }
        return { ...result, ...saveResult };
      }
      setActionLoading(false);
      toast.error(result?.error || 'Erreur lors du calcul');
      return null;
    },
    [load],
  );

  const approvePayment = useCallback(
    async (paymentId: string, actorId: string) => {
      setActionLoading(true);
      const result = await shareholderService.approvePayment(paymentId, actorId);
      setActionLoading(false);
      if (result.success) {
        if (result.sent_to_wallet) {
          const amt = result.credited_amount?.toLocaleString('fr-FR') ?? '';
          const cur = result.wallet_currency ?? '';
          toast.success(`Approuvé — ${amt} ${cur} crédité sur le wallet de l'actionnaire`);
        } else if (result.wallet_error) {
          toast.warning(`Approuvé — erreur wallet : ${result.wallet_error}. Utilisez "Envoyer wallet" pour réessayer.`);
        } else {
          toast.success('Paiement approuvé');
        }
        await load();
      } else {
        toast.error(result.error || 'Erreur');
      }
      return result;
    },
    [load],
  );

  const sendToWallet = useCallback(
    async (paymentId: string, actorId: string) => {
      setActionLoading(true);
      const result = await shareholderService.sendPaymentToWallet(paymentId, actorId);
      setActionLoading(false);
      if (result.success) {
        toast.success('Paiement envoyé au wallet de l\'actionnaire');
        await load();
      } else {
        toast.error(result.error || 'Erreur');
      }
      return result;
    },
    [load],
  );

  const suspendShareholder = useCallback(
    async (id: string, actorId: string) => {
      setActionLoading(true);
      const result = await shareholderService.suspendShareholder(id, actorId);
      setActionLoading(false);
      if (result.success) {
        toast.success('Actionnaire suspendu');
        await load();
      } else {
        toast.error(result.error || 'Erreur lors de la suspension');
      }
      return result;
    },
    [load],
  );

  const reactivateShareholder = useCallback(
    async (id: string, actorId: string) => {
      setActionLoading(true);
      const result = await shareholderService.reactivateShareholder(id, actorId);
      setActionLoading(false);
      if (result.success) {
        toast.success('Actionnaire réactivé');
        await load();
      } else {
        toast.error(result.error || 'Erreur lors de la réactivation');
      }
      return result;
    },
    [load],
  );

  const transferShare = useCallback(
    async (fromId: string, toId: string, reason: string, actorId: string) => {
      setActionLoading(true);
      const result = await shareholderService.transferShare(fromId, toId, reason, actorId);
      setActionLoading(false);
      if (result.success) {
        toast.success(`Part transférée vers ${result.transferred_to}`);
        await load();
      } else {
        toast.error(result.error || 'Erreur lors du transfert');
      }
      return result;
    },
    [load],
  );

  const deleteShareholder = useCallback(
    async (id: string, actorId: string) => {
      setActionLoading(true);
      const result = await shareholderService.deleteShareholder(id, actorId);
      setActionLoading(false);
      if (result.success) {
        toast.success('Actionnaire supprimé');
        await load();
      } else {
        toast.error(result.error || 'Erreur lors de la suppression');
      }
      return result;
    },
    [load],
  );

  const filterPayments = useCallback(
    (status?: PaymentStatus) =>
      status ? payments.filter(p => p.status === status) : payments,
    [payments],
  );

  return {
    shareholders,
    stats,
    percentages,
    revenues,
    payments,
    loading,
    actionLoading,
    refetch: load,
    createShareholder,
    updateShareholder,
    suspendShareholder,
    reactivateShareholder,
    transferShare,
    deleteShareholder,
    calculateRevenue,
    approvePayment,
    sendToWallet,
    filterPayments,
  };
}
