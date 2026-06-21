import { useTranslation } from "@/hooks/useTranslation";
/**
 * 💇 Découverte BEAUTÉ (client) — section marketplace beauté : cartes riches de salons
 * avec note, prix à partir de, badges (À domicile / Walk-in / Nouveau) + favoris.
 * Visible sans connexion ; la connexion est demandée seulement à la réservation.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Money } from '@/components/Money';
import { useBeautyProviders, useBeautyFavorites, isNewProvider } from '@/hooks/useBeautyDiscovery';
import { ArrowLeft, Search, Star, Home, DoorOpen, Heart, MapPin, Loader2, Scissors, Crown } from 'lucide-react';

type Filter = 'all' | 'home' | 'walkin' | 'top' | 'fav';

export default function BeautyDiscovery() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { providers, loading } = useBeautyProviders();
  const { favIds, toggle } = useBeautyFavorites();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [cat, setCat] = useState<string>('');

  const cats = useMemo(() => [...new Set(providers.flatMap((p) => p.categories))].slice(0, 8), [providers]);

  const list = useMemo(() => providers.filter((p) => {
    if (q && !p.business_name.toLowerCase().includes(q.toLowerCase()) && !(p.address || '').toLowerCase().includes(q.toLowerCase())) return false;
    if (cat && !p.categories.includes(cat)) return false;
    if (filter === 'home') return p.hasHome;
    if (filter === 'walkin') return p.acceptsWalkin;
    if (filter === 'top') return p.rating >= 4;
    if (filter === 'fav') return favIds.has(p.id);
    return true;
  }), [providers, q, cat, filter, favIds]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-xl font-bold flex items-center gap-2"><Crown className="h-5 w-5 text-[#ff4000]" />{t('beautyDiscovery.beauteBienEtre')}</h1>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => navigate('/mes-rdv-beaute')}>Mes RDV</Button>
      </div>

      <div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Salon, quartier…" className="pl-8" /></div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {([['all', 'Tous'], ['home', 'À domicile'], ['walkin', 'Walk-in OK'], ['top', 'Note 4★+'], ['fav', 'Favoris']] as [Filter, string][]).map(([f, l]) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} className="shrink-0" onClick={() => setFilter(f)}>{l}</Button>
        ))}
        {cats.map((c) => <Button key={c} size="sm" variant={cat === c ? 'default' : 'outline'} className="shrink-0 capitalize" onClick={() => setCat(cat === c ? '' : c)}>{c}</Button>)}
      </div>

      {loading ? <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#ff4000]" /></div> : list.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">{t('beautyDiscovery.aucunSalonTrouve')}</p>
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <Card key={p.id} className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/beaute/${p.id}`)}>
              <div className="relative h-28 bg-[#ff4000]">
                {p.cover_image_url && <img src={p.cover_image_url} alt="" className="h-full w-full object-cover" />}
                <button onClick={(e) => { e.stopPropagation(); toggle(p.id); }} className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5">
                  <Heart className={`h-4 w-4 ${favIds.has(p.id) ? 'fill-[#ff4000] text-[#ff4000]' : 'text-muted-foreground'}`} />
                </button>
              </div>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold flex items-center gap-1">{p.business_name}{isNewProvider(p.created_at) && <Badge className="bg-green-100 text-green-700 text-[10px]">{t('beautyDiscovery.nouveau')}</Badge>}</h3>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{p.address || 'Salon'}</p>
                    <p className="mt-1 text-xs capitalize text-muted-foreground flex items-center gap-1"><Scissors className="h-3 w-3" />{p.categories.slice(0, 3).join(' · ') || 'Beauté'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {p.rating > 0 && <div className="flex items-center gap-1 justify-end text-sm"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{p.rating} <span className="text-xs text-muted-foreground">({p.reviews})</span></div>}
                    <div className="text-xs text-muted-foreground">{t('beautyDiscovery.aPartirDe')}</div>
                    <div className="font-bold text-[#ff4000]"><Money amount={p.minPrice} from="GNF" /></div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.hasHome && <Badge variant="outline" className="gap-1 text-[10px]"><Home className="h-3 w-3" />{t('beautyDiscovery.aDomicile')}</Badge>}
                  {p.acceptsWalkin && <Badge variant="outline" className="gap-1 text-[10px]"><DoorOpen className="h-3 w-3" />Walk-in OK</Badge>}
                </div>
                <Button size="sm" className="mt-2 w-full" onClick={(e) => { e.stopPropagation(); navigate(`/beaute/${p.id}`); }}>{t('beautyDiscovery.voirReserver')}</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
