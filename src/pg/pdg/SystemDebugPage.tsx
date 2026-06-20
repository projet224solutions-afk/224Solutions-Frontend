import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Database,
  Server,
  Activity,
  Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TableCheck {
  name: string;
  exists: boolean;
  rowCount?: number;
  error?: string;
}

interface SystemStatus {
  overall: 'healthy' | 'degraded' | 'critical' | 'unknown';
  database: 'healthy' | 'degraded' | 'critical';
  auth: 'healthy' | 'degraded' | 'critical';
  storage: 'healthy' | 'degraded' | 'critical';
  tables: TableCheck[];
  timestamp: string;
}

export default function SystemDebugPage() {
  const { t } = useTranslation();
  const [status, setStatus] = React.useState<SystemStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [_applying, setApplying] = React.useState(false);

  const checkTables = async (): Promise<TableCheck[]> => {
    const requiredTables = [
      'secure_logs',
      'error_logs',
      'system_health_logs',
      'performance_metrics',
      'alerts',
      'health_check_reports',
      'csp_violations'
    ];

    const results: TableCheck[] = [];

    for (const tableName of requiredTables) {
      try {
        const { count, error } = await supabase
          .from(tableName as any)
          .select('*', { count: 'exact', head: true });

        if (error) {
          results.push({
            name: tableName,
            exists: false,
            error: error.message
          });
        } else {
          results.push({
            name: tableName,
            exists: true,
            rowCount: count || 0
          });
        }
      } catch (err) {
        results.push({
          name: tableName,
          exists: false,
          error: String(err)
        });
      }
    }

    return results;
  };

  const checkSystemStatus = async () => {
    setLoading(true);
    try {
      // Check database
      const dbStart = Date.now();
      const { error: dbError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .single();
      const dbTime = Date.now() - dbStart;

      // Check auth
      const { data: { session }, error: authError } = await supabase.auth.getSession();

      // Check storage
      const { data: _buckets, error: storageError } = await supabase.storage.listBuckets();

      // Check tables
      const tables = await checkTables();

      const databaseStatus = dbError ? 'critical' : dbTime > 1000 ? 'degraded' : 'healthy';
      const authStatus = authError ? 'degraded' : 'healthy';
      const storageStatus = storageError ? 'degraded' : 'healthy';

      const missingTables = tables.filter(t => !t.exists).length;
      const overall = missingTables > 0 ? 'degraded'
                    : databaseStatus === 'critical' ? 'critical'
                    : databaseStatus === 'degraded' || authStatus === 'degraded' ? 'degraded'
                    : 'healthy';

      setStatus({
        overall,
        database: databaseStatus,
        auth: authStatus,
        storage: storageStatus,
        tables,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error checking system status:', error);
      setStatus({
        overall: 'critical',
        database: 'critical',
        auth: 'critical',
        storage: 'critical',
        tables: [],
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const _applyMigration = async () => {
    setApplying(true);
    try {
      // Lire le contenu de la migration
      const migrationUrl = '/supabase/migrations/20240130_security_services_infrastructure.sql';

      console.log('Migration à appliquer :', migrationUrl);
      alert(t('systemDebugPage.migrationAAppliquerManuellementVia'));

    } catch (error) {
      console.error('Error applying migration:', error);
    } finally {
      setApplying(false);
    }
  };

  React.useEffect(() => {
    checkSystemStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-[#ff4000]" />;
      case 'degraded':
        return <AlertCircle className="h-5 w-5 text-[#ff4000]" />;
      case 'critical':
        return <XCircle className="h-5 w-5 text-[#ff4000]" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-orange-100 text-[#ff4000] border-orange-200';
      case 'degraded':
        return 'bg-orange-100 text-[#ff4000] border-orange-200';
      case 'critical':
        return 'bg-orange-100 text-[#ff4000] border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>{t('systemDebugPage.verificationDuSysteme')}</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>
            Impossible de vérifier l'état du système
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const missingTables = status.tables.filter(t => !t.exists);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('systemDebugPage.diagnosticSysteme')}</h1>
          <p className="text-gray-600 mt-1">
            Vérification de l'état du système de monitoring et des services de sécurité
          </p>
        </div>
        <Button onClick={checkSystemStatus} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Rafraîchir
        </Button>
      </div>

      {/* Statut Global */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Statut global du système
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {getStatusIcon(status.overall)}
            <div>
              <div className="text-2xl font-bold capitalize">{status.overall}</div>
              <div className="text-sm text-gray-600">
                Dernière vérification : {new Date(status.timestamp).toLocaleString('fr-FR')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerte si tables manquantes */}
      {missingTables.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Migration requise</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-3">
              {missingTables.length} table(s) manquante(s) pour les services de sécurité.
              Le système de monitoring est dégradé car ces tables sont nécessaires.
            </p>
            <div className="space-y-2">
              <p className="font-semibold">{t('systemDebugPage.pourCorriger')}</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>{t('systemDebugPage.ouvrirUnTerminalDansLe')}</li>
                <li>{t('systemDebugPage.executer')} <code className="bg-orange-200 px-2 py-1 rounded">supabase db push</code></li>
                <li>{t('systemDebugPage.ouAppliquerManuellementLaMigration')}</li>
              </ol>
              <p className="text-sm mt-3">
                Fichier : <code className="bg-orange-200 px-2 py-1 rounded">
                  supabase/migrations/20240130_security_services_infrastructure.sql
                </code>
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Composants système */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" />
              Base de données
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getStatusIcon(status.database)}
              <Badge className={getStatusColor(status.database)}>
                {status.database}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Authentification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getStatusIcon(status.auth)}
              <Badge className={getStatusColor(status.auth)}>
                {status.auth}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4" />
              Storage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getStatusIcon(status.storage)}
              <Badge className={getStatusColor(status.storage)}>
                {status.storage}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables de sécurité */}
      <Card>
        <CardHeader>
          <CardTitle>{t('systemDebugPage.tablesDesServicesDeSecurite')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {status.tables.map((table) => (
              <div
                key={table.name}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {table.exists ? (
                    <CheckCircle className="h-5 w-5 text-[#ff4000]" />
                  ) : (
                    <XCircle className="h-5 w-5 text-[#ff4000]" />
                  )}
                  <div>
                    <div className="font-medium">{table.name}</div>
                    {table.exists ? (
                      <div className="text-sm text-gray-600">
                        {table.rowCount} ligne(s)
                      </div>
                    ) : (
                      <div className="text-sm text-[#ff4000]">
                        {table.error || 'Table manquante'}
                      </div>
                    )}
                  </div>
                </div>
                <Badge variant={table.exists ? 'default' : 'destructive'}>
                  {table.exists ? 'OK' : 'MANQUANTE'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Instructions de Correction */}
      <Card>
        <CardHeader>
          <CardTitle>{t('systemDebugPage.instructionsDeCorrection')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">{t('systemDebugPage.etape1VerifierSupabaseCli')}</h3>
            <code className="block bg-gray-100 p-3 rounded text-sm">
              supabase --version
            </code>
          </div>

          <div>
            <h3 className="font-semibold mb-2">{t('systemDebugPage.etape2AppliquerLaMigration')}</h3>
            <code className="block bg-gray-100 p-3 rounded text-sm">
              supabase db push
            </code>
          </div>

          <div>
            <h3 className="font-semibold mb-2">{t('systemDebugPage.etape3VerifierLeResultat')}</h3>
            <p className="text-sm text-gray-600">
              Rafraîchir cette page après l'application de la migration.
              Toutes les tables doivent être marquées comme "OK" en vert.
            </p>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Alternative: Application manuelle</AlertTitle>
            <AlertDescription>
              Si vous n'avez pas Supabase CLI, vous pouvez:
              <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                <li>Ouvrir Supabase Dashboard</li>
                <li>{t('systemDebugPage.allerDansSqlEditor')}</li>
                <li>{t('systemDebugPage.copierLeContenuDe')} <code>supabase/migrations/20240130_security_services_infrastructure.sql</code></li>
                <li>{t('systemDebugPage.collerEtExecuterLeSql')}</li>
              </ol>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Guides Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Documentation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm">
            <p className="font-semibold mb-2">Guides disponibles:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li><code>QUICK_START_SECURITY.md</code> - Installation rapide (30 min)</li>
              <li><code>SECURITY_SERVICES_GUIDE.md</code> - Guide complet utilisation</li>
              <li><code>SECURITY_IMPLEMENTATION_REPORT.md</code> {t('systemDebugPage.rapportDImplementation')}</li>
              <li><code>SECURITY_AUDIT_REPORT.md</code> - Rapport audit initial</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
