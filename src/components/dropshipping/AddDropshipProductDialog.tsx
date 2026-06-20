/**
 * Dialog pour ajouter un produit dropshipping
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { DropshipSupplier } from '@/types/dropshipping';

interface AddDropshipProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: DropshipSupplier[];
  onAdd: (product: Record<string, unknown>) => Promise<unknown>;
}

export function AddDropshipProductDialog({
  open,
  onOpenChange,
  suppliers,
  onAdd
}: AddDropshipProductDialogProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    supplier_id: '',
    product_name: '',
    product_description: '',
    supplier_product_url: '',
    supplier_price: '',
    selling_price: '',
    category: '',
    estimated_delivery_min: '7',
    estimated_delivery_max: '21'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.supplier_id || !formData.product_name || !formData.supplier_price || !formData.selling_price) {
      toast.error(t('addDropshipProductDialog.veuillezRemplirTousLesChamps'));
      return;
    }

    setLoading(true);
    try {
      await onAdd({
        supplier_id: formData.supplier_id,
        product_name: formData.product_name,
        product_description: formData.product_description || null,
        supplier_product_url: formData.supplier_product_url || null,
        supplier_price: parseFloat(formData.supplier_price),
        supplier_currency: 'USD',
        selling_price: parseFloat(formData.selling_price),
        selling_currency: 'GNF',
        category: formData.category || null,
        estimated_delivery_min: parseInt(formData.estimated_delivery_min),
        estimated_delivery_max: parseInt(formData.estimated_delivery_max),
        is_active: true,
        is_available: true,
        availability_status: 'available'
      });

      // Reset form
      setFormData({
        supplier_id: '',
        product_name: '',
        product_description: '',
        supplier_product_url: '',
        supplier_price: '',
        selling_price: '',
        category: '',
        estimated_delivery_min: '7',
        estimated_delivery_max: '21'
      });

      onOpenChange(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Calculer la marge automatiquement
  const calculateMargin = (): string => {
    const supplier = parseFloat(formData.supplier_price) || 0;
    const selling = parseFloat(formData.selling_price) || 0;
    if (selling === 0) return '0';
    const supplierGNF = supplier * 8500; // Taux approximatif
    return ((selling - supplierGNF) / selling * 100).toFixed(1);
  };

  const marginValue = calculateMargin();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('addDropshipProductDialog.ajouterUnProduitDropshipping')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sélection fournisseur */}
          <div className="space-y-2">
            <Label htmlFor="supplier">Fournisseur *</Label>
            <Select
              value={formData.supplier_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, supplier_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('addDropshipProductDialog.selectionnerUnFournisseur')} />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name} ({supplier.country})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Infos produit */}
          <div className="space-y-2">
            <Label htmlFor="product_name">{t('addDropshipProductDialog.nomDuProduit')}</Label>
            <Input
              id="product_name"
              value={formData.product_name}
              onChange={(e) => setFormData(prev => ({ ...prev, product_name: e.target.value }))}
              placeholder={t('addDropshipProductDialog.exEcouteursBluetoothSansFil')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.product_description}
              onChange={(e) => setFormData(prev => ({ ...prev, product_description: e.target.value }))}
              placeholder={t('addDropshipProductDialog.descriptionDuProduit')}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier_url">{t('addDropshipProductDialog.urlDuProduitChezLe')}</Label>
            <Input
              id="supplier_url"
              type="url"
              value={formData.supplier_product_url}
              onChange={(e) => setFormData(prev => ({ ...prev, supplier_product_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          {/* Prix */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier_price">Prix fournisseur (USD) *</Label>
              <Input
                id="supplier_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.supplier_price}
                onChange={(e) => setFormData(prev => ({ ...prev, supplier_price: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="selling_price">{t('addDropshipProductDialog.prixDeVenteGnf')}</Label>
              <Input
                id="selling_price"
                type="number"
                step="1"
                min="0"
                value={formData.selling_price}
                onChange={(e) => setFormData(prev => ({ ...prev, selling_price: e.target.value }))}
                placeholder="0"
              />
            </div>
          </div>

          {formData.supplier_price && formData.selling_price && (
            <div className={`p-3 rounded-lg ${
              parseFloat(marginValue) > 20
                ? 'bg-orange-50 border-orange-200 dark:bg-[#ff4000]'
                : 'bg-orange-50 border-orange-200 dark:bg-orange-950'
            } border`}>
              <p className="text-sm">
                <strong>{t('addDropshipProductDialog.margeEstimee')}</strong>{' '}
                <span className={parseFloat(marginValue) > 20 ? 'text-[#ff4000]' : 'text-orange-600'}>
                  {marginValue}%
                </span>
              </p>
            </div>
          )}

          {/* Catégorie */}
          <div className="space-y-2">
            <Label htmlFor="category">{t('addDropshipProductDialog.categorie')}</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              placeholder={t('addDropshipProductDialog.exElectroniqueModeBeaute')}
            />
          </div>

          {/* Délais de livraison */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="delivery_min">{t('addDropshipProductDialog.livraisonMinJours')}</Label>
              <Input
                id="delivery_min"
                type="number"
                min="1"
                value={formData.estimated_delivery_min}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_delivery_min: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery_max">{t('addDropshipProductDialog.livraisonMaxJours')}</Label>
              <Input
                id="delivery_max"
                type="number"
                min="1"
                value={formData.estimated_delivery_max}
                onChange={(e) => setFormData(prev => ({ ...prev, estimated_delivery_max: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Ajout en cours...' : 'Ajouter le produit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
