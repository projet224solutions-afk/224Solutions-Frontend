/**
 * 🔗 Résolution du lien de redirection d'une notification.
 *
 * À partir du `type` + `metadata` d'une notification ET du rôle de l'utilisateur,
 * renvoie la route vers la fonctionnalité dédiée — la plus PRÉCISE possible (bon onglet
 * + élément ciblé), ou null si pas de cible.
 *
 * Conventions de query params honorées par les pages cibles :
 *   ?order=<id> / ?focus=<id> → défilement + surbrillance de l'élément
 *   ?online=pending|processing|delivered → filtre des commandes en ligne (vendeur)
 *   ?tab=<valeur> → onglet actif (livreur / agent / bureau)
 *
 * Priorité : un `metadata.link` / `metadata.url` / `metadata.route` explicite (commençant
 * par '/') gagne toujours — le backend peut imposer une cible précise par destinataire.
 */

export interface NotificationLike {
  type?: string;
  metadata?: Record<string, unknown> | null;
}

export function getNotificationLink(n: NotificationLike, role?: string | null): string | null {
  const meta = (n.metadata || {}) as Record<string, any>;

  // 1) Lien explicite posé par le backend (le plus fiable).
  const explicit = meta.link || meta.url || meta.route;
  if (typeof explicit === 'string' && explicit.startsWith('/')) return explicit;

  const type = String(n.type || '').toLowerCase();
  const orderId = meta.order_id || meta.orderId;
  const focus = orderId ? `focus=${orderId}` : '';
  const orderQ = orderId ? `?order=${orderId}` : '';

  const isAdmin = role === 'admin' || role === 'pdg' || role === 'ceo';
  const isVendor = role === 'vendeur' || role === 'vendor';
  const isAgent = role === 'agent';
  const isDriver = role === 'livreur' || role === 'driver' || role === 'delivery';
  const isTaxi = role === 'taxi' || role === 'moto' || role === 'taxi_moto';
  const isSyndicat = role === 'syndicat' || role === 'bureau';

  const withQuery = (base: string, ...parts: string[]) => {
    const q = parts.filter(Boolean).join('&');
    return q ? `${base}?${q}` : base;
  };

  // ── PDG / Admin ─────────────────────────────────────────────
  if (isAdmin) {
    switch (type) {
      case 'escrow':
      case 'dispute':
      case 'order':
        return '/pdg';
      case 'message':
        return '/messages';
      default:
        return '/pdg';
    }
  }

  // ── Vendeur ─────────────────────────────────────────────────
  if (isVendor) {
    switch (type) {
      case 'order':
      case 'delivery':
        // Nouvelle commande en ligne → onglet commandes, filtre « en attente », sur la commande.
        return withQuery('/vendeur/orders', 'online=pending', focus);
      case 'escrow':
      case 'dispute':
        return withQuery('/vendeur/escrow', focus);
      case 'payment':
        return '/vendeur/wallet';
      case 'message':
        return '/messages';
      default:
        return '/vendeur';
    }
  }

  // ── Agent ───────────────────────────────────────────────────
  if (isAgent) {
    switch (type) {
      case 'message':
        return '/messages';
      case 'payment':
      case 'commission':
        return withQuery('/agent', 'tab=wallet');
      default:
        return withQuery('/agent', `tab=${meta.tab || 'overview'}`);
    }
  }

  // ── Livreur ─────────────────────────────────────────────────
  if (isDriver) {
    switch (type) {
      case 'delivery':
      case 'order':
        // Course assignée → onglet « active » ; sinon → « missions » (disponibles).
        return withQuery('/livreur', `tab=${meta.assigned || meta.delivery_id ? 'active' : 'missions'}`);
      case 'payment':
        return withQuery('/livreur', 'tab=wallet');
      case 'message':
        return '/messages';
      default:
        return withQuery('/livreur', 'tab=missions');
    }
  }

  // ── Taxi-moto ───────────────────────────────────────────────
  if (isTaxi) {
    if (type === 'message') return '/messages';
    return '/taxi-moto/driver';
  }

  // ── Bureau syndicat ─────────────────────────────────────────
  if (isSyndicat) {
    if (type === 'message') return '/messages';
    return withQuery('/bureau', `tab=${meta.tab || 'overview'}`);
  }

  // ── Client (par défaut) ─────────────────────────────────────
  switch (type) {
    case 'escrow':
    case 'dispute':
    case 'order':
    case 'delivery':
      return `/orders${orderQ}`;
    case 'message':
      return '/messages';
    case 'payment':
      return '/wallet';
    default:
      return null;
  }
}
