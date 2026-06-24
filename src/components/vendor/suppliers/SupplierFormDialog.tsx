/**
 * Formulaire de création/édition de fournisseur
 * Affiche les catégories produits et sélection/création de produits pour les grossistes
 * Version 3 étapes avec stepper professionnel
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Plus,
  X,
  Search,
  Package,
  Tag,
  User,
  Phone,
  Building2,
  ChevronRight,
  ChevronLeft,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SupplierFormDialogProps {
  vendorId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SupplierFormData) => void;
  isSaving: boolean;
  editingSupplier?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    notes: string | null;
    category: string | null;
  } | null;
}

export interface SupplierFormData {
  id?: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  category: string;
  linkedProducts: LinkedProduct[];

  /**
   * Interne UI: quand false (édition), on ne touche pas au catalogue existant
   * pour éviter d'écraser des liens si l'utilisateur n'a pas modifié les produits.
   */
  syncLinkedProducts?: boolean;
}

export interface LinkedProduct {
  productId: string | null;
  productName: string;
  isNew: boolean;
  categoryId: string;
  categoryName: string;
  quantity: number;
  unitPrice?: number;
}

const SUPPLIER_CATEGORIES = [
  'Grossiste',
  'Fabricant',
  'Importateur',
  'Distributeur',
  'Détaillant',
  'Prestataire',
  'Autre',
];

const STEPS = [
  { id: 1, title: 'Informations', icon: User },
  { id: 2, title: "Coordonnées", icon: Phone },
  { id: 3, title: "Produits", icon: Package },
];

export function SupplierFormDialog({
  vendorId,
  isOpen,
  onClose,
  onSave,
  isSaving,
  editingSupplier,
}: SupplierFormDialogProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<SupplierFormData>({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    category: '',
    linkedProducts: [],
  });
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({});
  const [linkedProductsTouched, setLinkedProductsTouched] = useState(false);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch ALL products for vendor
  const { data: allProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ['vendor-products-for-supplier', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, category_id, images, price')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('name')
        .limit(500);

      if (error) throw error;
      return data || [];
    },
    enabled: !!vendorId && formData.category === 'Grossiste',
  });

  // Fetch linked products for editing supplier
  const { data: supplierLinkedProducts = [] } = useQuery({
    queryKey: ['supplier-linked-products', editingSupplier?.id],
    queryFn: async () => {
      if (!editingSupplier?.id) return [];

      const { data, error } = await supabase
        .from('vendor_supplier_products')
        .select(`
          id,
          product_id,
          unit_cost,
          default_quantity,
          product:products(id, name, category_id, price)
        `)
        .eq('supplier_id', editingSupplier.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!editingSupplier?.id && isOpen,
  });

  // Filter products by selected category
  const products = selectedCategoryId && selectedCategoryId !== 'all'
    ? allProducts.filter(p => p.category_id === selectedCategoryId)
    : allProducts;

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setLinkedProductsTouched(false);
      if (editingSupplier) {
        setFormData({
          id: editingSupplier.id,
          name: editingSupplier.name,
          phone: editingSupplier.phone || '',
          email: editingSupplier.email || '',
          address: editingSupplier.address || '',
          notes: editingSupplier.notes || '',
          category: editingSupplier.category || '',
          linkedProducts: [],
        });
      } else {
        setFormData({
          name: '',
          phone: '',
          email: '',
          address: '',
          notes: '',
          category: '',
          linkedProducts: [],
        });
      }
      setProductSearch('');
      setSelectedCategoryId('');
    }
  }, [isOpen, editingSupplier]);

  // Load linked products when editing
  useEffect(() => {
    if (supplierLinkedProducts.length > 0 && editingSupplier && formData.linkedProducts.length === 0) {
      const linkedProducts: LinkedProduct[] = supplierLinkedProducts.map((sp: any) => {
        const category = categories.find((c) => c.id === sp.product?.category_id);
        return {
          productId: sp.product_id,
          productName: sp.product?.name || 'Produit inconnu',
          isNew: false,
          categoryId: sp.product?.category_id || '',
          categoryName: category?.name || '',
          quantity: sp.default_quantity || 1,
          unitPrice: sp.unit_cost || sp.product?.price || 0,
        };
      });
      setFormData((prev) => ({ ...prev, linkedProducts }));
      // important: ne pas marquer comme "modifié" juste parce qu'on a chargé les liens existants
      setLinkedProductsTouched(false);
    }
  }, [supplierLinkedProducts, editingSupplier, categories, formData.linkedProducts.length]);

  const isGrossiste = formData.category === 'Grossiste';
  const totalSteps = isGrossiste ? 3 : 2;

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.sku?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const handleAddProduct = (product: { id: string; name: string; category_id: string | null; price?: number }) => {
    const category = categories.find((c) => c.id === product.category_id);
    const quantity = productQuantities[product.id] || 1;

    setFormData((prev) => ({
      ...prev,
      linkedProducts: [
        ...prev.linkedProducts,
        {
          productId: product.id,
          productName: product.name,
          isNew: false,
          categoryId: product.category_id || '',
          categoryName: category?.name || 'Non catégorisé',
          quantity: quantity,
          unitPrice: product.price || 0,
        },
      ],
    }));

    setLinkedProductsTouched(true);
    setProductSearch('');
    setProductQuantities((prev) => {
      const updated = { ...prev };
      delete updated[product.id];
      return updated;
    });
  };

  const handleUpdateQuantity = (index: number, quantity: number) => {
    setFormData((prev) => {
      const updated = [...prev.linkedProducts];
      if (!updated[index]) return prev;
      updated[index] = { ...updated[index], quantity: Math.max(1, quantity) };
      return { ...prev, linkedProducts: updated };
    });
    setLinkedProductsTouched(true);
  };

  const handleRemoveProduct = (index: number) => {
    setFormData((prev) => {
      const updated = [...prev.linkedProducts];
      updated.splice(index, 1);
      return { ...prev, linkedProducts: updated };
    });
    setLinkedProductsTouched(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) return;
    onSave({
      ...formData,
      syncLinkedProducts: isGrossiste ? linkedProductsTouched : false,
    });
  };

  const canGoNext = () => {
    if (currentStep === 1) return formData.name.trim() !== '';
    return true;
  };

  const handleNext = () => {
    if (currentStep < totalSteps && canGoNext()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const visibleSteps = isGrossiste ? STEPS : STEPS.slice(0, 2);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header avec Stepper */}
        <DialogHeader className="flex-shrink-0 border-b p-6 pb-4">
          <DialogTitle className="text-xl font-semibold mb-4">
            {editingSupplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
          </DialogTitle>

          {/* Stepper professionnel */}
          <div className="flex items-center justify-between">
            {visibleSteps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                        isActive && "border-primary bg-primary text-primary-foreground",
                        isCompleted && "border-primary bg-primary/20 text-primary",
                        !isActive && !isCompleted && "border-muted-foreground/30 text-muted-foreground"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <StepIcon className="h-5 w-5" />
                      )}
                    </div>
                    <span className={cn(
                      "text-xs mt-2 font-medium",
                      isActive && "text-primary",
                      !isActive && "text-muted-foreground"
                    )}>
                      {step.title}
                    </span>
                  </div>

                  {index < visibleSteps.length - 1 && (
                    <div className={cn(
                      "flex-1 h-0.5 mx-4 rounded",
                      currentStep > step.id ? "bg-primary" : "bg-muted"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        {/* Contenu des étapes */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Étape 1: Informations générales */}
          {currentStep === 1 && (
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{t('supplierFormDialog.informationsGenerales')}</h3>
                    <p className="text-sm text-muted-foreground">{t('supplierFormDialog.identiteEtTypeDuFournisseur')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">
                      Nom du fournisseur <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t('supplierFormDialog.exSocieteAbcImport')}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-sm font-medium">
                      Type de fournisseur
                    </Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={t('supplierFormDialog.selectionnerUnType')} />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPLIER_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.category === 'Grossiste' && (
                      <p className="text-xs text-primary flex items-center gap-1 mt-1">
                        <Package className="h-3 w-3" />
                        Vous pourrez associer des produits à l'étape 3
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          {/* Étape 2: Coordonnées */}
          {currentStep === 2 && (
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{t('supplierFormDialog.coordonnees')}</h3>
                    <p className="text-sm text-muted-foreground">{t('supplierFormDialog.informationsDeContact')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium">{t('supplierFormDialog.telephone')}</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Ex: +224 620 00 00 00"
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Ex: contact@fournisseur.com"
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Adresse complète
                  </Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder={t('supplierFormDialog.exQuartierAlmamyaKaloumConakry')}
                    className="h-11"
                  />
                </div>
              </div>
            </ScrollArea>
          )}

          {/* Étape 3: Produits (seulement pour Grossiste) */}
          {currentStep === 3 && isGrossiste && (
            <div className="h-full flex flex-col p-6 pt-4">
              <div className="flex items-center gap-3 pb-4 border-b mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{t('supplierFormDialog.catalogueProduits')}</h3>
                  <p className="text-sm text-muted-foreground">{t('supplierFormDialog.associezDesProduitsACe')}</p>
                </div>
                {formData.linkedProducts.length > 0 && (
                  <Badge variant="secondary" className="text-sm">
                    {formData.linkedProducts.length} produit(s) sélectionné(s)
                  </Badge>
                )}
              </div>

              <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Colonne gauche: Recherche et sélection */}
                <div className="flex flex-col space-y-4">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">{t('supplierFormDialog.filtrerParCategorie')}</Label>
                    <Select
                      value={selectedCategoryId}
                      onValueChange={setSelectedCategoryId}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder={t('supplierFormDialog.toutesLesCategories')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('supplierFormDialog.toutesLesCategories2')}</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-medium">{t('supplierFormDialog.rechercherUnProduit')}</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t('supplierFormDialog.nomOuSkuDuProduit')}
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="pl-10 h-10"
                      />
                    </div>
                  </div>

                  {/* Liste des produits disponibles */}
                  <div className="flex-1 min-h-0">
                    <Label className="text-sm font-medium mb-2 block">
                      Produits disponibles ({filteredProducts.length})
                    </Label>
                    {productsLoading ? (
                      <div className="h-64 flex items-center justify-center border rounded-lg bg-muted/20">
                        <p className="text-sm text-muted-foreground">Chargement...</p>
                      </div>
                    ) : filteredProducts.length > 0 ? (
                      <ScrollArea className="h-64 border rounded-lg">
                        <div className="p-2 space-y-2">
                          {filteredProducts.slice(0, 50).map((product) => {
                            const isAlreadyAdded = formData.linkedProducts.some(
                              (lp) => lp.productId === product.id
                            );
                            const productImage = Array.isArray(product.images) && product.images.length > 0
                              ? product.images[0]
                              : null;

                            return (
                              <div
                                key={product.id}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                                  isAlreadyAdded
                                    ? "bg-primary/10 border-primary/40"
                                    : "hover:bg-accent hover:border-primary/30"
                                )}
                                onClick={() => !isAlreadyAdded && handleAddProduct(product)}
                              >
                                <div className="w-12 h-12 rounded-md bg-muted flex-shrink-0 overflow-hidden border">
                                  {productImage ? (
                                    <img
                                      src={productImage}
                                      alt={product.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <Package className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm line-clamp-1">
                                    {product.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{product.sku}</p>
                                  {product.price != null && product.price > 0 && (
                                    <p className="text-xs font-semibold text-primary">
                                      {fc(product.price)}
                                    </p>
                                  )}
                                </div>

                                {isAlreadyAdded ? (
                                  <Badge variant="default" className="flex-shrink-0">
                                    <Check className="h-3 w-3 mr-1" />
                                    Ajouté
                                  </Badge>
                                ) : (
                                  <Button size="sm" variant="ghost" className="flex-shrink-0">
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="h-64 flex flex-col items-center justify-center border rounded-lg bg-muted/20">
                        <Package className="h-10 w-10 text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">{t('supplierFormDialog.aucunProduitTrouve')}</p>
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      onClose();
                      navigate('/vendeur/products?action=new');
                    }}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Créer un nouveau produit
                  </Button>
                </div>

                {/* Colonne droite: Produits sélectionnés */}
                <div className="flex flex-col space-y-4">
                  <Label className="text-sm font-medium">
                    Produits sélectionnés ({formData.linkedProducts.length})
                  </Label>

                  {formData.linkedProducts.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg bg-muted/10 min-h-[300px]">
                      <Package className="h-12 w-12 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground text-center">
                        Cliquez sur un produit à gauche<br />pour l'ajouter à la liste
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="flex-1 border rounded-lg min-h-[300px]">
                      <div className="p-3 space-y-3">
                        {formData.linkedProducts.map((lp, idx) => (
                          <div
                            key={idx}
                            className="p-3 border rounded-lg bg-primary/5 border-primary/20"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Package className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium line-clamp-1">
                                  {lp.productName}
                                </p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Tag className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">
                                    {lp.categoryName}
                                  </span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                                onClick={() => handleRemoveProduct(idx)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-primary/10">
                              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                                Quantité:
                              </Label>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleUpdateQuantity(idx, lp.quantity - 1)}
                                >
                                  -
                                </Button>
                                <Input
                                  type="number"
                                  min="1"
                                  value={lp.quantity}
                                  onChange={(e) => handleUpdateQuantity(idx, parseInt(e.target.value) || 1)}
                                  className="h-7 w-14 text-center"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleUpdateQuantity(idx, lp.quantity + 1)}
                                >
                                  +
                                </Button>
                              </div>
                              {lp.unitPrice != null && lp.unitPrice > 0 && (
                                <span className="text-xs font-semibold text-primary ml-auto">
                                  {fc(lp.unitPrice * lp.quantity)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}

                  {/* Total */}
                  {formData.linkedProducts.length > 0 && (
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{t('supplierFormDialog.totalEstime')}</span>
                        <span className="text-lg font-bold text-primary">
                          {fc(formData.linkedProducts
                            .reduce((sum, lp) => sum + (lp.unitPrice || 0) * lp.quantity, 0))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer avec navigation */}
        <DialogFooter className="border-t p-4 flex-shrink-0">
          <div className="flex w-full justify-between items-center">
            <Button
              variant="ghost"
              onClick={currentStep === 1 ? onClose : handlePrev}
            >
              {currentStep === 1 ? (
                'Annuler'
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Précédent
                </>
              )}
            </Button>

            <div className="flex gap-2">
              {currentStep < totalSteps ? (
                <Button onClick={handleNext} disabled={!canGoNext()}>
                  Suivant
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isSaving || !formData.name.trim()}>
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
