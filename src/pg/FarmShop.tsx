import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🌾 Boutique producteur (côté ACHETEUR) — catalogue public + commande + suivi.
 * Lecture publique des produits ; la commande crée une farm_orders (buyer = utilisateur),
 * qui alimente en TEMPS RÉEL le Kanban de l'agriculteur. Suivi par timeline.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/Money';
import { ArrowLeft, Leaf, Minus, Plus, ShoppingCart, QrCode, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = ['nouveau', 'confirme', 'prepare', 'expedie', 'livre'];
const STEP_LABEL: Record<string, string> = { nouveau: 'Commande envoyée', confirme: 'Confirmée', prepare: 'En préparation', expedie: 'En route', livre: 'Livrée' };

export default function FarmShop() {
  const { t } = useTranslation();
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [farm, setFarm] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState('nouveau');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!serviceId) return;
      const [{ data: svc }, { data: prods }] = await Promise.all([
        supabase.from('professional_services').select('business_name, logo_url, cover_image_url, address').eq('id', serviceId).maybeSingle(),
        supabase.from('farm_products').select('*').eq('professional_service_id', serviceId).eq('is_active', true).gt('stock_quantity', 0).order('created_at', { ascending: false }),
      ]);
      if (!alive) return;
      setFarm(svc); setProducts(prods || []); setLoading(false);
    })();
    return () => { alive = false; };
  }, [serviceId]);

  // Suivi temps réel de la commande passée.
  useEffect(() => {
    if (!orderId) return;
    const ch = supabase.channel(`farm-track-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'farm_orders', filter: `id=eq.${orderId}` }, (p: any) => setOrderStatus(p.new.status))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [orderId]);

  const items = useMemo(() => products.filter((p) => cart[p.id] > 0).map((p) => ({ ...p, qty: cart[p.id] })), [products, cart]);
  const total = useMemo(() => items.reduce((s, it) => s + it.price * it.qty, 0), [items]);
  const setQty = (id: string, delta: number) => setCart((c) => { const n = Math.max(0, (c[id] || 0) + delta); const nc = { ...c }; if (n === 0) delete nc[id]; else nc[id] = n; return nc; });

  const placeOrder = async () => {
    if (!user) { toast.error(t('farmShop.connectezVousPourCommander')); navigate('/auth'); return; }
    if (items.length === 0) return;
    setPlacing(true);
    const { data, error } = await supabase.from('farm_orders').insert({
      professional_service_id: serviceId,
      buyer_user_id: user.id,
      customer_name: (user as any).user_metadata?.full_name || user.email || 'Client',
      customer_phone: phone || null,
      items: items.map((it) => ({ product: it.name, quantity: it.qty, unit: it.unit, price: it.price })),
      total,
      delivery_type: 'livraison',
      status: 'nouveau',
    }).select('id').single();
    setPlacing(false);
    if (error) { toast.error(error.message); return; }
    setOrderId((data as any).id); setCart({});
    toast.success(t('farmShop.commandeEnvoyeeAuProducteur'));
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff4000]" /></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-32">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t('farmShop.retour')}</Button>

      <div className="flex items-center gap-3">
        {farm?.logo_url ? <img src={farm.logo_url} alt="" className="h-14 w-14 rounded-full object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100"><Leaf className="h-7 w-7 text-green-700" /></div>}
        <div><h1 className="text-xl font-bold">{farm?.business_name || 'Producteur'}</h1><p className="text-sm text-muted-foreground">{farm?.address}</p></div>
      </div>

      {orderId ? (
        <Card><CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 font-semibold text-green-700"><Check className="h-5 w-5" />{t('farmShop.commandeEnvoyee')}</div>
          <div className="space-y-2">
            {STEPS.map((s, i) => {
              const reached = STEPS.indexOf(orderStatus) >= i;
              return (
                <div key={s} className="flex items-center gap-3">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full ${reached ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'}`}>{reached ? <Check className="h-4 w-4" /> : i + 1}</div>
                  <span className={`text-sm ${reached ? 'font-medium' : 'text-muted-foreground'}`}>{STEP_LABEL[s]}</span>
                </div>
              );
            })}
          </div>
          <Button variant="outline" className="w-full" onClick={() => setOrderId(null)}>{t('farmShop.passerUneAutreCommande')}</Button>
        </CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.length === 0 && <p className="col-span-full text-sm text-muted-foreground">{t('farmShop.aucunProduitDisponible')}</p>}
            {products.map((p) => (
              <Card key={p.id}>
                <CardContent className="space-y-2 p-2">
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                    {p.photos?.[0] ? <img src={p.photos[0]} alt={p.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Leaf className="h-8 w-8 text-muted-foreground" /></div>}
                    {p.organic && <Badge className="absolute left-1 top-1 bg-green-600 text-[10px]"><Leaf className="mr-0.5 h-2.5 w-2.5" />Bio</Badge>}
                    <a href={`/trace/${p.id}`} target="_blank" rel="noreferrer" className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white" title={t('farmShop.tracabilite')}><QrCode className="h-3.5 w-3.5" /></a>
                  </div>
                  <div className="text-sm font-semibold leading-tight">{p.name}</div>
                  <div className="text-sm font-bold text-[#ff4000]"><Money amount={p.price} /> <span className="text-[11px] font-normal text-muted-foreground">/ {p.unit}</span></div>
                  {cart[p.id] ? (
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(p.id, -1)}><Minus className="h-3.5 w-3.5" /></Button>
                      <span className="w-6 text-center text-sm font-medium">{cart[p.id]}</span>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQty(p.id, 1)}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : (
                    <Button size="sm" className="w-full" onClick={() => setQty(p.id, 1)}><Plus className="h-4 w-4 mr-1" />{t('farmShop.ajouter')}</Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {items.length > 0 && (
            <div className="fixed inset-x-0 bottom-0 border-t bg-card p-3">
              <div className="mx-auto max-w-3xl space-y-2">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('farmShop.votreTelephonePourLaLivraison')} className="h-9" />
                <Button className="w-full" disabled={placing} onClick={placeOrder}>
                  {placing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShoppingCart className="h-4 w-4 mr-1" />}
                  Commander · {items.length} article(s) · <Money amount={total} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
