import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, Server, HardDrive, AlertTriangle, CheckCircle, Activity, Clock, FileText, Shield } from 'lucide-react';
import { usePDGMaintenanceData } from '@/hooks/usePDGMaintenanceData';
import { IdAuditManager } from './IdAuditManager';

export default function PDGSystemMaintenance() {
  const { t } = useTranslation();
  const {
    services,
    dbStats,
    logs,
    loading,
    checkServicesStatus,
    cleanupOldData,
    optimizeDatabase,
    createBackup
  } = usePDGMaintenanceData();


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="w-5 h-5 text-[#ff4000]" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-[#ff4000]" />;
      case 'down':
        return <AlertTriangle className="w-5 h-5 text-[#ff4000]" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'operational':
        return <Badge className="bg-[#ff4000]">{t('pDGSystemMaintenance.operationnel')}</Badge>;
      case 'degraded':
        return <Badge className="bg-[#ff4000]">{t('pDGSystemMaintenance.degrade')}</Badge>;
      case 'down':
        return <Badge className="bg-[#ff4000]">Hors ligne</Badge>;
      default:
        return <Badge>Inconnu</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">{t('pDGSystemMaintenance.maintenanceSysteme')}</h2>
          <p className="text-muted-foreground mt-1">{t('pDGSystemMaintenance.surveillanceEtGestionDeL')}</p>
        </div>
        <Button onClick={checkServicesStatus} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Statistiques Base de Données */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tables</CardTitle>
            <Database className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dbStats.totalTables}</div>
            <p className="text-xs text-muted-foreground mt-1">tables principales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Enregistrements</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dbStats.totalRecords.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">enregistrements totaux</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stockage</CardTitle>
            <HardDrive className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dbStats.storageUsed}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('pDGSystemMaintenance.espaceUtilise')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Dernier Backup</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">{dbStats.lastBackup || 'Jamais'}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('pDGSystemMaintenance.sauvegardeSysteme')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Statut des services */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Statut des Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {services.map((service, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-4">
                  {getStatusIcon(service.status)}
                  <div>
                    <h3 className="font-medium">{service.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Uptime: {service.uptime} • {service.lastCheck}
                      {service.responseTime && ` • ${service.responseTime}ms`}
                    </p>
                  </div>
                </div>
                {getStatusBadge(service.status)}
              </div>
            ))}
            {services.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t('pDGSystemMaintenance.aucunServiceSurveille')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audit des IDs Système */}
      <IdAuditManager />

      {/* Actions de maintenance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Base de données
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => cleanupOldData(30)}
              disabled={loading}
            >
              Nettoyage (30j)
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={optimizeDatabase}
              disabled={loading}
            >
              Optimisation
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={createBackup}
              disabled={loading}
            >
              Sauvegarde
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              Serveurs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={checkServicesStatus}
              disabled={loading}
            >
              Vérifier Statut
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={optimizeDatabase}
              disabled={loading}
            >
              Rafraîchir Stats
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={true}
            >
              Surveiller (Pro)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Stockage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => cleanupOldData(60)}
              disabled={loading}
            >
              Nettoyer (60j)
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={optimizeDatabase}
              disabled={loading}
            >
              Analyser DB
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={true}
            >
              Compresser (Pro)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Logs de Maintenance */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Historique des Maintenances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{log.action}</p>
                      <p className="text-xs text-muted-foreground">{log.timestamp}</p>
                    </div>
                  </div>
                  <Badge className="bg-[#ff4000]">{t('pDGSystemMaintenance.succes')}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
