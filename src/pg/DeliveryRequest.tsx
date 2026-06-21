/**
 * PAGE DE DEMANDE DE LIVRAISON
 * Interface client pour créer une nouvelle livraison
 */

import {} from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeliveryRequestById } from '@/components/delivery/DeliveryRequestById';

export default function DeliveryRequest() {
  const navigate = useNavigate();

  const handleDeliveryCreated = (deliveryId: string) => {
    // Rediriger vers le tracking après création
    navigate(`/tracking?id=${deliveryId}`);
  };

  return (
    <div className="min-h-screen bg-orange-500/5/5">
      {/* En-tête */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="container max-w-2xl mx-auto px-4 py-4">
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
                Nouvelle Livraison
              </h1>
              <p className="text-sm text-muted-foreground">
                224Solutions Delivery
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <DeliveryRequestById onDeliveryCreated={handleDeliveryCreated} />
      </div>
    </div>
  );
}
