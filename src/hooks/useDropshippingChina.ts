/**
 * Hook pour le module Dropshipping Chine
 * Gestion des fournisseurs, imports, tracking et coûts chinois
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  ChinaImport,
  PriceAlert,
  ChinaTracking,
  ChinaCost,
  SupplierReview,
  ChinaSettings,
  ChinaDashboardStats,
  ChinaPlatformType,
  ExtractedProductData
} from '@/types/dropshipping-china';

export function useDropshippingChina() {
  const [loading, setLoading] = useState(false);
  const [chinaSuppliers, setChinaSuppliers] = useState<any[]>([]);
  const [chinaProducts, setChinaProducts] = useState<any[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [imports, setImports] = useState<ChinaImport[]>([]);
  const [settings, setSettings] = useState<ChinaSettings | null>(null);
  const [stats, setStats] = useState<ChinaDashboardStats | null>(null);

  // Charger les fournisseurs chinois
  const loadChinaSuppliers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('dropship_suppliers')
        .select('*')
        .eq('supplier_region', 'CHINA')
        .order('quality_score', { ascending: false });

      if (error) throw error;
      setChinaSuppliers(data || []);
    } catch (error) {
      console.error('Erreur chargement fournisseurs Chine:', error);
    }
  }, []);

  // Charger les produits Chine
  const loadChinaProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('dropship_products')
        .select('*, dropship_suppliers(*)')
        .eq('supplier_region', 'CHINA')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChinaProducts(data || []);
    } catch (error) {
      console.error('Erreur chargement produits Chine:', error);
    }
  }, []);

  // Charger les alertes prix
  const loadPriceAlerts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('dropship_price_alerts')
        .select('*')
        .eq('is_acknowledged', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPriceAlerts((data || []) as PriceAlert[]);
    } catch (error) {
      console.error('Erreur chargement alertes:', error);
    }
  }, []);

  // Charger les imports en cours
  const loadImports = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('dropship_china_imports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setImports((data || []) as ChinaImport[]);
    } catch (error) {
      console.error('Erreur chargement imports:', error);
    }
  }, []);

  // Charger les settings Chine
  const loadSettings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('dropship_china_settings')
        .select('*')
        .eq('vendor_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setSettings(data as ChinaSettings | null);
    } catch (error) {
      console.error('Erreur chargement settings Chine:', error);
    }
  }, []);

  // Calculer les stats
  const loadStats = useCallback(async () => {
    try {
      // Produits Chine
      const { count: productCount } = await supabase
        .from('dropship_products')
        .select('*', { count: 'exact', head: true })
        .eq('supplier_region', 'CHINA');

      // Commandes Chine
      const { data: ordersData } = await supabase
        .from('dropship_orders')
        .select('transport_method, actual_delivery_days, cost_breakdown')
        .not('transport_method', 'is', null);

      // Alertes non-acquittées
      const { count: alertCount } = await supabase
        .from('dropship_price_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('is_acknowledged', false);

      // Score moyen fournisseurs
      const { data: suppliersData } = await supabase
        .from('dropship_suppliers')
        .select('quality_score')
        .eq('supplier_region', 'CHINA');

      const avgScore = suppliersData?.length
        ? suppliersData.reduce((sum, s) => sum + (s.quality_score || 0), 0) / suppliersData.length
        : 0;

      // Délai moyen livraison
      const deliveryOrders = ordersData?.filter(o => o.actual_delivery_days) || [];
      const avgDelivery = deliveryOrders.length
        ? deliveryOrders.reduce((sum, o) => sum + o.actual_delivery_days, 0) / deliveryOrders.length
        : 0;

      setStats({
        totalChinaProducts: productCount || 0,
        totalChinaOrders: ordersData?.length || 0,
        averageMargin: 25, // À calculer dynamiquement
        averageDeliveryDays: Math.round(avgDelivery),
        pendingAlerts: alertCount || 0,
        topPlatform: 'ALIEXPRESS',
        customsBlockedRate: 2.5,
        supplierScoreAverage: Number(avgScore.toFixed(2))
      });
    } catch (error) {
      console.error('Erreur calcul stats Chine:', error);
    }
  }, []);

  // Import produit depuis URL
  const importFromUrl = async (url: string): Promise<ChinaImport | null> => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      // Détecter la plateforme
      let platformType: ChinaPlatformType = 'PRIVATE';
      if (url.includes('alibaba.com')) platformType = 'ALIBABA';
      else if (url.includes('aliexpress.com') || url.includes('aliexpress.')) platformType = 'ALIEXPRESS';
      else if (url.includes('1688.com')) platformType = '1688';

      // Créer l'import
      const { data, error } = await supabase
        .from('dropship_china_imports')
        .insert({
          vendor_id: user.id,
          source_url: url,
          platform_type: platformType,
          import_status: 'pending',
          extracted_data: {}
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Import démarré', {
        description: `Extraction depuis ${platformType} en cours...`
      });

      // Simuler l'extraction (en production, appeler une edge function)
      await simulateExtraction(data.id, url, platformType);

      await loadImports();
      return data as ChinaImport;
    } catch (error: any) {
      toast.error('Erreur import', { description: error.message });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Simuler extraction (à remplacer par vraie API)
  const simulateExtraction = async (importId: string, url: string, platform: ChinaPlatformType) => {
    // Simulation extraction
    const extractedData: ExtractedProductData = {
      title: `Produit importé depuis ${platform}`,
      description: 'Description extraite automatiquement',
      images: [],
      price: Math.floor(Math.random() * 50) + 5,
      currency: platform === 'ALIEXPRESS' ? 'USD' : 'CNY',
      moq: platform === '1688' ? 10 : 1,
      shipping_info: {
        domestic_days: 2,
        international_days: platform === 'ALIEXPRESS' ? 15 : 20
      }
    };

    await supabase
      .from('dropship_china_imports')
      .update({
        import_status: 'completed',
        extracted_data: JSON.parse(JSON.stringify(extractedData)),
        completed_at: new Date().toISOString()
      })
      .eq('id', importId);
  };

  // Créer produit depuis import
  const createProductFromImport = async (importData: ChinaImport, sellingPrice: number): Promise<boolean> => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const extracted = importData.extracted_data;

      // Créer le produit
      const { data, error } = await supabase
        .from('dropship_products')
        .insert({
          vendor_id: user.id,
          supplier_id: chinaSuppliers.find(s => s.platform_type === importData.platform_type)?.id,
          product_name: extracted.title || 'Produit sans nom',
          product_description: extracted.description,
          supplier_price: extracted.price || 0,
          supplier_currency: extracted.currency || 'USD',
          selling_price: sellingPrice,
          selling_currency: 'GNF',
          platform_product_id: importData.platform_product_id,
          platform_type: importData.platform_type,
          supplier_region: 'CHINA',
          original_images: extracted.images || [],
          moq: extracted.moq || 1,
          import_source_url: importData.source_url,
          imported_at: new Date().toISOString(),
          is_active: true,
          is_available: true,
          availability_status: 'available'
        })
        .select()
        .single();

      if (error) throw error;

      // Lier à l'import
      await supabase
        .from('dropship_china_imports')
        .update({ product_id: data.id })
        .eq('id', importData.id);

      toast.success('Produit créé avec succès');
      await loadChinaProducts();
      return true;
    } catch (error: any) {
      toast.error('Erreur création produit', { description: error.message });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Calculer coûts complets
  const calculateFullCosts = (
    supplierPrice: number,
    supplierCurrency: string,
    transportMethod: string = 'express'
  ): ChinaCost => {
    // Taux de change approximatifs
    const rates: Record<string, number> = {
      CNY: 0.14,
      USD: 1,
      EUR: 1.1
    };

    const priceUsd = supplierPrice * (rates[supplierCurrency] || 1);

    // Frais selon méthode transport
    const shippingCosts: Record<string, { domestic: number; intl: number }> = {
      express: { domestic: 1, intl: 15 },
      air: { domestic: 0.5, intl: 10 },
      sea: { domestic: 0.3, intl: 5 },
      economy: { domestic: 0.2, intl: 8 }
    };

    const shipping = shippingCosts[transportMethod] || shippingCosts.express;
    const customsPercent = settings?.default_customs_estimate_percent || 15;
    const estimatedCustoms = priceUsd * (customsPercent / 100);
    const platformFees = priceUsd * 0.03; // 3% frais plateforme

    const totalCostUsd = priceUsd + shipping.domestic + shipping.intl + estimatedCustoms + platformFees;

    return {
      id: '',
      product_id: '',
      vendor_id: '',
      supplier_price: supplierPrice,
      supplier_currency: supplierCurrency,
      china_domestic_shipping: shipping.domestic,
      international_shipping: shipping.intl,
      estimated_customs: estimatedCustoms,
      platform_fees: platformFees,
      exchange_rate: rates[supplierCurrency],
      total_cost_usd: totalCostUsd,
      is_current: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  };

  // Acquitter alerte prix
  const acknowledgeAlert = async (alertId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('dropship_price_alerts')
        .update({
          is_acknowledged: true,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;
      await loadPriceAlerts();
      return true;
    } catch (error) {
      console.error('Erreur acquittement alerte:', error);
      return false;
    }
  };

  // Ajouter review fournisseur
  const addSupplierReview = async (review: Partial<SupplierReview>): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { error } = await supabase
        .from('dropship_supplier_reviews')
        .insert({
          supplier_id: review.supplier_id!,
          vendor_id: user.id,
          rating: review.rating,
          delivery_rating: review.delivery_rating,
          quality_rating: review.quality_rating,
          communication_rating: review.communication_rating,
          review_text: review.review_text,
          is_dispute: review.is_dispute,
          dispute_reason: review.dispute_reason
        });

      if (error) throw error;
      toast.success('Avis enregistré');
      return true;
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
      return false;
    }
  };

  // Sauvegarder settings Chine
  const saveSettings = async (newSettings: Partial<ChinaSettings>): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { error } = await supabase
        .from('dropship_china_settings')
        .upsert({
          vendor_id: user.id,
          ...newSettings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      toast.success('Paramètres sauvegardés');
      await loadSettings();
      return true;
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
      return false;
    }
  };

  // Logger événement Chine
  const logChinaEvent = async (
    logType: string,
    severity: string,
    message: string,
    details: Record<string, unknown> = {}
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      await supabase
        .from('dropship_china_logs')
        .insert([{
          log_type: logType,
          severity,
          message,
          details: JSON.parse(JSON.stringify(details)),
          vendor_id: user?.id
        }]);
    } catch (error) {
      console.error('Erreur log Chine:', error);
    }
  };

  // Charger données initiales
  useEffect(() => {
    loadChinaSuppliers();
    loadChinaProducts();
    loadPriceAlerts();
    loadImports();
    loadSettings();
    loadStats();
  }, [loadChinaSuppliers, loadChinaProducts, loadPriceAlerts, loadImports, loadSettings, loadStats]);

  return {
    loading,
    chinaSuppliers,
    chinaProducts,
    priceAlerts,
    imports,
    settings,
    stats,
    importFromUrl,
    createProductFromImport,
    calculateFullCosts,
    acknowledgeAlert,
    addSupplierReview,
    saveSettings,
    logChinaEvent,
    refresh: () => {
      loadChinaSuppliers();
      loadChinaProducts();
      loadPriceAlerts();
      loadImports();
      loadStats();
    }
  };
}
