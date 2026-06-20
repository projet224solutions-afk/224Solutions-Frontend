/**
 * PAGE SUIVI COURSE TAXI
 * Suivi en temps réel — Taxi Voiture ou Taxi Moto
 * Accessible via /taxi/tracking/:rideId
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import TaxiMotoTracking from '@/components/taxi-moto/TaxiMotoTracking';

interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export default function TaxiTrackingPage() {
  const { t } = useTranslation();
  const { rideId } = useParams<{ rideId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);

  // Obtenir la position utilisateur
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Charger la course
  useEffect(() => {
    if (!rideId) return;

    const loadRide = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from('taxi_trips')
          .select(`
            id,
            status,
            pickup_address,
            dropoff_address,
            price_total,
            requested_at,
            driver_id,
            pickup_lat,
            pickup_lng,
            dropoff_lat,
            dropoff_lng
          `)
          .eq('id', rideId)
          .maybeSingle();

        if (queryError) throw queryError;

        if (!data) {
          setError('Course introuvable');
          return;
        }

        // Charger les infos du chauffeur
        let driverInfo = null;
        if (data.driver_id) {
          const { data: driverData } = await supabase
            .from('taxi_drivers')
            .select('id, vehicle_type, vehicle_plate, rating, user_id')
            .eq('id', data.driver_id)
            .maybeSingle();

          if (driverData) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name, phone, avatar_url')
              .eq('id', driverData.user_id)
              .maybeSingle();

            driverInfo = {
              id: driverData.user_id,
              name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Chauffeur' : 'Chauffeur',
              rating: driverData.rating || 5,
              phone: profile?.phone || '',
              vehicleType: driverData.vehicle_type,
              vehicleNumber: driverData.vehicle_plate || '',
              photo: profile?.avatar_url || undefined,
            };
          }
        }

        setRide({
          id: data.id,
          status: data.status,
          pickupAddress: data.pickup_address || '',
          destinationAddress: data.dropoff_address || '',
          estimatedPrice: data.price_total || 0,
          driver: driverInfo,
          createdAt: data.requested_at || '',
        });
      } catch (err) {
        console.error('[TaxiTrackingPage] Error:', err);
        setError('Impossible de charger la course');
      } finally {
        setLoading(false);
      }
    };

    loadRide();
  }, [rideId]);

  // Realtime: écouter les changements de statut
  useEffect(() => {
    if (!rideId) return;

    const channel = supabase
      .channel(`tracking_ride_${rideId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'taxi_trips', filter: `id=eq.${rideId}` },
        (payload) => {
          if (payload.new) {
            setRide((prev: any) => prev ? { ...prev, status: payload.new.status } : prev);
            // Si course terminée/annulée, rediriger
            if (['completed', 'cancelled'].includes(payload.new.status)) {
              setTimeout(() => navigate('/taxi-moto'), 3000);
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [rideId, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500/5 via-background to-[#ff4000]/5">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{t('taxiTrackingPage.suiviDeCourse')}</h1>
              <p className="text-sm text-muted-foreground">{t('taxiTrackingPage.enTempsReel')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-muted-foreground">{t('taxiTrackingPage.chargementDeVotreCourse')}</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mb-4" />
            <h3 className="font-semibold text-lg mb-2">Course introuvable</h3>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => navigate('/taxi-moto')}>
              Retour à l'accueil taxi
            </Button>
          </div>
        ) : (
          <TaxiMotoTracking currentRide={ride} userLocation={userLocation} />
        )}
      </div>
    </div>
  );
}
