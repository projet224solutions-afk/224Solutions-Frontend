/**
 * VENDOR ROUTES COMPONENT
 * Routes optimisées avec chunking intelligent par catégorie
 * 224Solutions - Performance & Code Splitting
 *
 * Chunking Strategy:
 * - Core: Dashboard, Products, Orders (chargés en priorité)
 * - Finance: Wallet, Payments, Invoices (lazy)
 * - CRM: Clients, Agents, Marketing (lazy)
 * - Advanced: Reports, Analytics, Warehouse (lazy)
 * - System: Settings, Support, Sync (lazy)
 */

import { memo, Suspense, lazy } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SectionLoader } from '@/components/ui/GlobalLoader';
import { useTranslation } from '@/hooks/useTranslation';
import type { RecentOrder } from '@/types/vendor-dashboard';

// ============================================================================
// Lazy Imports - Groupés par catégorie pour un meilleur chunking
// ============================================================================

// === CORE (Priorité haute) ===
const VendorDashboardHome = lazy(() => import('./VendorDashboardHome'));
const ProductManagement = lazy(() => import('@/components/vendor/ProductManagement'));
const OrderManagement = lazy(() => import('@/components/vendor/OrderManagement'));
const VendorReturnsManager = lazy(() => import('@/components/vendor/returns/VendorReturnsManager'));

// === FINANCE ===
const UniversalWalletTransactions = lazy(() => import('@/components/wallet/UniversalWalletTransactions'));
const ProfessionalVirtualCard = lazy(() => import('@/components/virtual-card').then(m => ({ default: m.ProfessionalVirtualCard })));
const VendorQuotesInvoices = lazy(() => import('@/pg/VendorQuotesInvoices'));
const PaymentManagement = lazy(() => import('@/components/vendor/PaymentManagement'));
const VendorEscrowPage = lazy(() => import('@/components/vendor/VendorEscrowPage'));
const PaymentLinksManager = lazy(() => import('@/components/vendor/PaymentLinksManager'));
const ExpenseManagementDashboard = lazy(() => import('@/components/vendor/ExpenseManagementDashboard'));
const VendorDebtManagement = lazy(() => import('@/components/vendor/debts/VendorDebtManagement').then(m => ({ default: m.VendorDebtManagement })));
const VendorContracts = lazy(() => import('@/pg/VendorContracts'));
const AffiliateManagement = lazy(() => import('@/components/vendor/AffiliateManagement'));
const CollectionAccountsManager = lazy(() => import('@/components/vendor/accounts/CollectionAccountsManager'));
const InstallmentPlansManager = lazy(() => import('@/components/vendor/payments/InstallmentPlansManager'));

// === CRM & MARKETING ===
const ClientManagement = lazy(() => import('@/components/vendor/ClientManagement'));
const AgentManagement = lazy(() => import('@/components/vendor/AgentManagement'));
const ProspectManagement = lazy(() => import('@/components/vendor/ProspectManagement'));
const MarketingManagement = lazy(() => import('@/components/vendor/MarketingManagement'));
const VendorCampaignCenter = lazy(() => import('@/components/vendor/VendorCampaignCenter'));

// === INVENTORY & PRODUCTS ===
const InventoryManagement = lazy(() => import('@/components/vendor/InventoryManagement'));
const MultiWarehouseManagement = lazy(() => import('@/components/vendor/MultiWarehouseManagement'));
const SupplierManagement = lazy(() => import('@/components/vendor/SupplierManagement'));
const VendorDigitalProducts = lazy(() => import('@/components/vendor/VendorDigitalProducts'));
const StockAdjustmentForm = lazy(() => import('@/components/vendor/stock/StockAdjustmentForm'));

// === SERVICES ===
const VendorServiceModule = lazy(() => import('@/components/vendor/VendorServiceModule'));
const POSSystemWrapper = lazy(() => import('@/components/vendor/POSSystemWrapper'));
const VendorDeliveriesPanel = lazy(() => import('@/components/vendor/VendorDeliveriesPanel').then(m => ({ default: m.VendorDeliveriesPanel })));
const VendorRatingsPanel = lazy(() => import('@/components/vendor/VendorRatingsPanel'));
const MyPurchasesOrdersList = lazy(() => import('@/components/shared/MyPurchasesOrdersList'));
const AdvancedSalesManager = lazy(() => import('@/components/vendor/sales/AdvancedSalesManager'));

// === COMMUNICATION ===
const SupportTickets = lazy(() => import('@/components/vendor/SupportTickets'));
const UniversalCommunicationHub = lazy(() => import('@/components/communication/UniversalCommunicationHub'));
const ReviewsManagement = lazy(() => import('@/components/vendor/ReviewsManagement'));

// === ANALYTICS & REPORTS ===
const VendorAnalyticsDashboard = lazy(() => import('@/components/vendor/VendorAnalyticsDashboard').then(m => ({ default: m.VendorAnalyticsDashboard })));
const VendorReportsManager = lazy(() => import('@/components/vendor/reports/VendorReportsManager'));

// === SYSTEM ===
const VendorSettings = lazy(() => import('@/pg/vendor/Settings'));
// Copilot 224 unifié (mode intégré) — remplace l'ancien CopiloteChat.
const Copilot224 = lazy(() => import('@/components/service-common/Copilot224'));
const OfflineSyncPanel = lazy(() => import('@/components/vendor/OfflineSyncPanel'));
const PWADiagnostic = lazy(() => import('@/components/pwa/PWADiagnostic'));

// === PROTECTION ===
const ProtectedRoute = lazy(() => import('@/components/subscription/ProtectedRoute').then(m => ({ default: m.ProtectedRoute })));

// ============================================================================
// Types
// ============================================================================

interface VendorRoutesProps {
  recentOrders: RecentOrder[];
  showAllOrders: boolean;
  onToggleShowAllOrders: () => void;
  canAccessPOS: boolean;
  vendorId: string;
}

// ============================================================================
// Composants de fallback
// ============================================================================

/**
 * Page POS verrouillée pour les vendeurs digitaux
 */
const POSLockedPage = memo(function POSLockedPage() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('vendorRoutes.posVerrouille')}</CardTitle>
        <CardDescription>
          Votre boutique est configurée en "En ligne uniquement". Le POS est désactivé.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button variant="outline" onClick={() => navigate('/vendeur/settings')}>
          Paramètres
        </Button>
        <Button onClick={() => navigate('/vendeur/dashboard')}>
          Retour
        </Button>
      </CardContent>
    </Card>
  );
});

/**
 * Wrapper pour la carte virtuelle
 */
const VirtualCardPage = memo(function VirtualCardPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Carte Virtuelle 224PAY</CardTitle>
        <CardDescription>
          Gérez votre carte virtuelle pour les paiements en ligne
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProfessionalVirtualCard />
      </CardContent>
    </Card>
  );
});

/**
 * Wrapper pour le copilote IA
 */
const CopilotePage = memo(function CopilotePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('vendorRoutes.copiloteIaVendeur')}</CardTitle>
        <CardDescription>
          Votre assistant intelligent pour gérer votre boutique
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Copilot224 variant="embedded" service="ecommerce" title="Copilot 224" height="500px" />
      </CardContent>
    </Card>
  );
});

// ============================================================================
// Composant principal
// ============================================================================

const VendorRoutes = memo(function VendorRoutes({
  recentOrders,
  showAllOrders,
  onToggleShowAllOrders,
  canAccessPOS,
  vendorId,
}: VendorRoutesProps) {
  const { t } = useTranslation();
  return (
    <Suspense fallback={<SectionLoader text={t('vendorRoutes.loading')} />}>
      <Routes>
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CORE ROUTES - Toujours accessibles */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        <Route
          index
          element={
            <VendorDashboardHome
              recentOrders={recentOrders}
              showAllOrders={showAllOrders}
              onToggleShowAllOrders={onToggleShowAllOrders}
              canAccessPOS={canAccessPOS}
            />
          }
        />
        <Route
          path="dashboard"
          element={
            <VendorDashboardHome
              recentOrders={recentOrders}
              showAllOrders={showAllOrders}
              onToggleShowAllOrders={onToggleShowAllOrders}
              canAccessPOS={canAccessPOS}
            />
          }
        />

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SALES & COMMERCE */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        <Route path="analytics" element={
          <ProtectedRoute feature="analytics_basic">
            <VendorAnalyticsDashboard />
          </ProtectedRoute>
        } />

        <Route path="pos" element={
          canAccessPOS ? (
            <ProtectedRoute feature="pos_system">
              <POSSystemWrapper />
            </ProtectedRoute>
          ) : (
            <POSLockedPage />
          )
        } />

        <Route path="service-module" element={<VendorServiceModule />} />

        <Route path="products" element={
          <ProtectedRoute feature="products_basic">
            <ProductManagement />
          </ProtectedRoute>
        } />

        <Route path="digital-products" element={<VendorDigitalProducts />} />

        <Route path="orders" element={
          <ProtectedRoute feature="orders_simple">
            <OrderManagement />
          </ProtectedRoute>
        } />

        <Route path="inventory" element={
          <ProtectedRoute feature="inventory_management">
            <InventoryManagement />
          </ProtectedRoute>
        } />

        <Route path="warehouse" element={
          <ProtectedRoute feature="multi_warehouse">
            <MultiWarehouseManagement />
          </ProtectedRoute>
        } />

        <Route path="suppliers" element={
          <ProtectedRoute feature="supplier_management">
            <SupplierManagement />
          </ProtectedRoute>
        } />

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CRM & MARKETING */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        <Route path="clients" element={
          <ProtectedRoute feature="crm_basic">
            <ClientManagement />
          </ProtectedRoute>
        } />


        <Route path="agents" element={
          <ProtectedRoute feature="sales_agents">
            <AgentManagement />
          </ProtectedRoute>
        } />

        <Route path="prospects" element={
          <ProtectedRoute feature="prospect_management">
            <ProspectManagement />
          </ProtectedRoute>
        } />

        <Route path="marketing" element={
          <ProtectedRoute feature="marketing_promotions">
            <MarketingManagement />
          </ProtectedRoute>
        } />

        <Route path="campaigns" element={
          <ProtectedRoute feature="marketing_promotions">
            <VendorCampaignCenter />
          </ProtectedRoute>
        } />

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* FINANCE */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        <Route path="wallet" element={
          <ProtectedRoute feature="wallet_basic">
            <UniversalWalletTransactions />
          </ProtectedRoute>
        } />

        <Route path="virtual-card" element={
          <ProtectedRoute feature="wallet_basic">
            <VirtualCardPage />
          </ProtectedRoute>
        } />

        <Route path="quotes-invoices" element={
          <ProtectedRoute feature="quotes_invoices">
            <VendorQuotesInvoices />
          </ProtectedRoute>
        } />

        <Route path="payments" element={
          <ProtectedRoute feature="payments">
            <PaymentManagement />
          </ProtectedRoute>
        } />

        <Route path="escrow" element={<VendorEscrowPage />} />

        <Route path="returns" element={<VendorReturnsManager />} />

        <Route path="payment-links" element={
          <ProtectedRoute feature="payment_links">
            <PaymentLinksManager />
          </ProtectedRoute>
        } />

        <Route path="expenses" element={
          <ProtectedRoute feature="expenses">
            <ExpenseManagementDashboard />
          </ProtectedRoute>
        } />

        <Route path="debts" element={
          <ProtectedRoute feature="debt_management">
            <VendorDebtManagement vendorId={vendorId} />
          </ProtectedRoute>
        } />

        <Route path="contracts" element={
          <ProtectedRoute feature="contracts">
            <VendorContracts />
          </ProtectedRoute>
        } />

        <Route path="affiliate" element={
          <ProtectedRoute feature="affiliate_program">
            <AffiliateManagement shopId={vendorId || undefined} />
          </ProtectedRoute>
        } />

        <Route path="accounts" element={<CollectionAccountsManager />} />
        <Route path="installments" element={<InstallmentPlansManager />} />

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SERVICES */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        <Route path="my-purchases" element={
          <MyPurchasesOrdersList
            title="Mes Achats Personnels"
            emptyMessage="Vous n'avez pas encore effectué d'achats sur le marketplace"
          />
        } />

        <Route path="delivery" element={
          <ProtectedRoute feature="delivery_tracking">
            <VendorDeliveriesPanel />
          </ProtectedRoute>
        } />

        <Route path="ratings" element={
          <ProtectedRoute feature="ratings">
            <VendorRatingsPanel />
          </ProtectedRoute>
        } />

        <Route path="support" element={
          <ProtectedRoute feature="support_basic">
            <SupportTickets />
          </ProtectedRoute>
        } />

        <Route path="communication" element={
          <ProtectedRoute feature="communication_hub">
            <UniversalCommunicationHub />
          </ProtectedRoute>
        } />

        <Route path="reviews" element={
          <ProtectedRoute feature="copilot_ai">
            <ReviewsManagement />
          </ProtectedRoute>
        } />

        <Route path="stock-adjustments" element={<StockAdjustmentForm />} />
        <Route path="advanced-sales" element={<AdvancedSalesManager />} />

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* REPORTS & ANALYTICS */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        <Route path="reports" element={
          <ProtectedRoute feature="data_export">
            <VendorReportsManager />
          </ProtectedRoute>
        } />

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SYSTEM */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        <Route path="copilote" element={
          <ProtectedRoute feature="copilot_ai">
            <CopilotePage />
          </ProtectedRoute>
        } />

        <Route path="settings" element={<VendorSettings />} />

        <Route path="offline-sync" element={
          <ProtectedRoute feature="offline_mode">
            <OfflineSyncPanel />
          </ProtectedRoute>
        } />

        <Route path="pwa-diagnostic" element={<PWADiagnostic />} />
      </Routes>
    </Suspense>
  );
});

export { VendorRoutes };
export default VendorRoutes;
