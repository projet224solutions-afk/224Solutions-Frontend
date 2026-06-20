/**
 * USER TRACKER - 224SOLUTIONS
 * Composant pour tracker la position d'un utilisateur en temps réel
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, X, Navigation, Clock, User, Radio, Store, Phone, MapPin, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTrackLocation } from "@/hooks/useLiveLocation";
import { extractUserId, formatElapsed, type SharedProfile } from "@/lib/liveLocation";
import { GPS_CONFIG } from "@/services/gps/PrecisionGeolocationService";
import { TaxiMotoService } from "@/services/taxi/TaxiMotoService";
import { resolveTrackingTarget } from "@/services/taxiTrackingService";
import { sendLocateRequest } from "@/services/pushBackendService";
import { calculateDistance } from "@/hooks/useGeoDistance";

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// Numéro de téléphone : uniquement chiffres / séparateurs / +, au moins 7 caractères.
// (Les custom_id type CLT0005/DRV1234 contiennent des lettres → exclus.)
const PHONE_RE = /^\+?[\d\s().-]{7,}$/;

/** Variantes d'un numéro pour la recherche (avec/sans +, sans séparateurs, sans 00). */
function phoneVariants(raw: string): string[] {
  const compact = raw.replace(/[\s().-]/g, '');
  const digits = compact.replace(/[^\d]/g, '');
  const withPlus = digits ? `+${digits}` : '';
  const noPrefix = digits.startsWith('00') ? digits.slice(2) : digits;
  return Array.from(new Set([raw.trim(), compact, digits, withPlus, noPrefix].filter(Boolean)));
}

interface TrackedUser {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  lastLat?: number;
  lastLng?: number;
  lastSeen?: string;
  isOnline?: boolean;
  status?: string;
  vehicleType?: string;
}

interface UserTrackerProps {
  /** Nom du chauffeur, transmis au client dans la notification "taxi en route". */
  driverName?: string;
  /**
   * ID du chauffeur taxi (taxi_drivers). Si fourni : active le « mode course » —
   * le chauffeur passe occupé (masqué de la recherche) à la confirmation et le
   * suivi reste actif jusqu'à « Course terminée ».
   */
  driverId?: string | null;
  /** Notifie le parent quand une course est active (pour empêcher la fermeture du dialog). */
  onActiveChange?: (active: boolean) => void;
  /** Appelé quand le chauffeur clique « Course terminée » (le parent ferme le dialog). */
  onFinish?: () => void;
  /**
   * 'taxi' (défaut) : le chauffeur navigue vers le client.
   * 'merchant' : vendeur/service — le CLIENT navigue vers nous, on voit le client approcher.
   */
  mode?: 'taxi' | 'merchant';
}

export function UserTracker({ driverName, driverId, onActiveChange, onFinish, mode = 'taxi' }: UserTrackerProps = {}) {
  const { t } = useTranslation();
  const isMerchant = mode === 'merchant';
  const [userId, setUserId] = useState('');
  const [trackedUser, setTrackedUser] = useState<TrackedUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  // Le chauffeur a vu la fiche du client et confirmé la localisation
  const [localizationConfirmed, setLocalizationConfirmed] = useState(false);
  // Fiche du client chargée DIRECTEMENT par le chauffeur (profils publics, fiable)
  const [localProfile, setLocalProfile] = useState<SharedProfile | null>(null);
  // Le client a refusé la demande de localisation
  const [clientDeclined, setClientDeclined] = useState(false);

  // Position GPS du chauffeur (origine de l'itinéraire vers le client)
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);

  // Suivi de la position partagée. On s'abonne pour recevoir la fiche + la position,
  // mais on ne notifie le client (taxi_enroute) qu'APRÈS confirmation de la fiche.
  const live = useTrackLocation(isTracking ? trackedUser?.id ?? null : null, {
    announceAsTaxi: true,
    notifyClient: localizationConfirmed,
    driverName,
    driverPosition: myLocation,
    requesterRole: isMerchant ? 'merchant' : 'driver',
  });

  // La position en direct (broadcast) prime sur la dernière position connue en base
  const displayLat = live.position?.lat ?? trackedUser?.lastLat;
  const displayLng = live.position?.lng ?? trackedUser?.lastLng;
  const isLive = !!live.position;

  // Indique qu'on a une position FIXE de boutique (mode marchand) → le GPS navigateur ne
  // doit pas l'écraser (le client doit venir À LA BOUTIQUE, pas à la position du téléphone).
  const shopCoordsLockedRef = useRef(false);

  // Suivre la position du chauffeur tant que le tracking est actif.
  // En mode marchand, le GPS sert seulement de repli si la boutique n'a pas de coordonnées.
  useEffect(() => {
    if (!isTracking || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setMyLocation((prev) => {
        // Mode marchand : la position fixe de la boutique prime → ne pas écraser.
        if (isMerchant && shopCoordsLockedRef.current) return prev;
        return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      }),
      () => { /* GPS indisponible : en marchand, on garde les coords boutique */ },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTracking, isMerchant]);

  // 🏬 MODE MARCHAND : la position du vendeur = coordonnées ENREGISTRÉES de la boutique
  // (fixe et fiable). Sans ça, si le GPS du navigateur du vendeur échoue, le client reste
  // bloqué sur « En attente de la position du vendeur… » et le vendeur ne voit pas le client.
  useEffect(() => {
    if (!isMerchant) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data: v } = await supabase
          .from('vendors')
          .select('latitude, longitude')
          .eq('user_id', user.id)
          .maybeSingle();
        const lat = v?.latitude != null ? Number(v.latitude) : null;
        const lng = v?.longitude != null ? Number(v.longitude) : null;
        if (!cancelled && lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
          shopCoordsLockedRef.current = true;       // la boutique prime sur le GPS navigateur
          setMyLocation({ lat, lng });
        }
      } catch { /* pas de coords boutique → repli GPS navigateur */ }
    })();
    return () => { cancelled = true; };
  }, [isMerchant]);

  // ===== Mode course (taxi) : statut occupé + course persistante =====
  // Garde l'état "course active" et la dernière position sans recréer les callbacks
  const courseActiveRef = useRef(false);
  const myLocationRef = useRef(myLocation);
  useEffect(() => { myLocationRef.current = myLocation; }, [myLocation]);

  // À la confirmation de la localisation : passer le chauffeur OCCUPÉ
  // → il disparaît de la recherche "taxi disponible" des clients.
  useEffect(() => {
    if (driverId && localizationConfirmed && !courseActiveRef.current) {
      courseActiveRef.current = true;
      onActiveChange?.(true);
      const loc = myLocationRef.current;
      TaxiMotoService.updateDriverStatus(driverId, true, false, loc?.lat, loc?.lng)
        .catch((e) => console.error('Statut occupé non appliqué:', e));
    }
  }, [driverId, localizationConfirmed, onActiveChange]);

  // Fin de course : restaurer la disponibilité (le client le revoit dans la recherche)
  const endCourse = useCallback(() => {
    if (driverId && courseActiveRef.current) {
      courseActiveRef.current = false;
      const loc = myLocationRef.current;
      TaxiMotoService.updateDriverStatus(driverId, true, true, loc?.lat, loc?.lng)
        .catch((e) => console.error('Disponibilité non restaurée:', e));
    }
    onActiveChange?.(false);
  }, [driverId, onActiveChange]);

  // Sécurité : restaurer la disponibilité si le composant est démonté en pleine course
  useEffect(() => endCourse, [endCourse]);

  // Client hors ligne → envoyer un push pour qu'il ouvre l'app (une seule fois)
  const pushSentRef = useRef(false);
  useEffect(() => {
    if (live.targetOnline === false && trackedUser?.id && !pushSentRef.current) {
      pushSentRef.current = true;
      sendLocateRequest(trackedUser.id, driverName)
        .then((r) => {
          const delivered = (r as any)?.delivered ?? (r?.data as any)?.delivered;
          if (r?.success && delivered !== false) {
            toast.info(t('userTracker.notificationEnvoyeeAuClientPour'));
          }
        })
        .catch(() => { /* push best-effort */ });
    }
    if (live.targetOnline === true) pushSentRef.current = false; // réarmer si re-déconnexion
  }, [live.targetOnline, trackedUser?.id, driverName]);

  // Feedback : le client a confirmé ou refusé le partage de sa position
  useEffect(() => {
    if (live.clientResponse === 'confirmed') {
      toast.success(t('userTracker.leClientAConfirmeLe'));
      setClientDeclined(false);
    } else if (live.clientResponse === 'declined') {
      toast.warning(t('userTracker.leClientARefuseLa'));
      setClientDeclined(true);
    }
  }, [live.clientResponse]);

  const hasClientPosition = Number.isFinite(displayLat) && Number.isFinite(displayLng);

  // ===== Mode vendeur/service : on regarde le CLIENT approcher de NOUS =====
  const clientDistanceKm = (isMerchant && hasClientPosition && myLocation)
    ? calculateDistance(displayLat!, displayLng!, myLocation.lat, myLocation.lng)
    : null;
  const merchantEtaMin = clientDistanceKm !== null ? Math.max(1, Math.round((clientDistanceKm / 15) * 60)) : null;
  const merchantArrived = clientDistanceKm !== null && clientDistanceKm <= 0.02; // ~20 m
  const merchantMapSrc = (isMerchant && hasClientPosition && myLocation)
    ? `https://maps.google.com/maps?saddr=${displayLat},${displayLng}&daddr=${myLocation.lat},${myLocation.lng}&output=embed`
    : null;

  // Fermeture auto à l'arrivée du client (≤ ~20 m) côté vendeur
  useEffect(() => {
    if (isMerchant && merchantArrived) {
      const t = setTimeout(() => { stopTracking(); onFinish?.(); }, 1500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMerchant, merchantArrived]);

  // Carte d'itinéraire intégrée (s'ouvre automatiquement dès la localisation)
  const embedSrc = hasClientPosition
    ? (myLocation
        ? `https://maps.google.com/maps?saddr=${myLocation.lat},${myLocation.lng}&daddr=${displayLat},${displayLng}&output=embed`
        : `https://maps.google.com/maps?q=${displayLat},${displayLng}&z=16&output=embed`)
    : null;

  // Lien de navigation GPS turn-by-turn (application Google Maps).
  // dir_action=navigate → lance DIRECTEMENT le guidage vocal (sur mobile),
  // sans aperçu ni saisie : le chauffeur est guidé immédiatement vers le client.
  const navUrl = hasClientPosition
    ? (myLocation
        ? `https://www.google.com/maps/dir/?api=1&origin=${myLocation.lat},${myLocation.lng}&destination=${displayLat},${displayLng}&travelmode=driving&dir_action=navigate`
        : `https://www.google.com/maps/dir/?api=1&destination=${displayLat},${displayLng}&travelmode=driving&dir_action=navigate`)
    : null;

  // NB : on n'ouvre PLUS Google Maps automatiquement. La carte d'itinéraire reste
  // affichée DANS l'app (carte intégrée ci-dessous). Le chauffeur ouvre Google Maps
  // uniquement s'il le souhaite, via le bouton « Démarrer la navigation GPS ».

  /**
   * Rechercher et charger les données d'un utilisateur
   */
  /**
   * Charge directement la fiche du client (profil public + boutique éventuelle)
   * à partir de l'ID saisi — fiable, sans dépendre de la diffusion du client.
   */
  const loadClientProfile = async (rawId: string) => {
    setLocalProfile(null);
    const isUuid = UUID_RE.test(rawId);
    const sel = 'id, first_name, last_name, full_name, phone, avatar_url, city, country, custom_id';
    let prof: any = null;
    try {
      const query = isUuid
        ? supabase.from('profiles').select(sel).eq('id', rawId)
        : supabase.from('profiles').select(sel).ilike('custom_id', rawId);
      const { data } = await query.maybeSingle();
      prof = data;
    } catch { /* profil non lisible → on retombera sur la diffusion du client */ }

    if (!prof) return;

    let vendor: any = null;
    try {
      const { data } = await supabase
        .from('vendors')
        .select('business_name, address, city, neighborhood, phone, logo_url')
        .eq('user_id', prof.id)
        .maybeSingle();
      vendor = data;
    } catch { /* pas de boutique */ }

    const isShop = !!vendor;
    setLocalProfile({
      name: prof.full_name || `${prof.first_name || ''} ${prof.last_name || ''}`.trim() || 'Client',
      phone: vendor?.phone || prof.phone || undefined,
      address: isShop
        ? [vendor?.address, vendor?.neighborhood, vendor?.city].filter(Boolean).join(', ') || undefined
        : [prof.city, prof.country].filter(Boolean).join(', ') || undefined,
      photo: vendor?.logo_url || prof.avatar_url || undefined,
      customId: prof.custom_id || undefined,
      isShop,
      shopName: vendor?.business_name || undefined,
    });
  };

  const trackUser = async () => {
    // Accepte un ID brut, un UUID collé ou un lien …/track/<id>
    const raw = extractUserId(userId);
    if (!raw) {
      toast.error(t('userTracker.veuillezSaisirUnIdOu'));
      return;
    }

    setLocalizationConfirmed(false); // on doit d'abord revoir la fiche du client
    setClientDeclined(false);
    setLoading(true);

    // Résolution via backend (service role) : vérifie que le compte est ACTIF.
    // Un compte SUPPRIMÉ n'existe plus dans profiles/user_ids → 'not_found' → on refuse.
    // Gère aussi ID / UUID / custom_id / téléphone / email et renvoie la fiche.
    let id = raw;
    let preloadedProfile = false;
    const resolved = await resolveTrackingTarget(raw);
    if (resolved) {
      if (resolved.status !== 'active') {
        setLoading(false);
        toast.error(t('userTracker.compteIntrouvableIlEstPeut'));
        return;
      }
      if (resolved.trackingKey) id = resolved.trackingKey;
      if (resolved.profile) { setLocalProfile(resolved.profile); preloadedProfile = true; }
    } else {
      // Repli si le backend est injoignable : résolution locale du téléphone uniquement
      try {
        if (!UUID_RE.test(raw) && PHONE_RE.test(raw)) {
          const variants = phoneVariants(raw);
          const filter = variants.map((v) => `phone.eq.${v}`).join(',');
          const { data: byPhone } = await supabase
            .from('profiles').select('id').or(filter).limit(1).maybeSingle();
          if (!byPhone?.id) {
            setLoading(false);
            toast.error(t('userTracker.aucunClientTrouveAvecCe'));
            return;
          }
          id = byPhone.id as string;
        }
      } catch {
        setLoading(false);
        toast.error(t('userTracker.erreurLorsDeLaRecherche'));
        return;
      }
    }

    if (!preloadedProfile) void loadClientProfile(id); // charge la fiche si pas déjà fournie
    try {
      console.log('🔍 Recherche utilisateur:', id);

      // 1. Vérifier si c'est un chauffeur taxi
      const { data: driverData, error: _driverError } = await supabase
        .from('taxi_drivers')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();

      if (driverData) {
        console.log('✅ Chauffeur trouvé:', driverData);

        // Charger le profil pour le nom
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, phone')
          .eq('id', id)
          .single();

        setTrackedUser({
          id,
          firstName: profile?.first_name,
          lastName: profile?.last_name,
          phone: profile?.phone,
          lastLat: driverData.last_lat,
          lastLng: driverData.last_lng,
          lastSeen: driverData.last_seen,
          isOnline: driverData.is_online,
          status: driverData.status,
          vehicleType: driverData.vehicle_type
        });

        setIsTracking(true);
        toast.success(t('userTracker.utilisateurTrouveTrackingActif'));
        return;
      }

      // 2. Sinon chercher dans les profils généraux
      const { data: profileData, error: _profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (profileData) {
        console.log('✅ Utilisateur trouvé:', profileData);
        setTrackedUser({
          id,
          firstName: profileData.first_name,
          lastName: profileData.last_name,
          phone: profileData.phone
        });
        setIsTracking(true);
        toast.success(t('userTracker.clientTrouveEnAttenteDe'));
        return;
      }

      // 3. Profil introuvable mais on peut quand même suivre la position
      //    partagée en direct (le client a peut-être juste donné son ID/lien).
      setTrackedUser({ id });
      setIsTracking(true);
      toast.success(t('userTracker.suiviDeLaPositionEn'));

    } catch (error) {
      console.error('❌ Erreur lors du tracking:', error);
      toast.error(t('userTracker.erreurLorsDeLaRecherche'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Arrêter le tracking
   */
  const stopTracking = () => {
    endCourse();
    setTrackedUser(null);
    setIsTracking(false);
    setLocalizationConfirmed(false);
    setLocalProfile(null);
    setUserId('');
    toast.info(t('userTracker.trackingArrete'));
  };

  // « Course terminée » : clôt la course et demande au parent de fermer la vue
  const finishCourse = () => {
    endCourse();
    setTrackedUser(null);
    setIsTracking(false);
    setLocalizationConfirmed(false);
    setLocalProfile(null);
    setUserId('');
    toast.success(t('userTracker.courseTerminee'));
    onFinish?.();
  };

  // Fiche affichée : priorité à la lecture directe (UUID), repli sur la diffusion du client
  const clientProfile = localProfile || live.clientProfile;

  /**
   * S'abonner aux mises à jour en temps réel
   */
  useEffect(() => {
    if (!trackedUser?.id || !isTracking) return;

    console.log('📡 Démarrage du tracking temps réel pour:', trackedUser.id);

    // S'abonner aux changements du conducteur
    const channel = supabase
      .channel(`user-tracking-${trackedUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'taxi_drivers',
          filter: `user_id=eq.${trackedUser.id}`
        },
        (payload) => {
          console.log('📍 Position mise à jour:', payload.new);
          const updated = payload.new as any;
          setTrackedUser(prev => prev ? {
            ...prev,
            lastLat: updated.last_lat,
            lastLng: updated.last_lng,
            lastSeen: updated.last_seen,
            isOnline: updated.is_online,
            status: updated.status
          } : null);
          toast.success(t('userTracker.positionMiseAJour'));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trackedUser?.id, isTracking]);

  /**
   * Ouvrir Google Maps avec la position
   */
  const openInMaps = () => {
    if (!navUrl) {
      toast.error('Position GPS non disponible');
      return;
    }
    window.open(navUrl, '_blank', 'noopener');
  };

  /**
   * Formater la date de dernière vue
   */
  const formatLastSeen = (dateString?: string) => {
    if (!dateString) return 'Jamais';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    return `Il y a ${diffDays}j`;
  };

  return (
    <div className="space-y-4">
        {/* Formulaire de recherche */}
        {!isTracking && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder={t('userTracker.idTelephoneOuLienDe')}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="font-mono text-sm"
                onKeyDown={(e) => e.key === 'Enter' && trackUser()}
              />
              <Button
                onClick={trackUser}
                disabled={loading}
                className="shrink-0"
              >
                <Search className="w-4 h-4 mr-2" />
                {loading ? 'Recherche...' : 'Suivre'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              💡 Saisissez l'<strong>ID</strong>{t('userTracker.le')} <strong>{t('userTracker.numeroDeTelephone')}</strong> {t('userTracker.ouLe')} <strong>lien</strong> du client pour voir sa position en temps réel
            </p>
          </div>
        )}

        {/* Étape 1 : fiche du client/boutique à confirmer AVANT la localisation */}
        {isTracking && !localizationConfirmed && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                {clientProfile?.isShop
                  ? <Store className="w-5 h-5 text-primary" />
                  : <User className="w-5 h-5 text-primary" />}
                {clientProfile?.isShop ? 'Boutique à localiser' : 'Client à localiser'}
              </h3>
              <Button variant="ghost" size="sm" onClick={stopTracking} className="text-[#ff4000] hover:bg-orange-50">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {clientDeclined ? (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center text-sm text-[#ff4000]">
                ❌ Le client a refusé la demande de localisation.
              </div>
            ) : !clientProfile ? (
              <div className="bg-muted/40 border rounded-lg p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                En attente de l'autorisation du client…
              </div>
            ) : (
              <div className="rounded-lg border bg-card p-3 space-y-3">
                <div className="flex items-center gap-3">
                  {clientProfile.photo ? (
                    <img src={clientProfile.photo} alt="" className="w-14 h-14 rounded-full object-cover border" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                      {clientProfile.isShop
                        ? <Store className="w-6 h-6 text-primary" />
                        : <User className="w-6 h-6 text-primary" />}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {clientProfile.shopName || clientProfile.name || 'Client'}
                    </p>
                    {clientProfile.isShop && clientProfile.name && (
                      <p className="text-xs text-muted-foreground truncate">Gérant : {clientProfile.name}</p>
                    )}
                    {clientProfile.customId && (
                      <p className="text-[11px] font-mono text-muted-foreground">ID : {clientProfile.customId}</p>
                    )}
                    {clientProfile.isShop && (
                      <Badge variant="outline" className="mt-1 text-[10px]">{t('userTracker.boutique')}</Badge>
                    )}
                  </div>
                </div>
                {clientProfile.phone && (
                  <div className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a href={`tel:${clientProfile.phone}`} className="font-medium">{clientProfile.phone}</a>
                  </div>
                )}
                {clientProfile.address && (
                  <div className="flex items-start gap-2 text-sm bg-muted/50 p-2 rounded">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <span>{clientProfile.address}</span>
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
              Vérifiez les informations puis confirmez pour démarrer la localisation en temps réel.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => setLocalizationConfirmed(true)} className="w-full">
                <Navigation className="w-4 h-4 mr-2" />
                Confirmer la localisation
              </Button>
              <Button variant="outline" onClick={stopTracking} className="w-full">
                Annuler
              </Button>
            </div>
          </div>
        )}

        {/* Étape 2 : suivi en temps réel (après confirmation de la fiche) */}
        {trackedUser && isTracking && localizationConfirmed && (
          <div className="space-y-3">
            {/* En-tête avec nom et badges */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-5 h-5 text-gray-600" />
                  <h3 className="font-bold text-lg">
                    {trackedUser.firstName || 'Utilisateur'} {trackedUser.lastName || ''}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground font-mono mb-2">
                  ID: {trackedUser.id}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {trackedUser.isOnline !== undefined && (
                    <Badge variant={trackedUser.isOnline ? "default" : "secondary"}>
                      {trackedUser.isOnline ? '🟢 En ligne' : '🔴 Hors ligne'}
                    </Badge>
                  )}
                  {trackedUser.status && (
                    <Badge variant="outline">
                      {trackedUser.status === 'available' && '✅ Disponible'}
                      {trackedUser.status === 'on_trip' && '🚗 En course'}
                      {trackedUser.status === 'offline' && '⏸️ Hors ligne'}
                    </Badge>
                  )}
                  {trackedUser.vehicleType && (
                    <Badge variant="outline">
                      🏍️ {trackedUser.vehicleType}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={stopTracking}
                className="text-[#ff4000] hover:text-[#ff4000] hover:bg-orange-50"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Contact */}
            {trackedUser.phone && (
              <div className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded">
                <span className="text-muted-foreground">📱</span>
                <span className="font-medium">{trackedUser.phone}</span>
              </div>
            )}

            {/* Position GPS — exiger des nombres FINIS (lastLat/lastLng peuvent être null en
                base → null.toFixed plantait après confirmation de position). */}
            {Number.isFinite(displayLat) && Number.isFinite(displayLng) ? (
              isMerchant ? (
              /* MODE VENDEUR/SERVICE : on voit le client approcher de nous */
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900 flex items-center gap-2">
                    🚶 {merchantArrived ? 'Client arrivé !' : 'Le client arrive vers vous'}
                    {isLive && (
                      <Badge variant="default" className="bg-blue-500 text-[10px] h-4 px-1.5">EN DIRECT</Badge>
                    )}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-blue-700">
                    <Clock className="w-3 h-3" />
                    {isLive ? formatElapsed(live.position?.ts) : '—'}
                  </div>
                </div>
                {clientDistanceKm !== null && !merchantArrived && (
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded border p-2 bg-white/60">
                      <div className="text-base font-bold text-blue-700">{clientDistanceKm.toFixed(clientDistanceKm < 1 ? 2 : 1)} km</div>
                      <div className="text-[10px] text-muted-foreground">Distance</div>
                    </div>
                    <div className="rounded border p-2 bg-white/60">
                      <div className="text-base font-bold text-blue-700">{merchantEtaMin} min</div>
                      <div className="text-[10px] text-muted-foreground">{t('userTracker.arriveeEstimee')}</div>
                    </div>
                  </div>
                )}
                {merchantMapSrc && !merchantArrived && (
                  <div className="rounded-lg overflow-hidden border border-blue-200 aspect-video bg-white">
                    <iframe title={t('userTracker.leClientEnRouteVers')} width="100%" height="100%" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={merchantMapSrc} />
                  </div>
                )}
                {merchantArrived ? (
                  <p className="text-sm text-center text-[#ff4000] font-medium">{t('userTracker.leClientEstArriveA')}</p>
                ) : (
                  <div className="text-xs font-mono text-blue-800 bg-white/50 p-2 rounded border border-blue-100">
                    📍 Client : {displayLat.toFixed(6)}, {displayLng.toFixed(6)}
                    {isLive && live.position?.accuracy ? ` (±${Math.round(live.position.accuracy)} m)` : ''}
                  </div>
                )}
              </div>
              ) : (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#ff4000] flex items-center gap-2">
                    📍 Position GPS
                    {isLive && (
                      <Badge variant="default" className="bg-[#ff4000] text-[10px] h-4 px-1.5">
                        EN DIRECT
                      </Badge>
                    )}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-[#ff4000]">
                    <Clock className="w-3 h-3" />
                    {isLive ? formatElapsed(live.position?.ts) : formatLastSeen(trackedUser.lastSeen)}
                  </div>
                </div>

                {/* Itinéraire : la navigation s'ouvre automatiquement dès la localisation */}
                {embedSrc && (
                  <div className="rounded-lg overflow-hidden border border-orange-200 aspect-video bg-white">
                    <iframe
                      title={t('userTracker.itineraireVersLeClient')}
                      width="100%"
                      height="100%"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      src={embedSrc}
                    />
                  </div>
                )}

                <div className="text-xs font-mono text-[#ff4000] bg-white/50 p-2 rounded border border-orange-100 space-y-0.5">
                  <div>
                    📍 Client : {displayLat.toFixed(6)}, {displayLng.toFixed(6)}
                    {isLive && live.position?.accuracy ? ` (±${Math.round(live.position.accuracy)} m)` : ''}
                  </div>
                  {myLocation ? (
                    <div>
                      🛵 Vous : {myLocation.lat.toFixed(6)}, {myLocation.lng.toFixed(6)}
                      {myLocation.accuracy ? ` (±${Math.round(myLocation.accuracy)} m)` : ''}
                    </div>
                  ) : (
                    <div className="text-[#ff4000]">{t('userTracker.activezVotreGpsPourAfficher')}</div>
                  )}
                  {((live.position?.accuracy ?? 0) > GPS_CONFIG.ACCEPTABLE_ACCURACY_METERS
                    || (myLocation?.accuracy ?? 0) > GPS_CONFIG.ACCEPTABLE_ACCURACY_METERS) && (
                    <div className="text-[#ff4000]">{t('userTracker.signalGpsFaibleLaPrecision')}</div>
                  )}
                </div>

                <Button
                  onClick={openInMaps}
                  className="w-full"
                  size="sm"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  {myLocation ? "Démarrer la navigation GPS" : "Ouvrir dans Google Maps"}
                </Button>
              </div>
              )
            ) : live.targetOnline === false ? (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <p className="text-sm font-medium text-[#ff4000]">
                  📴 L'utilisateur n'est pas en ligne
                </p>
                <p className="text-xs text-[#ff4000] mt-1">
                  Il n'a pas de connexion Internet ou l'application est fermée. Réessayez quand il sera en ligne.
                </p>
              </div>
            ) : (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                <p className="text-sm text-[#ff4000]">
                  ⏳ En attente de la position partagée
                </p>
                <p className="text-xs text-[#ff4000] mt-1">
                  {live.targetOnline === true
                    ? 'Utilisateur en ligne ✓ — en attente de sa confirmation de partage.'
                    : 'Vérification de la présence du client…'}
                </p>
              </div>
            )}

            {/* Indicateur de tracking actif */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
              <p className="text-xs text-blue-800 font-medium flex items-center justify-center gap-2">
                <Radio className="w-3 h-3 animate-pulse" />
                {live.connected ? 'Connecté — suivi en temps réel actif' : 'Connexion au canal de suivi…'}
                {live.sharerStopped && ' (partage arrêté par le client)'}
              </p>
            </div>

            {/* Course terminée : restaure la disponibilité du chauffeur (mode course taxi) */}
            {driverId && (
              <Button
                onClick={finishCourse}
                className="w-full bg-[#ff4000] hover:bg-[#ff4000] text-white"
                size="lg"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                Course terminée
              </Button>
            )}
          </div>
        )}
    </div>
  );
}
