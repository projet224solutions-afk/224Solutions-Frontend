/**
 * Sheet affichant les achats validés avec statistiques par période
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ShoppingCart,
  Clock,
  CalendarDays,
  Calendar,
  CalendarRange,
  CheckCircle,
  TrendingUp,
  Eye,
  Trash2
} from 'lucide-react';
import { startOfDay, startOfWeek, startOfMonth, startOfYear, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface ValidatedPurchasesSheetProps {
  vendorId: string;
  isOpen: boolean;
  onClose: () => void;
  onViewPurchase?: (purchaseId: string) => void;
}

interface Purchase {
  id: string;
  purchase_number: string;
  total_purchase_amount: number;
  total_selling_amount: number;
  estimated_total_profit: number;
  validated_at: string;
  created_at: string;
}

type PeriodFilter = 'today' | 'week' | 'month' | 'year' | 'all';

export function ValidatedPurchasesSheet({ vendorId, isOpen, onClose, onViewPurchase }: ValidatedPurchasesSheetProps) {
  const { t } = useTranslation();
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [deletePurchase, setDeletePurchase] = useState<Purchase | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

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

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['validated-purchases', vendorId, periodFilter],
    queryFn: async () => {
      const dateFilter = getDateFilter();
      let query = supabase
        .from('stock_purchases')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('status', 'validated')
        .order('validated_at', { ascending: false });

      if (dateFilter) {
        query = query.gte('validated_at', dateFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Purchase[];
    },
    enabled: isOpen && !!vendorId,
  });

  // Stats par période
  const { data: periodStats } = useQuery({
    queryKey: ['validated-purchases-stats', vendorId],
    queryFn: async () => {
      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      const monthStart = startOfMonth(now).toISOString();
      const yearStart = startOfYear(now).toISOString();

      const [todayRes, weekRes, monthRes, yearRes, allRes] = await Promise.all([
        supabase
          .from('stock_purchases')
          .select('id, total_purchase_amount, estimated_total_profit')
          .eq('vendor_id', vendorId)
          .eq('status', 'validated')
          .gte('validated_at', todayStart),
        supabase
          .from('stock_purchases')
          .select('id, total_purchase_amount, estimated_total_profit')
          .eq('vendor_id', vendorId)
          .eq('status', 'validated')
          .gte('validated_at', weekStart),
        supabase
          .from('stock_purchases')
          .select('id, total_purchase_amount, estimated_total_profit')
          .eq('vendor_id', vendorId)
          .eq('status', 'validated')
          .gte('validated_at', monthStart),
        supabase
          .from('stock_purchases')
          .select('id, total_purchase_amount, estimated_total_profit')
          .eq('vendor_id', vendorId)
          .eq('status', 'validated')
          .gte('validated_at', yearStart),
        supabase
          .from('stock_purchases')
          .select('id, total_purchase_amount, estimated_total_profit')
          .eq('vendor_id', vendorId)
          .eq('status', 'validated'),
      ]);

      const calcStats = (data: any[] | null) => ({
        count: data?.length || 0,
        totalAmount: data?.reduce((sum, p) => sum + (p.total_purchase_amount || 0), 0) || 0,
        totalProfit: data?.reduce((sum, p) => sum + (p.estimated_total_profit || 0), 0) || 0,
      });

      return {
        today: calcStats(todayRes.data),
        week: calcStats(weekRes.data),
        month: calcStats(monthRes.data),
        year: calcStats(yearRes.data),
        all: calcStats(allRes.data),
      };
    },
    enabled: isOpen && !!vendorId,
  });

  const handleDeletePurchase = async () => {
    if (!deletePurchase) return;

    setIsDeleting(true);
    try {
      // Supprimer les items d'abord
      await supabase
        .from('stock_purchase_items')
        .delete()
        .eq('purchase_id', deletePurchase.id);

      // Supprimer l'achat
      const { error } = await supabase
        .from('stock_purchases')
        .delete()
        .eq('id', deletePurchase.id);

      if (error) throw error;

      toast.success(t('validatedPurchasesSheet.achatSupprimeAvecSucces'));
      queryClient.invalidateQueries({ queryKey: ['validated-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['validated-purchases-stats'] });
      queryClient.invalidateQueries({ queryKey: ['stock-purchases'] });
    } catch (error) {
      console.error('Error deleting purchase:', error);
      toast.error(t('validatedPurchasesSheet.erreurLorsDeLaSuppression'));
    } finally {
      setIsDeleting(false);
      setDeletePurchase(null);
    }
  };

  const formatCurrency = useFormatCurrency();

  const periodConfig = {
    today: { label: "Aujourd'hui", icon: Clock },
    week: { label: 'Cette semaine', icon: CalendarDays },
    month: { label: 'Ce mois', icon: Calendar },
    year: { label: 'Cette année', icon: CalendarRange },
    all: { label: 'Tout', icon: ShoppingCart },
  };

  const currentStats = periodStats?.[periodFilter] || { count: 0, totalAmount: 0, totalProfit: 0 };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-[#ff4000]" />
              Achats Validés
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-4">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold">{currentStats.count}</p>
                  <p className="text-xs text-muted-foreground">Achats</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/50">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold">{formatCurrency(currentStats.totalAmount)}</p>
                  <p className="text-xs text-muted-foreground">Total investi</p>
                </CardContent>
              </Card>
              <Card className="bg-[#ff4000]/10 border-[#ff4000]/20">
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-[#ff4000]">{formatCurrency(currentStats.totalProfit)}</p>
                  <p className="text-xs text-muted-foreground">{t('validatedPurchasesSheet.profitEstime')}</p>
                </CardContent>
              </Card>
            </div>

            {/* Liste des achats */}
            <ScrollArea className="h-[calc(100vh-320px)]">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Chargement...</div>
              ) : purchases.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">{t('validatedPurchasesSheet.aucunAchatValidePourCette')}</p>
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {purchases.map((purchase) => (
                    <Card key={purchase.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{purchase.purchase_number}</p>
                            <p className="text-xs text-muted-foreground">
                              {purchase.validated_at && format(new Date(purchase.validated_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                            </p>
                          </div>
                          <div className="text-right mr-3">
                            <p className="font-semibold text-sm">{formatCurrency(purchase.total_purchase_amount)}</p>
                            <div className="flex items-center gap-1 text-xs text-[#ff4000]">
                              <TrendingUp className="h-3 w-3" />
                              +{formatCurrency(purchase.estimated_total_profit)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {onViewPurchase && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title={t('validatedPurchasesSheet.voirLesDetails')}
                                onClick={() => {
                                  onViewPurchase(purchase.id);
                                  onClose();
                                }}
                              >
                                <Eye className="h-4 w-4 text-primary" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title={t('validatedPurchasesSheet.supprimerLAchat')}
                              onClick={() => setDeletePurchase(purchase)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={!!deletePurchase} onOpenChange={() => setDeletePurchase(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('validatedPurchasesSheet.supprimerCetAchat')}</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l'achat <strong>{deletePurchase?.purchase_number}</strong> ?
              Cette action est irréversible et supprimera également tous les articles associés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('validatedPurchasesSheet.annuler')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePurchase}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}