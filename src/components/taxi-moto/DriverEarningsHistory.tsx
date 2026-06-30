/**
 * HISTORIQUE DÉTAILLÉ DES GAINS CHAUFFEUR
 * Affichage complet avec graphiques et statistiques
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { Money } from "@/components/Money";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, TrendingUp } from "lucide-react";
import { useMemo } from "react";

interface Ride {
  id: string;
  ride_code?: string;
  pickup_address: string;
  dropoff_address: string;
  distance_km?: number;
  duration_min?: number;
  price_total?: number;
  driver_share?: number;
  requested_at?: string;
  accepted_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  status: string;
}

interface DriverEarningsHistoryProps {
  rides: Ride[];
  todayEarnings: number;
  todayRides: number;
}

export function DriverEarningsHistory({ rides, todayEarnings, todayRides }: DriverEarningsHistoryProps) {
  const { t } = useTranslation();
  // Calculer les statistiques par période
  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const weekRides = rides.filter(r => {
      const date = new Date(r.completed_at || r.created_at);
      return date >= weekAgo;
    });

    const monthRides = rides.filter(r => {
      const date = new Date(r.completed_at || r.created_at);
      return date >= monthAgo;
    });

    const weekEarnings = weekRides.reduce((sum, r) => sum + (r.driver_share || 0), 0);
    const monthEarnings = monthRides.reduce((sum, r) => sum + (r.driver_share || 0), 0);

    return {
      week: { rides: weekRides.length, earnings: weekEarnings },
      month: { rides: monthRides.length, earnings: monthEarnings }
    };
  }, [rides]);

  // Grouper par jour pour le graphique
  const dailyStats = useMemo(() => {
    const days: { [key: string]: { rides: number; earnings: number } } = {};

    rides.forEach(ride => {
      const date = new Date(ride.completed_at || ride.created_at);
      const key = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

      if (!days[key]) {
        days[key] = { rides: 0, earnings: 0 };
      }

      days[key].rides += 1;
      days[key].earnings += ride.driver_share || 0;
    });

    return Object.entries(days)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .slice(-7); // Derniers 7 jours
  }, [rides]);

  return (
    <div className="space-y-4">
  {/* Statistiques par période */}
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-white border-0 shadow-lg">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-[#ff4000]">
              {todayEarnings.toLocaleString()}
            </div>
            <div className="text-xs text-gray-600">GNF Aujourd'hui</div>
            <div className="text-sm font-medium text-blue-600 mt-1">
              {todayRides} courses
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-lg">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(stats.week.earnings).toLocaleString()}
            </div>
            <div className="text-xs text-gray-600">GNF Cette semaine</div>
            <div className="text-sm font-medium text-blue-600 mt-1">
              {stats.week.rides} courses
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-lg">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-[#04439e]">
              {Math.round(stats.month.earnings).toLocaleString()}
            </div>
            <div className="text-xs text-gray-600">GNF Ce mois</div>
            <div className="text-sm font-medium text-blue-600 mt-1">
              {stats.month.rides} courses
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphique simple des 7 derniers jours */}
      <Card className="bg-white border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Évolution 7 derniers jours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {dailyStats.map(([date, data]) => (
              <div key={date} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-16">{date}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                  <div
                    className="bg-[#ff4000] h-full rounded-full flex items-center justify-end px-2"
                    style={{ width: `${Math.min((data.earnings / (stats.week.earnings / 7)) * 100, 100)}%` }}
                  >
                    <span className="text-xs font-bold text-white">{data.rides}</span>
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-700 w-24 text-right">
                  <Money amount={Math.round(data.earnings)} from="GNF" />
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Liste des courses */}
      <Card className="bg-white border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>{t('driverEarningsHistory.historiqueDesCourses')}</span>
            <Badge>{rides.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rides.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{t('driverEarningsHistory.aucuneCourseTerminee')}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {rides.map((ride) => {
                const earnings = ride.driver_share || 0;
                const rideDate = new Date(ride.completed_at || ride.created_at);
                const duration = ride.completed_at && ride.accepted_at
                  ? Math.round((new Date(ride.completed_at).getTime() - new Date(ride.accepted_at).getTime()) / 60000)
                  : ride.duration_min || 0;

                return (
                  <div key={ride.id} className="border rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {ride.ride_code || `#${ride.id.slice(0, 8)}`}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {rideDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                            {' à '}
                            {rideDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-[#ff4000] rounded-full flex-shrink-0"></div>
                            <span className="truncate">{ride.pickup_address}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-[#ff4000] rounded-full flex-shrink-0"></div>
                            <span className="truncate">{ride.dropoff_address}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <div className="text-lg font-bold text-[#ff4000]">
                          +{earnings.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">GNF</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{(ride.distance_km || 0).toFixed(1)} km</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{duration} min</span>
                      </div>
                      <span>•</span>
                      <span className="font-medium">
                        {duration > 0 ? Math.round((ride.distance_km || 0) / duration * 60) : 0} km/h
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
