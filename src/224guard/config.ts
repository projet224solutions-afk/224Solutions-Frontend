/**
 * 224Guard — configuration centrale (seuils, budgets, feature-detect).
 * Toutes les constantes de tuning sont ici. Les valeurs sont issues de
 * GUARD224_LOGIC_AUDIT.md (§1.1 Q4/Q5, §1.2).
 */

export const GUARD_CONFIG = {
  /** Entropie de Shannon : seuils de détection d'un secret « sans format connu ». */
  entropy: {
    /** bits/char au-delà duquel une chaîne est « suspecte » (texte normal ≈ 3-4). */
    minBitsPerChar: 4.0,
    /** longueur minimale pour considérer une chaîne comme un secret potentiel. */
    minLength: 24,
  },

  /** Déduplication : fenêtre glissante (ms) pour ne pas ré-émettre la même alerte. */
  dedup: {
    windowMs: 5 * 60_000,
  },

  /** Rate-limiting des alertes (anti-flood / anti-pollution, cf. attaque #5). */
  rateLimit: {
    /** alertes max par source et par fenêtre avant de coalescer en méta-alerte. */
    maxPerSourcePerWindow: 30,
    windowMs: 60_000,
  },

  /** File d'attente résiliente. */
  queue: {
    maxSize: 500,
    maxRetries: 5,
    /** délai de base du backoff exponentiel (ms) : delay = base * 2^retry. */
    backoffBaseMs: 1_000,
    /** nom du store de persistance (IndexedDB). */
    storeName: '224guard_alerts',
  },

  /** Scoring de confiance : pondérations (somme = 1) — cf. ConfidenceScorer. */
  scoreWeights: {
    regex: 0.45,
    entropy: 0.2,
    context: 0.2,
    behavior: 0.05,
    historical: 0.1,
  },

  /** Seuil de score final (0-1) à partir duquel une alerte est émise. */
  emitThreshold: 0.5,

  /**
   * Allowlist adaptative : l'apprentissage des faux positifs ne peut JAMAIS réduire
   * le score de plus de ce facteur, et JAMAIS sur un motif critique (cf. attaque #6).
   */
  allowlist: {
    maxScoreReduction: 0.4,
    minFalsePositivesToAdjust: 5,
  },
} as const;

/** Feature-detection : 224Guard se dégrade gracieusement si une API manque. */
export const ENV_CAPS = {
  hasIndexedDB: typeof globalThis !== 'undefined' && typeof (globalThis as any).indexedDB !== 'undefined',
  hasSubtleCrypto:
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as any).crypto !== 'undefined' &&
    typeof (globalThis as any).crypto?.subtle !== 'undefined',
  hasMutationObserver: typeof globalThis !== 'undefined' && typeof (globalThis as any).MutationObserver !== 'undefined',
  hasBroadcastChannel: typeof globalThis !== 'undefined' && typeof (globalThis as any).BroadcastChannel !== 'undefined',
} as const;
