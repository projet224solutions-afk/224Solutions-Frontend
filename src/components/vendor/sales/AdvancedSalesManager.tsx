/**
 * GESTIONNAIRE VENTES AVANCÉES
 * Ventes groupées, retours, à crédit, promotions
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import { useVendorCurrency } from '@/hooks/useVendorCurrency';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  ShoppingCart, RotateCcw, CreditCard, Percent, Plus,
  Package, Users, Search, Banknote, CheckCircle, Eye, Check
} from 'lucide-react';

// Type produit pour la sélection
interface Product {
  id: string;
  name: string;
  price: number;
  images?: string[];
  category_id?: string;
}

// Type catégorie
interface Category {
  id: string;
  name: string;
}

// ============= TYPES =============
interface GroupedSale {
  id: string;
  group_name: string;
  total: number;
  discount_value: number;
  status: string;
  created_at: string;
}

interface SaleReturn {
  id: string;
  order_id: string | null;
  return_reason: string;
  refund_amount: number;
  created_at: string;
}

interface CreditSaleItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  images?: string[];
}

interface CreditSale {
  id: string;
  customer_name: string;
  customer_phone?: string | null;
  notes?: string | null;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string;
  status: string;
  items?: CreditSaleItem[];
}

interface Promotion {
  id: string;
  name: string;
  discount_type: string;
  discount_value: number;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  applicable_products?: string[];
  applicable_categories?: string[];
}

export default function AdvancedSalesManager() {
  const { t } = useTranslation();
  const { vendorId } = useCurrentVendor();
  const { toast } = useToast();
  const { currency, convert, isReady: currencyReady } = useVendorCurrency();
  const fc = (amount: number) => currencyReady ? `${Math.round(convert(amount)).toLocaleString('fr-FR')} ${currency}` : '—';
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('credit');

  // États pour chaque section
  const [creditSales, setCreditSales] = useState<CreditSale[]>([]);
  const [saleReturns, setSaleReturns] = useState<SaleReturn[]>([]);
  const [groupedSales, setGroupedSales] = useState<GroupedSale[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  // Dialogs
  const [isNewCreditOpen, setIsNewCreditOpen] = useState(false);
  const [isNewReturnOpen, setIsNewReturnOpen] = useState(false);
  const [isNewPromoOpen, setIsNewPromoOpen] = useState(false);
  const [isCollectPaymentOpen, setIsCollectPaymentOpen] = useState(false);
  const [selectedCreditForPayment, setSelectedCreditForPayment] = useState<CreditSale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  // Dialog pour voir les détails des produits d'une vente à crédit
  const [isCreditDetailsOpen, setIsCreditDetailsOpen] = useState(false);
  const [selectedCreditForDetails, setSelectedCreditForDetails] = useState<CreditSale | null>(null);

  // Formulaires
  const [newCredit, setNewCredit] = useState({
    customer_name: '',
    total: '',
    due_date: '',
    notes: '',
    selected_category: ''
  });

  // Produits sélectionnés pour crédit (avec quantité)
  const [creditSelectedProducts, setCreditSelectedProducts] = useState<{id: string; name: string; price: number; quantity: number; images?: string[]}[]>([]);

  // Recherche produit pour crédits
  const [creditProductSearch, setCreditProductSearch] = useState('');

  const [newReturn, setNewReturn] = useState({
    order_id: '',
    return_reason: '',
    refund_amount: '',
    quantity_returned: '1',
    unit_price: '',
    selected_category: '',
    selected_product: ''
  });

  // Recherche produit pour retours
  const [returnProductSearch, setReturnProductSearch] = useState('');

  const [newPromo, setNewPromo] = useState({
    name: '',
    discount_type: 'percentage',
    discount_value: '',
    start_date: '',
    end_date: '',
    selected_products: [] as string[],
    selected_categories: [] as string[]
  });

  // État pour les produits et catégories
  const [vendorProducts, setVendorProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');

  // Chargement des données
  const loadData = async () => {
    if (!vendorId) return;
    setLoading(true);

    try {
      // Ventes à crédit
      const { data: creditData } = await supabase
        .from('vendor_credit_sales')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      setCreditSales((creditData || []).map(c => ({
        id: c.id,
        customer_name: c.customer_name || 'Client',
        customer_phone: c.customer_phone || null,
        notes: c.notes || null,
        total: c.total,
        paid_amount: c.paid_amount || 0,
        remaining_amount: c.remaining_amount,
        due_date: c.due_date,
        status: c.status,
        items: (Array.isArray(c.items) ? c.items : []) as unknown as CreditSaleItem[]
      })));

      // Retours
      const { data: returnsData } = await supabase
        .from('sale_returns')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      setSaleReturns((returnsData || []).map(r => ({
        id: r.id,
        order_id: r.order_id,
        return_reason: r.return_reason,
        refund_amount: r.refund_amount,
        created_at: r.created_at
      })));

      // Ventes groupées
      const { data: groupedData } = await supabase
        .from('grouped_sales')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      setGroupedSales((groupedData || []).map(g => ({
        id: g.id,
        group_name: g.group_name || 'Groupe',
        total: g.total,
        discount_value: g.discount_value || 0,
        status: g.status,
        created_at: g.created_at
      })));

      // Promotions
      const { data: promoData } = await supabase
        .from('vendor_promotions')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      setPromotions((promoData || []).map(p => ({
        id: p.id,
        name: p.name,
        discount_type: p.discount_type,
        discount_value: p.discount_value,
        start_date: p.start_date,
        end_date: p.end_date,
        is_active: p.is_active,
        applicable_products: Array.isArray(p.applicable_products)
          ? (p.applicable_products as unknown as string[])
          : [],
        applicable_categories: Array.isArray(p.applicable_categories)
          ? (p.applicable_categories as unknown as string[])
          : []
      })));

      // Produits du vendeur - chercher par vendor_id OU user_id pour compatibilité
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, price, images, category_id')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('name');

      console.log('[AdvancedSalesManager] Produits chargés:', productsData?.length || 0, 'pour vendorId:', vendorId);

      if (productsError) {
        console.error('[AdvancedSalesManager] Erreur chargement produits:', productsError);
      }

      setVendorProducts(productsData || []);

      // Catégories actives
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      setCategories(categoriesData || []);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  // Créer une vente à crédit
  const createCreditSale = async () => {
    if (!vendorId || !newCredit.customer_name || !newCredit.due_date) {
      toast({ title: 'Champs requis manquants', variant: 'destructive' });
      return;
    }

    if (creditSelectedProducts.length === 0) {
      toast({ title: t('advancedSalesManager.veuillezSelectionnerAuMoinsUn'), variant: 'destructive' });
      return;
    }

    try {
      // Calculer le total à partir des produits sélectionnés
      const calculatedTotal = creditSelectedProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
      const orderNum = `CR-${Date.now().toString(36).toUpperCase()}`;

      // Préparer les items pour sauvegarde
      const itemsToSave = creditSelectedProducts.map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        quantity: p.quantity,
        images: p.images || []
      }));

      const { error } = await supabase
        .from('vendor_credit_sales')
        .insert([{
          vendor_id: vendorId,
          customer_name: newCredit.customer_name,
          order_number: orderNum,
          total: calculatedTotal,
          subtotal: calculatedTotal,
          remaining_amount: calculatedTotal,
          due_date: newCredit.due_date,
          notes: newCredit.notes,
          items: itemsToSave,
          status: 'pending'
        }]);

      if (error) throw error;

      toast({ title: t('advancedSalesManager.venteACreditCreee') });
      setIsNewCreditOpen(false);
      setNewCredit({ customer_name: '', total: '', due_date: '', notes: '', selected_category: '' });
      setCreditSelectedProducts([]);
      loadData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  // Créer un retour
  const createReturn = async () => {
    if (!vendorId || !newReturn.return_reason || !newReturn.refund_amount || !newReturn.unit_price) {
      toast({ title: 'Champs requis manquants', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('sale_returns')
        .insert([{
          vendor_id: vendorId,
          order_id: newReturn.order_id || null,
          return_reason: newReturn.return_reason,
          refund_amount: parseFloat(newReturn.refund_amount),
          quantity_returned: parseInt(newReturn.quantity_returned) || 1,
          unit_price: parseFloat(newReturn.unit_price)
        }]);

      if (error) throw error;

      toast({ title: t('advancedSalesManager.retourEnregistre') });
      setIsNewReturnOpen(false);
      setNewReturn({ order_id: '', return_reason: '', refund_amount: '', quantity_returned: '1', unit_price: '', selected_category: '', selected_product: '' });
      loadData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  // Créer une promotion
  const createPromo = async () => {
    if (!vendorId || !newPromo.name || !newPromo.discount_value) {
      toast({ title: 'Champs requis manquants', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('vendor_promotions')
        .insert([{
          vendor_id: vendorId,
          name: newPromo.name,
          discount_type: newPromo.discount_type,
          discount_value: parseFloat(newPromo.discount_value),
          start_date: newPromo.start_date || null,
          end_date: newPromo.end_date || null,
          applicable_products: newPromo.selected_products.length > 0 ? newPromo.selected_products : null,
          applicable_categories: newPromo.selected_categories.length > 0 ? newPromo.selected_categories : null,
          is_active: true
        }]);

      if (error) throw error;

      toast({ title: t('advancedSalesManager.promotionCreee') });
      setIsNewPromoOpen(false);
      setNewPromo({
        name: '',
        discount_type: 'percentage',
        discount_value: '',
        start_date: '',
        end_date: '',
        selected_products: [],
        selected_categories: []
      });
      setProductSearchTerm('');
      loadData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  // Encaisser un paiement sur une vente à crédit
  const collectCreditPayment = async () => {
    if (!selectedCreditForPayment || !paymentAmount) {
      toast({ title: t('advancedSalesManager.montantRequis'), variant: 'destructive' });
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: t('advancedSalesManager.montantInvalide'), variant: 'destructive' });
      return;
    }

    if (amount > selectedCreditForPayment.remaining_amount) {
      toast({ title: t('advancedSalesManager.leMontantDepasseLeReste'), variant: 'destructive' });
      return;
    }

    try {
      // Encaissement ATOMIQUE côté serveur : verrou de la vente, insertion de l'historique
      // (credit_sale_payments, qui n'était JAMAIS alimentée), recalcul paid/remaining depuis
      // la somme des paiements (anti lost-update). Reste un registre CASH offline (sans wallet).
      const { data, error } = await supabase.rpc('record_credit_sale_payment_atomic' as any, {
        p_credit_sale_id: selectedCreditForPayment.id,
        p_amount: amount,
        p_method: 'cash',
      });

      if (error) throw error;
      const res = data as any;

      toast({
        title: res?.status === 'paid' ? '✅ Crédit soldé !' : '✅ Paiement enregistré',
        description: `${fc(amount)} encaissés`
      });
      setIsCollectPaymentOpen(false);
      setSelectedCreditForPayment(null);
      setPaymentAmount('');
      loadData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    }
  };

  // Ouvrir le dialogue d'encaissement
  const openCollectPaymentDialog = (credit: CreditSale) => {
    setSelectedCreditForPayment(credit);
    setPaymentAmount(credit.remaining_amount.toString());
    setIsCollectPaymentOpen(true);
  };

  // Toggle sélection produit pour promo
  const toggleProductSelection = (productId: string) => {
    setNewPromo(prev => ({
      ...prev,
      selected_products: prev.selected_products.includes(productId)
        ? prev.selected_products.filter(id => id !== productId)
        : [...prev.selected_products, productId]
    }));
  };

  // Toggle sélection catégorie pour promo
  const toggleCategorySelection = (categoryId: string) => {
    setNewPromo(prev => ({
      ...prev,
      selected_categories: prev.selected_categories.includes(categoryId)
        ? prev.selected_categories.filter(id => id !== categoryId)
        : [...prev.selected_categories, categoryId]
    }));
  };

  // Filtrer les produits (catégories sélectionnées + recherche)
  // Règle demandée : si une catégorie est sélectionnée, n'afficher QUE les produits de cette/ces catégorie(s)
  const filteredProducts = vendorProducts.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(productSearchTerm.toLowerCase());
    const matchesSelectedCategories =
      newPromo.selected_categories.length === 0 ||
      (Boolean(p.category_id) && newPromo.selected_categories.includes(p.category_id as string));

    return matchesSearch && matchesSelectedCategories;
  });

  // Produits dans les catégories sélectionnées (pour mise en évidence)
  const productsInSelectedCategories = newPromo.selected_categories.length > 0
    ? vendorProducts.filter(p => p.category_id && newPromo.selected_categories.includes(p.category_id))
    : [];

  // Stats
  const totalCredit = creditSales.reduce((sum, c) => sum + c.remaining_amount, 0);
  const totalReturns = saleReturns.reduce((sum, r) => sum + r.refund_amount, 0);
  const activePromos = promotions.filter(p => p.is_active).length;

  if (loading) {
    return <div className="p-4 text-center">Chargement...</div>;
  }

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Header - Compact mobile */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="text-base sm:text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
            <span className="truncate">{t('advancedSalesManager.ventesAvancees')}</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
            Gérez vos ventes à crédit, retours et promotions
          </p>
        </div>
      </div>

      {/* Stats - Grid 2x2 compact mobile */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-2 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">{t('advancedSalesManager.creances')}</p>
                <p className="text-sm sm:text-lg font-bold text-orange-600 truncate">{fc(totalCredit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-destructive flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Retours</p>
                <p className="text-sm sm:text-lg font-bold text-destructive truncate">{fc(totalReturns)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">{t('advancedSalesManager.groupees')}</p>
                <p className="text-sm sm:text-lg font-bold">{groupedSales.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 sm:p-4">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Percent className="w-4 h-4 sm:w-5 sm:h-5 text-[#ff4000] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Promos</p>
                <p className="text-sm sm:text-lg font-bold text-[#ff4000]">{activePromos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs - Horizontal scroll mobile */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
          <TabsList className="grid grid-cols-4 w-full min-w-[280px]">
            <TabsTrigger value="credit" className="text-[10px] sm:text-sm px-1 sm:px-3">
              <CreditCard className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
              <span className="hidden sm:inline">{t('advancedSalesManager.credit')}</span>
            </TabsTrigger>
            <TabsTrigger value="returns" className="text-[10px] sm:text-sm px-1 sm:px-3">
              <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
              <span className="hidden sm:inline">Retours</span>
            </TabsTrigger>
            <TabsTrigger value="grouped" className="text-[10px] sm:text-sm px-1 sm:px-3">
              <Package className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
              <span className="hidden sm:inline">{t('advancedSalesManager.groupees')}</span>
            </TabsTrigger>
            <TabsTrigger value="promos" className="text-[10px] sm:text-sm px-1 sm:px-3">
              <Percent className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
              <span className="hidden sm:inline">Promos</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* VENTES À CRÉDIT */}
        <TabsContent value="credit" className="mt-3 sm:mt-4">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h3 className="font-semibold text-sm sm:text-base">{t('advancedSalesManager.ventesACredit')}</h3>
            <Dialog open={isNewCreditOpen} onOpenChange={setIsNewCreditOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 text-xs sm:text-sm">
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">{t('advancedSalesManager.nouvelle')}</span>
                  <span className="sm:hidden">+</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-3 sm:p-6">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle className="text-base sm:text-lg">{t('advancedSalesManager.nouvelleVenteACredit')}</DialogTitle>
                </DialogHeader>

                <ScrollArea className="flex-1 pr-4">
                  <div className="pb-4">
                    <div className="grid gap-4 lg:grid-cols-3">
                      {/* COL 1 — Client & Détails */}
                      <div className="space-y-4 lg:col-span-1">
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground mb-2">{t('advancedSalesManager.informationsClient')}</p>
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-medium">{t('advancedSalesManager.nomDuClient')}</label>
                              <Input
                                placeholder={t('advancedSalesManager.nomDuClient2')}
                                value={newCredit.customer_name}
                                onChange={(e) => setNewCredit({ ...newCredit, customer_name: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Notes</label>
                              <Input
                                placeholder="Notes optionnelles"
                                value={newCredit.notes}
                                onChange={(e) => setNewCredit({ ...newCredit, notes: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="rounded-lg border bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground mb-2">{t('advancedSalesManager.detailsDuCredit')}</p>
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-medium">{t('advancedSalesManager.montantGnf')}</label>
                              <Input
                                type="number"
                                placeholder="0"
                                value={newCredit.total}
                                onChange={(e) => setNewCredit({ ...newCredit, total: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">{t('advancedSalesManager.dateDEcheance')}</label>
                              <Input
                                type="date"
                                value={newCredit.due_date}
                                onChange={(e) => setNewCredit({ ...newCredit, due_date: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* COL 2-3 — Sélection Catégorie & Produit */}
                      <div className="grid gap-4 md:grid-cols-2 lg:col-span-2">
                        {/* Catégories */}
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground mb-2">{t('advancedSalesManager.categorieOptionnel')}</p>
                          <ScrollArea className="h-56">
                            <div className="space-y-1">
                              {categories.map((cat) => (
                                <div
                                  key={cat.id}
                                  className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-muted/50 ${
                                    newCredit.selected_category === cat.id ? 'bg-primary/10 border border-primary' : ''
                                  }`}
                                  onClick={() => {
                                    setNewCredit({
                                      ...newCredit,
                                      selected_category: newCredit.selected_category === cat.id ? '' : cat.id
                                    });
                                  }}
                                >
                                  <Checkbox
                                    checked={newCredit.selected_category === cat.id}
                                    onCheckedChange={() => {
                                      setNewCredit({
                                        ...newCredit,
                                        selected_category: newCredit.selected_category === cat.id ? '' : cat.id
                                      });
                                    }}
                                  />
                                  <span className="text-sm">{cat.name}</span>
                                </div>
                              ))}
                              {categories.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">{t('advancedSalesManager.aucuneCategorie')}</p>
                              )}
                            </div>
                          </ScrollArea>
                        </div>

                        {/* Produits sélectionnés */}
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs text-muted-foreground">{t('advancedSalesManager.produitsSelectionnes')}</p>
                            {creditSelectedProducts.length > 0 && (
                              <Badge variant="secondary">{creditSelectedProducts.length} produit(s)</Badge>
                            )}
                          </div>

                          {/* Liste des produits sélectionnés */}
                          {creditSelectedProducts.length > 0 && (
                            <div className="space-y-2 mb-3 p-2 bg-primary/5 rounded-lg border border-primary/20">
                              {creditSelectedProducts.map((sp) => (
                                <div key={sp.id} className="flex items-center gap-2">
                                  {sp.images && sp.images[0] ? (
                                    <img src={sp.images[0]} alt={sp.name} className="w-8 h-8 rounded object-cover" />
                                  ) : (
                                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                      <Package className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{sp.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{fc(sp.price)}</p>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => {
                                        setCreditSelectedProducts(prev =>
                                          prev.map(p => p.id === sp.id ? {...p, quantity: Math.max(1, p.quantity - 1)} : p)
                                        );
                                      }}
                                    >
                                      -
                                    </Button>
                                    <span className="text-xs font-mono w-6 text-center">{sp.quantity}</span>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => {
                                        setCreditSelectedProducts(prev =>
                                          prev.map(p => p.id === sp.id ? {...p, quantity: p.quantity + 1} : p)
                                        );
                                      }}
                                    >
                                      +
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-destructive"
                                      onClick={() => {
                                        setCreditSelectedProducts(prev => prev.filter(p => p.id !== sp.id));
                                      }}
                                    >
                                      ×
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              <div className="pt-2 border-t">
                                <p className="text-sm font-bold text-primary">
                                  Total: {fc(creditSelectedProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0))}
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="relative mb-2">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder={t('advancedSalesManager.rechercherUnProduit')}
                              value={creditProductSearch}
                              onChange={(e) => setCreditProductSearch(e.target.value)}
                              className="pl-8"
                            />
                          </div>
                          <ScrollArea className="h-56">
                            <div className="grid grid-cols-2 gap-2">
                              {vendorProducts
                                .filter(p => {
                                  const matchesSearch = p.name.toLowerCase().includes(creditProductSearch.toLowerCase());
                                  const matchesCategory = !newCredit.selected_category || p.category_id === newCredit.selected_category;
                                  return matchesSearch && matchesCategory;
                                })
                                .map((product) => {
                                  const isSelected = creditSelectedProducts.some(sp => sp.id === product.id);
                                  return (
                                    <div
                                      key={product.id}
                                      className={`relative p-1.5 rounded-lg cursor-pointer transition-all hover:bg-muted/50 ${
                                        isSelected ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted/20'
                                      }`}
                                      onClick={() => {
                                        if (isSelected) {
                                          setCreditSelectedProducts(prev => prev.filter(p => p.id !== product.id));
                                        } else {
                                          setCreditSelectedProducts(prev => [...prev, {
                                            id: product.id,
                                            name: product.name,
                                            price: product.price,
                                            quantity: 1,
                                            images: product.images
                                          }]);
                                        }
                                      }}
                                    >
                                      {/* Checkbox indicator */}
                                      {isSelected && (
                                        <div className="absolute top-1 right-1 z-10 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                          <Check className="w-3 h-3 text-primary-foreground" />
                                        </div>
                                      )}

                                      {/* Product image */}
                                      <div className="aspect-square rounded-md overflow-hidden mb-1.5 bg-muted">
                                        {product.images && product.images[0] ? (
                                          <img
                                            src={product.images[0]}
                                            alt={product.name}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center">
                                            <Package className="w-8 h-8 text-muted-foreground" />
                                          </div>
                                        )}
                                      </div>

                                      {/* Product info */}
                                      <p className="text-xs font-medium truncate">{product.name}</p>
                                      <p className="text-[10px] text-primary font-bold">{fc(product.price)}</p>
                                    </div>
                                  );
                                })}
                            </div>
                            {vendorProducts.filter(p => {
                              const matchesSearch = p.name.toLowerCase().includes(creditProductSearch.toLowerCase());
                              const matchesCategory = !newCredit.selected_category || p.category_id === newCredit.selected_category;
                              return matchesSearch && matchesCategory;
                            }).length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">{t('advancedSalesManager.aucunProduitTrouve')}</p>
                            )}
                          </ScrollArea>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                <div className="flex gap-2 justify-end pt-4 flex-shrink-0 border-t">
                  <Button variant="outline" onClick={() => setIsNewCreditOpen(false)}>{t('advancedSalesManager.annuler')}</Button>
                  <Button onClick={createCreditSale}>{t('advancedSalesManager.creer')}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {creditSales.map((sale) => (
              <Card key={sale.id}>
                <CardContent className="p-2.5 sm:p-4">
                  <div className="space-y-2 sm:space-y-3">
                    {/* Mobile: Stack layout / Desktop: Row layout */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                      {/* Client info */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="p-1.5 sm:p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex-shrink-0">
                          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm sm:text-base truncate">{sale.customer_name}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Éch: {new Date(sale.due_date).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                        {/* Badge mobile only - inline with name */}
                        <Badge variant={sale.status === 'paid' ? 'default' : 'secondary'} className="sm:hidden text-[10px] h-5">
                          {sale.status === 'paid' ? 'Payé' : sale.status === 'partial' ? 'Part.' : 'Att.'}
                        </Badge>
                      </div>

                      {/* Montants + Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
                        <div className="text-left sm:text-right">
                          <p className="font-bold text-sm sm:text-base text-orange-600">{fc(sale.remaining_amount)}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            sur {fc(sale.total)}
                          </p>
                          <Badge variant={sale.status === 'paid' ? 'default' : 'secondary'} className="hidden sm:inline-flex">
                            {sale.status === 'paid' ? 'Payé' : sale.status === 'partial' ? 'Partiel' : 'En attente'}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                            onClick={() => {
                              setSelectedCreditForDetails(sale);
                              setIsCreditDetailsOpen(true);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </Button>
                          {sale.status !== 'paid' && (
                            <Button
                              size="sm"
                              className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                              onClick={() => openCollectPaymentDialog(sale)}
                            >
                              <Banknote className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" />
                              <span className="hidden sm:inline">Encaisser</span>
                            </Button>
                          )}
                          {sale.status === 'paid' && (
                            <div className="p-1.5 sm:p-2">
                              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-[#ff4000]" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Liste des produits vendus à crédit */}
                    {sale.items && sale.items.length > 0 && (
                      <div className="border-t pt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">{t('advancedSalesManager.produitsVendus')}</p>
                        <div className="flex flex-wrap gap-2">
                          {sale.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 bg-muted/50 rounded-lg p-2"
                            >
                              {item.images && item.images[0] ? (
                                <img
                                  src={item.images[0]}
                                  alt={item.name}
                                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                  <Package className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate max-w-[120px]">{item.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {item.quantity}x {fc(item.price)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {creditSales.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">{t('advancedSalesManager.aucuneVenteACredit')}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Dialog d'encaissement */}
          <Dialog open={isCollectPaymentOpen} onOpenChange={setIsCollectPaymentOpen}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-primary" />
                  Encaisser un paiement
                </DialogTitle>
              </DialogHeader>

              {selectedCreditForPayment && (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="font-semibold text-lg">{selectedCreditForPayment.customer_name}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t('advancedSalesManager.totalCredit')}</span>
                        <p className="font-medium">{fc(selectedCreditForPayment.total)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('advancedSalesManager.dejaPaye')}</span>
                        <p className="font-medium text-[#ff4000]">{fc(selectedCreditForPayment.paid_amount)}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">{t('advancedSalesManager.resteAPayer')}</span>
                        <p className="font-bold text-orange-600 text-lg">{fc(selectedCreditForPayment.remaining_amount)}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">{t('advancedSalesManager.montantAEncaisserGnf')}</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="mt-1"
                    />
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaymentAmount(selectedCreditForPayment.remaining_amount.toString())}
                      >
                        Tout solder
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPaymentAmount(Math.round(selectedCreditForPayment.remaining_amount / 2).toString())}
                      >
                        Moitié
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button variant="outline" onClick={() => setIsCollectPaymentOpen(false)}>
                      Annuler
                    </Button>
                    <Button onClick={collectCreditPayment}>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Confirmer l'encaissement
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Dialog de détails des produits vendus à crédit */}
          <Dialog open={isCreditDetailsOpen} onOpenChange={setIsCreditDetailsOpen}>
            <DialogContent className="w-[95vw] sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-3 sm:p-6">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Détails vente à crédit
                </DialogTitle>
              </DialogHeader>

              {selectedCreditForDetails && (
                <div className="space-y-3 sm:space-y-4 overflow-hidden flex flex-col">
                  {/* Infos client - compact mobile */}
                  <div className="rounded-lg border bg-muted/30 p-2.5 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                        <Users className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm sm:text-lg truncate">{selectedCreditForDetails.customer_name}</p>
                        {selectedCreditForDetails.customer_phone && (
                          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                            📞 {selectedCreditForDetails.customer_phone}
                          </p>
                        )}
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Éch: {new Date(selectedCreditForDetails.due_date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                    {/* Montants - grille responsive */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2 mt-3 sm:mt-4 text-xs sm:text-sm">
                      <div className="bg-background/50 rounded p-1.5 sm:p-2">
                        <span className="text-muted-foreground text-[10px] sm:text-xs">Total</span>
                        <p className="font-bold text-xs sm:text-sm">{fc(selectedCreditForDetails.total)}</p>
                      </div>
                      <div className="bg-background/50 rounded p-1.5 sm:p-2">
                        <span className="text-muted-foreground text-[10px] sm:text-xs">{t('advancedSalesManager.paye')}</span>
                        <p className="font-medium text-[#ff4000] text-xs sm:text-sm">{fc(selectedCreditForDetails.paid_amount)}</p>
                      </div>
                      <div className="bg-background/50 rounded p-1.5 sm:p-2">
                        <span className="text-muted-foreground text-[10px] sm:text-xs">Reste</span>
                        <p className="font-bold text-orange-600 text-xs sm:text-sm">{fc(selectedCreditForDetails.remaining_amount)}</p>
                      </div>
                    </div>

                    {/* Notes */}
                    {selectedCreditForDetails.notes && (
                      <div className="mt-4 pt-3 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Notes:</p>
                        <p className="text-sm">{selectedCreditForDetails.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Liste des produits */}
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium mb-3">Produits vendus ({selectedCreditForDetails.items?.length || 0})</p>
                    <ScrollArea className="h-[300px] pr-2">
                      <div className="space-y-3">
                        {selectedCreditForDetails.items && selectedCreditForDetails.items.length > 0 ? (
                          selectedCreditForDetails.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                            >
                              {item.images && item.images[0] ? (
                                <img
                                  src={item.images[0]}
                                  alt={item.name}
                                  className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                  <Package className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{item.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  Prix unitaire: {fc(item.price)}
                                </p>
                                <p className="text-sm">
                                  Quantité: <span className="font-semibold">{item.quantity}</span>
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-primary">
                                  {fc(item.price * item.quantity)}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-50" />
                            <p className="text-muted-foreground font-medium">{t('advancedSalesManager.aucunProduitEnregistre')}</p>
                            <p className="text-xs text-muted-foreground mt-2 max-w-[250px] mx-auto">
                              Cette vente a été créée avant l'ajout de cette fonctionnalité.
                              Les nouvelles ventes à crédit afficheront les produits sélectionnés.
                            </p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="flex justify-end pt-4 border-t flex-shrink-0">
                    <Button variant="outline" onClick={() => setIsCreditDetailsOpen(false)}>
                      Fermer
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* RETOURS */}
        <TabsContent value="returns" className="mt-3 sm:mt-4">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h3 className="font-semibold text-sm sm:text-base">Retours</h3>
            <Dialog open={isNewReturnOpen} onOpenChange={setIsNewReturnOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 text-xs sm:text-sm">
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">{t('advancedSalesManager.nouveauRetour')}</span>
                  <span className="sm:hidden">+</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-3 sm:p-6">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle className="text-base sm:text-lg">{t('advancedSalesManager.enregistrerUnRetour')}</DialogTitle>
                </DialogHeader>

                <ScrollArea className="flex-1 pr-4">
                  <div className="pb-4">
                    <div className="grid gap-4 lg:grid-cols-3">
                      {/* COL 1 — Contexte & Raison */}
                      <div className="space-y-4 lg:col-span-1">
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground mb-2">Contexte</p>
                          <div className="space-y-3">
                            <div>
                              <label className="text-sm font-medium">{t('advancedSalesManager.nCommandeOptionnel')}</label>
                              <Input
                                placeholder="ORD-XXXXX"
                                value={newReturn.order_id}
                                onChange={(e) => setNewReturn({ ...newReturn, order_id: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">{t('advancedSalesManager.raisonDuRetour')}</label>
                              <Input
                                placeholder={t('advancedSalesManager.produitDefectueuxMauvaiseTaille')}
                                value={newReturn.return_reason}
                                onChange={(e) => setNewReturn({ ...newReturn, return_reason: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="rounded-lg border bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground mb-2">Montants</p>
                          <div className="space-y-3">
                            <div className="grid gap-3 grid-cols-2">
                              <div>
                                <label className="text-sm font-medium">{t('advancedSalesManager.quantite')}</label>
                                <Input
                                  type="number"
                                  placeholder="1"
                                  value={newReturn.quantity_returned}
                                  onChange={(e) => setNewReturn({ ...newReturn, quantity_returned: e.target.value })}
                                />
                              </div>
                              <div>
                                <label className="text-sm font-medium">Prix unitaire *</label>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={newReturn.unit_price}
                                  onChange={(e) => setNewReturn({ ...newReturn, unit_price: e.target.value })}
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-sm font-medium">{t('advancedSalesManager.montantRemboursementGnf')}</label>
                              <Input
                                type="number"
                                placeholder="0"
                                value={newReturn.refund_amount}
                                onChange={(e) => setNewReturn({ ...newReturn, refund_amount: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* COL 2-3 — Sélection Catégorie & Produit */}
                      <div className="grid gap-4 md:grid-cols-2 lg:col-span-2">
                        {/* Catégories */}
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground mb-2">{t('advancedSalesManager.categorieOptionnel')}</p>
                          <ScrollArea className="h-56">
                            <div className="space-y-1">
                              {categories.map((cat) => (
                                <div
                                  key={cat.id}
                                  className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-muted/50 ${
                                    newReturn.selected_category === cat.id ? 'bg-primary/10 border border-primary' : ''
                                  }`}
                                  onClick={() => {
                                    setNewReturn({
                                      ...newReturn,
                                      selected_category: newReturn.selected_category === cat.id ? '' : cat.id,
                                      selected_product: '' // Reset product when category changes
                                    });
                                  }}
                                >
                                  <Checkbox
                                    checked={newReturn.selected_category === cat.id}
                                    onCheckedChange={() => {
                                      setNewReturn({
                                        ...newReturn,
                                        selected_category: newReturn.selected_category === cat.id ? '' : cat.id,
                                        selected_product: ''
                                      });
                                    }}
                                  />
                                  <span className="text-sm">{cat.name}</span>
                                </div>
                              ))}
                              {categories.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">{t('advancedSalesManager.aucuneCategorie')}</p>
                              )}
                            </div>
                          </ScrollArea>
                        </div>

                        {/* Produits */}
                        <div className="rounded-lg border bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground mb-2">{t('advancedSalesManager.produitConcerne')}</p>
                          <div className="relative mb-2">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder={t('advancedSalesManager.rechercher')}
                              value={returnProductSearch}
                              onChange={(e) => setReturnProductSearch(e.target.value)}
                              className="pl-8"
                            />
                          </div>
                          <ScrollArea className="h-48">
                            <div className="space-y-1">
                              {vendorProducts
                                .filter(p => {
                                  const matchesSearch = p.name.toLowerCase().includes(returnProductSearch.toLowerCase());
                                  const matchesCategory = !newReturn.selected_category || p.category_id === newReturn.selected_category;
                                  return matchesSearch && matchesCategory;
                                })
                                .map((product) => (
                                  <div
                                    key={product.id}
                                    className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-muted/50 ${
                                      newReturn.selected_product === product.id ? 'bg-primary/10 border border-primary' : ''
                                    }`}
                                    onClick={() => {
                                      setNewReturn({
                                        ...newReturn,
                                        selected_product: newReturn.selected_product === product.id ? '' : product.id,
                                        unit_price: product.price.toString()
                                      });
                                    }}
                                  >
                                    <Checkbox
                                      checked={newReturn.selected_product === product.id}
                                      onCheckedChange={() => {
                                        setNewReturn({
                                          ...newReturn,
                                          selected_product: newReturn.selected_product === product.id ? '' : product.id,
                                          unit_price: product.price.toString()
                                        });
                                      }}
                                    />
                                    {product.images && product.images[0] ? (
                                      <img
                                        src={product.images[0]}
                                        alt={product.name}
                                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                        <Package className="w-5 h-5 text-muted-foreground" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm block truncate">{product.name}</span>
                                      <span className="text-xs text-muted-foreground">{fc(product.price)}</span>
                                    </div>
                                  </div>
                                ))}
                              {vendorProducts.filter(p => {
                                const matchesSearch = p.name.toLowerCase().includes(returnProductSearch.toLowerCase());
                                const matchesCategory = !newReturn.selected_category || p.category_id === newReturn.selected_category;
                                return matchesSearch && matchesCategory;
                              }).length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">{t('advancedSalesManager.aucunProduitTrouve')}</p>
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>

                <div className="flex gap-2 justify-end pt-4 flex-shrink-0 border-t">
                  <Button variant="outline" onClick={() => setIsNewReturnOpen(false)}>{t('advancedSalesManager.annuler')}</Button>
                  <Button onClick={createReturn}>{t('advancedSalesManager.enregistrer')}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {saleReturns.map((ret) => (
              <Card key={ret.id}>
                <CardContent className="p-2.5 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-destructive/10 flex-shrink-0">
                        <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-destructive" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-xs sm:text-sm truncate">{ret.order_id ? `Cmd ${ret.order_id}` : 'Retour direct'}</p>
                        <p className="text-[10px] sm:text-sm text-muted-foreground truncate">{ret.return_reason}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm sm:text-base text-destructive">-{fc(ret.refund_amount)}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {new Date(ret.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {saleReturns.length === 0 && (
              <Card>
                <CardContent className="p-6 sm:p-8 text-center">
                  <RotateCcw className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-muted-foreground/50" />
                  <p className="text-sm sm:text-base text-muted-foreground">{t('advancedSalesManager.aucunRetourEnregistre')}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* VENTES GROUPÉES */}
        <TabsContent value="grouped" className="mt-3 sm:mt-4">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h3 className="font-semibold text-sm sm:text-base">{t('advancedSalesManager.ventesGroupees')}</h3>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {groupedSales.map((gs) => (
              <Card key={gs.id}>
                <CardContent className="p-2.5 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 flex-shrink-0">
                        <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-xs sm:text-sm truncate">{gs.group_name}</p>
                        <p className="text-[10px] sm:text-sm text-muted-foreground">
                          {new Date(gs.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-sm sm:text-base">{fc(gs.total)}</p>
                      {gs.discount_value > 0 && (
                        <p className="text-[10px] sm:text-xs text-[#ff4000]">-{gs.discount_value}%</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {groupedSales.length === 0 && (
              <Card>
                <CardContent className="p-6 sm:p-8 text-center">
                  <Package className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-muted-foreground/50" />
                  <p className="text-sm sm:text-base text-muted-foreground">{t('advancedSalesManager.aucuneVenteGroupee')}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">{t('advancedSalesManager.creeesDepuisLePos')}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* PROMOTIONS */}
        <TabsContent value="promos" className="mt-3 sm:mt-4">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h3 className="font-semibold text-sm sm:text-base">Promotions</h3>
            <Dialog open={isNewPromoOpen} onOpenChange={setIsNewPromoOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 text-xs sm:text-sm">
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">{t('advancedSalesManager.nouvellePromo')}</span>
                  <span className="sm:hidden">+</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-3 sm:p-6">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle className="text-base sm:text-lg">{t('advancedSalesManager.creerUnePromotion')}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="flex-1 pr-4">
                <div className="pb-4">
                  <div className="grid gap-4 lg:grid-cols-3">
                    {/* COL 1 — Infos promotion */}
                    <div className="space-y-4 lg:col-span-1">
                      <div>
                        <label className="text-sm font-medium">{t('advancedSalesManager.nomDeLaPromo')}</label>
                        <Input
                          placeholder={t('advancedSalesManager.exSoldesDEte')}
                          value={newPromo.name}
                          onChange={(e) => setNewPromo({ ...newPromo, name: e.target.value })}
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="text-sm font-medium">{t('advancedSalesManager.typeDeRemise')}</label>
                          <select
                            className="w-full px-3 py-2 border rounded-md bg-background"
                            value={newPromo.discount_type}
                            onChange={(e) => setNewPromo({ ...newPromo, discount_type: e.target.value })}
                          >
                            <option value="percentage">Pourcentage (%)</option>
                            <option value="fixed">{t('advancedSalesManager.montantFixeGnf')}</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">
                            Valeur {newPromo.discount_type === 'percentage' ? '(%)' : '(GNF)'} *
                          </label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={newPromo.discount_value}
                            onChange={(e) => setNewPromo({ ...newPromo, discount_value: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="text-sm font-medium">{t('advancedSalesManager.dateDebut')}</label>
                          <Input
                            type="date"
                            value={newPromo.start_date}
                            onChange={(e) => setNewPromo({ ...newPromo, start_date: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Date fin</label>
                          <Input
                            type="date"
                            value={newPromo.end_date}
                            onChange={(e) => setNewPromo({ ...newPromo, end_date: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* COL 2–3 — Sélection (catégories + produits) */}
                    <div className="grid gap-4 md:grid-cols-2 lg:col-span-2">
                      {/* 1. SÉLECTION DE CATÉGORIES */}
                      <div className="bg-muted/30 p-3 rounded-lg border">
                        <label className="text-sm font-medium flex items-center gap-2">
                          🏷️ Catégories concernées
                        </label>
                        <p className="text-xs text-muted-foreground mb-2">
                          {newPromo.selected_categories.length === 0
                            ? 'Toutes les catégories (aucune sélection)'
                            : `${newPromo.selected_categories.length} catégorie(s) sélectionnée(s) - Les produits ci-dessous seront filtrés`}
                        </p>

                        <div className="h-56 border rounded-md p-2 bg-background overflow-y-auto">
                          {categories.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Aucune catégorie disponible
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {categories.map((category) => (
                                <div
                                  key={category.id}
                                  className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                                    newPromo.selected_categories.includes(category.id)
                                      ? 'bg-primary/10 border border-primary'
                                      : 'hover:bg-muted'
                                  }`}
                                  onClick={() => toggleCategorySelection(category.id)}
                                >
                                  <Checkbox
                                    checked={newPromo.selected_categories.includes(category.id)}
                                    onCheckedChange={() => toggleCategorySelection(category.id)}
                                  />
                                  <Package className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">{category.name}</span>
                                  <Badge variant="outline" className="ml-auto text-xs">
                                    {vendorProducts.filter(p => p.category_id === category.id).length} produit(s)
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {newPromo.selected_categories.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              setNewPromo({ ...newPromo, selected_categories: [], selected_products: [] });
                            }}
                          >
                            Tout désélectionner
                          </Button>
                        )}
                      </div>

                      {/* 2. SÉLECTION DE PRODUITS */}
                      <div>
                        <label className="text-sm font-medium flex items-center gap-2">
                          📦 Produits à promouvoir
                        </label>
                        <p className="text-xs text-muted-foreground mb-2">
                          {newPromo.selected_categories.length > 0 && productsInSelectedCategories.length > 0 && (
                            <span className="text-primary font-medium">
                              {productsInSelectedCategories.length} produit(s) dans les catégories sélectionnées •
                            </span>
                          )}
                          {newPromo.selected_products.length === 0
                            ? (newPromo.selected_categories.length > 0
                                ? ' Produits de la/les catégorie(s) sélectionnée(s) (aucune sélection)'
                                : ' Tous les produits (aucune sélection)')
                            : ` ${newPromo.selected_products.length} produit(s) sélectionné(s)`}
                        </p>

                        {/* Recherche */}
                        <div className="relative mb-2">
                          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder={t('advancedSalesManager.rechercherUnProduit')}
                            value={productSearchTerm}
                            onChange={(e) => setProductSearchTerm(e.target.value)}
                            className="pl-8"
                          />
                        </div>

                        {/* Liste des produits */}
                        <div className="h-56 border rounded-md p-2 bg-background overflow-y-auto">
                          {vendorProducts.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Aucun produit disponible dans votre boutique
                            </p>
                          ) : filteredProducts.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              {productSearchTerm
                                ? `Aucun résultat pour "${productSearchTerm}"`
                                : newPromo.selected_categories.length > 0
                                  ? 'Aucun produit dans la/les catégorie(s) sélectionnée(s)'
                                  : 'Aucun produit disponible'}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {filteredProducts.map((product) => {
                                const isSelected = newPromo.selected_products.includes(product.id);
                                const categoryName = categories.find(c => c.id === product.category_id)?.name;
                                const isInSelectedCategory =
                                  newPromo.selected_categories.length > 0 &&
                                  Boolean(product.category_id) &&
                                  newPromo.selected_categories.includes(product.category_id as string);

                                return (
                                  <div
                                    key={product.id}
                                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors border ${
                                      isSelected
                                        ? 'bg-primary/10 border-primary'
                                        : isInSelectedCategory
                                          ? 'bg-accent/40 border-accent'
                                          : 'border-transparent hover:bg-muted'
                                    }`}
                                    onClick={() => toggleProductSelection(product.id)}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => toggleProductSelection(product.id)}
                                    />
                                    {product.images?.[0] && (
                                      <img
                                        src={product.images[0]}
                                        alt={product.name}
                                        className="w-10 h-10 object-cover rounded"
                                      />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{product.name}</p>
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs text-muted-foreground">
                                          {fc(product.price)}
                                        </p>
                                        {categoryName && (
                                          <Badge variant="secondary" className="text-xs">
                                            {categoryName}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <Badge variant="default" className="text-xs">✓</Badge>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {newPromo.selected_products.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            onClick={() => setNewPromo({ ...newPromo, selected_products: [] })}
                          >
                            Tout désélectionner les produits
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                </ScrollArea>
                <div className="flex gap-2 justify-end pt-4 flex-shrink-0 border-t">
                  <Button variant="outline" onClick={() => setIsNewPromoOpen(false)}>{t('advancedSalesManager.annuler')}</Button>
                  <Button onClick={createPromo}>{t('advancedSalesManager.creer')}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {promotions.map((promo) => {
              const linkedProducts = promo.applicable_products && promo.applicable_products.length > 0
                ? vendorProducts.filter(p => promo.applicable_products?.includes(p.id))
                : [];

              const linkedCategories = promo.applicable_categories && promo.applicable_categories.length > 0
                ? categories.filter(c => promo.applicable_categories?.includes(c.id))
                : [];

              return (
                <Card key={promo.id}>
                  <CardContent className="p-2.5 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                      <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${promo.is_active ? 'bg-orange-100 dark:bg-[#ff4000]/30' : 'bg-muted'}`}>
                          <Percent className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${promo.is_active ? 'text-[#ff4000]' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-xs sm:text-sm truncate">{promo.name}</p>
                            <Badge variant={promo.is_active ? 'default' : 'secondary'} className="text-[10px] h-5 sm:hidden">
                              {promo.is_active ? 'Active' : 'Off'}
                            </Badge>
                          </div>
                          <p className="text-[10px] sm:text-sm text-muted-foreground">
                            {promo.start_date && promo.end_date
                              ? `${new Date(promo.start_date).toLocaleDateString('fr-FR')} - ${new Date(promo.end_date).toLocaleDateString('fr-FR')}`
                              : 'Sans limite'
                            }
                          </p>
                          {/* Tags produits/catégories - hidden on mobile for space */}
                          <div className="hidden sm:flex flex-wrap gap-1 mt-1">
                            {linkedProducts.length > 0 ? (
                              <>
                                {linkedProducts.slice(0, 2).map(p => (
                                  <Badge key={p.id} variant="outline" className="text-xs">
                                    📦 {p.name}
                                  </Badge>
                                ))}
                                {linkedProducts.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{linkedProducts.length - 2}
                                  </Badge>
                                )}
                              </>
                            ) : null}

                            {linkedCategories.length > 0 ? (
                              <>
                                {linkedCategories.slice(0, 2).map(c => (
                                  <Badge key={c.id} variant="secondary" className="text-xs">
                                    🏷️ {c.name}
                                  </Badge>
                                ))}
                                {linkedCategories.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{linkedCategories.length - 2}
                                  </Badge>
                                )}
                              </>
                            ) : null}

                            {linkedProducts.length === 0 && linkedCategories.length === 0 && (
                              <Badge variant="secondary" className="text-xs">
                                Tous les produits
                              </Badge>
                            )}
                          </div>
                          {/* Mobile: compact badge count */}
                          <div className="flex sm:hidden flex-wrap gap-1 mt-1">
                            {linkedProducts.length > 0 && (
                              <Badge variant="outline" className="text-[10px] h-4">
                                📦 {linkedProducts.length}
                              </Badge>
                            )}
                            {linkedCategories.length > 0 && (
                              <Badge variant="secondary" className="text-[10px] h-4">
                                🏷️ {linkedCategories.length}
                              </Badge>
                            )}
                            {linkedProducts.length === 0 && linkedCategories.length === 0 && (
                              <Badge variant="secondary" className="text-[10px] h-4">{t('advancedSalesManager.tous')}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end sm:flex-col sm:items-end gap-1">
                        <p className="font-bold text-sm sm:text-base text-[#ff4000]">
                          -{promo.discount_type === 'percentage' ? `${promo.discount_value}%` : fc(promo.discount_value)}
                        </p>
                        <Badge variant={promo.is_active ? 'default' : 'secondary'} className="hidden sm:inline-flex">
                          {promo.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {promotions.length === 0 && (
              <Card>
                <CardContent className="p-6 sm:p-8 text-center">
                  <Percent className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-muted-foreground/50" />
                  <p className="text-sm sm:text-base text-muted-foreground">{t('advancedSalesManager.aucunePromotion')}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
