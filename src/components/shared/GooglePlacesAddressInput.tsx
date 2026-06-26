/**
 * GOOGLE PLACES ADDRESS INPUT
 * Composant d'entrée d'adresse avec autocomplétion Google Places
 * 224Solutions - GPS Ultra-Précis
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  MapPin,
  Crosshair,
  Loader2,
  CheckCircle,
  AlertCircle,
  Navigation,
  Building2,
  Home,
  ShoppingBag,
  Plane,
  Hotel
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  precisionGeoService,
  AddressSuggestion,
  PlaceDetails
} from '@/services/gps/PrecisionGeolocationService';

// Types
export interface ValidatedAddress {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  placeId: string;
  addressComponents?: PlaceDetails['addressComponents'];
}

interface GooglePlacesAddressInputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (address: ValidatedAddress | null) => void;
  onValidChange?: (isValid: boolean) => void;
  /** Texte brut tapé (utile pour des suggestions locales en parallèle de Google) */
  onInputChange?: (raw: string) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  showCurrentLocationButton?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  variant?: 'default' | 'pickup' | 'destination';
}

// Icône selon le type de lieu
const getPlaceIcon = (types: string[]) => {
  if (types.includes('airport')) return <Plane className="w-4 h-4" />;
  if (types.includes('lodging') || types.includes('hotel')) return <Hotel className="w-4 h-4" />;
  if (types.includes('store') || types.includes('shopping_mall') || types.includes('market')) return <ShoppingBag className="w-4 h-4" />;
  if (types.includes('establishment')) return <Building2 className="w-4 h-4" />;
  if (types.includes('street_address') || types.includes('route')) return <Home className="w-4 h-4" />;
  return <MapPin className="w-4 h-4" />;
};

export function GooglePlacesAddressInput({
  label,
  placeholder = 'Rechercher une adresse...',
  value: initialValue = '',
  onChange,
  onValidChange,
  onInputChange,
  userLocation,
  showCurrentLocationButton = true,
  required = false,
  disabled = false,
  className,
  inputClassName,
  variant = 'default',
}: GooglePlacesAddressInputProps) {
  const { t } = useTranslation();
  // États
  const [inputValue, setInputValue] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<ValidatedAddress | null>(null);
  const [isValid, setIsValid] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Couleurs selon le variant
  const variantStyles = {
    default: {
      icon: 'text-primary',
      badge: 'bg-primary/10 text-primary',
    },
    pickup: {
      icon: 'text-[#ff4000]',
      badge: 'bg-orange-100 text-[#ff4000]',
    },
    destination: {
      icon: 'text-[#ff4000]',
      badge: 'bg-orange-100 text-[#ff4000]',
    },
  };

  const currentStyle = variantStyles[variant];

  /**
   * Recherche d'adresses avec debounce
   */
  const searchAddresses = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);

    try {
      const results = await precisionGeoService.searchAddresses(
        query,
        userLocation || undefined
      );

      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (error) {
      console.error('[GooglePlacesInput] Erreur recherche:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [userLocation]);

  /**
   * Gestion de la saisie avec debounce
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    onInputChange?.(value); // expose le texte brut (suggestions locales)

    // Invalider l'adresse précédente
    if (selectedAddress) {
      setSelectedAddress(null);
      setIsValid(false);
      onChange?.(null);
      onValidChange?.(false);
    }

    // Debounce la recherche
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchAddresses(value);
    }, 300);
  }, [selectedAddress, searchAddresses, onChange, onValidChange, onInputChange]);

  /**
   * Sélection d'une suggestion
   */
  const handleSelectSuggestion = useCallback(async (suggestion: AddressSuggestion) => {
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const details = await precisionGeoService.getPlaceDetails(suggestion.placeId);

      if (details && details.latitude && details.longitude) {
        const validatedAddress: ValidatedAddress = {
          formattedAddress: details.formattedAddress,
          latitude: details.latitude,
          longitude: details.longitude,
          placeId: details.placeId,
          addressComponents: details.addressComponents,
        };

        setInputValue(details.formattedAddress);
        setSelectedAddress(validatedAddress);
        setIsValid(true);
        onChange?.(validatedAddress);
        onValidChange?.(true);

        toast.success(t('googlePlacesAddressInput.adresseValideeAvecCoordonneesGps'));
      } else {
        toast.error(t('googlePlacesAddressInput.impossibleDObtenirLesCoordonnees'));
      }
    } catch (error) {
      console.error('[GooglePlacesInput] Erreur détails:', error);
      toast.error(t('googlePlacesAddressInput.erreurLorsDeLaValidation'));
    } finally {
      setIsLoading(false);
    }
  }, [onChange, onValidChange]);

  /**
   * Utiliser la position actuelle
   */
  const handleUseCurrentLocation = useCallback(async () => {
    setIsLoadingLocation(true);

    try {
      const location = await precisionGeoService.getCurrentPosition(true);

      // Géocodage inverse pour obtenir l'adresse
      const details = await precisionGeoService.reverseGeocode(
        location.latitude,
        location.longitude
      );

      if (details) {
        const validatedAddress: ValidatedAddress = {
          formattedAddress: details.formattedAddress,
          latitude: details.latitude,
          longitude: details.longitude,
          placeId: details.placeId || '',
          addressComponents: details.addressComponents,
        };

        setInputValue(details.formattedAddress);
        setSelectedAddress(validatedAddress);
        setIsValid(true);
        onChange?.(validatedAddress);
        onValidChange?.(true);

        toast.success(`Position actuelle (précision: ${location.accuracy.toFixed(0)}m)`);
      } else {
        // Fallback avec coordonnées brutes
        const validatedAddress: ValidatedAddress = {
          formattedAddress: `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`,
          latitude: location.latitude,
          longitude: location.longitude,
          placeId: '',
        };

        setInputValue(validatedAddress.formattedAddress);
        setSelectedAddress(validatedAddress);
        setIsValid(true);
        onChange?.(validatedAddress);
        onValidChange?.(true);

        toast.info('Position GPS obtenue (adresse non disponible)');
      }
    } catch (error: any) {
      toast.error(error.message || 'Impossible d\'obtenir votre position');
    } finally {
      setIsLoadingLocation(false);
    }
  }, [onChange, onValidChange]);

  /**
   * Fermer les suggestions au clic extérieur
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className={cn('relative', className)}>
      {/* Label */}
      {label && (
        <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
          <MapPin className={cn('w-4 h-4', currentStyle.icon)} />
          {label}
          {required && <span className="text-destructive">*</span>}
        </label>
      )}

      {/* Input avec bouton position */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'pl-10 pr-10',
              isValid && 'border-[#ff4000] focus-visible:ring-[#ff4000]',
              inputClassName
            )}
          />

          {/* Icône gauche */}
          <MapPin className={cn(
            'absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4',
            currentStyle.icon
          )} />

          {/* Indicateur de statut */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : isValid ? (
              <CheckCircle className="w-4 h-4 text-[#ff4000]" />
            ) : inputValue.length > 0 ? (
              <AlertCircle className="w-4 h-4 text-[#ff4000]" />
            ) : null}
          </div>
        </div>

        {/* Bouton position actuelle */}
        {showCurrentLocationButton && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleUseCurrentLocation}
            disabled={disabled || isLoadingLocation}
            className="shrink-0"
            title="Utiliser ma position actuelle"
          >
            {isLoadingLocation ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Crosshair className="w-4 h-4" />
            )}
          </Button>
        )}
      </div>

      {/* Badge de validation GPS */}
      {selectedAddress && (
        <div className="mt-2 flex items-center gap-2">
          <Badge variant="secondary" className={cn('text-xs', currentStyle.badge)}>
            <Navigation className="w-3 h-3 mr-1" />
            GPS: {selectedAddress.latitude.toFixed(6)}, {selectedAddress.longitude.toFixed(6)}
          </Badge>
        </div>
      )}

      {/* Liste des suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <Card
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-1 z-50 max-h-60 overflow-y-auto shadow-lg"
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.placeId}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full flex items-start gap-3 p-3 hover:bg-muted text-left transition-colors border-b last:border-0"
            >
              <div className={cn('mt-0.5', currentStyle.icon)}>
                {getPlaceIcon(suggestion.types)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {suggestion.mainText}
                </p>
                {suggestion.secondaryText && (
                  <p className="text-xs text-muted-foreground truncate">
                    {suggestion.secondaryText}
                  </p>
                )}
              </div>
            </button>
          ))}
        </Card>
      )}

      {/* Message d'aide */}
      {!isValid && inputValue.length > 0 && inputValue.length < 3 && (
        <p className="text-xs text-muted-foreground mt-1">
          Saisissez au moins 3 caractères pour rechercher
        </p>
      )}

      {!isValid && inputValue.length >= 3 && !isLoading && suggestions.length === 0 && (
        <p className="text-xs text-[#ff4000] mt-1">
          Sélectionnez une adresse dans la liste pour valider
        </p>
      )}
    </div>
  );
}

export default GooglePlacesAddressInput;
