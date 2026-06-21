/**
 * COMPOSANT DE RÉSERVATION TAXI-MOTO ULTRA PROFESSIONNEL V2
 * Interface avec GPS ultra-précis et géocodage Google Maps
 * 224Solutions - Taxi-Moto System
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/Money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    MapPin,
    Navigation,
    Clock,
    CreditCard,
    Star,
    Loader2,
    Calendar,
    Users,
    Zap,
    DollarSign,
    Route,
    CheckCircle,
    AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { getVehicleTypeInfo } from "@/services/pricingService";
import { useAuth } from "@/hooks/useAuth";
import { TaxiMotoService } from "@/services/taxi/TaxiMotoService";
import { supabase } from "@/integrations/supabase/client";
import PaymentMethodStep from "./PaymentMethodStep";
import { PaymentMethod } from "@/services/taxi/paymentsService";
import DestinationPreview from "./DestinationPreview";
import GooglePlacesAddressInput, { ValidatedAddress } from "@/components/shared/GooglePlacesAddressInput";
import { precisionGeoService } from "@/services/gps/PrecisionGeolocationService";

interface LocationCoordinates {
    latitude: number;
    longitude: number;
}

interface Driver {
    id: string;
    name: string;
    rating: number;
    distance: number;
    vehicleType: string;
    eta: string;
    rides: number;
}

interface TaxiMotoBookingProps {
    userLocation: LocationCoordinates | null;
    nearbyDrivers: Driver[];
    onRideCreated: (ride: unknown) => void;
}

export default function TaxiMotoBooking({
    userLocation,
    nearbyDrivers,
    onRideCreated
}: TaxiMotoBookingProps) {
    const { t } = useTranslation();
    const { user } = useAuth();

    // États du formulaire - GPS ultra-précis
    const [pickupAddress, setPickupAddress] = useState<ValidatedAddress | null>(null);
    const [destinationAddress, setDestinationAddress] = useState<ValidatedAddress | null>(null);
    const [_selectedVehicleType, _setSelectedVehicleType] = useState<'moto_economique' | 'moto_rapide' | 'moto_premium'>('moto_rapide');
    const [scheduledTime, setScheduledTime] = useState('');
    const [isScheduled, setIsScheduled] = useState(false);

    // États de calcul
    const [routeInfo, setRouteInfo] = useState<{
        distance: number;
        duration: number;
        distanceText: string;
        durationText: string;
    } | null>(null);
    const [priceEstimate, setPriceEstimate] = useState<{
        totalPrice: number;
        basePrice: number;
        distance: number;
        duration: number;
        currency: string;
    } | null>(null);
    const [_priceComparison, setPriceComparison] = useState<unknown[]>([]);

    // États de chargement
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [_loadingPrice, setLoadingPrice] = useState(false);
    const [bookingInProgress, setBookingInProgress] = useState(false);

    // État pour l'étape de paiement
    const [showPaymentStep, setShowPaymentStep] = useState(false);
    const [walletBalance, setWalletBalance] = useState(0);

    // Charger le solde du wallet
    useEffect(() => {
        const loadWalletBalance = async () => {
            if (!user) return;
            const { data } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', user.id)
                .eq('currency', 'GNF')
                .maybeSingle();
            if (data) {
                setWalletBalance(data.balance || 0);
            }
        };
        loadWalletBalance();
    }, [user]);

    /**
     * Calcule l'itinéraire et le prix via Google Maps Directions API
     */
    const calculateRouteAndPrice = useCallback(async () => {
        if (!pickupAddress || !destinationAddress) return;

        setLoadingRoute(true);
        setLoadingPrice(true);

        try {
            // Calculer l'itinéraire via routes réelles Google Maps
            const route = await precisionGeoService.calculateRoute(
                { latitude: pickupAddress.latitude, longitude: pickupAddress.longitude },
                { latitude: destinationAddress.latitude, longitude: destinationAddress.longitude }
            );

            if (route) {
                const distanceKm = route.distance.value / 1000;
                const durationMin = route.duration.value / 60;

                setRouteInfo({
                    distance: parseFloat(distanceKm.toFixed(2)),
                    duration: Math.round(durationMin),
                    distanceText: route.distance.text,
                    durationText: route.duration.text,
                });

                console.log('[TaxiMotoBooking] Route Google Maps:', {
                    distance: route.distance.text,
                    duration: route.duration.text,
                });

                // Calculer le prix via le service backend
                const fareCalculation = await TaxiMotoService.calculateFare(
                    distanceKm,
                    durationMin,
                    1.0
                );

                if (fareCalculation) {
                    const totalPrice = (fareCalculation as any).total_fare || (fareCalculation as any).total || fareCalculation.total;
                    const basePrice = (fareCalculation as any).base_fare || 0;

                    setPriceEstimate({
                        totalPrice: Math.round(totalPrice),
                        basePrice: Math.round(basePrice),
                        distance: distanceKm,
                        duration: durationMin,
                        currency: 'GNF'
                    });
                }
            }

            setPriceComparison([]);

        } catch (error) {
            console.error('Erreur calcul itinéraire/prix:', error);
            toast.error(t('taxiMotoBookingV2.impossibleDeCalculerLItineraire'));
            setPriceEstimate(null);
        } finally {
            setLoadingRoute(false);
            setLoadingPrice(false);
        }
    }, [pickupAddress, destinationAddress]);

    // Effet pour calculer automatiquement quand les adresses changent
    useEffect(() => {
        if (pickupAddress && destinationAddress) {
            const timer = setTimeout(calculateRouteAndPrice, 300);
            return () => clearTimeout(timer);
        }
    }, [pickupAddress, destinationAddress, calculateRouteAndPrice]);

    /**
     * Ouvre l'étape de sélection du mode de paiement
     */
    const handleProceedToPayment = () => {
        if (!user) {
            toast.error(t('taxiMotoBookingV2.veuillezVousConnecterPourReserver'));
            return;
        }

        if (!pickupAddress || !destinationAddress || !priceEstimate) {
            toast.error(t('taxiMotoBookingV2.veuillezCompleterTousLesChamps'));
            return;
        }

        setShowPaymentStep(true);
    };

    /**
     * Effectue la réservation après sélection du mode de paiement
     */
    const handleConfirmBooking = async (paymentMethod: PaymentMethod, phoneNumber?: string) => {
        if (!pickupAddress || !destinationAddress || !priceEstimate) return;

        console.log('[TaxiMotoBooking] Booking avec GPS précis:', {
            pickup: {
                address: pickupAddress.formattedAddress,
                lat: pickupAddress.latitude,
                lng: pickupAddress.longitude,
                placeId: pickupAddress.placeId,
            },
            destination: {
                address: destinationAddress.formattedAddress,
                lat: destinationAddress.latitude,
                lng: destinationAddress.longitude,
                placeId: destinationAddress.placeId,
            },
            price: priceEstimate.totalPrice,
        });

        setBookingInProgress(true);

        try {
            const ride = await TaxiMotoService.createRide({
                pickupLat: pickupAddress.latitude,
                pickupLng: pickupAddress.longitude,
                dropoffLat: destinationAddress.latitude,
                dropoffLng: destinationAddress.longitude,
                pickupAddress: pickupAddress.formattedAddress,
                dropoffAddress: destinationAddress.formattedAddress,
                distanceKm: routeInfo?.distance || 0,
                durationMin: routeInfo?.duration || 0,
                estimatedPrice: priceEstimate.totalPrice,
                paymentMethod,
                phoneNumber,
            });

            console.log('[TaxiMotoBooking] Ride created:', ride);
            onRideCreated(ride);
            toast.success(t('taxiMotoBookingV2.reservationConfirmeeRechercheDUn'));

            // Réinitialiser le formulaire
            setPickupAddress(null);
            setDestinationAddress(null);
            setRouteInfo(null);
            setPriceEstimate(null);
            setShowPaymentStep(false);

        } catch (error) {
            console.error('[TaxiMotoBooking] Booking error:', error);
            toast.error(t('taxiMotoBookingV2.erreurLorsDeLaReservation'));
        } finally {
            setBookingInProgress(false);
        }
    };

    // Si l'étape de paiement est active
    if (showPaymentStep && priceEstimate) {
        return (
            <PaymentMethodStep
                amount={priceEstimate.totalPrice}
                walletBalance={walletBalance}
                onConfirm={handleConfirmBooking}
                onBack={() => setShowPaymentStep(false)}
                isLoading={bookingInProgress}
            />
        );
    }

    return (
        <div className="space-y-4">
            {/* Formulaire de réservation */}
            <Card className="bg-card border-0 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Navigation className="w-5 h-5 text-primary" />
                        Nouvelle réservation
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Point de départ - GPS Ultra-Précis */}
                    <GooglePlacesAddressInput
                        label={t('taxiMotoBookingV2.pointDeDepart')}
                        placeholder={t('taxiMotoBookingV2.rechercherVotreAdresseDeDepart')}
                        userLocation={userLocation}
                        showCurrentLocationButton={true}
                        required={true}
                        variant="pickup"
                        onChange={setPickupAddress}
                        onValidChange={(valid) => {
                            if (!valid) {
                                setRouteInfo(null);
                                setPriceEstimate(null);
                            }
                        }}
                    />

                    {/* Destination - GPS Ultra-Précis */}
                    <GooglePlacesAddressInput
                        label="Destination"
                        placeholder={t('taxiMotoBookingV2.rechercherVotreDestination')}
                        userLocation={userLocation}
                        showCurrentLocationButton={false}
                        required={true}
                        variant="destination"
                        onChange={setDestinationAddress}
                        onValidChange={(valid) => {
                            if (!valid) {
                                setRouteInfo(null);
                                setPriceEstimate(null);
                            }
                        }}
                    />

                    {/* Statut de validation GPS */}
                    {(pickupAddress || destinationAddress) && (
                        <div className="flex flex-wrap gap-2">
                            {pickupAddress && (
                                <Badge variant="secondary" className="bg-orange-100 text-[#ff4000] text-xs">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Départ validé GPS
                                </Badge>
                            )}
                            {destinationAddress && (
                                <Badge variant="secondary" className="bg-orange-100 text-[#ff4000] text-xs">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Destination validée GPS
                                </Badge>
                            )}
                        </div>
                    )}

                    {/* Options de réservation */}
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={isScheduled}
                                onChange={(e) => setIsScheduled(e.target.checked)}
                                className="rounded"
                            />
                            <span className="text-sm">{t('taxiMotoBookingV2.reservationPlanifiee')}</span>
                        </label>

                        {isScheduled && (
                            <input
                                type="datetime-local"
                                value={scheduledTime}
                                onChange={(e) => setScheduledTime(e.target.value)}
                                min={new Date().toISOString().slice(0, 16)}
                                className="flex-1 px-3 py-2 border rounded-md text-sm"
                            />
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Aperçu de l'itinéraire */}
            {pickupAddress && destinationAddress && (
                <DestinationPreview
                    pickupAddress={pickupAddress.formattedAddress}
                    pickupCoords={{ latitude: pickupAddress.latitude, longitude: pickupAddress.longitude }}
                    destinationAddress={destinationAddress.formattedAddress}
                    destinationCoords={{ latitude: destinationAddress.latitude, longitude: destinationAddress.longitude }}
                    routeInfo={routeInfo ? {
                        distance: routeInfo.distance,
                        duration: routeInfo.duration,
                    } : undefined}
                    onClear={() => {
                        setDestinationAddress(null);
                        setRouteInfo(null);
                        setPriceEstimate(null);
                    }}
                />
            )}

            {/* Informations d'itinéraire Google Maps */}
            {routeInfo && (
                <Card className="bg-card border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="text-center">
                                    <div className="text-lg font-bold text-primary">
                                        {routeInfo.distanceText}
                                    </div>
                                    <div className="text-xs text-muted-foreground">{t('taxiMotoBookingV2.distanceReelle')}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-bold text-[#ff4000]">
                                        {routeInfo.durationText}
                                    </div>
                                    <div className="text-xs text-muted-foreground">{t('taxiMotoBookingV2.tempsEstime')}</div>
                                </div>
                            </div>

                            <Badge variant="outline" className="text-xs">
                                <Route className="w-3 h-3 mr-1" />
                                Google Maps
                            </Badge>

                            {loadingRoute && (
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Détail du prix */}
            {priceEstimate && (
                <Card className="bg-card border-0 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-[#ff4000]" />
                            Détail du prix
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span>{t('taxiMotoBookingV2.prixDeBase')}</span>
                            <span><Money amount={priceEstimate.basePrice || 0} from="GNF" /></span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>Distance ({routeInfo?.distanceText || `${priceEstimate.distance}km`})</span>
                            <span>Inclus</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>Temps estimé ({routeInfo?.durationText || `${priceEstimate.duration}min`})</span>
                            <span>Inclus</span>
                        </div>

                        <Separator />
                        <div className="flex justify-between text-lg font-bold">
                            <span>Total</span>
                            <span className="text-[#ff4000]">
                                <Money amount={priceEstimate.totalPrice || 0} from="GNF" />
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Bouton de réservation */}
            <Button
                onClick={handleProceedToPayment}
                disabled={!pickupAddress || !destinationAddress || !priceEstimate || bookingInProgress}
                className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/40"
            >
                {bookingInProgress ? (
                    <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Réservation en cours...
                    </>
                ) : (
                    <>
                        <CreditCard className="w-5 h-5 mr-2" />
                        Choisir le mode de paiement
                    </>
                )}
            </Button>

            {/* Message si adresses non validées */}
            {(!pickupAddress || !destinationAddress) && (
                <div className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Sélectionnez des adresses validées par GPS pour continuer
                </div>
            )}

            {/* Conducteurs proches */}
            {nearbyDrivers.length > 0 && (
                <Card className="bg-card border-0 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Conducteurs proches
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {nearbyDrivers.slice(0, 3).map((driver) => (
                            <div key={driver.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                                        <Users className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <div className="font-medium">{driver.name}</div>
                                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                                            <Star className="w-3 h-3 fill-[#ff4000] text-[#ff4000]" />
                                            {driver.rating} • {driver.rides} courses
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <Badge variant="secondary">{driver.eta}</Badge>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {driver.distance}km
                                    </div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
