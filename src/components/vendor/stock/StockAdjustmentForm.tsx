import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import { supabase } from '@/integrations/supabase/client';
import { readSectionCache, writeSectionCache, isBrowserOffline } from '@/lib/offline/sectionCache';
import { useToast } from '@/hooks/use-toast';
import {
  Package, AlertTriangle, Trash2, RefreshCw,
  RotateCcw, ClipboardList, Plus, Search
} from 'lucide-react';

interface StockAdjustment {
  id: string;
  product_id: string;
  adjustment_type: string;
  quantity_before: number;
  quantity_adjusted: number;
  quantity_after: number;
  reason: string;
  valuation_method: string;
  unit_cost?: number;
  total_cost?: number;
  created_at: string;
  products?: { name: string; sku?: string };
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  stock_quantity: number;
  cost_price?: number;
}

const adjustmentTypes = [
  { value: 'breakage', label: 'Casse', icon: Trash2, color: 'bg-orange-100 text-[#ff4000]' },
  { value: 'theft', label: 'Vol', icon: AlertTriangle, color: 'bg-orange-100 text-orange-800' },
  { value: 'expiration', label: "Péremption", icon: Package, color: 'bg-orange-100 text-[#ff4000]' },
  { value: 'correction', label: 'Correction inventaire', icon: RefreshCw, color: 'bg-blue-100 text-blue-800' },
  { value: 'return', label: "Retour fournisseur", icon: RotateCcw, color: 'bg-blue-100 text-[#04439e]' },
  { value: 'other', label: 'Autre', icon: ClipboardList, color: 'bg-gray-100 text-gray-800' }
];

export default function StockAdjustmentForm() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { vendorId } = useCurrentVendor();
  const { toast } = useToast();
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    product_id: '',
    adjustment_type: 'breakage',
    quantity_adjusted: '',
    reason: '',
    valuation_method: 'fifo'
  });

  const loadData = async () => {
    if (!vendorId) return;
    setLoading(true);

    // 📴 Hors ligne : afficher produits + derniers ajustements connus (cache).
    if (isBrowserOffline()) {
      const cachedProducts = readSectionCache<Product>('stock_adj_products', vendorId);
      const cachedAdj = readSectionCache<StockAdjustment>('stock_adjustments', vendorId);
      if (cachedProducts) setProducts(cachedProducts);
      if (cachedAdj) setAdjustments(cachedAdj);
      setLoading(false);
      return;
    }

    try {
      // Charger les ajustements
      const { data: adjustmentsData, error: adjError } = await supabase
        .from('stock_adjustments')
        .select(`
          *,
          products(name, sku)
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (adjError) throw adjError;
      setAdjustments(adjustmentsData || []);
      writeSectionCache('stock_adjustments', vendorId, adjustmentsData || []);

      // Charger les produits
      const { data: productsData, error: prodError } = await supabase
        .from('products')
        .select('id, name, sku, stock_quantity, cost_price')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('name');

      if (prodError) throw prodError;
      setProducts((productsData || []) as Product[]);
      writeSectionCache('stock_adj_products', vendorId, (productsData || []) as Product[]);
    } catch (error) {
      console.error('Error loading data:', error);
      // Repli sur le cache si le réseau échoue malgré navigator.onLine.
      const cachedProducts = readSectionCache<Product>('stock_adj_products', vendorId);
      const cachedAdj = readSectionCache<StockAdjustment>('stock_adjustments', vendorId);
      if (cachedProducts) setProducts(cachedProducts);
      if (cachedAdj) setAdjustments(cachedAdj);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const selectedProduct = products.find(p => p.id === formData.product_id);

  const handleSubmit = async () => {
    if (!vendorId || !formData.product_id || !formData.quantity_adjusted || !formData.reason) {
      toast({ title: t('stockAdjustmentForm.veuillezRemplirTousLesChamps'), variant: 'destructive' });
      return;
    }

    const qty = parseInt(formData.quantity_adjusted);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: t('stockAdjustmentForm.quantiteInvalide'), variant: 'destructive' });
      return;
    }

    const product = products.find(p => p.id === formData.product_id);
    if (!product) return;

    const quantityBefore = product.stock_quantity;
    const quantityAfter = Math.max(0, quantityBefore - qty);
    const unitCost = product.cost_price || 0;
    const totalCost = unitCost * qty;

    try {
      // Créer l'ajustement
      const { error: adjError } = await supabase
        .from('stock_adjustments')
        .insert([{
          vendor_id: vendorId,
          product_id: formData.product_id,
          adjustment_type: formData.adjustment_type,
          quantity_before: quantityBefore,
          quantity_adjusted: qty,
          quantity_after: quantityAfter,
          reason: formData.reason,
          valuation_method: formData.valuation_method,
          unit_cost: unitCost,
          total_cost: totalCost
        }]);

      if (adjError) throw adjError;

      // Mettre à jour le stock du produit
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock_quantity: quantityAfter })
        .eq('id', formData.product_id);

      if (updateError) throw updateError;

      toast({ title: t('stockAdjustmentForm.ajustementEnregistre') });
      setIsOpen(false);
      setFormData({
        product_id: '',
        adjustment_type: 'breakage',
        quantity_adjusted: '',
        reason: '',
        valuation_method: 'fifo'
      });
      loadData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  const filteredAdjustments = adjustments.filter(adj =>
    adj.products?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adj.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalLoss = adjustments.reduce((sum, adj) => sum + (adj.total_cost || 0), 0);

  if (loading) {
    return <div className="p-4 text-center">Chargement...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            Ajustements de Stock
          </h2>
          <p className="text-sm text-muted-foreground">
            Gérez les pertes, casses et corrections d'inventaire
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nouvel ajustement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('stockAdjustmentForm.enregistrerUnAjustementDeStock')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Sélection produit */}
              <div>
                <label className="text-sm font-medium">{t('stockAdjustmentForm.produit')}</label>
                <select
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                >
                  <option value="">{t('stockAdjustmentForm.selectionnerUnProduit')}</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ''} - Stock: {p.stock_quantity}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type d'ajustement */}
              <div>
                <label className="text-sm font-medium">Type d'ajustement *</label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {adjustmentTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <Button
                        key={type.value}
                        type="button"
                        variant={formData.adjustment_type === type.value ? 'default' : 'outline'}
                        size="sm"
                        className="justify-start"
                        onClick={() => setFormData({ ...formData, adjustment_type: type.value })}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {type.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Quantité */}
              <div>
                <label className="text-sm font-medium">{t('stockAdjustmentForm.quantiteARetirer')}</label>
                <Input
                  type="number"
                  placeholder="0"
                  min="1"
                  max={selectedProduct?.stock_quantity || 999999}
                  value={formData.quantity_adjusted}
                  onChange={(e) => setFormData({ ...formData, quantity_adjusted: e.target.value })}
                />
                {selectedProduct && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Stock actuel: {selectedProduct.stock_quantity} |
                    Après ajustement: {Math.max(0, selectedProduct.stock_quantity - (parseInt(formData.quantity_adjusted) || 0))}
                  </p>
                )}
              </div>

              {/* Méthode de valorisation */}
              <div>
                <label className="text-sm font-medium">{t('stockAdjustmentForm.methodeDeValorisation')}</label>
                <select
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  value={formData.valuation_method}
                  onChange={(e) => setFormData({ ...formData, valuation_method: e.target.value })}
                >
                  <option value="fifo">{t('stockAdjustmentForm.fifoPremierEntrePremierSorti')}</option>
                  <option value="lifo">{t('stockAdjustmentForm.lifoDernierEntrePremierSorti')}</option>
                  <option value="average">{t('stockAdjustmentForm.coutMoyenPondere')}</option>
                </select>
              </div>

              {/* Raison */}
              <div>
                <label className="text-sm font-medium">Raison / Détails *</label>
                <Input
                  placeholder={t('stockAdjustmentForm.exProduitTombeEtCasse')}
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                />
              </div>

              {/* Estimation perte */}
              {selectedProduct && formData.quantity_adjusted && (
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <p className="text-sm font-medium text-destructive">
                    Perte estimée: {fc((selectedProduct.cost_price || 0) * parseInt(formData.quantity_adjusted || '0'))}
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4">
                <Button variant="outline" onClick={() => setIsOpen(false)}>{t('stockAdjustmentForm.annuler')}</Button>
                <Button onClick={handleSubmit}>{t('stockAdjustmentForm.enregistrer')}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total ajustements</p>
            <p className="text-2xl font-bold">{adjustments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Perte totale</p>
            <p className="text-2xl font-bold text-destructive">{fc(totalLoss)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Casses</p>
            <p className="text-2xl font-bold">{adjustments.filter(a => a.adjustment_type === 'breakage').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t('stockAdjustmentForm.peremptions')}</p>
            <p className="text-2xl font-bold">{adjustments.filter(a => a.adjustment_type === 'expiration').length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('stockAdjustmentForm.rechercherUnAjustement')}
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {filteredAdjustments.map((adj) => {
          const typeConfig = adjustmentTypes.find(t => t.value === adj.adjustment_type);
          const Icon = typeConfig?.icon || ClipboardList;

          return (
            <Card key={adj.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${typeConfig?.color || 'bg-gray-100'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold">{adj.products?.name || 'Produit inconnu'}</p>
                      <p className="text-sm text-muted-foreground">{adj.reason}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(adj.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">-{adj.quantity_adjusted} unités</Badge>
                    {adj.total_cost && adj.total_cost > 0 && (
                      <p className="text-sm text-destructive mt-1">
                        -{fc(adj.total_cost)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredAdjustments.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">{t('stockAdjustmentForm.aucunAjustementEnregistre')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
