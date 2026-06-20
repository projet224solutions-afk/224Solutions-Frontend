import offlineDB from '@/lib/offlineDB';
import { collectPosMarketingContact, createPosOrder, syncPosSales, type PosSalePayload } from '@/services/posBackendService';

interface SyncOfflinePosSalesOptions {
  vendorId?: string | null;
  userId?: string | null;
}

interface SyncOfflinePosSalesResult {
  total: number;
  synced: number;
  failed: number;
}

let inFlightSync: Promise<SyncOfflinePosSalesResult> | null = null;

function isPosSaleEvent(event: any) {
  return event?.type === 'sale' || event?.type === 'credit_sale';
}

const VALID_METHODS = ['cash', 'mobile_money', 'card', 'credit'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Au-delà de ce nombre de tentatives, une vente est considérée NON RÉCUPÉRABLE :
// on cesse de la retenter (et de la compter) pour ne pas spammer l'utilisateur indéfiniment.
const MAX_SYNC_ATTEMPTS = 5;

/** Normalise vers une date ISO 8601 valide (exigée par le backend), sinon maintenant. */
function toIso(v: any): string {
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/**
 * Vrai si l'erreur est TRANSITOIRE (réseau, serveur indisponible, timeout, auth expirée) :
 * dans ce cas on réessaiera SANS pousser la vente vers l'abandon (pas d'incrément retry_count).
 * Les erreurs DÉTERMINISTES (validation, rejet métier) ne matchent pas → elles comptent vers le cap.
 */
function isTransientError(message: any): boolean {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('réseau') || m.includes('reseau') || m.includes('network') ||
    m.includes('timeout') || m.includes('annulée') || m.includes('annulee') ||
    m.includes('indisponible') || m.includes('injoignable') || m.includes('fetch') ||
    m.includes('non authentifié') || m.includes('non authentifie') ||
    m.includes('serveur') || m.includes('500') || m.includes('502') ||
    m.includes('503') || m.includes('504')
  );
}

/** Marque un événement échoué en choisissant le bon mode : transitoire (retry) vs déterministe (compté). */
async function markFailure(clientEventId: string, message: any): Promise<void> {
  if (isTransientError(message)) {
    await offlineDB.markEventForRetry(clientEventId, String(message));
  } else {
    await offlineDB.markEventAsFailed(clientEventId, String(message));
  }
}

/**
 * Synchronise les ventes POS hors ligne.
 *  - Ventes NORMALES ('sale') → table `pos_sales` via /api/pos/sync (RPC idempotente create_pos_sale_complete,
 *    anti-doublon par local_sale_id, décrément stock serveur). COHÉRENT avec les ventes en ligne.
 *  - Ventes À CRÉDIT ('credit_sale') → endpoint backend ATOMIQUE /api/pos/order (RPC create_pos_order_complete) :
 *    orders + order_items + vendor_credit_sales + stock dans UNE transaction, idempotent par order_number.
 *
 * Politique de retry BLINDÉE (anti-perte d'argent) :
 *  - données irrécupérables (aucun article UUID) → abandon immédiat (offlineDB.abandonEvent) ;
 *  - rejet métier déterministe (RPC error) → compté vers le cap MAX_SYNC_ATTEMPTS puis parqué ;
 *  - échec transitoire (réseau/serveur/timeout/auth) → réessayé indéfiniment SANS incrément (jamais abandonné) ;
 *  - exécution unique concurrente garantie (verrou inFlightSync), idempotence serveur tout-ou-rien.
 */
export async function syncOfflinePosSales(
  options: SyncOfflinePosSalesOptions = {}
): Promise<SyncOfflinePosSalesResult> {
  if (inFlightSync) return inFlightSync;

  inFlightSync = (async () => {
    const { vendorId } = options;

    const pendingEvents = await offlineDB.getPendingEvents();
    const failedEvents = await offlineDB.getFailedEvents();

    const salesEvents = [...pendingEvents, ...failedEvents]
      .filter((event) => {
        if (!isPosSaleEvent(event)) return false;
        if (vendorId && event.vendor_id !== vendorId) return false;
        // Vente non récupérable (trop de tentatives) → on ne la retente plus et on ne la compte plus.
        if ((event.retry_count || 0) >= MAX_SYNC_ATTEMPTS) return false;
        return true;
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (salesEvents.length === 0) {
      return { total: 0, synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    // ─────────────────────────────────────────────────────────────────────
    // 1) VENTES NORMALES → pos_sales (/api/pos/sync), groupées par vendeur, par lots de 50.
    // ─────────────────────────────────────────────────────────────────────
    const regular = salesEvents.filter((e) => e.type === 'sale' && e.vendor_id);
    const byVendor = new Map<string, any[]>();
    for (const e of regular) {
      if (!byVendor.has(e.vendor_id)) byVendor.set(e.vendor_id, []);
      byVendor.get(e.vendor_id)!.push(e);
    }

    for (const [vid, events] of byVendor) {
      for (let i = 0; i < events.length; i += 50) {
        const chunk = events.slice(i, i + 50);
        const payloads: PosSalePayload[] = [];
        const byLocalId = new Map<string, any>();

        for (const e of chunk) {
          const d = e.data || {};
          const localId = String(d.offline_order_id || d.order_number || e.client_event_id).slice(0, 100);
          // Le backend valide le lot ENTIER (Zod) → on n'envoie QUE des articles strictement valides
          // (product_id UUID, quantité ENTIÈRE 1..9999) pour qu'une vente n'invalide pas tout le lot.
          const items = (Array.isArray(d.items) ? d.items : [])
            .filter((it: any) => it && typeof it.product_id === 'string' && UUID_RE.test(it.product_id))
            .map((it: any) => ({
              product_id: it.product_id,
              product_name: String(it.product_name || 'Article').slice(0, 200),
              quantity: Math.min(9999, Math.max(1, Math.round(Number(it.quantity) || 1))),
              unit_price: Math.max(0, Number(it.unit_price) || 0),
              discount: Math.max(0, Number(it.discount) || 0),
            }));

          // Sans article valide identifiable, la vente ne pourra JAMAIS être créée côté serveur
          // (échec déterministe) → on l'ABANDONNE immédiatement (pas de retry infini, pas de toast récurrent).
          if (items.length === 0) {
            await offlineDB.abandonEvent(e.client_event_id, 'Aucun article valide (product_id UUID manquant)');
            continue;
          }

          byLocalId.set(localId, e);
          payloads.push({
            local_sale_id: localId,
            items,
            payment_method: VALID_METHODS.includes(d.payment_method) ? d.payment_method : 'cash',
            total_amount: Math.max(0, Number(d.total_amount) || 0),
            discount_total: Math.max(0, Number(d.discount_amount) || 0),
            customer_name: d.customer_name ? String(d.customer_name).slice(0, 200) : null,
            customer_phone: d.customer_phone ? String(d.customer_phone).slice(0, 20) : null,
            marketing_contact: d.marketing_contact ? String(d.marketing_contact).slice(0, 200) : null,
            notes: d.notes ? String(d.notes).slice(0, 500) : null,
            sold_at: toIso(d.sale_date || e.created_at),
          });
        }

        if (payloads.length === 0) continue;

        try {
          const res: any = await syncPosSales(payloads, vid);
          const data = res?.data ?? res;
          const results: any[] = data?.results || [];

          if (data?.success === false || results.length === 0) {
            // Échec GLOBAL de l'appel (souvent transitoire : réseau/serveur) → on réessaiera sans
            // pénaliser inutilement de vraies ventes (markFailure classe transitoire vs déterministe).
            for (const e of chunk) {
              await markFailure(e.client_event_id, data?.error || 'Synchronisation refusée');
              failed++;
            }
            continue;
          }

          for (const r of results) {
            const ev = byLocalId.get(r.local_sale_id);
            if (!ev) continue;
            if (r.status === 'created' || r.status === 'duplicate') {
              await offlineDB.markEventAsSynced(ev.client_event_id);
              synced++;
            } else {
              // Erreur PAR VENTE renvoyée par la RPC = déterministe (validation/métier) → comptée vers le cap.
              await offlineDB.markEventAsFailed(ev.client_event_id, r.error || 'Erreur de synchronisation');
              failed++;
            }
          }
        } catch (error) {
          // Exception (réseau/abort) → transitoire : on réessaiera sans pousser vers l'abandon.
          console.error('Erreur sync POS (pos_sales):', error);
          for (const e of chunk) {
            await offlineDB.markEventForRetry(e.client_event_id, String(error));
            failed++;
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2) VENTES À CRÉDIT → endpoint backend ATOMIQUE /api/pos/order (RPC create_pos_order_complete).
    //    UNE seule transaction tout-ou-rien : orders + order_items + vendor_credit_sales + stock
    //    (verrou FOR UPDATE) + taxe server-side. Idempotent (order_number UNIQUE → 'duplicate'),
    //    autorisé/validé côté serveur (verifyJWT + propriété vendeur + Zod). Remplace les anciennes
    //    écritures client→Supabase multi-tables non atomiques (rollback manuel partiel).
    // ─────────────────────────────────────────────────────────────────────
    const creditEvents = salesEvents.filter((e) => e.type === 'credit_sale' && e.vendor_id);
    for (const event of creditEvents) {
      try {
        const d = event.data || {};
        const vid = event.vendor_id;

        // order_number STABLE = clé d'idempotence (un retry renvoie 'duplicate' = succès).
        const orderNumber = String(d.order_number || `POS-CREDIT-${event.client_event_id}`).slice(0, 100);

        // N'envoyer QUE des articles strictement valides (UUID + quantité entière 1..9999),
        // pour ne pas faire échouer la validation Zod du lot côté serveur.
        const items = (Array.isArray(d.items) ? d.items : [])
          .filter((it: any) => it && typeof it.product_id === 'string' && UUID_RE.test(it.product_id))
          .map((it: any) => ({
            product_id: it.product_id,
            quantity: Math.min(9999, Math.max(1, Math.round(Number(it.quantity) || 1))),
            unit_price: Math.max(0, Number(it.unit_price) || 0),
            discount: Math.max(0, Number(it.discount) || 0),
          }));

        // Vente à crédit irrécupérable (aucun article identifiable) → abandon immédiat (pas de boucle).
        if (items.length === 0) {
          await offlineDB.abandonEvent(event.client_event_id, 'Aucun article valide (product_id UUID manquant)');
          continue;
        }

        const customerName = String(d.customer_name || 'Client comptoir').slice(0, 200);
        const creditItems = (Array.isArray(d.items) ? d.items : []).map((it: any) => ({
          id: it.product_id, name: it.product_name, price: it.unit_price, quantity: it.quantity, images: it.images || [],
        }));

        const resp: any = await createPosOrder(
          {
            order_number: orderNumber,
            items,
            payment_method: 'credit',
            payment_status: 'pending',
            status: 'confirmed',
            discount_total: Math.max(0, Number(d.discount_amount) || 0),
            notes: d.credit_notes ? String(d.credit_notes).slice(0, 500) : `Vente à crédit POS - ${customerName}`,
            credit_customer_name: customerName,
            credit_customer_phone: d.customer_phone ? String(d.customer_phone).slice(0, 20) : null,
            credit_due_date: d.due_date ? toIso(d.due_date) : null,
            credit_notes: d.credit_notes ? String(d.credit_notes).slice(0, 500) : null,
            credit_items: creditItems,
          },
          vid,
        );

        if (resp?.success) {
          // Contact marketing = BEST-EFFORT : ne doit jamais faire échouer/réessayer la vente.
          const marketingContact = String(d.marketing_contact || '').trim();
          if (marketingContact) {
            try {
              await collectPosMarketingContact(
                { contact: marketingContact, customer_name: customerName, order_total: Number(d.total_amount || 0), sold_at: toIso(d.sale_date || event.created_at) },
                vid,
              );
            } catch { /* best-effort, ignoré */ }
          }
          await offlineDB.markEventAsSynced(event.client_event_id);
          synced++;
        } else {
          // Transitoire (réseau/serveur) → retry sans pénalité ; déterministe (rejet métier) → compté.
          await markFailure(event.client_event_id, resp?.error || 'Échec de synchronisation de la vente à crédit');
          failed++;
        }
      } catch (error) {
        failed++;
        console.error('Erreur sync POS crédit offline:', error);
        await offlineDB.markEventForRetry(event.client_event_id, String(error));
      }
    }

    return { total: salesEvents.length, synced, failed };
  })();

  try {
    return await inFlightSync;
  } finally {
    inFlightSync = null;
  }
}

export default {
  syncOfflinePosSales,
};
