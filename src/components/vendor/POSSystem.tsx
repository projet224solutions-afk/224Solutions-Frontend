import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, _CardHeader, _CardTitle } from '@/components/ui/card';
import { usePOSPersistence, clearPOSState, type POSPersistedState } from '@/hooks/usePOSPersistence';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { _Select, _SelectContent, _SelectItem, _SelectTrigger, _SelectValue } from '@/components/ui/select';
import { _Tabs, _TabsContent, _TabsList, _TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Receipt,
  Search,
  Grid3X3,
  List,
  Calculator,
  Smartphone,
  _User,
  CheckSquare,
  Settings,
  _Building,
  _Printer,
  _FileText,
  Clock,
  _UserX,
  _StickyNote,
  ShoppingBag,
  Check,
  Euro,
  _Eye,
  Package,
  Store,
  _Upload,
  ImageIcon,
  Percent,
  ChevronRight,
  Shield,
  CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import { usePOSSettings } from '@/hooks/usePOSSettings';

import { usePriceConverter } from '@/hooks/usePriceConverter';
import { CurrencySelect } from '@/components/ui/currency-select';
import { getCurrencyByCode, formatCurrency } from '@/data/currencies';
import { useAuth } from '@/hooks/useAuth';
import { useAgent } from '@/contexts/AgentContext';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import { supabase } from '@/integrations/supabase/client';
import { useVendorOptimized } from '@/hooks/useVendorOptimized';
import { _getEdgeFunctionErrorMessage } from '@/utils/supabaseFunctionsError';
import { NumericKeypadPopup } from './pos/NumericKeypadPopup';
import { QuantityKeypadPopup } from './pos/QuantityKeypadPopup';
import { POSReceipt } from './pos/POSReceipt';
import { BarcodeScannerModal } from './pos/BarcodeScannerModal';
import { Scan } from 'lucide-react';
import { useChapChapPay, type ChapChapPayMethod } from '@/hooks/useChapChapPay';
import { StripeCardPaymentModal } from '@/components/pos/StripeCardPaymentModal';
import { collectPosMarketingContact, syncPosSales, createPosOrder } from '@/services/posBackendService';

interface Product {
  id: string;
  name: string;
  price: number;
  images?: string[];
  category: string;
  categoryId?: string | null;
  section?: string; // Section personnalisée du vendeur
  stock: number;
  barcode?: string;
  // Champs carton
  sell_by_carton?: boolean;
  units_per_carton?: number;
  price_carton?: number;
}

interface CartItem extends Product {
  quantity: number;
  total: number;
  // Type de vente (unité ou carton)
  saleType?: 'unit' | 'carton';
  displayQuantity?: string; // Pour afficher "1 carton (24 unités)"
}

interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export function POSSystem() {
  const { t } = useTranslation();
  // Devise unifiée (CurrencyContext synchronisé au profil — fiable, ne retombe pas sur GNF
  // sur un simple retard de taux comme l'ancien useVendorCurrency). Le POS affiche donc
  // toujours la VRAIE devise de la boutique (ex: XOF) sur les prix, le panier ET le reçu.
  const { convert: priceConvert, userCurrency, loading: priceLoading, lastUpdated: ratesLastUpdatedFromCtx } = usePriceConverter();
  const vendorCurrency = userCurrency;
  const vendorConvert = useCallback((priceInGNF: number) => priceConvert(priceInGNF, 'GNF').convertedAmount, [priceConvert]);
  const currencyReady = !priceLoading;
  const { settings, loading: settingsLoading, updateSettings } = usePOSSettings(vendorCurrency);
  const { user: authUser, _session } = useAuth();
  const { vendorId: currentVendorId, userId: vendorOwnerUserId, loading: currentVendorLoading } = useCurrentVendor();
  const { vendorId: agentVendorId, agent } = useAgent(); // Récupérer le vendor_id depuis le contexte agent
  const isMobile = useIsMobile();
  const isAgentMode = !!agent; // Détecte si on est dans l'interface agent
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products');

  // Hook ChapChapPay pour paiements sécurisés
  const { initiatePullPayment, pollStatus, isLoading: _chapchapLoading, error: _chapchapError } = useChapChapPay();

  // Récupérer le vendor_id de l'utilisateur connecté ou du contexte agent
  const [vendorId, setVendorId] = useState<string | null>(currentVendorId || agentVendorId || null);
  const user = authUser;

  useEffect(() => {
    const VENDOR_ID_CACHE_KEY = 'pos_vendor_id';

    if (currentVendorLoading) {
      return;
    }

    if (currentVendorId || agentVendorId) {
      setVendorId(currentVendorId || agentVendorId);
      return;
    }

    // Sinon, on cherche le vendor_id via l'utilisateur connecte
    if (authUser?.id) {
      // ✨ MODE OFFLINE: Utiliser le cache si hors ligne
      if (!navigator.onLine) {
        const cachedVendorId = localStorage.getItem(`${VENDOR_ID_CACHE_KEY}_${authUser.id}`);
        if (cachedVendorId) {
          console.log('📦 [POS Offline] vendorId restauré depuis cache:', cachedVendorId);
          setVendorId(cachedVendorId);
          return;
        }
        console.warn('⚠️ [POS Offline] Pas de vendorId en cache - réseau requis');
        return;
      }

      supabase
        .from('vendors')
        .select('id')
        .eq('user_id', authUser.id)
        .maybeSingle()
        .then(({ data, _error }) => {
          if (data) {
            setVendorId(data.id);
            // ✨ Persister vendorId pour offline
            localStorage.setItem(`${VENDOR_ID_CACHE_KEY}_${authUser.id}`, data.id);
          } else {
            console.log('Pas de vendor trouvé, chargement de tous les produits du marketplace');
          }
        });
    }
  }, [authUser?.id, agentVendorId, currentVendorId, currentVendorLoading]);

  // Charger les produits du vendor depuis la base de données
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Charger les catégories depuis la base de données
  const [categories, setCategories] = useState<Array<{id: string, name: string}>>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Devise sélectionnée: si pos_settings a une devise explicite non-GNF → l'utiliser,
  // sinon utiliser la devise du wallet du vendeur.
  // Raison: usePOSSettings crée toujours un enregistrement avec 'GNF' par défaut,
  // donc settings?.currency est toujours truthy et le fallback || ne fonctionne pas.
  const selectedCurrency = (settings?.currency && settings.currency !== 'GNF')
    ? settings.currency
    : vendorCurrency;

  // Utilise lastUpdated depuis le contexte partagé (plus de useFxRates local)
  const ratesLastUpdated = ratesLastUpdatedFromCtx;

  // Formater le prix avec la devise — retourne '—' tant que auth+wallet+taux ne sont pas prêts.
  // Utilise convert() du contexte (taux déjà chargé, sans re-fetch) pour éliminer le clignotement.
  const formatPriceWithCurrency = (priceInGNF: number): string => {
    if (!currencyReady) return '—';
    const convertedPrice = vendorConvert(priceInGNF);
    const currencyInfo = getCurrencyByCode(selectedCurrency);
    if (!currencyInfo) return `${Math.round(convertedPrice).toLocaleString()} ${selectedCurrency}`;
    return formatCurrency(convertedPrice, selectedCurrency);
  };


  // Clé de cache pour les catégories
  const CATEGORIES_CACHE_KEY = 'pos_categories';
  const CATEGORIES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 heures

  const loadCategories = async () => {
    try {
      setCategoriesLoading(true);

      // ✨ MODE OFFLINE: Récupérer depuis le cache
      if (!navigator.onLine) {
        try {
          const { default: offlineDB } = await import('@/lib/offlineDB');
          const cachedCategories = await offlineDB.getCachedData<Array<{id: string, name: string}>>(CATEGORIES_CACHE_KEY);

          if (cachedCategories && cachedCategories.length > 0) {
            console.log('📦 [POS] Catégories depuis cache offline');
            setCategories(cachedCategories);
            return;
          }
        } catch (cacheError) {
          console.warn('Erreur lecture cache catégories:', cacheError);
        }
        setCategoriesLoading(false);
        return;
      }

      const { data: categoriesData, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      setCategories(categoriesData || []);

      // ✨ Sauvegarder dans le cache
      try {
        const { default: offlineDB } = await import('@/lib/offlineDB');
        await offlineDB.cacheData(CATEGORIES_CACHE_KEY, categoriesData || [], CATEGORIES_CACHE_TTL, false);
      } catch (cacheError) {
        console.warn('Erreur écriture cache catégories:', cacheError);
      }

    } catch (error) {
      console.error('Erreur chargement catégories:', error);

      // Fallback sur cache
      if (!navigator.onLine) {
        try {
          const { default: offlineDB } = await import('@/lib/offlineDB');
          const cached = await offlineDB.getCachedData<Array<{id: string, name: string}>>(CATEGORIES_CACHE_KEY);
          if (cached) setCategories(cached);
        } catch (_e) {}
      }
    } finally {
      setCategoriesLoading(false);
    }
  };

  // Trier les catégories: celles avec des produits en premier
  const sortedCategories = useMemo(() => {
    if (!categories.length || !products.length) return categories;

    // Compter les produits par catégorie
    const productCountByCategory = new Map<string, number>();
    products.forEach(product => {
      if (product.categoryId) {
        const count = productCountByCategory.get(product.categoryId) || 0;
        productCountByCategory.set(product.categoryId, count + 1);
      }
    });

    // Trier: catégories avec produits d'abord (par nombre décroissant), puis les autres
    return [...categories].sort((a, b) => {
      const countA = productCountByCategory.get(a.id) || 0;
      const countB = productCountByCategory.get(b.id) || 0;

      // Si les deux ont des produits ou les deux n'en ont pas, trier par nom
      if ((countA > 0 && countB > 0) || (countA === 0 && countB === 0)) {
        return a.name.localeCompare(b.name);
      }

      // Sinon, celle avec des produits vient en premier
      return countB - countA;
    });
  }, [categories, products]);

  useEffect(() => {
    loadCategories();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✨ Synchronisation automatique des ventes offline lors de la reconnexion
  useEffect(() => {
    const syncOfflineSales = async () => {
      if (!vendorId || !navigator.onLine) return;

      try {
        const { syncOfflinePosSales } = await import('@/lib/offlinePosSync');
        const result = await syncOfflinePosSales({
          vendorId,
          userId: user?.id ?? undefined
        });

        if (result.total === 0) return;

        console.log(`🔄 Synchronisation de ${result.total} vente(s) offline...`);
        toast.info(`Synchronisation de ${result.total} vente(s) en cours...`);

        // Rafraîchir les produits pour avoir les stocks à jour depuis la DB
        await loadVendorProducts();

        // Mettre à jour aussi le cache offline avec les stocks actuels
        try {
          setTimeout(async () => {
            try {
              const { default: offlineDBModule } = await import('@/lib/offlineDB');
              const { data: freshData } = await supabase
                .from('products')
                .select('id, name, price, stock_quantity, barcode, barcode_value, barcode_format, sku, images, category_id, section, categories(id, name), sell_by_carton, units_per_carton, price_carton')
                .eq('vendor_id', vendorId)
                .eq('is_active', true);

              if (freshData) {
                const formatted = freshData.map((p: any) => ({
                  id: p.id,
                  name: p.name ?? 'Produit',
                  price: Number(p.price || 0),
                  category: p.categories?.name || 'Divers',
                  categoryId: p.categories?.id || null,
                  section: p.section || undefined,
                  stock: Number(p.stock_quantity || 0),
                  barcode: p.barcode_value || p.barcode || p.sku || undefined,
                  images: p.images || [],
                  sell_by_carton: p.sell_by_carton || false,
                  units_per_carton: Number(p.units_per_carton || 1),
                  price_carton: Number(p.price_carton || 0)
                }));

                await offlineDBModule.cacheData(`${PRODUCTS_CACHE_KEY}_${vendorId}`, formatted, PRODUCTS_CACHE_TTL, false);
                console.log('✅ Cache offline mis à jour avec stocks corrigés');
              }
            } catch (e) {
              console.warn('Erreur mise à jour cache post-sync:', e);
            }
          }, 2000);
        } catch (e) {
          console.warn('Erreur post-sync cache wrapper:', e);
        }

        if (result.synced > 0) {
          toast.success(`${result.synced} vente(s) hors-ligne synchronisée(s) !`);
        }

        // Sync AUTOMATIQUE (montage / reconnexion) : on reste silencieux sur les échecs pour
        // ne pas répéter un message à chaque ouverture du POS. Les ventes non récupérables sont
        // abandonnées par syncOfflinePosSales ; l'indicateur réseau permet une relance manuelle.
        if (result.failed > 0) {
          console.warn(`[POS] ${result.failed} vente(s) restent en échec de synchronisation`);
        }
      } catch (error) {
        console.error('Erreur synchronisation offline:', error);
      }
    };

    // Sync au montage si online
    syncOfflineSales();

    // Sync quand on repasse online
    const handleOnline = () => {
      console.log('📡 Connexion rétablie - synchronisation...');
      syncOfflineSales();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, user?.id]);

  // Clé de cache pour les produits
  const PRODUCTS_CACHE_KEY = 'pos_products';
  const PRODUCTS_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 heures

  const loadVendorProducts = async () => {
    if (!vendorId) return;

    try {
      setProductsLoading(true);

      // ✨ MODE OFFLINE: Récupérer depuis le cache
      if (!navigator.onLine) {
        try {
          const { default: offlineDB } = await import('@/lib/offlineDB');
          const cachedProducts = await offlineDB.getCachedData<Product[]>(`${PRODUCTS_CACHE_KEY}_${vendorId}`);

          if (cachedProducts && cachedProducts.length > 0) {
            console.log('📦 [POS] Utilisation du cache offline:', cachedProducts.length, 'produits');
            setProducts(cachedProducts);
            toast.info(t('pOSSystem.modeHorsLigneProduitsCharges'), {
              description: `${cachedProducts.length} produit(s) disponible(s)`,
              duration: 3000
            });
            return;
          }
        } catch (cacheError) {
          console.warn('Erreur lecture cache produits:', cacheError);
        }

        // Pas de cache disponible
        toast.error(t('pOSSystem.modeHorsLigneAucunProduit'), {
          description: 'Visitez le POS une fois avec internet pour charger les produits.',
          duration: 5000
        });
        setProductsLoading(false);
        return;
      }

      // MODE ONLINE: Charger depuis Supabase
      const { data: productsData, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          stock_quantity,
          barcode,
          barcode_value,
          barcode_format,
          sku,
          images,
          category_id,
          section,
          categories(id, name),
          sell_by_carton,
          units_per_carton,
          price_carton
        `)
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const formattedProducts = (productsData || []).map((p: any) => ({
        id: p.id,
        name: p.name ?? 'Produit',
        price: Number(p.price || 0),
        category: p.categories?.name || 'Divers',
        categoryId: p.categories?.id || null,
        section: p.section || undefined,
        stock: Number(p.stock_quantity || 0),
        // Utiliser barcode_value (POS) en priorité, sinon barcode, sinon sku
        barcode: p.barcode_value || p.barcode || p.sku || undefined,
        images: p.images || [],
        // Champs carton
        sell_by_carton: p.sell_by_carton || false,
        units_per_carton: Number(p.units_per_carton || 1),
        price_carton: Number(p.price_carton || 0)
      }));

      // Trier les produits: ceux en stock d'abord, rupture de stock en bas
      const sortedProducts = formattedProducts.sort((a, b) => {
        if (a.stock === 0 && b.stock > 0) return 1;
        if (a.stock > 0 && b.stock === 0) return -1;
        return a.name.localeCompare(b.name);
      });

      setProducts(sortedProducts);

      // ✨ Sauvegarder dans le cache pour utilisation offline
      try {
        const { default: offlineDB } = await import('@/lib/offlineDB');
        await offlineDB.cacheData(
          `${PRODUCTS_CACHE_KEY}_${vendorId}`,
          sortedProducts,
          PRODUCTS_CACHE_TTL,
          false // Pas de cryptage pour les produits (données non sensibles)
        );
        console.log('💾 [POS] Cache produits mis à jour:', sortedProducts.length, 'produits');
      } catch (cacheError) {
        console.warn('Erreur écriture cache produits:', cacheError);
      }

    } catch (error) {
      console.error('Erreur chargement produits:', error);

      // ✨ En cas d'erreur, essayer le cache
      if (!navigator.onLine) {
        try {
          const { default: offlineDB } = await import('@/lib/offlineDB');
          const cachedProducts = await offlineDB.getCachedData<Product[]>(`${PRODUCTS_CACHE_KEY}_${vendorId}`);

          if (cachedProducts && cachedProducts.length > 0) {
            console.log('📦 [POS] Fallback sur cache après erreur');
            setProducts(cachedProducts);
            toast.info(t('pOSSystem.modeHorsLigneProduitsCharges'));
            return;
          }
        } catch (cacheError) {
          console.warn('Erreur fallback cache:', cacheError);
        }
      }

      toast.error(t('pOSSystem.erreurLorsDuChargementDes'));
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    if (vendorId) {
      loadVendorProducts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const [cart, setCart] = useState<CartItem[]>([]);

  // Synchroniser le panier avec les données produits mises à jour
  useEffect(() => {
    if (products.length === 0 || cart.length === 0) return;

    setCart(prevCart => prevCart.map(cartItem => {
      const updatedProduct = products.find(p => p.id === cartItem.id);
      if (!updatedProduct) return cartItem;

      // Mettre à jour les données du produit dans le panier
      const newPrice = cartItem.saleType === 'carton'
        ? (updatedProduct.price_carton || updatedProduct.price * (updatedProduct.units_per_carton || 1))
        : updatedProduct.price;

      // Recalculer le total
      let newTotal: number;
      if (cartItem.saleType === 'carton' && updatedProduct.units_per_carton) {
        const cartonCount = Math.floor(cartItem.quantity / (cartItem.units_per_carton || updatedProduct.units_per_carton));
        newTotal = cartonCount * newPrice;
      } else {
        newTotal = cartItem.quantity * newPrice;
      }

      return {
        ...cartItem,
        name: updatedProduct.name,
        price: newPrice,
        stock: updatedProduct.stock,
        sell_by_carton: updatedProduct.sell_by_carton,
        units_per_carton: updatedProduct.units_per_carton,
        price_carton: updatedProduct.price_carton,
        total: newTotal
      };
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'card'>('cash');
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState('');
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState<'orange' | 'mtn'>('orange');
  const [receivedAmount, setReceivedAmount] = useState<number>(0);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountMode, setDiscountMode] = useState<'percent' | 'amount'>('percent');
  const [numericInput, setNumericInput] = useState('');
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showMarketingContactField, setShowMarketingContactField] = useState(false);
  const [marketingContactInput, setMarketingContactInput] = useState('');
  const [showKeypad, setShowKeypad] = useState(false);
  const [showQuantityKeypad, setShowQuantityKeypad] = useState(false);
  const [selectedProductForQuantity, setSelectedProductForQuantity] = useState<Product | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [keypadMode, setKeypadMode] = useState<'quantity' | 'amount'>('quantity');
  const [selectedCartItemForQuantity, setSelectedCartItemForQuantity] = useState<CartItem | null>(null);

  // État pour la vente à crédit
  const [showCreditSaleModal, setShowCreditSaleModal] = useState(false);
  const [creditCustomerName, setCreditCustomerName] = useState('');
  const [creditCustomerPhone, setCreditCustomerPhone] = useState('');
  const [creditDueDate, setCreditDueDate] = useState('');
  const [creditNotes, setCreditNotes] = useState('');
  const [isProcessingCredit, setIsProcessingCredit] = useState(false);

  // État pour le modal de paiement Stripe
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [pendingStripeOrder, setPendingStripeOrder] = useState<{id: string, order_number: string} | null>(null);
  const skipStripeCancelOnCloseRef = useRef(false);

  // États pour personnalisation - Récupérer le nom de l'entreprise depuis le profil vendor
  const { profile: vendorProfile } = useVendorOptimized();
  const companyName = vendorProfile?.business_name || 'Point de Vente';
  const [currentTime, setCurrentTime] = useState(new Date());

  // Historique des 3 derniers produits sélectionnés
  const [recentlySelected, setRecentlySelected] = useState<string[]>([]);

  // ✨ PERSISTANCE: Restaurer l'état au montage et sauvegarder automatiquement
  const handleRestorePOSState = useCallback((savedState: POSPersistedState) => {
    // Vérifier que c'est le bon vendor
    if (savedState.vendorId && savedState.vendorId !== vendorId) {
      clearPOSState();
      return;
    }

    if (savedState.cart.length > 0) {
      setCart(savedState.cart as CartItem[]);
      toast.success(`🔄 Panier restauré (${savedState.cart.length} article${savedState.cart.length > 1 ? 's' : ''})`, {
        description: 'Votre session précédente a été récupérée.',
        duration: 3000
      });
    }
    if (savedState.selectedCustomer) setSelectedCustomer(savedState.selectedCustomer as Customer);
    if (savedState.paymentMethod) setPaymentMethod(savedState.paymentMethod);
    if (savedState.mobileMoneyPhone) setMobileMoneyPhone(savedState.mobileMoneyPhone);
    if (savedState.mobileMoneyProvider) setMobileMoneyProvider(savedState.mobileMoneyProvider);
    if (savedState.receivedAmount) setReceivedAmount(savedState.receivedAmount);
    if (savedState.discountPercent) setDiscountPercent(savedState.discountPercent);
    if (savedState.discountAmount) setDiscountAmount(savedState.discountAmount);
    if (savedState.discountMode) setDiscountMode(savedState.discountMode);
    if (savedState.recentlySelected) setRecentlySelected(savedState.recentlySelected);
  }, [vendorId]);

  // Hook de persistance automatique
  const { _saveImmediately } = usePOSPersistence(
    {
      cart,
      selectedCustomer,
      paymentMethod,
      mobileMoneyPhone,
      mobileMoneyProvider,
      receivedAmount,
      discountPercent,
      discountAmount,
      discountMode,
      recentlySelected,
      vendorId,
    },
    {
      enabled: !!vendorId,
      onRestore: handleRestorePOSState,
    }
  );

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.barcode?.includes(searchTerm);
    const matchesCategory = selectedCategory === 'all' || product.categoryId === selectedCategory;
    const matchesSection = selectedSection === 'all' || product.section === selectedSection;
    return matchesSearch && matchesCategory && matchesSection;
  });

  // Sections uniques disponibles (filtrées par catégorie si sélectionnée)
  const availableSections = useMemo(() => {
    const productsInCategory = selectedCategory === 'all'
      ? products
      : products.filter(p => p.categoryId === selectedCategory);

    const sections = [...new Set(productsInCategory
      .map(p => p.section)
      .filter((s): s is string => !!s && s.trim() !== '')
    )];

    return sections.sort((a, b) => a.localeCompare(b));
  }, [products, selectedCategory]);

  // Réinitialiser la section quand la catégorie change
  useEffect(() => {
    setSelectedSection('all');
  }, [selectedCategory]);

  // Trier les produits: les 3 derniers sélectionnés en premier
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const aIndex = recentlySelected.indexOf(a.id);
    const bIndex = recentlySelected.indexOf(b.id);

    // Si les deux sont dans les récents, trier par ordre de sélection (plus récent d'abord)
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    // Si seulement a est récent, le mettre en premier
    if (aIndex !== -1) return -1;
    // Si seulement b est récent, le mettre en premier
    if (bIndex !== -1) return 1;
    // Sinon garder l'ordre original
    return 0;
  });

  // Calculs automatiques avec TVA dynamique
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const taxRate = settings?.tax_rate || 0.18;
  const taxEnabled = settings?.tax_enabled ?? true;
  const tax = taxEnabled ? subtotal * taxRate : 0;
  const totalBeforeDiscount = subtotal + tax;

  // Calcul de la remise selon le mode sélectionné
  const discountValue = discountMode === 'percent'
    ? (totalBeforeDiscount * discountPercent) / 100
    : discountAmount;
  const total = Math.max(0, totalBeforeDiscount - discountValue);
  const change = receivedAmount - total;
  const hasDiscount = discountValue > 0;
  const discountLabel = discountMode === 'percent' && discountPercent > 0
    ? `Remise (${discountPercent}%)`
    : 'Remise';

  // Fonction d'ajout au panier avec calcul automatique (unités)
  const addToCart = (productOrCartItem: Product | CartItem, quantity: number = 1) => {
    // Récupérer le produit original pour avoir le prix unitaire correct
    const originalProduct = products.find(p => p.id === productOrCartItem.id);
    const product = originalProduct || productOrCartItem;
    const unitPrice = originalProduct?.price || productOrCartItem.price;

    if (product.stock <= 0) {
      toast.error(t('pOSSystem.produitEnRuptureDeStock'));
      return;
    }

    // Mettre à jour les produits récemment sélectionnés (max 3)
    setRecentlySelected(prev => {
      const filtered = prev.filter(id => id !== product.id);
      return [product.id, ...filtered].slice(0, 3);
    });

    setCart(prev => {
      const totalUnitsInCart = prev
        .filter(i => i.id === product.id)
        .reduce((sum, i) => sum + (i.quantity || 0), 0);

      if (totalUnitsInCart + quantity > product.stock) {
        toast.error('Stock insuffisant');
        return prev;
      }

      const existingItem = prev.find(item => item.id === product.id && item.saleType !== 'carton');
      if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        // Utiliser le prix unitaire original pour le calcul
        const originalUnitPrice = originalProduct?.price || existingItem.price;
        return prev.map(item =>
          item.id === product.id && item.saleType !== 'carton'
            ? { ...item, quantity: newQuantity, total: newQuantity * originalUnitPrice }
            : item
        );
      }

      return [...prev, { ...product, quantity, total: unitPrice * quantity, saleType: 'unit' as const, price: unitPrice }];
    });

    toast.success(`${product.name} ajouté au panier`);
  };

  // Fonction d'ajout au panier par carton
  const addToCartByCarton = (productOrCartItem: Product | CartItem, cartonCount: number = 1) => {
    // Récupérer le produit original depuis la liste des produits pour avoir les prix corrects
    const originalProduct = products.find(p => p.id === productOrCartItem.id);
    const product = originalProduct || productOrCartItem;

    if (!product.sell_by_carton || !product.units_per_carton || product.units_per_carton <= 1) {
      toast.error(t('pOSSystem.ceProduitNePeutPas'));
      return;
    }

    const unitsNeeded = cartonCount * product.units_per_carton;

    // Mettre à jour les produits récemment sélectionnés (max 3)
    setRecentlySelected(prev => {
      const filtered = prev.filter(id => id !== product.id);
      return [product.id, ...filtered].slice(0, 3);
    });

    // IMPORTANT: Utiliser le prix du produit ORIGINAL, pas celui du CartItem
    // car le CartItem.price peut être le prix carton déjà calculé
    const originalUnitPrice = originalProduct?.price || product.price;
    const originalPriceCarton = originalProduct?.price_carton || product.price_carton;

    const pricePerCarton = (originalPriceCarton && originalPriceCarton > 0)
      ? originalPriceCarton
      : (originalUnitPrice * product.units_per_carton);

    setCart(prev => {
      const unitUnits = prev
        .filter(i => i.id === product.id && i.saleType !== 'carton')
        .reduce((sum, i) => sum + (i.quantity || 0), 0);

      const existingCartonItem = prev.find(item => item.id === product.id && item.saleType === 'carton');

      if (existingCartonItem) {
        const existingCartons = existingCartonItem.quantity / product.units_per_carton;
        const newCartonCount = existingCartons + cartonCount;
        const newUnitsQuantity = newCartonCount * product.units_per_carton;

        if (unitUnits + newUnitsQuantity > product.stock) {
          toast.error('Stock insuffisant');
          return prev;
        }

        return prev.map(item =>
          item.id === product.id && item.saleType === 'carton'
            ? {
                ...item,
                quantity: newUnitsQuantity,
                total: newCartonCount * pricePerCarton,
                displayQuantity: `${newCartonCount} carton(s) (${newUnitsQuantity} unités)`,
              }
            : item
        );
      }

      if (unitUnits + unitsNeeded > product.stock) {
        toast.error(`Stock insuffisant pour ${cartonCount} carton(s).`);
        return prev;
      }

      return [
        ...prev,
        {
          ...product,
          quantity: unitsNeeded,
          total: cartonCount * pricePerCarton,
          saleType: 'carton' as const,
          price: pricePerCarton, // Prix affiché = prix carton
          displayQuantity: `${cartonCount} carton(s) (${unitsNeeded} unités)`,
        },
      ];
    });

    toast.success(`📦 ${cartonCount} carton(s) de ${product.name} ajouté(s)`);
  };

  // Mise à jour de quantité avec recalcul automatique
  const updateQuantity = (productId: string, newQuantity: number, _saleType?: 'unit' | 'carton') => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find(p => p.id === productId);

    // Empêcher de dépasser le stock en tenant compte des autres lignes (unité/carton)
    const otherUnitsInCart = cart
      .filter(i => i.id === productId && i !== selectedCartItemForQuantity)
      .reduce((sum, i) => sum + (i.quantity || 0), 0);

    if (product && otherUnitsInCart + newQuantity > product.stock) {
      toast.error('Stock insuffisant');
      return;
    }

    setCart(prev =>
      prev.map(item => {
        if (item.id !== productId) return item;

        // Pour les ventes carton, calculer le total correctement avec le prix du produit ORIGINAL
        if (item.saleType === 'carton' && product?.units_per_carton) {
          const cartonCount = Math.floor(newQuantity / product.units_per_carton);
          // Utiliser les prix du produit original, pas du cartItem
          const pricePerCarton = (product.price_carton && product.price_carton > 0)
            ? product.price_carton
            : (product.price * product.units_per_carton);
          return {
            ...item,
            quantity: newQuantity,
            total: cartonCount * pricePerCarton,
            displayQuantity: `${cartonCount} carton(s) (${newQuantity} unités)`
          };
        }

        // Vente unitaire standard - utiliser le prix du produit original
        const unitPrice = product?.price || item.price;
        return { ...item, quantity: newQuantity, total: newQuantity * unitPrice };
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
    toast.info(t('pOSSystem.articleRetireDuPanier'));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setReceivedAmount(0);
    setDiscountPercent(0);
    setDiscountAmount(0);
    setDiscountMode('percent');
    setShowMarketingContactField(false);
    setMarketingContactInput('');
    // Effacer aussi les données persistées
    clearPOSState();
    toast.info(t('pOSSystem.panierVide'));
  };

  const getNormalizedMarketingContact = () => {
    const raw = marketingContactInput.trim();
    if (!raw) return null;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(raw.toLowerCase())) {
      return {
        kind: 'email' as const,
        value: raw.toLowerCase(),
      };
    }

    const digitsOnly = raw.replace(/\D/g, '');
    if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
      return {
        kind: 'phone' as const,
        value: raw.startsWith('+') ? `+${digitsOnly}` : digitsOnly,
      };
    }

    return null;
  };

  const collectMarketingContactAfterSale = async () => {
    const normalizedContact = getNormalizedMarketingContact();
    if (!normalizedContact || !vendorId || !navigator.onLine) return;

    const response = await collectPosMarketingContact({
      contact: normalizedContact.value,
      customer_name: selectedCustomer?.name || 'Client POS',
      order_total: total,
      sold_at: new Date().toISOString(),
    }, vendorId);

    if (!response.success) {
      toast.warning(t('pOSSystem.venteEnregistreeMaisLeContact'), {
        description: response.error || 'Vous pourrez le ressaisir plus tard.',
      });
      return;
    }

    toast.success(
      normalizedContact.kind === 'email'
        ? 'Email ajouté aux contacts campagnes'
        : 'Numéro ajouté aux contacts campagnes'
    );
  };

  // Fonctions du pavé numérique - maintenant pour quantité
  const handleNumericInput = (input: string) => {
    if (input === 'clear') {
      setNumericInput('');
      if (keypadMode === 'amount') {
        setReceivedAmount(0);
      }
      return;
    }

    if (input === 'enter') {
      if (numericInput) {
        if (keypadMode === 'amount') {
          setReceivedAmount(parseFloat(numericInput));
          toast.success(`Montant saisi: ${formatPriceWithCurrency(Number(numericInput))}${selectedCurrency !== 'GNF' ? ` (${Number(numericInput).toLocaleString()} GNF)` : ''}`);
        } else if (keypadMode === 'quantity' && selectedCartItemForQuantity) {
          const qty = parseInt(numericInput, 10);
          if (qty > 0) {
            const product = products.find(p => p.id === selectedCartItemForQuantity.id);
            if (product && qty <= product.stock) {
              updateQuantity(selectedCartItemForQuantity.id, qty);
              toast.success(`Quantité mise à jour: ${qty}`);
            } else {
              toast.error('Stock insuffisant');
            }
          }
          setSelectedCartItemForQuantity(null);
        }
        setNumericInput('');
        setShowKeypad(false);
      }
      return;
    }

    // Empêcher les décimales pour les quantités
    if (keypadMode === 'quantity' && input === '.') return;

    setNumericInput(prev => prev + input);
  };

  // Ouvrir le pavé numérique pour modifier la quantité d'un article du panier
  const _openQuantityKeypadForCartItem = (item: CartItem) => {
    setSelectedCartItemForQuantity(item);
    setKeypadMode('quantity');
    setNumericInput(item.quantity.toString());
    setShowKeypad(true);
  };

  // Ouvrir le pavé numérique pour le montant reçu
  const _openAmountKeypad = () => {
    setKeypadMode('amount');
    setSelectedCartItemForQuantity(null);
    setNumericInput('');
    setShowKeypad(true);
  };

  // Validation de la commande
  const validateOrder = () => {
    if (cart.length === 0) {
      toast.error('Panier vide');
      return;
    }
    setShowOrderSummary(true);
  };

  // Ouvrir le modal de vente à crédit
  const openCreditSaleModal = () => {
    if (cart.length === 0) {
      toast.error('Panier vide');
      return;
    }
    setShowCreditSaleModal(true);
  };

  // Traiter la vente à crédit
  const processCreditSale = async () => {
    if (!creditCustomerName.trim()) {
      toast.error(t('pOSSystem.veuillezEntrerLeNomDu'));
      return;
    }
    if (!creditDueDate) {
      toast.error(t('pOSSystem.veuillezSelectionnerUneDateD'));
      return;
    }
    if (!vendorId) {
      toast.error(t('pOSSystem.vendeurNonIdentifie'));
      return;
    }

    setIsProcessingCredit(true);

    // ✨ MODE OFFLINE: Stocker la vente à crédit localement
    const isOffline = !navigator.onLine;

    if (isOffline) {
      try {
        const offlineOrderId = `offline_credit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const offlineOrderNumber = `CR-OFF-${Date.now().toString(36).toUpperCase()}`;

        const creditSaleData = {
          type: 'credit_sale',
          vendor_id: vendorId,
          created_at: new Date().toISOString(),
          data: {
            offline_order_id: offlineOrderId,
            order_number: offlineOrderNumber,
            total_amount: total,
            subtotal: subtotal,
            tax_amount: tax,
            discount_amount: discountValue,
            payment_method: 'cash',
            payment_status: 'pending',
            status: 'confirmed',
            source: 'pos_offline_credit',
            customer_name: creditCustomerName.trim(),
            customer_phone: creditCustomerPhone.trim() || '',
            due_date: creditDueDate,
            credit_notes: creditNotes || '',
            items: cart.map(item => ({
              product_id: item.id,
              product_name: item.name,
              quantity: item.quantity,
              unit_price: item.quantity > 0 ? item.total / item.quantity : item.price,
              total_price: item.total,
              images: item.images || []
            })),
            sale_date: new Date().toISOString()
          }
        };

        const { default: offlineDB } = await import('@/lib/offlineDB');
        await offlineDB.initDB();
        const eventId = await offlineDB.storeEvent(creditSaleData, true);

        console.log('✅ [POS Offline] Vente à crédit stockée:', eventId);

        // Mettre à jour le stock localement
        const updatedProducts = products.map(product => {
          const cartItem = cart.find(item => item.id === product.id);
          if (cartItem) {
            return { ...product, stock: Math.max(0, product.stock - cartItem.quantity) };
          }
          return product;
        });
        setProducts(updatedProducts);

        // Mettre à jour le cache
        try {
          await offlineDB.cacheData(
            `${PRODUCTS_CACHE_KEY}_${vendorId}`,
            updatedProducts,
            PRODUCTS_CACHE_TTL,
            false
          );
        } catch (cachErr) {
          console.warn('Erreur mise à jour cache:', cachErr);
        }

        // Réinitialiser
        setLastOrderNumber(offlineOrderNumber);
        setShowCreditSaleModal(false);
        setCreditCustomerName('');
        setCreditCustomerPhone('');
        setCreditDueDate('');
        setCreditNotes('');
        setCart([]);

        toast.success(t('pOSSystem.venteACreditEnregistreeHors'), {
          description: `Client: ${creditSaleData.data.customer_name} - ${formatPriceWithCurrency(total)}${selectedCurrency !== 'GNF' ? ` (${total.toLocaleString()} GNF)` : ''} - Sera synchronisée à la reconnexion.`,
          duration: 5000
        });

        setIsProcessingCredit(false);
        return;
      } catch (offlineError: any) {
        console.error('Erreur stockage offline crédit:', offlineError);
        toast.error('Erreur enregistrement hors-ligne', {
          description: offlineError.message || 'Veuillez réessayer.',
          duration: 6000
        });
        setIsProcessingCredit(false);
        return;
      }
    }

    // MODE ONLINE: logique existante
    try {
      const orderNum = `CR-${Date.now().toString(36).toUpperCase()}`;

      // 1. Créer un client temporaire ou récupérer l'ID existant
      const customerId = await getOrCreateCustomerId();
      if (!customerId) {
        toast.error(t('pOSSystem.erreurLorsDeLaCreation'));
        setIsProcessingCredit(false);
        return;
      }

      // 2. Création ATOMIQUE via backend : orders + order_items + stock + taxe
      //    server-side + enregistrement vendor_credit_sales, le tout en 1 transaction.
      const orderResponse = await createPosOrder({
        order_number: orderNum,
        customer_id: customerId,
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.quantity > 0 ? item.total / item.quantity : item.price,
          discount: 0,
        })),
        payment_method: 'credit',
        payment_status: 'pending',
        status: 'confirmed',
        discount_total: discountValue,
        notes: `🔖 VENTE À CRÉDIT - Client: ${creditCustomerName.trim()}${creditCustomerPhone ? ` - Tél: ${creditCustomerPhone}` : ''}`,
        shipping_address: { address: 'Vente à crédit', is_credit_sale: true },
        credit_customer_name: creditCustomerName.trim(),
        credit_customer_phone: creditCustomerPhone.trim() || null,
        credit_due_date: creditDueDate ? new Date(creditDueDate).toISOString() : null,
        credit_notes: creditNotes || `Produits: ${cart.map(i => `${i.name} x${i.quantity}`).join(', ')}`,
        credit_items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          images: item.images || [],
        })),
      }, vendorId);

      if (!orderResponse.success || !orderResponse.data?.order_id) {
        throw new Error(orderResponse.error || 'Impossible de créer la commande à crédit');
      }

      toast.success(t('pOSSystem.venteACreditEnregistree'), {
        description: `${creditCustomerName} - ${formatPriceWithCurrency(total)}${selectedCurrency !== 'GNF' ? ` (${total.toLocaleString()} GNF)` : ''} - Stock mis à jour`,
      });

      // Fermer le modal et réinitialiser
      setShowCreditSaleModal(false);
      setCreditCustomerName('');
      setCreditCustomerPhone('');
      setCreditDueDate('');
      setCreditNotes('');
      setCart([]);

      // Recharger les produits pour afficher le stock mis à jour
      await loadVendorProducts();

    } catch (error: any) {
      console.error('Erreur vente à crédit:', error);
      toast.error(t('pOSSystem.erreurLorsDeLEnregistrement'), {
        description: error.message,
      });
    } finally {
      setIsProcessingCredit(false);
    }
  };

  // Mettre à jour le statut de commande POS avec fallback si l'enum n'est pas à jour
  const updatePosOrderStatus = async (
    orderId: string,
    updates: Record<string, any>
  ): Promise<{ error: any | null }> => {
    const primaryUpdate = await supabase
      .from('orders')
      .update({ ...updates, status: 'completed' })
      .eq('id', orderId);

    if (!primaryUpdate.error) {
      return { error: null };
    }

    const errorMessage = primaryUpdate.error?.message || '';
    const isEnumError =
      errorMessage.includes('order_status') ||
      errorMessage.includes('invalid input value for enum');

    if (isEnumError) {
      const fallbackUpdate = await supabase
        .from('orders')
        .update({ ...updates, status: 'confirmed' })
        .eq('id', orderId);
      return { error: fallbackUpdate.error || null };
    }

    return { error: primaryUpdate.error };
  };

  const createCashOrderFallbackDirect = async () => {
    const customerId = await getOrCreateCustomerId();
    if (!customerId) {
      throw new Error('Impossible de créer le client pour la vente POS');
    }

    const fallbackOrderNumber = `POS-CASH-${Date.now().toString(36).toUpperCase()}`;
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: fallbackOrderNumber,
        vendor_id: vendorId,
        customer_id: customerId,
        total_amount: total,
        subtotal: subtotal,
        tax_amount: tax,
        discount_amount: discountValue,
        payment_status: 'paid',
        status: 'confirmed',
        payment_method: 'cash',
        shipping_address: { address: 'Point de vente' },
        notes: 'Fallback POS cash (backend indisponible)',
        source: 'pos',
      })
      .select('id, order_number')
      .single();

    if (orderError || !order) {
      throw orderError || new Error('Impossible de créer la commande POS fallback');
    }

    const orderItems = cart.map(item => ({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.quantity > 0 ? item.total / item.quantity : item.price,
      total_price: item.total,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) {
      throw itemsError;
    }

    return order;
  };

  const processPayment = async () => {
    // Note: Le montant reçu n'est plus obligatoire pour valider

    if (marketingContactInput.trim() && !getNormalizedMarketingContact()) {
      toast.error(t('pOSSystem.leContactClientDoitEtre'));
      return;
    }

    if (isProcessingPayment) return;
    setIsProcessingPayment(true);

    if (!vendorId) {
      toast.error(t('pOSSystem.vendeurNonIdentifie'));
      setIsProcessingPayment(false);
      return;
    }

    if (!user?.id) {
      toast.error(t('pOSSystem.utilisateurNonConnecte'));
      setIsProcessingPayment(false);
      return;
    }

    // ✨ NOUVEAU: Vérification mode offline
    const isOffline = !navigator.onLine;

    // En mode offline, seuls les paiements en espèces sont autorisés
    if (isOffline && paymentMethod !== 'cash') {
      toast.error(t('pOSSystem.modeHorsLigneSeulsLes'), {
        description: 'Mobile Money et carte bancaire nécessitent une connexion internet.',
        duration: 5000
      });
      setIsProcessingPayment(false);
      return;
    }

    // Validation Mobile Money (seulement si online)
    if (paymentMethod === 'mobile_money') {
      if (!mobileMoneyPhone || mobileMoneyPhone.length !== 9) {
        toast.error(t('pOSSystem.veuillezEntrerUnNumeroDe'));
        setIsProcessingPayment(false);
        return;
      }

      // Validation provider pour Mobile Money
      const starts = mobileMoneyPhone;
      if (mobileMoneyProvider === 'orange') {
        const ok = starts.startsWith('610') || starts.startsWith('611') || starts.startsWith('62');
        if (!ok) {
          toast.error(t('pOSSystem.numeroNonCompatibleOrangeMoney'), {
            description: 'Orange Money (GN) commence généralement par 610, 611 ou 62.',
          });
          setIsProcessingPayment(false);
          return;
        }
      }
      if (mobileMoneyProvider === 'mtn') {
        if (!starts.startsWith('66')) {
          toast.error(t('pOSSystem.numeroNonCompatibleMtnMomo'), {
            description: 'MTN MoMo (GN) commence généralement par 66.',
          });
          setIsProcessingPayment(false);
          return;
        }
      }
    }

    try {
      // Pour Mobile Money, utiliser ChapChapPay E-Commerce (redirection vers page de paiement)
      if (paymentMethod === 'mobile_money') {
        toast.loading(t('pOSSystem.initialisationDuPaiementChapchappay'));

        // Mapper le provider vers le format ChapChapPay
        const chapchapPaymentMethod: ChapChapPayMethod = mobileMoneyProvider === 'orange' ? 'orange_money' : 'mtn_momo';

        // Formater le numéro de téléphone pour ChapChapPay (format 224XXXXXXXXX)
        const formattedPhone = `224${mobileMoneyPhone}`;

        // Créer la commande d'abord pour avoir l'orderId
        const customerId = await getOrCreateCustomerId();
        if (!customerId) {
          toast.dismiss();
          setIsProcessingPayment(false);
          return;
        }

        // Générer un numéro de commande unique
        const mobileOrderNumber = `POS-MM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        // Création ATOMIQUE via backend (orders + order_items + stock + taxe server-side)
        const orderResponse = await createPosOrder({
          order_number: mobileOrderNumber,
          customer_id: customerId,
          items: cart.map(item => ({
            product_id: item.id,
            quantity: item.quantity,
            unit_price: vendorConvert(item.quantity > 0 ? item.total / item.quantity : item.price),
            discount: 0,
          })),
          payment_method: 'mobile_money',
          payment_status: 'pending',
          status: 'processing',
          discount_total: vendorConvert(discountValue),
          notes: `Paiement Mobile Money (${mobileMoneyProvider === 'orange' ? 'Orange Money' : 'MTN MoMo'}) - ${mobileMoneyPhone}`,
          currency: selectedCurrency,
        }, vendorId);

        if (!orderResponse.success || !orderResponse.data?.order_id) {
          toast.dismiss();
          throw new Error(orderResponse.error || 'Impossible de créer la commande POS');
        }

        const order = {
          id: orderResponse.data.order_id,
          order_number: orderResponse.data.order_number || mobileOrderNumber,
        };

        // Initialiser le paiement ChapChapPay sécurisé
        const chapchapResult = await initiatePullPayment({
          amount: total,
          customerPhone: formattedPhone,
          paymentMethod: chapchapPaymentMethod,
          orderId: order.order_number || order.id,
          description: `Vente POS - ${cart.length} article(s)`,
          notifyUrl: `${window.location.origin}/api/chapchappay-webhook`,
        });

        toast.dismiss();

        if (!chapchapResult.success) {
          console.error('[POS] ChapChapPay payment error:', chapchapResult.error);
          toast.error(t('pOSSystem.erreurLorsDeLInitialisation'), {
            description: chapchapResult.error || 'Veuillez réessayer',
          });
          // Annuler la commande si le paiement échoue
          await supabase.from('orders').update({ status: 'cancelled', payment_status: 'failed' }).eq('id', order.id);
          return;
        }

        // Mettre à jour la commande avec l'ID de transaction ChapChapPay
        await supabase.from('orders')
          .update({
            notes: `Paiement ChapChapPay (${mobileMoneyProvider === 'orange' ? 'Orange Money' : 'MTN MoMo'}) - ${mobileMoneyPhone} - Transaction: ${chapchapResult.transactionId}`
          })
          .eq('id', order.id);

        // Notification: demande de paiement envoyée
        toast.info(t('pOSSystem.demandeDePaiementEnvoyee'), {
          description: `Confirmez le paiement sur votre téléphone ${mobileMoneyProvider === 'orange' ? 'Orange Money' : 'MTN MoMo'}.`
        });

        // Polling pour vérifier le statut du paiement
        if (chapchapResult.transactionId) {
          toast.loading(t('pOSSystem.enAttenteDeConfirmation'), { id: 'payment-polling' });

          const finalStatus = await pollStatus(chapchapResult.transactionId, (status) => {
            console.log('[POS] Payment status:', status);
          });

          toast.dismiss('payment-polling');

          if (finalStatus?.status === 'completed' || finalStatus?.status === 'success') {
            toast.success(t('pOSSystem.paiementConfirme'));

            // Mettre à jour la commande - POS orders are completed immediately (no delivery needed)
            const { error: updateError } = await updatePosOrderStatus(order.id, {
              payment_status: 'paid'
            });
            if (updateError) throw updateError;

            await collectMarketingContactAfterSale();

            setLastOrderNumber(order.order_number || order.id.substring(0, 8).toUpperCase());
            setShowOrderSummary(false);
            setShowReceipt(true);
            await loadVendorProducts();
          } else if (finalStatus?.status === 'failed' || finalStatus?.status === 'cancelled' || finalStatus?.status === 'expired') {
            toast.error(t('pOSSystem.paiementEchoueAnnuleOuExpire'));

            // Marquer la commande comme échouée
            await supabase.from('orders')
              .update({ payment_status: 'failed' })
              .eq('id', order.id);
          } else {
            // Paiement en attente
            toast.warning(t('pOSSystem.paiementEnAttente'), {
              description: 'Le statut du paiement sera mis à jour via webhook.'
            });
          }
        }

        setLastOrderNumber(order.order_number || order.id.substring(0, 8).toUpperCase());
        setShowOrderSummary(false);
        setCart([]);
        return;
      }

      // Paiement par carte bancaire (Stripe) - Ouvrir le modal
      if (paymentMethod === 'card') {
        try {
          const customerId = await getOrCreateCustomerId();
          if (!customerId) {
            setIsProcessingPayment(false);
            return;
          }

          // Générer un numéro de commande unique
          const cardOrderNumber = `POS-CB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

          // Création ATOMIQUE via backend (orders + order_items + stock + taxe server-side)
          const orderResponse = await createPosOrder({
            order_number: cardOrderNumber,
            customer_id: customerId,
            items: cart.map(item => ({
              product_id: item.id,
              quantity: item.quantity,
              unit_price: vendorConvert(item.quantity > 0 ? item.total / item.quantity : item.price),
              discount: 0,
            })),
            payment_method: 'card',
            payment_status: 'pending',
            status: 'processing',
            discount_total: vendorConvert(discountValue),
            notes: 'Paiement par carte bancaire - En attente',
            currency: selectedCurrency,
          }, vendorId);

          if (!orderResponse.success || !orderResponse.data?.order_id) {
            throw new Error(orderResponse.error || 'Impossible de créer la commande POS');
          }

          const order = {
            id: orderResponse.data.order_id,
            order_number: orderResponse.data.order_number || cardOrderNumber,
          };

          // Sauvegarder la commande et ouvrir le modal Stripe
          skipStripeCancelOnCloseRef.current = false;
          setPendingStripeOrder({ id: order.id, order_number: order.order_number || order.id.substring(0, 8).toUpperCase() });
          setShowStripeModal(true);
          setShowOrderSummary(false);
          return;

        } catch (cardError: any) {
          console.error('Card payment error:', cardError);
          toast.error(t('pOSSystem.erreurPaiementCarte'), {
            description: cardError.message || 'Veuillez réessayer'
          });
          return;
        }
      }

      // Pour les paiements en espèces, procéder normalement OU en mode offline
      const isOfflinePayment = !navigator.onLine;

      // ✨ MODE OFFLINE: Stocker localement pour synchronisation ultérieure
      if (isOfflinePayment) {
        try {
          // Générer un ID local unique pour la commande
          const offlineOrderId = `offline_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          const offlineOrderNumber = `POS-OFF-${Date.now().toString(36).toUpperCase()}`;

          // Préparer les données de la vente
          const saleData = {
            type: 'sale',
            vendor_id: vendorId,
            created_at: new Date().toISOString(), // ✅ Requis par offlineDB
            data: {
              offline_order_id: offlineOrderId,
              order_number: offlineOrderNumber,
              total_amount: total,
              subtotal: subtotal,
              tax_amount: tax,
              discount_amount: discountValue,
              payment_method: 'cash',
              payment_status: 'paid',
              status: 'confirmed',
              source: 'pos_offline',
              items: cart.map(item => ({
                product_id: item.id,
                product_name: item.name,
                quantity: item.quantity,
                unit_price: item.quantity > 0 ? item.total / item.quantity : item.price,
                total_price: item.total
              })),
              sale_date: new Date().toISOString(),
              customer_name: selectedCustomer?.name || 'Client comptoir',
              customer_phone: selectedCustomer?.phone || '',
              marketing_contact: getNormalizedMarketingContact()?.value || ''
            }
          };

          // Stocker dans IndexedDB via offlineDB
          const { default: offlineDB } = await import('@/lib/offlineDB');
          await offlineDB.initDB();
          const eventId = await offlineDB.storeEvent(saleData, true);

          console.log('✅ [POS Offline] Vente stockée:', eventId);

          // Mettre à jour le stock localement (décrémenter)
          const updatedProducts = products.map(product => {
            const cartItem = cart.find(item => item.id === product.id);
            if (cartItem) {
              return { ...product, stock: Math.max(0, product.stock - cartItem.quantity) };
            }
            return product;
          });
          setProducts(updatedProducts);

          // Mettre à jour le cache avec les nouveaux stocks
          try {
            await offlineDB.cacheData(
              `${PRODUCTS_CACHE_KEY}_${vendorId}`,
              updatedProducts,
              PRODUCTS_CACHE_TTL,
              false
            );
          } catch (cachErr) {
            console.warn('Erreur mise à jour cache:', cachErr);
          }

          setLastOrderNumber(offlineOrderNumber);
          setShowOrderSummary(false);
          setShowReceipt(true);

          toast.success(t('pOSSystem.venteEnregistreeModeHorsLigne'), {
            description: `N° ${offlineOrderNumber} - Sera synchronisée à la reconnexion.`,
            duration: 5000
          });

          setIsProcessingPayment(false);
          return;

        } catch (offlineError: any) {
          console.error('Erreur stockage offline:', offlineError);

          // Diagnostic plus précis de l'erreur
          let errorMessage = 'Veuillez réessayer.';
          if (offlineError.message?.includes('QuotaExceeded')) {
            errorMessage = 'Stockage plein. Supprimez des données ou reconnectez-vous pour synchroniser.';
          } else if (offlineError.name === 'InvalidStateError') {
            errorMessage = 'Base de données offline non disponible. Essayez de recharger la page.';
          } else if (offlineError.message) {
            errorMessage = offlineError.message;
          }

          toast.error('Erreur enregistrement hors-ligne', {
            description: errorMessage,
            duration: 6000
          });
          setIsProcessingPayment(false);
          return;
        }
      }

      // Mode ONLINE: passer par le backend POS atomique
      console.log('🔄 [POS] Création de vente via backend atomique...');

      const localSaleId = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const syncResponse = await syncPosSales([
        {
          local_sale_id: localSaleId,
          items: cart.map(item => ({
            product_id: item.id,
            product_name: item.name,
            quantity: item.quantity,
            unit_price: item.quantity > 0 ? item.total / item.quantity : item.price,
            discount: 0,
          })),
          payment_method: 'cash',
          total_amount: total,
          discount_total: discountValue,
          customer_name: selectedCustomer?.name || 'Client comptoir',
          customer_phone: selectedCustomer?.phone || null,
          marketing_contact: getNormalizedMarketingContact()?.value || null,
          notes: 'Paiement POS - Espèces',
          sold_at: new Date().toISOString(),
        },
      ], vendorId);

      if (!syncResponse.success || !syncResponse.data?.results?.length) {
        const backendError = syncResponse.error || 'Impossible de créer la vente POS';
        const shouldFallbackToDirect = paymentMethod === 'cash';

        if (!shouldFallbackToDirect) {
          throw new Error(backendError);
        }

        console.warn('⚠️ [POS] Backend indisponible, fallback direct Supabase activé:', backendError);
        const fallbackOrder = await createCashOrderFallbackDirect();

        setLastOrderNumber((fallbackOrder.order_number || fallbackOrder.id).toUpperCase());
        setShowOrderSummary(false);
        setShowReceipt(true);
        await collectMarketingContactAfterSale();
        toast.success(t('pOSSystem.paiementEffectueAvecSuccesMode'));
        await loadVendorProducts();
        return;
      }

      const saleResult = syncResponse.data.results[0];
      if (saleResult.status === 'error' || !saleResult.sale_id) {
        throw new Error(saleResult.error || 'Échec de création de la vente POS');
      }

      const order = {
        id: saleResult.sale_id,
        order_number: localSaleId.toUpperCase(),
      };

      console.log('✅ [POS] Vente créée via backend atomique:', order.id, order.order_number);

      // 5. Stock: géré côté base de données
      // - décrément via trigger sur order_items
      // - synchronisation bidirectionnelle products.stock_quantity <-> inventory.quantity
      // IMPORTANT: ne pas décrémenter côté client, sinon on obtient des doubles décréments (-2).

      setLastOrderNumber(order.order_number || order.id.substring(0, 8).toUpperCase());
      setShowOrderSummary(false);
      setShowReceipt(true);
      toast.success(t('pOSSystem.paiementEffectueAvecSucces'));
      await loadVendorProducts();
    } catch (error: any) {
      console.error('❌ [POS] Erreur paiement complète:', error);
      console.error('❌ [POS] Error message:', error?.message);
      console.error('❌ [POS] Error details:', JSON.stringify(error, null, 2));

      // ✨ NOUVEAU: Si erreur réseau, proposer le mode offline
      if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed')) {
        if (paymentMethod === 'cash') {
          try {
            console.warn('⚠️ [POS] Erreur réseau détectée, tentative fallback direct Supabase...');
            const fallbackOrder = await createCashOrderFallbackDirect();

            setLastOrderNumber((fallbackOrder.order_number || fallbackOrder.id).toUpperCase());
            setShowOrderSummary(false);
            setShowReceipt(true);
            await collectMarketingContactAfterSale();
            toast.success(t('pOSSystem.paiementEffectueAvecSuccesFallback'));
            await loadVendorProducts();
            return;
          } catch (fallbackError: any) {
            console.error('❌ [POS] Échec fallback direct Supabase:', fallbackError);
          }
        }

        toast.error(t('pOSSystem.connexionPerdue'), {
          description: 'Passez en mode hors-ligne pour continuer les ventes en espèces.',
          duration: 5000
        });
      } else {
        // Extraire le message d'erreur le plus détaillé possible
        const errorMessage = error?.message
          || error?.error_description
          || error?.details
          || error?.hint
          || JSON.stringify(error);

        toast.error(t('pOSSystem.erreurLorsDuPaiement'), {
          description: errorMessage,
          duration: 10000 // Augmenté pour avoir le temps de lire
        });
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Helper function pour obtenir ou creer un customer
  const getOrCreateCustomerId = async (): Promise<string | null> => {
    try {
      if (!user?.id) {
        toast.error('Utilisateur non connecte');
        return null;
      }

      const { data: existingCustomer, error: searchError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (searchError) throw searchError;
      if (existingCustomer?.id) return existingCustomer.id;

      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({ user_id: user.id })
        .select('id')
        .single();

      if (customerError || !newCustomer?.id) {
        throw customerError || new Error('Impossible de creer le client POS');
      }

      return newCustomer.id;
    } catch (error: any) {
      console.error('[POS] getOrCreateCustomerId error:', error);
      toast.error(t('pOSSystem.erreurLorsDeLaCreation2'), {
        description: error?.message || 'Veuillez reessayer'
      });
      return null;
    }
  };

  const handleBarcodeSearch = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      addToCart(product);
      setBarcodeInput('');
    } else {
      toast.error(t('pOSSystem.produitNonTrouve'));
    }
  };

  // Mise à jour de l'horloge
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && barcodeInput) {
        handleBarcodeSearch(barcodeInput);
      }
    };

    document.addEventListener('keypress', handleKeyPress);
    return () => document.removeEventListener('keypress', handleKeyPress);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcodeInput]);

  return (
    <div className={`flex flex-col w-full overflow-hidden bg-transparent max-w-full ${
      isAgentMode
        ? 'h-full'
        : 'h-[100dvh] -m-2 sm:-m-3 md:-m-6'
    }`}>
      {/* En-tête professionnel - Compact sur mobile */}
      <div className="border-b border-border/50 flex-shrink-0 w-full max-w-full">
        <div className="flex items-center justify-between px-3 py-2 md:p-6 max-w-full overflow-hidden">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="w-8 h-8 md:w-14 md:h-14 bg-gradient-to-br from-primary to-primary/80 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0">
              {settings?.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt="Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Store className="h-4 w-4 md:h-7 md:w-7 text-primary-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm md:text-2xl font-bold text-foreground truncate max-w-[120px] md:max-w-none">
                POS
              </h1>
              <p className="text-[10px] md:text-sm text-muted-foreground font-medium truncate max-w-[120px] md:max-w-none">{vendorProfile?.business_name || 'Point de Vente'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Horloge - Desktop only */}
            <div className="hidden md:flex bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-4 shadow-md">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                <div>
                  <div className="font-mono font-bold">{currentTime.toLocaleTimeString('fr-FR')}</div>
                  <div className="text-xs text-muted-foreground">{currentTime.toLocaleDateString('fr-FR')}</div>
                </div>
              </div>
            </div>

            {/* Dialog des paramètres */}
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size={isMobile ? "sm" : "default"} className="shadow-md">
                  <Settings className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">TVA & Config</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    Paramètres POS
                  </DialogTitle>
                </DialogHeader>

                {settingsLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="text-muted-foreground">Chargement...</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Logo Upload Section */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('pOSSystem.logoDeLEntreprise')}</label>
                      <div className="flex items-start gap-4">
                        {/* Aperçu du logo */}
                        <div className="w-20 h-20 border-2 border-dashed border-border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                          {settings?.logo_url ? (
                            <img
                              src={settings.logo_url}
                              alt="Logo"
                              className="max-w-full max-h-full object-contain"
                            />
                          ) : (
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>

                        {/* Upload Button */}
                        <div className="flex-1">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;

                              if (file.size > 2 * 1024 * 1024) {
                                toast.error(t('pOSSystem.leFichierEstTropVolumineux'));
                                return;
                              }

                              try {
                                const fileExt = file.name.split('.').pop();
                                const fileName = `pos-logo-${user?.id}-${Date.now()}.${fileExt}`;
                                const filePath = `logos/${fileName}`;

                                const { error: uploadError } = await supabase.storage
                                  .from('documents')
                                  .upload(filePath, file, {
                                    contentType: file.type,
                                    upsert: true
                                  });

                                if (uploadError) throw uploadError;

                                const { data: publicUrlData } = supabase.storage
                                  .from('documents')
                                  .getPublicUrl(filePath);

                                await updateSettings({ logo_url: publicUrlData.publicUrl });
                                toast.success(t('pOSSystem.logoMisAJour'));
                              } catch (error) {
                                console.error('Erreur upload logo:', error);
                                toast.error(t('pOSSystem.erreurLorsDuTelechargementDu'));
                              }
                            }}
                            className="cursor-pointer text-sm"
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            PNG, JPG, SVG • Max: 2 MB
                          </p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('pOSSystem.nomDeLEntreprise')}</label>
                      <Input
                        value={settings?.company_name || ''}
                        onChange={(e) => updateSettings({ company_name: e.target.value })}
                        placeholder={t('pOSSystem.nomDeVotreEntreprise')}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                        TVA
                        <Badge variant={taxEnabled ? 'default' : 'secondary'} className="text-xs">
                          {taxEnabled ? 'Activée' : 'Désactivée'}
                        </Badge>
                      </label>
                      <div className="flex items-center gap-3 mb-2">
                        <Button
                          variant={taxEnabled ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateSettings({ tax_enabled: !taxEnabled })}
                          className="flex items-center gap-2"
                        >
                          <Check className={`h-4 w-4 ${taxEnabled ? 'opacity-100' : 'opacity-0'}`} />
                          {taxEnabled ? 'Activée' : 'Désactivée'}
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {taxEnabled ? `${(taxRate * 100).toFixed(1)}%` : '0%'}
                        </span>
                      </div>
                      {taxEnabled && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            value={taxRate}
                            onChange={(e) => updateSettings({ tax_rate: parseFloat(e.target.value) || 0 })}
                            className="flex-1"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Format décimal (ex: 0.18 pour 18%)
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Devise</label>
                      <CurrencySelect
                        value={settings?.currency || 'GNF'}
                        onValueChange={(value) => updateSettings({ currency: value })}
                        showFlag={true}
                        showName={false}
                      />
                      {ratesLastUpdated && selectedCurrency !== 'GNF' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Taux mis à jour: {ratesLastUpdated.toLocaleString('fr-FR')}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('pOSSystem.piedDePageDesRecus')}</label>
                      <Textarea
                        value={settings?.receipt_footer || ''}
                        onChange={(e) => updateSettings({ receipt_footer: e.target.value })}
                        placeholder={t('pOSSystem.merciDeVotreVisite')}
                        className="h-20"
                      />
                    </div>

                <div className="bg-muted/30 p-3 rounded-lg">
                      <div className="text-xs text-muted-foreground">
                        <strong>TVA:</strong> {taxEnabled ? `${(taxRate * 100).toFixed(1)}%` : 'Désactivée'}<br/>
                    <strong>Devise:</strong> {settings?.currency || 'GNF'}
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Mobile: Tabs pour basculer entre Produits et Panier */}
      {isMobile && (
        <div className="bg-card/95 backdrop-blur-sm border-b border-border/50 px-3 py-1.5 sticky top-0 z-30">
          <div className="flex gap-2">
            <Button
              variant={mobileTab === 'products' ? 'default' : 'outline'}
              onClick={() => setMobileTab('products')}
              className="h-9 flex-1 text-xs font-semibold"
            >
              <Package className="h-4 w-4 mr-1.5" />
              Produits
            </Button>
            <Button
              variant={mobileTab === 'cart' ? 'default' : 'outline'}
              onClick={() => setMobileTab('cart')}
              className="h-9 flex-1 relative text-xs font-semibold"
            >
              <ShoppingCart className="h-4 w-4 mr-1.5" />
              Panier
              {cart.length > 0 && (
                <Badge className="absolute -top-1.5 -right-1.5 h-5 min-w-[20px] p-0 flex items-center justify-center text-[10px] font-bold bg-destructive text-destructive-foreground">
                  {cart.reduce((sum, item) => sum + item.quantity, 0)}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className={`flex flex-1 min-h-0 overflow-hidden gap-1 sm:gap-2 md:gap-4 p-1 sm:p-2 md:p-4 w-full max-w-full ${isMobile ? 'flex-col' : ''}`}>
        {/* Section Produits - Design moderne */}
        <div className={`flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden space-y-1 sm:space-y-2 md:space-y-4 max-w-full ${isMobile && mobileTab !== 'products' ? 'hidden' : ''}`}>
          {/* Barre de recherche améliorée - Compact sur mobile */}
          <div className="flex-shrink-0 overflow-hidden w-full max-w-full p-2 sm:p-3 md:p-4">
              <div className="flex flex-col gap-2 md:gap-4">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('pOSSystem.rechercher')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-10 text-sm border-2 border-border/50 focus:border-primary/50 bg-background/80"
                    />
                  </div>

                  {/* Bouton Scanner */}
                  <Button
                    variant="default"
                    size="icon"
                    onClick={() => setShowBarcodeScanner(true)}
                    className="h-10 w-10 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md"
                    title={t('pOSSystem.scannerUnProduit')}
                  >
                    <Scan className="h-5 w-5" />
                  </Button>

                  {/* Vue mode - Desktop only */}
                  <div className="hidden md:flex gap-1">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => setViewMode('grid')}
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'outline'}
                      size="icon"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Barre-code - Desktop only */}
                <Input
                  placeholder="Scanner code-barres"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="hidden md:block h-10 text-sm border-2 border-border/50 focus:border-primary/50 bg-background/80"
                />
              </div>

              {/* Filtres par catégorie - Scroll horizontal */}
              <div
                className="flex gap-1.5 md:gap-2 mt-3 md:mt-4 overflow-x-auto pb-2 max-w-full"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
              >
                {categoriesLoading ? (
                  <div className="text-xs text-muted-foreground">Chargement...</div>
                ) : (
                  <>
                    <Button
                      variant={selectedCategory === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory('all')}
                      className="shadow-sm transition-all duration-200 hover:shadow-md flex-shrink-0 text-xs whitespace-nowrap"
                    >
                      Tous
                    </Button>
                    {sortedCategories.map(category => {
                      const productCount = products.filter(p => p.categoryId === category.id).length;
                      return (
                        <Button
                          key={category.id}
                          variant={selectedCategory === category.id ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedCategory(category.id)}
                          className={`shadow-sm transition-all duration-200 hover:shadow-md flex-shrink-0 text-xs whitespace-nowrap ${
                            productCount > 0 ? 'border-primary/30' : 'opacity-60'
                          }`}
                        >
                          {category.name}
                          {productCount > 0 && (
                            <span className="ml-1 text-[10px] bg-primary/20 text-primary px-1 rounded">
                              {productCount}
                            </span>
                          )}
                        </Button>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Sélecteur de Section - Affiché uniquement s'il y a des sections disponibles */}
              {availableSections.length > 0 && (
                <div
                  className="flex gap-1.5 md:gap-2 mt-2 overflow-x-auto pb-2 max-w-full"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                >
                  <Button
                    variant={selectedSection === 'all' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedSection('all')}
                    className="flex-shrink-0 text-xs whitespace-nowrap h-7"
                  >
                    Toutes sections
                  </Button>
                  {availableSections.map(section => {
                    const sectionProductCount = products.filter(p =>
                      p.section === section &&
                      (selectedCategory === 'all' || p.categoryId === selectedCategory)
                    ).length;
                    return (
                      <Button
                        key={section}
                        variant={selectedSection === section ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setSelectedSection(section)}
                        className={`flex-shrink-0 text-xs whitespace-nowrap h-7 ${
                          selectedSection === section ? 'bg-secondary' : 'bg-muted/50'
                        }`}
                      >
                        {section}
                        <span className="ml-1 text-[10px] opacity-70">
                          ({sectionProductCount})
                        </span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>

          {/* Grille de produits professionnelle - Mobile optimisé - Sans fond blanc */}
          <div className="flex-1 overflow-auto min-h-0 min-w-0 max-w-full">
                {productsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <div className="text-muted-foreground text-sm">Chargement...</div>
                    </div>
                  </div>
                ) : sortedProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
                    <ShoppingBag className="h-12 w-12 text-muted-foreground/50" />
                    <div className="text-center">
                      <div className="text-sm font-semibold text-muted-foreground mb-1">{t('pOSSystem.aucunProduit')}</div>
                      <div className="text-xs text-muted-foreground">
                        {searchTerm ? 'Modifiez votre recherche' : 'Ajoutez des produits'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 p-1 md:p-2">
                    {sortedProducts.map(product => {
                      const isRecent = recentlySelected.includes(product.id);

                      // Stock restant affiché = stock DB - unités déjà dans le panier (unité + carton)
                      const unitsInCart = cart
                        .filter((i) => i.id === product.id)
                        .reduce((sum, i) => sum + (i.quantity || 0), 0);
                      const remainingStock = Math.max(0, product.stock - unitsInCart);

                      const canSellCarton = !!product.sell_by_carton && !!product.units_per_carton && product.units_per_carton > 1;
                      const cartonsAvailable = canSellCarton ? Math.floor(remainingStock / product.units_per_carton) : 0;
                      const cartonPrice = canSellCarton
                        ? (product.price_carton && product.price_carton > 0
                          ? product.price_carton
                          : product.price * product.units_per_carton)
                        : 0;

                      return (
                        <Card
                          key={product.id}
                          onClick={() => {
                            if (remainingStock > 0) {
                              addToCart(product);
                            }
                          }}
                          className={`group relative transition-all duration-200 hover:shadow-xl border bg-card cursor-pointer ${
                            isRecent
                              ? 'border-primary/60 ring-2 ring-primary/20 shadow-lg'
                              : 'border-border/50 hover:border-primary/40'
                          } ${remainingStock <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                        <CardContent className="p-0 flex flex-col">
                          {/* Image produit - Hauteur fixe pour éviter les débordements */}
                          <div className="relative w-full h-24 md:h-28 bg-gradient-to-br from-muted/50 to-muted/30 overflow-hidden flex-shrink-0">
                            {/* Badge stock (restant) */}
                            <div className="absolute top-1 right-1 z-10">
                              <Badge
                                variant={remainingStock > 10 ? 'default' : remainingStock > 0 ? 'secondary' : 'destructive'}
                                className="shadow-md font-bold text-[10px] px-1.5 py-0.5"
                              >
                                {remainingStock}
                              </Badge>
                            </div>

                            {/* Badge quantité panier (unités) */}
                            {unitsInCart > 0 && (
                              <div className="absolute top-1 left-1 z-10">
                                <Badge variant="default" className="font-mono font-bold text-[10px] px-1.5 py-0.5 bg-primary">
                                  ×{unitsInCart}
                                </Badge>
                              </div>
                            )}

                            {product.images && product.images.length > 0 ? (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Package className="h-8 w-8 text-muted-foreground/40" />
                              </div>
                            )}
                          </div>

                          {/* Info produit - Très compact sur mobile */}
                            <div className="p-2 md:p-3 space-y-1">
                            {/* Nom produit */}
                            <h3 className="font-semibold text-xs md:text-sm leading-tight line-clamp-2 min-h-[2rem]">
                              {product.name}
                            </h3>

                            {/* Code-barres affiché */}
                            {product.barcode && (
                              <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-mono bg-muted/30 px-1 py-0.5 rounded">
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M2 6h2v12H2zM6 6h1v12H6zM9 6h2v12H9zM13 6h1v12h-1zM16 6h2v12h-2zM20 6h2v12h-2z"/>
                                </svg>
                                <span className="truncate max-w-[80px]">{product.barcode}</span>
                              </div>
                            )}

                            {/* Prix unité */}
                            <div className="flex items-baseline gap-1">
                              <span className="text-sm md:text-lg font-bold text-primary">
                                {formatPriceWithCurrency(product.price)}
                                {selectedCurrency !== 'GNF' && (
                                  <span className="block text-[9px] text-muted-foreground ml-1">({product.price.toLocaleString()} GNF)</span>
                                )}
                              </span>
                              <span className="text-[10px] text-muted-foreground">/unité</span>
                            </div>

                            {/* Prix carton */}
                            {canSellCarton && (
                              <div
                                className={`flex items-baseline gap-1 px-1 py-0.5 rounded ${
                                  cartonsAvailable > 0
                                    ? 'bg-vendeur-secondary/10 dark:bg-vendeur-secondary/20'
                                    : 'bg-muted/40'
                                }`}
                              >
                                <span
                                  className={`text-xs font-bold ${
                                    cartonsAvailable > 0
                                      ? 'text-vendeur-secondary'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  📦 {formatPriceWithCurrency(cartonsAvailable > 0 ? cartonPrice : 0)}
                                  {selectedCurrency !== 'GNF' && cartonsAvailable > 0 && (
                                    <span className="block text-[9px] text-muted-foreground ml-1">({cartonPrice.toLocaleString()} GNF)</span>
                                  )}
                                </span>
                                <span
                                  className={`text-[9px] ${
                                    cartonsAvailable > 0
                                      ? 'text-vendeur-secondary/70'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  /{cartonsAvailable > 0 ? product.units_per_carton : 0}u
                                </span>
                              </div>
                            )}

                            {/* Stock disponible (unités + cartons) */}
                            {canSellCarton && (
                              <div className="text-[9px] text-muted-foreground">
                                {cartonsAvailable} cartons dispo
                              </div>
                            )}

                            {/* Boutons d'action - Touch friendly */}
                            <div className="flex flex-col gap-1.5 pt-1.5">
                              {/* Ligne 1: Quantité + Unité */}
                              <div className="flex gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const qty = cart.find(item => item.id === product.id && item.saleType !== 'carton')?.quantity || 0;
                                    if (qty > 0) updateQuantity(product.id, qty - 1);
                                  }}
                                  disabled={!cart.find(item => item.id === product.id && item.saleType !== 'carton')}
                                  className="h-8 w-8 p-0 flex-shrink-0"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </Button>

                                {/* Bouton pavé numérique pour quantité multiple */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedProductForQuantity(product);
                                    setShowQuantityKeypad(true);
                                  }}
                                  className="h-8 w-8 p-0 flex-shrink-0 border-primary/30 hover:border-primary hover:bg-primary/10"
                                  title={t('pOSSystem.saisirQuantite')}
                                >
                                  <Calculator className="h-3.5 w-3.5 text-primary" />
                                </Button>

                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addToCart(product);
                                  }}
                                  className="flex-1 h-8 text-[10px] md:text-xs font-semibold"
                                >
                                  <Plus className="h-3.5 w-3.5 mr-0.5" />
                                  Unité
                                </Button>
                              </div>

                              {/* Ligne 2: Bouton Carton */}
                              {canSellCarton && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (cartonsAvailable > 0) addToCartByCarton(product);
                                  }}
                                  disabled={cartonsAvailable <= 0}
                                  className="w-full h-8 text-[10px] md:text-xs font-semibold bg-vendeur-secondary hover:bg-vendeur-secondary/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  📦 Carton ({cartonsAvailable > 0 ? product.units_per_carton : 0}u)
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                )}
          </div>
        </div>

        {/* Section Panier - Interface professionnelle - Responsive optimisé mobile */}
        <div className={`w-full md:w-80 lg:w-full max-w-[380px] flex-shrink-0 flex flex-col min-w-0 max-w-full ${isMobile ? 'flex-1 min-h-0' : 'md:min-h-0 md:max-h-full'} ${isMobile && mobileTab !== 'cart' ? 'hidden' : ''}`}>
          {/* Panier - Design optimisé mobile */}
          <Card className="shadow-xl border-0 bg-card overflow-hidden flex flex-col max-w-full flex-1">
            {/* En-tête compact */}
            <div className="p-1.5 sm:p-2 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 border-b border-primary/20 flex-shrink-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 rounded-md bg-primary/20">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                  </div>
                  <span className="sr-only">Panier</span>
                  <Badge
                    variant="secondary"
                    className="bg-primary text-primary-foreground font-bold px-1.5 text-[11px] tabular-nums"
                  >
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                                <span className="text-xs sm:text-sm font-black text-primary tabular-nums">
                                  {formatPriceWithCurrency(subtotal)}
                                  {selectedCurrency !== 'GNF' && (
                                    <span className="ml-1 text-[10px] text-muted-foreground">({subtotal.toLocaleString()} GNF)</span>
                                  )}
                                </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearCart}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Liste des produits du panier - Zone scrollable optimisée */}
            <div className="overflow-hidden p-2 sm:p-2 flex-1 min-h-0">
              <ScrollArea className="h-full">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <ShoppingBag className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-muted-foreground font-medium text-sm">Panier vide</p>
                    <p className="text-xs text-muted-foreground/80">{t('pOSSystem.ajoutezDesProduits')}</p>
                  </div>
                ) : (
                  <div className="space-y-1 pr-4">
                    {cart.map(item => (
                      <div
                        key={`${item.id}-${item.saleType || 'unit'}`}
                        className="flex items-center gap-2 p-2 bg-background/80 rounded-lg border border-border/30"
                      >
                        {/* Image produit - petite */}
                        {item.images && item.images[0] ? (
                          <img
                            src={item.images[0]}
                            alt={item.name}
                            className="w-10 h-10 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            <Package className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}

                        {/* Nom + Prix - zone flexible */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs truncate">
                            {item.saleType === 'carton' && '📦 '}
                            {item.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatPriceWithCurrency(item.price)}
                            {selectedCurrency !== 'GNF' && (
                              <span className="ml-1">({item.price.toLocaleString()} GNF)</span>
                            )}
                          </p>
                        </div>

                        {/* Contrôles quantité - taille fixe */}
                        <div className="flex items-center bg-muted/40 rounded-lg shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const decrementBy = item.saleType === 'carton' && item.units_per_carton
                                ? item.units_per_carton
                                : 1;
                              updateQuantity(item.id, item.quantity - decrementBy);
                            }}
                            className="h-8 w-8 p-0 hover:bg-destructive/20"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="font-mono font-bold text-sm w-6 text-center">
                            {item.saleType === 'carton' && item.units_per_carton
                              ? Math.floor(item.quantity / item.units_per_carton)
                              : item.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => item.saleType === 'carton' ? addToCartByCarton(item) : addToCart(item)}
                            className="h-8 w-8 p-0 hover:bg-primary/20"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Supprimer */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFromCart(item.id)}
                          className="text-muted-foreground hover:text-destructive h-8 w-8 p-0 flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Section paiement ultra compacte mobile */}
            {cart.length > 0 && (
              <div className="border-t border-primary/20 bg-gradient-to-b from-muted/20 to-background flex-shrink-0 p-3 space-y-2.5">
                {/* Remise - Version compacte collapsible */}
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <div className="flex items-center gap-1.5">
                      <Percent className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-bold">Remise</span>
                      {discountValue > 0 && (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                          -{formatPriceWithCurrency(discountValue)}
                        </Badge>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>

                  <div className="mt-2 space-y-2 p-2 bg-muted/20 rounded-lg">
                    <div className="grid grid-cols-2 gap-1">
                      <Button
                        variant={discountMode === 'percent' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => { setDiscountMode('percent'); setDiscountAmount(0); }}
                        className="h-7 text-[10px]"
                      >
                        <Percent className="h-3 w-3 mr-1" />%
                      </Button>
                      <Button
                        variant={discountMode === 'amount' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => { setDiscountMode('amount'); setDiscountPercent(0); }}
                        className="h-7 text-[10px]"
                      >
                        <Euro className="h-3 w-3 mr-1" />GNF
                      </Button>
                    </div>

                    <Input
                      type="number"
                      value={discountMode === 'percent' ? (discountPercent || '') : (discountAmount || '')}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        if (discountMode === 'percent') {
                          setDiscountPercent(Math.min(100, Math.max(0, val)));
                        } else {
                          setDiscountAmount(Math.min(val, totalBeforeDiscount));
                        }
                      }}
                      className="h-8 text-sm font-bold text-center"
                      placeholder={discountMode === 'percent' ? 'Ex: 10%' : 'Ex: 5000'}
                    />
                  </div>
                </details>

                {/* Total et TVA avec remise visible */}
                <div className="space-y-1.5 py-1.5 border-y border-border/30">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      TVA: {formatPriceWithCurrency(tax)}
                    </span>
                    {hasDiscount && (
                      <span className="text-[10px] text-muted-foreground line-through">
                        {formatPriceWithCurrency(totalBeforeDiscount)}
                      </span>
                    )}
                  </div>

                  {hasDiscount && (
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[#ff4000]">
                      <span>{discountLabel}</span>
                      <span>-{formatPriceWithCurrency(discountValue)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-foreground">{t('pOSSystem.totalAPayer')}</span>
                    <div className="text-right">
                      <span className="text-lg sm:text-xl font-black text-primary">{formatPriceWithCurrency(total)}</span>
                    </div>
                  </div>
                </div>

                {/* Mode de paiement - Espèces, Mobile Money, Carte */}
                <div className="flex gap-1">
                  {[
                    { id: 'cash', icon: Euro, label: 'Espèces' },
                    { id: 'mobile_money', icon: Smartphone, label: 'Mobile' },
                    { id: 'card', icon: Shield, label: 'Carte' },
                  ].map((method) => (
                    <Button
                      key={method.id}
                      variant={paymentMethod === method.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentMethod(method.id as any)}
                      className={`flex-1 h-8 text-[10px] ${paymentMethod === method.id ? 'shadow-md' : ''}`}
                    >
                      <method.icon className="h-3.5 w-3.5 mr-1" />
                      {method.label}
                    </Button>
                  ))}
                </div>

                {paymentMethod === 'mobile_money' && (
                  <div className="space-y-2 p-2 bg-gradient-to-r from-orange-50 to-orange-50 dark:from-orange-950/20 dark:to-[#ff4000]/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <Label className="text-xs font-semibold flex items-center gap-1 text-orange-700 dark:text-orange-400">
                      <Smartphone className="h-3.5 w-3.5" />
                      Paiement Mobile Money
                    </Label>

                    {/* Sélection du provider */}
                    <div className="flex gap-1">
                      <Button
                        variant={mobileMoneyProvider === 'orange' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setMobileMoneyProvider('orange')}
                        className={`flex-1 h-8 text-[10px] ${mobileMoneyProvider === 'orange' ? 'bg-orange-500 hover:bg-orange-600' : 'border-orange-300'}`}
                      >
                        🟠 Orange Money
                      </Button>
                      <Button
                        variant={mobileMoneyProvider === 'mtn' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setMobileMoneyProvider('mtn')}
                        className={`flex-1 h-8 text-[10px] ${mobileMoneyProvider === 'mtn' ? 'bg-[#ff4000] hover:bg-[#ff4000] text-black' : 'border-[#ff4000]'}`}
                      >
                        🟡 MTN MoMo
                      </Button>
                    </div>

                    {/* Numéro de téléphone */}
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">{t('pOSSystem.numeroDeTelephoneDuClient')}</Label>
                      <Input
                        type="tel"
                        value={mobileMoneyPhone}
                        onChange={(e) => setMobileMoneyPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                        placeholder="Ex: 620123456"
                        className="h-9 text-sm font-mono tracking-wider"
                        maxLength={9}
                      />
                      {mobileMoneyPhone && mobileMoneyPhone.length < 9 && (
                        <p className="text-[10px] text-destructive">Entrez 9 chiffres</p>
                      )}
                    </div>

                    <p className="text-[9px] text-muted-foreground">
                      💡 Le client recevra une demande de paiement sur son téléphone
                    </p>
                  </div>
                )}

                {paymentMethod === 'card' && (
                  <div className="space-y-2 p-2 bg-gradient-to-r from-blue-50 to-blue-50 dark:from-blue-950/20 dark:to-[#04439e]/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Label className="text-xs font-semibold flex items-center gap-1 text-blue-700 dark:text-blue-400">
                      <Shield className="h-3.5 w-3.5" />
                      Paiement par carte sécurisé
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      💳 Visa, Mastercard, American Express acceptées
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      🔒 Paiement sécurisé via Stripe
                    </p>
                  </div>
                )}

                {/* Boutons de validation */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    onClick={openCreditSaleModal}
                    variant="outline"
                    className="h-12 font-semibold text-sm"
                    disabled={cart.length === 0}
                  >
                    <CreditCard className="h-4 w-4 mr-1.5" />
                    À crédit
                  </Button>
                  <Button
                    onClick={validateOrder}
                    className="h-12 font-bold text-sm shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                    disabled={cart.length === 0}
                  >
                    <CheckSquare className="h-4 w-4 mr-1.5" />
                    Valider
                  </Button>
                </div>
                <p className="text-center text-sm font-bold text-primary pb-1">{formatPriceWithCurrency(total)}</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Dialog de confirmation de commande */}
      <Dialog open={showOrderSummary} onOpenChange={setShowOrderSummary}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Confirmation de commande
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted/30 p-4 rounded-lg">
              <h3 className="font-semibold mb-3">{t('pOSSystem.recapitulatif')}</h3>
              <div className="space-y-2 text-sm">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between">
                    <span>{item.name} × {item.quantity}</span>
                    <span>
                      {formatPriceWithCurrency(item.total)}
                      {selectedCurrency !== 'GNF' && (
                        <span className="block text-[10px] text-muted-foreground">({item.total.toLocaleString()} GNF)</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <Separator className="my-3" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Sous-total</span>
                  <span>
                    {formatPriceWithCurrency(subtotal)}
                    {selectedCurrency !== 'GNF' && (
                      <span className="block text-[10px] text-muted-foreground">({subtotal.toLocaleString()} GNF)</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>TVA ({taxEnabled ? `${(taxRate * 100).toFixed(1)}%` : 'désactivée'})</span>
                  <span>
                    {formatPriceWithCurrency(tax)}
                    {selectedCurrency !== 'GNF' && (
                      <span className="block text-[10px] text-muted-foreground">({tax.toLocaleString()} GNF)</span>
                    )}
                  </span>
                </div>
                {hasDiscount && (
                  <div className="flex justify-between text-[#ff4000] font-medium">
                    <span>{discountLabel}</span>
                    <span>
                      -{formatPriceWithCurrency(discountValue)}
                      {selectedCurrency !== 'GNF' && (
                        <span className="block text-[10px] text-muted-foreground">(-{discountValue.toLocaleString()} GNF)</span>
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t border-border pt-2">
                  <span>TOTAL</span>
                  <span className="text-primary">
                    {formatPriceWithCurrency(total)}
                    {selectedCurrency !== 'GNF' && (
                      <span className="block text-[10px] text-muted-foreground">({total.toLocaleString()} GNF)</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-muted/20 p-3 rounded-lg">
              <div className="text-sm">
                <strong>{t('pOSSystem.modeDePaiement')}</strong> {
                  paymentMethod === 'cash' ? 'Espèces' :
                  paymentMethod === 'card' ? 'Carte bancaire (Stripe)' :
                  'Mobile Money (ChapChapPay)'
                }
              </div>
              {paymentMethod === 'cash' && receivedAmount > 0 && (
                <div className="text-sm mt-1">
                  <strong>{t('pOSSystem.montantRecu')}</strong> {formatPriceWithCurrency(receivedAmount)}
                  {selectedCurrency !== 'GNF' && (
                    <span className="block text-[10px] text-muted-foreground">({receivedAmount.toLocaleString()} GNF)</span>
                  )}<br/>
                  <strong>Rendu:</strong> {formatPriceWithCurrency(change)}
                  {selectedCurrency !== 'GNF' && (
                    <span className="block text-[10px] text-muted-foreground">({change.toLocaleString()} GNF)</span>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{t('pOSSystem.contactClient')}</p>
                  <p className="text-xs text-muted-foreground">{t('pOSSystem.choisissezMailOuNumeroAvant')}</p>
                </div>
                <Button
                  type="button"
                  variant={showMarketingContactField ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setShowMarketingContactField((prev) => {
                      const next = !prev;
                      if (!next) {
                        setMarketingContactInput('');
                      }
                      return next;
                    });
                  }}
                  className="h-8 shrink-0"
                >
                  {showMarketingContactField ? 'Masquer' : 'Activer'}
                </Button>
              </div>

              {showMarketingContactField && (
                <div className="space-y-2">
                  <Input
                    value={marketingContactInput}
                    onChange={(e) => setMarketingContactInput(e.target.value)}
                    placeholder={t('pOSSystem.emailOuNumeroDuClient')}
                    className="h-9"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Saisissez directement l'email ou le numéro. Le contact sera ajouté à la fiche client et aux campagnes après la vente.
                  </p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex gap-2 bg-background/95 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <Button variant="outline" onClick={() => setShowOrderSummary(false)} className="flex-1">
                Annuler
              </Button>
              <Button onClick={processPayment} className="flex-1" disabled={isProcessingPayment}>
                <CheckSquare className="h-4 w-4 mr-2" />
                {isProcessingPayment ? 'Traitement...' : 'Confirmer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de vente à crédit */}
      <Dialog open={showCreditSaleModal} onOpenChange={setShowCreditSaleModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Vente à crédit
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted/30 p-4 rounded-lg">
              <h3 className="font-semibold mb-3">{t('pOSSystem.recapitulatifPanier')}</h3>
              <div className="space-y-2 text-sm max-h-32 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between">
                    <span>{item.name} × {item.quantity}</span>
                    <span>
                      {formatPriceWithCurrency(item.total)}
                      {selectedCurrency !== 'GNF' && (
                        <span className="block text-[10px] text-muted-foreground">({item.total.toLocaleString()} GNF)</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <Separator className="my-3" />
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Sous-total</span>
                  <span>
                    {formatPriceWithCurrency(subtotal)}
                    {selectedCurrency !== 'GNF' && (
                      <span className="block text-[10px] text-muted-foreground">({subtotal.toLocaleString()} GNF)</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>TVA ({taxEnabled ? `${(taxRate * 100).toFixed(1)}%` : 'désactivée'})</span>
                  <span>
                    {formatPriceWithCurrency(tax)}
                    {selectedCurrency !== 'GNF' && (
                      <span className="block text-[10px] text-muted-foreground">({tax.toLocaleString()} GNF)</span>
                    )}
                  </span>
                </div>
                {hasDiscount && (
                  <div className="flex justify-between text-sm text-[#ff4000] font-medium">
                    <span>{discountLabel}</span>
                    <span>
                      -{formatPriceWithCurrency(discountValue)}
                      {selectedCurrency !== 'GNF' && (
                        <span className="block text-[10px] text-muted-foreground">(-{discountValue.toLocaleString()} GNF)</span>
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t border-border pt-2">
                  <span>TOTAL</span>
                  <span className="text-primary">
                    {formatPriceWithCurrency(total)}
                    {selectedCurrency !== 'GNF' && (
                      <span className="block text-[10px] text-muted-foreground">({total.toLocaleString()} GNF)</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="creditCustomer">{t('pOSSystem.nomDuClient')}</Label>
                <Input
                  id="creditCustomer"
                  placeholder={t('pOSSystem.nomDuClient2')}
                  value={creditCustomerName}
                  onChange={(e) => setCreditCustomerName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="creditCustomerPhone">{t('pOSSystem.contactDuClient')}</Label>
                <Input
                  id="creditCustomerPhone"
                  type="tel"
                  placeholder="Ex: 620 00 00 00"
                  value={creditCustomerPhone}
                  onChange={(e) => setCreditCustomerPhone(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="creditDueDate">{t('pOSSystem.dateDEcheance')}</Label>
                <Input
                  id="creditDueDate"
                  type="date"
                  value={creditDueDate}
                  onChange={(e) => setCreditDueDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="creditNotes">Notes (optionnel)</Label>
                <Textarea
                  id="creditNotes"
                  placeholder={t('pOSSystem.notesSurLaVenteA')}
                  value={creditNotes}
                  onChange={(e) => setCreditNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCreditSaleModal(false)} className="flex-1">
                Annuler
              </Button>
              <Button
                onClick={processCreditSale}
                className="flex-1"
                disabled={isProcessingCredit || !creditCustomerName.trim() || !creditDueDate}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {isProcessingCredit ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <NumericKeypadPopup
        open={showKeypad}
        onOpenChange={setShowKeypad}
        numericInput={numericInput}
        onNumericInput={handleNumericInput}
        receivedAmount={receivedAmount}
        total={total}
        change={change}
        currency={selectedCurrency}
        mode={keypadMode}
        productName={selectedCartItemForQuantity?.name}
        maxQuantity={selectedCartItemForQuantity ? products.find(p => p.id === selectedCartItemForQuantity.id)?.stock : undefined}
      />

      {/* Reçu téléchargeable après paiement */}
      <POSReceipt
        open={showReceipt}
        onClose={() => {
          setShowReceipt(false);
          // Reset après fermeture du reçu
          clearCart();
          setReceivedAmount(0);
          setDiscountPercent(0);
          setDiscountAmount(0);
          setNumericInput('');
        }}
        orderData={{
          orderNumber: lastOrderNumber,
          // Convertir tous les montants GNF → devise sélectionnée pour l'affichage du reçu
          items: selectedCurrency !== 'GNF'
            ? cart.map(item => ({
                ...item,
                price: vendorConvert(item.price),
                total: vendorConvert(item.total),
                discount: item.discount ? {
                  ...item.discount,
                  discountAmount: item.discount.discountAmount != null
                    ? vendorConvert(item.discount.discountAmount)
                    : item.discount.discountAmount,
                } : item.discount,
              }))
            : cart,
          subtotal: selectedCurrency !== 'GNF' ? vendorConvert(subtotal) : subtotal,
          tax: selectedCurrency !== 'GNF' ? vendorConvert(tax) : tax,
          taxRate,
          taxEnabled,
          discount: selectedCurrency !== 'GNF' ? vendorConvert(discountValue) : discountValue,
          discountMode,
          discountPercent,
          totalBeforeDiscount: selectedCurrency !== 'GNF' ? vendorConvert(totalBeforeDiscount) : totalBeforeDiscount,
          total: selectedCurrency !== 'GNF' ? vendorConvert(total) : total,
          paymentMethod,
          receivedAmount: selectedCurrency !== 'GNF' ? vendorConvert(receivedAmount) : receivedAmount,
          change: selectedCurrency !== 'GNF' ? vendorConvert(change) : change,
          currency: selectedCurrency,
          companyName: companyName,
          logoUrl: settings?.logo_url,
          receiptFooter: settings?.receipt_footer
        }}
      />

      {/* Popup pavé numérique pour quantité */}
      <QuantityKeypadPopup
        open={showQuantityKeypad}
        onOpenChange={setShowQuantityKeypad}
        selectedProduct={selectedProductForQuantity}
        onConfirm={(product, quantity) => {
          addToCart(product, quantity);
        }}
        currency={selectedCurrency}
      />

      {/* Modal Scanner Code-barres + Vérification Photo */}
      <BarcodeScannerModal
        open={showBarcodeScanner}
        onOpenChange={setShowBarcodeScanner}
        products={products}
        onAddToCart={addToCart}
        onAddToCartByCarton={addToCartByCarton}
      />

      {/* Modal Paiement Stripe - Vrai paiement carte bancaire */}
      {pendingStripeOrder && vendorId && (
        <StripeCardPaymentModal
          isOpen={showStripeModal}
          onClose={() => {
            setShowStripeModal(false);

            if (skipStripeCancelOnCloseRef.current) {
              skipStripeCancelOnCloseRef.current = false;
              setPendingStripeOrder(null);
              return;
            }

            // Annuler la commande si le modal est fermé sans paiement
            if (pendingStripeOrder) {
              supabase.from('orders')
                .update({ status: 'cancelled', payment_status: 'cancelled' })
                .eq('id', pendingStripeOrder.id);
              setPendingStripeOrder(null);
            }
          }}
          amount={total}
          currency="GNF"
          orderId={pendingStripeOrder.id}
          sellerId={vendorOwnerUserId || vendorId}
          description={`Vente POS - ${cart.length} article(s)`}
          onSuccess={async (paymentIntentId) => {
            // Paiement réussi - POS orders are completed immediately (no delivery needed)
            console.log('✅ Paiement Stripe réussi:', paymentIntentId);

            try {
              // Marquer comme payé et complété - POS n'a pas besoin de workflow de livraison
              const { error: updateError } = await updatePosOrderStatus(pendingStripeOrder.id, {
                payment_status: 'paid',
                notes: `Paiement Stripe confirmé - Intent: ${paymentIntentId}`
              });
              if (updateError) throw updateError;

              await collectMarketingContactAfterSale();

              skipStripeCancelOnCloseRef.current = true;
              setLastOrderNumber(pendingStripeOrder.order_number);
              setShowStripeModal(false);
              setPendingStripeOrder(null);
              setShowReceipt(true);
              clearCart();
              await loadVendorProducts();
            } catch (error: any) {
              console.error('❌ Erreur mise à jour commande Stripe:', error);
              toast.error(t('pOSSystem.erreurLorsDeLaFinalisation'), {
                description: error?.message || 'Veuillez réessayer'
              });
            }
          }}
          onError={(error) => {
            console.error('❌ Erreur paiement Stripe:', error);
            toast.error(t('pOSSystem.paiementEchoue'), {
              description: error
            });
          }}
        />
      )}
    </div>
  );
}

// Export par défaut pour l'import dynamique
export default POSSystem;
