
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SyndicateMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'president' | 'secretary' | 'member';
  badge_number: string;
  wallet_balance: number;
  status: 'active' | 'inactive';
  joined_date: string;
}

export interface TaxiDriver {
  id: string;
  name: string;
  phone: string;
  email?: string;
  gilet_number?: string;
  plate_number: string;
  moto_serial: string;
  badge_number: string;
  wallet_balance: number;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
}

export interface SyndicateStats {
  total_members: number;
  active_members: number;
  total_taxi_motards: number;
  active_taxi_motards: number;
  total_balance: number;
  monthly_revenue: number;
  pending_validations: number;
  active_alerts: number;
}

export function useSyndicatUltraProData() {
  const [members, setMembers] = useState<SyndicateMember[]>([]);
  const [drivers, setDrivers] = useState<TaxiDriver[]>([]);
  const [bureauId, setBureauId] = useState<string | null>(null);
  const [bureauName, setBureauName] = useState<string | null>(null);
  const [stats, setStats] = useState<SyndicateStats>({
    total_members: 0,
    active_members: 0,
    total_taxi_motards: 0,
    active_taxi_motards: 0,
    total_balance: 0,
    monthly_revenue: 0,
    pending_validations: 0,
    active_alerts: 0,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Essayer d'abord la session bureau locale (authentification personnalisée)
      let currentBureauId: string | null = null;
      let currentBureauName: string | null = null;

      const bureauSession = localStorage.getItem('bureau_session') || sessionStorage.getItem('bureau_session');
      if (bureauSession) {
        try {
          const session = JSON.parse(bureauSession);
          if (session.bureauId) {
            const { data: bureauData } = await supabase
              .from('bureaus')
              .select('id, commune, prefecture')
              .eq('id', session.bureauId)
              .single();

            if (bureauData) {
              currentBureauId = bureauData.id;
              currentBureauName = `Syndicat de ${bureauData.commune} - ${bureauData.prefecture}`;
            }
          }
        } catch (e) {
          console.error('Erreur parsing session bureau:', e);
        }
      }

      // Si pas de session bureau, essayer avec l'utilisateur Supabase
      if (!currentBureauId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userBureau } = await supabase
            .from('bureaus')
            .select('id, commune, prefecture')
            .eq('president_email', user.email)
            .single();

          if (userBureau) {
            currentBureauId = userBureau.id;
            currentBureauName = `Syndicat de ${userBureau.commune} - ${userBureau.prefecture}`;
          }
        }
      }

      if (!currentBureauId) {
        setError('Bureau non trouvé');
        return;
      }

      setBureauId(currentBureauId);
      setBureauName(currentBureauName);

      // Requêtes optimisées avec COUNT et agrégations SQL
      const [membersRes, driversRes, walletRes, alertsRes] = await Promise.all([
        // Travailleurs syndiqués (syndicate_workers au lieu de members)
        supabase
          .from('syndicate_workers')
          .select('*', { count: 'exact' })
          .eq('bureau_id', currentBureauId),

        // Chauffeurs taxi-moto liés au bureau (utilise maintenant bureau_id)
        supabase
          .from('taxi_drivers')
          .select('*', { count: 'exact' })
          .eq('bureau_id', currentBureauId),

        // Wallet du bureau (utiliser bureau_wallets au lieu de wallets)
        supabase
          .from('bureau_wallets')
          .select('balance')
          .eq('bureau_id', currentBureauId)
          .single(),

        // Alertes actives
        supabase
          .from('syndicate_alerts')
          .select('*', { count: 'exact' })
          .eq('bureau_id', currentBureauId)
          .eq('is_read', false)
      ]);

      const membersData = membersRes.data || [];
      const driversData = driversRes.data || [];

      setMembers(membersData as any);
      setDrivers(driversData as any);

      // Calculs optimisés
      const totalMembers = membersRes.count || 0;
      const activeMembers = membersData.filter((m: any) => m.status === 'active').length;
      const totalDrivers = driversRes.count || 0;
      const activeDrivers = driversData.filter((d: any) => d.status === 'active').length;
      const totalBalance = walletRes.data?.balance || 0;
      const activeAlerts = alertsRes.count || 0;

      // Calculer le revenu du mois (à partir des transactions)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: transactions } = await supabase
        .from('bureau_transactions')
        .select('amount')
        .eq('bureau_id', currentBureauId)
        .eq('type', 'revenue')
        .gte('created_at', startOfMonth.toISOString());

      const monthlyRevenue = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

      setStats({
        total_members: totalMembers,
        active_members: activeMembers,
        total_taxi_motards: totalDrivers,
        active_taxi_motards: activeDrivers,
        total_balance: totalBalance,
        monthly_revenue: monthlyRevenue,
        pending_validations: membersData.filter((m: any) => m.status === 'pending').length,
        active_alerts: activeAlerts,
      });
    } catch (e: any) {
      console.error('Erreur refresh bureau stats:', e);
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // CENTRALISÉ: Écouter syndicate_workers et vehicles au lieu de members
    const channel = supabase
      .channel('realtime-syndicate')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'syndicate_workers' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'taxi_drivers' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bureau_transactions' }, refresh)
      .subscribe();
    const interval = setInterval(refresh, 30000);
    return () => {
      try { supabase.removeChannel(channel); } catch {}
      clearInterval(interval);
    };
  }, [refresh]);

  return { members, drivers, stats, loading, error, refresh, bureauId, bureauName };
}


