import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Phone, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import CommunicationWidget from '@/components/communication/CommunicationWidget';

export default function WorkerDashboard() {
  const { t } = useTranslation();
  const { token } = useParams();
  const navigate = useNavigate();
  const [worker, setWorker] = useState<any>(null);
  const [bureau, setBureau] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [motos, setMotos] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      loadWorkerData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadWorkerData = async () => {
    try {
      setLoading(true);

      // Charger les données du travailleur
      const { data: workerData, error: workerError } = await supabase
        .from('syndicate_workers')
        .select('*')
        .eq('access_token', token)
        .single();

      if (workerError) throw workerError;
      if (!workerData) {
        toast.error(t('workerDashboard.accesNonTrouve'));
        navigate('/');
        return;
      }

      setWorker(workerData);

      // Charger les données du bureau
      const { data: bureauData } = await supabase
        .from('bureaus')
        .select('*')
        .eq('id', workerData.bureau_id)
        .single();

      setBureau(bureauData);

      // Charger les données selon les permissions
      const permissions = workerData.permissions as any;
      const promises = [];

      if (permissions.view_members) {
        promises.push(
          supabase.from('syndicate_workers').select('*').eq('bureau_id', workerData.bureau_id) // Utiliser syndicate_workers
        );
      }

      if (permissions.view_vehicles) {
        promises.push(
          supabase.from('vehicles').select('*').eq('bureau_id', workerData.bureau_id) // Utiliser vehicles
        );
      }

      promises.push(
        supabase.from('syndicate_alerts').select('*').eq('bureau_id', workerData.bureau_id).order('created_at', { ascending: false })
      );

      const results = await Promise.all(promises);

      let resultIndex = 0;
      if (permissions.view_members) {
        setMembers(results[resultIndex++].data || []);
      }
      if (permissions.view_vehicles) {
        setMotos(results[resultIndex++].data || []);
      }
      setAlerts(results[resultIndex].data || []);

    } catch (error) {
      console.error('Erreur chargement travailleur:', error);
      toast.error(t('workerDashboard.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{t('workerDashboard.accesNonTrouve')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{t('workerDashboard.leLienDAccesEst')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{worker.nom}</h1>
          <p className="text-muted-foreground">
            {bureau?.bureau_code} - {bureau?.prefecture}
          </p>
          <Badge className="mt-2">{worker.access_level}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Phone className="w-4 h-4 mr-2" />
            Support Technique
          </Button>
          <Button variant="outline">
            <MessageSquare className="w-4 h-4 mr-2" />
            Contact Bureau
          </Button>
        </div>
      </div>

      {/* Statistiques accessibles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {worker.permissions.view_members && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Membres</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{members.length}</div>
            </CardContent>
          </Card>
        )}
        {worker.permissions.view_vehicles && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{t('workerDashboard.vehicules')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{motos.length}</div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Alertes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ff4000]">
              {alerts.filter(a => !a.is_read).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Permissions actives */}
      <Card>
        <CardHeader>
          <CardTitle>Mes Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(worker.permissions as any).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${value ? 'bg-[#ff4000]' : 'bg-gray-300'}`} />
                <span className="text-sm">
                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contenu selon permissions */}
      {(worker.permissions as any).view_members && (
        <Card>
          <CardHeader>
            <CardTitle>Membres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <h3 className="font-medium">{member.name}</h3>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge>{member.status}</Badge>
                </div>
              ))}
              {members.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  Aucun membre
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(worker.permissions as any).view_vehicles && (
        <Card>
          <CardHeader>
            <CardTitle>{t('workerDashboard.vehicules')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {motos.map((moto) => (
                <div key={moto.id} className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <h3 className="font-medium">{moto.serial_number}</h3>
                    <p className="text-sm text-muted-foreground">
                      {moto.brand} {moto.model} • {moto.year} • {moto.color}
                    </p>
                  </div>
                  <Badge>{moto.status}</Badge>
                </div>
              ))}
              {motos.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  Aucun véhicule
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alertes */}
      <Card>
        <CardHeader>
          <CardTitle>Alertes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-4 p-4 rounded-lg border ${
                  alert.is_critical ? 'border-orange-200 bg-orange-50' : 'border-orange-200 bg-orange-50'
                }`}
              >
                <AlertCircle className={`w-5 h-5 ${alert.is_critical ? 'text-[#ff4000]' : 'text-[#ff4000]'} flex-shrink-0 mt-0.5`} />
                <div className="flex-1">
                  <h3 className={`font-medium ${alert.is_critical ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
                    {alert.title}
                  </h3>
                  <p className={`text-sm mt-1 ${alert.is_critical ? 'text-[#ff4000]' : 'text-[#ff4000]'}`}>
                    {alert.message}
                  </p>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Aucune alerte
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Widget de communication flottant */}
      <CommunicationWidget position="bottom-right" showNotifications={true} />
    </div>
  );
}
