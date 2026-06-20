import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🛒 Campagnes E-commerce — Achat groupé (Pinduoduo) + Flash sales (stock temps réel).
 * Group buy : créé via backend (RPC atomique). Flash sale : géré via RLS (vendor_user_id).
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { backendFetch } from '@/services/backendApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/Money';
import { Users, Zap, Plus, Loader2, Share2, Trash2, Clock } from 'lucide-react';
import { toast } from 'sonner';

export function EcommerceCampaigns({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [flash, setFlash] = useState<any[]>([]);
  const [gbForm, setGbForm] = useState({ product_name: '', group_price: 0, min: 3 });
  const [fsForm, setFsForm] = useState({ product_name: '', sale_price: 0, stock_allocated: 20, hours: 6 });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: g }, { data: f }] = await Promise.all([
      supabase.from('group_buys').select('*').eq('vendor_user_id', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('flash_sales').select('*').eq('vendor_user_id', user.id).order('created_at', { ascending: false }).limit(20),
    ]);
    setGroups(g || []); setFlash(f || []);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);
  // Temps réel sur les achats groupés (progression).
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`vendor-gb-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_buys', filter: `vendor_user_id=eq.${user.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user?.id, load]);

  const createGroupBuy = async () => {
    if (!gbForm.product_name.trim() || gbForm.group_price <= 0) { toast.error(t('ecommerceCampaigns.produitEtPrixRequis')); return; }
    setBusy(true);
    const res = await backendFetch<{ group_buy_id: string }>('/api/v2/group-buy', { method: 'POST', body: { product_name: gbForm.product_name, group_price: gbForm.group_price, min: gbForm.min } });
    setBusy(false);
    if (res.success) { toast.success(t('ecommerceCampaigns.achatGroupeLance')); setGbForm({ product_name: '', group_price: 0, min: 3 }); await load(); }
    else toast.error(res.error || 'Erreur');
  };

  const createFlash = async () => {
    if (!user || !fsForm.product_name.trim() || fsForm.sale_price <= 0) { toast.error(t('ecommerceCampaigns.produitEtPrixRequis')); return; }
    setBusy(true);
    const { error } = await supabase.from('flash_sales').insert({
      vendor_user_id: user.id, product_name: fsForm.product_name, sale_price: fsForm.sale_price,
      stock_allocated: fsForm.stock_allocated, ends_at: new Date(Date.now() + fsForm.hours * 3600000).toISOString(),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t('ecommerceCampaigns.flashSaleCreee')); setFsForm({ product_name: '', sale_price: 0, stock_allocated: 20, hours: 6 }); await load();
  };

  const endFlash = async (id: string) => { setFlash((p) => p.filter((x) => x.id !== id)); await supabase.from('flash_sales').update({ is_active: false }).eq('id', id); };
  const shareGb = (id: string) => { void navigator.clipboard?.writeText(`${window.location.origin}/group-buy/${id}`); toast.success(t('ecommerceCampaigns.lienCopie')); };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Achat groupé */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Users className="h-4 w-4 text-[#ff4000]" />{t('ecommerceCampaigns.achatGroupePinduoduo')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>{t('ecommerceCampaigns.produit')}</Label><Input value={gbForm.product_name} onChange={(e) => setGbForm((f) => ({ ...f, product_name: e.target.value }))} placeholder={t('ecommerceCampaigns.exSacDeRiz25kg')} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>{t('ecommerceCampaigns.prixGroupeGnf')}</Label><Input type="number" value={gbForm.group_price} onChange={(e) => setGbForm((f) => ({ ...f, group_price: +e.target.value || 0 }))} /></div>
            <div><Label>Min. participants</Label><select className="w-full rounded-md border px-2 py-2 text-sm" value={gbForm.min} onChange={(e) => setGbForm((f) => ({ ...f, min: +e.target.value }))}><option value={3}>3</option><option value={5}>5</option><option value={10}>10</option></select></div>
          </div>
          <Button onClick={createGroupBuy} disabled={busy} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}Lancer l'achat groupé</Button>
          <div className="space-y-2">
            {groups.map((g) => (
              <div key={g.id} className="rounded-lg border p-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{g.product_name}</span>
                  <Badge variant={g.status === 'succeeded' ? 'default' : g.status === 'failed' ? 'outline' : 'secondary'} className="text-[10px]">{g.status}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">{g.participant_count}/{g.min_participants}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-semibold text-[#ff4000]"><Money amount={g.group_price} /></span>
                  {g.status === 'open' && <Button size="sm" variant="outline" onClick={() => shareGb(g.id)}><Share2 className="h-3.5 w-3.5 mr-1" />Partager</Button>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Flash sales */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Zap className="h-4 w-4 text-[#ff4000]" />Flash sales</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>{t('ecommerceCampaigns.produit')}</Label><Input value={fsForm.product_name} onChange={(e) => setFsForm((f) => ({ ...f, product_name: e.target.value }))} placeholder="Ex : T-shirt coton" /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Prix promo</Label><Input type="number" value={fsForm.sale_price} onChange={(e) => setFsForm((f) => ({ ...f, sale_price: +e.target.value || 0 }))} /></div>
            <div><Label className="text-xs">Stock</Label><Input type="number" value={fsForm.stock_allocated} onChange={(e) => setFsForm((f) => ({ ...f, stock_allocated: +e.target.value || 0 }))} /></div>
            <div><Label className="text-xs">{t('ecommerceCampaigns.dureeH')}</Label><Input type="number" value={fsForm.hours} onChange={(e) => setFsForm((f) => ({ ...f, hours: +e.target.value || 1 }))} /></div>
          </div>
          <Button onClick={createFlash} disabled={busy} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Zap className="h-4 w-4 mr-1" />}Lancer la flash sale</Button>
          <div className="space-y-2">
            {flash.map((s) => {
              const left = Math.max(0, s.stock_allocated - s.stock_sold);
              const ended = new Date(s.ends_at) < new Date();
              return (
                <div key={s.id} className="rounded-lg border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.product_name}</span>
                    <Badge className={ended ? 'bg-slate-400' : left === 0 ? 'bg-red-500' : 'bg-green-600'} >{ended ? 'Terminée' : left === 0 ? 'Épuisé' : `${left} restant`}</Badge>
                    <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{new Date(s.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-semibold text-[#ff4000]"><Money amount={s.sale_price} /></span>
                    {s.is_active && !ended && <Button size="sm" variant="ghost" onClick={() => endFlash(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default EcommerceCampaigns;
