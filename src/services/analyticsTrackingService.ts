/**
 * Service de tracking analytics avec géolocalisation IP automatique
 * Enregistre les vues de produits et visites de boutiques
 */

import { supabase } from '@/integrations/supabase/client';
import { getSafeBrowserGeo } from '@/lib/safeGeo';
import { publishLiveEvent, vendorAnalyticsTopic, platformAnalyticsTopic } from '@/lib/realtime/liveEvents';

interface GeoData {
  country: string;
  city: string;
  ip: string;
}

// Cache de géolocalisation pour éviter les appels répétés
let geoCache: GeoData | null = null;
let geoCacheTimestamp: number = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Génère un hash d'empreinte digitale simple basé sur le navigateur
 */
function generateFingerprintHash(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset().toString(),
    navigator.hardwareConcurrency?.toString() || '',
    navigator.platform || ''
  ];

  const fingerprint = components.join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * Détecte automatiquement le pays et la ville via IP
 */
async function detectGeoLocation(): Promise<GeoData> {
  // Utiliser le cache s'il est valide
  if (geoCache && Date.now() - geoCacheTimestamp < CACHE_DURATION) {
    return geoCache;
  }

  try {
    const data = getSafeBrowserGeo();

    geoCache = {
      country: data.countryCode || 'GN',
      city: data.city || 'Conakry',
      ip: data.ip || '0.0.0.0'
    };
    geoCacheTimestamp = Date.now();

    return geoCache;
  } catch (error) {
    console.warn('⚠️ Géolocalisation échouée, utilisation de valeurs par défaut:', error);
    return {
      country: 'GN',
      city: 'Conakry',
      ip: '0.0.0.0'
    };
  }
}

/**
 * Détecte le type d'appareil
 */
function detectDeviceType(): string {
  const userAgent = navigator.userAgent.toLowerCase();

  if (/tablet|ipad|playbook|silk/.test(userAgent)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/.test(userAgent)) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * Génère un identifiant de session unique
 */
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Enregistre une vue de produit
 */
export async function trackProductView(
  productId: string,
  vendorId: string,
  options?: {
    source?: string;
    referrer?: string;
  }
): Promise<void> {
  try {
    // Récupérer les données de géolocalisation en parallèle avec l'ID utilisateur
    const [geoData, authResult] = await Promise.all([
      detectGeoLocation(),
      supabase.auth.getUser()
    ]);

    const userId = authResult.data?.user?.id || null;
    const sessionId = getSessionId();
    const deviceType = detectDeviceType();
    const fingerprintHash = generateFingerprintHash();

    const { error } = await supabase
      .from('product_views_raw')
      .insert({
        product_id: productId,
        vendor_id: vendorId,
        user_id: userId,
        session_id: sessionId,
        device_type: deviceType,
        country_code: geoData.country,
        city: geoData.city,
        ip_address: geoData.ip,
        fingerprint_hash: fingerprintHash,
        user_agent: navigator.userAgent,
        referer_url: options?.referrer || document.referrer || null
      });

    if (error) {
      console.error('❌ Erreur tracking vue produit:', error);
    } else {
      console.log('✅ Vue produit enregistrée:', { productId, country: geoData.country, city: geoData.city });
      // 📊 TEMPS RÉEL (Ably/broadcast) : diffuse l'événement pour les dashboards live,
      // À CÔTÉ de la persistance Supabase ci-dessus. Best-effort → n'impacte pas l'écriture.
      const evt = { type: 'product_view', productId, vendorId, country: geoData.country, city: geoData.city, at: new Date().toISOString() };
      publishLiveEvent(vendorAnalyticsTopic(vendorId), 'product_view', evt);
      publishLiveEvent(platformAnalyticsTopic(), 'product_view', evt);
    }
  } catch (error) {
    console.error('❌ Exception tracking vue produit:', error);
  }
}

/**
 * Enregistre une visite de boutique
 */
export async function trackShopVisit(
  vendorId: string,
  options?: {
    source?: string;
    referrer?: string;
    entryPage?: string;
  }
): Promise<void> {
  try {
    // Récupérer les données de géolocalisation en parallèle avec l'ID utilisateur
    const [geoData, authResult] = await Promise.all([
      detectGeoLocation(),
      supabase.auth.getUser()
    ]);

    const userId = authResult.data?.user?.id || null;
    const sessionId = getSessionId();
    const deviceType = detectDeviceType();
    const fingerprintHash = generateFingerprintHash();

    const { error } = await supabase
      .from('shop_visits_raw')
      .insert({
        vendor_id: vendorId,
        user_id: userId,
        session_id: sessionId,
        device_type: deviceType,
        country_code: geoData.country,
        city: geoData.city,
        ip_address: geoData.ip,
        fingerprint_hash: fingerprintHash,
        user_agent: navigator.userAgent,
        referer_url: options?.referrer || document.referrer || null,
        entry_page: options?.entryPage || window.location.pathname
      });

    if (error) {
      // Ignorer les doublons (visite déjà enregistrée)
      if (error.code === '23505') {
        console.log('ℹ️ Visite boutique déjà enregistrée (doublon ignoré)');
      } else {
        console.error('❌ Erreur tracking visite boutique:', error);
      }
    } else {
      console.log('✅ Visite boutique enregistrée:', { vendorId, country: geoData.country, city: geoData.city });
      // 📊 TEMPS RÉEL (Ably/broadcast) pour dashboards live, à côté de la persistance Supabase.
      const evt = { type: 'shop_visit', vendorId, country: geoData.country, city: geoData.city, at: new Date().toISOString() };
      publishLiveEvent(vendorAnalyticsTopic(vendorId), 'shop_visit', evt);
      publishLiveEvent(platformAnalyticsTopic(), 'shop_visit', evt);
    }
  } catch (error) {
    console.error('❌ Exception tracking visite boutique:', error);
  }
}

/**
 * Force le rafraîchissement du cache de géolocalisation
 */
export function clearGeoCache(): void {
  geoCache = null;
  geoCacheTimestamp = 0;
}
