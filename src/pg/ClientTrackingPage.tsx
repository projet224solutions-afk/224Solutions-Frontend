/**
 * PAGE DE SUIVI CLIENT
 * Le client suit sa livraison en temps réel
 */

import React, {} from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
const ClientDeliveryTracking = React.lazy(() => import('@/components/delivery/ClientDeliveryTracking').then(m => ({ default: m.ClientDeliveryTracking })));

export default function ClientTrackingPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const deliveryId = searchParams.get('id');

  if (!deliveryId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">{t('clientTrackingPage.idDeLivraisonManquant')}</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#ff4000]/5">
      {/* En-tête */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold bg-orange-600 bg-clip-text text-transparent">
                Suivi de livraison
              </h1>
              <p className="text-sm text-muted-foreground">
                224Solutions Delivery
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <ClientDeliveryTracking deliveryId={deliveryId} />
      </div>
    </div>
  );
}
