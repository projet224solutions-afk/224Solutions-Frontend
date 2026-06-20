/**
 * EMERGENCY ALERT CARD - Carte d'alerte d'urgence
 * 224Solutions - Composant de liste des alertes
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, MapPin, Clock, Activity } from 'lucide-react';
import type { EmergencyAlert } from '@/types/emergency';

interface EmergencyAlertCardProps {
  alert: EmergencyAlert;
  isSelected: boolean;
  onClick: () => void;
  onTakeAction?: () => void;
}

export const EmergencyAlertCard: React.FC<EmergencyAlertCardProps> = ({
  alert,
  isSelected,
  onClick,
  onTakeAction
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-[#ff4000] animate-pulse';
      case 'in_progress':
        return 'bg-orange-500';
      case 'resolved':
        return 'bg-[#ff4000]';
      case 'false_alert':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'URGENCE';
      case 'in_progress':
        return 'EN COURS';
      case 'resolved':
        return 'RÉSOLUE';
      case 'false_alert':
        return 'FAUSSE ALERTE';
      default:
        return status.toUpperCase();
    }
  };

  const formatTime = (seconds?: number) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}min ${secs}s` : `${secs}s`;
  };

  return (
    <Card
      onClick={onClick}
      className={`cursor-pointer transition-all hover:shadow-lg ${
        isSelected ? 'ring-2 ring-primary shadow-lg' : ''
      } ${alert.status === 'active' ? 'border-[#ff4000] border-2' : ''}`}
    >
      <CardContent className="p-4 space-y-3">
        {/* En-tête avec statut */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${getStatusColor(alert.status)}`} />
            <div>
              <p className="font-bold text-sm">{alert.driver_name || 'Conducteur'}</p>
              <p className="text-xs text-muted-foreground">{alert.driver_code || 'N/A'}</p>
            </div>
          </div>
          <Badge variant={alert.status === 'active' ? 'destructive' : 'default'} className="text-xs">
            {getStatusLabel(alert.status)}
          </Badge>
        </div>

        {/* Informations */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatTime(alert.seconds_since_alert)}</span>
          </div>

          {alert.current_speed !== undefined && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Activity className="h-3 w-3" />
              <span>{alert.current_speed.toFixed(1)} km/h</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">
              {alert.current_latitude?.toFixed(4) || alert.initial_latitude.toFixed(4)},
              {alert.current_longitude?.toFixed(4) || alert.initial_longitude.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Action rapide */}
        {alert.status === 'active' && onTakeAction && (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onTakeAction();
            }}
            size="sm"
            className="w-full"
            variant="destructive"
          >
            <AlertTriangle className="h-3 w-3 mr-2" />
            Prendre en Charge
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default EmergencyAlertCard;
