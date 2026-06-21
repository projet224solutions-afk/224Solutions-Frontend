import { useTranslation } from "@/hooks/useTranslation";
/**
 * Dashboard Home dédié pour les vendeurs de produits numériques
 * Stats réelles avec ventilation : CA brut, commissions, revenu net
 */

import { memo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Laptop, Plus, Eye, TrendingUp, DollarSign,
  Link, Package, FileText, BookOpen, Plane, Box, ShoppingCart,
  Users, Download, BarChart3, Wallet
} from 'lucide-react';
import { useMerchantDigitalProducts } from '@/hooks/useDigitalProducts';
import { SectionLoader } from '@/components/ui/GlobalLoader';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import RecentlyViewedProducts from '@/components/shared/RecentlyViewedProducts';

const categoryIcons: Record<string, React.ComponentType<any>> = {
  voyage: Plane,
  logiciel: Laptop,
  formation: FileText,
  livre: BookOpen,
  dropshipping: Box,
  custom: Package,
  ai: Laptop,
};

interface MerchantStats {
  totalSales: number;
  grossRevenue: number;
  totalCommissions: number;
  netRevenue: number;
  activeSubscribers: number;
  totalDownloads: number;
  subscriptionRevenue: number;
}

const DigitalVendorDashboardHome = memo(function DigitalVendorDashboardHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { products, loading } = useMerchantDigitalProducts();
  const fc = useFormatCurrency();
  const [stats, setStats] = useState<MerchantStats>({
    totalSales: 0, grossRevenue: 0, totalCommissions: 0,
    netRevenue: 0, activeSubscribers: 0, totalDownloads: 0, subscriptionRevenue: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const publishedCount = products.filter(p => p.status === 'published').length;
  const draftCount = products.filter(p => p.status === 'draft').length;
  const affiliateCount = products.filter(p => p.product_mode === 'affiliate').length;
  const directCount = products.filter(p => p.product_mode === 'direct').length;
  const totalViews = products.reduce((sum, p) => sum + (p.views_count || 0), 0);
  const fmtNum = (n: number) => n.toLocaleString('fr-FR');

  useEffect(() => {
    if (!user?.id) return;

    const loadStats = async () => {
      setStatsLoading(true);

      try {
        const [purchasesRes, subscriptionsRes] = await Promise.all([
          supabase
            .from('digital_product_purchases')
            .select('id, amount, download_count, commission_amount')
            .eq('merchant_id', user.id)
            .eq('payment_status', 'completed'),
          supabase
            .from('digital_subscriptions')
            .select('id, amount_per_period, status')
            .eq('merchant_id', user.id)
        ]);

        const purchases = purchasesRes.data || [];
        const subscriptions = subscriptionsRes.data || [];

        const totalSales = purchases.length;
        const grossRevenue = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalCommissions = purchases.reduce((sum, p) => sum + (p.commission_amount || 0), 0);
        const netRevenue = grossRevenue - totalCommissions;
        const totalDownloads = purchases.reduce((sum, p) => sum + (p.download_count || 0), 0);
        const activeSubs = subscriptions.filter(s => s.status === 'active');
        const activeSubscribers = activeSubs.length;
        const subscriptionRevenue = activeSubs.reduce((sum, s) => sum + (s.amount_per_period || 0), 0);

        setStats({ totalSales, grossRevenue, totalCommissions, netRevenue, activeSubscribers, totalDownloads, subscriptionRevenue });
      } catch (error) {
        console.error('Erreur chargement stats:', error);
      } finally {
        setStatsLoading(false);
      }
    };

    loadStats();
  }, [user?.id]);

  const primaryMetrics = [
    {
      label: t('digitalVendorDashboardHome.ventesConfirmees'),
      value: statsLoading ? '...' : fmtNum(stats.totalSales),
      note: t('digitalVendorDashboardHome.transactionsFinalisees'),
      icon: ShoppingCart,
      cardBg: 'bg-[#04439e]',
      valueTone: 'text-white',
      labelTone: 'text-white/60',
      noteTone: 'text-white/45',
      iconBg: 'bg-white/15',
      iconColor: 'text-white',
    },
    {
      label: "Chiffre d'affaires brut",
      value: statsLoading ? '...' : fc(stats.grossRevenue),
      note: 'avant commissions',
      icon: DollarSign,
      cardBg: 'bg-[#ff4000]',
      valueTone: 'text-white',
      labelTone: 'text-white/60',
      noteTone: 'text-white/45',
      iconBg: 'bg-white/15',
      iconColor: 'text-white',
    },
    {
      label: 'Revenu net',
      value: statsLoading ? '...' : fc(stats.netRevenue),
      note: stats.totalCommissions > 0 ? `-${fc(stats.totalCommissions)} de commissions` : 'aucune commission déduite',
      icon: TrendingUp,
      cardBg: 'bg-[#04439e]',
      valueTone: 'text-white',
      labelTone: 'text-white/60',
      noteTone: 'text-white/45',
      iconBg: 'bg-white/15',
      iconColor: 'text-white',
    },
    {
      label: t('digitalVendorDashboardHome.abonnesActifs'),
      value: statsLoading ? '...' : fmtNum(stats.activeSubscribers),
      note: stats.subscriptionRevenue > 0 ? `${fc(stats.subscriptionRevenue)} par période` : 'aucun abonnement actif',
      icon: Users,
      cardBg: 'bg-[#ff4000]',
      valueTone: 'text-white',
      labelTone: 'text-white/60',
      noteTone: 'text-white/45',
      iconBg: 'bg-white/15',
      iconColor: 'text-white',
    },
  ];

  const secondaryMetrics = [
    {
      label: 'Catalogue digital',
      value: fmtNum(products.length),
      note: `${directCount} directs • ${affiliateCount} affiliés`,
      icon: Package,
    },
    {
      label: t('digitalVendorDashboardHome.produitsPublies'),
      value: fmtNum(publishedCount),
      note: draftCount > 0 ? `${draftCount} brouillon${draftCount > 1 ? 's' : ''}` : 'aucun brouillon',
      icon: BarChart3,
    },
    {
      label: t('digitalVendorDashboardHome.telechargements'),
      value: statsLoading ? '...' : fmtNum(stats.totalDownloads),
      note: t('digitalVendorDashboardHome.livraisonsDejaConsommees'),
      icon: Download,
    },
    {
      label: t('digitalVendorDashboardHome.visibiliteTotale'),
      value: fmtNum(totalViews),
      note: stats.totalSales > 0 ? `conversion ${((stats.totalSales / Math.max(totalViews, 1)) * 100).toFixed(1)}%` : 'conversion à construire',
      icon: Eye,
    },
  ];



  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden pb-[calc(env(safe-area-inset-bottom)+8.5rem)] sm:space-y-8 md:pb-0">
      <Card className="overflow-hidden border-0 bg-transparent shadow-none">
        <CardContent className="px-1 py-2 sm:px-0 sm:py-3 lg:py-4">
          <div className="flex flex-col gap-5 sm:gap-6">
            <div className="max-w-3xl">
              <h2 className="text-center text-xl font-extrabold uppercase leading-tight tracking-[-0.02em] text-[#0b1b33] xl:text-left sm:text-3xl lg:text-[2.6rem]">
                <span className="text-[#04439e]">{t('digitalVendorDashboardHome.pilotezVosProduitsNumeriques')}</span>{' '}
                <span className="text-[#0b1b33]">{t('digitalVendorDashboardHome.commeUnVraiBusiness')}</span>{' '}
                <span className="text-[#ff6a1a]">international.</span>
              </h2>
              <p className="mt-4 max-w-2xl text-center text-sm leading-6 text-[#425466] xl:text-left sm:text-base">
                Organisez vos offres, suivez vos revenus et accédez rapidement aux actions qui font progresser votre boutique digitale.
              </p>
            </div>


          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {primaryMetrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <Card key={metric.label} className={['overflow-hidden rounded-[26px] border-0 shadow-[0_18px_45px_rgba(4,67,158,0.20)]', metric.cardBg].join(' ')}>
              <CardContent className="p-3.5 sm:p-5">
                <div className="flex items-start justify-between gap-2 sm:gap-4">
                  <div className="min-w-0">
                    <p className={['text-[9px] sm:text-[11px] font-semibold uppercase tracking-[0.12em] sm:tracking-[0.18em]', metric.labelTone].join(' ')}>{metric.label}</p>
                    <p className={['mt-2 text-xl font-semibold leading-none sm:text-[2rem]', metric.valueTone].join(' ')}>{metric.value}</p>
                    <p className={['mt-2 text-xs sm:text-sm', metric.noteTone].join(' ')}>{metric.note}</p>
                  </div>
                  <div className={['flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl flex-shrink-0', metric.iconBg].join(' ')}>
                    <Icon className={['h-4 w-4 sm:h-5 sm:w-5', metric.iconColor].join(' ')} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="min-w-0">
        <Card className="overflow-hidden rounded-[28px] border border-[#04439e]/10 bg-white shadow-[0_22px_55px_rgba(4,67,158,0.12)]">
          <CardHeader className="border-b border-[#e3ecfa] px-4 pb-4 pt-4 sm:px-6 sm:pt-6">
            <CardTitle className="text-base font-semibold text-[#0b1b33] sm:text-xl">Vue business</CardTitle>
            <CardDescription className="text-xs text-[#5f78a5] sm:text-sm">{t('digitalVendorDashboardHome.lectureRapideDesSignauxBusiness')}</CardDescription>
          </CardHeader>
          <CardContent className="grid min-w-0 grid-cols-1 gap-2.5 px-4 pb-4 pt-4 sm:grid-cols-2 sm:gap-3 sm:px-6 sm:pb-6">
            {secondaryMetrics.map((metric) => {
              const Icon = metric.icon;

              return (
                <div key={metric.label} className="min-w-0 rounded-[18px] border border-[#04439e]/10 bg-[#04439e]/5 p-3 sm:rounded-[22px] sm:p-4">
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#5f78a5] min-[400px]:text-[8px] sm:text-[11px] sm:tracking-[0.18em]">{metric.label}</p>
                      <p className="mt-1.5 text-lg font-semibold text-[#0b1b33] sm:text-2xl">{metric.value}</p>
                      <p className="mt-1 text-[10px] leading-tight text-[#5f78a5] sm:text-sm">{metric.note}</p>
                    </div>
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-[#04439e]/10 sm:h-11 sm:w-11 sm:rounded-2xl">
                      <Icon className="h-4 w-4 text-[#04439e] sm:h-5 sm:w-5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] border border-gray-100 bg-white shadow-[0_22px_55px_rgba(0,0,0,0.08)]">
        <CardHeader className="border-b border-gray-100 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl font-semibold text-gray-900">{t('digitalVendorDashboardHome.catalogueRecent')}</CardTitle>
              <CardDescription className="mt-1 text-sm text-gray-500">{t('digitalVendorDashboardHome.vosOffresDigitalesLesPlus')}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/vendeur-digital/products')} className="rounded-xl border-[#04439e]/20 bg-[#04439e] font-semibold text-white hover:bg-[#04439e]/90 hover:text-white">
              Voir tout
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {loading ? (
            <SectionLoader />
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-gray-200 bg-gray-50 py-12 text-center">
              <Laptop className="mb-4 h-14 w-14 text-gray-300" />
              <p className="text-base font-semibold text-gray-900">{t('digitalVendorDashboardHome.aucunProduitNumerique')}</p>
              <p className="mb-4 mt-2 max-w-sm text-sm text-gray-500">{t('digitalVendorDashboardHome.commencezAVendreAvecUne')}</p>
              <Button onClick={() => navigate('/vendeur-digital/add-product')} size="sm" className="gap-2 rounded-xl bg-[#ff4000] font-semibold text-white hover:bg-[#e53900]">
                <Plus className="w-4 h-4" />
                Créer mon premier produit
              </Button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {products.slice(0, 5).map((product) => {
                const CategoryIcon = categoryIcons[product.category] || Package;
                const statusLabel = product.status === 'published'
                  ? 'Publié'
                  : product.status === 'draft'
                    ? 'Brouillon'
                    : product.status === 'rejected'
                      ? 'Rejeté'
                      : product.status === 'archived'
                        ? 'Archivé'
                        : product.status;
                const statusClass = product.status === 'published'
                  ? 'bg-[#ff4000] text-white'
                  : product.status === 'draft'
                    ? 'bg-gray-100 text-gray-600'
                    : product.status === 'rejected'
                      ? 'bg-orange-100 text-[#ff4000]'
                      : 'bg-gray-100 text-gray-500';

                return (
                  <div
                    key={product.id}
                    onClick={() => navigate(`/digital-product/${product.id}`)}
                    className="flex cursor-pointer items-center gap-3 rounded-[18px] sm:rounded-[22px] border border-gray-100 bg-gray-50/50 p-3 sm:p-4 transition-all hover:-translate-y-0.5 hover:bg-gray-50 hover:border-gray-200 hover:shadow-[0_16px_36px_rgba(0,0,0,0.06)]"
                  >
                    <div className="flex h-11 w-11 sm:h-14 sm:w-14 flex-shrink-0 items-center justify-center rounded-[14px] sm:rounded-[18px] bg-[#04439e]/10">
                      <CategoryIcon className="h-6 w-6 text-[#04439e]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900 sm:text-base">{product.title}</p>
                        <Badge className="border-0 bg-[#04439e]/10 text-[11px] font-semibold text-[#04439e] shadow-none">
                          {product.product_mode === 'affiliate' ? 'Affiliation' : 'Vente directe'}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                        <span>{product.sales_count || 0} ventes</span>
                        <span>•</span>
                        <span>{product.views_count || 0} vues</span>
                        <span>•</span>
                        <span>{product.price > 0 ? `${fmtNum(product.price)} ${product.currency}` : 'Gratuit'}</span>
                      </div>
                      <p className="mt-2 text-xs text-gray-400">
                        Mis à jour {formatDistanceToNow(new Date((product as any).updated_at || product.created_at), { addSuffix: true, locale: fr })}
                      </p>
                    </div>

                    <Badge className={['inline-flex flex-shrink-0 border-0 text-[10px] sm:text-[11px] font-semibold shadow-none', statusClass].join(' ')}>
                      {statusLabel}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <RecentlyViewedProducts
        title={t('digitalVendorDashboardHome.produitsConsultesRecemment')}
        subtitle="Retrouvez rapidement les dernières fiches ouvertes dans votre espace digital."
        maxItems={6}
      />
    </div>
  );
});

export { DigitalVendorDashboardHome };
export default DigitalVendorDashboardHome;
