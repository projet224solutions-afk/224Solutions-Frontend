import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🖼️ Gestionnaire de VITRINE — publie des items (image + vidéo Premium + prix) au
 * marketplace pour les services sans catalogue (Sport, Ménage…). Un clic sur le
 * marketplace ouvre la fiche du service.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Money } from '@/components/Money';
import { Plus, Trash2, Video, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { MediaUploadFields } from '@/components/service-common/MediaUploadFields';
import { useServiceShowcase, useIsPremiumPlan } from '@/hooks/useServiceShowcase';

const EMPTY = { title: '', description: '', price: 0, image_url: '', video_url: '' };

export function ServiceShowcaseManager({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const { items, addItem, toggle, removeItem } = useServiceShowcase(serviceId);
  const { isPremium } = useIsPremiumPlan(serviceId);
  const [form, setForm] = useState(EMPTY);

  const submit = async () => {
    if (!form.title) { toast.error('Titre requis'); return; }
    if (!form.image_url) { toast.error(t('serviceShowcaseManager.ajoutezUneImage')); return; }
    await addItem({ title: form.title, description: form.description, price: Number(form.price) || 0, image_url: form.image_url, video_url: form.video_url || null });
    setForm(EMPTY);
  };

  return (
    <div className="space-y-3">
      <Card><CardContent className="space-y-3 pt-4">
        <div className="flex items-center gap-2 text-sm font-medium"><ImagePlus className="h-4 w-4 text-[#ff4000]" />{t('serviceShowcaseManager.publierSurLeMarketplace')}</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 space-y-1"><Label>Titre</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t('serviceShowcaseManager.exAbonnementMensuelMenageComplet')} /></div>
          <div className="col-span-2 space-y-1"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <div className="col-span-2 space-y-1"><Label>Prix indicatif (GNF)</Label><Input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: +e.target.value || 0 }))} /></div>
        </div>
        <MediaUploadFields subfolder={`showcase/${serviceId}`} imageUrl={form.image_url} videoUrl={form.video_url}
          onImage={(url) => setForm((f) => ({ ...f, image_url: url }))} onVideo={(url) => setForm((f) => ({ ...f, video_url: url }))} isPremium={isPremium} />
        <Button onClick={submit}><Plus className="h-4 w-4 mr-1" />Publier</Button>
      </CardContent></Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map((it) => (
          <Card key={it.id} className={`group relative overflow-hidden ${it.is_active ? '' : 'opacity-60'}`}>
            {it.image_url && <img src={it.image_url} alt={it.title} className="h-28 w-full object-cover" />}
            <div className="p-2 space-y-1">
              <p className="text-xs font-medium truncate flex items-center gap-1">{it.title}{it.video_url && <Video className="h-3 w-3 text-[#ff4000]" />}</p>
              <p className="text-xs font-bold text-[#ff4000]"><Money amount={it.price} from="GNF" /></p>
              <div className="flex items-center gap-1">
                <Switch checked={it.is_active} onCheckedChange={() => toggle(it)} />
                <Badge variant="outline" className="text-[10px]">{it.is_active ? 'Publié' : 'Masqué'}</Badge>
              </div>
            </div>
            <Button size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeItem(it.id)}><Trash2 className="h-3 w-3" /></Button>
          </Card>
        ))}
      </div>
      {items.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">{t('serviceShowcaseManager.aucunePublicationAjoutezUneImage')}</p>}
    </div>
  );
}

export default ServiceShowcaseManager;
