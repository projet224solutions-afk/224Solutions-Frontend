import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface AddressResult {
  formatted: string;
  loading: boolean;
  error: string | null;
}

/**
 * Hook pour géolocaliser une adresse via Google Geocoding API
 * @param address Adresse à géolocaliser (objet avec street, city, country, etc.)
 */
export function useReverseGeocode(address: any): AddressResult {
  const [formatted, setFormatted] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setFormatted('Adresse non spécifiée');
      return;
    }

    const geocodeAddress = async () => {
      try {
        setLoading(true);
        setError(null);

        // Construire l'adresse à partir de l'objet
        const addressString = typeof address === 'object' && address !== null
          ? `${address.address || address.street || ''}, ${address.city || 'Conakry'}, ${address.country || 'Guinée'}`
          : String(address);

        // Si l'adresse a des coordonnées lat/lng, utiliser le reverse geocoding
        if (address.latitude && address.longitude) {
          const { data, error: funcError } = await supabase.functions.invoke('geocode-address', {
            body: {
              type: 'reverse',
              lat: address.latitude,
              lng: address.longitude
            }
          });

          if (funcError) throw funcError;

          if (data && data.results && data.results.length > 0) {
            setFormatted(data.results[0].formatted_address);
            return;
          }
        }

        // Sinon, utiliser le geocoding forward pour obtenir l'adresse formatée
        const { data, error: funcError } = await supabase.functions.invoke('geocode-address', {
          body: {
            type: 'geocode',
            address: addressString
          }
        });

        if (funcError) throw funcError;

        if (data && data.results && data.results.length > 0) {
          setFormatted(data.results[0].formatted_address);
        } else {
          // Fallback sur l'adresse originale si la géolocalisation échoue
          setFormatted(addressString);
        }
      } catch (err) {
        console.error('Error geocoding address:', err);

        // Fallback sur l'adresse originale en cas d'erreur - pas besoin d'afficher l'erreur à l'utilisateur
        const fallbackAddress = typeof address === 'object' && address !== null
          ? `${address.address || address.street || 'Adresse non spécifiée'}, ${address.city || 'Conakry'}, ${address.country || 'Guinée'}`
          : String(address);
        setFormatted(fallbackAddress);
        // Ne pas afficher l'erreur à l'utilisateur si on a un fallback valide
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    geocodeAddress();
  }, [address]);

  return { formatted, loading, error };
}
