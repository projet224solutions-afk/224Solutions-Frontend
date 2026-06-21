import { useTranslation } from "@/hooks/useTranslation";
/**
 * PARCOURS CLIENT ARTISAN — publier une demande puis comparer les devis reçus.
 * 5 étapes : métier → détails+photos → localisation → urgence/date → récapitulatif.
 * Onglet « Mes demandes » : suivi + jusqu'à 3 devis côte à côte + acceptation (backend atomique).
 */

import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Money } from '@/components/Money';
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, Clock, Loader2, MapPin, Navigation, Send, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { useGeoDistance } from '@/hooks/useGeoDistance';
import { useClientArtisanRequests, useQuotesForRequest, useArtisanInterventions } from '@/hooks/useArtisan';
import { useTrackLocation } from '@/hooks/useLiveLocation';
import { SimpleMapView } from '@/components/taxi-moto/SimpleMapView';
import type { ArtisanService } from '@/lib/artisan/calculator';

const TRADES: { code: ArtisanService; name: string; logo: string; hint: string }[] = [
  { code: 'plomberie', name: 'Plomberie', logo: '/service-icons/logo-plomberie.svg', hint: 'Fuite, robinet, chauffe-eau, WC…' },
  { code: 'vitrerie', name: 'Vitrerie', logo: '/service-icons/logo-vitrerie.svg', hint: 'Vitre cassée, miroir, double vitrage…' },
  { code: 'menuiserie', name: 'Menuiserie', logo: '/service-icons/logo-menuiserie.svg', hint: 'Porte, placard, cuisine, parquet…' },
  { code: 'soudure', name: 'Soudure & Métallerie', logo: '/service-icons/logo-soudure.svg', hint: 'Portail, grille, garde-corps…' },
];
const URGENCIES: { code: 'normal' | 'urgent' | 'immediate'; label: string; desc: string }[] = [
  { code: 'normal', label: 'Normal', desc: 'Sous quelques jours' },
  { code: 'urgent', label: 'Urgent', desc: 'Dans les 24-48h' },
  { code: 'immediate', label: 'Immédiat', desc: 'Aujourd\'hui (intervention d\'urgence)' },
];

export default function ArtisanRequest() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetType = params.get('type') as ArtisanService | null;
  const presetValid = TRADES.some((t) => t.code === presetType);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t('artisanRequest.retour')}</Button>
      <Tabs defaultValue="new">
        <TabsList>
          <TabsTrigger value="new">{t('artisanRequest.nouvelleDemande')}</TabsTrigger>
          <TabsTrigger value="mine">Mes demandes</TabsTrigger>
          <TabsTrigger value="interventions">Mes interventions</TabsTrigger>
        </TabsList>
        <TabsContent value="new"><NewRequestFlow presetType={presetValid ? presetType : null} /></TabsContent>
        <TabsContent value="mine"><MyRequests /></TabsContent>
        <TabsContent value="interventions"><MyInterventions /></TabsContent>
      </Tabs>
    </div>
  );
}

// ── Parcours 5 étapes ─────────────────────────────────────────────────────────
function NewRequestFlow({ presetType }: { presetType: ArtisanService | null }) {
  const { t } = useTranslation();
  const { createRequest } = useClientArtisanRequests();
  const { uploadFile } = useStorageUpload();
  const { userPosition, usingRealLocation } = useGeoDistance();

  const [step, setStep] = useState(presetType ? 1 : 0);
  const [service, setService] = useState<ArtisanService | null>(presetType);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'urgent' | 'immediate'>('normal');
  const [preferredDate, setPreferredDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setUploading(true);
    const res = await uploadFile(file, { folder: 'documents' as any, subfolder: `requests/${service ?? 'misc'}` });
    setUploading(false);
    if (res.success && res.publicUrl) setPhotos((p) => [...p, res.publicUrl!]);
    else toast.error(t('artisanRequest.uploadEchoue'));
  };

  const canNext = () => {
    if (step === 0) return !!service;
    if (step === 1) return title.trim().length >= 3;
    if (step === 2) return city.trim().length >= 2;
    return true;
  };

  const submit = async () => {
    if (!service) return;
    setSubmitting(true);
    const res = await createRequest({
      service_type: service, title: title.trim(), description, photos,
      address, city, urgency,
      latitude: usingRealLocation ? userPosition?.latitude : undefined,
      longitude: usingRealLocation ? userPosition?.longitude : undefined,
      preferred_date: preferredDate ? new Date(preferredDate).toISOString() : null,
    });
    setSubmitting(false);
    if (res.success) setDone(true);
  };

  if (done) {
    return (
      <Card><CardContent className="space-y-3 py-10 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h3 className="text-lg font-semibold">{t('artisanRequest.demandePubliee')}</h3>
        <p className="text-muted-foreground">Les artisans {service} proches vont vous envoyer leurs devis. Retrouvez-les dans l'onglet « Mes demandes ».</p>
      </CardContent></Card>
    );
  }

  const STEPS = ['Métier', 'Détails', 'Localisation', 'Urgence', 'Récapitulatif'];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Étape {step + 1}/5 — {STEPS[step]}</CardTitle>
        <div className="mt-2 flex gap-1">
          {STEPS.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded ${i <= step ? 'bg-[#ff4000]' : 'bg-muted'}`} />)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {TRADES.map((t) => (
              <button key={t.code} onClick={() => { setService(t.code); setStep(1); }}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition hover:border-[#ff4000] ${service === t.code ? 'border-[#ff4000] bg-[#ff4000]/5' : ''}`}>
                <img src={t.logo} alt={t.name} className="h-14 w-14" />
                <span className="font-semibold">{t.name}</span>
                <span className="text-center text-[11px] text-muted-foreground">{t.hint}</span>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div><Label>{t('artisanRequest.objetDeLaDemande')}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('artisanRequest.exFuiteSousLEvier')} /></div>
            <div><Label>{t('artisanRequest.descriptionDetailsUtiles')}</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder={t('artisanRequest.decrivezLeProblemeLesDimensions')} /></div>
            <div>
              <Label>{t('artisanRequest.photosRecommande')}</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {photos.map((p, i) => (
                  <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border">
                    <img src={p} alt="" className="h-full w-full object-cover" />
                    <button onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} className="absolute right-0 top-0 bg-black/50 p-1"><Trash2 className="h-3 w-3 text-white" /></button>
                  </div>
                ))}
                <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground hover:border-[#ff4000]">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                  <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
                </label>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div><Label>Ville *</Label><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex : Conakry" /></div>
            <div><Label>Adresse / quartier</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('artisanRequest.exKaloumPresDe')} /></div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />{usingRealLocation ? 'Votre position GPS sera jointe pour les artisans proches.' : 'Position GPS indisponible — renseignez bien la ville.'}
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label>Niveau d'urgence</Label>
            <div className="grid gap-2">
              {URGENCIES.map((u) => (
                <button key={u.code} onClick={() => setUrgency(u.code)}
                  className={`flex items-center justify-between rounded-lg border-2 p-3 text-left transition ${urgency === u.code ? 'border-[#ff4000] bg-[#ff4000]/5' : ''}`}>
                  <div><div className="font-semibold">{u.label}</div><div className="text-xs text-muted-foreground">{u.desc}</div></div>
                  {urgency === u.code && <CheckCircle2 className="h-5 w-5 text-[#ff4000]" />}
                </button>
              ))}
            </div>
            <div><Label>{t('artisanRequest.dateSouhaiteeOptionnel')}</Label><Input type="datetime-local" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} /></div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-2 text-sm">
            <Row k="Métier" v={TRADES.find((t) => t.code === service)?.name ?? ''} />
            <Row k="Objet" v={title} />
            {description && <Row k="Description" v={description} />}
            <Row k="Ville" v={city} />
            {address && <Row k="Adresse" v={address} />}
            <Row k="Urgence" v={URGENCIES.find((u) => u.code === urgency)?.label ?? ''} />
            {preferredDate && <Row k="Date souhaitée" v={new Date(preferredDate).toLocaleString()} />}
            <Row k="Photos" v={`${photos.length} jointe(s)`} />
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" disabled={step === 0 || submitting} onClick={() => setStep((s) => s - 1)}><ArrowLeft className="h-4 w-4 mr-1" />{t('artisanRequest.precedent')}</Button>
          {step < 4
            ? <Button disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>{t('artisanRequest.suivant')}<ArrowRight className="h-4 w-4 ml-1" /></Button>
            : <Button disabled={submitting} onClick={submit}>{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}Publier la demande</Button>}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  const { t } = useTranslation();
  return <div className="flex justify-between gap-4 border-b py-1"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v}</span></div>;
}

// ── Mes demandes + comparaison de devis ───────────────────────────────────────
function MyRequests() {
  const { t } = useTranslation();
  const { requests, loading } = useClientArtisanRequests();
  if (loading) return <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
  if (requests.length === 0) return <Card><CardContent className="py-10 text-center text-muted-foreground">{t('artisanRequest.aucuneDemandePourLeMoment')}</CardContent></Card>;
  return <div className="space-y-3">{requests.map((r) => <RequestCard key={r.id} requestId={r.id} title={r.title} status={r.status} service={r.service_type} createdAt={r.created_at} />)}</div>;
}

// ── Mes interventions : paiement acompte → validation → paiement solde ────────
function MyInterventions() {
  const { t } = useTranslation();
  const { interventions, loading, validate, payDeposit, payBalance } = useArtisanInterventions('client');
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
  if (interventions.length === 0) return <Card><CardContent className="py-10 text-center text-muted-foreground">{t('artisanRequest.aucuneInterventionAcceptezUnDevis')}</CardContent></Card>;

  const run = async (id: string, fn: () => Promise<boolean>) => { setBusy(id); await fn(); setBusy(null); };

  return (
    <div className="space-y-3">
      {interventions.map((i) => {
        const depositDone = !!i.deposit_paid_at;
        const balanceDone = !!i.balance_paid_at;
        const canValidate = i.status === 'completed';
        const canPayBalance = (i.status === 'completed' || i.status === 'validated') && !balanceDone;
        return (
          <Card key={i.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <span className="capitalize">{i.service_type}</span>
                <Badge variant="outline" className="capitalize">{i.status.replace('_', ' ')}</Badge>
                <span className="ml-auto text-sm font-normal">{t('artisanRequest.paye')} <b className="text-[#ff4000]"><Money amount={i.amount_paid ?? 0} /></b></span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              {!depositDone && (
                <Button size="sm" disabled={busy === i.id} onClick={() => run(i.id, () => payDeposit(i.id, 30))}>
                  {busy === i.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wallet className="h-4 w-4 mr-1" />}Payer l'acompte (30%)
                </Button>
              )}
              {depositDone && <Badge className="bg-green-600">{t('artisanRequest.acomptePaye')}</Badge>}
              {canValidate && (
                <Button size="sm" variant="outline" disabled={busy === i.id} onClick={() => run(i.id, () => validate(i.id))}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />Valider l'intervention
                </Button>
              )}
              {canPayBalance && (
                <Button size="sm" disabled={busy === i.id} onClick={() => run(i.id, () => payBalance(i.id))}>
                  {busy === i.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wallet className="h-4 w-4 mr-1" />}Payer le solde
                </Button>
              )}
              {balanceDone && <Badge className="bg-green-600">{t('artisanRequest.solde')}</Badge>}
            </CardContent>
            {i.status === 'en_route' && i.artisan_id && <ArtisanLiveTracker artisanId={i.artisan_id} />}
          </Card>
        );
      })}
    </div>
  );
}

// ── Suivi GPS live de l'artisan en route (réutilise le canal Realtime du taxi) ─
function ArtisanLiveTracker({ artisanId }: { artisanId: string }) {
  const { t } = useTranslation();
  const { position, connected } = useTrackLocation(artisanId);
  const { userPosition } = useGeoDistance();

  const distanceKm = useMemo(() => {
    if (!position || !userPosition) return null;
    const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(position.lat - userPosition.latitude);
    const dLng = toRad(position.lng - userPosition.longitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(userPosition.latitude)) * Math.cos(toRad(position.lat)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, [position, userPosition]);

  return (
    <div className="border-t p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Navigation className={`h-4 w-4 text-[#ff4000] ${position ? 'animate-pulse' : ''}`} />
        {position ? 'Artisan en route' : connected ? 'En attente de la position de l\'artisan…' : 'Connexion au suivi…'}
        {distanceKm !== null && <span className="ml-auto text-muted-foreground">≈ {distanceKm.toFixed(1)} km</span>}
      </div>
      {position && (
        <div className="h-48 overflow-hidden rounded-lg">
          <SimpleMapView
            driverLocation={{ latitude: position.lat, longitude: position.lng }}
            destinationLocation={userPosition ? { latitude: userPosition.latitude, longitude: userPosition.longitude } : undefined}
          />
        </div>
      )}
    </div>
  );
}

function RequestCard({ requestId, title, status, service, createdAt }: { requestId: string; title: string; status: string; service: string; createdAt: string }) {
  const { t } = useTranslation();
  const { quotes, acceptQuote } = useQuotesForRequest(requestId);
  const [accepting, setAccepting] = useState<string | null>(null);
  const top3 = useMemo(() => quotes.slice(0, 3), [quotes]);
  const accepted = quotes.find((q) => q.status === 'accepted');

  const onAccept = async (id: string) => { setAccepting(id); await acceptQuote(id); setAccepting(null); };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className="capitalize">{service}</span> — {title}
          <Badge variant="outline" className="capitalize">{status}</Badge>
          <span className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground"><Clock className="h-3 w-3" />{new Date(createdAt).toLocaleDateString()}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {quotes.length === 0 && <p className="text-sm text-muted-foreground">{t('artisanRequest.enAttenteDeDevisDes')}</p>}
        {quotes.length > 0 && (
          <>
            {!accepted && <p className="mb-2 text-sm font-medium">{quotes.length} devis reçu(s) — comparez et choisissez :</p>}
            <div className="grid gap-3 sm:grid-cols-3">
              {top3.map((q) => {
                const isAccepted = q.status === 'accepted';
                const disabled = !!accepted || q.status === 'refused';
                return (
                  <div key={q.id} className={`rounded-xl border-2 p-3 ${isAccepted ? 'border-green-600 bg-green-50' : disabled ? 'opacity-60' : 'border-muted'}`}>
                    <div className="text-xs text-muted-foreground">Devis</div>
                    <div className="text-lg font-bold text-[#ff4000]"><Money amount={q.total_ttc ?? 0} /></div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{(q.items?.length ?? 0)} ligne(s) · TVA {q.tax_rate ?? 18}%</div>
                    {q.notes && <p className="mt-1 line-clamp-2 text-[11px]">{q.notes}</p>}
                    {isAccepted
                      ? <Badge className="mt-2 bg-green-600">{t('artisanRequest.accepte')}</Badge>
                      : q.status === 'refused'
                        ? <Badge variant="outline" className="mt-2">{t('artisanRequest.ecarte')}</Badge>
                        : <Button size="sm" className="mt-2 w-full" disabled={disabled || accepting === q.id} onClick={() => onAccept(q.id)}>{accepting === q.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Choisir'}</Button>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
