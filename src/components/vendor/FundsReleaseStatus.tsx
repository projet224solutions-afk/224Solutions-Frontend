/**
 * COMPOSANT: Statut de libération des fonds (Vendeur)
 * 224SOLUTIONS - Affichage transparent du statut des fonds en attente
 */

// build: force-recompile

import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';


import {
  Clock,
  CheckCircle,
  AlertTriangle,
  Shield,
  TrendingUp,
  Wallet
} from 'lucide-react';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTranslation } from '@/hooks/useTranslation';

interface FundsRelease {
  id: string;
  transaction_id: string;
  amount_to_release: number;
  held_at: string;
  scheduled_release_at: string;
  released_at: string | null;
  status: 'PENDING' | 'SCHEDULED' | 'RELEASED' | 'REJECTED' | 'DISPUTED';
  release_type: string;
  stripe_transaction?: {
    stripe_payment_intent_id: string;
    amount: number;
    buyer_id: string;
  } | null;
}

interface WalletBalance {
  id: string | number;
  balance: number;
  total_received: number;
  total_sent: number;
}

export function FundsReleaseStatus() {
  const { t } = useTranslation();
  const [releases, setReleases] = useState<FundsRelease[]>([]);
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [_userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUserData();

    // Rafraîchir toutes les minutes
    const interval = setInterval(fetchUserData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);

      // Récupérer le wallet avec gestion robuste des colonnes
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', user.id)
        .maybeSingle();

      if (walletError || !wallet) {
        console.error('Wallet not found or error:', walletError);
        setLoading(false);
        return;
      }

      setWalletBalance({ ...wallet, total_received: 0, total_sent: 0 } as any);

      // Récupérer les libérations en cours
      const { data: releasesData, error: releasesError } = await supabase
        .from('funds_release_schedule')
        .select(`
          id,
          transaction_id,
          amount_to_release,
          held_at,
          scheduled_release_at,
          released_at,
          status,
          release_type,
          stripe_transaction:stripe_transactions!transaction_id (
            stripe_payment_intent_id,
            amount,
            buyer_id
          )
        `)
        .eq('wallet_id', String(wallet.id))
        .in('status', ['PENDING', 'SCHEDULED'])
        .order('held_at', { ascending: false });

      if (releasesError) {
        console.error('Releases error:', releasesError);
        return;
      }

      // Valider et filtrer les données
      const validReleases = (releasesData || []).filter(release => {
        return release.stripe_transaction != null;
      }) as FundsRelease[];

      setReleases(validReleases);
    } catch (error) {
      console.error('Error fetching funds release status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string; icon: any }> = {
      PENDING: { variant: 'secondary', label: t('fundsReleaseStatus.statusPending'), icon: AlertTriangle },
      SCHEDULED: { variant: 'default', label: t('fundsReleaseStatus.statusScheduled'), icon: Clock },
      RELEASED: { variant: 'default', label: t('fundsReleaseStatus.statusReleased'), icon: CheckCircle },
      REJECTED: { variant: 'destructive', label: t('fundsReleaseStatus.statusRejected'), icon: AlertTriangle },
      DISPUTED: { variant: 'destructive', label: t('fundsReleaseStatus.statusDisputed'), icon: AlertTriangle },
    };

    const config = variants[status] || variants.PENDING;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const calculateProgress = (heldAt: string, scheduledAt: string) => {
    const now = new Date();
    const held = new Date(heldAt);
    const scheduled = new Date(scheduledAt);

    const totalMinutes = differenceInMinutes(scheduled, held);
    const elapsedMinutes = differenceInMinutes(now, held);

    return Math.min(Math.max((elapsedMinutes / totalMinutes) * 100, 0), 100);
  };

  const getRemainingTime = (scheduledAt: string) => {
    const now = new Date();
    const scheduled = new Date(scheduledAt);
    const remainingMinutes = differenceInMinutes(scheduled, now);

    if (remainingMinutes <= 0) {
      return t('fundsReleaseStatus.soonAvailable');
    }

    if (remainingMinutes < 60) {
      return `${remainingMinutes} min`;
    }

    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    return `${hours}h ${minutes}min`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wallet Balance */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('fundsReleaseStatus.availableBalance')}
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {((walletBalance?.balance || 0) / 100).toFixed(2)} XOF
            </div>
            <p className="text-xs text-muted-foreground">
              {t('fundsReleaseStatus.usableNow')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('fundsReleaseStatus.totalReceived')}
            </CardTitle>
            <Clock className="h-4 w-4 text-[#ff4000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ff4000]">
              {((walletBalance?.total_received || 0) / 100).toFixed(2)} XOF
            </div>
            <p className="text-xs text-muted-foreground">
              {releases.length} {t('fundsReleaseStatus.paymentsInProgress')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('fundsReleaseStatus.totalSent')}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-[#ff4000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ff4000]">
              {((walletBalance?.total_sent || 0) / 100).toFixed(2)} XOF
            </div>
            <p className="text-xs text-muted-foreground">
              {t('fundsReleaseStatus.allPeriods')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Releases List */}
      {releases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {t('fundsReleaseStatus.releasesInProgress')}
            </CardTitle>
            <CardDescription>
              {t('fundsReleaseStatus.releasesDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {releases.map((release) => {
              const isScheduled = release.status === 'SCHEDULED';
              const isPending = release.status === 'PENDING';
              const progress = isScheduled
                ? calculateProgress(release.held_at, release.scheduled_release_at)
                : 0;

              return (
                <Card key={release.id} className="border-l-4 border-l-primary">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl font-bold">
                              {(release.amount_to_release / 100).toFixed(2)} XOF
                            </span>
                            {getStatusBadge(release.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {t('fundsReleaseStatus.received')} {formatDistanceToNow(new Date(release.held_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                        </div>

                        {getStatusBadge(release.status)}
                      </div>

                      {/* Progress Bar (for SCHEDULED) */}
                      {isScheduled && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {t('fundsReleaseStatus.releaseIn')} {getRemainingTime(release.scheduled_release_at)}
                            </span>
                            <span className="font-medium">{Math.round(progress)}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      )}

                      {/* Pending Admin Review */}
                      {isPending && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-[#ff4000] mt-0.5" />
                            <div>
                              <p className="font-medium text-[#ff4000]">
                                {t('fundsReleaseStatus.reviewInProgress')}
                              </p>
                              <p className="text-sm text-[#ff4000] mt-1">
                                {t('fundsReleaseStatus.reviewText')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Info */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">{t('fundsReleaseStatus.transaction')}</span>
                          <p className="font-mono text-xs mt-1">
                            {Array.isArray(release.stripe_transaction)
                              ? release.stripe_transaction[0]?.stripe_payment_intent_id?.slice(0, 20)
                              : release.stripe_transaction?.stripe_payment_intent_id?.slice(0, 20)}
                            ...
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('fundsReleaseStatus.type')}</span>
                          <p className="font-medium mt-1">
                            {release.release_type === 'AUTO' ? t('fundsReleaseStatus.auto') : t('fundsReleaseStatus.manual')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-2">
              <p className="font-medium text-blue-900">
                {t('fundsReleaseStatus.protectionTitle')}
              </p>
              <p className="text-sm text-blue-700">
                {t('fundsReleaseStatus.protectionText')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
