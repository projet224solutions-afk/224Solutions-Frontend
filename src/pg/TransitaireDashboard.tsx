import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Package, Plane, Ship, TrendingUp, Clock, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRoleRedirect } from "@/hooks/useRoleRedirect";
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from "react-router-dom";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useTransitaireErrorBoundary } from "@/hooks/useTransitaireErrorBoundary";

import { useTransitaireStats } from "@/hooks/useTransitaireStats";
import ProfessionalMessaging from "@/components/messaging/ProfessionalMessaging";
import { WalletBalanceWidget } from "@/components/wallet/WalletBalanceWidget";
import CommunicationWidget from "@/components/communication/CommunicationWidget";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";

export default function TransitaireDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  useRoleRedirect(); // S'assurer que seuls les transitaires/admins accèdent à cette page
  const { error, captureError, clearError } = useTransitaireErrorBoundary();
  const { stats: transitaireStats, loading: statsLoading } = useTransitaireStats();
  const formatPrice = useFormatCurrency();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Stats dynamiques basées sur les données réelles
  const stats = [
    {
      label: t('transit.activeShipments'),
      value: statsLoading ? "..." : transitaireStats.totalShipments.toString(),
      icon: Package,
      color: "text-blue-500"
    },
    {
      label: t('transit.inTransit'),
      value: statsLoading ? "..." : transitaireStats.pendingShipments.toString(),
      icon: Plane,
      color: "text-[#ff4000]"
    },
    {
      label: t('transit.monthlyRevenue'),
      value: statsLoading ? "..." : formatPrice(transitaireStats.totalRevenue),
      icon: TrendingUp,
      color: "text-[#04439e]"
    },
    {
      label: t('transit.averageDelay'),
      value: statsLoading ? "..." : `${transitaireStats.customsInProgress}j`,
      icon: Clock,
      color: "text-orange-500"
    }
  ];

  const activeShipments = [
    {
      id: 'INT-2024-089',
      origin: 'Conakry, Guinée',
      destination: 'Paris, France',
      weight: '125 kg',
      status: 'En douane',
      eta: '3 jours',
      type: 'Aérien'
    },
    {
      id: 'INT-2024-090',
      origin: 'Abidjan, CI',
      destination: 'New York, USA',
      weight: '2.5 tonnes',
      status: 'En transit',
      eta: '15 jours',
      type: 'Maritime'
    }
  ];

  const recentCustoms = [
    { country: 'France', processed: 12, pending: 3 },
    { country: 'USA', processed: 8, pending: 1 },
    { country: 'Maroc', processed: 15, pending: 2 }
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-foreground">{t('transit.dashboard')}</h1>
              </div>
              <p className="text-muted-foreground">
                {t('transit.internationalTransport')} - {profile?.first_name || user?.email}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden lg:block">
                <WalletBalanceWidget className="min-w-[260px]" />
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                {t('common.signOut')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <p className="text-[#ff4000]">{error.message}</p>
            <button onClick={clearError} className="text-[#ff4000] hover:text-[#ff4000]">×</button>
          </div>
        </div>
      )}

      {/* Navigation par onglets */}
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Stats Cards */}
          <section className="px-4 py-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <Card key={index}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                          <p className="text-2xl font-bold">{stat.value}</p>
                        </div>
                        <Icon className={`w-8 h-8 ${stat.color}`} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>

      {/* Active Shipments */}
      <section className="px-4 py-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Expéditions actives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeShipments.map((shipment) => (
                <div key={shipment.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{shipment.id}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                        shipment.status === 'En transit'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {shipment.type === 'Aérien' ? <Plane className="w-3 h-3" /> : <Ship className="w-3 h-3" />}
                        {shipment.status}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-[#ff4000]">ETA: {shipment.eta}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Origine</p>
                      <p className="font-medium">{shipment.origin}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Destination</p>
                      <p className="font-medium">{shipment.destination}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Poids</p>
                      <p className="font-medium">{shipment.weight}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Customs Status */}
      <section className="px-4 py-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Statut douanier par pays
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentCustoms.map((customs, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-accent rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium mb-1">{customs.country}</h4>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="text-[#ff4000]">{customs.processed} traités</span>
                      <span className="text-orange-600">{customs.pending} en attente</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Détails
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Features Overview */}
      <section className="px-4 py-2 mb-6">
        <Card className="bg-[#04439e]/5 border-0">
          <CardContent className="p-6">
            <div className="text-center">
              <Globe className="w-12 h-12 mx-auto mb-4 text-blue-500" />
              <h3 className="text-xl font-bold mb-2">{t('transitaireDashboard.plateformeDeTransitInternational')}</h3>
              <p className="text-muted-foreground mb-4">
                Gérez vos expéditions internationales avec notre système avancé
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>{t('transitaireDashboard.suiviEnTempsReel')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>{t('transitaireDashboard.gestionDouaniere')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Documentation automatique</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Multi-modal (Air/Mer)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Alertes SMS/Email</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>{t('transitaireDashboard.rapportsDetailles')}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
        </TabsContent>

        <TabsContent value="communication" className="space-y-6">
          <div className="px-4 py-6">
            <ProfessionalMessaging />
          </div>
        </TabsContent>
      </Tabs>

      {/* Widget de communication flottant */}
      <CommunicationWidget position="bottom-right" showNotifications={true} />
    </div>
  );
}
