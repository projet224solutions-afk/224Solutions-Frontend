/**
 * Dashboard Affilié Voyage
 * Affiche les stats, commissions et liens
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import {
  Wallet, TrendingUp, Users, Copy,
  CheckCircle, Clock, AlertCircle, ExternalLink,
  BarChart3, Link2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AffiliateData {
  id: string;
  affiliate_code: string;
  status: string;
  commission_rate: number;
  total_earnings: number;
  pending_earnings: number;
  paid_earnings: number;
  total_referrals: number;
  total_bookings: number;
  specialization: string[];
}

interface Commission {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

interface AffiliateDashboardProps {
  onViewServices: () => void;
}

export function AffiliateDashboard({ onViewServices }: AffiliateDashboardProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAffiliateData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadAffiliateData = async () => {
    try {
      // Charger les données affilié
      const { data: affiliateData, error: affiliateError } = await (supabase as any)
        .from('travel_affiliates')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (affiliateError) throw affiliateError;
      setAffiliate(affiliateData);

      // Charger les commissions
      const { data: commissionsData, error: commissionsError } = await (supabase as any)
        .from('travel_affiliate_commissions')
        .select('*')
        .eq('affiliate_id', affiliateData.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!commissionsError) {
        setCommissions(commissionsData || []);
      }
    } catch (error) {
      console.error('Error loading affiliate data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyAffiliateLink = () => {
    if (!affiliate) return;
    const link = `${window.location.origin}/travel?ref=${affiliate.affiliate_code}`;
    navigator.clipboard.writeText(link);
    toast.success(t('affiliateDashboard.lienCopie'));
  };

  const fc = useFormatCurrency();
  const formatPrice = (price: number, currency: string = 'GNF') => fc(price, currency);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-[#ff4000]">{t('affiliateDashboard.approuve')}</Badge>;
      case 'pending':
        return <Badge variant="secondary">En attente</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspendu</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!affiliate) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header avec statut */}
      <Card className="bg-gradient-to-br from-[#04439e]/10 to-[#ff4000]/10 border-[#04439e]/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-foreground">{t('affiliateDashboard.dashboardAffilie')}</h2>
              <p className="text-sm text-muted-foreground">
                Code: <span className="font-mono font-bold">{affiliate.affiliate_code}</span>
              </p>
            </div>
            {getStatusBadge(affiliate.status)}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              onClick={copyAffiliateLink}
            >
              <Link2 className="w-4 h-4" />
              Copier mon lien
            </Button>
            <Button size="sm" className="flex-1" onClick={onViewServices}>
              Voir les services
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ff4000]/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-[#ff4000]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('affiliateDashboard.totalGagne')}</p>
                <p className="font-bold text-foreground">
                  {formatPrice(affiliate.total_earnings)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ff4000]/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#ff4000]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">En attente</p>
                <p className="font-bold text-foreground">
                  {formatPrice(affiliate.pending_earnings)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('affiliateDashboard.referrals')}</p>
                <p className="font-bold text-foreground">{affiliate.total_referrals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#04439e]/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-[#04439e]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('affiliateDashboard.reservations')}</p>
                <p className="font-bold text-foreground">{affiliate.total_bookings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission rate */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">{t('affiliateDashboard.tauxDeCommission')}</span>
            <span className="font-bold text-primary">{affiliate.commission_rate}%</span>
          </div>
          <Progress value={affiliate.commission_rate * 10} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            Augmentez vos ventes pour débloquer des taux plus élevés
          </p>
        </CardContent>
      </Card>

      {/* Dernières commissions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Dernières commissions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          {commissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune commission pour le moment
            </p>
          ) : (
            <div className="space-y-3">
              {commissions.map((commission) => (
                <div
                  key={commission.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {commission.status === 'paid' ? (
                      <CheckCircle className="w-4 h-4 text-[#ff4000]" />
                    ) : commission.status === 'approved' ? (
                      <Clock className="w-4 h-4 text-[#ff4000]" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {formatPrice(commission.amount, commission.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(commission.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      commission.status === 'paid' ? 'default' :
                      commission.status === 'approved' ? 'secondary' : 'outline'
                    }
                    className="text-xs"
                  >
                    {commission.status === 'paid' ? 'Payé' :
                     commission.status === 'approved' ? 'Approuvé' : 'En attente'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
