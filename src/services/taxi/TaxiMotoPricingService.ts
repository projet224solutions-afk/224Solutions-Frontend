/**
 * SERVICE TARIFICATION TAXI MOTO - 224SOLUTIONS
 * Calcul automatique des prix avec commission PDG
 */

import { supabase } from "@/integrations/supabase/client";

export interface PricingConfig {
  base_fare: number;
  per_km_rate: number;
  per_minute_rate: number;
  minimum_fare: number;
  driver_commission: number; // pourcentage (ex: 85 = 85%)
  platform_commission: number; // pourcentage (ex: 15 = 15%)
  surge_multiplier: number; // multiplicateur de surge (1.0 = normal)
}

export interface FareBreakdown {
  base_fare: number;
  distance_cost: number;
  time_cost: number;
  subtotal: number;
  surge_multiplier: number;
  surge_amount: number;
  total: number;
  driver_share: number;
  platform_fee: number;
  currency: string;
}

export class TaxiMotoPricingService {
  private static defaultConfig: PricingConfig = {
    base_fare: 5000, // 5000 GNF base
    per_km_rate: 2000, // 2000 GNF par km
    per_minute_rate: 100, // 100 GNF par minute
    minimum_fare: 7000, // minimum 7000 GNF
    driver_commission: 85, // 85% pour le chauffeur
    platform_commission: 15, // 15% pour la plateforme
    surge_multiplier: 1.0 // pas de surge par défaut
  };

  /**
   * Récupérer la configuration de tarification depuis la DB
   */
  static async getPricingConfig(): Promise<PricingConfig> {
    try {
      const { data, error } = await supabase
        .from('taxi_pricing_config')
        .select('*')
        .single();

      if (error || !data) {
        console.log('[Pricing] Using default config');
        return this.defaultConfig;
      }

      return {
        base_fare: Number(data.base_fare) || this.defaultConfig.base_fare,
        per_km_rate: Number(data.per_km_rate) || this.defaultConfig.per_km_rate,
        per_minute_rate: Number(data.per_minute_rate) || this.defaultConfig.per_minute_rate,
        minimum_fare: Number(data.minimum_fare) || this.defaultConfig.minimum_fare,
        driver_commission: Number(data.driver_commission) || this.defaultConfig.driver_commission,
        platform_commission: Number(data.platform_commission) || this.defaultConfig.platform_commission,
        surge_multiplier: Number(data.surge_multiplier) || this.defaultConfig.surge_multiplier
      };
    } catch (err) {
      console.error('[Pricing] Error loading config:', err);
      return this.defaultConfig;
    }
  }

  /**
   * Calculer le prix d'une course
   */
  static async calculateFare(
    distanceKm: number,
    durationMin: number,
    surgeFactor: number = 1.0
  ): Promise<FareBreakdown> {
    const config = await this.getPricingConfig();

    // Calcul du prix de base
    const baseFare = config.base_fare;
    const distanceCost = distanceKm * config.per_km_rate;
    const timeCost = durationMin * config.per_minute_rate;

    let subtotal = baseFare + distanceCost + timeCost;

    // Appliquer le minimum
    if (subtotal < config.minimum_fare) {
      subtotal = config.minimum_fare;
    }

    // Appliquer le surge multiplier
    const surgeMultiplier = config.surge_multiplier * surgeFactor;
    const surgeAmount = subtotal * (surgeMultiplier - 1);
    const total = Math.round(subtotal * surgeMultiplier);

    // Calculer la commission
    const driverShare = Math.round(total * (config.driver_commission / 100));
    const platformFee = total - driverShare;

    return {
      base_fare: baseFare,
      distance_cost: Math.round(distanceCost),
      time_cost: Math.round(timeCost),
      subtotal: Math.round(subtotal),
      surge_multiplier: surgeMultiplier,
      surge_amount: Math.round(surgeAmount),
      total,
      driver_share: driverShare,
      platform_fee: platformFee,
      currency: 'GNF'
    };
  }

  /**
   * Calculer le surge multiplier en fonction de la demande
   */
  static async calculateSurgeMultiplier(
    latitude: number,
    longitude: number,
    radiusKm: number = 5
  ): Promise<number> {
    try {
      // Compter les courses actives dans la zone
      const { count: activeRides } = await supabase
        .from('taxi_trips')
        .select('*', { count: 'exact', head: true })
        .in('status', ['requested', 'accepted', 'arriving', 'started', 'in_progress']);

      // Compter les chauffeurs disponibles dans la zone
      const { data: availableDrivers } = await supabase.rpc('find_nearby_drivers' as any, {
        p_lat: latitude,
        p_lng: longitude,
        p_radius_km: radiusKm
      });

      const driversCount = availableDrivers?.length || 0;
      const demandsCount = activeRides || 0;

      // Calcul du surge: si demande > offre
      if (driversCount === 0) return 1.5; // 50% de surge si aucun chauffeur

      const ratio = demandsCount / driversCount;

      if (ratio > 2) return 2.0; // 100% de surge
      if (ratio > 1.5) return 1.75; // 75% de surge
      if (ratio > 1) return 1.5; // 50% de surge
      if (ratio > 0.8) return 1.25; // 25% de surge

      return 1.0; // pas de surge
    } catch (err) {
      console.error('[Pricing] Error calculating surge:', err);
      return 1.0;
    }
  }

  /**
   * Mettre à jour la configuration de tarification (admin seulement)
   */
  static async updatePricingConfig(config: Partial<PricingConfig>): Promise<void> {
    try {
      const { error } = await supabase
        .from('taxi_pricing_config')
        .update(config as any)
        .eq('id', (await supabase.from('taxi_pricing_config').select('id').single()).data?.id);

      if (error) throw error;

      console.log('[Pricing] Configuration mise à jour');
    } catch (err) {
      console.error('[Pricing] Error updating config:', err);
      throw err;
    }
  }

  /**
   * Obtenir l'historique des prix pour analyse (PDG)
   */
  static async getPricingHistory(
    startDate: string,
    endDate: string
  ): Promise<Array<{ date: string; avgPrice: number; totalRides: number }>> {
    try {
      const { data, error } = await supabase
        .from('taxi_trips')
        .select('requested_at, price_total')
        .gte('requested_at', startDate)
        .lte('requested_at', endDate)
        .eq('status', 'completed');

      if (error || !data) return [];

      // Grouper par jour
      const grouped = data.reduce((acc: any, trip) => {
        const date = new Date(trip.requested_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { total: 0, count: 0 };
        }
        acc[date].total += trip.price_total || 0;
        acc[date].count += 1;
        return acc;
      }, {});

      return Object.entries(grouped).map(([date, stats]: [string, any]) => ({
        date,
        avgPrice: Math.round(stats.total / stats.count),
        totalRides: stats.count
      }));
    } catch (err) {
      console.error('[Pricing] Error getting history:', err);
      return [];
    }
  }
}
