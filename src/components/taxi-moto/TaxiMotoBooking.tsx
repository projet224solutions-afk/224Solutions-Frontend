/**
 * COMPOSANT DE RÉSERVATION TAXI-MOTO ULTRA PROFESSIONNEL
 * Interface de réservation avec géolocalisation et calcul de tarifs en temps réel
 * 224Solutions - Taxi-Moto System
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/Money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    MapPin,
    Navigation,
    _Clock,
    CreditCard,
    Star,
    Loader2,
    _Calendar,
    Users,
    _Zap,
    DollarSign,
    _Route,
    Search
} from "lucide-react";
import { toast } from "sonner";
import { mapService } from "@/services/mapService";
import { getVehicleTypeInfo } from "@/services/pricingService";
import { useAuth } from "@/hooks/useAuth";
import { TaxiMotoService } from "@/services/taxi/TaxiMotoService";
import { supabase } from "@/integrations/supabase/client";
import PaymentMethodStep from "./PaymentMethodStep";
import { PaymentMethod } from "@/services/taxi/paymentsService";
import AddressSuggestionItem from "./AddressSuggestionItem";
import DestinationPreview from "./DestinationPreview";

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

    // États du formulaire
    const [pickupAddress, setPickupAddress] = useState('');
    const [destinationAddress, setDestinationAddress] = useState('');
    const [selectedVehicleType, setSelectedVehicleType] = useState<'moto_economique' | 'moto_rapide' | 'moto_premium'>('moto_rapide');
    const [scheduledTime, setScheduledTime] = useState('');
    const [isScheduled, setIsScheduled] = useState(false);

    // États de calcul
    const [routeInfo, setRouteInfo] = useState<unknown>(null);
    const [priceEstimate, setPriceEstimate] = useState<unknown>(null);
    const [priceComparison, setPriceComparison] = useState<unknown[]>([]);

    // États de chargement
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [_loadingPrice, setLoadingPrice] = useState(false);
    const [bookingInProgress, setBookingInProgress] = useState(false);

    // États de géocodage
    const [pickupSuggestions, setPickupSuggestions] = useState<unknown[]>([]);
    const [destinationSuggestions, setDestinationSuggestions] = useState<unknown[]>([]);
    const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
    const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
    const [pickupSearchQuery, setPickupSearchQuery] = useState('');
    const [destinationSearchQuery, setDestinationSearchQuery] = useState('');

    // Coordonnées sélectionnées
    const [pickupCoords, setPickupCoords] = useState<LocationCoordinates | null>(null);
    const [destinationCoords, setDestinationCoords] = useState<LocationCoordinates | null>(null);

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
     * Utilise la position actuelle comme point de départ
     */
    const useCurrentLocation = async () => {
        console.log('[TaxiMotoBooking] Demande de position actuelle...');

        if (userLocation) {
            setPickupCoords(userLocation);
            setPickupAddress('Position actuelle');
            toast.success(t('taxiMotoBooking.positionActuelleUtiliseeCommePoint'));
            console.log('[TaxiMotoBooking] Position utilisée:', userLocation);
            return;
        }

        // Si pas de position, demander l'accès GPS
        toast.info(t('taxiMotoBooking.demandeDAccesAVotre'));

        if (!navigator.geolocation) {
            toast.error(t('taxiMotoBooking.laGeolocalisationNEstPas'));
            return;
        }

        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            });

            const newLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                timestamp: Date.now()
            };

            setPickupCoords(newLocation);
            setPickupAddress('Position actuelle');
            toast.success(t('taxiMotoBooking.positionGpsObtenueAvecSucces'));
            console.log('[TaxiMotoBooking] Position GPS obtenue:', newLocation);

        } catch (error) {
            console.error('[TaxiMotoBooking] Erreur GPS:', error);

            if (error instanceof GeolocationPositionError) {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        toast.error(t('taxiMotoBooking.accesGpsRefuseVeuillezAutoriser'));
                        break;
                    case error.POSITION_UNAVAILABLE:
                        toast.error(t('taxiMotoBooking.positionGpsNonDisponibleVerifiez'));
                        break;
                    case error.TIMEOUT:
                        toast.error(t('taxiMotoBooking.delaiDAttenteGpsDepasse'));
                        break;
                    default:
                        toast.error(t('taxiMotoBooking.erreurLorsDeLObtention'));
                }
            } else {
                toast.error(t('taxiMotoBooking.impossibleDObtenirVotrePosition'));
            }
        }
    };

    /**
     * Géocode une adresse avec debouncing
     */
    const geocodeAddress = useCallback(async (address: string, isPickup: boolean) => {
        // Longueur minimale de 3 caractères pour une recherche plus précise
        if (address.length < 3) {
            // Masquer les suggestions si trop court
            if (isPickup) {
                setShowPickupSuggestions(false);
            } else {
                setShowDestinationSuggestions(false);
            }
            return;
        }

        try {
            const results = await mapService.geocodeAddress(address);

            if (results && results.length > 0) {
                if (isPickup) {
                    setPickupSuggestions(results);
                    setShowPickupSuggestions(true);
                } else {
                    setDestinationSuggestions(results);
                    setShowDestinationSuggestions(true);
                }
            } else {
                // Pas de résultats, masquer les suggestions
                if (isPickup) {
                    setShowPickupSuggestions(false);
                } else {
                    setShowDestinationSuggestions(false);
                }
            }
        } catch (error) {
            console.warn('[TaxiMotoBooking] Geocoding error:', error);
            // Ne pas afficher d'erreur à l'utilisateur pour éviter le spam
            // Masquer simplement les suggestions
            if (isPickup) {
                setShowPickupSuggestions(false);
            } else {
                setShowDestinationSuggestions(false);
            }
        }
    }, []);

    /**
     * Sélectionne une suggestion d'adresse
     */
    const selectAddressSuggestion = (suggestion: unknown, isPickup: boolean) => {
        if (isPickup) {
            setPickupAddress(suggestion.address);
            setPickupCoords(suggestion.coordinates);
            setShowPickupSuggestions(false);
        } else {
            setDestinationAddress(suggestion.address);
            setDestinationCoords(suggestion.coordinates);
            setShowDestinationSuggestions(false);
        }
    };

    /**
     * Calcule l'itinéraire et le prix
     */
    const calculateRouteAndPrice = useCallback(async () => {
        if (!pickupCoords || !destinationCoords) return;

        setLoadingRoute(true);
        setLoadingPrice(true);

        try {
            // Obtenir l'itinéraire
            const route = await mapService.getRoute(pickupCoords, destinationCoords);
            console.log('[TaxiMotoBooking] Route calculated:', route);
            setRouteInfo(route);

            // Calculer le prix via le service backend
            const fareCalculation = await TaxiMotoService.calculateFare(
                route.distance,
                route.duration,
                1.0 // surge multiplier
            );

            console.log('[TaxiMotoBooking] Fare calculated:', fareCalculation);

            // Formater le prix pour l'affichage
            const totalPrice = fareCalculation.total_fare || fareCalculation.total;
            const basePrice = fareCalculation.base_fare || 0;

            if (fareCalculation && typeof totalPrice === 'number') {
                setPriceEstimate({
                    totalPrice: Math.round(totalPrice),
                    distance: route.distance,
                    duration: route.duration,
                    basePrice: Math.round(basePrice),
                    currency: 'GNF'
                });
            } else {
                console.error('[TaxiMotoBooking] Prix invalide retourné:', fareCalculation);
                setPriceEstimate(null);
                toast.error(t('taxiMotoBooking.erreurLorsDuCalculDu'));
            }

            // Réinitialiser la comparaison
            setPriceComparison([]);

        } catch (error) {
            console.error('Erreur calcul itinéraire/prix:', error);
            toast.error(t('taxiMotoBooking.impossibleDeCalculerLItineraire'));
            setPriceEstimate(null);
        } finally {
            setLoadingRoute(false);
            setLoadingPrice(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pickupCoords, destinationCoords, selectedVehicleType, isScheduled, scheduledTime]);

    /**
     * Ouvre l'étape de sélection du mode de paiement
     */
    const handleProceedToPayment = () => {
        if (!user) {
            toast.error(t('taxiMotoBooking.veuillezVousConnecterPourReserver'));
            return;
        }

        if (!pickupCoords || !destinationCoords || !priceEstimate) {
            toast.error(t('taxiMotoBooking.veuillezCompleterTousLesChamps'));
            return;
        }

        setShowPaymentStep(true);
    };

    /**
     * Effectue la réservation après sélection du mode de paiement
     */
    const handleConfirmBooking = async (paymentMethod: PaymentMethod, phoneNumber?: string) => {
        if (!pickupCoords || !destinationCoords || !priceEstimate) return;

        console.log('[TaxiMotoBooking] Starting booking with:', {
            pickupCoords,
            destinationCoords,
            priceEstimate,
            routeInfo,
            paymentMethod,
            phoneNumber
        });

        setBookingInProgress(true);

        try {
            const ride = await TaxiMotoService.createRide({
                pickupLat: pickupCoords.latitude,
                pickupLng: pickupCoords.longitude,
                dropoffLat: destinationCoords.latitude,
                dropoffLng: destinationCoords.longitude,
                pickupAddress: pickupAddress || 'Point de départ',
                dropoffAddress: destinationAddress || 'Destination',
                distanceKm: routeInfo?.distance || 0,
                durationMin: routeInfo?.duration || 0,
                estimatedPrice: priceEstimate.totalPrice,
                paymentMethod,
                phoneNumber
            });

            console.log('[TaxiMotoBooking] Ride created successfully:', ride);
            onRideCreated(ride);
            toast.success(t('taxiMotoBooking.reservationConfirmeeRechercheDUn'));

            // Réinitialiser le formulaire
            setPickupAddress('');
            setDestinationAddress('');
            setPickupCoords(null);
            setDestinationCoords(null);
            setRouteInfo(null);
            setPriceEstimate(null);
            setShowPaymentStep(false);

        } catch (error) {
            console.error('[TaxiMotoBooking] Booking error:', error);
            toast.error(t('taxiMotoBooking.erreurLorsDeLaReservation'));
        } finally {
            setBookingInProgress(false);
        }
    };

    // Effet pour calculer automatiquement quand les coordonnées changent
    useEffect(() => {
        if (pickupCoords && destinationCoords) {
            const timer = setTimeout(calculateRouteAndPrice, 500);
            return () => clearTimeout(timer);
        }
    }, [pickupCoords, destinationCoords, selectedVehicleType, calculateRouteAndPrice]);

    // Debouncing pour le geocoding du pickup
    useEffect(() => {
        if (pickupSearchQuery.length >= 5) {
            const timer = setTimeout(() => {
                geocodeAddress(pickupSearchQuery, true);
            }, 800);
            return () => clearTimeout(timer);
        } else if (pickupSearchQuery.length > 0 && pickupSearchQuery.length < 5) {
            setShowPickupSuggestions(false);
        }
    }, [pickupSearchQuery, geocodeAddress]);

    // Debouncing pour le geocoding de la destination - recherche plus rapide
    useEffect(() => {
        if (destinationSearchQuery.length >= 3) {
            const timer = setTimeout(() => {
                geocodeAddress(destinationSearchQuery, false);
            }, 500); // Réduit à 500ms pour une réponse plus rapide
            return () => clearTimeout(timer);
        } else if (destinationSearchQuery.length > 0 && destinationSearchQuery.length < 3) {
            setShowDestinationSuggestions(false);
        }
    }, [destinationSearchQuery, geocodeAddress]);

    // Si l'étape de paiement est active, afficher le composant de sélection
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
            <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Navigation className="w-5 h-5 text-blue-600" />
                        Nouvelle réservation
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Point de départ */}
                    <div className="relative">
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                            Point de départ
                        </label>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <Input
                                    placeholder={t('taxiMotoBooking.saisissezVotreAdresseDeDepart')}
                                    value={pickupAddress}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setPickupAddress(value);
                                        setPickupSearchQuery(value);
                                    }}
                                    className="pl-10"
                                />
                                <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-3" />

                                {/* Suggestions de départ */}
                                {showPickupSuggestions && pickupSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 bg-white border rounded-md shadow-lg z-10 max-h-40 overflow-y-auto">
                                        {pickupSuggestions.map((suggestion, index) => (
                                            <button
                                                key={index}
                                                onClick={() => selectAddressSuggestion(suggestion, true)}
                                                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                                            >
                                                {suggestion.address}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <Button
                                onClick={useCurrentLocation}
                                variant="outline"
                                size="icon"
                                className="shrink-0 hover:bg-blue-50 hover:border-blue-500 hover:text-blue-600 transition-all active:scale-95"
                                title="Utiliser ma position actuelle"
                            >
                                <Navigation className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Destination avec recherche améliorée */}
                    <div className="relative">
                        <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[#ff4000]" />
                            Destination
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    placeholder={t('taxiMotoBooking.tapezUneAdresseOuUn')}
                                    value={destinationAddress}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setDestinationAddress(value);
                                        setDestinationSearchQuery(value);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && destinationAddress.length >= 3) {
                                            e.preventDefault();
                                            geocodeAddress(destinationAddress, false);
                                        }
                                    }}
                                    className="pl-10 pr-4"
                                />
                                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />

                                {/* Indicateur de recherche en cours */}
                                {destinationSearchQuery.length >= 3 && destinationSearchQuery.length < 5 && (
                                    <div className="absolute right-3 top-3">
                                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>

                            {/* Bouton de recherche explicite */}
                            <Button
                                onClick={() => {
                                    if (destinationAddress.length >= 3) {
                                        geocodeAddress(destinationAddress, false);
                                    }
                                }}
                                variant="default"
                                size="icon"
                                disabled={destinationAddress.length < 3}
                                className="shrink-0 bg-[#ff4000] hover:bg-[#ff4000] text-white transition-all active:scale-95 disabled:opacity-50"
                                title={t('taxiMotoBooking.rechercherCetteAdresse')}
                            >
                                <Search className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Message d'aide contextuel */}
                        {destinationAddress.length > 0 && destinationAddress.length < 3 && (
                            <p className="text-xs text-[#ff4000] mt-1 flex items-center gap-1">
                                <span>⚡</span> Tapez au moins 3 caractères pour rechercher
                            </p>
                        )}

                        {/* Suggestions de destination améliorées */}
                        {showDestinationSuggestions && destinationSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white border rounded-xl shadow-2xl z-20 max-h-72 overflow-y-auto mt-1">
                                <div className="sticky top-0 bg-gradient-to-r from-orange-50 to-orange-50 px-4 py-2.5 border-b flex items-center justify-between">
                                    <span className="text-xs text-gray-600 font-medium">
                                        🎯 {destinationSuggestions.length} résultat(s) trouvé(s)
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        Sélectionnez une adresse
                                    </span>
                                </div>
                                {destinationSuggestions.map((suggestion, index) => (
                                    <AddressSuggestionItem
                                        key={index}
                                        suggestion={suggestion}
                                        onClick={() => selectAddressSuggestion(suggestion, false)}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Message quand aucun résultat */}
                        {showDestinationSuggestions && destinationSuggestions.length === 0 && destinationSearchQuery.length >= 5 && (
                            <div className="absolute top-full left-0 right-0 bg-white border rounded-xl shadow-xl z-20 mt-1 p-4 text-center">
                                <p className="text-sm text-gray-500">{t('taxiMotoBooking.aucunResultatTrouve')}</p>
                                <p className="text-xs text-gray-400 mt-1">{t('taxiMotoBooking.essayezAvecUneAdressePlus')}</p>
                            </div>
                        )}
                    </div>

                    {/* Options de réservation */}
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={isScheduled}
                                onChange={(e) => setIsScheduled(e.target.checked)}
                                className="rounded"
                            />
                            <span className="text-sm">{t('taxiMotoBooking.reservationPlanifiee')}</span>
                        </label>

                        {isScheduled && (
                            <Input
                                type="datetime-local"
                                value={scheduledTime}
                                onChange={(e) => setScheduledTime(e.target.value)}
                                min={new Date().toISOString().slice(0, 16)}
                                className="flex-1"
                            />
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Aperçu détaillé de la destination */}
            {destinationCoords && destinationAddress && (
                <DestinationPreview
                    pickupAddress={pickupAddress}
                    pickupCoords={pickupCoords}
                    destinationAddress={destinationAddress}
                    destinationCoords={destinationCoords}
                    routeInfo={routeInfo}
                    onClear={() => {
                        setDestinationAddress('');
                        setDestinationCoords(null);
                        setRouteInfo(null);
                    }}
                />
            )}

            {/* Informations d'itinéraire compactes */}
            {routeInfo && !destinationCoords && (
                <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="text-center">
                                    <div className="text-lg font-bold text-blue-600">
                                        {routeInfo.distance}km
                                    </div>
                                    <div className="text-xs text-gray-600">Distance</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-lg font-bold text-[#ff4000]">
                                        {routeInfo.duration}min
                                    </div>
                                    <div className="text-xs text-gray-600">{t('taxiMotoBooking.duree')}</div>
                                </div>
                            </div>

                            {loadingRoute && (
                                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Comparaison des prix */}
            {priceComparison.length > 0 && (
                <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-lg">{t('taxiMotoBooking.choisissezVotreMoto')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {priceComparison.map((option) => {
                            const vehicleInfo = getVehicleTypeInfo(option.vehicleType);
                            const isSelected = selectedVehicleType === option.vehicleType;

                            return (
                                <button
                                    key={option.vehicleType}
                                    onClick={() => setSelectedVehicleType(option.vehicleType as unknown)}
                                    className={`w-full p-4 rounded-lg border-2 transition-all ${isSelected
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="text-2xl">{vehicleInfo.icon}</div>
                                            <div className="text-left">
                                                <div className="font-semibold">{vehicleInfo.name}</div>
                                                <div className="text-sm text-gray-600">{option.estimatedArrival}</div>
                                                <div className="text-xs text-gray-500">
                                                    {vehicleInfo.features.slice(0, 2).join(' • ')}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="text-lg font-bold text-[#ff4000]">
                                                <Money amount={option.price?.totalPrice || 0} from="GNF" />
                                            </div>
                                            {option.price?.appliedMultipliers?.length > 0 && (
                                                <Badge variant="secondary" className="text-xs">
                                                    +{Math.round(((option.price?.surgeMultiplier || 1) - 1) * 100)}%
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* Détail du prix sélectionné */}
            {priceEstimate && (
                <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-[#ff4000]" />
                            Détail du prix
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between">
                            <span>{t('taxiMotoBooking.prixDeBase')}</span>
                            <span><Money amount={priceEstimate?.basePrice || 0} from="GNF" /></span>
                        </div>
                        <div className="flex justify-between">
                            <span>Distance ({routeInfo?.distance}km)</span>
                            <span><Money amount={priceEstimate?.distancePrice || 0} from="GNF" /></span>
                        </div>
                        <div className="flex justify-between">
                            <span>Temps ({routeInfo?.duration}min)</span>
                            <span><Money amount={priceEstimate?.timePrice || 0} from="GNF" /></span>
                        </div>

                        {priceEstimate?.appliedMultipliers?.length > 0 && (
                            <>
                                <Separator />
                                {priceEstimate.appliedMultipliers.map((multiplier, index) => (
                                    <div key={index} className="flex justify-between text-sm">
                                        <span className="text-orange-600">{multiplier?.reason || 'Majoration'}</span>
                                        <span className="text-orange-600">
                                            +{Math.round(((multiplier?.multiplier || 1) - 1) * 100)}%
                                        </span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-sm">
                                    <span>Majoration</span>
                                    <span>+<Money amount={priceEstimate?.surgeAmount || 0} from="GNF" /></span>
                                </div>
                            </>
                        )}

                        <div className="flex justify-between text-sm">
                            <span>TVA (18%)</span>
                            <span><Money amount={priceEstimate?.taxes || 0} from="GNF" /></span>
                        </div>

                        <Separator />
                        <div className="flex justify-between text-lg font-bold">
                            <span>Total</span>
                            <span className="text-[#ff4000]">
                                <Money amount={priceEstimate?.totalPrice || 0} from="GNF" />
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Bouton de réservation - ouvre l'étape de paiement */}
            <Button
                onClick={handleProceedToPayment}
                disabled={!pickupCoords || !destinationCoords || !priceEstimate || bookingInProgress}
                className="w-full h-12 text-lg font-semibold bg-[#04439e]"
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

            {/* Conducteurs proches */}
            {nearbyDrivers.length > 0 && (
                <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-lg">Conducteurs proches</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {nearbyDrivers.slice(0, 3).map((driver) => (
                            <div key={driver.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                        <Users className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="font-medium">{driver.name}</div>
                                        <div className="text-sm text-gray-600 flex items-center gap-2">
                                            <Star className="w-3 h-3 fill-[#ff4000] text-[#ff4000]" />
                                            {driver.rating} • {driver.rides} courses
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="text-sm font-medium">{driver.distance}km</div>
                                    <div className="text-xs text-gray-600">{driver.eta}</div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
