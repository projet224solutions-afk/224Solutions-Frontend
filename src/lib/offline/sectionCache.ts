/**
 * sectionCache - Cache de LECTURE hors ligne pour les listes de l'interface vendeur.
 * 224SOLUTIONS - Mode hors ligne
 *
 * But : permettre aux sections qui ne nécessitent PAS de connexion temps réel
 * (produits, commandes, inventaire, fournisseurs, achats…) d'afficher les
 * DERNIÈRES DONNÉES CONNUES quand le vendeur est hors ligne, au lieu d'une
 * liste vide. C'est un cache d'AFFICHAGE (localStorage, synchrone, simple) —
 * distinct du cache opérationnel POS (IndexedDB `catalogCache`/`localStockManager`).
 *
 * Règles :
 * - On n'écrit le cache QUE sur une réponse réseau réussie (jamais d'écriture
 *   d'une liste vide issue d'un échec → on ne détruit pas les données connues).
 * - La lecture est tolérante : clé absente / JSON corrompu → repli silencieux.
 */

const PREFIX = 'vendor_section_cache:';

interface CacheEnvelope<T> {
  ts: number;
  data: T;
}

function keyFor(section: string, scopeId: string): string {
  return `${PREFIX}${section}:${scopeId}`;
}

/**
 * Écrit la liste en cache. Ne fait rien si `data` est vide/nul afin de ne pas
 * écraser des données valides par un résultat d'échec réseau.
 */
export function writeSectionCache<T>(section: string, scopeId: string | null | undefined, data: T[]): void {
  if (!scopeId) return;
  if (!Array.isArray(data) || data.length === 0) return;
  try {
    const envelope: CacheEnvelope<T[]> = { ts: Date.now(), data };
    localStorage.setItem(keyFor(section, scopeId), JSON.stringify(envelope));
  } catch {
    // quota / sérialisation : on ignore, le cache reste optionnel
  }
}

/**
 * Lit la liste en cache. Retourne `null` si rien n'est disponible.
 */
export function readSectionCache<T>(section: string, scopeId: string | null | undefined): T[] | null {
  if (!scopeId) return null;
  try {
    const raw = localStorage.getItem(keyFor(section, scopeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T[]>;
    return Array.isArray(parsed?.data) ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Vrai si l'appareil est actuellement hors ligne (selon le navigateur).
 */
export function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
