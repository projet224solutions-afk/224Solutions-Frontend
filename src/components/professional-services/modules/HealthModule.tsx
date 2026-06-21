/**
 * MODULE SANTÉ / PHARMACIE — Interface professionnelle
 * Inspiré CVS Health, Boots, Walgreens, McKesson
 *
 * Architecture: Composable panels sous-componentisés
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Pill, XCircle, RefreshCw, Plus, Activity,
  ShoppingCart, Package, Users, ClipboardList,
  Settings, Stethoscope, CreditCard
} from 'lucide-react';
import { useServiceHealthStats } from '@/hooks/useServiceHealthStats';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
// Caisse hors ligne : on réutilise DIRECTEMENT le POS vendeur (déjà 100% offline/atomique).
// La pharmacie est un vendeur (products/orders par vendor_id) → POSSystem résout le bon
// vendor_id du pharmacien connecté via useCurrentVendor, sans aucun prop ni duplication.
import POSSystemWrapper from '@/components/vendor/POSSystemWrapper';
import { PharmacyQuickActions } from './pharmacy/PharmacyQuickActions';
import { PharmacyKPICards } from './pharmacy/PharmacyKPICards';
import { PharmacyOverviewPanel } from './pharmacy/PharmacyOverviewPanel';
import { PharmacySalesPanel } from './pharmacy/PharmacySalesPanel';
import { PharmacyInventoryPanel } from './pharmacy/PharmacyInventoryPanel';

interface HealthModuleProps {
  serviceId: string;
  businessName?: string;
}

export function HealthModule({ serviceId, businessName }: HealthModuleProps) {
  const { t } = useTranslation();
  const { stats, recentSales, loading, error, refresh } = useServiceHealthStats(serviceId);
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-9 w-9 rounded-lg mb-3" />
                <Skeleton className="h-6 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48 lg:col-span-2" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive font-medium">{error}</p>
          <Button onClick={refresh} className="mt-4 gap-2">
            <RefreshCw className="w-4 h-4" />
            {t('healthModule.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Empty state — onboarding
  if (!stats?.hasData) {
    return (
      <div className="space-y-6">
        <PharmacyHeader businessName={businessName} onRefresh={refresh} />

        <Card className="overflow-hidden">
          <div className="bg-[#ff4000] p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                <Pill className="w-7 h-7 text-white" />
              </div>
              <div className="text-white">
                <h3 className="text-xl font-bold mb-1">{t('healthModule.welcomeTitle')}</h3>
                <p className="text-white/80 text-sm max-w-md">
                  {t('healthModule.welcomeDesc')}
                </p>
              </div>
            </div>
          </div>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => navigate('/vendeur/products')}
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-[#ff4000]/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5 text-[#ff4000]" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">{t('healthModule.addProducts')}</p>
                  <p className="text-xs text-muted-foreground">{t('healthModule.addProductsDesc')}</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/vendeur/orders')}
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">{t('healthModule.manageOrders')}</p>
                  <p className="text-xs text-muted-foreground">{t('healthModule.manageOrdersDesc')}</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/vendeur/settings')}
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-[#04439e]/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Settings className="w-5 h-5 text-[#04439e]" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">{t('healthModule.configure')}</p>
                  <p className="text-xs text-muted-foreground">{t('healthModule.configureDesc')}</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <PharmacyHeader businessName={businessName} onRefresh={refresh} />

      {/* Quick Actions */}
      <PharmacyQuickActions onTabChange={setActiveTab} />

      {/* KPI Cards */}
      <PharmacyKPICards stats={stats} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap bg-muted/50 h-auto p-1">
          <TabsTrigger value="overview" className="gap-1.5 text-xs md:text-sm whitespace-nowrap">
            <Activity className="w-4 h-4" />
            {t('healthModule.tabOverview')}
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-1.5 text-xs md:text-sm whitespace-nowrap">
            <Package className="w-4 h-4" />
            {t('healthModule.tabInventory')}
          </TabsTrigger>
          <TabsTrigger value="pos" className="gap-1.5 text-xs md:text-sm whitespace-nowrap">
            <CreditCard className="w-4 h-4" />
            {t('healthModule.tabPos')}
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5 text-xs md:text-sm whitespace-nowrap">
            <ShoppingCart className="w-4 h-4" />
            {t('healthModule.tabSales')}
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-1.5 text-xs md:text-sm whitespace-nowrap">
            <Users className="w-4 h-4" />
            {t('healthModule.tabPatients')}
          </TabsTrigger>
          <TabsTrigger value="prescriptions" className="gap-1.5 text-xs md:text-sm whitespace-nowrap">
            <ClipboardList className="w-4 h-4" />
            {t('healthModule.tabPrescriptions')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <PharmacyOverviewPanel stats={stats} recentSales={recentSales} />
        </TabsContent>

        <TabsContent value="inventory" className="mt-4">
          <PharmacyInventoryPanel stats={stats} />
        </TabsContent>

        {/* CAISSE PHARMACIE — POS vendeur réutilisé tel quel (offline natif : encaisse sans
            internet, ventes stockées puis synchronisées vers pos_sales à la reconnexion). */}
        <TabsContent value="pos" className="mt-4">
          <div className="rounded-xl border bg-orange-50/50 dark:bg-[#ff4000]/10 border-orange-200 dark:border-[#ff4000]/40 p-3 mb-4 flex items-center gap-2 text-sm">
            <Pill className="w-4 h-4 text-[#ff4000] flex-shrink-0" />
            <span className="text-muted-foreground">
              {t('healthModule.posInfo')}
            </span>
          </div>
          <POSSystemWrapper />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <PharmacySalesPanel stats={stats} recentSales={recentSales} />
        </TabsContent>

        <TabsContent value="clients" className="mt-4">
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="font-semibold text-lg mb-1">{t('healthModule.patientsTitle')}</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
                {t('healthModule.patientsDesc')}
              </p>
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <Users className="w-4 h-4" />
                <span>{stats.clients.total} {t('healthModule.patientsRegistered')}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prescriptions" className="mt-4">
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="font-semibold text-lg mb-1">{t('healthModule.prescriptionsTitle')}</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
                {t('healthModule.prescriptionsDesc')}
              </p>
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                <ClipboardList className="w-4 h-4" />
                <span>{stats.prescriptions.total} {t('healthModule.prescriptionsWord')} • {stats.prescriptions.pending} {t('healthModule.pendingWord')}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Header réutilisable */
function PharmacyHeader({ businessName, onRefresh }: { businessName?: string; onRefresh: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-[#ff4000]/30 flex items-center justify-center">
          <Stethoscope className="w-5 h-5 text-[#ff4000] dark:text-[#ff4000]" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-bold leading-tight">{businessName || t('healthModule.myPharmacy')}</h2>
          <p className="text-xs md:text-sm text-muted-foreground">{t('healthModule.integratedMgmt')}</p>
        </div>
      </div>
      <Button onClick={onRefresh} variant="outline" size="sm" className="gap-1.5">
        <RefreshCw className="w-3.5 h-3.5" />
        <span className="hidden md:inline">{t('healthModule.refresh')}</span>
      </Button>
    </div>
  );
}

export default HealthModule;
