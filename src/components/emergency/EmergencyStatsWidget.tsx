/**
 * EMERGENCY STATS WIDGET - Widget statistiques pour dashboard
 * 224Solutions - Vue résumée des alertes d'urgence
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Activity,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { emergencyService } from '@/services/emergencyService';
import type { EmergencyStats } from '@/types/emergency';
import { useNavigate } from 'react-router-dom';

interface EmergencyStatsWidgetProps {
  bureauId?: string;
  compact?: boolean;
  showDetails?: boolean;
}

export const EmergencyStatsWidget: React.FC<EmergencyStatsWidgetProps> = ({
  bureauId,
  compact = false,
  showDetails = true
}) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<EmergencyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      try {
        const data = await emergencyService.getStats(bureauId);
        setStats(data);
      } catch (error) {
        console.error('❌ Erreur chargement stats urgence:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();

    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [bureauId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          Aucune donnée disponible
        </CardContent>
      </Card>
    );
  }

  const hasActiveAlerts = (stats.active_alerts || 0) > 0;

  if (compact) {
    return (
      <Card
        className={`cursor-pointer transition-all hover:shadow-lg ${
          hasActiveAlerts ? 'border-[#ff4000] border-2' : ''
        }`}
        onClick={() => navigate('/emergency')}
      >
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${
                hasActiveAlerts ? 'bg-orange-100 text-[#ff4000] animate-pulse' : 'bg-orange-100 text-[#ff4000]'
              }`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">Alertes d'Urgence</p>
                <p className="text-xs text-muted-foreground">
                  {hasActiveAlerts ? `${stats.active_alerts} active(s)` : 'Aucune alerte'}
                </p>
              </div>
            </div>
            {hasActiveAlerts && (
              <Badge variant="destructive" className="animate-pulse">
                {stats.active_alerts}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={hasActiveAlerts ? 'border-[#ff4000] border-2' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className={hasActiveAlerts ? 'h-5 w-5 text-[#ff4000] animate-pulse' : 'h-5 w-5'} />
            Système d'Urgence SOS
          </span>
          {hasActiveAlerts && (
            <Badge variant="destructive" className="animate-pulse">
              {stats.active_alerts} ACTIVE(S)
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Statistiques principales */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Activity className="h-4 w-4" />
              <span className="text-sm">Alertes Actives</span>
            </div>
            <p className={`text-3xl font-bold ${hasActiveAlerts ? 'text-[#ff4000] animate-pulse' : 'text-[#ff4000]'}`}>
              {stats.active_alerts || 0}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Résolues Aujourd'hui</span>
            </div>
            <p className="text-3xl font-bold text-[#ff4000]">
              {stats.resolved_alerts || 0}
            </p>
          </div>
        </div>

        {showDetails && (
          <>
            {/* Statistiques secondaires */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">Fausses Alertes</span>
                </div>
                <p className="text-xl font-bold text-orange-600">
                  {stats.false_alerts || 0}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Temps Moyen</span>
                </div>
                <p className="text-xl font-bold text-blue-600">
                  {stats.avg_resolution_time
                    ? `${Math.round(parseInt(stats.avg_resolution_time) / 60)}min`
                    : 'N/A'}
                </p>
              </div>
            </div>

            {/* Total */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Alertes</span>
                <span className="text-2xl font-bold">
                  {stats.total_alerts || 0}
                </span>
              </div>
            </div>
          </>
        )}

        {/* Bouton d'action */}
        <Button
          onClick={() => navigate('/emergency')}
          className="w-full"
          variant={hasActiveAlerts ? 'destructive' : 'default'}
        >
          {hasActiveAlerts ? (
            <>
              <AlertTriangle className="h-4 w-4 mr-2" />
              Voir les Alertes Actives
            </>
          ) : (
            <>
              <Activity className="h-4 w-4 mr-2" />
              Ouvrir le Tableau de Bord
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default EmergencyStatsWidget;
