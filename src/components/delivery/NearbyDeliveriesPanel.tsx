/**
 * PANNEAU DES COLIS À PROXIMITÉ - AMÉLIORÉ
 * Affiche tous les détails AVANT acceptation:
 * - Distance livreur → vendeur
 * - Distance vendeur → client
 * - Prix total à gagner
 * - Nom et adresse vendeur
 * - Adresse client CACHÉE (sécurité)
 */

import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MapPin, Package, Navigation, Phone, Store, Clock,
  DollarSign, CreditCard, Truck, Check, X, Loader2, RefreshCw
} from 'lucide-react';
import { DeliveryService, type NearbyDelivery } from '@/services/delivery/DeliveryService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EnhancedDelivery extends NearbyDelivery {
  vendor_name?: string;
  vendor_phone?: string;
  payment_method?: string;
  package_type?: string;
  distance_to_vendor?: number;
  distance_vendor_to_client?: number;
  total_distance?: number;
  estimated_earnings?: number;
  estimated_time?: number;
}

export function NearbyDeliveriesPanel() {
  const { t } = useTranslation();
  const [deliveries, setDeliveries] = useState<EnhancedDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [_userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    loadNearbyDeliveries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadNearbyDeliveries = async () => {
    setLoading(true);
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
            setUserPosition(pos);
            await fetchDeliveries(pos);
          },
          () => fetchDeliveries(null)
        );
      } else {
        await fetchDeliveries(null);
      }
    } catch (error) {
      console.error('Error loading deliveries:', error);
      toast.error(t('nearbyDeliveriesPanel.erreurLorsDuChargement'));
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveries = async (driverPos: { lat: number; lng: number } | null) => {
    try {
      // Charger les livraisons en attente (sans filtre ready_for_pickup pour inclure toutes les livraisons créées par les vendeurs)
      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('status', 'pending')
        .is('driver_id', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const enhanced: EnhancedDelivery[] = (data || []).map((d: any) => {
        const pickup = typeof d.pickup_address === 'object' ? d.pickup_address : {};
        const delivery = typeof d.delivery_address === 'object' ? d.delivery_address : {};

        // Calcul simple des distances si position dispo
        let distToVendor = d.distance_to_vendor || 0;
        if (driverPos && pickup.lat && pickup.lng && !distToVendor) {
          distToVendor = calculateDistance(driverPos.lat, driverPos.lng, pickup.lat, pickup.lng);
        }

        const distVendorClient = d.distance_vendor_to_client || d.distance_km || 0;
        const totalDist = distToVendor + distVendorClient;
        const earnings = d.driver_earning || d.delivery_fee || Math.round(5000 + totalDist * 2000);

        return {
          id: d.id,
          pickup_address: pickup.address || 'Adresse de récupération',
          delivery_address: '🔒 Révélée après acceptation',
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          delivery_lat: delivery.lat,
          delivery_lng: delivery.lng,
          distance_km: d.distance_km,
          delivery_fee: d.delivery_fee || 0,
          status: d.status,
          vendor_name: d.vendor_name || 'Vendeur',
          vendor_phone: d.vendor_phone,
          payment_method: d.payment_method || 'prepaid',
          package_type: d.package_type || 'Standard',
          distance_to_vendor: Math.round(distToVendor * 10) / 10,
          distance_vendor_to_client: Math.round(distVendorClient * 10) / 10,
          total_distance: Math.round(totalDist * 10) / 10,
          estimated_earnings: earnings,
          estimated_time: Math.round(totalDist * 3) || 30
        };
      });

      setDeliveries(enhanced);
    } catch (error) {
      console.error('Error fetching deliveries:', error);
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const handleAccept = async (deliveryId: string) => {
    setAcceptingId(deliveryId);
    try {
      const acceptedDelivery = await DeliveryService.acceptDelivery(deliveryId);

      // Retirer immédiatement de la liste pour un feedback visuel instantané
      setDeliveries(prev => prev.filter(d => d.id !== deliveryId));

      toast.success(t('nearbyDeliveriesPanel.livraisonAccepteeAvecSucces'), {
        description: 'Rendez-vous chez le vendeur pour récupérer le colis'
      });

      // Rafraîchir la liste complète après un court délai
      setTimeout(() => loadNearbyDeliveries(), 1000);

      return acceptedDelivery;
    } catch (error: any) {
      console.error('[NearbyDeliveriesPanel] Accept error:', error);
      toast.error(error.message || 'Erreur lors de l\'acceptation', {
        description: 'La livraison est peut-être déjà prise par un autre livreur'
      });
      // Rafraîchir pour avoir l'état actuel
      loadNearbyDeliveries();
    } finally {
      setAcceptingId(null);
    }
  };

  const formatCurrency = useFormatCurrency();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-600" />
          <p className="mt-2 text-muted-foreground">{t('nearbyDeliveriesPanel.rechercheDeLivraisons')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-orange-600" />
              Livraisons disponibles
            </CardTitle>
            <CardDescription>{deliveries.length} offres près de vous</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={loadNearbyDeliveries}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {deliveries.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-muted-foreground">{t('nearbyDeliveriesPanel.aucuneLivraisonDisponible')}</p>
          </div>
        ) : (
          deliveries.map((d) => (
            <div key={d.id} className="p-4 bg-[#ff4000]/5 rounded-xl border border-orange-200/50 space-y-3">
              {/* Vendeur */}
              <div className="flex items-start gap-3">
                <Store className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">{d.vendor_name}</p>
                  <p className="text-sm text-muted-foreground">{d.pickup_address}</p>
                  {d.vendor_phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Phone className="h-3 w-3" /> {d.vendor_phone}
                    </p>
                  )}
                </div>
              </div>

              {/* Distances */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">{t('nearbyDeliveriesPanel.vousVendeur')}</p>
                  <p className="font-bold text-orange-700">{d.distance_to_vendor} km</p>
                </div>
                <div className="p-2 bg-orange-100 dark:bg-[#ff4000]/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">{t('nearbyDeliveriesPanel.vendeurClient')}</p>
                  <p className="font-bold text-[#ff4000]">{d.distance_vendor_to_client} km</p>
                </div>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-bold text-blue-700">{d.total_distance} km</p>
                </div>
              </div>

              {/* Prix et infos */}
              <div className="flex items-center justify-between p-3 bg-[#ff4000] rounded-lg text-white">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  <span className="font-bold text-lg">{formatCurrency(d.estimated_earnings || 0)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={d.payment_method === 'cod' ? 'bg-orange-100 text-[#ff4000]' : 'bg-white/20 text-white'}>
                    <CreditCard className="h-3 w-3 mr-1" />
                    {d.payment_method === 'cod' ? 'COD' : 'Prépayé'}
                  </Badge>
                  <Badge variant="secondary" className="bg-white/20 text-white">
                    <Clock className="h-3 w-3 mr-1" />
                    ~{d.estimated_time} min
                  </Badge>
                </div>
              </div>

              {/* Note sécurité */}
              <p className="text-xs text-center text-muted-foreground italic">
                🔒 L'adresse du client sera révélée après acceptation
              </p>

              {/* Bouton accepter */}
              <Button
                className="w-full bg-[#ff4000] hover:bg-[#ff4000] shadow-lg shadow-[#ff4000]/40"
                onClick={() => handleAccept(d.id)}
                disabled={acceptingId === d.id}
              >
                {acceptingId === d.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Accepter cette livraison
                  </>
                )}
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
