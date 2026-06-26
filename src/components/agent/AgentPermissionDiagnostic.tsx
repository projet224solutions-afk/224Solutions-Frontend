/**
 * Composant de Diagnostic des Permissions Agent
 * Affiche les permissions actuelles et aide au debug
 */

import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PermissionDiagnosticProps {
  agentId?: string;
}

export function AgentPermissionDiagnostic({ agentId }: PermissionDiagnosticProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);

  const runDiagnostic = async () => {
    setLoading(true);
    const result: any = {
      timestamp: new Date().toISOString(),
      checks: [],
      agent: null,
      user: null,
      canCreateUsers: false,
      canCreateAgents: false,
    };

    try {
      // 1. Vérifier session utilisateur
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      result.checks.push({
        name: 'Session Utilisateur',
        status: !userError && user ? 'success' : 'error',
        message: user ? `Connecté: ${user.email}` : 'Non connecté',
        details: userError ? userError.message : null
      });

      result.user = user;

      if (!user) {
        setDiagnosticResult(result);
        setLoading(false);
        return;
      }

      // 2. Vérifier profil agent
      const { data: agentData, error: agentError } = await supabase
        .from('agents_management')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      result.checks.push({
        name: 'Profil Agent',
        status: !agentError && agentData ? 'success' : 'error',
        message: agentData ? `Agent trouvé: ${agentData.name}` : 'Agent non trouvé',
        details: agentError ? agentError.message : null
      });

      result.agent = agentData;

      if (!agentData) {
        // Vérifier si c'est un PDG
        const { data: pdgData, error: pdgError } = await supabase
          .from('pdg_management')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        result.checks.push({
          name: 'Profil PDG',
          status: !pdgError && pdgData ? 'success' : 'warning',
          message: pdgData ? `PDG trouvé: ${pdgData.name}` : 'PDG non trouvé',
          details: pdgError ? pdgError.message : null
        });

        if (pdgData) {
          result.agent = {
            ...pdgData,
            isPdg: true,
            permissions: pdgData.permissions || ['all_modules', 'create_users', 'manage_users']
          };
        }
      }

      // 3. Vérifier permissions
      const permissions = result.agent?.permissions || [];
      const hasCreateUsers = permissions.includes('create_users') ||
                            permissions.includes('all') ||
                            permissions.includes('all_modules');

      result.canCreateUsers = hasCreateUsers;

      result.checks.push({
        name: 'Permission create_users',
        status: hasCreateUsers ? 'success' : 'error',
        message: hasCreateUsers ? 'Permission accordée' : 'Permission manquante',
        details: `Permissions actuelles: ${permissions.join(', ') || 'Aucune'}`
      });

      // 4. Vérifier can_create_sub_agent
      const canCreateSubAgent = result.agent?.can_create_sub_agent || result.agent?.isPdg;
      result.canCreateAgents = canCreateSubAgent;

      result.checks.push({
        name: 'Créer des agents',
        status: canCreateSubAgent ? 'success' : 'warning',
        message: canCreateSubAgent ? 'Peut créer des sous-agents' : 'Ne peut pas créer de sous-agents',
        details: result.agent?.isPdg ? 'PDG - toujours autorisé' : null
      });

      // 5. Vérifier agent actif
      const isActive = result.agent?.is_active !== false;
      result.checks.push({
        name: 'Statut Agent',
        status: isActive ? 'success' : 'error',
        message: isActive ? 'Agent actif' : 'Agent désactivé',
        details: null
      });

      // 6. Test appel Edge Function
      result.checks.push({
        name: 'Test Edge Function',
        status: 'success',
        message: t('agentPermissionDiagnostic.testAEffectuerManuellement'),
        details: 'Essayez de créer un utilisateur pour tester'
      });

    } catch (error: any) {
      result.checks.push({
        name: 'Erreur Diagnostic',
        status: 'error',
        message: error.message,
        details: JSON.stringify(error)
      });
    }

    setDiagnosticResult(result);
    setLoading(false);
  };

  useEffect(() => {
    if (agentId) {
      runDiagnostic();
    }
  }, [agentId]);

  if (!diagnosticResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('agentPermissionDiagnostic.diagnosticDesPermissions')}</CardTitle>
          <CardDescription>{t('agentPermissionDiagnostic.verifiezVosPermissionsAgent')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={runDiagnostic} disabled={loading}>
            {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            Lancer le diagnostic
          </Button>
        </CardContent>
      </Card>
    );
  }

  const allSuccess = diagnosticResult.checks.every((c: any) => c.status === 'success');
  const hasErrors = diagnosticResult.checks.some((c: any) => c.status === 'error');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t('agentPermissionDiagnostic.diagnosticDesPermissions')}</CardTitle>
            <CardDescription>
              Dernière vérification: {new Date(diagnosticResult.timestamp).toLocaleTimeString()}
            </CardDescription>
          </div>
          <Button onClick={runDiagnostic} disabled={loading} size="sm">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Résumé */}
        <Alert variant={hasErrors ? 'destructive' : allSuccess ? 'default' : 'default'}>
          <AlertDescription>
            {allSuccess && '✅ Toutes les vérifications ont réussi'}
            {hasErrors && '❌ Des erreurs ont été détectées'}
            {!allSuccess && !hasErrors && '⚠️ Certaines permissions sont manquantes'}
          </AlertDescription>
        </Alert>

        {/* Permissions principales */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              {diagnosticResult.canCreateUsers ? (
                <CheckCircle2 className="h-5 w-5 text-[#ff4000]" />
              ) : (
                <XCircle className="h-5 w-5 text-[#ff4000]" />
              )}
              <span className="font-medium">{t('agentPermissionDiagnostic.creerUtilisateurs')}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {diagnosticResult.canCreateUsers ? 'Autorisé' : 'Non autorisé'}
            </p>
          </div>
          <div className="p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              {diagnosticResult.canCreateAgents ? (
                <CheckCircle2 className="h-5 w-5 text-[#ff4000]" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-[#ff4000]" />
              )}
              <span className="font-medium">{t('agentPermissionDiagnostic.creerAgents')}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {diagnosticResult.canCreateAgents ? 'Autorisé' : 'Non autorisé'}
            </p>
          </div>
        </div>

        {/* Détails des vérifications */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">{t('agentPermissionDiagnostic.verificationsDetaillees')}</h4>
          {diagnosticResult.checks.map((check: any, index: number) => (
            <div key={index} className="flex items-start gap-3 p-2 bg-muted/30 rounded">
              {check.status === 'success' && <CheckCircle2 className="h-4 w-4 text-[#ff4000] mt-0.5" />}
              {check.status === 'error' && <XCircle className="h-4 w-4 text-[#ff4000] mt-0.5" />}
              {check.status === 'warning' && <AlertTriangle className="h-4 w-4 text-[#ff4000] mt-0.5" />}
              <div className="flex-1">
                <p className="text-sm font-medium">{check.name}</p>
                <p className="text-xs text-muted-foreground">{check.message}</p>
                {check.details && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{check.details}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Informations agent */}
        {diagnosticResult.agent && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-sm mb-2">Informations Agent</h4>
            <div className="space-y-1 text-xs">
              <p><strong>ID:</strong> {diagnosticResult.agent.id}</p>
              <p><strong>Email:</strong> {diagnosticResult.agent.email}</p>
              <p><strong>Type:</strong> {diagnosticResult.agent.isPdg ? 'PDG' : 'Agent'}</p>
              <p><strong>Permissions:</strong></p>
              <div className="flex flex-wrap gap-1 mt-1">
                {(diagnosticResult.agent.permissions || []).map((perm: string) => (
                  <Badge key={perm} variant="secondary" className="text-xs">
                    {perm}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Aide au debug */}
        {hasErrors && (
          <Alert>
            <AlertDescription>
              <strong>Solutions possibles:</strong>
              <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                <li>{t('agentPermissionDiagnostic.verifiezQueVotreCompteAgent')}</li>
                <li>{t('agentPermissionDiagnostic.contactezLePdgPourObtenir')}</li>
                <li>{t('agentPermissionDiagnostic.assurezVousDEtreConnecte')}</li>
                <li>{t('agentPermissionDiagnostic.essayezDeVousDeconnecterPuis')}</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
