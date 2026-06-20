/**
 * 📍 Diffusion de positions en TEMPS RÉEL via l'abstraction LiveChannel (broadcast).
 *
 * But scalabilité : sortir les positions GPS haute-fréquence du chemin `postgres_changes`
 * (qui tape le WAL Postgres et ne tient pas à grande échelle) vers du broadcast pur,
 * provider-agnostique — Supabase broadcast aujourd'hui, **Ably** (puis AWS IoT) par simple
 * flag `VITE_REALTIME_PROVIDER`, SANS toucher les appelants.
 *
 * Usage DUAL-MODE (transition sûre) : on AJOUTE ces appels À CÔTÉ du postgres_changes
 * existant. Tant que les deux tournent, rien n'est cassé ni manqué. Quand le broadcast est
 * vérifié, on pourra retirer le postgres_changes (et réduire les écritures DB) → WAL déchargé.
 *
 * L'écriture en base reste inchangée : ce module ne fait QUE de la diffusion (best-effort).
 */
import { getLiveChannel, type LiveChannel } from './index';

export interface LivePosition {
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  at?: string;
}

// Canaux producteurs réutilisés (un par topic) — évite d'ouvrir/fermer à chaque point GPS.
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

/** Producteur (livreur/chauffeur) : diffuse sa position. Best-effort, n'échoue jamais bruyamment. */
export function publishLivePosition(topic: string, pos: LivePosition): void {
  try {
    getProducerChannel(topic).send('position', pos);
  } catch {
    /* diffusion ignorée si le canal est indisponible (la donnée est déjà en base) */
  }
}

/** Abonné (client) : reçoit les positions. Renvoie une fonction de nettoyage. */
export function subscribeLivePosition(topic: string, cb: (pos: LivePosition) => void): () => void {
  const ch = getLiveChannel(topic);
  ch.on('position', (payload) => {
    const p = payload as LivePosition;
    if (p && typeof p.lat === 'number' && typeof p.lng === 'number') cb(p);
  }).subscribe();
  return () => {
    try { ch.close(); } catch { /* déjà fermé */ }
  };
}

/** Conventions de noms de canaux (un par entité suivie). */
export const deliveryPositionTopic = (deliveryId: string) => `delivery-tracking:${deliveryId}`;
export const driverPositionTopic = (driverId: string) => `driver-pos:${driverId}`;
export const ridePositionTopic = (rideId: string) => `ride-track:${rideId}`;
