import { useTranslation } from "@/hooks/useTranslation";
/**
 * Hook pour gérer les livraisons
 * Connecté à la base de données Supabase
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { publishLivePosition, deliveryPositionTopic } from '@/lib/realtime/livePositions';
import {
  acceptDeliveryBackend,
  startDeliveryBackend,
  cancelDeliveryBackend,
  trackDeliveryPositionBackend,
} from '@/services/deliveryBackendService';

interface Delivery {
  id: string;
  order_id?: string;
  client_id?: string;
  driver_id?: string;
  pickup_address: any;
  delivery_address: any;
  status: 'pending' | 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  delivery_fee: number;
  driver_earning?: number;
  distance_km?: number;
  estimated_pickup_time?: string;
  estimated_delivery_time?: string;
  estimated_time_minutes?: number;
  accepted_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  driver_notes?: string;
  proof_photo_url?: string;
  client_signature?: string;
  // Données vendeur
  vendor_id?: string;
  vendor_name?: string;
  vendor_phone?: string;
  vendor_location?: any;
  customer_name?: string;
  customer_phone?: string;
  package_type?: string;
  package_description?: string;
  payment_method?: string;
  distance_to_vendor?: number;
  distance_vendor_to_client?: number;
  total_distance?: number;
  // Données de tarification vendeur
  base_price?: number;
  price_per_km?: number;
  distance_price?: number;
}

interface TrackingPoint {
  id: string;
  delivery_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  recorded_at: string;
}

export function useDelivery() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [currentDelivery, setCurrentDelivery] = useState<Delivery | null>(null);
  const [deliveryHistory, setDeliveryHistory] = useState<Delivery[]>([]);
  const [nearbyDeliveries, setNearbyDeliveries] = useState<Delivery[]>([]);
  const [trackingPoints, setTrackingPoints] = useState<TrackingPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger la livraison en cours - filtre strict pour données valides
  const loadCurrentDelivery = useCallback(async () => {
    if (!user) return;

    try {
      console.log('🚚 [useDelivery] Loading current delivery for user:', user.id);

      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('driver_id', user.id)
        .in('status', ['assigned', 'picked_up', 'in_transit'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      // Vérifier que la livraison a des données valides
      if (data && (data.vendor_name || data.customer_name || data.order_id)) {
        console.log('✅ [useDelivery] Current delivery loaded:', data.id);
        setCurrentDelivery(data);
      } else {
        console.log('⚠️ [useDelivery] No valid current delivery found');
        setCurrentDelivery(null);
      }
    } catch (error) {
      console.error('❌ Erreur chargement livraison en cours:', error);
    }
  }, [user]);

  // Charger l'historique - filtre strict pour éviter les données invalides
  const loadDeliveryHistory = useCallback(async () => {
    if (!user) return;

    try {
      console.log('📋 [useDelivery] Loading delivery history for user:', user.id);

      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('driver_id', user.id)
        .in('status', ['delivered', 'cancelled'])
        .order('completed_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Filtrer pour exclure les livraisons sans données valides
      const validHistory = (data || []).filter(d =>
        d.vendor_name || d.customer_name || d.order_id
      );

      console.log('✅ [useDelivery] Valid history loaded:', validHistory.length, 'items');
      setDeliveryHistory(validHistory);
    } catch (error) {
      console.error('❌ Erreur chargement historique:', error);
    }
  }, [user]);

  // Trouver les livraisons à proximité avec données de tarification vendeur
  const findNearbyDeliveries = useCallback(async (_lat: number, _lng: number, _radiusKm: number) => {
    setLoading(true);
    setError(null);

    try {
      console.log('🔍 [useDelivery] Searching nearby deliveries...');

      // Charger UNIQUEMENT les livraisons vraiment disponibles
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data, error } = await supabase
        .from('deliveries')
        .select('*')
        .eq('status', 'pending')
        .is('driver_id', null)
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      console.log('✅ Livraisons disponibles (réelles):', data?.length || 0);

      // Filtrer et enrichir avec les données de tarification vendeur
      const validDeliveries = (data || []).filter(d =>
        d.status === 'pending' && !d.driver_id
      );

      // Récupérer les configurations de prix des vendeurs
      const vendorIds = [...new Set(validDeliveries.filter(d => d.vendor_id).map(d => d.vendor_id))];

      const vendorPricing: Record<string, { base_price: number; price_per_km: number }> = {};

      if (vendorIds.length > 0) {
        const { data: vendorData } = await supabase
          .from('vendors')
          .select('id, delivery_base_price, delivery_price_per_km')
          .in('id', vendorIds);

        if (vendorData) {
          vendorData.forEach(v => {
            vendorPricing[v.id] = {
              base_price: v.delivery_base_price || 5000,
              price_per_km: v.delivery_price_per_km || 1000
            };
          });
        }
      }

      // Enrichir les livraisons avec les données de tarification
      const enrichedDeliveries = validDeliveries.map(d => {
        const pricing = d.vendor_id ? vendorPricing[d.vendor_id] : null;
        const distanceKm = d.distance_km || d.distance_vendor_to_client || 5;

        return {
          ...d,
          base_price: pricing?.base_price || 5000,
          price_per_km: pricing?.price_per_km || 1000,
          distance_price: Math.round(distanceKm * (pricing?.price_per_km || 1000)),
          distance_vendor_to_client: distanceKm,
          total_distance: (d.distance_to_vendor || 0) + distanceKm
        };
      });

      console.log('✅ Après enrichissement:', enrichedDeliveries.length);
      setNearbyDeliveries(enrichedDeliveries);
    } catch (error: any) {
      console.error('❌ Erreur chargement livraisons:', error);
      setError(error.message);
      toast.error(t('useDelivery.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Accepter une livraison — claim ATOMIQUE côté backend (anti double-affectation + autorisation).
  const acceptDelivery = useCallback(async (deliveryId: string) => {
    if (!user) return;

    try {
      const result = await acceptDeliveryBackend(deliveryId);
      if (!result.success) {
        toast.error(result.error || 'Cette livraison n\'est plus disponible');
        await findNearbyDeliveries(0, 0, 99999);
        return;
      }

      if (result.data) setCurrentDelivery(result.data);
      else await loadCurrentDelivery();
      setNearbyDeliveries(prev => prev.filter(d => d.id !== deliveryId));
      toast.success(t('useDelivery.livraisonAcceptee'));
      return result.data;
    } catch (error: any) {
      console.error('❌ Error accepting delivery:', error);
      toast.error(t('useDelivery.erreurLorsDeLAcceptation'));
      throw error;
    }
  }, [user, findNearbyDeliveries, loadCurrentDelivery]);

  // Démarrer une livraison — transition validée côté backend (seul le livreur assigné).
  const startDelivery = useCallback(async (deliveryId: string) => {
    try {
      const result = await startDeliveryBackend(deliveryId);
      if (!result.success) {
        toast.error(result.error || 'Démarrage impossible');
        return;
      }
      if (result.data) setCurrentDelivery(result.data);
      else await loadCurrentDelivery();
      toast.success(t('useDelivery.livraisonDemarree'));
      return result.data;
    } catch (error: any) {
      console.error('Erreur démarrage livraison:', error);
      toast.error(t('useDelivery.erreurLorsDuDemarrage'));
      throw error;
    }
  }, [loadCurrentDelivery]);

  // ⚠️ La complétion de livraison N'EST PAS gérée ici : elle DOIT passer par le backend
  // atomique (`completeDeliveryBackend` via useDeliveryActions → /api/v2/delivery) qui
  // calcule la commission et CRÉDITE le wallet du livreur de façon sécurisée. L'ancienne
  // implémentation locale (commission `* 0.985` côté client + écriture directe sans crédit
  // wallet) a été retirée pour éviter tout contournement du flux argent.

  // Annuler une livraison — autorisation + transition validées côté backend.
  const cancelDelivery = useCallback(async (deliveryId: string, reason: string) => {
    try {
      const result = await cancelDeliveryBackend(deliveryId, reason);
      if (!result.success) {
        toast.error(result.error || 'Annulation impossible');
        return;
      }
      setCurrentDelivery(null);
      toast.success(t('useDelivery.livraisonAnnulee'));
    } catch (error: any) {
      console.error('Erreur annulation livraison:', error);
      toast.error(t('useDelivery.erreurLorsDeLAnnulation'));
      throw error;
    }
  }, []);

  // Tracker la position : l'ÉCRITURE EN BASE passe par le backend (validée : seul le livreur
  // assigné, livraison active). Le broadcast reste émis côté client pour la basse latence.
  const trackPosition = useCallback(async (
    deliveryId: string,
    latitude: number,
    longitude: number,
    speed?: number,
    heading?: number,
    accuracy?: number
  ) => {
    if (!user) return;

    // Broadcast immédiat (best-effort, hors WAL) pour un suivi fluide côté client.
    publishLivePosition(deliveryPositionTopic(deliveryId), {
      lat: latitude, lng: longitude, speed, heading, accuracy, at: new Date().toISOString(),
    });

    // Persistance sécurisée (source de vérité) via le backend. Non bloquant.
    try {
      await trackDeliveryPositionBackend(deliveryId, latitude, longitude, speed, heading, accuracy);
    } catch (error) {
      console.error('Erreur tracking position:', error);
    }
  }, [user]);

  // Charger le tracking
  const loadTracking = useCallback(async (deliveryId: string) => {
    try {
      // Scale : ne charge que les colonnes GPS utiles (pas SELECT *) + plafond — un trajet
      // peut contenir des milliers de points ; ici on n'en affiche que le nombre/la trace.
      const { data, error } = await supabase
        .from('delivery_tracking')
        .select('latitude, longitude, recorded_at')
        .eq('delivery_id', deliveryId)
        .order('recorded_at', { ascending: true })
        .limit(1000);

      if (error) throw error;
      setTrackingPoints((data || []) as any);
    } catch (error) {
      console.error('Erreur chargement tracking:', error);
    }
  }, []);

  // S'abonner au tracking en temps réel
  const subscribeToTracking = useCallback((deliveryId: string) => {
    const channel = supabase
      .channel(`delivery_tracking_${deliveryId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'delivery_tracking',
        filter: `delivery_id=eq.${deliveryId}`
      }, (payload) => {
        setTrackingPoints(prev => [...prev, payload.new as TrackingPoint]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // (Le règlement du livreur est effectué atomiquement côté backend à la complétion —
  // voir useDeliveryActions/completeDeliveryBackend. Pas de "processPayment" cosmétique ici.)

  // Charger au montage
  useEffect(() => {
    if (user) {
      loadCurrentDelivery();
      loadDeliveryHistory();
    }
  }, [user, loadCurrentDelivery, loadDeliveryHistory]);

  return {
    currentDelivery,
    deliveryHistory,
    nearbyDeliveries,
    trackingPoints,
    loading,
    error,
    findNearbyDeliveries,
    acceptDelivery,
    startDelivery,
    cancelDelivery,
    trackPosition,
    loadTracking,
    subscribeToTracking,
    loadDeliveryHistory,
    loadCurrentDelivery
  };
}
