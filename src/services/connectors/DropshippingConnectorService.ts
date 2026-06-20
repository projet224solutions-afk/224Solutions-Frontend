/**
 * DROPSHIPPING CONNECTOR SERVICE
 * Service d'orchestration pour tous les connecteurs dropshipping
 * Gère l'import, la synchronisation et les commandes
 *
 * @module DropshippingConnectorService
 * @version 1.0.0
 * @author 224Solutions
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ConnectorFactory } from './ConnectorFactory';
import type {
  ConnectorType,
  ConnectorConfig,
  IExternalConnector,
  ProductImportResult,
  SyncResult,
  OrderData,
  SupplierOrderResult,
  ConnectorInfo,
  ConnectorMetrics,
  ConnectorLog
} from './types';

// ==================== TYPES ====================

interface ConnectorInstance {
  connector: IExternalConnector;
  vendorId: string;
  config: Partial<ConnectorConfig>;
  metrics: Partial<ConnectorMetrics>;
  lastActivity: Date;
}

interface SyncJob {
  id: string;
  vendorId: string;
  connectorType: ConnectorType;
  syncType: 'price' | 'availability' | 'full';
  productIds?: string[];
  scheduledAt: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: SyncResult;
}

interface ImportJob {
  id: string;
  vendorId: string;
  sourceUrl: string;
  connectorType: ConnectorType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: ProductImportResult;
}

// ==================== SERVICE ====================

class DropshippingConnectorService {
  private instances: Map<string, ConnectorInstance> = new Map();
  private syncJobs: Map<string, SyncJob> = new Map();
  private importJobs: Map<string, ImportJob> = new Map();
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

  // ==================== INITIALIZATION ====================

  /**
   * Initialiser un connecteur pour un vendeur
   */
  async initializeConnector(
    vendorId: string,
    connectorType: ConnectorType,
    config: Partial<ConnectorConfig> = {}
  ): Promise<IExternalConnector | null> {
    const key = this.getInstanceKey(vendorId, connectorType);

    try {
      // Vérifier si déjà initialisé
      if (this.instances.has(key)) {
        return this.instances.get(key)!.connector;
      }

      // Créer le connecteur
      const connector = ConnectorFactory.create(connectorType, {
        sandbox: config.sandbox ?? true, // Mode sandbox par défaut
        ...config
      });

      // Authentifier
      const authResult = await connector.authenticate();

      if (!authResult.success) {
        console.error(`[Connector] Auth failed for ${connectorType}:`, authResult.error);
        toast.error(`Erreur d'authentification ${connectorType}`);
        return null;
      }

      // Stocker l'instance
      this.instances.set(key, {
        connector,
        vendorId,
        config,
        metrics: {
          connectorType,
          totalRequests: 0,
          totalSyncs: 0,
          totalOrders: 0,
          errorsLast24h: 0,
          periodStart: new Date(),
          periodEnd: new Date()
        },
        lastActivity: new Date()
      });

      // Démarrer la sync automatique si configuré
      if (config.autoSync !== false) {
        this.startAutoSync(vendorId, connectorType, config.syncIntervalMinutes || 60);
      }

      // Logger dans Supabase
      await this.logActivity(vendorId, connectorType, 'info', `Connecteur ${connectorType} initialisé`);

      toast.success(`Connecteur ${connectorType} activé`);
      return connector;
    } catch (error: any) {
      console.error(`[Connector] Init error:`, error);
      toast.error(`Erreur initialisation ${connectorType}`);
      return null;
    }
  }

  /**
   * Obtenir un connecteur existant
   */
  getConnector(vendorId: string, connectorType: ConnectorType): IExternalConnector | null {
    const key = this.getInstanceKey(vendorId, connectorType);
    return this.instances.get(key)?.connector || null;
  }

  // ==================== PRODUCT IMPORT ====================

  /**
   * Importer un produit depuis une URL
   */
  async importProduct(
    vendorId: string,
    sourceUrl: string,
    options: { autoDetectPlatform?: boolean; connectorType?: ConnectorType } = {}
  ): Promise<ProductImportResult> {
    try {
      // Détecter automatiquement la plateforme si non spécifiée
      const connectorType = options.connectorType || this.detectPlatform(sourceUrl);

      if (!connectorType) {
        return {
          success: false,
          errors: ['Impossible de détecter la plateforme. Veuillez spécifier le type de connecteur.']
        };
      }

      // Obtenir ou initialiser le connecteur
      let connector = this.getConnector(vendorId, connectorType);

      if (!connector) {
        connector = await this.initializeConnector(vendorId, connectorType);
        if (!connector) {
          return {
            success: false,
            errors: [`Impossible d'initialiser le connecteur ${connectorType}`]
          };
        }
      }

      // Créer un job d'import
      const jobId = `import_${Date.now()}`;
      this.importJobs.set(jobId, {
        id: jobId,
        vendorId,
        sourceUrl,
        connectorType,
        status: 'processing'
      });

      // Importer le produit
      const result = await connector.importProduct(sourceUrl);

      // Mettre à jour le job
      this.importJobs.get(jobId)!.status = result.success ? 'completed' : 'failed';
      this.importJobs.get(jobId)!.result = result;

      // Si succès, sauvegarder dans la base de données
      if (result.success && result.normalizedProduct) {
        const savedProduct = await this.saveImportedProduct(vendorId, result.normalizedProduct, connectorType);

        if (savedProduct) {
          result.productId = savedProduct.id;
          await this.logActivity(vendorId, connectorType, 'import', `Produit importé: ${result.normalizedProduct.title}`);
        }
      }

      // Mettre à jour les métriques
      this.updateMetrics(vendorId, connectorType, { productsImported: 1 });

      return result;
    } catch (error: any) {
      console.error('[Connector] Import error:', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Détecter la plateforme depuis l'URL
   */
  detectPlatform(url: string): ConnectorType | null {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('aliexpress.com') || urlLower.includes('aliexpress.ru')) {
      return 'ALIEXPRESS';
    }

    if (urlLower.includes('alibaba.com')) {
      return 'ALIBABA';
    }

    if (urlLower.includes('1688.com')) {
      return '1688';
    }

    // URL non reconnue
    return null;
  }

  /**
   * Sauvegarder un produit importé dans la base de données
   */
  private async saveImportedProduct(
    vendorId: string,
    product: ProductImportResult['normalizedProduct'],
    connectorType: ConnectorType
  ): Promise<{ id: string } | null> {
    if (!product) return null;

    try {
      // D'abord, créer l'import dans china_product_imports
      const { data: importData, error: importError } = await (supabase as any)
        .from('china_product_imports')
        .insert({
          vendor_id: vendorId,
          source_platform: connectorType,
          source_url: product.sourceUrl,
          source_product_id: product.externalId,
          original_title: product.title,
          translated_title: product.titleTranslated,
          original_description: product.description,
          images: product.images,
          supplier_price_cny: product.priceCurrency === 'CNY' ? product.priceOriginal : product.priceOriginal * 7.2,
          supplier_price_usd: product.priceUsd,
          moq: product.moq,
          price_tiers: product.priceTiers || [],
          variants: product.variants || [],
          production_time_days: 3,
          shipping_time_days: product.estimatedDeliveryDays?.max || 20,
          import_status: 'pending'
        })
        .select()
        .single();

      if (importError) {
        console.error('[Connector] Save import error:', importError);
        // Continuer quand même - ce n'est pas bloquant
      }

      // Créer le produit dropship directement avec le vendorId (auth.uid())
      // Pas besoin de chercher dans une table vendors séparée
      const marginPercent = 40; // Marge par défaut 40%
      const sellingPrice = product.priceUsd * (1 + marginPercent / 100);

      const { data: dropshipProduct, error: productError } = await (supabase as any)
        .from('dropship_products')
        .insert({
          vendor_id: vendorId,
          source_connector: connectorType,
          source_product_id: product.externalId,
          source_url: product.sourceUrl,
          title: product.title,
          description: product.description,
          images: product.images,
          thumbnail: product.images?.[0] || null,
          cost_price: product.priceUsd,
          cost_currency: 'USD',
          selling_price: sellingPrice,
          margin_percent: marginPercent,
          stock_quantity: product.stockQuantity || 0,
          stock_status: 'in_stock',
          shipping_time_min: product.estimatedDeliveryDays?.min || 15,
          shipping_time_max: product.estimatedDeliveryDays?.max || 30,
          auto_sync: true,
          sync_status: 'synced',
          last_sync_at: new Date().toISOString(),
          has_variants: (product.variants?.length || 0) > 0,
          variants: product.variants || [],
          is_published: false,
          is_available: true
        })
        .select()
        .single();

      if (productError) {
        console.error('[Connector] Save dropship product error:', productError);
        return importData ? { id: importData.id } : null;
      }

      // Mettre à jour l'import avec le lien vers le produit dropship
      if (importData && dropshipProduct) {
        await supabase
          .from('china_product_imports')
          .update({
            dropship_product_id: dropshipProduct.id,
            import_status: 'imported'
          })
          .eq('id', importData.id);
      }

      return { id: dropshipProduct?.id || importData?.id };
    } catch (error: any) {
      console.error('[Connector] Save product error:', error);
      return null;
    }
  }

  // ==================== SYNCHRONIZATION ====================

  /**
   * Synchroniser les prix
   */
  async syncPrices(
    vendorId: string,
    connectorType: ConnectorType,
    productIds?: string[]
  ): Promise<SyncResult> {
    const connector = this.getConnector(vendorId, connectorType);

    if (!connector) {
      return {
        success: false,
        syncType: 'price',
        productsUpdated: 0,
        pricesUpdated: 0,
        stocksUpdated: 0,
        errors: [{ productId: '', errorType: 'NO_CONNECTOR', message: 'Connecteur non initialisé', retryable: true }],
        warnings: [],
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 0
      };
    }

    const result = await connector.syncPrice(productIds);

    // Logger
    await this.logActivity(
      vendorId,
      connectorType,
      'sync',
      `Sync prix: ${result.pricesUpdated} mis à jour`,
      { result }
    );

    // Mettre à jour les métriques
    this.updateMetrics(vendorId, connectorType, { totalSyncs: 1 });

    return result;
  }

  /**
   * Synchroniser la disponibilité
   */
  async syncAvailability(
    vendorId: string,
    connectorType: ConnectorType,
    productIds?: string[]
  ): Promise<SyncResult> {
    const connector = this.getConnector(vendorId, connectorType);

    if (!connector) {
      return {
        success: false,
        syncType: 'availability',
        productsUpdated: 0,
        pricesUpdated: 0,
        stocksUpdated: 0,
        errors: [{ productId: '', errorType: 'NO_CONNECTOR', message: 'Connecteur non initialisé', retryable: true }],
        warnings: [],
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 0
      };
    }

    const result = await connector.syncAvailability(productIds);

    await this.logActivity(
      vendorId,
      connectorType,
      'sync',
      `Sync disponibilité: ${result.stocksUpdated} mis à jour`
    );

    return result;
  }

  /**
   * Synchronisation complète
   */
  async syncAll(vendorId: string, connectorType: ConnectorType, productIds?: string[]): Promise<{
    priceSync: SyncResult;
    availabilitySync: SyncResult;
  }> {
    const [priceSync, availabilitySync] = await Promise.all([
      this.syncPrices(vendorId, connectorType, productIds),
      this.syncAvailability(vendorId, connectorType, productIds)
    ]);

    return { priceSync, availabilitySync };
  }

  /**
   * Démarrer la synchronisation automatique
   */
  startAutoSync(vendorId: string, connectorType: ConnectorType, intervalMinutes: number): void {
    const key = this.getInstanceKey(vendorId, connectorType);

    // Arrêter l'ancienne sync si elle existe
    this.stopAutoSync(vendorId, connectorType);

    // Démarrer la nouvelle
    const interval = setInterval(async () => {
      console.log(`[AutoSync] Running for ${connectorType}...`);
      await this.syncAll(vendorId, connectorType);
    }, intervalMinutes * 60 * 1000);

    this.syncIntervals.set(key, interval);
  }

  /**
   * Arrêter la synchronisation automatique
   */
  stopAutoSync(vendorId: string, connectorType: ConnectorType): void {
    const key = this.getInstanceKey(vendorId, connectorType);
    const interval = this.syncIntervals.get(key);

    if (interval) {
      clearInterval(interval);
      this.syncIntervals.delete(key);
    }
  }

  // ==================== ORDER MANAGEMENT ====================

  /**
   * Créer une commande fournisseur
   */
  async createSupplierOrder(
    vendorId: string,
    connectorType: ConnectorType,
    orderData: OrderData
  ): Promise<SupplierOrderResult> {
    const connector = this.getConnector(vendorId, connectorType);

    if (!connector) {
      return {
        success: false,
        error: 'Connecteur non initialisé',
        errorCode: 'NO_CONNECTOR'
      };
    }

    const result = await connector.onOrderCreated(orderData);

    if (result.success) {
      // Sauvegarder la commande dans la base
      await this.saveSupplierOrder(vendorId, connectorType, orderData, result);

      await this.logActivity(
        vendorId,
        connectorType,
        'order',
        `Commande fournisseur créée: ${result.supplierOrderId}`
      );

      this.updateMetrics(vendorId, connectorType, { totalOrders: 1 });
    }

    return result;
  }

  /**
   * Sauvegarder une commande fournisseur
   */
  private async saveSupplierOrder(
    vendorId: string,
    connectorType: ConnectorType,
    orderData: OrderData,
    result: SupplierOrderResult
  ): Promise<void> {
    try {
      await (supabase as any)
        .from('china_supplier_orders')
        .insert({
          customer_order_id: orderData.customerOrderId,
          vendor_id: vendorId,
          status: 'pending_supplier_confirm',
          items: orderData.items,
          shipping_address: orderData.shippingAddress,
          supplier_total_usd: result.totalCost || orderData.total,
          supplier_total_cny: (result.totalCost || orderData.total) * 7.2,
          expected_ship_date: result.estimatedShipDate,
          expected_delivery_date: result.estimatedDeliveryDate,
          notes_internal: `Connecteur: ${connectorType} | Ref: ${result.supplierOrderReference}`
        });
    } catch (error) {
      console.error('[Connector] Save order error:', error);
    }
  }

  // ==================== UTILITIES ====================

  /**
   * Obtenir les connecteurs disponibles pour un vendeur
   */
  getAvailableConnectors(): ConnectorInfo[] {
    return ConnectorFactory.getAvailableConnectors();
  }

  /**
   * Obtenir les connecteurs actifs pour un vendeur
   */
  getActiveConnectors(vendorId: string): ConnectorType[] {
    const active: ConnectorType[] = [];

    for (const [key, instance] of this.instances.entries()) {
      if (key.startsWith(`${vendorId}_`)) {
        active.push(instance.connector.connectorType);
      }
    }

    return active;
  }

  /**
   * Obtenir les métriques d'un connecteur
   */
  getMetrics(vendorId: string, connectorType: ConnectorType): Partial<ConnectorMetrics> | null {
    const key = this.getInstanceKey(vendorId, connectorType);
    return this.instances.get(key)?.metrics || null;
  }

  /**
   * Déconnecter un connecteur
   */
  async disconnectConnector(vendorId: string, connectorType: ConnectorType): Promise<void> {
    const key = this.getInstanceKey(vendorId, connectorType);
    const instance = this.instances.get(key);

    if (instance) {
      this.stopAutoSync(vendorId, connectorType);
      await instance.connector.disconnect();
      this.instances.delete(key);

      await this.logActivity(vendorId, connectorType, 'info', `Connecteur ${connectorType} déconnecté`);
    }
  }

  /**
   * Déconnecter tous les connecteurs d'un vendeur
   */
  async disconnectAll(vendorId: string): Promise<void> {
    for (const [key, instance] of this.instances.entries()) {
      if (key.startsWith(`${vendorId}_`)) {
        await this.disconnectConnector(vendorId, instance.connector.connectorType);
      }
    }
  }

  // ==================== PRIVATE HELPERS ====================

  private getInstanceKey(vendorId: string, connectorType: ConnectorType): string {
    return `${vendorId}_${connectorType}`;
  }

  private updateMetrics(
    vendorId: string,
    connectorType: ConnectorType,
    updates: Partial<ConnectorMetrics>
  ): void {
    const key = this.getInstanceKey(vendorId, connectorType);
    const instance = this.instances.get(key);

    if (instance) {
      instance.metrics = {
        ...instance.metrics,
        ...updates,
        totalRequests: (instance.metrics.totalRequests || 0) + 1
      };
      instance.lastActivity = new Date();
    }
  }

  private async logActivity(
    vendorId: string,
    connectorType: ConnectorType,
    logType: ConnectorLog['logType'],
    message: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    try {
      // Mapper le logType vers les valeurs acceptées par china_dropship_logs
      const dbLogType = (logType === 'import' ? 'import' :
                        logType === 'order' ? 'order' :
                        logType === 'sync' ? 'sync' :
                        logType === 'error' || logType === 'critical' ? 'error' :
                        logType === 'api' ? 'api' : 'sync') as 'sync' | 'import' | 'order' | 'alert' | 'error' | 'api';

      await (supabase as any)
        .from('china_dropship_logs')
        .insert({
          vendor_id: vendorId,
          log_type: dbLogType,
          severity: logType === 'error' || logType === 'critical' ? 'error' : 'info',
          message: `[${connectorType}] ${message}`,
          details: {
            connector_type: connectorType,
            ...details
          }
        });
    } catch (error) {
      console.error('[Connector] Log error:', error);
    }
  }
}

// Export singleton
export const dropshippingConnectorService = new DropshippingConnectorService();

export default dropshippingConnectorService;
