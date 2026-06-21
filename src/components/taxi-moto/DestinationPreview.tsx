/**
 * COMPOSANT D'APERÇU DE DESTINATION
 * Affiche les détails complets de la destination sélectionnée
 * 224Solutions - Taxi-Moto System
 */

import { MapPin, Navigation2, ExternalLink, Route, Clock, ArrowRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LocationCoordinates {
    latitude: number;
    longitude: number;
}

interface DestinationPreviewProps {
    pickupAddress: string;
    pickupCoords: LocationCoordinates | null;
    destinationAddress: string;
    destinationCoords: LocationCoordinates | null;
    routeInfo?: {
        distance: number;
        duration: number;
    } | null;
    onClear?: () => void;
}

export default function DestinationPreview({
    pickupAddress,
    pickupCoords,
    destinationAddress,
    destinationCoords,
    routeInfo,
    onClear
}: DestinationPreviewProps) {
    const { t } = useTranslation();
    if (!destinationCoords || !destinationAddress) return null;

    // Ouvrir dans Google Maps
    const openInGoogleMaps = () => {
        if (pickupCoords && destinationCoords) {
            const url = `https://www.google.com/maps/dir/${pickupCoords.latitude},${pickupCoords.longitude}/${destinationCoords.latitude},${destinationCoords.longitude}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        } else if (destinationCoords) {
            const url = `https://www.google.com/maps/search/?api=1&query=${destinationCoords.latitude},${destinationCoords.longitude}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    // Parser l'adresse
    const parseAddress = (address: string) => {
        const parts = address.split(',').map(p => p.trim());
        return {
            main: parts[0] || address,
            secondary: parts.slice(1, 3).join(', '),
            full: address
        };
    };

    const destParsed = parseAddress(destinationAddress);
    const pickupParsed = parseAddress(pickupAddress || 'Position actuelle');

    return (
        <Card className="bg-primary/5 border-0 shadow-lg overflow-hidden">
            <CardContent className="p-0">
                {/* En-tête avec trajet */}
                <div className="bg-white/80 backdrop-blur-sm p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                            <Route className="w-5 h-5 text-blue-600" />
                            Aperçu du trajet
                        </h3>
                        {onClear && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClear}
                                className="text-gray-500 hover:text-[#ff4000]"
                            >
                                Modifier
                            </Button>
                        )}
                    </div>

                    {/* Itinéraire visuel */}
                    <div className="space-y-3">
                        {/* Point de départ */}
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                                <Navigation2 className="w-4 h-4 text-[#ff4000]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">{t('destinationPreview.depart')}</p>
                                <p className="font-medium text-gray-900 truncate">
                                    {pickupParsed.main}
                                </p>
                                {pickupParsed.secondary && (
                                    <p className="text-sm text-gray-500 truncate">
                                        {pickupParsed.secondary}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Ligne de connexion */}
                        <div className="flex items-center gap-3 pl-4">
                            <div className="w-0.5 h-8 bg-[#ff4000] rounded-full ml-3"></div>
                            {routeInfo && (
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <ArrowRight className="w-4 h-4" />
                                    <span>{routeInfo.distance} km</span>
                                    <span>•</span>
                                    <Clock className="w-3 h-3" />
                                    <span>~{routeInfo.duration} min</span>
                                </div>
                            )}
                        </div>

                        {/* Destination */}
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                                <MapPin className="w-4 h-4 text-[#ff4000]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-500 uppercase tracking-wide">Destination</p>
                                <p className="font-medium text-gray-900 truncate">
                                    {destParsed.main}
                                </p>
                                {destParsed.secondary && (
                                    <p className="text-sm text-gray-500 truncate">
                                        {destParsed.secondary}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Détails GPS et actions */}
                <div className="p-4 space-y-3">
                    {/* Coordonnées GPS */}
                    <div className="grid grid-cols-2 gap-3">
                        {pickupCoords && (
                            <div className="bg-white/60 rounded-lg p-2">
                                <p className="text-xs text-gray-500 mb-1">{t('destinationPreview.gpsDepart')}</p>
                                <p className="text-xs font-mono text-gray-700">
                                    {pickupCoords.latitude.toFixed(6)},
                                    <br />
                                    {pickupCoords.longitude.toFixed(6)}
                                </p>
                            </div>
                        )}
                        <div className="bg-white/60 rounded-lg p-2">
                            <p className="text-xs text-gray-500 mb-1">GPS Destination</p>
                            <p className="text-xs font-mono text-gray-700">
                                {destinationCoords.latitude.toFixed(6)},
                                <br />
                                {destinationCoords.longitude.toFixed(6)}
                            </p>
                        </div>
                    </div>

                    {/* Bouton Google Maps */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={openInGoogleMaps}
                        className="w-full bg-white/80 hover:bg-white gap-2"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Voir sur Google Maps
                    </Button>

                    {/* Badge de précision */}
                    <div className="flex items-center justify-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                            ✓ Coordonnées vérifiées
                        </Badge>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
