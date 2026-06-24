import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🍽️ MARKETPLACE CLIENT — LISTE DES RESTAURANTS (spec « Visibilité Marketplace »).
 * - Recherche FIXE + filtres scrollables (sticky), résultats instantanés sans rechargement.
 * - Cartes : photo, nom, cuisine, note+avis, ETA (temps réel par distance), frais/gratuite,
 *   badges Promo (rouge) · Nouveau (bleu) · Populaire (orange) · Fermé (gris).
 * - VISIBLE SANS CONNEXION (route publique). La connexion n'est requise qu'à la commande.
 * - Ordre géré par le hook (promo → ouvert → plan → note/commandes).
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, MapPin, Clock, ArrowLeft, UtensilsCrossed, Tag, Bike, Heart } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useGeoDistance, calculateDistance } from '@/hooks/useGeoDistance';
import { useRestaurantsDiscovery, type DiscoveryRestaurant } from '@/hooks/useRestaurantsDiscovery';
import { useRestaurantFavorites } from '@/hooks/useRestaurantFavorites';

/** Attente liée aux livreurs disponibles (ajoutée à l'ETA) : moins de livreurs = plus d'attente. */
function driverWaitMinutes(available: number): number {
  if (available >= 5) return 0;
  if (available >= 2) return 3;
  if (available >= 1) return 7;
  return 12;
}

interface EnrichedRestaurant extends DiscoveryRestaurant {
  distanceKm: number | null;
  etaMinutes: number;
}

type FilterId = 'all' | 'favorites' | 'fast' | 'top' | 'promo' | 'takeaway' | 'dinein' | 'halal' | 'veg' | 'cheap';

const FILTERS: { id: FilterId; label: string; test: (r: EnrichedRestaurant) => boolean }[] = [
  { id: 'all', label: "Tous", test: () => true },
  { id: 'fast', label: "⚡ Livraison -30min", test: (r) => r.etaMinutes <= 30 },
  { id: 'top', label: '⭐ Note 4+', test: (r) => r.rating >= 4 },
  { id: 'promo', label: '🔥 Promos en cours', test: (r) => r.hasPromo },
  { id: 'takeaway', label: "🏃 À emporter", test: (r) => r.menuCount > 0 },
  { id: 'dinein', label: "🪑 Sur table", test: (r) => r.menuCount > 0 },
  { id: 'halal', label: 'Halal', test: (r) => r.dietaryTags.includes('halal') },
  { id: 'veg', label: "🌱 Végétarien", test: (r) => r.dietaryTags.some((t) => t.startsWith('veg')) },
  { id: 'cheap', label: 'Livraison < 5 000', test: (r) => r.freeDelivery || r.deliveryFee < 5000 },
];

export default function Restaurants() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fc = useFormatCurrency();
  const { restaurants, availableDrivers, loading, error } = useRestaurantsDiscovery();
  const { userPosition } = useGeoDistance();
  const { isFavorite, toggleFavorite, isLoggedIn } = useRestaurantFavorites();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');

  // ETA temps réel : prépa + trajet (distance ≈ 3 min/km) + attente selon livreurs disponibles.
  const driverWait = driverWaitMinutes(availableDrivers);
  const enriched = useMemo<EnrichedRestaurant[]>(() => restaurants.map((r) => {
    const distanceKm = (r.lat != null && r.lng != null && userPosition)
      ? calculateDistance(userPosition.latitude, userPosition.longitude, r.lat, r.lng)
      : null;
    const travel = distanceKm != null ? Math.round(distanceKm * 3) : 10;
    return { ...r, distanceKm, etaMinutes: r.etaBaseMinutes + travel + driverWait };
  }), [restaurants, userPosition, driverWait]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const passFilter = (r: EnrichedRestaurant) =>
      filter === 'favorites' ? isFavorite(r.id) : (FILTERS.find((x) => x.id === filter) || FILTERS[0]).test(r);
    return enriched.filter((r) =>
      passFilter(r) &&
      (q === '' || r.name.toLowerCase().includes(q) || (r.cuisine || '').toLowerCase().includes(q) ||
        (r.city || '').toLowerCase().includes(q) || (r.neighborhood || '').toLowerCase().includes(q)));
  }, [enriched, filter, query, isFavorite]);

  const onToggleFav = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); e.preventDefault();
    if (!isLoggedIn) { navigate('/auth'); return; }
    await toggleFavorite(id);
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-10">
      {/* Recherche FIXE + filtres STICKY */}
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-3xl px-3 pt-3">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-muted" aria-label={t('restaurants.retour')}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('restaurants.rechercherUnRestaurantUneCuisine')}
                className="h-11 rounded-full pl-9 text-base"
              />
            </div>
          </div>
          <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {isLoggedIn && (
              <button
                onClick={() => setFilter('favorites')}
                className={cn(
                  'flex items-center gap-1 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                  filter === 'favorites' ? 'border-[#ff4000] bg-[#ff4000] text-white' : 'bg-background hover:bg-muted',
                )}
              >
                <Heart className={cn('h-3.5 w-3.5', filter === 'favorites' && 'fill-white')} /> Mes favoris
              </button>
            )}
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                  filter === f.id ? 'border-[#ff4000] bg-[#ff4000] text-white' : 'bg-background hover:bg-muted',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-3 pt-4">
        <h1 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <UtensilsCrossed className="h-5 w-5 text-[#ff4000]" />
          Restaurants {loading ? '' : <span className="text-sm font-normal text-muted-foreground">({results.length})</span>}
        </h1>

        {loading && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-56 animate-pulse rounded-xl bg-muted" />)}
          </div>
        )}

        {error && <p className="py-10 text-center text-destructive">{error}</p>}

        {!loading && !error && results.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <UtensilsCrossed className="mx-auto mb-3 h-10 w-10 opacity-40" />
            Aucun restaurant ne correspond à votre recherche.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => navigate(`/restaurant/${r.id}/menu`)}
              className="group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Bannière + badges */}
              <div className="relative h-32 w-full bg-muted">
                {r.cover_image_url
                  ? <img src={r.cover_image_url} alt={r.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                  : <div className="flex h-full items-center justify-center text-muted-foreground"><UtensilsCrossed className="h-8 w-8" /></div>}
                <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                  {r.hasPromo && <Badge className="gap-1 bg-red-600 text-white hover:bg-red-600"><Tag className="h-3 w-3" />{r.promoLabel || 'Promo'}</Badge>}
                  {r.isNew && <Badge className="bg-blue-600 text-white hover:bg-blue-600">{t('restaurants.nouveau')}</Badge>}
                  {r.isPopular && <Badge className="bg-orange-500 text-white hover:bg-orange-500">Populaire</Badge>}
                </div>
                {/* Favori (connecté) : cœur en haut à droite */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => onToggleFav(e, r.id)}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/85 shadow-sm transition-colors hover:bg-white"
                  aria-label={isFavorite(r.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  <Heart className={cn('h-4 w-4', isFavorite(r.id) ? 'fill-[#ff4000] text-[#ff4000]' : 'text-gray-600')} />
                </span>
                {!r.isOpen && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                    <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-semibold text-gray-700">{t('restaurants.ferme')}</span>
                  </div>
                )}
              </div>
              {/* Infos */}
              <div className="space-y-1.5 p-3">
                <div className="flex items-start gap-2">
                  {r.logo_url && <img src={r.logo_url} alt="" className="h-9 w-9 shrink-0 rounded-lg border object-cover" loading="lazy" />}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold leading-tight">{r.name}</h3>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.cuisine || [r.neighborhood, r.city].filter(Boolean).join(', ') || 'Restaurant'}
                    </p>
                  </div>
                  {r.isOpen && <Badge variant="outline" className="shrink-0 border-emerald-300 text-emerald-700">Ouvert</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-medium text-foreground">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {r.rating > 0 ? r.rating.toFixed(1) : 'Nouveau'}
                    {r.total_reviews > 0 && <span className="font-normal text-muted-foreground"> ({r.total_reviews} avis)</span>}
                  </span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />~{r.etaMinutes} min</span>
                  <span className="flex items-center gap-1">
                    <Bike className="h-3.5 w-3.5" />
                    {r.freeDelivery
                      ? <span className="font-medium text-emerald-600">Gratuite</span>
                      : r.deliveryFee > 0 ? fc(r.deliveryFee) : 'Livraison'}
                  </span>
                </div>
                {r.minPrice != null && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />Dès {fc(r.minPrice)}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
