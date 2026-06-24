import { useState, useEffect, Fragment } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SubscriptionService, Plan, PriceHistory } from '@/services/subscriptionService';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { DollarSign, History, TrendingUp, Users, Edit, RefreshCw, Gift, AlertTriangle, Image, Package } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function SubscriptionManagement() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [newMaxProducts, setNewMaxProducts] = useState('');
  const [newMaxImages, setNewMaxImages] = useState('');
  const [reason, setReason] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProductLimitDialogOpen, setIsProductLimitDialogOpen] = useState(false);
  const [isImageLimitDialogOpen, setIsImageLimitDialogOpen] = useState(false);
  const [isFreeSubscriptionDialogOpen, setIsFreeSubscriptionDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [freeSubscriptionData, setFreeSubscriptionData] = useState({
    userId: '',
    planId: '',
    days: ''
  });
  const [isSubscriptionsListOpen, setIsSubscriptionsListOpen] = useState(false);
  const [allSubscriptions, setAllSubscriptions] = useState<any[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
    loadAllSubscriptionsOnMount();
    const cleanup = setupRealtimeSubscription();
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAllSubscriptionsOnMount = async () => {
    try {
      setLoadingSubscriptions(true);

      // 1. Charger les abonnements vendeurs (table subscriptions)
      const { data: vendorSubs, error: vendorError } = await supabase
        .from('subscriptions')
        .select(`
          id,
          user_id,
          plan_id,
          status,
          billing_cycle,
          started_at,
          current_period_end,
          created_at,
          price_paid_gnf,
          plans (display_name, name)
        `)
        .order('created_at', { ascending: false });

      if (vendorError) throw vendorError;

      // 2. Charger les abonnements services (table service_subscriptions)
      const { data: serviceSubs, error: serviceError } = await supabase
        .from('service_subscriptions')
        .select(`
          id,
          user_id,
          plan_id,
          status,
          billing_cycle,
          started_at,
          current_period_end,
          created_at,
          price_paid_gnf,
          professional_service_id,
          service_plans (display_name, name, service_type_id)
        `)
        .order('created_at', { ascending: false });

      if (serviceError) throw serviceError;

      // 3. Normaliser les deux sources
      const normalizedVendor = (vendorSubs || []).map(sub => ({
        ...sub,
        source: 'vendor' as const,
        plan_display: (sub.plans as any)?.display_name || (sub.plans as any)?.name || 'N/A',
      }));

      const normalizedService = (serviceSubs || []).map(sub => ({
        ...sub,
        source: 'service' as const,
        plan_display: (sub.service_plans as any)?.display_name || (sub.service_plans as any)?.name || 'N/A',
      }));

      const allSubs = [...normalizedVendor, ...normalizedService];

      // 4. Récupérer les profils
      const userIds = [...new Set(allSubs.map(sub => sub.user_id))];
      let profiles: any[] = [];
      let vendors: any[] = [];
      let serviceTypes: any[] = [];
      if (userIds.length > 0) {
        const [{ data: profilesData }, { data: vendorsData }, { data: stData }] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, email, first_name, last_name, role')
            .in('id', userIds),
          supabase
            .from('vendors')
            .select('user_id, business_name, business_type')
            .in('user_id', userIds),
          supabase
            .from('service_types')
            .select('id, code, name'),
        ]);
        profiles = profilesData || [];
        vendors = vendorsData || [];
        serviceTypes = stData || [];
      }
      const serviceTypeMap = new Map(serviceTypes.map((s: any) => [s.id, s.name || s.code]));

      // 5. Enrichir avec profils + statut réel calculé
      const enrichedData = allSubs.map(sub => {
        const realStatus = computeRealStatus(sub);
        const vendor = vendors.find(v => v.user_id === sub.user_id);
        const typeLabel = sub.source === 'service'
          ? (serviceTypeMap.get((sub.service_plans as any)?.service_type_id) || 'Service')
          : (vendor?.business_type === 'digital' ? 'Vendeur Digital'
             : vendor?.business_type === 'hybrid' ? 'Vendeur Hybride'
             : 'Boutique');
        return {
          ...sub,
          profiles: profiles.find(p => p.id === sub.user_id),
          vendor_business_name: vendor?.business_name || null,
          vendor_business_type: vendor?.business_type || null,
          acquisition_type: determineAcquisitionType(sub),
          real_status: realStatus,
          type_label: typeLabel,
        };
      });

      // 6. Garder le plus récent par user
      const uniqueSubscriptions = enrichedData.reduce((acc, sub) => {
        const existingIndex = acc.findIndex(s => s.user_id === sub.user_id && s.source === sub.source);

        if (existingIndex === -1) {
          acc.push(sub);
        } else {
          const existingDate = new Date(acc[existingIndex].created_at);
          const currentDate = new Date(sub.created_at);
          if (currentDate > existingDate) {
            acc[existingIndex] = sub;
          }
        }
        return acc;
      }, [] as any[]);

      setAllSubscriptions(uniqueSubscriptions);
    } catch (error) {
      console.error('Error loading subscriptions:', error);
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  // Calculer le statut réel basé sur current_period_end
  const computeRealStatus = (sub: any): 'active' | 'expired' | 'past_due' | 'cancelled' => {
    if (sub.status === 'cancelled') return 'cancelled';
    if (sub.status === 'expired') return 'expired';
    if (sub.status === 'past_due') return 'past_due';

    if (sub.current_period_end) {
      const endDate = new Date(sub.current_period_end);
      const now = new Date();
      if (endDate < now) return 'expired';
    }

    return sub.status || 'active';
  };

  // Déterminer si l'abonnement est offert ou acheté
  const determineAcquisitionType = (sub: any): 'offered' | 'purchased' | 'free' => {
    // Méthode de paiement free_gift = offert par le PDG
    if (sub.payment_method === 'free_gift') return 'offered';
    // Billing cycle custom ou lifetime = offert par le PDG
    if (sub.billing_cycle === 'custom' || sub.billing_cycle === 'lifetime') return 'offered';
    // Prix payé = 0 et pas un plan gratuit de base = offert
    if (sub.price_paid_gnf === 0) {
      const planName = sub.plan_display?.toLowerCase() || sub.plans?.name?.toLowerCase() || '';
      if (planName === 'free' || planName === 'gratuit') return 'free';
      return 'offered';
    }
    return 'purchased';
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansData, historyData, statsData] = await Promise.all([
        SubscriptionService.getPlans(),
        SubscriptionService.getPriceHistory(),
        SubscriptionService.getSubscriptionStats(),
      ]);
      setPlans(plansData);
      setPriceHistory(historyData);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Erreur',
        description: t('subscriptionManagement.impossibleDeChargerLesDonnees'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    // Défensif : retirer un éventuel canal homonyme déjà souscrit (StrictMode / re-render)
    // pour éviter « cannot add postgres_changes callbacks after subscribe() ».
    for (const c of supabase.getChannels()) {
      if (c.topic === 'realtime:subscription_changes') supabase.removeChannel(c);
    }

    const channel = supabase
      .channel('subscription_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
        },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plan_price_history',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const loadAllSubscriptions = async () => {
    await loadAllSubscriptionsOnMount();
  };

  const handleOpenDialog = (plan: Plan) => {
    setSelectedPlan(plan);
    setNewPrice(plan.monthly_price_gnf.toString());
    setReason('');
    setIsDialogOpen(true);
  };

  const handleOpenProductLimitDialog = (plan: Plan) => {
    setSelectedPlan(plan);
    setNewMaxProducts(plan.max_products?.toString() || '');
    setReason('');
    setIsProductLimitDialogOpen(true);
  };

  const handleOpenImageLimitDialog = (plan: Plan) => {
    setSelectedPlan(plan);
    setNewMaxImages(plan.max_images_per_product?.toString() || '');
    setReason('');
    setIsImageLimitDialogOpen(true);
  };

  const handleChangePlanPrice = async () => {
    if (!selectedPlan) return;

    const priceValue = parseInt(newPrice);
    if (isNaN(priceValue) || priceValue < 0) {
      toast({
        title: 'Erreur',
        description: t('subscriptionManagement.veuillezEntrerUnPrixValide'),
        variant: 'destructive',
      });
      return;
    }

    if (priceValue === selectedPlan.monthly_price_gnf) {
      toast({
        title: 'Attention',
        description: t('subscriptionManagement.leNouveauPrixDoitEtre'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const success = await SubscriptionService.changePlanPrice(
        selectedPlan.id,
        priceValue,
        user.id,
        reason || undefined
      );

      if (success) {
        toast({
          title: t('subscriptionManagement.succes'),
          description: `Prix du plan ${selectedPlan.display_name} modifié avec succès`,
        });
        setIsDialogOpen(false);
        fetchData();
      } else {
        throw new Error('Failed to change price');
      }
    } catch (error: any) {
      console.error('Error changing price:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de modifier le prix',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenFreeSubscriptionDialog = () => {
    setFreeSubscriptionData({ userId: '', planId: '', days: '' });
    setIsFreeSubscriptionDialogOpen(true);
  };

  const handleOfferFreeSubscription = async () => {
    if (!freeSubscriptionData.userId || !freeSubscriptionData.planId || !freeSubscriptionData.days) {
      toast({
        title: 'Erreur',
        description: t('subscriptionManagement.veuillezRemplirTousLesChamps'),
        variant: 'destructive',
      });
      return;
    }

    const days = parseInt(freeSubscriptionData.days);
    if (isNaN(days) || days <= 0) {
      toast({
        title: 'Erreur',
        description: t('subscriptionManagement.leNombreDeJoursDoit'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      // Résoudre l'ID utilisateur (accepte UUID ou custom_id)
      let resolvedUserId = freeSubscriptionData.userId;

      // Si ce n'est pas un UUID, chercher dans user_ids
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(freeSubscriptionData.userId)) {
        const { data: userIdData, error: userIdError } = await supabase
          .from('user_ids')
          .select('user_id')
          .eq('custom_id', freeSubscriptionData.userId.toUpperCase())
          .single();

        if (userIdError || !userIdData) {
          throw new Error(`Code utilisateur "${freeSubscriptionData.userId}" non trouvé`);
        }

        resolvedUserId = userIdData.user_id;
      }

      // Calculer la date de fin
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      // Créer l'abonnement gratuit
      const { error } = await supabase.from('subscriptions').insert({
        user_id: resolvedUserId,
        plan_id: freeSubscriptionData.planId,
        price_paid_gnf: 0,
        billing_cycle: 'custom',
        status: 'active',
        started_at: new Date().toISOString(),
        current_period_end: endDate.toISOString(),
        auto_renew: false,
        payment_method: 'free_gift',
      });

      if (error) throw error;

      toast({
        title: t('subscriptionManagement.succes'),
        description: `Abonnement gratuit de ${days} jours offert avec succès`,
      });

      setIsFreeSubscriptionDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error offering free subscription:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de l\'attribution de l\'abonnement',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeProductLimit = async () => {
    if (!selectedPlan) return;

    const productLimit = newMaxProducts === '' ? null : parseInt(newMaxProducts);
    if (productLimit !== null && (isNaN(productLimit) || productLimit < 0)) {
      toast({
        title: 'Erreur',
        description: t('subscriptionManagement.veuillezEntrerUnNombreValide'),
        variant: 'destructive',
      });
      return;
    }

    if (productLimit === selectedPlan.max_products) {
      toast({
        title: 'Attention',
        description: t('subscriptionManagement.laNouvelleLimiteDoitEtre'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('plans')
        .update({
          max_products: productLimit,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedPlan.id);

      if (error) throw error;

      toast({
        title: t('subscriptionManagement.succes'),
        description: `Limite de produits du plan ${selectedPlan.display_name} modifiée avec succès`,
      });
      setIsProductLimitDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error changing product limit:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de modifier la limite',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeImageLimit = async () => {
    if (!selectedPlan) return;

    const imageLimit = newMaxImages === '' ? null : parseInt(newMaxImages);
    if (imageLimit !== null && (isNaN(imageLimit) || imageLimit < 1)) {
      toast({
        title: 'Erreur',
        description: t('subscriptionManagement.veuillezEntrerUnNombreValide2'),
        variant: 'destructive',
      });
      return;
    }

    if (imageLimit === selectedPlan.max_images_per_product) {
      toast({
        title: 'Attention',
        description: t('subscriptionManagement.laNouvelleLimiteDoitEtre'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('plans')
        .update({
          max_images_per_product: imageLimit,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedPlan.id);

      if (error) throw error;

      toast({
        title: t('subscriptionManagement.succes'),
        description: `Limite d'images du plan ${selectedPlan.display_name} modifiée avec succès`,
      });
      setIsImageLimitDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error('Error changing image limit:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de modifier la limite',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Vérifier les incohérences de limites
  const getLimitWarnings = () => {
    const warnings: string[] = [];
    const sortedPlans = [...plans].sort((a, b) => a.monthly_price_gnf - b.monthly_price_gnf);

    for (let i = 1; i < sortedPlans.length; i++) {
      const currentPlan = sortedPlans[i];
      const previousPlan = sortedPlans[i - 1];

      // Vérifier max_products
      if (currentPlan.max_products !== null && previousPlan.max_products !== null) {
        if (currentPlan.max_products < previousPlan.max_products) {
          warnings.push(`${currentPlan.display_name} (${currentPlan.max_products} produits) < ${previousPlan.display_name} (${previousPlan.max_products} produits)`);
        }
      }

      // Vérifier max_images
      if (currentPlan.max_images_per_product !== null && previousPlan.max_images_per_product !== null) {
        if (currentPlan.max_images_per_product < previousPlan.max_images_per_product) {
          warnings.push(`${currentPlan.display_name} (${currentPlan.max_images_per_product} images) < ${previousPlan.display_name} (${previousPlan.max_images_per_product} images)`);
        }
      }
    }

    return warnings;
  };

  // Regroupe les abonnements par type (type de service ou type de vendeur), triés.
  const groupByType = (subs: any[]) => {
    const map = new Map<string, any[]>();
    for (const sub of subs) {
      const key = sub.type_label || 'Autre';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(sub);
    }
    return [...map.entries()]
      .map(([type, rows]) => ({ type, rows }))
      .sort((a, b) => a.type.localeCompare(b.type, 'fr'));
  };

  const renderSubscriptionTable = (subs: any[], title: string, description: string, showExpiredBadge: boolean) => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button onClick={loadAllSubscriptions} variant="outline" size="sm" disabled={loadingSubscriptions}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loadingSubscriptions ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loadingSubscriptions ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3">Chargement...</span>
          </div>
        ) : subs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{showExpiredBadge ? 'Aucun abonnement expiré' : 'Aucun abonnement actif'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">{subs.length} abonnement(s)</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('subscriptionManagement.vendeur')}</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Acquisition</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>{t('subscriptionManagement.debut')}</TableHead>
                  <TableHead>Fin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupByType(subs).map((g) => (
                  <Fragment key={g.type}>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={9} className="py-2 font-semibold text-foreground">
                        {g.type} · {g.rows.length} abonnement(s)
                      </TableCell>
                    </TableRow>
                    {g.rows.map((sub) => (
                  <TableRow key={`${sub.source}-${sub.id}`}>
                    <TableCell className="font-medium">
                      <div className="space-y-1">
                        <div>{sub.profiles?.first_name} {sub.profiles?.last_name}</div>
                        {sub.source === 'vendor' && sub.vendor_business_name && (
                          <div className="text-xs text-muted-foreground">{sub.vendor_business_name}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sub.profiles?.email}
                    </TableCell>
                    <TableCell>
                      {sub.source === 'service' ? (
                        <Badge variant="secondary">{t('subscriptionManagement.service')}</Badge>
                      ) : sub.vendor_business_type === 'digital' ? (
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[#04439e]">{t('subscriptionManagement.vendeurDigital')}</Badge>
                      ) : sub.vendor_business_type === 'hybrid' ? (
                        <Badge variant="outline" className="border-orange-200 bg-orange-50 text-[#ff4000]">{t('subscriptionManagement.vendeurHybride')}</Badge>
                      ) : (
                        <Badge variant="outline">{t('subscriptionManagement.boutique')}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{sub.plan_display}</Badge>
                    </TableCell>
                    <TableCell>
                      {sub.real_status === 'active' ? (
                        <Badge variant="default">✓ Actif</Badge>
                      ) : sub.real_status === 'expired' ? (
                        <Badge variant="destructive">{t('subscriptionManagement.expire')}</Badge>
                      ) : sub.real_status === 'past_due' ? (
                        <Badge variant="destructive">{t('subscriptionManagement.impaye')}</Badge>
                      ) : sub.real_status === 'cancelled' ? (
                        <Badge variant="outline" className="text-muted-foreground">{t('subscriptionManagement.annule')}</Badge>
                      ) : (
                        <Badge variant="outline">{sub.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {sub.acquisition_type === 'offered' ? (
                        <Badge variant="outline" className="border-primary text-primary">🎁 Offert</Badge>
                      ) : sub.acquisition_type === 'free' ? (
                        <Badge variant="outline" className="text-muted-foreground">Gratuit</Badge>
                      ) : (
                        <Badge variant="default">{t('subscriptionManagement.achete')}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {sub.billing_cycle === 'lifetime' ? (
                        <Badge variant="default">{t('subscriptionManagement.aVie')}</Badge>
                      ) : sub.billing_cycle === 'yearly' ? (
                        <Badge variant="outline">Annuel</Badge>
                      ) : sub.billing_cycle === 'custom' ? (
                        <Badge variant="outline">{t('subscriptionManagement.personnalise')}</Badge>
                      ) : (
                        <Badge variant="outline">{sub.billing_cycle || 'Mensuel'}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {sub.started_at ? format(new Date(sub.started_at), 'dd/MM/yyyy', { locale: fr }) : '-'}
                    </TableCell>
                    <TableCell className={`text-sm font-medium ${sub.real_status === 'expired' ? 'text-destructive' : ''}`}>
                      {sub.current_period_end ? format(new Date(sub.current_period_end), 'dd/MM/yyyy', { locale: fr }) : '-'}
                    </TableCell>
                  </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">{t('subscriptionManagement.gestionDesAbonnements')}</h2>
          <p className="text-muted-foreground">
            Gérez les plans, prix et suivez les statistiques d'abonnement
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleOpenFreeSubscriptionDialog} variant="default" size="sm">
            <Gift className="w-4 h-4 mr-2" />
            Offrir Abonnement
          </Button>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Statistiques - Utilise les données chargées */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={loadAllSubscriptions}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Abonnements</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{allSubscriptions.length || stats?.total_subscriptions || 0}</div>
            <p className="text-xs text-muted-foreground">
              {allSubscriptions.filter(s => s.real_status === 'active').length || stats?.active_subscriptions || 0} actifs · {allSubscriptions.filter(s => s.real_status === 'expired').length} expirés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenus Totaux</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {SubscriptionService.formatAmount(
                allSubscriptions.reduce((sum, s) => sum + (s.price_paid_gnf || 0), 0) || stats?.total_revenue || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t('subscriptionManagement.tousLesAbonnements')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">🎁 Offerts</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {allSubscriptions.filter(s => s.acquisition_type === 'offered').length}
            </div>
            <p className="text-xs text-muted-foreground">Abonnements gratuits offerts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('subscriptionManagement.achetes')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {allSubscriptions.filter(s => s.acquisition_type === 'purchased').length}
            </div>
            <p className="text-xs text-muted-foreground">Abonnements payants</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerte pour les incohérences de limites */}
      {getLimitWarnings().length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('subscriptionManagement.incoherencesDetecteesDansLesLimites')}</AlertTitle>
          <AlertDescription>
            <p className="mb-2">{t('subscriptionManagement.lesPlansMoinsChersOnt')}</p>
            <ul className="list-disc list-inside space-y-1">
              {getLimitWarnings().map((warning, idx) => (
                <li key={idx} className="text-sm">{warning}</li>
              ))}
            </ul>
            <p className="mt-2 font-medium">{t('subscriptionManagement.cliquezSurLesBoutonsD')}</p>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">
            ✅ Actifs ({allSubscriptions.filter(s => s.real_status === 'active').length})
          </TabsTrigger>
          <TabsTrigger value="expired">
            ⛔ Expirés ({allSubscriptions.filter(s => s.real_status !== 'active').length})
          </TabsTrigger>
          <TabsTrigger value="plans">{t('subscriptionManagement.plansEtPrix')}</TabsTrigger>
          <TabsTrigger value="history">{t('subscriptionManagement.historiqueDesPrix')}</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {renderSubscriptionTable(
            allSubscriptions.filter(s => s.real_status === 'active'),
            'Abonnements Actifs',
            'Vendeurs avec un abonnement en cours de validité',
            false
          )}
        </TabsContent>

        <TabsContent value="expired" className="space-y-4">
          {renderSubscriptionTable(
            allSubscriptions.filter(s => s.real_status !== 'active'),
            'Abonnements Expirés / Inactifs',
            'Vendeurs dont l\'abonnement a expiré, est annulé ou impayé',
            true
          )}
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Plans d'Abonnement</CardTitle>
              <CardDescription>
                Gérez les prix, limites de produits et images de chaque plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Prix Mensuel</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Package className="w-4 h-4" />
                        Produits Max
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Image className="w-4 h-4" />
                        Images/Produit
                      </div>
                    </TableHead>
                    <TableHead>{t('subscriptionManagement.fonctionnalites')}</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan, index) => {
                    const prevPlan = index > 0 ? plans[index - 1] : null;
                    const hasProductWarning = prevPlan &&
                      plan.max_products !== null &&
                      prevPlan.max_products !== null &&
                      plan.max_products < prevPlan.max_products;
                    const hasImageWarning = prevPlan &&
                      plan.max_images_per_product !== null &&
                      prevPlan.max_images_per_product !== null &&
                      plan.max_images_per_product < prevPlan.max_images_per_product;

                    return (
                      <TableRow key={plan.id} className={hasProductWarning || hasImageWarning ? 'bg-destructive/10' : ''}>
                        <TableCell className="font-medium">{plan.display_name}</TableCell>
                        <TableCell>
                          {SubscriptionService.formatAmount(plan.monthly_price_gnf)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {plan.max_products === null ? (
                              <Badge variant="secondary">{t('subscriptionManagement.illimite')}</Badge>
                            ) : (
                              <span className={`font-medium ${hasProductWarning ? 'text-destructive' : ''}`}>
                                {plan.max_products}
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenProductLimitDialog(plan)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {plan.max_images_per_product === null ? (
                              <Badge variant="secondary">{t('subscriptionManagement.illimite')}</Badge>
                            ) : (
                              <span className={`font-medium ${hasImageWarning ? 'text-destructive' : ''}`}>
                                {plan.max_images_per_product}
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenImageLimitDialog(plan)}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {plan.analytics_access && <Badge variant="outline">Analytics</Badge>}
                            {plan.priority_support && <Badge variant="outline">Support Pro</Badge>}
                            {plan.featured_products && <Badge variant="outline">Vedette</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDialog(plan)}
                            disabled={plan.name === 'free'}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Modifier Prix
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('subscriptionManagement.historiqueDesChangementsDePrix')}</CardTitle>
              <CardDescription>
                Consultez l'historique complet des modifications de prix
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Ancien Prix</TableHead>
                    <TableHead>{t('subscriptionManagement.nouveauPrix')}</TableHead>
                    <TableHead>Raison</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priceHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Aucun changement de prix enregistré
                      </TableCell>
                    </TableRow>
                  ) : (
                    priceHistory.map((history) => {
                      const plan = plans.find((p) => p.id === history.plan_id);
                      return (
                        <TableRow key={history.id}>
                          <TableCell>
                            {format(new Date(history.changed_at), 'Pp', { locale: fr })}
                          </TableCell>
                          <TableCell className="font-medium">
                            {plan?.display_name || 'Plan inconnu'}
                          </TableCell>
                          <TableCell>
                            {SubscriptionService.formatAmount(history.old_price)}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {SubscriptionService.formatAmount(history.new_price)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {history.reason || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog pour modifier le prix */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('subscriptionManagement.modifierLePrixDuPlan')}</DialogTitle>
            <DialogDescription>
              {selectedPlan && `Plan: ${selectedPlan.display_name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPrice">{t('subscriptionManagement.nouveauPrixGnf')}</Label>
              <Input
                id="newPrice"
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder={t('subscriptionManagement.entrezLeNouveauPrix')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">{t('subscriptionManagement.raisonDuChangement')}</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('subscriptionManagement.expliquezLaRaisonDeCe')}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleChangePlanPrice} disabled={submitting}>
              {submitting ? 'Modification...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pour modifier la limite de produits */}
      <Dialog open={isProductLimitDialogOpen} onOpenChange={setIsProductLimitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('subscriptionManagement.modifierLaLimiteDeProduits')}</DialogTitle>
            <DialogDescription>
              {selectedPlan && `Plan: ${selectedPlan.display_name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="maxProducts">{t('subscriptionManagement.nombreMaximumDeProduits')}</Label>
              <Input
                id="maxProducts"
                type="number"
                value={newMaxProducts}
                onChange={(e) => setNewMaxProducts(e.target.value)}
                placeholder={t('subscriptionManagement.laissezVidePourIllimite')}
              />
              <p className="text-xs text-muted-foreground">
                Laissez le champ vide pour autoriser un nombre illimité de produits
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reasonProducts">{t('subscriptionManagement.raisonDuChangementOptionnel')}</Label>
              <Textarea
                id="reasonProducts"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('subscriptionManagement.expliquezLaRaisonDeCe')}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProductLimitDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleChangeProductLimit} disabled={submitting}>
              {submitting ? 'Modification...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pour modifier la limite d'images */}
      <Dialog open={isImageLimitDialogOpen} onOpenChange={setIsImageLimitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('subscriptionManagement.modifierLaLimiteDImages')}</DialogTitle>
            <DialogDescription>
              {selectedPlan && `Plan: ${selectedPlan.display_name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="maxImages">{t('subscriptionManagement.nombreMaximumDImagesPar')}</Label>
              <Input
                id="maxImages"
                type="number"
                min="1"
                value={newMaxImages}
                onChange={(e) => setNewMaxImages(e.target.value)}
                placeholder="Ex: 3, 5, 10"
              />
              <p className="text-xs text-muted-foreground">
                Nombre d'images qu'un vendeur peut ajouter par produit (minimum 1)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reasonImages">{t('subscriptionManagement.raisonDuChangementOptionnel')}</Label>
              <Textarea
                id="reasonImages"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('subscriptionManagement.expliquezLaRaisonDeCe')}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImageLimitDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleChangeImageLimit} disabled={submitting}>
              {submitting ? 'Modification...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pour offrir un abonnement gratuit */}
      <Dialog open={isFreeSubscriptionDialogOpen} onOpenChange={setIsFreeSubscriptionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('subscriptionManagement.offrirUnAbonnementGratuit')}</DialogTitle>
            <DialogDescription>
              Attribuez un abonnement gratuit à un utilisateur pour une durée déterminée
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="userId">ID Utilisateur</Label>
              <Input
                id="userId"
                type="text"
                value={freeSubscriptionData.userId}
                onChange={(e) => setFreeSubscriptionData({ ...freeSubscriptionData, userId: e.target.value })}
                placeholder={t('subscriptionManagement.uuidDeLUtilisateur')}
              />
              <p className="text-xs text-muted-foreground">
                L'identifiant unique de l'utilisateur (UUID)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="planSelect">Plan d'Abonnement</Label>
              <select
                id="planSelect"
                className="w-full px-3 py-2 border border-input bg-background rounded-md"
                value={freeSubscriptionData.planId}
                onChange={(e) => setFreeSubscriptionData({ ...freeSubscriptionData, planId: e.target.value })}
              >
                <option value="">{t('subscriptionManagement.selectionnezUnPlan')}</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.display_name} - {SubscriptionService.formatAmount(plan.monthly_price_gnf)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="days">{t('subscriptionManagement.nombreDeJours')}</Label>
              <Input
                id="days"
                type="number"
                value={freeSubscriptionData.days}
                onChange={(e) => setFreeSubscriptionData({ ...freeSubscriptionData, days: e.target.value })}
                placeholder="Ex: 30, 60, 90"
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                Durée de l'abonnement gratuit en jours
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFreeSubscriptionDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleOfferFreeSubscription} disabled={submitting}>
              {submitting ? 'Attribution...' : 'Offrir l\'Abonnement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Liste des Abonnements */}
      <Dialog open={isSubscriptionsListOpen} onOpenChange={setIsSubscriptionsListOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('subscriptionManagement.listeDesAbonnements')}</DialogTitle>
            <DialogDescription>
              {allSubscriptions.length} abonnement(s) au total
            </DialogDescription>
          </DialogHeader>

          {loadingSubscriptions ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-3">Chargement...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>{t('subscriptionManagement.role')}</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>{t('subscriptionManagement.debut')}</TableHead>
                    <TableHead>Fin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSubscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">
                        {sub.profiles?.first_name} {sub.profiles?.last_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sub.profiles?.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{sub.profiles?.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{sub.plans?.display_name}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sub.status === 'active' ? 'default' : 'destructive'}>
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sub.billing_cycle === 'lifetime' ? (
                          <Badge variant="default" className="bg-primary text-primary-foreground">
                            🎁 Offert
                          </Badge>
                        ) : (
                          <span className="text-sm">{sub.billing_cycle}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sub.started_at ? format(new Date(sub.started_at), 'dd/MM/yyyy', { locale: fr }) : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sub.current_period_end ? format(new Date(sub.current_period_end), 'dd/MM/yyyy', { locale: fr }) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
