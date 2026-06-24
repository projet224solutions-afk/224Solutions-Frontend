/**
 * COMPOSANT DE SUIVI TAXI-MOTO EN TEMPS RÉEL
 * Affiche la position live du conducteur, l'ETA et les informations de course.
 * 224Solutions - Taxi-Moto System
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    MapPin,
    Navigation,
    Clock,
    Phone,
    Share2,
    AlertTriangle,
    CheckCircle,
    Car,
    User,
    Star,
    MessageCircle,
    Bike,
    ArrowRight,
    Loader2,
    Wifi
} from "lucide-react";
import { toast } from "sonner";
import { LocalPrice } from '@/components/ui/LocalPrice';
import { supabase } from "@/integrations/supabase/client";
import { RidesService } from "@/services/taxi/ridesService";
import RidePaymentFlow from "./RidePaymentFlow";
import { tryNativeShare } from '@/utils/nativeShare';
import { useDriverTracking } from '@/hooks/useDriverTracking';

interface LocationCoordinates {
    latitude: number;
    longitude: number;
}

interface CurrentRide {
    id: string;
    status: 'pending' | 'accepted' | 'driver_arriving' | 'in_progress' | 'completed' | 'cancelled';
    pickupAddress: string;
    destinationAddress: string;
    estimatedPrice: number;
    driver?: {
        id: string;
        name: string;
        rating: number;
        phone: string;
        vehicleType: string;
        vehicleNumber: string;
        photo?: string;
    };
    estimatedArrival?: string;
    actualArrival?: string;
    createdAt: string;
}

interface TaxiMotoTrackingProps {
    currentRide: CurrentRide | null;
    userLocation: LocationCoordinates | null;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
};

export default function TaxiMotoTracking({
    currentRide,
    userLocation
}: TaxiMotoTrackingProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [rideProgress, setRideProgress] = useState(0);
    const [_rideDetails, setRideDetails] = useState<any>(null);
    const [driverInfo, setDriverInfo] = useState<any>(null);
    const [showPayment, setShowPayment] = useState(false);
    const [pickupCoords, setPickupCoords] = useState<LocationCoordinates | null>(null);
    const [driverIdForTracking, setDriverIdForTracking] = useState<string | undefined>(undefined);

    // Hook de suivi temps réel avec notifications ETA
    const { driverPosition, etaMinutes, isMoving } = useDriverTracking(
        currentRide?.id,
        pickupCoords ?? userLocation,
        driverIdForTracking
    );

    // ETA calculé depuis la position du chauffeur (via useDriverTracking)
    const displayEta = etaMinutes ?? null;

    // Distance entre chauffeur et client (en km)
    const distanceToDriver = driverPosition && userLocation
        ? calculateDistance(
            userLocation.latitude, userLocation.longitude,
            driverPosition.latitude, driverPosition.longitude
          )
        : null;

    // Charger les détails de la course
    useEffect(() => {
        if (currentRide?.id) {
            loadRideDetails();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentRide?.id]);

    // Synchroniser l'ID conducteur depuis currentRide.driver
    useEffect(() => {
        if (currentRide?.driver?.id) {
            setDriverIdForTracking(currentRide.driver.id);
        }
    }, [currentRide?.driver?.id]);

    // Écouter les mises à jour de statut en temps réel
    useEffect(() => {
        if (!currentRide?.id) return;

        const subscription = supabase
            .channel(`ride_status_${currentRide.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'taxi_trips',
                filter: `id=eq.${currentRide.id}`
            }, (payload) => {
                if (payload.new) {
                    updateRideProgress(payload.new);
                }
            })
            .subscribe();

        return () => { subscription.unsubscribe(); };
    }, [currentRide?.id]);

    const loadRideDetails = async () => {
        if (!currentRide?.id) return;
        try {
            const details = await RidesService.getRideDetails(currentRide.id);
            setRideDetails(details);
            updateRideProgress(details);

            // Extraire les coordonnées de rendez-vous
            if (details.pickup_lat && details.pickup_lng) {
                setPickupCoords({
                    latitude: Number(details.pickup_lat),
                    longitude: Number(details.pickup_lng)
                });
            }

            // Charger les infos et ID du conducteur
            if (details.driver_id) {
                setDriverIdForTracking(details.driver_id);
                if (!currentRide.driver) {
                    loadDriverInfo(details.driver_id);
                }
            }
        } catch (error) {
            console.error('Error loading ride details:', error);
        }
    };

    const loadDriverInfo = async (driverId: string) => {
        try {
            const { data: driverData, error } = await supabase
                .from('taxi_drivers')
                .select('*, profiles!taxi_drivers_user_id_fkey(first_name, last_name, phone)')
                .eq('id', driverId)
                .single();

            if (error) throw error;

            if (driverData) {
                const profile = (driverData as any).profiles;
                setDriverInfo({
                    id: driverData.id,
                    user_id: driverData.user_id,
                    name: profile ? `${profile.first_name} ${profile.last_name}` : 'Conducteur',
                    rating: driverData.rating || 4.5,
                    phone: profile?.phone || '',
                    vehicleType: driverData.vehicle_type || 'moto_rapide',
                    vehicleNumber: driverData.vehicle_plate || 'N/A',
                    photo: null
                });
            }
        } catch (error) {
            console.error('Error loading driver info:', error);
        }
    };

    const updateRideProgress = (ride: any) => {
        const statusProgress: Record<string, number> = {
            'requested': 10,
            'accepted': 25,
            'driver_arriving': 50,
            'picked_up': 60,
            'in_progress': 75,
            'completed': 100,
            'cancelled': 0
        };
        setRideProgress(statusProgress[ride.status] ?? 0);

        if (ride.status === 'completed' && !ride.payment_status) {
            setShowPayment(true);
        }
    };

    const shareRide = () => {
        if (!currentRide) return;
        const shareText = `🚗 Je suis en course avec 224Solutions Taxi-Moto\nCourse: ${currentRide.id}\nDe: ${currentRide.pickupAddress}\nVers: ${currentRide.destinationAddress}\nConducteur: ${currentRide.driver?.name || 'En attente'}\nSuivi en temps réel: https://224solution.net/track/${currentRide.id}`;
        void (async () => {
            const result = await tryNativeShare({ title: t('taxiMotoTracking.suiviDeMaCourseTaxi'), text: shareText });
            if (result === 'fallback') {
                await navigator.clipboard.writeText(shareText);
                toast.success(t('taxiMotoTracking.lienDeSuiviCopieDans'));
            }
        })().catch(() => {
            navigator.clipboard.writeText(shareText);
            toast.success(t('taxiMotoTracking.lienDeSuiviCopieDans'));
        });
    };

    const contactDriver = () => {
        const phone = currentRide?.driver?.phone || driverInfo?.phone;
        if (phone) {
            window.open(`tel:${phone}`);
        } else {
            toast.error(t('taxiMotoTracking.numeroDuConducteurNonDisponible'));
        }
    };

    const cancelRide = async () => {
        if (!currentRide) return;
        if (window.confirm(t('taxiMotoTracking.etesVousSurDeVouloir'))) {
            try {
                await RidesService.updateRideStatus(currentRide.id, 'cancelled');
                toast.success(t('taxiMotoTracking.courseAnnulee'));
            } catch (error) {
                console.error('Error cancelling ride:', error);
                toast.error(t('taxiMotoTracking.erreurLorsDeLAnnulation'));
            }
        }
    };

    const getStatusInfo = (status: string) => {
        const statusMap: Record<string, { label: string; color: string; icon: any; description: string }> = {
            requested: {
                label: t('taxiMotoTracking.rechercheDeConducteur'),
                color: 'bg-orange-100 text-[#ff4000]',
                icon: Clock,
                description: t('taxiMotoTracking.nousRecherchonsUnConducteurProche')
            },
            pending: {
                label: 'En attente',
                color: 'bg-orange-100 text-[#ff4000]',
                icon: Clock,
                description: t('taxiMotoTracking.nousRecherchonsUnConducteurProche')
            },
            accepted: {
                label: t('taxiMotoTracking.conducteurAssigne'),
                color: 'bg-blue-100 text-blue-800',
                icon: CheckCircle,
                description: t('taxiMotoTracking.unConducteurAAccepteVotre')
            },
            driver_arriving: {
                label: 'Conducteur en route',
                color: 'bg-orange-100 text-orange-800',
                icon: Bike,
                description: t('taxiMotoTracking.leConducteurSeDirigeVers')
            },
            picked_up: {
                label: t('taxiMotoTracking.aBord'),
                color: 'bg-blue-100 text-[#04439e]',
                icon: Car,
                description: t('taxiMotoTracking.vousEtesABordEn')
            },
            in_progress: {
                label: 'Course en cours',
                color: 'bg-orange-100 text-[#ff4000]',
                icon: Car,
                description: t('taxiMotoTracking.vousEtesEnRouteVers')
            },
            completed: {
                label: t('taxiMotoTracking.courseTerminee'),
                color: 'bg-gray-100 text-gray-800',
                icon: CheckCircle,
                description: t('taxiMotoTracking.vousEtesArriveADestination')
            },
            cancelled: {
                label: t('taxiMotoTracking.courseAnnulee'),
                color: 'bg-orange-100 text-[#ff4000]',
                icon: AlertTriangle,
                description: t('taxiMotoTracking.cetteCourseAEteAnnulee')
            }
        };
        return statusMap[status] ?? statusMap.pending;
    };

    if (!currentRide) {
        return (
            <Card className="bg-card border-0 shadow-lg">
                <CardContent className="p-8 text-center">
                    <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">{t('taxiMotoTracking.aucuneCourseActive')}</h3>
                    <p className="text-muted-foreground">{t('taxiMotoTracking.reservezUneCoursePourVoir')}</p>
                </CardContent>
            </Card>
        );
    }

    if (showPayment && currentRide.status === 'completed') {
        return (
            <RidePaymentFlow
                rideId={currentRide.id}
                amount={currentRide.estimatedPrice}
                onPaymentSuccess={() => {
                    setShowPayment(false);
                    toast.success(t('taxiMotoTracking.merciABientotSur224solutions'));
                }}
                onCancel={() => setShowPayment(false)}
            />
        );
    }

    const statusInfo = getStatusInfo(currentRide.status);
    const StatusIcon = statusInfo.icon;
    const driver = currentRide.driver || driverInfo;

    return (
        <div className="space-y-4">

            {/* STATUT + BARRE DE PROGRESSION */}
            <Card className="bg-card border-0 shadow-lg">
                <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                        <Badge className={`${statusInfo.color} px-3 py-1 flex items-center gap-1.5`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusInfo.label}
                        </Badge>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Wifi className="w-3 h-3 text-[#ff4000]" />
                            <span>{t('taxiMotoTracking.tempsReel')}</span>
                        </div>
                    </div>

                    <p className="text-sm text-foreground mb-3">{statusInfo.description}</p>

                    {/* Barre de progression */}
                    <div className="w-full bg-secondary rounded-full h-2 mb-4">
                        <div
                            className="bg-primary h-2 rounded-full transition-all duration-700"
                            style={{ width: `${rideProgress}%` }}
                        />
                    </div>

                    {/* ETA en grand */}
                    {displayEta !== null && currentRide.status !== 'completed' && currentRide.status !== 'in_progress' && (
                        <div className="flex items-center justify-between bg-primary/8 rounded-xl p-3">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-primary" />
                                <span className="text-sm text-muted-foreground">{t('taxiMotoTracking.arriveeEstimee')}</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-primary">{displayEta}</span>
                                <span className="text-sm text-muted-foreground">min</span>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* CARTE DE SUIVI GPS EN TEMPS RÉEL */}
            <Card className="bg-card border-0 shadow-lg overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Navigation className="w-4 h-4 text-primary" />
                        Position en temps réel
                        {driverPosition && (
                            <span className="ml-auto flex items-center gap-1 text-xs font-normal text-[#ff4000]">
                                <span className="w-1.5 h-1.5 bg-[#ff4000] rounded-full animate-pulse" />
                                Actif
                            </span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Zone de carte visuelle */}
                    <div className="relative h-52 bg-blue-50 flex items-center justify-center overflow-hidden">

                        {/* Fond grille style carte */}
                        <div className="absolute inset-0 opacity-10"
                            style={{
                                backgroundImage: 'linear-gradient(#04439e 1px, transparent 1px), linear-gradient(90deg, #04439e 1px, transparent 1px)',
                                backgroundSize: '32px 32px'
                            }}
                        />

                        {driverPosition ? (
                            <div className="relative w-full h-full flex items-center justify-center">

                                {/* Ligne de connexion entre chauffeur et client */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-32 border-t-2 border-dashed border-primary/40" />
                                </div>

                                {/* Point du chauffeur (gauche) */}
                                <div className="absolute left-1/4 top-1/2 -translate-y-1/2 flex flex-col items-center">
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg">
                                            <Bike className="w-6 h-6 text-white" />
                                        </div>
                                        {isMoving && (
                                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff4000] opacity-75" />
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#ff4000]" />
                                            </span>
                                        )}
                                    </div>
                                    <span className="mt-1 text-xs font-medium text-primary bg-white/80 rounded px-1">
                                        Conducteur
                                    </span>
                                </div>

                                {/* Flèche au centre */}
                                <ArrowRight className="text-primary/50 w-5 h-5" />

                                {/* Point du client (droite) */}
                                <div className="absolute right-1/4 top-1/2 -translate-y-1/2 flex flex-col items-center">
                                    <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
                                        <MapPin className="w-6 h-6 text-white" />
                                    </div>
                                    <span className="mt-1 text-xs font-medium text-orange-600 bg-white/80 rounded px-1">
                                        Vous
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center">
                                <Loader2 className="w-8 h-8 mx-auto mb-2 text-primary animate-spin" />
                                <p className="text-sm text-muted-foreground">{t('taxiMotoTracking.localisationDuConducteur')}</p>
                            </div>
                        )}
                    </div>

                    {/* Infos de distance en bas de la carte */}
                    {driverPosition && (
                        <div className="px-4 py-3 grid grid-cols-2 gap-3 border-t">
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground mb-0.5">Distance</p>
                                <p className="text-base font-bold text-primary">
                                    {distanceToDriver !== null
                                        ? distanceToDriver < 1
                                            ? `${Math.round(distanceToDriver * 1000)} m`
                                            : `${distanceToDriver.toFixed(1)} km`
                                        : '–'
                                    }
                                </p>
                            </div>
                            <div className="text-center border-l">
                                <p className="text-xs text-muted-foreground mb-0.5">{t('taxiMotoTracking.arriveDans')}</p>
                                <p className="text-base font-bold text-[#ff4000]">
                                    {displayEta !== null ? `${displayEta} min` : '–'}
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* INFORMATIONS DU CONDUCTEUR */}
            {driver && (
                <Card className="bg-card border-0 shadow-lg">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">{t('taxiMotoTracking.votreConducteur')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                {driver.photo ? (
                                    <img src={driver.photo} alt={driver.name} className="w-14 h-14 rounded-full object-cover" />
                                ) : (
                                    <User className="w-7 h-7 text-primary" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-base truncate">{driver.name}</h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Star className="w-3.5 h-3.5 fill-[#ff4000] text-[#ff4000]" />
                                    <span>{driver.rating?.toFixed(1)}</span>
                                    <span>•</span>
                                    <span className="capitalize">{driver.vehicleType?.replace('_', ' ')}</span>
                                </div>
                                {driver.vehicleNumber && driver.vehicleNumber !== 'N/A' && (
                                    <p className="text-xs text-muted-foreground">Plaque: {driver.vehicleNumber}</p>
                                )}
                            </div>
                            {isMoving && (
                                <Badge className="bg-orange-100 text-[#ff4000] text-xs flex-shrink-0">
                                    En mouvement
                                </Badge>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button onClick={contactDriver} variant="outline" className="flex-1">
                                <Phone className="w-4 h-4 mr-2" />
                                Appeler
                            </Button>
                            <Button
                                onClick={() => {
                                    const driverUserId = currentRide?.driver?.user_id || driverInfo?.user_id;
                                    if (driverUserId) navigate(`/messages?recipientId=${driverUserId}`);
                                }}
                                variant="outline"
                                className="flex-1"
                            >
                                <MessageCircle className="w-4 h-4 mr-2" />
                                Message
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* DÉTAILS DU TRAJET */}
            <Card className="bg-card border-0 shadow-lg">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t('taxiMotoTracking.detailsDuTrajet')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="w-3 h-3 bg-[#ff4000] rounded-full mt-1.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-muted-foreground">{t('taxiMotoTracking.depart')}</p>
                            <p className="text-sm font-medium">{currentRide.pickupAddress}</p>
                        </div>
                    </div>
                    <div className="ml-1.5 border-l-2 border-dashed border-muted-foreground/30 h-3" />
                    <div className="flex items-start gap-3">
                        <div className="w-3 h-3 bg-[#ff4000] rounded-full mt-1.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-muted-foreground">Destination</p>
                            <p className="text-sm font-medium">{currentRide.destinationAddress}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t">
                        <span className="text-sm font-medium">{t('taxiMotoTracking.prixEstime')}</span>
                        <LocalPrice amount={currentRide.estimatedPrice} currency="GNF" size="lg" />
                    </div>
                </CardContent>
            </Card>

            {/* ACTIONS */}
            <div className="flex gap-3">
                <Button onClick={shareRide} variant="outline" className="flex-1">
                    <Share2 className="w-4 h-4 mr-2" />
                    Partager
                </Button>
                {(currentRide.status === 'pending' || currentRide.status === 'accepted') && (
                    <Button onClick={cancelRide} variant="destructive" className="flex-1">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Annuler
                    </Button>
                )}
            </div>
            {/* Bloc SOS retiré côté client : seul le chauffeur peut déclencher une alerte SOS. */}
        </div>
    );
}
