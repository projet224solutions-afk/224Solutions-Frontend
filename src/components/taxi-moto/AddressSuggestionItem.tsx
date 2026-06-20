/**
 * COMPOSANT DE SUGGESTION D'ADRESSE DÉTAILLÉE
 * Affiche les détails complets d'une suggestion d'adresse
 * 224Solutions - Taxi-Moto System
 */

import { MapPin, Building, Navigation2, Map } from "lucide-react";

interface AddressSuggestion {
    address: string;
    coordinates: {
        latitude: number;
        longitude: number;
    };
    placeType?: string;
    neighborhood?: string;
    city?: string;
    country?: string;
}

interface AddressSuggestionItemProps {
    suggestion: AddressSuggestion;
    onClick: () => void;
    isSelected?: boolean;
}

export default function AddressSuggestionItem({
    suggestion,
    onClick,
    isSelected
}: AddressSuggestionItemProps) {
    // Parser l'adresse pour extraire les composants
    const addressParts = suggestion.address.split(',').map(part => part.trim());
    const mainAddress = addressParts[0] || suggestion.address;
    const secondaryAddress = addressParts.slice(1).join(', ');

    // Déterminer l'icône selon le type
    const getIcon = () => {
        const addressLower = suggestion.address.toLowerCase();
        if (addressLower.includes('hôtel') || addressLower.includes('hotel')) {
            return <Building className="w-5 h-5 text-blue-500" />;
        }
        if (addressLower.includes('marché') || addressLower.includes('market')) {
            return <Map className="w-5 h-5 text-[#ff4000]" />;
        }
        if (addressLower.includes('aéroport') || addressLower.includes('airport')) {
            return <Navigation2 className="w-5 h-5 text-[#04439e]" />;
        }
        return <MapPin className="w-5 h-5 text-[#ff4000]" />;
    };

    return (
        <button
            onClick={onClick}
            className={`
                w-full text-left px-4 py-3
                hover:bg-blue-50
                border-b border-gray-100 last:border-b-0
                transition-colors duration-150
                flex items-start gap-3
                ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}
            `}
        >
            <div className="flex-shrink-0 mt-0.5">
                {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                    {mainAddress}
                </p>
                {secondaryAddress && (
                    <p className="text-sm text-gray-500 truncate mt-0.5">
                        {secondaryAddress}
                    </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                        📍 {suggestion.coordinates.latitude.toFixed(4)}, {suggestion.coordinates.longitude.toFixed(4)}
                    </span>
                </div>
            </div>
        </button>
    );
}
