import { backendConfig } from '@/config/backend';

/**
 * Décision « pays maison » du marketplace — calculée DE FAÇON AUTORITAIRE par le backend
 * Node.js (résolution pays + comptage produits + seuil). Le front passe juste le pays
 * détecté et applique le résultat. Endpoint public (marketplace accessible aux anonymes).
 */
export interface MarketplaceHomeCountryDecision {
  success: boolean;
  homeCountry: string | null;   // nom du pays résolu (présent chez les vendeurs), ou null
  qualifies: boolean;           // productCount >= threshold → démarrer sur ce pays
  productCount: number;
  threshold: number;
  countries: string[];          // pays disponibles (chips)
}

const HOME_COUNTRY_TIMEOUT_MS = 4500;

const SAFE_FALLBACK: MarketplaceHomeCountryDecision = {
  success: false, homeCountry: null, qualifies: false, productCount: 0, threshold: 30, countries: [],
};

/**
 * Récupère la décision pays maison auprès du backend.
 * `detected` = meilleur signal de pays côté client (profil, pays détecté IP/timezone, cache).
 * En cas d'erreur/timeout : dégradé sûr (pas de pays maison → Mondial).
 */
export async function getMarketplaceHomeCountry(detected: string): Promise<MarketplaceHomeCountryDecision> {
  const baseUrl = backendConfig.baseUrl || '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HOME_COUNTRY_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${baseUrl}/api/v2/marketplace/home-country?detected=${encodeURIComponent(detected || '')}`,
      { method: 'GET', headers: { 'Content-Type': 'application/json' }, signal: controller.signal },
    );
    if (!res.ok) return SAFE_FALLBACK;
    const data = (await res.json()) as Partial<MarketplaceHomeCountryDecision>;
    return {
      success: !!data.success,
      homeCountry: data.homeCountry ?? null,
      qualifies: !!data.qualifies,
      productCount: Number(data.productCount || 0),
      threshold: Number(data.threshold || 30),
      countries: Array.isArray(data.countries) ? data.countries : [],
    };
  } catch {
    return SAFE_FALLBACK;
  } finally {
    clearTimeout(timer);
  }
}
