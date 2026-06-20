import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🎯 Promotions restaurant — création/gestion (réduction %, livraison gratuite, 2=1).
 * RLS : le restaurateur gère SES promotions ; le client lit les promos actives.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Tag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Promo {
  id: string; title: string; promo_type: 'percentage' | 'free_delivery' | 'bogo';
  value: number; start_time: string | null; end_time: string | null; quota: number | null;
  used_count: number; is_active: boolean;
}

const TYPE_LABEL: Record<Promo['promo_type'], string> = {
  percentage: 'Réduction %', free_delivery: 'Livraison gratuite', bogo: '2 achetés = 1 offert',
};

export function RestaurantPromotions({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', promo_type: 'percentage' as Promo['promo_type'], value: 10, start_time: '', end_time: '', quota: '' });

  const load = useCallback(async () => {
    const { data } = await supabase.from('restaurant_promotions').select('*').eq('professional_service_id', serviceId).order('created_at', { ascending: false });
    setPromos((data as unknown as Promo[]) ?? []);
    setLoading(false);
  }, [serviceId]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!form.title.trim()) { toast.error('Titre requis'); return; }
    setSaving(true);
    const { error } = await supabase.from('restaurant_promotions').insert({
      professional_service_id: serviceId,
      title: form.title.trim(),
      promo_type: form.promo_type,
      value: Number(form.value) || 0,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      quota: form.quota ? Number(form.quota) : null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t('restaurantPromotions.promotionCreee'));
    setForm({ title: '', promo_type: 'percentage', value: 10, start_time: '', end_time: '', quota: '' });
    await load();
  };

  const toggle = async (p: Promo) => {
    setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !x.is_active } : x)));
    await supabase.from('restaurant_promotions').update({ is_active: !p.is_active, updated_at: new Date().toISOString() }).eq('id', p.id);
  };
  const remove = async (id: string) => {
    setPromos((prev) => prev.filter((x) => x.id !== id));
    await supabase.from('restaurant_promotions').delete().eq('id', id);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{t('restaurantPromotions.nouvellePromotion')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Titre</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t('restaurantPromotions.ex20LeMidi')} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Type</Label>
              <select className="w-full rounded-md border px-2 py-2 text-sm" value={form.promo_type} onChange={(e) => setForm((f) => ({ ...f, promo_type: e.target.value as Promo['promo_type'] }))}>
                <option value="percentage">{t('restaurantPromotions.reduction')}</option>
                <option value="free_delivery">{t('restaurantPromotions.livraisonGratuite')}</option>
                <option value="bogo">2 achetés = 1 offert</option>
              </select>
            </div>
            <div><Label>{form.promo_type === 'percentage' ? 'Réduction (%)' : form.promo_type === 'free_delivery' ? 'Montant min (GNF)' : 'Valeur'}</Label>
              <Input type="number" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: +e.target.value || 0 }))} disabled={form.promo_type === 'bogo'} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">{t('restaurantPromotions.debutH')}</Label><Input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} /></div>
            <div><Label className="text-xs">Fin (h)</Label><Input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} /></div>
            <div><Label className="text-xs">Quota</Label><Input type="number" value={form.quota} onChange={(e) => setForm((f) => ({ ...f, quota: e.target.value }))} placeholder="∞" /></div>
          </div>
          <Button onClick={create} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}Créer la promotion</Button>
        </CardContent>
      </Card>

      {loading ? <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : (
        <div className="space-y-2">
          {promos.length === 0 && <p className="text-sm text-muted-foreground">{t('restaurantPromotions.aucunePromotion')}</p>}
          {promos.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <Tag className="h-4 w-4 text-[#ff4000]" />
                <div className="min-w-0">
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {TYPE_LABEL[p.promo_type]}{p.promo_type === 'percentage' ? ` · -${p.value}%` : p.promo_type === 'free_delivery' ? ` · dès ${p.value} GNF` : ''}
                    {p.start_time && ` · ${p.start_time.slice(0, 5)}-${(p.end_time || '').slice(0, 5)}`}
                    {p.quota ? ` · ${p.used_count}/${p.quota}` : ''}
                  </div>
                </div>
                <Badge variant={p.is_active ? 'default' : 'outline'} className="ml-auto">{p.is_active ? 'Active' : 'Inactive'}</Badge>
                <Switch checked={p.is_active} onCheckedChange={() => toggle(p)} />
                <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default RestaurantPromotions;
