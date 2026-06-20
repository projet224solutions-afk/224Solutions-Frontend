/**
 * DROPSHIPPING CONNECTORS MODULE - INDEX
 * Exporte tous les composants du module dropshipping
 *
 * @module dropshipping/connectors
 * @version 1.0.0
 * @author 224Solutions
 */

// Main Dashboard
export { DropshippingDashboard } from './DropshippingDashboard';
export { default as DropshippingDashboardDefault } from './DropshippingDashboard';

// Connector Management
export { ConnectorManager } from './ConnectorManager';
export { default as ConnectorManagerDefault } from './ConnectorManager';

// Product Import
export { ProductImportDialog } from './ProductImportDialog';
export { default as ProductImportDialogDefault } from './ProductImportDialog';

// Products Table
export { DropshipProductsTable } from './DropshipProductsTable';
export { default as DropshipProductsTableDefault } from './DropshipProductsTable';
export type { DropshipProduct } from './DropshipProductsTable';

// Supplier Orders
export { SupplierOrderPanel } from './SupplierOrderPanel';
export { default as SupplierOrderPanelDefault } from './SupplierOrderPanel';
export type { SupplierOrder } from './SupplierOrderPanel';
