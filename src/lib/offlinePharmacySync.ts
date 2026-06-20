/**
 * Synchronisation des ventes de CAISSE PHARMACIE hors ligne.
 *
 * Symétrique de `offlineRestaurantSync` : les ventes comptoir encaissées EN PERSONNE sans
 * connexion sont stockées dans IndexedDB (offlineDB, type 'pharmacy_pos_sale') puis rejouées
 * à la reconnexion via la RPC ATOMIQUE `create_pharmacy_pos_offline_order` (insert
 * pharmacy_orders + décrément stock, idempotente par idempotency_key « PHARMA-OFF-… »).
 *
 * Politique de retry BLINDÉE (anti-perte d'argent), identique au POS vendeur/restaurant :
 *  - vente sans article → abandon immédiat ;
 *  - rejet métier déterministe (NON_AUTORISE, SERVICE_INTROUVABLE…) → parqué après cap ;
 *  - échec transitoire (réseau/serveur/timeout/auth) → réessayé sans pénaliser ;
 *  - exécution unique concurrente (verrou inFlightSync), idempotence serveur tout-ou-rien.
 */
import offlineDB from '@/lib/offlineDB';
import { supabase } from '@/integrations/supabase/client';

interface SyncOptions { serviceId?: string | null; }
interface SyncResult { total: number; synced: number; failed: number; }

let inFlightSync: Promise<SyncResult> | null = null;
const MAX_SYNC_ATTEMPTS = 5;

export function isPharmacySaleEvent(event: any): boolean {
  return event?.type === 'pharmacy_pos_sale';
}

function isTransientError(message: any): boolean {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('réseau') || m.includes('reseau') || m.includes('network') ||
    m.includes('timeout') || m.includes('annulée') || m.includes('annulee') ||
    m.includes('indisponible') || m.includes('injoignable') || m.includes('fetch') ||
    m.includes('jwt') || m.includes('non authentifié') || m.includes('non authentifie') ||
    m.includes('failed to fetch') || m.includes('serveur') ||
    m.includes('500') || m.includes('502') || m.includes('503') || m.includes('504')
  );
}

async function markFailure(clientEventId: string, message: any): Promise<void> {
  if (isTransientError(message)) await offlineDB.markEventForRetry(clientEventId, String(message));
  else await offlineDB.markEventAsFailed(clientEventId, String(message));
}

export async function syncOfflinePharmacySales(options: SyncOptions = {}): Promise<SyncResult> {
  if (inFlightSync) return inFlightSync;

  inFlightSync = (async () => {
    const { serviceId } = options;
    const [pending, failed] = await Promise.all([offlineDB.getPendingEvents(), offlineDB.getFailedEvents()]);

    const events = [...pending, ...failed]
      .filter((e) => {
        if (!isPharmacySaleEvent(e)) return false;
        if (serviceId && e.vendor_id !== serviceId) return false; // vendor_id = professional_service_id
        if ((e.retry_count || 0) >= MAX_SYNC_ATTEMPTS) return false;
        return true;
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (events.length === 0) return { total: 0, synced: 0, failed: 0 };

    let synced = 0; let failed2 = 0;

    for (const event of events) {
      try {
        const d = event.data || {};
        const svc = event.vendor_id;
        const idem = String(d.idempotency_key || `PHARMA-OFF-${event.client_event_id}`).slice(0, 120);
        const items = Array.isArray(d.items) ? d.items : [];
        if (items.length === 0) { await offlineDB.abandonEvent(event.client_event_id, 'Vente sans article'); continue; }

        const { data, error } = await supabase.rpc('create_pharmacy_pos_offline_order', {
          p_service_id: svc,
          p_idempotency_key: idem,
          p_sale: {
            total: Math.max(0, Number(d.total) || 0),
            payment_method: d.payment_method || 'cash',
            customer_name: d.customer_name || null,
            notes: d.notes || null,
            created_at: d.sale_date || event.created_at,
            items: items.map((it: any) => ({
              medication_id: it.medication_id || it.id || null,
              name: it.name || 'Article',
              price: Math.max(0, Number(it.price) || 0),
              quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
              subtotal: Math.max(0, Number(it.subtotal) || 0),
            })),
          },
        });

        if (error) { await markFailure(event.client_event_id, error.message || error); failed2++; continue; }

        const status = (data as any)?.status;
        if (status === 'created' || status === 'duplicate') { await offlineDB.markEventAsSynced(event.client_event_id); synced++; }
        else { await offlineDB.markEventAsFailed(event.client_event_id, 'Réponse inattendue de la synchronisation'); failed2++; }
      } catch (err) {
        console.error('Erreur sync caisse pharmacie offline:', err);
        await offlineDB.markEventForRetry(event.client_event_id, String(err));
        failed2++;
      }
    }
    return { total: events.length, synced, failed: failed2 };
  })();

  try { return await inFlightSync; } finally { inFlightSync = null; }
}

export default { syncOfflinePharmacySales, isPharmacySaleEvent };
