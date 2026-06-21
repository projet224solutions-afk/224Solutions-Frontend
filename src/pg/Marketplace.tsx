import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Grid, List, ArrowUpDown, Menu, ShoppingCart as ShoppingCartIcon, MapPin, Globe, Share2, Filter, Package, Briefcase, Laptop, Plane, Monitor, GraduationCap, BookOpen, Bot, ShoppingBag, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import SearchBar from "@/components/SearchBar";
import { MarketplaceGrid } from "@/components/marketplace/MarketplaceGrid";
import { TranslatedProductCard } from "@/components/marketplace/TranslatedProductCard";
import { UniversalMarketplaceCard } from "@/components/marketplace/UniversalMarketplaceCard";
import { ProfessionalServiceCard } from "@/components/marketplace/ProfessionalServiceCard";
import { ServiceTypesGrid } from "@/components/marketplace/ServiceTypesGrid";
import { CurrencyIndicator } from "@/components/marketplace/CurrencyIndicator";
import QuickFooter from "@/components/QuickFooter";
import ProductDetailModal from "@/components/marketplace/ProductDetailModal";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { BrowseModal } from "@/components/marketplace/BrowseModal";
import { supabase } from "@/integrations/supabase/client";

import { useMarketplaceUniversal } from "@/hooks/useMarketplaceUniversal";
import { useContactVendor } from "@/hooks/useContactVendor";
import { toast } from "sonner";
import { useResponsive } from "@/hooks/useResponsive";
import { ResponsiveContainer } from "@/components/responsive/ResponsiveContainer";
import { useCart } from "@/contexts/CartContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getFlagEmoji, getCountryNameFromCode } from "@/data/countryMappings";
import { getMarketplaceHomeCountry } from "@/services/marketplaceHomeCountry";
import { useAuth } from "@/hooks/useAuth";
import { ShareButton } from "@/components/shared/ShareButton";
import { useTranslation } from "@/hooks/useTranslation";
import { useAIPersonalized, useAITrending } from "@/hooks/useAIRecommendations";
import { useDiscoveryProducts } from "@/hooks/useDiscoveryProducts";
import { AIRecommendationSection } from "@/components/marketplace/AIRecommendationSection";
import { useBehaviorTracking } from "@/hooks/useBehaviorTracking";
import { useRecommendationRealtimeInvalidation } from "@/hooks/useRecommendationRealtimeInvalidation";
import { useSmartRecommendations, useTrendingProducts, useRecentlyViewed } from "@/hooks/useSmartRecommendations";
import { cn } from "@/lib/utils";
import { ScrollToTopButton } from "@/components/marketplace/ScrollToTopButton";
import { InfiniteScrollTrigger } from "@/components/marketplace/InfiniteScrollTrigger";

// Couleurs de marque
const BRAND_BLUE = '#04439e';
const BRAND_ORANGE = '#ff4000';

// Options de tri (bouton + chips défilables, comme le sélecteur de pays/ville)
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'position', label: 'Équitable' },
  { value: 'visibility', label: 'Visibilité business' },
  { value: 'newest', label: 'Plus récents' },
  { value: 'popular', label: 'Popularité' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'rating', label: 'Mieux notés' },
];

// Le seuil de bascule auto + le comptage produits sont décidés CÔTÉ BACKEND
// (endpoint /api/v2/marketplace/home-country) — source unique de vérité.

/** Loading state with 10s timeout ÔÇö prevents infinite skeleton on mobile PWA */
function MarketplaceLoadingState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  const [timedOut, setTimedOut] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 20000);
    return () => clearTimeout(timer);
  }, []);

  if (timedOut) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-foreground">{t('marketplace.cannotLoadProducts')}</p>
          <p className="text-xs text-muted-foreground">{t('marketplace.checkConnection')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={onRetry}>
            {t('common.retry')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            if ('caches' in window) {
              caches.keys().then(names => names.forEach(n => caches.delete(n)));
            }
            window.location.reload();
          }}>
            Vider le cache
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="marketplace-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="marketplace-card animate-pulse">
          <div className="marketplace-card-image-container bg-muted" />
          <div className="marketplace-card-content space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
            <div className="h-5 bg-muted rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Configuration des cat├®gories num├®riques pour le filtre
const DIGITAL_CATEGORIES = [
  { id: 'all', name: 'Tous', icon: Package },
  { id: 'voyage', name: 'Voyage', icon: Plane },
  { id: 'logiciel', name: 'Logiciels', icon: Monitor },
  { id: 'formation', name: 'Formations', icon: GraduationCap },
  { id: 'livre', name: 'Livres', icon: BookOpen },
  { id: 'ai', name: 'IA', icon: Bot },
  { id: 'physique_affilie', name: 'Affili├®s', icon: ShoppingBag },
] as const;

const PAGE_LIMIT = 24;

interface Category {
  id: string;
  name: string;
  image_url?: string;
  is_active: boolean;
  productCount?: number; // nb de produits dans le pays/ville sélectionnés
}

interface Product {
  id: string;
  name: string;
  price: number;
  description?: string;
  images?: string[];
  vendor_id: string;
  vendors?: {
    business_name: string;
  };
}

export default function Marketplace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isMobile, isTablet } = useResponsive();
  const { user, profile } = useAuth();
  const { userCountry } = useCurrency(); // pays détecté par IP/timezone (code ISO-2, ex. 'GN')
  const { addToCart, getCartCount } = useCart();
  const { t } = useTranslation();

  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || "");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || "all");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedItemType, setSelectedItemType] = useState<'all' | 'product' | 'professional_service' | 'digital_product'>('all');
  const [selectedDigitalCategory, setSelectedDigitalCategory] = useState<string>("all");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showSortPicker, setShowSortPicker] = useState(false);
  // Onglet actif de la barre de type : un seul bouton allumé à la fois (Produits/Pays/Services/Numériques)
  const [activeTab, setActiveTab] = useState<'products' | 'country' | 'services' | 'digital'>('products');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showBrowseModal, setShowBrowseModal] = useState(false);
  const [sortBy, setSortBy] = useState<'popular' | 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'position' | 'visibility'>("visibility");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ minPrice: 0, maxPrice: 0, minRating: 0 });
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [deferRecommendations, setDeferRecommendations] = useState(false);
  // Auto-sélection du pays appliquée une seule fois (ne pas écraser un choix manuel ensuite)
  const autoCountryAppliedRef = useRef(false);
  // Pays « maison » résolu (pays détecté → chip), pour que « Produits » y ramène depuis Mondial
  const homeCountryRef = useRef<string>('all');

  // Behavior tracking diff├®r├® pour ne pas ralentir l'ouverture initiale
  useBehaviorTracking({ sessionType: 'browse' }, deferRecommendations);
  useRecommendationRealtimeInvalidation(deferRecommendations);
  
  const vendorId = searchParams.get('vendor') || undefined;
  const includePhysicalVendors = searchParams.get('includePhysical') === '1';

  const [vendorSlug, setVendorSlug] = useState<string | null>(null);

  // D├®terminer quelle cat├®gorie passer au hook:
  // - Si on filtre par produits num├®riques et une cat├®gorie num├®rique est s├®lectionn├®e, l'utiliser
  // - Sinon utiliser la cat├®gorie e-commerce classique
  const effectiveCategory = selectedItemType === 'digital_product' && selectedDigitalCategory !== 'all' 
    ? selectedDigitalCategory 
    : selectedCategory;

  // ­ƒöÑ UTILISER LE HOOK UNIVERSEL pour charger TOUT (produits + services pro + num├®riques)
  const { 
    items: marketplaceItems,
    loading: marketplaceLoading,
    total: marketplaceTotal,
    hasMore: marketplaceHasMore,
    loadMore: marketplaceLoadMore,
    refresh: marketplaceRefresh
  } = useMarketplaceUniversal({
    limit: 24,
    category: effectiveCategory,
    searchQuery,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minRating: filters.minRating,
    vendorId,
    country: selectedCountry,
    city: selectedCity,
    itemType: selectedItemType,
    sortBy,
    autoLoad: true
  });

  const shouldEnableRecommendations =
    selectedCategory === 'all' &&
    selectedItemType !== 'professional_service' &&
    selectedItemType !== 'digital_product' &&
    !marketplaceLoading;

  useEffect(() => {
    setDeferRecommendations(false);

    if (!shouldEnableRecommendations) return;

    const enableRecommendations = () => setDeferRecommendations(true);
    let timeoutId: number | null = null;
    let idleId: number | null = null;

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = (window as Window & { requestIdleCallback: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback(
        enableRecommendations,
        { timeout: isMobile ? 2500 : 1200 }
      );
    } else {
      timeoutId = window.setTimeout(enableRecommendations, isMobile ? 2200 : 900);
    }

    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (idleId !== null && 'cancelIdleCallback' in window) {
        (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
      }
    };
  }, [isMobile, shouldEnableRecommendations]);

  const shouldLoadRecommendations = shouldEnableRecommendations && deferRecommendations;

  // Recommandations secondaires charg├®es apr├¿s le contenu principal et le premier rendu mobile
  const { data: aiPersonalized, isLoading: loadingAIPersonalized } = useAIPersonalized(6, shouldLoadRecommendations);
  const { data: aiTrending, isLoading: loadingAITrending } = useAITrending(6, shouldLoadRecommendations);
  const { data: discoveryProducts, isLoading: loadingDiscovery } = useDiscoveryProducts(8, shouldLoadRecommendations);
  const { data: smartRecs, isLoading: loadingSmartRecs } = useSmartRecommendations(8, shouldLoadRecommendations);
  const { data: trendingProducts, isLoading: loadingTrendingProducts } = useTrendingProducts(8, shouldLoadRecommendations);
  const { data: recentlyViewed, isLoading: loadingRecentlyViewed } = useRecentlyViewed(8, shouldLoadRecommendations);

  // --- Filtrage des recommandations par PAYS + VILLE -------------------------
  // Les 6 carrousels de reco ne portent pas la géo. On résout pays+ville du vendeur
  // de chaque produit via UNE requête products→vendors(country,city) (clé = id produit),
  // puis on filtre chaque liste selon le pays ET la ville sélectionnés (match exact).
  const recoIdOf = (item: any): string | undefined => item?.id || item?.product_id;
  const [recoGeoMap, setRecoGeoMap] = useState<Record<string, { country: string; city: string }>>({});

  useEffect(() => {
    const all = [aiPersonalized, aiTrending, discoveryProducts, smartRecs, trendingProducts, recentlyViewed];
    const ids = [...new Set(all.flatMap((arr) => (arr || []).map(recoIdOf)).filter(Boolean))] as string[];
    const missing = ids.filter((id) => !(id in recoGeoMap));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('id, vendors(country, city)')
        .in('id', missing);
      if (cancelled || !data) return;
      setRecoGeoMap((prev) => {
        const next = { ...prev };
        data.forEach((p: any) => {
          next[p.id] = { country: p.vendors?.country || '', city: p.vendors?.city || '' };
        });
        // marquer les ids non résolus pour éviter de re-requêter en boucle
        missing.forEach((id) => { if (!(id in next)) next[id] = { country: '', city: '' }; });
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [aiPersonalized, aiTrending, discoveryProducts, smartRecs, trendingProducts, recentlyViewed, recoGeoMap]);

  // Filtre une liste de reco par pays ET ville sélectionnés (match exact ; 'all' = ignoré).
  const filterRecoByGeo = <T,>(arr: T[] | undefined): T[] | undefined => {
    if (!arr) return arr;
    const byCountry = selectedCountry && selectedCountry !== 'all';
    const byCity = selectedCity && selectedCity !== 'all';
    if (!byCountry && !byCity) return arr;
    const norm = (s?: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const tc = norm(selectedCountry), tv = norm(selectedCity);
    return arr.filter((item: any) => {
      const g = recoGeoMap[recoIdOf(item) as string];
      if (!g) return false;
      if (byCountry && norm(g.country) !== tc) return false;
      if (byCity && norm(g.city) !== tv) return false;
      return true;
    });
  };

  const aiPersonalizedF = filterRecoByGeo(aiPersonalized);
  const aiTrendingF = filterRecoByGeo(aiTrending);
  const discoveryProductsF = filterRecoByGeo(discoveryProducts);
  const smartRecsF = filterRecoByGeo(smartRecs);
  const trendingProductsF = filterRecoByGeo(trendingProducts);
  const recentlyViewedF = filterRecoByGeo(recentlyViewed);

  // Charger le nom du vendeur si filtr├® par vendeur
  useEffect(() => {
    if (vendorId) {
      const loadVendorName = async () => {
        const { data } = await supabase
          .from('vendors')
          .select('business_name, shop_slug')
          .eq('id', vendorId)
          .single();
        if (data) {
          setVendorName(data.business_name);
          setVendorSlug(data.shop_slug);
        }
      };
      loadVendorName();
    } else {
      setVendorName(null);
      setVendorSlug(null);
    }
  }, [vendorId]);

  // Charger les localisations au montage
  useEffect(() => {
    loadLocations();
  }, []);

  // Charger/Recharger les catégories selon le PAYS + la VILLE (source unique : chips + Explorer)
  useEffect(() => {
    loadCategories(selectedCountry, selectedCity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountry, selectedCity]);

  const loadCategories = async (countryFilter?: string, cityFilter?: string) => {
    try {
      const cf = (countryFilter ?? selectedCountry);
      const ci = (cityFilter ?? selectedCity);
      const hasCountry = cf && cf !== 'all';
      const hasCity = ci && ci !== 'all';
      const safe = (s: string) => (s || '').replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();

      // Catégories ayant des produits AFFICHABLES (vendeur en ligne/hybride), filtrées par
      // le PAYS et la VILLE sélectionnés (match exact) → cohérent avec la grille. C'est la
      // SOURCE unique (chips marketplace + onglet Catégories de la modale Explorer).
      let pq: any = supabase
        .from('products')
        .select('category_id, vendors!inner(country, city, business_type)')
        .eq('is_active', true)
        .not('category_id', 'is', null)
        .in('vendors.business_type', ['online', 'hybrid']);
      if (hasCountry) pq = pq.or(`country.ilike.${safe(cf)}`, { referencedTable: 'vendors' });
      if (hasCity) pq = pq.or(`city.ilike.${safe(ci)}`, { referencedTable: 'vendors' });
      const { data: rows, error: countError } = await pq;
      if (countError) throw countError;

      const categoryProductCount = new Map<string, number>();
      (rows || []).forEach((p: any) => {
        if (p.category_id) {
          categoryProductCount.set(p.category_id, (categoryProductCount.get(p.category_id) || 0) + 1);
        }
      });

      const ids = Array.from(categoryProductCount.keys());
      if (ids.length === 0) {
        setCategories([{ id: 'all', name: t('common.all'), is_active: true }]);
        return;
      }

      const { data, error } = await supabase
        .from('categories')
        .select('id, name, image_url, is_active')
        .eq('is_active', true)
        .in('id', ids)
        .order('name');
      if (error) throw error;

      // Compteur attaché + tri par nombre de produits (décroissant)
      const sortedCategories = (data || [])
        .map((c: any) => ({ ...c, productCount: categoryProductCount.get(c.id) || 0 }))
        .sort((a, b) => (b.productCount || 0) - (a.productCount || 0));

      const allCategory = { id: 'all', name: t('common.all'), is_active: true };
      setCategories([allCategory, ...sortedCategories]);
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
      setCategories([{ id: 'all', name: t('common.all'), is_active: true }]);
    }
  };

  const loadLocations = async (countryFilter?: string) => {
    try {
      // Charger les pays distincts depuis les vendeurs visibles sur le marketplace
      // (actifs, avec un pays d├®fini)
      const { data: countryData, error: countryError } = await supabase
        .from('vendors')
        .select('country')
        .eq('is_active', true)
        .not('country', 'is', null)
        .neq('country', '')
        .or('business_type.is.null,business_type.neq.physical');

      if (countryError) {
        console.error('Erreur chargement pays:', countryError);
      }

      const uniqueCountries = [
        ...new Set(
          (countryData || [])
            .map(v => (v.country || '').trim().replace(/\s+/g, ' '))
            .filter(Boolean)
        )
      ];

      // Si aucun pays trouv├®, on peut aussi chercher dans les produits num├®riques
      if (uniqueCountries.length === 0) {
        const { data: digitalVendors } = await supabase
          .from('digital_products')
          .select('vendors!digital_products_vendor_id_fkey(country)')
          .eq('status', 'published')
          .not('vendor_id', 'is', null);

        const digitalCountries = (digitalVendors || [])
          .map((d: any) => d.vendors?.country)
          .filter(Boolean)
          .map((c: string) => c.trim().replace(/\s+/g, ' '));

        uniqueCountries.push(...new Set(digitalCountries));
      }

      setCountries([...new Set(uniqueCountries)].sort());

      // Charger les villes distinctes (filtr├®es par pays si s├®lectionn├®)
      let cityQuery = supabase
        .from('vendors')
        .select('city, country')
        .eq('is_active', true)
        .not('city', 'is', null)
        .neq('city', '')
        .or('business_type.is.null,business_type.neq.physical');

      // Si un pays est s├®lectionn├®, filtrer les villes par ce pays
      if (countryFilter && countryFilter !== 'all') {
        cityQuery = cityQuery.ilike('country', countryFilter);
      }

      const { data: cityData } = await cityQuery;

      const cityMap = new Map<string, string>();
      (cityData || []).forEach(v => {
        const raw = (v.city || '').trim().replace(/\s+/g, ' ');
        if (raw) {
          const key = raw.toLowerCase();
          if (!cityMap.has(key)) {
            // Garder la version avec majuscule
            cityMap.set(key, raw.charAt(0).toUpperCase() + raw.slice(1));
          }
        }
      });
      setCities([...cityMap.values()].sort());
    } catch (error) {
      console.error('Erreur chargement localisations:', error);
    }
  };

  // Auto-pays : par défaut, présélectionner le PAYS DÉTECTÉ (IP/timezone) s'il existe des
  // vendeurs dans ce pays. Sinon → « Mondial » (all). Vaut pour connecté ET anonyme.
  // Le pays détecté est un code ISO-2 (ex. 'GN') ; les chips sont des noms ('Guinée') → on
  // résout d'abord par nom, sinon par code ISO. Appliqué une seule fois (n'écrase pas un
  // choix manuel ni une vue boutique).
  useEffect(() => {
    if (autoCountryAppliedRef.current) return;
    if (vendorId) { autoCountryAppliedRef.current = true; return; } // vue boutique → ne pas forcer

    // Détection RÉELLE : pays explicite du profil → détecté (profil) → détecté (IP/timezone)
    const realCandidate = profile?.country || profile?.detected_country || userCountry || '';

    // Secours : cache de géo-détection (peut être un fallback). Utilisé seulement si aucune
    // détection réelle, et SANS verrouiller (une détection réelle plus tardive pourra corriger).
    const readGeoCache = (): string => {
      try {
        const raw = localStorage.getItem('geo_detection_cache');
        if (raw) {
          const p = JSON.parse(raw);
          if (p?.data?.country && String(p.data.country).length === 2) return p.data.country;
        }
      } catch { /* ignore */ }
      return '';
    };

    const provisional = !realCandidate;
    const candidate = realCandidate || readGeoCache();
    if (!candidate) return;             // aucune info géo encore → attendre
    if (countries.length === 0) return; // chips pas encore chargés → attendre

    // ── Résolution CLIENT (synchrone, FIABLE) du pays détecté → un chip existant.
    // Garantit que « Produits » filtre TOUJOURS sur le pays de l'utilisateur, même si
    // l'endpoint backend est indisponible/non déployé. (Indépendant du seuil.)
    const norm = (s?: string) => (s || '').trim().replace(/\s+/g, ' ').toLowerCase();
    let clientMatch = countries.find((c) => norm(c) === norm(candidate));
    if (!clientMatch) {
      const nm = getCountryNameFromCode(candidate);
      if (nm) clientMatch = countries.find((c) => norm(c) === norm(nm));
    }
    homeCountryRef.current = clientMatch || 'all';

    // 🌍 DÉCISION DE SEUIL : autoritaire côté backend (atomique) quand dispo. Le backend
    // résout le pays, compte les produits et applique le seuil. Si l'appel échoue, on
    // reste prudemment sur « Mondial » (le bouton « Produits » fonctionne déjà via le client).
    let cancelled = false;
    (async () => {
      const decision = await getMarketplaceHomeCountry(candidate);
      if (cancelled || autoCountryAppliedRef.current) return; // ne pas écraser un choix manuel

      // Si le backend a résolu un pays, il fait foi ; sinon on garde la résolution client.
      const home = decision.homeCountry || clientMatch || 'all';
      homeCountryRef.current = home;

      // Le seuil décide UNIQUEMENT de l'état de DÉPART (sinon Mondial).
      const startCountry = (decision.qualifies && decision.homeCountry) ? decision.homeCountry : 'all';
      setSelectedCountry(startCountry);
      setActiveTab(startCountry !== 'all' ? 'products' : 'country');

      if (!provisional) autoCountryAppliedRef.current = true;
    })();
    return () => { cancelled = true; };
  }, [user, profile, userCountry, countries, vendorId]);

  // Recharger les villes quand le pays change
  useEffect(() => {
    loadLocations(selectedCountry);
    // R├®initialiser la ville si on change de pays
    if (selectedCountry !== 'all') {
      setSelectedCity('all');
    }
  }, [selectedCountry]);

  const handleProductClick = (itemId: string) => {
    setSelectedProductId(itemId);
    setShowProductModal(true);
  };

  const [contactLoading, setContactLoading] = useState<string | null>(null);
  const contactVendor = useContactVendor();
  const handleContactVendor = (itemId: string) => {
    const item = marketplaceItems.find(p => p.id === itemId);
    if (!item) {
      toast.error('Item introuvable');
      return;
    }
    contactVendor({
      vendorUserId: item.vendor_user_id,
      vendorId: item.vendor_id,
      productId: item.id,
      productName: item.name,
      onLoadingChange: (l) => setContactLoading(l ? itemId : null),
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20 scroll-smooth">
      {/* Header compact mobile */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="px-3 py-2 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0 overflow-hidden">
              {vendorName ? (
                <>
                  <h1 className="text-base sm:text-xl font-bold text-foreground truncate">
                    {vendorName}
                  </h1>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {marketplaceTotal} article{marketplaceTotal > 1 ? 's' : ''}
                  </p>
                </>
              ) : (
                <h1 className="text-sm sm:text-base font-semibold text-primary truncate">
                  224Solutions Marketplace
                </h1>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <CurrencyIndicator variant="default" />
              {vendorId && (
                <>
                  <ShareButton
                    title={vendorName || 'Boutique'}
                    text={`D├®couvrez la boutique ${vendorName} sur 224 Solutions`}
                    url={`${window.location.origin}/boutique/${vendorSlug || vendorId}`}
                    variant="outline"
                    size="icon"
                    resourceType="shop"
                    resourceId={vendorId}
                    useShortUrl={true}
                    ogType="shop"
                  />
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => navigate('/marketplace')}
                    className="text-xs"
                  >
                    {t('home.seeAll')}
                  </Button>
                </>
              )}
              {user && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative h-8 w-8"
                  onClick={() => navigate('/cart')}
                >
                  <ShoppingCartIcon className="w-4 h-4" />
                  {getCartCount() > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[9px]">
                      {getCartCount()}
                    </Badge>
                  )}
                </Button>
              )}
            </div>
          </div>
          
          {/* Search bar */}
          <div className="mt-2">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t('marketplace.searchProducts')}
              showFilter
              onFilter={() => setShowFilters(!showFilters)}
              showCamera
              onCameraCapture={(file) => {
                navigate('/marketplace/visual-search', { state: { capturedImage: file } });
              }}
            />
          </div>
        </div>
      </header>

      {/* Categories - compact on mobile */}
      <section className="px-2 py-1.5 border-b border-border overflow-visible bg-background">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0.5 -mx-0.5 px-0.5">
          {categories.map((category) => (
            <Badge
              key={category.id}
              variant={selectedCategory === category.id ? "filter-active" : "filter"}
              className="whitespace-nowrap shrink-0 px-2.5 py-1 text-[10px] sm:text-xs rounded-full"
              onClick={() => {
                setActiveTab('products');
                setSelectedCategory(category.id);
                setSelectedDigitalCategory('all');
                setSelectedItemType(category.id === 'all' ? 'all' : 'product');
              }}
            >
              {category.name}
            </Badge>
          ))}
        </div>
      </section>

      {/* Type filter buttons - inline compact */}
      <section className="px-2 py-1.5 border-b border-border">
        <div className="flex justify-center gap-2">
          <button
            onClick={() => {
              // « Produits » = accueil : onglet produits + retour au pays détecté (maison).
              // itemType='all' → e-commerce du pays + produits numériques (mondiaux).
              setActiveTab('products');
              setSelectedItemType('all');
              setSelectedDigitalCategory('all');
              setShowCountryPicker(false);
              autoCountryAppliedRef.current = true;
              setSelectedCountry(homeCountryRef.current); // produits du pays par défaut
            }}
            className={cn(
              'flex-1 max-w-[140px] h-10 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs font-medium',
              activeTab === 'products'
                ? 'text-white shadow-sm'
                : 'bg-card border border-border hover:border-primary/50'
            )}
            style={activeTab === 'products' ? { backgroundColor: BRAND_BLUE } : undefined}
          >
            <Package className="w-3.5 h-3.5" />
            Produits
          </button>
          <button
            onClick={() => {
              setActiveTab('country');
              setSelectedItemType('all');
              setSelectedDigitalCategory('all');
              setShowCountryPicker((v) => !v);
            }}
            className={cn(
              'flex-1 max-w-[140px] h-10 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs font-medium',
              activeTab === 'country'
                ? 'text-white shadow-sm'
                : 'bg-card border border-border hover:border-primary/50'
            )}
            style={activeTab === 'country' ? { backgroundColor: BRAND_BLUE } : undefined}
            title={t('marketplace.chooseCountry')}
          >
            {activeTab === 'country' && selectedCountry !== 'all'
              ? <span className="text-sm leading-none shrink-0" aria-hidden>{getFlagEmoji(selectedCountry) || '📍'}</span>
              : <Globe className="w-3.5 h-3.5" />}
            <span className="truncate">
              {activeTab === 'country' && selectedCountry !== 'all' ? selectedCountry : 'Mondial'}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab('services');
              setSelectedItemType('professional_service');
              setSelectedDigitalCategory('all');
              setShowCountryPicker(false);
            }}
            className={cn(
              'flex-1 max-w-[140px] h-10 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs font-medium',
              activeTab === 'services'
                ? 'text-white shadow-sm'
                : 'bg-card border border-border hover:border-secondary/50'
            )}
            style={activeTab === 'services' ? { backgroundColor: BRAND_BLUE } : undefined}
          >
            <Briefcase className="w-3.5 h-3.5" />
            Services Pro
          </button>
          <button
            onClick={() => {
              setActiveTab('digital');
              setSelectedItemType('digital_product');
              setShowCountryPicker(false);
            }}
            className={cn(
              'flex-1 max-w-[140px] h-10 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs font-medium',
              activeTab === 'digital'
                ? 'text-white shadow-sm'
                : 'bg-card border border-border hover:border-accent/50'
            )}
            style={activeTab === 'digital' ? { backgroundColor: BRAND_ORANGE } : undefined}
          >
            <Laptop className="w-3.5 h-3.5" />
            Numériques
          </button>
        </div>
      </section>

      {/* Filtre categories numeriques - Visible uniquement pour les produits numeriques */}
      {selectedItemType === 'digital_product' && (
        <section className="px-2 py-2 border-b border-border">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
            {DIGITAL_CATEGORIES.map((cat) => {
              const IconComponent = cat.icon;
              const isSelected = selectedDigitalCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedDigitalCategory(cat.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1.5 rounded-lg shrink-0 transition-all duration-150',
                    'border text-xs font-medium',
                    isSelected
                      ? 'bg-[#04439e] border-transparent text-white shadow-sm'
                      : 'bg-white border-[#04439e]/25 text-[#04439e] hover:bg-[#04439e]/5 hover:border-[#04439e]/50'
                  )}
                >
                  <div 
                    className="w-5 h-5 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : BRAND_BLUE }}
                  >
                    <IconComponent className="w-3 h-3 text-white" />
                  </div>
                  <span className={cn(
                    'hidden xs:inline',
                    isSelected ? 'text-white' : 'text-foreground'
                  )}>
                    {cat.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Liste des pays - affichée seulement quand on clique « Mondial » (chips défilables) */}
      {showCountryPicker && (
      <section className="px-2 py-1.5 border-b border-border bg-muted/30">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
          {/* Mondial = tous les pays (fallback / vue monde entier) */}
          <button
            onClick={() => { setActiveTab('country'); autoCountryAppliedRef.current = true; setSelectedCountry('all'); setShowCountryPicker(false); }}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border shrink-0 transition-all duration-150',
              selectedCountry === 'all'
                ? 'bg-[#04439e] border-transparent text-white'
                : 'bg-white border-[#04439e]/25 text-[#04439e] hover:bg-[#04439e]/5 hover:border-[#04439e]/50'
            )}
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            Mondial
          </button>
          {countries.map((country) => {
            const isSelected = selectedCountry === country;
            const flag = getFlagEmoji(country); // drapeau (ou '' si pays inconnu)
            return (
              <button
                key={country}
                onClick={() => { setActiveTab('country'); autoCountryAppliedRef.current = true; setSelectedCountry(country); setShowCountryPicker(false); }}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border shrink-0 transition-all duration-150 whitespace-nowrap',
                  isSelected
                    ? 'bg-[#04439e] border-transparent text-white'
                    : 'bg-white border-[#04439e]/25 text-[#04439e] hover:bg-[#04439e]/5 hover:border-[#04439e]/50'
                )}
              >
                {flag
                  ? <span className="text-sm leading-none shrink-0" aria-hidden>{flag}</span>
                  : <MapPin className="w-3 h-3 shrink-0" />}
                {country}
              </button>
            );
          })}
        </div>
      </section>
      )}

      {/* Liste des VILLES — affichée seulement au clic sur « Toutes les villes » (chips défilables) */}
      {showCityPicker && cities.length > 0 && (
        <section className="px-2 py-1.5 border-b border-border bg-muted/30">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
            <button
              onClick={() => { setSelectedCity('all'); setShowCityPicker(false); }}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border shrink-0 transition-all duration-150 whitespace-nowrap',
                selectedCity === 'all'
                  ? 'bg-[#04439e] border-transparent text-white'
                  : 'bg-white border-[#04439e]/25 text-[#04439e] hover:bg-[#04439e]/5 hover:border-[#04439e]/50'
              )}
            >
              <MapPin className="w-3 h-3 shrink-0" />
              Toutes les villes
            </button>
            {cities.map((city) => {
              const isSel = selectedCity === city;
              return (
                <button
                  key={city}
                  onClick={() => { setSelectedCity(city); setShowCityPicker(false); }}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border shrink-0 transition-all duration-150 whitespace-nowrap',
                    isSel
                      ? 'bg-[#04439e] border-transparent text-white'
                      : 'bg-white border-[#04439e]/25 text-[#04439e] hover:bg-[#04439e]/5 hover:border-[#04439e]/50'
                  )}
                >
                  <MapPin className="w-3 h-3 shrink-0" />
                  {city}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Filters & View Controls */}
      <section className="px-2 py-1.5 border-b border-border">
        {/* Premiere ligne de filtres - scrollable horizontalement */}
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
          {/* Tri — bouton qui déroule les options en chips (comme Mondial/Ville) */}
          <button
            onClick={() => setShowSortPicker((v) => !v)}
            className={cn(
              'h-8 shrink-0 w-auto min-w-[100px] sm:min-w-[140px] px-2.5 rounded-md flex items-center gap-1 text-[10px] sm:text-xs font-medium transition-all border',
              showSortPicker ? 'text-white border-transparent shadow-sm' : 'bg-background border-border hover:border-primary/40'
            )}
            style={showSortPicker ? { backgroundColor: BRAND_BLUE } : undefined}
            title="Trier"
          >
            <ArrowUpDown className="w-3 h-3 shrink-0" />
            <span className="truncate">{SORT_OPTIONS.find((o) => o.value === sortBy)?.label || 'Trier'}</span>
          </button>

          {/* Filtre Ville — bouton à sa place ; clic = déroule la liste des villes (chips) */}
          <button
            onClick={() => setShowCityPicker((v) => !v)}
            className={cn(
              'h-8 shrink-0 w-auto min-w-[105px] sm:min-w-[140px] px-2.5 rounded-md flex items-center gap-1 text-[10px] sm:text-xs font-medium transition-all border',
              showCityPicker || selectedCity !== 'all'
                ? 'text-white border-transparent shadow-sm'
                : 'bg-background border-border hover:border-primary/40'
            )}
            style={(showCityPicker || selectedCity !== 'all') ? { backgroundColor: BRAND_BLUE } : undefined}
            title="Filtrer par ville"
          >
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{selectedCity === 'all' ? 'Toutes les villes' : selectedCity}</span>
          </button>

          {!isMobile && (
            <div className="flex items-start gap-1 rounded-lg shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBrowseModal(true)}
                className="h-11 w-11 p-0 hover:text-white"
                style={{ color: BRAND_BLUE }}
                title="Explorer"
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = BRAND_BLUE; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <List className="w-6 h-6" />
              </Button>
            </div>
          )}
        </div>

        {/* Panneau de filtres avances */}
        {showFilters && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block text-foreground">Prix (GNF)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    className="flex-1 px-3 py-2 border border-border rounded-md text-xs bg-background w-full"
                    onChange={e => setFilters(prev => ({ ...prev, minPrice: parseInt(e.target.value) || 0 }))}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    className="flex-1 px-3 py-2 border border-border rounded-md text-xs bg-background w-full"
                    onChange={e => setFilters(prev => ({ ...prev, maxPrice: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block text-foreground">{t('marketplace.minRating')}</label>
                <Select onValueChange={(val) => setFilters(prev => ({ ...prev, minRating: parseInt(val) || 0 }))}>
                  <SelectTrigger className="h-9 text-xs w-full">
                    <SelectValue placeholder={t('marketplace.chooseRating')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4+ {t('marketplace.stars')}</SelectItem>
                    <SelectItem value="3">3+ {t('marketplace.stars')}</SelectItem>
                    <SelectItem value="2">2+ {t('marketplace.stars')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Liste des options de TRI — affichée au clic sur le bouton de tri (chips défilables) */}
      {showSortPicker && (
        <section className="px-2 py-1.5 border-b border-border bg-muted/30">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
            {SORT_OPTIONS.map((o) => {
              const isSel = sortBy === o.value;
              return (
                <button
                  key={o.value}
                  onClick={() => { setSortBy(o.value as typeof sortBy); setShowSortPicker(false); }}
                  className={cn(
                    'flex items-center gap-1 px-2.5 h-8 rounded-lg shrink-0 whitespace-nowrap transition-all text-[11px] sm:text-xs font-medium border',
                    isSel ? 'text-white border-transparent shadow-sm' : 'bg-card border-border hover:border-primary/40'
                  )}
                  style={isSel ? { backgroundColor: BRAND_BLUE } : undefined}
                >
                  <ArrowUpDown className="w-3 h-3 shrink-0" />
                  {o.label}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* AI Recommendations - Alibaba style (contenu filtré par pays, voir reco*Filtered) */}
      {selectedCategory === 'all' && selectedItemType !== 'professional_service' && selectedItemType !== 'digital_product' && (
        <section className="px-2 sm:px-4 py-2">
          <AIRecommendationSection
            title={t('marketplace.selectedForYou') || 'Sélection pour vous'}
            subtitle={t('marketplace.basedOnBehavior') || 'Basé sur votre activité récente'}
            products={aiPersonalizedF}
            isLoading={loadingAIPersonalized}
            icon="sparkles"
            showReason={true}
            seeAllLink="/marketplace/for-you"
            maxItems={6}
          />

          <AIRecommendationSection
            title={t('marketplace.trendingNow') || 'Tendances du moment'}
            subtitle={t('marketplace.trendingSubtitle') || 'Les plus populaires cette semaine'}
            products={aiTrendingF}
            isLoading={loadingAITrending}
            icon="trending"
            showReason={false}
            seeAllLink="/marketplace/for-you"
            maxItems={6}
          />

          <AIRecommendationSection
            title={t('marketplace.discoverTitle')}
            subtitle={t('marketplace.discoverSubtitle')}
            products={discoveryProductsF}
            isLoading={loadingDiscovery}
            icon="gift"
            showReason={true}
            maxItems={8}
          />

          {/* Smart Recommendations base sur scoring produit + preferences utilisateur */}
          <AIRecommendationSection
            title={t('marketplace.recommendedTitle')}
            subtitle={t('marketplace.recommendedSubtitle')}
            products={smartRecsF}
            isLoading={loadingSmartRecs}
            icon="sparkles"
            showReason={true}
            maxItems={8}
          />

          {/* Populaire en ce moment ÔÇö bas├® sur product_scores trending */}
          <AIRecommendationSection
            title={t('marketplace.trendingTitle')}
            subtitle={t('marketplace.trendingSubtitle')}
            products={trendingProductsF}
            isLoading={loadingTrendingProducts}
            icon="trending"
            showReason={false}
            maxItems={8}
          />

          {/* R├®cemment consult├®s */}
          <AIRecommendationSection
            title={t('marketplace.recentTitle')}
            subtitle={t('marketplace.recentSubtitle')}
            products={recentlyViewedF}
            isLoading={loadingRecentlyViewed}
            icon="clock"
            showReason={false}
            maxItems={8}
          />
        </section>
      )}

      {/* Results */}
      <section className="px-2 sm:px-4 py-2">
        {/* Si "Services Pro" est s├®lectionn├®, afficher la grille des types de services */}
        {selectedItemType === 'professional_service' ? (
          <ServiceTypesGrid
            onBack={() => { setActiveTab('products'); setSelectedItemType('all'); }}
            searchQuery={searchQuery}
            country={selectedCountry}
            city={selectedCity}
          />
        ) : (
          <>
            {/* Barre de recherche pour produits num├®riques */}
            {selectedItemType === 'digital_product' && (
              <div className="mb-4">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={t('marketplace.searchProducts')}
                />
              </div>
            )}


            {marketplaceLoading ? (
              <MarketplaceLoadingState onRetry={marketplaceRefresh} />
            ) : marketplaceItems.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-2">
                   {t('marketplace.noProducts')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('marketplace.noProducts')}
                </p>
              </div>
            ) : (
              <MarketplaceGrid>
                {marketplaceItems.filter(item => item.item_type !== 'professional_service').map((item) => (
                  <TranslatedProductCard
                    key={item.id}
                    id={item.id}
                    image={item.images || []}
                    promotionalVideos={item.promotional_videos || []}
                    title={item.name}
                    description={item.description}
                    price={item.price}
                    originalPrice={item.originalPrice}
                    currency={item.currency || 'GNF'}
                    vendor={item.vendor_name}
                    vendorId={item.vendor_id}
                    vendorUserId={item.vendor_user_id}
                    vendorPublicId={item.vendor_public_id}
                    vendorLocation={item.address}
                    vendorRating={item.rating}
                    vendorRatingCount={item.reviews_count}
                    rating={item.rating}
                    reviewCount={item.reviews_count}
                    isPremium={item.is_premium || item.is_featured}
                    stock={item.stock}
                    category={item.category_name}
                    onBuy={() => item.external_link ? navigate(item.external_link) : handleProductClick(item.id)}
                    onAddToCart={() => {
                      if (item.external_link) { navigate(item.external_link); return; }
                      addToCart({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        image: item.images?.[0],
                        vendor_id: item.vendor_id,
                        vendor_name: item.vendor_name,
                        currency: item.currency || 'GNF',
                        item_type: item.item_type,
                        product_mode: item.product_mode,
                        affiliate_url: item.affiliate_url
                      });
                      toast.success(t('marketplace.addToCart'));
                    }}
                    onContact={() => handleContactVendor(item.id)}
                    contactLoading={contactLoading === item.id}
                  />
                ))}
              </MarketplaceGrid>
            )}

            {/* Infinite Scroll - charge automatiquement au d├®filement */}
            <InfiniteScrollTrigger
              onTrigger={marketplaceLoadMore}
              hasMore={marketplaceHasMore}
              isLoading={marketplaceLoading}
            />
          </>
        )}
      </section>

      <ScrollToTopButton />

      {/* Footer de navigation */}
      <QuickFooter />

      {/* Modal de d├®tails du produit */}
      <ProductDetailModal
        productId={selectedProductId}
        open={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setSelectedProductId(null);
        }}
      />

      {/* Modal de navigation */}
      <BrowseModal
        open={showBrowseModal}
        onOpenChange={setShowBrowseModal}
        categories={categories}
        onSelectCategory={(catId) => {
          setActiveTab('products');
          setSelectedCategory(catId);
          setSelectedDigitalCategory('all');
          setSelectedItemType(catId === 'all' ? 'all' : 'product');
        }}
        onSelectProduct={(productId) => handleProductClick(productId)}
        onSelectVendor={(vendorId) => navigate(`/shop/${vendorId}`)}
        country={selectedCountry}
        city={selectedCity}
      />
    </div>
  );
}
