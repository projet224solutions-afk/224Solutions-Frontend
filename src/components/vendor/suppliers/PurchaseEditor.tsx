/**
 * Éditeur d'achat de stock complet
 * Ajout produits, calculs automatiques, génération PDF, validation
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  DialogFooter,
} from '@/components/ui/dialog';
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
  ArrowLeft,
  Plus,
  Trash2,
  FileText,
  CheckCircle,
  Lock,
  Package,
  Calculator,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import { MissingProductsVerificationDialog } from './MissingProductsVerificationDialog';

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
}

interface PurchaseItem {
  id: string;
  purchase_id: string;
  supplier_id: string | null;
  product_id: string | null;
  category_id: string | null;
  product_name: string;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  unit_profit: number;
  total_purchase: number;
  total_selling: number;
  total_profit: number;
}

interface Supplier {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  stock_quantity: number | null;
  supplier_unit_cost?: number | null; // Coût chez le fournisseur
}

interface Category {
  id: string;
  name: string;
}

interface PurchaseEditorProps {
  purchase: Purchase;
  vendorId: string;
  onClose: () => void;
}

export function PurchaseEditor({ purchase, vendorId, onClose }: PurchaseEditorProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [showValidateConfirm, setShowValidateConfirm] = useState(false);
  const [missingProductsData, setMissingProductsData] = useState<any[]>([]);
  // Mode de paiement de l'achat : payé (dépense) ou à crédit (dette fournisseur).
  const [paymentMode, setPaymentMode] = useState<'cash' | 'credit'>('cash');
  const [creditDueDate, setCreditDueDate] = useState('');
  const [creditMinInstallment, setCreditMinInstallment] = useState('');
  const [notes, setNotes] = useState(purchase.notes || '');
  const [newItem, setNewItem] = useState({
    supplier_id: '',
    category_id: '',
    product_id: '',
    product_name: '',
    quantity: 1,
    purchase_price: 0,
    selling_price: 0,
  });

  // Fetch purchase items
  const { data: items = [], refetch: refetchItems } = useQuery({
    queryKey: ['purchase-items', purchase.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_purchase_items')
        .select('*')
        .eq('purchase_id', purchase.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as PurchaseItem[];
    },
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['vendor-suppliers-select', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_suppliers')
        .select('id, name')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Supplier[];
    },
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Category[];
    },
  });

  // Fetch products linked to selected supplier
  const { data: products = [] } = useQuery({
    queryKey: ['vendor-products-by-supplier', vendorId, newItem.supplier_id, newItem.category_id],
    queryFn: async () => {
      // Si un fournisseur est sélectionné, on récupère ses produits liés
      if (newItem.supplier_id) {
        const { data: supplierProducts, error: spError } = await supabase
          .from('vendor_supplier_products')
          .select(`
            id,
            product_id,
            unit_cost,
            default_quantity,
            products:product_id (
              id,
              name,
              price,
              category_id,
              stock_quantity
            )
          `)
          .eq('supplier_id', newItem.supplier_id);

        if (spError) throw spError;

        // Transformer les données pour avoir le format Product attendu
        let filteredProducts = (supplierProducts || [])
          .filter(sp => sp.products)
          .map(sp => ({
            id: (sp.products as any).id,
            name: (sp.products as any).name,
            price: (sp.products as any).price,
            category_id: (sp.products as any).category_id,
            stock_quantity: (sp.products as any).stock_quantity,
            supplier_unit_cost: sp.unit_cost, // Coût unitaire chez ce fournisseur
          }));

        // Filtrer par catégorie si sélectionnée
        if (newItem.category_id) {
          filteredProducts = filteredProducts.filter(p => p.category_id === newItem.category_id);
        }

        return filteredProducts as Product[];
      }

      // Si aucun fournisseur, on affiche tous les produits du vendeur
      let query = supabase
        .from('products')
        .select('id, name, price, category_id, stock_quantity')
        .eq('vendor_id', vendorId)
        .order('name');

      if (newItem.category_id) {
        query = query.eq('category_id', newItem.category_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Product[];
    },
  });

  // Get selected product for display
  const selectedProduct = products.find((p) => p.id === newItem.product_id);

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('stock_purchase_items').insert({
        purchase_id: purchase.id,
        supplier_id: newItem.supplier_id || null,
        category_id: newItem.category_id || null,
        product_id: newItem.product_id || null,
        product_name: newItem.product_name,
        quantity: newItem.quantity,
        purchase_price: newItem.purchase_price,
        selling_price: newItem.selling_price,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      refetchItems();
      queryClient.invalidateQueries({ queryKey: ['stock-purchases', vendorId] });
      toast.success(t('purchaseEditor.produitAjoute'));
      setIsAddItemDialogOpen(false);
      resetNewItem();
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('stock_purchase_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchItems();
      queryClient.invalidateQueries({ queryKey: ['stock-purchases', vendorId] });
      toast.success(t('purchaseEditor.produitRetire'));
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Update notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      const { error } = await supabase
        .from('stock_purchases')
        .update({ notes: newNotes })
        .eq('id', purchase.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('purchaseEditor.notesEnregistrees'));
    },
  });

  // Generate document mutation with PDF
  const generateDocMutation = useMutation({
    mutationFn: async () => {
      // Appel à l'Edge Function pour générer le PDF
      const { data, error: funcError } = await supabase.functions.invoke('generate-purchase-pdf', {
        body: {
          purchase_id: purchase.id,
          vendor_id: vendorId,
        },
      });

      if (funcError) throw funcError;

      // Générer le PDF côté client avec jsPDF
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();

      // Header
      doc.setFontSize(20);
      doc.setTextColor(30, 64, 175);
      doc.text('BON D\'ACHAT DE STOCK', 105, 20, { align: 'center' });

      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(purchase.purchase_number, 105, 28, { align: 'center' });
      doc.text(`Date: ${new Date(purchase.created_at).toLocaleDateString('fr-FR')}`, 105, 35, { align: 'center' });

      // Summary box - only purchase total (no profit for supplier document)
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 45, 85, 25, 'F');
      doc.rect(110, 45, 85, 25, 'F');

      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text('TOTAL ACHAT', 56.5, 52, { align: 'center' });
      doc.text('ARTICLES', 152.5, 52, { align: 'center' });

      doc.setFontSize(12);
      doc.setTextColor(30, 64, 175);
      doc.text(formatCurrency(totalPurchase), 56.5, 62, { align: 'center' });
      doc.setTextColor(51);
      doc.text(`${items.length} produit(s) / ${items.reduce((s, i) => s + i.quantity, 0)} unité(s)`, 152.5, 62, { align: 'center' });

      // Table header
      let yPos = 80;
      doc.setFillColor(30, 64, 175);
      doc.rect(14, yPos, 182, 8, 'F');
      doc.setFontSize(9);
      doc.setTextColor(255);
      doc.text('Produit', 16, yPos + 5.5);
      doc.text('Qté', 100, yPos + 5.5);
      doc.text('Prix Unitaire', 130, yPos + 5.5);
      doc.text('Total', 170, yPos + 5.5);

      // Table rows (no profit/selling price - supplier document)
      yPos += 8;
      doc.setTextColor(51);
      items.forEach((item, idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, yPos, 182, 8, 'F');
        }
        doc.setFontSize(9);
        doc.text(item.product_name.substring(0, 35), 16, yPos + 5.5);
        doc.text(item.quantity.toString(), 100, yPos + 5.5);
        doc.text(formatCurrency(item.purchase_price), 130, yPos + 5.5);
        doc.text(formatCurrency(item.total_purchase), 170, yPos + 5.5);
        yPos += 8;
      });

      // Save PDF
      doc.save(`${purchase.purchase_number}.pdf`);

      // Update status
      const { error } = await supabase
        .from('stock_purchases')
        .update({ status: 'document_generated' })
        .eq('id', purchase.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-purchases', vendorId] });
      toast.success(t('purchaseEditor.documentPdfGenereEtTelecharge'));
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Validate purchase mutation - backend Node (atomique, RPC validate_stock_purchase)
  const validateMutation = useMutation({
    mutationFn: async () => {
      // ACHAT À CRÉDIT : on pose le mode + échéance + fournisseur sur l'achat AVANT validation.
      // Le RPC validate_stock_purchase lit ces champs et crée une DETTE au lieu d'une dépense payée.
      if (paymentMode === 'credit') {
        const firstSupplier = items.find((i) => i.supplier_id)?.supplier_id || null;
        const { error: upErr } = await supabase
          .from('stock_purchases')
          .update({
            payment_mode: 'credit',
            supplier_id: firstSupplier,
            due_date: creditDueDate || null,
            minimum_installment: creditMinInstallment ? Number(creditMinInstallment) : 0,
          })
          .eq('id', purchase.id);
        if (upErr) throw new Error(upErr.message);
      }

      const { backendFetch } = await import('@/services/backendApi');
      const resp = await backendFetch<any>('/api/inventory/validate-purchase', {
        body: {
          purchase_id: purchase.id,
          vendor_id: vendorId,
          items: items,
          purchase_number: purchase.purchase_number,
          total_amount: items.reduce((sum, item) => sum + item.total_purchase, 0),
        },
      });

      if (!resp.success) throw new Error(resp.error || 'Erreur de validation');

      return resp.data ?? resp;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-purchases', vendorId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-expenses'] });
      toast.success(t('purchaseEditor.achatValideStockPrixD'));
      setShowValidateConfirm(false);
      onClose();
    },
    onError: (error: Error) => {
      toast.error(`Erreur validation: ${error.message}`);
    },
  });

  const resetNewItem = () => {
    setNewItem({
      supplier_id: '',
      category_id: '',
      product_id: '',
      product_name: '',
      quantity: 1,
      purchase_price: 0,
      selling_price: 0,
    });
  };

  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setNewItem({
        ...newItem,
        product_id: productId,
        product_name: product.name,
        selling_price: product.price,
        // Utiliser le coût fournisseur si disponible
        purchase_price: product.supplier_unit_cost || newItem.purchase_price,
      });
    }
  };

  const handleAddItem = () => {
    if (!newItem.product_name.trim()) {
      toast.error(t('purchaseEditor.leNomDuProduitEst'));
      return;
    }
    if (newItem.quantity < 1) {
      toast.error(t('purchaseEditor.laQuantiteDoitEtreSuperieure'));
      return;
    }
    if (newItem.purchase_price <= 0) {
      toast.error(t('purchaseEditor.lePrixDAchatEst'));
      return;
    }
    if (newItem.selling_price <= 0) {
      toast.error(t('purchaseEditor.lePrixDeVenteEst'));
      return;
    }
    addItemMutation.mutate();
  };

  const formatCurrency = useFormatCurrency();

  const totalPurchase = items.reduce((sum, item) => sum + item.total_purchase, 0);
  const totalSelling = items.reduce((sum, item) => sum + item.total_selling, 0);
  const totalProfit = items.reduce((sum, item) => sum + item.total_profit, 0);
  const isLocked = purchase.is_locked || purchase.status === 'validated';

  return (
    <ScrollArea className="h-[calc(100vh-120px)] pr-4">
      <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {purchase.purchase_number}
              {isLocked && <Lock className="h-4 w-4 text-muted-foreground" />}
            </h2>
            <Badge
              variant={
                purchase.status === 'validated'
                  ? 'default'
                  : purchase.status === 'document_generated'
                  ? 'outline'
                  : 'secondary'
              }
            >
              {purchase.status === 'validated'
                ? 'Validé'
                : purchase.status === 'document_generated'
                ? 'Document généré'
                : 'Brouillon'}
            </Badge>
          </div>
        </div>

        {!isLocked && (
          <Button onClick={() => setIsAddItemDialogOpen(true)} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter produit
          </Button>
        )}
      </div>

      {/* Récapitulatif achat (pour bon d'achat - sans profit) */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('purchaseEditor.totalDeLAchat')}</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(totalPurchase)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">{items.length} article(s)</p>
              <p className="text-sm text-muted-foreground">
                {items.reduce((sum, item) => sum + item.quantity, 0)} unité(s)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des produits (sans profit) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" />
            Produits ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calculator className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>{t('purchaseEditor.aucunProduitAjoute')}</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.product_name}</p>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                        <span>Qté: {item.quantity}</span>
                        <span>Prix unitaire: {formatCurrency(item.purchase_price)}</span>
                      </div>
                    </div>
                    <div className="text-right mr-2">
                      <p className="text-sm font-semibold">
                        {formatCurrency(item.total_purchase)}
                      </p>
                    </div>
                    {!isLocked && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteItemMutation.mutate(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Analyse Financière (Profits) - Section séparée */}
      <Card className="border-orange-200 dark:border-[#ff4000] bg-orange-50/50 dark:bg-[#ff4000]/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-[#ff4000] dark:text-[#ff4000]">
            <Calculator className="h-4 w-4" />
            Analyse Financière & Profits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center mb-4">
            <div className="p-3 rounded-lg bg-background">
              <p className="text-xs text-muted-foreground">Total Achat</p>
              <p className="text-lg font-bold text-destructive">
                {formatCurrency(totalPurchase)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-background">
              <p className="text-xs text-muted-foreground">{t('purchaseEditor.totalVenteEstime')}</p>
              <p className="text-lg font-bold">{formatCurrency(totalSelling)}</p>
            </div>
            <div className="p-3 rounded-lg bg-background">
              <p className="text-xs text-muted-foreground">{t('purchaseEditor.profitEstime')}</p>
              <p className="text-lg font-bold text-[#ff4000]">
                +{formatCurrency(totalProfit)}
              </p>
            </div>
          </div>

          {/* Détail profits par produit */}
          {items.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Détail par produit
              </p>
              <div className="space-y-1">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded bg-background text-sm"
                  >
                    <div className="flex-1">
                      <span className="font-medium">{item.product_name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({item.quantity} × {formatCurrency(item.selling_price - item.purchase_price)})
                      </span>
                    </div>
                    <span className={`font-semibold ${item.total_profit >= 0 ? 'text-[#ff4000]' : 'text-destructive'}`}>
                      {item.total_profit >= 0 ? '+' : ''}{formatCurrency(item.total_profit)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Marge bénéficiaire */}
              <div className="mt-3 pt-3 border-t flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('purchaseEditor.margeBeneficiaire')}</span>
                <span className="font-bold text-[#ff4000]">
                  {totalPurchase > 0 ? ((totalProfit / totalPurchase) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {!isLocked && (
        <Card>
          <CardContent className="p-4">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => updateNotesMutation.mutate(notes)}
              placeholder={t('purchaseEditor.notesSurCetAchat')}
              rows={2}
              className="mt-1"
            />
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {!isLocked && (
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => generateDocMutation.mutate()}
            disabled={items.length === 0 || generateDocMutation.isPending}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Générer document
          </Button>
          <Button
            onClick={() => setShowVerificationDialog(true)}
            disabled={items.length === 0}
            className="gap-2 bg-[#ff4000] hover:bg-[#ff4000]"
          >
            <CheckCircle className="h-4 w-4" />
            Valider l'achat
          </Button>
        </div>
      )}

      {/* Dialog ajout produit - Plus grand et professionnel */}
      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Ajouter un produit à l'achat
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Sélectionnez un produit existant ou créez-en un nouveau pour cet achat
            </p>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Section Sélection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Fournisseur (optionnel)
                </Label>
                <Select
                  value={newItem.supplier_id}
                  onValueChange={(v) => setNewItem({
                    ...newItem,
                    supplier_id: v,
                    product_id: '',
                    product_name: '',
                    purchase_price: 0,
                    selling_price: 0
                  })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={suppliers.length === 0 ? 'Aucun fournisseur disponible' : 'Sélectionner un fournisseur...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.length === 0 ? (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        Aucun fournisseur créé. Créez d'abord un fournisseur dans l'onglet "Fournisseurs".
                      </div>
                    ) : (
                      suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('purchaseEditor.categorieOptionnel')}</Label>
                <Select
                  value={newItem.category_id}
                  onValueChange={(v) => setNewItem({ ...newItem, category_id: v, product_id: '' })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder={t('purchaseEditor.filtrerParCategorie')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Sélection du produit avec images */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('purchaseEditor.selectionnerUnProduitExistant')}</Label>

              {products.length > 0 ? (
                <ScrollArea className="h-48 border rounded-lg p-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => handleProductSelect(product.id)}
                        className={`flex flex-col items-center p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                          newItem.product_id === product.id
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-muted hover:border-muted-foreground/30'
                        }`}
                      >
                        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-2">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <span className="text-xs font-medium text-center line-clamp-2">
                          {product.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(product.price)}
                        </span>
                        {product.stock_quantity !== null && (
                          <span className="text-xs text-primary mt-1">
                            Stock: {product.stock_quantity}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="h-32 border rounded-lg flex items-center justify-center text-muted-foreground text-sm">
                  Aucun produit disponible. Créez des produits d'abord.
                </div>
              )}
            </div>

            {/* Produit sélectionné - Aperçu */}
            {selectedProduct && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                      <Package className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{selectedProduct.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Prix de vente actuel: {formatCurrency(selectedProduct.price)}
                      </p>
                      {selectedProduct.stock_quantity !== null && (
                        <Badge variant="secondary" className="mt-1">
                          Stock actuel: {selectedProduct.stock_quantity} unités
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Nom du produit */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Nom du produit <span className="text-destructive">*</span>
              </Label>
              <Input
                value={newItem.product_name}
                onChange={(e) => setNewItem({ ...newItem, product_name: e.target.value })}
                placeholder={t('purchaseEditor.saisissezOuModifiezLeNom')}
                className="h-11"
              />
            </div>

            {/* Quantité et Prix */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Quantité <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={newItem.quantity}
                  onChange={(e) =>
                    setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })
                  }
                  className="h-11 text-center text-lg font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Prix d'achat <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    value={newItem.purchase_price}
                    onChange={(e) =>
                      setNewItem({ ...newItem, purchase_price: parseFloat(e.target.value) || 0 })
                    }
                    className="h-11 pr-12 text-right font-medium"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    GNF
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Prix de vente <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    value={newItem.selling_price}
                    onChange={(e) =>
                      setNewItem({ ...newItem, selling_price: parseFloat(e.target.value) || 0 })
                    }
                    className="h-11 pr-12 text-right font-medium"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    GNF
                  </span>
                </div>
              </div>
            </div>

            {/* Calculs en temps réel - Amélioré */}
            {newItem.purchase_price > 0 && newItem.selling_price > 0 && (
              <Card className={`${newItem.selling_price < newItem.purchase_price ? 'bg-destructive/10 border-destructive/30' : 'bg-orange-50 dark:bg-[#ff4000]/20 border-orange-200 dark:border-[#ff4000]'}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="h-4 w-4" />
                    <span className="font-medium text-sm">{t('purchaseEditor.recapitulatifDesCalculs')}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Profit unitaire</p>
                      <p className={`font-bold ${newItem.selling_price >= newItem.purchase_price ? 'text-[#ff4000]' : 'text-destructive'}`}>
                        {newItem.selling_price >= newItem.purchase_price ? '+' : ''}
                        {formatCurrency(newItem.selling_price - newItem.purchase_price)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Total achat</p>
                      <p className="font-bold text-destructive">
                        {formatCurrency(newItem.quantity * newItem.purchase_price)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Profit total</p>
                      <p className={`font-bold ${newItem.selling_price >= newItem.purchase_price ? 'text-[#ff4000]' : 'text-destructive'}`}>
                        {newItem.selling_price >= newItem.purchase_price ? '+' : ''}
                        {formatCurrency(newItem.quantity * (newItem.selling_price - newItem.purchase_price))}
                      </p>
                    </div>
                  </div>

                  {newItem.selling_price < newItem.purchase_price && (
                    <div className="mt-3 flex items-center gap-2 text-destructive text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{t('purchaseEditor.attentionLePrixDeVente')}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter className="pt-4 border-t gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAddItemDialogOpen(false)}
              className="min-w-24"
            >
              Annuler
            </Button>
            <Button
              onClick={handleAddItem}
              disabled={addItemMutation.isPending}
              className="min-w-32 gap-2"
            >
              <Plus className="h-4 w-4" />
              {addItemMutation.isPending ? 'Ajout...' : 'Ajouter le produit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de vérification des produits manquants */}
      <MissingProductsVerificationDialog
        open={showVerificationDialog}
        onOpenChange={setShowVerificationDialog}
        suppliers={suppliers}
        categories={categories}
        purchaseNumber={purchase.purchase_number}
        onConfirm={(hasMissing, missingEntries) => {
          setMissingProductsData(missingEntries);
          setShowVerificationDialog(false);
          setShowValidateConfirm(true);
        }}
      />

      {/* Confirmation validation */}
      <AlertDialog open={showValidateConfirm} onOpenChange={setShowValidateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Valider définitivement cet achat ?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Cette action est <strong>{t('purchaseEditor.irreversible')}</strong>{t('purchaseEditor.uneFoisValide')}</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>{t('purchaseEditor.leStockSeraAutomatiquementMis')}</li>
                <li>{paymentMode === 'credit' ? `Une DETTE fournisseur sera créée (${formatCurrency(totalPurchase)})` : `Une dépense sera créée (${formatCurrency(totalPurchase)})`}</li>
                <li>{t('purchaseEditor.lesPrixDeVenteSeront')}</li>
                <li>{t('purchaseEditor.lAchatSeraVerrouille')}</li>
              </ul>

              {/* Mode de paiement : payé (dépense) ou à crédit (dette fournisseur) */}
              <div className="mt-3 rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium text-foreground">{t('purchaseEditor.reglement')}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPaymentMode('cash')}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm ${paymentMode === 'cash' ? 'border-primary bg-primary/10 font-medium' : 'border-border'}`}>
                    💵 Payé
                  </button>
                  <button type="button" onClick={() => setPaymentMode('credit')}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm ${paymentMode === 'credit' ? 'border-[#ff4000] bg-orange-50 font-medium text-[#ff4000]' : 'border-border'}`}>
                    🧾 À crédit (dette)
                  </button>
                </div>
                {paymentMode === 'credit' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <label className="text-xs text-muted-foreground">Échéance
                      <input type="date" value={creditDueDate} onChange={(e) => setCreditDueDate(e.target.value)}
                        className="mt-1 block w-full rounded-md border px-2 py-1.5 text-sm bg-background" />
                    </label>
                    <label className="text-xs text-muted-foreground">Tranche min. (GNF)
                      <input type="number" value={creditMinInstallment} onChange={(e) => setCreditMinInstallment(e.target.value)}
                        placeholder="0" className="mt-1 block w-full rounded-md border px-2 py-1.5 text-sm bg-background" />
                    </label>
                  </div>
                )}
              </div>
              {missingProductsData.length > 0 && (
                <div className="mt-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-sm font-medium text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {missingProductsData.length} produit(s) manquant(s) signalé(s)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ces informations seront enregistrées pour suivi.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('purchaseEditor.annuler')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => validateMutation.mutate()}
              className="bg-[#ff4000] hover:bg-[#ff4000]"
            >
              {validateMutation.isPending ? 'Validation...' : 'Confirmer la validation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </ScrollArea>
  );
}
