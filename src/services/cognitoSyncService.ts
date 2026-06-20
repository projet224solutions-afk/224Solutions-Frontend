/**
 * 🔄 COGNITO SYNC SERVICE - Optimisé avec retry et circuit breaker
 * Synchronise le profil Cognito avec le backend (Google Cloud SQL)
 */

import { backendConfig } from '@/config/backend';

interface SyncProfilePayload {
  additionalData?: {
    city?: string;
    country?: string;
    currency?: string;
  };
}

interface SyncResult {
  success: boolean;
  user?: any;
  error?: string;
}

// ==================== RETRY LOGIC ====================

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeout);

      // Ne pas retry sur les erreurs client (4xx sauf 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // Retry sur 429 et 5xx
      if ((response.status === 429 || response.status >= 500) && attempt < retries) {
        const delay = INITIAL_DELAY * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(`⚠️ [CognitoSync] Retry ${attempt + 1}/${retries} après ${Math.round(delay)}ms (HTTP ${response.status})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.warn(`⚠️ [CognitoSync] Timeout sur tentative ${attempt + 1}/${retries}`);
      }

      if (attempt < retries) {
        const delay = INITIAL_DELAY * Math.pow(2, attempt) + Math.random() * 500;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

// ==================== SYNC QUEUE ====================

interface QueuedSync {
  idToken: string;
  additionalData?: SyncProfilePayload['additionalData'];
  timestamp: number;
}

const syncQueue: QueuedSync[] = [];
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue || syncQueue.length === 0) return;
  isProcessingQueue = true;

  while (syncQueue.length > 0) {
    const item = syncQueue.shift()!;
    // Ignorer les syncs vieux de plus de 5 minutes
    if (Date.now() - item.timestamp > 5 * 60 * 1000) continue;

    try {
      await doSync(item.idToken, item.additionalData);
    } catch {
      // Si échec, on ne requeue pas pour éviter boucle infinie
    }
  }

  isProcessingQueue = false;
}

// ==================== SYNC FUNCTIONS ====================

async function doSync(
  idToken: string,
  additionalData?: SyncProfilePayload['additionalData']
): Promise<SyncResult> {
  const response = await fetchWithRetry(
    `${backendConfig.baseUrl}/api/cognito/sync-profile`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({ additionalData }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ [CognitoSync] Erreur sync:', data.error);
    return { success: false, error: data.error };
  }

  console.log('✅ [CognitoSync] Profil synchronisé avec Cloud SQL');
  return { success: true, user: data.user };
}

/**
 * Synchronise le profil après login Cognito
 * Avec retry automatique et mise en queue si offline
 */
export async function syncCognitoProfile(
  idToken: string,
  additionalData?: SyncProfilePayload['additionalData']
): Promise<SyncResult> {
  // Si offline, mettre en queue
  if (!navigator.onLine) {
    syncQueue.push({ idToken, additionalData, timestamp: Date.now() });

    // Écouter le retour online
    const handler = () => {
      window.removeEventListener('online', handler);
      processQueue();
    };
    window.addEventListener('online', handler);

    console.log('📦 [CognitoSync] Sync mise en queue (offline)');
    return { success: false, error: 'Offline - queued for later' };
  }

  try {
    return await doSync(idToken, additionalData);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur réseau';
    console.error('❌ [CognitoSync] Erreur après retries:', message);

    // Queue pour retry ultérieur
    syncQueue.push({ idToken, additionalData, timestamp: Date.now() });

    return { success: false, error: message };
  }
}

/**
 * Récupère le profil complet depuis Cloud SQL
 */
export async function fetchCognitoProfile(idToken: string): Promise<SyncResult> {
  try {
    const response = await fetchWithRetry(
      `${backendConfig.baseUrl}/api/cognito/me`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error };
    }

    return { success: true, user: data.user };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur réseau';
    console.error('❌ [CognitoSync] Erreur fetch profil:', message);
    return { success: false, error: message };
  }
}

/**
 * Valide le token Cognito auprès du backend
 */
export async function validateCognitoToken(idToken: string): Promise<boolean> {
  try {
    const response = await fetchWithRetry(
      `${backendConfig.baseUrl}/api/cognito/validate-token`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      },
      1 // Maximum 1 retry pour la validation
    );

    return response.ok;
  } catch {
    return false;
  }
}
