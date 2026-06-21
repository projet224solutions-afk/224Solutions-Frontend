import { useTranslation } from "@/hooks/useTranslation";
/**
 * Dashboard Multi-Cloud Health Check - Production-grade
 * Real-time monitoring with DB-backed status and Supabase Realtime
 */
import { useState } from 'react';
import { useMultiCloudHealth } from '@/hooks/useMultiCloudHealth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  RefreshCw, Cloud, Database, Shield, Bell, Server,
  CheckCircle, AlertTriangle, XCircle, HelpCircle,
  Activity, Clock, Wifi, Globe, Zap, TrendingUp, Eye
} from 'lucide-react';
import type { ServiceStatus, CloudProvider, CloudServiceCheck } from '@/services/MultiCloudHealthService';
import { cn } from '@/lib/utils';

const statusConfig: Record<ServiceStatus, { color: string; bgColor: string; icon: typeof CheckCircle; label: string; textColor: string }> = {
  operational: { color: 'bg-[#ff4000]', bgColor: 'bg-[#ff4000]/10', icon: CheckCircle, label: 'Opérationnel', textColor: 'text-[#ff4000]' },
  degraded: { color: 'bg-[#ff4000]', bgColor: 'bg-[#ff4000]/10', icon: AlertTriangle, label: 'Dégradé', textColor: 'text-[#ff4000]' },
  outage: { color: 'bg-[#ff4000]', bgColor: 'bg-[#ff4000]/10', icon: XCircle, label: 'Panne', textColor: 'text-[#ff4000]' },
  unknown: { color: 'bg-slate-400', bgColor: 'bg-slate-400/10', icon: HelpCircle, label: 'Inconnu', textColor: 'text-slate-500' }
};

const providerConfig: Record<CloudProvider, { label: string; icon: typeof Cloud; color: string; bgGradient: string; description: string }> = {
  supabase: { label: 'Supabase', icon: Database, color: 'text-[#ff4000]', bgGradient: '', description: 'DB, Auth, Realtime, Edge Functions, Storage' },
  aws: { label: 'AWS', icon: Server, color: 'text-orange-500', bgGradient: '', description: 'Lambda Backend, Cognito Auth' },
  google_cloud: { label: 'Google Cloud', icon: Cloud, color: 'text-blue-500', bgGradient: '', description: 'Cloud Storage, Cloud Functions' },
  firebase: { label: 'Firebase', icon: Bell, color: 'text-[#ff4000]', bgGradient: '', description: 'Cloud Messaging (FCM)' }
};

function StatusDot({ status, pulse = false }: { status: ServiceStatus; pulse?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={cn(
      'w-2.5 h-2.5 rounded-full',
      statusConfig[status].color,
      pulse && status === 'operational' && 'animate-pulse'
    )} />
  );
}

function ServiceRow({ svc }: { svc: CloudServiceCheck }) {
  const { t } = useTranslation();
  const config = statusConfig[svc.status];
  const Icon = config.icon;
  const latencyColor = svc.responseTime < 500 ? 'text-[#ff4000]' : svc.responseTime < 1500 ? 'text-[#ff4000]' : 'text-[#ff4000]';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50 transition-colors cursor-default">
            <div className="flex items-center gap-2.5">
              <Icon className={cn('h-3.5 w-3.5', config.textColor)} />
              <span className="text-sm font-medium">{svc.service}</span>
            </div>
            <span className={cn('text-xs font-mono font-medium', latencyColor)}>{svc.responseTime}ms</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold text-sm">{svc.service}</p>
            <p className="text-xs text-muted-foreground">{svc.message}</p>
            <p className="text-xs text-muted-foreground">{t('multiCloudDashboard.verificationReelle')}</p>
            <p className="text-xs text-muted-foreground">
              Vérifié : {new Date(svc.lastChecked).toLocaleTimeString('fr-FR')}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function MultiCloudDashboard() {
  const { t } = useTranslation();
  const { report, isChecking, refresh, history, providers: dbProviders, services: dbServices, incidents: dbIncidents, lastUpdate } = useMultiCloudHealth(30000);
  const [showHistory, setShowHistory] = useState(false);

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center p-16 gap-4">
        <div className="relative">
          <Cloud className="h-12 w-12 text-muted-foreground/30" />
          <RefreshCw className="h-5 w-5 animate-spin text-primary absolute -bottom-1 -right-1" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-medium text-foreground">{t('multiCloudDashboard.analyseDeLInfrastructure')}</p>
          <p className="text-sm text-muted-foreground">{t('multiCloudDashboard.verificationDe10ServicesCloud')}</p>
        </div>
      </div>
    );
  }

  const overallConfig = statusConfig[report.overall];
  const OverallIcon = overallConfig.icon;
  const totalServices = report.totalChecks;

  const lastFive = history.slice(-5);
  const avgUptime = lastFive.length > 0
    ? Math.round(lastFive.reduce((s, r) => s + r.uptimePercent, 0) / lastFive.length)
    : report.uptimePercent;

  return (
    <div className="space-y-6">
      {/* === HEADER === */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Globe className="h-7 w-7 text-primary" />
            <StatusDot status={report.overall} pulse />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Infrastructure Multi-Cloud</h2>
            <p className="text-sm text-muted-foreground">
              Monitoring temps réel — 4 providers, {totalServices} services (100% checks réels)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 text-xs">
            <Activity className="h-3 w-3" />
            Refresh: 30s + Realtime
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isChecking}
            className="gap-1.5"
          >
            <RefreshCw className={cn('h-4 w-4', isChecking && 'animate-spin')} />
            {isChecking ? 'Vérification...' : 'Rafraîchir'}
          </Button>
        </div>
      </div>

      {/* === SCORE GLOBAL === */}
      <Card className={cn('border-2',
        report.overall === 'operational' ? 'border-[#ff4000]/30' :
        report.overall === 'degraded' ? 'border-[#ff4000]/30' : 'border-[#ff4000]/30'
      )}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-2.5 rounded-xl', overallConfig.bgColor)}>
                <OverallIcon className={cn('h-6 w-6', overallConfig.textColor)} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{overallConfig.label}</span>
                  <Badge variant="secondary" className="text-xs font-mono">
                    {report.uptimePercent}%
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {report.healthyChecks}/{report.totalChecks} services opérationnels
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>Tendance: {avgUptime}%</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{lastUpdate.toLocaleTimeString('fr-FR')}</span>
              </div>
            </div>
          </div>

          <Progress value={report.uptimePercent} className="h-3 rounded-full" />

          {/* Mini stats par provider */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {(Object.keys(report.providers) as CloudProvider[]).map(provider => {
              const prov = report.providers[provider];
              const config = providerConfig[provider];
              return (
                <div key={provider} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <StatusDot status={prov.status} />
                  <span className="text-xs font-medium truncate">{config.label}</span>
                  <span className="text-xs text-muted-foreground ml-auto font-mono">{prov.avgResponseTime}ms</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* === DB STATUS (REALTIME) === */}
      {dbProviders.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Providers & Services (DB Realtime)
              <Badge variant="outline" className="text-[10px]">LIVE</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {dbProviders.map(prov => {
                const st = prov.status === 'healthy' ? 'operational' : prov.status === 'degraded' ? 'degraded' : prov.status === 'down' ? 'outage' : 'unknown';
                return (
                  <div key={prov.id} className="flex items-center gap-1.5 p-2 rounded bg-muted/30 text-xs border">
                    <StatusDot status={st as ServiceStatus} />
                    <span className="truncate font-semibold capitalize">{prov.name}</span>
                    {prov.latency != null && <span className="ml-auto text-muted-foreground font-mono">{prov.latency}ms</span>}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {dbServices.map(svc => {
                const st = svc.status === 'healthy' ? 'operational' : svc.status === 'degraded' ? 'degraded' : svc.status === 'down' ? 'outage' : 'unknown';
                return (
                  <div key={svc.id} className="flex items-center gap-1.5 p-1.5 rounded bg-muted/20 text-xs">
                    <StatusDot status={st as ServiceStatus} />
                    <span className="truncate font-medium">{svc.display_name || svc.name}</span>
                  </div>
                );
              })}
            </div>
            {dbIncidents.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-semibold text-destructive">Incidents ouverts ({dbIncidents.length})</p>
                {dbIncidents.slice(0, 5).map(inc => (
                  <div key={inc.id} className="text-xs p-1.5 rounded bg-destructive/10 text-destructive">
                    {inc.title} — {inc.message}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* === PROVIDERS DETAIL === */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.keys(report.providers) as CloudProvider[]).map(provider => {
          const prov = report.providers[provider];
          const config = providerConfig[provider];
          const ProvIcon = config.icon;
          const provStatus = statusConfig[prov.status];

          return (
            <Card key={provider} className="overflow-hidden">
              <div className={cn('bg-gradient-to-r', config.bgGradient)}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-background/80 backdrop-blur-sm">
                        <ProvIcon className={cn('h-5 w-5', config.color)} />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{config.label}</CardTitle>
                        <p className="text-[11px] text-muted-foreground">{config.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn('text-[10px] font-mono', provStatus.textColor)}>
                        {prov.avgResponseTime}ms
                      </Badge>
                      <StatusDot status={prov.status} pulse={prov.status === 'operational'} />
                    </div>
                  </div>
                </CardHeader>
              </div>
              <CardContent className="pt-3 pb-4">
                <div className="space-y-0.5">
                  {prov.services.map((svc, i) => (
                    <ServiceRow key={i} svc={svc} />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* === HISTORIQUE === */}
      {history.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Historique ({history.length} checks)
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} className="text-xs">
                {showHistory ? 'Masquer' : 'Afficher'}
              </Button>
            </div>
          </CardHeader>
          {showHistory && (
            <CardContent className="pt-0">
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {history.slice(-30).map((h, i) => (
                  <TooltipProvider key={i}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={cn(
                          'w-3 h-8 rounded-sm flex-shrink-0 transition-all cursor-pointer hover:opacity-80',
                          h.overall === 'operational' ? 'bg-[#ff4000]' :
                          h.overall === 'degraded' ? 'bg-[#ff4000]' :
                          h.overall === 'outage' ? 'bg-[#ff4000]' : 'bg-slate-400',
                          'opacity-60 hover:opacity-100'
                        )} />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        <p>{new Date(h.timestamp).toLocaleTimeString('fr-FR')}</p>
                        <p>{h.healthyChecks}/{h.totalChecks} OK — {h.uptimePercent}%</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Wifi className="h-3 w-3" /> Premier: {new Date(history[0].timestamp).toLocaleTimeString('fr-FR')}</span>
                <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Dernier: {new Date(history[history.length - 1].timestamp).toLocaleTimeString('fr-FR')}</span>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* === LÉGENDE === */}
      <div className="flex flex-wrap items-center gap-4 px-2 text-xs text-muted-foreground">
        {Object.entries(statusConfig).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 rounded-full', val.color)} />
            <span>{val.label}</span>
          </div>
        ))}
        <span className="ml-2 text-[10px]">{t('multiCloudDashboard.donneesPersisteesEnDbSupabase')}</span>
      </div>
    </div>
  );
}
