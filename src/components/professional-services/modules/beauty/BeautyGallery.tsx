import { useTranslation } from "@/hooks/useTranslation";
/**
 * 💇 ÉCRAN 4 — GALERIE DE RÉALISATIONS (avant/après). Public (profil) ou privé (client).
 * Upload vers GCS. Filtrable par catégorie de service.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { useBeautyGallery } from '@/hooks/useBeauty';

export function BeautyGallery({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const { items, loading, add, togglePublic, remove } = useBeautyGallery(serviceId);
  const { uploadFile, isUploading } = useStorageUpload();
  const [f, setF] = useState<any>({ is_public: true, service_category: '' });

  const upload = async (kind: 'before_url' | 'after_url', file?: File) => {
    if (!file) return;
    const res = await uploadFile(file, { folder: 'restaurant' as any, subfolder: `beauty-gallery/${serviceId}` });
    if (res.success && res.publicUrl) setF((x: any) => ({ ...x, [kind]: res.publicUrl }));
    else toast.error(res.error || 'Upload échoué');
  };

  const submit = async () => {
    if (!f.after_url && !f.before_url) { toast.error(t('beautyGallery.ajoutezAuMoinsUnePhoto')); return; }
    await add({ before_url: f.before_url, after_url: f.after_url, image_url: f.after_url || f.before_url, service_category: f.service_category, description: f.description, is_public: !!f.is_public });
    setF({ is_public: true, service_category: '' });
  };

  return (
    <div className="space-y-3">
      <Card><CardContent className="space-y-3 pt-4">
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Photo AVANT</Label><Input type="file" accept="image/*" disabled={isUploading} onChange={(e) => upload('before_url', e.target.files?.[0])} />{f.before_url && <img src={f.before_url} alt="" className="mt-1 h-12 w-12 rounded object-cover" />}</div>
          <div><Label className="text-xs">{t('beautyGallery.photoApres')}</Label><Input type="file" accept="image/*" disabled={isUploading} onChange={(e) => upload('after_url', e.target.files?.[0])} />{f.after_url && <img src={f.after_url} alt="" className="mt-1 h-12 w-12 rounded object-cover" />}</div>
        </div>
        <div className="flex items-center gap-2">
          <Input className="flex-1" placeholder={t('beautyGallery.categorieCoupeColoration')} value={f.service_category} onChange={(e) => setF((x: any) => ({ ...x, service_category: e.target.value }))} />
          <div className="flex items-center gap-1"><Switch checked={!!f.is_public} onCheckedChange={(v) => setF((x: any) => ({ ...x, is_public: v }))} /><Label className="text-xs">{f.is_public ? 'Publique' : 'Privée'}</Label></div>
        </div>
        {isUploading && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('beautyGallery.televersement')}</p>}
        <Button onClick={submit} disabled={isUploading || (!f.before_url && !f.after_url)}>
          <Plus className="h-4 w-4 mr-1" />{(!f.before_url && !f.after_url) ? 'Choisissez une photo' : 'Ajouter à la galerie'}
        </Button>
      </CardContent></Card>

      {loading ? <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((it) => (
            <Card key={it.id} className="group relative overflow-hidden">
              <div className="grid grid-cols-2">
                {it.before_url ? <img src={it.before_url} alt="avant" className="h-24 w-full object-cover" /> : <div className="h-24 bg-muted" />}
                {it.after_url ? <img src={it.after_url} alt={t('beautyGallery.apres')} className="h-24 w-full object-cover" /> : <div className="h-24 bg-muted" />}
              </div>
              <div className="flex items-center justify-between p-2">
                <Badge variant="outline" className="text-[10px] capitalize">{it.service_category || '—'}</Badge>
                <button onClick={() => togglePublic(it)}>{it.is_public ? <Eye className="h-4 w-4 text-green-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}</button>
              </div>
              <Button size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => remove(it.id)}><Trash2 className="h-3 w-3" /></Button>
            </Card>
          ))}
          {items.length === 0 && <p className="col-span-full text-center text-sm text-muted-foreground py-4">Aucune réalisation. Montrez vos avant/après.</p>}
        </div>
      )}
    </div>
  );
}

export default BeautyGallery;
