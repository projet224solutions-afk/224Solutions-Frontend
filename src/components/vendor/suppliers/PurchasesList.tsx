/**
 * Liste et gestion des achats de stock
 * Workflow complet: Brouillon → Document généré → Validé
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { readSectionCache, writeSectionCache, isBrowserOffline } from '@/lib/offline/sectionCache';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Plus,
  Search,
  FileText,
  CheckCircle,
  Clock,
  Lock,
  Eye,
  Trash2,
  ShoppingCart,
  Pencil,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { PurchaseEditor } from './PurchaseEditor';
import { NewPurchaseDialog, PurchaseProduct } from './NewPurchaseDialog';
import { useTranslation } from '@/hooks/useTranslation';
import { useVendorCurrency } from '@/hooks/useVendorCurrency';
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

interface PurchasesListProps {
  vendorId: string;
  initialPurchaseId?: string | null;
  onPurchaseViewed?: () => void;
}

interface Purchase {
  id: string;
  purchase_number: string;
  status: 'draft' | 'document_generated' | 'validated';
  total_purchase_amount: number;
  total_selling_amount: number;
  estimated_total_profit: number;
  notes: string | null;
  document_url: string | null;
  is_locked: boolean;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
}

const STATUS_CONFIG_BASE = {
  draft: {
    icon: Clock,
    variant: 'secondary' as const,
    color: 'text-orange-500',
  },
  document_generated: {
    icon: FileText,
    variant: 'outline' as const,
    color: 'text-blue-500',
  },
  validated: {
    icon: CheckCircle,
    variant: 'default' as const,
    color: 'text-[#ff4000]',
  },
};

export function PurchasesList({ vendorId, initialPurchaseId, onPurchaseViewed }: PurchasesListProps) {
  const { t, language } = useTranslation();
  const { currency, convert, isReady: currencyReady } = useVendorCurrency();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deletePurchase, setDeletePurchase] = useState<Purchase | null>(null);
  const [isNewPurchaseDialogOpen, setIsNewPurchaseDialogOpen] = useState(false);

  const dateLocale = language === 'fr' ? fr : enUS;

  const getStatusLabel = (status: string) => t(`purchases.status.${status}`);
  const formatAmount = (amount: number) => currencyReady ? `${Math.round(convert(amount)).toLocaleString('fr-FR')} ${currency}` : '—';

  // Fetch only validated purchases for main list
  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ['stock-purchases-validated', vendorId],
    queryFn: async () => {
      // 📴 Hors ligne : derniers achats validés connus (cache).
      if (isBrowserOffline()) {
        return readSectionCache<Purchase>('stock_purchases_validated', vendorId) ?? [];
      }

      const { data, error } = await supabase
        .from('stock_purchases')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('status', 'validated')
        .order('validated_at', { ascending: false });

      if (error) {
        const cached = readSectionCache<Purchase>('stock_purchases_validated', vendorId);
        if (cached) return cached;
        throw error;
      }
      writeSectionCache('stock_purchases_validated', vendorId, (data || []) as Purchase[]);
      return data as Purchase[];
    },
    enabled: !!vendorId,
  });

  // Effect to open purchase from external navigation
  useEffect(() => {
    if (initialPurchaseId && purchases.length > 0) {
      const purchase = purchases.find(p => p.id === initialPurchaseId);
      if (purchase) {
        setSelectedPurchase(purchase);
        setIsEditorOpen(true);
        onPurchaseViewed?.();
      }
    }
  }, [initialPurchaseId, purchases, onPurchaseViewed]);

  // Create new purchase with supplier and products
  const createMutation = useMutation({
    mutationFn: async ({
      supplierId,
      supplierName,
      products
    }: {
      supplierId: string;
      supplierName: string;
      products: PurchaseProduct[];
    }) => {
      // Generate purchase number
      const purchaseNumber = `ACH-${Date.now().toString(36).toUpperCase()}`;

      // Create the purchase (supplier_id is stored in purchase items, not in purchase header)
      const { data: purchase, error: purchaseError } = await supabase
        .from('stock_purchases')
        .insert([{
          vendor_id: vendorId,
          purchase_number: purchaseNumber,
          notes: `Fournisseur: ${supplierName}`,
        }])
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Insert purchase items with supplier_id
      if (products.length > 0) {
        const items = products.filter(p => p.quantity > 0).map(p => ({
          purchase_id: purchase.id,
          supplier_id: supplierId,
          product_id: p.productId,
          product_name: p.productName,
          quantity: p.quantity,
          purchase_price: p.unitCost,
          selling_price: p.sellingPrice, // Prix de vente réel du produit
        }));

        if (items.length > 0) {
          const { error: itemsError } = await supabase
            .from('stock_purchase_items')
            .insert(items);

          if (itemsError) {
            console.error('Error inserting purchase items:', itemsError);
          }
        }
      }

      return purchase as Purchase;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stock-purchases', vendorId] });
      queryClient.invalidateQueries({ queryKey: ['supplier-purchase-stats', vendorId] });
      setSelectedPurchase(data);
      setIsEditorOpen(true);
      setIsNewPurchaseDialogOpen(false);
      toast.success(t('purchases.created'));
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleCreatePurchase = (supplierId: string, supplierName: string, products: PurchaseProduct[]) => {
    createMutation.mutate({ supplierId, supplierName, products });
  };

  // Delete purchase
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // 1. Supprimer les items d'abord (contrainte de clé étrangère)
      const { error: itemsError } = await supabase
        .from('stock_purchase_items')
        .delete()
        .eq('purchase_id', id);

      if (itemsError) throw itemsError;

      // 2. Supprimer l'achat
      const { error } = await supabase
        .from('stock_purchases')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-purchases-validated', vendorId] });
      queryClient.invalidateQueries({ queryKey: ['supplier-purchase-stats', vendorId] });
      toast.success(t('purchases.deleted'));
      setDeletePurchase(null);
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const handleOpenPurchase = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setSelectedPurchase(null);
    queryClient.invalidateQueries({ queryKey: ['stock-purchases', vendorId] });
    queryClient.invalidateQueries({ queryKey: ['supplier-purchase-stats', vendorId] });
  };

  // Removed hardcoded formatCurrency - using formatAmount from top of component

  const filteredPurchases = purchases.filter((p) =>
    p.purchase_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isEditorOpen && selectedPurchase) {
    return (
      <PurchaseEditor
        purchase={selectedPurchase}
        vendorId={vendorId}
        onClose={handleCloseEditor}
      />
    );
  }

  if (isLoading) {
    return <div className="text-center py-8">{t('purchases.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 md:h-4 md:w-4 text-muted-foreground" />
          <Input
            placeholder={t('purchases.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 md:pl-9 text-base md:text-sm h-11 md:h-10"
          />
        </div>
        <Button
          onClick={() => setIsNewPurchaseDialogOpen(true)}
          className="gap-2 h-11 md:h-10"
        >
          <Plus className="h-5 w-5 md:h-4 md:w-4" />
          <span className="text-base md:text-sm">{t('purchases.new')}</span>
        </Button>
      </div>

      {/* Liste des achats */}
      {filteredPurchases.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            {searchTerm
              ? t('purchases.notFound')
              : t('purchases.empty')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPurchases.map((purchase) => {
            const config = STATUS_CONFIG_BASE[purchase.status];
            const StatusIcon = config.icon;

            return (
              <Card
                key={purchase.id}
                className="hover:shadow-md transition-shadow cursor-pointer active:scale-[0.98]"
                onClick={() => handleOpenPurchase(purchase)}
              >
                <CardContent className="p-5 md:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 md:p-2 rounded-lg bg-muted ${config.color}`}>
                        <StatusIcon className="h-6 w-6 md:h-5 md:w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{purchase.purchase_number}</h3>
                          {purchase.is_locked && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(purchase.created_at), {
                            addSuffix: true,
                            locale: dateLocale,
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={config.variant}>{getStatusLabel(purchase.status)}</Badge>
                      <div className="text-right">
                        <p className="font-semibold text-sm">
                          {formatAmount(purchase.total_purchase_amount)}
                        </p>
                        <p className="text-xs text-primary">
                          +{formatAmount(purchase.estimated_total_profit)} {t('purchases.profit')}
                        </p>
                      </div>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" title={t('purchases.view')} className="h-10 w-10 md:h-9 md:w-9">
                          <Eye className="h-5 w-5 md:h-4 md:w-4" />
                        </Button>
                        {!purchase.is_locked && purchase.status !== 'validated' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t('purchases.edit')}
                            onClick={() => handleOpenPurchase(purchase)}
                            className="h-10 w-10 md:h-9 md:w-9"
                          >
                            <Pencil className="h-5 w-5 md:h-4 md:w-4 text-primary" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          title={t('purchases.deleteAction')}
                          onClick={() => setDeletePurchase(purchase)}
                          className="h-10 w-10 md:h-9 md:w-9"
                        >
                          <Trash2 className="h-5 w-5 md:h-4 md:w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Alert suppression */}
      <AlertDialog
        open={!!deletePurchase}
        onOpenChange={() => setDeletePurchase(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('purchases.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deletePurchase?.purchase_number}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('purchases.delete.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePurchase && deleteMutation.mutate(deletePurchase.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('purchases.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog nouvel achat */}
      <NewPurchaseDialog
        vendorId={vendorId}
        isOpen={isNewPurchaseDialogOpen}
        onClose={() => setIsNewPurchaseDialogOpen(false)}
        onConfirm={handleCreatePurchase}
        isCreating={createMutation.isPending}
      />
    </div>
  );
}
