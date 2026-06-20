import { backendConfig } from '@/config/backend';
import { backendFetch } from './backendApi';

const MARKETPLACE_VISIBILITY_TIMEOUT_MS = 4500;

export type MarketplaceVisibilityItemType = 'product' | 'digital_product' | 'professional_service';

export interface MarketplaceVisibilityCandidate {
  id: string;
  itemType: MarketplaceVisibilityItemType;
  vendorId?: string;
  vendorUserId?: string;
  rating?: number;
  reviewsCount?: number;
  createdAt?: string;
  descriptionLength?: number;
  imageCount?: number;
  isSponsored?: boolean;
}

export interface MarketplaceVisibilityScoresResponse {
  orderedIds: string[];
  scores: Record<string, {
    subscriptionScore: number;
    performanceScore: number;
    boostScore: number;
    qualityScore: number;
    relevanceScore: number;
    finalScore: number;
    breakdown?: Record<string, any>;
  }>;
  meta?: Record<string, any>;
}

export async function rankMarketplaceCandidates(candidates: MarketplaceVisibilityCandidate[], context?: Record<string, any>) {
  const baseUrl = backendConfig.baseUrl || '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MARKETPLACE_VISIBILITY_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/api/marketplace-visibility/rank-candidates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: candidates, context }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const json = await response.json();
    if (!json?.success) return null;

    return json as { success: true } & MarketplaceVisibilityScoresResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn('[MarketplaceVisibility] Timeout classement, fallback tri local');
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getVendorVisibilitySummary() {
  return backendFetch<any>('/api/marketplace-visibility/vendor/me', { method: 'GET' });
}

export async function getVendorBoosts() {
  return backendFetch<any[]>('/api/marketplace-visibility/vendor/boosts', { method: 'GET' });
}

export async function createVendorBoost(payload: {
  targetType: 'product' | 'shop';
  targetId: string;
  placement?: 'general' | 'homepage' | 'category' | 'search';
  categorySlug?: string;
  budgetAmount: number;
  amountPaid?: number;
  boostScore: number;
  startsAt?: string;
  endsAt?: string;
  paymentReference?: string;
  activateNow?: boolean;
  metadata?: Record<string, any>;
}) {
  return backendFetch<any>('/api/marketplace-visibility/vendor/boosts', {
    method: 'POST',
    body: payload,
  });
}

export async function getPdgVisibilityOverview() {
  return backendFetch<any>('/api/marketplace-visibility/pdg/overview', { method: 'GET' });
}

export async function updatePdgVisibilityConfig(payload: Record<string, any>) {
  return backendFetch<any>('/api/marketplace-visibility/pdg/config', {
    method: 'PUT',
    body: payload,
  });
}

export async function updatePdgPlanScore(payload: {
  planName: string;
  visibilityTier: string;
  baseScore: number;
  exposureMultiplier?: number;
  frequencyBoost?: number;
}) {
  return backendFetch<any>('/api/marketplace-visibility/pdg/plan-score', {
    method: 'PUT',
    body: payload,
  });
}
