/**
 * SUIVI DES STATUTS DE LIVRAISON EN TEMPS RÉEL
 * Affiche la timeline complète avec notifications automatiques
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Truck,
  Store,
  Package,
  MapPin,
  CheckCircle2,
  Clock,
  Navigation,
  Phone,
  MessageCircle,
  User,
  Bell
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DeliveryStatus {
  id: string;
  status: string;
  driver_name?: string;
  driver_phone?: string;
  driver_location?: { lat: number; lng: number };
  vendor_name?: string;
  vendor_address?: string;
  delivery_address?: string;
  estimated_time_minutes?: number;
  created_at: string;
  updated_at?: string;
}

interface StatusStep {
  key: string;
  label: string;
  icon: typeof Truck;
  description: string;
}

const STATUS_STEPS: StatusStep[] = [
  { key: 'assigned', label: 'Livreur assigné', icon: User, description: 'Un livreur a accepté votre commande' },
  { key: 'driver_on_way_to_vendor', label: 'En route vers le vendeur', icon: Navigation, description: 'Le livreur se dirige vers le point de retrait' },
  { key: 'driver_arrived_vendor', label: 'Arrivé chez le vendeur', icon: Store, description: 'Le livreur est arrivé pour récupérer le colis' },
  { key: 'picked_up', label: 'Colis récupéré', icon: Package, description: 'Le colis a été récupéré' },
  { key: 'in_transit', label: 'En route vers vous', icon: Truck, description: 'Le livreur est en chemin' },
  { key: 'driver_5min_away', label: 'À 5 minutes', icon: Clock, description: 'Le livreur arrive dans environ 5 minutes' },
  { key: 'driver_arrived', label: 'Livreur arrivé', icon: MapPin, description: 'Le livreur est à votre porte' },
  { key: 'delivered', label: 'Livré', icon: CheckCircle2, description: 'Votre colis a été livré avec succès' }
];

interface DeliveryStatusTrackerProps {
  deliveryId: string;
  userRole: 'client' | 'vendor' | 'driver';
}

export function DeliveryStatusTracker({ deliveryId, userRole }: DeliveryStatusTrackerProps) {
  const { t } = useTranslation();
  const [delivery, setDelivery] = useState<DeliveryStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Charger les données de livraison
  const loadDelivery = async () => {
    try {
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('id', deliveryId)
        .single();

      if (error) throw error;
      setDelivery(data as DeliveryStatus);
    } catch (error) {
      console.error('Error loading delivery:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDelivery();

    // Souscription temps réel
    const channel = supabase
      .channel(`delivery-${deliveryId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: `id=eq.${deliveryId}`
        },
        (payload) => {
          console.log('Delivery status update:', payload);
          setDelivery(payload.new as DeliveryStatus);

          // Notification sonore
          if ('Notification' in window && Notification.permission === 'granted') {
            const statusLabel = STATUS_STEPS.find(s => s.key === (payload.new as any).status)?.label;
            new Notification('224Solutions Livraison', {
              body: statusLabel || 'Mise à jour de votre livraison',
              icon: '/favicon.ico'
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryId]);

  const getCurrentStepIndex = () => {
    if (!delivery) return -1;
    return STATUS_STEPS.findIndex(s => s.key === delivery.status);
  };

  const currentStepIndex = getCurrentStepIndex();

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4 mx-auto" />
            <div className="h-4 bg-muted rounded w-1/2 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!delivery) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Livraison introuvable
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Statut actuel */}
      <Card className="border-2 border-orange-500 bg-gradient-to-br from-orange-50 to-orange-50 dark:from-orange-950/20 dark:to-[#ff4000]/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t('deliveryStatusTracker.suiviDeLivraison')}</CardTitle>
            <Badge variant="outline" className="animate-pulse">
              <Bell className="h-3 w-3 mr-1" />
              En temps réel
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {currentStepIndex >= 0 && (
            <div className="flex items-center gap-4 p-4 bg-white/80 dark:bg-background/80 rounded-lg">
              {(() => {
                const CurrentIcon = STATUS_STEPS[currentStepIndex].icon;
                return <CurrentIcon className="h-8 w-8 text-orange-600" />;
              })()}
              <div>
                <p className="font-bold text-lg">{STATUS_STEPS[currentStepIndex].label}</p>
                <p className="text-sm text-muted-foreground">{STATUS_STEPS[currentStepIndex].description}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Informations livreur */}
      {delivery.driver_name && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <User className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium">{delivery.driver_name}</p>
                  <p className="text-sm text-muted-foreground">{t('deliveryStatusTracker.votreLivreur')}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {delivery.driver_phone && (
                  <Button variant="outline" size="icon" asChild>
                    <a href={`tel:${delivery.driver_phone}`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="icon">
                  <MessageCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progression</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {STATUS_STEPS.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <div key={step.key} className="flex gap-3">
                  {/* Ligne verticale et icône */}
                  <div className="flex flex-col items-center">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center
                      ${isCompleted
                        ? 'bg-[#ff4000] text-white'
                        : 'bg-muted text-muted-foreground'}
                      ${isCurrent ? 'ring-2 ring-[#ff4000] ring-offset-2' : ''}
                    `}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {index < STATUS_STEPS.length - 1 && (
                      <div className={`w-0.5 h-8 ${isCompleted ? 'bg-[#ff4000]' : 'bg-muted'}`} />
                    )}
                  </div>

                  {/* Contenu */}
                  <div className={`pb-6 ${isCurrent ? 'font-medium' : ''}`}>
                    <p className={isCompleted ? 'text-foreground' : 'text-muted-foreground'}>
                      {step.label}
                    </p>
                    {isCurrent && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Adresses */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-start gap-3">
            <Store className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">{t('deliveryStatusTracker.pointDeRetrait')}</p>
              <p className="font-medium">{delivery.vendor_name || 'Vendeur'}</p>
              <p className="text-sm">{delivery.vendor_address}</p>
            </div>
          </div>
          <div className="border-l-2 border-dashed ml-2 h-4" />
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-[#ff4000] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Destination</p>
              <p className="font-medium">{delivery.delivery_address}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
