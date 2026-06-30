import { useTranslation } from "@/hooks/useTranslation";
/**
 * Service PHARMACIE — interface CLIENT (patient).
 * Accueil : « J'ai une ordonnance » + « Pharmacie de garde » + liste des pharmacies (public).
 * Flux : scan ordonnance → choix pharmacie → mode récupération → envoi → devis → paiement → suivi.
 * Sécurité médicale : badge « Appelez le 15 » sur toutes les vues. Wallet + Copilot intégrés.
 */
import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { usePharmaciesDiscovery, useClientPrescriptions, useMedicationReminders, usePrescriptionPhotos, uploadPrescriptionPhoto, type PharmacyCard } from '@/hooks/usePharmacyClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { WalletBar } from '@/components/service-common/WalletBar';
import { Copilot224 } from '@/components/service-common/Copilot224';
import { PharmacySafetyBadge } from '@/components/pharmacy/PharmacySafetyBadge';
import {
  FileText, ShieldPlus, MapPin, Star, Truck, Store, Camera, X, Loader2,
  Check, Clock, Pill, CheckCircle2, XCircle, AlarmClock, Plus, Trash2, BellRing,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Pharmacie() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fc = useFormatCurrency();
  const { pharmacies, loading } = usePharmaciesDiscovery();
  const { prescriptions, orders, loading: loadingMine, sendPrescription, payPrescription } = useClientPrescriptions();

  const [onlyOnCall, setOnlyOnCall] = useState(false);
  const [tab, setTab] = useState<'pharmacies' | 'mine' | 'reminders'>('pharmacies');
  const [flow, setFlow] = useState<PharmacyCard | null>(null);
  // Photos d'ordonnance : on garde le CHEMIN privé (envoyé au backend) + un aperçu LOCAL
  // (objet URL) pour l'affichage avant envoi — le bucket est privé, pas d'URL publique.
  const [photos, setPhotos] = useState<{ path: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('pickup');
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const list = useMemo(() => {
    const arr = onlyOnCall ? pharmacies.filter((p) => p.on_call) : pharmacies;
    // De garde en premier, puis note décroissante.
    return [...arr].sort((a, b) => (Number(b.on_call) - Number(a.on_call)) || ((b.rating || 0) - (a.rating || 0)));
  }, [pharmacies, onlyOnCall]);

  const startOrder = (p: PharmacyCard) => {
    if (!user) { toast.info(t('pharmacie.connectezVousPourEnvoyerUne')); navigate('/auth'); return; }
    setFlow(p); setPhotos([]); setDeliveryType('pickup'); setAddress(''); setName(''); setPhone('');
  };

  const onPickPhotos = async (files: FileList | null) => {
    if (!files?.length || !user) return;
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 5)) {
        const res = await uploadPrescriptionPhoto(f, user.id);
        if (res?.path) setPhotos((p) => [...p, { path: res.path, preview: URL.createObjectURL(f) }]);
      }
    } catch { toast.error(t('pharmacie.echecDeLUpload')); } finally { setUploading(false); }
  };

  const submit = async () => {
    if (!flow || photos.length === 0) { toast.error(t('pharmacie.ajoutezAuMoinsUnePhoto')); return; }
    if (deliveryType === 'delivery' && !address.trim()) { toast.error(t('pharmacie.adresseDeLivraisonRequise')); return; }
    setSending(true);
    const ok = await sendPrescription({ pharmacy_id: flow.id, photos: photos.map((p) => p.path), delivery_type: deliveryType, delivery_address: address.trim() || undefined, customer_name: name.trim() || undefined, customer_phone: phone.trim() || undefined });
    setSending(false);
    if (ok) { setFlow(null); setTab('mine'); }
  };

  const pay = async (id: string) => { setPayingId(id); await payPrescription(id); setPayingId(null); };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container mx-auto px-4 py-5 space-y-4">
        <div className="flex items-center gap-2"><Pill className="h-6 w-6 text-[#ff4000]" /><h1 className="text-xl font-bold">Pharmacie</h1></div>
        <PharmacySafetyBadge />
        {user && <WalletBar className="w-full" />}

        {/* 2 grandes entrées */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={() => { setTab('pharmacies'); setOnlyOnCall(false); }} className="flex items-center gap-3 rounded-xl bg-[#04439e] p-4 text-left text-white hover:opacity-95">
            <FileText className="h-7 w-7" /><div><div className="font-bold">{t('pharmacie.jAiUneOrdonnance')}</div><div className="text-xs text-white/80">{t('pharmacie.choisissezUnePharmacieCiDessous')}</div></div>
          </button>
          <button onClick={() => { setTab('pharmacies'); setOnlyOnCall(true); }} className="flex items-center gap-3 rounded-xl bg-red-600 p-4 text-left text-white hover:opacity-95">
            <ShieldPlus className="h-7 w-7" /><div><div className="font-bold">{t('pharmacie.pharmacieDeGarde')}</div><div className="text-xs text-white/80">Ouvertes en urgence (nuit / week-end)</div></div>
          </button>
        </div>

        {/* Onglets */}
        <div className="flex gap-2">
          <Button variant={tab === 'pharmacies' ? 'default' : 'outline'} size="sm" onClick={() => setTab('pharmacies')}>Pharmacies</Button>
          {user && <Button variant={tab === 'mine' ? 'default' : 'outline'} size="sm" onClick={() => setTab('mine')}>Mes ordonnances</Button>}
          {user && <Button variant={tab === 'reminders' ? 'default' : 'outline'} size="sm" className="gap-1.5" onClick={() => setTab('reminders')}><AlarmClock className="h-4 w-4" /> Mes rappels</Button>}
        </div>

        {tab === 'pharmacies' ? (
          <>
            {onlyOnCall && <p className="text-sm text-red-600 font-medium">{t('pharmacie.affichageDesPharmaciesDeGarde')}</p>}
            {loading ? <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
              : list.length === 0 ? <Card><CardContent className="py-10 text-center text-muted-foreground">Aucune pharmacie {onlyOnCall ? 'de garde ' : ''}disponible.</CardContent></Card>
              : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {list.map((p) => (
                    <Card key={p.id} className="overflow-hidden">
                      {p.cover_image_url && <img src={p.cover_image_url} alt={p.business_name} className="h-24 w-full object-cover" />}
                      <CardContent className="space-y-2 p-3">
                        <div className="flex items-center gap-2">
                          {p.logo_url && <img src={p.logo_url} alt="" className="h-8 w-8 rounded-full object-cover" />}
                          <div className="min-w-0 flex-1"><div className="font-semibold truncate">{p.business_name}</div>
                            {p.address && <div className="text-xs text-muted-foreground flex items-center gap-1 truncate"><MapPin className="h-3 w-3" />{p.address}</div>}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {p.on_call && <Badge className="bg-red-600 text-white gap-1"><ShieldPlus className="h-3 w-3" />{t('pharmacie.deGarde')}</Badge>}
                          {p.total_reviews ? <Badge variant="outline" className="gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{Number(p.rating).toFixed(1)} ({p.total_reviews})</Badge> : <Badge variant="outline">{t('pharmacie.nouveau')}</Badge>}
                        </div>
                        <Button className="w-full gap-1.5" size="sm" onClick={() => startOrder(p)}><FileText className="h-4 w-4" /> {t('pharmacie.envoyerUneOrdonnance')}</Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
          </>
        ) : tab === 'mine' ? (
          <MyPrescriptions {...{ prescriptions, orders, loading: loadingMine, fc, pay, payingId }} />
        ) : (
          <MyReminders />
        )}
      </div>

      {/* Flux d'envoi d'ordonnance */}
      <Dialog open={!!flow} onOpenChange={(o) => !o && setFlow(null)}>
        <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Envoyer à {flow?.business_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{t('pharmacie.placezVotreOrdonnanceSurUne')}</p>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((ph, i) => (
                <div key={i} className="relative"><img src={ph.preview} alt="" className="h-20 w-full rounded object-cover border" />
                  <button onClick={() => setPhotos((p) => p.filter((_, idx) => idx !== i))} className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive p-0.5 text-white"><X className="h-3 w-3" /></button>
                </div>
              ))}
              <label className="flex h-20 cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed text-muted-foreground hover:border-primary">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Camera className="h-5 w-5" /><span className="text-[10px]">{t('pharmacie.ajouter')}</span></>}
                <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => onPickPhotos(e.target.files)} />
              </label>
            </div>
            <div>
              <Label className="text-xs">{t('pharmacie.modeDeRecuperation')}</Label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <Button type="button" variant={deliveryType === 'pickup' ? 'default' : 'outline'} size="sm" className="gap-1.5" onClick={() => setDeliveryType('pickup')}><Store className="h-4 w-4" /> Retrait (gratuit)</Button>
                <Button type="button" variant={deliveryType === 'delivery' ? 'default' : 'outline'} size="sm" className="gap-1.5" onClick={() => setDeliveryType('delivery')}><Truck className="h-4 w-4" /> {t('pharmacie.livraison')}</Button>
              </div>
            </div>
            {deliveryType === 'delivery' && <div><Label className="text-xs">{t('pharmacie.adresseDeLivraison')}</Label><Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('pharmacie.votreAdresseComplete')} /></div>}
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Nom (optionnel)</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label className="text-xs">{t('pharmacie.telephone')}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+224…" /></div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFlow(null)}>{t('pharmacie.annuler')}</Button>
            <Button onClick={submit} disabled={sending || photos.length === 0} className="gap-1.5">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Envoyer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Copilot224 service="pharmacie" title="Copilot Pharmacie" />
    </div>
  );
}

/** Miniature d'ordonnance via URL signée (bucket privé). */
function PrescriptionThumb({ prescriptionId, hasPhotos }: { prescriptionId: string; hasPhotos: boolean }) {
  const { t } = useTranslation();
  const { urls } = usePrescriptionPhotos(prescriptionId, hasPhotos);
  if (!hasPhotos) return null;
  if (!urls[0]) return <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center"><FileText className="h-4 w-4 text-muted-foreground" /></div>;
  return <img src={urls[0]} alt="" className="h-10 w-10 rounded object-cover border" />;
}

/** Mes ordonnances : statut, devis (accepter & payer), suivi de commande. */
function MyPrescriptions({ prescriptions, orders, loading, fc, pay, payingId }: any) {
  const { t } = useTranslation();
  if (loading) return <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>;
  if (!prescriptions.length) return <Card><CardContent className="py-10 text-center text-muted-foreground"><FileText className="mx-auto mb-2 h-10 w-10 opacity-40" /> {t('pharmacie.aucuneOrdonnanceEnvoyee')}</CardContent></Card>;
  const orderByPresc = new Map(orders.map((o: any) => [o.prescription_id, o]));
  const STEPS = ['preparing', 'ready', 'delivering', 'delivered'];
  return (
    <div className="space-y-2">
      {prescriptions.map((p: any) => {
        const order = orderByPresc.get(p.id);
        return (
          <Card key={p.id}><CardContent className="space-y-2 py-3">
            <div className="flex items-center gap-2">
              <PrescriptionThumb prescriptionId={p.id} hasPhotos={!!p.photos?.length} />
              <div className="min-w-0 flex-1"><div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(p.created_at).toLocaleString('fr-FR')}</div></div>
              {p.status === 'refused' && <Badge className="bg-gray-200 text-gray-700 gap-1"><XCircle className="h-3 w-3" />{t('pharmacie.refusee')}</Badge>}
              {['pending', 'reviewing'].includes(p.status) && <Badge className="bg-orange-100 text-orange-700 gap-1"><Clock className="h-3 w-3" />{t('pharmacie.enVerification')}</Badge>}
              {order && <Badge className="bg-emerald-100 text-emerald-700">{t('pharmacie.payee')}</Badge>}
            </div>

            {p.status === 'refused' && p.refuse_reason && <p className="rounded bg-gray-50 p-2 text-xs text-gray-600">Motif : {p.refuse_reason}</p>}

            {/* Devis reçu → accepter et payer */}
            {p.status === 'quoted' && !order && (
              <div className="rounded-lg border p-2 space-y-1.5">
                <div className="text-xs font-semibold">{t('pharmacie.devisDuPharmacien')}</div>
                {(p.medications_validated || []).map((m: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs"><span>{m.quantity}× {m.name}{m.dosage ? ` (${m.dosage})` : ''}{m.available === false ? ' — équivalent proposé' : ''}</span><span>{fc(Number(m.price) * Number(m.quantity || 1))}</span></div>
                ))}
                {p.pharmacist_notes && <p className="text-[11px] text-muted-foreground">Note : {p.pharmacist_notes}</p>}
                <div className="border-t pt-1.5 space-y-0.5">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>{t('pharmacie.medicaments')}</span><span>{fc(p.total_quoted || 0)}</span></div>
                  {p.delivery_type === 'delivery' && Number(p.delivery_fee) > 0 && <div className="flex items-center justify-between text-[11px] text-muted-foreground"><span>{t('pharmacie.livraison2')}</span><span>{fc(p.delivery_fee)}</span></div>}
                  <div className="flex items-center justify-between font-bold"><span>{t('pharmacie.totalAPayer')}</span><span className="text-primary">{fc((Number(p.total_quoted) || 0) + (p.delivery_type === 'delivery' ? Number(p.delivery_fee) || 0 : 0))}</span></div>
                </div>
                <Button className="w-full gap-1.5" size="sm" disabled={payingId === p.id} onClick={() => pay(p.id)}>{payingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Accepter et payer</Button>
              </div>
            )}

            {/* Suivi de la commande payée */}
            {order && (
              <div className="flex items-center gap-1 text-[11px]">
                {STEPS.map((s, i) => {
                  const reached = STEPS.indexOf(order.status === 'collected' ? 'delivered' : order.status) >= i;
                  const labels: any = { preparing: 'Préparation', ready: 'Prête', delivering: 'En livraison', delivered: 'Reçue' };
                  if (s === 'delivering' && order.delivery_type !== 'delivery') return null;
                  return <span key={s} className={`flex items-center gap-1 ${reached ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}`}>{reached ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{labels[s]}{i < STEPS.length - 1 && ' →'}</span>;
                })}
              </div>
            )}
          </CardContent></Card>
        );
      })}
    </div>
  );
}

/** Mes rappels de prise : le client saisit nom + heures ; une notification le prévient à l'heure.
 *  ⚠️ Aucun conseil médical — c'est juste un réveil pour respecter le traitement prescrit. */
function MyReminders() {
  const { t } = useTranslation();
  const { reminders, loading, addReminder, removeReminder } = useMedicationReminders();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [durationDays, setDurationDays] = useState('');
  const [saving, setSaving] = useState(false);
  // AMÉLIORATION 2.1 — traitements du client qui se terminent bientôt (renouvellement)
  const [renewals, setRenewals] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('my_treatments_ending_soon' as any, { p_days_ahead: 3 });
      if ((data as any)?.success) setRenewals((data as any).treatments || []);
    })();
  }, [reminders]);

  const addTime = () => setTimes((t) => (t.length >= 6 ? t : [...t, '12:00']));
  const setTimeAt = (i: number, v: string) => setTimes((t) => t.map((x, idx) => (idx === i ? v : x)));
  const removeTime = (i: number) => setTimes((t) => (t.length <= 1 ? t : t.filter((_, idx) => idx !== i)));

  const submit = async () => {
    if (!name.trim()) { toast.error(t('pharmacie.indiquezLeNomDuMedicament')); return; }
    setSaving(true);
    const ok = await addReminder({
      medication_name: name.trim(), times,
      duration_days: durationDays ? Math.max(1, parseInt(durationDays, 10) || 0) : null,
    });
    setSaving(false);
    if (ok) { setName(''); setTimes(['08:00']); setDurationDays(''); }
  };

  return (
    <div className="space-y-3">
      {/* AMÉLIORATION 2.1 — rappel de renouvellement de traitement */}
      {renewals.length > 0 && (
        <div className="space-y-2">
          {renewals.map((r) => (
            <Card key={r.id} className="border-[#ff4000]/40 bg-orange-50">
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <Pill className="h-5 w-5 shrink-0 text-[#ff4000]" />
                <div className="min-w-0 flex-1 text-sm">
                  💊 Votre traitement <strong>{r.medication_name}</strong> se termine
                  {' '}{r.days_left <= 0 ? "aujourd'hui" : `dans ${r.days_left} jour(s)`}. Pensez à renouveler.
                </div>
                <Button size="sm" className="gap-1.5 shrink-0" onClick={() => navigate('/pharmacie')}>Commander</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Card><CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><BellRing className="h-4 w-4 text-[#ff4000]" /> {t('pharmacie.nouveauRappel')}</div>
        <p className="text-xs text-muted-foreground">{t('pharmacie.recevezUneNotificationAL')}</p>
        <div><Label className="text-xs">{t('pharmacie.medicament')}</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('pharmacie.exParacetamol500mg')} /></div>
        <div>
          <Label className="text-xs">{t('pharmacie.heuresDePrise')}</Label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {times.map((t, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input type="time" value={t} onChange={(e) => setTimeAt(i, e.target.value)} className="h-8 w-[110px]" />
                {times.length > 1 && <button onClick={() => removeTime(i)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>}
              </div>
            ))}
            {times.length < 6 && <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={addTime}><Plus className="h-3.5 w-3.5" /> Heure</Button>}
          </div>
        </div>
        <div className="max-w-[200px]"><Label className="text-xs">{t('pharmacie.dureeJoursOptionnel')}</Label><Input type="number" min={1} value={durationDays} onChange={(e) => setDurationDays(e.target.value)} placeholder="Ex : 7" /></div>
        <Button size="sm" onClick={submit} disabled={saving} className="gap-1.5">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter le rappel</Button>
      </CardContent></Card>

      {loading ? <div className="py-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
        : reminders.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground"><AlarmClock className="mx-auto mb-2 h-9 w-9 opacity-40" /> {t('pharmacie.aucunRappelAjoutezEnUn')}</CardContent></Card>
        : (
          <div className="space-y-2">
            {reminders.map((r) => (
              <Card key={r.id}><CardContent className="flex items-center gap-3 py-3">
                <Pill className="h-5 w-5 shrink-0 text-[#ff4000]" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{r.medication_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(r.times || []).map((t) => t.slice(0, 5)).join(' · ')}
                    {r.duration_days ? ` — ${r.duration_days} j` : ''}
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeReminder(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </CardContent></Card>
            ))}
          </div>
        )}
    </div>
  );
}
