/**
 * 224Guard — traduction À L'AFFICHAGE des libellés d'alerte.
 *
 * Principe : la couche de détection (Lot A/B) reste PURE — elle ne dépend ni de React ni
 * de l'i18n. Elle produit un `patternKey` STABLE (identifiant technique) + un libellé
 * français de repli stocké en base. Ici, côté dashboard, on traduit par `patternKey`.
 * Repli gracieux : libellé FR stocké → patternKey. Jamais de chaîne vide.
 */

type TFn = (key: string) => string;

/** patternKey (stable, jamais traduit) → clé i18n du libellé. */
const PATTERN_I18N: Record<string, string> = {
  // Motifs critiques (patterns.ts)
  'crypto.private_key': 'guard224.label.cryptoPrivateKey',
  'stripe.secret': 'guard224.label.stripeSecret',
  'aws.access_key': 'guard224.label.awsAccessKey',
  'github.token': 'guard224.label.githubToken',
  'slack.token': 'guard224.label.slackToken',
  'redis.url': 'guard224.label.redisUrl',
  'gcp.service_account': 'guard224.label.gcpServiceAccount',
  'server.secret_assignment': 'guard224.label.serverSecret',
  'twilio.account_sid': 'guard224.label.twilioAccountSid',
  // Motifs publics par conception (patterns.ts)
  'firebase.api_key': 'guard224.label.firebaseApiKey',
  'stripe.publishable': 'guard224.label.stripePublishable',
  'mapbox.public': 'guard224.label.mapboxPublic',
  // Détections dynamiques (PatternMatcher / AlertManager)
  'supabase.service_role': 'guard224.label.supabaseServiceRole',
  'entropy.generic': 'guard224.label.entropyGeneric',
  'system.flood': 'guard224.label.flood',
  // Alertes système (résilience — Lot B)
  'network.tamper': 'guard224.label.networkTamper',
};

const HEALTH_PREFIX = 'health.';

/**
 * Traduit le libellé d'une alerte 224Guard à partir de son `patternKey` stable.
 * @param fallback libellé FR stocké en base (repli si la clé i18n est absente).
 */
export function translateGuardLabel(
  t: TFn,
  patternKey: string | null | undefined,
  fallback?: string | null,
): string {
  if (!patternKey) return fallback || '';

  // health.<composant> : motif dynamique (un par composant surveillé) → libellé + nom.
  if (patternKey.startsWith(HEALTH_PREFIX)) {
    return `${t('guard224.label.healthDegraded')} : ${patternKey.slice(HEALTH_PREFIX.length)}`;
  }

  const i18nKey = PATTERN_I18N[patternKey];
  if (i18nKey) {
    const translated = t(i18nKey);
    // t() renvoie la clé elle-même si absente du dictionnaire → on retombe sur le repli FR.
    if (translated && translated !== i18nKey) return translated;
  }
  return fallback || patternKey;
}
