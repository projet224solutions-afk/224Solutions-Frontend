/**
 * HOOK USE CONNECTORS
 * Hook React pour gérer les connecteurs dropshipping
 *
 * @module useConnectors
 * @version 1.0.0
 * @author 224Solutions
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  dropshippingConnectorService,
  ConnectorFactory,
  type ConnectorType,
  type ConnectorConfig,
  type ConnectorInfo,
  type ProductImportResult,
  type SyncResult,
  type SupplierOrderResult,
  type OrderData,
  type ConnectorMetrics
} from '@/services/connectors';

// ==================== INTERFACES ====================

interface UseConnectorsReturn {
  // État
  loading: boolean;
  importing: boolean;
  syncing: boolean;

  // Données
  availableConnectors: ConnectorInfo[];
  activeConnectors: ConnectorType[];
  metrics: Map<ConnectorType, Partial<ConnectorMetrics>>;

  // Actions Connecteurs
  initConnector: (type: ConnectorType, config?: Partial<ConnectorConfig>) => Promise<boolean>;
  disconnectConnector: (type: ConnectorType) => Promise<void>;

  // Actions Import
  importFromUrl: (url: string, connectorType?: ConnectorType) => Promise<ProductImportResult>;
  importFromId: (productId: string, connectorType: ConnectorType) => Promise<ProductImportResult>;
  detectPlatform: (url: string) => ConnectorType | null;
  saveProduct: (product: ProductImportResult, options?: { autoPublish?: boolean; marginPercent?: number }) => Promise<string | null>;

  // Actions Sync
  syncPrices: (connectorType: ConnectorType, productIds?: string[]) => Promise<SyncResult>;
  syncAvailability: (connectorType: ConnectorType, productIds?: string[]) => Promise<SyncResult>;
  syncAll: (connectorType: ConnectorType, productIds?: string[]) => Promise<{ priceSync: SyncResult; availabilitySync: SyncResult }>;

  // Actions Commandes
  createOrder: (connectorType: ConnectorType, orderData: OrderData) => Promise<SupplierOrderResult>;

  // Utilitaires
  isConnectorActive: (type: ConnectorType) => boolean;
  getConnectorInfo: (type: ConnectorType) => ConnectorInfo | undefined;
}

// ==================== HOOK ====================

export function useConnectors(vendorId?: string): UseConnectorsReturn {
  // États
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeConnectors, setActiveConnectors] = useState<ConnectorType[]>([]);
  const [metrics, setMetrics] = useState<Map<ConnectorType, Partial<ConnectorMetrics>>>(new Map());

  // Données statiques
  const availableConnectors = useMemo(() =>
    ConnectorFactory.getAvailableConnectors().filter(c => c.status !== 'deprecated'),
    []
  );

  // ==================== INITIALISATION ====================

  useEffect(() => {
    if (vendorId) {
      // Charger les connecteurs actifs
      const active = dropshippingConnectorService.getActiveConnectors(vendorId);
      setActiveConnectors(active);

      // Charger les métriques
      const metricsMap = new Map<ConnectorType, Partial<ConnectorMetrics>>();
      for (const type of active) {
        const m = dropshippingConnectorService.getMetrics(vendorId, type);
        if (m) metricsMap.set(type, m);
      }
      setMetrics(metricsMap);
    }
  }, [vendorId]);

  // ==================== ACTIONS CONNECTEURS ====================

  const initConnector = useCallback(async (
    type: ConnectorType,
    config: Partial<ConnectorConfig> = {}
  ): Promise<boolean> => {
    if (!vendorId) {
      toast.error('Vendeur non identifié');
      return false;
    }

    setLoading(true);
    try {
      const connector = await dropshippingConnectorService.initializeConnector(
        vendorId,
        type,
        config
      );

      if (connector) {
        setActiveConnectors(prev => [...prev.filter(t => t !== type), type]);
        return true;
      }

      return false;
    } catch (error: any) {
      console.error('[useConnectors] Init error:', error);
      toast.error(`Erreur initialisation ${type}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  const disconnectConnector = useCallback(async (type: ConnectorType): Promise<void> => {
    if (!vendorId) return;

    setLoading(true);
    try {
      await dropshippingConnectorService.disconnectConnector(vendorId, type);
      setActiveConnectors(prev => prev.filter(t => t !== type));
      toast.success(`${type} déconnecté`);
    } catch (_error: any) {
      toast.error(`Erreur déconnexion ${type}`);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  // ==================== ACTIONS IMPORT ====================

  const importFromUrl = useCallback(async (
    url: string,
    connectorType?: ConnectorType
  ): Promise<ProductImportResult> => {
    if (!vendorId) {
      return { success: false, errors: ['Vendeur non identifié'] };
    }

    setImporting(true);
    try {
      const result = await dropshippingConnectorService.importProduct(
        vendorId,
        url,
        { connectorType, autoDetectPlatform: !connectorType }
      );

      if (result.success) {
        toast.success('Produit importé avec succès');
      } else {
        toast.error(result.errors?.[0] || 'Erreur import');
      }

      return result;
    } catch (error: any) {
      toast.error(error.message);
      return { success: false, errors: [error.message] };
    } finally {
      setImporting(false);
    }
  }, [vendorId]);

  const detectPlatform = useCallback((url: string): ConnectorType | null => {
    return dropshippingConnectorService.detectPlatform(url);
  }, []);

  // ==================== ACTIONS SYNC ====================

  const syncPrices = useCallback(async (
    connectorType: ConnectorType,
    productIds?: string[]
  ): Promise<SyncResult> => {
    if (!vendorId) {
      return {
        success: false,
        syncType: 'price',
        productsUpdated: 0,
        pricesUpdated: 0,
        stocksUpdated: 0,
        errors: [{ productId: '', errorType: 'NO_VENDOR', message: 'Vendeur non identifié', retryable: false }],
        warnings: [],
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 0
      };
    }

    setSyncing(true);
    try {
      const result = await dropshippingConnectorService.syncPrices(vendorId, connectorType, productIds);

      if (result.success) {
        toast.success(`${result.pricesUpdated} prix synchronisés`);
      } else if (result.errors.length > 0) {
        toast.warning(`Sync avec ${result.errors.length} erreurs`);
      }

      return result;
    } finally {
      setSyncing(false);
    }
  }, [vendorId]);

  const syncAvailability = useCallback(async (
    connectorType: ConnectorType,
    productIds?: string[]
  ): Promise<SyncResult> => {
    if (!vendorId) {
      return {
        success: false,
        syncType: 'availability',
        productsUpdated: 0,
        pricesUpdated: 0,
        stocksUpdated: 0,
        errors: [{ productId: '', errorType: 'NO_VENDOR', message: 'Vendeur non identifié', retryable: false }],
        warnings: [],
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 0
      };
    }

    setSyncing(true);
    try {
      const result = await dropshippingConnectorService.syncAvailability(vendorId, connectorType, productIds);

      if (result.success) {
        toast.success(`${result.stocksUpdated} stocks synchronisés`);
      }

      return result;
    } finally {
      setSyncing(false);
    }
  }, [vendorId]);

  const syncAll = useCallback(async (
    connectorType: ConnectorType,
    productIds?: string[]
  ) => {
    if (!vendorId) {
      const emptyResult: SyncResult = {
        success: false,
        syncType: 'full',
        productsUpdated: 0,
        pricesUpdated: 0,
        stocksUpdated: 0,
        errors: [],
        warnings: [],
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 0
      };
      return { priceSync: emptyResult, availabilitySync: emptyResult };
    }

    setSyncing(true);
    try {
      const result = await dropshippingConnectorService.syncAll(vendorId, connectorType, productIds);
      toast.success('Synchronisation complète terminée');
      return result;
    } finally {
      setSyncing(false);
    }
  }, [vendorId]);

  // Import depuis un ID produit (pour marketplace)
  const importFromId = useCallback(async (
    productId: string,
    connectorType: ConnectorType
  ): Promise<ProductImportResult> => {
    if (!vendorId) {
      return { success: false, errors: ['Vendeur non identifié'] };
    }

    setImporting(true);
    try {
      // Construire l'URL depuis l'ID selon le connecteur
      let url = '';
      switch (connectorType) {
        case 'ALIEXPRESS':
          url = `https://www.aliexpress.com/item/${productId}.html`;
          break;
        case 'ALIBABA':
          url = `https://www.alibaba.com/product-detail/${productId}.html`;
          break;
        case '1688':
          url = `https://detail.1688.com/offer/${productId}.html`;
          break;
        default:
          return { success: false, errors: ['Plateforme non supportée pour import par ID'] };
      }

      return await importFromUrl(url, connectorType);
    } finally {
      setImporting(false);
    }
  }, [vendorId, importFromUrl]);

  // Sauvegarder un produit importé dans dropship_products
  const saveProduct = useCallback(async (
    product: ProductImportResult,
    options: { autoPublish?: boolean; marginPercent?: number } = {}
  ): Promise<string | null> => {
    if (!vendorId || !product.normalizedProduct) {
      toast.error('Données produit invalides');
      return null;
    }

    try {
      const np = product.normalizedProduct;
      const marginPercent = options.marginPercent || 30;
      const sellingPrice = np.priceUsd * (1 + marginPercent / 100);

      const { data, error } = await (supabase as any)
        .from('dropship_products')
        .insert({
          vendor_id: vendorId,
          title: np.titleTranslated || np.title,
          description: np.descriptionTranslated || np.description,
          images: np.images,
          thumbnail: np.images[0],
          source_connector: np.sourcePlatform,
          source_product_id: np.externalId,
          source_url: np.sourceUrl,
          cost_price: np.priceUsd,
          cost_currency: 'USD',
          selling_price: sellingPrice,
          margin_percent: marginPercent,
          stock_quantity: np.stockQuantity || 0,
          has_variants: (np.variants?.length || 0) > 0,
          variants: np.variants || [],
          shipping_time_min: np.estimatedDeliveryDays.min,
          shipping_time_max: np.estimatedDeliveryDays.max,
          is_published: options.autoPublish || false,
          is_available: true,
          category: np.category,
          tags: np.tags,
          metadata: {
            moq: np.moq,
            priceTiers: np.priceTiers,
            supplierInfo: np.supplierInfo,
            importedAt: new Date().toISOString()
          }
        })
        .select('id')
        .single();

      if (error) throw error;

      toast.success('Produit sauvegardé avec succès');
      return data?.id || null;
    } catch (error: any) {
      console.error('[useConnectors] Save error:', error);
      toast.error('Erreur lors de la sauvegarde');
      return null;
    }
  }, [vendorId]);

  // ==================== ACTIONS COMMANDES ====================

  const createOrder = useCallback(async (
    connectorType: ConnectorType,
    orderData: OrderData
  ): Promise<SupplierOrderResult> => {
    if (!vendorId) {
      return { success: false, error: 'Vendeur non identifié', errorCode: 'NO_VENDOR' };
    }

    setLoading(true);
    try {
      const result = await dropshippingConnectorService.createSupplierOrder(
        vendorId,
        connectorType,
        orderData
      );

      if (result.success) {
        toast.success(`Commande fournisseur créée: ${result.supplierOrderId}`);
      } else {
        toast.error(result.error || 'Erreur création commande');
      }

      return result;
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  // ==================== UTILITAIRES ====================

  const isConnectorActive = useCallback((type: ConnectorType): boolean => {
    return activeConnectors.includes(type);
  }, [activeConnectors]);

  const getConnectorInfo = useCallback((type: ConnectorType): ConnectorInfo | undefined => {
    return ConnectorFactory.getConnectorInfo(type);
  }, []);

  // ==================== RETURN ====================

  return {
    // État
    loading,
    importing,
    syncing,

    // Données
    availableConnectors,
    activeConnectors,
    metrics,

    // Actions
    initConnector,
    disconnectConnector,
    importFromUrl,
    importFromId,
    saveProduct,
    detectPlatform,
    syncPrices,
    syncAvailability,
    syncAll,
    createOrder,

    // Utilitaires
    isConnectorActive,
    getConnectorInfo
  };
}

export default useConnectors;
