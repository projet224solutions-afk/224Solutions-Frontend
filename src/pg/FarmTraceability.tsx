import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🌾 Page PUBLIQUE de traçabilité produit (scan QR, SANS connexion) — signature JD Agriculture.
 * Affiche : produit, ferme, agriculteur, localisation, semis/récolte, méthode de culture,
 * et une timeline du champ jusqu'à la vente. Lecture publique (RLS farm_products).
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Leaf, Sprout, MapPin, Calendar, ShieldCheck, Loader2, Tractor } from 'lucide-react';

const METHOD: Record<string, { label: string; Icon: any; color: string }> = {
  bio: { label: 'Agriculture biologique', Icon: Leaf, color: 'bg-green-100 text-green-700' },
  traitement: { label: "Avec traitement raisonné", Icon: Sprout, color: 'bg-amber-100 text-amber-700' },
  conventionnel: { label: 'Culture conventionnelle', Icon: Tractor, color: 'bg-slate-100 text-slate-700' },
};

export default function FarmTraceability() {
  const { t } = useTranslation();
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<any>(null);
  const [farmer, setFarmer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!productId) { setLoading(false); return; }
      const { data: p } = await supabase.from('farm_products').select('*').eq('id', productId).maybeSingle();
      if (!alive) return;
      setProduct(p);
      if (p) {
        const { data: svc } = await supabase
          .from('professional_services')
          .select('business_name, logo_url, cover_image_url, address, phone')
          .eq('id', p.professional_service_id).maybeSingle();
        if (alive) setFarmer(svc);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [productId]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff4000]" /></div>;
  if (!product) return <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">{t('farmTraceability.produitIntrouvableOuQrInvalide')}</div>;

  const method = METHOD[product.culture_method] || METHOD.conventionnel;
  const photo = product.photos?.[0] || farmer?.cover_image_url;

  const TimelineStep = ({ label, date, Icon, done }: { label: string; date?: string | null; Icon: any; done: boolean }) => (
    <div className="flex items-center gap-3">
      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${done ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'}`}><Icon className="h-4 w-4" /></div>
      <div><div className="text-sm font-medium">{label}</div>{date && <div className="text-xs text-muted-foreground">{new Date(date).toLocaleDateString()}</div>}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div className="text-center">
        <Badge className="bg-green-600">{t('farmTraceability.produitTrace224solutions')}</Badge>
      </div>

      {photo && <img src={photo} alt={product.name} className="h-48 w-full rounded-2xl object-cover" />}

      <Card><CardContent className="space-y-2 p-4">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={method.color}><method.Icon className="mr-1 h-3 w-3" />{method.label}</Badge>
          {product.organic && <Badge className="bg-green-100 text-green-700"><Leaf className="mr-1 h-3 w-3" />Bio</Badge>}
        </div>
        {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}
        <div className="text-lg font-bold text-[#ff4000]">{Number(product.price).toLocaleString()} GNF / {product.unit}</div>
      </CardContent></Card>

      <Card><CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          {farmer?.logo_url ? <img src={farmer.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100"><Tractor className="h-6 w-6 text-green-700" /></div>}
          <div>
            <div className="font-semibold">{product.farm_name || farmer?.business_name || 'Ferme'}</div>
            <div className="text-xs text-muted-foreground">{farmer?.business_name}</div>
          </div>
        </div>
        {(product.origin || farmer?.address) && <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-[#ff4000]" />{product.origin || farmer?.address}</div>}
        {(product.farm_latitude && product.farm_longitude) && (
          <a className="block text-xs text-blue-600 underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${product.farm_latitude}&mlon=${product.farm_longitude}#map=15/${product.farm_latitude}/${product.farm_longitude}`}>{t('farmTraceability.voirLaFermeSurLa')}</a>
        )}
      </CardContent></Card>

      <Card><CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-green-600" />{t('farmTraceability.duChampALaVente')}</div>
        <TimelineStep label="Semis / mise en culture" date={product.planting_date} Icon={Sprout} done={!!product.planting_date} />
        <TimelineStep label={t('farmTraceability.recolte')} date={product.harvest_date} Icon={Calendar} done={!!product.harvest_date} />
        <TimelineStep label={t('farmTraceability.misEnVenteSur224solutions')} date={product.created_at} Icon={ShieldCheck} done />
      </CardContent></Card>

      <p className="pb-6 text-center text-[11px] text-muted-foreground">{t('farmTraceability.tracabiliteGarantiePar224solutionsScanne')}</p>
    </div>
  );
}
