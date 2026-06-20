
import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ENDPOINTS = [
  { name: 'API Auth', url: '/api/auth/health' },
  { name: 'API Produits', url: '/api/products/health' },
  { name: 'API Commandes', url: '/api/orders/health' },
  { name: 'API Paiements', url: '/api/payments/health' },
  { name: 'API Notifications', url: '/api/notifications/health' },
];

export default function PDGApiSupervision() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'ok'|'degraded'|'down'>('ok');
  const [latency, setLatency] = useState<number|null>(null);
  const [availability, setAvailability] = useState<number|null>(null);
  const [incidents, setIncidents] = useState<number|null>(null);
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [criticalEvents, setCriticalEvents] = useState<any[]>([]);
  const [openIncidents, setOpenIncidents] = useState<any[]>([]);

  useEffect(() => {
    // Mesure la latence et le statut de chaque endpoint
    Promise.all(ENDPOINTS.map(async (ep) => {
      const start = performance.now();
      try {
        const res = await fetch(ep.url, { method: 'GET' });
        const elapsed = Math.round(performance.now() - start);
        return {
          name: ep.name,
          status: res.ok ? 'operational' : 'down',
          latency: `${elapsed}ms`,
        };
      } catch {
        return {
          name: ep.name,
          status: 'down',
          latency: 'N/A',
        };
      }
    })).then((results) => {
      setEndpoints(results);
      // Statut global
      if (results.some(r => r.status === 'down')) setStatus('degraded');
      else setStatus('ok');
      // Latence moyenne
      const validLatencies = results.map(r => parseInt(r.latency)).filter(n => !isNaN(n));
      setLatency(validLatencies.length ? Math.round(validLatencies.reduce((a,b)=>a+b,0)/validLatencies.length) : null);
      // Disponibilité (simple: % endpoints up)
      setAvailability(Math.round(100 * results.filter(r=>r.status==='operational').length / results.length));
    });

    // Incidents critiques (24h) avec filtrage + gestion erreurs robuste
    supabase
      .from('security_incidents')
      .select('*')
      .eq('severity', 'critical')
      .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString())
      .then(({ data, error }) => {
        if (error) {
          console.warn('Lecture incidents critiques refusée:', error);
          setCriticalEvents([]);
        } else {
          setCriticalEvents(data || []);
        }
      });

    // Incidents ouverts avec gestion erreurs
    supabase
      .from('security_incidents')
      .select('*')
      .eq('status', 'open')
      .then(({ data, error }) => {
        if (error) {
          console.warn('Lecture incidents ouverts refusée:', error);
          setOpenIncidents([]);
        } else {
          setOpenIncidents(data || []);
        }
      });

    // Nombre d'incidents 24h
    supabase
      .from('security_incidents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .then(({ count, error }) => {
        if (error) {
          console.warn('Lecture security_incidents refusée:', error);
          setIncidents(0);
        } else {
          setIncidents(count || 0);
        }
      });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Supervision API</h2>
        <p className="text-muted-foreground">{t('pDGApiSupervision.surveillezLesPerformancesEtLa')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Statut Global</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {status === 'ok' && <CheckCircle className="h-5 w-5 text-[#ff4000]" />}
              {status === 'degraded' && <AlertTriangle className="h-5 w-5 text-orange-500" />}
              {status === 'down' && <XCircle className="h-5 w-5 text-[#ff4000]" />}
              <span className="text-2xl font-bold">
                {status === 'ok' && 'Opérationnel'}
                {status === 'degraded' && 'Dégradé'}
                {status === 'down' && 'Hors service'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('pDGApiSupervision.tempsDeReponse')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latency !== null ? `${latency}ms` : '...'}</div>
            <p className="text-xs text-muted-foreground">{t('pDGApiSupervision.moyenneSur5Endpoints')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('pDGApiSupervision.disponibilite')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availability !== null ? `${availability}%` : '...'}</div>
            <p className="text-xs text-muted-foreground">% endpoints UP</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incidents ouverts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{incidents !== null ? incidents : '...'}</div>
            <p className="text-xs text-muted-foreground">{t('pDGApiSupervision.dernieres24h')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('pDGApiSupervision.endpointsSurveilles')}</CardTitle>
          <CardDescription>{t('pDGApiSupervision.etatEnTempsReelDes')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {endpoints.map((endpoint) => (
              <div key={endpoint.name} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  {endpoint.status === 'operational' ? (
                    <CheckCircle className="h-5 w-5 text-[#ff4000]" />
                  ) : (
                    <XCircle className="h-5 w-5 text-[#ff4000]" />
                  )}
                  <div>
                    <p className="font-medium">{endpoint.name}</p>
                    <p className="text-sm text-muted-foreground">Latence: {endpoint.latency}</p>
                  </div>
                </div>
                <Badge variant="outline" className={endpoint.status === 'operational' ? 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20' : 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20'}>
                  {endpoint.status === 'operational' ? 'Opérationnel' : 'Hors service'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Incidents critiques (24h)</CardTitle>
          <CardDescription>{t('pDGApiSupervision.logsDAuditCritiquesDetectes')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {criticalEvents.length === 0 && <div className="text-muted-foreground">{t('pDGApiSupervision.aucunEvenementCritiqueDetecte')}</div>}
            {criticalEvents.map((evt, i) => (
              <div key={i} className="p-2 border rounded flex flex-col gap-1">
                <span className="font-semibold">{evt.event_type}</span>
                <span className="text-xs text-muted-foreground">{evt.created_at}</span>
                <span className="text-xs">{evt.details}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Incidents ouverts</CardTitle>
          <CardDescription>{t('pDGApiSupervision.resumeParSeverite')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {openIncidents.length === 0 && <div className="text-muted-foreground">{t('pDGApiSupervision.aucunIncidentOuvert')}</div>}
            {openIncidents.map((inc, i) => (
              <div key={i} className="flex items-center gap-4 p-2 border rounded">
                <span className="font-semibold">{inc.severity}</span>
                <span className="text-xs">{inc.open_count} ouverts</span>
                <span className="text-xs text-muted-foreground">Dernier: {inc.latest_incident}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
