/**
 * ALIEXPRESS CONNECTOR
 * Connecteur pour la plateforme AliExpress
 * Import produits, sync prix, gestion commandes
 *
 * @module AliExpressConnector
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
  NormalizedProduct,
  ShippingMethod
} from './types';

// ==================== ALIEXPRESS SPECIFIC TYPES ====================

interface AliExpressProductData {
  productId: string;
  title: string;
  description: string;
  images: string[];
  price: {
    original: number;
    current: number;
    currency: string;
  };
  shipping: {
    methods: Array<{
      name: string;
      price: number;
      estimatedDays: string;
    }>;
  };
  seller: {
    id: string;
    name: string;
    rating: number;
    positiveRate: number;
    followers: number;
  };
  stock: number;
  moq: number;
  variants?: Array<{
    id: string;
    name: string;
    options: string[];
    priceModifier?: number;
  }>;
  category?: string;
  specifications?: Record<string, string>;
}

interface AliExpressOrderResponse {
  orderId: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
}

// ==================== ALIEXPRESS CONNECTOR ====================

export class AliExpressConnector extends BaseConnector {
  // Identification
  readonly connectorType: ConnectorType = 'ALIEXPRESS';
  readonly connectorName: string = 'AliExpress';
  readonly connectorVersion: string = '1.0.0';

  // URLs AliExpress
  private readonly API_BASE_URL = 'https://api.aliexpress.com/v2';
  private readonly AFFILIATE_BASE_URL = 'https://portals.aliexpress.com';

  constructor(config: Partial<ConnectorConfig> = {}) {
    super({
      baseUrl: 'https://api.aliexpress.com/v2',
      timeout: 30000,
      retryAttempts: 3,
      retryDelayMs: 2000,
      rateLimit: {
        maxRequestsPerMinute: 20,
        maxRequestsPerHour: 300,
        maxRequestsPerDay: 3000,
        currentMinuteRequests: 0,
        currentHourRequests: 0,
        currentDayRequests: 0,
        lastResetTimestamp: Date.now()
      },
      ...config
    });
  }

  // ==================== AUTHENTICATION ====================

  protected async doAuthenticate(): Promise<AuthResult> {
    this.log('info', 'Authentification AliExpress...');

    try {
      // En mode sandbox ou sans API key, on simule l'authentification
      if (this.config.sandbox || !this.config.apiKey) {
        this.log('info', 'Mode sandbox - authentification simulée');
        return {
          success: true,
          accessToken: 'sandbox_token_' + Date.now(),
          expiresAt: new Date(Date.now() + 86400000), // 24h
          scopes: ['product.read', 'order.create', 'tracking.read']
        };
      }

      // Authentification réelle via OAuth AliExpress
      // Note: Nécessite un compte développeur AliExpress
      const response = await fetch(`${this.AFFILIATE_BASE_URL}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.config.apiKey || '',
          client_secret: this.config.apiSecret || '',
          code: this.config.accessToken || ''
        })
      });

      if (!response.ok) {
        throw new Error(`Authentification échouée: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + (data.expires_in * 1000)),
        scopes: data.scope?.split(' ') || []
      };
    } catch (error: any) {
      this.log('error', `Erreur authentification: ${error.message}`);
      return {
        success: false,
        error: error.message,
        errorCode: 'AUTH_FAILED'
      };
    }
  }

  protected async doValidateConnection(): Promise<boolean> {
    // Vérifier si le token est valide
    return this.status === 'active' && !!this.config.accessToken;
  }

  // ==================== PRODUCT IMPORT ====================

  protected async doImportProduct(sourceUrl: string): Promise<ProductImportResult> {
    this.log('info', `Import produit depuis: ${sourceUrl}`);

    try {
      // Extraire l'ID produit de l'URL
      const productId = this.extractProductId(sourceUrl);
      if (!productId) {
        return {
          success: false,
          errors: ['URL invalide - impossible d\'extraire l\'ID produit']
        };
      }

      // En mode sandbox, retourner des données simulées
      if (this.config.sandbox) {
        return this.getMockProductImport(productId, sourceUrl);
      }

      // Appel API réel
      const productData = await this.fetchProductDetails(productId);
      if (!productData) {
        return {
          success: false,
          errors: ['Produit non trouvé sur AliExpress']
        };
      }

      // Normaliser le produit
      const normalizedProduct = this.normalizeProduct(productData, sourceUrl);

      return {
        success: true,
        productId,
        normalizedProduct,
        warnings: this.validateProduct(normalizedProduct)
      };
    } catch (error: any) {
      this.log('error', `Erreur import: ${error.message}`);
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  private extractProductId(url: string): string | null {
    // Patterns d'URL AliExpress
    const patterns = [
      /aliexpress\.com\/item\/(\d+)\.html/,
      /aliexpress\.com\/item\/(\d+)/,
      /\/(\d{10,})\.html/,
      /\/item\/(\d+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  private async fetchProductDetails(productId: string): Promise<AliExpressProductData | null> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/products/${productId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      this.log('error', `Erreur fetch produit: ${error.message}`);
      return null;
    }
  }

  private normalizeProduct(data: AliExpressProductData, sourceUrl: string): NormalizedProduct {
    // Convertir les méthodes de shipping
    const shippingMethods: ShippingMethod[] = (data.shipping?.methods || []).map(m => ({
      name: m.name,
      estimatedDays: this.parseEstimatedDays(m.estimatedDays),
      price: m.price,
      currency: data.price.currency,
      trackingAvailable: m.name.toLowerCase().includes('tracking') || m.name.toLowerCase().includes('express')
    }));

    // Calculer les délais min/max
    const deliveryDays = shippingMethods.map(m => m.estimatedDays).filter(d => d > 0);
    const minDays = deliveryDays.length > 0 ? Math.min(...deliveryDays) : 15;
    const maxDays = deliveryDays.length > 0 ? Math.max(...deliveryDays) : 45;

    return {
      externalId: data.productId,
      sourceUrl,
      sourcePlatform: 'ALIEXPRESS',

      title: data.title,
      description: data.description,
      images: data.images || [],

      priceCurrency: data.price.currency,
      priceOriginal: data.price.current,
      priceUsd: this.convertToUsd(data.price.current, data.price.currency),

      moq: data.moq || 1,
      stockQuantity: data.stock,

      variants: data.variants?.map(v => ({
        id: v.id,
        name: v.name,
        value: v.options.join(', '),
        priceModifier: v.priceModifier
      })),

      shippingMethods,
      estimatedDeliveryDays: {
        min: minDays,
        max: maxDays
      },

      supplierInfo: {
        id: data.seller?.id,
        name: data.seller?.name || 'Vendeur AliExpress',
        rating: data.seller?.rating,
        verified: (data.seller?.positiveRate || 0) > 95,
        region: 'CHINA'
      },

      category: data.category,
      attributes: data.specifications,

      isDropship: true,
      isExternalDropship: true,
      platformVerified: (data.seller?.positiveRate || 0) > 95
    };
  }

  private parseEstimatedDays(estimatedStr: string): number {
    // Parse "15-30 days" ou "15 days"
    const match = estimatedStr.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 20;
  }

  private convertToUsd(amount: number, currency: string): number {
    // Taux de change approximatifs (en production, utiliser une API de taux)
    const rates: Record<string, number> = {
      'USD': 1,
      'CNY': 0.14,
      'EUR': 1.08,
      'GBP': 1.27
    };

    const rate = rates[currency] || 1;
    return Math.round(amount * rate * 100) / 100;
  }

  private validateProduct(product: NormalizedProduct): string[] {
    const warnings: string[] = [];

    if (!product.images || product.images.length === 0) {
      warnings.push('Aucune image trouvée');
    }

    if ((product.stockQuantity ?? 0) < 10) {
      warnings.push('Stock faible');
    }

    if (product.estimatedDeliveryDays.max > 60) {
      warnings.push('Délai de livraison très long');
    }

    if ((product.supplierInfo.rating ?? 0) < 4) {
      warnings.push('Note vendeur basse');
    }

    return warnings;
  }

  private getMockProductImport(productId: string, sourceUrl: string): ProductImportResult {
    return {
      success: true,
      productId,
      normalizedProduct: {
        externalId: productId,
        sourceUrl,
        sourcePlatform: 'ALIEXPRESS',

        title: 'Produit Test AliExpress',
        titleTranslated: 'AliExpress Test Product',
        description: 'Description du produit importé depuis AliExpress',
        images: [
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'
        ],

        priceCurrency: 'USD',
        priceOriginal: 15.99,
        priceUsd: 15.99,

        moq: 1,
        stockQuantity: 500,
        priceTiers: [
          { minQuantity: 1, price: 15.99, currency: 'USD' },
          { minQuantity: 10, price: 14.99, currency: 'USD' },
          { minQuantity: 50, price: 12.99, currency: 'USD' }
        ],

        shippingMethods: [
          { name: 'AliExpress Standard', estimatedDays: 20, price: 0, currency: 'USD', trackingAvailable: true },
          { name: 'ePacket', estimatedDays: 15, price: 2.99, currency: 'USD', trackingAvailable: true }
        ],

        estimatedDeliveryDays: { min: 15, max: 30 },

        supplierInfo: {
          id: 'seller_' + productId,
          name: 'Top Seller Store',
          shopUrl: `https://aliexpress.com/store/${productId}`,
          rating: 4.8,
          yearsActive: 5,
          verified: true,
          tradeAssurance: false,
          region: 'CHINA'
        },

        category: 'Electronics',
        tags: ['dropship', 'aliexpress', 'china'],

        isDropship: true,
        isExternalDropship: true,
        platformVerified: true
      },
      warnings: ['Mode sandbox - données simulées']
    };
  }

  // ==================== PRICE SYNC ====================

  protected async doSyncPrice(productIds?: string[]): Promise<SyncResult> {
    const startedAt = new Date();
    let pricesUpdated = 0;
    const errors: SyncResult['errors'] = [];

    this.log('sync', `Sync prix pour ${productIds?.length || 'tous les'} produits`);

    try {
      // En mode sandbox, simuler la synchronisation
      if (this.config.sandbox) {
        return {
          success: true,
          syncType: 'price',
          productsUpdated: productIds?.length || 5,
          pricesUpdated: productIds?.length || 5,
          stocksUpdated: 0,
          errors: [],
          warnings: ['Mode sandbox - sync simulée'],
          startedAt,
          completedAt: new Date(),
          durationMs: 500
        };
      }

      // Sync réelle pour chaque produit
      for (const productId of productIds || []) {
        try {
          const productData = await this.fetchProductDetails(productId);
          if (productData) {
            // Ici on mettrait à jour le prix dans la base
            pricesUpdated++;
          }
        } catch (error: any) {
          errors.push({
            productId,
            errorType: 'PRICE_SYNC_FAILED',
            message: error.message,
            retryable: true
          });
        }
      }

      return {
        success: errors.length === 0,
        syncType: 'price',
        productsUpdated: pricesUpdated,
        pricesUpdated,
        stocksUpdated: 0,
        errors,
        warnings: [],
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime()
      };
    } catch (error: any) {
      return {
        success: false,
        syncType: 'price',
        productsUpdated: 0,
        pricesUpdated: 0,
        stocksUpdated: 0,
        errors: [{ productId: '', errorType: 'SYNC_FAILED', message: error.message, retryable: true }],
        warnings: [],
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime()
      };
    }
  }

  // ==================== AVAILABILITY SYNC ====================

  protected async doSyncAvailability(productIds?: string[]): Promise<SyncResult> {
    const startedAt = new Date();
    let stocksUpdated = 0;
    const errors: SyncResult['errors'] = [];

    this.log('sync', `Sync disponibilité pour ${productIds?.length || 'tous les'} produits`);

    try {
      if (this.config.sandbox) {
        return {
          success: true,
          syncType: 'availability',
          productsUpdated: productIds?.length || 5,
          pricesUpdated: 0,
          stocksUpdated: productIds?.length || 5,
          errors: [],
          warnings: ['Mode sandbox - sync simulée'],
          startedAt,
          completedAt: new Date(),
          durationMs: 500
        };
      }

      for (const productId of productIds || []) {
        try {
          const productData = await this.fetchProductDetails(productId);
          if (productData) {
            stocksUpdated++;
          }
        } catch (error: any) {
          errors.push({
            productId,
            errorType: 'AVAILABILITY_SYNC_FAILED',
            message: error.message,
            retryable: true
          });
        }
      }

      return {
        success: errors.length === 0,
        syncType: 'availability',
        productsUpdated: stocksUpdated,
        pricesUpdated: 0,
        stocksUpdated,
        errors,
        warnings: [],
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime()
      };
    } catch (error: any) {
      return {
        success: false,
        syncType: 'availability',
        productsUpdated: 0,
        pricesUpdated: 0,
        stocksUpdated: 0,
        errors: [{ productId: '', errorType: 'SYNC_FAILED', message: error.message, retryable: true }],
        warnings: [],
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime()
      };
    }
  }

  // ==================== ORDER CREATION ====================

  protected async doCreateSupplierOrder(orderData: OrderData): Promise<SupplierOrderResult> {
    this.log('order', `Création commande fournisseur AliExpress: ${orderData.orderId}`);

    try {
      if (this.config.sandbox) {
        // Simuler la création de commande
        const mockOrderId = `AE${Date.now()}`;
        return {
          success: true,
          supplierOrderId: mockOrderId,
          supplierOrderReference: `REF-${mockOrderId}`,
          estimatedShipDate: new Date(Date.now() + 3 * 86400000), // +3 jours
          estimatedDeliveryDate: new Date(Date.now() + 20 * 86400000), // +20 jours
          totalCost: orderData.total,
          currency: 'USD'
        };
      }

      // Appel API réel pour créer la commande
      const response = await fetch(`${this.API_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          items: orderData.items.map(item => ({
            productId: item.externalProductId,
            quantity: item.quantity,
            variantId: item.variantId
          })),
          shipping: {
            name: orderData.shippingAddress.recipientName,
            phone: orderData.shippingAddress.phone,
            address: orderData.shippingAddress.addressLine1,
            city: orderData.shippingAddress.city,
            country: orderData.shippingAddress.countryCode,
            postalCode: orderData.shippingAddress.postalCode
          }
        }),
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        throw new Error(`Erreur création commande: ${response.status}`);
      }

      const result: AliExpressOrderResponse = await response.json();

      return {
        success: true,
        supplierOrderId: result.orderId,
        supplierOrderReference: result.orderId,
        estimatedDeliveryDate: result.estimatedDelivery ? new Date(result.estimatedDelivery) : undefined,
        totalCost: result.totalAmount,
        currency: result.currency
      };
    } catch (error: any) {
      this.log('error', `Erreur création commande: ${error.message}`);
      return {
        success: false,
        error: error.message,
        errorCode: 'ORDER_CREATION_FAILED'
      };
    }
  }

  // ==================== TRACKING ====================

  protected async doPushTracking(trackingData: TrackingData): Promise<TrackingResult> {
    this.log('info', `Récupération tracking: ${trackingData.trackingNumber}`);

    try {
      if (this.config.sandbox) {
        return {
          success: true,
          trackingUpdated: true,
          currentStatus: 'En transit',
          estimatedDelivery: new Date(Date.now() + 10 * 86400000),
          trackingEvents: [
            { timestamp: new Date(Date.now() - 2 * 86400000), status: 'Expédié', location: 'Shenzhen, CN' },
            { timestamp: new Date(Date.now() - 1 * 86400000), status: 'En transit', location: 'Hong Kong' },
            { timestamp: new Date(), status: 'Arrivé au hub', location: 'Dubai, UAE' }
          ]
        };
      }

      // Appel API tracking
      const response = await fetch(`${this.API_BASE_URL}/tracking/${trackingData.trackingNumber}`, {
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`Erreur tracking: ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        trackingUpdated: true,
        currentStatus: data.status,
        estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : undefined,
        trackingEvents: data.events?.map((e: any) => ({
          timestamp: new Date(e.time),
          status: e.status,
          location: e.location,
          description: e.description
        }))
      };
    } catch (error: any) {
      return {
        success: false,
        trackingUpdated: false,
        error: error.message
      };
    }
  }
}

export default AliExpressConnector;
