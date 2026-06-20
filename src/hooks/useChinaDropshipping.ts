/**
 * CHINA DROPSHIPPING HOOK
 * Hook principal pour la gestion du dropshipping Chine
 * Extension modulaire du système existant
 *
 * @module useChinaDropshipping
 * @version 1.0.0
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  ChinaSupplierExtension,
  ChinaProductImport,
  ChinaSupplierOrder,
  ChinaCostBreakdown,
  ChinaPriceSync,
  ChinaPriceAlert,
  ChinaDropshipSettings,
  ChinaDropshipLog,
  ChinaDropshipReport,
  ChinaPlatformType,
  SupplierScore,
  ChinaLogistics,
  SyncStatus
} from '@/types/china-dropshipping';
import {
  DEFAULT_CHINA_SETTINGS,
  SUPPLIER_SCORE_THRESHOLDS
} from '@/types/china-dropshipping';

// ==================== INTERFACES ====================

interface UseChinaDropshippingReturn {
  // États
  loading: boolean;
  syncStatus: SyncStatus;

  // Données
  chinaSuppliers: ChinaSupplierExtension[];
  importedProducts: ChinaProductImport[];
  chinaOrders: ChinaSupplierOrder[];
  priceAlerts: ChinaPriceAlert[];
  settings: ChinaDropshipSettings | null;

  // Stats
  stats: ChinaDropshipStats | null;

  // Actions Fournisseurs
  loadChinaSuppliers: () => Promise<void>;
  addChinaSupplier: (supplier: Partial<ChinaSupplierExtension>) => Promise<ChinaSupplierExtension | null>;
  updateChinaSupplier: (id: string, updates: Partial<ChinaSupplierExtension>) => Promise<boolean>;
  verifySupplier: (id: string) => Promise<boolean>;
  disableSupplier: (id: string, reason: string) => Promise<boolean>;

  // Actions Import Produits
  importFromUrl: (url: string, platform: ChinaPlatformType) => Promise<ChinaProductImport | null>;
  convertToDropshipProduct: (importId: string, vendorMargin: number) => Promise<string | null>;

  // Actions Commandes
  loadChinaOrders: () => Promise<void>;
  createSupplierOrder: (customerOrderId: string, items: any[]) => Promise<ChinaSupplierOrder | null>;
  updateOrderStatus: (orderId: string, status: string, note?: string) => Promise<boolean>;

  // Actions Sync
  syncPrices: (productIds?: string[]) => Promise<boolean>;
  syncAvailability: (productIds?: string[]) => Promise<boolean>;

  // Actions Alertes
  loadAlerts: () => Promise<void>;
  dismissAlert: (alertId: string) => Promise<boolean>;

  // Actions Settings
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<ChinaDropshipSettings>) => Promise<boolean>;

  // Calculs
  calculateCosts: (productId: string, quantity: number) => Promise<ChinaCostBreakdown | null>;

  // Logs
  addLog: (log: Partial<ChinaDropshipLog>) => Promise<void>;
}

interface ChinaDropshipStats {
  totalSuppliers: number;
  verifiedSuppliers: number;
  activeProducts: number;
  pendingOrders: number;
  inTransitOrders: number;
  avgDeliveryDays: number;
  totalRevenue: number;
  totalProfit: number;
  marginPercent: number;
  alertsCount: number;
}

// ==================== HOOK PRINCIPAL ====================

export function useChinaDropshipping(vendorId?: string): UseChinaDropshippingReturn {
  // États
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  // Données
  const [chinaSuppliers, setChinaSuppliers] = useState<ChinaSupplierExtension[]>([]);
  const [importedProducts, _setImportedProducts] = useState<ChinaProductImport[]>([]);
  const [chinaOrders, setChinaOrders] = useState<ChinaSupplierOrder[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<ChinaPriceAlert[]>([]);
  const [settings, setSettings] = useState<ChinaDropshipSettings | null>(null);
  const [stats, setStats] = useState<ChinaDropshipStats | null>(null);

  // Refs pour éviter les race conditions
  const syncInProgressRef = useRef(false);
  const _retryCountRef = useRef<Map<string, number>>(new Map());

  // ==================== FOURNISSEURS ====================

  const loadChinaSuppliers = useCallback(async () => {
    if (!vendorId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('china_suppliers')
        .select('*')
        .order('internal_score', { ascending: false });

      if (error) throw error;
      setChinaSuppliers((data || []) as unknown as ChinaSupplierExtension[]);
    } catch (error: any) {
      console.error('[ChinaDropship] Erreur chargement fournisseurs:', error);
      await addLog({
        log_type: 'error',
        severity: 'error',
        message: 'Erreur chargement fournisseurs Chine',
        details: { error: error.message }
      });
    } finally {
      setLoading(false);
    }
  }, [vendorId, addLog]);

  const addChinaSupplier = useCallback(async (
    supplier: Partial<ChinaSupplierExtension>
  ): Promise<ChinaSupplierExtension | null> => {
    if (!vendorId) {
      toast.error('Vendeur non identifié');
      return null;
    }

    try {
      setLoading(true);

      const insertData = {
        ...supplier,
        supplier_region: 'CHINA',
        internal_score: 50, // Score initial par défaut
        score_level: 'UNVERIFIED',
        successful_deliveries: 0,
        total_deliveries: 0,
        on_time_rate: 0,
        dispute_rate: 0,
        verified_by_admin: false
      };

      const { data, error } = await supabase
        .from('china_suppliers')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      toast.success('Fournisseur chinois ajouté');
      await loadChinaSuppliers();

      await addLog({
        log_type: 'sync',
        severity: 'info',
        message: `Nouveau fournisseur chinois ajouté: ${supplier.platform_type}`,
        details: { supplier_id: data?.id }
      });

      return data as unknown as ChinaSupplierExtension;
    } catch (error: any) {
      console.error('[ChinaDropship] Erreur ajout fournisseur:', error);
      toast.error(error.message || 'Erreur lors de l\'ajout');
      return null;
    } finally {
      setLoading(false);
    }
  }, [vendorId, loadChinaSuppliers, addLog]);

  const updateChinaSupplier = useCallback(async (
    id: string,
    updates: Partial<ChinaSupplierExtension>
  ): Promise<boolean> => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('china_suppliers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast.success('Fournisseur mis à jour');
      await loadChinaSuppliers();
      return true;
    } catch (error: any) {
      console.error('[ChinaDropship] Erreur mise à jour fournisseur:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour');
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadChinaSuppliers]);

  const verifySupplier = useCallback(async (id: string): Promise<boolean> => {
    return updateChinaSupplier(id, {
      verified_by_admin: true,
      verification_date: new Date().toISOString(),
      score_level: 'BRONZE' // Promotion après vérification
    });
  }, [updateChinaSupplier]);

  const disableSupplier = useCallback(async (id: string, reason: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('china_suppliers')
        .update({
          score_level: 'BLACKLISTED',
          notes: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.warning('Fournisseur désactivé');
      await loadChinaSuppliers();

      await addLog({
        log_type: 'alert',
        severity: 'warning',
        message: `Fournisseur désactivé: ${reason}`,
        details: { supplier_id: id, reason }
      });

      return true;
    } catch (error: any) {
      console.error('[ChinaDropship] Erreur désactivation:', error);
      return false;
    }
  }, [loadChinaSuppliers, addLog]);

  // ==================== IMPORT PRODUITS ====================

  const importFromUrl = useCallback(async (
    url: string,
    platform: ChinaPlatformType
  ): Promise<ChinaProductImport | null> => {
    if (!vendorId) {
      toast.error('Vendeur non identifié');
      return null;
    }

    try {
      setLoading(true);
      setSyncStatus('syncing');

      // Extraction des données produit (simulation - en prod, utiliser un scraper)
      const productData = await extractProductFromUrl(url, platform);

      if (!productData) {
        throw new Error('Impossible d\'extraire les données du produit');
      }

      const importRecord: Partial<ChinaProductImport> = {
        vendor_id: vendorId,
        source_platform: platform,
        source_url: url,
        source_product_id: productData.id,
        original_title: productData.title,
        translated_title: productData.title, // À traduire via API
        images: productData.images,
        supplier_price_cny: productData.priceCNY,
        supplier_price_usd: productData.priceCNY / 7.2, // Taux approx
        moq: productData.moq || 1,
        variants: productData.variants || [],
        production_time_days: productData.productionDays || 3,
        shipping_time_days: productData.shippingDays || 15,
        import_status: 'pending'
      };

      const { data, error } = await (supabase as any)
        .from('china_product_imports')
        .insert(importRecord)
        .select()
        .single();

      if (error) throw error;

      toast.success('Produit importé avec succès');
      setSyncStatus('success');

      await addLog({
        vendor_id: vendorId,
        log_type: 'import',
        severity: 'info',
        message: `Produit importé depuis ${platform}`,
        details: { url, product_id: data?.id }
      });

      return data as unknown as ChinaProductImport;
    } catch (error: any) {
      console.error('[ChinaDropship] Erreur import:', error);
      toast.error(error.message || 'Erreur lors de l\'import');
      setSyncStatus('error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [vendorId, addLog]);

  const convertToDropshipProduct = useCallback(async (
    importId: string,
    vendorMargin: number
  ): Promise<string | null> => {
    if (!vendorId) return null;

    try {
      setLoading(true);

      // Récupérer le produit importé
      const { data: imported, error: fetchError } = await supabase
        .from('china_product_imports')
        .select('*')
        .eq('id', importId)
        .single();

      if (fetchError || !imported) throw new Error('Produit importé non trouvé');

      // Calculer le prix de vente
      const costUSD = (imported as any).supplier_price_usd;
      const sellingPriceUSD = costUSD * (1 + vendorMargin / 100);

      // Convertir en devise locale (GNF par exemple)
      const exchangeRate = 8500; // USD -> GNF (à dynamiser)
      const sellingPriceLocal = sellingPriceUSD * exchangeRate;

      // Créer le produit dropship
      const { data: product, error: createError } = await supabase
        .from('dropship_products')
        .insert({
          vendor_id: vendorId,
          product_name: (imported as any).translated_title || (imported as any).original_title,
          product_description: (imported as any).translated_description,
          supplier_id: null, // À lier après
          supplier_product_url: (imported as any).source_url,
          supplier_price: costUSD,
          supplier_currency: 'USD',
          selling_price: sellingPriceLocal,
          selling_currency: 'GNF',
          images: (imported as any).images,
          variants: JSON.stringify((imported as any).variants || []),
          is_active: true,
          china_import_id: importId // Lien vers l'import
        })
        .select()
        .single();

      if (createError) throw createError;

      // Mettre à jour le statut de l'import
      await supabase
        .from('china_product_imports')
        .update({
          import_status: 'imported',
          dropship_product_id: product?.id
        })
        .eq('id', importId);

      toast.success('Produit ajouté à votre catalogue');
      return product?.id || null;
    } catch (error: any) {
      console.error('[ChinaDropship] Erreur conversion:', error);
      toast.error(error.message || 'Erreur lors de la conversion');
      return null;
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  // ==================== COMMANDES ====================

  const loadChinaOrders = useCallback(async () => {
    if (!vendorId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('china_supplier_orders')
        .select(`
          *,
          logistics:china_logistics(*)
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChinaOrders((data || []) as unknown as ChinaSupplierOrder[]);
    } catch (error: any) {
      console.error('[ChinaDropship] Erreur chargement commandes:', error);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  const createSupplierOrder = useCallback(async (
    customerOrderId: string,
    items: any[]
  ): Promise<ChinaSupplierOrder | null> => {
    if (!vendorId) return null;

    try {
      setLoading(true);

      // Calculer les totaux
      let totalCNY = 0;
      let totalUSD = 0;
      const orderItems = items.map(item => {
        const itemTotalCNY = item.unit_price_cny * item.quantity;
        const itemTotalUSD = item.unit_price_usd * item.quantity;
        totalCNY += itemTotalCNY;
        totalUSD += itemTotalUSD;
        return {
          ...item,
          total_cny: itemTotalCNY,
          total_usd: itemTotalUSD
        };
      });

      const orderData: Partial<ChinaSupplierOrder> = {
        customer_order_id: customerOrderId,
        vendor_id: vendorId,
        supplier_id: items[0]?.supplier_id,
        status: 'pending_supplier_confirm',
        status_history: [{
          status: 'pending_supplier_confirm',
          timestamp: new Date().toISOString()
        }],
        items: orderItems,
        supplier_total_cny: totalCNY,
        supplier_total_usd: totalUSD,
        supplier_payment_status: 'pending'
      };

      const { data, error } = await (supabase as any)
        .from('china_supplier_orders')
        .insert(orderData)
        .select()
        .single();

      if (error) throw error;

      toast.success('Commande fournisseur créée');
      await loadChinaOrders();

      return data as unknown as ChinaSupplierOrder;
    } catch (error: any) {
      console.error('[ChinaDropship] Erreur création commande:', error);
      toast.error('Erreur lors de la création de la commande');
      return null;
    } finally {
      setLoading(false);
    }
  }, [vendorId, loadChinaOrders]);

  const updateOrderStatus = useCallback(async (
    orderId: string,
    status: string,
    note?: string
  ): Promise<boolean> => {
    try {
      // Récupérer l'historique actuel
      const { data: order, error: fetchError } = await supabase
        .from('china_supplier_orders')
        .select('status_history')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      const history = (order as any)?.status_history || [];
      history.push({
        status,
        timestamp: new Date().toISOString(),
        note
      });

      const { error } = await supabase
        .from('china_supplier_orders')
        .update({
          status,
          status_history: history,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Statut mis à jour');
      await loadChinaOrders();
      return true;
    } catch (error: any) {
      console.error('[ChinaDropship] Erreur mise à jour statut:', error);
      return false;
    }
  }, [loadChinaOrders]);

  // ==================== SYNCHRONISATION ====================

  const syncPrices = useCallback(async (productIds?: string[]): Promise<boolean> => {
    if (syncInProgressRef.current) {
      console.log('[ChinaDropship] Sync déjà en cours, ignoré');
      return false;
    }

    try {
      syncInProgressRef.current = true;
      setSyncStatus('syncing');

      // Récupérer les produits à synchroniser
      let query = supabase
        .from('china_product_imports')
        .select('*')
        .eq('import_status', 'imported');

      if (productIds?.length) {
        query = query.in('id', productIds);
      }

      const { data: products, error } = await query;
      if (error) throw error;

      let updatedCount = 0;
      let alertsGenerated = 0;

      for (const product of (products || [])) {
        try {
          // Simuler récupération du nouveau prix (en prod: appeler API fournisseur)
          const newPriceCNY = await fetchCurrentPrice(
            (product as any).source_url,
            (product as any).source_platform
          );

          if (newPriceCNY !== null) {
            const oldPrice = (product as any).supplier_price_cny;
            const changePercent = ((newPriceCNY - oldPrice) / oldPrice) * 100;

            // Enregistrer le changement
            await supabase.from('china_price_syncs').insert({
              product_id: product.id,
              previous_price_cny: oldPrice,
              current_price_cny: newPriceCNY,
              price_change_percent: changePercent,
              price_change_direction: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'stable',
              previous_availability: true,
              current_availability: true
            });

            // Générer alerte si nécessaire
            if (Math.abs(changePercent) >= (settings?.price_increase_alert_threshold || 15)) {
              await supabase.from('china_price_alerts').insert({
                vendor_id: vendorId,
                product_id: product.id,
                alert_type: changePercent > 0 ? 'INCREASE' : 'DECREASE',
                severity: changePercent > 30 ? 'critical' : changePercent > 20 ? 'high' : 'medium',
                message: `Prix ${changePercent > 0 ? 'augmenté' : 'diminué'} de ${Math.abs(changePercent).toFixed(1)}%`,
                old_value: oldPrice,
                new_value: newPriceCNY,
                change_percent: changePercent
              });
              alertsGenerated++;

              // Auto-désactivation si configuré
              if (settings?.auto_disable_on_price_spike &&
                  changePercent > (settings?.auto_disable_threshold_percent || 30)) {
                await supabase
                  .from('dropship_products')
                  .update({ is_active: false })
                  .eq('china_import_id', product.id);
              }
            }

            // Mettre à jour le prix
            await supabase
              .from('china_product_imports')
              .update({
                supplier_price_cny: newPriceCNY,
                supplier_price_usd: newPriceCNY / 7.2,
                updated_at: new Date().toISOString()
              })
              .eq('id', product.id);

            updatedCount++;
          }
        } catch (err) {
          // Continuer avec les autres produits en cas d'erreur
          console.error(`[ChinaDropship] Erreur sync produit ${product.id}:`, err);
        }
      }

      setSyncStatus('success');
      toast.success(`${updatedCount} prix synchronisés, ${alertsGenerated} alertes`);

      await addLog({
        vendor_id: vendorId,
        log_type: 'sync',
        severity: 'info',
        message: `Synchronisation prix terminée`,
        details: { updated: updatedCount, alerts: alertsGenerated }
      });

      return true;
    } catch (error: any) {
      console.error('[ChinaDropship] Erreur sync prix:', error);
      setSyncStatus('error');
      return false;
    } finally {
      syncInProgressRef.current = false;
    }
  }, [vendorId, settings, addLog]);

  const syncAvailability = useCallback(async (_productIds?: string[]): Promise<boolean> => {
    // Logique similaire à syncPrices mais pour la disponibilité
    // Implémentation simplifiée
    toast.info('Synchronisation disponibilité en cours...');
    return true;
  }, []);

  // ==================== ALERTES ====================

  const loadAlerts = useCallback(async () => {
    if (!vendorId) return;

    try {
      const { data, error } = await supabase
        .from('china_price_alerts')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPriceAlerts((data || []) as unknown as ChinaPriceAlert[]);
    } catch (error: any) {
      console.error('[ChinaDropship] Erreur chargement alertes:', error);
    }
  }, [vendorId]);

  const dismissAlert = useCallback(async (alertId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('china_price_alerts')
        .update({ is_read: true, resolved_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) throw error;
      await loadAlerts();
      return true;
    } catch (_error) {
      return false;
    }
  }, [loadAlerts]);

  // ==================== SETTINGS ====================

  const loadSettings = useCallback(async () => {
    if (!vendorId) return;

    try {
      const { data, error } = await supabase
        .from('china_dropship_settings')
        .select('*')
        .eq('vendor_id', vendorId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings(data as unknown as ChinaDropshipSettings);
      } else {
        // Créer les paramètres par défaut
        const defaultSettings = {
          vendor_id: vendorId,
          ...DEFAULT_CHINA_SETTINGS,
          local_selling_currency: 'GNF'
        };

        const { data: newSettings } = await supabase
          .from('china_dropship_settings')
          .insert(defaultSettings)
          .select()
          .single();

        setSettings(newSettings as unknown as ChinaDropshipSettings);
      }
    } catch (error: any) {
      console.error('[ChinaDropship] Erreur chargement settings:', error);
    }
  }, [vendorId]);

  const updateSettings = useCallback(async (
    updates: Partial<ChinaDropshipSettings>
  ): Promise<boolean> => {
    if (!vendorId) return false;

    try {
      const { error } = await supabase
        .from('china_dropship_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('vendor_id', vendorId);

      if (error) throw error;

      toast.success('Paramètres mis à jour');
      await loadSettings();
      return true;
    } catch (_error: any) {
      toast.error('Erreur mise à jour paramètres');
      return false;
    }
  }, [vendorId, loadSettings]);

  // ==================== CALCULS ====================

  const calculateCosts = useCallback(async (
    productId: string,
    quantity: number
  ): Promise<ChinaCostBreakdown | null> => {
    try {
      // Récupérer les données du produit
      const { data: product, error } = await supabase
        .from('china_product_imports')
        .select('*')
        .eq('id', productId)
        .single();

      if (error || !product) return null;

      const supplierPriceCNY = (product as any).supplier_price_cny * quantity;
      const exchangeRateCNYUSD = 7.2;
      const supplierPriceUSD = supplierPriceCNY / exchangeRateCNYUSD;

      // Frais estimés
      const domesticShippingCNY = 15 * quantity; // ~15 CNY par unité
      const handlingFeeCNY = 5 * quantity;
      const internationalShippingUSD = calculateShippingCost(quantity, 'AIR');
      const customsDutyPercent = 10; // Taux moyen
      const customsDutyAmount = supplierPriceUSD * (customsDutyPercent / 100);

      const totalCostUSD = supplierPriceUSD +
        (domesticShippingCNY / exchangeRateCNYUSD) +
        (handlingFeeCNY / exchangeRateCNYUSD) +
        internationalShippingUSD +
        customsDutyAmount;

      // Conversion devise locale
      const exchangeRateUSDLocal = 8500; // USD -> GNF
      const totalCostLocal = totalCostUSD * exchangeRateUSDLocal;

      // Marge vendeur (défaut 30%)
      const marginPercent = 30;
      const marginAmount = totalCostLocal * (marginPercent / 100);
      const finalPrice = totalCostLocal + marginAmount;

      return {
        id: `calc_${Date.now()}`,
        product_id: productId,
        supplier_price_cny: supplierPriceCNY,
        supplier_price_usd: supplierPriceUSD,
        exchange_rate_cny_usd: exchangeRateCNYUSD,
        domestic_shipping_cny: domesticShippingCNY,
        handling_fee_cny: handlingFeeCNY,
        international_shipping_usd: internationalShippingUSD,
        transport_method: 'AIR',
        weight_kg: quantity * 0.5, // Estimation
        estimated_customs_duty_percent: customsDutyPercent,
        estimated_customs_duty_amount: customsDutyAmount,
        customs_duty_currency: 'USD',
        payment_processing_fee: totalCostUSD * 0.029,
        platform_fee: totalCostUSD * 0.02,
        total_cost_usd: totalCostUSD,
        total_cost_local: totalCostLocal,
        local_currency: 'GNF',
        exchange_rate_usd_local: exchangeRateUSDLocal,
        vendor_margin_percent: marginPercent,
        vendor_margin_amount: marginAmount,
        final_selling_price: finalPrice,
        selling_currency: 'GNF',
        estimated_profit: marginAmount,
        estimated_profit_percent: marginPercent,
        calculated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('[ChinaDropship] Erreur calcul coûts:', error);
      return null;
    }
  }, []);

  // ==================== LOGS ====================

  const addLog = useCallback(async (log: Partial<ChinaDropshipLog>) => {
    try {
      await (supabase as any).from('china_dropship_logs').insert({
        vendor_id: vendorId,
        log_type: log.log_type || 'sync',
        message: log.message || '',
        severity: log.severity || 'info',
        details: log.details || {}
      });
    } catch (error) {
      console.error('[ChinaDropship] Erreur ajout log:', error);
    }
  }, [vendorId]);

  // ==================== STATS ====================

  const loadStats = useCallback(async () => {
    if (!vendorId) return;

    try {
      // Agrégation des statistiques
      const stats: ChinaDropshipStats = {
        totalSuppliers: chinaSuppliers.length,
        verifiedSuppliers: chinaSuppliers.filter(s => s.verified_by_admin).length,
        activeProducts: importedProducts.filter(p => p.import_status === 'imported').length,
        pendingOrders: chinaOrders.filter(o => o.status === 'pending_supplier_confirm').length,
        inTransitOrders: chinaOrders.filter(o =>
          ['shipped_international', 'customs_clearance', 'last_mile_delivery'].includes(o.status)
        ).length,
        avgDeliveryDays: 18, // Calculer depuis l'historique
        totalRevenue: 0, // Calculer depuis les commandes
        totalProfit: 0,
        marginPercent: 25,
        alertsCount: priceAlerts.length
      };

      setStats(stats);
    } catch (error) {
      console.error('[ChinaDropship] Erreur chargement stats:', error);
    }
  }, [vendorId, chinaSuppliers, importedProducts, chinaOrders, priceAlerts]);

  // ==================== EFFECTS ====================

  useEffect(() => {
    if (vendorId) {
      loadChinaSuppliers();
      loadChinaOrders();
      loadAlerts();
      loadSettings();
    }
  }, [vendorId, loadChinaSuppliers, loadChinaOrders, loadAlerts, loadSettings]);

  useEffect(() => {
    loadStats();
  }, [chinaSuppliers, importedProducts, chinaOrders, priceAlerts, loadStats]);

  // ==================== RETURN ====================

  return {
    loading,
    syncStatus,
    chinaSuppliers,
    importedProducts,
    chinaOrders,
    priceAlerts,
    settings,
    stats,
    loadChinaSuppliers,
    addChinaSupplier,
    updateChinaSupplier,
    verifySupplier,
    disableSupplier,
    importFromUrl,
    convertToDropshipProduct,
    loadChinaOrders,
    createSupplierOrder,
    updateOrderStatus,
    syncPrices,
    syncAvailability,
    loadAlerts,
    dismissAlert,
    loadSettings,
    updateSettings,
    calculateCosts,
    addLog
  };
}

// ==================== HELPERS ====================

/**
 * Extraire les données produit depuis une URL (simulation)
 * En production, utiliser un service de scraping
 */
async function extractProductFromUrl(
  url: string,
  platform: ChinaPlatformType
): Promise<any> {
  // Simulation - en prod, appeler un service backend
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Données simulées
  return {
    id: `${platform}_${Date.now()}`,
    title: 'Produit Exemple depuis ' + platform,
    images: [
      'https://via.placeholder.com/400x400',
      'https://via.placeholder.com/400x400'
    ],
    priceCNY: Math.floor(Math.random() * 500) + 50,
    moq: Math.floor(Math.random() * 10) + 1,
    variants: [
      { id: 'color', name: 'Couleur', values: ['Rouge', 'Bleu', 'Noir'] },
      { id: 'size', name: 'Taille', values: ['S', 'M', 'L', 'XL'] }
    ],
    productionDays: Math.floor(Math.random() * 5) + 2,
    shippingDays: Math.floor(Math.random() * 10) + 10
  };
}

/**
 * Récupérer le prix actuel d'un produit (simulation)
 */
async function fetchCurrentPrice(
  _url: string,
  _platform: ChinaPlatformType
): Promise<number | null> {
  // Simulation - en prod, appeler l'API du fournisseur
  await new Promise(resolve => setTimeout(resolve, 500));

  // Simuler une variation de prix de ±20%
  const basePrice = 100;
  const variation = (Math.random() - 0.5) * 0.4;
  return basePrice * (1 + variation);
}

/**
 * Calculer les frais de livraison internationale
 */
function calculateShippingCost(
  quantity: number,
  method: 'AIR' | 'SEA' | 'EXPRESS' | 'RAIL'
): number {
  const rates: Record<string, number> = {
    EXPRESS: 25,
    AIR: 15,
    RAIL: 8,
    SEA: 4
  };

  const weightKg = quantity * 0.5; // Estimation poids
  const minCharge = 30;

  return Math.max(weightKg * rates[method], minCharge);
}

export default useChinaDropshipping;
