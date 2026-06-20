import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';

export interface TrafficStats {
  totalProductViews: number;
  uniqueProductViewers: number;
  totalShopVisits: number;
  uniqueShopVisitors: number;
  todayProductViews: number;
  todayShopVisits: number;
  weeklyTrend: Array<{
    date: string;
    productViews: number;
    shopVisits: number;
  }>;
  topProducts: Array<{
    product_id: string;
    views: number;
  }>;
  deviceBreakdown: Record<string, number>;
  countryBreakdown: Record<string, number>;
  cityBreakdown: Record<string, number>;
}

/**
 * Hook pour récupérer les analytics de trafic (vues produits, visites boutique)
 * Combine les données agrégées (analytics_daily_stats) avec les données brutes en temps réel
 */
export function useTrafficAnalytics() {
  const { vendorId, loading: vendorLoading } = useCurrentVendor();
  const [stats, setStats] = useState<TrafficStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!vendorId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const _sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

      // Charger les statistiques agrégées ET les données brutes en parallèle
      const [dailyStatsResult, productViewsRawResult, shopVisitsRawResult] = await Promise.all([
        // Stats agrégées
        supabase
          .from('analytics_daily_stats')
          .select('*')
          .eq('vendor_id', vendorId)
          .gte('stat_date', thirtyDaysAgoStr)
          .order('stat_date', { ascending: false }),

        // Vues produits brutes (30 derniers jours)
        supabase
          .from('product_views_raw')
          .select('id, product_id, session_id, device_type, country_code, city, view_date')
          .eq('vendor_id', vendorId)
          .gte('view_date', thirtyDaysAgoStr),

        // Visites boutique brutes (30 derniers jours)
        supabase
          .from('shop_visits_raw')
          .select('id, session_id, device_type, country_code, city, visit_date')
          .eq('vendor_id', vendorId)
          .gte('visit_date', thirtyDaysAgoStr)
      ]);

      if (dailyStatsResult.error) {
        console.error('Erreur chargement analytics_daily_stats:', dailyStatsResult.error);
      }

      const _statsData = dailyStatsResult.data || [];
      const productViewsRaw = productViewsRawResult.data || [];
      const shopVisitsRaw = shopVisitsRawResult.data || [];

      // Calculer les stats en temps réel à partir des données brutes
      const rawDeviceBreakdown: Record<string, number> = {};
      const rawCountryBreakdown: Record<string, number> = {};
      const rawCityBreakdown: Record<string, number> = {};
      const rawTopProductsMap: Record<string, number> = {};
      const rawDailyProductViews: Record<string, number> = {};
      const rawDailyShopVisits: Record<string, number> = {};
      const rawUniqueSessions = new Set<string>();
      const rawUniqueShopSessions = new Set<string>();

      // Analyser les vues produits brutes
      productViewsRaw.forEach(view => {
        // Comptage par appareil
        if (view.device_type) {
          rawDeviceBreakdown[view.device_type] = (rawDeviceBreakdown[view.device_type] || 0) + 1;
        }

        // Comptage par pays
        if (view.country_code) {
          rawCountryBreakdown[view.country_code] = (rawCountryBreakdown[view.country_code] || 0) + 1;
        }

        // Comptage par ville
        if (view.city) {
          rawCityBreakdown[view.city] = (rawCityBreakdown[view.city] || 0) + 1;
        }

        // Comptage par produit
        if (view.product_id) {
          rawTopProductsMap[view.product_id] = (rawTopProductsMap[view.product_id] || 0) + 1;
        }

        // Comptage par jour
        if (view.view_date) {
          rawDailyProductViews[view.view_date] = (rawDailyProductViews[view.view_date] || 0) + 1;
        }

        // Sessions uniques
        if (view.session_id) {
          rawUniqueSessions.add(view.session_id);
        }
      });

      // Analyser les visites boutique brutes
      shopVisitsRaw.forEach(visit => {
        // Comptage par appareil (combiner avec produits)
        if (visit.device_type) {
          rawDeviceBreakdown[visit.device_type] = (rawDeviceBreakdown[visit.device_type] || 0) + 1;
        }

        // Comptage par pays (combiner)
        if (visit.country_code) {
          rawCountryBreakdown[visit.country_code] = (rawCountryBreakdown[visit.country_code] || 0) + 1;
        }

        // Comptage par ville (combiner)
        if (visit.city) {
          rawCityBreakdown[visit.city] = (rawCityBreakdown[visit.city] || 0) + 1;
        }

        // Comptage par jour
        if (visit.visit_date) {
          rawDailyShopVisits[visit.visit_date] = (rawDailyShopVisits[visit.visit_date] || 0) + 1;
        }

        // Sessions uniques boutique
        if (visit.session_id) {
          rawUniqueShopSessions.add(visit.session_id);
        }
      });

      // Combiner stats agrégées avec stats brutes
      // (Les données brutes sont prioritaires car plus à jour)

      // Totaux à partir des données brutes
      const totalProductViews = productViewsRaw.length;
      const uniqueProductViewers = rawUniqueSessions.size;
      const totalShopVisits = shopVisitsRaw.length;
      const uniqueShopVisitors = rawUniqueShopSessions.size;

      // Stats aujourd'hui
      const todayProductViews = rawDailyProductViews[today] || 0;
      const todayShopVisits = rawDailyShopVisits[today] || 0;

      // Générer le trend hebdomadaire
      const weeklyTrend: Array<{ date: string; productViews: number; shopVisits: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        weeklyTrend.push({
          date: dateStr,
          productViews: rawDailyProductViews[dateStr] || 0,
          shopVisits: rawDailyShopVisits[dateStr] || 0
        });
      }

      // Top produits
      const topProducts = Object.entries(rawTopProductsMap)
        .map(([product_id, views]) => ({ product_id, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      setStats({
        totalProductViews,
        uniqueProductViewers,
        totalShopVisits,
        uniqueShopVisitors,
        todayProductViews,
        todayShopVisits,
        weeklyTrend,
        topProducts,
        deviceBreakdown: rawDeviceBreakdown,
        countryBreakdown: rawCountryBreakdown,
        cityBreakdown: rawCityBreakdown
      });

    } catch (err) {
      console.error('Erreur chargement traffic analytics:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    if (vendorLoading) return;
    loadStats();
  }, [vendorId, vendorLoading, loadStats]);

  return {
    stats,
    loading: loading || vendorLoading,
    error,
    refresh: loadStats
  };
}
