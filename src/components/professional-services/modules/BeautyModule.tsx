/**
 * MODULE SALON DE BEAUTÉ - Interface complète
 * Utilise serviceId pour afficher les données spécifiques au salon
 */

import { useState, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BeautyAgenda } from '@/components/professional-services/modules/beauty/BeautyAgenda';
import { BeautyServices } from '@/components/professional-services/modules/beauty/BeautyServices';
import { BeautyClients } from '@/components/professional-services/modules/beauty/BeautyClients';
import { BeautyGallery } from '@/components/professional-services/modules/beauty/BeautyGallery';
import { BeautyAnalytics } from '@/components/professional-services/modules/beauty/BeautyAnalytics';
import { BeautySettings } from '@/components/professional-services/modules/beauty/BeautySettings';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Crown, Users, Calendar, DollarSign, Clock,
  CheckCircle, XCircle, RefreshCw, Eye, Plus,
  TrendingUp, Settings, Image as ImageIcon, BarChart3
} from 'lucide-react';
import { useServiceBeautyStats } from '@/hooks/useServiceBeautyStats';
import { useBeautyAppointmentsAll } from '@/hooks/useBeauty';
import { Money } from '@/components/Money';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface BeautyModuleProps {
  serviceId: string;
  businessName?: string;
}

// formatCurrency is now handled via useFormatCurrency hook inside the component

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-[#04439e]/10 text-[#04439e]',
  completed: 'bg-[#16a34a]/10 text-[#16a34a]',  // vert = terminé ✓
  cancelled: 'bg-red-100 text-red-600',           // rouge = annulé ✗
  no_show: 'bg-slate-100 text-slate-500',
};

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  completed: 'Terminé',
  cancelled: 'Annulé',
  no_show: 'Absent',
};

export function BeautyModule({ serviceId, businessName }: BeautyModuleProps) {
  const { t } = useTranslation();
  const formatCurrency = useFormatCurrency();
  const { stats, recentAppointments, loading, error, refresh } = useServiceBeautyStats(serviceId);
  // Données complètes pour les commissions (CA réel par prestataire, pas un sous-ensemble récent)
  const { appointments: allAppts } = useBeautyAppointmentsAll(serviceId);
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();
  const tabsRef = useRef<HTMLDivElement>(null);
  // Change d'onglet ET fait défiler jusqu'au contenu (sinon le clic semble « ne rien faire »).
  const goTab = (tab: string) => {
    setActiveTab(tab);
    setTimeout(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive">{error}</p>
          <Button onClick={refresh} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  const noData = !stats?.hasData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="w-7 h-7 text-primary" />
            {businessName || 'Salon de Beauté'}
          </h2>
          <p className="text-muted-foreground">{t('beautyModule.gerezVosRendezVousEt')}</p>
        </div>
        <Button onClick={refresh} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Onboarding (premier lancement) — boutons internes au module, pas de page externe */}
      {noData && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <Crown className="h-6 w-6 text-[#ff4000]" />
            <div className="flex-1 min-w-[180px]">
              <p className="font-semibold">{t('beautyModule.bienvenueDansVotreEspaceBeaute')}</p>
              <p className="text-sm text-muted-foreground">{t('beautyModule.commencezParAjouterVosPrestations')}</p>
            </div>
            <Button size="sm" onClick={() => goTab('services')}><Plus className="h-4 w-4 mr-1" />{t('beautyModule.ajouterUnService')}</Button>
            <Button size="sm" variant="outline" onClick={() => goTab('settings')}><Settings className="h-4 w-4 mr-1" />Configurer</Button>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card onClick={() => goTab('appointments')} className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-transparent hover:border-l-pink-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('beautyModule.rendezVous')}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.appointments.total || 0}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {stats?.todayAppointments > 0 && (
                <Badge variant="secondary" className="text-xs bg-orange-100 text-[#ff4000]">
                  {stats.todayAppointments} aujourd'hui
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card onClick={() => goTab('services')} className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-transparent hover:border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('beautyModule.services')}</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.services.total || 0}</div>
            <span className="text-xs text-[#ff4000]">{stats?.services.active || 0} actifs</span>
          </CardContent>
        </Card>

        <Card onClick={() => goTab('clients')} className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-transparent hover:border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.staff.total || 0}</div>
            <span className="text-xs text-muted-foreground">membres</span>
          </CardContent>
        </Card>

        <Card onClick={() => goTab('analytics')} className="cursor-pointer hover:shadow-md transition-shadow bg-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-primary">
              {formatCurrency(stats?.sales.totalRevenue || 0)}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatCurrency(stats?.sales.monthRevenue || 0)} ce mois
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div ref={tabsRef} className="scroll-mt-20">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-8 lg:w-auto lg:inline-grid">
          <TabsTrigger value="appointments"><Calendar className="w-4 h-4 mr-1 hidden md:block" />Agenda</TabsTrigger>
          <TabsTrigger value="services"><Crown className="w-4 h-4 mr-1 hidden md:block" />{t('beautyModule.services')}</TabsTrigger>
          <TabsTrigger value="clients"><Users className="w-4 h-4 mr-1 hidden md:block" />Clients</TabsTrigger>
          <TabsTrigger value="gallery"><ImageIcon className="w-4 h-4 mr-1 hidden md:block" />Galerie</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="w-4 h-4 mr-1 hidden md:block" />Analytics</TabsTrigger>
          <TabsTrigger value="commissions"><DollarSign className="w-4 h-4 mr-1 hidden md:block" />Commissions</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1 hidden md:block" />{t('beautyModule.reglages')}</TabsTrigger>
          <TabsTrigger value="overview"><DollarSign className="w-4 h-4 mr-1 hidden md:block" />{t('beautyModule.resume')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Résumé des revenus
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                  <span className="text-sm font-medium">Total</span>
                  <span className="font-bold text-primary">{formatCurrency(stats?.sales.totalRevenue || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Aujourd'hui</span>
                  <span className="font-semibold">{formatCurrency(stats?.sales.todayRevenue || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Cette semaine</span>
                  <span className="font-semibold">{formatCurrency(stats?.sales.weekRevenue || 0)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Ce mois</span>
                  <span className="font-semibold">{formatCurrency(stats?.sales.monthRevenue || 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Appointments Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  État des rendez-vous
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-orange-50 dark:bg-[#ff4000]/20 border border-orange-200 rounded-lg text-center">
                    <div className="text-xs font-medium text-[#ff4000]">Aujourd'hui</div>
                    <div className="text-xl font-bold text-[#ff4000]">{stats?.todayAppointments || 0}</div>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-[#04439e]/20 border border-blue-200 rounded-lg text-center">
                    <div className="text-xs font-medium text-[#04439e]">{t('beautyModule.aVenir')}</div>
                    <div className="text-xl font-bold text-[#04439e]">{stats?.upcomingAppointments || 0}</div>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t">
                  <div className="flex justify-between items-center p-2 rounded bg-orange-50">
                    <span className="text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#ff4000]" /> En attente
                    </span>
                    <span className="font-semibold text-[#ff4000]">{stats?.appointments.pending || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-blue-50">
                    <span className="text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-500" /> Confirmés
                    </span>
                    <span className="font-semibold text-blue-700">{stats?.appointments.confirmed || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-orange-50">
                    <span className="text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[#ff4000]" /> Terminés
                    </span>
                    <span className="font-semibold text-[#ff4000]">{stats?.appointments.completed || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded bg-orange-50">
                    <span className="text-sm flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-[#ff4000]" /> Annulés
                    </span>
                    <span className="font-semibold text-[#ff4000]">{stats?.appointments.cancelled || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="appointments" className="mt-4">
          <BeautyAgenda serviceId={serviceId} />
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <BeautyServices serviceId={serviceId} />
        </TabsContent>

        <TabsContent value="clients" className="mt-4">
          <BeautyClients serviceId={serviceId} />
        </TabsContent>

        <TabsContent value="gallery" className="mt-4">
          <BeautyGallery serviceId={serviceId} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <BeautyAnalytics serviceId={serviceId} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <BeautySettings serviceId={serviceId} />
        </TabsContent>

        {/* Commissions — style Fresha Team Plan (données complètes, CA réel par prestataire) */}
        <TabsContent value="commissions" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-0 bg-[#04439e] text-white">
              <CardContent className="p-4">
                <p className="text-xs opacity-70">{t('beautyModule.caTotalTermine')}</p>
                <p className="text-2xl font-bold">
                  <Money amount={allAppts.filter(a => a.status === 'completed').reduce((s, a) => s + (a.total_price || 0), 0)} />
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 bg-[#ff4000] text-white">
              <CardContent className="p-4">
                <p className="text-xs opacity-70">Commissions (30%)</p>
                <p className="text-2xl font-bold">
                  <Money amount={allAppts.filter(a => a.status === 'completed').reduce((s, a) => s + (a.total_price || 0), 0) * 0.3} />
                </p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Par prestataire — {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(
                allAppts.filter(a => a.status === 'completed').reduce((acc, a) => {
                  const k = a.staff_id || 'Non assigné';
                  if (!acc[k]) acc[k] = { total: 0, count: 0 };
                  acc[k].total += a.total_price || 0; acc[k].count += 1;
                  return acc;
                }, {} as Record<string, { total: number; count: number }>)
              ).map(([staff, { total, count }]) => (
                <div key={staff} className="flex items-center justify-between border-b py-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{staff === 'Non assigné' ? 'Non assigné' : `Coiffeur ${staff.slice(0, 6)}…`}</p>
                    <p className="text-xs text-muted-foreground">{count} prestation{count > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold"><Money amount={total} /></p>
                    <p className="text-xs text-muted-foreground">→ <Money amount={total * 0.3} /> commission</p>
                  </div>
                </div>
              ))}
              {allAppts.filter(a => a.status === 'completed').length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">{t('beautyModule.aucunePrestationTermineePourLe')}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

export default BeautyModule;
