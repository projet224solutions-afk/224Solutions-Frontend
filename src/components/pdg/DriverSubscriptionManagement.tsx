import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Gift, RefreshCw, Users, DollarSign, Bike, Car,
  Calendar, Search, Edit, CheckCircle, XCircle, Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DriverSubscription {
  id: string;
  user_id: string;
  type: string;
  price: number;
  status: string;
  start_date: string;
  end_date: string;
  payment_method: string;
  billing_cycle: string;
  transaction_id: string;
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  } | null;
}

interface DriverSubscriptionConfig {
  id: string;
  subscription_type: string;
  price: number;
  duration_days: number;
  yearly_price: number | null;
  is_active: boolean;
}

interface Stats {
  total_active: number;
  total_expired: number;
  total_taxi: number;
  total_livreur: number;
  total_revenue: number;
  revenue_this_month: number;
}

export default function DriverSubscriptionManagement() {
  const { t } = useTranslation();
  const [subscriptions, setSubscriptions] = useState<DriverSubscription[]>([]);
  const [config, setConfig] = useState<DriverSubscriptionConfig | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'taxi' | 'livreur'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');

  // Dialog states
  const [isOfferDialogOpen, setIsOfferDialogOpen] = useState(false);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Offer subscription form
  const [offerData, setOfferData] = useState({
    userId: '',
    type: 'taxi' as 'taxi' | 'livreur',
    days: '30',
    isFree: true
  });

  // Config form
  const [configForm, setConfigForm] = useState({
    price: '',
    yearlyPrice: '',
    durationDays: '30'
  });

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSubscriptions(),
        fetchConfig(),
        fetchStats()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('driverSubscriptionManagement.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptions = async () => {
    const { data, error } = await supabase
      .from('driver_subscriptions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Récupérer les profils séparément
    const userIds = [...new Set(data?.map(s => s.user_id) || [])];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone')
        .in('id', userIds);

      const enrichedData = data?.map(sub => ({
        ...sub,
        profiles: profiles?.find(p => p.id === sub.user_id)
      }));

      setSubscriptions(enrichedData || []);
    } else {
      setSubscriptions(data || []);
    }
  };

  const fetchConfig = async () => {
    const { data, error } = await supabase
      .from('driver_subscription_config')
      .select('*')
      .eq('subscription_type', 'both')
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    setConfig(data);
    if (data) {
      setConfigForm({
        price: data.price?.toString() || '',
        yearlyPrice: data.yearly_price?.toString() || '',
        durationDays: data.duration_days?.toString() || '30'
      });
    }
  };

  const fetchStats = async () => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      { count: total_active },
      { count: total_expired },
      { count: total_taxi },
      { count: total_livreur },
      { data: revenues },
      { data: revenuesMonth }
    ] = await Promise.all([
      supabase.from('driver_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('driver_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'expired'),
      supabase.from('driver_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('type', 'taxi'),
      supabase.from('driver_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('type', 'livreur'),
      supabase.from('driver_subscription_revenues').select('amount'),
      supabase.from('driver_subscription_revenues').select('amount').gte('created_at', firstDayOfMonth)
    ]);

    setStats({
      total_active: total_active || 0,
      total_expired: total_expired || 0,
      total_taxi: total_taxi || 0,
      total_livreur: total_livreur || 0,
      total_revenue: revenues?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0,
      revenue_this_month: revenuesMonth?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0
    });
  };

  const handleOfferSubscription = async () => {
    if (!offerData.userId) {
      toast.error(t('driverSubscriptionManagement.veuillezEntrerUnIdentifiantUtilisateur'));
      return;
    }

    const days = parseInt(offerData.days);
    if (isNaN(days) || days <= 0 || days > 365) {
      toast.error(t('driverSubscriptionManagement.leNombreDeJoursDoit'));
      return;
    }

    setSubmitting(true);
    try {
      console.log('🎁 [PDG] Offre abonnement:', { userId: offerData.userId, type: offerData.type, days });

      // Résoudre l'ID utilisateur via RPC (contourne RLS)
      let resolvedUserId = offerData.userId.trim();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!uuidRegex.test(resolvedUserId)) {
        console.log('🔍 [PDG] Recherche utilisateur:', resolvedUserId);

        // Utiliser la fonction RPC pour résoudre l'utilisateur (SECURITY DEFINER)
        const { data: foundUserId, error: resolveError } = await supabase
          .rpc('resolve_user_for_subscription' as any, {
            p_identifier: resolvedUserId
          } as any);

        if (resolveError || !foundUserId) {
          console.error('❌ [PDG] Erreur résolution:', resolveError);

          // Fallback: recherche directe dans profiles (si RPC n'existe pas)
          if (resolveError?.code === 'PGRST202') {
            console.log('⚠️ [PDG] RPC non trouvée, recherche directe...');

            // Recherche par email exact
            // eslint-disable-next-line prefer-const
            let { data: profileData, error: _profileError } = await supabase
              .from('profiles')
              .select('id, email')
              .eq('email', resolvedUserId.toLowerCase())
              .maybeSingle();

            // Si pas trouvé par email, chercher par téléphone
            if (!profileData) {
              const { data: phoneData } = await supabase
                .from('profiles')
                .select('id, email')
                .eq('phone', resolvedUserId)
                .maybeSingle();
              profileData = phoneData;
            }

            // Si pas trouvé, chercher par custom_id/public_id
            if (!profileData) {
              const { data: idData } = await supabase
                .from('profiles')
                .select('id, email')
                .or(`custom_id.eq.${resolvedUserId.toUpperCase()},public_id.eq.${resolvedUserId.toUpperCase()}`)
                .maybeSingle();
              profileData = idData;
            }

            if (!profileData) {
              throw new Error(`Utilisateur "${resolvedUserId}" non trouvé. Vérifiez l'ID, email ou téléphone.`);
            }

            console.log('✅ [PDG] Utilisateur trouvé:', profileData.email);
            resolvedUserId = profileData.id;
          } else {
            throw new Error(`Utilisateur "${resolvedUserId}" non trouvé. Vérifiez l'ID, email ou téléphone.`);
          }
        } else {
          console.log('✅ [PDG] Utilisateur résolu via RPC:', foundUserId);
          resolvedUserId = foundUserId;
        }
      }

      // Utiliser la fonction RPC pour créer l'abonnement (plus fiable)
      console.log('📝 [PDG] Appel fonction pdg_offer_subscription');
      const { data: subscriptionId, error: rpcError } = await (supabase as any)
        .rpc('pdg_offer_subscription', {
          p_user_id: resolvedUserId,
          p_type: offerData.type,
          p_days: days
        });

      if (rpcError) {
        console.error('❌ [PDG] Erreur RPC:', rpcError);

        // Si fonction n'existe pas encore, fallback sur méthode directe
        if (rpcError.code === 'PGRST202' || rpcError.message?.includes('function')) {
          console.warn('⚠️ [PDG] Fonction RPC non trouvée, utilisation méthode directe');

          // Méthode fallback
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + days);

          await supabase
            .from('driver_subscriptions')
            .update({ status: 'expired', updated_at: new Date().toISOString() })
            .eq('user_id', resolvedUserId)
            .eq('status', 'active');

          const { error: insertError } = await supabase
            .from('driver_subscriptions')
            .insert({
              user_id: resolvedUserId,
              type: offerData.type,
              price: 0,
              status: 'active',
              start_date: startDate.toISOString(),
              end_date: endDate.toISOString(),
              payment_method: 'pdg_gift',
              billing_cycle: 'custom',
              transaction_id: `GIFT-PDG-${Date.now()}`,
              metadata: { offered_by_pdg: true, days_offered: days }
            });

          if (insertError) throw insertError;
        } else {
          throw rpcError;
        }
      }

      console.log('✅ [PDG] Abonnement créé:', subscriptionId);
      toast.success(`🎁 Abonnement ${offerData.type} de ${days} jours offert avec succès!`, {
        description: 'L\'utilisateur peut maintenant utiliser l\'application'
      });

      setIsOfferDialogOpen(false);
      setOfferData({ userId: '', type: 'taxi', days: '30', isFree: true });
      fetchData();
    } catch (error: any) {
      console.error('❌ [PDG] Erreur offre abonnement:', error);

      // Messages d'erreur détaillés
      let errorMessage = 'Erreur lors de l\'offre d\'abonnement';
      if (error.message?.includes('non trouvé') || error.message?.includes('not found')) {
        errorMessage = 'Utilisateur introuvable. Vérifiez l\'ID, email ou téléphone.';
      } else if (error.message?.includes('Type invalide')) {
        errorMessage = 'Type d\'abonnement invalide. Choisissez taxi ou livreur.';
      } else if (error.message?.includes('constraint') && error.message?.includes('payment_method')) {
        errorMessage = 'Erreur de configuration. La migration SQL doit être appliquée.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage, {
        description: 'Vérifiez les informations et réessayez'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateConfig = async () => {
    const price = parseInt(configForm.price);
    const yearlyPrice = configForm.yearlyPrice ? parseInt(configForm.yearlyPrice) : null;
    const durationDays = parseInt(configForm.durationDays);

    if (isNaN(price) || price <= 0) {
      toast.error(t('driverSubscriptionManagement.lePrixMensuelDoitEtre'));
      return;
    }

    setSubmitting(true);
    try {
      if (config) {
        const { error } = await supabase
          .from('driver_subscription_config')
          .update({
            price,
            yearly_price: yearlyPrice,
            duration_days: durationDays,
            updated_at: new Date().toISOString()
          })
          .eq('id', config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('driver_subscription_config')
          .insert({
            subscription_type: 'both',
            price,
            yearly_price: yearlyPrice,
            duration_days: durationDays,
            is_active: true
          });

        if (error) throw error;
      }

      toast.success(t('driverSubscriptionManagement.configurationMiseAJourAvec'));
      setIsConfigDialogOpen(false);
      fetchConfig();
    } catch (error: any) {
      console.error('Error updating config:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (subscription: DriverSubscription) => {
    try {
      const newStatus = subscription.status === 'active' ? 'suspended' : 'active';
      const { error } = await supabase
        .from('driver_subscriptions')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', subscription.id);

      if (error) throw error;

      toast.success(`Abonnement ${newStatus === 'active' ? 'réactivé' : 'suspendu'}`);
      fetchSubscriptions();
    } catch (_error) {
      toast.error(t('driverSubscriptionManagement.erreurLorsDeLaModification'));
    }
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = !searchQuery ||
      sub.profiles?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.profiles?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.profiles?.phone?.includes(searchQuery) ||
      sub.transaction_id?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = filterType === 'all' || sub.type === filterType;
    const matchesStatus = filterStatus === 'all' || sub.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const formatAmount = useFormatCurrency();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20"><CheckCircle className="w-3 h-3 mr-1" /> Actif</Badge>;
      case 'expired':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> {t('driverSubscriptionManagement.expire')}</Badge>;
      case 'suspended':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Suspendu</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Abonnements Drivers</h2>
          <p className="text-muted-foreground text-sm">
            Gérez les abonnements Taxi-Moto et Livreurs
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setIsOfferDialogOpen(true)} className="gap-2">
            <Gift className="w-4 h-4" />
            Offrir Abonnement
          </Button>
          <Button onClick={() => setIsConfigDialogOpen(true)} variant="outline" className="gap-2">
            <Edit className="w-4 h-4" />
            Configuration
          </Button>
          <Button onClick={fetchData} variant="ghost" size="icon">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Actifs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff4000]">{stats.total_active}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Taxi-Moto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Car className="w-5 h-5 text-[#ff4000]" />
                {stats.total_taxi}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Livreurs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Bike className="w-5 h-5 text-blue-600" />
                {stats.total_livreur}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{t('driverSubscriptionManagement.expires')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{stats.total_expired}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Revenus Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-[#ff4000]">{formatAmount(stats.total_revenue)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Ce Mois</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{formatAmount(stats.revenue_this_month)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Config Display */}
      {config && (
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="font-medium">Configuration actuelle:</span>
              <Badge variant="outline" className="gap-1">
                <DollarSign className="w-3 h-3" />
                Mensuel: {formatAmount(config.price)}
              </Badge>
              {config.yearly_price && (
                <Badge variant="outline" className="gap-1">
                  <Calendar className="w-3 h-3" />
                  Annuel: {formatAmount(config.yearly_price)}
                </Badge>
              )}
              <Badge variant="secondary">
                Durée: {config.duration_days} jours
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('driverSubscriptionManagement.rechercherParNomEmailTelephone')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('driverSubscriptionManagement.tousTypes')}</SelectItem>
                <SelectItem value="taxi">Taxi-Moto</SelectItem>
                <SelectItem value="livreur">Livreur</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('driverSubscriptionManagement.tousStatuts')}</SelectItem>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="expired">{t('driverSubscriptionManagement.expire')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Abonnements ({filteredSubscriptions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead>{t('driverSubscriptionManagement.periode')}</TableHead>
                  <TableHead>{t('driverSubscriptionManagement.paiement')}</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubscriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Aucun abonnement trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {sub.profiles?.first_name} {sub.profiles?.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {sub.profiles?.email || sub.profiles?.phone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {sub.type === 'taxi' ? <Car className="w-3 h-3" /> : <Bike className="w-3 h-3" />}
                          {sub.type === 'taxi' ? 'Taxi-Moto' : 'Livreur'}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(sub.status)}</TableCell>
                      <TableCell>
                        {sub.price === 0 ? (
                          <Badge className="bg-[#04439e]/10 text-[#04439e] border-[#04439e]/20">
                            <Gift className="w-3 h-3 mr-1" /> Gratuit
                          </Badge>
                        ) : (
                          formatAmount(sub.price)
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          <div>Du: {format(new Date(sub.start_date), 'dd/MM/yyyy', { locale: fr })}</div>
                          <div>Au: {format(new Date(sub.end_date), 'dd/MM/yyyy', { locale: fr })}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {sub.payment_method === 'pdg_gift' ? 'Cadeau PDG' : sub.payment_method}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(sub)}
                          disabled={sub.status === 'expired'}
                        >
                          {sub.status === 'active' ? 'Suspendre' : 'Réactiver'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Offer Subscription Dialog */}
      <Dialog open={isOfferDialogOpen} onOpenChange={setIsOfferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              Offrir un Abonnement
            </DialogTitle>
            <DialogDescription>
              Offrez un abonnement gratuit à un driver
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Identifiant Utilisateur</Label>
              <Input
                placeholder={t('driverSubscriptionManagement.uuidDrv0001EmailOuTelephone')}
                value={offerData.userId}
                onChange={(e) => setOfferData({ ...offerData, userId: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Accepte: UUID, code DRV/CLT, email ou téléphone
              </p>
            </div>
            <div className="space-y-2">
              <Label>Type d'abonnement</Label>
              <Select
                value={offerData.type}
                onValueChange={(v) => setOfferData({ ...offerData, type: v as 'taxi' | 'livreur' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="taxi">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4" /> Taxi-Moto
                    </div>
                  </SelectItem>
                  <SelectItem value="livreur">
                    <div className="flex items-center gap-2">
                      <Bike className="w-4 h-4" /> Livreur
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('driverSubscriptionManagement.nombreDeJours')}</Label>
              <Input
                type="number"
                min="1"
                value={offerData.days}
                onChange={(e) => setOfferData({ ...offerData, days: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOfferDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleOfferSubscription} disabled={submitting}>
              {submitting ? 'Envoi...' : 'Offrir l\'abonnement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Config Dialog */}
      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" />
              Configuration des Prix
            </DialogTitle>
            <DialogDescription>
              Modifiez les prix des abonnements drivers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Prix Mensuel (GNF)</Label>
              <Input
                type="number"
                min="0"
                value={configForm.price}
                onChange={(e) => setConfigForm({ ...configForm, price: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Prix Annuel (GNF) - Optionnel</Label>
              <Input
                type="number"
                min="0"
                value={configForm.yearlyPrice}
                onChange={(e) => setConfigForm({ ...configForm, yearlyPrice: e.target.value })}
                placeholder={t('driverSubscriptionManagement.laisserVidePourPrixMensuel')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('driverSubscriptionManagement.dureeJours')}</Label>
              <Input
                type="number"
                min="1"
                value={configForm.durationDays}
                onChange={(e) => setConfigForm({ ...configForm, durationDays: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateConfig} disabled={submitting}>
              {submitting ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
