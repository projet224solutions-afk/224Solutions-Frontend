/**
 * PRIVATE SUPPLIER CONNECTOR
 * Connecteur pour fournisseurs privés (non-plateforme)
 * Import manuel, gestion personnalisée
 *
 * @module PrivateSupplierConnector
 * @version 1.0.0
 * @author 224Solutions
 */

import { BaseConnector } from './BaseConnector';
import type {
  ConnectorType,
  ConnectorConfig,
  AuthResult,
  ProductImportResult,
  SyncResult,
  OrderData,
  SupplierOrderResult,
  TrackingData,
  TrackingResult,
  NormalizedProduct
} from './types';

// ==================== PRIVATE SUPPLIER TYPES ====================

export interface PrivateSupplierConfig {
  supplierId: string;
  supplierName: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsApp?: string;
  contactWeChat?: string;
  country: string;
  currency: string;
  paymentTerms?: string;
  minimumOrderValue?: number;
  leadTimeDays?: number;
  notes?: string;
}

export interface ManualProductData {
  name: string;
  description?: string;
  images?: string[];
  price: number;
  currency: string;
  moq?: number;
  stockQuantity?: number;
  sku?: string;
  variants?: Array<{
    name: string;
    options: string[];
    priceModifier?: number;
  }>;
  specifications?: Record<string, string>;
  shippingInfo?: {
    estimatedDays: number;
    shippingCost?: number;
  };
}

// ==================== PRIVATE SUPPLIER CONNECTOR ====================

export class PrivateSupplierConnector extends BaseConnector {
  // Identification
  readonly connectorType: ConnectorType = 'PRIVATE';
  readonly connectorName: string = 'Fournisseur Privé';
  readonly connectorVersion: string = '1.0.0';

  // Configuration spécifique
  private supplierConfig: PrivateSupplierConfig | null = null;

  constructor(
    config: Partial<ConnectorConfig> = {},
    supplierConfig?: PrivateSupplierConfig
  ) {
    super({
      baseUrl: '', // Pas d'API externe
      timeout: 10000,
      retryAttempts: 1, // Pas de retry pour les fournisseurs privés (manuel)
      retryDelayMs: 0,
      rateLimit: {
        maxRequestsPerMinute: 100, // Pas de limite réelle
        maxRequestsPerHour: 1000,
        maxRequestsPerDay: 10000,
        currentMinuteRequests: 0,
        currentHourRequests: 0,
        currentDayRequests: 0,
        lastResetTimestamp: Date.now()
      },
      ...config
    });

    this.supplierConfig = supplierConfig || null;
  }

  // ==================== CONFIGURATION ====================

  setSupplierConfig(config: PrivateSupplierConfig): void {
    this.supplierConfig = config;
    this.log('info', `Configuration fournisseur privé: ${config.supplierName}`);
  }

  getSupplierConfig(): PrivateSupplierConfig | null {
    return this.supplierConfig;
  }

  // ==================== AUTHENTICATION ====================

  protected async doAuthenticate(): Promise<AuthResult> {
    // Les fournisseurs privés n'ont pas besoin d'authentification API
    this.log('info', 'Fournisseur privé - pas d\'authentification API requise');

    if (!this.supplierConfig) {
      return {
        success: false,
        error: 'Configuration fournisseur manquante',
        errorCode: 'NO_SUPPLIER_CONFIG'
      };
    }

    return {
      success: true,
      accessToken: `private_${this.supplierConfig.supplierId}_${Date.now()}`,
      scopes: ['manual_import', 'manual_order']
    };
  }

  protected async doValidateConnection(): Promise<boolean> {
    return !!this.supplierConfig;
  }

  // ==================== PRODUCT IMPORT ====================

  /**
   * Import manuel d'un produit (pas de scraping)
   * L'URL peut être un lien vers un catalogue PDF, une image, ou simplement une description
   */
  protected async doImportProduct(sourceUrl: string): Promise<ProductImportResult> {
    this.log('info', `Import manuel produit privé: ${sourceUrl}`);

    if (!this.supplierConfig) {
      return {
        success: false,
        errors: ['Configuration fournisseur manquante']
      };
    }

    // Pour les fournisseurs privés, on retourne une structure vide à remplir manuellement
    return {
      success: true,
      productId: `PRIV_${Date.now()}`,
      normalizedProduct: this.createEmptyProduct(sourceUrl),
      warnings: [
        'Produit créé avec données par défaut',
        'Veuillez compléter les informations manuellement'
      ]
    };
  }

  /**
   * Import direct avec toutes les données (API interne)
   */
  async importManualProduct(productData: ManualProductData): Promise<ProductImportResult> {
    this.log('info', `Import manuel complet: ${productData.name}`);

    if (!this.supplierConfig) {
      return {
        success: false,
        errors: ['Configuration fournisseur manquante']
      };
    }

    const productId = `PRIV_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const normalizedProduct: NormalizedProduct = {
      externalId: productId,
      sourceUrl: '', // Pas d'URL source
      sourcePlatform: 'PRIVATE',

      title: productData.name,
      description: productData.description,
      images: productData.images || [],

      priceCurrency: productData.currency,
      priceOriginal: productData.price,
      priceUsd: this.convertToUsd(productData.price, productData.currency),

      moq: productData.moq || 1,
      stockQuantity: productData.stockQuantity,

      variants: productData.variants?.map((v, i) => ({
        id: `var_${i}`,
        name: v.name,
        value: v.options.join(', '),
        priceModifier: v.priceModifier
      })),

      shippingMethods: productData.shippingInfo ? [{
        name: 'Livraison fournisseur',
        estimatedDays: productData.shippingInfo.estimatedDays,
        price: productData.shippingInfo.shippingCost || 0,
        currency: productData.currency,
        trackingAvailable: true
      }] : [],

      estimatedDeliveryDays: {
        min: productData.shippingInfo?.estimatedDays || (this.supplierConfig.leadTimeDays || 7),
        max: (productData.shippingInfo?.estimatedDays || (this.supplierConfig.leadTimeDays || 7)) + 10
      },

      supplierInfo: {
        id: this.supplierConfig.supplierId,
        name: this.supplierConfig.supplierName,
        verified: true,
        region: this.mapCountryToRegion(this.supplierConfig.country)
      },

      attributes: productData.specifications,

      isDropship: true,
      isExternalDropship: true,
      platformVerified: false // Fournisseur privé non vérifié par plateforme
    };

    return {
      success: true,
      productId,
      normalizedProduct,
      warnings: []
    };
  }

  private createEmptyProduct(sourceUrl: string): NormalizedProduct {
    return {
      externalId: `PRIV_${Date.now()}`,
      sourceUrl,
      sourcePlatform: 'PRIVATE',

      title: 'Nouveau produit fournisseur privé',
      description: 'À compléter',
      images: [],

      priceCurrency: this.supplierConfig?.currency || 'USD',
      priceOriginal: 0,
      priceUsd: 0,

      moq: 1,

      estimatedDeliveryDays: {
        min: this.supplierConfig?.leadTimeDays || 7,
        max: (this.supplierConfig?.leadTimeDays || 7) + 14
      },

      supplierInfo: {
        id: this.supplierConfig?.supplierId || 'unknown',
        name: this.supplierConfig?.supplierName || 'Fournisseur privé',
        region: this.mapCountryToRegion(this.supplierConfig?.country || 'UNKNOWN')
      },

      isDropship: true,
      isExternalDropship: true,
      platformVerified: false
    };
  }

  private convertToUsd(amount: number, currency: string): number {
    const rates: Record<string, number> = {
      'USD': 1,
      'EUR': 1.08,
      'CNY': 0.14,
      'GBP': 1.27,
      'GNF': 0.000092, // Franc guinéen
      'XOF': 0.0015, // CFA
      'MAD': 0.099 // Dirham marocain
    };
    return Math.round(amount * (rates[currency] || 1) * 100) / 100;
  }

  private mapCountryToRegion(country: string): 'CHINA' | 'LOCAL' | 'INTERNATIONAL' {
    const chinaCountries = ['CN', 'CHINA', 'HK', 'HONG KONG', 'TW', 'TAIWAN'];
    const localCountries = ['GN', 'GUINEA', 'SN', 'SENEGAL', 'CI', 'IVORY COAST', 'ML', 'MALI'];

    const upperCountry = country.toUpperCase();

    if (chinaCountries.includes(upperCountry)) return 'CHINA';
    if (localCountries.includes(upperCountry)) return 'LOCAL';
    return 'INTERNATIONAL';
  }

  // ==================== SYNC METHODS ====================

  protected async doSyncPrice(_productIds?: string[]): Promise<SyncResult> {
    // Pour les fournisseurs privés, la sync est manuelle
    const startedAt = new Date();

    this.log('info', 'Sync prix fournisseur privé - mise à jour manuelle requise');

    return {
      success: true,
      syncType: 'price',
      productsUpdated: 0,
      pricesUpdated: 0,
      stocksUpdated: 0,
      errors: [],
      warnings: ['Fournisseur privé - synchronisation manuelle uniquement'],
      startedAt,
      completedAt: new Date(),
      durationMs: 0
    };
  }

  protected async doSyncAvailability(_productIds?: string[]): Promise<SyncResult> {
    const startedAt = new Date();

    this.log('info', 'Sync disponibilité fournisseur privé - mise à jour manuelle requise');

    return {
      success: true,
      syncType: 'availability',
      productsUpdated: 0,
      pricesUpdated: 0,
      stocksUpdated: 0,
      errors: [],
      warnings: ['Fournisseur privé - synchronisation manuelle uniquement'],
      startedAt,
      completedAt: new Date(),
      durationMs: 0
    };
  }

  // ==================== ORDER CREATION ====================

  protected async doCreateSupplierOrder(orderData: OrderData): Promise<SupplierOrderResult> {
    this.log('order', `Création commande fournisseur privé: ${orderData.orderId}`);

    if (!this.supplierConfig) {
      return {
        success: false,
        error: 'Configuration fournisseur manquante',
        errorCode: 'NO_SUPPLIER_CONFIG'
      };
    }

    // Pour un fournisseur privé, on génère une référence de commande
    // mais la commande réelle doit être passée manuellement (email, WhatsApp, etc.)
    const orderId = `PRIV_ORD_${Date.now()}`;

    // Générer un message de commande formaté
    const orderMessage = this.generateOrderMessage(orderData);

    this.log('info', `Commande à passer manuellement:\n${orderMessage}`);

    return {
      success: true,
      supplierOrderId: orderId,
      supplierOrderReference: orderId,
      estimatedShipDate: new Date(Date.now() + (this.supplierConfig.leadTimeDays || 7) * 86400000),
      estimatedDeliveryDate: new Date(Date.now() + ((this.supplierConfig.leadTimeDays || 7) + 14) * 86400000),
      totalCost: orderData.total,
      currency: this.supplierConfig.currency
    };
  }

  private generateOrderMessage(orderData: OrderData): string {
    const lines = [
      `📦 NOUVELLE COMMANDE DROPSHIPPING`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `🔖 Référence: ${orderData.orderId}`,
      `📅 Date: ${new Date().toLocaleDateString('fr-FR')}`,
      ``,
      `📋 ARTICLES:`,
      ...orderData.items.map(item =>
        `  • ${item.productName} x${item.quantity} @ ${item.unitPrice} ${orderData.currency}`
      ),
      ``,
      `💰 Total: ${orderData.total} ${orderData.currency}`,
      ``,
      `📍 LIVRAISON:`,
      `  ${orderData.shippingAddress.recipientName}`,
      `  ${orderData.shippingAddress.phone}`,
      `  ${orderData.shippingAddress.addressLine1}`,
      orderData.shippingAddress.addressLine2 ? `  ${orderData.shippingAddress.addressLine2}` : null,
      `  ${orderData.shippingAddress.city}, ${orderData.shippingAddress.country}`,
      ``,
      orderData.notes ? `📝 Notes: ${orderData.notes}` : null,
      ``,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Merci de confirmer la réception de cette commande.`
    ].filter(Boolean);

    return lines.join('\n');
  }

  /**
   * Envoyer la commande par email/WhatsApp (helper)
   */
  async sendOrderNotification(orderData: OrderData, method: 'email' | 'whatsapp' | 'wechat'): Promise<boolean> {
    if (!this.supplierConfig) {
      this.log('error', 'Configuration fournisseur manquante');
      return false;
    }

    const message = this.generateOrderMessage(orderData);

    switch (method) {
      case 'email':
        // Intégration email à implémenter
        this.log('info', `Email à envoyer à: ${this.supplierConfig.contactEmail}`);
        break;

      case 'whatsapp':
        const whatsappUrl = `https://wa.me/${this.supplierConfig.contactWhatsApp?.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
        this.log('info', `WhatsApp URL: ${whatsappUrl}`);
        break;

      case 'wechat':
        this.log('info', `WeChat: Envoyer à ${this.supplierConfig.contactWeChat}`);
        break;
    }

    return true;
  }

  // ==================== TRACKING ====================

  protected async doPushTracking(trackingData: TrackingData): Promise<TrackingResult> {
    this.log('info', `Tracking fournisseur privé: ${trackingData.trackingNumber}`);

    // Pour les fournisseurs privés, le tracking est géré manuellement
    // On pourrait intégrer une API de tracking universelle (17Track, AfterShip, etc.)

    return {
      success: true,
      trackingUpdated: true,
      currentStatus: 'En attente de mise à jour manuelle',
      trackingEvents: [{
        timestamp: new Date(),
        status: 'Tracking enregistré',
        description: `Numéro de suivi: ${trackingData.trackingNumber}`
      }]
    };
  }

  // ==================== HELPERS SPÉCIFIQUES ====================

  /**
   * Mettre à jour manuellement le prix d'un produit
   */
  async updateProductPrice(
    productId: string,
    newPrice: number,
    currency: string
  ): Promise<boolean> {
    this.log('info', `Mise à jour prix manuel: ${productId} -> ${newPrice} ${currency}`);
    // À implémenter avec la base de données
    return true;
  }

  /**
   * Mettre à jour manuellement le stock
   */
  async updateProductStock(productId: string, newStock: number): Promise<boolean> {
    this.log('info', `Mise à jour stock manuel: ${productId} -> ${newStock}`);
    // À implémenter avec la base de données
    return true;
  }

  /**
   * Marquer une commande comme expédiée
   */
  async markOrderShipped(
    orderId: string,
    trackingNumber: string,
    _carrier?: string
  ): Promise<boolean> {
    this.log('order', `Commande expédiée: ${orderId} - Tracking: ${trackingNumber}`);
    // À implémenter avec la base de données
    return true;
  }
}

export default PrivateSupplierConnector;
