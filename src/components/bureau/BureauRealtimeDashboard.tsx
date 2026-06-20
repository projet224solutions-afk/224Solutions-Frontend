/**
 * Dashboard de monitoring temps réel pour les bureaux/syndicats
 */

import { useState, useEffect } from 'react';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users,
  Car,
  MapPin,
  DollarSign,
  AlertTriangle,
  Activity,
  RefreshCw,
  Clock,
  Phone,
  Star,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useBureauRealtimeStats, OnlineDriver, RecentActivity } from '@/hooks/useBureauRealtimeStats';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BureauRealtimeDashboardProps {
  bureauId: string;
  bureauName?: string;
}

export function BureauRealtimeDashboard({ bureauId, bureauName }: BureauRealtimeDashboardProps) {
  const { stats, onlineDrivers, recentActivity, loading, error, refresh } = useBureauRealtimeStats(bureauId);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    setLastUpdate(new Date());
  }, [stats]);

  const formatCurrency = useFormatCurrency();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
          <Button onClick={refresh} variant="outline" className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Monitoring Temps Réel</h2>
          {bureauName && <p className="text-muted-foreground">{bureauName}</p>}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4 text-[#ff4000] animate-pulse" />
            <span>Mise à jour: {formatDistanceToNow(lastUpdate, { addSuffix: true, locale: fr })}</span>
          </div>
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Total Chauffeurs"
          value={stats.total_drivers}
          icon={<Users className="h-5 w-5" />}
          color="bg-blue-500/10 text-blue-500"
        />
        <StatCard
          title="En Ligne"
          value={stats.online_drivers}
          icon={<Wifi className="h-5 w-5" />}
          color="bg-[#ff4000]/10 text-[#ff4000]"
          badge={stats.online_drivers > 0 ? 'live' : undefined}
        />
        <StatCard
          title="En Course"
          value={stats.on_trip_drivers}
          icon={<Car className="h-5 w-5" />}
          color="bg-[#ff4000]/10 text-[#ff4000]"
        />
        <StatCard
          title="Courses Aujourd'hui"
          value={stats.today_rides}
          icon={<MapPin className="h-5 w-5" />}
          color="bg-[#04439e]/10 text-[#04439e]"
        />
        <StatCard
          title="Revenus Aujourd'hui"
          value={formatCurrency(stats.today_earnings)}
          icon={<DollarSign className="h-5 w-5" />}
          color="bg-[#ff4000]/10 text-[#ff4000]"
          isText
        />
        <StatCard
          title="Alertes SOS"
          value={stats.active_sos}
          icon={<AlertTriangle className="h-5 w-5" />}
          color={stats.active_sos > 0 ? "bg-[#ff4000]/10 text-[#ff4000]" : "bg-gray-500/10 text-gray-500"}
          urgent={stats.active_sos > 0}
        />
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Online Drivers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wifi className="h-5 w-5 text-[#ff4000]" />
              Chauffeurs en Ligne ({onlineDrivers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {onlineDrivers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <WifiOff className="h-12 w-12 mb-2" />
                  <p>Aucun chauffeur en ligne</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {onlineDrivers.map(driver => (
                    <DriverCard key={driver.id} driver={driver} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              Activité Récente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Activity className="h-12 w-12 mb-2" />
                  <p>Aucune activité récente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map(activity => (
                    <ActivityItem key={activity.id} activity={activity} />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* SOS Alert Banner */}
      {stats.active_sos > 0 && (
        <Card className="border-[#ff4000] bg-[#ff4000]/5 animate-pulse">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-[#ff4000]" />
                <div>
                  <p className="font-bold text-[#ff4000]">
                    {stats.active_sos} Alerte(s) SOS Active(s)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Intervention immédiate requise
                  </p>
                </div>
              </div>
              <Button variant="destructive">
                Voir les Alertes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Sub-components
interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  badge?: string;
  urgent?: boolean;
  isText?: boolean;
}

function StatCard({ title, value, icon, color, badge, urgent, isText }: StatCardProps) {
  return (
    <Card className={urgent ? 'border-[#ff4000] animate-pulse' : ''}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className={`p-2 rounded-lg ${color}`}>
            {icon}
          </div>
          {badge && (
            <Badge variant="secondary" className="bg-[#ff4000] text-white text-xs">
              {badge}
            </Badge>
          )}
        </div>
        <p className={`font-bold ${isText ? 'text-lg' : 'text-2xl'}`}>{value}</p>
        <p className="text-xs text-muted-foreground truncate">{title}</p>
      </CardContent>
    </Card>
  );
}

function DriverCard({ driver }: { driver: OnlineDriver }) {
  const statusColors = {
    available: 'bg-[#ff4000]',
    on_trip: 'bg-[#ff4000]',
    offline: 'bg-gray-500'
  };

  const driverLabel = driver.vehicle_plate || driver.vehicle_type || 'Chauffeur';

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-background ${statusColors[driver.status as keyof typeof statusColors] || 'bg-gray-500'}`} />
        </div>
        <div>
          <p className="font-medium">{driverLabel}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {driver.vehicle_type && (
              <span className="flex items-center gap-1">
                <Car className="h-3 w-3" />
                {driver.vehicle_type}
              </span>
            )}
            {driver.rating && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 text-[#ff4000]" />
                {driver.rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {driver.last_lat && driver.last_lng && (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MapPin className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Phone className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ActivityItem({ activity }: { activity: RecentActivity }) {
  const typeIcons = {
    trip: <Car className="h-4 w-4" />,
    sos: <AlertTriangle className="h-4 w-4 text-[#ff4000]" />,
    driver_online: <Wifi className="h-4 w-4 text-[#ff4000]" />,
    driver_offline: <WifiOff className="h-4 w-4 text-gray-500" />
  };

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="p-2 rounded-full bg-muted">
        {typeIcons[activity.type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{activity.message}</p>
        {activity.driver_name && (
          <p className="text-xs text-muted-foreground">{activity.driver_name}</p>
        )}
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: fr })}
      </span>
    </div>
  );
}
