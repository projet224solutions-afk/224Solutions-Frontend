/**
 * ROUTEUR INTELLIGENT TAXI
 * Redirige automatiquement vers l'interface appropriée selon le rôle et taxi_category
 * - Taxi voiture → /taxi/car/driver
 * - Taxi moto → /taxi-moto/driver
 * - Clients/autres → /proximite/taxi-moto
 */

import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function TaxiMotoRouter() {
  const { t } = useTranslation();
  const { profile, user, loading, profileLoading } = useAuth();
  const navigate = useNavigate();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    if (hasRedirected) return;
    if (loading || profileLoading) return;

    setHasRedirected(true);

    if (profile?.role === 'taxi') {
      // Vérifier taxi_category pour router vers le bon dashboard
      const checkTaxiCategory = async () => {
        if (!user?.id) {
          navigate('/taxi-moto/driver', { replace: true });
          return;
        }

        try {
          const { data } = await supabase
            .from('taxi_drivers')
            .select('taxi_category')
            .eq('user_id', user.id)
            .maybeSingle();

          if (data?.taxi_category === 'car') {
            navigate('/taxi/car/driver', { replace: true });
          } else {
            // Par défaut ou motorcycle → interface moto existante
            navigate('/taxi-moto/driver', { replace: true });
          }
        } catch {
          navigate('/taxi-moto/driver', { replace: true });
        }
      };

      checkTaxiCategory();
    } else {
      // Clients et autres rôles → interface de réservation
      navigate('/taxi-moto', { replace: true });
    }
  }, [profile, user, loading, profileLoading, navigate, hasRedirected]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">{t('taxiMotoRouter.chargementDeVotreInterface')}</p>
      </div>
    </div>
  );
}
