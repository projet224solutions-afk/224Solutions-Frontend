/**
 * 🚗 PDG DRIVERS MANAGEMENT
 * Gestion centralisée des livreurs
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bike, Activity, RefreshCw, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Driver {
  id: string;
  user_id: string;
  license_number: string;
  vehicle_type: string;
  is_online: boolean;
  is_verified: boolean;
  rating: number;
  total_deliveries: number;
  created_at: string;
}

export default function PDGDrivers() {
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    online: 0,
    offline: 0,
    total: 0,
    verified: 0
  });

  const loadDrivers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setDrivers(data || []);

      const online = data?.filter(d => d.is_online).length || 0;
      const offline = data?.filter(d => !d.is_online).length || 0;
      const verified = data?.filter(d => d.is_verified).length || 0;

      setStats({
        online,
        offline,
        total: data?.length || 0,
        verified
      });
    } catch (error: any) {
      console.error('Erreur chargement livreurs:', error);
      toast.error(t('pDGDrivers.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span>{t('pDGDrivers.chargementDesLivreurs')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Livreurs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.total}</span>
              <Bike className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">En ligne</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.online}</span>
              <Activity className="w-5 h-5 text-[#ff4000]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Hors ligne</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.offline}</span>
              <Activity className="w-5 h-5 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('pDGDrivers.verifies')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.verified}</span>
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des livreurs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('pDGDrivers.listeDesLivreurs')}</CardTitle>
              <CardDescription>{drivers.length} livreurs enregistrés</CardDescription>
            </div>
            <Button onClick={loadDrivers} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {drivers.map((driver) => (
              <div key={driver.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Bike className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{driver.license_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {driver.vehicle_type} • {driver.total_deliveries} livraisons
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={driver.is_online ? 'default' : 'secondary'}>
                    {driver.is_online ? 'En ligne' : 'Hors ligne'}
                  </Badge>
                  {driver.is_verified && (
                    <Badge variant="outline" className="bg-blue-50">
                      Vérifié
                    </Badge>
                  )}
                  <span className="text-sm">⭐ {driver.rating?.toFixed(1) || 'N/A'}</span>
                  <Button variant="ghost" size="sm">
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
