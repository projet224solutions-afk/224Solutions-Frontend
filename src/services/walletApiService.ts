import { supabase } from '@/lib/supabaseClient';

export interface WalletApiRequest {
  id: string;
  user_id: string;
  professional_service_id: string;
  business_name: string;
  website_url: string | null;
  use_case: string;
  expected_volume: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  professional_services?: {
    business_name: string;
    service_type_id: string;
  };
}

export interface WalletApiKey {
  id: string;
  request_id: string;
  user_id: string;
  professional_service_id: string;
  api_key: string;
  api_secret: string;
  key_name: string;
  is_active: boolean;
  is_test_mode: boolean;
  allowed_domains: string[];
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  commission_rate: number;
  total_transactions: number;
  total_volume_gnf: number;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface WalletApiTransaction {
  id: string;
  api_key_id: string;
  professional_service_id: string;
  payer_identifier: string;
  amount_gnf: number;
  commission_gnf: number;
  net_amount_gnf: number;
  currency: string;
  status: string;
  payment_reference: string | null;
  description: string | null;
  completed_at: string | null;
  created_at: string;
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'wk_live_';
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

function generateApiSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let secret = 'ws_';
  for (let i = 0; i < 48; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}

export class WalletApiService {
  // ========== PRESTATAIRE ==========

  /** Soumettre une demande d'accès API */
  static async submitRequest(params: {
    userId: string;
    serviceId: string;
    businessName: string;
    websiteUrl?: string;
    useCase: string;
    expectedVolume?: string;
  }): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('wallet_api_requests')
        .insert({
          user_id: params.userId,
          professional_service_id: params.serviceId,
          business_name: params.businessName,
          website_url: params.websiteUrl || null,
          use_case: params.useCase,
          expected_volume: params.expectedVolume || null,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('❌ Erreur soumission demande API:', error);
      return null;
    }
  }

  /** Récupérer la demande du prestataire */
  static async getMyRequest(serviceId: string): Promise<WalletApiRequest | null> {
    try {
      const { data, error } = await supabase
        .from('wallet_api_requests')
        .select('*')
        .eq('professional_service_id', serviceId)
        .maybeSingle();

      if (error) throw error;
      return data as WalletApiRequest | null;
    } catch (error) {
      console.error('❌ Erreur récupération demande API:', error);
      return null;
    }
  }

  /** Récupérer les clés API du prestataire */
  static async getMyKeys(serviceId: string): Promise<WalletApiKey[]> {
    try {
      const { data, error } = await supabase
        .from('wallet_api_keys')
        .select('*')
        .eq('professional_service_id', serviceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as WalletApiKey[];
    } catch (error) {
      console.error('❌ Erreur récupération clés API:', error);
      return [];
    }
  }

  /** Récupérer les transactions du prestataire */
  static async getMyTransactions(serviceId: string, limit = 50): Promise<WalletApiTransaction[]> {
    try {
      const { data, error } = await supabase
        .from('wallet_api_transactions')
        .select('*')
        .eq('professional_service_id', serviceId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as WalletApiTransaction[];
    } catch (error) {
      console.error('❌ Erreur récupération transactions API:', error);
      return [];
    }
  }

  /** Activer/désactiver une clé */
  static async toggleKey(keyId: string, isActive: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('wallet_api_keys')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', keyId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('❌ Erreur toggle clé API:', error);
      return false;
    }
  }

  /** Basculer mode test/production */
  static async toggleTestMode(keyId: string, isTestMode: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('wallet_api_keys')
        .update({ is_test_mode: isTestMode, updated_at: new Date().toISOString() })
        .eq('id', keyId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('❌ Erreur toggle mode test:', error);
      return false;
    }
  }

  // ========== PDG ==========

  /** Récupérer toutes les demandes */
  static async getAllRequests(status?: string): Promise<WalletApiRequest[]> {
    try {
      let query = supabase
        .from('wallet_api_requests')
        .select('*, professional_services(business_name, service_type_id)')
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as WalletApiRequest[];
    } catch (error) {
      console.error('❌ Erreur récupération demandes API:', error);
      return [];
    }
  }

  /** Approuver une demande et générer les clés */
  static async approveRequest(requestId: string, adminUserId: string, commissionRate = 2.5): Promise<boolean> {
    try {
      // 1. Récupérer la demande
      const { data: request, error: reqError } = await supabase
        .from('wallet_api_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (reqError || !request) throw reqError || new Error('Demande non trouvée');

      // 2. Marquer comme approuvée
      const { error: updateError } = await supabase
        .from('wallet_api_requests')
        .update({
          status: 'approved',
          reviewed_by: adminUserId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // 3. Générer les clés API
      const apiKey = generateApiKey();
      const apiSecret = generateApiSecret();

      const { error: keyError } = await supabase
        .from('wallet_api_keys')
        .insert({
          request_id: requestId,
          user_id: request.user_id,
          professional_service_id: request.professional_service_id,
          api_key: apiKey,
          api_secret: apiSecret,
          key_name: `224Wallet - ${request.business_name}`,
          commission_rate: commissionRate,
          is_test_mode: true,
        });

      if (keyError) throw keyError;

      return true;
    } catch (error) {
      console.error('❌ Erreur approbation demande API:', error);
      return false;
    }
  }

  /** Rejeter une demande */
  static async rejectRequest(requestId: string, adminUserId: string, reason: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('wallet_api_requests')
        .update({
          status: 'rejected',
          reviewed_by: adminUserId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('❌ Erreur rejet demande API:', error);
      return false;
    }
  }

  /** Récupérer toutes les clés API (admin) */
  static async getAllKeys(): Promise<WalletApiKey[]> {
    try {
      const { data, error } = await supabase
        .from('wallet_api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as WalletApiKey[];
    } catch (error) {
      console.error('❌ Erreur récupération clés API:', error);
      return [];
    }
  }

  /** Stats globales API */
  static async getApiStats(): Promise<{
    totalRequests: number;
    pendingRequests: number;
    approvedRequests: number;
    activeKeys: number;
    totalTransactions: number;
    totalVolume: number;
  }> {
    try {
      const [requestsRes, keysRes, txRes] = await Promise.all([
        supabase.from('wallet_api_requests').select('status'),
        supabase.from('wallet_api_keys').select('is_active, total_transactions, total_volume_gnf'),
        supabase.from('wallet_api_transactions').select('amount_gnf, status').eq('status', 'completed'),
      ]);

      const requests = requestsRes.data || [];
      const keys = keysRes.data || [];
      const txs = txRes.data || [];

      return {
        totalRequests: requests.length,
        pendingRequests: requests.filter(r => r.status === 'pending').length,
        approvedRequests: requests.filter(r => r.status === 'approved').length,
        activeKeys: keys.filter(k => k.is_active).length,
        totalTransactions: txs.length,
        totalVolume: txs.reduce((sum, tx) => sum + (tx.amount_gnf || 0), 0),
      };
    } catch (error) {
      console.error('❌ Erreur stats API:', error);
      return { totalRequests: 0, pendingRequests: 0, approvedRequests: 0, activeKeys: 0, totalTransactions: 0, totalVolume: 0 };
    }
  }

  static formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-GN', { style: 'decimal' }).format(amount) + ' GNF';
  }
}
