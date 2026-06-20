/**
 * DROPSHIP SERVICES INDEX
 * Exporte tous les services du module dropshipping
 *
 * @module dropship
 * @version 1.0.0
 * @author 224Solutions
 */

// Marketplace Integration (pour les clients)
export {
  DropshipMarketplaceService,
  dropshipMarketplaceService as dropshipMarketplace
} from './DropshipMarketplaceService';

export type {
  MarketplaceProduct,
  ProductQueryOptions,
  ProductQueryResult
} from './DropshipMarketplaceService';

// Order Handler (pour le traitement des commandes)
export {
  DropshipOrderHandler,
  dropshipOrderHandler
} from './DropshipOrderHandler';

export type {
  OrderItem,
  CustomerOrder,
  DropshipOrderItem,
  ProcessOrderResult
} from './DropshipOrderHandler';
