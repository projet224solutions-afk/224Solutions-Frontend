/**
 * Section des dépenses liées aux achats de stock
 * Affiche les achats synchronisés avec statistiques par période
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useVendorCurrency } from '@/hooks/useVendorCurrency';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingCart,
  Clock,
  CalendarDays,
  Calendar,
  CalendarRange,
  TrendingUp,
  Lock,
  Package
} from 'lucide-react';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PurchaseExpensesSectionProps {
  vendorId: string;
}

type PeriodFilter = 'today' | 'week' | 'month' | 'year' | 'all';

interface PurchaseExpense {
  id: string;
  amount: number;
  description: string;
  expense_date: string;
  purchase_reference: string | null;
  is_locked: boolean;
  created_at: string;
}

export function PurchaseExpensesSection({ vendorId }: PurchaseExpensesSectionProps) {
  const { t } = useTranslation();
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');

  const getDateFilter = () => {
    const now = new Date();
    switch (periodFilter) {
      case 'today':
        return startOfDay(now).toISOString();
      case 'week':
        return startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      case 'month':
        return startOfMonth(now).toISOString();
      case 'year':
        return startOfYear(now).toISOString();
      default:
        return null;
    }
  };

  // Récupérer les dépenses liées aux achats (avec purchase_reference)
  const { data: purchaseExpenses = [], isLoading } = useQuery({
    queryKey: ['purchase-expenses', vendorId, periodFilter],
    queryFn: async () => {
      const dateFilter = getDateFilter();
      let query = supabase
        .from('vendor_expenses')
        .select('*')
        .eq('vendor_id', vendorId)
        .not('purchase_reference', 'is', null)
        .order('created_at', { ascending: false });

      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PurchaseExpense[];
    },
    enabled: !!vendorId,
  });

  // Stats par période
  const { data: periodStats } = useQuery({
    queryKey: ['purchase-expenses-stats', vendorId],
    queryFn: async () => {
      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      const monthStart = startOfMonth(now).toISOString();
      const yearStart = startOfYear(now).toISOString();

      const [todayRes, weekRes, monthRes, yearRes, allRes] = await Promise.all([
        supabase
          .from('vendor_expenses')
          .select('id, amount')
          .eq('vendor_id', vendorId)
          .not('purchase_reference', 'is', null)
          .gte('created_at', todayStart),
        supabase
          .from('vendor_expenses')
          .select('id, amount')
          .eq('vendor_id', vendorId)
          .not('purchase_reference', 'is', null)
          .gte('created_at', weekStart),
        supabase
          .from('vendor_expenses')
          .select('id, amount')
          .eq('vendor_id', vendorId)
          .not('purchase_reference', 'is', null)
          .gte('created_at', monthStart),
        supabase
          .from('vendor_expenses')
          .select('id, amount')
          .eq('vendor_id', vendorId)
          .not('purchase_reference', 'is', null)
          .gte('created_at', yearStart),
        supabase
          .from('vendor_expenses')
          .select('id, amount')
          .eq('vendor_id', vendorId)
          .not('purchase_reference', 'is', null),
      ]);

      const calcStats = (data: any[] | null) => ({
        count: data?.length || 0,
        totalAmount: data?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0,
      });

      return {
        today: calcStats(todayRes.data),
        week: calcStats(weekRes.data),
        month: calcStats(monthRes.data),
        year: calcStats(yearRes.data),
        all: calcStats(allRes.data),
      };
    },
    enabled: !!vendorId,
  });

  const { currency, convert, isReady: currencyReady } = useVendorCurrency();
  const formatCurrency = (amount: number) => currencyReady ? `${Math.round(convert(amount)).toLocaleString('fr-FR')} ${currency}` : '—';

  const periodConfig = {
    today: { label: "Aujourd'hui", icon: Clock },
    week: { label: 'Cette semaine', icon: CalendarDays },
    month: { label: 'Ce mois', icon: Calendar },
    year: { label: 'Cette année', icon: CalendarRange },
    all: { label: 'Tout', icon: ShoppingCart },
  };

  const currentStats = periodStats?.[periodFilter] || { count: 0, totalAmount: 0 };

  if (!vendorId) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Chargement des données...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Dépenses d'Achats de Stock
            <Badge variant="outline" className="ml-2">
              Synchronisées
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tabs de période */}
          <Tabs value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
            <TabsList className="grid grid-cols-5 w-full">
              {Object.entries(periodConfig).map(([key, { label, icon: Icon }]) => (
                <TabsTrigger key={key} value={key} className="text-xs px-2">
                  <Icon className="h-3 w-3 mr-1 hidden sm:inline" />
                  {key === 'today' ? 'Jour' : key === 'week' ? 'Sem.' : key === 'month' ? 'Mois' : key === 'year' ? 'Année' : 'Tout'}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Stats résumé */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold">{currentStats.count}</p>
                <p className="text-sm text-muted-foreground">Achats</p>
              </CardContent>
            </Card>
            <Card className="bg-destructive/10 border-destructive/20">
              <CardContent className="p-4 text-center">
                <p className="text-xl font-bold text-destructive">{formatCurrency(currentStats.totalAmount)}</p>
                <p className="text-sm text-muted-foreground">{t('purchaseExpensesSection.totalDepense')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Liste des dépenses d'achats */}
          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : purchaseExpenses.length === 0 ? (
              <div className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{t('purchaseExpensesSection.aucuneDepenseDAchatPour')}</p>
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {purchaseExpenses.map((expense) => (
                  <Card key={expense.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm">{expense.purchase_reference}</p>
                            {expense.is_locked && (
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {expense.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(expense.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-destructive">
                            -{formatCurrency(Number(expense.amount))}
                          </p>
                          <Badge variant="secondary" className="text-xs mt-1">
                            Achat stock
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
