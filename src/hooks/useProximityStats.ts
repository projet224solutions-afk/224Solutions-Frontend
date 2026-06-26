import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGeoDistance, calculateDistance as calcDistanceFn } from '@/hooks/useGeoDistance';

interface ProximityStats {
  boutiques: number;
  taxiMoto: number;
  livraison: number;
  beaute: number;
  restaurant: number;
  vtc: number;
  reparation: number;
  nettoyage: number;
  mode: number;
  sante: number;
  electronique: number;
  maison: number;
  immobilier: number;
  formation: number;
  media: number;
  sport: number;
  // Stats additionnelles utilisées dans Proximite.tsx
  informatique: number;
  agriculture: number;
  freelance: number;
  construction: number;
  plomberie: number;
  vitrerie: number;
  menuiserie: number;
  soudure: number;
}

/** Debug info returned by hook */
export interface ProximityDebugInfo {
  vendors: { total: number; noGps: number; outOfRadius: number; inRadius: number };
  services: { total: number; noGps: number; outOfRadius: number; inRadius: number };
  taxiMoto: { total: number; noGps: number; outOfRadius: number; inRadius: number };
  drivers: { total: number; noGps: number; outOfRadius: number; inRadius: number };
  positionUsed: { latitude: number; longitude: number };
  usingRealGps: boolean;
}

interface UserPosition {
  latitude: number;
  longitude: number;
}

const RADIUS_KM = 20;

export function useProximityStats() {
  // ✅ Source unique de géolocalisation (même fallback + même logique que les pages Nearby*)
  const { userPosition, positionReady, usingRealLocation, refreshPosition, DEFAULT_POSITION } = useGeoDistance();

  const [stats, setStats] = useState<ProximityStats>({
    boutiques: 0,
    taxiMoto: 0,
    livraison: 0,
    beaute: 0,
    restaurant: 0,
    vtc: 0,
    reparation: 0,
    nettoyage: 0,
    mode: 0,
    sante: 0,
    electronique: 0,
    maison: 0,
    immobilier: 0,
    formation: 0,
    media: 0,
    sport: 0,
    informatique: 0,
    agriculture: 0,
    freelance: 0,
    construction: 0,
    plomberie: 0,
    vitrerie: 0,
    menuiserie: 0,
    soudure: 0,
  });

  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<ProximityDebugInfo | null>(null);

  // Compat UI: message quand on utilise la position fallback
  const locationError = useMemo(() => {
    if (!positionReady) return null;
    if (usingRealLocation) return null;
    return 'GPS non disponible: distances basées sur la position par défaut';
  }, [positionReady, usingRealLocation]);

  const fetchStats = useCallback(async (position: UserPosition) => {
    try {
      setLoading(true);

      // ✅ 5 requêtes au lieu de 7 :
      //    - categories (standalone) supprimée : inutilisée (les noms de catégorie
      //      viennent du JOIN products.categories, pas de cette requête séparée)
      //    - vendors GPS cross-reference (req 7) supprimée : redondante avec la req 1
      //      qui contient déjà user_id/latitude/longitude → on filtre son résultat.
      //    products est CONSERVÉ : il alimente mode/électronique/maison (cf. plus bas).
      const [vendorsRes, proServicesRes, driversRes, taxiDriversRes, productsRes] = await Promise.all([
        supabase
          .from('vendors')
          .select('id, business_type, service_type, latitude, longitude, user_id')
          .eq('is_active', true),

        supabase
          .from('professional_services')
          .select(`
            id,
            latitude,
            longitude,
            service_type_id,
            user_id,
            service_types (code, name)
          `)
          .eq('status', 'active'),

        supabase
          .from('drivers')
          .select('id, vehicle_type, current_location')
          .or('status.eq.active,is_online.eq.true'),

        supabase
          .from('taxi_drivers')
          .select('id, vehicle_type, last_lat, last_lng, is_online, status')
          .or('is_online.eq.true,status.eq.on_trip,status.eq.active,status.eq.online'),

        supabase
          .from('products')
          .select(`
            id,
            category_id,
            vendor_id,
            categories (id, name)
          `)
          .eq('is_active', true),
      ]);

      if (vendorsRes.error) throw vendorsRes.error;
      if (proServicesRes.error) throw proServicesRes.error;
      if (driversRes.error) throw driversRes.error;
      if (taxiDriversRes.error) throw taxiDriversRes.error;
      if (productsRes.error) throw productsRes.error;

      const vendors = vendorsRes.data ?? [];
      const professionalServices = proServicesRes.data ?? [];
      const drivers = driversRes.data ?? [];
      const taxiDrivers = taxiDriversRes.data ?? [];
      const products = productsRes.data ?? [];

      // ✅ GPS cross-reference : on filtre la requête vendors existante (req 1)
      // au lieu d'une 2ᵉ requête vendors redondante.
      const vendorGpsMap = new Map<string, { lat: number; lng: number }>();
      vendors.forEach((v: any) => {
        if (v.user_id && v.latitude != null && v.longitude != null) {
          vendorGpsMap.set(v.user_id, { lat: Number(v.latitude), lng: Number(v.longitude) });
        }
      });

      // Enrichir les services sans GPS avec les données vendor
      const enrichedServices = professionalServices.map((s: any) => {
        if (s.latitude == null || s.longitude == null) {
          const vendorGps = vendorGpsMap.get(s.user_id);
          if (vendorGps) {
            return { ...s, latitude: vendorGps.lat, longitude: vendorGps.lng };
          }
        }
        return s;
      });

      const newStats: ProximityStats = {
        boutiques: 0,
        taxiMoto: 0,
        livraison: 0,
        beaute: 0,
        restaurant: 0,
        vtc: 0,
        reparation: 0,
        nettoyage: 0,
        mode: 0,
        sante: 0,
        electronique: 0,
        maison: 0,
        immobilier: 0,
        formation: 0,
        media: 0,
        sport: 0,
        informatique: 0,
        agriculture: 0,
        freelance: 0,
        construction: 0,
        plomberie: 0,
        vitrerie: 0,
        menuiserie: 0,
        soudure: 0,
      };

      // Debug counters
      const dbg: ProximityDebugInfo = {
        vendors: { total: vendors.length, noGps: 0, outOfRadius: 0, inRadius: 0 },
        services: { total: enrichedServices.length, noGps: 0, outOfRadius: 0, inRadius: 0 },
        taxiMoto: { total: taxiDrivers.length, noGps: 0, outOfRadius: 0, inRadius: 0 },
        drivers: { total: drivers.length, noGps: 0, outOfRadius: 0, inRadius: 0 },
        positionUsed: { latitude: position.latitude, longitude: position.longitude },
        usingRealGps: usingRealLocation,
      };

      // 1) Boutiques (vendors) — strict GPS + rayon
      vendors.forEach((vendor: any) => {
        const lat = vendor?.latitude;
        const lng = vendor?.longitude;
        if (lat === null || lat === undefined || lng === null || lng === undefined) {
          dbg.vendors.noGps++;
          return;
        }

        const distance = calcDistanceFn(position.latitude, position.longitude, Number(lat), Number(lng));
        if (!Number.isFinite(distance) || distance > RADIUS_KM) {
          dbg.vendors.outOfRadius++;
          return;
        }

        dbg.vendors.inRadius++;
        newStats.boutiques++;
        if (vendor.business_type === 'restaurant' || vendor.service_type === 'restaurant') {
          newStats.restaurant++;
        }
      });

      // Helpers parse point
      const parsePoint = (value: unknown): { lat: number; lng: number } | null => {
        if (!value) return null;
        const s = String(value);
        const match = s.match(/\(([^,]+),([^)]+)\)/);
        if (!match) return null;
        const lng = Number(match[1]);
        const lat = Number(match[2]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
      };

      // 2) Drivers (livraison + vtc) — strict GPS + rayon
      drivers.forEach((driver: any) => {
        const p = parsePoint(driver.current_location);
        if (!p) {
          dbg.drivers.noGps++;
          return;
        }

        const distance = calcDistanceFn(position.latitude, position.longitude, p.lat, p.lng);
        if (!Number.isFinite(distance) || distance > RADIUS_KM) {
          dbg.drivers.outOfRadius++;
          return;
        }

        dbg.drivers.inRadius++;
        if (driver.vehicle_type === 'car') newStats.vtc++;
        newStats.livraison++;
      });

      // 3) Taxi drivers — strict GPS + rayon
      taxiDrivers.forEach((driver: any) => {
        const lat = driver?.last_lat;
        const lng = driver?.last_lng;
        if (lat === null || lat === undefined || lng === null || lng === undefined) {
          dbg.taxiMoto.noGps++;
          return;
        }

        const distance = calcDistanceFn(position.latitude, position.longitude, Number(lat), Number(lng));
        if (!Number.isFinite(distance) || distance > RADIUS_KM) {
          dbg.taxiMoto.outOfRadius++;
          return;
        }

        dbg.taxiMoto.inRadius++;
        newStats.taxiMoto++;
        newStats.livraison++;
      });

      // 4) Services pro — strict GPS + rayon (cohérent avec ServicesProximite.tsx)
      const serviceTypeCounts: Record<string, number> = {};
      enrichedServices.forEach((service: any) => {
        const lat = service?.latitude;
        const lng = service?.longitude;
        const hasGps = lat !== null && lat !== undefined && lng !== null && lng !== undefined;

        if (!hasGps) {
          dbg.services.noGps++;
          return; // ❌ Pas de GPS = pas visible en proximité
        }

        const lat_val = Number(lat);
        const lng_val = Number(lng);
        if (!Number.isFinite(lat_val) || !Number.isFinite(lng_val) || (lat_val === 0 && lng_val === 0)) {
          dbg.services.noGps++;
          return; // ❌ Coordonnées invalides
        }

        const distance = calcDistanceFn(position.latitude, position.longitude, lat_val, lng_val);
        if (!Number.isFinite(distance) || distance > RADIUS_KM) {
          dbg.services.outOfRadius++;
          return; // Hors rayon = exclu
        }

        dbg.services.inRadius++;
        const code = service?.service_types?.code;
        if (code) {
          serviceTypeCounts[code] = (serviceTypeCounts[code] || 0) + 1;
        }
      });

      newStats.beaute = serviceTypeCounts['beaute'] || 0;
      newStats.restaurant += serviceTypeCounts['restaurant'] || 0;
      newStats.reparation = serviceTypeCounts['reparation'] || 0;
      newStats.nettoyage = serviceTypeCounts['menage'] || serviceTypeCounts['nettoyage'] || 0;
      newStats.immobilier = serviceTypeCounts['location'] || serviceTypeCounts['immobilier'] || 0;
      newStats.formation = serviceTypeCounts['education'] || serviceTypeCounts['formation'] || 0;
      newStats.media = serviceTypeCounts['media'] || serviceTypeCounts['photo-video'] || 0;
      newStats.sante = serviceTypeCounts['sante'] || 0;
      newStats.sport = serviceTypeCounts['sport'] || 0;
      // Stats additionnelles
      newStats.informatique = serviceTypeCounts['informatique'] || serviceTypeCounts['tech'] || 0;
      newStats.agriculture = serviceTypeCounts['agriculture'] || 0;
      newStats.freelance = serviceTypeCounts['freelance'] || serviceTypeCounts['administratif'] || 0;
      newStats.construction = serviceTypeCounts['construction'] || serviceTypeCounts['btp'] || 0;
      newStats.plomberie = serviceTypeCounts['plomberie'] || serviceTypeCounts['plombier'] || 0;
      newStats.vitrerie = serviceTypeCounts['vitrerie'] || serviceTypeCounts['vitrier'] || 0;
      newStats.menuiserie = serviceTypeCounts['menuiserie'] || serviceTypeCounts['menuisier'] || 0;
      newStats.soudure = serviceTypeCounts['soudure'] || serviceTypeCounts['metallerie'] || serviceTypeCounts['soudeur'] || 0;

      // 5) Produits (catégories) — inchangé (pas de notion GPS)
      const productCategoryCounts: Record<string, Set<string>> = {};
      products.forEach((product: any) => {
        const categoryName = product?.categories?.name?.toLowerCase?.() || '';
        if (categoryName.includes('mode') || categoryName.includes('vetement') || categoryName.includes('fashion')) {
          productCategoryCounts['mode'] = productCategoryCounts['mode'] || new Set();
          productCategoryCounts['mode'].add(product.id);
        }
        if (
          categoryName.includes('sante') ||
          categoryName.includes('bien-etre') ||
          categoryName.includes('health') ||
          categoryName.includes('beauté')
        ) {
          productCategoryCounts['sante'] = productCategoryCounts['sante'] || new Set();
          productCategoryCounts['sante'].add(product.id);
        }
        if (
          categoryName.includes('electron') ||
          categoryName.includes('tech') ||
          categoryName.includes('phone') ||
          categoryName.includes('high-tech') ||
          categoryName.includes('informatique')
        ) {
          productCategoryCounts['electronique'] = productCategoryCounts['electronique'] || new Set();
          productCategoryCounts['electronique'].add(product.id);
        }
        if (categoryName.includes('maison') || categoryName.includes('déco') || categoryName.includes('home')) {
          productCategoryCounts['maison'] = productCategoryCounts['maison'] || new Set();
          productCategoryCounts['maison'].add(product.id);
        }
      });

      // Stats basées sur les données réelles uniquement (pas de fake stats)
      newStats.mode = productCategoryCounts['mode']?.size || 0;
      newStats.electronique = productCategoryCounts['electronique']?.size || 0;
      newStats.maison = productCategoryCounts['maison']?.size || 0;
      // Note: newStats.sante est déjà défini via les services professionnels

      // Debug log for developers
      console.log('[ProximityStats] Debug info:', dbg);

      setStats(newStats);
      setDebugInfo(dbg);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
    } finally {
      setLoading(false);
    }
  }, [usingRealLocation]);

  // Chargement initial dès que la position est prête (réelle OU fallback) — cohérent avec le reste
  useEffect(() => {
    if (!positionReady) return;
    const origin = userPosition ?? DEFAULT_POSITION;
    void fetchStats(origin);
  }, [positionReady, userPosition, DEFAULT_POSITION, fetchStats]);

  const refresh = useCallback(async () => {
    const pos = await refreshPosition();
    await fetchStats(pos);
  }, [refreshPosition, fetchStats]);

  return {
    stats,
    loading,
    userPosition,
    locationError,
    refresh,
    radiusKm: RADIUS_KM,
    usingRealLocation,
    debugInfo,
  };
}
