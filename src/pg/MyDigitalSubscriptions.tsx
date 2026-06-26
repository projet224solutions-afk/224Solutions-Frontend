/**
 * 📋 MES ABONNEMENTS NUMÉRIQUES
 * Page de gestion des abonnements récurrents aux produits digitaux
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft, RefreshCw, Calendar, CreditCard, XCircle,
  CheckCircle, Clock, AlertTriangle, Package, TrendingUp, Download
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface DigitalSubscription {
  id: string;
  product_id: string;
  buyer_id: string;
  merchant_id: string;
  status: string;
  billing_cycle: string;
  amount_per_period: number;
  currency: string;
  current_period_start: string;
  current_period_end: string;
  next_billing_date: string | null;
  auto_renew: boolean;
  total_payments_made: number;
  total_amount_paid: number;
  last_payment_at: string | null;
  failed_payment_count: number;
  cancelled_at: string | null;
  created_at: string;
  product_title?: string;
  product_image?: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  active: { label: 'Actif', color: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20', icon: CheckCircle },
  past_due: { label: "Paiement en retard", color: 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20', icon: AlertTriangle },
  cancelled: { label: "Annulé", color: 'bg-muted text-muted-foreground border-border', icon: XCircle },
  expired: { label: "Expiré", color: 'bg-destructive/10 text-destructive border-destructive/20', icon: Clock },
  paused: { label: 'Suspendu', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Clock },
};

const cycleLabels: Record<string, string> = {
  monthly: 'Mensuel',
  yearly: 'Annuel',
  lifetime: 'À vie',
};

export default function MyDigitalSubscriptions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<DigitalSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (user?.id) loadSubscriptions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadSubscriptions = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('digital_subscriptions')
        .select('*')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrichir avec les infos produit
      const enriched: DigitalSubscription[] = [];
      for (const sub of (data || [])) {
        const { data: product } = await supabase
          .from('digital_products')
          .select('title, images')
          .eq('id', sub.product_id)
          .maybeSingle();

        enriched.push({
          ...sub,
          product_title: product?.title || 'Produit inconnu',
          product_image: product?.images?.[0] || undefined,
        });
      }

      setSubscriptions(enriched);
    } catch (error) {
      console.error('Erreur chargement abonnements:', error);
      toast({ variant: 'destructive', title: 'Erreur', description: t('myDigitalSubscriptions.impossibleDeChargerVosAbonnements') });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedSubId) return;
    try {
      setCancelling(true);
      const { error } = await supabase
        .from('digital_subscriptions')
        .update({
          status: 'cancelled',
          auto_renew: false,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedSubId)
        .eq('buyer_id', user!.id);

      if (error) throw error;

      toast({ title: t('myDigitalSubscriptions.abonnementAnnule'), description: t('myDigitalSubscriptions.vousGardezLAccesJusqu') });
      setCancelDialogOpen(false);
      setSelectedSubId(null);
      await loadSubscriptions();
    } catch (_error) {
      toast({ variant: 'destructive', title: 'Erreur', description: t('myDigitalSubscriptions.impossibleDAnnulerLAbonnement') });
    } finally {
      setCancelling(false);
    }
  };

  const handleToggleAutoRenew = async (subId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('digital_subscriptions')
        .update({ auto_renew: !currentValue, updated_at: new Date().toISOString() })
        .eq('id', subId)
        .eq('buyer_id', user!.id);

      if (error) throw error;
      toast({ title: currentValue ? 'Renouvellement désactivé' : 'Renouvellement activé' });
      await loadSubscriptions();
    } catch {
      toast({ variant: 'destructive', title: 'Erreur' });
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const getDaysRemaining = (endDate: string) => {
    const diff = new Date(endDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const activeCount = subscriptions.filter(s => s.status === 'active').length;
  const totalMonthly = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.billing_cycle === 'yearly' ? s.amount_per_period / 12 : s.amount_per_period), 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Mes Abonnements</h1>
            <p className="text-sm text-muted-foreground">{t('myDigitalSubscriptions.gerezVosAbonnementsAuxProduits')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadSubscriptions} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Abonnement{activeCount > 1 ? 's' : ''} actif{activeCount > 1 ? 's' : ''}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{Math.round(totalMonthly).toLocaleString('fr-FR')}</p>
                <p className="text-xs text-muted-foreground">GNF/mois estimé</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
          </div>
        ) : subscriptions.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center space-y-4">
              <Package className="w-16 h-16 mx-auto text-muted-foreground/30" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">{t('myDigitalSubscriptions.aucunAbonnement')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Explorez les produits numériques avec abonnement sur le marketplace
                </p>
              </div>
              <Button onClick={() => navigate('/marketplace')} className="mt-2">
                Explorer le marketplace
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {subscriptions.map(sub => {
              const status = statusConfig[sub.status] || statusConfig.expired;
              const StatusIcon = status.icon;
              const daysLeft = sub.current_period_end ? getDaysRemaining(sub.current_period_end) : 0;
              const isActive = sub.status === 'active';

              return (
                <Card key={sub.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex gap-4 p-4">
                      {/* Image */}
                      {sub.product_image ? (
                        <img
                          src={sub.product_image}
                          alt={sub.product_title}
                          className="w-20 h-20 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Package className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-foreground truncate">{sub.product_title}</h3>
                          <Badge variant="outline" className={status.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {status.label}
                          </Badge>
                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <CreditCard className="w-3 h-3" />
                            <span>{sub.amount_per_period.toLocaleString('fr-FR')} {sub.currency} / {cycleLabels[sub.billing_cycle]?.toLowerCase() || sub.billing_cycle}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>Prochain : {sub.next_billing_date ? formatDate(sub.next_billing_date) : 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            <span>{sub.total_payments_made} paiement{sub.total_payments_made > 1 ? 's' : ''} effectué{sub.total_payments_made > 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{isActive ? `${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}` : 'Inactif'}</span>
                          </div>
                        </div>

                        {/* Progress bar pour les jours restants */}
                        {isActive && sub.billing_cycle === 'monthly' && (
                          <div className="mt-2">
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div
                                className="bg-primary rounded-full h-1.5 transition-all"
                                style={{ width: `${Math.min(100, (daysLeft / 30) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {isActive && (
                      <div className="border-t border-border px-4 py-3 flex items-center gap-2 bg-muted/30">
                        <Button
                          size="sm"
                          onClick={() => navigate(`/digital-purchase/${sub.product_id}`)}
                          className="text-xs"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Accéder au contenu
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleAutoRenew(sub.id, sub.auto_renew)}
                          className="text-xs"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          {sub.auto_renew ? 'Désactiver' : 'Activer'} renouvellement
                        </Button>
                        <div className="flex-1" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-destructive hover:text-destructive"
                          onClick={() => {
                            setSelectedSubId(sub.id);
                            setCancelDialogOpen(true);
                          }}
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Annuler
                        </Button>
                      </div>
                    )}

                    {sub.status === 'cancelled' && sub.current_period_end && new Date(sub.current_period_end) > new Date() && (
                      <div className="border-t border-border px-4 py-2 bg-[#ff4000]/5">
                        <p className="text-xs text-[#ff4000]">
                          Accès maintenu jusqu'au {formatDate(sub.current_period_end)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('myDigitalSubscriptions.annulerCetAbonnement')}</AlertDialogTitle>
            <AlertDialogDescription>
              Vous garderez l'accès au contenu jusqu'à la fin de la période en cours.
              Aucun remboursement ne sera effectué pour la période déjà payée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Garder l'abonnement</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? 'Annulation...' : 'Confirmer l\'annulation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
