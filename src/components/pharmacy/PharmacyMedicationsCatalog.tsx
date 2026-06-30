import { useTranslation } from "@/hooks/useTranslation";
/**
 * Catalogue de médicaments de la pharmacie (CRUD). Nom, dosage, forme, prix, stock,
 * sous ordonnance (oui/non), équivalents génériques, seuil d'alerte stock bas.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Money } from '@/components/Money';
import { supabase } from '@/integrations/supabase/client';
import { usePharmacyMedications, type Medication } from '@/hooks/usePharmacy';
import { Plus, Search, Trash2, Pencil, Loader2, Pill, AlertTriangle, ShieldAlert } from 'lucide-react';

const FORMS = ['comprimé', 'sirop', 'pommade', 'injectable', 'gélule', 'gouttes', 'autre'];
const CONTROL_LEVELS: { value: string; label: string }[] = [
  { value: 'none', label: 'Libre' },
  { value: 'prescription', label: 'Sur ordonnance' },
  { value: 'controlled', label: 'Contrôlé (registre)' },
  { value: 'narcotic', label: 'Stupéfiant (registre strict)' },
];
const isControlled = (m: Partial<Medication>) => m.control_level === 'controlled' || m.control_level === 'narcotic';

export function PharmacyMedicationsCatalog({ serviceId }: { serviceId: string }) {
  const { t } = useTranslation();
  const { medications, loading, upsert, remove } = usePharmacyMedications(serviceId);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Medication>>({});
  // CONFORMITÉ 1.4B — alertes de péremption (propriétaire)
  const [expiryAlerts, setExpiryAlerts] = useState<{ expired: any[]; expiring_soon: any[] } | null>(null);
  useEffect(() => {
    if (!serviceId) return;
    (async () => {
      const { data } = await supabase.rpc('pharmacy_expiry_alerts' as any, { p_pharmacy_id: serviceId, p_days_ahead: 30 });
      if ((data as any)?.success) setExpiryAlerts(data as any);
    })();
  }, [serviceId, medications]);

  const filtered = medications.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));
  const edit = (m?: Medication) => { setForm(m ? { ...m } : { requires_prescription: true, stock: 0, price: 0, low_stock_threshold: 5, generic_equivalents: [] }); setOpen(true); };
  const save = async () => {
    if (!form.name?.trim()) return;
    setSaving(true);
    const ok = await upsert(form);
    setSaving(false);
    if (ok) setOpen(false);
  };

  if (loading) return <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder={t('pharmacyMedicationsCatalog.rechercherUnMedicament')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button onClick={() => edit()} className="gap-1.5 shrink-0"><Plus className="h-4 w-4" /> {t('pharmacyMedicationsCatalog.ajouter')}</Button>
      </div>

      {/* CONFORMITÉ 1.4B — alertes de péremption */}
      {expiryAlerts && expiryAlerts.expired.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span><strong>{expiryAlerts.expired.length}</strong> médicament(s) PÉRIMÉ(S) — à retirer de la vente.</span>
        </div>
      )}
      {expiryAlerts && expiryAlerts.expiring_soon.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span><strong>{expiryAlerts.expiring_soon.length}</strong> médicament(s) expirent dans moins de 30 jours.</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground"><Pill className="mx-auto mb-2 h-10 w-10 opacity-40" /> {t('pharmacyMedicationsCatalog.aucunMedicamentAjoutezVotreCatalogue')}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const low = m.stock <= m.low_stock_threshold;
            return (
              <Card key={m.id}><CardContent className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium flex items-center gap-2">{m.name}{m.dosage ? <span className="text-xs text-muted-foreground">{m.dosage}</span> : null}
                    {m.requires_prescription && <Badge variant="outline" className="text-[10px]">{t('pharmacyMedicationsCatalog.surOrdonnance')}</Badge>}
                    {isControlled(m) && <Badge className="text-[10px] gap-1 bg-red-600 text-white hover:bg-red-600"><ShieldAlert className="h-3 w-3" />{m.control_level === 'narcotic' ? 'Stupéfiant' : 'Contrôlé'}</Badge>}</div>
                  <div className="text-xs text-muted-foreground">{m.form || '—'} · <Money amount={m.price || 0} /></div>
                </div>
                <Badge variant="outline" className={low ? 'text-red-700 border-red-300 gap-1' : 'gap-1'}>{low && <AlertTriangle className="h-3 w-3" />}{m.stock} en stock</Badge>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => edit(m)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { if (confirm(`Supprimer ${m.name} ?`)) remove(m.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </CardContent></Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Modifier' : 'Ajouter'} un médicament</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nom *</Label><Input value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Dosage</Label><Input value={form.dosage || ''} onChange={(e) => setForm((f) => ({ ...f, dosage: e.target.value }))} placeholder="500mg" /></div>
              <div><Label>Forme</Label>
                <select className="w-full rounded-md border px-2 py-2 text-sm" value={form.form || ''} onChange={(e) => setForm((f) => ({ ...f, form: e.target.value }))}>
                  <option value="">—</option>{FORMS.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Prix</Label><Input type="number" min={0} value={form.price ?? 0} onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) || 0 }))} /></div>
              <div><Label>Stock</Label><Input type="number" min={0} value={form.stock ?? 0} onChange={(e) => setForm((f) => ({ ...f, stock: Number(e.target.value) || 0 }))} /></div>
              <div><Label>Alerte ≤</Label><Input type="number" min={0} value={form.low_stock_threshold ?? 5} onChange={(e) => setForm((f) => ({ ...f, low_stock_threshold: Number(e.target.value) || 0 }))} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requires_prescription !== false} onChange={(e) => setForm((f) => ({ ...f, requires_prescription: e.target.checked }))} /> {t('pharmacyMedicationsCatalog.medicamentSousOrdonnance')}</label>
            {/* CONFORMITÉ 1.4A — niveau de contrôle + péremption + lot */}
            <div>
              <Label>Niveau de contrôle</Label>
              <select className="w-full rounded-md border px-2 py-2 text-sm" value={form.control_level || 'none'} onChange={(e) => setForm((f) => ({ ...f, control_level: e.target.value as Medication['control_level'] }))}>
                {CONTROL_LEVELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {isControlled(form) && <p className="mt-1 text-xs text-red-700">Chaque délivrance sera consignée au registre légal.</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date de péremption</Label><Input type="date" value={form.expiry_date || ''} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value || null }))} /></div>
              <div><Label>N° de lot</Label><Input value={form.batch_number || ''} onChange={(e) => setForm((f) => ({ ...f, batch_number: e.target.value || null }))} placeholder="Lot" /></div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>{t('pharmacyMedicationsCatalog.annuler')}</Button>
            <Button onClick={save} disabled={saving || !form.name?.trim()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PharmacyMedicationsCatalog;
