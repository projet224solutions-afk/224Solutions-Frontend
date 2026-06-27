/**
 * Géocode les villes ABSENTES de public.city_coordinates via Nominatim (OSM).
 * Fallback du niveau 1 (table de référence) : pour les villes que la table ne
 * couvre pas et qu'on ne veut pas saisir à la main.
 *
 * Usage   : node scripts/geocode_missing_cities.mjs
 * Pré-requis (env) : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Après exécution, relancer le backfill (RPC backfill_services_geolocation ou
 * bouton PDG) pour appliquer les nouvelles coordonnées aux services.
 *
 * Nominatim : gratuit, exige un User-Agent identifiant + MAX 1 requête/seconde.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans l\'env.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocodeCity(cityName, countryHint = 'Guinea') {
  const q = encodeURIComponent(`${cityName}, ${countryHint}`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': '224Solutions-Geocoder/1.0 (contact@224solution.net)' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const lat = parseFloat(data[0].lat);
  const lng = parseFloat(data[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

// Doit refléter public.normalize_city_key (minuscule + sans accent + espaces collapsés)
function normalizeKey(s) {
  return (s || '')
    .normalize('NFD')
    .replace(new RegExp('[̀-ͯ]', 'g'), '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

async function main() {
  const { data: cities, error } = await supabase.rpc('list_ungeocoded_cities');
  if (error) {
    console.error('❌ list_ungeocoded_cities:', error.message);
    process.exit(1);
  }
  if (!cities?.length) {
    console.log('✓ Aucune ville à géocoder.');
    return;
  }

  console.log(`${cities.length} ville(s) à géocoder via Nominatim...`);
  let ok = 0;
  let ko = 0;
  for (const c of cities) {
    const coords = await geocodeCity(c.city_raw);
    if (coords) {
      const { error: upErr } = await supabase.from('city_coordinates').upsert(
        {
          city_key: normalizeKey(c.city_raw),
          city_label: c.city_raw,
          latitude: coords.lat,
          longitude: coords.lng,
        },
        { onConflict: 'city_key' },
      );
      if (upErr) {
        console.log(`✗ ${c.city_raw} (upsert échoué: ${upErr.message})`);
        ko++;
      } else {
        console.log(`✓ ${c.city_raw} → ${coords.lat}, ${coords.lng}`);
        ok++;
      }
    } else {
      console.log(`✗ ${c.city_raw} (introuvable)`);
      ko++;
    }
    await sleep(1100); // respecter la limite Nominatim (1 req/s)
  }

  console.log(`\nTerminé : ${ok} ajoutée(s), ${ko} échec(s).`);
  console.log('→ Relancer backfill_services_geolocation() pour appliquer aux services.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
