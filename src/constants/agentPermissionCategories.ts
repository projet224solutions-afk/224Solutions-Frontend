/**
 * Catégories de permissions pour les agents
 * Utilisé pour l'affichage organisé dans l'interface agent et PDG
 */

import { AVAILABLE_PERMISSIONS, PermissionKey } from '@/hooks/useAgentPermissions';

export interface PermissionCategory {
  key: string;
  label: string;
  icon: string;
  colorClass: string;
  bgClass: string;
  permissions: PermissionKey[];
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    key: 'finance',
    label: 'Finance',
    icon: 'DollarSign',
    colorClass: 'text-[#ff4000]',
    bgClass: 'bg-orange-50 border-orange-200',
    permissions: [
      'view_finance',
      'manage_finance',
      'view_banking',
      'manage_banking',
      'manage_wallet_transactions',
      'access_pdg_wallet',
      'view_platform_surveillance',
      'view_financial_module',
      'manage_commissions',
      'view_payments',
      'manage_payments',
    ],
  },
  {
    key: 'gestion',
    label: 'Gestion',
    icon: 'Users',
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-50 border-blue-200',
    permissions: [
      'view_users',
      'manage_users',
      'create_users',
      'view_shareholders',
      'manage_shareholders',
      'view_products',
      'manage_products',
      'view_transfer_fees',
      'manage_transfer_fees',
      'view_kyc',
      'manage_kyc',
      'view_service_subscriptions',
      'manage_service_subscriptions',
      'view_service_plans',
      'manage_service_plans',
    ],
  },
  {
    key: 'services_pro',
    label: 'Services Professionnels',
    icon: 'Store',
    colorClass: 'text-[#ff4000]',
    bgClass: 'bg-orange-50 border-orange-200',
    permissions: [
      'view_beauty_services',
      'manage_beauty_services',
      'view_fitness_services',
      'manage_fitness_services',
      'view_restaurant_services',
      'manage_restaurant_services',
      'view_health_services',
      'manage_health_services',
      'view_education_services',
      'manage_education_services',
      'view_transport_services',
      'manage_transport_services',
      'view_hotel_services',
      'manage_hotel_services',
      'view_event_services',
      'manage_event_services',
      'view_repair_services',
      'manage_repair_services',
      'view_legal_services',
      'manage_legal_services',
      'view_finance_services',
      'manage_finance_services',
      'view_tech_services',
      'manage_tech_services',
      'view_cleaning_services',
      'manage_cleaning_services',
      'view_real_estate_services',
      'manage_real_estate_services',
      'view_agriculture_services',
      'manage_agriculture_services',
    ],
  },
  {
    key: 'operations',
    label: 'Opérations',
    icon: 'Briefcase',
    colorClass: 'text-[#ff4000]',
    bgClass: 'bg-orange-50 border-orange-200',
    permissions: [
      'view_agents',
      'manage_agents',
      'create_sub_agents',
      'view_syndicat',
      'manage_syndicat',
      'view_bureau_monitoring',
      'manage_bureau_monitoring',
      'view_driver_subscriptions',
      'manage_driver_subscriptions',
      'view_stolen_vehicles',
      'manage_stolen_vehicles',
      'view_orders',
      'manage_orders',
      'view_vendors',
      'manage_vendors',
      'view_vendor_kyc',
      'manage_vendor_kyc',
      'view_vendor_certification',
      'manage_vendor_certification',
      'view_drivers',
      'manage_drivers',
      'view_quotes_invoices',
      'manage_quotes_invoices',
      'access_communication',
      'manage_communication',
      'view_broadcasts',
      'manage_broadcasts',
      'view_agent_wallet_audit',
      'manage_agent_wallet_audit',
      'manage_deliveries',
    ],
  },
  {
    key: 'systeme',
    label: 'Système',
    icon: 'Settings',
    colorClass: 'text-[#04439e]',
    bgClass: 'bg-blue-50 border-blue-200',
    permissions: [
      'view_security',
      'manage_security',
      'view_id_normalization',
      'manage_id_normalization',
      'view_bug_bounty',
      'manage_bug_bounty',
      'view_config',
      'manage_config',
      'view_maintenance',
      'manage_maintenance',
      'view_api',
      'manage_api',
      'view_debug',
      'manage_debug',
    ],
  },
  {
    key: 'intelligence',
    label: 'Intelligence / IA',
    icon: 'Brain',
    colorClass: 'text-[#ff4000]',
    bgClass: 'bg-orange-50 border-orange-200',
    permissions: [
      'access_ai_assistant',
      'access_copilot',
      'access_copilot_dashboard',
      'view_copilot_audit',
      'view_reports',
      'manage_reports',
      'view_statistics',
    ],
  },
  {
    key: 'special',
    label: 'Spécial',
    icon: 'Shield',
    colorClass: 'text-[#ff4000]',
    bgClass: 'bg-orange-50 border-orange-200',
    permissions: [
      'manage_sanctions',
      'access_suppliers',
    ],
  },
];

/**
 * Obtient le label d'une permission
 */
export function getPermissionLabel(key: string): string {
  return AVAILABLE_PERMISSIONS[key as PermissionKey] || key.replace(/_/g, ' ');
}

/**
 * Filtre les permissions actives par catégorie
 */
export function getActivePermissionsByCategory(
  permissions: Record<string, boolean>
): { category: PermissionCategory; activePermissions: PermissionKey[] }[] {
  return PERMISSION_CATEGORIES.map((category) => ({
    category,
    activePermissions: category.permissions.filter((perm) => permissions[perm] === true),
  })).filter((item) => item.activePermissions.length > 0);
}

/**
 * Compte le nombre total de permissions actives
 */
export function countActivePermissions(permissions: Record<string, boolean>): number {
  return Object.values(permissions).filter(Boolean).length;
}
