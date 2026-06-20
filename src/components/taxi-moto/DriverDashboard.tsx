/**
 * DASHBOARD CONDUCTEUR - Composant principal avec connexion temps réel
 * Affiche les statistiques en temps réel depuis la base de données
 */

import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Wifi, Battery, Phone, Navigation, Car, CreditCard, Hash } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TaxiMotoService } from "@/services/taxi/TaxiMotoService";

interface DriverStats {
  todayEarnings: number;
  todayRides: number;
  rating: number;
  totalRides: number;
  onlineTime: string;
  vehiclePlate?: string;
  giletNumber?: string;
  serialNumber?: string;
}

interface ActiveRide {
  id: string;
  customer: {
    name: string;
    phone: string;
    rating: number;
  };
  pickup: {
    address: string;
    coords: { latitude: number; longitude: number };
  };
  destination: {
    address: string;
    coords: { latitude: number; longitude: number };
  };
  status: 'accepted' | 'arriving' | 'picked_up' | 'in_progress';
  startTime: string;
  estimatedEarnings: number;
}

interface DriverDashboardProps {
  driverId: string;
  isOnline: boolean;
  location: { latitude: number; longitude: number } | null;
  activeRide: ActiveRide | null;
  onNavigate: (tab: string) => void;
  onContactCustomer: (phone: string) => void;
  onToggleOnline: () => void;
  hasSubscription?: boolean;
  driverLoading?: boolean;
}

export function DriverDashboard({
  driverId,
  isOnline,
  location,
  activeRide,
  onNavigate,
  onContactCustomer,
  onToggleOnline,
  hasSubscription = true,
  driverLoading = false
}: DriverDashboardProps) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DriverStats>({
    todayEarnings: 0,
    todayRides: 0,
    rating: 5.0,
    totalRides: 0,
    onlineTime: '0h 0m 0s',
    vehiclePlate: '',
    giletNumber: '',
    serialNumber: ''
  });
  const [loading, setLoading] = useState(false);
  const [currentOnlineTime, setCurrentOnlineTime] = useState('0h 0m 0s');

  // Gérer le début/fin de la session en ligne avec localStorage
  useEffect(() => {
    const storageKey = `driver_online_start_${driverId}`;

    if (isOnline) {
      // Si le conducteur passe en ligne et n'a pas d'heure de début enregistrée
      const existingStartTime = localStorage.getItem(storageKey);
      if (!existingStartTime) {
        const startTime = new Date().toISOString();
        localStorage.setItem(storageKey, startTime);
        console.log('⏰ Session en ligne démarrée:', startTime);
      } else {
        console.log('⏰ Session en ligne existante récupérée:', existingStartTime);
      }
    } else {
      // Si le conducteur passe hors ligne, nettoyer le localStorage
      localStorage.removeItem(storageKey);
      setCurrentOnlineTime('0h 0m 0s');
      console.log('⏸️ Session en ligne terminée');
    }
  }, [isOnline, driverId]);

  // Mettre à jour le temps en ligne chaque seconde
  useEffect(() => {
    if (!isOnline || !driverId) {
      setCurrentOnlineTime('0h 0m 0s');
      return;
    }

    const storageKey = `driver_online_start_${driverId}`;

    const updateTime = () => {
      const startTimeStr = localStorage.getItem(storageKey);
      if (!startTimeStr) {
        setCurrentOnlineTime('0h 0m 0s');
        return;
      }

      const startTime = new Date(startTimeStr);
      const now = new Date();
      const diffMs = now.getTime() - startTime.getTime();
      const totalSeconds = Math.floor(diffMs / 1000);

      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setCurrentOnlineTime(`${hours}h ${minutes}m ${seconds}s`);
    };

    // Mise à jour immédiate puis toutes les secondes
    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [isOnline, driverId]);

  const loadStats = async () => {
    if (!driverId) return;
    setLoading(true);

    try {
      // Charger le profil conducteur
      const { data: driverData, error: driverError } = await supabase
        .from('taxi_drivers')
        .select('rating, total_rides, total_earnings, is_online, last_seen, created_at, vehicle_plate, vehicle')
        .eq('id', driverId)
        .single();

      if (driverError) throw driverError;

      // Extraire les infos du véhicule
      const vehicleData = driverData?.vehicle ?
        (typeof driverData.vehicle === 'string' ? JSON.parse(driverData.vehicle) : driverData.vehicle)
        : {};

      // Charger toutes les courses du conducteur
      const rides = await TaxiMotoService.getDriverRides(driverId, 100);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayRides = rides.filter(r => {
        const rideDate = new Date(r.requested_at);
        return rideDate >= today && r.status === 'completed';
      });

      // Calculer les gains du jour
      const todayEarnings = todayRides.reduce((sum, r) => {
        return sum + (r.driver_share || 0);
      }, 0);

      // Calculer le temps en ligne
      let onlineMinutes = 0;
      todayRides.forEach(ride => {
        if (ride.completed_at && ride.accepted_at) {
          const start = new Date(ride.accepted_at);
          const end = new Date(ride.completed_at);
          onlineMinutes += Math.floor((end.getTime() - start.getTime()) / 60000);
        }
      });

      const hours = Math.floor(onlineMinutes / 60);
      const mins = onlineMinutes % 60;

      setStats({
        todayEarnings: Math.round(todayEarnings),
        todayRides: todayRides.length,
        rating: Number(driverData?.rating) || 5.0,
        totalRides: driverData?.total_rides || 0,
        onlineTime: `${hours}h ${mins}m`,
        vehiclePlate: driverData?.vehicle_plate || '',
        giletNumber: vehicleData?.gilet_number || '',
        serialNumber: vehicleData?.moto_serial_number || ''
      });

      console.log('✅ Stats loaded:', {
        todayEarnings,
        todayRides: todayRides.length,
        totalRides: driverData?.total_rides
      });
    } catch (error) {
      console.error('❌ Error loading stats:', error);
      toast.error(t('driverDashboard.erreurDeChargementDesStatistiques'));
    } finally {
      setLoading(false);
    }
  };

  // Chargement initial
  useEffect(() => {
    loadStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  // S'abonner aux changements en temps réel
  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel(`driver-dashboard-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'taxi_trips',
          filter: `driver_id=eq.${driverId}`
        },
        (payload) => {
          console.log('📊 Trip changed, refreshing dashboard...', payload);
          loadStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  return (
    <div className="space-y-4 mt-4">
      {/* En-tête avec statistiques et bouton en ligne */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-gray-800">{t('driverDashboard.statistiquesDuJour')}</h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={onToggleOnline}
            size="sm"
            disabled={driverLoading || (!isOnline && !hasSubscription)}
            className={`font-bold text-xs ${
              driverLoading
                ? 'bg-gray-300 text-gray-500 cursor-wait'
                : isOnline
                ? 'bg-[#ff4000] hover:bg-[#ff4000] text-white'
                : !hasSubscription
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gray-400 hover:bg-gray-500 text-white'
            }`}
            title={driverLoading ? 'Chargement...' : !hasSubscription && !isOnline ? 'Abonnement requis pour passer en ligne' : ''}
          >
            {driverLoading ? (
              <>
                <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-1" />
                Chargement...
              </>
            ) : (
              <>
                <div className={`w-2 h-2 rounded-full mr-1 ${isOnline ? 'bg-white animate-pulse' : 'bg-gray-200'}`} />
                {isOnline ? 'En ligne' : 'Passer en ligne'}
              </>
            )}
          </Button>
          <Button
            onClick={() => {
              loadStats();
              toast.success(t('driverDashboard.donneesActualisees'));
            }}
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={loading}
          >
            {loading ? '⏳' : '🔄'}
          </Button>
        </div>
      </div>

      {/* Statistiques du jour */}
      <div className="grid grid-cols-2 gap-4">
        <Card
          className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-lg hover:shadow-xl transition-all cursor-pointer active:scale-95"
          onClick={() => {
            if (stats.todayEarnings > 0) {
              onNavigate('history');
              toast.success(t('driverDashboard.detailsDesGains'));
            } else {
              toast.info(t('driverDashboard.aucunGainAujourdHuiCommencez'));
            }
          }}
        >
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-[#ff4000] mb-1">
              {stats.todayEarnings.toLocaleString()}
            </div>
            <div className="text-xs font-medium text-gray-600">GNF aujourd'hui</div>
            <div className="text-xs text-[#ff4000] mt-1">{t('driverDashboard.voirDetails')}</div>
          </CardContent>
        </Card>

        <Card
          className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-lg hover:shadow-xl transition-all cursor-pointer active:scale-95"
          onClick={() => {
            if (stats.todayRides > 0) {
              onNavigate('history');
              toast.success(t('driverDashboard.historiqueDesCourses'));
            } else {
              toast.info(t('driverDashboard.aucuneCourseActiveAujourdHui'));
            }
          }}
        >
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-700 mb-1">
              {stats.todayRides}
            </div>
            <div className="text-xs font-medium text-gray-600">Courses aujourd'hui</div>
            <div className="text-xs text-blue-600 mt-1">👆 Voir historique</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card
          className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-lg hover:shadow-xl transition-all cursor-pointer active:scale-95"
          onClick={() => {
            if (stats.totalRides > 0) {
              onNavigate('history');
              toast.success(`⭐ Note moyenne: ${stats.rating.toFixed(1)}/5 sur ${stats.totalRides} courses`);
            } else {
              toast.info(t('driverDashboard.aucuneEvaluationPourLeMoment'));
            }
          }}
        >
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-[#ff4000] flex items-center justify-center gap-1 mb-1">
              {stats.rating.toFixed(1)}
              <Star className="w-6 h-6 fill-[#ff4000] text-[#ff4000]" />
            </div>
            <div className="text-xs font-medium text-gray-600">Note moyenne</div>
            <div className="text-xs text-[#ff4000] mt-1">{t('driverDashboard.voirEvaluations')}</div>
          </CardContent>
        </Card>

        <Card
          className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-lg hover:shadow-xl transition-all cursor-pointer active:scale-95"
          onClick={() => {
            if (isOnline) {
              toast.success(`⏱️ En ligne depuis ${currentOnlineTime}`);
            } else {
              toast.info(t('driverDashboard.passezEnLignePourCommencer'));
            }
          }}
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-[#04439e] mb-1">
              {isOnline ? currentOnlineTime : '0h 0m 0s'}
            </div>
            <div className="text-xs font-medium text-gray-600">Temps en ligne</div>
          </CardContent>
        </Card>
      </div>

      {/* Course active */}
      {activeRide && (
        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-600" />
              Course en cours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{activeRide.customer.name}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Star className="w-3 h-3 fill-[#ff4000] text-[#ff4000]" />
                  <span>{activeRide.customer.rating}</span>
                </div>
              </div>
              <Badge className={`${
                activeRide.status === 'accepted' ? 'bg-orange-100 text-[#ff4000]' :
                activeRide.status === 'arriving' ? 'bg-blue-100 text-blue-800' :
                activeRide.status === 'picked_up' ? 'bg-orange-100 text-[#ff4000]' :
                'bg-blue-100 text-[#04439e]'
              }`}>
                {activeRide.status === 'accepted' ? 'Acceptée' :
                 activeRide.status === 'arriving' ? 'En route' :
                 activeRide.status === 'picked_up' ? 'Client à bord' :
                 'En cours'}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-[#ff4000] rounded-full"></div>
                <span>{activeRide.pickup.address}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-[#ff4000] rounded-full"></div>
                <span>{activeRide.destination.address}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => onContactCustomer(activeRide.customer.phone)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Phone className="w-4 h-4 mr-1" />
                Appeler
              </Button>
              <Button
                onClick={() => onNavigate('navigation')}
                size="sm"
                className="flex-1"
              >
                <Navigation className="w-4 h-4 mr-1" />
                Navigation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* État du système - Connexion temps réel */}
      <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Car className="w-5 h-5 text-blue-600" />
            Informations du véhicule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium">Plaque</span>
            </div>
            <Badge variant="outline" className="font-mono">
              {stats.vehiclePlate || 'Non renseignée'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-[#04439e]" />
              <span className="text-sm font-medium">{t('driverDashboard.nSerie')}</span>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {stats.serialNumber || 'Non renseigné'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#ff4000]" />
              <span className="text-sm font-medium">N° Gilet</span>
            </div>
            <Badge variant="outline" className="font-mono">
              {stats.giletNumber || 'Non renseigné'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* État du système - Connexion temps réel */}
      <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#ff4000] animate-pulse' : 'bg-gray-400'}`}></div>
            État du système
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#ff4000]" />
              <span className="text-sm font-medium">GPS</span>
            </div>
            <Badge className={location ? "bg-orange-100 text-[#ff4000]" : "bg-orange-100 text-[#ff4000]"}>
              {location ? '✓ Actif' : '✗ Inactif'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-[#ff4000]" />
              <span className="text-sm font-medium">{t('driverDashboard.baseDeDonnees')}</span>
            </div>
            <Badge className={driverId ? "bg-orange-100 text-[#ff4000]" : "bg-orange-100 text-[#ff4000]"}>
              {driverId ? '✓ Connecté' : '⏳ En attente'}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Battery className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium">Statut</span>
            </div>
            <Badge className={isOnline ? "bg-orange-100 text-[#ff4000]" : "bg-gray-100 text-gray-800"}>
              {isOnline ? '🟢 En ligne' : '⚫ Hors ligne'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}