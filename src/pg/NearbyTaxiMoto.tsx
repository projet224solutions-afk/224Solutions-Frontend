/**
 * NEARBY TAXI-MOTO PAGE
 * Liste des taxi-motos disponibles à proximité
 * 224Solutions - Production Ready v4 (Uber/Bolt Grade)
 *
 * Optimisations appliquées:
 * ✓ Comparaison des distances arrondies (évite re-renders sur micro-changements)
 * ✓ Dépendances React corrigées (pas de drivers.length dans useCallback)
 * ✓ Logique refresh unifiée (refreshPosition déclenche loadDrivers)
 * ✓ Intervalle secondes unique (ref pour lastUpdated)
 * ✓ Annulation des requêtes (AbortController)
 * ✓ Auto-refresh intelligent (visibilityState)
 * ✓ Protection memory leaks complète
 * ✓ Protection contre requêtes parallèles
 * ✓ Anti-spam sur bouton refresh
 * ✓ Aucune recréation d'intervalle inutile
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Car,
  Navigation,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import QuickFooter from "@/components/QuickFooter";
import { useGeoDistance } from "@/hooks/useGeoDistance";
import {
  type TaxiDriver,
  processTaxiDriver,
  filterDriversByRadius,
  sortDrivers,
  createProfileMap,
} from '@/lib/drivers';
import { TaxiDriversList } from '@/components/drivers';

// ============================================================================
// Constants
// ============================================================================

const RADIUS_KM = 20;
const AUTO_REFRESH_INTERVAL = 20000; // 20 secondes
const MAX_DRIVERS_LIMIT = 100;
const REFRESH_COOLDOWN = 2000; // 2 secondes entre les clics manuels

// ============================================================================
// Utility: Compare driver arrays avec distances arrondies
// ============================================================================

/**
 * Compare deux arrays de drivers en arrondissant les distances
 * pour éviter les re-renders sur des micro-changements de float
 */
function areDriversEqual(prev: TaxiDriver[], next: TaxiDriver[]): boolean {
  if (prev.length !== next.length) return false;

  for (let i = 0; i < prev.length; i++) {
    const p = prev[i];
    const n = next[i];

    // ✓ Arrondir les distances à 2 décimales (centièmes de km = 10m)
    const pDistanceRounded = p.distance !== undefined ? Math.round(p.distance * 100) : -1;
    const nDistanceRounded = n.distance !== undefined ? Math.round(n.distance * 100) : -1;

    // ✓ Arrondir les ratings à 1 décimale
    const pRatingRounded = p.rating !== null ? Math.round(p.rating * 10) : -1;
    const nRatingRounded = n.rating !== null ? Math.round(n.rating * 10) : -1;

    if (
      p.id !== n.id ||
      p.status !== n.status ||
      p.is_online !== n.is_online ||
      pDistanceRounded !== nDistanceRounded ||
      pRatingRounded !== nRatingRounded
    ) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Composant principal
// ============================================================================

export default function NearbyTaxiMoto() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // ===========================================================================
  // State
  // ===========================================================================
  const [drivers, setDrivers] = useState<TaxiDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  // ===========================================================================
  // Refs pour protection memory leaks, requêtes et intervalles
  // ===========================================================================
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const autoRefreshRef = useRef<number | null>(null);
  const secondsIntervalRef = useRef<number | null>(null);
  const lastRefreshClickRef = useRef<number>(0);
  const lastUpdatedRef = useRef<Date | null>(null); // ✓ Ref au lieu de state pour éviter recréation d'intervalle
  const driversRef = useRef<TaxiDriver[]>([]); // ✓ Ref pour accès dans catch sans dépendance

  // Géolocalisation centralisée
  const { userPosition, positionReady, refreshPosition } = useGeoDistance();

  // ===========================================================================
  // Fonction de chargement optimisée avec AbortController
  // ===========================================================================
  const loadDrivers = useCallback(async (isAutoRefresh = false) => {
    // ✓ Protection contre les requêtes parallèles
    if (isFetchingRef.current) return;
    if (!positionReady) return;

    // ✓ Annuler la requête précédente si elle existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // ✓ Créer un nouveau AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    isFetchingRef.current = true;

    // ✓ Activer le loading UNIQUEMENT pour le premier chargement
    if (!isAutoRefresh) {
      setLoading(true);
      setError(null);
    }

    try {
      const position = { lat: userPosition.latitude, lng: userPosition.longitude };

      const { data, error: queryError } = await supabase
        .from('taxi_drivers')
        .select(`
          id,
          user_id,
          vehicle_type,
          vehicle_plate,
          taxi_category,
          rating,
          total_rides,
          status,
          is_online,
          last_lat,
          last_lng
        `)
        .eq('is_online', true)
        .limit(MAX_DRIVERS_LIMIT)
        .abortSignal(abortController.signal);

      // ✓ Vérifier si la requête a été annulée ou composant démonté
      if (abortController.signal.aborted || !isMountedRef.current) return;

      if (queryError) throw new Error(`Erreur: ${queryError.message}`);

      const rawData = (data || []) as Array<Record<string, unknown>>;

      // Récupération des profils séparément (pas de FK dans le schema cache)
      const userIds = rawData.map(d => d.user_id).filter(Boolean) as string[];
      let profileMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, phone, avatar_url')
          .in('id', userIds)
          .abortSignal(abortController.signal);
        if (!abortController.signal.aborted && isMountedRef.current) {
          profileMap = createProfileMap((profilesData || []) as Array<Record<string, unknown>>);
        }
      }

      const processedDrivers: TaxiDriver[] = [];
      for (const raw of rawData) {
        processedDrivers.push(processTaxiDriver(raw, position, profileMap));
      }

      const filtered = filterDriversByRadius(processedDrivers, RADIUS_KM);
      const sorted = sortDrivers(filtered) as TaxiDriver[];

      // ✓ Vérifier à nouveau si annulé ou démonté
      if (abortController.signal.aborted || !isMountedRef.current) return;

      // ✓ Mettre à jour uniquement si les données ont changé
      setDrivers(prevDrivers => {
        if (areDriversEqual(prevDrivers, sorted)) {
          return prevDrivers; // Pas de changement, pas de re-render
        }
        driversRef.current = sorted; // Sync ref
        return sorted;
      });

      // ✓ Mettre à jour le timestamp via ref (pas de recréation d'intervalle)
      lastUpdatedRef.current = new Date();
      setSecondsAgo(0);

      // Clear l'erreur en cas de succès
      setError(null);

    } catch (err) {
      // ✓ Ignorer les erreurs d'annulation
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      if (!isMountedRef.current) return;

      console.error('Error loading taxi drivers:', err);

      // ✓ Ne pas écraser les données existantes en cas d'erreur d'auto-refresh
      // Utiliser driversRef au lieu de drivers.length pour éviter la dépendance
      if (!isAutoRefresh || driversRef.current.length === 0) {
        setError(err instanceof Error ? err.message: t('nearbyTaxiMoto.erreurLorsDuChargement'));
      }
    } finally {
      if (isMountedRef.current) {
        isFetchingRef.current = false;
        if (!isAutoRefresh) {
          setLoading(false);
        }
      }
    }
  // ✓ Dépendances corrigées: pas de drivers.length
  }, [positionReady, userPosition.latitude, userPosition.longitude]);

  // ===========================================================================
  // Chargement initial et rechargement sur changement de position
  // ===========================================================================
  useEffect(() => {
    if (positionReady) {
      loadDrivers(false);
    }
  }, [positionReady, userPosition.latitude, userPosition.longitude, loadDrivers]);

  // ===========================================================================
  // Auto-refresh intelligent avec visibilityState
  // ===========================================================================
  useEffect(() => {
    if (!positionReady) return;

    // ✓ Fonction de refresh conditionnelle
    const doAutoRefresh = () => {
      // Ne pas rafraëchir si l'onglet n'est pas visible
      if (document.visibilityState !== 'visible') return;
      if (!isMountedRef.current) return;

      loadDrivers(true);
    };

    // ✓ Handler pour le changement de visibilité
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMountedRef.current) {
        // Rafraëchir immédiatement quand l'onglet redevient visible
        loadDrivers(true);
      }
    };

    // Créer l'intervalle
    autoRefreshRef.current = window.setInterval(doAutoRefresh, AUTO_REFRESH_INTERVAL);

    // Écouter les changements de visibilité
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (autoRefreshRef.current !== null) {
        window.clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [positionReady, loadDrivers]);

  // ===========================================================================
  // Compteur "Mis à jour il y a X secondes" - Intervalle unique
  // ===========================================================================
  useEffect(() => {
    // ✓ Créer un seul intervalle au montage
    secondsIntervalRef.current = window.setInterval(() => {
      if (!isMountedRef.current) return;

      // ✓ Utiliser la ref au lieu du state pour éviter les dépendances
      const lastUpdated = lastUpdatedRef.current;
      if (lastUpdated) {
        const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
        setSecondsAgo(prev => {
          // ✓ Ne mettre à jour que si la valeur change
          if (prev !== diff) return diff;
          return prev;
        });
      }
    }, 1000);

    return () => {
      if (secondsIntervalRef.current !== null) {
        window.clearInterval(secondsIntervalRef.current);
        secondsIntervalRef.current = null;
      }
    };
  }, []); // ✓ Aucune dépendance = intervalle créé une seule fois

  // ===========================================================================
  // Cleanup complet au démontage
  // ===========================================================================
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // ✓ Annuler toute requête en cours
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // ✓ Nettoyer les intervalles
      if (autoRefreshRef.current !== null) {
        window.clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
      if (secondsIntervalRef.current !== null) {
        window.clearInterval(secondsIntervalRef.current);
        secondsIntervalRef.current = null;
      }
    };
  }, []);

  // ===========================================================================
  // Handlers
  // ===========================================================================

  // ✓ Rafraëchissement manuel - uniquement refreshPosition
  // Le chargement est déclenché automatiquement par le changement de position
  const handleRefresh = useCallback(async () => {
    const now = Date.now();

    // ✓ Protection anti-spam: 2 secondes minimum entre les clics
    if (now - lastRefreshClickRef.current < REFRESH_COOLDOWN) {
      return;
    }

    // ✓ Protection contre les requêtes parallèles
    if (isFetchingRef.current) {
      return;
    }

    lastRefreshClickRef.current = now;

    // ✓ Rafraëchir la position - loadDrivers sera appelé automatiquement
    // via l'effet qui écoute userPosition.latitude/longitude
    await refreshPosition();

    // ✓ Force un refresh immédiat après le refreshPosition
    // car la position peut ne pas avoir changé significativement
    await loadDrivers(false);
  }, [refreshPosition, loadDrivers]);

  const handleBookDriver = useCallback((driverId: string) => {
    navigate(`/taxi-moto?driver=${driverId}`);
  }, [navigate]);

  const handleBookNow = useCallback(() => {
    navigate('/taxi-moto');
  }, [navigate]);

  const handleRetry = useCallback(() => {
    loadDrivers(false);
  }, [loadDrivers]);

  // ===========================================================================
  // Formatage du temps écoulé
  // ===========================================================================
  const formatTimeAgo = (seconds: number): string => {
    if (seconds < 5) return 'À l\'instant';
    if (seconds < 60) return `Il y a ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `Il y a ${minutes}min`;
  };

  // ===========================================================================
  // Rendu
  // ===========================================================================

  const isRefreshDisabled = loading || isFetchingRef.current;
  const hasLastUpdated = lastUpdatedRef.current !== null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Car className="w-5 h-5 text-taxi-primary" />
                Taxis à Proximité
              </h1>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  {drivers.length} chauffeur{drivers.length !== 1 ? 's' : ''} dans un rayon de {RADIUS_KM} km
                </p>
                {hasLastUpdated && (
                  <span className="text-xs text-muted-foreground/70">
                    • {formatTimeAgo(secondsAgo)}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshDisabled}
              className="rounded-full"
              title="Actualiser"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Quick Book Button */}
        <Card className="bg-[#04439e] border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-white">
                <h3 className="font-semibold">{t('nearbyTaxiMoto.reserverUnTaxi')}</h3>
                <p className="text-sm opacity-90">{t('nearbyTaxiMoto.voitureOuMotoLePlus')}</p>
              </div>
              <Button
                onClick={handleBookNow}
                className="bg-white text-blue-600 hover:bg-white/90"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Réserver
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ✓ Liste des conducteurs - Composant mémoïsé externe */}
        <TaxiDriversList
          loading={loading}
          error={error}
          drivers={drivers}
          onRetry={handleRetry}
          onBook={handleBookDriver}
        />
      </div>

      <QuickFooter />
    </div>
  );
}
