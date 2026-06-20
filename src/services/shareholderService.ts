// ============================================================================
// Service actionnaires — 100% Node.js backend via backendFetch
// ============================================================================

import { backendFetch } from './backendApi';
import type {
  Shareholder,
  ShareholderRevenue,
  ShareholderPayment,
  ShareholderDocument,
  ShareholderVote,
  PDGShareholderStats,
  PercentageInfo,
  PercentageSummary,
  RevenueCalculationResult,
  CreateShareholderDto,
  UpdateShareholderDto,
  ShareholderDashboardData,
  VoteChoice,
  CreateVoteDto,
} from '@/types/shareholder';

// ─── helper ──────────────────────────────────────────────────────────────────

function ok<T>(res: { success: boolean; data?: T; error?: string }): T {
  if (!res.success || res.data === undefined) throw new Error(res.error || 'Erreur backend');
  return res.data as T;
}

// ============================================================================
// CRUD Actionnaires (PDG)
// ============================================================================

export const shareholderService = {

  // --------------------------------------------------------------------------
  // Créer un actionnaire complet (PDG)
  // --------------------------------------------------------------------------
  async createShareholder(
    data: CreateShareholderDto,
    _createdByUserId: string,
  ): Promise<{ success: boolean; shareholder_id?: string; error?: string }> {
    const res = await backendFetch<{ shareholder_id: string }>('/api/shareholders', {
      method: 'POST',
      body:   data,
    });
    if (!res.success) return { success: false, error: res.error };
    return { success: true, shareholder_id: res.data?.shareholder_id };
  },

  // --------------------------------------------------------------------------
  // Lister tous les actionnaires (PDG)
  // --------------------------------------------------------------------------
  async listShareholders(): Promise<Shareholder[]> {
    const res = await backendFetch<Shareholder[]>('/api/shareholders');
    return res.success ? (res.data ?? []) : [];
  },

  // --------------------------------------------------------------------------
  // Obtenir un actionnaire par ID
  // --------------------------------------------------------------------------
  async getShareholder(id: string): Promise<Shareholder | null> {
    const list = await this.listShareholders();
    return list.find(s => s.id === id) ?? null;
  },

  // --------------------------------------------------------------------------
  // Mettre à jour un actionnaire (PDG)
  // --------------------------------------------------------------------------
  async updateShareholder(
    id: string,
    updates: UpdateShareholderDto,
    _actorId: string,
  ): Promise<{ success: boolean; error?: string; recalculated_revenues?: number }> {
    const res = await backendFetch<unknown>(`/api/shareholders/${id}`, {
      method: 'PUT',
      body:   updates,
    });
    return {
      success: res.success,
      error: res.error,
      // Nombre de revenus EN ATTENTE recalculés suite au changement de part (reçus à jour)
      recalculated_revenues: (res as { recalculated_revenues?: number }).recalculated_revenues,
    };
  },

  // --------------------------------------------------------------------------
  // Statistiques PDG
  // --------------------------------------------------------------------------
  async getPDGStats(): Promise<PDGShareholderStats | null> {
    const res = await backendFetch<PDGShareholderStats>('/api/shareholders/stats');
    return res.success ? (res.data ?? null) : null;
  },

  // --------------------------------------------------------------------------
  // Résumé des pourcentages (PDG)
  // --------------------------------------------------------------------------
  async getPercentageSummary(): Promise<PercentageSummary[]> {
    const res = await backendFetch<PercentageSummary[]>('/api/shareholders/percentages');
    return res.success ? (res.data ?? []) : [];
  },

  // --------------------------------------------------------------------------
  // Valider un pourcentage avant attribution (PDG)
  // --------------------------------------------------------------------------
  async validatePercentage(
    category: string,
    scope: string,
    country: string | null,
    percentage: number,
    excludeAssignmentId?: string,
  ): Promise<PercentageInfo> {
    const res = await backendFetch<PercentageInfo>('/api/shareholders/validate-percentage', {
      method: 'POST',
      body: {
        category,
        scope,
        new_percentage: percentage,
        country:        country || null,
        exclude_id:     excludeAssignmentId || null,
      },
    });
    if (!res.success) {
      return { valid: false, current: 0, remaining: 0, requested: percentage, message: res.error };
    }
    return res.data as PercentageInfo;
  },

  // --------------------------------------------------------------------------
  // Suspendre / Réactiver un actionnaire (PDG)
  // --------------------------------------------------------------------------
  async suspendShareholder(
    id: string,
    actorId: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateShareholder(id, { status: 'suspended' }, actorId);
  },

  async reactivateShareholder(
    id: string,
    actorId: string,
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateShareholder(id, { status: 'active' }, actorId);
  },

  // --------------------------------------------------------------------------
  // Transférer la part d'action vers un autre actionnaire (PDG)
  // --------------------------------------------------------------------------
  async transferShare(
    fromId: string,
    toShareholderId: string,
    reason: string,
    _actorId: string,
  ): Promise<{ success: boolean; transferred_to?: string; error?: string }> {
    const res = await backendFetch<{ transferred_to: string }>(`/api/shareholders/${fromId}/transfer`, {
      method: 'POST',
      body:   { to_shareholder_id: toShareholderId, reason },
    });
    if (!res.success) return { success: false, error: res.error };
    return { success: true, transferred_to: res.data?.transferred_to };
  },

  // --------------------------------------------------------------------------
  // Supprimer (archiver) un actionnaire (PDG)
  // --------------------------------------------------------------------------
  async deleteShareholder(
    id: string,
    _actorId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const res = await backendFetch(`/api/shareholders/${id}`, {
      method: 'DELETE',
    });
    return { success: res.success, error: res.error };
  },

  // ============================================================================
  // REVENUS (PDG)
  // ============================================================================

  // --------------------------------------------------------------------------
  // Calculer les revenus d'un assignment pour une période
  // --------------------------------------------------------------------------
  async calculateRevenue(
    assignmentId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<RevenueCalculationResult | null> {
    const res = await backendFetch<RevenueCalculationResult>('/api/shareholders/revenues/calculate', {
      method: 'POST',
      body: {
        assignment_id: assignmentId,
        period_start:  periodStart,
        period_end:    periodEnd,
      },
    });
    if (!res.success) {
      return { error: res.error } as any;
    }
    return res.data ?? null;
  },

  // --------------------------------------------------------------------------
  // Enregistrer les revenus calculés (PDG)
  // --------------------------------------------------------------------------
  async saveRevenue(
    result: RevenueCalculationResult,
    _actorId: string,
  ): Promise<{ success: boolean; revenue_id?: string; error?: string }> {
    const res = await backendFetch<{ revenue_id: string }>('/api/shareholders/revenues/save', {
      method: 'POST',
      body:   result,
    });
    if (!res.success) {
      if (res.error_code === 'DUPLICATE_REVENUE') {
        // Le backend renvoie un message précis (période identique OU chevauchante)
        return { success: false, error: res.error || 'Revenus déjà calculés pour cette période et cet actionnaire.' };
      }
      return { success: false, error: res.error };
    }
    return { success: true, revenue_id: res.data?.revenue_id };
  },

  // --------------------------------------------------------------------------
  // Lister tous les revenus (PDG) ou revenus personnels (actionnaire)
  // --------------------------------------------------------------------------
  async listRevenues(shareholderId?: string): Promise<ShareholderRevenue[]> {
    const path = shareholderId ? '/api/shareholders/revenues/me' : '/api/shareholders/revenues';
    const res = await backendFetch<ShareholderRevenue[]>(path);
    return res.success ? (res.data ?? []) : [];
  },

  // ============================================================================
  // PAIEMENTS (PDG)
  // ============================================================================

  // --------------------------------------------------------------------------
  // Lister tous les paiements (PDG) ou paiements personnels (actionnaire)
  // --------------------------------------------------------------------------
  async listPayments(shareholderId?: string): Promise<ShareholderPayment[]> {
    const path = shareholderId ? '/api/shareholders/payments/me' : '/api/shareholders/payments';
    const res = await backendFetch<ShareholderPayment[]>(path);
    return res.success ? (res.data ?? []) : [];
  },

  // --------------------------------------------------------------------------
  // Approuver un paiement (PDG)
  // --------------------------------------------------------------------------
  async approvePayment(
    paymentId: string,
    _actorId: string,
  ): Promise<{ success: boolean; sent_to_wallet?: boolean; credited_amount?: number; wallet_currency?: string; wallet_error?: string; error?: string }> {
    const res = await backendFetch<{ sent_to_wallet: boolean; credited_amount?: number; wallet_currency?: string; wallet_error?: string }>(`/api/shareholders/payments/${paymentId}/approve`, {
      method: 'POST',
    });
    if (!res.success) return { success: false, error: res.error };
    return {
      success:         true,
      sent_to_wallet:  res.data?.sent_to_wallet ?? false,
      credited_amount: res.data?.credited_amount,
      wallet_currency: res.data?.wallet_currency,
      wallet_error:    res.data?.wallet_error,
    };
  },

  // --------------------------------------------------------------------------
  // Envoyer un paiement dans le wallet de l'actionnaire (PDG)
  // --------------------------------------------------------------------------
  async sendPaymentToWallet(
    paymentId: string,
    _actorId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const res = await backendFetch(`/api/shareholders/payments/${paymentId}/send-wallet`, {
      method: 'POST',
    });
    return { success: res.success, error: res.error };
  },

  // ============================================================================
  // DASHBOARD ACTIONNAIRE
  // ============================================================================

  // --------------------------------------------------------------------------
  // Données complètes du dashboard actionnaire
  // --------------------------------------------------------------------------
  async getDashboardData(_userId: string): Promise<ShareholderDashboardData | null> {
    const res = await backendFetch<ShareholderDashboardData>('/api/shareholders/dashboard');
    if (!res.success) {
      const err = new Error(res.error || 'Erreur lors du chargement du tableau de bord');
      (err as any).error_code = res.error_code;
      throw err;
    }
    return res.data ?? null;
  },

  // --------------------------------------------------------------------------
  // Documents visibles par l'actionnaire
  // --------------------------------------------------------------------------
  async listDocuments(_shareholderId: string): Promise<ShareholderDocument[]> {
    const res = await backendFetch<ShareholderDocument[]>('/api/shareholders/documents');
    return res.success ? (res.data ?? []) : [];
  },

  // --------------------------------------------------------------------------
  // Votes accessibles à l'actionnaire
  // --------------------------------------------------------------------------
  async listVotes(_shareholderId: string): Promise<ShareholderVote[]> {
    const res = await backendFetch<ShareholderVote[]>('/api/shareholders/votes');
    return res.success ? (res.data ?? []) : [];
  },

  // --------------------------------------------------------------------------
  // Soumettre un vote (actionnaire)
  // --------------------------------------------------------------------------
  async submitVote(
    voteId: string,
    _shareholderId: string,
    choice: VoteChoice,
  ): Promise<{ success: boolean; error?: string }> {
    const res = await backendFetch(`/api/shareholders/votes/${voteId}/respond`, {
      method: 'POST',
      body:   { choice },
    });
    return { success: res.success, error: res.error };
  },

  // ============================================================================
  // VOTES — PDG
  // ============================================================================

  async listVotesAll(): Promise<ShareholderVote[]> {
    const res = await backendFetch<ShareholderVote[]>('/api/shareholders/votes/all');
    return res.success ? (res.data ?? []) : [];
  },

  async createVote(
    data: CreateVoteDto,
  ): Promise<{ success: boolean; vote_id?: string; error?: string }> {
    const res = await backendFetch<{ vote_id: string }>('/api/shareholders/votes', {
      method: 'POST',
      body:   data,
    });
    if (!res.success) return { success: false, error: res.error };
    return { success: true, vote_id: res.data?.vote_id };
  },

  async updateVote(
    id: string,
    data: CreateVoteDto,
  ): Promise<{ success: boolean; error?: string }> {
    const res = await backendFetch(`/api/shareholders/votes/${id}`, {
      method: 'PUT',
      body:   data,
    });
    return { success: res.success, error: res.error };
  },

  async publishVote(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await backendFetch(`/api/shareholders/votes/${id}/publish`, { method: 'POST' });
    return { success: res.success, error: res.error };
  },

  async closeVote(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await backendFetch(`/api/shareholders/votes/${id}/close`, { method: 'POST' });
    return { success: res.success, error: res.error };
  },

  async cancelVote(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await backendFetch(`/api/shareholders/votes/${id}/cancel`, { method: 'POST' });
    return { success: res.success, error: res.error };
  },

  async deleteVote(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await backendFetch(`/api/shareholders/votes/${id}`, { method: 'DELETE' });
    return { success: res.success, error: res.error };
  },

  // --------------------------------------------------------------------------
  // Notifications de l'actionnaire
  // --------------------------------------------------------------------------
  async getNotifications(_userId: string): Promise<any[]> {
    const res = await backendFetch<any[]>('/api/shareholders/notifications');
    return res.success ? (res.data ?? []) : [];
  },

  // --------------------------------------------------------------------------
  // Marquer une notification comme lue
  // --------------------------------------------------------------------------
  async markNotificationRead(notifId: string): Promise<void> {
    await backendFetch(`/api/shareholders/notifications/${notifId}/read`, {
      method: 'PUT',
    });
  },

  // --------------------------------------------------------------------------
  // Abonnements dans le périmètre de l'actionnaire
  // --------------------------------------------------------------------------
  async getShareholderSubscriptions(
    _category: string,
    _scope: string,
    _country: string | null,
  ): Promise<any[]> {
    const res = await backendFetch<any[]>('/api/shareholders/subscriptions');
    return res.success ? (res.data ?? []) : [];
  },
};
