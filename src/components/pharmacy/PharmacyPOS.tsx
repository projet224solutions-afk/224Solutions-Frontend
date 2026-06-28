import { useTranslation } from "@/hooks/useTranslation";
/**
 * 💊 CAISSE PHARMACIE (POS comptoir) — vente en personne de médicaments du catalogue.
 * Fonctionne EN LIGNE (RPC atomique create_pharmacy_pos_offline_order : insert + stock) et
 * HORS LIGNE (stockée dans IndexedDB, rejouée à la reconnexion). Réglée en personne → aucun
 * mouvement wallet, aucune commission (comme la caisse restaurant).
 *
 * Sécurité médicale : un médicament « sur ordonnance » affiche un rappel — le pharmacien (présent)
 * reste responsable de vérifier l'ordonnance papier avant délivrance. Pas de conseil médical.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { usePharmacyMedications, type Medication } from '@/hooks/usePharmacy';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import offlineDB from '@/lib/offlineDB';
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Receipt, Pill, Check, X,
  Banknote, Smartphone, CreditCard, Printer, Download, ShieldAlert, WifiOff,
} from 'lucide-react';

type PaymentMethod = 'cash' | 'mobile_money' | 'card';
const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'cash', label: "Espèces", icon: <Banknote className="w-4 h-4" /> },
  { value: 'mobile_money', label: 'Mobile Money', icon: <Smartphone className="w-4 h-4" /> },
  { value: 'card', label: 'Carte', icon: <CreditCard className="w-4 h-4" /> },
];

interface CartItem { id: string; medicationId: string; name: string; price: number; quantity: number; }

export function PharmacyPOS({ serviceId, businessName }: { serviceId: string; businessName?: string }) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { medications, loading, reload } = usePharmacyMedications(serviceId);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [customerName, setCustomerName] = useState('');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  // CONFORMITÉ 1.3 — médicaments contrôlés/stupéfiants présents dans le panier
  const controlledInCart = useMemo(
    () => cart.filter((c) => {
      const med = medications.find((m) => m.id === c.medicationId);
      return med && ['controlled', 'narcotic'].includes((med as any).control_level);
    }),
    [cart, medications]
  );
  const [dispensationInfo, setDispensationInfo] = useState({
    patientName: '', patientIdRef: '', prescriptionRef: '', prescriberName: '',
  });
  // AMÉLIORATIONS 2.2 (génériques en stock) + 2.3 (pharmacies proches) sur rupture
  const [altMed, setAltMed] = useState<Medication | null>(null);
  const [alternatives, setAlternatives] = useState<any[]>([]);
  const [nearby, setNearby] = useState<any[] | null>(null);
  const [altLoading, setAltLoading] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const openAlternatives = async (m: Medication) => {
    setAltMed(m); setAlternatives([]); setNearby(null); setAltLoading(true);
    const { data } = await supabase.rpc('generic_alternatives' as any, { p_medication_id: m.id });
    setAlternatives((data as any)?.success ? (data as any).alternatives || [] : []);
    setAltLoading(false);
  };
  const searchNearby = () => {
    if (!altMed || typeof navigator === 'undefined' || !navigator.geolocation) { toast.error('Géolocalisation indisponible'); return; }
    setNearbyLoading(true); setNearby(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { data } = await supabase.rpc('find_medication_nearby' as any, {
          p_medication_name: altMed.name, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_radius_km: 20,
        });
        setNearby((data as any)?.success ? (data as any).pharmacies || [] : []);
        setNearbyLoading(false);
      },
      () => { toast.error('Position indisponible'); setNearbyLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  const addAlternativeToCart = (altId: string) => {
    const med = medications.find((m) => m.id === altId);
    if (med) addToCart(med);
    setAltMed(null);
  };

  useEffect(() => {
    if (!serviceId) return;
    let alive = true;
    supabase.from('professional_services').select('logo_url').eq('id', serviceId).maybeSingle()
      .then(({ data }) => { const u = (data as any)?.logo_url; if (alive && u) { setLogoUrl(u); const i = new Image(); i.src = u; } });
    return () => { alive = false; };
  }, [serviceId]);

  // Sync des ventes hors ligne : au montage + retour de connexion.
  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    const run = async () => {
      if (!navigator.onLine) return;
      try {
        const { syncOfflinePharmacySales } = await import('@/lib/offlinePharmacySync');
        const res = await syncOfflinePharmacySales({ serviceId });
        if (!cancelled && res.synced > 0) { toast.success(`${res.synced} vente(s) hors ligne synchronisée(s)`); reload(); }
      } catch { /* le scheduler réessaiera */ }
    };
    run();
    window.addEventListener('online', run);
    return () => { cancelled = true; window.removeEventListener('online', run); };
  }, [serviceId, reload]);

  const items = useMemo(() => {
    let arr = medications.filter((m) => m.is_active);
    if (search.trim()) { const q = search.toLowerCase(); arr = arr.filter((m) => m.name.toLowerCase().includes(q) || (m.dosage || '').toLowerCase().includes(q)); }
    return arr;
  }, [medications, search]);

  const addToCart = useCallback((m: Medication) => {
    setCart((prev) => {
      const ex = prev.find((c) => c.medicationId === m.id);
      const cur = ex?.quantity || 0;
      if (m.stock != null && cur >= m.stock) { toast.error(m.stock <= 0 ? `${m.name} : épuisé` : `${m.name} : ${m.stock} en stock seulement`); return prev; }
      if (m.requires_prescription && cur === 0) toast.warning(`${m.name} : sur ordonnance — vérifiez l'ordonnance papier avant délivrance.`);
      if (ex) return prev.map((c) => c.medicationId === m.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { id: crypto.randomUUID(), medicationId: m.id, name: `${m.name}${m.dosage ? ` ${m.dosage}` : ''}`, price: Number(m.price) || 0, quantity: 1 }];
    });
  }, []);
  const updateQty = useCallback((id: string, delta: number) => setCart((p) => p.map((c) => c.id === id ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter((c) => c.quantity > 0)), []);
  const removeFromCart = useCallback((id: string) => setCart((p) => p.filter((c) => c.id !== id)), []);

  const subtotal = useMemo(() => cart.reduce((s, c) => s + c.price * c.quantity, 0), [cart]);
  const totalItems = useMemo(() => cart.reduce((s, c) => s + c.quantity, 0), [cart]);

  const finishSale = (order: any) => {
    setLastOrder(order); setIsCheckoutOpen(false); setIsReceiptOpen(true);
    setCart([]); setCustomerName('');
    setDispensationInfo({ patientName: '', patientIdRef: '', prescriptionRef: '', prescriberName: '' });
  };

  // CONFORMITÉ 1.3B — bloque l'encaissement d'un contrôlé sans traçabilité.
  const validateControlledDispensation = (): boolean => {
    if (controlledInCart.length === 0) return true;
    if (!dispensationInfo.patientName.trim() || !dispensationInfo.prescriptionRef.trim()) {
      toast.error('Médicament contrôlé : nom du patient et référence d\'ordonnance obligatoires');
      return false;
    }
    return true;
  };

  // CONFORMITÉ 1.3C — consigne chaque contrôlé au registre légal (append-only).
  const registerControlledDispensations = async (orderId: string | null) => {
    for (const item of controlledInCart) {
      try {
        await supabase.rpc('register_controlled_dispensation' as any, {
          p_pharmacy_id: serviceId,
          p_medication_id: item.medicationId,
          p_quantity: item.quantity,
          p_patient_name: dispensationInfo.patientName,
          p_patient_id_ref: dispensationInfo.patientIdRef || null,
          p_prescription_ref: dispensationInfo.prescriptionRef,
          p_prescriber_name: dispensationInfo.prescriberName || null,
          p_order_id: orderId,
        } as any);
      } catch (e: any) {
        // Non bloquant pour la vente, mais on alerte : la traçabilité a échoué.
        toast.error(`Registre contrôlés : échec pour ${item.name}`, { description: e?.message });
      }
    }
  };

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    if (!validateControlledDispensation()) return;   // CONFORMITÉ 1.3B
    setSubmitting(true);
    const createdAt = new Date().toISOString();
    const idem = `PHARMA-OFF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const itemsPayload = cart.map((c) => ({ medication_id: c.medicationId, name: c.name, price: c.price, quantity: c.quantity, subtotal: c.price * c.quantity }));
    const receipt = { id: idem, idempotency_key: idem, created_at: createdAt, customer_name: customerName || 'Client', payment_method: paymentMethod, items: itemsPayload, total: subtotal };

    // HORS LIGNE : stocker localement, rejeu à la reconnexion.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      try {
        await offlineDB.initDB();
        await offlineDB.storeEvent({
          type: 'pharmacy_pos_sale', vendor_id: serviceId, created_at: createdAt,
          data: { idempotency_key: idem, total: subtotal, payment_method: paymentMethod, customer_name: customerName || 'Client', items: itemsPayload, sale_date: createdAt },
        }, true);
        finishSale(receipt);
        toast.success(t('pharmacyPOS.venteEnregistreeHorsLigne'), { description: `N° ${idem.slice(-6)} — synchronisée au retour de la connexion.`, duration: 5000 });
      } catch (e: any) {
        toast.error("Erreur d'enregistrement hors ligne", { description: e?.message || 'Réessayez.' });
      } finally { setSubmitting(false); }
      return;
    }

    // EN LIGNE : RPC atomique (insert + décrément stock), idempotente.
    try {
      const { data, error } = await supabase.rpc('create_pharmacy_pos_offline_order', {
        p_service_id: serviceId, p_idempotency_key: idem,
        p_sale: { total: subtotal, payment_method: paymentMethod, customer_name: customerName || 'Client', items: itemsPayload, created_at: createdAt },
      });
      if (error) throw error;
      const orderId = (data as any)?.order_id || idem;
      // CONFORMITÉ 1.3C — enregistrer les contrôlés au registre avant de vider le panier.
      if (controlledInCart.length > 0) await registerControlledDispensations(orderId);
      finishSale({ ...receipt, id: orderId });
      reload();
      toast.success(t('pharmacyPOS.venteEnregistree'));
    } catch (e: any) {
      const m = String(e?.message || e);
      // Réseau coupé en cours → bascule hors ligne (pas de perte).
      if (/fetch|réseau|reseau|network|timeout/i.test(m)) {
        try {
          await offlineDB.initDB();
          await offlineDB.storeEvent({ type: 'pharmacy_pos_sale', vendor_id: serviceId, created_at: createdAt, data: { idempotency_key: idem, total: subtotal, payment_method: paymentMethod, customer_name: customerName || 'Client', items: itemsPayload, sale_date: createdAt } }, true);
          finishSale(receipt);
          toast.success(t('pharmacyPOS.venteEnregistreeHorsLigneReseau'));
        } catch { toast.error(t('pharmacyPOS.echecEnregistrement')); }
      } else {
        toast.error(m === 'NON_AUTORISE' ? 'Action réservée au propriétaire de la pharmacie' : `Erreur : ${m}`);
      }
    } finally { setSubmitting(false); }
  };

  const printReceipt = async () => {
    if (!lastOrder) return;
    const ref = String(lastOrder.id).slice(-6).toUpperCase();
    const money = (n: any) => fc(Number(n) || 0);
    const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
    const rows = (lastOrder.items || []).map((it: any) => `<tr><td>${it.quantity}× ${esc(it.name)}</td><td class="r">${money(it.subtotal ?? it.price * it.quantity)}</td></tr>`).join('');
    if (logoUrl) await new Promise((res) => { const im = new Image(); im.onload = () => res(null); im.onerror = () => res(null); im.src = logoUrl; });
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Reçu ${ref}</title><style>
      @page{size:80mm auto;margin:4mm}body{font-family:'Courier New',monospace;width:72mm;margin:0 auto;color:#000;font-size:12px}
      h1{font-size:14px;text-align:center;margin:0 0 2px}.logo{display:block;margin:0 auto 4px;max-height:48px;max-width:60mm;object-fit:contain}
      .c{text-align:center}.r{text-align:right}hr{border:none;border-top:1px dashed #000;margin:6px 0}
      table{width:100%;border-collapse:collapse}td{padding:1px 0}.tot{font-weight:bold;font-size:13px}</style></head><body>
      ${logoUrl ? `<img src="${esc(logoUrl)}" class="logo"/>` : ''}<h1>${esc(businessName || 'Pharmacie')}</h1>
      <div class="c">Reçu N° ${ref}<br/>${new Date(lastOrder.created_at).toLocaleString('fr-FR')}</div><hr/>
      <div>Client : ${esc(lastOrder.customer_name || '-')}</div>
      <div>Paiement : ${esc(PAYMENT_METHODS.find((m) => m.value === lastOrder.payment_method)?.label || lastOrder.payment_method)}</div><hr/>
      <table>${rows}</table><hr/><table><tr class="tot"><td>TOTAL</td><td class="r">${money(lastOrder.total)}</td></tr></table><hr/>
      <div class="c">{t('pharmacyPOS.conservezCeRecuBonneSante')}</div></body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) { toast.error('Impression indisponible.'); iframe.remove(); return; }
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch { /* noop */ } setTimeout(() => iframe.remove(), 1000); }, 300);
  };

  const downloadReceipt = () => {
    if (!lastOrder) return;
    const ref = String(lastOrder.id).slice(-6).toUpperCase();
    const money = (n: any) => fc(Number(n) || 0);
    const lines = [
      `        ${businessName || 'PHARMACIE'}`, `        REÇU N° ${ref}`, `        ${new Date(lastOrder.created_at).toLocaleString('fr-FR')}`,
      '----------------------------------------', `Client   : ${lastOrder.customer_name || '-'}`,
      `Paiement : ${PAYMENT_METHODS.find((m) => m.value === lastOrder.payment_method)?.label || lastOrder.payment_method}`,
      '----------------------------------------',
      ...(lastOrder.items || []).map((it: any) => `${it.quantity}x ${it.name}`.padEnd(28) + money(it.subtotal ?? it.price * it.quantity)),
      '----------------------------------------', `TOTAL    : ${money(lastOrder.total)}`, '', '        Bonne santé !',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `recu-${ref}.txt`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[300px]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-240px)] min-h-[480px]">
      <div className="flex gap-2 md:hidden">
        <Button variant={mobileTab === 'products' ? 'default' : 'outline'} size="sm" className="flex-1 gap-1" onClick={() => setMobileTab('products')}><Pill className="w-4 h-4" /> {t('pharmacyPOS.medicaments')}</Button>
        <Button variant={mobileTab === 'cart' ? 'default' : 'outline'} size="sm" className="flex-1 gap-1" onClick={() => setMobileTab('cart')}><ShoppingCart className="w-4 h-4" /> Panier ({totalItems})</Button>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Catalogue */}
        <div className={`flex-1 min-w-0 flex-col gap-3 ${mobileTab === 'products' ? 'flex' : 'hidden'} md:flex`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder={t('pharmacyPOS.rechercherUnMedicament')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="gap-1"><Pill className="w-3 h-3" />{medications.length} au catalogue</Badge>
            <Badge variant="outline" className="text-emerald-700 border-emerald-300">{medications.filter((m) => m.stock > 0).length} en stock</Badge>
            {medications.filter((m) => m.stock <= 0).length > 0 && <Badge variant="outline" className="text-red-700 border-red-300">{medications.filter((m) => m.stock <= 0).length} épuisés</Badge>}
          </div>
          <ScrollArea className="flex-1">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground"><Pill className="w-12 h-12 mb-3 opacity-50" /><p className="text-sm">{t('pharmacyPOS.aucunMedicamentAuCatalogue')}</p><p className="text-xs">{t('pharmacyPOS.ajoutezEnDansLOnglet')}</p></div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {items.map((m) => {
                  const inCart = cart.find((c) => c.medicationId === m.id);
                  const out = m.stock <= 0;
                  return (
                    <Card key={m.id} className={`cursor-pointer hover:shadow-md transition-all relative ${inCart ? 'ring-2 ring-primary' : ''} ${out ? 'opacity-60' : ''}`} onClick={() => addToCart(m)}>
                      <CardContent className="p-2">
                        <p className="font-medium text-xs line-clamp-2 leading-tight">{m.name}{m.dosage ? ` ${m.dosage}` : ''}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs font-bold text-primary">{fc(Number(m.price) || 0)}</span>
                          {m.requires_prescription && <Badge variant="outline" className="text-[8px] px-1 py-0 border-amber-400 text-amber-700">ord.</Badge>}
                        </div>
                        <div className="mt-1"><span className={`text-[10px] font-semibold ${out ? 'text-red-600' : m.stock <= m.low_stock_threshold ? 'text-orange-600' : 'text-emerald-600'}`}>{out ? 'Épuisé' : `${m.stock} rest.`}</span></div>
                        {out && (
                          <button
                            className="mt-1 w-full rounded bg-blue-50 text-blue-700 text-[10px] font-medium py-0.5 hover:bg-blue-100"
                            onClick={(e) => { e.stopPropagation(); void openAlternatives(m); }}
                          >
                            Alternatives
                          </button>
                        )}
                        {inCart && <Badge className="absolute top-1 right-1 text-[10px] px-1.5 py-0">x{inCart.quantity}</Badge>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Panier */}
        <div className={`w-full md:w-80 lg:w-96 flex-shrink-0 flex-col border rounded-lg bg-card ${mobileTab === 'cart' ? 'flex' : 'hidden'} md:flex`}>
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2 text-sm"><ShoppingCart className="w-4 h-4" /> Panier ({totalItems})</h3>
            {cart.length > 0 && <Button variant="ghost" size="sm" onClick={() => setCart([])}><Trash2 className="w-3 h-3 mr-1" /> Vider</Button>}
          </div>
          <ScrollArea className="flex-1 p-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground"><ShoppingCart className="w-8 h-8 mb-2 opacity-50" /><p className="text-xs">Panier vide</p></div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate">{item.name}</p><p className="text-xs text-primary font-semibold">{fc(item.price * item.quantity)}</p></div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.id, -1)}><Minus className="w-3 h-3" /></Button>
                      <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQty(item.id, 1)}><Plus className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeFromCart(item.id)}><X className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="p-3 border-t space-y-2">
            <div className="flex justify-between items-center"><span className="text-sm font-medium">Total</span><span className="text-lg font-bold text-primary">{fc(subtotal)}</span></div>
            <Button className="w-full gap-2" disabled={cart.length === 0} onClick={() => setIsCheckoutOpen(true)}><Receipt className="w-4 h-4" /> Encaisser ({totalItems})</Button>
          </div>
        </div>
      </div>

      {/* Checkout */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="w-5 h-5" /> {t('pharmacyPOS.encaisserLaVente')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800"><ShieldAlert className="h-4 w-4 shrink-0" /> {t('pharmacyPOS.pourToutMedicamentSurOrdonnance')}</div>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              {cart.map((item) => <div key={item.id} className="flex justify-between text-sm"><span>{item.quantity}x {item.name}</span><span className="font-medium">{fc(item.price * item.quantity)}</span></div>)}
              <Separator className="my-2" />
              <div className="flex justify-between font-bold"><span>Total</span><span className="text-primary">{fc(subtotal)}</span></div>
            </div>
            <div><label className="text-xs font-medium mb-1 block">{t('pharmacyPOS.nomDuClientOptionnel')}</label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t('pharmacyPOS.client')} className="h-9" /></div>
            <div>
              <label className="text-xs font-medium mb-1 block">{t('pharmacyPOS.modeDePaiement')}</label>
              <div className="grid grid-cols-3 gap-2">{PAYMENT_METHODS.map((m) => <Button key={m.value} variant={paymentMethod === m.value ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod(m.value)} className="gap-1 text-xs">{m.icon} {m.label}</Button>)}</div>
            </div>
            {/* CONFORMITÉ 1.3D — traçabilité obligatoire pour les médicaments contrôlés */}
            {controlledInCart.length > 0 && (
              <div className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-800">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  Médicament contrôlé — la délivrance sera enregistrée au registre légal.
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Nom du patient *</label>
                  <Input value={dispensationInfo.patientName} onChange={(e) => setDispensationInfo((d) => ({ ...d, patientName: e.target.value }))} placeholder="Nom complet du patient" className="h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Référence d'ordonnance *</label>
                  <Input value={dispensationInfo.prescriptionRef} onChange={(e) => setDispensationInfo((d) => ({ ...d, prescriptionRef: e.target.value }))} placeholder="N° / réf de l'ordonnance" className="h-9" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Pièce d'identité</label>
                    <Input value={dispensationInfo.patientIdRef} onChange={(e) => setDispensationInfo((d) => ({ ...d, patientIdRef: e.target.value }))} placeholder="N° pièce" className="h-9" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Médecin</label>
                    <Input value={dispensationInfo.prescriberName} onChange={(e) => setDispensationInfo((d) => ({ ...d, prescriberName: e.target.value }))} placeholder="Prescripteur" className="h-9" />
                  </div>
                </div>
              </div>
            )}
            {typeof navigator !== 'undefined' && !navigator.onLine && <div className="flex items-center gap-2 text-xs text-orange-600"><WifiOff className="h-4 w-4" /> {t('pharmacyPOS.horsLigneLaVenteSera')}</div>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsCheckoutOpen(false)}>{t('pharmacyPOS.annuler')}</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">{submitting ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" /> …</> : <><Check className="w-4 h-4" /> Confirmer • {fc(subtotal)}</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reçu */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-[#ff4000]"><Check className="w-5 h-5" /> {t('pharmacyPOS.venteEnregistree2')}</DialogTitle></DialogHeader>
          {lastOrder && (
            <div className="bg-muted/30 rounded-lg p-4 font-mono text-xs space-y-2">
              <div className="text-center border-b pb-2">
                {logoUrl && <img src={logoUrl} alt="logo" className="mx-auto mb-1 max-h-12 object-contain" />}
                {businessName && <p className="font-bold text-sm">{businessName}</p>}
                <p className="font-bold text-sm">{t('pharmacyPOS.recu')}</p><p>#{String(lastOrder.id).slice(-6).toUpperCase()}</p><p>{new Date(lastOrder.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <div className="border-b pb-2"><p><strong>{t('pharmacyPOS.client2')}</strong> {lastOrder.customer_name}</p><p><strong>{t('pharmacyPOS.paiement')}</strong> {PAYMENT_METHODS.find((m) => m.value === lastOrder.payment_method)?.label}</p></div>
              <div className="space-y-1 border-b pb-2">{lastOrder.items?.map((it: any, i: number) => <div key={i} className="flex justify-between"><span>{it.quantity}x {it.name}</span><span>{fc(it.subtotal)}</span></div>)}</div>
              <div className="flex justify-between font-bold text-sm pt-1"><span>TOTAL</span><span>{fc(lastOrder.total)}</span></div>
            </div>
          )}
          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Button onClick={printReceipt} className="w-full gap-2 bg-[#04439e] hover:bg-[#04439e]/90"><Printer className="w-4 h-4" /> Imprimer</Button>
            <Button onClick={downloadReceipt} variant="secondary" className="w-full gap-2"><Download className="w-4 h-4" /> {t('pharmacyPOS.telecharger')}</Button>
            <Button variant="outline" onClick={() => setIsReceiptOpen(false)} className="w-full col-span-2 sm:col-span-1">{t('pharmacyPOS.fermer')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AMÉLIORATIONS 2.2 + 2.3 — alternatives sur rupture (générique en stock OU pharmacie proche) */}
      <Dialog open={!!altMed} onOpenChange={(o) => { if (!o) { setAltMed(null); setNearby(null); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pill className="w-5 h-5" /> {altMed?.name} — épuisé</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* 2.2 — Équivalents génériques EN STOCK dans cette pharmacie */}
            <div>
              <p className="text-sm font-semibold mb-2">Équivalents génériques disponibles ici</p>
              {altLoading ? (
                <div className="py-3 text-center text-xs text-muted-foreground">Recherche…</div>
              ) : alternatives.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun équivalent générique en stock.</p>
              ) : (
                <div className="space-y-2">
                  {alternatives.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded-lg border p-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{a.name}</p>
                        <p className="text-xs text-muted-foreground">{fc(Number(a.price) || 0)} · {a.stock} en stock
                          {altMed && Number(a.price) < Number(altMed.price || 0) && <span className="ml-1 text-emerald-600 font-semibold">moins cher</span>}
                        </p>
                      </div>
                      <Button size="sm" className="gap-1 shrink-0" onClick={() => addAlternativeToCart(a.id)}><Plus className="w-3.5 h-3.5" /> Ajouter</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* 2.3 — Disponibilité dans une autre pharmacie proche */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-semibold">Disponible ailleurs ?</p>
                <Button size="sm" variant="outline" className="gap-1" disabled={nearbyLoading} onClick={searchNearby}>
                  <Search className="w-3.5 h-3.5" /> {nearbyLoading ? 'Recherche…' : 'Chercher ailleurs'}
                </Button>
              </div>
              {nearby && nearby.length === 0 && <p className="text-xs text-muted-foreground">Aucune pharmacie proche (20 km) n'a ce médicament en stock.</p>}
              {nearby && nearby.length > 0 && (
                <div className="space-y-2">
                  {nearby.map((p) => (
                    <div key={p.pharmacy_id} className="rounded-lg border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{p.pharmacy_name}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0">{p.distance_km} km</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{fc(Number(p.price) || 0)} · {p.stock} en stock{p.pharmacy_city ? ` · ${p.pharmacy_city}` : ''}</p>
                      {p.pharmacy_phone && (
                        <a href={`tel:${p.pharmacy_phone}`} className="text-xs text-blue-700 font-medium hover:underline">📞 Appeler {p.pharmacy_phone}</a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAltMed(null); setNearby(null); }}>{t('pharmacyPOS.fermer')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PharmacyPOS;
