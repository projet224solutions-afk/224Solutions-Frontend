/**
 * PARTAGE DE POSITION EN TEMPS RÉEL — 224Solutions Taxi-Moto
 *
 * Permet à un client de partager sa position GPS en direct (par son ID ou un lien)
 * et à un chauffeur (ou n'importe qui possédant le lien) de la suivre en temps réel.
 *
 * Implémentation via Supabase Realtime **Broadcast** : aucun schéma/table requis.
 * - Le partageur (client) émet sa position sur le canal `live-location-<userId>`.
 * - Le suiveur (chauffeur / lien) s'abonne au même canal et reçoit la position.
 */

export const LIVE_LOCATION_PREFIX = 'live-location-';

/**
 * Nom du canal Realtime pour un identifiant donné.
 * On normalise (trim + majuscules) pour que le partageur et le suiveur
 * tombent sur le même canal même si la casse diffère (ex: CLT0005 vs clt0005).
 */
export function liveLocationChannelName(userId: string): string {
  return `${LIVE_LOCATION_PREFIX}${String(userId).trim().toUpperCase()}`;
}

/** Événements broadcast échangés sur le canal. */
export const LIVE_LOCATION_EVENTS = {
  /** Le partageur (client) émet sa position. */
  position: 'position',
  /** Un suiveur demande la position courante immédiatement (à l'abonnement). */
  request: 'request',
  /** Le partageur a arrêté le partage. */
  stop: 'stop',
  /** Le chauffeur signale qu'il a localisé le client → demande de confirmation de position. */
  taxiEnroute: 'taxi_enroute',
  /** Le chauffeur diffuse sa propre position (pour le suivi d'arrivée côté client). */
  driverPosition: 'driver_position',
  /** Le client a confirmé sa position → le suivi peut démarrer. */
  positionConfirmed: 'position_confirmed',
  /** Le client a refusé / annulé le suivi. */
  positionDeclined: 'position_declined',
  /** Le client diffuse sa fiche (nom, tél, adresse, photo, ou infos boutique). */
  profile: 'profile',
  /** Le chauffeur demande au client (même non partageur) d'autoriser le partage. */
  shareRequest: 'share_request',
  /** Le client accuse réception (« je suis en ligne ») dès qu'il reçoit une demande. */
  online: 'online',
} as const;

/** Rôle de l'initiateur du suivi : chauffeur (taxi) ou commerçant/service. */
export type RequesterRole = 'driver' | 'merchant';

/** Infos transmises au client quand l'initiateur se met en route / localise. */
export interface TaxiEnrouteInfo {
  driverName?: string;
  ts: number;
  /**
   * 'driver' (défaut) : le chauffeur vient vers le client (taxi-moto).
   * 'merchant' : le CLIENT doit aller vers le vendeur/service → navigation côté client.
   */
  requesterRole?: RequesterRole;
}

/** Fiche du client (ou de sa boutique) diffusée au chauffeur avant la localisation. */
export interface SharedProfile {
  name?: string;
  phone?: string;
  address?: string;
  photo?: string;
  customId?: string;
  /** Vrai si le partageur est une boutique/vendeur. */
  isShop?: boolean;
  shopName?: string;
}

/** Position partagée diffusée sur le canal. */
export interface LivePosition {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number | null;
  speed?: number | null;
  /** Timestamp d'émission (ms). */
  ts: number;
  /** Nom affichable du partageur (optionnel). */
  name?: string;
}

const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

/**
 * Extrait un identifiant utilisateur depuis une saisie libre :
 * accepte un UUID brut, un lien `…/track/<id>` ou un ID personnalisé.
 */
export function extractUserId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1) UUID présent dans la chaîne (lien ou ID collé)
  const uuid = trimmed.match(UUID_RE);
  if (uuid) return uuid[0];

  // 2) Lien de type …/track/<id>
  const fromPath = trimmed.match(/\/track\/([^/?#\s]+)/i);
  if (fromPath) return decodeURIComponent(fromPath[1]);

  // 3) Sinon, on considère la saisie comme un ID direct (ex: custom_id)
  return trimmed;
}

/** Construit le lien public de suivi pour un utilisateur. */
export function buildShareLink(userId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/track/${encodeURIComponent(userId)}`;
}

/** Lien Google Maps (itinéraire) vers une position. */
export function googleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** Formate un délai écoulé depuis un timestamp (ms) en libellé court FR. */
export function formatElapsed(ts?: number): string {
  if (!ts) return 'Jamais';
  const diffMs = Date.now() - ts;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return "À l'instant";
  if (diffSec < 60) return `Il y a ${diffSec} s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  return `Il y a ${diffH} h`;
}
