/**
 * Page publique Menu Restaurant
 * Permet aux clients de voir le menu et passer une commande directement
 * v2 - Achat direct sans panier intermédiaire
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { backendFetch } from '@/services/backendApi';
import { mapService } from '@/services/mapService';

// Frais de livraison (modèle Uber/Meituan) — DOIT matcher le calcul serveur (restaurant.routes priceOrder) :
// frais = forfait de base du resto + DELIVERY_PRICE_PER_KM × distance(resto→client). Affichage estimé ;
// le backend reste autoritaire au paiement.
const DELIVERY_PRICE_PER_KM = 2000; // GNF/km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useAppPersistence, useFormPersistence } from '@/hooks/useAppPersistence';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Minus,
  Clock,
  Flame,
  Star,
  MapPin,
  Phone,
  ChefHat,
  Utensils,
  Leaf,
  CreditCard,
  Wallet,
  Check,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RestaurantOrderTracker } from '@/components/professional-services/modules/restaurant/RestaurantOrderTracker';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
}

interface MenuItem {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  images: string[] | null;
  video_url: string | null;
  preparation_time: number;
  is_available: boolean;
  is_featured: boolean;
  is_new: boolean;
  spicy_level: number;
  dietary_tags: string[] | null;
  allergens: string[] | null;
  variants?: { groups?: OptionGroup[] } | null;
}

interface OptionGroup {
  id: string;
  name: string;
  min?: number;          // sélections minimales (0 = facultatif)
  max?: number;          // sélections maximales (1 = choix unique)
  options: { id: string; name: string; price: number }[];
}

interface SelectedOption { group_id: string; group_name: string; option_id: string; name: string; price: number }

interface CartItem extends MenuItem {
  quantity: number;
  special_instructions?: string;
  menuItemId?: string;            // vrai id du plat (l'id du panier peut être composite si options)
  selectedOptions?: SelectedOption[];
  optionsPrice?: number;
}

interface RestaurantInfo {
  id: string;
  business_name: string;
  description: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  address: string | null;
  phone: string | null;
  rating: number | null;
  total_reviews: number | null;
  latitude: number | null;
  longitude: number | null;
  metadata: any;
}

export default function RestaurantPublicMenu() {
  const { t } = useTranslation();
  const { serviceId } = useParams<{ serviceId: string }>();
  const [searchParams] = useSearchParams();
  const qrTable = searchParams.get('table'); // MODE 3 (QR) : numéro de table pré-rempli depuis le QR scanné
  const navigate = useNavigate();
  const { user } = useAuth();
  const fc = useFormatCurrency();

  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [clientCoords, setClientCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCheckout, setShowCheckout] = useState(false);

  // Quick order modal (achat direct)
  const [quickOrderItem, setQuickOrderItem] = useState<MenuItem | null>(null);
  const [quickOrderQuantity, setQuickOrderQuantity] = useState(1);
  const [showQuickOrder, setShowQuickOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderNumber, setLastOrderNumber] = useState('');
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  // Promotion active (réduction %) appliquée à la commande, si dans la plage horaire.
  const [activePromo, setActivePromo] = useState<{ id: string; title: string; promo_type: string; value: number; start_time: string | null; end_time: string | null } | null>(null);

  // États persistés - Checkout form + Cart
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persistance du panier restaurant
  const persistedCart = useAppPersistence<CartItem[]>({
    key: `restaurant_cart_${serviceId}`,
    defaultState: [],
    maxAge: 2 * 60 * 60 * 1000, // 2 heures
    enabled: !!serviceId,
  });

  // Persistance du formulaire checkout
  const { values: checkoutForm, setValues: setCheckoutForm, resetForm: _resetCheckoutForm, isRestored: checkoutRestored } = useFormPersistence(
    `restaurant_checkout_${serviceId}`,
    {
      customerName: '',
      customerPhone: '',
      orderType: 'takeaway' as 'dine_in' | 'takeaway' | 'delivery',
      tableNumber: '',
      deliveryAddress: '',
      orderNotes: '',
      paymentMethod: 'wallet' as 'wallet' | 'cash' | 'orange_money' | 'mobile_money' | 'card',
    },
    { enabled: !!serviceId, maxAge: 30 * 60 * 1000 }
  );

  // Aliases pour compatibilité avec le code existant
  const cart = persistedCart.state;
  const setCart = persistedCart.setState;
  const customerName = checkoutForm.customerName;
  const setCustomerName = (v: string) => setCheckoutForm(prev => ({ ...prev, customerName: v }));
  const customerPhone = checkoutForm.customerPhone;
  const setCustomerPhone = (v: string) => setCheckoutForm(prev => ({ ...prev, customerPhone: v }));
  const orderType = checkoutForm.orderType;
  const setOrderType = (v: 'dine_in' | 'takeaway' | 'delivery') => setCheckoutForm(prev => ({ ...prev, orderType: v }));
  const tableNumber = checkoutForm.tableNumber;
  const setTableNumber = (v: string) => setCheckoutForm(prev => ({ ...prev, tableNumber: v }));
  const deliveryAddress = checkoutForm.deliveryAddress;
  const setDeliveryAddress = (v: string) => setCheckoutForm(prev => ({ ...prev, deliveryAddress: v }));
  const orderNotes = checkoutForm.orderNotes;
  const setOrderNotes = (v: string) => setCheckoutForm(prev => ({ ...prev, orderNotes: v }));
  const paymentMethod = checkoutForm.paymentMethod;
  const setPaymentMethod = (v: 'wallet' | 'cash' | 'orange_money' | 'mobile_money' | 'card') => setCheckoutForm(prev => ({ ...prev, paymentMethod: v }));
  // Clé d'idempotence par tentative de commande (régénérée après succès) → anti double-débit.
  const idemRef = useRef<string>('');
  // Numéro mobile money du payeur (Orange Money / Mobile Money) — saisi au paiement, PAS comme info client.
  const [payerNumber, setPayerNumber] = useState('');

  // Load restaurant and menu data
  useEffect(() => {
    const loadRestaurantData = async () => {
      if (!serviceId) return;

      try {
        setLoading(true);

        // Load restaurant info
        const { data: restaurantData, error: restError } = await supabase
          .from('professional_services')
          .select('id, business_name, description, logo_url, cover_image_url, address, phone, rating, total_reviews, latitude, longitude, metadata')
          .eq('id', serviceId)
          .single();

        if (restError) throw restError;
        setRestaurant(restaurantData);

        // Load menu categories
        const { data: categoriesData, error: catError } = await supabase
          .from('restaurant_menu_categories')
          .select('*')
          .eq('professional_service_id', serviceId)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (catError) throw catError;
        setCategories(categoriesData || []);

        // Load menu items - afficher TOUS les plats (is_available pour filtrer l'affichage)
        const { data: itemsData, error: itemsError } = await supabase
          .from('restaurant_menu_items')
          .select('*')
          .eq('professional_service_id', serviceId)
          .order('display_order', { ascending: true });

        if (itemsError) throw itemsError;
        setMenuItems(itemsData || []);

      } catch (error) {
        console.error('Error loading restaurant:', error);
        toast.error(t('restaurantPublicMenu.erreurLorsDuChargementDu'));
      } finally {
        setLoading(false);
      }
    };

    loadRestaurantData();
  }, [serviceId]);

  // ⚡ Menu TEMPS RÉEL : si le restaurant active/désactive un plat (ou change un prix),
  // le client le voit en direct sans rechargement (abonnement Supabase Realtime).
  useEffect(() => {
    if (!serviceId) return;
    const ch = supabase
      .channel(`resto-menu-${serviceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_menu_items', filter: `professional_service_id=eq.${serviceId}` }, async () => {
        const { data } = await supabase.from('restaurant_menu_items').select('*').eq('professional_service_id', serviceId).order('display_order', { ascending: true });
        setMenuItems(data || []);
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [serviceId]);

  // Promotions actives du restaurant (affichage + remise %). Filtre la plage horaire.
  useEffect(() => {
    if (!serviceId) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('restaurant_promotions')
        .select('id, title, promo_type, value, start_time, end_time, is_active')
        .eq('professional_service_id', serviceId)
        .eq('is_active', true);
      if (!alive) return;
      const nowHM = new Date().toTimeString().slice(0, 8);
      const inWindow = (p: any) => (!p.start_time || nowHM >= p.start_time) && (!p.end_time || nowHM <= p.end_time);
      // On privilégie une réduction % active dans la plage horaire.
      const pct = (data || []).filter((p: any) => p.promo_type === 'percentage' && inWindow(p)).sort((a: any, b: any) => b.value - a.value)[0];
      setActivePromo(pct || (data || []).find((p: any) => inWindow(p)) || null);
    })();
    return () => { alive = false; };
  }, [serviceId]);

  // Pre-fill user info if logged in
  useEffect(() => {
    if (user) {
      setCustomerName(user.user_metadata?.full_name || '');
      setCustomerPhone(user.phone || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // MODE 3 (QR CODE) : si l'URL contient ?table=N (QR scanné à la table), on FORCE le mode « Sur table »
  // + le n° de table. ⚠️ On dépend de `checkoutRestored` : la restauration localStorage du formulaire
  // (mode/table précédents) se fait dans un effet APRÈS le mount → on RÉ-AFFIRME après restauration pour
  // que le QR gagne TOUJOURS (sinon un ancien « à emporter » persisté écraserait la Table scannée).
  useEffect(() => {
    if (!qrTable) return;
    setOrderType('dine_in');
    setTableNumber(qrTable);
    // Le paiement digital par défaut est garanti par l'effet allowedPayments (dine_in = digital only).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrTable, checkoutRestored]);

  // Méthodes de paiement autorisées par mode :
  //  - Sur table : digital uniquement (Orange Money / Mobile Money / Carte).
  //  - Livraison chez moi : wallet + digital (PAS d'espèces).
  //  - Je viens chercher : wallet + espèces + digital.
  const allowedPayments = (mode: typeof orderType): (typeof paymentMethod)[] =>
    mode === 'dine_in' ? ['orange_money', 'mobile_money', 'card']
      : mode === 'delivery' ? ['wallet', 'orange_money', 'mobile_money', 'card']
        : ['wallet', 'cash', 'orange_money', 'mobile_money', 'card'];

  useEffect(() => {
    const allowed = allowedPayments(orderType);
    if (!allowed.includes(paymentMethod)) setPaymentMethod(orderType === 'dine_in' ? 'orange_money' : 'wallet');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderType]);

  // Filter items by category
  const filteredItems = useMemo(() => {
    if (selectedCategory === 'all') return menuItems;
    return menuItems.filter(item => item.category_id === selectedCategory);
  }, [menuItems, selectedCategory]);

  // Featured items
  const featuredItems = useMemo(() =>
    menuItems.filter(item => item.is_featured),
    [menuItems]
  );

  // Cart operations
  const addToCart = useCallback((item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── OPTIONS / SUPPLÉMENTS : si le plat a des `variants.groups`, on ouvre un modal de choix
  //    AVANT d'ajouter au panier ; sinon ajout direct. Prix RECALCULÉ côté serveur à la commande. ──
  const [optionItem, setOptionItem] = useState<MenuItem | null>(null);
  const [optionSel, setOptionSel] = useState<Record<string, string[]>>({});

  const startAdd = useCallback((item: MenuItem) => {
    if (Array.isArray(item.variants?.groups) && item.variants!.groups!.length > 0) {
      setOptionSel({}); setOptionItem(item);
    } else { addToCart(item); }
  }, [addToCart]);

  const toggleOption = (g: OptionGroup, optionId: string) => {
    setOptionSel(prev => {
      const cur = prev[g.id] || [];
      const single = (g.max ?? 1) <= 1;
      if (single) return { ...prev, [g.id]: cur.includes(optionId) ? [] : [optionId] };
      if (cur.includes(optionId)) return { ...prev, [g.id]: cur.filter(x => x !== optionId) };
      if ((g.max ?? 99) <= cur.length) return prev; // maximum atteint
      return { ...prev, [g.id]: [...cur, optionId] };
    });
  };

  const confirmAddOptions = () => {
    if (!optionItem) return;
    const groups = optionItem.variants?.groups || [];
    for (const g of groups) {
      if ((g.min ?? 0) > (optionSel[g.id] || []).length) { toast.error(`Choisissez au moins ${g.min} option(s) pour « ${g.name} »`); return; }
    }
    const chosen: SelectedOption[] = [];
    for (const g of groups) for (const oid of (optionSel[g.id] || [])) {
      const o = g.options.find(o => o.id === oid);
      if (o) chosen.push({ group_id: g.id, group_name: g.name, option_id: o.id, name: o.name, price: Number(o.price) || 0 });
    }
    const optionsPrice = chosen.reduce((s, o) => s + o.price, 0);
    const lineId = `${optionItem.id}::${chosen.map(o => o.option_id).sort().join(',')}`;
    setCart(prev => {
      const ex = prev.find(i => i.id === lineId);
      if (ex) return prev.map(i => i.id === lineId ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...optionItem, id: lineId, menuItemId: optionItem.id, price: optionItem.price + optionsPrice, optionsPrice, selectedOptions: chosen, quantity: 1 }];
    });
    toast.success(t('restaurantPublicMenu.ajouteAuPanier'));
    setOptionItem(null); setOptionSel({});
  };

  // Quick order - Achat direct
  const openQuickOrder = useCallback((item: MenuItem) => {
    setQuickOrderItem(item);
    setQuickOrderQuantity(1);
    setOrderSuccess(false);
    setShowQuickOrder(true);
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.id !== itemId);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // RECOMMANDER (depuis l'historique) : ?reorder=<orderId> → recharge les MÊMES plats encore
  // disponibles dans le panier, aux prix actuels (jamais les anciens). S'exécute une seule fois.
  const reorderRef = useRef(false);
  useEffect(() => {
    const reorderId = searchParams.get('reorder');
    if (!reorderId || reorderRef.current || menuItems.length === 0) return;
    reorderRef.current = true;
    void (async () => {
      const { data } = await supabase.from('restaurant_orders').select('items').eq('id', reorderId).maybeSingle();
      const past = Array.isArray((data as any)?.items) ? (data as any).items : [];
      if (past.length === 0) return;
      const byId = new Map(menuItems.map((m) => [m.id, m]));
      const byName = new Map(menuItems.map((m) => [m.name?.toLowerCase(), m]));
      const toAdd: { item: MenuItem; qty: number }[] = [];
      let added = 0, skipped = 0;
      for (const it of past) {
        const m = byId.get(it.menu_item_id) || byName.get(String(it.name || '').toLowerCase());
        const qty = Math.max(1, Number(it.quantity) || 1);
        if (m && m.is_available) { toAdd.push({ item: m, qty }); added += qty; } else skipped++;
      }
      if (toAdd.length === 0) { toast.error('Ces plats ne sont plus disponibles.'); return; }
      setCart((prev) => {
        const next = [...prev];
        for (const { item, qty } of toAdd) {
          const idx = next.findIndex((i) => i.id === item.id);
          if (idx >= 0) next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
          else next.push({ ...item, quantity: qty });
        }
        return next;
      });
      toast.success(`Panier rechargé : ${added} article${added > 1 ? 's' : ''}${skipped ? ` (${skipped} indisponible${skipped > 1 ? 's' : ''} ignoré${skipped > 1 ? 's' : ''})` : ''}`);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuItems, searchParams]);

  const getItemQuantity = useCallback((itemId: string) => {
    return cart.find(i => i.id === itemId)?.quantity || 0;
  }, [cart]);

  const cartTotal = useMemo(() =>
    cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  const cartCount = useMemo(() =>
    cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  // Submit order (from cart or quick order)
  // ⚠️ SUPPRIMÉ : l'ancien creditRestaurantWallet faisait un `UPDATE wallets SET balance = …` BRUT
  // (contournait AML/FX/audit et ne débitait jamais le client). Remplacé par le paiement ATOMIQUE
  // Position du client (livraison) → frais calculés par DISTANCE (sinon forfait de base seul).
  const detectClientPosition = async () => {
    setLocating(true);
    try {
      const p = await mapService.getCurrentPosition();
      setClientCoords({ lat: p.latitude, lng: p.longitude });
      toast.success(t('restaurantPublicMenu.positionDetecteeFraisDeLivraison'));
    } catch {
      toast.error(t('restaurantPublicMenu.positionIndisponibleFraisDeBase'));
    } finally { setLocating(false); }
  };

  // Promo « livraison offerte » active → le client ne paie pas les frais (le resto les absorbe).
  const deliveryOffered = activePromo?.promo_type === 'free_delivery';
  const deliveryBase = Math.max(0, Number((restaurant?.metadata as any)?.delivery_fee) || 0);
  const deliveryDistanceKm = (restaurant?.latitude && restaurant?.longitude && clientCoords)
    ? haversineKm(Number(restaurant.latitude), Number(restaurant.longitude), clientCoords.lat, clientCoords.lng) : 0;
  // Frais estimés affichés (le backend reste autoritaire au paiement).
  const deliveryFeeEstimate = orderType === 'delivery' && !deliveryOffered
    ? Math.round(deliveryBase + DELIVERY_PRICE_PER_KM * deliveryDistanceKm) : 0;

  // backend `/api/v2/restaurant/order` (débit client → crédit resto net → commission PDG).
  const handleSubmitOrder = async (isQuickOrder: boolean = false) => {
    if (isSubmitting) return; // garde anti double-soumission (double clic / double appel)

    // MODE SUR TABLE : aucun nom ni téléphone requis (juste le n° de table + instructions optionnelles).
    if (orderType === 'dine_in') {
      if (!tableNumber.trim()) { toast.error(t('restaurantPublicMenu.numeroDeTableManquantScannez')); return; }
    } else if (orderType === 'delivery' && !deliveryAddress.trim()) {
      toast.error(t('restaurantPublicMenu.veuillezEntrerLAdresseDe'));
      return;
    }

    // Contact requis pour les commandes réglées EN PERSONNE (le restaurant/livreur doit joindre le client).
    const inPerson = ['orange_money', 'mobile_money', 'card', 'cash'].includes(paymentMethod);
    if (orderType === 'delivery' && inPerson && (!customerName.trim() || !customerPhone.trim())) {
      toast.error(t('restaurantPublicMenu.nomEtTelephoneRequisPour')); return;
    }
    if (orderType === 'takeaway' && inPerson && !customerName.trim()) {
      toast.error(t('restaurantPublicMenu.votreNomEstRequisPour')); return;
    }

    // Determine items to order
    const itemsToOrder = isQuickOrder && quickOrderItem
      ? [{ ...quickOrderItem, quantity: quickOrderQuantity }]
      : cart;

    if (itemsToOrder.length === 0) {
      toast.error(t('restaurantPublicMenu.aucunArticleACommander'));
      return;
    }

    const grossTotal = itemsToOrder.reduce((sum, item) => sum + item.price * item.quantity, 0);
    // Application de la promotion active (réduction %).
    const promoPct = activePromo?.promo_type === 'percentage' ? (Number(activePromo.value) || 0) : 0;
    const promoDiscount = Math.round(grossTotal * promoPct / 100);
    const total = grossTotal - promoDiscount;

    setIsSubmitting(true);
    try {
      // ── MODE SUR TABLE (QR) : réglé EN PERSONNE (espèces / Orange Money / Mobile Money / carte),
      //    AUCUN compte requis, AUCUN wallet. La commande part au restaurant qui confirme, prépare
      //    et sert à la table. Le client suit en direct (tracker) — pas besoin de nom/téléphone. ──
      // ── PAIEMENT EN PERSONNE (Orange Money / Mobile Money / Carte réglés au comptoir ou à la table) —
      //    TOUS LES MODES (sur table, livraison, à emporter). Aucun compte app requis, aucun wallet :
      //    la commande part au restaurant, qui l'encaisse sur place puis la confirme et la prépare. ──
      if (['orange_money', 'mobile_money', 'card', 'cash'].includes(paymentMethod)) {
        const payItems = itemsToOrder.map(it => ({ menu_item_id: (it as any).menuItemId ?? it.id, quantity: it.quantity, options: (((it as any).selectedOptions || []) as SelectedOption[]).map(o => ({ group_id: o.group_id, option_id: o.option_id })) }));
        const res = await backendFetch<any>('/api/v2/restaurant/order/pay-mobile', {
          method: 'POST',
          allowAnonymous: true, // commande EN PERSONNE : aucun compte requis (QR table / comptoir)
          body: {
            professional_service_id: serviceId, order_type: orderType,
            table_number: orderType === 'dine_in' && tableNumber.trim() ? tableNumber.trim() : null,
            delivery_address: orderType === 'delivery' ? deliveryAddress : null,
            customer_name: orderType === 'dine_in' ? null : (customerName || null),
            customer_phone: orderType === 'dine_in' ? null : (customerPhone || null),
            customer_user_id: user?.id ?? null,
            special_note: orderNotes || null, items: payItems,
            payment_method: paymentMethod,
          },
        });
        if (!res.success) { toast.error((res as any).error || 'Commande non envoyée'); return; }
        const d: any = (res as any).data ?? res;
        setLastOrderId(d.order_id ?? null);
        setLastOrderNumber(String(d.order_id || '').replace(/-/g, '').slice(0, 4).toUpperCase());
        toast.success(orderType === 'dine_in'
          ? `Commande Table ${tableNumber} envoyée ! Réglez sur place une fois servi.`
          : paymentMethod === 'cash'
            ? 'Commande envoyée ! Réglez en espèces au retrait / à la livraison.'
            : 'Commande envoyée ! Réglez au moment du retrait / de la livraison.');
        if (isQuickOrder) { setOrderSuccess(true); } else { clearCart(); setShowCheckout(false); }
        setOrderNotes(''); setPayerNumber('');
        return;
      }

      // ── PAIEMENT WALLET (livraison / à emporter) → BACKEND ATOMIQUE (débit client → crédit resto net →
      //    commission PDG). Prix + promo RECALCULÉS côté serveur (jamais le client). Compte requis. ──
      if (paymentMethod === 'wallet') {
        if (!user) { toast.error(t('restaurantPublicMenu.connectezVousPourPayerAvec')); navigate('/auth'); return; }
        if (!idemRef.current) idemRef.current = (globalThis.crypto?.randomUUID?.() || `resto-${Date.now()}-${Math.random()}`);
        const payItems = itemsToOrder.map(it => ({ menu_item_id: (it as any).menuItemId ?? it.id, quantity: it.quantity, options: (((it as any).selectedOptions || []) as SelectedOption[]).map(o => ({ group_id: o.group_id, option_id: o.option_id })) }));
        const res = await backendFetch<any>('/api/v2/restaurant/order', {
          method: 'POST',
          body: {
            professional_service_id: serviceId,
            order_type: orderType,
            table_number: orderType === 'dine_in' && tableNumber.trim() ? tableNumber.trim() : null,
            delivery_address: orderType === 'delivery' ? deliveryAddress : null,
            // Position du client → frais de livraison calculés par distance côté serveur.
            client_lat: orderType === 'delivery' ? (clientCoords?.lat ?? null) : null,
            client_lng: orderType === 'delivery' ? (clientCoords?.lng ?? null) : null,
            special_note: orderNotes || null,
            items: payItems,
            idempotency_key: idemRef.current,
          },
        });
        if (!res.success) { toast.error((res as any).error || 'Paiement refusé'); return; }
        const d: any = (res as any).data ?? res;
        idemRef.current = ''; // succès → nouvelle clé pour la prochaine commande
        setLastOrderId(d.order_id ?? null);
        setLastOrderNumber(String(d.order_id || '').replace(/-/g, '').slice(0, 4).toUpperCase());
        toast.success(`Commande payée • ${fc(d.charged ?? total)}`);
        if (isQuickOrder) { setOrderSuccess(true); } else { clearCart(); setShowCheckout(false); }
        setOrderNotes(''); setTableNumber(''); setDeliveryAddress('');
        return;
      }

      // (Espèces + digital sont désormais TOUS gérés ci-dessus via /pay-mobile : prix validé serveur,
      //  contact client stocké. Plus d'insert direct côté client.)
      toast.error(t('restaurantPublicMenu.modeDePaiementNonPris'));
    } catch (error) {
      console.error('Error submitting order:', error);
      toast.error(t('restaurantPublicMenu.erreurLorsDeLEnvoi'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickOrderTotal = useMemo(() =>
    quickOrderItem ? quickOrderItem.price * quickOrderQuantity : 0,
    [quickOrderItem, quickOrderQuantity]
  );

  // Get category name
  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Sans catégorie';
    return categories.find(c => c.id === categoryId)?.name || 'Sans catégorie';
  };

  // Sélecteur de paiement (mode-aware) — partagé par le panier et le modal rapide.
  const PAYMENT_LABELS: Record<string, string> = {
    wallet: 'Wallet (en ligne)', cash: 'Espèces (sur place)',
    orange_money: 'Orange Money', mobile_money: 'Mobile Money', card: 'Carte bancaire',
  };
  const paymentIcon = (m: string) =>
    m === 'wallet' ? <Wallet className="w-4 h-4 text-[#ff4000]" />
      : m === 'cash' ? <Receipt className="w-4 h-4 text-muted-foreground" />
        : m === 'orange_money' ? <Phone className="w-4 h-4 text-[#ff4000]" />
          : m === 'mobile_money' ? <Phone className="w-4 h-4" />
            : <CreditCard className="w-4 h-4 text-blue-600" />;
  const renderPaymentSelector = () => (
    <div className="space-y-2">
      <Label>{t('restaurantPublicMenu.paiement')}</Label>
      <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
        <div className="grid grid-cols-2 gap-2">
          {allowedPayments(orderType).map((m) => (
            <label key={m} className={cn('flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-colors', paymentMethod === m && 'border-[#ff4000] bg-[#ff4000]/5')}>
              <RadioGroupItem value={m} className="sr-only" />
              {paymentIcon(m)}
              <span className="text-xs font-medium">{PAYMENT_LABELS[m]}</span>
            </label>
          ))}
        </div>
      </RadioGroup>
      {['orange_money', 'mobile_money', 'card'].includes(paymentMethod) && (
        <p className="text-xs text-muted-foreground">{t('restaurantPublicMenu.aucunCompteNecessaireReglezDirectement')}</p>
      )}
      {paymentMethod === 'wallet' && <p className="text-xs text-muted-foreground">{t('restaurantPublicMenu.debiteDeVotreWalletA')}</p>}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('restaurantPublicMenu.chargementDuMenu')}</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <ChefHat className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t('restaurantPublicMenu.restaurantNonTrouve')}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t('restaurantPublicMenu.ceRestaurantNExistePas')}</p>
          {/* QR scanné dans un nouvel onglet = pas d'historique → on renvoie vers la liste des restaurants. */}
          <Button onClick={() => navigate('/restaurants')}>{t('restaurantPublicMenu.voirLesRestaurants')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header with cover image */}
      <div className="relative h-48 sm:h-64 bg-[#ff4000]">
        {restaurant.cover_image_url ? (
          <img
            src={restaurant.cover_image_url}
            alt={restaurant.business_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Utensils className="w-20 h-20 text-white/50" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 bg-black/30 text-white hover:bg-black/50 rounded-full"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {/* Restaurant info overlay */}
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <div className="flex items-center gap-3">
            {restaurant.logo_url && (
              <img
                src={restaurant.logo_url}
                alt=""
                className="w-14 h-14 rounded-xl object-cover border-2 border-white"
              />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold truncate">
                {restaurant.business_name}
              </h1>
              {activePromo && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#ff4000] px-2.5 py-1 text-xs font-semibold text-white">
                  🎉 {activePromo.title}
                  {activePromo.promo_type === 'percentage' ? ` · -${activePromo.value}%` : activePromo.promo_type === 'free_delivery' ? ' · Livraison offerte' : ' · 2=1'}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 text-sm text-white/90">
                {restaurant.rating && (
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-[#ff4000] text-[#ff4000]" />
                    {restaurant.rating.toFixed(1)}
                    {restaurant.total_reviews && ` (${restaurant.total_reviews})`}
                  </span>
                )}
                {restaurant.address && (
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3" />
                    {restaurant.address}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODE 3 — bannière table (QR scanné) */}
      {qrTable && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-[#ff4000]/30 bg-[#ff4000]/10 px-4 py-2.5 text-sm font-medium text-[#ff4000]">
          🪑 Vous êtes à la <strong>Table {qrTable}</strong> — commandez, le serveur vous l'apporte.
        </div>
      )}

      {/* Categories tabs */}
      <div className="sticky top-0 z-20 bg-background border-b border-border">
        <div className="px-4 py-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            <Button
              variant={selectedCategory === 'all' ? 'filter-active' : 'filter'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className="flex-shrink-0"
            >
              Tout
            </Button>
            {categories.map(cat => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? 'filter-active' : 'filter'}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
                className="flex-shrink-0"
              >
                {cat.icon && <span className="mr-1">{cat.icon}</span>}
                {cat.name}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Featured items */}
      {selectedCategory === 'all' && featuredItems.length > 0 && (
        <section className="px-4 py-4">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Populaires
          </h2>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {featuredItems.map(item => (
              <Card
                key={item.id}
                className="flex-shrink-0 w-40 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => startAdd(item)}
              >
                <div className="relative h-24 bg-muted">
                  {(() => {
                    const img = (item.images && item.images.length > 0 ? item.images[0] : item.image_url) || null;
                    return img
                      ? <img src={img} alt={item.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><ChefHat className="w-8 h-8 text-muted-foreground" /></div>;
                  })()}
                  {item.is_new && (
                    <Badge className="absolute top-1 left-1 text-[10px] px-1.5 py-0">{t('restaurantPublicMenu.nouveau')}</Badge>
                  )}
                  {item.video_url && (
                    <span className="absolute bottom-1 right-1 bg-black/60 text-white rounded p-0.5">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </span>
                  )}
                </div>
                <CardContent className="p-2">
                  <h3 className="font-medium text-sm line-clamp-1">{item.name}</h3>
                  <p className="text-primary font-bold text-sm">{fc(item.price)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Menu items grid */}
      <section className="px-4 py-4">
        <h2 className="text-lg font-bold mb-3">
          {selectedCategory === 'all' ? 'Tous les plats' : getCategoryName(selectedCategory)}
        </h2>

        {filteredItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('restaurantPublicMenu.aucunPlatDisponibleDansCette')}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredItems.map(item => {
              const qty = getItemQuantity(item.id);
              return (
                <Card key={item.id} className={cn(
                  "overflow-hidden",
                  !item.is_available && "opacity-60"
                )}>
                  <CardContent className="p-0">
                    <div className="flex gap-3 p-3">
                      {/* Image */}
                      {(() => {
                        const allImages = item.images && item.images.length > 0
                          ? item.images
                          : item.image_url ? [item.image_url] : [];
                        const mainImg = allImages[0] || null;
                        return (
                          <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
                            {mainImg ? (
                              <img src={mainImg} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ChefHat className="w-8 h-8 text-muted-foreground" />
                              </div>
                            )}
                            {item.is_new && item.is_available && (
                              <Badge className="absolute top-1 left-1 text-[10px] px-1.5 py-0">{t('restaurantPublicMenu.nouveau')}</Badge>
                            )}
                            {allImages.length > 1 && (
                              <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded">
                                +{allImages.length - 1}
                              </span>
                            )}
                            {item.video_url && (
                              <span className="absolute bottom-1 left-1 bg-black/60 text-white rounded p-0.5">
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                              </span>
                            )}
                            {!item.is_available && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                                  Indisponible
                                </Badge>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className={cn(
                              "font-semibold text-sm line-clamp-1",
                              !item.is_available && "line-through text-muted-foreground"
                            )}>{item.name}</h3>
                            {item.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {!item.is_available && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-500 border-orange-200">
                              <Clock className="w-2.5 h-2.5 mr-0.5" /> Bientôt disponible
                            </Badge>
                          )}
                          {item.spicy_level > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-[#ff4000] border-orange-200">
                              🌶️ {item.spicy_level > 2 ? 'Très épicé' : 'Épicé'}
                            </Badge>
                          )}
                          {item.dietary_tags?.includes('vegetarian') && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-[#ff4000] border-orange-200">
                              <Leaf className="w-2.5 h-2.5 mr-0.5" /> Végé
                            </Badge>
                          )}
                          {item.preparation_time > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              <Clock className="w-2.5 h-2.5 mr-0.5" /> {item.preparation_time} min
                            </Badge>
                          )}
                        </div>

                        {/* Price & Add button */}
                        <div className="flex items-center justify-between mt-2">
                          <span className={cn(
                            "font-bold",
                            item.is_available ? "text-primary" : "text-muted-foreground"
                          )}>{fc(item.price)}</span>

                          {item.is_available ? (
                            qty > 0 ? (
                              <div className="flex items-center gap-2 bg-primary/10 rounded-full px-2 py-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="w-6 h-6 rounded-full"
                                  onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <span className="font-semibold text-sm w-5 text-center">{qty}</span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="w-6 h-6 rounded-full"
                                  onClick={(e) => { e.stopPropagation(); startAdd(item); }}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                className="h-8 gap-1 bg-[#ff4000] hover:bg-[#ff4000]"
                                onClick={() => openQuickOrder(item)}
                              >
                                <ShoppingCart className="w-3.5 h-3.5" />
                                Commander
                              </Button>
                            )
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Non disponible
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-30">
          <Sheet open={showCheckout} onOpenChange={setShowCheckout}>
            <SheetTrigger asChild>
              <Button className="w-full h-14 rounded-2xl shadow-xl gap-3 text-base">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  <Badge variant="secondary" className="bg-white text-primary">
                    {cartCount}
                  </Badge>
                </div>
                <span className="flex-1">{t('restaurantPublicMenu.voirLePanier')}</span>
                <span className="font-bold">{fc(cartTotal)}</span>
              </Button>
            </SheetTrigger>

            <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl max-h-[90vh] overflow-y-auto">
              <SheetHeader className="pb-4 border-b">
                <SheetTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Votre commande
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto py-4 space-y-6">
                {/* Cart items */}
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                      <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ChefHat className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm line-clamp-1">{item.name}</h4>
                        <p className="text-primary font-semibold text-sm">
                          {fc(item.price * item.quantity)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="w-7 h-7 rounded-full"
                          onClick={() => removeFromCart(item.id)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="font-semibold w-5 text-center">{item.quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="w-7 h-7 rounded-full"
                          onClick={() => startAdd(item)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Order type */}
                <div className="space-y-3">
                  <Label>{t('restaurantPublicMenu.typeDeCommande')}</Label>
                  <RadioGroup value={orderType} onValueChange={(v) => setOrderType(v as typeof orderType)}>
                    <div className="grid grid-cols-3 gap-2">
                      <label className={cn(
                        'flex flex-col items-center gap-1.5 p-3 border-2 rounded-xl cursor-pointer transition-colors text-center',
                        orderType === 'delivery' ? 'border-[#ff4000] bg-[#ff4000]/5' : 'border-border'
                      )}>
                        <RadioGroupItem value="delivery" className="sr-only" />
                        <span className="text-2xl">🛵</span>
                        <span className="text-xs font-semibold leading-tight">{t('restaurantPublicMenu.livraisonChezMoi')}</span>
                      </label>
                      <label className={cn(
                        'flex flex-col items-center gap-1.5 p-3 border-2 rounded-xl cursor-pointer transition-colors text-center',
                        orderType === 'takeaway' ? 'border-[#ff4000] bg-[#ff4000]/5' : 'border-border'
                      )}>
                        <RadioGroupItem value="takeaway" className="sr-only" />
                        <span className="text-2xl">🏃</span>
                        <span className="text-xs font-semibold leading-tight">Je viens chercher</span>
                      </label>
                      <label className={cn(
                        'flex flex-col items-center gap-1.5 p-3 border-2 rounded-xl cursor-pointer transition-colors text-center',
                        orderType === 'dine_in' ? 'border-[#ff4000] bg-[#ff4000]/5' : 'border-border'
                      )}>
                        <RadioGroupItem value="dine_in" className="sr-only" />
                        <span className="text-2xl">🪑</span>
                        <span className="text-xs font-semibold leading-tight">{t('restaurantPublicMenu.jeSuisATable')}</span>
                      </label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Champs conditionnels selon le mode (exactement comme le prompt) */}
                {orderType === 'takeaway' && (
                  <div className="rounded-xl border bg-muted/40 p-3 text-sm">
                    <p className="font-medium flex items-center gap-1"><MapPin className="w-4 h-4 text-[#ff4000]" /> {t('restaurantPublicMenu.recuperationAuRestaurant')}</p>
                    {restaurant?.address && <p className="text-muted-foreground mt-1">{restaurant.address}</p>}
                    <p className="text-muted-foreground mt-1">⏱️ Prête dans ~{Math.max(...cart.map(c => c.preparation_time || 15), 15)} min — une notification vous préviendra.</p>
                  </div>
                )}

                {/* Infos — SUR TABLE : juste les instructions (pas de nom/téléphone). LIVRAISON/À EMPORTER : coordonnées. */}
                <div className="space-y-3">
                  {orderType !== 'dine_in' && (() => {
                    const inPerson = ['orange_money', 'mobile_money', 'card', 'cash'].includes(paymentMethod);
                    const nameReq = inPerson; // requis pour livraison ET à emporter réglés en personne
                    const phoneReq = inPerson && orderType === 'delivery';
                    return (
                      <>
                        <div>
                          <Label htmlFor="name">Votre nom {nameReq ? <span className="text-[#ff4000]">*</span> : <span className="text-muted-foreground">(optionnel)</span>}</Label>
                          <Input id="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t('restaurantPublicMenu.entrezVotreNom')} className="mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="phone">Téléphone {phoneReq ? <span className="text-[#ff4000]">*</span> : <span className="text-muted-foreground">(optionnel)</span>}</Label>
                          <Input id="phone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Ex: 620 00 00 00" className="mt-1" />
                        </div>
                      </>
                    );
                  })()}

                  {orderType === 'dine_in' && (
                    qrTable ? (
                      <div className="rounded-lg border border-[#ff4000]/30 bg-[#ff4000]/5 px-3 py-2 text-sm font-semibold text-[#ff4000]">🪑 Table {tableNumber}</div>
                    ) : (
                      <div>
                        <Label htmlFor="table">{t('restaurantPublicMenu.numeroDeTable')}</Label>
                        <Input id="table" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} placeholder="Ex: 5" className="mt-1" />
                      </div>
                    )
                  )}

                  {orderType === 'delivery' && (
                    <div>
                      <Label htmlFor="address">{t('restaurantPublicMenu.adresseDeLivraison')}</Label>
                      <Textarea id="address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder={t('restaurantPublicMenu.entrezVotreAdresseComplete')} className="mt-1" rows={2} />
                      {/* Position GPS → frais calculés par distance ; affichage des frais de livraison. */}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={detectClientPosition} disabled={locating} className="gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {locating ? 'Localisation…' : clientCoords ? 'Position OK' : 'Utiliser ma position'}
                        </Button>
                        <span className="text-sm font-medium">
                          {deliveryOffered
                            ? <span className="text-[#ff4000]">{t('restaurantPublicMenu.livraisonOfferte')}</span>
                            : <>Frais : {fc(deliveryFeeEstimate)}{!clientCoords && <span className="text-xs text-muted-foreground font-normal"> {t('restaurantPublicMenu.deBase')}</span>}</>}
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="notes">Instructions (optionnel)</Label>
                    <Textarea id="notes" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder={t('restaurantPublicMenu.exSansOignonBienCuit')} className="mt-1" rows={2} />
                  </div>
                </div>

                {/* Paiement (mode-aware) : sur table = digital ; livraison = wallet + digital ; emporter = wallet + espèces + digital */}
                {renderPaymentSelector()}

                {/* Total */}
                <div className="pt-4 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sous-total</span>
                    <span>{fc(cartTotal)}</span>
                  </div>
                  {activePromo?.promo_type === 'percentage' && (
                    <div className="flex justify-between text-sm text-[#ff4000]">
                      <span>Promo {activePromo.title} (−{activePromo.value}%)</span>
                      <span>−{fc(Math.round(cartTotal * (Number(activePromo.value) || 0) / 100))}</span>
                    </div>
                  )}
                  {orderType === 'delivery' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('restaurantPublicMenu.fraisDeLivraison')}</span>
                      <span>{deliveryOffered ? <span className="text-[#ff4000]">Offerte</span> : fc(deliveryFeeEstimate)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">{fc(cartTotal - (activePromo?.promo_type === 'percentage' ? Math.round(cartTotal * (Number(activePromo.value) || 0) / 100) : 0) + deliveryFeeEstimate)}</span>
                  </div>
                  {paymentMethod === 'wallet' && <p className="text-xs text-muted-foreground">{t('restaurantPublicMenu.debiteDeVotreWalletA2')}</p>}
                </div>
              </div>

              {/* Submit button */}
              <div className="pt-4 border-t">
                <Button
                  className="w-full h-12 text-base"
                  onClick={() => handleSubmitOrder(false)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Confirmer la commande • {fc(cartTotal)}
                    </>
                  )}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      {/* Modal OPTIONS / SUPPLÉMENTS : choix avant ajout au panier (plats avec variants). */}
      <Dialog open={!!optionItem} onOpenChange={(o) => { if (!o) { setOptionItem(null); setOptionSel({}); } }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{optionItem?.name}</DialogTitle>
          </DialogHeader>
          {optionItem && (
            <div className="space-y-4">
              {(optionItem.variants?.groups || []).map((g) => {
                const single = (g.max ?? 1) <= 1;
                const cur = optionSel[g.id] || [];
                return (
                  <div key={g.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-semibold">{g.name}</Label>
                      <span className="text-xs text-muted-foreground">
                        {(g.min ?? 0) > 0 ? 'Obligatoire' : 'Facultatif'}{!single && g.max ? ` · max ${g.max}` : ''}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {g.options.map((o) => {
                        const checked = cur.includes(o.id);
                        return (
                          <label key={o.id} className={cn('flex items-center justify-between rounded-lg border p-2.5 cursor-pointer transition-colors', checked && 'border-[#ff4000] bg-[#ff4000]/5')}>
                            <span className="flex items-center gap-2 text-sm">
                              <input type={single ? 'radio' : 'checkbox'} checked={checked} onChange={() => toggleOption(g, o.id)} className="accent-[#ff4000]" />
                              {o.name}
                            </span>
                            {o.price > 0 && <span className="text-sm font-medium text-muted-foreground">+{fc(o.price)}</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <Button className="w-full bg-[#ff4000] hover:bg-[#e03900]" onClick={confirmAddOptions}>
                Ajouter au panier · {fc(
                  optionItem.price +
                  (optionItem.variants?.groups || []).reduce((s, g) => s + (optionSel[g.id] || []).reduce((ss, oid) => ss + (g.options.find(o => o.id === oid)?.price || 0), 0), 0)
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Order Modal - Achat direct */}
      <Dialog open={showQuickOrder} onOpenChange={setShowQuickOrder}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              Commander directement
            </DialogTitle>
          </DialogHeader>

          {orderSuccess ? (
            // Success state
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-orange-100 dark:bg-[#ff4000]/30 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-[#ff4000]" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#ff4000]">{t('restaurantPublicMenu.commandeEnvoyee')}</h3>
                <p className="text-muted-foreground mt-1">Référence: {lastOrderNumber}</p>
              </div>
              <Card className="bg-muted/50">
                <CardContent className="p-4 text-left space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Article</span>
                    <span className="font-medium">{quickOrderItem?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('restaurantPublicMenu.quantite')}</span>
                    <span className="font-medium">{quickOrderQuantity}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span className="text-primary">{fc(quickOrderTotal)}</span>
                  </div>
                </CardContent>
              </Card>
              {lastOrderId && (
                <Card><CardContent className="p-4 text-left">
                  <p className="mb-3 text-sm font-medium">{t('restaurantPublicMenu.suiviDeVotreCommande')}</p>
                  <RestaurantOrderTracker orderId={lastOrderId} />
                </CardContent></Card>
              )}
              <Button className="w-full" onClick={() => setShowQuickOrder(false)}>
                Fermer
              </Button>
            </div>
          ) : (
            // Order form
            <div className="space-y-4">
              {/* Item preview */}
              {quickOrderItem && (
                <Card>
                  <CardContent className="p-4">
                    {/* Galerie images + vidéo */}
                    {(() => {
                      const allImages = quickOrderItem.images && quickOrderItem.images.length > 0
                        ? quickOrderItem.images
                        : quickOrderItem.image_url ? [quickOrderItem.image_url] : [];
                      return (
                        <div className="mb-3 space-y-2">
                          {allImages.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                              {allImages.map((img, idx) => (
                                <img
                                  key={idx}
                                  src={img}
                                  alt={`Photo ${idx + 1}`}
                                  className={`flex-shrink-0 rounded-lg object-cover ${allImages.length === 1 ? 'w-full h-40' : 'w-32 h-24'}`}
                                />
                              ))}
                            </div>
                          )}
                          {quickOrderItem.video_url && (
                            <video
                              src={quickOrderItem.video_url}
                              controls
                              className="w-full rounded-lg max-h-40 bg-black object-contain"
                              preload="metadata"
                            />
                          )}
                        </div>
                      );
                    })()}
                    <div className="flex gap-3">
                      {!quickOrderItem.images?.length && !quickOrderItem.image_url && (
                        <div className="w-20 h-20 rounded-lg bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                          <ChefHat className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold">{quickOrderItem.name}</h3>
                        {quickOrderItem.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{quickOrderItem.description}</p>
                        )}
                        <p className="text-primary font-bold mt-1">{fc(quickOrderItem.price)}</p>
                      </div>
                    </div>

                    {/* Quantity selector */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t">
                      <span className="font-medium">{t('restaurantPublicMenu.quantite')}</span>
                      <div className="flex items-center gap-3">
                        <Button
                          size="icon"
                          variant="outline"
                          className="w-8 h-8 rounded-full"
                          onClick={() => setQuickOrderQuantity(q => Math.max(1, q - 1))}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="font-bold text-lg w-8 text-center">{quickOrderQuantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="w-8 h-8 rounded-full"
                          onClick={() => setQuickOrderQuantity(q => q + 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Order type */}
              <div className="space-y-2">
                <Label>{t('restaurantPublicMenu.typeDeCommande')}</Label>
                <RadioGroup value={orderType} onValueChange={(v) => setOrderType(v as typeof orderType)}>
                  <div className="grid grid-cols-3 gap-2">
                    <label className={cn(
                      'flex flex-col items-center gap-1.5 p-2.5 border-2 rounded-lg cursor-pointer transition-colors text-center',
                      orderType === 'delivery' ? 'border-[#ff4000] bg-[#ff4000]/5' : 'border-border'
                    )}>
                      <RadioGroupItem value="delivery" className="sr-only" />
                      <span className="text-2xl">🛵</span>
                      <span className="text-[11px] font-semibold leading-tight">{t('restaurantPublicMenu.livraisonChezMoi')}</span>
                    </label>
                    <label className={cn(
                      'flex flex-col items-center gap-1.5 p-2.5 border-2 rounded-lg cursor-pointer transition-colors text-center',
                      orderType === 'takeaway' ? 'border-[#ff4000] bg-[#ff4000]/5' : 'border-border'
                    )}>
                      <RadioGroupItem value="takeaway" className="sr-only" />
                      <span className="text-2xl">🏃</span>
                      <span className="text-[11px] font-semibold leading-tight">Je viens chercher</span>
                    </label>
                    <label className={cn(
                      'flex flex-col items-center gap-1.5 p-2.5 border-2 rounded-lg cursor-pointer transition-colors text-center',
                      orderType === 'dine_in' ? 'border-[#ff4000] bg-[#ff4000]/5' : 'border-border'
                    )}>
                      <RadioGroupItem value="dine_in" className="sr-only" />
                      <span className="text-2xl">🪑</span>
                      <span className="text-[11px] font-semibold leading-tight">{t('restaurantPublicMenu.jeSuisATable')}</span>
                    </label>
                  </div>
                </RadioGroup>
              </div>

              {/* Infos — SUR TABLE : aucun nom/téléphone (juste table + instructions). Sinon : coordonnées. */}
              {orderType !== 'dine_in' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="quick-name">Nom (optionnel)</Label>
                    <Input id="quick-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t('restaurantPublicMenu.votreNom2')} className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="quick-phone">{t('restaurantPublicMenu.telephoneOptionnel')}</Label>
                    <Input id="quick-phone" type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="620 00 00 00" className="mt-1" />
                  </div>
                </div>
              )}

              {orderType === 'dine_in' && (
                qrTable ? (
                  <div className="rounded-lg border border-[#ff4000]/30 bg-[#ff4000]/5 px-3 py-2 text-sm font-semibold text-[#ff4000]">🪑 Table {tableNumber}</div>
                ) : (
                  <div>
                    <Label htmlFor="quick-table">{t('restaurantPublicMenu.numeroDeTable')}</Label>
                    <Input id="quick-table" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} placeholder="Ex: 5" className="mt-1" />
                  </div>
                )
              )}

              {orderType === 'delivery' && (
                <div>
                  <Label htmlFor="quick-address">{t('restaurantPublicMenu.adresseDeLivraison')}</Label>
                  <Input id="quick-address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder={t('restaurantPublicMenu.votreAdresse')} className="mt-1" />
                </div>
              )}

              {/* Paiement (mode-aware) — partagé avec le panier */}
              {renderPaymentSelector()}

              {/* Notes */}
              <div>
                <Label htmlFor="quick-notes">Instructions (optionnel)</Label>
                <Textarea
                  id="quick-notes"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder={t('restaurantPublicMenu.sansOignonBienCuit')}
                  className="mt-1"
                  rows={2}
                />
              </div>

              {/* Total & Submit */}
              <div className="pt-3 border-t space-y-3">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{fc(quickOrderTotal)}</span>
                </div>

                <Button
                  className="w-full h-12 text-base bg-[#ff4000] hover:bg-[#ff4000]"
                  onClick={() => handleSubmitOrder(true)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Confirmer la commande
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
