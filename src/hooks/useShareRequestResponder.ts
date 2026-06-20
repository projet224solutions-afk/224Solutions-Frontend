/**
 * useShareRequestResponder — Écouteur GLOBAL de demandes de localisation.
 *
 * Monté pour tout utilisateur connecté (client, service, vendeur…), il :
 *  - résout le custom_id de l'utilisateur (lecture de SA propre ligne user_ids),
 *  - s'abonne en permanence à son canal `live-location-<custom_id>`,
 *  - reçoit les demandes `share_request` d'un chauffeur (même si l'utilisateur
 *    ne partage pas encore sa position),
 *  - sur accept() : démarre le partage GPS (position + fiche) et écoute le taxi,
 *  - sur decline() : refuse.
 *
 * Permet à n'importe quel compte connecté de recevoir la notification de partage.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  liveLocationChannelName,
  LIVE_LOCATION_EVENTS,
  type LivePosition,
  type SharedProfile,
} from '@/lib/liveLocation';
import { getLiveChannel, type LiveChannel } from '@/lib/realtime';

// Heartbeat de re-diffusion de position. 10 s = bon compromis fraîcheur/charge
// (réduit ~2,5× le volume de messages Realtime à grande échelle).
const HEARTBEAT_MS = 10000;

interface ShareRequestInfo {
  driverName?: string;
  ts: number;
  requesterRole?: 'driver' | 'merchant';
}

export function useShareRequestResponder(authUserId: string | undefined, displayName?: string) {
  const [request, setRequest] = useState<ShareRequestInfo | null>(null);
  const [sharing, setSharing] = useState(false);
  const [lastPosition, setLastPosition] = useState<LivePosition | null>(null);
  const [driverPosition, setDriverPosition] = useState<LivePosition | null>(null);
  const [taxiEnroute, setTaxiEnroute] = useState<{ driverName?: string; requesterRole?: 'driver' | 'merchant' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Le client écoute/diffuse sur PLUSIEURS canaux (son custom_id ET son user_id)
  // afin d'être joignable que le chauffeur saisisse l'ID, l'UUID ou le téléphone.
  const channelsRef = useRef<LiveChannel[]>([]);
  const subscribedRef = useRef(false);
  const sharingRef = useRef(false); // déjà en partage → ignorer les relances de demande
  const watchIdRef = useRef<number | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPosRef = useRef<LivePosition | null>(null);
  const profileRef = useRef<SharedProfile | undefined>(undefined);

  // Charger le custom_id + la fiche (profil/boutique) de l'utilisateur
  const [customId, setCustomId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!authUserId) { setCustomId(null); profileRef.current = undefined; return; }
    (async () => {
      try {
        const { data: uid } = await supabase
          .from('user_ids').select('custom_id').eq('user_id', authUserId).maybeSingle();
        if (!cancelled) setCustomId(uid?.custom_id || authUserId);
      } catch { if (!cancelled) setCustomId(authUserId); }

      try {
        const [{ data: prof }, { data: vendor }] = await Promise.all([
          supabase.from('profiles')
            .select('first_name, last_name, full_name, phone, avatar_url, city, country, custom_id')
            .eq('id', authUserId).maybeSingle(),
          supabase.from('vendors')
            .select('business_name, address, city, neighborhood, phone, logo_url')
            .eq('user_id', authUserId).maybeSingle(),
        ]);
        if (cancelled) return;
        const isShop = !!vendor;
        profileRef.current = {
          name: (prof?.full_name || `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim() || displayName || 'Client'),
          phone: vendor?.phone || prof?.phone || undefined,
          address: isShop
            ? [vendor?.address, vendor?.neighborhood, vendor?.city].filter(Boolean).join(', ') || undefined
            : [prof?.city, prof?.country].filter(Boolean).join(', ') || undefined,
          photo: vendor?.logo_url || prof?.avatar_url || undefined,
          customId: prof?.custom_id || undefined,
          isShop,
          shopName: vendor?.business_name || undefined,
        };
      } catch { /* fiche optionnelle */ }
    })();
    return () => { cancelled = true; };
  }, [authUserId, displayName]);

  const send = useCallback((event: string, payload: unknown) => {
    channelsRef.current.forEach((c) => c.send(event, payload));
  }, []);

  const emitPosition = useCallback((pos: LivePosition) => send(LIVE_LOCATION_EVENTS.position, pos), [send]);
  const emitProfile = useCallback(() => {
    if (profileRef.current) send(LIVE_LOCATION_EVENTS.profile, profileRef.current);
  }, [send]);

  // Abonnement permanent aux canaux de l'utilisateur (custom_id ET user_id).
  // Deux canaux distincts permettent au chauffeur de joindre le client par son
  // ID personnalisé, son UUID, ou son numéro de téléphone (résolu en user_id).
  useEffect(() => {
    setRequest(null);
    if (!customId || !authUserId) return;

    // Clés de canal dédupliquées (custom_id peut déjà valoir authUserId si absent)
    const keys = Array.from(new Set(
      [customId, authUserId].map((k) => liveLocationChannelName(k))
    ));

    const channels = keys.map((channelName) => {
      const channel = getLiveChannel(channelName);

      channel.on(LIVE_LOCATION_EVENTS.shareRequest, (payload) => {
        // Accuser réception immédiatement (« je suis en ligne »), même si déjà en partage
        // → permet au chauffeur de savoir que l'utilisateur est joignable.
        send(LIVE_LOCATION_EVENTS.online, { ts: Date.now(), name: displayName });
        // Déjà en partage → ignorer les relances (évite la ré-ouverture de la modale)
        if (sharingRef.current) return;
        setRequest({ driverName: (payload as any)?.driverName, ts: Date.now(), requesterRole: (payload as any)?.requesterRole });
      });
      // Demande de position immédiate (si déjà en partage)
      channel.on(LIVE_LOCATION_EVENTS.request, () => {
        if (lastPosRef.current) emitPosition(lastPosRef.current);
        emitProfile();
      });
      channel.on(LIVE_LOCATION_EVENTS.taxiEnroute, (payload) => {
        setTaxiEnroute({ driverName: (payload as any)?.driverName, requesterRole: (payload as any)?.requesterRole });
      });
      channel.on(LIVE_LOCATION_EVENTS.driverPosition, (payload) => {
        setDriverPosition(payload as LivePosition);
      });

      channel.subscribe((status) => {
        if (status === 'subscribed') {
          subscribedRef.current = true;
          // Annoncer « je suis en ligne » dès l'abonnement → un chauffeur qui me
          // suivait (et m'a réveillé par push) reçoit ce signal et relance sa demande.
          channel.send(LIVE_LOCATION_EVENTS.online, { ts: Date.now(), name: displayName });
        }
      });
      return channel;
    });

    channelsRef.current = channels;

    return () => {
      subscribedRef.current = false;
      channelsRef.current = [];
      channels.forEach((c) => c.close());
    };
  }, [customId, authUserId, emitPosition, emitProfile]);

  // Démarre le partage GPS (réponse à une demande acceptée)
  const startSharing = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setError("La géolocalisation n'est pas supportée par cet appareil");
      return;
    }
    emitProfile();
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const pos: LivePosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          ts: Date.now(),
          name: displayName,
        };
        lastPosRef.current = pos;
        setLastPosition(pos);
        emitPosition(pos);
      },
      () => setError("Impossible d'obtenir votre position GPS."),
      // maximumAge:2000 → position fraîche (<2s), précise et robuste partout
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );
    heartbeatRef.current = setInterval(() => {
      if (lastPosRef.current) emitPosition({ ...lastPosRef.current, ts: Date.now() });
      emitProfile();
    }, HEARTBEAT_MS);
    sharingRef.current = true;
    setSharing(true);
  }, [displayName, emitPosition, emitProfile]);

  const stopSharing = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    lastPosRef.current = null;
    sharingRef.current = false;
    setSharing(false);
  }, []);

  const accept = useCallback(() => {
    send(LIVE_LOCATION_EVENTS.positionConfirmed, { ts: Date.now() });
    startSharing();
    setRequest(null);
  }, [send, startSharing]);

  const decline = useCallback(() => {
    send(LIVE_LOCATION_EVENTS.positionDeclined, { ts: Date.now() });
    stopSharing();
    setDriverPosition(null);
    setTaxiEnroute(null);
    setRequest(null);
  }, [send, stopSharing]);

  // Nettoyage GPS au démontage
  useEffect(() => stopSharing, [stopSharing]);

  return { request, sharing, lastPosition, driverPosition, taxiEnroute, error, accept, decline, stopSharing };
}
