/**
 * Sheet affichant les achats non validés (brouillons)
 * Avec boutons de modification et validation
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Package,
  Clock,
  FileText,
  AlertTriangle,
  Pencil,
  Trash2,
  Loader2
} from 'lucide-react';
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
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PurchaseEditor } from './PurchaseEditor';

interface DraftPurchasesSheetProps {
  vendorId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface Purchase {
  id: string;
  purchase_number: string;
  status: 'draft' | 'document_generated' | 'validated';
  total_purchase_amount: number;
  total_selling_amount: number;
  estimated_total_profit: number;
  document_url: string | null;
  is_locked: boolean;
  notes: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG = {
  draft: {
    label: 'Brouillon',
    icon: Clock,
    color: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  },
  document_generated: {
    label: 'Document généré',
    icon: FileText,
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  },
  validated: {
    label: 'Validé',
    icon: Clock,
    color: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/30',
  },
};

export function DraftPurchasesSheet({ vendorId, isOpen, onClose }: DraftPurchasesSheetProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null);

  const { data: purchases = [], isLoading, refetch } = useQuery({
    queryKey: ['draft-purchases', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_purchases')
        .select('*')
        .eq('vendor_id', vendorId)
        .neq('status', 'validated')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Purchase[];
    },
    enabled: isOpen && !!vendorId,
  });

  // Stats par statut
  const draftCount = purchases.filter(p => p.status === 'draft').length;
  const documentGeneratedCount = purchases.filter(p => p.status === 'document_generated').length;
  const totalAmount = purchases.reduce((sum, p) => sum + (p.total_purchase_amount || 0), 0);

  const formatCurrency = useFormatCurrency();

  const handleEditPurchase = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setSelectedPurchase(null);
    refetch();
    queryClient.invalidateQueries({ queryKey: ['supplier-purchase-stats', vendorId] });
    queryClient.invalidateQueries({ queryKey: ['stock-purchases-validated', vendorId] });
  };

  const handleDeletePurchase = async () => {
    if (!purchaseToDelete) return;
    setDeletingId(purchaseToDelete.id);
    try {
      // 1. Supprimer les items d'abord
      const { error: itemsError } = await supabase
        .from('stock_purchase_items')
        .delete()
        .eq('purchase_id', purchaseToDelete.id);

      if (itemsError) throw itemsError;

      // 2. Supprimer l'achat
      const { error } = await supabase
        .from('stock_purchases')
        .delete()
        .eq('id', purchaseToDelete.id);

      if (error) throw error;

      toast.success(t('draftPurchasesSheet.achatSupprimeAvecSucces'));
      refetch();
      queryClient.invalidateQueries({ queryKey: ['supplier-purchase-stats', vendorId] });
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(`Erreur de suppression: ${error.message}`);
    } finally {
      setDeletingId(null);
      setPurchaseToDelete(null);
    }
  };

  const _handleValidatePurchase = async (purchase: Purchase) => {
    setValidatingId(purchase.id);
    try {
      // 1. Récupérer les items de l'achat
      const { data: items, error: itemsError } = await supabase
        .from('stock_purchase_items')
        .select('id, product_id, supplier_id, product_name, quantity, purchase_price, selling_price, total_purchase')
        .eq('purchase_id', purchase.id);

      if (itemsError) throw itemsError;
      if (!items || items.length === 0) {
        throw new Error('Aucun article trouvé pour cet achat');
      }

      // 2. Valider via le backend Node (atomique, RPC validate_stock_purchase)
      const { backendFetch } = await import('@/services/backendApi');
      const resp = await backendFetch<any>('/api/inventory/validate-purchase', {
        body: {
          purchase_id: purchase.id,
          vendor_id: vendorId,
          items: items,
          purchase_number: purchase.purchase_number,
          total_amount: purchase.total_purchase_amount
        }
      });

      if (!resp.success) throw new Error(resp.error || 'Erreur de validation');

      toast.success(t('draftPurchasesSheet.achatValideAvecSuccesStock'));
      refetch();
      queryClient.invalidateQueries({ queryKey: ['supplier-purchase-stats', vendorId] });
      queryClient.invalidateQueries({ queryKey: ['stock-purchases-validated', vendorId] });
    } catch (error: any) {
      console.error('Validation error:', error);
      toast.error(`Erreur de validation: ${error.message}`);
    } finally {
      setValidatingId(null);
    }
  };

  // Si l'éditeur est ouvert, on l'affiche en plein écran
  if (isEditorOpen && selectedPurchase) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-4xl p-0 max-h-[90vh] overflow-y-auto">
          <PurchaseEditor
            purchase={selectedPurchase}
            vendorId={vendorId}
            onClose={handleCloseEditor}
          />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-orange-500" />
            Achats en attente
          </SheetTitle>
          <SheetDescription>
            Achats non validés nécessitant une action
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          {/* Stats résumé */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Card className="bg-orange-500/10 border-orange-500/20">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-orange-600">{draftCount}</p>
                <p className="text-xs text-muted-foreground">Brouillons</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/10 border-blue-500/20">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{documentGeneratedCount}</p>
                <p className="text-xs text-muted-foreground">{t('draftPurchasesSheet.docsGeneres')}</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold">{formatCurrency(totalAmount)}</p>
                <p className="text-xs text-muted-foreground">Total en attente</p>
              </CardContent>
            </Card>
          </div>

          {/* Message d'alerte */}
          {purchases.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-[#ff4000]/10 border border-[#ff4000]/20">
              <AlertTriangle className="h-4 w-4 text-[#ff4000] mt-0.5 shrink-0" />
              <p className="text-xs text-[#ff4000]">
                Ces achats n'ont pas encore été validés. Le stock ne sera mis à jour qu'après validation.
              </p>
            </div>
          )}

          {/* Liste des achats */}
          <ScrollArea className="h-[calc(100vh-340px)]">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : purchases.length === 0 ? (
              <div className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{t('draftPurchasesSheet.aucunAchatEnAttente')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('draftPurchasesSheet.tousVosAchatsOntEte')}</p>
              </div>
            ) : (
              <div className="space-y-3 pr-4">
                {purchases.map((purchase) => {
                  const config = STATUS_CONFIG[purchase.status];
                  const StatusIcon = config.icon;
                  const _isValidating = validatingId === purchase.id;

                  return (
                    <Card key={purchase.id} className="hover:shadow-md transition-shadow border-l-4 border-l-orange-500">
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${purchase.status === 'draft' ? 'bg-orange-500/20' : 'bg-blue-500/20'}`}>
                                <StatusIcon className={`h-4 w-4 ${purchase.status === 'draft' ? 'text-orange-500' : 'text-blue-500'}`} />
                              </div>
                              <div>
                                <p className="font-semibold">{purchase.purchase_number}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(purchase.created_at), { addSuffix: true, locale: fr })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className={config.color}>
                                {config.label}
                              </Badge>
                              <p className="font-bold text-lg mt-1">
                                {formatCurrency(purchase.total_purchase_amount)}
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 pt-2 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 gap-2"
                              onClick={() => handleEditPurchase(purchase)}
                              disabled={purchase.is_locked}
                            >
                              <Pencil className="h-4 w-4" />
                              Modifier
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setPurchaseToDelete(purchase)}
                              disabled={deletingId === purchase.id}
                            >
                              {deletingId === purchase.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Dialog de confirmation de suppression */}
        <AlertDialog open={!!purchaseToDelete} onOpenChange={() => setPurchaseToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('draftPurchasesSheet.supprimerCetAchat')}</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer l'achat <strong>{purchaseToDelete?.purchase_number}</strong> ?
                Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('draftPurchasesSheet.annuler')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeletePurchase}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
