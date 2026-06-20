/**
 * CONNECTORS MODULE - Exports
 * Module de connecteurs dropshipping
 *
 * @module connectors
 * @version 1.0.0
 * @author 224Solutions
 */

// Types
export * from './types';

// Base Connector
export { BaseConnector } from './BaseConnector';

// Connecteurs spécifiques
export { AliExpressConnector } from './AliExpressConnector';
export { AlibabaConnector } from './AlibabaConnector';
export { Connector1688 } from './Connector1688';
export { PrivateSupplierConnector } from './PrivateSupplierConnector';
export type { PrivateSupplierConfig, ManualProductData } from './PrivateSupplierConnector';

// Factory
export { ConnectorFactory, CONNECTOR_REGISTRY } from './ConnectorFactory';

// Service principal
export { dropshippingConnectorService, default as DropshippingConnectorService } from './DropshippingConnectorService';
