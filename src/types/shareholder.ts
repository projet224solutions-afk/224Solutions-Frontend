// ============================================================================
// Types du système de gestion des actionnaires
// ============================================================================

export type ShareholderCategory = 'seller' | 'service' | 'taxi' | 'delivery_driver' | 'digital_vendor';
export type ActionScope = 'country' | 'global';
export type ShareholderStatus = 'active' | 'suspended' | 'archived';
export type PaymentStatus = 'pending' | 'approved' | 'sent_to_wallet' | 'withdrawn' | 'cancelled';
export type VoteType = 'simple' | 'weighted';
export type VoteTarget = 'all' | 'country' | 'global' | 'category' | 'category_country' | 'specific_shareholder';
export type VoteChoice = 'yes' | 'no' | 'abstain';
export type DocumentType =
  | 'shareholder_contract'
  | 'payment_receipt'
  | 'monthly_report'
  | 'financial_report'
  | 'meeting_minutes'
  | 'participation_certificate'
  | 'tax_document'
  | 'other';
export type DocumentVisibility =
  | 'all'
  | 'specific_shareholder'
  | 'country'
  | 'global'
  | 'category'
  | 'category_country';

// Labels pour l'affichage
export const CATEGORY_LABELS: Record<ShareholderCategory, string> = {
  seller:          'Vendeur',
  service:         'Service',
  taxi:            'Taxi',
  delivery_driver: 'Livreur',
  digital_vendor:  'Vendeur Numérique',
};

export const SCOPE_LABELS: Record<ActionScope, string> = {
  country: 'Par pays',
  global:  'Global',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending:         'En attente',
  approved:        'Approuvé',
  sent_to_wallet:  'Envoyé au wallet',
  withdrawn:       'Retiré',
  cancelled:       'Annulé',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending:         'bg-orange-100 text-[#ff4000]',
  approved:        'bg-blue-100 text-blue-800',
  sent_to_wallet:  'bg-orange-100 text-[#ff4000]',
  withdrawn:       'bg-blue-100 text-[#04439e]',
  cancelled:       'bg-orange-100 text-[#ff4000]',
};

export const VOTE_TARGET_LABELS: Record<VoteTarget, string> = {
  all:                  'Tous les actionnaires',
  country:              'Par pays',
  global:               'Global',
  category:             'Par catégorie',
  category_country:     'Catégorie + Pays',
  specific_shareholder: 'Actionnaire spécifique',
};

// ============================================================================
// Entités principales
// ============================================================================

export interface Shareholder {
  id:             string;
  user_id:        string;
  full_name:      string;
  email:          string;
  phone?:         string;
  status:         ShareholderStatus;
  created_by?:    string;
  internal_notes?: string;
  created_at:     string;
  updated_at:     string;
  // Relations jointes
  assignment?:    ShareholderAssignment;
  profile?:       {
    first_name?: string;
    last_name?:  string;
    avatar_url?: string;
    country?:    string;
  };
}

export interface ShareholderAssignment {
  id:             string;
  shareholder_id: string;
  category:       ShareholderCategory;
  action_scope:   ActionScope;
  country?:       string | null;
  percentage:     number;
  status:         ShareholderStatus;
  created_at:     string;
  updated_at:     string;
}

export interface ShareholderRevenue {
  id:                       string;
  shareholder_id:           string;
  assignment_id:            string;
  category:                 ShareholderCategory;
  period_start:             string;
  period_end:               string;
  action_scope:             ActionScope;
  country?:                 string | null;
  paid_subscriptions_count: number;
  free_subscriptions_count: number;
  total_paid_revenue_brut:  number;
  total_agent_commission:   number;
  total_paid_revenue:       number;
  percentage:               number;
  shareholder_amount:       number;
  currency:                 string;
  payment_status:           PaymentStatus;
  notes?:                   string;
  created_at:               string;
  updated_at:               string;
}

export interface ShareholderPayment {
  id:                    string;
  shareholder_id:        string;
  revenue_id:            string;
  wallet_transaction_id?: string;
  amount:                number;
  currency:              string;
  status:                PaymentStatus;
  approved_by?:          string;
  approved_at?:          string;
  sent_to_wallet_at?:    string;
  created_at:            string;
  updated_at:            string;
  // Relations
  revenue?:              ShareholderRevenue;
  shareholder?:          Shareholder;
}

export interface ShareholderDocument {
  id:             string;
  title:          string;
  document_type:  DocumentType;
  file_url?:      string;
  content?:       string;
  visibility:     DocumentVisibility;
  shareholder_id?: string;
  category?:      ShareholderCategory;
  country?:       string;
  uploaded_by?:   string;
  is_public:      boolean;
  created_at:     string;
}

export interface ShareholderVote {
  id:             string;
  title:          string;
  description?:   string;
  start_date:     string;
  end_date:       string;
  vote_type:      VoteType;
  target_type:    VoteTarget;
  category?:      ShareholderCategory;
  country?:       string;
  shareholder_id?: string;
  status:         'draft' | 'open' | 'closed' | 'cancelled';
  created_by?:    string;
  created_at:     string;
  updated_at:     string;
  // Données agrégées
  my_response?:   VoteChoice | null;
  total_yes?:     number;
  total_no?:      number;
  total_abstain?: number;
  total_votes?:   number;
}

export interface ShareholderVoteResponse {
  id:             string;
  vote_id:        string;
  shareholder_id: string;
  choice:         VoteChoice;
  vote_weight:    number;
  created_at:     string;
}

export interface ShareholderAuditLog {
  id:          string;
  actor_id?:   string;
  action:      string;
  entity_type: string;
  entity_id?:  string;
  old_value?:  Record<string, unknown>;
  new_value?:  Record<string, unknown>;
  ip_address?: string;
  created_at:  string;
}

export interface ShareholderMonthlyReport {
  id:             string;
  shareholder_id: string;
  period_start:   string;
  period_end:     string;
  file_url?:      string;
  report_data?:   Record<string, unknown>;
  generated_by?:  string;
  generated_at:   string;
}

// ============================================================================
// DTOs pour les formulaires
// ============================================================================

export interface CreateShareholderDto {
  full_name:          string;
  email:              string;
  phone?:             string;
  temp_password:      string;
  category:           ShareholderCategory;
  action_scope:       ActionScope;
  country?:           string;
  percentage:         number;
  internal_notes?:    string;
  residence_country?: string;
}

export interface UpdateShareholderDto {
  full_name?:       string;
  email?:           string;
  phone?:           string;
  status?:          ShareholderStatus;
  category?:        ShareholderCategory;
  action_scope?:    ActionScope;
  country?:         string | null;
  percentage?:      number;
  internal_notes?:  string;
}

export interface CreateVoteDto {
  title:          string;
  description?:   string;
  start_date:     string;
  end_date:       string;
  vote_type:      VoteType;
  target_type:    VoteTarget;
  category?:      ShareholderCategory;
  country?:       string;
  shareholder_id?: string;
}

export interface CreateDocumentDto {
  title:          string;
  document_type:  DocumentType;
  file_url?:      string;
  content?:       string;
  visibility:     DocumentVisibility;
  shareholder_id?: string;
  category?:      ShareholderCategory;
  country?:       string;
}

// ============================================================================
// Données du dashboard
// ============================================================================

export interface ShareholderDashboardData {
  shareholder:          Shareholder;
  assignment:           ShareholderAssignment;
  total_revenues:       number;
  total_earnings:       number;
  pending_payments:     number;
  received_payments:    number;
  unread_notifications: number;
  open_votes:           number;
  wallet_balance:       number;
  recent_revenues?:     ShareholderRevenue[];
}

export interface PDGShareholderStats {
  total_shareholders:   number;
  active_shareholders:  number;
  suspended_shareholders: number;
  total_assignments:    number;
  total_all_revenues:   number;
  total_all_earnings:   number;
  pending_payments:     number;
  sent_payments:        number;
}

export interface PercentageInfo {
  valid:     boolean;
  current:   number;
  remaining: number;
  requested: number;
  message?:  string;
}

export interface PercentageSummary {
  category:                  ShareholderCategory;
  action_scope:              ActionScope;
  country?:                  string | null;
  used_percentage:           number;
  remaining_percentage:      number;
  active_shareholders_count: number;
}

// Calcul de revenu (retour de la fonction RPC)
export interface RevenueCalculationResult {
  assignment_id:            string;
  shareholder_id:           string;
  category:                 ShareholderCategory;
  action_scope:             ActionScope;
  country?:                 string | null;
  paid_subscriptions_count: number;
  free_subscriptions_count: number;
  // Montant brut encaissé (avant déduction des commissions agents)
  total_paid_revenue_brut?: number;
  // Total des commissions agents déduites du brut
  total_agent_commission?:  number;
  // Montant NET = brut - commissions agents (base du calcul actionnaire)
  total_paid_revenue:       number;
  percentage:               number;
  shareholder_amount:       number;
  currency:                 string;
  period_start:             string;
  period_end:               string;
  error?:                   string;
}
