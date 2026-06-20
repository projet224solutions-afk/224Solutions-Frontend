/**
 * Dialog de création d'un nouvel achat
 * Étape 1: sélection du fournisseur
 * Étape 2: sélection manuelle des produits à acheter avec quantités
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2,
  Search,
  ShoppingCart,
  Plus,
  Check,
  Phone,
  Mail,
  MapPin,
  Package,
  ArrowLeft,
  ArrowRight,
  Box,
  Filter,
  Trash2,
  RefreshCw,
  Edit3,
  DollarSign,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PurchaseInputKeypad } from './PurchaseInputKeypad';
import { Input } from '@/components/ui/input';

interface NewPurchaseDialogProps {
  vendorId: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (supplierId: string, supplierName: string, products: PurchaseProduct[]) => void;
  isCreating: boolean;
}

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  category: string | null;
}

interface SupplierProduct {
  id: string;
  product_id: string;
  unit_cost: number;
  default_quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    stock_quantity: number;
    images: string[] | null;
    sku: string | null;
    sell_by_carton: boolean | null;
    units_per_carton: number | null;
    price_carton: number | null;
    cost_price: number | null;
    category_id: string | null;
  };
}

interface Category {
  id: string;
  name: string;
}

export interface PurchaseProduct {
  productId: string;
  productName: string;
  unitCost: number;
  unitCostCurrency: string;
  sellingPrice: number; // Prix de vente du produit
  quantity: number;
  imageUrl: string | null;
  sku: string | null;
  currentStock: number;
  saleType: 'unit' | 'carton';
  sellByCarton: boolean;
  unitsPerCarton: number | null;
  priceCarton: number | null;
  cartonQuantity: number;
  categoryId: string | null;
}

const _CURRENCIES = [
  { code: 'GNF', label: 'GNF' },
  { code: 'USD', label: 'USD' },
  { code: 'EUR', label: 'EUR' },
  { code: 'XOF', label: 'XOF' },
  { code: 'CNY', label: 'CNY' },
];

export function NewPurchaseDialog({
  vendorId,
  isOpen,
  onClose,
  onConfirm,
  isCreating,
}: NewPurchaseDialogProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const [step, setStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<PurchaseProduct[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Keypad state
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [keypadMode, setKeypadMode] = useState<'price' | 'quantity' | 'carton'>('quantity');
  const [keypadProductId, setKeypadProductId] = useState<string | null>(null);
  const [keypadProductName, setKeypadProductName] = useState('');
  const [keypadCurrentValue, setKeypadCurrentValue] = useState(0);
  const [keypadCurrency, setKeypadCurrency] = useState('GNF');
  const [keypadUnitsPerCarton, setKeypadUnitsPerCarton] = useState<number | null>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setSearchTerm('');
      setProductSearchTerm('');
      setSelectedSupplier(null);
      setSelectedProducts([]);
      setSelectedCategoryFilter('all');
    }
  }, [isOpen]);

  // Fetch suppliers
  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery({
    queryKey: ['vendor-suppliers-for-purchase', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_suppliers')
        .select('id, name, phone, email, address, category')
        .eq('vendor_id', vendorId)
        .order('name');

      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!vendorId && isOpen,
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['vendor-categories', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .order('name');

      if (error) throw error;
      return data as Category[];
    },
    enabled: !!vendorId && isOpen && step === 2,
  });

  // Fetch supplier products when supplier is selected (products linked to this supplier)
  const { data: supplierProducts = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['supplier-products', selectedSupplier?.id],
    queryFn: async () => {
      if (!selectedSupplier?.id) return [];

      const { data, error } = await supabase
        .from('vendor_supplier_products')
        .select(`
          id,
          product_id,
          unit_cost,
          default_quantity,
          product:products(id, name, price, stock_quantity, images, sku, sell_by_carton, units_per_carton, price_carton, cost_price, category_id)
        `)
        .eq('supplier_id', selectedSupplier.id);

      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        product: item.product,
      })) as SupplierProduct[];
    },
    enabled: !!selectedSupplier?.id && step === 2,
  });

  // Filter supplier products by category and search
  const filteredSupplierProducts = supplierProducts.filter((sp) => {
    const matchesSearch = sp.product?.name?.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
      sp.product?.sku?.toLowerCase().includes(productSearchTerm.toLowerCase());

    const matchesCategory = selectedCategoryFilter === 'all' ||
      sp.product?.category_id === selectedCategoryFilter;

    // Don't show already selected products
    const notAlreadySelected = !selectedProducts.some(p => p.productId === sp.product_id);

    return matchesSearch && matchesCategory && notAlreadySelected;
  });

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Add product to selection
  const addProductToSelection = (sp: SupplierProduct) => {
    const sellByCarton = sp.product?.sell_by_carton || false;
    const unitsPerCarton = sp.product?.units_per_carton || null;
    const priceCarton = sp.product?.price_carton || null;

    const newProduct: PurchaseProduct = {
      productId: sp.product_id,
      productName: sp.product?.name || 'Produit inconnu',
      unitCost: 0,
      unitCostCurrency: 'GNF',
      sellingPrice: sp.product?.price || 0, // Prix de vente actuel du produit
      quantity: sp.default_quantity || 1,
      imageUrl: sp.product?.images?.[0] || null,
      sku: sp.product?.sku || null,
      currentStock: sp.product?.stock_quantity || 0,
      saleType: 'unit' as const,
      sellByCarton,
      unitsPerCarton,
      priceCarton,
      cartonQuantity: 0,
      categoryId: sp.product?.category_id || null,
    };

    setSelectedProducts(prev => [...prev, newProduct]);
  };

  // Remove product from selection
  const removeProductFromSelection = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId));
  };

  const handleConfirm = () => {
    if (selectedSupplier && selectedProducts.length > 0) {
      const productsWithQuantity = selectedProducts.filter(p => p.quantity > 0 || p.cartonQuantity > 0);
      onConfirm(selectedSupplier.id, selectedSupplier.name, productsWithQuantity);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const handleNextStep = () => {
    if (selectedSupplier) {
      setStep(2);
    }
  };

  const handlePreviousStep = () => {
    setStep(1);
    setSelectedProducts([]);
    setSelectedCategoryFilter('all');
    setProductSearchTerm('');
  };

  // Change supplier in step 2 - keep selected products
  const handleChangeSupplier = () => {
    setStep(1);
    setSelectedSupplier(null);
    // Ne pas effacer les produits sélectionnés pour permettre d'acheter chez plusieurs fournisseurs
    setSelectedCategoryFilter('all');
    setProductSearchTerm('');
  };

  const _updateProductQuantity = (productId: string, delta: number) => {
    setSelectedProducts((prev) =>
      prev.map((p) =>
        p.productId === productId
          ? { ...p, quantity: Math.max(0, p.quantity + delta) }
          : p
      )
    );
  };

  const setProductQuantity = (productId: string, quantity: number) => {
    setSelectedProducts((prev) =>
      prev.map((p) =>
        p.productId === productId
          ? { ...p, quantity: Math.max(0, quantity) }
          : p
      )
    );
  };

  const setProductUnitCost = (productId: string, unitCost: number) => {
    setSelectedProducts((prev) =>
      prev.map((p) =>
        p.productId === productId
          ? { ...p, unitCost: Math.max(0, unitCost) }
          : p
      )
    );
  };

  const _setProductCurrency = (productId: string, currency: string) => {
    setSelectedProducts((prev) =>
      prev.map((p) =>
        p.productId === productId
          ? { ...p, unitCostCurrency: currency }
          : p
      )
    );
  };

  const _updateCartonQuantity = (productId: string, delta: number) => {
    setSelectedProducts((prev) =>
      prev.map((p) =>
        p.productId === productId
          ? { ...p, cartonQuantity: Math.max(0, p.cartonQuantity + delta) }
          : p
      )
    );
  };

  const setCartonQuantity = (productId: string, cartonQty: number) => {
    setSelectedProducts((prev) =>
      prev.map((p) =>
        p.productId === productId
          ? { ...p, cartonQuantity: Math.max(0, cartonQty) }
          : p
      )
    );
  };

  // Open keypad for editing
  const openKeypadFor = (product: PurchaseProduct, mode: 'price' | 'quantity' | 'carton') => {
    setKeypadProductId(product.productId);
    setKeypadProductName(product.productName);
    setKeypadMode(mode);
    setKeypadCurrency(product.unitCostCurrency);
    setKeypadUnitsPerCarton(product.unitsPerCarton);

    if (mode === 'price') {
      setKeypadCurrentValue(product.unitCost);
    } else if (mode === 'quantity') {
      setKeypadCurrentValue(product.quantity);
    } else {
      setKeypadCurrentValue(product.cartonQuantity);
    }

    setKeypadOpen(true);
  };

  const handleKeypadConfirm = (value: number) => {
    if (!keypadProductId) return;

    if (keypadMode === 'price') {
      setProductUnitCost(keypadProductId, value);
    } else if (keypadMode === 'quantity') {
      setProductQuantity(keypadProductId, value);
    } else {
      setCartonQuantity(keypadProductId, value);
    }
  };

  const calculateProductTotal = (product: PurchaseProduct): number => {
    const unitTotal = product.quantity * product.unitCost;
    const cartonTotal = product.cartonQuantity * (product.priceCarton || product.unitCost * (product.unitsPerCarton || 1));
    return unitTotal + cartonTotal;
  };

  const calculateTotalUnits = (product: PurchaseProduct): number => {
    const unitCount = product.quantity;
    const cartonUnits = product.cartonQuantity * (product.unitsPerCarton || 0);
    return unitCount + cartonUnits;
  };

  const totalAmount = selectedProducts.reduce(
    (sum, p) => sum + calculateProductTotal(p),
    0
  );

  const totalItems = selectedProducts.reduce((sum, p) => sum + calculateTotalUnits(p), 0);

  // Get unique categories from supplier products for the filter
  const availableCategories = categories.filter(cat =>
    supplierProducts.some(sp => sp.product?.category_id === cat.id)
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[96vh] sm:max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-3 sm:p-6 pb-3 sm:pb-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-xl font-semibold">
                Nouvel achat de stock
              </DialogTitle>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">
                {step === 1
                  ? 'Étape 1/2: Sélectionnez le fournisseur'
                  : 'Étape 2/2: Sélectionnez les produits'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <div className={cn(
              "flex-1 h-2 md:h-1.5 rounded-full transition-all duration-300",
              step >= 1 ? "bg-primary shadow-sm" : "bg-muted"
            )} />
            <div className={cn(
              "flex-1 h-2 md:h-1.5 rounded-full transition-all duration-300",
              step >= 2 ? "bg-primary shadow-sm" : "bg-muted"
            )} />
          </div>
        </DialogHeader>

        {/* Step 1: Supplier Selection */}
        {step === 1 && (
          <div className="flex-1 min-h-0 p-3 sm:p-6 space-y-3 sm:space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 md:h-4 md:w-4 text-muted-foreground" />
              <Input
                placeholder={t('newPurchaseDialog.rechercherUnFournisseur')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 md:pl-9 h-12 md:h-10 text-base md:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs sm:text-sm font-medium flex items-center justify-between">
                <span>Fournisseurs disponibles</span>
                <Badge variant="secondary" className="text-xs">{filteredSuppliers.length}</Badge>
              </Label>

              {loadingSuppliers ? (
                <div className="h-48 sm:h-64 flex items-center justify-center border rounded-lg bg-muted/20">
                  <p className="text-sm text-muted-foreground">Chargement...</p>
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="h-48 sm:h-64 flex flex-col items-center justify-center border rounded-lg bg-muted/20 px-4">
                  <Building2 className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/40 mb-2 sm:mb-3" />
                  <p className="text-xs sm:text-sm text-muted-foreground text-center">
                    {suppliers.length === 0
                      ? "Aucun fournisseur. Créez-en un d'abord."
                      : 'Aucun fournisseur trouvé'}
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[45vh] sm:h-80 border rounded-lg">
                  <div className="p-2 space-y-2">
                    {filteredSuppliers.map((supplier) => {
                      const isSelected = selectedSupplier?.id === supplier.id;

                      return (
                        <div
                          key={supplier.id}
                          onClick={() => setSelectedSupplier(supplier)}
                          className={cn(
                            "p-4 md:p-3 rounded-lg border-2 cursor-pointer transition-all active:scale-[0.98]",
                            isSelected
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-transparent bg-muted/30 hover:bg-accent active:bg-accent/80"
                          )}
                        >
                          <div className="flex items-start gap-2.5 sm:gap-4">
                            <div className={cn(
                              "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0",
                              isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                            )}>
                              {isSelected ? (
                                <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                              ) : (
                                <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 sm:mb-1 flex-wrap">
                                <h4 className="font-semibold text-sm truncate">{supplier.name}</h4>
                                {supplier.category && (
                                  <Badge variant="outline" className="text-[10px] sm:text-xs">
                                    {supplier.category}
                                  </Badge>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] sm:text-xs text-muted-foreground">
                                {supplier.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                    <span className="truncate max-w-[100px]">{supplier.phone}</span>
                                  </span>
                                )}
                                {supplier.email && (
                                  <span className="hidden sm:flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    <span className="truncate max-w-[120px]">{supplier.email}</span>
                                  </span>
                                )}
                                {supplier.address && (
                                  <span className="hidden sm:flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    <span className="truncate max-w-[120px]">{supplier.address}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Product Selection */}
        {step === 2 && (
          <div className="flex-1 min-h-0 p-3 sm:p-6 space-y-3 sm:space-y-4 overflow-hidden flex flex-col">
            {/* Supplier info with change button */}
            <div className="p-2.5 sm:p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Fournisseur</p>
                  <p className="font-semibold text-xs sm:text-sm truncate">{selectedSupplier?.name}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleChangeSupplier}
                className="text-[10px] sm:text-xs gap-1 px-2 h-7 sm:h-8 flex-shrink-0"
              >
                <RefreshCw className="h-3 w-3" />
                <span className="hidden xs:inline">Changer</span>
              </Button>
            </div>

            {/* Filters: Search + Category */}
            <div className="flex gap-2 sm:gap-3">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Recherche..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  className="pl-8 sm:pl-10 h-9 sm:h-10 text-sm"
                />
              </div>
              <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                <SelectTrigger className="w-[130px] sm:w-48 h-9 sm:h-10 text-xs sm:text-sm">
                  <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                  <span className="truncate">
                    <SelectValue placeholder={t('newPurchaseDialog.categorie')} />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('newPurchaseDialog.toutesCategories')}</SelectItem>
                  {availableCategories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Two columns on desktop, stacked tabs on mobile */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 min-h-0">
              {/* Available products to add */}
              <div className="flex flex-col min-h-0 border rounded-lg">
                <div className="p-2 sm:p-3 border-b bg-muted/30">
                  <Label className="text-xs sm:text-sm font-medium flex items-center justify-between">
                    <span>{t('newPurchaseDialog.produitsDisponibles')}</span>
                    <Badge variant="secondary" className="text-[10px] sm:text-xs">{filteredSupplierProducts.length}</Badge>
                  </Label>
                </div>

                {loadingProducts ? (
                  <div className="flex-1 flex items-center justify-center min-h-[120px] sm:min-h-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Chargement...</p>
                  </div>
                ) : filteredSupplierProducts.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-3 min-h-[120px] sm:min-h-0">
                    <Package className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/40 mb-2" />
                    <p className="text-[10px] sm:text-xs text-muted-foreground text-center">
                      {supplierProducts.length === 0
                        ? "Aucun produit lié"
                        : selectedProducts.length === supplierProducts.length
                        ? "Tous ajoutés"
                        : 'Aucun trouvé'}
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="flex-1 max-h-[25vh] sm:max-h-none">
                    <div className="p-1.5 sm:p-2 space-y-1.5 sm:space-y-2">
                      {filteredSupplierProducts.map((sp) => {
                        return (
                          <div
                          key={sp.id}
                          className="p-2 sm:p-3 rounded-lg border bg-card hover:bg-accent/50 active:bg-accent transition-all cursor-pointer"
                          onClick={() => addProductToSelection(sp)}
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                              {sp.product?.images?.[0] ? (
                                <img
                                  src={sp.product.images[0]}
                                  alt={sp.product?.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-xs sm:text-sm truncate">{sp.product?.name}</p>
                              <span className="text-[10px] sm:text-xs text-muted-foreground">Stock: {sp.product?.stock_quantity || 0}</span>
                            </div>
                            <Button size="icon" variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
                              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Selected products with quantities */}
              <div className="flex flex-col min-h-0 border rounded-lg border-primary/30">
                <div className="p-2 sm:p-3 border-b bg-primary/5">
                  <Label className="text-xs sm:text-sm font-medium flex items-center justify-between">
                    <span className="text-primary">{t('newPurchaseDialog.selectionnes')}</span>
                    <Badge className="bg-primary text-[10px] sm:text-xs">{selectedProducts.length} produit(s)</Badge>
                  </Label>
                </div>

                {selectedProducts.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-3 min-h-[120px] sm:min-h-0">
                    <ShoppingCart className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/40 mb-2" />
                    <p className="text-[10px] sm:text-xs text-muted-foreground text-center">
                      Cliquez sur un produit pour l'ajouter
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="flex-1 max-h-[25vh] sm:max-h-none">
                    <div className="p-1.5 sm:p-2 space-y-1.5 sm:space-y-2">
                      {selectedProducts.map((product) => {
                        const productTotal = calculateProductTotal(product);

                        return (
                          <div
                            key={product.productId}
                            className="p-3 rounded-xl border-2 bg-card shadow-sm"
                          >
                            {/* Product header */}
                            <div className="flex items-start gap-2 mb-3">
                              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                {product.imageUrl ? (
                                  <img
                                    src={product.imageUrl}
                                    alt={product.productName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Package className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">{product.productName}</p>
                                <p className="text-xs text-muted-foreground">Stock: {product.currentStock}</p>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => removeProductFromSelection(product.productId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Mobile-optimized input buttons */}
                            <div className="space-y-2">
                              {/* Price button - tap to open keypad */}
                              <button
                                type="button"
                                onClick={() => openKeypadFor(product, 'price')}
                                className="w-full flex items-center justify-between p-3 rounded-xl bg-[#ff4000]/10 border-2 border-[#ff4000]/30 hover:border-[#ff4000]/50 active:scale-[0.98] transition-all"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-[#ff4000]/20 flex items-center justify-center">
                                    <DollarSign className="h-4 w-4 text-[#ff4000]" />
                                  </div>
                                  <span className="text-sm font-medium text-muted-foreground">Prix d'achat</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-lg font-bold tabular-nums",
                                    product.unitCost > 0 ? "text-[#ff4000]" : "text-muted-foreground"
                                  )}>
                                    {product.unitCost > 0 ? product.unitCost.toLocaleString() : '0'}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {product.unitCostCurrency}
                                  </Badge>
                                  <Edit3 className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </button>

                              {/* Quantity button - tap to open keypad */}
                              <button
                                type="button"
                                onClick={() => openKeypadFor(product, 'quantity')}
                                className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-500/10 border-2 border-blue-500/30 hover:border-blue-500/50 active:scale-[0.98] transition-all"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <Hash className="h-4 w-4 text-blue-600" />
                                  </div>
                                  <span className="text-sm font-medium text-muted-foreground">{t('newPurchaseDialog.quantiteUnites')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-lg font-bold tabular-nums",
                                    product.quantity > 0 ? "text-blue-600" : "text-muted-foreground"
                                  )}>
                                    {product.quantity}
                                  </span>
                                  <Edit3 className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </button>

                              {/* Carton quantity button - only if sell by carton */}
                              {product.sellByCarton && product.unitsPerCarton && (
                                <button
                                  type="button"
                                  onClick={() => openKeypadFor(product, 'carton')}
                                  className="w-full flex items-center justify-between p-3 rounded-xl bg-[#04439e]/10 border-2 border-[#04439e]/30 hover:border-[#04439e]/50 active:scale-[0.98] transition-all"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-[#04439e]/20 flex items-center justify-center">
                                      <Box className="h-4 w-4 text-[#04439e]" />
                                    </div>
                                    <div className="text-left">
                                      <span className="text-sm font-medium text-muted-foreground block">Cartons</span>
                                      <span className="text-[10px] text-muted-foreground/70">({product.unitsPerCarton} u/ctn)</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={cn(
                                      "text-lg font-bold tabular-nums",
                                      product.cartonQuantity > 0 ? "text-[#04439e]" : "text-muted-foreground"
                                    )}>
                                      {product.cartonQuantity}
                                    </span>
                                    <Edit3 className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </button>
                              )}

                              {/* Summary */}
                              <div className="flex justify-between items-center pt-2 border-t border-dashed">
                                <span className="text-sm text-muted-foreground">
                                  {calculateTotalUnits(product)} unités total
                                </span>
                                <span className="text-base font-bold text-primary">
                                  {productTotal.toLocaleString()} {product.unitCostCurrency}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>

            {/* Total */}
            {selectedProducts.length > 0 && (
              <div className="p-2.5 sm:p-4 rounded-lg bg-primary/10 border border-primary/20 flex-shrink-0">
                <div className="flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <span className="font-medium text-xs sm:text-base">{t('newPurchaseDialog.totalEstime')}</span>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                      {selectedProducts.length} produit(s) • {totalItems} unités
                    </p>
                  </div>
                  <span className="text-base sm:text-xl font-bold text-primary flex-shrink-0">
                    {fc(totalAmount)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="p-3 sm:p-4 border-t flex-shrink-0 gap-2 sm:gap-0">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isCreating} size="sm" className="text-xs sm:text-sm h-9 sm:h-10">
                Annuler
              </Button>
              <Button
                onClick={handleNextStep}
                disabled={!selectedSupplier}
                className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-9 sm:h-10 flex-1 sm:flex-none"
              >
                Suivant
                <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handlePreviousStep} disabled={isCreating} className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-9 sm:h-10">
                <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Retour
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!selectedProducts.some(p => p.quantity > 0 || p.cartonQuantity > 0) || isCreating}
                className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-9 sm:h-10 flex-1 sm:flex-none"
              >
                {isCreating ? (
                  'Création...'
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="truncate">Créer ({fc(totalAmount)})</span>
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Numeric keypad for mobile input */}
      <PurchaseInputKeypad
        open={keypadOpen}
        onOpenChange={setKeypadOpen}
        mode={keypadMode}
        productName={keypadProductName}
        currentValue={keypadCurrentValue}
        currency={keypadCurrency}
        unitsPerCarton={keypadUnitsPerCarton}
        onConfirm={handleKeypadConfirm}
      />
    </Dialog>
  );
}
