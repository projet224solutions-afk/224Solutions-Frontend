/**
 * 📊 ANALYSE DE PROFIT MENSUEL - 224SOLUTIONS
 * Calcul du profit basé sur les ventes, achats et coûts fixes (loyer, abonnement)
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useVendorCurrency } from '@/hooks/useVendorCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  TrendingUp,
  DollarSign,
  Home,
  CreditCard,
  Plus,
  Edit,
  Trash2,
  Zap,
  Wifi,
  Shield,
  Users,
  HelpCircle,
  Calculator,
  Loader2,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface FixedCost {
  id: string;
  vendor_id: string;
  cost_type: 'loyer' | 'abonnement' | 'salaires' | 'electricite' | 'internet' | 'assurance' | 'autre';
  label: string;
  amount: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface MonthlyProfitAnalysisProps {
  vendorId: string; // ID de vendors (pour orders, stock_purchases)
  userId: string;   // ID de auth.users (pour vendor_expenses, vendor_fixed_costs)
}

const COST_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  loyer: { label: 'Loyer', icon: <Home className="w-4 h-4" />, color: '#ff4000' },
  abonnement: { label: 'Abonnement', icon: <CreditCard className="w-4 h-4" />, color: '#04439e' },
  salaires: { label: 'Salaires', icon: <Users className="w-4 h-4" />, color: '#04439e' },
  electricite: { label: "Électricité", icon: <Zap className="w-4 h-4" />, color: '#ff4000' },
  internet: { label: 'Internet', icon: <Wifi className="w-4 h-4" />, color: '#04439e' },
  assurance: { label: 'Assurance', icon: <Shield className="w-4 h-4" />, color: '#ff4000' },
  autre: { label: 'Autre', icon: <HelpCircle className="w-4 h-4" />, color: '#6B7280' }
};

// formatCurrency is now imported from lib - used inside component with useFormatCurrency

export function MonthlyProfitAnalysis({ vendorId, userId }: MonthlyProfitAnalysisProps) {
  const { t } = useTranslation();
  const { currency, convert, isReady: currencyReady } = useVendorCurrency();
  const formatCurrency = (amount: number) => currencyReady ? `${Math.round(convert(amount)).toLocaleString('fr-FR')} ${currency}` : '—';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<FixedCost | null>(null);
  const [formData, setFormData] = useState({
    cost_type: 'loyer' as FixedCost['cost_type'],
    label: '',
    amount: ''
  });

  // Période d'analyse : ventes ET achats utilisent la MÊME fenêtre (cohérence des dates).
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');
  const periodRange = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonthD = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    let start: Date | null = startOfMonthD;
    let label = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    if (period === 'day') { start = startOfDay; label = "Aujourd'hui"; }
    else if (period === 'week') { start = startOfWeek; label = 'Cette semaine'; }
    else if (period === 'year') { start = startOfYear; label = String(now.getFullYear()); }
    else if (period === 'all') { start = null; label = 'Tout l\'historique'; }
    return { startIso: start ? start.toISOString() : null, endIso: now.toISOString(), label };
  }, [period]);

  // Récupérer les coûts fixes (utilise userId car vendor_fixed_costs référence auth.users)
  const { data: fixedCosts = [], isLoading: loadingCosts } = useQuery({
    queryKey: ['vendor-fixed-costs', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_fixed_costs')
        .select('*')
        .eq('vendor_id', userId)
        .eq('is_active', true)
        .order('cost_type');

      if (error) throw error;
      return (data || []) as FixedCost[];
    },
    enabled: !!userId
  });

  // Ventes du mois = orders (en ligne + POS électronique) + POS CASH (pos_sales) + liens de
  // paiement payés. Toutes ces sources référencent vendors.id. Sans pos_sales + payment_links,
  // le profit sous-comptait gravement les revenus (le cash est souvent la majorité).
  const { data: monthlySales = 0, isLoading: loadingSales } = useQuery({
    queryKey: ['vendor-period-sales', vendorId, period],
    queryFn: async () => {
      const { startIso, endIso } = periodRange;
      const withWindow = (q: any, dateCol: string) =>
        startIso ? q.gte(dateCol, startIso).lte(dateCol, endIso) : q;

      const [ordersRes, posRes, linksRes] = await Promise.all([
        withWindow(supabase.from('orders').select('total_amount')
          .eq('vendor_id', vendorId).in('status', ['completed', 'delivered']), 'created_at'),
        withWindow(supabase.from('pos_sales').select('total_amount')
          .eq('vendor_id', vendorId).neq('status', 'refunded'), 'sold_at'),
        withWindow(supabase.from('payment_links').select('net_amount, montant')
          .eq('vendeur_id', vendorId).eq('status', 'success'), 'paid_at'),
      ]);
      if (ordersRes.error) throw ordersRes.error;

      const ordersSum = (ordersRes.data || []).reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
      const posSum = (posRes.data || []).reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
      const linksSum = (linksRes.data || []).reduce((s: number, l: any) => s + Number(l.net_amount ?? l.montant ?? 0), 0);
      return ordersSum + posSum + linksSum;
    },
    enabled: !!vendorId
  });

  // Récupérer les achats du mois (stock_purchases - utilise vendorId)
  const { data: monthlyPurchases = 0, isLoading: loadingPurchases } = useQuery({
    queryKey: ['vendor-period-purchases', vendorId, period],
    queryFn: async () => {
      const { startIso, endIso } = periodRange;
      // Même fenêtre que les ventes ; achat compté à sa VALIDATION (validated_at) — date à
      // laquelle le stock + la dépense sont enregistrés (cohérent avec les ventes).
      let q = supabase
        .from('stock_purchases')
        .select('total_purchase_amount')
        .eq('vendor_id', vendorId)
        .eq('status', 'validated');
      if (startIso) q = q.gte('validated_at', startIso).lte('validated_at', endIso);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []).reduce((sum: number, p: any) => sum + Number(p.total_purchase_amount || 0), 0);
    },
    enabled: !!vendorId
  });

  // Mutation pour ajouter un coût fixe (utilise userId)
  const addCostMutation = useMutation({
    mutationFn: async (data: { cost_type: string; label: string; amount: number }) => {
      const { error } = await supabase
        .from('vendor_fixed_costs')
        .insert({
          vendor_id: userId,
          cost_type: data.cost_type,
          label: data.label,
          amount: data.amount,
          is_active: true
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-fixed-costs', userId] });
      toast({ title: t('monthlyProfitAnalysis.coutFixeAjouteAvecSucces') });
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erreur', description: t('monthlyProfitAnalysis.impossibleDAjouterLeCout'), variant: 'destructive' });
    }
  });

  // Mutation pour mettre à jour un coût fixe
  const updateCostMutation = useMutation({
    mutationFn: async (data: { id: string; cost_type: string; label: string; amount: number }) => {
      const { error } = await supabase
        .from('vendor_fixed_costs')
        .update({
          cost_type: data.cost_type,
          label: data.label,
          amount: data.amount
        })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-fixed-costs', userId] });
      toast({ title: t('monthlyProfitAnalysis.coutFixeMisAJour') });
      setEditingCost(null);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Erreur', description: t('monthlyProfitAnalysis.impossibleDeMettreAJour'), variant: 'destructive' });
    }
  });

  // Mutation pour supprimer un coût fixe
  const deleteCostMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vendor_fixed_costs')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-fixed-costs', userId] });
      toast({ title: t('monthlyProfitAnalysis.coutFixeSupprime') });
    },
    onError: () => {
      toast({ title: 'Erreur', description: t('monthlyProfitAnalysis.impossibleDeSupprimer'), variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({ cost_type: 'loyer', label: '', amount: '' });
  };

  const handleSubmit = () => {
    if (!formData.label || !formData.amount) {
      toast({ title: 'Champs requis', description: t('monthlyProfitAnalysis.veuillezRemplirTousLesChamps'), variant: 'destructive' });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount < 0) {
      toast({ title: t('monthlyProfitAnalysis.montantInvalide'), variant: 'destructive' });
      return;
    }

    if (editingCost) {
      updateCostMutation.mutate({
        id: editingCost.id,
        cost_type: formData.cost_type,
        label: formData.label,
        amount
      });
    } else {
      addCostMutation.mutate({
        cost_type: formData.cost_type,
        label: formData.label,
        amount
      });
    }
  };

  const handleEdit = (cost: FixedCost) => {
    setEditingCost(cost);
    setFormData({
      cost_type: cost.cost_type,
      label: cost.label,
      amount: cost.amount.toString()
    });
    setIsAddDialogOpen(true);
  };

  // Calculs
  // Total des coûts fixes MENSUELS configurés (loyer, abonnement…).
  const monthlyFixedCosts = useMemo(() => {
    return fixedCosts.reduce((sum, cost) => sum + Number(cost.amount || 0), 0);
  }, [fixedCosts]);

  // Coûts fixes PRORATISÉS à la période sélectionnée (sinon on soustrairait un mois entier
  // de loyer d'une seule journée de ventes → profit faux).
  const totalFixedCosts = useMemo(() => {
    const factor: Record<typeof period, number> = { day: 1 / 30, week: 7 / 30, month: 1, year: 12, all: 1 };
    return monthlyFixedCosts * (factor[period] ?? 1);
  }, [monthlyFixedCosts, period]);

  const grossProfit = useMemo(() => {
    return monthlySales - monthlyPurchases;
  }, [monthlySales, monthlyPurchases]);

  const netProfit = useMemo(() => {
    return grossProfit - totalFixedCosts;
  }, [grossProfit, totalFixedCosts]);

  const profitMargin = useMemo(() => {
    if (monthlySales === 0) return 0;
    return (netProfit / monthlySales) * 100;
  }, [netProfit, monthlySales]);

  // Données pour le graphique en secteurs
  const pieData = useMemo(() => {
    const costsByType: Record<string, number> = {};
    fixedCosts.forEach(cost => {
      costsByType[cost.cost_type] = (costsByType[cost.cost_type] || 0) + Number(cost.amount);
    });

    return Object.entries(costsByType).map(([type, amount]) => ({
      name: COST_TYPE_LABELS[type]?.label || type,
      value: amount,
      color: COST_TYPE_LABELS[type]?.color || '#6B7280'
    }));
  }, [fixedCosts]);

  const isLoading = loadingCosts || loadingSales || loadingPurchases;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('monthlyProfitAnalysis.analyseDeProfit')}</h3>
          <p className="text-sm text-muted-foreground capitalize">{periodRange.label}</p>
          {/* Sélecteur de période : pilote ventes ET achats (mêmes dates). */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {([['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois'], ['year', 'Année'], ['all', 'Tout']] as const).map(([val, lbl]) => (
              <Button key={val} size="sm" variant={period === val ? 'default' : 'outline'}
                className="h-7 px-2.5 text-xs" onClick={() => setPeriod(val)}>
                {lbl}
              </Button>
            ))}
          </div>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setEditingCost(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un coût fixe
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCost ? 'Modifier le coût fixe' : 'Ajouter un coût fixe mensuel'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>{t('monthlyProfitAnalysis.typeDeCout')}</Label>
                <Select
                  value={formData.cost_type}
                  onValueChange={(value: FixedCost['cost_type']) =>
                    setFormData(prev => ({ ...prev, cost_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COST_TYPE_LABELS).map(([key, { label, icon }]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          {icon}
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('monthlyProfitAnalysis.libelle')}</Label>
                <Input
                  placeholder={t('monthlyProfitAnalysis.exLoyerBoutique')}
                  value={formData.label}
                  onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                />
              </div>
              <div>
                <Label>{t('monthlyProfitAnalysis.montantMensuelGnf')}</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <Button
                onClick={handleSubmit}
                className="w-full"
                disabled={addCostMutation.isPending || updateCostMutation.isPending}
              >
                {(addCostMutation.isPending || updateCostMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingCost ? 'Mettre à jour' : 'Ajouter'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Résumé principal */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Chiffre d'affaires */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-sm text-muted-foreground truncate">{t('monthlyProfitAnalysis.ventesDuMois')}</p>
                <p className="text-sm sm:text-xl font-bold text-[#ff4000] truncate">{formatCurrency(monthlySales)}</p>
              </div>
              <div className="p-1.5 sm:p-2 bg-orange-100 rounded-full shrink-0 ml-1">
                <TrendingUp className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#ff4000]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coût des achats */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-sm text-muted-foreground truncate">{t('monthlyProfitAnalysis.achatsDuMois')}</p>
                <p className="text-sm sm:text-xl font-bold text-[#ff4000] truncate">{formatCurrency(monthlyPurchases)}</p>
              </div>
              <div className="p-1.5 sm:p-2 bg-orange-100 rounded-full shrink-0 ml-1">
                <DollarSign className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#ff4000]" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coûts fixes */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-sm text-muted-foreground truncate">{t('monthlyProfitAnalysis.coutsFixes')}</p>
                <p className="text-sm sm:text-xl font-bold text-orange-600 truncate">{formatCurrency(totalFixedCosts)}</p>
              </div>
              <div className="p-1.5 sm:p-2 bg-orange-100 rounded-full shrink-0 ml-1">
                <Home className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profit net */}
        <Card className={netProfit >= 0 ? 'border-orange-200 bg-orange-50/50' : 'border-orange-200 bg-orange-50/50'}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-sm text-muted-foreground truncate">Profit net</p>
                <p className={`text-sm sm:text-xl font-bold truncate ${netProfit >= 0 ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
                  {formatCurrency(netProfit)}
                </p>
                <p className={`text-[10px] sm:text-xs ${netProfit >= 0 ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
                  Marge: {profitMargin.toFixed(1)}%
                </p>
              </div>
              <div className={`p-1.5 sm:p-2 rounded-full shrink-0 ml-1 ${netProfit >= 0 ? 'bg-orange-100' : 'bg-orange-100'}`}>
                {netProfit >= 0 ? (
                  <CheckCircle className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#ff4000]" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#ff4000]" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Détail du calcul */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="w-4 h-4" />
            Détail du calcul
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Chiffre d'affaires (ventes)</span>
              <span className="font-medium text-[#ff4000]">+ {formatCurrency(monthlySales)}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">{t('monthlyProfitAnalysis.coutDesAchatsStock')}</span>
              <span className="font-medium text-[#ff4000]">- {formatCurrency(monthlyPurchases)}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center py-2 bg-muted/50 rounded px-2">
              <span className="font-medium">Marge brute</span>
              <span className={`font-bold ${grossProfit >= 0 ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
                {formatCurrency(grossProfit)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">{t('monthlyProfitAnalysis.totalCoutsFixes')}</span>
              <span className="font-medium text-[#ff4000]">- {formatCurrency(totalFixedCosts)}</span>
            </div>
            <Separator />
            <div className={`flex justify-between items-center py-3 rounded px-2 ${
              netProfit >= 0 ? 'bg-orange-100' : 'bg-orange-100'
            }`}>
              <span className="font-bold">Profit net mensuel</span>
              <span className={`font-bold text-lg ${netProfit >= 0 ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
                {formatCurrency(netProfit)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grille: Coûts fixes + Graphique */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Liste des coûts fixes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('monthlyProfitAnalysis.coutsFixesMensuels')}</CardTitle>
          </CardHeader>
          <CardContent>
            {fixedCosts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Home className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('monthlyProfitAnalysis.aucunCoutFixeConfigure')}</p>
                <p className="text-sm">{t('monthlyProfitAnalysis.ajoutezVotreLoyerAbonnementEtc')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fixedCosts.map((cost) => {
                  const typeInfo = COST_TYPE_LABELS[cost.cost_type] || COST_TYPE_LABELS.autre;
                  return (
                    <div
                      key={cost.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="p-2 rounded-full"
                          style={{ backgroundColor: `${typeInfo.color}20` }}
                        >
                          {React.cloneElement(typeInfo.icon as React.ReactElement, {
                            style: { color: typeInfo.color }
                          })}
                        </div>
                        <div>
                          <p className="font-medium">{cost.label}</p>
                          <Badge variant="outline" className="text-xs">
                            {typeInfo.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{formatCurrency(cost.amount)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(cost)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteCostMutation.mutate(cost.id)}
                          disabled={deleteCostMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Graphique répartition */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('monthlyProfitAnalysis.repartitionDesCoutsFixes')}</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                Aucune donnée disponible
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerte si profit négatif */}
      {netProfit < 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            <strong>Attention !</strong> Votre profit net est négatif ce mois-ci.
            Vos dépenses ({formatCurrency(monthlyPurchases + totalFixedCosts)}) dépassent
            vos ventes ({formatCurrency(monthlySales)}).
            Considérez réduire vos coûts fixes ou augmenter vos ventes.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
