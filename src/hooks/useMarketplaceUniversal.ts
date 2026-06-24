/**
 * Hook Universel Marketplace - 224SOLUTIONS
 * Charge les produits E-commerce, les produits numériques et les services professionnels
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getCurrencyForCountry } from '@/data/countryMappings';
import { rankMarketplaceCandidates } from '@/services/marketplaceVisibilityService';

// Mapping des catégories techniques vers des noms lisibles
const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
  'dropshipping': 'Dropshipping',
  'voyage': 'Voyage & Billetterie',
  'logiciel': 'Logiciel & SaaS',
  'formation': 'Formation & Coaching',
  'livre': 'Livre & eBook',
  'custom': 'Produit Numérique',
  'ai': 'Intelligence Artificielle',
  'physique_affilie': 'Produit Physique',
};

/**
 * Nettoie un terme de recherche pour un usage SÛR dans les filtres PostgREST.
 * Retire les caractères qui cassent la syntaxe `.or()` (`,` `(` `)`) et les
 * jokers `ilike` (`%` `_`) ainsi que les backslashes. Compacte les espaces.
 */
function sanitizeSearchTerm(raw?: string): string {
  return (raw || '')
    .replace(/[,()%\\_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Retire les accents (é→e, à→a…) pour une recherche insensible aux accents. */
function stripAccents(s: string): string {
  // ̀-ͯ = marques diacritiques combinantes (séparées par normalize('NFD'))
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Sonde (mise en cache) : la recherche insensible aux accents est-elle disponible
 * (colonnes générées `search_text` présentes en base) ? Si la migration n'est pas
 * encore appliquée, on retombe sur la recherche classique (name/description).
 */
let searchTextCapability: Promise<boolean> | null = null;
function hasUnaccentSearch(): Promise<boolean> {
  if (!searchTextCapability) {
    searchTextCapability = supabase
      .from('products')
      .select('search_text')
      .limit(1)
      .then(({ error }) => !error)
      .catch(() => false);
  }
  return searchTextCapability;
}

export interface MarketplaceItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  currency?: string; // Devise du produit (USD, EUR, GNF, etc.)
  description?: string;
  images: string[];
  promotional_videos?: string[];
  vendor_id: string;
  vendor_name: string;
  vendor_user_id?: string;
  vendor_public_id?: string; // public_id du vendeur (VND0001, etc.)
  category_name?: string;
  service_type?: string;
  rating: number;
  reviews_count: number;
  item_type: 'product' | 'digital_product' | 'professional_service';
  free_shipping?: boolean;
  created_at: string;
  marketplace_position?: number; // Position dans le marketplace (rotation automatique)
  is_sponsored?: boolean; // Produit sponsorisé (toujours en tête)
  // Champs spécifiques aux services professionnels
  business_name?: string;
  address?: string;
  phone?: string;
  opening_hours?: any;
  // Champs spécifiques aux produits numériques
  download_url?: string;
  file_size?: string;
  license_type?: string;
  // Champs pour affiliés
  product_mode?: 'direct' | 'affiliate';
  affiliate_url?: string;
  visibility_score?: number;
  /** Lien interne vers la page du service (produits issus des modules : agriculture, restaurant, beauté…). */
  external_link?: string;
}

interface UseMarketplaceUniversalOptions {
  limit?: number;
  category?: string;
  searchQuery?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  vendorId?: string;
  country?: string;
  city?: string;
  itemType?: 'all' | 'product' | 'digital_product' | 'professional_service';
  sortBy?: 'popular' | 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'position' | 'visibility';
  autoLoad?: boolean;
  userPreferredCategories?: string[]; // ✅ catégories préférées (bonus pertinence)
}

const MARKETPLACE_SOURCE_TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: Promise<T>, fallbackValue: T, label: string, timeoutMs: number = MARKETPLACE_SOURCE_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[Marketplace] Timeout source: ${label}`);
          resolve(fallbackValue);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const useMarketplaceUniversal = (options: UseMarketplaceUniversalOptions = {}) => {
  const {
    limit = 24,
    category,
    searchQuery,
    minPrice,
    maxPrice,
    minRating,
    vendorId,
    country,
    city,
    itemType = 'all',
    sortBy = 'newest',
    autoLoad = true,
    userPreferredCategories = [],
  } = options;

  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(autoLoad);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const sourceRowLimit = Math.max(limit * 5, 120);

  const requestIdRef = useRef(0);
  const lastLoadedAtRef = useRef(0);
  const loadingRef = useRef(false);
  const refreshRef = useRef<() => void>(() => { });
  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Charge les produits e-commerce classiques
   */
  const loadProducts = async (): Promise<MarketplaceItem[]> => {
    if (itemType === 'professional_service' || itemType === 'digital_product') return [];

    try {
      let query = supabase
        .from('products')
        .select(`
          id,
          name,
          price,
          compare_price,
          description,
          images,
          promotional_videos,
          vendor_id,
          category_id,
          rating,
          reviews_count,
          free_shipping,
          created_at,
          marketplace_position,
          is_sponsored,
          seller_currency,
          vendors!inner(business_name, user_id, business_type, country, city, shop_currency),
          categories(name)
        `)
        .eq('is_active', true)
        // Règle marketplace côté SERVEUR : seuls les vendeurs en ligne/hybride exposent
        // des produits (plus de post-filtrage client → moins de sur-récupération).
        .in('vendors.business_type', ['online', 'hybrid']);

      // Filtres
      if (vendorId) query = query.eq('vendor_id', vendorId);
      if (category && category !== 'all') {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category);
        if (isUUID) {
          query = query.eq('category_id', category);
        }
      }
      // 🔎 Recherche ÉLARGIE (serveur) : nom + description + nom de catégorie.
      // Insensible aux accents si dispo (colonne search_text) ; sinon repli name/description.
      const productSearch = sanitizeSearchTerm(searchQuery);
      if (productSearch) {
        const useUnaccent = await hasUnaccentSearch();
        const ors: string[] = [];
        let catIds: string[] = [];
        if (useUnaccent) {
          const term = stripAccents(productSearch).toLowerCase();
          ors.push(`search_text.ilike.%${term}%`);
          const { data: cats } = await supabase
            .from('categories').select('id').ilike('search_name', `%${term}%`);
          catIds = (cats || []).map((c: any) => c.id).filter(Boolean);
        } else {
          ors.push(`name.ilike.%${productSearch}%`, `description.ilike.%${productSearch}%`);
          const { data: cats } = await supabase
            .from('categories').select('id').ilike('name', `%${productSearch}%`);
          catIds = (cats || []).map((c: any) => c.id).filter(Boolean);
        }
        if (catIds.length > 0) ors.push(`category_id.in.(${catIds.join(',')})`);
        query = query.or(ors.join(','));
      }
      // 🏙️ Filtre VILLE côté SERVEUR — match EXACT (insensible à la casse) de la ville
      // choisie. Pas de match sur le 1ᵉʳ mot (sinon « Préfecture De Labé » ramènerait aussi
      // « Préfecture De Coyah »). → seuls les produits de CETTE ville.
      if (city && city !== 'all') {
        const c = sanitizeSearchTerm(city);
        query = query.or(`city.ilike.${c}`, { referencedTable: 'vendors' });
      }
      if (minPrice && minPrice > 0) query = query.gte('price', minPrice);
      if (maxPrice && maxPrice > 0) query = query.lte('price', maxPrice);
      if (minRating && minRating > 0) query = query.gte('rating', minRating);

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(sourceRowLimit);
      if (error) throw error;

      // Reste : seul le filtre PAYS demeure côté client (correspondance normalisée exacte,
      // robuste aux variations de casse/espaces). business_type + ville sont déjà filtrés serveur.
      const filtered = (data || []).filter(product => {
        const vendor = (product.vendors as any);
        if (!vendor) return false; // sécurité (jointure inner garantit déjà la présence)

        if (country && country !== 'all') {
          const vendorCountry = (vendor.country || '').trim().replace(/\s+/g, ' ').toLowerCase();
          const normalizedCountry = country.trim().replace(/\s+/g, ' ').toLowerCase();
          if (vendorCountry !== normalizedCountry) return false;
        }

        return true;
      });

      // Récupérer les public_id des vendeurs depuis profiles
      const vendorUserIds = filtered
        .map(p => (p.vendors as any)?.user_id)
        .filter(Boolean);

      let vendorPublicIds: Record<string, string> = {};
      if (vendorUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, public_id')
          .in('id', vendorUserIds);

        if (profiles) {
          vendorPublicIds = Object.fromEntries(
            profiles.map(p => [p.id, p.public_id || ''])
          );
        }
      }

      return filtered.map(product => {
        const vendor = product.vendors as any;
        const vendorUserId = vendor?.user_id;
        // DEVISE = PAYS DU VENDEUR (fiable) : Guinée→GNF, Sénégal→XOF. PAS shop_currency (parfois faux).
        const derivedCurrency = getCurrencyForCountry(vendor?.country || '');

        return {
          id: product.id,
          name: product.name,
          price: product.price,
          // Prix barré : afficher si compare_price > price
          originalPrice: (product.compare_price && product.compare_price > product.price) ? product.compare_price : undefined,
          currency: derivedCurrency,
          description: product.description || '',
          images: Array.isArray(product.images) ? (product.images as string[]) : [],
          promotional_videos: Array.isArray(product.promotional_videos) ? (product.promotional_videos as string[]) : [],
          vendor_id: product.vendor_id,
          vendor_name: vendor?.business_name || 'Vendeur',
          vendor_user_id: vendorUserId,
          vendor_public_id: vendorUserId ? vendorPublicIds[vendorUserId] : undefined,
          category_name: (product.categories as any)?.name || 'Général',
          rating: product.rating || 0,
          reviews_count: product.reviews_count || 0,
          item_type: 'product' as const,
          free_shipping: product.free_shipping || false,
          created_at: product.created_at,
          marketplace_position: (product as any).marketplace_position || 0,
          is_sponsored: (product as any).is_sponsored || false,
        };
      });
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      return [];
    }
  };

  /**
   * Charge les services professionnels (restaurants, salons, etc.)
   */
  const loadProfessionalServices = async (): Promise<MarketplaceItem[]> => {
    if (itemType !== 'all' && itemType !== 'professional_service') return [];

    try {
      let query = supabase
        .from('professional_services')
        .select(`
          id,
          business_name,
          description,
          address,
          city,
          phone,
          logo_url,
          cover_image_url,
          rating,
          total_reviews,
          opening_hours,
          user_id,
          created_at,
          status,
          verification_status,
          service_types(name, code)
        `)
        .eq('status', 'active');

      // Filtres — recherche insensible aux accents si dispo, sinon repli nom/description
      const serviceSearch = sanitizeSearchTerm(searchQuery);
      if (serviceSearch) {
        if (await hasUnaccentSearch()) {
          query = query.ilike('search_text', `%${stripAccents(serviceSearch).toLowerCase()}%`);
        } else {
          query = query.or(`business_name.ilike.%${serviceSearch}%,description.ilike.%${serviceSearch}%`);
        }
      }
      if (minRating && minRating > 0) query = query.gte('rating', minRating);

      // Filtrage par ville — match EXACT (insensible à la casse), côté serveur
      if (city && city !== 'all') {
        const c = sanitizeSearchTerm(city);
        query = query.ilike('city', c);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(sourceRowLimit);
      if (error) throw error;

      // Filtrage par pays : professional_services n'a PAS de colonne `country`. Le pays du
      // service = pays de son vendeur propriétaire (vendors.country) — même source que les
      // chips de pays, et lisible par les visiteurs anonymes. On résout via user_id.
      let rows = data || [];
      if (country && country !== 'all') {
        const ownerIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
        const ownerCountry: Record<string, string> = {};
        if (ownerIds.length > 0) {
          const { data: ownerVendors } = await supabase
            .from('vendors')
            .select('user_id, country')
            .in('user_id', ownerIds);
          (ownerVendors || []).forEach((v: any) => {
            if (v.user_id && v.country) ownerCountry[v.user_id] = v.country;
          });
        }
        const normalizedCountry = country.trim().replace(/\s+/g, ' ').toLowerCase();
        rows = rows.filter(r => {
          const c = (ownerCountry[r.user_id] || '').trim().replace(/\s+/g, ' ').toLowerCase();
          return c === normalizedCountry;
        });
      }

      return rows.map(service => {
        // Construire le tableau d'images à partir de logo_url et cover_image_url
        const images: string[] = [];
        if (service.cover_image_url) images.push(service.cover_image_url);
        if (service.logo_url) images.push(service.logo_url);

        return {
          id: service.id,
          name: service.business_name,
          price: 0, // Les services pro n'ont pas de prix direct
          description: service.description || '',
          images,
          vendor_id: service.id,
          vendor_name: service.business_name,
          vendor_user_id: service.user_id,
          category_name: (service.service_types as any)?.name || 'Service',
          service_type: (service.service_types as any)?.code,
          rating: Number(service.rating) || 0,
          reviews_count: service.total_reviews || 0,
          item_type: 'professional_service' as const,
          business_name: service.business_name,
          address: service.address,
          phone: service.phone,
          opening_hours: service.opening_hours,
          created_at: service.created_at
        };
      });
    } catch (error) {
      console.error('Erreur chargement services professionnels:', error);
      return [];
    }
  };

  /**
   * Charge les produits numériques depuis la table digital_products
   */
  const loadDigitalProducts = async (): Promise<MarketplaceItem[]> => {
    if (itemType === "professional_service" || itemType === "product") return [];

    const DIGITAL_CATEGORIES = new Set([
      "dropshipping",
      "voyage",
      "logiciel",
      "formation",
      "livre",
      "custom",
      "ai",
      "physique_affilie",
    ]);

    try {
      // Jointure vendeur : INNER seulement si une ville est filtrée (pour pouvoir filtrer
      // côté serveur sans faire disparaître les numériques sans vendeur quand aucune ville
      // n'est sélectionnée). Les numériques restent MONDIAUX (jamais filtrés par pays).
      const cityActive = !!(city && city !== 'all');
      const vendorJoin = cityActive
        ? 'vendors:vendors!digital_products_vendor_id_fkey!inner (business_name, user_id, shop_slug, country, city)'
        : 'vendors:vendors!digital_products_vendor_id_fkey (business_name, user_id, shop_slug, country, city)';

      let query = supabase
        .from("digital_products")
        .select(
          `
          id,
          merchant_id,
          vendor_id,
          title,
          description,
          short_description,
          images,
          video_url,
          category,
          product_type,
          product_mode,
          price,
          currency,
          original_price,
          rating,
          reviews_count,
          created_at,
          affiliate_url,
          file_type,
          marketplace_position,
          is_sponsored,
          ${vendorJoin}
        `
        )
        .eq("status", "published");

      // Filtre vendeur (⚠️ vendorId = vendors.id dans l'UI marketplace)
      if (vendorId) {
        query = query.eq("vendor_id", vendorId);
      }

      // Filtre recherche (titre + description) — insensible aux accents si dispo, sinon repli
      const digitalSearch = sanitizeSearchTerm(searchQuery);
      if (digitalSearch) {
        if (await hasUnaccentSearch()) {
          query = query.ilike('search_text', `%${stripAccents(digitalSearch).toLowerCase()}%`);
        } else {
          query = query.or(`title.ilike.%${digitalSearch}%,description.ilike.%${digitalSearch}%`);
        }
      }

      // 🏙️ Filtre VILLE côté SERVEUR — match EXACT (insensible à la casse) de la ville.
      if (cityActive) {
        const c = sanitizeSearchTerm(city);
        query = query.or(`city.ilike.${c}`, { referencedTable: 'vendors' });
      }

      // Filtre prix
      if (minPrice && minPrice > 0) query = query.gte("price", minPrice);
      if (maxPrice && maxPrice > 0) query = query.lte("price", maxPrice);

      // Filtre catégorie: uniquement si la catégorie sélectionnée correspond à l'enum digital_products.category
      if (category && category !== "all" && DIGITAL_CATEGORIES.has(category)) {
        query = query.eq("category", category);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(sourceRowLimit);
      if (error) throw error;

      // Ville déjà filtrée côté SERVEUR (voir ci-dessus). Les numériques restent MONDIAUX
      // (jamais filtrés par pays) → on garde tout le lot renvoyé.
      const filtered = data || [];

      // Récupérer les public_id des vendeurs depuis profiles
      const vendorUserIds = filtered
        .map((p: any) => (p.vendors as any)?.user_id || p.merchant_id)
        .filter(Boolean);

      let vendorPublicIds: Record<string, string> = {};
      if (vendorUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, public_id')
          .in('id', vendorUserIds);

        if (profiles) {
          vendorPublicIds = Object.fromEntries(
            profiles.map(p => [p.id, p.public_id || ''])
          );
        }
      }

      return filtered.map((product: any) => {
        const images = Array.isArray(product.images) ? (product.images as string[]) : [];
        const v = product.vendors as any;
        const vendorUserId = v?.user_id || product.merchant_id;

        // Devise: utiliser celle du produit si définie, sinon dériver du pays du vendeur
        const vendorCountry = v?.country || '';
        const derivedCurrency = product.currency || (vendorCountry ? getCurrencyForCountry(vendorCountry) : 'GNF');

        return {
          id: product.id,
          name: product.title,
          price: product.price || 0,
          originalPrice: product.original_price || undefined,
          currency: derivedCurrency, // Devise du produit ou dérivée du vendeur
          description: product.short_description || product.description || "",
          images,
          promotional_videos: product.video_url ? [product.video_url] : [],
          vendor_id: product.vendor_id || product.merchant_id,
          vendor_name: v?.business_name || "Vendeur",
          vendor_user_id: vendorUserId,
          vendor_public_id: vendorUserId ? vendorPublicIds[vendorUserId] : undefined,
          // Afficher product_type (saisi par l'utilisateur) s'il existe, sinon fallback sur category
          category_name: product.product_type?.trim() || CATEGORY_DISPLAY_NAMES[product.category] || product.category || "Numérique",
          service_type: product.product_mode,
          rating: product.rating || 0,
          reviews_count: product.reviews_count || 0,
          item_type: "digital_product" as const,
          download_url: product.affiliate_url || undefined,
          file_size: product.file_type || undefined,
          license_type: product.product_mode === "affiliate" ? "Affiliation" : "Vente directe",
          created_at: product.created_at,
          marketplace_position: product.marketplace_position || 0,
          is_sponsored: product.is_sponsored || false,
          // Exposer product_mode et affiliate_url pour le panier
          product_mode: product.product_mode as 'direct' | 'affiliate' | undefined,
          affiliate_url: product.affiliate_url || undefined,
        };
      });
    } catch (error) {
      console.error("Erreur chargement produits numériques:", error);
      return [];
    }
  };

  /**
   * Récupère le nom de la catégorie à partir de son ID
   */
  const getCategoryName = async (categoryId: string): Promise<string | null> => {
    if (!categoryId || categoryId === 'all') return null;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId);
    if (!isUUID) return categoryId; // C'est déjà un nom

    try {
      const { data } = await supabase
        .from('categories')
        .select('name')
        .eq('id', categoryId)
        .single();
      return data?.name || null;
    } catch {
      return null;
    }
  };

  /**
   * Charge tous les items (produits e-commerce + produits numériques + services professionnels)
   */
  const loadAllItems = useCallback(async (reset = false) => {
    const requestId = ++requestIdRef.current;

    try {
      loadingRef.current = true;
      setLoading(true);

      // Si une catégorie e-commerce est sélectionnée (UUID), ne charger que les produits
      const isEcommerceCategorySelected = category && category !== 'all' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(category);

      // Produits issus des MODULES de service (agriculture, restaurant, beauté) — surfacés
      // dans la grille avec leurs photos. Un clic ouvre la page du service (external_link).
      const loadServiceProducts = async (): Promise<MarketplaceItem[]> => {
        if (itemType === 'professional_service' || itemType === 'digital_product') return [];
        try {
          // NB : Éducation (courses) N'est PAS surfacée ici — les formations passent par la boutique digitale.
          const [farm, resto, beauty, props, showcase] = await Promise.all([
            supabase.from('farm_products').select('id, professional_service_id, name, price, photos, description').eq('is_active', true).gt('stock_quantity', 0).limit(50),
            supabase.from('restaurant_menu_items').select('id, professional_service_id, name, price, image_url, description').eq('is_available', true).limit(50),
            supabase.from('beauty_services').select('id, professional_service_id, name, price, image_url, video_url, description').eq('is_active', true).limit(50),
            supabase.from('properties').select('id, professional_service_id, title, price, description, offer_type, status, images:property_images(image_url, is_cover)').eq('offer_type', 'location').eq('status', 'disponible').limit(50),
            supabase.from('service_showcase').select('id, professional_service_id, title, price, image_url, video_url, description').eq('is_active', true).limit(50),
          ]);
          const propCover = (r: any) => { const im = (r.images || []); const c = im.find((x: any) => x.is_cover) || im[0]; return c?.image_url ? [c.image_url] : []; };
          const rows: any[] = [
            ...(((farm.data as any[]) || []).map((r) => ({ r, link: `/agriculture/${r.professional_service_id}`, images: Array.isArray(r.photos) ? r.photos : [], cat: 'Agriculture' }))),
            ...(((resto.data as any[]) || []).map((r) => ({ r, link: `/restaurant/${r.professional_service_id}/menu`, images: r.image_url ? [r.image_url] : [], cat: 'Restaurant' }))),
            ...(((beauty.data as any[]) || []).map((r) => ({ r, link: `/beaute/${r.professional_service_id}`, images: r.image_url ? [r.image_url] : [], video: r.video_url, cat: 'Beauté' }))),
            ...(((props.data as any[]) || []).map((r) => ({ r: { ...r, name: r.title }, link: `/bien/${r.id}`, images: propCover(r), cat: 'Immobilier' }))),
            ...(((showcase.data as any[]) || []).map((r) => ({ r: { ...r, name: r.title }, link: `/services-proximite/${r.professional_service_id}`, images: r.image_url ? [r.image_url] : [], video: r.video_url, cat: 'Service' }))),
          ];
          const psids = [...new Set(rows.map((x) => x.r.professional_service_id).filter(Boolean))];
          let nameMap = new Map<string, string>();
          if (psids.length) {
            const { data: svcs } = await supabase.from('professional_services').select('id, business_name').in('id', psids);
            nameMap = new Map(((svcs as any[]) || []).map((s) => [s.id, s.business_name as string]));
          }
          return rows.filter((x) => x.images.length > 0).map((x) => ({
            id: x.r.id, name: x.r.name, price: Number(x.r.price) || 0, images: x.images.filter(Boolean),
            description: x.r.description || '', vendor_id: x.r.professional_service_id,
            vendor_name: nameMap.get(x.r.professional_service_id) || x.cat,
            business_name: nameMap.get(x.r.professional_service_id), category_name: x.cat,
            rating: 0, reviews_count: 0, item_type: 'product' as const, created_at: new Date().toISOString(),
            promotional_videos: x.video ? [x.video] : [],
            external_link: x.link,
          }));
        } catch { return []; }
      };

      // Charger selon le type sélectionné
      let allItems: MarketplaceItem[] = [];
      if (itemType === 'product') {
        const [products, serviceProducts] = await Promise.all([
          withTimeout(loadProducts(), [], 'products'),
          withTimeout(loadServiceProducts(), [], 'service_products'),
        ]);
        allItems = [...products, ...serviceProducts];
      } else if (itemType === 'digital_product') {
        allItems = isEcommerceCategorySelected ? [] : await withTimeout(loadDigitalProducts(), [], 'digital_products');
      } else if (itemType === 'professional_service') {
        allItems = isEcommerceCategorySelected ? [] : await withTimeout(loadProfessionalServices(), [], 'professional_services');
      } else {
        // 'all' = produits + numériques + services pro + produits des modules de service
        if (isEcommerceCategorySelected) {
          allItems = await withTimeout(loadProducts(), [], 'products');
        } else {
          const [products, digitalProducts, professionalServices, serviceProducts] = await Promise.all([
            withTimeout(loadProducts(), [], 'products'),
            withTimeout(loadDigitalProducts(), [], 'digital_products'),
            withTimeout(loadProfessionalServices(), [], 'professional_services'),
            withTimeout(loadServiceProducts(), [], 'service_products'),
          ]);
          allItems = [...products, ...digitalProducts, ...professionalServices, ...serviceProducts];
        }
      }

      // Filtrage global par prix
      if (minPrice && minPrice > 0) {
        allItems = allItems.filter(item => item.price >= minPrice);
      }
      if (maxPrice && maxPrice > 0) {
        allItems = allItems.filter(item => item.price <= maxPrice);
      }

      // Filtrage par rating
      if (minRating && minRating > 0) {
        allItems = allItems.filter(item => item.rating >= minRating);
      }

      // Tri avec rotation quotidienne pour une exposition équitable
      // Seed basé sur la date du jour pour que l'ordre change chaque jour
      const today = new Date();
      const dailySeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

      // Fonction de hash simple pour créer un ordre pseudo-aléatoire déterministe
      const seededHash = (str: string, seed: number) => {
        let hash = seed;
        for (let i = 0; i < str.length; i++) {
          hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
        }
        return hash;
      };

      // D'abord, séparer les produits sponsorisés (toujours en tête)
      const sponsored = allItems.filter(item => item.is_sponsored);
      const nonSponsored = allItems.filter(item => !item.is_sponsored);

      // Fonction de tri pour les non-sponsorisés
      const sortItems = (items: MarketplaceItem[]) => {
        switch (sortBy) {
          case 'price_asc':
            items.sort((a, b) => a.price - b.price);
            break;
          case 'price_desc':
            items.sort((a, b) => b.price - a.price);
            break;
          case 'rating':
            items.sort((a, b) => b.rating - a.rating);
            break;
          case 'popular':
            items.sort((a, b) => b.reviews_count - a.reviews_count);
            break;
          case 'newest':
            items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            break;
          case 'visibility': {
            // Score « Visibilité business » CÔTÉ CLIENT (repli si le backend de ranking est
            // indisponible) : qualité (note/avis/description/images) + fraîcheur + sponsorisé.
            // Le backend l'affine ensuite (abonnement/boost) quand il est joignable.
            const vScore = (it: MarketplaceItem) => {
              const rating = Number(it.rating) || 0;
              const reviews = Number(it.reviews_count) || 0;
              const imgs = Array.isArray(it.images) ? it.images.length : 0;
              const descLen = (it.description || '').length;
              const ageDays = Math.max(0, (Date.now() - new Date(it.created_at).getTime()) / 86_400_000);
              const recency = Math.max(0, 1 - ageDays / 60); // 0..1 (plus récent = mieux, ~60j)
              const quality = (rating / 5) * 45 + Math.log10(reviews + 1) * 20
                + Math.min(descLen / 600, 1) * 15 + Math.min(imgs / 5, 1) * 20;
              return quality + recency * 15 + (it.is_sponsored ? 15 : 0);
            };
            items.sort((a, b) => vScore(b) - vScore(a));
            break;
          }
          case 'position':
          default:
            // Rotation quotidienne: chaque produit reçoit un score pseudo-aléatoire
            // basé sur son ID + la date du jour, garantissant que l'ordre change chaque jour
            // tout en restant stable pendant la même journée
            items.sort((a, b) => {
              const scoreA = seededHash(a.id, dailySeed);
              const scoreB = seededHash(b.id, dailySeed);
              return scoreA - scoreB;
            });
            break;
        }
        return items;
      };

      // Trier les deux groupes séparément
      sortItems(sponsored);
      sortItems(nonSponsored);

      // Combiner: sponsorisés en tête, puis les autres
      allItems = [...sponsored, ...nonSponsored];

      // Ranking centralisé backend (abonnement + performance + boost + qualité + pertinence)
      // On l'applique pour les modes de découverte (visibility/position/popular)
      if (allItems.length > 0 && (sortBy === 'visibility' || sortBy === 'position' || sortBy === 'popular')) {
        const candidates = allItems
          .map(item => {
            const imageCount = Array.isArray(item.images) ? item.images.length : 0;
            return {
              id: item.id,
              itemType: item.item_type,
              vendorId: item.vendor_id,
              vendorUserId: item.vendor_user_id,
              rating: item.rating,
              reviewsCount: item.reviews_count,
              createdAt: item.created_at,
              descriptionLength: (item.description || '').length,
              imageCount,
              isSponsored: !!item.is_sponsored,
            };
          })
          .filter(c => !!c.vendorUserId);

        if (candidates.length > 0) {
          const ranked = await withTimeout(
            rankMarketplaceCandidates(candidates, {
              channel: 'marketplace',
              sortBy,
              category: category || 'all',
              itemType,
              country: country || 'all',
              city: city || 'all',
              // ✅ Catégories préférées (bonus de pertinence personnalisé côté backend)
              userPreferredCategories: userPreferredCategories || [],
            }),
            null,
            'visibility_ranking',
            4500
          );

          if (ranked?.orderedIds?.length) {
            const scoreById = ranked.scores || {};
            const orderMap = new Map<string, number>(ranked.orderedIds.map((id, idx) => [id, idx]));

            allItems = allItems
              .map(item => ({
                ...item,
                visibility_score: Number(scoreById[item.id]?.finalScore || 0),
              }))
              .sort((a, b) => {
                const idxA = orderMap.has(a.id) ? (orderMap.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
                const idxB = orderMap.has(b.id) ? (orderMap.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
                if (idxA !== idxB) return idxA - idxB;

                // fallback stable order
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              });
          }
        }
      }

      // Pagination
      const currentPage = reset ? 1 : page;
      const startIndex = (currentPage - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedItems = allItems.slice(startIndex, endIndex);

      // Protection anti-race-condition:
      // ignorer les anciennes requêtes qui reviennent après une nouvelle sélection
      if (requestId !== requestIdRef.current) return;

      if (reset) {
        setItems(paginatedItems);
        setPage(1);
      } else {
        setItems(prev => [...prev, ...paginatedItems]);
      }

      setTotal(allItems.length);
      setHasMore(endIndex < allItems.length);
      lastLoadedAtRef.current = Date.now();

    } catch (error) {
      if (requestId === requestIdRef.current) {
        console.error('Erreur chargement marketplace:', error);
        toast.error('Erreur lors du chargement des items');
      }
    } finally {
      if (requestId === requestIdRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [
    page,
    limit,
    category,
    searchQuery,
    minPrice,
    maxPrice,
    minRating,
    vendorId,
    country,
    city,
    itemType,
    sortBy,
  ]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  }, [loading, hasMore]);

  const refresh = useCallback(() => {
    loadAllItems(true);
  }, [loadAllItems]);

  useEffect(() => {
    refreshRef.current = () => loadAllItems(true);
  }, [loadAllItems]);

  // Charger automatiquement au montage et quand les options changent
  useEffect(() => {
    if (!autoLoad) return;

    setPage(1);
    setLoading(true);
    loadAllItems(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    category,
    searchQuery,
    minPrice,
    maxPrice,
    minRating,
    vendorId,
    country,
    city,
    itemType,
    sortBy,
    autoLoad,
  ]);

  // Charger plus quand la page change
  useEffect(() => {
    if (page > 1 && autoLoad) {
      loadAllItems(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Rechargement en temps réel: produits/services numériques/services pro
  useEffect(() => {
    if (!autoLoad) return;

    const scheduleRefresh = () => {
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
      }

      realtimeRefreshTimerRef.current = setTimeout(() => {
        console.log('[MarketplaceRealtime] Changement détecté → refresh');
        refreshRef.current();
      }, 1000);
    };

    const channel = supabase
      .channel('marketplace-realtime-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'digital_products' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'professional_services' }, scheduleRefresh)
      .subscribe();

    return () => {
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [autoLoad]);

  // Rechargement au retour en foreground (mobile + desktop)
  useEffect(() => {
    if (!autoLoad) return;

    const refreshIfStale = () => {
      const isVisible = document.visibilityState === 'visible';
      const staleForMs = Date.now() - lastLoadedAtRef.current;

      if (isVisible && staleForMs > 45_000 && !loadingRef.current) {
        console.log('[MarketplaceRealtime] Foreground/safety refresh', { staleForMs });
        refreshRef.current();
      }
    };

    const safetyInterval = setInterval(refreshIfStale, 60_000);
    window.addEventListener('focus', refreshIfStale);
    window.addEventListener('online', refreshIfStale);
    document.addEventListener('visibilitychange', refreshIfStale);

    return () => {
      clearInterval(safetyInterval);
      window.removeEventListener('focus', refreshIfStale);
      window.removeEventListener('online', refreshIfStale);
      document.removeEventListener('visibilitychange', refreshIfStale);
    };
  }, [autoLoad]);

  return {
    items,
    loading,
    total,
    hasMore,
    loadMore,
    refresh,
    page
  };
};
