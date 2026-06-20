/**
 * PANEL ADMIN/PDG TAXI MOTO
 * Interface de monitoring et gestion pour admin et PDG
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/Money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from '@/integrations/supabase/client';
import { Activity, DollarSign, Users, TrendingUp, AlertTriangle } from 'lucide-react';

export function TaxiMotoAdminPanel() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    activeRides: 0,
    totalRides: 0,
    totalDrivers: 0,
    onlineDrivers: 0,
    totalRevenue: 0,
    todayRevenue: 0
  });
  const [recentRides, setRecentRides] = useState<any[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
    loadRecentRides();
    loadFraudAlerts();
  }, []);

  const loadStats = async () => {
    const { data: rides } = await supabase.from('taxi_trips').select('status, price_total');
    const { data: drivers } = await supabase.from('taxi_drivers').select('is_online');

    setStats({
      activeRides: rides?.filter(r => ['requested', 'accepted', 'started'].includes(r.status || '')).length || 0,
      totalRides: rides?.length || 0,
      totalDrivers: drivers?.length || 0,
      onlineDrivers: drivers?.filter(d => d.is_online).length || 0,
      totalRevenue: rides?.reduce((sum, r) => sum + ((r.price_total || 0) * 0.15), 0) || 0,
      todayRevenue: 0
    });
  };

  const loadRecentRides = async () => {
    const { data } = await supabase
      .from('taxi_trips')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(10);
    setRecentRides(data || []);
  };

  const loadFraudAlerts = async () => {
    const { data } = await supabase
      .from('taxi_fraud_detection' as any)
      .select('*')
      .eq('is_resolved', false)
      .order('created_at', { ascending: false });
    setFraudAlerts(data || []);
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">🏍️ Admin Taxi Moto</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground">Courses actives</p>
              <p className="text-2xl font-bold">{stats.activeRides}</p>
            </div>
            <Activity className="w-6 h-6 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground">Chauffeurs en ligne</p>
              <p className="text-2xl font-bold">{stats.onlineDrivers}/{stats.totalDrivers}</p>
            </div>
            <Users className="w-6 h-6 text-[#ff4000]" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground">Revenus totaux</p>
              <p className="text-2xl font-bold"><Money amount={Math.round(stats.totalRevenue)} from="GNF" /></p>
            </div>
            <DollarSign className="w-6 h-6 text-blue-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground">Total courses</p>
              <p className="text-2xl font-bold">{stats.totalRides}</p>
            </div>
            <TrendingUp className="w-6 h-6 text-orange-500" />
          </div>
        </Card>
      </div>

      {/* Alertes fraude */}
      {fraudAlerts.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h2 className="text-xl font-semibold">Alertes fraude ({fraudAlerts.length})</h2>
          </div>
          <div className="space-y-2">
            {fraudAlerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="p-3 bg-destructive/10 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge variant="destructive" className="mb-1">{alert.severity}</Badge>
                    <p className="font-medium">{alert.fraud_type}</p>
                    <p className="text-sm text-muted-foreground">{alert.description}</p>
                  </div>
                  <Button size="sm" variant="outline">Examiner</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Courses récentes */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">{t('taxiMotoAdminPanel.coursesRecentes')}</h2>
        <div className="space-y-2">
          {recentRides.map((ride) => (
            <div key={ride.id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">{ride.pickup_address}</p>
                <p className="text-sm text-muted-foreground">→ {ride.dropoff_address}</p>
              </div>
              <div className="text-right">
                <Badge>{ride.status}</Badge>
                <p className="text-sm font-semibold mt-1"><Money amount={(ride as any).price_total || (ride as any).estimated_price || 0} from="GNF" /></p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
