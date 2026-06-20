/**
 * ÉCRAN CENTRAL — Validation des ordonnances par le pharmacien.
 * File d'attente → ouverture d'une ordonnance → photo zoomable + saisie des médicaments + devis.
 * Validation TOUJOURS manuelle (responsabilité du pharmacien). Refus avec motif obligatoire.
 */
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { usePharmacyPrescriptions, type Prescription, type PrescriptionMed } from '@/hooks/usePharmacy';
import { usePrescriptionPhotos } from '@/hooks/usePharmacyClient';
import { FileText, Plus, Trash2, Check, X, ZoomIn, Clock, Loader2, ShieldAlert } from 'lucide-react';

/** Miniature d'ordonnance via URL signée (bucket privé). */
function PrescThumb({ prescriptionId, hasPhotos, className }: { prescriptionId: string; hasPhotos: boolean; className?: string }) {
  const { urls } = usePrescriptionPhotos(prescriptionId, hasPhotos);
  if (!hasPhotos) return null;
  if (!urls[0]) return <div className={`rounded border bg-muted flex items-center justify-center ${className || ''}`}><FileText className="h-4 w-4 text-muted-foreground" /></div>;
  return <img src={urls[0]} alt="ordonnance" className={`rounded object-cover border ${className || ''}`} />;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: 'À vérifier', cls: 'bg-red-100 text-red-700' },
  reviewing: { label: 'En cours', cls: 'bg-orange-100 text-orange-700' },
  quoted: { label: 'Devis envoyé', cls: 'bg-blue-100 text-blue-700' },
  validated: { label: 'Validée', cls: 'bg-emerald-100 text-emerald-700' },
  refused: { label: 'Refusée', cls: 'bg-gray-200 text-gray-600' },
  expired: { label: 'Expirée', cls: 'bg-gray-200 text-gray-600' },
};

export function PharmacyPrescriptionValidation({ serviceId }: { serviceId: string }) {
  const fc = useFormatCurrency();
  const { prescriptions, loading, validate, refuse } = usePharmacyPrescriptions(serviceId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [meds, setMeds] = useState<PrescriptionMed[]>([]);
  const [notes, setNotes] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [attested, setAttested] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const { urls: currentPhotos } = usePrescriptionPhotos(openId, !!openId);
  const [refusing, setRefusing] = useState(false);
  const [refuseReason, setRefuseReason] = useState('');
  const [busy, setBusy] = useState(false);

  // File = ordonnances non encore traitées (à vérifier / en cours / devis envoyé).
  const queue = prescriptions.filter((p) => ['pending', 'reviewing', 'quoted'].includes(p.status));
  const current = prescriptions.find((p) => p.id === openId) || null;

  const openPrescription = (p: Prescription) => {
    setOpenId(p.id);
    setMeds(p.medications_validated?.length ? p.medications_validated : [{ name: '', dosage: '', quantity: 1, price: 0, available: true }]);
    setNotes(p.pharmacist_notes || '');
    setDeliveryFee(Number((p as any).delivery_fee) || 0);
    setAttested(false);
    setRefusing(false); setRefuseReason('');
  };
  const addMed = () => setMeds((m) => [...m, { name: '', dosage: '', quantity: 1, price: 0, available: true }]);
  const setMed = (i: number, patch: Partial<PrescriptionMed>) => setMeds((m) => m.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const delMed = (i: number) => setMeds((m) => m.filter((_, idx) => idx !== i));
  const total = meds.reduce((s, m) => s + Math.max(0, Number(m.price) || 0) * Math.max(1, Math.round(Number(m.quantity) || 1)), 0);

  const doValidate = async () => {
    const valid = meds.filter((m) => m.name.trim() && Number(m.price) > 0);
    if (valid.length === 0) return;
    setBusy(true);
    const ok = await validate(current!.id, valid, notes, current!.delivery_type === 'delivery' ? deliveryFee : 0);
    setBusy(false);
    if (ok) setOpenId(null);
  };
  const doRefuse = async () => {
    if (!refuseReason.trim()) return;
    setBusy(true);
    const ok = await refuse(current!.id, refuseReason.trim());
    setBusy(false);
    if (ok) setOpenId(null);
  };

  if (loading) return <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">La validation engage votre responsabilité de pharmacien.</span> Avant de valider, vérifiez :
          lisibilité de l'ordonnance ; identité et signature du prescripteur ; date de validité (non périmée) ; identité du patient ;
          cohérence dosage / posologie / durée ; absence de contre-indication, d'interaction ou d'allergie connue ; disponibilité en stock.
          <span className="font-medium"> En cas de doute, refusez et orientez vers le médecin.</span>
        </div>
      </div>

      {queue.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <FileText className="mx-auto mb-2 h-10 w-10 opacity-40" /> Aucune ordonnance à traiter.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {queue.map((p) => {
            const st = STATUS_LABEL[p.status] || STATUS_LABEL.pending;
            return (
              <Card key={p.id} className="cursor-pointer hover:shadow-md transition" onClick={() => openPrescription(p)}>
                <CardContent className="flex items-center gap-3 py-3">
                  <PrescThumb prescriptionId={p.id} hasPhotos={!!p.photos?.length} className="h-12 w-12" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.customer_name || 'Client'}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(p.created_at).toLocaleString('fr-FR')}</div>
                  </div>
                  <Badge className={st.cls}>{st.label}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Ouverture d'une ordonnance : photo + saisie médicaments */}
      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          {current && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Photo(s) de l'ordonnance */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Ordonnance — {current.customer_name || 'Client'}</h3>
                {currentPhotos.length === 0 && <div className="rounded-lg border bg-muted py-10 text-center text-xs text-muted-foreground"><Loader2 className="mx-auto mb-1 h-4 w-4 animate-spin" /> Chargement de l'ordonnance…</div>}
                {currentPhotos.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt={`ordonnance ${i + 1}`} className="w-full rounded-lg border" />
                    <button onClick={() => setZoom(url)} className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 group-hover:opacity-100"><ZoomIn className="h-4 w-4" /></button>
                  </div>
                ))}
                {current.delivery_type && <p className="text-xs text-muted-foreground">Récupération : {current.delivery_type === 'delivery' ? `🛵 Livraison — ${current.delivery_address || ''}` : '🏪 Retrait en pharmacie'}</p>}
              </div>

              {/* Saisie des médicaments + devis */}
              {!refusing ? (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Médicaments (saisie pharmacien)</h3>
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    {meds.map((m, i) => (
                      <div key={i} className="rounded-lg border p-2 space-y-1.5">
                        <div className="flex gap-1.5">
                          <Input className="h-8 flex-1" placeholder="Nom du médicament" value={m.name} onChange={(e) => setMed(i, { name: e.target.value })} />
                          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => delMed(i)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          <Input className="h-8" placeholder="Dosage" value={m.dosage || ''} onChange={(e) => setMed(i, { dosage: e.target.value })} />
                          <Input className="h-8" type="number" min={1} placeholder="Qté" value={m.quantity} onChange={(e) => setMed(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                          <Input className="h-8" type="number" min={0} placeholder="Prix" value={m.price} onChange={(e) => setMed(i, { price: Math.max(0, Number(e.target.value) || 0) })} />
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <input type="checkbox" checked={m.available !== false} onChange={(e) => setMed(i, { available: e.target.checked })} /> En stock
                          {m.available === false && <Input className="h-7 ml-2 flex-1" placeholder="Équivalent proposé + note" value={m.note || ''} onChange={(e) => setMed(i, { note: e.target.value })} />}
                        </label>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" className="w-full gap-1" onClick={addMed}><Plus className="h-4 w-4" /> Ajouter un médicament</Button>
                  {current.delivery_type === 'delivery' && (
                    <div className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5">
                      <span className="text-xs flex items-center gap-1">🛵 Frais de livraison</span>
                      <Input className="h-8 w-28 text-right" type="number" min={0} value={deliveryFee} onChange={(e) => setDeliveryFee(Math.max(0, Number(e.target.value) || 0))} />
                    </div>
                  )}
                  <Textarea className="text-sm" rows={2} placeholder="Note au client (optionnel)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  <div className="space-y-0.5 border-t pt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Médicaments</span><span>{fc(total)}</span></div>
                    {current.delivery_type === 'delivery' && deliveryFee > 0 && <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Livraison</span><span>{fc(deliveryFee)}</span></div>}
                    <div className="flex items-center justify-between font-bold"><span>Total devis</span><span className="text-primary">{fc(total + (current.delivery_type === 'delivery' ? deliveryFee : 0))}</span></div>
                  </div>
                  <label className="flex items-start gap-2 rounded-lg bg-muted/50 px-2 py-1.5 text-xs cursor-pointer">
                    <input type="checkbox" className="mt-0.5" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
                    <span>J'atteste avoir vérifié l'ordonnance (lisibilité, prescripteur, validité, posologie, contre-indications) et engage ma responsabilité de pharmacien.</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="gap-1.5 text-destructive border-destructive/40" onClick={() => setRefusing(true)}><X className="h-4 w-4" /> Refuser</Button>
                    <Button className="gap-1.5" disabled={busy || total <= 0 || !attested} onClick={doValidate}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Valider l'ordonnance</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-destructive">Refuser l'ordonnance</h3>
                  <p className="text-xs text-muted-foreground">Motif obligatoire (illisible, non conforme, périmée…). Le client sera notifié.</p>
                  <Textarea rows={4} placeholder="Motif du refus…" value={refuseReason} onChange={(e) => setRefuseReason(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => setRefusing(false)}>Retour</Button>
                    <Button variant="destructive" disabled={busy || !refuseReason.trim()} onClick={doRefuse}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmer le refus'}</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Zoom plein écran de la photo */}
      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-w-4xl bg-black/95 p-2">
          {zoom && <img src={zoom} alt="ordonnance" className="max-h-[85vh] w-full object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PharmacyPrescriptionValidation;
