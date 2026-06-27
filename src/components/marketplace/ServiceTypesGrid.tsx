/**
 * Grille des Types de Services Professionnels
 * Affiche tous les types de services disponibles (Restaurant, Boutique, VTC, etc.)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  ShoppingBag,
  Utensils,
  Car,
  Truck,
  Scissors,
  Wrench,
  GraduationCap,
  Laptop,
  Home,
  Camera,
  Plane,
  Dumbbell,
  Briefcase,
  Sparkles,
  BookOpen,
  HardHat,
  Tractor,
  Stethoscope,
  Package,
  ArrowRight,
  Users,
  LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/useTranslation';
import { localizeServiceField } from '@/config/serviceTypesConfig';

interface ServiceType {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  commission_rate: number;
  is_active: boolean;
}

// Map des icônes Lucide
const iconMap: Record<string, LucideIcon> = {
  ShoppingBag,
  Utensils,
  Car,
  Truck,
  Scissors,
  Wrench,
  GraduationCap,
  Laptop,
  Home,
  Camera,
  Plane,
  Dumbbell,
  Briefcase,
  Sparkles,
  BookOpen,
  HardHat,
  Tractor,
  Stethoscope,
  Package
};

// Couleurs de marque unies (pas de dégradés)
const BRAND_BLUE = '#04439e';
const BRAND_ORANGE = '#ff4000';

const serviceTypeVisualMap: Record<string, { image: string; accent?: string; logoImage?: string }> = {
  agriculture: {
    image: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80',
    accent: '#ff4000',
    logoImage: '/service-icons-3d/agriculture.png',
  },
  beaute: {
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
    accent: '#ff4000',
    logoImage: '/service-icons-3d/beaute.png',
  },
  construction: {
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
    accent: '#ff4000',
    logoImage: '/service-icons-3d/construction.png',
  },
  education: {
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80',
    accent: '#04439e',
  },
  ecommerce: {
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80',
    accent: BRAND_BLUE,
    logoImage: '/service-icons-3d/boutique.png',
  },
  freelance: {
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80',
    accent: '#04439e',
    logoImage: '/service-icons-3d/freelance.png',
  },
  informatique: {
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
    accent: '#04439e',
    logoImage: '/service-icons-3d/informatique.png',
  },
  livraison: {
    image: 'https://images.unsplash.com/photo-1648394794449-5dbe63f6a8b5?auto=format&fit=crop&w=800&q=80',
    accent: BRAND_ORANGE,
    logoImage: '/service-icons-3d/livraison.png',
  },
  location: {
    image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80',
    accent: '#04439e',
    logoImage: '/service-icons-3d/immobilier.png',
  },
  maison: {
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
    accent: '#c2410c',
    logoImage: '/service-icons-3d/maison.png',
  },
  media: {
    image: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80',
    accent: '#04439e',
    logoImage: '/service-icons-3d/media.png',
  },
  menage: {
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80',
    accent: '#04439e',
    logoImage: '/service-icons-3d/nettoyage.png',
  },
  reparation: {
    image: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=800&q=80',
    accent: '#ff4000',
    logoImage: '/service-icons-3d/reparation.png',
  },
  restaurant: {
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
    accent: '#e85d04',
    logoImage: '/service-icons-3d/restaurant.png',
  },
  sante: {
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80',
    accent: '#ff4000',
    logoImage: '/service-icons-3d/sante.png',
  },
  sport: {
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
    accent: '#ff4000',
    logoImage: '/service-icons-3d/sport.png',
  },
  vtc: {
    image: 'https://images.unsplash.com/photo-1601979107535-46367552bc25?auto=format&fit=crop&w=800&q=80',
    accent: '#04439e',
    logoImage: '/service-icons-3d/vtc.png',
  },
};

const getServiceVisual = (serviceType: ServiceType) => {
  const code = serviceType.code?.toLowerCase() || '';
  const normalized = `${serviceType.name} ${serviceType.category}`.toLowerCase();

  if (serviceTypeVisualMap[code]) return serviceTypeVisualMap[code];
  if (normalized.includes('boutique') || normalized.includes('e-commerce') || normalized.includes('commerce')) return serviceTypeVisualMap.ecommerce;
  if (normalized.includes('éducation') || normalized.includes('education') || normalized.includes('formation')) return serviceTypeVisualMap.education;
  if (normalized.includes('immobilier') || normalized.includes('location')) return serviceTypeVisualMap.location;
  if (normalized.includes('photo') || normalized.includes('vidéo') || normalized.includes('video')) return serviceTypeVisualMap.media;
  if (normalized.includes('santé') || normalized.includes('sante')) return serviceTypeVisualMap.sante;
  if (normalized.includes('maison') || normalized.includes('déco') || normalized.includes('deco')) return serviceTypeVisualMap.maison;
  if (normalized.includes('livraison')) return serviceTypeVisualMap.livraison;

  return { image: '', accent: BRAND_BLUE };
};

interface ServiceTypesGridProps {
  onBack?: () => void;
  searchQuery?: string;
  /** Pays sélectionné dans le marketplace ('all' = Mondial). Filtre les services par pays. */
  country?: string;
  /** Ville sélectionnée ('all' = toutes). Filtre les services par ville (bidirectionnel). */
  city?: string;
}

export function ServiceTypesGrid({ onBack, searchQuery, country = 'all', city = 'all' }: ServiceTypesGridProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceCounts, setServiceCounts] = useState<Record<string, number>>({});

  // Recharger quand le pays OU la ville change pour recalculer les compteurs
  useEffect(() => {
    loadServiceTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, city]);

  const loadServiceTypes = async () => {
    try {
      // ⚡ Requêtes INDÉPENDANTES exécutées en PARALLÈLE (gain réseau mobile lent) :
      //  1) types de services SAUF numériques (qui vont dans le bouton "Numériques")
      //     — les services numériques (dropshipping, logiciel, ebooks) n'ont pas de GPS
      //  2) services actifs (id pour résoudre la localisation effective)
      const [typesResult, countsResult] = await Promise.all([
        supabase
          .from('service_types')
          .select('*')
          .eq('is_active', true)
          .neq('category', 'Numérique') // Exclure les services numériques
          .not('code', 'in', '(dropshipping,digital_logiciel,digital_livre)') // Double sécurité
          .order('name'),
        supabase
          .from('professional_services')
          .select('id, service_type_id, user_id, city')
          .eq('status', 'active'),
      ]);

      const { data: types, error } = typesResult;
      const { data: counts, error: countError } = countsResult;

      if (error) throw error;

      setServiceTypes(types || []);

      if (!countError && counts) {
        let rows = counts as any[];
        const norm = (s?: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
        const geoActive = (country && country !== 'all') || (city && city !== 'all');

        if (geoActive) {
          // Résolution ATOMIQUE ville/pays effectifs (ps sinon vendor) via RPC ; repli durci.
          const ids = rows.map((r) => r.id).filter(Boolean);
          const eff = new Map<string, { city: string | null; country: string | null }>();
          let ok = false;
          try {
            const { data: rl, error: rlErr } = await supabase
              .rpc('get_services_resolved_location', { p_service_ids: ids });
            if (!rlErr && Array.isArray(rl)) {
              rl.forEach((r: any) => eff.set(r.service_id, { city: r.effective_city ?? null, country: r.effective_country ?? null }));
              ok = true;
            }
          } catch { /* repli */ }
          if (!ok) {
            const ownerIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
            const vmap = new Map<string, any>();
            if (ownerIds.length > 0) {
              const { data: vs } = await supabase
                .from('vendors').select('user_id, city, country').in('user_id', ownerIds);
              (vs || []).forEach((v: any) => vmap.set(v.user_id, v));
            }
            rows.forEach((r) => {
              const v = vmap.get(r.user_id) || {};
              const psCity = (r.city || '').trim();
              eff.set(r.id, { city: psCity || v.city || null, country: v.country || null });
            });
          }

          if (country && country !== 'all') {
            const target = norm(country);
            rows = rows.filter((r) => norm(eff.get(r.id)?.country || '') === target);
          }
          if (city && city !== 'all') {
            const targetCity = norm(city);
            rows = rows.filter((r) => norm(eff.get(r.id)?.city || '') === targetCity);
          }
        }

        const countMap: Record<string, number> = {};
        rows.forEach((item) => {
          countMap[item.service_type_id] = (countMap[item.service_type_id] || 0) + 1;
        });
        setServiceCounts(countMap);
      }
    } catch (error) {
      console.error('Erreur chargement types de services:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrer par recherche
  const searchFiltered = searchQuery
    ? serviceTypes.filter(type =>
        type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        type.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        type.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : serviceTypes;

  // Pays OU ville précis sélectionné → ne montrer que les types ayant des services
  // correspondants (compteurs déjà filtrés par pays + ville).
  const hasGeoFilter = (country && country !== 'all') || (city && city !== 'all');
  const filteredTypes = hasGeoFilter
    ? searchFiltered.filter(type => (serviceCounts[type.id] || 0) > 0)
    : searchFiltered;

  const handleServiceClick = (serviceType: ServiceType) => {
    // Naviguer vers la page des services de proximité avec le filtre du type
    // (+ le pays sélectionné pour que la proximité reste cantonnée à ce pays)
    const params = new URLSearchParams({ type: serviceType.code });
    if (country && country !== 'all') params.set('country', country);
    if (city && city !== 'all') params.set('city', city);
    navigate(`/services-proximite?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="w-12 h-12 bg-muted rounded-xl mb-4" />
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header avec bouton retour */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{t('serviceGrid.title')}</h2>
          <p className="text-sm text-muted-foreground">
            {filteredTypes.length} {t('serviceGrid.typesAvailable')}
          </p>
        </div>
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack}>
            {t('serviceGrid.backToProducts')}
          </Button>
        )}
      </div>

      {/* Grille des types de services */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredTypes.map((serviceType) => {
          const IconComponent = iconMap[serviceType.icon] || Briefcase;
          const count = serviceCounts[serviceType.id] || 0;
          const visual = getServiceVisual(serviceType);

          return (
            <Card
              key={serviceType.id}
              className={cn(
                "group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.02]",
                "border-2 border-border hover:border-[#04439e]"
              )}
              onClick={() => handleServiceClick(serviceType)}
            >
              <CardContent className="p-0">
                <div className="relative h-24 overflow-hidden sm:h-28">
                  {visual.image ? (
                    <>
                      <img
                        src={visual.image}
                        alt={serviceType.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="absolute inset-0 bg-[#0b1b33]/70 to-transparent" />
                    </>
                  ) : (
                    <div className="h-full w-full bg-[#04439e]" />
                  )}

                  <div
                    className="absolute left-4 top-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl shadow-lg sm:h-14 sm:w-14"
                    style={{ backgroundColor: visual.logoImage ? undefined : (visual.accent || BRAND_BLUE) }}
                  >
                    {visual.logoImage ? (
                      <img src={visual.logoImage} alt={serviceType.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                    )}
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  <h3 className="mb-1 line-clamp-1 text-sm font-semibold transition-colors group-hover:text-white sm:text-base">
                    {localizeServiceField(t, serviceType.code, 'name', serviceType.name)}
                  </h3>

                  <p className="mb-3 line-clamp-2 text-xs text-muted-foreground transition-colors group-hover:text-white">
                    {localizeServiceField(t, serviceType.code, 'description', serviceType.description)}
                  </p>

                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs transition-colors group-hover:bg-transparent group-hover:text-white">
                      <Users className="mr-1 h-3 w-3" />
                      {count} {count > 1 ? t('serviceGrid.providers') : t('serviceGrid.provider')}
                    </Badge>
                    <ArrowRight
                      className="h-4 w-4 transition-all group-hover:translate-x-1 group-hover:text-white"
                      style={{ color: BRAND_ORANGE }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTypes.length === 0 && (
        <div className="text-center py-12">
          <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('serviceGrid.noService')}</p>
        </div>
      )}
    </div>
  );
}