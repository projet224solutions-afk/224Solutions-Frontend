/**
 * Hook pour calculer le prix de livraison basé sur la distance GPS
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DeliveryPriceResult {
  distance: number; // en km
  basePrice: number;
  distancePrice: number;
  totalPrice: number;
  estimatedTime: number; // en minutes
}

interface VendorPricingConfig {
  basePrice: number;
  pricePerKm: number;
  rushBonus: number;
}

export function useDeliveryPriceCalculation(vendorId: string) {
  const [calculating, setCalculating] = useState(false);
  const [priceResult, setPriceResult] = useState<DeliveryPriceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Calculer la distance entre deux adresses via geocoding
  const calculateDistance = useCallback(async (
    pickupAddress: string,
    deliveryAddress: string
  ): Promise<DeliveryPriceResult | null> => {
    setCalculating(true);
    setError(null);

    try {
      // 1. Récupérer la config de tarification du vendeur
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select('delivery_base_price, delivery_price_per_km, delivery_rush_bonus')
        .eq('id', vendorId)
        .single();

      if (vendorError) throw vendorError;

      const config: VendorPricingConfig = {
        basePrice: vendorData?.delivery_base_price || 5000,
        pricePerKm: vendorData?.delivery_price_per_km || 1000,
        rushBonus: vendorData?.delivery_rush_bonus || 0
      };

      // 2. Géocoder les adresses pour obtenir les coordonnées
      const pickupCoords = await geocodeAddress(pickupAddress);
      const deliveryCoords = await geocodeAddress(deliveryAddress);

      if (!pickupCoords || !deliveryCoords) {
        // Fallback: estimation basée sur les caractères de l'adresse
        const estimatedDistance = estimateDistanceFromAddresses(pickupAddress, deliveryAddress);
        return calculatePriceFromDistance(estimatedDistance, config);
      }

      // 3. Calculer la distance Haversine
      const distance = haversineDistance(
        pickupCoords.lat,
        pickupCoords.lng,
        deliveryCoords.lat,
        deliveryCoords.lng
      );

      const result = calculatePriceFromDistance(distance, config);
      setPriceResult(result);
      return result;

    } catch (err) {
      console.error('Error calculating delivery price:', err);
      setError('Erreur lors du calcul du prix');

      // Fallback avec distance estimée
      const fallbackResult: DeliveryPriceResult = {
        distance: 5,
        basePrice: 5000,
        distancePrice: 5000,
        totalPrice: 10000,
        estimatedTime: 15
      };
      setPriceResult(fallbackResult);
      return fallbackResult;
    } finally {
      setCalculating(false);
    }
  }, [vendorId]);

  // Calculer le prix à partir de la distance
  const calculatePriceFromDistance = (
    distance: number,
    config: VendorPricingConfig
  ): DeliveryPriceResult => {
    const distanceKm = Math.max(1, Math.round(distance * 10) / 10); // Au moins 1km
    const distancePrice = Math.round(distanceKm * config.pricePerKm);
    const totalPrice = config.basePrice + distancePrice;

    // Estimation du temps: ~3 min/km en ville
    const estimatedTime = Math.round(distanceKm * 3);

    return {
      distance: distanceKm,
      basePrice: config.basePrice,
      distancePrice,
      totalPrice,
      estimatedTime
    };
  };

  // Réinitialiser
  const reset = () => {
    setPriceResult(null);
    setError(null);
  };

  return {
    calculateDistance,
    calculating,
    priceResult,
    error,
    reset
  };
}

// Géocoder une adresse (via Edge Function Mapbox ou fallback)
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const { data, error } = await supabase.functions.invoke('mapbox-proxy', {
      body: {
        action: 'geocode',
        data: { address }
      }
    });

    if (error || !data?.features?.length) {
      return null;
    }

    const [lng, lat] = data.features[0].center;
    return { lat, lng };
  } catch {
    return null;
  }
}

// Formule Haversine pour calculer la distance entre deux points GPS
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Estimation de distance basée sur les noms d'adresses (fallback)
function estimateDistanceFromAddresses(pickup: string, delivery: string): number {
  // Villes principales en Guinée avec distances approximatives
  const cities: Record<string, { lat: number; lng: number }> = {
    'conakry': { lat: 9.6412, lng: -13.5784 },
    'kaloum': { lat: 9.5092, lng: -13.7122 },
    'matam': { lat: 9.5333, lng: -13.6833 },
    'dixinn': { lat: 9.5667, lng: -13.65 },
    'ratoma': { lat: 9.6167, lng: -13.6167 },
    'matoto': { lat: 9.6167, lng: -13.5667 },
    'kindia': { lat: 10.0567, lng: -12.8667 },
    'mamou': { lat: 10.3833, lng: -12.0833 },
    'labé': { lat: 11.3167, lng: -12.2833 },
    'kankan': { lat: 10.3833, lng: -9.3 },
    'nzérékoré': { lat: 7.75, lng: -8.8167 }
  };

  const pickupLower = pickup.toLowerCase();
  const deliveryLower = delivery.toLowerCase();

  let pickupCoords: { lat: number; lng: number } | null = null;
  let deliveryCoords: { lat: number; lng: number } | null = null;

  for (const [city, coords] of Object.entries(cities)) {
    if (pickupLower.includes(city)) pickupCoords = coords;
    if (deliveryLower.includes(city)) deliveryCoords = coords;
  }

  if (pickupCoords && deliveryCoords) {
    return haversineDistance(
      pickupCoords.lat, pickupCoords.lng,
      deliveryCoords.lat, deliveryCoords.lng
    );
  }

  // Distance par défaut si pas de correspondance
  return 5; // 5 km par défaut
}
