import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { usePriceConverter } from '@/hooks/usePriceConverter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PdgRevenueService, type RevenueStats, type PdgRevenue, type PdgSetting } from '@/services/pdgRevenueService';
import { supabase } from '@/lib/supabaseClient';
import { TrendingUp, DollarSign, Wallet, ShoppingBag, RefreshCw, Settings, Download, ArrowDownToLine, ArrowUpFromLine, Globe } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function PDGRevenueAnalytics() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { convert, userCurrency } = usePriceConverter();
  const compactAxis = (v: number) => {
    const c = convert(v, 'GNF').convertedAmount;
    if (Math.abs(c) >= 1_000_000) return `${(c / 1_000_000).toFixed(1)}M ${userCurrency}`;
    if (Math.abs(c) >= 1_000) return `${(c / 1_000).toFixed(0)}K ${userCurrency}`;
    return `${Math.round(c)} ${userCurrency}`;
  };
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [revenues, setRevenues] = useState<PdgRevenue[]>([]);
  const [settings, setSettings] = useState<PdgSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, _setDateRange] = useState<{ start: Date; end: Date }>({
    start: subDays(new Date(), 30),
    end: new Date(),
  });
  const { toast } = useToast();

  // Charger les données
  const loadData = async () => {
    setLoading(true);
    console.log('🔄 [PDGRevenueAnalytics] Chargement des données...');

    const [statsData, revenuesData, settingsData] = await Promise.all([
      PdgRevenueService.getRevenueStats(dateRange.start, dateRange.end),
      PdgRevenueService.getRevenueHistory(200),
      PdgRevenueService.getAllSettings(),
    ]);

    setStats(statsData);
    setRevenues(revenuesData);
    setSettings(settingsData);
    setLoading(false);

    console.log('✅ [PDGRevenueAnalytics] Données chargées:', {
      stats: statsData,
      revenues: revenuesData.length,
      settings: settingsData.length,
    });
  };

  useEffect(() => {
    loadData();

    // Écouter les changements en temps réel
    const revenueChannel = supabase
      .channel('pdg_revenue_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'revenus_pdg' }, () => {
        console.log('🔔 [PDGRevenueAnalytics] Nouveau revenu détecté, rechargement...');
        loadData();
      })
      .subscribe();

    return () => {
      revenueChannel.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  // Calculer les données pour les graphiques
  const pieData = [
    { name: 'Frais Wallet', value: Number(stats?.wallet_fees_revenue || 0), color: '#04439e' },
    { name: 'Commissions Achats', value: Number(stats?.purchase_fees_revenue || 0), color: '#ff4000' },
  ];

  // Données temporelles (groupées par jour)
  const timelineData = revenues.reduce((acc: any[], rev) => {
    const date = format(new Date(rev.created_at), 'dd MMM', { locale: fr });
    const existing = acc.find(item => item.date === date);

    if (existing) {
      existing.wallet += rev.source_type === 'frais_transaction_wallet' ? Number(rev.amount) : 0;
      existing.purchase += rev.source_type === 'frais_achat_commande' ? Number(rev.amount) : 0;
      existing.total += Number(rev.amount);
    } else {
      acc.push({
        date,
        wallet: rev.source_type === 'frais_transaction_wallet' ? Number(rev.amount) : 0,
        purchase: rev.source_type === 'frais_achat_commande' ? Number(rev.amount) : 0,
        total: Number(rev.amount),
      });
    }

    return acc;
  }, []).slice(-30).reverse();

  // Calculer la croissance
  const calculateGrowth = () => {
    if (timelineData.length < 2) return 0;
    const lastWeek = timelineData.slice(-7).reduce((sum, d) => sum + d.total, 0);
    const previousWeek = timelineData.slice(-14, -7).reduce((sum, d) => sum + d.total, 0);
    if (previousWeek === 0) return 100;
    return ((lastWeek - previousWeek) / previousWeek) * 100;
  };

  // Mettre à jour un paramètre
  const handleUpdateSetting = async (key: string, newValue: number) => {
    const user = await supabase.auth.getUser();
    if (!user.data.user) return;

    const success = await PdgRevenueService.updateSetting(
      key,
      { value: newValue },
      user.data.user.id
    );

    if (success) {
      toast({ title: t('pDGRevenueAnalytics.parametreMisAJour'), description: t('pDGRevenueAnalytics.lesNouveauxTauxOntEte') });
      loadData();
    } else {
      toast({ title: '❌ Erreur', description: t('pDGRevenueAnalytics.impossibleDeMettreAJour'), variant: 'destructive' });
    }
  };

  // Exporter en CSV
  const exportToCSV = () => {
    const csvContent = [
      ['Date', 'Type', 'Montant', 'Pourcentage', 'Transaction ID'].join(','),
      ...revenues.map(rev => [
        format(new Date(rev.created_at), 'dd/MM/yyyy HH:mm'),
        rev.source_type,
        rev.amount,
        rev.percentage_applied,
        rev.transaction_id || 'N/A',
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenus_pdg_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-12 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">{t('pDGRevenueAnalytics.chargementDesRevenus')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('pDGRevenueAnalytics.analyseDesRevenusPdg')}</h2>
          <p className="text-muted-foreground mt-1">
            Suivi et différenciation des sources de revenus de la plateforme
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualiser
          </Button>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* Cartes KPI */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenu Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fc(Number(stats?.total_revenue || 0))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.transaction_count || 0} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Frais Wallet</CardTitle>
            <Wallet className="h-4 w-4 text-[#04439e]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fc(Number(stats?.wallet_fees_revenue || 0))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.wallet_transaction_count || 0} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commissions Achats</CardTitle>
            <ShoppingBag className="h-4 w-4 text-[#ff4000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fc(Number(stats?.purchase_fees_revenue || 0))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.purchase_transaction_count || 0} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Croissance</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#ff4000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {calculateGrowth().toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              7 derniers jours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques et données */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="details">{t('pDGRevenueAnalytics.historiqueDetaille')}</TabsTrigger>
          <TabsTrigger value="settings">Configuration</TabsTrigger>
        </TabsList>

        {/* Vue d'ensemble */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Graphique en camembert */}
            <Card>
              <CardHeader>
                <CardTitle>{t('pDGRevenueAnalytics.repartitionDesRevenus')}</CardTitle>
                <CardDescription>{t('pDGRevenueAnalytics.distributionParSourceDeRevenu')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${fc(value)}`}
                      outerRadius={80}
                      fill="#04439e"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => fc(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Graphique temporel */}
            <Card>
              <CardHeader>
                <CardTitle>{t('pDGRevenueAnalytics.evolutionTemporelle')}</CardTitle>
                <CardDescription>{t('pDGRevenueAnalytics.revenusSurLes30Derniers')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={compactAxis} width={72} />
                    <Tooltip formatter={(value: any) => fc(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="wallet" stroke="#04439e" name="Frais Wallet" />
                    <Line type="monotone" dataKey="purchase" stroke="#ff4000" name="Commissions" />
                    <Line type="monotone" dataKey="total" stroke="#ff4000" name="Total" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Informations supplémentaires */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pDGRevenueAnalytics.mecanismesDeCommission')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-[#04439e] rounded-lg">
                <div>
                  <p className="font-medium">🔹 Frais Wallet</p>
                  <p className="text-sm text-muted-foreground">
                    Prélevés sur les transferts, retraits et recharges entre wallets
                  </p>
                </div>
                <span className="text-xl font-bold text-[#04439e]">
                  {settings.find(s => s.setting_key === 'wallet_transaction_fee_percentage')?.setting_value?.value || 1.5}%
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-[#ff4000] rounded-lg">
                <div>
                  <p className="font-medium">🔹 Commissions Achats</p>
                  <p className="text-sm text-muted-foreground">
                    Prélevées sur les paiements d'achats de produits ou services
                  </p>
                </div>
                <span className="text-xl font-bold text-[#ff4000]">
                  {settings.find(s => s.setting_key === 'purchase_commission_percentage')?.setting_value?.value || 10}%
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Historique détaillé */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>{t('pDGRevenueAnalytics.historiqueDesTransactionsGeneratrices')}</CardTitle>
              <CardDescription>{t('pDGRevenueAnalytics.listeCompleteDesRevenusEnregistres')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {revenues.slice(0, 50).map((rev) => (
                  <div
                    key={rev.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {rev.source_type === 'frais_transaction_wallet' ? (
                        <Wallet className="h-5 w-5 text-[#04439e]" />
                      ) : (
                        <ShoppingBag className="h-5 w-5 text-[#ff4000]" />
                      )}
                      <div>
                        <p className="font-medium">
                          {rev.source_type === 'frais_transaction_wallet'
                            ? 'Frais Transaction Wallet'
                            : 'Commission Achat'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(rev.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#ff4000]">
                        {fc(Number(rev.amount))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Taux: {rev.percentage_applied}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration */}
        <TabsContent value="settings">
          <div className="space-y-6">
            {/* Aperçu des taux actuels */}
            <div className="grid gap-4 md:grid-cols-3">
              {settings.map((setting) => {
                const value = setting.setting_value?.value || 0;
                const iconConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
                  wallet_transaction_fee_percentage: {
                    icon: <Wallet className="h-5 w-5" />,
                    color: 'text-[#04439e]',
                    bg: 'bg-blue-100 dark:bg-[#04439e]/30'
                  },
                  purchase_commission_percentage: {
                    icon: <ShoppingBag className="h-5 w-5" />,
                    color: 'text-[#ff4000]',
                    bg: 'bg-orange-100 dark:bg-[#ff4000]/30'
                  },
                  service_commissions: {
                    icon: <Settings className="h-5 w-5" />,
                    color: 'text-blue-600',
                    bg: 'bg-blue-100 dark:bg-blue-900/30'
                  },
                  deposit_fee_percentage: {
                    icon: <ArrowDownToLine className="h-5 w-5" />,
                    color: 'text-[#ff4000]',
                    bg: 'bg-orange-100 dark:bg-[#ff4000]/30'
                  },
                  withdrawal_fee_percentage: {
                    icon: <ArrowUpFromLine className="h-5 w-5" />,
                    color: 'text-orange-600',
                    bg: 'bg-orange-100 dark:bg-orange-900/30'
                  },
                  international_transfer_fee_percentage: {
                    icon: <Globe className="h-5 w-5" />,
                    color: 'text-[#04439e]',
                    bg: 'bg-blue-100 dark:bg-[#04439e]/30'
                  },
                };
                const config = iconConfig[setting.setting_key] || {
                  icon: <Settings className="h-5 w-5" />,
                  color: 'text-gray-600',
                  bg: 'bg-gray-100 dark:bg-gray-800'
                };

                return (
                  <Card key={setting.id} className={`border-2 hover:shadow-lg transition-shadow`}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`p-3 rounded-xl ${config.bg} ${config.color}`}>
                          {config.icon}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-muted-foreground">{setting.description}</p>
                          <p className={`text-3xl font-bold ${config.color}`}>{value}%</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Mis à jour le {format(new Date(setting.updated_at), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Formulaire de modification */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Modifier les Taux de Commission
                </CardTitle>
                <CardDescription>
                  Ajustez les pourcentages prélevés sur chaque type de transaction
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {settings.map((setting) => {
                    const currentValue = setting.setting_value?.value || 0;
                    const settingLabels: Record<string, { title: string; desc: string; min: number; max: number; example: number }> = {
                      wallet_transaction_fee_percentage: {
                        title: '💳 Frais Wallet',
                        desc: 'Appliqué sur transferts, retraits et recharges',
                        min: 0,
                        max: 10,
                        example: 100000
                      },
                      purchase_commission_percentage: {
                        title: '🛒 Commission Achats',
                        desc: 'Prélevé sur les paiements de commandes',
                        min: 0,
                        max: 30,
                        example: 500000
                      },
                      service_commissions: {
                        title: t('pDGRevenueAnalytics.commissionServices'),
                        desc: 'Appliqué sur les services professionnels',
                        min: 0,
                        max: 20,
                        example: 200000
                      },
                      deposit_fee_percentage: {
                        title: t('pDGRevenueAnalytics.fraisDeDepot'),
                        desc: 'Prélevé lors des rechargements (PayPal, carte, etc.)',
                        min: 0,
                        max: 10,
                        example: 100000
                      },
                      withdrawal_fee_percentage: {
                        title: t('pDGRevenueAnalytics.fraisDeRetrait'),
                        desc: 'Prélevé lors des demandes de retrait',
                        min: 0,
                        max: 10,
                        example: 100000
                      },
                      international_transfer_fee_percentage: {
                        title: '🌍 Frais Transfert International',
                        desc: 'Marge appliquée sur le taux de change pour les transferts internationaux',
                        min: 0,
                        max: 10,
                        example: 500000
                      },
                    };
                    const labelConfig = settingLabels[setting.setting_key] || {
                      title: setting.setting_key,
                      desc: setting.description || '',
                      min: 0,
                      max: 100,
                      example: 100000
                    };

                    return (
                      <div key={setting.id} className="space-y-4 p-4 border rounded-xl bg-accent/30">
                        <div>
                          <Label className="text-base font-semibold">{labelConfig.title}</Label>
                          <p className="text-xs text-muted-foreground mt-1">{labelConfig.desc}</p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.1"
                              min={labelConfig.min}
                              max={labelConfig.max}
                              defaultValue={currentValue}
                              id={`setting-${setting.setting_key}`}
                              className="text-lg font-semibold"
                            />
                            <span className="text-lg font-bold">%</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span>Min: {labelConfig.min}%</span>
                            <span>•</span>
                            <span>Max: {labelConfig.max}%</span>
                          </div>
                        </div>

                        {/* Exemple de calcul en temps réel */}
                        <div className="p-3 bg-background rounded-lg border">
                          <p className="text-xs text-muted-foreground mb-1">Exemple sur {fc(labelConfig.example)}:</p>
                          <p className="font-semibold text-[#ff4000]">
                            Revenu PDG: {fc(labelConfig.example * currentValue / 100)}
                          </p>
                        </div>

                        <Button
                          className="w-full"
                          onClick={() => {
                            const input = document.getElementById(`setting-${setting.setting_key}`) as HTMLInputElement;
                            const newValue = parseFloat(input.value);
                            if (newValue < labelConfig.min || newValue > labelConfig.max) {
                              toast({
                                title: '❌ Valeur invalide',
                                description: `Le taux doit être entre ${labelConfig.min}% et ${labelConfig.max}%`,
                                variant: 'destructive'
                              });
                              return;
                            }
                            handleUpdateSetting(setting.setting_key, newValue);
                          }}
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Appliquer
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Note d'information */}
            <Card className="bg-orange-50 dark:bg-[#ff4000]/20 border-orange-200 dark:border-[#ff4000]">
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="text-2xl">💡</div>
                  <div>
                    <p className="font-medium text-[#ff4000] dark:text-orange-200">Important</p>
                    <p className="text-sm text-[#ff4000] dark:text-orange-300 mt-1">
                      Les modifications de taux s'appliquent immédiatement à toutes les nouvelles transactions.
                      Les transactions en cours conservent leur taux d'origine. L'historique des modifications
                      est conservé pour audit.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
