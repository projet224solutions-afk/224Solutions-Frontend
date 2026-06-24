/**
 * CARTE DE COURSE ACTIVE
 * Affiche les détails de la course en cours avec actions
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Money } from '@/components/Money';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Car, MapPin, Phone, MessageCircle,
  Navigation, Star, Clock, DollarSign
} from 'lucide-react';

interface ActiveRideCardProps {
  ride: {
    id: string;
    customer: {
      name: string;
      phone: string;
      rating: number;
    };
    pickup: {
      address: string;
      coords: { latitude: number; longitude: number };
    };
    destination: {
      address: string;
      coords: { latitude: number; longitude: number };
    };
    status: 'accepted' | 'arriving' | 'picked_up' | 'in_progress';
    startTime: string;
    estimatedEarnings: number;
  };
  onUpdateStatus: (newStatus: 'arriving' | 'picked_up' | 'in_progress') => void;
  onContactCustomer: (phone: string) => void;
  onNavigate: (coords: { latitude: number; longitude: number }) => void;
  onCancelRide?: () => void;
}

export function ActiveRideCard({
  ride,
  onUpdateStatus,
  onContactCustomer,
  onNavigate,
  onCancelRide
}: ActiveRideCardProps) {
  const { t } = useTranslation();
  const getStatusInfo = () => {
    switch (ride.status) {
      case 'accepted':
        return {
          label: t('activeRideCard.enRouteVersLeClient'),
          color: 'bg-orange-100 text-[#ff4000] border-orange-300',
          nextAction: 'arriving',
          nextLabel: 'Je suis arrivé',
          icon: '🚕'
        };
      case 'arriving':
        return {
          label: t('activeRideCard.arriveAuPointDeRendez'),
          color: 'bg-blue-100 text-blue-800 border-blue-300',
          nextAction: 'picked_up',
          nextLabel: 'Client à bord',
          icon: '🙋'
        };
      case 'picked_up':
        return {
          label: t('activeRideCard.clientABord'),
          color: 'bg-orange-100 text-[#ff4000] border-orange-300',
          nextAction: 'in_progress',
          nextLabel: 'Arrivé à destination',
          icon: '🚗'
        };
      default:
        return {
          label: 'En cours',
          color: 'bg-blue-100 text-[#04439e] border-blue-300',
          nextAction: 'in_progress',
          nextLabel: 'Terminer',
          icon: '🏁'
        };
    }
  };

  const statusInfo = getStatusInfo();
  const targetLocation = ride.status === 'accepted' || ride.status === 'arriving'
    ? ride.pickup.coords
    : ride.destination.coords;

  return (
    <Card className="bg-white border-2 border-blue-200 shadow-xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Car className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg">Course en cours</span>
          </div>
          <Badge className={statusInfo.color + ' font-bold text-sm px-3 py-1'}>
            {statusInfo.icon} {statusInfo.label}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Informations client */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
          <div className="flex-1">
            <h3 className="font-bold text-lg text-gray-900">{ride.customer.name}</h3>
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-4 h-4 fill-[#ff4000] text-[#ff4000]" />
              <span className="text-sm font-semibold text-[#ff4000]">{ride.customer.rating}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => onContactCustomer(ride.customer.phone)}
              size="sm"
              variant="outline"
              className="bg-orange-50 hover:bg-orange-100 border-orange-300"
            >
              <Phone className="w-4 h-4 text-[#ff4000]" />
            </Button>
            <Button
              onClick={() => window.open(`sms:${ride.customer.phone}`)}
              size="sm"
              variant="outline"
              className="bg-blue-50 hover:bg-blue-100 border-blue-300"
            >
              <MessageCircle className="w-4 h-4 text-blue-600" />
            </Button>
          </div>
        </div>

        {/* Itinéraire */}
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border-l-4 border-[#ff4000]">
            <div className="p-2 bg-[#ff4000] rounded-full mt-1">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-[#ff4000] uppercase">{t('activeRideCard.depart')}</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{ride.pickup.address}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border-l-4 border-[#ff4000]">
            <div className="p-2 bg-[#ff4000] rounded-full mt-1">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-[#ff4000] uppercase">Destination</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{ride.destination.address}</p>
            </div>
          </div>
        </div>

        {/* Informations de gain */}
        <div className="flex items-center justify-between p-4 bg-[#ff4000]/5 rounded-lg border border-orange-200">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#ff4000]" />
            <span className="text-sm text-gray-600">{t('activeRideCard.gainEstime')}</span>
          </div>
          <span className="text-2xl font-bold text-[#ff4000]">
            <Money amount={ride?.estimatedEarnings || 0} from="GNF" />
          </span>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => onNavigate(targetLocation)}
              variant="outline"
              className="h-12 bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700 font-semibold"
            >
              <Navigation className="w-4 h-4 mr-2" />
              Navigation
            </Button>

            <Button
              onClick={() => onUpdateStatus(statusInfo.nextAction as any)}
              className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-600/40"
            >
              ✅ {statusInfo.nextLabel}
            </Button>
          </div>

          {onCancelRide && (
            <Button
              onClick={onCancelRide}
              variant="outline"
              className="w-full h-12 bg-orange-50 hover:bg-orange-100 border-orange-300 text-[#ff4000] font-semibold"
            >
              ❌ Annuler la course
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
