import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, AlertTriangle, Info, RefreshCw, FileJson } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AnalysisResult {
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export function PDGPermissionsAnalyzer() {
  const { t } = useTranslation();
  const [analysis, setAnalysis] = useState<Record<string, AnalysisResult[]>>({});
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    const results: Record<string, AnalysisResult[]> = {};

    try {
      // 1. Vérifier les tables principales
      results['Tables'] = await checkTables();

      // 2. Vérifier les agents
      results['Agents'] = await checkAgents();

      // 3. Vérifier les permissions
      results['Permissions'] = await checkPermissions();

      setAnalysis(results);
    } catch (error) {
      console.error('Erreur analyse:', error);
      toast.error(t('pDGPermissionsAnalyzer.erreurLorsDeLAnalyse'));
    } finally {
      setLoading(false);
    }
  };

  const checkTables = async (): Promise<AnalysisResult[]> => {
    const results: AnalysisResult[] = [];
    const tables = ['agents_management', 'agent_permissions', 'agent_wallets'];

    for (const table of tables) {
      try {
        const { error } = await supabase
          .from(table as any)
          .select('id')
          .limit(1);

        if (error?.message?.includes('does not exist')) {
          results.push({
            status: 'error',
            message: `Table '${table}' manquante`,
            severity: 'critical'
          });
        } else if (error) {
          results.push({
            status: 'warning',
            message: `Erreur accès '${table}': ${error.message}`,
            severity: 'high'
          });
        } else {
          results.push({
            status: 'ok',
            message: `Table '${table}' présente et accessible`
          });
        }
      } catch (_err) {
        results.push({
          status: 'error',
          message: `Erreur vérification table '${table}'`,
          severity: 'high'
        });
      }
    }

    return results;
  };

  const checkAgents = async (): Promise<AnalysisResult[]> => {
    const results: AnalysisResult[] = [];

    try {
      const { data, error, count } = await supabase
        .from('agents_management')
        .select('*', { count: 'exact' });

      if (error) {
        results.push({
          status: 'error',
          message: 'Erreur accès table agents',
          severity: 'high'
        });
      } else {
        results.push({
          status: 'ok',
          message: `${count || 0} agents trouvés`
        });

        // Vérifier les agents inactifs
        const inactive = data?.filter(a => !a.is_active) || [];
        if (inactive.length > 0) {
          results.push({
            status: 'warning',
            message: `${inactive.length} agents inactifs`,
            severity: 'low'
          });
        }
      }
    } catch (_err) {
      results.push({
        status: 'error',
        message: 'Erreur vérification agents',
        severity: 'high'
      });
    }

    return results;
  };

  const checkPermissions = async (): Promise<AnalysisResult[]> => {
    const results: AnalysisResult[] = [];

    try {
      const { data, error, count } = await supabase
        .from('agent_permissions')
        .select('*', { count: 'exact' });

      if (error) {
        results.push({
          status: 'error',
          message: 'Erreur accès permissions agents',
          severity: 'high'
        });
      } else {
        const activePerms = data?.filter(p => p.permission_value) || [];
        results.push({
          status: 'ok',
          message: `${activePerms.length} permissions actives (${count || 0} total)`
        });

        // Compter les permissions par type
        const byType: Record<string, number> = {};
        for (const perm of activePerms) {
          const type = perm.permission_key?.startsWith('manage_') ? 'Écriture' : 'Lecture';
          byType[type] = (byType[type] || 0) + 1;
        }

        for (const [type, count] of Object.entries(byType)) {
          results.push({
            status: 'ok',
            message: `${count} permissions de type ${type}`
          });
        }
      }
    } catch (_err) {
      results.push({
        status: 'error',
        message: 'Erreur vérification permissions',
        severity: 'high'
      });
    }

    return results;
  };

  const exportAnalysis = () => {
    const data = JSON.stringify({ analysis, timestamp: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pdg-permissions-analysis-${Date.now()}.json`;
    a.click();
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'ok': return <CheckCircle2 className="h-4 w-4 text-[#ff4000]" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-[#ff4000]" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-[#ff4000]" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch(severity) {
      case 'low': return 'bg-blue-50 text-blue-900';
      case 'medium': return 'bg-orange-50 text-[#ff4000]';
      case 'high': return 'bg-orange-50 text-orange-900';
      case 'critical': return 'bg-orange-50 text-[#ff4000]';
      default: return 'bg-gray-50 text-gray-900';
    }
  };

  useEffect(() => {
    runAnalysis();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('pDGPermissionsAnalyzer.analyseurDePermissionsPdg')}</CardTitle>
              <CardDescription>
                Vérifie l'intégrité du système de permissions agents
              </CardDescription>
            </div>
            <Button
              onClick={runAnalysis}
              disabled={loading}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Analyse...' : 'Analyser'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(analysis).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Cliquez sur "Analyser" pour démarrer
            </div>
          ) : (
            <Tabs defaultValue={Object.keys(analysis)[0]}>
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  {Object.keys(analysis).map(category => (
                    <TabsTrigger key={category} value={category}>
                      {category}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <Button variant="outline" size="sm" onClick={exportAnalysis}>
                  <FileJson className="h-4 w-4 mr-2" />
                  Exporter
                </Button>
              </div>

              {Object.entries(analysis).map(([category, results]) => (
                <TabsContent key={category} value={category} className="space-y-2">
                  <ScrollArea className="h-[400px]">
                    <div className="pr-4 space-y-2">
                      {results.map((result, idx) => (
                        <Alert key={idx} className={getSeverityColor(result.severity)}>
                          <div className="flex items-start gap-2">
                            {getStatusIcon(result.status)}
                            <div className="flex-1">
                              <AlertTitle className="text-sm">{result.message}</AlertTitle>
                              {result.details && (
                                <AlertDescription className="text-xs mt-1">
                                  {result.details}
                                </AlertDescription>
                              )}
                            </div>
                            {result.severity && (
                              <Badge variant="outline" className="text-xs">
                                {result.severity}
                              </Badge>
                            )}
                          </div>
                        </Alert>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
