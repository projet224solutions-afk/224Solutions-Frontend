import { useTranslation } from "@/hooks/useTranslation";
/**
 * 💇 ÉCRAN 2 — GESTION DES SERVICES (Fresha). Durée EXACTE (découpe l'agenda) + prix +
 * dépôt de réservation + option domicile (frais) + photo/vidéo + forfaits (durée cumulée).
 */

import { useState } from 'react';
import { useBeautyServices, useBeautyPackages, colorFor, type BeautyService } from '@/hooks/useBeauty';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Money } from '@/components/Money';
import { Plus, Trash2, Clock, Loader2, Video, Home, Package, Check, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { MediaUploadFields } from '@/components/service-common/MediaUploadFields';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { useIsPremiumPlan } from '@/hooks/useServiceShowcase';

const CATS = ['coiffure', 'coloration', 'soins', 'maquillage', 'ongles', 'epilation', 'massage', 'barbier'];
const EMPTY: any = { name: '', category: 'coiffure', duration_minutes: 45, price: 0, description: '', image_url: '', video_url: '', deposit_required: 0, is_home_service: false, home_service_extra_fee: 0 };

export function BeautyServices({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const { services, loading, createService, updateService, toggleService, removeService } = useBeautyServices(serviceId);
  const { packages, create: createPackage, remove: removePackage } = useBeautyPackages(serviceId);
  const { isPremium } = useIsPremiumPlan(serviceId);
  const { uploadFile } = useStorageUpload();
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [pkg, setPkg] = useState<any>({ name: '', service_ids: [] as string[], price: 0 });

  // Ajouter / remplacer la photo d'une prestation DÉJÀ créée.
  const setRowImage = async (id: string, file?: File) => {
    if (!file) return;
    setUploadingId(id);
    const res = await uploadFile(file, { folder: 'restaurant' as any, subfolder: `beauty/${serviceId}` });
    setUploadingId(null);
    if (res.success && res.publicUrl) await updateService(id, { image_url: res.publicUrl });
    else toast.error(res.error || 'Upload échoué');
  };

  const add = async () => {
    if (!form.name.trim()) { toast.error('Nom requis'); return; }
    setSaving(true);
    const ok = await createService({
      name: form.name, category: form.category, description: form.description,
      duration_minutes: Number(form.duration_minutes) || 30, price: Number(form.price) || 0, is_active: true,
      image_url: form.image_url || undefined, video_url: form.video_url || undefined,
      deposit_required: Number(form.deposit_required) || 0, is_home_service: !!form.is_home_service,
      home_service_extra_fee: Number(form.home_service_extra_fee) || 0,
    } as Partial<BeautyService> as any);
    setSaving(false);
    if (ok) setForm(EMPTY);
  };

  const pkgServices = services.filter((s) => pkg.service_ids.includes(s.id));
  const pkgDuration = pkgServices.reduce((t, s) => t + (s.duration_minutes || 0), 0);
  const pkgOriginal = pkgServices.reduce((t, s) => t + (s.price || 0), 0);
  const addPackage = async () => {
    if (!pkg.name || pkg.service_ids.length < 2) { toast.error(t('beautyServices.nomAuMoins2Services')); return; }
    await createPackage({ name: pkg.name, service_ids: pkg.service_ids, total_duration_minutes: pkgDuration, price: Number(pkg.price) || pkgOriginal, original_price: pkgOriginal, is_active: true });
    setPkg({ name: '', service_ids: [], price: 0 });
  };

  return (
    <Tabs defaultValue="services" className="space-y-3">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="services"><Clock className="h-4 w-4 mr-1" />Prestations</TabsTrigger>
        <TabsTrigger value="packages"><Package className="h-4 w-4 mr-1" />Forfaits</TabsTrigger>
      </TabsList>

      {/* PRESTATIONS */}
      <TabsContent value="services" className="space-y-3">
        <Card><CardContent className="space-y-3 pt-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2"><Label>{t('beautyServices.nomDuService')}</Label><Input value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Ex : Coupe femme + brushing" /></div>
            <div><Label>{t('beautyServices.categorie')}</Label><select className="w-full rounded-md border px-2 py-2 text-sm capitalize" value={form.category} onChange={(e) => setForm((f: any) => ({ ...f, category: e.target.value }))}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><Label>{t('beautyServices.dureeMin')}</Label><Input type="number" step={15} value={form.duration_minutes} onChange={(e) => setForm((f: any) => ({ ...f, duration_minutes: +e.target.value || 0 }))} /></div>
            <div><Label>Prix (GNF)</Label><Input type="number" value={form.price} onChange={(e) => setForm((f: any) => ({ ...f, price: +e.target.value || 0 }))} /></div>
            <div><Label>Acompte requis (GNF)</Label><Input type="number" value={form.deposit_required} onChange={(e) => setForm((f: any) => ({ ...f, deposit_required: +e.target.value || 0 }))} /></div>
            <div className="col-span-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2"><Home className="h-4 w-4 text-[#ff4000]" /><Label className="text-sm">{t('beautyServices.serviceADomicile')}</Label></div>
            <Switch checked={!!form.is_home_service} onCheckedChange={(v) => setForm((f: any) => ({ ...f, is_home_service: v }))} />
          </div>
          {form.is_home_service && <div><Label>{t('beautyServices.fraisDeDeplacementGnf')}</Label><Input type="number" value={form.home_service_extra_fee} onChange={(e) => setForm((f: any) => ({ ...f, home_service_extra_fee: +e.target.value || 0 }))} /></div>}
          <p className="text-xs text-muted-foreground">{t('beautyServices.unePhotoRendLaPrestation')}</p>
          <MediaUploadFields subfolder={`beauty/${serviceId}`} imageUrl={form.image_url} videoUrl={form.video_url}
            onImage={(url) => setForm((f: any) => ({ ...f, image_url: url }))} onVideo={(url) => setForm((f: any) => ({ ...f, video_url: url }))} isPremium={isPremium} />
          <Button onClick={add} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}Ajouter la prestation</Button>
        </CardContent></Card>

        {loading ? <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : (
          <div className="space-y-2">
            {services.length === 0 && <p className="text-sm text-muted-foreground">{t('beautyServices.aucunePrestationAjoutezLesAvec')}</p>}
            {services.map((s) => (
              <Card key={s.id} className={s.is_active ? '' : 'opacity-60'}><CardContent className="flex flex-wrap items-center gap-3 py-3">
                {s.image_url ? <img src={s.image_url} alt="" className="h-12 w-12 rounded object-cover" /> : <span className={`flex h-12 w-12 items-center justify-center rounded bg-muted ${colorFor(s.category)} bg-opacity-20`}><Camera className="h-4 w-4 text-muted-foreground" /></span>}
                <div className="min-w-0">
                  <div className="font-medium flex items-center gap-1">{s.name}{s.video_url && <Video className="h-3 w-3 text-[#ff4000]" />}{s.is_home_service && <Home className="h-3 w-3 text-[#04439e]" />}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{s.duration_minutes} min · <Money amount={s.price} /> {s.deposit_required ? <Badge variant="outline" className="text-[10px]">Acompte {s.deposit_required}</Badge> : null} {s.category && <Badge variant="outline" className="capitalize text-[10px]">{s.category}</Badge>}</div>
                </div>
                <label className="ml-auto inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border hover:bg-muted" title="Ajouter / changer la photo">
                  {uploadingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4 text-[#04439e]" />}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setRowImage(s.id, e.target.files?.[0])} />
                </label>
                <Switch checked={s.is_active} onCheckedChange={() => toggleService(s)} />
                <Button size="icon" variant="ghost" onClick={() => removeService(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </CardContent></Card>
            ))}
          </div>
        )}
      </TabsContent>

      {/* FORFAITS */}
      <TabsContent value="packages" className="space-y-3">
        <Card><CardContent className="space-y-3 pt-4">
          <Label>{t('beautyServices.nouveauForfaitDureeEtPrix')}</Label>
          <Input placeholder="Nom (ex : Soin Complet)" value={pkg.name} onChange={(e) => setPkg((p: any) => ({ ...p, name: e.target.value }))} />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('beautyServices.selectionnezLesPrestationsIncluses')}</p>
            <div className="flex flex-wrap gap-1">
              {services.map((s) => {
                const on = pkg.service_ids.includes(s.id);
                return <button key={s.id} onClick={() => setPkg((p: any) => ({ ...p, service_ids: on ? p.service_ids.filter((x: string) => x !== s.id) : [...p.service_ids, s.id] }))}
                  className={`rounded-full border px-2 py-1 text-xs ${on ? 'border-[#ff4000] bg-[#ff4000]/10 text-[#ff4000]' : ''}`}>{on && <Check className="mr-1 inline h-3 w-3" />}{s.name}</button>;
              })}
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm"><span className="text-muted-foreground">{t('beautyServices.dureeTotale')} <b>{pkgDuration} min</b></span><span className="text-muted-foreground">Prix normal : <Money amount={pkgOriginal} /></span></div>
          <div><Label>Prix forfait (GNF)</Label><Input type="number" value={pkg.price} onChange={(e) => setPkg((p: any) => ({ ...p, price: +e.target.value || 0 }))} placeholder={`${pkgOriginal}`} /></div>
          <Button onClick={addPackage}><Plus className="h-4 w-4 mr-1" />{t('beautyServices.creerLeForfait')}</Button>
        </CardContent></Card>
        <div className="space-y-2">
          {packages.map((p) => (
            <Card key={p.id}><CardContent className="flex items-center gap-3 py-3">
              <Package className="h-5 w-5 text-[#ff4000]" />
              <div className="min-w-0"><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.total_duration_minutes} min · {p.service_ids.length} prestations</div></div>
              <div className="ml-auto text-right"><div className="font-bold text-[#ff4000]"><Money amount={p.price} /></div>{p.original_price > p.price && <div className="text-xs text-muted-foreground line-through"><Money amount={p.original_price} /></div>}</div>
              <Button size="icon" variant="ghost" onClick={() => removePackage(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardContent></Card>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}

export default BeautyServices;
