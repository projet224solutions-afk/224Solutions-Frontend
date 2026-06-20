/**
 * 📊 Diffusion d'ÉVÉNEMENTS en temps réel via l'abstraction LiveChannel (broadcast).
 *
 * Générique (analytics live, compteurs, activité…), provider-agnostique : Supabase broadcast
 * aujourd'hui, **Ably** par flag `VITE_REALTIME_PROVIDER=ably`, sans toucher les appelants.
 *
 * ⚠️ C'est un TRANSPORT temps réel, PAS un stockage. La persistance/requête de l'analytique
 * reste en base (Supabase) — ici on ne fait QUE diffuser pour les dashboards live (best-effort).
 */
import { getLiveChannel, type LiveChannel } from './index';

const producerChannels = new Map<string, LiveChannel>();

function getProducerChannel(topic: string): LiveChannel {
  let ch = producerChannels.get(topic);
  if (!ch) {
    ch = getLiveChannel(topic);
    ch.subscribe();
    producerChannels.set(topic, ch);
  }
  return ch;
}

/** Producteur : diffuse un événement live. Best-effort, n'échoue jamais bruyamment. */
export function publishLiveEvent(topic: string, event: string, payload: unknown): void {
  try {
    getProducerChannel(topic).send(event, payload);
  } catch {
    /* diffusion ignorée si le canal est indisponible (la donnée est déjà persistée en base) */
  }
}

/** Abonné (dashboard live) : reçoit un type d'événement. Renvoie une fonction de nettoyage. */
export function subscribeLiveEvent(
  topic: string,
  event: string,
  cb: (payload: unknown) => void,
): () => void {
  const ch = getLiveChannel(topic);
  ch.on(event, cb).subscribe();
  return () => { try { ch.close(); } catch { /* déjà fermé */ } };
}

/** Conventions de canaux analytics. */
export const vendorAnalyticsTopic = (vendorId: string) => `analytics:vendor:${vendorId}`;
export const platformAnalyticsTopic = () => `analytics:platform`;
