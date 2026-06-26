/**
 * PAIEMENT VIA LE BACKEND (point d'entrée unique financier) — avec fallback Edge.
 *
 * 1) Appelle le backend Node.js (/api/v2/payments/*), qui relaie vers l'Edge Function
 *    de paiement (logique Stripe/OM/wallet éprouvée, inchangée).
 * 2) Si le backend est injoignable, on bascule sur l'appel Edge direct AVEC LE MÊME
 *    idempotencyKey → l'Edge déduplique (taxi_transactions.idempotency_key) donc aucun
 *    double débit possible. On ne casse rien si le backend tombe.
 *
 * Le backend renvoie : { success:true, proxied:true, edgeStatus, data:<json Edge> } quand
 * l'Edge a répondu, sinon un échec (backend/proxy injoignable) → fallback.
 */
import { backendFetch } from '@/services/backendApi';
import { supabase } from '@/integrations/supabase/client';

export async function payViaBackend(
  backendPath: string,
  edgeFn: string,
  backendBody: Record<string, unknown>,
  edgeBody: Record<string, unknown>,
  idempotencyKey: string,
): Promise<any> {
  const resp: any = await backendFetch(backendPath, {
    method: 'POST',
    body: backendBody,
    idempotencyKey,
  });

  // L'Edge a bien été atteinte via le backend → on utilise sa réponse.
  if (resp?.success && resp?.proxied) {
    if (resp.edgeStatus >= 200 && resp.edgeStatus < 300) return resp.data;
    throw new Error(resp.data?.error || `Erreur paiement (${resp.edgeStatus})`);
  }

  // Backend / proxy injoignable → fallback Edge direct (même idempotencyKey → sûr).
  console.warn(`[payViaBackend] backend indisponible (${resp?.error || '?'}) → fallback Edge ${edgeFn}`);
  const { data, error } = await supabase.functions.invoke(edgeFn, { body: edgeBody });
  if (error) throw error;
  return data;
}
