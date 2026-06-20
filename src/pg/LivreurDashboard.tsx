/**
 * LIVREUR - INTERFACE COMPLÈTE RESPONSIVE
 * 224Solutions Delivery System
 * Toutes les fonctionnalités du Taxi-Moto intégrées + Responsive
 */

import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { NotificationBellButton } from '@/components/shared/NotificationBellButton';
import { useTranslation } from "@/hooks/useTranslation";
import { Money } from '@/components/Money';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from "sonner";
import { MapPin, Package, Clock, Wallet, CheckCircle, AlertTriangle, Truck, Navigation, TrendingUp, Car, MessageSquare, Headphones } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentLocation } from "@/hooks/useGeolocation";
import { supabase } from "@/integrations/supabase/client";
import { useDelivery } from "@/hooks/useDelivery";
import { useTaxiRides } from "@/hooks/useTaxiRides";
import { useDriver } from "@/hooks/useDriver";
import { useResponsive } from "@/hooks/useResponsive";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useLivreurErrorBoundary } from "@/hooks/useLivreurErrorBoundary";
import { useDeliveryActions } from "@/hooks/useDeliveryActions";
import { useRealtimeDelivery } from "@/hooks/useRealtimeDelivery";
import { useDriverSubscription } from "@/hooks/useDriverSubscription";
import { UserTrackerButton } from "@/components/taxi-moto/UserTrackerButton";
import { processDeliveryPayment as processDeliveryPaymentBackend } from "@/services/deliveryBackendService";

// Lazy loading des composants lourds
const NearbyDeliveriesPanel = lazy(() => import('@/components/delivery/NearbyDeliveriesPanel').then(m => ({ default: m.NearbyDeliveriesPanel })));
const DriverSubscriptionBanner = lazy(() => import('@/components/driver/DriverSubscriptionBanner').then(m => ({ default: m.DriverSubscriptionBanner })));
const _DriverSubscriptionButton = lazy(() => import('@/components/driver/DriverSubscriptionButton').then(m => ({ default: m.DriverSubscriptionButton })));
const WalletBalanceWidget = lazy(() => import("@/components/wallet/WalletBalanceWidget").then(m => ({ default: m.WalletBalanceWidget })));
const UserIdDisplay = lazy(() => import("@/components/UserIdDisplay").then(m => ({ default: m.UserIdDisplay })));
const NearbyDeliveriesListener = lazy(() => import('@/components/delivery/NearbyDeliveriesListener').then(m => ({ default: m.NearbyDeliveriesListener })));
const DriverStatusToggle = lazy(() => import('@/components/driver/DriverStatusToggle').then(m => ({ default: m.DriverStatusToggle })));
const EarningsDisplay = lazy(() => import('@/components/driver/EarningsDisplay').then(m => ({ default: m.EarningsDisplay })));
const DeliveryProofUpload = lazy(() => import('@/components/driver/DeliveryProofUpload').then(m => ({ default: m.DeliveryProofUpload })));
const ResponsiveContainer = lazy(() => import("@/components/responsive/ResponsiveContainer").then(m => ({ default: m.ResponsiveContainer })));
const _ResponsiveGrid = lazy(() => import("@/components/responsive/ResponsiveContainer").then(m => ({ default: m.ResponsiveGrid })));
const _MobileBottomNav = lazy(() => import("@/components/responsive/MobileBottomNav").then(m => ({ default: m.MobileBottomNav })));
const _CommunicationWidget = lazy(() => import("@/components/communication/CommunicationWidget"));
const DriverLayout = lazy(() => import('@/components/driver/DriverLayout').then(m => ({ default: m.DriverLayout })));
const DeliveryChat = lazy(() => import('@/components/delivery/DeliveryChat'));
const DeliveryGPSNavigation = lazy(() => import('@/components/delivery/DeliveryGPSNavigation').then(m => ({ default: m.DeliveryGPSNavigation })));
const MyPurchasesOrdersList = lazy(() => import('@/components/shared/MyPurchasesOrdersList'));
const SupportTicketsUniversal = lazy(() => import('@/components/shared/SupportTicketsUniversal').then(m => ({ default: m.SupportTicketsUniversal })));

export default function LivreurDashboard() {
  const fc = useFormatCurrency();
  const { user, profile } = useAuth();
  const { location, getCurrentLocation, watchLocation, stopWatching } = useCurrentLocation();
  const { isMobile, isTablet } = useResponsive();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'missions');
  const [showProofUpload, setShowProofUpload] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Nom du livreur transmis au client dans la notification « livreur en route »
  const driverName = profile?.first_name
    ? `${profile.first_name} ${profile?.last_name || ''}`.trim()
    : 'Livreur';

  // Gestion des erreurs centralisée
  const { error, captureError, clearError } = useLivreurErrorBoundary();

  // Vérification subscription et KYC
  const { hasAccess, subscription, loading: _subscriptionLoading, isExpired } = useDriverSubscription();

  // Hook pour le profil et statut du driver
  const { driver, stats, goOnline, goOffline, pause, updateLocation, uploadProof, loadDriverProfile } = useDriver();

  // Hook pour les livraisons
  const {
    currentDelivery,
    deliveryHistory,
    nearbyDeliveries,
    trackingPoints,
    loading: deliveryLoading,
    error: _deliveryError,
    findNearbyDeliveries,
    loadTracking,
    subscribeToTracking,
    trackPosition: trackDeliveryPosition,
    loadDeliveryHistory,
    loadCurrentDelivery
  } = useDelivery();

  // Hook pour les actions de livraison (logique métier extraite)
  const {
    acceptDelivery,
    startDelivery,
    completeDeliveryWithProof,
    cancelDelivery,
    reportProblem,
  } = useDeliveryActions({
    driverId: user?.id || null,
    onDeliveryAccepted: () => {
      setActiveTab('active');
      loadCurrentDelivery();
      if (location) {
        findNearbyDeliveries(location.latitude, location.longitude, 10);
      }
    },
    onDeliveryCompleted: () => {
      console.log('📥 [LivreurDashboard] onDeliveryCompleted callback triggered');
      setShowProofUpload(false);
      // setCurrentDelivery(null); // Commenté car setCurrentDelivery n'existe pas

      // Recharger toutes les données
      loadCurrentDelivery();
      loadDeliveryHistory();
      // Rafraîchir gains/stats (jour/semaine/mois) + solde wallet après crédit
      loadDriverProfile();

      // Recharger les livraisons disponibles
      if (location) {
        findNearbyDeliveries(location.latitude, location.longitude, 10);
      }

      // Basculer vers l'historique après un court délai
      setTimeout(() => {
        setActiveTab('history');
      }, 1000);
    },
    onDeliveryCancelled: () => {
      loadCurrentDelivery();
      setActiveTab('missions');
      if (location) {
        findNearbyDeliveries(location.latitude, location.longitude, 10);
      }
    },
  });

  // Realtime delivery subscription avec guards
  useRealtimeDelivery({
    deliveryId: currentDelivery?.id || null,
    isOnline: driver?.is_online || false,
    hasAccess,
    onDeliveryUpdate: (delivery) => {
      console.log('[LivreurDashboard] Delivery updated via realtime:', delivery);
      loadCurrentDelivery();
    },
  });

  // Hook pour les courses taxi-moto
  const {
    currentRide,
    rideHistory,
    loading: rideLoading,
    acceptRide: _acceptRideFn,
    startRide: startRideFn,
    completeRide: completeRideFn,
    cancelRide,
    trackPosition: trackRidePosition,
    processPayment: _processRidePayment
  } = useTaxiRides();

  const loading = deliveryLoading || rideLoading;

  // Charger la position GPS au montage avec capture d'erreur (relevé initial rapide)
  useEffect(() => {
    getCurrentLocation().catch(err => {
      console.error('[LivreurDashboard] GPS error:', err);
      captureError('gps', 'Impossible d\'accéder à votre position GPS', err);
    });
  }, [getCurrentLocation, captureError]);

  // 📍 SUIVI GPS CONTINU tant que le livreur est en ligne : sans ce watch, `location`
  // restait figée au relevé initial → la position publiée ne bougeait jamais (livreur
  // immobile sur la carte du client). On démarre/arrête le watch selon le statut en ligne.
  useEffect(() => {
    if (!driver?.is_online) return;
    const watchId = watchLocation();
    return () => {
      if (watchId != null) stopWatching(watchId);
    };
  }, [driver?.is_online, watchLocation, stopWatching]);

  // Horodatages de dernière publication (throttle par ref → ne PAS réinitialiser un timer
  // à chaque point GPS, sinon il ne se déclenche jamais quand le watch émet en continu).
  const lastDriverPosUpdateRef = useRef(0);
  const lastDeliveryTrackRef = useRef(0);
  const lastRideTrackRef = useRef(0);

  // Mettre à jour la position du driver (profil) au plus toutes les 30 s, en ligne.
  useEffect(() => {
    if (!driver?.is_online || !location) return;
    const now = Date.now();
    if (now - lastDriverPosUpdateRef.current < 30000) return;
    lastDriverPosUpdateRef.current = now;
    updateLocation({ lat: location.latitude, lng: location.longitude });
  }, [driver?.is_online, location, updateLocation]);

  // Recharger les livraisons quand on bascule sur l'onglet missions
  useEffect(() => {
    if (activeTab === 'missions' && !currentDelivery && !currentRide) {
      if (location) {
        findNearbyDeliveries(location.latitude, location.longitude, 10);
      } else {
        // Charger toutes les livraisons même sans GPS
        findNearbyDeliveries(0, 0, 99999);
      }
    }
  }, [activeTab, location, currentDelivery, currentRide, findNearbyDeliveries]);

  // Charger les livraisons à proximité quand la position change OU au montage
  useEffect(() => {
    // Charger sans filtrage GPS au montage si pas de location
    if (!currentDelivery && !currentRide) {
      if (location) {
        findNearbyDeliveries(location.latitude, location.longitude, 10);
      } else {
        // Charger toutes les livraisons même sans GPS
        findNearbyDeliveries(0, 0, 99999);
      }
    }
  }, [location, currentDelivery, currentRide, findNearbyDeliveries]);

  // S'abonner au tracking realtime — clé = id UNIQUEMENT (pas `location`), sinon le canal
  // serait recréé à chaque point GPS (churn de souscriptions).
  useEffect(() => {
    if (!currentDelivery?.id) return;
    const unsubscribe = subscribeToTracking(currentDelivery.id);
    return () => { unsubscribe(); };
  }, [currentDelivery?.id, subscribeToTracking]);

  // Publier la position du livreur à chaque nouveau point GPS, throttlé à 10 s par ref
  // (pas d'intervalle dépendant de `location` → évite la réinitialisation permanente du timer).
  useEffect(() => {
    if (!location) return;
    const now = Date.now();

    if (currentDelivery?.id) {
      if (now - lastDeliveryTrackRef.current >= 10000) {
        lastDeliveryTrackRef.current = now;
        trackDeliveryPosition(
          currentDelivery.id,
          location.latitude,
          location.longitude,
          undefined,
          undefined,
          location.accuracy
        );
      }
    } else if (currentRide?.id) {
      if (now - lastRideTrackRef.current >= 10000) {
        lastRideTrackRef.current = now;
        trackRidePosition(
          currentRide.id,
          location.latitude,
          location.longitude,
          undefined,
          undefined
        );
      }
    }
  }, [location, currentDelivery?.id, currentRide?.id, trackDeliveryPosition, trackRidePosition]);

  /**
   * Accepter une livraison
   */
  const _handleAcceptDelivery = async (deliveryId: string) => {
    try {
      await acceptDelivery(deliveryId);
    } catch (error) {
      captureError('network', 'Impossible d\'accepter la livraison', error);
    }
  };

  /**
   * Démarrer une livraison
   */
  const handleStartDelivery = async () => {
    if (!currentDelivery) return;
    try {
      await startDelivery(currentDelivery.id);
    } catch (error) {
      captureError('network', 'Impossible de démarrer la livraison', error);
    }
  };

  /**
   * Terminer une livraison avec preuve
   */
  const handleCompleteWithProof = async (photoUrl: string, signature: string) => {
    if (!currentDelivery) return;
    try {
      await completeDeliveryWithProof(currentDelivery.id, photoUrl, signature);
    } catch (error) {
      captureError('network', 'Erreur lors de la finalisation', error);
    }
  };

  /**
   * Annuler une livraison
   */
  const _handleCancelDelivery = async (reason: string) => {
    if (!currentDelivery) return;
    try {
      await cancelDelivery(currentDelivery.id, reason);
    } catch (error) {
      captureError('network', 'Impossible d\'annuler la livraison', error);
    }
  };

  /**
   * Signaler un problème
   */
  const handleReportProblem = () => {
    if (!currentDelivery) return;
    reportProblem(currentDelivery.id, 'Problème signalé par le livreur');
  };

  /**
   * Traiter le paiement (livraison ou course)
   */
  const handleProcessPayment = () => {
    if (currentDelivery || currentRide) {
      setShowPaymentModal(true);
    }
  };

  /**
   * Signaler un problème sur la course taxi en cours → crée un vrai ticket support.
   */
  const handleReportRideProblem = async () => {
    if (!currentRide || !user) return;
    const problem = prompt('Décrivez le problème :');
    if (!problem) return;
    try {
      const { error } = await supabase.from('support_tickets').insert({
        subject: `Problème course #${currentRide.id.slice(0, 8)}`,
        description: problem,
        category: 'other',
        priority: 'high',
        requester_id: user.id,
        status: 'open',
      });
      if (error) throw error;
      toast.success(t('livreurDashboard.problemeSignaleAuSupportUn'));
    } catch (error) {
      console.error('Erreur signalement course:', error);
      toast.error(t('livreurDashboard.impossibleDeSignalerLeProbleme'));
    }
  };

  /**
   * Encaisser une livraison via le backend Node.js (crédit wallet réel + marquage payé).
   * Remplace l'ancien stub frontend qui ne faisait qu'un toast.
   */
  const handleDeliveryPayment = async (method: string) => {
    if (!currentDelivery) return;
    try {
      const result = await processDeliveryPaymentBackend(currentDelivery.id, method);
      if (!result.success) {
        toast.error(result.error || 'Erreur lors de l\'encaissement');
        return;
      }
      const amount = (result.amount || 0).toLocaleString();
      toast.success(
        result.credited
          ? `💰 ${fc(amount)} crédités sur votre wallet`
          : `✅ Encaissement espèces enregistré (${fc(amount)})`
      );
      window.dispatchEvent(new Event('wallet-updated'));
      setShowPaymentModal(false);
      loadCurrentDelivery();
      loadDeliveryHistory();
    } catch (error) {
      captureError('network', 'Erreur lors de l\'encaissement', error);
    }
  };

  if (loading && !currentDelivery && nearbyDeliveries.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Truck className="h-12 w-12 animate-bounce mx-auto mb-4 text-primary" />
          <p>{t('delivery.loadingData')}</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">{t('livreurDashboard.chargementDuDashboardLivreur')}</p>
        </div>
      </div>
    }>
    <>
      {/* Bannière d'abonnement */}
      <DriverSubscriptionBanner />

      <DriverLayout currentPage="dashboard">
    <div className="p-responsive bg-gradient-to-br from-orange-500/5 via-background to-[#ff4000]/5">
      {/* Listener temps réel pour nouvelles livraisons */}
      <NearbyDeliveriesListener
        enabled={!currentDelivery && !currentRide}
        onNewDelivery={() => {
          if (location) {
            findNearbyDeliveries(location.latitude, location.longitude, 10);
          }
        }}
      />

      {/* Error Banner - Affichage des erreurs persistantes */}
      {error && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-[#ff4000] mb-4">
          <p className="font-medium">{error.message}</p>
          <button onClick={clearError} className="text-sm underline mt-2">{t('livreurDashboard.fermer')}</button>
        </div>
      )}

      <ResponsiveContainer maxWidth="full">
        {/* Statut du livreur Online/Offline avec KYC Badge */}
        {driver && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <DriverStatusToggle
                status={driver.status}
                isOnline={driver.is_online}
                onGoOnline={goOnline}
                onGoOffline={goOffline}
                onPause={pause}
              />
            </div>
          </div>
        )}

        {/* Statistiques de gains */}
        {driver && (
          <div className="mt-4 mb-6">
            <EarningsDisplay
              totalEarnings={driver.earnings_total || 0}
              todayEarnings={stats.todayEarnings}
              todayDeliveries={stats.todayDeliveries}
              weekEarnings={stats.weekEarnings}
              weekDeliveries={stats.weekDeliveries}
              monthEarnings={stats.monthEarnings}
              monthDeliveries={stats.monthDeliveries}
            />
          </div>
        )}

        {/* En-tête avec informations utilisateur - Responsive */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className={`font-bold bg-gradient-to-r from-orange-600 to-[#ff4000] bg-clip-text text-transparent ${isMobile ? 'text-xl' : 'text-3xl'}`}>
                🚴 {t('delivery.dashboard')}
              </h1>
            </div>
            <p className="text-sm md:text-base text-muted-foreground">
              {t('common.welcome')} {profile?.first_name || 'Livreur'} - 224Solutions Delivery
            </p>
            <div className="mt-1">
              <UserIdDisplay />
            </div>
            {(currentDelivery || currentRide) && (
              <Badge
                variant="default"
                className="mt-2 gap-1"
                style={{ background: 'linear-gradient(135deg, hsl(25 98% 55%), hsl(15 100% 50%))' }}
              >
                ⚠ {currentDelivery ? t('delivery.inProgressDelivery') : t('taxi.dashboard')}
              </Badge>
            )}
          </div>

          {/* Actions d'en-tête */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Localiser un client par ID / lien partagé (système taxi-moto) */}
            <UserTrackerButton
              driverName={driverName}
              className="h-9 px-2 gap-1 text-xs text-orange-600 hover:text-[#ff4000] hover:bg-orange-50"
            />

            {/* Notifications (cloche partagée → /notifications, clic = redirection ciblée) */}
            <NotificationBellButton />

            {/* Bouton de navigation */}
            <Button
              onClick={() => navigate('/delivery-request')}
              style={{
                background: 'linear-gradient(135deg, hsl(25 98% 55%), hsl(15 100% 50%))',
                color: 'white'
              }}
              className="gap-2"
            >
              <Package className="h-4 w-4" />
              {!isMobile && t('delivery.newDelivery')}
            </Button>
          </div>
        </div>

        {/* Onglets de navigation - Responsive */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid bg-card/80 backdrop-blur mb-6 ${isMobile ? 'grid-cols-5' : 'grid-cols-6'} border border-orange-500/20`}>
            <TabsTrigger value="missions" className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white">
              📦 {isMobile ? 'Missions' : 'Missions disponibles'}
              {nearbyDeliveries.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs bg-white text-orange-600">{nearbyDeliveries.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" disabled={!currentDelivery && !currentRide} className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#ff4000] data-[state=active]:to-[#ff4000] data-[state=active]:text-white">
              🚚 {isMobile ? 'Active' : 'En cours'}
              {(currentDelivery || currentRide) && <Badge variant="default" className="ml-1 text-xs bg-white text-[#ff4000]">1</Badge>}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs md:text-sm data-[state=active]:bg-[#04439e] data-[state=active]: data-[state=active]: data-[state=active]:text-white">
              📋 {isMobile ? 'Historique' : 'Historique'}
              {(deliveryHistory.length + rideHistory.length) > 0 && (
                <Badge variant="outline" className="ml-1 text-xs">{deliveryHistory.length + rideHistory.length}</Badge>
              )}
            </TabsTrigger>
            {!isMobile && (
              <TabsTrigger value="my-purchases" className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#ff4000] data-[state=active]:to-[#ff4000] data-[state=active]:text-white">
                🛒 Mes Achats
              </TabsTrigger>
            )}
            <TabsTrigger value="wallet" className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#04439e] data-[state=active]:to-[#04439e] data-[state=active]:text-white">
              💰 {isMobile ? 'Wallet' : 'Portefeuille'}
            </TabsTrigger>
            <TabsTrigger value="support" className="text-xs md:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#04439e] data-[state=active]:to-blue-700 data-[state=active]:text-white">
              <Headphones className="w-3.5 h-3.5 mr-1" />
              {isMobile ? 'Support' : 'Support'}
            </TabsTrigger>
          </TabsList>

          {/* 📦 Liste des livraisons disponibles */}
          <TabsContent value="missions" className="space-y-3">
            {/* 📍 Localiser un client par ID / lien (système taxi-moto) */}
            <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-[#ff4000]/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-orange-600" />
                  <p className="font-semibold text-sm bg-gradient-to-r from-orange-600 to-[#ff4000] bg-clip-text text-transparent">
                    Localiser un client
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Saisissez l'ID ou le lien partagé par le client pour voir sa position en temps réel,
                  obtenir l'itinéraire et le prévenir que vous êtes en route.
                </p>
                <UserTrackerButton
                  prominent
                  driverName={driverName}
                  className="w-full text-white bg-gradient-to-r from-orange-500 to-[#ff4000] hover:from-orange-600 hover:to-[#ff4000]"
                />
              </CardContent>
            </Card>

            {/* Panneau des colis à proximité */}
            <NearbyDeliveriesPanel />

            {/* Alerte GPS si non activé */}
            {!location && (
              <Card className="p-4 bg-[#ff4000]/10 border-[#ff4000]/30">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-[#ff4000]" />
                  <div>
                    <p className="font-medium text-[#ff4000]">{t('livreurDashboard.gpsDesactive')}</p>
                    <p className="text-sm text-[#ff4000]">
                      Activez le GPS pour voir les missions à proximité et filtrer par distance
                    </p>
                  </div>
                </div>
              </Card>
            )}

          </TabsContent>

          {/* 🚚 Livraison en cours */}
          <TabsContent value="active">
            {currentDelivery ? (
              <Card className="shadow-lg border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-[#ff4000]/5">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <Badge
                          variant="default"
                          style={{ background: 'linear-gradient(135deg, hsl(25 98% 55%), hsl(15 100% 50%))' }}
                        >
                          ⚠ Livraison en cours
                        </Badge>
                        <Badge variant="outline" className="border-orange-500">{currentDelivery.status}</Badge>
                      </div>
                      <h3 className="font-bold text-lg mb-3">
                        Livraison #{currentDelivery.id.slice(0, 8)}
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <MapPin className="h-5 w-5 flex-shrink-0 text-primary mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium">{t('livreurDashboard.pointDeCollecte')}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {typeof currentDelivery.pickup_address === 'string'
                                ? currentDelivery.pickup_address
                                : JSON.stringify(currentDelivery.pickup_address)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <MapPin className="h-5 w-5 flex-shrink-0 text-[#ff4000] mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium">Destination</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {typeof currentDelivery.delivery_address === 'string'
                                ? currentDelivery.delivery_address
                                : JSON.stringify(currentDelivery.delivery_address)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 bg-gradient-to-r from-orange-500/20 to-[#ff4000]/20 rounded-xl border border-orange-500/30">
                      <p className="text-sm text-muted-foreground mb-2 font-medium">{t('livreurDashboard.votreRemuneration')}</p>
                      <p className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-[#ff4000] bg-clip-text text-transparent">
                        <Money amount={currentDelivery.delivery_fee || 0} from="GNF" />
                      </p>
                    </div>

                    {trackingPoints.length > 0 && (
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-sm font-medium mb-1 flex items-center gap-2">
                          <Navigation className="h-4 w-4" />
                          Tracking GPS
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {trackingPoints.length} points enregistrés
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 pt-2">
                      {/* Composant de Navigation GPS avec données réelles */}
                      <DeliveryGPSNavigation
                        activeDelivery={currentDelivery as any}
                        currentLocation={location ? { latitude: location.latitude, longitude: location.longitude } : null}
                        onContactCustomer={(phone) => window.open(`tel:${phone}`, '_self')}
                      />

                      {currentDelivery.status === 'picked_up' && (
                        <Button
                          onClick={handleStartDelivery}
                          disabled={loading}
                          className="w-full text-white"
                          size="lg"
                          style={{ background: 'linear-gradient(135deg, hsl(220 97% 27%), hsl(220 96% 32%))' }}
                        >
                          <Truck className="w-5 h-5 mr-2" />
                          🚀 Démarrer la livraison
                        </Button>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={() => setShowChat(true)}
                          variant="outline"
                          className="w-full border-blue-500 text-blue-600 hover:bg-blue-50"
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Chat
                        </Button>
                        <Button
                          onClick={() => setShowProofUpload(true)}
                          disabled={loading}
                          className="w-full text-white"
                          style={{ background: 'linear-gradient(135deg, hsl(15 100% 50%), hsl(15 100% 50%))' }}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Terminer
                        </Button>
                      </div>

                      {/* Bouton de paiement - encaissement via backend */}
                      {currentDelivery.status === 'delivered' && !(currentDelivery as any).driver_payment_method && (
                        <Button
                          onClick={handleProcessPayment}
                          className="w-full text-white"
                          size="lg"
                          style={{ background: 'linear-gradient(135deg, hsl(15 100% 50%), hsl(15 100% 50%))' }}
                        >
                          <Wallet className="w-5 h-5 mr-2" />
                          💳 Traiter le paiement
                        </Button>
                      )}

                      <Button
                        onClick={handleReportProblem}
                        variant="outline"
                        disabled={loading}
                        className="w-full border-[#ff4000] text-[#ff4000] hover:bg-orange-50"
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Signaler un problème
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : currentRide ? (
              <Card className="shadow-lg border-[#ff4000]/30">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Badge className="bg-[#ff4000]">Course Taxi</Badge>
                        <Badge variant="outline">{currentRide.status}</Badge>
                      </div>
                      <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                        <Car className="h-5 w-5" />
                        Course #{currentRide.id.slice(0, 8)}
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <MapPin className="h-5 w-5 flex-shrink-0 text-primary mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium">{t('livreurDashboard.pointDeDepart')}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {typeof currentRide.pickup_address === 'string'
                                ? currentRide.pickup_address
                                : 'Adresse non disponible'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <MapPin className="h-5 w-5 flex-shrink-0 text-[#ff4000] mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium">Destination</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {typeof currentRide.dropoff_address === 'string'
                                ? currentRide.dropoff_address
                                : 'Adresse non disponible'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-[#ff4000]/10 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">{t('livreurDashboard.prixDeLaCourse')}</p>
                      <p className="text-3xl font-bold text-[#ff4000]">
                        <Money amount={currentRide.price_total || 0} from="GNF" />
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                      {currentRide.status === 'accepted' && (
                        <Button
                          onClick={() => startRideFn(currentRide.id)}
                          disabled={loading}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Client récupéré
                        </Button>
                      )}
                      {(currentRide.status === 'picked_up' || currentRide.status === 'in_transit') && (
                        <Button
                          onClick={() => completeRideFn(currentRide.id)}
                          disabled={loading}
                          className="w-full bg-[#ff4000] hover:bg-[#ff4000]"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Terminer la course
                        </Button>
                      )}
                      <Button
                        onClick={handleReportRideProblem}
                        variant="destructive"
                        disabled={loading}
                        className="w-full"
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Signaler un problème
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="p-8">
                <div className="text-center text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">{t('livreurDashboard.aucuneMissionActive')}</p>
                  <p className="text-sm mt-1">{t('livreurDashboard.acceptezUneLivraisonOuUne')}</p>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* 📋 Historique unifié */}
          <TabsContent value="history" className="space-y-3">
            {deliveryHistory.length === 0 && rideHistory.length === 0 ? (
              <Card className="p-8">
                <div className="text-center text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">{t('livreurDashboard.aucunHistorique')}</p>
                  <p className="text-sm mt-1">{t('livreurDashboard.vosLivraisonsEtCoursesTerminees')}</p>
                </div>
              </Card>
            ) : (
              <>
                {/* Livraisons terminées */}
                {deliveryHistory.map((delivery) => {
                  const getStatusLabel = (status: string) => {
                    switch(status) {
                      case 'delivered': return 'Livrée';
                      case 'cancelled': return 'Annulée';
                      case 'pending': return 'En attente';
                      case 'assigned': return 'Assignée';
                      case 'picked_up': return 'Récupérée';
                      case 'in_transit': return 'En transit';
                      default: return status;
                    }
                  };

                  return (
                    <Card key={delivery.id} className="shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-muted-foreground" />
                              <p className="font-medium">
                                Livraison #{delivery.id.slice(0, 8)}
                              </p>
                              <Badge variant={
                                delivery.status === 'delivered' ? 'default' :
                                delivery.status === 'cancelled' ? 'destructive' :
                                'secondary'
                              }>
                                {getStatusLabel(delivery.status)}
                              </Badge>
                            </div>
                            {(delivery as any).vendor_name && (
                              <p className="text-sm text-foreground">
                                🏪 {(delivery as any).vendor_name}
                              </p>
                            )}
                            {(delivery as any).customer_name && (
                              <p className="text-sm text-muted-foreground">
                                👤 {(delivery as any).customer_name}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {new Date(delivery.created_at || '').toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">
                              +<Money amount={(delivery as any).driver_earning || delivery.delivery_fee || 0} from="GNF" />
                            </p>
                            {(delivery as any).distance_km && (
                              <p className="text-xs text-muted-foreground">
                                {(delivery as any).distance_km} km
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Courses taxi terminées */}
                {rideHistory.map((ride) => {
                  const getRideStatusLabel = (status: string) => {
                    switch(status) {
                      case 'completed': return 'Terminée';
                      case 'cancelled': return 'Annulée';
                      default: return status;
                    }
                  };

                  return (
                    <Card key={ride.id} className="shadow-sm border-[#ff4000]/20">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Car className="h-4 w-4 text-[#ff4000]" />
                              <p className="font-medium">Course #{ride.id.slice(0, 8)}</p>
                              <Badge variant={
                                ride.status === 'completed' ? 'default' :
                                ride.status === 'cancelled' ? 'destructive' :
                                'secondary'
                              }>
                                {getRideStatusLabel(ride.status)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {new Date(ride.requested_at || '').toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-[#ff4000]">
                              +<Money amount={ride.price_total || 0} from="GNF" />
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </TabsContent>

          {/* 💰 Portefeuille */}
          <TabsContent value="wallet">
            <div className="space-y-4">
              <WalletBalanceWidget />

              <Card className="shadow-md">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Statistiques de livraison
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm font-medium">Livraisons disponibles</span>
                      <Badge variant="secondary">{nearbyDeliveries.length}</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm font-medium">{t('livreurDashboard.livraisonEnCours')}</span>
                      <Badge variant={currentDelivery ? 'default' : 'secondary'}>
                        {currentDelivery ? '1' : '0'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm font-medium">{t('livreurDashboard.livraisonsTerminees')}</span>
                      <Badge variant="outline">
                        {deliveryHistory.filter(d => d.status === 'delivered').length}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm font-medium">Statut GPS</span>
                      <Badge variant={location ? 'default' : 'secondary'}>
                        {location ? '✓ Actif' : 'Inactif'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 🛒 Mes Achats */}
          <TabsContent value="my-purchases">
            <MyPurchasesOrdersList title="Mes Achats Personnels" />
          </TabsContent>

          {/* 🎧 Support */}
          <TabsContent value="support">
            <Suspense fallback={<div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
              <SupportTicketsUniversal />
            </Suspense>
          </TabsContent>
        </Tabs>
      </ResponsiveContainer>

      {/* Dialog de chat pour communication avec client/vendeur */}
      <Dialog open={showChat} onOpenChange={setShowChat}>
        <DialogContent className="max-w-2xl h-[600px] p-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>{t('livreurDashboard.communicationLivraison')}</DialogTitle>
          </DialogHeader>
          {currentDelivery && user && currentDelivery.client_id && (
            <div className="flex-1 px-6 pb-6 h-full overflow-hidden">
              <DeliveryChat
                deliveryId={currentDelivery.id}
                recipientId={currentDelivery.client_id}
                recipientName="Client"
                recipientRole="client"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de preuve de livraison */}
      {showProofUpload && currentDelivery && (
        <DeliveryProofUpload
          deliveryId={currentDelivery.id}
          onProofUploaded={handleCompleteWithProof}
          onCancel={() => setShowProofUpload(false)}
        />
      )}

      {/* Modal de paiement */}
      {showPaymentModal && (currentDelivery || currentRide) && user && (
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('livreurDashboard.traitementDuPaiement')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-1">{t('livreurDashboard.montantAEncaisser')}</p>
                <p className="text-3xl font-bold text-primary">
                  <Money amount={currentDelivery ? (currentDelivery.delivery_fee || 0) : (currentRide?.price_total || 0)} from="GNF" />
                </p>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={() => handleDeliveryPayment('cash')}
                  className="w-full"
                  variant="outline"
                >
                  💵 Paiement en espèces
                </Button>
                <Button
                  onClick={() => handleDeliveryPayment('mobile_money')}
                  className="w-full"
                  variant="outline"
                >
                  📱 Mobile Money
                </Button>
                <Button
                  onClick={() => handleDeliveryPayment('wallet')}
                  className="w-full"
                  variant="outline"
                >
                  💰 Wallet 224Solutions
                </Button>
              </div>
              <Button onClick={() => setShowPaymentModal(false)} variant="ghost" className="w-full">
                Annuler
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
    </DriverLayout>
    </>
    </Suspense>
  );
}
