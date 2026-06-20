/**
 * HOOKS DE PARTAGE DE POSITION EN TEMPS RÉEL — 224Solutions
 *
 * - useShareMyLocation : le client partage sa position GPS en direct.
 * - useTrackLocation   : un suiveur (chauffeur / lien public) reçoit la position.
 *
 * Basé sur Supabase Realtime Broadcast (aucune table requise).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  liveLocationChannelName,
  LIVE_LOCATION_EVENTS,
  type LivePosition,
  type TaxiEnrouteInfo,
  type SharedProfile,
} from '@/lib/liveLocation';
import { getLiveChannel, type LiveChannel } from '@/lib/realtime';

// Heartbeat de re-diffusion (10 s) — réduit le volume de messages Realtime à grande échelle.
const HEARTBEAT_MS = 10000;

/**
 * Partage la position GPS de l'utilisateur courant sur son canal.
 * Renvoie l'état du partage et la dernière position émise.
 */
export function useShareMyLocation(userId: string | undefined, name?: string, profile?: SharedProfile) {
  const [sharing, setSharing] = useState(false);
  const [lastPosition, setLastPosition] = useState<LivePosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Signaux reçus du chauffeur (taxi en route + position du taxi)
  const [taxiEnroute, setTaxiEnroute] = useState<TaxiEnrouteInfo | null>(null);
  const [driverPosition, setDriverPosition] = useState<LivePosition | null>(null);

  const channelRef = useRef<LiveChannel | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPosRef = useRef<LivePosition | null>(null);
  const profileRef = useRef<SharedProfile | undefined>(profile);
  profileRef.current = profile;

  const emit = useCallback((pos: LivePosition) => {
    channelRef.current?.send(LIVE_LOCATION_EVENTS.position, pos);
  }, []);

  /** Diffuse la fiche du client (réponse à une demande de suivi). */
  const emitProfile = useCallback(() => {
    if (profileRef.current) {
      channelRef.current?.send(LIVE_LOCATION_EVENTS.profile, profileRef.current);
    }
  }, []);

  /** Répond au chauffeur : confirme (et re-partage la position) ou refuse le suivi. */
  const respondToTaxi = useCallback((confirmed: boolean) => {
    channelRef.current?.send(
      confirmed ? LIVE_LOCATION_EVENTS.positionConfirmed : LIVE_LOCATION_EVENTS.positionDeclined,
      { ts: Date.now() },
    );
    if (confirmed && lastPosRef.current) emit(lastPosRef.current);
  }, [emit]);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (channelRef.current) {
      channelRef.current.send(LIVE_LOCATION_EVENTS.stop, {});
      channelRef.current.close();
      channelRef.current = null;
    }
    lastPosRef.current = null;
    setSharing(false);
    setTaxiEnroute(null);
    setDriverPosition(null);
  }, []);

  const start = useCallback(() => {
    setError(null);

    if (!userId) {
      setError('Utilisateur non identifié');
      return;
    }
    if (!('geolocation' in navigator)) {
      setError("La géolocalisation n'est pas supportée par cet appareil");
      return;
    }

    // Canal de l'utilisateur partageur (transport via abstraction : Supabase ou Ably)
    const channel = getLiveChannel(liveLocationChannelName(userId));

    // Répondre immédiatement aux demandes des suiveurs (position + fiche)
    channel.on(LIVE_LOCATION_EVENTS.request, () => {
      if (lastPosRef.current) emit(lastPosRef.current);
      emitProfile();
    });

    // Le chauffeur a localisé le client → "votre taxi est en route"
    channel.on(LIVE_LOCATION_EVENTS.taxiEnroute, (payload) => {
      setTaxiEnroute(payload as TaxiEnrouteInfo);
    });

    // Position du taxi (pour suivre son arrivée)
    channel.on(LIVE_LOCATION_EVENTS.driverPosition, (payload) => {
      setDriverPosition(payload as LivePosition);
    });

    channel.subscribe();
    channelRef.current = channel;

    // Suivi GPS continu
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const pos: LivePosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading,
          speed: position.coords.speed,
          ts: Date.now(),
          name,
        };
        lastPosRef.current = pos;
        setLastPosition(pos);
        emit(pos);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Accès GPS refusé. Autorisez la localisation pour partager votre position.'
            : 'Impossible d\'obtenir votre position GPS.'
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );

    // Battement régulier : ré-émet la dernière position ET la fiche pour les
    // suiveurs récents (garantit que le chauffeur reçoit le profil de façon fiable).
    heartbeatRef.current = setInterval(() => {
      if (lastPosRef.current) {
        lastPosRef.current = { ...lastPosRef.current, ts: Date.now(), name };
        emit(lastPosRef.current);
      }
      emitProfile();
    }, HEARTBEAT_MS);

    setSharing(true);
  }, [userId, name, emit, emitProfile]);

  // Nettoyage au démontage
  useEffect(() => stop, [stop]);

  return { sharing, lastPosition, error, start, stop, taxiEnroute, driverPosition, respondToTaxi };
}

interface TrackLocationOptions {
  /** Si vrai, rediffuse la position du chauffeur (suivi d'arrivée côté client). */
  announceAsTaxi?: boolean;
  /** Si vrai, notifie le client ("votre taxi est en route") → déclenche sa confirmation.
   *  Mis à vrai SEULEMENT après que le chauffeur a confirmé la localisation (vu la fiche). */
  notifyClient?: boolean;
  /** Nom du chauffeur (transmis dans la notification). */
  driverName?: string;
  /** Position du chauffeur, rediffusée au client pour suivre l'arrivée du taxi. */
  driverPosition?: { lat: number; lng: number } | null;
  /** Rôle de l'initiateur : 'driver' (taxi, défaut) ou 'merchant' (vendeur/service). */
  requesterRole?: 'driver' | 'merchant';
}

/**
 * Suit la position partagée par un utilisateur (par son ID).
 * Côté chauffeur (announceAsTaxi), annonce "taxi en route" et rediffuse sa
 * propre position pour le suivi d'arrivée côté client.
 */
export function useTrackLocation(
  userId: string | null | undefined,
  options: TrackLocationOptions = {}
) {
  const { announceAsTaxi = false, notifyClient = false, driverName, driverPosition, requesterRole = 'driver' } = options;
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [connected, setConnected] = useState(false);
  const [sharerStopped, setSharerStopped] = useState(false);
  const [clientResponse, setClientResponse] = useState<'confirmed' | 'declined' | null>(null);
  const [clientProfile, setClientProfile] = useState<SharedProfile | null>(null);

  const channelRef = useRef<LiveChannel | null>(null);
  const subscribedRef = useRef(false);
  const enrouteSentRef = useRef(false);
  const hasPositionRef = useRef(false);
  const notifyClientRef = useRef(notifyClient);
  notifyClientRef.current = notifyClient;
  const driverNameRef = useRef(driverName);
  driverNameRef.current = driverName;
  const requesterRoleRef = useRef(requesterRole);
  requesterRoleRef.current = requesterRole;
  const driverPosRef = useRef<{ lat: number; lng: number } | null>(driverPosition ?? null);
  driverPosRef.current = driverPosition ?? null;

  // Détection en ligne/hors ligne du client suivi (accusé de réception)
  const [targetOnline, setTargetOnline] = useState<boolean | null>(null);
  const onlineSeenRef = useRef(false);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Évite de relancer la demande en boucle quand le client (re)vient en ligne
  const reRequestedRef = useRef(false);

  // Envoie "taxi en route" une seule fois, quand le chauffeur a confirmé (notifyClient)
  // ET qu'on a reçu la position du client.
  const maybeSendEnroute = useCallback(() => {
    if (notifyClientRef.current && hasPositionRef.current && !enrouteSentRef.current
        && subscribedRef.current && channelRef.current) {
      enrouteSentRef.current = true;
      channelRef.current.send(LIVE_LOCATION_EVENTS.taxiEnroute, {
        driverName: driverNameRef.current,
        ts: Date.now(),
        requesterRole: requesterRoleRef.current,
      });
    }
  }, []);

  const sendDriverPosition = useCallback(() => {
    const p = driverPosRef.current;
    if (!announceAsTaxi || !p || !channelRef.current || !subscribedRef.current) return;
    channelRef.current.send(LIVE_LOCATION_EVENTS.driverPosition, {
      lat: p.lat, lng: p.lng, ts: Date.now(), name: driverName,
    });
  }, [announceAsTaxi, driverName]);

  useEffect(() => {
    setPosition(null);
    setConnected(false);
    setSharerStopped(false);
    setClientResponse(null);
    setClientProfile(null);
    subscribedRef.current = false;
    enrouteSentRef.current = false;
    hasPositionRef.current = false;
    setTargetOnline(null);
    onlineSeenRef.current = false;
    reRequestedRef.current = false;
    if (offlineTimerRef.current) { clearTimeout(offlineTimerRef.current); offlineTimerRef.current = null; }

    if (!userId) return;

    const channel = getLiveChannel(liveLocationChannelName(userId));
    channelRef.current = channel;

    channel.on(LIVE_LOCATION_EVENTS.position, (payload) => {
      setSharerStopped(false);
      setPosition(payload as LivePosition);
      hasPositionRef.current = true;
      // Une position reçue = client en ligne
      onlineSeenRef.current = true;
      setTargetOnline(true);
      // "Taxi en route" seulement si le chauffeur a déjà confirmé la localisation
      maybeSendEnroute();
    });

    // Accusé « je suis en ligne » (à la réception de la demande OU à l'ouverture de l'app)
    channel.on(LIVE_LOCATION_EVENTS.online, () => {
      onlineSeenRef.current = true;
      setTargetOnline(true);
      if (offlineTimerRef.current) { clearTimeout(offlineTimerRef.current); offlineTimerRef.current = null; }
      // Le client vient (re)d'ouvrir l'app → relancer la demande UNE fois pour afficher
      // sa modale de confirmation (la demande initiale était perdue app fermée).
      if (announceAsTaxi && !hasPositionRef.current && !reRequestedRef.current && channelRef.current) {
        reRequestedRef.current = true;
        channelRef.current.send(LIVE_LOCATION_EVENTS.shareRequest, { driverName, ts: Date.now(), requesterRole: requesterRoleRef.current });
      }
    });

    // Fiche du client (nom, tél, adresse, photo ou infos boutique)
    channel.on(LIVE_LOCATION_EVENTS.profile, (payload) => {
      setClientProfile(payload as SharedProfile);
    });

    channel.on(LIVE_LOCATION_EVENTS.stop, () => {
      setSharerStopped(true);
    });

    // Réponse du client à la demande de confirmation de position (feedback chauffeur)
    channel.on(LIVE_LOCATION_EVENTS.positionConfirmed, () => {
      setClientResponse('confirmed');
    });
    channel.on(LIVE_LOCATION_EVENTS.positionDeclined, () => {
      setClientResponse('declined');
    });

    channel.subscribe((status) => {
      if (status === 'subscribed') {
        setConnected(true);
        subscribedRef.current = true;
        // Demander la position courante sans attendre le prochain battement
        channel.send(LIVE_LOCATION_EVENTS.request, {});
        // Côté chauffeur : demander au client (même non partageur) d'autoriser le partage.
        // L'écouteur global du client est abonné en permanence → un seul envoi suffit
        // (un retry rouvrirait la modale après acceptation).
        if (announceAsTaxi) {
          channel.send(LIVE_LOCATION_EVENTS.shareRequest, { driverName, ts: Date.now(), requesterRole: requesterRoleRef.current });
          // Détection hors ligne : pas d'accusé du client sous 5 s → pas en ligne
          if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
          offlineTimerRef.current = setTimeout(() => {
            if (!onlineSeenRef.current) setTargetOnline(false);
          }, 5000);
        }
        // Envoyer immédiatement notre position (chauffeur) si disponible
        sendDriverPosition();
      }
    });

    // Battement : rediffuse régulièrement la position du taxi pour que le client
    // (même abonné tardivement ou GPS chauffeur statique) la reçoive de façon fiable.
    const heartbeat = announceAsTaxi
      ? setInterval(sendDriverPosition, 8000)
      : null;

    return () => {
      if (heartbeat) clearInterval(heartbeat);
      if (offlineTimerRef.current) { clearTimeout(offlineTimerRef.current); offlineTimerRef.current = null; }
      subscribedRef.current = false;
      channelRef.current = null;
      channel.close();
    };
  }, [userId, announceAsTaxi, driverName, sendDriverPosition, maybeSendEnroute]);

  // Rediffuse immédiatement la position du chauffeur dès qu'elle change (réactivité)
  useEffect(() => {
    sendDriverPosition();
  }, [driverPosition, sendDriverPosition]);

  // Dès que le chauffeur confirme la localisation (notifyClient), notifier le client
  useEffect(() => {
    maybeSendEnroute();
  }, [notifyClient, maybeSendEnroute]);

  return { position, connected, sharerStopped, clientResponse, clientProfile, targetOnline };
}
