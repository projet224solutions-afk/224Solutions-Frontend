/**
 * Résolution ville → coordonnées GPS côté client.
 *
 * Beaucoup de services/boutiques n'ont pas de position GPS précise mais ont une
 * VILLE (ex. « Conakry », « coyah »). Sans coordonnées, le filtre de proximité
 * 20 km les écarte alors qu'ils sont dans la ville de l'utilisateur. Ce helper
 * comble le manque en lisant la table de référence `city_coordinates` (même
 * source que le backfill serveur `backfill_services_geolocation`) et en
 * approximant la position au centre-ville. Une position GPS précise existante
 * est TOUJOURS prioritaire (on ne remplace que les coordonnées absentes).
 *
 * La table est lue UNE seule fois (promesse mémoïsée, partagée entre composants).
 */
import { supabase } from '@/integrations/supabase/client';

export interface LatLng { lat: number; lng: number }

/**
 * Zone de service (Afrique de l'Ouest élargie : Guinée + voisins). Sert à
 * rejeter les coordonnées aberrantes — ex. une géolocalisation desktop/IP qui
 * place un vendeur dans l'océan Atlantique (-37,-56) ou sur un autre continent.
 * Couvre Conakry, Dakar, Bamako, Abidjan, Lagos, Niamey, etc.
 */
export const SERVICE_REGION = { latMin: -5, latMax: 22, lngMin: -20, lngMax: 12 };

export function isInServiceRegion(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= SERVICE_REGION.latMin && lat <= SERVICE_REGION.latMax &&
    lng >= SERVICE_REGION.lngMin && lng <= SERVICE_REGION.lngMax
  );
}

/**
 * Doit refléter public.normalize_city_key (SQL) : minuscule + sans accent +
 * espaces collapsés. Garantit que « Conakry », « conakry », «  CONAKRY  »
 * matchent tous la clé « conakry ».
 */
export function normalizeCityKey(city?: string | null): string {
  return (city || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

let cachePromise: Promise<Map<string, LatLng>> | null = null;

/** Charge (et mémoïse) la table city_coordinates en Map<city_key, LatLng>. */
export function getCityCoordinates(): Promise<Map<string, LatLng>> {
  if (!cachePromise) {
    cachePromise = (async () => {
      const map = new Map<string, LatLng>();
      try {
        const { data } = await supabase
          .from('city_coordinates')
          .select('city_key, latitude, longitude');
        (data || []).forEach((r: any) => {
          const lat = Number(r.latitude);
          const lng = Number(r.longitude);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            map.set(String(r.city_key), { lat, lng });
          }
        });
      } catch {
        // Table absente / non lisible → map vide : comportement strictement
        // inchangé (les items sans GPS restent simplement non géolocalisés).
      }
      return map;
    })();
  }
  return cachePromise;
}

/**
 * Coordonnées effectives d'un item : sa position GPS précise si elle existe et
 * est valide, sinon le centre-ville de sa `city` (via city_coordinates). null si
 * aucune des deux n'est disponible.
 */
export function resolveItemCoords(
  item: { latitude?: number | null; longitude?: number | null; city?: string | null },
  cityMap: Map<string, LatLng>,
): LatLng | null {
  const lat = Number(item.latitude);
  const lng = Number(item.longitude);
  const hasValidGps =
    item.latitude != null && item.longitude != null &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    isInServiceRegion(lat, lng); // rejette les coords aberrantes → repli ville
  if (hasValidGps) return { lat, lng };

  const norm = normalizeCityKey(item.city);
  if (norm) {
    // 1) Match exact ("conakry", "coyah"…)
    const exact = cityMap.get(norm);
    if (exact) return exact;

    // 2) Match flou : la ville saisie CONTIENT le nom d'une ville connue, en
    //    mots entiers ("prefecture de coyah", "coyah centre", "fily, coyah
    //    centre" → coyah). Indispensable car les vendeurs saisissent une ville
    //    libre (préfecture, quartier…) et sont créés SANS GPS. On retient la
    //    clé la plus longue présente (évite les faux positifs).
    const words = new Set(norm.split(' ').filter(Boolean));
    let best: LatLng | null = null;
    let bestLen = 0;
    for (const [key, coords] of cityMap) {
      const keyWords = key.split(' ');
      const allPresent = keyWords.every((w) => words.has(w));
      if (allPresent && key.length > bestLen) {
        best = coords;
        bestLen = key.length;
      }
    }
    if (best) return best;
  }
  return null;
}
