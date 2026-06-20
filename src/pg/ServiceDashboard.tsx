import { useEffect, useState, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from "@/hooks/useTranslation";
import { Store, Settings, DollarSign, TrendingUp, Users, ShoppingBag, Key, Wallet, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Money } from '@/components/Money';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserTrackerButton } from '@/components/taxi-moto/UserTrackerButton';
import { Badge } from '@/components/ui/badge';
import { useProfessionalServices } from '@/hooks/useProfessionalServices';
import type { ProfessionalService } from '@/hooks/useProfessionalServices';
import { ServiceModuleManager } from '@/components/professional-services/modules/ServiceModuleManager';
import { BookingManagement } from '@/components/professional-services/modules/BookingManagement';
import { ServiceSettingsPanel } from '@/components/professional-services/ServiceSettingsPanel';
import { ServiceSubscriptionCard } from '@/components/professional-services/ServiceSubscriptionCard';
import { ServiceIdBadge } from '@/components/professional-services/ServiceIdBadge';
import CommunicationWidget from '@/components/communication/CommunicationWidget';
import { WalletBar } from '@/components/service-common/WalletBar';
import { SubscriptionBadge } from '@/components/service-common/SubscriptionBadge';
import { Copilot224 } from '@/components/service-common/Copilot224';

const MyPurchasesOrdersList = lazy(() => import('@/components/shared/MyPurchasesOrdersList'));
const WalletApiPanel = lazy(() => import('@/components/professional-services/modules/WalletApiPanel'));
const ServiceWalletWidget = lazy(() => import('@/components/professional-services/ServiceWalletWidget'));
const PaymentLinksManager = lazy(() => import('@/components/vendor/PaymentLinksManager'));

// Types de services qui ont leur propre module complet
// Services dont l'interface = le MODULE MÉTIER en plein écran (agenda, devis, dispatch…)
// et non le dashboard générique à onglets Produits/Paiements/API.
const FULL_MODULE_CODES = new Set([
  'location', 'construction', 'beaute', 'restaurant', 'agriculture', 'ecommerce',
  'media', 'freelance', 'reparation', 'informatique', 'maison', 'sport', 'sante', 'clinique', 'pharmacie',
  'livraison', 'vtc', 'voyage', 'menage', 'coach', 'coiff', 'mode', 'electronique',
  'dropshipping',
]);

function isFullModuleService(service: ProfessionalService): boolean {
  const code = service.service_type?.code?.toLowerCase() || '';
  const name = service.service_type?.name?.toLowerCase() || '';
  return (
    FULL_MODULE_CODES.has(code) ||
    name.includes('immobili') ||
    name.includes('construction') ||
    name.includes('btp') ||
    name.includes('beaut') ||
    name.includes('coiff')
  );
}

export default function ServiceDashboard() {
  const { t } = useTranslation();
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { userServices, loading } = useProfessionalServices();
  const [service, setService] = useState<ProfessionalService | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [showPurchases, setShowPurchases] = useState(false);

  // Auto-fill GPS is now handled globally via useAutoFillGps in App.tsx

  useEffect(() => {
    if (!loading) {
      const found = userServices.find((s) => s.id === serviceId);
      if (found) {
        setService(found);
      } else if (userServices.length > 0 || !serviceId) {
        // Services loaded but this one not found
        navigate('/services');
      }
      // If userServices is empty, we still show "Service introuvable"
    }
  }, [serviceId, userServices, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">{t('serviceDashboard.chargementDuDashboard')}</p>
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">{t('serviceDashboard.serviceIntrouvable')}</p>
          <Button onClick={() => navigate('/services')}>
            Retour aux services
          </Button>
        </div>
      </div>
    );
  }

  // Pour les services avec module complet ÔåÆ afficher directement
  if (isFullModuleService(service)) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="container mx-auto px-4 py-6">
          {/* Header avec bouton param├¿tres */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Store className="w-6 h-6 text-primary" />
              <h1 className="text-xl sm:text-2xl font-bold">{service.business_name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <ServiceIdBadge serviceId={service.id} compact />
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">{t('serviceDashboard.parametres')}</span>
              </Button>
            </div>
          </div>

          {/* Barre d'abonnement compacte */}
          <ServiceSubscriptionCard serviceId={service.id} serviceTypeId={service.service_type_id} compact />

          {/* RÈGLE N°2 — Wallet temps réel + recharge sur chaque page du service */}
          <div className="my-4"><WalletBar className="w-full" /></div>

          {/* Actions rapides (proches du haut, repliables) : liens de paiement + mes achats + localisation */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button variant={showLinks ? 'default' : 'outline'} size="sm" className="gap-2" onClick={() => setShowLinks((v) => !v)}>
              <CreditCard className="w-4 h-4" />Liens de paiement
            </Button>
            <Button variant={showPurchases ? 'default' : 'outline'} size="sm" className="gap-2" onClick={() => setShowPurchases((v) => !v)}>
              <ShoppingBag className="w-4 h-4" />Mes Achats
            </Button>
            {/* Localisation : le client/patient reçoit l'itinéraire pour venir au service */}
            <UserTrackerButton mode="merchant" driverName={service.business_name} />
          </div>
          {showLinks && (
            <Card className="mb-4"><CardContent className="p-0 sm:p-2">
              <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                <PaymentLinksManager />
              </Suspense>
            </CardContent></Card>
          )}
          {showPurchases && (
            <div className="mb-4">
              <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                <MyPurchasesOrdersList title="Mes Achats Personnels" emptyMessage="Vous n'avez pas encore effectué d'achats sur le marketplace" />
              </Suspense>
            </div>
          )}

          {/* MODULE MÉTIER (pièce maîtresse) */}
          <ServiceModuleManager
            serviceId={service.id}
            serviceTypeId={service.service_type_id}
            serviceTypeName={service.service_type?.name || 'Service'}
            serviceTypeCode={service.service_type?.code}
            businessName={service.business_name}
          />
          {/* Wallet détaillé du prestataire */}
          <div className="mt-6">
            <Suspense fallback={<div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <ServiceWalletWidget businessName={service.business_name} />
            </Suspense>
          </div>

        </div>
        {/* RÈGLE N°2 — Copilot IA contextuel au service (bulle flottante) */}
        <Copilot224 service={service.service_type?.code || ''} title={`Copilot ${service.service_type?.name || ''}`.trim()} />
        <ServiceSettingsPanel
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          service={service}
          onUpdated={() => window.location.reload()}
        />
        <CommunicationWidget position="bottom-right" showNotifications={true} />
      </div>
    );
  }

  // Dashboard generique pour les autres types de services
  const statusColors: Record<string, string> = {
    pending: 'bg-[#ff4000]',
    active: 'bg-[#ff4000]',
    suspended: 'bg-[#ff4000]',
    rejected: 'bg-gray-500',
  };

  const verificationColors: Record<string, string> = {
    unverified: 'bg-gray-500',
    pending: 'bg-[#ff4000]',
    verified: 'bg-[#ff4000]',
    rejected: 'bg-[#ff4000]',
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header mobile-optimized */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Store className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
                <h1 className="text-lg sm:text-2xl font-bold truncate">{service.business_name}</h1>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <Badge className={`${statusColors[service.status]} text-xs`}>
                  {service.status}
                </Badge>
                <Badge className={`${verificationColors[service.verification_status]} text-xs`}>
                  {service.verification_status}
                </Badge>
                <ServiceIdBadge serviceId={service.id} compact />
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
                {service.service_type?.name} • Commission: {service.service_type?.commission_rate}%
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setSettingsOpen(true)}>
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">{t('serviceDashboard.parametres')}</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Stats grid - 2 cols mobile, 4 cols desktop */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Revenus</CardTitle>
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold truncate"><Money amount={service.total_revenue} from="GNF" /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">{t('serviceDashboard.commandes')}</CardTitle>
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold">{service.total_orders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Avis</CardTitle>
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold">{service.total_reviews}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-6">
              <CardTitle className="text-xs sm:text-sm font-medium">Note</CardTitle>
              <span className="text-sm sm:text-xl">Ô¡É</span>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold">{service.rating.toFixed(1)}/5</div>
            </CardContent>
          </Card>
        </div>

        {/* RÈGLE N°2 — Barre commune : Wallet temps réel + Badge abonnement */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <WalletBar className="min-w-[240px] flex-1" />
          <SubscriptionBadge serviceId={service.id} />
        </div>

        {/* RÈGLE N°2 — Copilot IA contextuel au service */}
        <Copilot224 service={service.service_type?.code || ''} title={`Copilot ${service.service_type?.name || ''}`.trim()} />

        {/* Carte abonnement */}
        <div className="mb-6">
          <ServiceSubscriptionCard serviceId={service.id} serviceTypeId={service.service_type_id} />
        </div>

        {/* Localiser un client : il reçoit l'itinéraire pour venir au service */}
        <div className="mb-6 max-w-xs">
          <UserTrackerButton
            mode="merchant"
            prominent
            driverName={service.business_name}
            className="w-full bg-[#04439e] text-white"
          />
        </div>

        <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-max sm:w-auto sm:flex sm:flex-wrap gap-0.5">
              <TabsTrigger value="overview" className="text-xs sm:text-sm px-2.5 sm:px-3">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="wallet" className="text-xs sm:text-sm px-2.5 sm:px-3 gap-1">
                <Wallet className="w-3.5 h-3.5" />
                Wallet
              </TabsTrigger>
              <TabsTrigger value="products" className="text-xs sm:text-sm px-2.5 sm:px-3">{t('serviceDashboard.produits')}</TabsTrigger>
              <TabsTrigger value="bookings" className="text-xs sm:text-sm px-2.5 sm:px-3">R├®servations</TabsTrigger>
              <TabsTrigger value="payment-links" className="text-xs sm:text-sm px-2.5 sm:px-3 gap-1">
                <CreditCard className="w-3.5 h-3.5" />
                Paiements
              </TabsTrigger>
              <TabsTrigger value="my-purchases" className="text-xs sm:text-sm px-2.5 sm:px-3 gap-1">
                <ShoppingBag className="w-3.5 h-3.5" />
                Achats
              </TabsTrigger>
              <TabsTrigger value="reviews" className="text-xs sm:text-sm px-2.5 sm:px-3">Avis</TabsTrigger>
              <TabsTrigger value="analytics" className="text-xs sm:text-sm px-2.5 sm:px-3">Stats</TabsTrigger>
              <TabsTrigger value="api" className="text-xs sm:text-sm px-2.5 sm:px-3 gap-1">
                <Key className="w-3.5 h-3.5" />
                API
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('serviceDashboard.informationsDuService')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="mt-1">{service.description || 'Aucune description'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">T├®l├®phone</p>
                    <p className="mt-1">{service.phone || 'Non renseign├®'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p className="mt-1">{service.email || 'Non renseign├®'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Adresse</p>
                    <p className="mt-1">{service.address || 'Non renseign├®e'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Site Web</p>
                    <p className="mt-1">{service.website || 'Non renseign├®'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wallet">
            <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <ServiceWalletWidget businessName={service.business_name} />
            </Suspense>
          </TabsContent>

          <TabsContent value="products">
            <ServiceModuleManager
              serviceId={service.id}
              serviceTypeId={service.service_type_id}
              serviceTypeName={service.service_type?.name || 'Service'}
              serviceTypeCode={service.service_type?.code}
              businessName={service.business_name}
            />
          </TabsContent>

          <TabsContent value="bookings">
            <BookingManagement serviceId={service.id} />
          </TabsContent>

          <TabsContent value="payment-links">
            <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <PaymentLinksManager />
            </Suspense>
          </TabsContent>

          <TabsContent value="my-purchases">
            <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <MyPurchasesOrdersList
                title="Mes Achats Personnels"
                emptyMessage="Vous n'avez pas encore effectu├® d'achats sur le marketplace"
              />
            </Suspense>
          </TabsContent>

          <TabsContent value="reviews">
            <Card>
              <CardHeader>
                <CardTitle>Avis Clients</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('serviceDashboard.moduleDeGestionDesAvis')}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Statistiques D├®taill├®es</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Module d'analytics ├á impl├®menter...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api">
            <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <WalletApiPanel serviceId={service.id} businessName={service.business_name} />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>

      <ServiceSettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        service={service}
        onUpdated={() => window.location.reload()}
      />
      <CommunicationWidget position="bottom-right" showNotifications={true} />
    </div>
  );
}
