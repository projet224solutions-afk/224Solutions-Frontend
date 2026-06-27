import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RefreshCw, Database, Server, HardDrive, AlertTriangle, CheckCircle, Activity, Clock, FileText, Shield } from 'lucide-react';
import { usePDGMaintenanceData } from '@/hooks/usePDGMaintenanceData';
import { useAdminMfa } from '@/hooks/useAdminMfa';
import { toast } from 'sonner';
import { IdAuditManager } from './IdAuditManager';

export default function PDGSystemMaintenance() {
  const { t } = useTranslation();
  const {
    services,
    dbStats,
    logs,
    loading,
    checkServicesStatus,
    archiveOldData,
    refreshDatabaseStats,
    createBackup
  } = usePDGMaintenanceData();
  const { stepUp } = useAdminMfa();

  // ✅ Archivage audit_logs : confirmation forte (taper ARCHIVER) + MFA step-up serveur
  const [archiveConfirm, setArchiveConfirm] = useState<{ days: number } | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  const handleArchiveRequest = (days: number) => {
    setArchiveConfirm({ days });
    setConfirmText('');
    setMfaCode('');
  };

  const confirmArchive = async () => {
    if (confirmText !== 'ARCHIVER') { toast.error('Tapez ARCHIVER pour confirmer'); return; }
    if (!mfaCode || mfaCode.length < 6) { toast.error('Code MFA requis (6 chiffres)'); return; }
    // Vérification MFA step-up côté serveur (TOTP) avant l'archivage
    const res = await stepUp(mfaCode);
    if (!res.ok) { toast.error(`MFA invalide : ${res.error || 'code refusé'}`); return; }
    await archiveOldData(archiveConfirm!.days, mfaCode);
    setArchiveConfirm(null);
  };


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
              onClick={() => handleArchiveRequest(90)}
              disabled={loading}
            >
              Archiver logs (90j+)
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={refreshDatabaseStats}
              disabled={loading}
            >
              Rafraîchir stats
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={createBackup}
              disabled={loading}
            >
              Info sauvegardes
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
              onClick={refreshDatabaseStats}
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
              onClick={() => handleArchiveRequest(90)}
              disabled={loading}
            >
              Archiver logs (90j+)
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={refreshDatabaseStats}
              disabled={loading}
            >
              Rafraîchir stats
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

      {/* ✅ Dialog confirmation forte + MFA pour l'archivage des audit_logs */}
      {archiveConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-background rounded-xl p-6 space-y-4 border">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-lg">Archiver les logs d'audit</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Les logs de plus de <strong>{archiveConfirm.days} jours</strong> seront
              DÉPLACÉS vers l'archive froide (jamais supprimés). Cette action est
              journalisée et nécessite une vérification MFA.
            </p>
            <p className="text-sm">Tapez <strong>ARCHIVER</strong> pour confirmer :</p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ARCHIVER"
            />
            <p className="text-sm">Code MFA (authentificateur) :</p>
            <Input
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="123456"
              inputMode="numeric"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setArchiveConfirm(null)}>Annuler</Button>
              <Button
                variant="destructive"
                onClick={confirmArchive}
                disabled={confirmText !== 'ARCHIVER' || mfaCode.length < 6 || loading}
              >
                Confirmer l'archivage
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
