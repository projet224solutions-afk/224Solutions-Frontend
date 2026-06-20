/**
 * 📢 CAMPAIGN BACKEND SERVICE
 * Client frontend pour le système de campagnes vendeur
 * Aligné 1:1 avec backend/src/routes/campaigns.routes.ts
 */

import { backendFetch, type BackendResponse } from './backendApi';

// ==================== TYPES ====================

export interface VendorCustomerLink {
  id: string;
  vendor_id?: string;
  customer_user_id?: string | null;
  external_contact_id?: string | null;
  source_type: 'digital' | 'physical' | 'both';
  linked_via: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  preferred_language: string;
  marketing_email_opt_in: boolean;
  marketing_sms_opt_in: boolean;
  marketing_push_opt_in: boolean;
  marketing_in_app_opt_in: boolean;
  last_purchase_at: string | null;
  total_orders: number;
  total_spent: number;
  is_active: boolean;
  created_at: string;
}

export type CampaignStatus = 'draft' | 'scheduled' | 'queued' | 'sending' | 'sent' | 'partial' | 'failed' | 'cancelled';
export type CampaignChannel = 'in_app' | 'push' | 'email' | 'sms';
export type CampaignTargetType =
  | 'all_clients' | 'digital_only' | 'physical_only' | 'hybrid'
  | 'active' | 'inactive' | 'recent_buyers' | 'dormant'
  | 'vip' | 'by_store' | 'by_product_category' | 'custom';

export interface VendorCampaign {
  id: string;
  vendor_id: string;
  store_id: string | null;
  title: string;
  subject: string | null;
  message_body: string;
  message_html: string | null;
  message_type: string;
  target_type: CampaignTargetType;
  target_filters: Record<string, any>;
  selected_channels: CampaignChannel[];
  total_targeted: number;
  total_eligible: number;
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_failed: number;
  total_skipped: number;
  status: CampaignStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  image_url: string | null;
  link_url: string | null;
  link_text: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  analytics?: {
    by_channel: Record<string, Record<string, number>>;
    by_status: Record<string, number>;
  };
}

export interface CreateCampaignPayload {
  title: string;
  subject?: string;
  message_body: string;
  message_html?: string;
  message_type?: string;
  target_type: CampaignTargetType;
  target_filters?: Record<string, any>;
  selected_channels: CampaignChannel[];
  scheduled_at?: string;
  image_url?: string;
  link_url?: string;
  link_text?: string;
  store_id?: string;
}

export interface AudiencePreview {
  total: number;
  channels: {
    in_app: number;
    push: number;
    email: number;
    sms: number;
  };
}

export interface CampaignAnalytics {
  summary: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
  };
  by_channel: Record<string, {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    skipped: number;
  }>;
  rates: {
    delivery_rate: number;
    read_rate: number;
    failure_rate: number;
  };
}

export interface SendResult {
  campaign_id: string;
  total_targeted: number;
  total_eligible: number;
  total_skipped: number;
  total_deliveries: number;
  status: string;
}

function requireBackendData<T>(response: BackendResponse<T>, fallbackMessage: string): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.error || fallbackMessage);
  }

  return response.data;
}

// ==================== API CALLS ====================

export async function listVendorClients(): Promise<VendorCustomerLink[]> {
  const res = await backendFetch<VendorCustomerLink[]>('/api/campaigns/clients');
  return requireBackendData(res, 'Impossible de charger les clients');
}

export interface BroadcastResult {
  total_contacts: number;
  email_targeted: number; email_sent: number; email_failed: number;
  sms_targeted: number; sms_sent: number; sms_failed: number;
  sms_error?: string;
  email_error?: string;
  already_sent?: boolean;
}

/**
 * Envoi DIRECT d'un message à TOUS les contacts collectés (email et/ou SMS).
 * `idempotencyKey` : empêche un double-envoi (re-clic / retry) → la 2e fois ne renvoie rien.
 */
export async function broadcastToClients(payload: {
  channel: 'email' | 'sms' | 'both';
  subject?: string;
  message: string;
}, idempotencyKey?: string): Promise<BroadcastResult> {
  const res = await backendFetch<BroadcastResult>('/api/campaigns/broadcast', {
    method: 'POST',
    body: payload,
    idempotencyKey,
  });
  return requireBackendData(res, 'Échec de la diffusion');
}

export async function previewAudience(targetType: CampaignTargetType, targetFilters?: Record<string, any>): Promise<AudiencePreview> {
  const res = await backendFetch<AudiencePreview>('/api/campaigns/preview-audience', {
    method: 'POST',
    body: { target_type: targetType, target_filters: targetFilters || {} },
  });
  return requireBackendData(res, 'Impossible de prévisualiser l\'audience');
}

export async function createCampaign(payload: CreateCampaignPayload): Promise<VendorCampaign> {
  const res = await backendFetch<VendorCampaign>('/api/campaigns', {
    method: 'POST',
    body: payload,
  });
  return requireBackendData(res, 'Impossible de créer la campagne');
}

export async function listCampaigns(status?: string): Promise<VendorCampaign[]> {
  const params = status && status !== 'all' ? `?status=${status}` : '';
  const res = await backendFetch<VendorCampaign[]>(`/api/campaigns${params}`);
  return requireBackendData(res, 'Impossible de charger les campagnes');
}

export async function getCampaign(id: string): Promise<VendorCampaign> {
  const res = await backendFetch<VendorCampaign>(`/api/campaigns/${id}`);
  return requireBackendData(res, 'Impossible de charger la campagne');
}

export async function getCampaignAnalytics(id: string): Promise<CampaignAnalytics> {
  const res = await backendFetch<CampaignAnalytics>(`/api/campaigns/${id}/analytics`);
  return requireBackendData(res, 'Impossible de charger les analytics');
}

export async function sendCampaign(id: string): Promise<SendResult> {
  const res = await backendFetch<SendResult>(`/api/campaigns/${id}/send`, {
    method: 'POST',
  });
  return requireBackendData(res, 'Impossible d\'envoyer la campagne');
}

export async function cancelCampaign(id: string): Promise<void> {
  const res = await backendFetch(`/api/campaigns/${id}/cancel`, { method: 'POST' });
  requireBackendData(res, 'Impossible d\'annuler la campagne');
}

// ==================== ADMIN API ====================

export async function listAllCampaignsAdmin(params?: { limit?: number; offset?: number; vendor_id?: string }): Promise<VendorCampaign[]> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());
  if (params?.vendor_id) searchParams.set('vendor_id', params.vendor_id);
  const qs = searchParams.toString();
  const res = await backendFetch<VendorCampaign[]>(`/api/campaigns/admin/all${qs ? `?${qs}` : ''}`);
  return requireBackendData(res, 'Impossible de charger les campagnes admin');
}

export async function suspendCampaignAdmin(id: string, reason: string): Promise<void> {
  const res = await backendFetch(`/api/campaigns/admin/${id}/suspend`, {
    method: 'POST',
    body: { reason },
  });
  requireBackendData(res, 'Impossible de suspendre la campagne');
}
