import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🌾 Catalogue produits agriculteur — CRUD réel + QR de traçabilité + toggle disponibilité.
 * Chaque produit génère un QR pointant vers sa page publique /trace/:id (signature JD Agriculture).
 */

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useFarmProducts, type FarmProduct } from '@/hooks/useFarm';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Money } from '@/components/Money';
import { Plus, QrCode, Trash2, Eye, EyeOff, Camera, Loader2, Leaf, Download } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['Fruits & Légumes', 'Céréales & Grains', 'Élevage', 'Produits laitiers', 'Épices', 'Autre'];
const UNITS = ['kg', 'pièce', 'litre', 'botte', 'sac', 'caisse'];

const EMPTY = {
  name: '', category: CATEGORIES[0], description: '', unit: 'kg', price: 0, stock_quantity: 0,
  season: '', origin: '', organic: false, planting_date: '', harvest_date: '',
  culture_method: 'conventionnel' as FarmProduct['culture_method'], farm_name: '', photos: [] as string[],
};

export function FarmProductCatalog({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const { products, loading, createProduct, toggleActive, removeProduct } = useFarmProducts(serviceId);
  const { uploadFile } = useStorageUpload();
  const [open, setOpen] = useState(false);
  const [qrFor, setQrFor] = useState<FarmProduct | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const traceUrl = (id: string) => `${window.location.origin}/trace/${id}`;

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || form.photos.length >= 5) return;
    setUploading(true);
    const res = await uploadFile(file, { folder: 'restaurant' as any, subfolder: `farm/${serviceId}` });
    setUploading(false);
    if (res.success && res.publicUrl) setForm((f) => ({ ...f, photos: [...f.photos, res.publicUrl!] }));
    else toast.error(t('farmProductCatalog.uploadEchoue'));
  };

  const submit = async () => {
    if (!form.name.trim()) { toast.error('Nom requis'); return; }
    setSaving(true);
    const created = await createProduct({
      ...form,
      price: Number(form.price) || 0,
      stock_quantity: Number(form.stock_quantity) || 0,
      planting_date: form.planting_date || null,
      harvest_date: form.harvest_date || null,
    } as any);
    setSaving(false);
    if (created) { setForm({ ...EMPTY }); setOpen(false); setQrFor(created); }
  };

  const downloadQr = (p: FarmProduct) => {
    const svg = document.getElementById(`qr-${p.id}`);
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `QR-${p.name}.svg`; a.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />{t('farmProductCatalog.nouveauProduit')}</Button>
      </div>

      {loading ? <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.length === 0 && <p className="col-span-full text-sm text-muted-foreground">{t('farmProductCatalog.aucunProduitAjoutezVotrePremiere')}</p>}
          {products.map((p) => (
            <Card key={p.id} className={p.is_active ? '' : 'opacity-60'}>
              <CardContent className="space-y-2 p-2">
                <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                  {p.photos?.[0] ? <img src={p.photos[0]} alt={p.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Leaf className="h-8 w-8 text-muted-foreground" /></div>}
                  <Badge className={`absolute left-1 top-1 text-[10px] ${p.is_active && p.stock_quantity > 0 ? 'bg-green-600' : 'bg-slate-500'}`}>{p.is_active && p.stock_quantity > 0 ? 'En vente' : 'Indisponible'}</Badge>
                </div>
                <div className="text-sm font-semibold leading-tight">{p.name}</div>
                <div className="text-sm font-bold text-[#ff4000]"><Money amount={p.price} /> <span className="text-[11px] font-normal text-muted-foreground">/ {p.unit}</span></div>
                <div className="text-[11px] text-muted-foreground">Stock : {p.stock_quantity} {p.unit}</div>
                <div className="flex gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setQrFor(p)} title={t('farmProductCatalog.qrTracabilite')}><QrCode className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => toggleActive(p)} title={p.is_active ? 'Désactiver' : 'Activer'}>{p.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeProduct(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Formulaire nouveau produit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('farmProductCatalog.nouveauProduit')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex : Mangues Kent" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>{t('farmProductCatalog.categorie')}</Label><select className="w-full rounded-md border px-2 py-2 text-sm" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><Label>{t('farmProductCatalog.unite')}</Label><select className="w-full rounded-md border px-2 py-2 text-sm" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Prix (GNF)</Label><Input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: +e.target.value || 0 }))} /></div>
              <div><Label>Stock</Label><Input type="number" value={form.stock_quantity} onChange={(e) => setForm((f) => ({ ...f, stock_quantity: +e.target.value || 0 }))} /></div>
            </div>
            <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
            {/* Traçabilité */}
            <div className="rounded-lg border p-2 space-y-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">{t('farmProductCatalog.tracabilitePageQr')}</div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">{t('farmProductCatalog.nomDeLaFerme')}</Label><Input value={form.farm_name} onChange={(e) => setForm((f) => ({ ...f, farm_name: e.target.value }))} /></div>
                <div><Label className="text-xs">Origine / région</Label><Input value={form.origin} onChange={(e) => setForm((f) => ({ ...f, origin: e.target.value }))} placeholder="Ex : Kankan" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">{t('farmProductCatalog.dateDeSemis')}</Label><Input type="date" value={form.planting_date} onChange={(e) => setForm((f) => ({ ...f, planting_date: e.target.value }))} /></div>
                <div><Label className="text-xs">{t('farmProductCatalog.dateDeRecolte')}</Label><Input type="date" value={form.harvest_date} onChange={(e) => setForm((f) => ({ ...f, harvest_date: e.target.value }))} /></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1"><Label className="text-xs">{t('farmProductCatalog.methode')}</Label><select className="w-full rounded-md border px-2 py-2 text-sm" value={form.culture_method} onChange={(e) => setForm((f) => ({ ...f, culture_method: e.target.value as any }))}><option value="bio">Bio</option><option value="traitement">{t('farmProductCatalog.traitementRaisonne')}</option><option value="conventionnel">Conventionnel</option></select></div>
                <label className="mt-5 flex items-center gap-1 text-sm"><input type="checkbox" checked={form.organic} onChange={(e) => setForm((f) => ({ ...f, organic: e.target.checked }))} />Bio</label>
              </div>
            </div>
            {/* Photos */}
            <div>
              <Label>Photos ({form.photos.length}/5)</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {form.photos.map((p, i) => <img key={i} src={p} alt="" className="h-16 w-16 rounded object-cover" />)}
                {form.photos.length < 5 && (
                  <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded border-2 border-dashed text-muted-foreground hover:border-[#ff4000]">
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                    <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
                  </label>
                )}
              </div>
            </div>
            <Button onClick={submit} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}Publier (avec QR de traçabilité)</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR de traçabilité */}
      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle className="text-base">QR traçabilité · {qrFor?.name}</DialogTitle></DialogHeader>
          {qrFor && (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-lg bg-white p-3"><QRCodeSVG id={`qr-${qrFor.id}`} value={traceUrl(qrFor.id)} size={200} /></div>
              <p className="text-center text-xs text-muted-foreground">{t('farmProductCatalog.imprimezCeQrSurVos')}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => downloadQr(qrFor)}><Download className="h-4 w-4 mr-1" />{t('farmProductCatalog.telecharger')}</Button>
                <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(traceUrl(qrFor.id)); toast.success(t('farmProductCatalog.lienCopie')); }}>{t('farmProductCatalog.copierLeLien')}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default FarmProductCatalog;
