import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Store,
  Truck,
  Scissors,
  Utensils,
  Bike,
  Wrench,
  Sparkles,
  Building2,
  ShoppingBag,
  Heart,
  Laptop,
  Home,
  Camera,
  Dumbbell,
  Search,
  MapPin,
  Star,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Loader2,
  HardHat,
  Tractor,
  Briefcase,
  Square,
  Hammer,
  Flame,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import QuickFooter from "@/components/QuickFooter";
import { useProximityStats } from "@/hooks/useProximityStats";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from "@/integrations/supabase/client";

// Couleurs de la charte : Bleu #04439e, Orange #ff4000, Noir #000000
const BLUE = "#04439e";
const ORANGE = "#ff4000";
const _BLACK = "#000000";

interface ServiceCardItem {
  id: string;
  title: string;
  icon: any;
  count: number;
  path: string;
  description: string;
  image: string;
  logoImage?: string;
  overlayGradient?: string;
  accent: string;
  trending?: boolean;
}

type TFn = (key: string) => string;

const getPriorityServices = (stats: any, t: TFn): ServiceCardItem[] => [
  {
    id: "boutique",
    title: t("proximity.svc.boutique.title"),
    icon: Store,
    count: stats.boutiques,
    path: "/proximite/boutiques",
    description: t("proximity.svc.boutique.desc"),
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/logo-boutique.jpeg",
    accent: "#04439e"
  },
  {
    id: "restaurant",
    title: t("proximity.svc.restaurant.title"),
    icon: Utensils,
    count: stats.restaurant,
    path: "/services-proximite?type=restaurant",
    description: t("proximity.svc.restaurant.desc"),
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/logo-resto.jpeg",
    accent: "#e85d04"
  },
  {
    id: "reparation",
    title: t("proximity.svc.reparation.title"),
    icon: Wrench,
    count: stats.reparation,
    path: "/services-proximite?type=reparation",
    description: t("proximity.svc.reparation.desc"),
    image: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/icon-reparation.png",
    accent: "#ff4000"
  },
  {
    id: "immobilier",
    title: t("proximity.svc.immobilier.title"),
    icon: Building2,
    count: stats.immobilier,
    path: "/services-proximite?type=location",
    description: t("proximity.svc.immobilier.desc"),
    image: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80",
    logoImage: "/service-icons/logo-immobilier.jpeg",
    accent: "#04439e"
  },
  {
    id: "sante",
    title: t("proximity.svc.sante.title"),
    icon: Heart,
    count: stats.sante,
    path: "/services-proximite?type=sante",
    description: t("proximity.svc.sante.desc"),
    image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/icon-sante.png",
    accent: "#ff4000"
  },
  {
    id: "construction",
    title: t("proximity.svc.construction.title"),
    icon: HardHat,
    count: stats.construction,
    path: "/services-proximite?type=construction",
    description: t("proximity.svc.construction.desc"),
    image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/logo-construction-btp.jpeg",
    accent: "#ff4000"
  },
  {
    id: "media",
    title: t("proximity.svc.media.title"),
    icon: Camera,
    count: stats.media,
    path: "/services-proximite?type=media",
    description: t("proximity.svc.media.desc"),
    image: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/icon-photo-video.png",
    accent: "#04439e"
  },
  {
    id: "informatique",
    title: t("proximity.svc.informatique.title"),
    icon: Laptop,
    count: stats.informatique,
    path: "/services-proximite?type=informatique",
    description: t("proximity.svc.informatique.desc"),
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/icon-informatique.png",
    accent: "#04439e"
  }
];

const getQuickAccessServices = (stats: any, t: TFn): ServiceCardItem[] => [
  {
    id: "vtc",
    title: t("proximity.svc.vtc.title"),
    icon: Bike,
    count: stats.vtc,
    path: "/proximite/taxi-moto",
    description: t("proximity.svc.vtc.desc"),
    image: "https://images.unsplash.com/photo-1601979107535-46367552bc25?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/icon-taxi-moto.png",
    accent: "#04439e"
  },
  {
    id: "livraison",
    title: t("proximity.svc.livraison.title"),
    icon: Truck,
    count: stats.livraison,
    path: "/proximite/livraison",
    description: t("proximity.svc.livraison.desc"),
    trending: stats.livraison > 5,
    image: "https://images.unsplash.com/photo-1648394794449-5dbe63f6a8b5?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/icon-livreur.png",
    accent: "#ff4000"
  }
];

const getComplementaryServices = (stats: any, t: TFn): ServiceCardItem[] => [
  {
    id: "beaute",
    title: t("proximity.svc.beaute.title"),
    icon: Scissors,
    description: t("proximity.svc.beaute.desc"),
    count: stats.beaute,
    path: "/beaute",
    image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/icon-beaute.png",
    accent: "#ff4000"
  },
  {
    id: "nettoyage",
    title: t("proximity.svc.nettoyage.title"),
    icon: Sparkles,
    description: t("proximity.svc.nettoyage.desc"),
    count: stats.nettoyage,
    path: "/services-proximite?type=menage",
    image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/icon-nettoyage.png",
    accent: "#04439e"
  },
  {
    id: "sport",
    title: t("proximity.svc.sport.title"),
    icon: Dumbbell,
    description: t("proximity.svc.sport.desc"),
    count: stats.sport,
    path: "/services-proximite?type=sport",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/icon-sport-fitness.png",
    accent: "#ff4000"
  },
  {
    id: "agriculture",
    title: t("proximity.svc.agriculture.title"),
    icon: Tractor,
    description: t("proximity.svc.agriculture.desc"),
    count: stats.agriculture,
    path: "/services-proximite?type=agriculture",
    image: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/icon-agriculture.png",
    accent: "#ff4000"
  },
  {
    id: "freelance",
    title: t("proximity.svc.freelance.title"),
    icon: Briefcase,
    description: t("proximity.svc.freelance.desc"),
    count: stats.freelance,
    path: "/services-proximite?type=freelance",
    image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/icon-administratif.png",
    accent: "#04439e"
  },
  {
    id: "maison",
    title: t("proximity.svc.maison.title"),
    icon: Home,
    description: t("proximity.svc.maison.desc"),
    count: stats.maison,
    path: "/services-proximite?type=maison",
    image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/icon-maison.png",
    accent: "#c2410c"
  },
  {
    id: "plomberie",
    title: t("proximity.svc.plomberie.title"),
    icon: Wrench,
    description: t("proximity.svc.plomberie.desc"),
    count: stats.plomberie,
    path: "/services-proximite?type=plomberie",
    image: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/logo-plomberie.svg",
    accent: "#0E6BA8"
  },
  {
    id: "vitrerie",
    title: t("proximity.svc.vitrerie.title"),
    icon: Square,
    description: t("proximity.svc.vitrerie.desc"),
    count: stats.vitrerie,
    path: "/services-proximite?type=vitrerie",
    image: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/logo-vitrerie.svg",
    accent: "#29A7C4"
  },
  {
    id: "menuiserie",
    title: t("proximity.svc.menuiserie.title"),
    icon: Hammer,
    description: t("proximity.svc.menuiserie.desc"),
    count: stats.menuiserie,
    path: "/services-proximite?type=menuiserie",
    image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/logo-menuiserie.svg",
    accent: "#B5651D"
  },
  {
    id: "soudure",
    title: t("proximity.svc.soudure.title"),
    icon: Flame,
    description: t("proximity.svc.soudure.desc"),
    count: stats.soudure,
    path: "/services-proximite?type=soudure",
    image: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=1000&q=85",
    logoImage: "/service-icons/logo-soudure.svg",
    accent: "#ff4000"
  }
];

interface CategoryWithCount {
  id: string;
  name: string;
  image_url: string | null;
  product_count: number;
}

export default function Proximite() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { stats, loading, refresh, radiusKm, usingRealLocation, debugInfo } = useProximityStats();
  const [searchQuery, setSearchQuery] = useState("");
  const [productCategories, setProductCategories] = useState<CategoryWithCount[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    const loadCategoriesWithProducts = async () => {
      try {
        // ✅ 1 seule requête avec JOIN (categories + produits actifs liés) au lieu
        // de 2 séquentielles (tous les produits PUIS les catégories). products!inner
        // ne ramène que les catégories ayant ≥1 produit actif ; le count = longueur.
        const { data, error } = await supabase
          .from('categories')
          .select(`
            id,
            name,
            image_url,
            products!inner(id)
          `)
          .eq('is_active', true)
          .eq('products.is_active', true);

        if (error) throw error;

        const categoriesWithProducts: CategoryWithCount[] = (data || [])
          .map((cat: any) => ({
            id: cat.id,
            name: cat.name,
            image_url: cat.image_url,
            product_count: Array.isArray(cat.products) ? cat.products.length : 0,
          }))
          .filter(c => c.product_count > 0)
          .sort((a, b) => b.product_count - a.product_count);

        setProductCategories(categoriesWithProducts);
      } catch (error) {
        console.error('Erreur chargement catégories:', error);
        // Fallback : liste vide (pas d'affichage d'erreur bloquant)
        setProductCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };
    loadCategoriesWithProducts();
  }, []);

  // Listes brutes (toutes les cartes)
  const priorityServicesAll = useMemo(() => getPriorityServices(stats, t), [stats, t]);
  const quickAccessServicesAll = useMemo(() => getQuickAccessServices(stats, t), [stats, t]);
  const complementaryServicesAll = useMemo(() => getComplementaryServices(stats, t), [stats, t]);

  // ✅ Filtrage par searchQuery (insensible à la casse, cherche dans title + description)
  const filterServices = (items: ServiceCardItem[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      s => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  };

  const priorityServices = useMemo(() => filterServices(priorityServicesAll), [priorityServicesAll, searchQuery]);
  const quickAccessServices = useMemo(() => filterServices(quickAccessServicesAll), [quickAccessServicesAll, searchQuery]);
  const complementaryServices = useMemo(() => filterServices(complementaryServicesAll), [complementaryServicesAll, searchQuery]);

  const handleServiceClick = (path: string) => {
    navigate(path);
  };

  return (
    <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(180deg,#f0f5ff 0%,#eef3fb 60%,#f7faff 100%)' }}>
      {/* HERO HEADER */}
      <div
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#04439e 0%,#04439e 55%,#0b1b33 100%)' }}
      >
        {/* Cercles décoratifs */}
        <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full opacity-10" style={{ background: 'radial-gradient(circle,#fff,transparent)' }} />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full opacity-10" style={{ background: 'radial-gradient(circle,#ff4000,transparent)' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 pt-6 pb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: ORANGE }}>
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{t('home.nearbyServices')}</h1>
                <p className="text-xs text-white/70">{t('proximity.mostRequested') || 'Les plus demandés près de vous'}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={refresh}
              disabled={loading}
              className="rounded-full text-white/80 hover:text-white hover:bg-white/10"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
            </Button>
          </div>

          {/* Badges GPS / rayon */}
          <div className="flex items-center gap-2 mb-4 text-xs flex-wrap">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors"
              style={{
                backgroundColor: usingRealLocation
                  ? 'rgba(22,163,74,0.25)'   // vert clair si GPS actif
                  : 'rgba(234,179,8,0.2)',    // amber clair si position par défaut
                color: usingRealLocation
                  ? '#16a34a'  // ✅ vert  = GPS réel actif
                  : '#d97706'  // ✅ amber = position par défaut (Conakry)
              }}
            >
              <MapPin className="w-3 h-3" />
              {usingRealLocation ? t('proximity.gpsActive') : t('proximity.gpsInactive')}
            </button>
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}>
              {t('proximity.radius')}: {radiusKm} km
            </div>
            {loading && (
              <span className="flex items-center gap-1 text-white/60">
                <Loader2 className="w-3 h-3 animate-spin" />
                {t('common.loading')}
              </span>
            )}
          </div>

          {/* Debug Panel */}
          {showDebug && debugInfo && (
            <div className="mb-4 p-3 rounded-2xl border text-xs space-y-2 backdrop-blur-sm" style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.14)' }}>
              <div className="font-semibold text-white flex items-center gap-2">{t('proximity.debugTitle')} {radiusKm}km</div>
              <div className="grid grid-cols-2 gap-2 text-white/80">
                <div>
                  <span>{t('proximity.debugPosition')}:</span>
                  <div className="font-mono text-[10px] text-white/60">{debugInfo.positionUsed.latitude.toFixed(5)}, {debugInfo.positionUsed.longitude.toFixed(5)}</div>
                </div>
                <div>
                  <span>{t('proximity.debugSource')}:</span>
                  <div className="font-medium" style={{
                    color: debugInfo.usingRealGps
                      ? '#16a34a'  // ✅ vert  = GPS réel
                      : '#d97706'  // ✅ amber = position par défaut
                  }}>
                    {debugInfo.usingRealGps ? t('proximity.debugRealGps') : t('proximity.debugDefault')}
                  </div>
                </div>
              </div>
              <div className="border-t pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                {[
                  { label: t('proximity.debugShops'), data: debugInfo.vendors },
                  { label: t('proximity.debugProServices'), data: debugInfo.services },
                  { label: t('proximity.debugTaxi'), data: debugInfo.taxiMoto },
                  { label: t('proximity.debugDrivers'), data: debugInfo.drivers }
                ].map(item => (
                  <div key={item.label} className="rounded-lg p-2" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                    <div className="font-medium text-white">{item.label}</div>
                    <div className="text-[10px] text-white/60">
                      {t('proximity.debugTotal')}: {item.data.total} | {t('proximity.radius')}: {item.data.inRadius}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/50" />
            <Input
              placeholder={t('home.searchPlaceholder') || 'Rechercher un service ou produit...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 rounded-2xl border-0 text-white placeholder:text-white/45 focus-visible:ring-1 focus-visible:ring-white/30"
              style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

        {/* Aucun résultat pour la recherche active */}
        {searchQuery.trim() && priorityServices.length === 0 &&
         quickAccessServices.length === 0 && complementaryServices.length === 0 && (
          <div className="py-10 text-center space-y-2">
            <Search className="w-10 h-10 mx-auto opacity-30" style={{ color: BLUE }} />
            <p className="text-sm font-medium" style={{ color: BLUE }}>
              {t('proximity.searchNoResult')} « {searchQuery} »
            </p>
            <button
              className="text-xs underline"
              style={{ color: ORANGE }}
              onClick={() => setSearchQuery('')}
            >
              {t('proximity.clearSearch')}
            </button>
          </div>
        )}

        {/* SERVICES POPULAIRES */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5" style={{ color: ORANGE }} />
            <div>
              <h2 className="text-base font-bold" style={{ color: BLUE }}>{t('proximity.popularSectionTitle')}</h2>
              <p className="text-xs" style={{ color: '#5f78a5' }}>{t('proximity.popularSectionSubtitle')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {priorityServices.slice(0, 4).map((service) => {
              const Icon = service.icon;
              return (
                <button
                  key={service.id}
                  onClick={() => handleServiceClick(service.path)}
                  className="group relative overflow-hidden rounded-[20px] text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(4,67,158,0.18)]"
                  style={{ minHeight: 160 }}
                >
                  {/* Image */}
                  <img
                    src={service.image}
                    alt={service.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  {/* Dynamic accent gradient overlay */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: service.overlayGradient || `linear-gradient(to top, rgba(8,15,30,0.92) 0%, rgba(8,15,30,0.42) 50%, ${service.accent}26 100%)`
                    }}
                  />
                  {/* Content */}
                  <div className="relative z-10 flex h-full flex-col justify-end p-3.5" style={{ minHeight: 160 }}>
                    <div className="mb-2 flex h-12 w-12 items-center justify-center">
                      <img src={`/service-icons-3d/${service.id}.png`} alt={service.title} className="h-full w-full object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)]" loading="lazy" />
                    </div>
                    <h3 className="text-sm font-bold text-white leading-tight">{service.title}</h3>
                    <p className="text-[11px] text-white/70 mt-0.5">{service.description}</p>
                    <span className="mt-1.5 inline-block text-[11px] font-semibold" style={{ color: service.count > 0 ? '#ff4000' : 'rgba(255,255,255,0.5)' }}>
                      {service.count} {t('proximity.available')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {priorityServices.slice(4).map((service) => {
              const Icon = service.icon;
              return (
                <button
                  key={service.id}
                  onClick={() => handleServiceClick(service.path)}
                  className="group relative overflow-hidden rounded-[20px] text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(4,67,158,0.18)]"
                  style={{ minHeight: 160 }}
                >
                  <img src={service.image} alt={service.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: service.overlayGradient || `linear-gradient(to top, rgba(8,15,30,0.92) 0%, rgba(8,15,30,0.42) 50%, ${service.accent}26 100%)`
                    }}
                  />
                  <div className="relative z-10 flex h-full flex-col justify-end p-3.5" style={{ minHeight: 160 }}>
                    <div className="mb-2 flex h-12 w-12 items-center justify-center">
                      <img src={`/service-icons-3d/${service.id}.png`} alt={service.title} className="h-full w-full object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)]" loading="lazy" />
                    </div>
                    <h3 className="text-sm font-bold text-white leading-tight">{service.title}</h3>
                    <p className="text-[11px] text-white/70 mt-0.5">{service.description}</p>
                    <span className="mt-1.5 inline-block text-[11px] font-semibold" style={{ color: service.count > 0 ? '#ff4000' : 'rgba(255,255,255,0.5)' }}>
                      {service.count} {t('proximity.available')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ACCÈS RAPIDE */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Store className="w-5 h-5" style={{ color: BLUE }} />
            <div>
              <h2 className="text-base font-bold" style={{ color: BLUE }}>{t('proximity.quickAccess')}</h2>
              <p className="text-xs" style={{ color: '#5f78a5' }}>{t('proximity.quickAccessSubtitle')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {quickAccessServices.map((service) => {
              const Icon = service.icon;
              return (
                <button
                  key={service.id}
                  onClick={() => handleServiceClick(service.path)}
                  className="group relative overflow-hidden rounded-[20px] text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(4,67,158,0.18)]"
                  style={{ minHeight: 160 }}
                >
                  <img src={service.image} alt={service.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: `linear-gradient(to top, rgba(8,15,30,0.92) 0%, rgba(8,15,30,0.42) 50%, ${service.accent}26 100%)`
                    }}
                  />
                  {service.trending && (
                    <div className="absolute top-2.5 right-2.5 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: ORANGE, color: 'white' }}>
                      {t('proximity.trending')}
                    </div>
                  )}
                  <div className="relative z-10 flex h-full flex-col justify-end p-3.5" style={{ minHeight: 160 }}>
                    <div className="mb-2 flex h-12 w-12 items-center justify-center">
                      <img src={`/service-icons-3d/${service.id}.png`} alt={service.title} className="h-full w-full object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)]" loading="lazy" />
                    </div>
                    <h3 className="text-sm font-bold text-white leading-tight">{service.title}</h3>
                    <p className="text-[11px] text-white/70 mt-0.5">{service.description}</p>
                    <span className="mt-1.5 inline-block text-[11px] font-semibold" style={{ color: service.count > 0 ? '#ff4000' : 'rgba(255,255,255,0.5)' }}>
                      {service.count} {t('proximity.available')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* CATÉGORIES DE PRODUITS */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" style={{ color: BLUE }} />
              <div>
                <h2 className="text-base font-bold" style={{ color: BLUE }}>{t('home.productCategories') || 'Catégories de produits'}</h2>
                <p className="text-xs" style={{ color: '#5f78a5' }}>{t('home.exploreByCategory') || 'Explorez par catégorie'}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/marketplace')}
              className="text-sm font-medium flex items-center gap-1 hover:gap-2 transition-all"
              style={{ color: ORANGE }}
            >
              {t('home.seeAll')} <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {loadingCategories ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: BLUE }} />
            </div>
          ) : productCategories.length === 0 ? (
            <div className="text-center py-8" style={{ color: '#5f78a5' }}>
              <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t('proximity.noCategories')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {productCategories.slice(0, 8).map((category) => (
                <button
                  key={category.id}
                  onClick={() => navigate(`/marketplace?category=${category.id}&includePhysical=1`)}
                  className="group relative overflow-hidden rounded-[20px] text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(4,67,158,0.18)]"
                  style={{ minHeight: 130 }}
                >
                  {category.image_url ? (
                    <img src={category.image_url} alt={category.name} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                  ) : (
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg,#04439e,#04439e)' }} />
                  )}
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(11,27,51,0.05) 0%,rgba(11,27,51,0.78) 100%)' }} />
                  <div className="relative z-10 flex h-full flex-col justify-end p-3" style={{ minHeight: 130 }}>
                    <h3 className="text-sm font-bold text-white leading-tight line-clamp-1">{category.name}</h3>
                    <div className="mt-0.5 flex items-center gap-1">
                      <span className="text-xs font-semibold" style={{ color: '#ff4000' }}>{category.product_count}</span>
                      <span className="text-[11px] text-white/60">{category.product_count > 1 ? t('proximity.items') : t('proximity.item')}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* SERVICES COMPLÉMENTAIRES */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5" style={{ color: ORANGE }} />
              <div>
                <h2 className="text-base font-bold" style={{ color: BLUE }}>{t('proximity.otherServices')}</h2>
                <p className="text-xs" style={{ color: '#5f78a5' }}>{t('proximity.otherServicesSubtitle')}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/services-proximite')}
              className="text-sm font-medium flex items-center gap-1 hover:gap-2 transition-all"
              style={{ color: ORANGE }}
            >
              {t('proximity.explore')} <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {complementaryServices.map((service) => {
              const Icon = service.icon;
              return (
                <button
                  key={service.id}
                  onClick={() => navigate(service.path)}
                  className="group relative overflow-hidden rounded-[20px] text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(4,67,158,0.18)]"
                  style={{ minHeight: 150 }}
                >
                  <img src={service.image} alt={service.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: `linear-gradient(to top, rgba(8,15,30,0.92) 0%, rgba(8,15,30,0.42) 50%, ${service.accent}26 100%)`
                    }}
                  />
                  <div className="relative z-10 flex h-full flex-col justify-end p-3.5" style={{ minHeight: 150 }}>
                    <div className="mb-1.5 flex h-11 w-11 items-center justify-center">
                      <img src={`/service-icons-3d/${service.id}.png`} alt={service.title} className="h-full w-full object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)]" loading="lazy" />
                    </div>
                    <h3 className="text-sm font-bold text-white leading-tight">{service.title}</h3>
                    <p className="text-[11px] text-white/65 mt-0.5">{service.description}</p>
                    {service.count > 0 && (
                      <span className="mt-1 text-[11px] font-semibold" style={{ color: '#ff4000' }}>{service.count} {t('proximity.available')}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* BANNIÈRE PROMOTIONNELLE */}
        <div className="relative overflow-hidden rounded-3xl p-6 text-white" style={{ background: 'linear-gradient(135deg,#04439e 0%,#0b1b33 100%)' }}>
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10" style={{ background: 'radial-gradient(circle,#fff,transparent)' }} />
          <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full opacity-10" style={{ background: 'radial-gradient(circle,#ff4000,transparent)' }} />
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-2">{t('proximity.becomeProvider')}</h3>
            <p className="text-sm opacity-85 mb-4 max-w-md">
              {t('proximity.becomeProviderDesc')}
            </p>
            <button
              onClick={() => navigate('/auth')}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg"
            >
              {t('proximity.signUpNow')}
            </button>
          </div>
        </div>
      </div>

      <QuickFooter />
    </div>
  );
}
