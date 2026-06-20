import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🏠 Page BIEN publique (/bien/:propertyId) — fiche + location en ligne.
 * Pour un bien en location : le locataire signe le bail et paie caution (escrow) + 1er
 * loyer en un clic (atomique). S'il a déjà un bail actif, il paie le loyer du mois.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/Money';
import { startRentalLease, payRent } from '@/hooks/useRentalLeases';
import { ArrowLeft, BedDouble, Bath, Maximize, MapPin, ShieldCheck, Loader2, CheckCircle2, Home, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function PropertyPage() {
  const { t } = useTranslation();
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [prop, setProp] = useState<any>(null);
  const [images, setImages] = useState<any[]>([]);
  const [lease, setLease] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!propertyId) return;
    const { data } = await supabase.from('properties').select('*, images:property_images(*)').eq('id', propertyId).maybeSingle();
    setProp(data); setImages((data as any)?.images ?? []);
    if (user && data) {
      const { data: l } = await supabase.from('rental_leases').select('*').eq('property_id', propertyId).eq('tenant_user_id', user.id).eq('status', 'active').maybeSingle();
      setLease(l);
    }
    setLoading(false);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [propertyId, user]);

  const rent = async () => {
    if (!user) { toast.error(t('propertyPage.connectezVousPourLouer')); navigate('/auth'); return; }
    if (!propertyId) return;
    setBusy(true);
    const res = await startRentalLease(propertyId, { tenant_name: user.user_metadata?.full_name, tenant_phone: user.phone });
    setBusy(false);
    if (res.success) { toast.success(t('propertyPage.bailSigneCautionSecurisee')); await load(); }
    else toast.error(res.error || 'Erreur location');
  };

  const payThisMonth = async () => {
    if (!lease) return;
    setBusy(true);
    const period = new Date().toISOString().slice(0, 7);
    const res = await payRent(lease.id, period);
    setBusy(false);
    if (res.success) { toast.success((res.data as any)?.already ? 'Loyer déjà payé ce mois' : 'Loyer payé ✓'); await load(); }
    else toast.error(res.error || 'Erreur paiement');
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff4000]" /></div>;
  if (!prop) return <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">Bien introuvable.</div>;

  const cover = images.find((i) => i.is_cover)?.image_url || images[0]?.image_url;
  const isRent = prop.offer_type === 'location';

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />{t('propertyPage.retour')}</Button>

      {cover
        ? <img src={cover} alt="" className="h-52 w-full rounded-xl object-cover" />
        : <div className="h-52 w-full rounded-xl bg-gradient-to-br from-[#04439e] to-[#ff4000] flex items-center justify-center"><Home className="h-16 w-16 text-white/80" /></div>}
      {images.length > 1 && <div className="flex gap-2 overflow-x-auto">{images.slice(0, 6).map((i) => <img key={i.id} src={i.image_url} alt="" className="h-16 w-16 rounded object-cover shrink-0" />)}</div>}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold">{prop.title}</h1>
          <Badge className={isRent ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-[#ff4000]'}>{isRent ? 'Location' : 'Vente'}</Badge>
        </div>
        <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{prop.neighborhood} {prop.city}</p>
      </div>

      <div className="flex gap-4 text-sm">
        <span className="flex items-center gap-1"><Maximize className="h-4 w-4 text-muted-foreground" />{prop.surface} m²</span>
        <span className="flex items-center gap-1"><BedDouble className="h-4 w-4 text-muted-foreground" />{prop.rooms} pièces</span>
        <span className="flex items-center gap-1"><Bath className="h-4 w-4 text-muted-foreground" />{prop.bathrooms} sdb</span>
      </div>

      {prop.description && <p className="text-sm">{prop.description}</p>}

      {isRent && (
        <Card className="border-[#ff4000]/20 bg-[#ff4000]/5"><CardContent className="p-4 text-sm space-y-1">
          <div className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-[#ff4000]" />{t('propertyPage.cautionSecuriseeSousSequestre')}</div>
          <p className="text-muted-foreground">{t('propertyPage.aLaSignature')} <b>{t('propertyPage.t1MoisDeCaution')}</b> {t('propertyPage.gardeeEnSequestreParLa')} <b>1er loyer</b>{t('propertyPage.chaqueLoyerGenereUne')} <b>quittance</b>.</p>
        </CardContent></Card>
      )}

      {/* Locataire avec bail actif : payer le loyer du mois */}
      {lease && (
        <Card className="border-green-500/30"><CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-green-700"><CheckCircle2 className="h-4 w-4" />{t('propertyPage.vousLouezCeBien')}</div>
          <Button className="w-full" disabled={busy} onClick={payThisMonth}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileText className="h-4 w-4 mr-1" />{t('propertyPage.payerLeLoyerDeCe')}</>}</Button>
        </CardContent></Card>
      )}

      {/* CTA */}
      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div><div className="text-xs text-muted-foreground">{isRent ? 'Loyer / mois' : 'Prix'}</div><div className="text-lg font-bold text-[#ff4000]"><Money amount={prop.price} from="GNF" /></div></div>
          {isRent
            ? (lease
                ? <Button className="ml-auto" disabled><CheckCircle2 className="h-4 w-4 mr-1" />Bail actif</Button>
                : <Button className="ml-auto" disabled={busy || prop.status === 'loue'} onClick={rent}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : prop.status === 'loue' ? 'Déjà loué' : 'Louer ce bien'}</Button>)
            : <Button className="ml-auto" variant="outline" onClick={() => toast.info(t('propertyPage.contactezLAgencePourCe'))}>{t('propertyPage.demanderUneVisite')}</Button>}
        </div>
      </div>
    </div>
  );
}
