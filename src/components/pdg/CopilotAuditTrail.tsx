import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

interface AuditLog {
  id: string;
  user_id: string;
  action_type: string;
  action_data: any;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export default function CopilotAuditTrail() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // TODO: Créer la table copilot_audit_logs dans la base de données
      console.warn('Table copilot_audit_logs not implemented yet');
      setLogs([]);
      // let query = supabase
      //   .from('copilot_audit_logs')
      //   .select('*')
      //   .eq('user_id', user.user.id)
      //   .order('created_at', { ascending: false })
      //   .limit(100);
      //
      // if (filter === 'success') {
      //   query = query.eq('success', true);
      // } else if (filter === 'error') {
      //   query = query.eq('success', false);
      // }
      //
      // const { data, error } = await query;
      //
      // if (error) throw error;
      // setLogs(data || []);
    } catch (error) {
      console.error('Erreur chargement audit logs:', error);
      toast.error(t('copilotAuditTrail.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [filter]);

  const getActionIcon = (log: AuditLog) => {
    if (log.success) {
      return <CheckCircle className="w-4 h-4 text-[#ff4000]" />;
    }
    return <XCircle className="w-4 h-4 text-[#ff4000]" />;
  };

  const getActionBadge = (actionType: string) => {
    const colors: Record<string, string> = {
      'chat_message': 'bg-blue-500',
      'business_action': 'bg-[#04439e]',
      'analyze_system': 'bg-[#ff4000]',
      'status_check': 'bg-gray-500',
      'rate_limit_exceeded': 'bg-[#ff4000]',
      'business_action_blocked': 'bg-orange-500',
      'critical_error': 'bg-[#ff4000]'
    };

    return (
      <Badge className={colors[actionType] || 'bg-gray-500'}>
        {actionType.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const filteredLogs = logs.filter(log =>
    searchTerm === '' ||
    log.action_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.error_message && log.error_message.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    total: logs.length,
    success: logs.filter(l => l.success).length,
    errors: logs.filter(l => !l.success).length,
    successRate: logs.length > 0 ? ((logs.filter(l => l.success).length / logs.length) * 100).toFixed(1) : '0'
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Succès
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-[#ff4000]">{stats.success}</span>
              <CheckCircle className="w-5 h-5 text-[#ff4000]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Erreurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-[#ff4000]">{stats.errors}</span>
              <XCircle className="w-5 h-5 text-[#ff4000]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taux de Succès
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{stats.successRate}%</span>
              <Shield className="w-5 h-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres et recherche */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Audit Trail du Copilote
              </CardTitle>
              <CardDescription>
                Historique détaillé de toutes les actions du copilote IA
              </CardDescription>
            </div>
            <Button onClick={loadAuditLogs} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder={t('copilotAuditTrail.rechercherDansLesLogs')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              size="sm"
            >
              Tous
            </Button>
            <Button
              variant={filter === 'success' ? 'default' : 'outline'}
              onClick={() => setFilter('success')}
              size="sm"
            >
              Succès
            </Button>
            <Button
              variant={filter === 'error' ? 'default' : 'outline'}
              onClick={() => setFilter('error')}
              size="sm"
            >
              Erreurs
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Statut</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>{t('copilotAuditTrail.donnees')}</TableHead>
                    <TableHead>Erreur</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Aucun log trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{getActionIcon(log)}</TableCell>
                        <TableCell>{getActionBadge(log.action_type)}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {JSON.stringify(log.action_data).substring(0, 50)}...
                          </code>
                        </TableCell>
                        <TableCell>
                          {log.error_message ? (
                            <span className="text-xs text-[#ff4000]">{log.error_message}</span>
                          ) : (
                            <span className="text-xs text-[#ff4000]">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('fr-FR')}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alertes de sécurité */}
      {stats.errors > 10 && (
        <Card className="border-orange-500 bg-orange-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <div>
                <p className="font-medium text-orange-600">
                  Nombre élevé d'erreurs détecté
                </p>
                <p className="text-sm text-muted-foreground">
                  {stats.errors} erreurs sur {stats.total} actions. Vérifiez la configuration du copilote.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
