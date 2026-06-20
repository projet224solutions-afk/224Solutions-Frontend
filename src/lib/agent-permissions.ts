/**
 * Logique centralisée des permissions Agent/PDG déléguées.
 *
 * Objectif:
 * - `manage_*` implique automatiquement `view_*`
 * - Certaines permissions avancées satisfont des permissions de base (alias)
 *
 * IMPORTANT: cette logique est purement front (UI gating).
 * Les contrôles RLS/RPC côté DB restent la source de sécurité.
 */

export type PermissionState = Record<string, boolean> | Set<string>;

const withPdgPrefix = (key: string): string => {
  return key.startsWith('pdg_') ? key : `pdg_${key}`;
};

const withoutPdgPrefix = (key: string): string => {
  return key.startsWith('pdg_') ? key.slice(4) : key;
};

export function getPermissionCandidates(key: string): string[] {
  const normalized = key.trim();
  if (!normalized) return [];

  const candidates = new Set<string>();
  const base = withoutPdgPrefix(normalized);

  candidates.add(normalized);
  candidates.add(base);
  candidates.add(withPdgPrefix(base));

  return Array.from(candidates);
}

const hasRaw = (state: PermissionState, key: string): boolean => {
  const candidates = getPermissionCandidates(key);

  if (state instanceof Set) {
    return candidates.some((candidate) => state.has(candidate));
  }

  return candidates.some((candidate) => state[candidate] === true);
};

/**
 * Alias explicites (héritage fonctionnel).
 * NOTE: on ne duplique pas `manage_* => view_*` ici (géré génériquement).
 */
export const PERMISSION_ALIASES: Record<string, string[]> = {
  // Gestion
  view_users: ['manage_users', 'create_users'],
  create_users: ['manage_users'],
  view_kyc: ['manage_kyc', 'manage_vendor_kyc'],
  view_vendor_kyc: ['manage_vendor_kyc', 'manage_kyc'],
  view_products: ['manage_products'],
  view_transfer_fees: ['manage_transfer_fees'],
  view_service_subscriptions: ['manage_service_subscriptions'],
  view_service_plans: ['manage_service_plans', 'manage_service_subscriptions'],

  // Services Professionnels (15 types)
  view_beauty_services: ['manage_beauty_services'],
  view_fitness_services: ['manage_fitness_services'],
  view_restaurant_services: ['manage_restaurant_services'],
  view_health_services: ['manage_health_services'],
  view_education_services: ['manage_education_services'],
  view_transport_services: ['manage_transport_services'],
  view_hotel_services: ['manage_hotel_services'],
  view_event_services: ['manage_event_services'],
  view_repair_services: ['manage_repair_services'],
  view_legal_services: ['manage_legal_services'],
  view_finance_services: ['manage_finance_services'],
  view_tech_services: ['manage_tech_services'],
  view_cleaning_services: ['manage_cleaning_services'],
  view_real_estate_services: ['manage_real_estate_services'],
  view_agriculture_services: ['manage_agriculture_services'],

  // Finance
  view_finance: ['manage_finance'],
  view_banking: ['manage_banking', 'manage_finance'],
  view_payments: ['manage_payments', 'manage_finance'],
  view_financial_module: ['manage_finance', 'view_finance'],
  manage_wallet_transactions: ['manage_finance', 'manage_banking'],

  // Opérations
  view_agents: ['manage_agents'],
  create_sub_agents: ['manage_agents'],
  view_syndicat: ['manage_syndicat'],
  view_bureau_monitoring: ['manage_bureau_monitoring'],
  view_driver_subscriptions: ['manage_driver_subscriptions'],
  view_stolen_vehicles: ['manage_stolen_vehicles'],
  view_orders: ['manage_orders'],
  view_vendors: ['manage_vendors', 'manage_vendor_kyc'],
  view_vendor_certification: ['manage_vendor_certification'],
  view_drivers: ['manage_drivers'],
  view_quotes_invoices: ['manage_quotes_invoices'],
  access_communication: ['manage_communication'],
  view_agent_wallet_audit: ['manage_agent_wallet_audit'],

  // Système
  view_security: ['manage_security'],
  view_id_normalization: ['manage_id_normalization'],
  view_bug_bounty: ['manage_bug_bounty'],
  view_config: ['manage_config'],
  view_maintenance: ['manage_maintenance'],
  view_api: ['manage_api'],
  view_debug: ['manage_debug'],

  // Intelligence
  view_reports: ['manage_reports', 'view_analytics', 'view_finance', 'manage_finance'],
  view_copilot_audit: ['access_copilot'],
  view_analytics: ['manage_analytics', 'view_reports', 'manage_reports'],
};

export function hasPermissionWithAliases(state: PermissionState, key: string): boolean {
  // direct
  if (hasRaw(state, key)) return true;

  // héritage générique: manage_* => view_*
  if (key.startsWith('view_')) {
    const manageKey = key.replace('view_', 'manage_');
    if (hasRaw(state, manageKey)) return true;
  }

  // alias explicites
  const aliases = PERMISSION_ALIASES[key];
  if (aliases && aliases.some((k) => hasRaw(state, k))) return true;

  return false;
}

export function hasAnyPermissionWithAliases(state: PermissionState, keys: string[]): boolean {
  return keys.some((k) => hasPermissionWithAliases(state, k));
}

export function hasAllPermissionsWithAliases(state: PermissionState, keys: string[]): boolean {
  return keys.every((k) => hasPermissionWithAliases(state, k));
}
