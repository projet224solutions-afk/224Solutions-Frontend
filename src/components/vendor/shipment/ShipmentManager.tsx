/**
 * GESTIONNAIRE PRINCIPAL DES EXPÉDITIONS
 * Interface principale pour créer et gérer les expéditions
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Plus, MapPin, Clock, TrendingUp, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentVendor } from '@/hooks/useCurrentVendor';
import { ShipmentForm } from './ShipmentForm';
import { ShipmentSuccess } from './ShipmentSuccess';
import { ShipmentTracker } from './ShipmentTracker';
import { format } from 'date-fns';
import { toast } from 'sonner';

type ViewMode = 'list' | 'create' | 'success' | 'track';

interface Shipment {
  id: string;
  tracking_number: string;
  receiver_name: string;
  receiver_address: string;
  weight: number;
  status: string;
  created_at: string;
}

export function ShipmentManager() {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const { vendorId, loading: vendorLoading } = useCurrentVendor();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [successShipmentId, setSuccessShipmentId] = useState<string>('');
  const [successTrackingNumber, setSuccessTrackingNumber] = useState<string>('');
  const [trackingShipmentId, setTrackingShipmentId] = useState<string>('');

  useEffect(() => {
    if (!vendorId || vendorLoading) return;
    loadShipments();

    // Écoute des mises à jour en temps réel pour toutes les expéditions du vendeur
    const channel = supabase
      .channel('vendor-shipments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shipments',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          console.log('Shipment change detected:', payload);
          // Recharger automatiquement la liste
          loadShipments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, vendorLoading]);

  const loadShipments = async () => {
    if (!vendorId) {
      console.warn('⚠️ Pas de vendorId pour charger les expéditions');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Charger les expéditions
      const { data: shipmentsData, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setShipments(shipmentsData as any || []);
    } catch (error) {
      console.error('Error loading vendor shipments:', error);
      toast.error(t('shipmentManager.erreurLorsDuChargement'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = (shipmentId: string, trackingNumber: string) => {
    setSuccessShipmentId(shipmentId);
    setSuccessTrackingNumber(trackingNumber);
    setViewMode('success');
    loadShipments(); // Recharger la liste
  };

  const handleNewShipment = () => {
    setViewMode('create');
  };

  const handleBackToList = () => {
    setViewMode('list');
    loadShipments();
  };

  const handleViewTracking = (shipmentId: string) => {
    setTrackingShipmentId(shipmentId);
    setViewMode('track');
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

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  if (!vendorId) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            Profil vendeur introuvable
          </div>
        </CardContent>
      </Card>
    );
  }

  // Mode création
  if (viewMode === 'create') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{t('shipmentManager.nouvelleExpedition')}</h2>
          <Button variant="outline" onClick={handleBackToList}>
            Retour à la liste
          </Button>
        </div>
        <ShipmentForm
          vendorId={vendorId}
          onSuccess={handleCreateSuccess}
          onCancel={handleBackToList}
        />
      </div>
    );
  }

  // Mode succès
  if (viewMode === 'success') {
    return (
      <div className="space-y-4">
        <ShipmentSuccess
          shipmentId={successShipmentId}
          trackingNumber={successTrackingNumber}
          onNewShipment={handleNewShipment}
          onEdit={handleBackToList}
        />
        <div className="text-center">
          <Button variant="outline" onClick={handleBackToList}>
            Retour à la liste des expéditions
          </Button>
        </div>
      </div>
    );
  }

  // Mode suivi détaillé
  if (viewMode === 'track') {
    return (
      <ShipmentTracker
        shipmentId={trackingShipmentId}
        onBack={handleBackToList}
      />
    );
  }

  // Mode liste
  return (
    <div className="space-y-6">
      {/* Header avec stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('shipmentManager.totalExpeditions')}</p>
                <p className="text-2xl font-bold">{shipments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En cours</p>
                <p className="text-2xl font-bold">
                  {shipments.filter(s => !['delivered', 'cancelled'].includes(s.status)).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Package className="h-5 w-5 text-[#ff4000]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('shipmentManager.livrees')}</p>
                <p className="text-2xl font-bold">
                  {shipments.filter(s => s.status === 'delivered').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des expéditions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-orange-600" />
                Mes expéditions
              </CardTitle>
              <CardDescription>
                Gérez toutes vos expéditions logistiques
              </CardDescription>
            </div>
            <Button
              onClick={handleNewShipment}
              className="bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-600/40"
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle expédition
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {shipments.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground mb-4">{t('shipmentManager.aucuneExpeditionCreee')}</p>
                <Button
                  onClick={handleNewShipment}
                  className="bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-600/40"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Créer votre première expédition
                </Button>
              </div>
            ) : (
              shipments.map((shipment) => (
                <div
                  key={shipment.id}
                  className="p-4 bg-gradient-to-r from-orange-50/50 to-white rounded-lg border hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(shipment.status)}>
                          {getStatusLabel(shipment.status)}
                        </Badge>
                        <span className="font-mono text-sm font-medium">
                          {shipment.tracking_number}
                        </span>
                      </div>

                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-[#ff4000] flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">{shipment.receiver_name}</p>
                          <p className="text-muted-foreground">{shipment.receiver_address}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          <span>{shipment.weight} kg</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{format(new Date(shipment.created_at), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bouton de suivi */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewTracking(shipment.id)}
                      className="shrink-0"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Suivre
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
