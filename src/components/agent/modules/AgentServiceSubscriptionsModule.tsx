import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ServiceSubscriptionService,
  ServicePlan,
  ServiceSubscriptionStats
} from '@/services/serviceSubscriptionService';
import { toast } from 'sonner';
import {
  DollarSign,
  TrendingUp,
  Users,
  RefreshCw,
  Store,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AgentServiceSubscriptionsModuleProps {
  agentId: string;
  canManage?: boolean;
}

export function AgentServiceSubscriptionsModule({
  agentId,
  canManage = false
}: AgentServiceSubscriptionsModuleProps) {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [stats, setStats] = useState<ServiceSubscriptionStats | null>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansData, statsData, subsData] = await Promise.all([
        ServiceSubscriptionService.getPlans(),
        ServiceSubscriptionService.getStats(),
        ServiceSubscriptionService.getAllSubscriptions(100)
      ]);
      setPlans(plansData);
      setStats(statsData);
      setSubscriptions(subsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('agentServiceSubscriptionsModule.impossibleDeChargerLesDonnees'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-orange-100 text-[#ff4000] flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Actif
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-orange-100 text-[#ff4000] flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Expiré
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-slate-100 text-slate-700 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Annulé
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-orange-100 text-[#ff4000] flex items-center gap-1">
            <Clock className="w-3 h-3" />
            En attente
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      sub.service_name?.toLowerCase().includes(query) ||
      sub.plan_name?.toLowerCase().includes(query) ||
      sub.vendor_name?.toLowerCase().includes(query) ||
      sub.status?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-[#ff4000] to-[#ff4000] rounded-xl shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{t('agentServiceSubscriptionsModule.abonnementsServices')}</h2>
            <p className="text-slate-500">{t('agentServiceSubscriptionsModule.gerezLesAbonnementsDesServices')}</p>
          </div>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Abonnements Actifs</p>
                  <p className="text-2xl font-bold text-blue-700">{stats.active_subscriptions}</p>
                </div>
                <Users className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-orange-50 to-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Revenus Mensuels</p>
                  <p className="text-2xl font-bold text-[#ff4000]">
                    {ServiceSubscriptionService.formatAmount(stats.monthly_revenue || 0)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-[#ff4000]" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Abonnements</p>
                  <p className="text-2xl font-bold text-[#04439e]">{stats.total_subscriptions}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-[#04439e]" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md bg-gradient-to-br from-orange-50 to-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">{t('agentServiceSubscriptionsModule.servicesActifs')}</p>
                  <p className="text-2xl font-bold text-[#ff4000]">
                    {plans.filter(p => p.is_active).length}
                  </p>
                </div>
                <Store className="w-8 h-8 text-[#ff4000]" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="subscriptions" className="w-full">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="subscriptions" className="data-[state=active]:bg-white">
            <Users className="w-4 h-4 mr-2" />
            Abonnements
          </TabsTrigger>
          <TabsTrigger value="plans" className="data-[state=active]:bg-white">
            <Store className="w-4 h-4 mr-2" />
            Forfaits
          </TabsTrigger>
        </TabsList>

        {/* Subscriptions Tab */}
        <TabsContent value="subscriptions" className="mt-4">
          <Card className="border-0 shadow-md">
            <CardHeader className="border-b bg-slate-50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{t('agentServiceSubscriptionsModule.listeDesAbonnements')}</CardTitle>
                  <CardDescription>{t('agentServiceSubscriptionsModule.tousLesAbonnementsServicesActifs')}</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder={t('agentServiceSubscriptionsModule.rechercher')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('agentServiceSubscriptionsModule.service')}</TableHead>
                    <TableHead>Forfait</TableHead>
                    <TableHead>{t('agentServiceSubscriptionsModule.vendeur')}</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>{t('agentServiceSubscriptionsModule.periode')}</TableHead>
                    <TableHead className="text-right">{t('agentServiceSubscriptionsModule.prixPaye')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                        Aucun abonnement trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSubscriptions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">{sub.service_name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {sub.plan_name || 'Standard'}
                          </Badge>
                        </TableCell>
                        <TableCell>{sub.vendor_name || 'N/A'}</TableCell>
                        <TableCell>{getStatusBadge(sub.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-slate-600">
                            <Calendar className="w-3 h-3" />
                            {sub.current_period_start
                              ? format(new Date(sub.current_period_start), 'dd MMM yyyy', { locale: fr })
                              : 'N/A'
                            }
                            {sub.current_period_end && (
                              <span className="text-slate-400">
                                → {format(new Date(sub.current_period_end), 'dd MMM yyyy', { locale: fr })}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {ServiceSubscriptionService.formatAmount(sub.price_paid || 0)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plans Tab */}
        <TabsContent value="plans" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`border-0 shadow-md transition-all duration-200 ${
                  plan.is_active
                    ? 'bg-gradient-to-br from-white to-slate-50'
                    : 'opacity-60 bg-slate-100'
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg capitalize">{plan.name}</CardTitle>
                    <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                      {plan.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-primary">
                        {ServiceSubscriptionService.formatAmount(plan.monthly_price_gnf)}
                      </span>
                      <span className="text-sm text-slate-500">/mois</span>
                    </div>

                    {plan.yearly_price_gnf && (
                      <div className="text-sm text-slate-600">
                        Annuel: {ServiceSubscriptionService.formatAmount(plan.yearly_price_gnf)}
                      </div>
                    )}

                    {plan.features && plan.features.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-medium text-slate-500 mb-2">{t('agentServiceSubscriptionsModule.fonctionnalites')}</p>
                        <ul className="space-y-1">
                          {plan.features.slice(0, 4).map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                              <CheckCircle className="w-3 h-3 text-[#ff4000]" />
                              {feature}
                            </li>
                          ))}
                          {plan.features.length > 4 && (
                            <li className="text-xs text-slate-400">
                              +{plan.features.length - 4} autres...
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
