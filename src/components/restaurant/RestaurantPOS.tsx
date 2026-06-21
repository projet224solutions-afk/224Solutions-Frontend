/**
 * Restaurant POS - Point de vente pour plats, boissons et services
 * Utilise le menu du restaurant pour créer des ventes rapides
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useRestaurantMenu, type MenuItem } from '@/hooks/useRestaurantMenu';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import offlineDB from '@/lib/offlineDB';
import { StripeCardPaymentModal } from '@/components/pos/StripeCardPaymentModal';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Receipt,
  UtensilsCrossed, MapPin, Truck, ShoppingBag, Printer,
  Check, X, Users, Clock, CreditCard, Banknote, Smartphone, Download
} from 'lucide-react';

interface RestaurantPOSProps {
  serviceId: string;
  businessName?: string;
}

interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

type OrderType = 'sur_place' | 'emporter' | 'livraison';
type PaymentMethod = 'cash' | 'mobile_money' | 'card';

const ORDER_TYPES: { value: OrderType; label: string; icon: React.ReactNode }[] = [
  { value: 'sur_place', label: 'Sur place', icon: <MapPin className="w-4 h-4" /> },
  { value: 'emporter', label: 'À emporter', icon: <ShoppingBag className="w-4 h-4" /> },
  { value: 'livraison', label: 'Livraison', icon: <Truck className="w-4 h-4" /> },
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'cash', label: 'Espèces', icon: <Banknote className="w-4 h-4" /> },
  { value: 'mobile_money', label: 'Mobile Money', icon: <Smartphone className="w-4 h-4" /> },
  { value: 'card', label: 'Carte', icon: <CreditCard className="w-4 h-4" /> },
];

export function RestaurantPOS({ serviceId, businessName }: RestaurantPOSProps) {
  const { t } = useTranslation();
  const formatCurrency = useFormatCurrency();
  const { categories, menuItems, loading, refresh: refreshMenu, decrementLocalStock } = useRestaurantMenu(serviceId);

  // Décrémente le stock des plats vendus (plats suivis uniquement). RLS = le restaurateur ne
  // modifie que ses propres plats. Rafraîchit ensuite le menu (nouveau « restant »).
  const consumeStock = useCallback(async (lines: { menuItemId: string; quantity: number }[]) => {
    const tracked = lines
      .map(l => ({ l, mi: menuItems.find(m => m.id === l.menuItemId) }))
      .filter(x => x.mi && (x.mi as any).stock_quantity != null);
    for (const { l, mi } of tracked) {
      const cur = Number((mi as any).stock_quantity) || 0;
      const next = Math.max(0, cur - l.quantity);
      await supabase.from('restaurant_menu_items')
        .update({ stock_quantity: next, is_available: next > 0 ? (mi as any).is_available : false })
        .eq('id', l.menuItemId);
    }
    if (tracked.length) await refreshMenu();
  }, [menuItems, refreshMenu]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products'); // bascule Plats/Panier sur mobile
  const [orderType, setOrderType] = useState<OrderType>('sur_place');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [pendingCardOrder, setPendingCardOrder] = useState<{ orderId: string; amount: number } | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Logo du restaurant (pour l'en-tête du reçu imprimé/téléchargé). Préchargé pour une impression fiable.
  useEffect(() => {
    if (!serviceId) return;
    let alive = true;
    supabase.from('professional_services').select('logo_url').eq('id', serviceId).maybeSingle()
      .then(({ data }) => {
        const url = (data as any)?.logo_url || null;
        if (!alive || !url) return;
        setLogoUrl(url);
        const img = new Image(); img.src = url; // précharge (cache navigateur)
      });
    return () => { alive = false; };
  }, [serviceId]);

  // Filter available items
  const availableItems = useMemo(() => {
    let items = menuItems.filter(i => i.is_available);

    if (selectedCategory) {
      items = items.filter(i => i.category_id === selectedCategory);
    }

    if (selectedSection !== 'all') {
      items = items.filter(i => ((i as any).section || '') === selectedSection);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [menuItems, selectedCategory, selectedSection, search]);

  // Sections disponibles (filtrées par catégorie sélectionnée), comme le POS vendeur.
  const availableSections = useMemo(() => {
    const inCat = selectedCategory ? menuItems.filter(i => i.category_id === selectedCategory) : menuItems;
    return [...new Set(inCat.map(i => (i as any).section).filter(Boolean))].sort() as string[];
  }, [menuItems, selectedCategory]);

  const addToCart = useCallback((item: MenuItem) => {
    // STOCK : si le plat a un stock suivi, on n'ajoute pas au-delà du nombre restant.
    const stock = (item as any).stock_quantity;
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id);
      const current = existing?.quantity || 0;
      if (stock != null && current >= stock) {
        toast.error(stock <= 0 ? `${item.name} : épuisé` : `${item.name} : ${stock} en stock seulement`);
        return prev;
      }
      if (existing) {
        return prev.map(c =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, {
        id: crypto.randomUUID(),
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
      }];
    });
  }, []);

  const updateQuantity = useCallback((id: string, delta: number) => {
    setCart(prev => prev
      .map(c => c.id === id ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c)
      .filter(c => c.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(c => c.id !== id));
  }, []);

  const subtotal = useMemo(() => cart.reduce((sum, c) => sum + c.price * c.quantity, 0), [cart]);
  const totalItems = useMemo(() => cart.reduce((sum, c) => sum + c.quantity, 0), [cart]);

  // Synchronisation des ventes encaissées hors ligne : au montage de la caisse et à chaque
  // retour de connexion. Silencieux s'il n'y a rien (pas de spam) ; rafraîchit le menu si des
  // ventes ont été poussées (le stock a pu être décrémenté côté serveur).
  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    const run = async () => {
      if (!navigator.onLine) return;
      try {
        const { syncOfflineRestaurantSales } = await import('@/lib/offlineRestaurantSync');
        const res = await syncOfflineRestaurantSales({ serviceId });
        if (!cancelled && res.synced > 0) {
          toast.success(`${res.synced} vente(s) hors ligne synchronisée(s)`);
          refreshMenu();
        }
      } catch {
        /* transitoire : le scheduler réessaiera */
      }
    };
    run();
    window.addEventListener('online', run);
    return () => { cancelled = true; window.removeEventListener('online', run); };
  }, [serviceId, refreshMenu]);

  const handleSubmitOrder = async () => {
    if (cart.length === 0) return;

    setSubmitting(true);

    // Normalise le type de commande POS (FR) vers l'enum de restaurant_orders.
    const ORDER_TYPE_DB: Record<OrderType, 'dine_in' | 'takeaway' | 'delivery'> = {
      sur_place: 'dine_in', emporter: 'takeaway', livraison: 'delivery',
    };

    // ─────────────────────────────────────────────────────────────────────
    // MODE HORS LIGNE : encaisser SANS connexion. La vente (réglée en personne au
    // comptoir) est stockée dans IndexedDB puis rejouée à la reconnexion via la RPC
    // atomique create_restaurant_pos_offline_order (insert + stock, idempotent).
    // Le paiement carte hors ligne = règlement TPE externe → enregistré 'paid'
    // (Stripe est injoignable sans réseau, on n'ouvre donc pas le modal).
    // ─────────────────────────────────────────────────────────────────────
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const offlineOrderNumber = `RESTO-OFF-${Date.now().toString(36).toUpperCase()}`;
      const createdAt = new Date().toISOString();
      const itemsPayload = cart.map(c => ({
        menu_item_id: c.menuItemId,
        name: c.name,
        price: c.price,
        quantity: c.quantity,
        subtotal: c.price * c.quantity,
        notes: c.notes || null,
      }));
      try {
        await offlineDB.initDB();
        await offlineDB.storeEvent({
          type: 'restaurant_pos_sale',
          vendor_id: serviceId, // = professional_service_id (clé de scope de la sync)
          created_at: createdAt,
          data: {
            order_number: offlineOrderNumber,
            order_type: ORDER_TYPE_DB[orderType],
            status: 'completed',
            customer_name: customerName || 'Client',
            table_number: orderType === 'sur_place' ? (tableNumber || null) : null,
            payment_method: paymentMethod,
            payment_status: 'paid',
            subtotal,
            tax: 0,
            discount_amount: 0,
            total: subtotal,
            notes: orderNotes || null,
            items: itemsPayload,
            sale_date: createdAt,
          },
        }, true);

        setLastOrder({
          id: offlineOrderNumber,
          order_number: offlineOrderNumber,
          created_at: createdAt,
          customer_name: customerName || 'Client',
          order_type: ORDER_TYPE_DB[orderType],
          table_number: orderType === 'sur_place' ? (tableNumber || null) : null,
          payment_method: paymentMethod,
          items: itemsPayload,
          total: subtotal,
          subtotal,
        });
        // Décrément du stock affiché (+ cache) AVANT de vider le panier → le « restant »
        // baisse immédiatement, même hors ligne. Le serveur se cale à la resync.
        decrementLocalStock(cart.map(c => ({ menuItemId: c.menuItemId, quantity: c.quantity })));
        setIsCheckoutOpen(false);
        setIsReceiptOpen(true);
        setCart([]);
        setCustomerName('');
        setTableNumber('');
        setOrderNotes('');
        toast.success(t('restaurantPOS.venteEnregistreeHorsLigne'), {
          description: `N° ${offlineOrderNumber.slice(-6)} — synchronisée dès le retour de la connexion.`,
          duration: 5000,
        });
      } catch (offlineErr: any) {
        console.error('Erreur enregistrement caisse hors ligne:', offlineErr);
        toast.error("Erreur d'enregistrement hors ligne", {
          description: offlineErr?.message || 'Veuillez réessayer.',
        });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      // Pour le paiement carte, créer la commande en statut 'pending' d'abord
      const isPendingPayment = paymentMethod === 'card';

      // CAISSE COMPTOIR : une vente réglée au comptoir (espèces/mobile) est FINALISÉE et PAYÉE
      // immédiatement — elle ne doit JAMAIS atterrir dans la file « commandes à accepter » du
      // Kanban (le restaurateur l'a saisie lui-même). Seule la carte reste 'pending' le temps du
      // paiement Stripe, puis passe 'completed'/'paid' dans handleStripeSuccess.
      const orderData = {
        professional_service_id: serviceId,
        order_type: ORDER_TYPE_DB[orderType],
        status: isPendingPayment ? 'pending' : 'completed',
        source: 'pos',
        customer_name: customerName || 'Client',
        table_number: orderType === 'sur_place' ? (tableNumber || null) : null,
        total: subtotal,
        subtotal: subtotal,
        payment_method: paymentMethod,
        payment_status: isPendingPayment ? 'pending' : 'paid',
        completed_at: isPendingPayment ? null : new Date().toISOString(),
        notes: orderNotes || null,
        items: cart.map(c => ({
          menu_item_id: c.menuItemId,
          name: c.name,
          price: c.price,
          quantity: c.quantity,
          notes: c.notes,
          subtotal: c.price * c.quantity,
        })),
      };

      const { data, error } = await supabase
        .from('restaurant_orders')
        .insert([orderData])
        .select()
        .single();

      if (error) throw error;

      // Si paiement par carte, ouvrir le modal Stripe
      if (isPendingPayment) {
        setPendingCardOrder({ orderId: data.id, amount: subtotal });
        setShowStripeModal(true);
        setIsCheckoutOpen(false);
        setSubmitting(false);
        return;
      }

      setLastOrder({ ...orderData, id: data.id, created_at: data.created_at });
      setIsCheckoutOpen(false);
      setIsReceiptOpen(true);

      // Décrémente le stock des plats vendus AVANT de vider le panier.
      void consumeStock(cart.map(c => ({ menuItemId: c.menuItemId, quantity: c.quantity })));

      // Reset
      setCart([]);
      setCustomerName('');
      setTableNumber('');
      setOrderNotes('');

      toast.success(`Commande #${data.id.slice(-6).toUpperCase()} créée !`);
    } catch (error: any) {
      console.error('Erreur création commande:', error);
      toast.error(t('restaurantPOS.erreurLorsDeLaCreation'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStripeSuccess = async (_paymentIntentId: string) => {
    if (!pendingCardOrder) return;

    try {
      // Carte réglée → vente de caisse FINALISÉE et payée (sort de l'état 'pending' transitoire).
      await supabase
        .from('restaurant_orders')
        .update({ payment_status: 'paid', status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', pendingCardOrder.orderId);

      const { data: order } = await supabase
        .from('restaurant_orders')
        .select('*')
        .eq('id', pendingCardOrder.orderId)
        .single();

      if (order) {
        setLastOrder(order);
      }

      setShowStripeModal(false);
      setPendingCardOrder(null);
      setIsReceiptOpen(true);

      // Décrémente le stock des plats vendus AVANT de vider le panier.
      void consumeStock(cart.map(c => ({ menuItemId: c.menuItemId, quantity: c.quantity })));

      // Reset
      setCart([]);
      setCustomerName('');
      setTableNumber('');
      setOrderNotes('');

      toast.success(t('restaurantPOS.paiementParCarteReussi'));
    } catch (err) {
      console.error('Error updating order after payment:', err);
      toast.error(t('restaurantPOS.paiementRecuMaisErreurDe'));
    }
  };

  // Télécharge le reçu de la dernière commande (fichier texte imprimable).
  const downloadReceipt = () => {
    if (!lastOrder) return;
    const ref = lastOrder.id?.slice(-6).toUpperCase() || '------';
    const money = (n: any) => `${formatCurrency(Number(n) || 0)}`;
    const lines = [
      '        REÇU DE COMMANDE',
      `        N° ${ref}`,
      `        ${new Date(lastOrder.created_at).toLocaleString('fr-FR')}`,
      '----------------------------------------',
      `Client   : ${lastOrder.customer_name || '-'}`,
      `Type     : ${ORDER_TYPES.find(ty => ty.value === lastOrder.order_type)?.label || lastOrder.order_type}`,
      lastOrder.table_number ? `Table    : ${lastOrder.table_number}` : '',
      `Paiement : ${PAYMENT_METHODS.find(m => m.value === lastOrder.payment_method)?.label || lastOrder.payment_method}`,
      '----------------------------------------',
      ...(lastOrder.items || []).map((it: any) => `${it.quantity}x ${it.name}`.padEnd(28) + money(it.subtotal ?? it.price * it.quantity)),
      '----------------------------------------',
      `TOTAL    : ${money(lastOrder.total ?? lastOrder.total_amount ?? 0)}`,
      '',
      '        Merci de votre visite !',
    ].filter(Boolean);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `recu-${ref}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Imprime le reçu (ouvre une fenêtre formatée façon ticket de caisse et lance l'impression).
  const printReceipt = async () => {
    if (!lastOrder) return;
    const ref = lastOrder.id?.slice(-6).toUpperCase() || '------';
    const money = (n: any) => formatCurrency(Number(n) || 0);
    const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
    const rows = (lastOrder.items || []).map((it: any) =>
      `<tr><td>${it.quantity}× ${esc(it.name)}</td><td class="r">${money(it.subtotal ?? it.price * it.quantity)}</td></tr>`).join('');
    // Précharge le logo pour qu'il soit présent (en cache) au moment de l'impression.
    if (logoUrl) {
      await new Promise((res) => { const im = new Image(); im.onload = () => res(null); im.onerror = () => res(null); im.src = logoUrl; });
    }
    const logoTag = logoUrl ? `<img src="${esc(logoUrl)}" alt="logo" class="logo" />` : '';
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Reçu ${ref}</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        body { font-family: 'Courier New', monospace; width: 72mm; margin: 0 auto; color: #000; font-size: 12px; }
        h1 { font-size: 14px; text-align: center; margin: 0 0 2px; }
        .logo { display: block; margin: 0 auto 4px; max-height: 48px; max-width: 60mm; object-fit: contain; }
        .c { text-align: center; } .r { text-align: right; }
        hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; } td { padding: 1px 0; vertical-align: top; }
        .tot { font-weight: bold; font-size: 13px; }
      </style></head><body>
      ${logoTag}
      <h1>${esc(businessName || 'Restaurant')}</h1>
      <div class="c">Reçu N° ${ref}<br/>${new Date(lastOrder.created_at).toLocaleString('fr-FR')}</div>
      <hr/>
      <div>Client : ${esc(lastOrder.customer_name || '-')}</div>
      <div>Type : ${esc(ORDER_TYPES.find(ty => ty.value === lastOrder.order_type)?.label || lastOrder.order_type)}</div>
      ${lastOrder.table_number ? `<div>Table : ${esc(lastOrder.table_number)}</div>` : ''}
      <div>Paiement : ${esc(PAYMENT_METHODS.find(m => m.value === lastOrder.payment_method)?.label || lastOrder.payment_method)}</div>
      <hr/>
      <table>${rows}</table>
      <hr/>
      <table><tr class="tot"><td>TOTAL</td><td class="r">${money(lastOrder.total ?? lastOrder.total_amount ?? 0)}</td></tr></table>
      <hr/>
      <div class="c">{t('restaurantPOS.merciDeVotreVisite')}</div>
      </body></html>`;
    // Impression via une IFRAME cachée (fiable, pas de pop-up bloquée ni de page blanche).
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { toast.error('Impression indisponible.'); iframe.remove(); return; }
    doc.open();
    doc.write(html);
    doc.close();
    // Laisser le rendu (et les polices) se faire avant d'imprimer, puis nettoyer.
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch { toast.error(t('restaurantPOS.impossibleDeLancerLImpression')); }
      setTimeout(() => iframe.remove(), 1000);
    }, 300);
  };

  const handleStripeError = (error: string) => {
    console.error('Stripe payment error:', error);
    toast.error(`Erreur de paiement: ${error}`);
    setShowStripeModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-200px)] min-h-[500px]">
      {/* Onglets MOBILE (Plats / Panier) — masqués dès md, où le panier passe à droite */}
      <div className="flex gap-2 md:hidden">
        <Button variant={mobileTab === 'products' ? 'default' : 'outline'} size="sm" className="flex-1 gap-1" onClick={() => setMobileTab('products')}>
          <UtensilsCrossed className="w-4 h-4" /> Plats
        </Button>
        <Button variant={mobileTab === 'cart' ? 'default' : 'outline'} size="sm" className="flex-1 gap-1" onClick={() => setMobileTab('cart')}>
          <ShoppingCart className="w-4 h-4" /> Panier ({totalItems})
        </Button>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
      {/* LEFT: Menu Items */}
      <div className={`flex-1 min-w-0 flex-col gap-3 ${mobileTab === 'products' ? 'flex' : 'hidden'} md:flex`}>
        {/* Search & Categories */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('restaurantPOS.rechercherUnPlat')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            <Button
              variant={selectedCategory === null ? 'filter-active' : 'filter'}
              size="sm"
              onClick={() => { setSelectedCategory(null); setSelectedSection('all'); }}
              className="whitespace-nowrap text-xs"
            >
              Tous
            </Button>
            {categories.filter(c => c.is_active).map(cat => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? 'filter-active' : 'filter'}
                size="sm"
                onClick={() => { setSelectedCategory(cat.id); setSelectedSection('all'); }}
                className="whitespace-nowrap text-xs"
              >
                {cat.icon || '🍽️'} {cat.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Filtre par SECTION (comme le POS vendeur) — affiché s'il existe des sections */}
        {availableSections.length > 0 && (
          <div className="flex gap-1 overflow-x-auto pb-1">
            <Button
              variant={selectedSection === 'all' ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setSelectedSection('all')}
              className="whitespace-nowrap text-xs"
            >
              Toutes sections
            </Button>
            {availableSections.map(s => (
              <Button
                key={s}
                variant={selectedSection === s ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setSelectedSection(s)}
                className="whitespace-nowrap text-xs"
              >
                {s}
              </Button>
            ))}
          </div>
        )}

        {/* Order Type Selector */}
        <div className="flex gap-2">
          {ORDER_TYPES.map(type => (
            <Button
              key={type.value}
              variant={orderType === type.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setOrderType(type.value)}
              className="gap-1 text-xs flex-1"
            >
              {type.icon} {type.label}
            </Button>
          ))}
        </div>

        {/* Récap stock : nombre de plats au menu + disponibles + en rupture */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="gap-1"><UtensilsCrossed className="w-3 h-3" />{menuItems.length} plats au menu</Badge>
          <Badge variant="outline" className="text-emerald-700 border-emerald-300">{menuItems.filter(i => i.is_available).length} disponibles</Badge>
          {menuItems.filter(i => (i as any).stock_quantity != null && (i as any).stock_quantity <= 0).length > 0 && (
            <Badge variant="outline" className="text-red-700 border-red-300">{menuItems.filter(i => (i as any).stock_quantity != null && (i as any).stock_quantity <= 0).length} épuisés</Badge>
          )}
          {(() => { const tracked = menuItems.filter(i => (i as any).stock_quantity != null); const tot = tracked.reduce((s, i) => s + Number((i as any).stock_quantity || 0), 0); return tracked.length > 0 ? <Badge variant="outline">{tot} portions en stock</Badge> : null; })()}
        </div>

        {/* Menu Grid */}
        <ScrollArea className="flex-1">
          {availableItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <UtensilsCrossed className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">{t('restaurantPOS.aucunPlatDisponible')}</p>
              <p className="text-xs">{t('restaurantPOS.ajoutezDesPlatsDepuisL')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {availableItems.map(item => {
                const inCart = cart.find(c => c.menuItemId === item.id);
                return (
                  <Card
                    key={item.id}
                    className={`cursor-pointer hover:shadow-md transition-all relative ${
                      inCart ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => addToCart(item)}
                  >
                    {item.image_url && (
                      <div className="h-20 overflow-hidden rounded-t-lg">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardContent className="p-2">
                      <p className="font-medium text-xs line-clamp-2 leading-tight">{item.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-bold text-primary">
                          {formatCurrency(item.price)}
                        </span>
                        {item.is_new && (
                          <Badge className="text-[8px] px-1 py-0 bg-orange-500">NEW</Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        {item.preparation_time > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="w-3 h-3" />{item.preparation_time} min
                          </span>
                        )}
                        {/* STOCK : restant (suivi) ; « illimité » si non suivi. */}
                        {(item as any).stock_quantity != null && (
                          <span className={`text-[10px] font-semibold ${(item as any).stock_quantity <= 0 ? 'text-red-600' : (item as any).stock_quantity <= 5 ? 'text-orange-600' : 'text-emerald-600'}`}>
                            {(item as any).stock_quantity <= 0 ? 'Épuisé' : `${(item as any).stock_quantity} rest.`}
                          </span>
                        )}
                      </div>
                      {inCart && (
                        <Badge className="absolute top-1 right-1 text-[10px] px-1.5 py-0">
                          x{inCart.quantity}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* RIGHT: Cart (à droite dès md ; onglet sur mobile) */}
      <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 flex-col border rounded-lg bg-card ${mobileTab === 'cart' ? 'flex' : 'hidden'} md:flex`}>
        <div className="p-3 border-b flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <ShoppingCart className="w-4 h-4" />
            Panier ({totalItems})
          </h3>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setCart([])}>
              <Trash2 className="w-3 h-3 mr-1" />
              Vider
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 p-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <ShoppingCart className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-xs">Panier vide</p>
              <p className="text-[10px]">{t('restaurantPOS.cliquezSurUnPlatPour')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map(item => (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.name}</p>
                    <p className="text-xs text-primary font-semibold">
                      {formatCurrency(item.price * item.quantity)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => updateQuantity(item.id, -1)}
                    >
                      <Minus className="w-3 h-3" />
                    </Button>
                    <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => updateQuantity(item.id, 1)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Cart Footer */}
        <div className="p-3 border-t space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Total</span>
            <span className="text-lg font-bold text-primary">{formatCurrency(subtotal)}</span>
          </div>
          <Button
            className="w-full gap-2"
            disabled={cart.length === 0}
            onClick={() => setIsCheckoutOpen(true)}
          >
            <Receipt className="w-4 h-4" />
            Valider ({totalItems} articles)
          </Button>
        </div>
      </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Finaliser la commande
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.quantity}x {item.name}</span>
                  <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(subtotal)}</span>
              </div>
            </div>

            {/* Customer Info */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">{t('restaurantPOS.nomDuClient')}</label>
                <Input
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder={t('restaurantPOS.client')}
                  className="h-9"
                />
              </div>

              {orderType === 'sur_place' && (
                <div>
                  <label className="text-xs font-medium mb-1 block">N° Table</label>
                  <Input
                    value={tableNumber}
                    onChange={e => setTableNumber(e.target.value)}
                    placeholder="Ex: 5"
                    className="h-9"
                  />
                </div>
              )}

              {/* Payment Method */}
              <div>
                <label className="text-xs font-medium mb-1 block">{t('restaurantPOS.modeDePaiement')}</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map(method => (
                    <Button
                      key={method.value}
                      variant={paymentMethod === method.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentMethod(method.value)}
                      className="gap-1 text-xs"
                    >
                      {method.icon} {method.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Notes</label>
                <Textarea
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  placeholder={t('restaurantPOS.instructionsSpeciales')}
                  className="h-16 text-sm"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsCheckoutOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmitOrder} disabled={submitting} className="gap-2">
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                  Envoi...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Confirmer • {formatCurrency(subtotal)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#ff4000]">
              <Check className="w-5 h-5" />
              Commande enregistrée !
            </DialogTitle>
          </DialogHeader>

          {lastOrder && (
            <div className="bg-muted/30 rounded-lg p-4 font-mono text-xs space-y-2">
              <div className="text-center border-b pb-2">
                {logoUrl && <img src={logoUrl} alt="logo" className="mx-auto mb-1 max-h-12 object-contain" />}
                {businessName && <p className="font-bold text-sm">{businessName}</p>}
                <p className="font-bold text-sm">{t('restaurantPOS.recuDeCommande')}</p>
                <p>#{lastOrder.id?.slice(-6).toUpperCase()}</p>
                <p>{new Date(lastOrder.created_at).toLocaleString('fr-FR')}</p>
              </div>

              <div className="border-b pb-2">
                <p><strong>{t('restaurantPOS.client2')}</strong> {lastOrder.customer_name}</p>
                <p><strong>Type:</strong> {ORDER_TYPES.find(t => t.value === lastOrder.order_type)?.label}</p>
                {lastOrder.table_number && <p><strong>Table:</strong> {lastOrder.table_number}</p>}
                <p><strong>{t('restaurantPOS.paiement')}</strong> {PAYMENT_METHODS.find(m => m.value === lastOrder.payment_method)?.label}</p>
              </div>

              <div className="space-y-1 border-b pb-2">
                {lastOrder.items?.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.quantity}x {item.name}</span>
                    <span>{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between font-bold text-sm pt-1">
                <span>TOTAL</span>
                <span>{formatCurrency(lastOrder.total ?? lastOrder.total_amount ?? 0)}</span>
              </div>
            </div>
          )}

          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Button onClick={printReceipt} className="w-full gap-2 bg-[#04439e] hover:bg-[#04439e]/90">
              <Printer className="w-4 h-4" /> Imprimer
            </Button>
            <Button onClick={downloadReceipt} variant="secondary" className="w-full gap-2">
              <Download className="w-4 h-4" /> Télécharger
            </Button>
            <Button variant="outline" onClick={() => setIsReceiptOpen(false)} className="w-full col-span-2 sm:col-span-1">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Stripe pour paiement par carte */}
      {pendingCardOrder && (
        <StripeCardPaymentModal
          isOpen={showStripeModal}
          onClose={() => {
            setShowStripeModal(false);
            setPendingCardOrder(null);
          }}
          amount={pendingCardOrder.amount}
          orderId={pendingCardOrder.orderId}
          sellerId={serviceId}
          description={`Commande restaurant #${pendingCardOrder.orderId.slice(-6).toUpperCase()}`}
          edgeFunction="restaurant-payment"
          extraParams={{ serviceId }}
          onSuccess={handleStripeSuccess}
          onError={handleStripeError}
        />
      )}
    </div>
  );
}

export default RestaurantPOS;
