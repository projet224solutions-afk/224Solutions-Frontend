/**
 * 🚕 PDG BUREAU MONITORING - Vue globale des bureaux syndicaux
 * Utilise la fonction get_bureau_realtime_stats pour afficher les stats en temps réel
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { formatCurrency } from '@/lib/formatters';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Building2, Users, Car, AlertTriangle, DollarSign,
  Activity, RefreshCw, ExternalLink, MapPin, TrendingUp,
  Clock, Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Bureau {
  id: string;
  bureau_code: string;
  commune: string;
  prefecture: string;
  president_name: string | null;
  status: string | null;
  total_members: number | null;
}

interface BureauStats {
  bureau: Bureau;
  stats: {
    total_drivers: number;
    online_drivers: number;
    on_trip_drivers: number;
    today_rides: number;
    today_earnings: number;
    active_sos: number;
  } | null;
  loading: boolean;
  error: string | null;
}

export default function PDGBureauMonitoring() {
  const { t } = useTranslation();
  const _navigate = useNavigate();
  const [bureaus, setBureaus] = useState<BureauStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchBureausWithStats = useCallback(async () => {
    setLoading(true);
    try {
      // Récupérer tous les bureaux
      const { data: bureausData, error: bureausError } = await supabase
        .from('bureaus')
        .select('id, bureau_code, commune, prefecture, president_name, status, total_members')
        .order('commune', { ascending: true });

      if (bureausError) throw bureausError;

      if (!bureausData || bureausData.length === 0) {
        setBureaus([]);
        return;
      }

      // Initialiser les bureaux avec un état de chargement
      const initialBureaus: BureauStats[] = bureausData.map(bureau => ({
        bureau,
        stats: null,
        loading: true,
        error: null
      }));
      setBureaus(initialBureaus);

      // Récupérer les stats pour chaque bureau en parallèle
      const statsPromises = bureausData.map(async (bureau) => {
        try {
          const { data, error } = await supabase.rpc('get_bureau_realtime_stats', {
            p_bureau_id: bureau.id
          });

          if (error) throw error;

          return {
            bureau,
            stats: data?.[0] || {
              total_drivers: 0,
              online_drivers: 0,
              on_trip_drivers: 0,
              today_rides: 0,
              today_earnings: 0,
              active_sos: 0
            },
            loading: false,
            error: null
          };
        } catch (error: any) {
          console.warn(`Erreur stats bureau ${bureau.bureau_code}:`, error);
          return {
            bureau,
            stats: null,
            loading: false,
            error: error.message
          };
        }
      });

      const results = await Promise.all(statsPromises);
      setBureaus(results);
      setLastUpdate(new Date());

    } catch (error: any) {
      console.error('Erreur chargement bureaux:', error);
      toast.error(t('pDGBureauMonitoring.erreurDeChargementDesBureaux'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBureausWithStats();

    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchBureausWithStats, 30000);
    return () => clearInterval(interval);
  }, [fetchBureausWithStats]);

  // Calcul des totaux globaux
  const globalStats = bureaus.reduce((acc, b) => {
    if (b.stats) {
      acc.totalDrivers += b.stats.total_drivers;
      acc.onlineDrivers += b.stats.online_drivers;
      acc.onTripDrivers += b.stats.on_trip_drivers;
      acc.todayRides += b.stats.today_rides;
      acc.todayEarnings += Number(b.stats.today_earnings);
      acc.activeSOS += b.stats.active_sos;
    }
    return acc;
  }, {
    totalDrivers: 0,
    onlineDrivers: 0,
    onTripDrivers: 0,
    todayRides: 0,
    todayEarnings: 0,
    activeSOS: 0
  });

  const openBureauMonitoring = (bureauId: string) => {
    // Stocker le bureau ID et rediriger vers le monitoring
    sessionStorage.setItem('pdg_selected_bureau_id', bureauId);
    window.open(`/bureau/monitoring?bureau=${bureauId}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Monitoring Global des Bureaux
          </h2>
          <p className="text-muted-foreground">
            Vue en temps réel de tous les bureaux syndicaux
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Mis à jour: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={fetchBureausWithStats} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-4 text-center">
            <Building2 className="w-6 h-6 mx-auto mb-2 text-blue-500" />
            <div className="text-2xl font-bold text-blue-600">{bureaus.length}</div>
            <div className="text-xs text-muted-foreground">Bureaux</div>
          </CardContent>
        </Card>

        <Card className="bg-[#ff4000]/10 border-[#ff4000]/20">
          <CardContent className="p-4 text-center">
            <Users className="w-6 h-6 mx-auto mb-2 text-[#ff4000]" />
            <div className="text-2xl font-bold text-[#ff4000]">{globalStats.totalDrivers}</div>
            <div className="text-xs text-muted-foreground">Chauffeurs Total</div>
          </CardContent>
        </Card>

        <Card className="bg-[#ff4000]/10 border-[#ff4000]/20">
          <CardContent className="p-4 text-center">
            <Activity className="w-6 h-6 mx-auto mb-2 text-[#ff4000]" />
            <div className="text-2xl font-bold text-[#ff4000]">{globalStats.onlineDrivers}</div>
            <div className="text-xs text-muted-foreground">En Ligne</div>
          </CardContent>
        </Card>

        <Card className="bg-[#04439e]/10 border-[#04439e]/20">
          <CardContent className="p-4 text-center">
            <Car className="w-6 h-6 mx-auto mb-2 text-[#04439e]" />
            <div className="text-2xl font-bold text-[#04439e]">{globalStats.onTripDrivers}</div>
            <div className="text-xs text-muted-foreground">En Course</div>
          </CardContent>
        </Card>

        <Card className="bg-[#ff4000]/10 border-[#ff4000]/20">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 mx-auto mb-2 text-[#ff4000]" />
            <div className="text-2xl font-bold text-[#ff4000]">{globalStats.todayRides}</div>
            <div className="text-xs text-muted-foreground">Courses Aujourd'hui</div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${globalStats.activeSOS > 0 ? 'from-[#ff4000]/20 to-[#ff4000]/10 border-[#ff4000]/40 animate-pulse' : 'from-slate-500/10 to-slate-600/5 border-slate-500/20'}`}>
          <CardContent className="p-4 text-center">
            <AlertTriangle className={`w-6 h-6 mx-auto mb-2 ${globalStats.activeSOS > 0 ? 'text-[#ff4000]' : 'text-slate-400'}`} />
            <div className={`text-2xl font-bold ${globalStats.activeSOS > 0 ? 'text-[#ff4000]' : 'text-slate-500'}`}>
              {globalStats.activeSOS}
            </div>
            <div className="text-xs text-muted-foreground">Alertes SOS</div>
          </CardContent>
        </Card>
      </div>

      {/* Revenus du jour */}
      <Card className="bg-[#ff4000]/5 border-[#ff4000]/20">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-[#ff4000]" />
            <div>
              <p className="text-sm text-muted-foreground">{t('pDGBureauMonitoring.revenusTotauxDuJour')}</p>
              <p className="text-3xl font-bold text-[#ff4000]">
                {formatCurrency(globalStats.todayEarnings)}
              </p>
            </div>
          </div>
          <Badge className="bg-[#ff4000]/20 text-[#ff4000] border-[#ff4000]/30">
            <Shield className="w-3 h-3 mr-1" />
            Temps réel
          </Badge>
        </CardContent>
      </Card>

      {/* Liste des bureaux */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Bureaux par Localisation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {loading && bureaus.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : bureaus.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Aucun bureau trouvé
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bureaus.map(({ bureau, stats, loading: statLoading, error }) => (
                  <Card
                    key={bureau.id}
                    className={`hover:shadow-lg transition-all cursor-pointer group ${
                      stats?.active_sos && stats.active_sos > 0
                        ? 'border-[#ff4000]/50 bg-[#ff4000]/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => openBureauMonitoring(bureau.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-bold text-lg">{bureau.commune}</h4>
                          <p className="text-sm text-muted-foreground">{bureau.prefecture}</p>
                        </div>
                        <Badge variant={bureau.status === 'active' ? 'default' : 'secondary'}>
                          {bureau.bureau_code}
                        </Badge>
                      </div>

                      {statLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                        </div>
                      ) : error ? (
                        <p className="text-xs text-[#ff4000]">{error}</p>
                      ) : stats ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                          <div className="p-2 bg-muted/50 rounded">
                            <div className="text-lg font-bold">{stats.total_drivers}</div>
                            <div className="text-xs text-muted-foreground">Chauffeurs</div>
                          </div>
                          <div className="p-2 bg-[#ff4000]/10 rounded">
                            <div className="text-lg font-bold text-[#ff4000]">{stats.online_drivers}</div>
                            <div className="text-xs text-muted-foreground">En ligne</div>
                          </div>
                          <div className="p-2 bg-[#04439e]/10 rounded">
                            <div className="text-lg font-bold text-[#04439e]">{stats.on_trip_drivers}</div>
                            <div className="text-xs text-muted-foreground">En course</div>
                          </div>
                        </div>
                      ) : null}

                      {stats && (
                        <div className="mt-3 pt-3 border-t flex items-center justify-between">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Courses:</span>{' '}
                            <span className="font-medium">{stats.today_rides}</span>
                          </div>
                          {stats.active_sos > 0 && (
                            <Badge className="bg-[#ff4000] text-white animate-pulse">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {stats.active_sos} SOS
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              openBureauMonitoring(bureau.id);
                            }}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
