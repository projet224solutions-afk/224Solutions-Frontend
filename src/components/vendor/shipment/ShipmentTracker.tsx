/**
 * SUIVI DÉTAILLÉ D'UNE EXPÉDITION
 * Vue complète avec timeline et mises à jour en temps réel
 */

import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, User, MapPin, Phone, Copy, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ShipmentTimeline } from './ShipmentTimeline';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ShipmentTrackerProps {
  shipmentId: string;
  onBack: () => void;
}

interface ShipmentDetails {
  id: string;
  tracking_number: string;
  sender_name: string;
  sender_phone: string;
  sender_address: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  weight: number;
  pieces_count: number;
  item_type?: string;
  package_description?: string;
  cash_on_delivery: boolean;
  cod_amount?: number;
  insurance: boolean;
  insurance_amount?: number;
  return_option: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TrackingEvent {
  id: string;
  status: string;
  timestamp: string;
  location?: string;
  notes?: string;
}

export function ShipmentTracker({ shipmentId, onBack }: ShipmentTrackerProps) {
  const { t } = useTranslation();
  const [shipment, setShipment] = useState<ShipmentDetails | null>(null);
  const [trackingHistory, setTrackingHistory] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadShipmentData();

    // Configuration du temps réel pour les mises à jour de statut
    const channel = supabase
      .channel('shipment-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shipments',
          filter: `id=eq.${shipmentId}`,
        },
        (payload) => {
          console.log('Shipment updated:', payload);
          if (payload.new) {
            setShipment(payload.new as any);
            toast.success(t('shipmentTracker.statutMisAJourEn'));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shipment_tracking',
          filter: `shipment_id=eq.${shipmentId}`,
        },
        (payload) => {
          console.log('New tracking event:', payload);
          if (payload.new) {
            setTrackingHistory(prev => [payload.new as any, ...prev]);
            toast.info(t('shipmentTracker.nouvelleMiseAJourDe'));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  const loadShipmentData = async () => {
    try {
      setLoading(true);

      // Charger les détails de l'expédition
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', shipmentId)
        .single();

      if (shipmentError) throw shipmentError;
      setShipment(shipmentData as any);

      // Charger l'historique de tracking
      const { data: trackingData, error: trackingError } = await supabase
        .from('shipment_tracking')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('timestamp', { ascending: false });

      if (trackingError) throw trackingError;
      setTrackingHistory(trackingData as any || []);
    } catch (error) {
      console.error('Error loading shipment:', error);
      toast.error(t('shipmentTracker.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadShipmentData();
    setRefreshing(false);
    toast.success(t('shipmentTracker.donneesActualisees'));
  };

  const copyTrackingNumber = () => {
    if (shipment) {
      navigator.clipboard.writeText(shipment.tracking_number);
      toast.success(t('shipmentTracker.numeroDeSuiviCopie'));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'created': return 'bg-blue-100 text-blue-800';
      case 'picked_up': return 'bg-blue-100 text-[#04439e]';
      case 'in_transit': return 'bg-orange-100 text-orange-800';
      case 'delivered': return 'bg-orange-100 text-[#ff4000]';
      case 'cancelled': return 'bg-orange-100 text-[#ff4000]';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'created': return 'Créée';
      case 'picked_up': return 'Pris en charge';
      case 'in_transit': return 'En transit';
      case 'delivered': return 'Livré';
      case 'cancelled': return 'Annulé';
      default: return status;
    }
  };

  if (loading || !shipment) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      {/* Carte de suivi principale */}
      <Card className="bg-orange-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-600" />
                Suivi d'expédition
              </CardTitle>
              <div className="flex items-center gap-2">
                <code className="text-lg font-mono font-bold text-orange-900">
                  {shipment.tracking_number}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyTrackingNumber}
                  className="h-6 w-6"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <Badge className={getStatusColor(shipment.status)}>
              {getStatusLabel(shipment.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Expéditeur */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                Expéditeur
              </div>
              <div className="space-y-1">
                <p className="font-medium">{shipment.sender_name}</p>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {shipment.sender_phone}
                </div>
                <div className="flex items-start gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3 mt-0.5" />
                  {shipment.sender_address}
                </div>
              </div>
            </div>

            {/* Destinataire */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Destinataire
              </div>
              <div className="space-y-1">
                <p className="font-medium">{shipment.receiver_name}</p>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {shipment.receiver_phone}
                </div>
                <div className="flex items-start gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3 mt-0.5" />
                  {shipment.receiver_address}
                </div>
              </div>
            </div>
          </div>

          {/* Détails du colis */}
          <div className="mt-6 pt-6 border-t">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Poids</p>
                <p className="font-medium">{shipment.weight} kg</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('shipmentTracker.pieces')}</p>
                <p className="font-medium">{shipment.pieces_count}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('shipmentTracker.creeLe')}</p>
                <p className="font-medium">{format(new Date(shipment.created_at), 'dd/MM/yyyy')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('shipmentTracker.misAJour')}</p>
                <p className="font-medium">{format(new Date(shipment.updated_at), 'HH:mm')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline de suivi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-orange-600" />
            Historique de livraison
            <Badge variant="outline" className="ml-auto">
              Mise à jour en temps réel
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ShipmentTimeline
            currentStatus={shipment.status}
            trackingHistory={trackingHistory}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// Utilitaire cn déjà importé dans le projet
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
