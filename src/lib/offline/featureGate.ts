/**
 * Feature Gate - Contrôle d'accès aux fonctionnalités basé sur le statut online/offline
 * 224SOLUTIONS - Mode Offline Avancé
 *
 * Ce module gère les permissions d'accès aux fonctionnalités en mode hors ligne.
 * RÈGLE: Certaines fonctionnalités sont strictement interdites en mode offline.
 */

/**
 * Liste des fonctionnalités désactivées en mode hors ligne
 */
export const OFFLINE_DISABLED_FEATURES = [
  // Commandes et achats en ligne
  'online_orders',          // Commandes clients en ligne
  'online_purchases',       // Achats fournisseurs en ligne
  'cart_checkout',         // Validation panier (nécessite paiement en ligne)

  // Intelligence artificielle
  'copilot',               // Assistant IA
  'ai_chat',               // Chat avec IA
  'ai_recommendations',    // Recommandations IA

  // Communication temps réel
  'messaging',             // Messagerie
  'chat',                  // Chat en direct
  'notifications',         // Notifications temps réel
  'realtime_updates',      // Mises à jour temps réel

  // Transactions financières en ligne
  'bank_transfers',        // Virements bancaires
  'mobile_money_send',     // Envoi mobile money
  'card_payment',          // Paiement par carte
  'commission_withdraw',   // Retrait commissions
  'balance_transfer',      // Transfert de solde

  // Fonctionnalités collaboratives
  'live_collaboration',    // Collaboration en direct
  'shared_editing',        // Édition partagée
  'video_call',           // Appels vidéo
  'voice_call',           // Appels vocaux

  // Fonctionnalités cloud
  'cloud_sync',           // Sync cloud temps réel (géré par le système de sync)
  'cloud_backup',         // Backup cloud
  'remote_config',        // Configuration à distance
] as const;

/**
 * Liste des fonctionnalités autorisées en mode hors ligne
 */
export const OFFLINE_ENABLED_FEATURES = [
  // Système POS
  'pos_sales',            // Ventes POS
  'pos_cash_payment',     // Paiement en espèces
  'pos_ussd_payment',     // Paiement USSD (codes générés localement)
  'pos_qr_payment',       // Paiement QR local (différé)
  'pos_receipt',          // Génération reçus
  'pos_history',          // Historique ventes

  // Gestion stock
  'stock_view',           // Consultation stock
  'stock_adjust',         // Ajustement stock
  'stock_alerts',         // Alertes stock bas (locales)
  'product_search',       // Recherche produits

  // Catalogue
  'catalog_view',         // Consultation catalogue
  'catalog_search',       // Recherche catalogue
  'product_details',      // Détails produits

  // Gestion locale
  'local_settings',       // Paramètres locaux
  'offline_auth',         // Authentification offline (PIN/biométrie)
  'local_backup',         // Backup local
  'print_bluetooth',      // Impression Bluetooth

  // Consultation données
  'view_orders',          // Voir commandes (données locales)
  'view_customers',       // Voir clients (données locales)
  'view_reports',         // Voir rapports (données locales)
] as const;

export type OfflineDisabledFeature = typeof OFFLINE_DISABLED_FEATURES[number];
export type OfflineEnabledFeature = typeof OFFLINE_ENABLED_FEATURES[number];
export type Feature = OfflineDisabledFeature | OfflineEnabledFeature | string;

/**
 * Raison du blocage d'une fonctionnalité
 */
export interface FeatureBlockReason {
  code: string;
  message: string;
  action?: string;
}

/**
 * Résultat de la vérification d'accès à une fonctionnalité
 */
export interface FeatureAccessResult {
  isAllowed: boolean;
  reason: FeatureBlockReason | null;
  requiresOnline: boolean;
}

/**
 * Messages d'erreur pour les fonctionnalités bloquées
 */
const FEATURE_BLOCK_MESSAGES: Record<string, FeatureBlockReason> = {
  online_orders: {
    code: 'REQUIRES_ONLINE',
    message: 'Les commandes en ligne nécessitent une connexion internet',
    action: 'Veuillez vous connecter pour passer une commande en ligne'
  },
  copilot: {
    code: 'REQUIRES_ONLINE',
    message: 'L\'assistant IA nécessite une connexion internet',
    action: 'Reconnectez-vous pour utiliser l\'assistant IA'
  },
  messaging: {
    code: 'REQUIRES_ONLINE',
    message: 'La messagerie nécessite une connexion internet',
    action: 'Reconnectez-vous pour envoyer des messages'
  },
  notifications: {
    code: 'REQUIRES_ONLINE',
    message: 'Les notifications temps réel nécessitent une connexion',
    action: 'Les notifications seront affichées une fois connecté'
  },
  bank_transfers: {
    code: 'REQUIRES_ONLINE',
    message: 'Les virements bancaires nécessitent une connexion sécurisée',
    action: 'Reconnectez-vous pour effectuer un virement'
  },
  mobile_money_send: {
    code: 'REQUIRES_ONLINE',
    message: 'L\'envoi de mobile money nécessite une connexion',
    action: 'Reconnectez-vous pour envoyer de l\'argent'
  },
  commission_withdraw: {
    code: 'REQUIRES_ONLINE',
    message: 'Le retrait de commissions nécessite une connexion sécurisée',
    action: 'Reconnectez-vous pour retirer vos commissions'
  },
  default: {
    code: 'REQUIRES_ONLINE',
    message: 'Cette fonctionnalité nécessite une connexion internet',
    action: 'Veuillez vous reconnecter pour continuer'
  }
};

/**
 * Vérifie si une fonctionnalité est accessible en mode offline
 *
 * @param feature - Nom de la fonctionnalité à vérifier
 * @param isOnline - Statut de connexion actuel
 * @returns Résultat de la vérification avec raison du blocage si applicable
 *
 * @example
 * const { isAllowed, reason } = checkFeatureAccess('messaging', false);
 * if (!isAllowed) {
 *   toast.error(reason.message, { action: reason.action });
 * }
 */
export function checkFeatureAccess(
  feature: Feature,
  isOnline: boolean
): FeatureAccessResult {
  // Si en ligne, tout est autorisé
  if (isOnline) {
    return {
      isAllowed: true,
      reason: null,
      requiresOnline: false
    };
  }

  // Si hors ligne, vérifier si la fonctionnalité est interdite
  const isDisabled = OFFLINE_DISABLED_FEATURES.includes(feature as OfflineDisabledFeature);

  if (isDisabled) {
    const blockReason = FEATURE_BLOCK_MESSAGES[feature] || FEATURE_BLOCK_MESSAGES.default;
    return {
      isAllowed: false,
      reason: blockReason,
      requiresOnline: true
    };
  }

  // Fonctionnalité autorisée en mode offline
  return {
    isAllowed: true,
    reason: null,
    requiresOnline: false
  };
}

/**
 * Vérifie si une fonctionnalité nécessite une connexion
 *
 * @param feature - Nom de la fonctionnalité
 * @returns true si la fonctionnalité nécessite une connexion
 */
export function requiresOnlineConnection(feature: Feature): boolean {
  return OFFLINE_DISABLED_FEATURES.includes(feature as OfflineDisabledFeature);
}

/**
 * Vérifie si une fonctionnalité est autorisée en mode offline
 *
 * @param feature - Nom de la fonctionnalité
 * @returns true si la fonctionnalité fonctionne en mode offline
 */
export function isOfflineEnabled(feature: Feature): boolean {
  return OFFLINE_ENABLED_FEATURES.includes(feature as OfflineEnabledFeature) ||
    !OFFLINE_DISABLED_FEATURES.includes(feature as OfflineDisabledFeature);
}

/**
 * Obtient la liste de toutes les fonctionnalités désactivées en mode offline
 *
 * @returns Liste des fonctionnalités désactivées
 */
export function getDisabledFeatures(): readonly OfflineDisabledFeature[] {
  return OFFLINE_DISABLED_FEATURES;
}

/**
 * Obtient la liste de toutes les fonctionnalités autorisées en mode offline
 *
 * @returns Liste des fonctionnalités autorisées
 */
export function getEnabledFeatures(): readonly OfflineEnabledFeature[] {
  return OFFLINE_ENABLED_FEATURES;
}

/**
 * Filtre une liste d'éléments basée sur l'accessibilité des fonctionnalités
 * Utile pour désactiver des boutons, menus, etc. en mode offline
 *
 * @param items - Liste d'éléments avec leur fonctionnalité associée
 * @param isOnline - Statut de connexion
 * @returns Liste filtrée des éléments accessibles
 *
 * @example
 * const menuItems = [
 *   { label: 'Commandes', feature: 'online_orders' },
 *   { label: 'POS', feature: 'pos_sales' }
 * ];
 * const visibleItems = filterByFeatureAccess(menuItems, isOnline);
 */
export function filterByFeatureAccess<T extends { feature: Feature }>(
  items: T[],
  isOnline: boolean
): T[] {
  return items.filter(item => {
    const { isAllowed } = checkFeatureAccess(item.feature, isOnline);
    return isAllowed;
  });
}

/**
 * Décore des éléments avec leur statut d'accessibilité
 * Utile pour afficher des badges "Nécessite connexion" sur des boutons
 *
 * @param items - Liste d'éléments
 * @param isOnline - Statut de connexion
 * @returns Liste avec informations d'accessibilité
 *
 * @example
 * const decoratedItems = decorateWithAccessInfo(menuItems, isOnline);
 * // Render with badge if !item.isAllowed
 */
export function decorateWithAccessInfo<T extends { feature: Feature }>(
  items: T[],
  isOnline: boolean
): Array<T & FeatureAccessResult> {
  return items.map(item => ({
    ...item,
    ...checkFeatureAccess(item.feature, isOnline)
  }));
}

export default {
  checkFeatureAccess,
  requiresOnlineConnection,
  isOfflineEnabled,
  getDisabledFeatures,
  getEnabledFeatures,
  filterByFeatureAccess,
  decorateWithAccessInfo
};
