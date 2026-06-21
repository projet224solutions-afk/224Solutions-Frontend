import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Camera,
  Dumbbell,
  GraduationCap,
  Heart,
  Home,
  Laptop,
  MapPin,
  Phone,
  RefreshCw,
  Scissors,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Truck,
  Utensils,
  Wrench,
  Car,
  Square,
  Hammer,
  Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import QuickFooter from "@/components/QuickFooter";
import { cn } from "@/lib/utils";
import { useGeoDistance, formatDistance, calculateDistance } from "@/hooks/useGeoDistance";
import { getServiceVisual } from "@/config/serviceVisuals";

interface ProfessionalService {
  id: string;
  business_name: string;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  portfolio_images?: string[] | null;
  rating?: number | null;
  total_reviews?: number | null;
  city?: string | null;
  neighborhood?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
  service_type_id?: string | null;
  service_type?: {
    id: string;
    name: string;
    code?: string;
    category?: string;
  } | null;
  distance?: number | null;
  media_count?: number;
}

const RADIUS_KM = 20;

type ServiceCategory = {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
};

/**
 * Single source of truth for category filters.
 * The `id` matches the `service_types.code` values stored in the database,
 * AND the `?type=` values sent from Proximite.tsx.
 */
const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: "all", name: "Tous", icon: Store },
  { id: "restaurant", name: "Restaurants", icon: Utensils },
  { id: "beaute", name: "Beauté & Coiffure", icon: Scissors },
  { id: "reparation", name: "Réparation", icon: Wrench },
  { id: "menage", name: "Nettoyage & Ménage", icon: Sparkles },
  { id: "location", name: "Immobilier", icon: Building2 },
  { id: "education", name: "Éducation & Formation", icon: GraduationCap },
  { id: "media", name: "Photo & Vidéo", icon: Camera },
  { id: "sport", name: "Sport & Fitness", icon: Dumbbell },
  { id: "sante", name: "Santé & Bien-être", icon: Heart },
  { id: "informatique", name: "Informatique & Tech", icon: Laptop },
  { id: "construction", name: "Construction & BTP", icon: Building2 },
  { id: "plomberie", name: "Plomberie", icon: Wrench },
  { id: "vitrerie", name: "Vitrerie", icon: Square },
  { id: "menuiserie", name: "Menuiserie", icon: Hammer },
  { id: "soudure", name: "Soudure & Métallerie", icon: Flame },
  { id: "agriculture", name: "Agriculture", icon: ShoppingBag },
  { id: "freelance", name: "Services Pro", icon: Briefcase },
  { id: "maison", name: "Maison & Déco", icon: Home },
  { id: "ecommerce", name: "Boutique / E-commerce", icon: Store },
  { id: "vtc", name: "Transport VTC", icon: Car },
  { id: "livraison", name: "Livraison", icon: Truck },
];

export default function ServicesProximite() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userPosition, positionReady, usingRealLocation } = useGeoDistance();
  const [services, setServices] = useState<ProfessionalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedCategory = searchParams.get("type") || "all";
  // Pays sélectionné dans le marketplace ('all' = Mondial). En mode pays, on borne la
  // proximité à ce pays (et on lève le couperet des 20 km pour parcourir son catalogue).
  const selectedCountry = searchParams.get("country") || "all";
  // Ville sélectionnée ('all' = toutes). Filtre les services par ville (bidirectionnel).
  const selectedCity = searchParams.get("city") || "all";

  const setSelectedCategory = useCallback((cat: string) => {
    if (cat === "all") {
      searchParams.delete("type");
    } else {
      searchParams.set("type", cat);
    }
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  // Filtre VILLE contrôlable sur la page (synchronisé à l'URL ?city=)
  const setSelectedCity = useCallback((c: string) => {
    if (!c || c === "all") {
      searchParams.delete("city");
    } else {
      searchParams.set("city", c);
    }
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const positionRef = useRef({ lat: userPosition.latitude, lng: userPosition.longitude });
  const loadingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    document.title = t('servicesProximite.servicesDeProximite224solutions');
  }, []);

  const loadServices = useCallback(async (lat: number, lng: number) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      setLoading(true);

      const norm = (s?: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();

      // Étape 1 : IDs des services pro avec abonnement actif (RPC SECURITY DEFINER → contourne la RLS)
      const { data: activeSubData } = await supabase.rpc('get_active_service_subscription_limits');
      const activeServiceIds: string[] = [
        ...new Set((activeSubData || []).map((r: any) => r.professional_service_id as string).filter(Boolean)),
      ];

      // Étape 2 : LISTINGS UNIFIÉS (atomique) = services pro abonnés + boutiques/vendeurs
      // (localisation effective + pays + GPS déjà résolus côté serveur). Inclut les boutiques
      // créées comme `vendor` (ex. BMS/Labé) qui n'ont pas de fiche professional_services.
      let list: ProfessionalService[] = [];
      let serviceIdsForGallery: string[] = [];
      let unifiedOk = false;
      try {
        const { data: rows, error: rErr } = await supabase
          .rpc('get_proximity_listings', { p_service_ids: activeServiceIds });
        if (!rErr && Array.isArray(rows)) {
          list = rows.map((r: any) => ({
            id: r.id,
            business_name: r.business_name,
            description: r.description,
            address: r.address,
            phone: r.phone,
            email: r.email,
            logo_url: r.logo_url,
            cover_image_url: r.cover_image_url || null,
            rating: Number(r.rating) || 0,
            total_reviews: r.total_reviews || 0,
            neighborhood: r.neighborhood,
            latitude: r.latitude,
            longitude: r.longitude,
            user_id: r.user_id,
            service_type: { id: r.service_type_id, name: r.service_type_name, code: r.service_type_code, category: r.service_type_category },
            _city: r.effective_city ?? null,
            _country: r.effective_country ?? null,
            _source: r.source,
          })) as any;
          serviceIdsForGallery = rows.filter((r: any) => r.source === 'service').map((r: any) => r.id);
          unifiedOk = true;
        }
      } catch { /* repli ci-dessous */ }

      // Repli durci si la RPC unifiée n'est pas appliquée : services pro abonnés seuls.
      if (!unifiedOk) {
        if (activeServiceIds.length === 0) { setServices([]); return; }
        const { data, error } = await supabase
          .from('professional_services')
          .select('id,business_name,description,address,phone,email,logo_url,cover_image_url,rating,total_reviews,city,neighborhood,latitude,longitude,status,service_type_id,user_id,service_types (id, name, code, category)')
          .eq('status', 'active').in('id', activeServiceIds);
        if (error) throw error;
        const resolved = new Map<string, any>();
        try {
          const { data: rl } = await supabase.rpc('get_services_resolved_location', { p_service_ids: activeServiceIds });
          (rl || []).forEach((r: any) => resolved.set(r.service_id, { city: r.effective_city, country: r.effective_country, lat: r.latitude, lng: r.longitude }));
        } catch { /* */ }
        list = (data || []).map((item: any) => {
          const r = resolved.get(item.id);
          return {
            ...item,
            service_type: item.service_types,
            _city: r?.city ?? ((item.city || '').trim() || null),
            _country: r?.country ?? null,
            latitude: item.latitude ?? r?.lat ?? null,
            longitude: item.longitude ?? r?.lng ?? null,
            _source: 'service',
          };
        }) as any;
        serviceIdsForGallery = list.map((s) => s.id);
      }

      // Étape 3 : galerie (cover) pour les listings de type service (les boutiques utilisent leur logo/cover)
      if (serviceIdsForGallery.length > 0) {
        const { data: galleryData } = await supabase
          .from('service_gallery_images')
          .select('professional_service_id, image_url, media_type, is_cover, display_order')
          .in('professional_service_id', serviceIdsForGallery)
          .eq('media_type', 'image')
          .not('image_url', 'is', null)
          .order('display_order', { ascending: true });
        const byService = new Map<string, any[]>();
        (galleryData || []).forEach((row: any) => {
          if (!byService.has(row.professional_service_id)) byService.set(row.professional_service_id, []);
          byService.get(row.professional_service_id)!.push(row);
        });
        list = list.map((s) => {
          if (s.cover_image_url) return s;
          const photos = byService.get(s.id);
          if (photos && photos.length) {
            const cover = photos.find((p: any) => p.is_cover) || photos[0];
            if (cover?.image_url) return { ...s, cover_image_url: cover.image_url } as any;
          }
          return s;
        });
      }

      // Filtrage par PAYS (sur le pays effectif)
      if (selectedCountry && selectedCountry !== 'all') {
        const target = norm(selectedCountry);
        list = list.filter((s) => norm((s as any)._country) === target);
      }

      // Calculer la distance pour chaque service (null si GPS absent/invalide)
      const isCountryMode = selectedCountry && selectedCountry !== 'all';
      const withDistance = list.map((s) => {
        const lat_val = Number(s.latitude);
        const lng_val = Number(s.longitude);
        const hasValidCoords =
          s.latitude != null && s.longitude != null &&
          Number.isFinite(lat_val) && Number.isFinite(lng_val) &&
          !(lat_val === 0 && lng_val === 0);

        const distance = hasValidCoords
          ? calculateDistance(lat, lng, lat_val, lng_val)
          : null;
        return { ...s, distance };
      });

      // Mode PAYS : tout le catalogue du pays, trié par proximité (sans couperet 20 km,
      // les services sans GPS atterrissent en fin de liste).
      // Mode MONDIAL : uniquement les services avec GPS valide dans les 20 km.
      const nearby = (isCountryMode
        ? withDistance
        : withDistance.filter((s) => s.distance !== null && s.distance <= RADIUS_KM)
      ).sort((a, b) => {
        // Plus proche = premier ; à égalité, meilleure note = premier
        const distDiff = (a.distance ?? 999999) - (b.distance ?? 999999);
        return distDiff !== 0 ? distDiff : (b.rating ?? 0) - (a.rating ?? 0);
      });

      console.log(
        `Proximité: ${list.length} services${isCountryMode ? ` (pays=${selectedCountry})` : ''}, ` +
        `${nearby.length} affichés${isCountryMode ? '' : ` dans les ${RADIUS_KM} km`}`
      );

      setServices(nearby);
    } catch (error) {
      console.error('Erreur chargement services:', error);
      toast.error(t('servicesProximite.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [selectedCountry]);

  // Recharger quand le pays sélectionné change (le filtre pays est appliqué côté chargement)
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    loadServices(positionRef.current.lat, positionRef.current.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountry]);

  // Charger immédiatement au montage avec la position disponible (cache ou défaut Conakry)
  // Ne pas bloquer sur positionReady — la position initiale est déjà valide
  useEffect(() => {
    if (hasLoadedRef.current) return;
    const lat = userPosition.latitude;
    const lng = userPosition.longitude;
    positionRef.current = { lat, lng };
    hasLoadedRef.current = true;
    loadServices(lat, lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recharger si le GPS réel arrive et que la position a bougé de plus de 100m
  useEffect(() => {
    if (!positionReady || !hasLoadedRef.current) return;

    const newLat = userPosition.latitude;
    const newLng = userPosition.longitude;
    const prevLat = positionRef.current.lat;
    const prevLng = positionRef.current.lng;

    const movedKm = calculateDistance(prevLat, prevLng, newLat, newLng);
    if (movedKm <= 0.1) return;

    positionRef.current = { lat: newLat, lng: newLng };
    loadServices(newLat, newLng);
  }, [positionReady, userPosition.latitude, userPosition.longitude, loadServices]);

  const filteredServices = useMemo(() => {
    let result = services;

    // Filtrer par catégorie - match exact sur service_types.code
    if (selectedCategory !== 'all') {
      result = result.filter((s) => {
        const code = s.service_type?.code?.toLowerCase() || '';
        return code === selectedCategory.toLowerCase();
      });
    }

    // Filtrer par VILLE — match EXACT (insensible casse/espaces) sur la ville EFFECTIVE
    // (_city = ps.city sinon vendors.city) → seuls les services de CETTE ville.
    if (selectedCity && selectedCity !== 'all') {
      const target = selectedCity.trim().replace(/\s+/g, ' ').toLowerCase();
      result = result.filter((s) => {
        const c = ((s as any)._city || s.city || '').trim().replace(/\s+/g, ' ').toLowerCase();
        return c === target;
      });
    }

    // Filtrer par recherche
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((s) => {
        return (
          s.business_name?.toLowerCase().includes(q) ||
          s.city?.toLowerCase().includes(q) ||
          s.neighborhood?.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.service_type?.name?.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [services, selectedCategory, searchQuery, selectedCity]);

  // Villes disponibles pour le filtre (ville EFFECTIVE des services chargés)
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    services.forEach((s) => {
      const c = ((s as any)._city || s.city || '').trim().replace(/\s+/g, ' ');
      if (c) set.add(c);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [services]);

  const handleServiceClick = (service: any) => {
    // Boutique-vendeur (sans fiche professional_services) → page boutique du marketplace.
    // Service pro → page détail du service de proximité.
    if (service?._source === 'vendor') {
      navigate(`/shop/${service.id}`); // boutique-vendeur → page boutique directe
    } else {
      navigate(`/services-proximite/${service.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate("/proximite")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-foreground truncate">{t('servicesProximite.servicesDeProximite')}</h1>
                <p className="text-xs text-muted-foreground truncate">Dans un rayon de {RADIUS_KM} km</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => loadServices(positionRef.current.lat, positionRef.current.lng)} disabled={loading}>
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={usingRealLocation ? "default" : "secondary"} className="gap-1">
              <MapPin className="w-3 h-3" />
              {usingRealLocation ? "Position GPS active" : "GPS désactivé"}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {filteredServices.length} service{filteredServices.length > 1 ? "s" : ""} — rayon {RADIUS_KM} km
            </Badge>
          </div>

          <div className="mt-3 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder={t('servicesProximite.rechercherUnService')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl bg-muted/50 border-0 focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>
        </div>
      </header>

      {/* Catégories */}
      <section className="px-4 py-4 border-b border-border bg-card">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          {SERVICE_CATEGORIES.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "filter-active" : "filter"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="whitespace-nowrap flex-shrink-0 min-w-fit px-3"
            >
              <category.icon className="mr-1.5 h-4 w-4" />
              <span>{category.name}</span>
            </Button>
          ))}
        </div>
      </section>

      {/* CTA parcours client artisan (demande → devis multiples) */}
      {["plomberie", "vitrerie", "menuiserie", "soudure"].includes(selectedCategory) && (
        <section className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#ff4000]/30 bg-[#ff4000]/5 p-4">
            <div className="min-w-0">
              <div className="font-semibold">Besoin d'un artisan ({SERVICE_CATEGORIES.find((c) => c.id === selectedCategory)?.name}) ?</div>
              <div className="text-sm text-muted-foreground">{t('servicesProximite.publiezVotreDemandeRecevezPlusieurs')}</div>
            </div>
            <Button className="ml-auto" onClick={() => navigate(`/services/artisan/demande?type=${selectedCategory}`)}>
              Demander un devis
            </Button>
          </div>
        </section>
      )}

      {/* Filtre par VILLE (chips défilables) — alimenté par la ville effective des services */}
      {availableCities.length > 0 && (
        <section className="px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Filtrer par ville</span>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            <Button
              variant={selectedCity === 'all' ? 'filter-active' : 'filter'}
              size="sm"
              onClick={() => setSelectedCity('all')}
              className="whitespace-nowrap flex-shrink-0 px-3"
            >
              Toutes les villes
            </Button>
            {availableCities.map((c) => (
              <Button
                key={c}
                variant={selectedCity.toLowerCase() === c.toLowerCase() ? 'filter-active' : 'filter'}
                size="sm"
                onClick={() => setSelectedCity(c)}
                className="whitespace-nowrap flex-shrink-0 px-3"
              >
                <MapPin className="mr-1.5 h-3.5 w-3.5" />
                {c}
              </Button>
            ))}
          </div>
        </section>
      )}

      {/* Liste des services */}
      <section className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="rounded-2xl border border-border/50 bg-card p-10 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t('servicesProximite.chargementDesServices')}</p>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card p-10 text-center">
            <Store className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">{t('servicesProximite.aucunServiceTrouve')}</p>
            <p className="text-sm text-muted-foreground mb-4">{t('servicesProximite.essayezDeModifierLesFiltres')}</p>
            <Button variant="outline" onClick={() => { setSearchQuery(""); setSelectedCategory("all"); }}>
              Réinitialiser les filtres
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredServices.map((service, index) => (
              (() => {
                const visual = getServiceVisual({
                  code: service.service_type?.code,
                  name: service.service_type?.name,
                  category: service.service_type?.category,
                });
                const Icon = visual.icon;

                return (
              <button
                key={service.id}
                onClick={() => handleServiceClick(service)}
                className={cn(
                  "group relative flex flex-col p-4 rounded-2xl text-left",
                  "bg-card border border-border/50",
                  "hover:border-primary/30 hover:shadow-lg transition-all duration-300",
                  "hover:-translate-y-1"
                )}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                {/* Badge de distance */}
                <div className="absolute -top-2 -right-2 px-2.5 py-1 rounded-full text-xs font-semibold shadow-md flex items-center gap-1 bg-primary text-primary-foreground">
                  <MapPin className="w-3 h-3" />
                  {formatDistance(service.distance)}
                </div>

                {/* Badge galerie médias */}
                {(service.media_count ?? 0) > 0 && (
                  <div className="absolute -top-2 left-2 px-2 py-1 rounded-full text-[10px] font-semibold shadow-md flex items-center gap-1 bg-black/70 text-white backdrop-blur-sm">
                    <Camera className="w-2.5 h-2.5" />
                    {service.media_count}
                  </div>
                )}

                {(() => {
                  const mainImage = service.cover_image_url || service.logo_url || null;
                  return (
                <div className="mb-3 overflow-hidden rounded-2xl border border-border/50 bg-muted/40">
                  <div className="relative h-36 w-full overflow-hidden">
                    {mainImage ? (
                      <img
                        src={mainImage}
                        alt={service.business_name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${visual.accent}33, ${visual.accent}88)` }}>
                        <Icon className="h-12 w-12 text-white/80" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                    {!mainImage && (
                      <div
                        className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-lg"
                        style={{ backgroundColor: visual.accent }}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </div>
                  );
                })()}

                <div className="flex-1 space-y-2">
                  <h2 className="font-semibold text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                    {service.business_name}
                  </h2>

                  {service.service_type?.name && (
                    <Badge variant="secondary" className="text-[10px]">
                      {service.service_type.name}
                    </Badge>
                  )}

                  {(service.city || service.neighborhood || service.address) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="line-clamp-1">
                        {[service.neighborhood, service.city, !service.city && !service.neighborhood ? service.address : null]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </p>
                  )}

                  {service.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{service.description}</p>
                  )}

                  {(service.rating !== null && service.rating !== undefined && service.rating > 0) && (
                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-[#ff4000] fill-[#ff4000]" />
                        <span className="text-xs font-semibold text-foreground">{service.rating.toFixed(1)}</span>
                      </div>
                      {service.total_reviews && service.total_reviews > 0 && (
                        <span className="text-[10px] text-muted-foreground">({service.total_reviews} avis)</span>
                      )}
                    </div>
                  )}

                  {service.phone && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      <span>{service.phone}</span>
                    </div>
                  )}
                </div>
              </button>
                );
              })()
            ))}
          </div>
        )}
      </section>

      <QuickFooter />
    </div>
  );
}
