/**
 * SERVICE TARIFICATION - Type Uber
 * Calcul dynamique des prix de livraison
 */

import { supabase } from '@/integrations/supabase/client';

export interface PriceEstimate {
  basePrice: number;
  distanceKm: number;
  distancePrice: number;
  surgeMultiplier: number;
  totalPrice: number;
  currency: string;
  breakdown: {
    base: number;
    distance: number;
    surge: number;
    serviceFee: number;
  };
}

export class PricingService {
  /**
   * Calculer le prix estimé d'une livraison
   */
  static async estimateDeliveryPrice(
    pickupLat: number,
    pickupLng: number,
    deliveryLat: number,
    deliveryLng: number
  ): Promise<PriceEstimate> {
    try {
      const { data, error } = await supabase.rpc('calculate_delivery_price', {
        p_pickup_lat: pickupLat,
        p_pickup_lng: pickupLng,
        p_delivery_lat: deliveryLat,
        p_delivery_lng: deliveryLng,
      });

      if (error) throw error;

      const result = data[0];
      const serviceFee = result.total_price * 0.05; // 5% de frais de service

      return {
        basePrice: result.base_price,
        distanceKm: result.distance_km,
        distancePrice: result.distance_price,
        surgeMultiplier: result.surge_multiplier,
        totalPrice: result.total_price + serviceFee,
        currency: 'GNF',
        breakdown: {
          base: result.base_price,
          distance: result.distance_price,
          surge: result.total_price - (result.base_price + result.distance_price),
          serviceFee,
        },
      };
    } catch (error) {
      console.error('[PricingService] Error estimating price:', error);
      // Prix par défaut si le calcul échoue
      return {
        basePrice: 5000,
        distanceKm: 0,
        distancePrice: 0,
        surgeMultiplier: 1,
        totalPrice: 5000,
        currency: 'GNF',
        breakdown: {
          base: 5000,
          distance: 0,
          surge: 0,
          serviceFee: 0,
        },
      };
    }
  }

  /**
   * Enregistrer les détails de tarification pour une livraison
   */
  static async savePricingDetails(deliveryId: string, estimate: PriceEstimate): Promise<void> {
    try {
      const { error } = await supabase.from('delivery_pricing').insert({
        delivery_id: deliveryId,
        base_price: estimate.basePrice,
        distance_price: estimate.distancePrice,
        surge_price: estimate.breakdown.surge,
        service_fee: estimate.breakdown.serviceFee,
        total_price: estimate.totalPrice,
        currency: estimate.currency,
        pricing_details: estimate.breakdown,
      });

      if (error) throw error;
    } catch (error) {
      console.error('[PricingService] Error saving pricing:', error);
    }
  }

  /**
   * Obtenir les zones de tarification actives
   */
  static async getActivePricingZones() {
    try {
      const { data, error } = await supabase
        .from('pricing_zones')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[PricingService] Error fetching zones:', error);
      return [];
    }
  }
}
