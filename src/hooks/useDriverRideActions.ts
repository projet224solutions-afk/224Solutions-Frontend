import { useCallback } from 'react';
import { toast } from 'sonner';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { TaxiMotoService } from '@/services/taxi/TaxiMotoService';

interface UseDriverRideActionsProps {
  driverId: string | null;
  setAcceptingRideId: (id: string | null) => void;
  setRideRequests: React.Dispatch<React.SetStateAction<any[]>>;
  setActiveRide: (ride: any) => void;
  setNavigationActive: (active: boolean) => void;
  startNavigation: (coords: any) => void;
  loadDriverStats: () => void;
}

export function useDriverRideActions({
  driverId,
  setAcceptingRideId,
  setRideRequests,
  setActiveRide,
  setNavigationActive,
  startNavigation,
  loadDriverStats
}: UseDriverRideActionsProps) {
  const fc = useFormatCurrency();

  const acceptRide = useCallback(async (request: any) => {
    if (!driverId) {
      console.error('❌ Pas de driverId disponible');
      toast.error('Profil conducteur non trouvé');
      return;
    }

    setAcceptingRideId(request.id);
    toast.loading('⏳ Acceptation de la course...', { id: `accept-${request.id}` });

    try {
      console.log('📞 Appel de TaxiMotoService.acceptRide...');
      await TaxiMotoService.acceptRide(request.id, driverId);

      toast.dismiss(`accept-${request.id}`);
      toast.success('✅ Course acceptée avec succès!');

      setRideRequests(prev => prev.filter(r => r.id !== request.id));

      const activeRideData = {
        id: request.id,
        customer: {
          name: request.customerName,
          phone: request.customerPhone,
          rating: request.customerRating || 4.5
        },
        pickup: {
          address: request.pickupAddress,
          coords: request.pickupCoords
        },
        destination: {
          address: request.destinationAddress,
          coords: request.destinationCoords
        },
        status: 'accepted' as const,
        startTime: new Date().toISOString(),
        estimatedEarnings: request.estimatedEarnings || 0
      };

      setActiveRide(activeRideData);
      setNavigationActive(true);
      startNavigation(activeRideData.pickup.coords);
      loadDriverStats();
    } catch (error: any) {
      console.error('❌ Erreur acceptation course:', error);
      toast.dismiss(`accept-${request.id}`);

      if (error.message?.includes('LOCKED') || error.message?.includes('déjà en cours')) {
        toast.error('⚠️ Vous avez déjà une course en cours');
      } else if (error.message?.includes('ALREADY_ASSIGNED') || error.message?.includes('déjà attribuée')) {
        toast.error('⚠️ Course déjà prise par un autre conducteur');
      } else {
        toast.error(`Erreur: ${error.message || 'Impossible d\'accepter la course'}`);
      }
      setRideRequests(prev => prev.filter(r => r.id !== request.id));
    } finally {
      setAcceptingRideId(null);
    }
  }, [driverId, setAcceptingRideId, setRideRequests, setActiveRide, setNavigationActive, startNavigation, loadDriverStats]);

  const refuseRide = useCallback(async (requestId: string) => {
    if (!driverId) return;

    try {
      await TaxiMotoService.refuseRide(requestId, driverId);
      setRideRequests(prev => prev.filter(r => r.id !== requestId));
      toast.info('Course refusée');
    } catch (error) {
      console.error('Error declining ride:', error);
      toast.error('Erreur lors du refus');
    }
  }, [driverId, setRideRequests]);

  const updateRideStatus = useCallback(async (activeRide: any, newStatus: string) => {
    if (!activeRide) return;

    const statusMap: Record<string, string> = {
      'accepted': 'arriving',
      'arriving': 'started',
      'picked_up': 'in_progress',
      'in_progress': 'completed'
    };

    const dbStatus = statusMap[newStatus] || newStatus;

    try {
      await TaxiMotoService.updateRideStatus(activeRide.id, dbStatus);

      const updatedRide = { ...activeRide, status: newStatus };
      setActiveRide(updatedRide);

      if (newStatus === 'picked_up') {
        toast.success('✅ Client récupéré, en route vers la destination');
        startNavigation(activeRide.destination.coords);
      } else if (newStatus === 'in_progress') {
        toast.success('🚗 Course en cours');
      }

      loadDriverStats();
    } catch (error) {
      console.error('Error updating ride status:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  }, [setActiveRide, startNavigation, loadDriverStats]);

  const cancelRide = useCallback(async (activeRide: any, reason: string) => {
    if (!activeRide) return;

    try {
      await TaxiMotoService.updateRideStatus(activeRide.id, 'cancelled', 'driver', {
        cancel_reason: reason
      } as any);

      setActiveRide(null);
      setNavigationActive(false);
      toast.success('Course annulée');
      loadDriverStats();
    } catch (error) {
      console.error('❌ Erreur lors de l\'annulation:', error);
      toast.error('Impossible d\'annuler la course');
    }
  }, [setActiveRide, setNavigationActive, loadDriverStats]);

  const completeRide = useCallback(async (activeRide: any) => {
    if (!activeRide) return;

    try {
      await TaxiMotoService.updateRideStatus(activeRide.id, 'completed', 'driver', {
        completed_at: new Date().toISOString()
      });

      toast.success('🎉 Course terminée avec succès!', {
        description: `Vous avez gagné ${fc(activeRide.estimatedEarnings)}`
      });

      setActiveRide(null);
      setNavigationActive(false);
      loadDriverStats();
    } catch (error) {
      console.error('Error completing ride:', error);
      toast.error('Erreur lors de la finalisation');
    }
  }, [setActiveRide, setNavigationActive, loadDriverStats]);

  return {
    acceptRide,
    refuseRide,
    updateRideStatus,
    cancelRide,
    completeRide
  };
}
