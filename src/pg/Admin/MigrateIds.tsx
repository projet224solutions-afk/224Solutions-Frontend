/**
 * 📈 PAGE: MIGRATION DES IDs VERS LE SYSTÈME STANDARDISÉ
 * Interface d'administration pour migrer les anciens IDs
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle, Database, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface MigrationResult {
  table_name: string;
  old_id: string;
  new_id: string;
  status: string;
}

export default function MigrateIds() {
  const { t } = useTranslation();
  const [migrating, setMigrating] = useState(false);
  const [results, setResults] = useState<MigrationResult[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Charge les statistiques actuelles
   */
  const loadStats = async () => {
    setLoading(true);
    try {
      const { data: counters, error } = await supabase
        .from('id_counters')
        .select('*')
        .order('prefix');

      if (error) throw error;
      setStats(counters);
    } catch (err: any) {
      toast.error('Erreur chargement stats', {
        description: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Lance la migration des IDs existants
   */
  const runMigration = async () => {
    setMigrating(true);
    setResults([]);

    try {
      toast.info('Migration en cours...', {
        description: t('migrateIds.reorganisationDesIdsVersLe')
      });

      const { data, error } = await supabase
        .rpc('migrate_existing_ids');

      if (error) throw error;

      setResults(data || []);

      toast.success(`Migration terminée!`, {
        description: `${data?.length || 0} IDs migrés avec succès`
      });

      // Recharger les stats
      await loadStats();
    } catch (err: any) {
      toast.error(t('migrateIds.echecMigration'), {
        description: err.message
      });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('migrateIds.migrationDesIds')}</h1>
          <p className="text-muted-foreground mt-2">
            Système d'identifiants standardisés 224SOLUTIONS (AAA0001)
          </p>
        </div>
        <Button onClick={loadStats} variant="outline" disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span className="ml-2">Actualiser</span>
        </Button>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Important</AlertTitle>
        <AlertDescription>
          Cette opération va réorganiser tous les IDs existants selon le nouveau format standardisé.
          Les anciens IDs seront conservés dans une table de mapping pour référence.
        </AlertDescription>
      </Alert>

      {/* Statistiques des compteurs */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Compteurs actuels
            </CardTitle>
            <CardDescription>
              État des compteurs par préfixe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {stats.map((counter: any) => (
                <Card key={counter.prefix}>
                  <CardContent className="p-4">
                    <div className="text-center">
                      <Badge className="font-mono font-bold text-lg mb-2">
                        {counter.prefix}
                      </Badge>
                      <div className="text-2xl font-bold text-primary">
                        {counter.current_value.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {counter.description}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bouton de migration */}
      <Card>
        <CardHeader>
          <CardTitle>{t('migrateIds.lancerLaMigration')}</CardTitle>
          <CardDescription>
            Réorganise tous les IDs existants vers le format standardisé AAA0001
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={runMigration}
            disabled={migrating}
            size="lg"
            className="w-full"
          >
            {migrating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Migration en cours...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Démarrer la migration
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Résultats de la migration */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#ff4000]" />
              Résultats de la migration
            </CardTitle>
            <CardDescription>
              {results.length} IDs migrés avec succès
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {results.map((result, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{result.table_name}</Badge>
                      <span className="font-mono text-sm text-muted-foreground line-through">
                        {result.old_id}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono text-sm font-semibold text-primary">
                        {result.new_id}
                      </span>
                    </div>
                    <Badge variant="default" className="bg-[#ff4000]">
                      {result.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
