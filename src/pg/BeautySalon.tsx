import { useTranslation } from "@/hooks/useTranslation";
/**
 * 💇 Page PROFIL SALON (/beaute/:serviceId) — vitrine client : header (note + répartition),
 * onglets Services / Galerie avant-après / Avis vérifiés, favori, bouton Réserver.
 * Visible sans connexion (la connexion n'est demandée qu'à la réservation).
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Money } from '@/components/Money';
import { Progress } from '@/components/ui/progress';
import { useBeautyFavorites, getBeautyReviews, getBeautyRatingBreakdown } from '@/hooks/useBeautyDiscovery';
import { ArrowLeft, Star, Heart, MapPin, Clock, Loader2, Crown, Scissors, Image as ImageIcon, MessageSquare, Home } from 'lucide-react';

export default function BeautySalon() {
  const { t } = useTranslation();
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { favIds, toggle } = useBeautyFavorites();
  const [salon, setSalon] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [gallery, setGallery] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!serviceId) return;
      const [s, svcs, gal, rev, bd] = await Promise.all([
        supabase.from('professional_services').select('business_name, logo_url, cover_image_url, address, phone').eq('id', serviceId).maybeSingle(),
        supabase.from('beauty_services').select('*').eq('professional_service_id', serviceId).eq('is_active', true).order('category'),
        supabase.from('beauty_gallery').select('*').eq('professional_service_id', serviceId).eq('is_public', true).order('is_pinned', { ascending: false }).limit(30),
        getBeautyReviews(serviceId),
        getBeautyRatingBreakdown(serviceId),
      ]);
      setSalon(s.data); setServices((svcs.data as any[]) || []); setGallery((gal.data as any[]) || []);
      setReviews(rev); setBreakdown(bd); setLoading(false);
    })();
  }, [serviceId]);

  const { avg, total } = useMemo(() => {
    let sum = 0, n = 0;
    Object.entries(breakdown).forEach(([star, c]) => { sum += Number(star) * (c as number); n += c as number; });
    return { avg: n ? Math.round((sum / n) * 10) / 10 : 0, total: n };
  }, [breakdown]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#ff4000]" /></div>;
  if (!salon) return <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">Salon introuvable.</div>;

  const isFav = serviceId ? favIds.has(serviceId) : false;
  const book = (svcId?: string) => navigate(`/beaute/${serviceId}/reserver${svcId ? `?service=${svcId}` : ''}`);

  return (
    <div className="mx-auto max-w-2xl pb-24">
      {/* Couverture */}
      <div className="relative h-44 bg-[#ff4000]">
        {salon.cover_image_url && <img src={salon.cover_image_url} alt="" className="h-full w-full object-cover" />}
        <Button variant="ghost" size="icon" className="absolute left-2 top-2 bg-white/80" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        {serviceId && <button onClick={() => toggle(serviceId)} className="absolute right-2 top-2 rounded-full bg-white/90 p-2"><Heart className={`h-5 w-5 ${isFav ? 'fill-[#ff4000] text-[#ff4000]' : 'text-muted-foreground'}`} /></button>}
      </div>

      <div className="space-y-4 p-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Crown className="h-6 w-6 text-[#ff4000]" />{salon.business_name}</h1>
          <p className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{salon.address || 'Salon'}</p>
          {total > 0 && <div className="mt-1 flex items-center gap-1 text-sm"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /><b>{avg}</b><span className="text-muted-foreground">({total} avis)</span></div>}
        </div>

        <Tabs defaultValue="services">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="services"><Scissors className="h-4 w-4 mr-1" />{t('beautySalon.services')}</TabsTrigger>
            <TabsTrigger value="gallery"><ImageIcon className="h-4 w-4 mr-1" />Galerie</TabsTrigger>
            <TabsTrigger value="reviews"><MessageSquare className="h-4 w-4 mr-1" />Avis</TabsTrigger>
          </TabsList>

          {/* SERVICES */}
          <TabsContent value="services" className="space-y-2">
            {services.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t('beautySalon.aucunePrestationPubliee')}</p>}
            {services.map((s) => (
              <Card key={s.id}><CardContent className="flex items-center gap-3 p-3">
                {s.image_url && <img src={s.image_url} alt="" className="h-14 w-14 rounded object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{s.name}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{s.duration_minutes} min{s.is_home_service && <Badge variant="outline" className="gap-1 text-[10px]"><Home className="h-3 w-3" />Domicile</Badge>}</div>
                  {s.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{s.description}</p>}
                </div>
                <div className="text-right">
                  <div className="font-bold text-[#ff4000]"><Money amount={s.price} /></div>
                  <Button size="sm" className="mt-1" onClick={() => book(s.id)}>{t('beautySalon.reserver')}</Button>
                </div>
              </CardContent></Card>
            ))}
          </TabsContent>

          {/* GALERIE */}
          <TabsContent value="gallery">
            {gallery.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t('beautySalon.pasEncoreDeRealisations')}</p> : (
              <div className="grid grid-cols-2 gap-2">
                {gallery.map((g) => (
                  <div key={g.id} className="overflow-hidden rounded-lg border">
                    <div className="grid grid-cols-2">
                      {g.before_url ? <img src={g.before_url} alt="avant" className="h-24 w-full object-cover" /> : <div className="h-24 bg-muted" />}
                      {g.after_url ? <img src={g.after_url} alt={t('beautySalon.apres')} className="h-24 w-full object-cover" /> : (g.image_url ? <img src={g.image_url} alt="" className="h-24 w-full object-cover col-span-2" /> : <div className="h-24 bg-muted" />)}
                    </div>
                    {g.service_category && <p className="p-1 text-center text-[10px] capitalize text-muted-foreground">{g.service_category}</p>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* AVIS */}
          <TabsContent value="reviews" className="space-y-3">
            {total > 0 && (
              <Card><CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="text-center"><div className="text-3xl font-bold">{avg}</div><div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3 w-3 ${i < Math.round(avg) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />)}</div><div className="text-xs text-muted-foreground">{total} avis</div></div>
                  <div className="flex-1 space-y-1">
                    {[5, 4, 3, 2, 1].map((star) => { const c = Number(breakdown[star] || 0); return (
                      <div key={star} className="flex items-center gap-2 text-xs"><span className="w-3">{star}</span><Star className="h-3 w-3 fill-amber-400 text-amber-400" /><Progress value={total ? (c / total) * 100 : 0} className="h-1.5 flex-1" /><span className="w-5 text-muted-foreground">{c}</span></div>
                    ); })}
                  </div>
                </div>
              </CardContent></Card>
            )}
            {reviews.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t('beautySalon.aucunAvisPourLeMoment')}</p> : reviews.map((r, i) => (
              <Card key={i}><CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.name}</span>
                  <span className="flex">{Array.from({ length: r.rating }).map((_, j) => <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}</span>
                </div>
                {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">{r.service} · {r.date ? new Date(r.date).toLocaleDateString() : ''}</p>
              </CardContent></Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* CTA fixe */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-2xl"><Button className="w-full" onClick={() => book()}>{t('beautySalon.reserverUnRendezVous')}</Button></div>
      </div>
    </div>
  );
}
