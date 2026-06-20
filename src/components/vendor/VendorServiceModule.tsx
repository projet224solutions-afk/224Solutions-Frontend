/**
 * VendorServiceModule - Module métier du vendeur
 * Affiche TOUJOURS la vue boutique (statistiques, commandes, produits)
 * même pour les nouveaux vendeurs sans service professionnel configuré
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Plus, Clock, XCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import { useVendorServices } from '@/hooks/useVendorServices';
import { ServiceModuleManager } from '@/components/professional-services/modules/ServiceModuleManager';
import { AddServiceModal } from '@/components/vendor/business-module/AddServiceModal';
import { ServiceSelector } from '@/components/vendor/business-module/ServiceSelector';
import { VendorShopDashboard } from '@/components/vendor/VendorShopDashboard';

export default function VendorServiceModule() {
  const { t } = useTranslation();
  const { vendorId, profile, loading: vendorLoading } = useCurrentVendor();
  const {
    services,
    selectedService,
    selectedServiceId,
    selectService,
    hasMultipleServices,
    loading: servicesLoading,
    error,
    refresh
  } = useVendorServices();

  const [showAddService, setShowAddService] = useState(false);

  const loading = vendorLoading || servicesLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-28" />
        </div>

        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-3" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Erreur de chargement
          </CardTitle>
          <CardDescription>
            Impossible de charger vos services professionnels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Déterminer le nom de la boutique
  const businessName = selectedService?.business_name
    || profile?.business_name
    || profile?.first_name
    || 'Ma Boutique';

  return (
    <div className="space-y-6">
      {/* 🆕 Service Selector (seulement si des services existent) */}
      {services.length > 0 && (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b">
          <div>
            <h2 className="text-lg font-semibold mb-1">{t('vendorServiceModule.mesServicesProfessionnels')}</h2>
            <p className="text-sm text-muted-foreground">
              {services.length > 1
                ? 'Sélectionnez le service à gérer'
                : `Service actif: ${selectedService?.service_type?.name || 'Non défini'}`}
            </p>
          </div>
          <ServiceSelector
            services={services}
            selectedServiceId={selectedServiceId}
            onSelectService={selectService}
            onCreateNew={() => setShowAddService(true)}
          />
        </div>
      )}

      {/* Status Alerts pour le service sélectionné */}
      {selectedService?.status === 'pending' && (
        <Alert variant="default" className="bg-orange-50 border-orange-200 dark:bg-[#ff4000]/20">
          <Clock className="w-4 h-4 text-[#ff4000]" />
          <AlertTitle className="text-[#ff4000] dark:text-orange-100">{t('vendorServiceModule.serviceEnCoursDeValidation')}</AlertTitle>
          <AlertDescription className="text-[#ff4000] dark:text-orange-200">
            Votre service "{selectedService.business_name}" est en attente de validation.
          </AlertDescription>
        </Alert>
      )}

      {selectedService?.verification_status === 'rejected' && (
        <Alert variant="destructive">
          <XCircle className="w-4 h-4" />
          <AlertTitle>{t('vendorServiceModule.serviceRejete')}</AlertTitle>
          <AlertDescription>{t('vendorServiceModule.contactezLeSupportPourPlus')}</AlertDescription>
        </Alert>
      )}

      {/*
        ⚡ CHANGEMENT MAJEUR: Afficher TOUJOURS la vue boutique
        - Si un service professionnel est sélectionné: utiliser ServiceModuleManager
        - Sinon: utiliser VendorShopDashboard par défaut (vue boutique de base)
      */}
      {selectedService ? (
        <ServiceModuleManager
          serviceId={selectedService.id}
          serviceTypeId={selectedService.service_type_id}
          serviceTypeName={selectedService.service_type?.name || 'Service'}
          serviceTypeCode={selectedService.service_type?.code}
          businessName={selectedService.business_name || businessName}
        />
      ) : (
        // 🆕 Vue boutique par défaut pour les vendeurs sans service professionnel
        <VendorShopDashboard
          vendorId={vendorId}
          businessName={businessName}
          onCreateService={() => setShowAddService(true)}
        />
      )}

      <AddServiceModal
        open={showAddService}
        onOpenChange={setShowAddService}
      />
    </div>
  );
}
