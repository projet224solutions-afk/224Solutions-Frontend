// ============================================================================
// Hook: dashboard actionnaire (utilisateur connecté)
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { shareholderService } from '@/services/shareholderService';
import type {
  ShareholderDashboardData,
  ShareholderRevenue,
  ShareholderPayment,
  ShareholderDocument,
  ShareholderVote,
} from '@/types/shareholder';
import { useAuth } from './useAuth';

export function useShareholderDashboard() {
  const { user, profile } = useAuth();
  const [dashboardData, setDashboardData] = useState<ShareholderDashboardData | null>(null);
  const [revenues, setRevenues]           = useState<ShareholderRevenue[]>([]);
  const [payments, setPayments]           = useState<ShareholderPayment[]>([]);
  const [documents, setDocuments]         = useState<ShareholderDocument[]>([]);
  const [votes, setVotes]                 = useState<ShareholderVote[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [userCode, setUserCode]           = useState('');
  const [loading, setLoading]             = useState(true);
  const [loadError, setLoadError]         = useState<string | null>(null);
  const [isSuspended, setIsSuspended]     = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setLoadError(null);
    setIsSuspended(false);

    try {
      // Données dashboard — lance une erreur si l'API échoue
      const data = await shareholderService.getDashboardData(user.id);
      setDashboardData(data);

      if (data?.shareholder?.id) {
        const shId = data.shareholder.id;
        const assignment = data.assignment;

        // Charger en parallèle
        const [rev, pay, docs, votesData, notifs] = await Promise.all([
          shareholderService.listRevenues(shId),
          shareholderService.listPayments(shId),
          shareholderService.listDocuments(shId),
          shareholderService.listVotes(shId),
          shareholderService.getNotifications(user.id),
        ]);

        setRevenues(rev);
        setPayments(pay);
        setDocuments(docs);
        setVotes(votesData);
        setNotifications(notifs);

        // Charger les abonnements si on a un assignment valide
        if (assignment?.category && assignment?.action_scope) {
          const subs = await shareholderService.getShareholderSubscriptions(
            assignment.category,
            assignment.action_scope,
            assignment.country || null,
          );
          setSubscriptions(subs);
        }
      }
    } catch (err: any) {
      console.error('useShareholderDashboard.load:', err);
      if (err?.error_code === 'ACCOUNT_SUSPENDED') {
        setIsSuspended(true);
      } else {
        setLoadError(err?.message || 'Erreur de connexion au serveur');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    // Attendre que auth ET profile soient chargés
    if (!user?.id || profile === null) return;

    if (profile.role === 'actionnaire') {
      load();
      // Récupérer le custom_id pour le transfert wallet
      supabase
        .from('user_ids')
        .select('custom_id')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.custom_id) setUserCode(data.custom_id);
        });
    } else {
      // Utilisateur authentifié mais sans rôle actionnaire : stopper le chargement
      setLoading(false);
    }
  }, [user?.id, profile, load]);

  // Supabase Realtime: mise à jour en temps réel
  useEffect(() => {
    if (!user?.id) return;

    const shId       = dashboardData?.shareholder?.id;
    const assignment = dashboardData?.assignment;

    const channel = supabase.channel(`sh_realtime_${user.id}`)
      // Suspension / réactivation par le PDG
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'shareholders',
        filter: `user_id=eq.${user.id}`,
      }, async () => { await load(); })

      // Changement de scope / pourcentage par le PDG
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'shareholder_assignments',
        ...(shId ? { filter: `shareholder_id=eq.${shId}` } : {}),
      }, async () => { await load(); })

      // Nouveaux revenus calculés par le PDG
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'shareholder_revenues',
        ...(shId ? { filter: `shareholder_id=eq.${shId}` } : {}),
      }, async () => { await load(); })

      // Paiements (approbation, envoi wallet)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'shareholder_payments',
        ...(shId ? { filter: `shareholder_id=eq.${shId}` } : {}),
      }, async () => { await load(); })

      // Abonnements vendeurs (offerts par PDG, nouveaux inscrits, changements statut)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'subscriptions',
      }, async () => {
        if (assignment?.category === 'seller') await load();
      })

      // Abonnements chauffeurs/taxi (INSERT + UPDATE + DELETE)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'driver_subscriptions',
      }, async () => {
        if (assignment?.category === 'taxi' || assignment?.category === 'delivery_driver') await load();
      })

      // Abonnements services
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'service_subscriptions',
      }, async () => {
        if (assignment?.category === 'service') await load();
      })

      // Notifications
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        filter: `user_id=eq.${user.id}`,
      }, async () => { await load(); })

      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, dashboardData?.shareholder?.id, dashboardData?.assignment?.category, load]);

  const markNotificationRead = useCallback(async (notifId: string) => {
    await shareholderService.markNotificationRead(notifId);
    setNotifications(prev => prev.map(n =>
      n.id === notifId ? { ...n, read: true } : n,
    ));
  }, []);

  const submitVote = useCallback(async (
    voteId: string,
    choice: 'yes' | 'no' | 'abstain',
  ) => {
    if (!dashboardData?.shareholder?.id) return { success: false, error: 'Non connecté' };
    return shareholderService.submitVote(voteId, dashboardData.shareholder.id, choice);
  }, [dashboardData?.shareholder?.id]);

  const walletBalance = dashboardData?.wallet_balance ?? 0;
  const unreadCount   = notifications.filter(n => !n.read).length;
  const paidSubs      = subscriptions.filter(s => s.is_paid);
  const freeSubs      = subscriptions.filter(s => !s.is_paid);
  const openVotes     = votes.filter(v => v.status === 'open' && (!v.end_date || new Date(v.end_date) > new Date()));

  return {
    dashboardData,
    revenues,
    payments,
    documents,
    votes,
    openVotes,
    notifications,
    subscriptions,
    paidSubs,
    freeSubs,
    walletBalance,
    userCode,
    unreadCount,
    loading,
    loadError,
    isSuspended,
    refetch:              load,
    markNotificationRead,
    submitVote,
  };
}
