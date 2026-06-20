/**
 * 🔄 COMPOSANT DE SYNCHRONISATION PDG - 224SOLUTIONS
 *
 * Affiche l'état de synchronisation des données et permet de lancer une sync manuelle
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { usePDGSyncStatus } from '@/hooks/usePDGSyncStatus';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Users,
  Wallet,
  ArrowRightLeft,
  Loader2,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

export default function PDGSyncDashboard() {
  const { t } = useTranslation();
  const {
    lastCheck,
    isHealthy,
    checks,
    recommendations,
    loading,
    syncing,
    refresh,
    runSync
  } = usePDGSyncStatus();

  const [showDetails, setShowDetails] = useState(false);

  const getStatusIcon = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok':
        return <CheckCircle2 className="w-4 h-4 text-[#ff4000]" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-[#ff4000]" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-[#ff4000]" />;
    }
  };

  const getStatusColor = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok':
        return 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20';
      case 'warning':
        return 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20';
      case 'error':
        return 'bg-[#ff4000]/10 text-[#ff4000] border-[#ff4000]/20';
    }
  };

  const getTableIcon = (table: string) => {
    if (table.includes('profiles') || table.includes('user')) return <Users className="w-4 h-4" />;
    if (table.includes('wallet') || table.includes('transactions')) return <Wallet className="w-4 h-4" />;
    if (table.includes('vendor') || table.includes('agents')) return <Database className="w-4 h-4" />;
    return <ArrowRightLeft className="w-4 h-4" />;
  };

  const healthScore = checks.length > 0
    ? Math.round((checks.filter(c => c.status === 'ok').length / checks.length) * 100)
    : 100;

  const handleSync = async () => {
    const result = await runSync();
    if (result.success) {
      toast.success(`Synchronisation terminée: ${result.totalSynced} éléments synchronisés`);
    } else if (result.totalSynced > 0) {
      toast.warning(`Synchronisation partielle: ${result.totalSynced} réussis, ${result.totalErrors} erreurs (conflits possibles)`);
    } else if (result.totalErrors > 0) {
      toast.error(`Des conflits empêchent la synchronisation. Vérifiez les recommandations.`);
    }
  };

  if (loading) {
    return (
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-muted-foreground">{t('pDGSyncDashboard.analyseDeLaCoherenceDes')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${isHealthy ? 'bg-[#ff4000]/10' : 'bg-[#ff4000]/10'}`}>
                <Database className={`w-6 h-6 ${isHealthy ? 'text-[#ff4000]' : 'text-[#ff4000]'}`} />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Synchronisation des Données
                  <Badge variant="outline" className={isHealthy ? 'border-[#ff4000]/30 bg-[#ff4000]/10 text-[#ff4000]' : 'border-[#ff4000]/30 bg-[#ff4000]/10 text-[#ff4000]'}>
                    {isHealthy ? 'Sain' : 'Attention requise'}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Dernière vérification: {lastCheck ? new Date(lastCheck).toLocaleString('fr-FR') : 'Jamais'}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Vérifier
              </Button>
              <Button
                size="sm"
                onClick={handleSync}
                disabled={syncing}
                className="gap-2"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Synchroniser
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Health Score */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">{t('pDGSyncDashboard.scoreDeSante')}</span>
              <span className={`text-lg font-bold ${
                healthScore >= 80 ? 'text-[#ff4000]' :
                healthScore >= 50 ? 'text-[#ff4000]' :
                'text-[#ff4000]'
              }`}>
                {healthScore}%
              </span>
            </div>
            <Progress
              value={healthScore}
              className="h-2"
            />
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-muted/50 text-center">
              <div className="text-2xl font-bold text-[#ff4000]">
                {checks.filter(c => c.status === 'ok').length}
              </div>
              <div className="text-xs text-muted-foreground">{t('pDGSyncDashboard.verificationsOk')}</div>
            </div>
            <div className="p-4 rounded-xl bg-muted/50 text-center">
              <div className="text-2xl font-bold text-[#ff4000]">
                {checks.filter(c => c.status === 'warning').length}
              </div>
              <div className="text-xs text-muted-foreground">Avertissements</div>
            </div>
            <div className="p-4 rounded-xl bg-muted/50 text-center">
              <div className="text-2xl font-bold text-[#ff4000]">
                {checks.filter(c => c.status === 'error').length}
              </div>
              <div className="text-xs text-muted-foreground">Erreurs</div>
            </div>
            <div className="p-4 rounded-xl bg-muted/50 text-center">
              <div className="text-2xl font-bold text-primary">
                {checks.reduce((sum, c) => sum + (c.discrepancies || 0), 0)}
              </div>
              <div className="text-xs text-muted-foreground">{t('pDGSyncDashboard.elementsASync')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Checks */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t('pDGSyncDashboard.detailsDesVerifications')}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Masquer' : 'Afficher'} détails
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {checks.map((check, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-4 rounded-xl border ${getStatusColor(check.status)}`}
              >
                <div className="flex items-center gap-3">
                  {getTableIcon(check.table)}
                  <div>
                    <div className="font-medium text-sm">{check.table}</div>
                    <div className="text-xs text-muted-foreground">{check.message}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {check.discrepancies !== undefined && check.discrepancies > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {check.discrepancies} à corriger
                    </Badge>
                  )}
                  {getStatusIcon(check.status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm border-[#ff4000]/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#ff4000]" />
              Recommandations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-[#ff4000] mt-0.5">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
