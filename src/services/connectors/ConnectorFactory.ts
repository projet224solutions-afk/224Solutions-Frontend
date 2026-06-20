/**
 * CONNECTOR FACTORY & REGISTRY
 * Factory Pattern pour créer et gérer les connecteurs
 *
 * @module ConnectorFactory
 * @version 1.0.0
 * @author 224Solutions
 */

import type {
  ConnectorType,
  ConnectorConfig,
  ConnectorFactory as IConnectorFactory,
  ConnectorInfo,
  IExternalConnector
} from './types';

import { AliExpressConnector } from './AliExpressConnector';
import { AlibabaConnector } from './AlibabaConnector';
import { Connector1688 } from './Connector1688';
import { PrivateSupplierConnector, type PrivateSupplierConfig } from './PrivateSupplierConnector';

// ==================== CONNECTOR REGISTRY ====================

const CONNECTOR_REGISTRY: Record<ConnectorType, ConnectorInfo> = {
  'ALIEXPRESS': {
    type: 'ALIEXPRESS',
    name: 'AliExpress',
    description: 'Plateforme B2C chinoise - Petites commandes, livraison directe client',
    logo: '🛒',
    region: 'CHINA',
    features: [
      'Import produit par URL',
      'Synchronisation prix automatique',
      'Synchronisation stock',
      'Création commande automatique',
      'Tracking livraison',
      'Prix compétitifs',
      'Pas de MOQ'
    ],
    requiresApiKey: false, // Peut fonctionner en mode scraping/sandbox
    setupGuideUrl: 'https://portals.aliexpress.com/help',
    status: 'stable'
  },
  'ALIBABA': {
    type: 'ALIBABA',
    name: 'Alibaba',
    description: 'Plateforme B2B - Commandes en gros, prix dégressifs, MOQ',
    logo: '🏭',
    region: 'CHINA',
    features: [
      'Import produit par URL',
      'Prix dégressifs par quantité',
      'Trade Assurance',
      'Gold Supplier vérifié',
      'Négociation possible',
      'Incoterms (FOB, CIF, etc.)'
    ],
    requiresApiKey: true,
    setupGuideUrl: 'https://open.alibaba.com',
    status: 'stable'
  },
  '1688': {
    type: '1688',
    name: '1688.com',
    description: 'Alibaba domestique Chine - Prix usine, petits MOQ',
    logo: '🇨🇳',
    region: 'CHINA',
    features: [
      'Prix usine direct',
      'MOQ plus bas qu\'Alibaba',
      'Large choix de produits',
      'Interface en chinois',
      'Agent recommandé'
    ],
    requiresApiKey: true,
    setupGuideUrl: 'https://open.1688.com',
    status: 'beta'
  },
  'PRIVATE': {
    type: 'PRIVATE',
    name: 'Fournisseur Privé',
    description: 'Connecteur pour fournisseurs directs (non-plateforme)',
    logo: '🤝',
    region: 'GLOBAL',
    features: [
      'Import manuel',
      'Gestion personnalisée',
      'Communication directe',
      'Pas de frais plateforme',
      'Flexibilité totale'
    ],
    requiresApiKey: false,
    status: 'stable'
  },
  'CUSTOM': {
    type: 'CUSTOM',
    name: 'Connecteur Personnalisé',
    description: 'Créez votre propre connecteur',
    logo: '🔧',
    region: 'GLOBAL',
    features: [
      'API personnalisée',
      'Intégration sur mesure'
    ],
    requiresApiKey: true,
    status: 'beta'
  }
};

// ==================== CONNECTOR FACTORY ====================

class ConnectorFactoryImpl implements IConnectorFactory {
  private instances: Map<string, IExternalConnector> = new Map();

  /**
   * Créer une nouvelle instance de connecteur
   */
  create(type: ConnectorType, config: Partial<ConnectorConfig> = {}): IExternalConnector {
    switch (type) {
      case 'ALIEXPRESS':
        return new AliExpressConnector(config);

      case 'ALIBABA':
        return new AlibabaConnector(config);

      case '1688':
        return new Connector1688(config);

      case 'PRIVATE':
        return new PrivateSupplierConnector(config);

      case 'CUSTOM':
        throw new Error('Custom connector requires manual implementation');

      default:
        throw new Error(`Connecteur non supporté: ${type}`);
    }
  }

  /**
   * Créer un connecteur fournisseur privé avec configuration
   */
  createPrivateSupplier(
    config: Partial<ConnectorConfig>,
    supplierConfig: PrivateSupplierConfig
  ): PrivateSupplierConnector {
    return new PrivateSupplierConnector(config, supplierConfig);
  }

  /**
   * Obtenir ou créer une instance singleton pour un type donné
   */
  getInstance(type: ConnectorType, config: Partial<ConnectorConfig> = {}): IExternalConnector {
    const key = `${type}_${config.apiKey || 'default'}`;

    if (!this.instances.has(key)) {
      this.instances.set(key, this.create(type, config));
    }

    return this.instances.get(key)!;
  }

  /**
   * Obtenir la liste des connecteurs disponibles
   */
  getAvailableConnectors(): ConnectorInfo[] {
    return Object.values(CONNECTOR_REGISTRY);
  }

  /**
   * Obtenir les infos d'un connecteur spécifique
   */
  getConnectorInfo(type: ConnectorType): ConnectorInfo | undefined {
    return CONNECTOR_REGISTRY[type];
  }

  /**
   * Vérifier si un type de connecteur est supporté
   */
  isSupported(type: ConnectorType): boolean {
    return type in CONNECTOR_REGISTRY;
  }

  /**
   * Obtenir les connecteurs par région
   */
  getConnectorsByRegion(region: 'CHINA' | 'LOCAL' | 'INTERNATIONAL' | 'GLOBAL'): ConnectorInfo[] {
    return Object.values(CONNECTOR_REGISTRY).filter(c => c.region === region || c.region === 'GLOBAL');
  }

  /**
   * Obtenir les connecteurs stables
   */
  getStableConnectors(): ConnectorInfo[] {
    return Object.values(CONNECTOR_REGISTRY).filter(c => c.status === 'stable');
  }

  /**
   * Supprimer une instance
   */
  removeInstance(type: ConnectorType, apiKey?: string): void {
    const key = `${type}_${apiKey || 'default'}`;
    const instance = this.instances.get(key);

    if (instance) {
      instance.disconnect();
      this.instances.delete(key);
    }
  }

  /**
   * Supprimer toutes les instances
   */
  async clearAll(): Promise<void> {
    for (const instance of this.instances.values()) {
      await instance.disconnect();
    }
    this.instances.clear();
  }
}

// Export singleton
export const ConnectorFactory = new ConnectorFactoryImpl();

// Export pour extension
export { CONNECTOR_REGISTRY };
export type { IConnectorFactory };
