/**
 * ROUTES VENDEUR DIGITAL
 * Uniquement les routes pertinentes pour les produits numériques et affiliations
 */

import { memo, Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { SectionLoader } from '@/components/ui/GlobalLoader';

// Core
const DigitalVendorDashboardHome = lazy(() => import('./DigitalVendorDashboardHome'));
const DigitalVendorCopilot = lazy(() => import('./DigitalVendorCopilot'));
const ProtectedRoute = lazy(() => import('@/components/subscription/ProtectedRoute').then(m => ({ default: m.ProtectedRoute })));

// Produits numériques
const VendorDigitalProducts = lazy(() => import('@/components/vendor/VendorDigitalProducts'));
const DigitalProducts = lazy(() => import('@/pg/DigitalProducts'));

// Affiliation
const AffiliateManagement = lazy(() => import('@/components/vendor/AffiliateManagement'));

// Liens de paiement
const PaymentLinksManager = lazy(() => import('@/components/vendor/PaymentLinksManager'));
const VendorCampaignCenter = lazy(() => import('@/components/vendor/VendorCampaignCenter'));

// Finance
const UniversalWalletTransactions = lazy(() => import('@/components/wallet/UniversalWalletTransactions'));

// Mes Achats
const MyPurchasesOrdersList = lazy(() => import('@/components/shared/MyPurchasesOrdersList'));

// Système
const VendorSettings = lazy(() => import('@/pg/vendor/Settings'));
const VendorSubscriptionPage = lazy(() => import('@/pg/VendorSubscriptionPage'));

// Analytics
const VendorAnalyticsDashboard = lazy(() => import('@/components/vendor/VendorAnalyticsDashboard').then(m => ({ default: m.VendorAnalyticsDashboard })));

interface DigitalVendorRoutesProps {
  vendorId: string;
}

const DigitalVendorRoutes = memo(function DigitalVendorRoutes({ vendorId }: DigitalVendorRoutesProps) {
  return (
    <Suspense fallback={<SectionLoader text="Chargement..." />}>
      <Routes>
        {/* Dashboard */}
        <Route index element={<DigitalVendorDashboardHome />} />
        <Route path="dashboard" element={<DigitalVendorDashboardHome />} />
        <Route path="copilot" element={<DigitalVendorCopilot />} />

        {/* Produits numériques */}
        <Route path="products" element={<VendorDigitalProducts />} />
        <Route path="add-product" element={<DigitalProducts />} />

        {/* Marketplace (vue publique) */}
        <Route path="marketplace" element={<DigitalProducts />} />

        {/* Affiliation */}
        <Route path="affiliate" element={<AffiliateManagement shopId={vendorId || undefined} />} />

        {/* Statistiques */}
        <Route path="analytics" element={<VendorAnalyticsDashboard />} />

        {/* Campagnes */}
        <Route path="campaigns" element={
          <ProtectedRoute feature="marketing_promotions">
            <VendorCampaignCenter />
          </ProtectedRoute>
        } />

        {/* Liens de paiement */}
        <Route path="payment-links" element={<PaymentLinksManager />} />

        {/* Finance */}
        <Route path="wallet" element={<UniversalWalletTransactions />} />
        <Route path="subscription" element={<VendorSubscriptionPage />} />
        <Route path="liens-de-paiement" element={<PaymentLinksManager />} />

        {/* Mes Achats */}
        <Route path="my-purchases" element={<MyPurchasesOrdersList title="Mes Achats Personnels" emptyMessage="Vous n'avez pas encore effectué d'achats sur le marketplace" />} />

        {/* Paramètres */}
        <Route path="settings" element={<VendorSettings />} />
      </Routes>
    </Suspense>
  );
});

export { DigitalVendorRoutes };
export default DigitalVendorRoutes;
