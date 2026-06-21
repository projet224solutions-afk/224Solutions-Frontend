/**
 * PAGE DE LIVRAISON CÔTÉ CLIENT
 * Commander une livraison et suivre en temps réel
 */

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Package, MapPin, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientDeliveryRequest } from '@/components/delivery/ClientDeliveryRequest';
import { DeliveryStatusTracker } from '@/components/delivery/DeliveryStatusTracker';
const ClientDeliveryTracking = React.lazy(() => import('@/components/delivery/ClientDeliveryTracking').then(m => ({ default: m.ClientDeliveryTracking })));
import { useAuth } from '@/hooks/useAuth';

export default function ClientDelivery() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const trackingId = searchParams.get('track');
  const [activeTab, setActiveTab] = useState(trackingId ? 'tracking' : 'order');
  const [createdDeliveryId, setCreatedDeliveryId] = useState<string | null>(null);

  const handleDeliveryCreated = (deliveryId: string) => {
    setCreatedDeliveryId(deliveryId);
    setActiveTab('tracking');
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
                Livraison Express
              </h1>
              <p className="text-sm text-muted-foreground">
                224Solutions - Livraison rapide et fiable
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="container max-w-2xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="order" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Commander
            </TabsTrigger>
            <TabsTrigger value="tracking" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Suivre
            </TabsTrigger>
          </TabsList>

          <TabsContent value="order">
            <ClientDeliveryRequest onDeliveryCreated={handleDeliveryCreated} />
          </TabsContent>

          <TabsContent value="tracking">
            {createdDeliveryId || trackingId ? (
              <DeliveryStatusTracker
                deliveryId={createdDeliveryId || trackingId!}
                userRole="client"
              />
            ) : (
              <ClientDeliveryTracking deliveryId="" />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
