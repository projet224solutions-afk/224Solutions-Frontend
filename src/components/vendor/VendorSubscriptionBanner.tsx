/**
 * Bannière compacte d'abonnement vendeur
 * Affiche les infos essentielles en haut de la page
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { VendorSubscriptionPlanSelector } from "./VendorSubscriptionPlanSelector";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface SubscriptionData {
  id: string | null;
  plan_name: string;
  status: string;
  end_date: string | null;
  days_remaining: number;
}

export function VendorSubscriptionBanner() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPlanSelector, setShowPlanSelector] = useState(false);

  // Ne pas afficher si l'utilisateur n'est pas vendeur
  const isVendor = profile?.role === 'vendeur';

  useEffect(() => {
    if (user?.id && isVendor) {
      loadSubscription();
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isVendor]);

  const loadSubscription = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Chercher l'abonnement actif du vendeur
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          id,
          status,
          current_period_end,
          plans (
            name,
            display_name
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[VendorSubscriptionBanner] Erreur:', error);
        // Aucun abonnement = expiré
        setSubscription({
          id: null,
          plan_name: 'Aucun',
          status: 'expired',
          end_date: null,
          days_remaining: 0
        });
        return;
      }

      if (data) {
        const endDate = data.current_period_end ? new Date(data.current_period_end) : null;
        const now = new Date();
        const daysRemaining = endDate
          ? Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        // Vérifier si l'abonnement est vraiment actif (date de fin dans le futur)
        const isReallyActive = data.status === 'active' && endDate && endDate > now;

        setSubscription({
          id: data.id,
          plan_name: data.plans?.display_name || data.plans?.name || 'Inconnu',
          status: isReallyActive ? 'active' : 'expired',
          end_date: data.current_period_end,
          days_remaining: Math.max(0, daysRemaining)
        });
      } else {
        // Aucun abonnement trouvé = expiré/non souscrit
        setSubscription({
          id: null,
          plan_name: 'Aucun',
          status: 'expired',
          end_date: null,
          days_remaining: 0
        });
      }
    } catch (error) {
      console.error('[VendorSubscriptionBanner] Exception:', error);
      // En cas d'erreur, considérer comme expiré
      setSubscription({
        id: null,
        plan_name: 'Aucun',
        status: 'expired',
        end_date: null,
        days_remaining: 0
      });
    } finally {
      setLoading(false);
    }
  };

  // Ne rien afficher si non-vendeur ou en chargement
  if (!isVendor || loading) return null;

  const isActive = subscription?.status === 'active';
  const isExpired = subscription?.status === 'expired';
  const isExpiringSoon = subscription?.days_remaining !== undefined && subscription.days_remaining <= 7 && subscription.days_remaining > 0;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: fr });
    } catch {
      return 'N/A';
    }
  };

  return (
    <>
      <Card className={`mb-6 border-2 ${
        isExpired
          ? 'border-destructive bg-destructive/5'
          : isExpiringSoon
            ? 'border-orange-400 bg-orange-50'
            : 'border-[#ff4000] bg-gradient-to-r from-primary/5 to-blue-50'
      }`}>
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Titre et icône */}
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                isActive ? 'bg-primary/10' : 'bg-destructive/10'
              }`}>
                <Calendar className={`w-5 h-5 ${
                  isActive ? 'text-primary' : 'text-destructive'
                }`} />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-black">📅 Mon Abonnement</h3>
              </div>
            </div>

            {/* Infos principales */}
            <div className="flex flex-wrap items-center gap-6">
              {/* Statut */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-black font-medium">Statut</span>
                <Badge
                  variant={isActive ? "default" : "destructive"}
                  className="gap-1"
                >
                  {isActive ? (
                    <>
                      <CheckCircle className="w-3 h-3" />
                      Actif
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" />
                      Expiré
                    </>
                  )}
                </Badge>
              </div>

              {/* Plan */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-black font-medium">Plan actuel</span>
                <span className="font-semibold text-primary">{subscription?.plan_name || 'Premium'}</span>
              </div>

              {/* Date de fin */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-black font-medium">{t('vendorSubscriptionBanner.dateDeFin')}</span>
                <span className="font-medium text-black">{formatDate(subscription?.end_date || null)}</span>
              </div>

              {/* Jours restants */}
              {subscription?.days_remaining !== undefined && subscription.days_remaining > 0 && (
                <Badge
                  variant="outline"
                  className={`gap-1 ${
                    isExpiringSoon
                      ? 'border-orange-400 text-orange-700 bg-orange-100'
                      : 'border-blue-400 text-blue-700 bg-blue-100'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  J-{subscription.days_remaining}
                </Badge>
              )}
            </div>

            {/* Bouton */}
            <Button
              variant={isExpired ? "destructive" : "outline"}
              size="sm"
              onClick={() => setShowPlanSelector(true)}
            >
              {isExpired ? 'Renouveler' : 'Gérer'}
            </Button>
          </div>

          {/* Alerte expiration imminente */}
          {isExpiringSoon && !isExpired && (
            <div className="mt-3 flex items-center gap-2 text-orange-700 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>Votre abonnement expire dans {subscription?.days_remaining} jour{(subscription?.days_remaining || 0) > 1 ? 's' : ''}. Pensez à le renouveler.</span>
            </div>
          )}
        </CardContent>
      </Card>

      <VendorSubscriptionPlanSelector
        open={showPlanSelector}
        onOpenChange={setShowPlanSelector}
        onSuccess={loadSubscription}
      />
    </>
  );
}
