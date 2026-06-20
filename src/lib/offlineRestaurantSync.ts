/**
 * Synchronisation des ventes de CAISSE RESTAURANT hors ligne.
 *
 * Symétrique de `offlinePosSync` (POS vendeur) mais pour la caisse de comptoir du
 * restaurateur : les ventes encaissées EN PERSONNE sans connexion sont stockées dans
 * IndexedDB (offlineDB, type 'restaurant_pos_sale') puis rejouées à la reconnexion via la
 * RPC ATOMIQUE `create_restaurant_pos_offline_order` (insert restaurant_orders + décrément
 * stock dans UNE transaction, idempotente par order_number « RESTO-OFF-… »).
 *
 * Politique de retry BLINDÉE (anti-perte d'argent), identique au POS vendeur :
 *  - données irrécupérables (aucun article) → abandon immédiat (offlineDB.abandonEvent) ;
 *  - rejet métier déterministe (NON_AUTORISE, SERVICE_INTROUVABLE…) → compté vers le cap puis parqué ;
 *  - échec transitoire (réseau/serveur/timeout/auth) → réessayé indéfiniment SANS incrément ;
 *  - exécution unique concurrente garantie (verrou inFlightSync), idempotence serveur tout-ou-rien.
 */
import offlineDB from '@/lib/offlineDB';
import { supabase } from '@/integrations/supabase/client';

interface SyncOptions {
  serviceId?: string | null;
}
interface SyncResult {
  total: number;
  synced: number;
  failed: number;
}

let inFlightSync: Promise<SyncResult> | null = null;

const MAX_SYNC_ATTEMPTS = 5;

export function isRestaurantSaleEvent(event: any): boolean {
  return event?.type === 'restaurant_pos_sale';
}

/** Erreur TRANSITOIRE (réseau/serveur/timeout/auth) → réessayer sans pénaliser une vraie vente. */
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
  if (isTransientError(message)) {
    await offlineDB.markEventForRetry(clientEventId, String(message));
  } else {
    await offlineDB.markEventAsFailed(clientEventId, String(message));
  }
}

export async function syncOfflineRestaurantSales(options: SyncOptions = {}): Promise<SyncResult> {
  if (inFlightSync) return inFlightSync;

  inFlightSync = (async () => {
    const { serviceId } = options;

    const [pending, failed] = await Promise.all([
      offlineDB.getPendingEvents(),
      offlineDB.getFailedEvents(),
    ]);

    const events = [...pending, ...failed]
      .filter((e) => {
        if (!isRestaurantSaleEvent(e)) return false;
        if (serviceId && e.vendor_id !== serviceId) return false; // vendor_id = professional_service_id ici
        if ((e.retry_count || 0) >= MAX_SYNC_ATTEMPTS) return false;
        return true;
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (events.length === 0) return { total: 0, synced: 0, failed: 0 };

    let synced = 0;
    let failed2 = 0;

    for (const event of events) {
      try {
        const d = event.data || {};
        const svc = event.vendor_id; // professional_service_id
        const orderNumber = String(d.order_number || `RESTO-OFF-${event.client_event_id}`).slice(0, 120);

        const items = Array.isArray(d.items) ? d.items : [];
        // Sans aucun article, la commande n'a pas de sens → abandon (pas de retry infini).
        if (items.length === 0) {
          await offlineDB.abandonEvent(event.client_event_id, 'Vente sans article');
          continue;
        }

        const { data, error } = await supabase.rpc('create_restaurant_pos_offline_order', {
          p_service_id: svc,
          p_order_number: orderNumber,
          p_order: {
            order_type: d.order_type || 'dine_in',
            status: d.status || 'completed',
            customer_name: d.customer_name || null,
            table_number: d.table_number || null,
            payment_method: d.payment_method || 'cash',
            payment_status: d.payment_status || 'paid',
            subtotal: Math.max(0, Number(d.subtotal) || 0),
            tax: Math.max(0, Number(d.tax) || 0),
            discount_amount: Math.max(0, Number(d.discount_amount) || 0),
            total: Math.max(0, Number(d.total) || 0),
            notes: d.notes || null,
            items: items.map((it: any) => ({
              menu_item_id: it.menu_item_id || it.id || null,
              name: it.name || 'Article',
              price: Math.max(0, Number(it.price) || 0),
              quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
              subtotal: Math.max(0, Number(it.subtotal) || 0),
              notes: it.notes || null,
            })),
            created_at: d.sale_date || event.created_at,
          },
        });

        if (error) {
          // Erreur RPC = transitoire (réseau/serveur) OU déterministe (autorisation/params).
          await markFailure(event.client_event_id, error.message || error);
          failed2++;
          continue;
        }

        const status = (data as any)?.status;
        if (status === 'created' || status === 'duplicate') {
          await offlineDB.markEventAsSynced(event.client_event_id);
          synced++;
        } else {
          await offlineDB.markEventAsFailed(event.client_event_id, 'Réponse inattendue de la synchronisation');
          failed2++;
        }
      } catch (err) {
        console.error('Erreur sync caisse restaurant offline:', err);
        // Exception (réseau/abort) → transitoire : on réessaiera sans pousser vers l'abandon.
        await offlineDB.markEventForRetry(event.client_event_id, String(err));
        failed2++;
      }
    }

    return { total: events.length, synced, failed: failed2 };
  })();

  try {
    return await inFlightSync;
  } finally {
    inFlightSync = null;
  }
}

export default { syncOfflineRestaurantSales, isRestaurantSaleEvent };
