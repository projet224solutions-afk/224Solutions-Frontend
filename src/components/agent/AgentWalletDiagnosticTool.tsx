import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";

interface DiagnosticResult {
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

interface AgentWalletDiagnosticToolProps {
  agentId: string;
}

export default function AgentWalletDiagnosticTool({ agentId }: AgentWalletDiagnosticToolProps) {
  const { t } = useTranslation();
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    setResults([]);
    const diagnosticResults: DiagnosticResult[] = [];

    try {
      // Test 1: Vérifier la connexion Supabase
      diagnosticResults.push({
        test: 'Connexion Supabase',
        status: 'success',
        message: 'Client Supabase initialisé'
      });

      // Test 2: Vérifier que l'agentId est valide
      if (!agentId || agentId === '') {
        diagnosticResults.push({
          test: 'Agent ID',
          status: 'error',
          message: 'Agent ID manquant ou invalide',
          details: { agentId }
        });
      } else {
        diagnosticResults.push({
          test: 'Agent ID',
          status: 'success',
          message: `Agent ID valide: ${agentId.slice(0, 8)}...`
        });
      }

      // Test 3: Vérifier que l'agent existe dans agents_management
      const { data: agentData, error: agentError } = await supabase
        .from('agents_management')
        .select('id, agent_code, name, is_active')
        .eq('id', agentId)
        .single();

      if (agentError) {
        diagnosticResults.push({
          test: 'Agent dans agents_management',
          status: 'error',
          message: `Erreur: ${agentError.message}`,
          details: agentError
        });
      } else if (agentData) {
        diagnosticResults.push({
          test: 'Agent dans agents_management',
          status: 'success',
          message: `Agent trouvé: ${agentData.agent_code} - ${agentData.name}`,
          details: agentData
        });
      }

      // Test 4: Vérifier si le wallet existe
      const { data: walletData, error: walletError } = await supabase
        .from('agent_wallets')
        .select('*')
        .eq('agent_id', agentId)
        .maybeSingle();

      if (walletError) {
        diagnosticResults.push({
          test: 'Wallet existant',
          status: 'error',
          message: `Erreur lors de la recherche: ${walletError.message}`,
          details: walletError
        });
      } else if (walletData) {
        diagnosticResults.push({
          test: 'Wallet existant',
          status: 'success',
          message: `Wallet trouvé - Solde: ${walletData.balance} ${walletData.currency}`,
          details: walletData
        });
      } else {
        diagnosticResults.push({
          test: 'Wallet existant',
          status: 'warning',
          message: 'Aucun wallet trouvé - Doit être créé',
          details: null
        });

        // Test 5: Essayer de créer le wallet via RPC
        try {
          const { data: newWallet, error: createError }: any = await supabase
            .rpc('create_agent_wallet' as any, { p_agent_id: agentId });

          if (createError) {
            diagnosticResults.push({
              test: 'Création du wallet (RPC)',
              status: 'error',
              message: `Impossible de créer le wallet: ${createError.message}`,
              details: createError
            });

            // Vérifier les permissions RLS
            if (createError.code === '42501' || createError.message.includes('permission')) {
              diagnosticResults.push({
                test: 'Permissions RLS',
                status: 'error',
                message: 'Erreur de permissions - RLS bloque l\'insertion',
                details: 'Vérifiez les politiques Row Level Security sur agent_wallets'
              });
            }
          } else if (newWallet && Array.isArray(newWallet) && newWallet.length > 0) {
            diagnosticResults.push({
              test: 'Création du wallet (RPC)',
              status: 'success',
              message: `Wallet créé avec succès via RPC!`,
              details: newWallet[0]
            });
          }
        } catch (rpcError: any) {
          diagnosticResults.push({
            test: 'Création du wallet (RPC)',
            status: 'error',
            message: `Erreur lors de l'appel RPC: ${rpcError.message}`,
            details: rpcError
          });
        }
      }

      // Test 6: Vérifier les permissions de lecture
      const { count, error: countError } = await supabase
        .from('agent_wallets')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', agentId);

      if (countError) {
        diagnosticResults.push({
          test: 'Permissions de lecture',
          status: 'error',
          message: `Erreur de lecture: ${countError.message}`,
          details: countError
        });
      } else {
        diagnosticResults.push({
          test: 'Permissions de lecture',
          status: 'success',
          message: `Permissions OK - ${count} wallet(s) trouvé(s)`,
          details: { count }
        });
      }

    } catch (error: any) {
      diagnosticResults.push({
        test: 'Test général',
        status: 'error',
        message: `Erreur inattendue: ${error.message}`,
        details: error
      });
    }

    setResults(diagnosticResults);
    setLoading(false);

    // Résumé dans la console
    console.log('🔍 DIAGNOSTIC WALLET AGENT - Résultats:');
    diagnosticResults.forEach(result => {
      const icon = result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⚠️';
      console.log(`${icon} ${result.test}: ${result.message}`);
      if (result.details) {
        console.log('   Détails:', result.details);
      }
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-[#ff4000]" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-[#ff4000]" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-[#ff4000]" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-orange-100 text-[#ff4000] border-orange-300';
      case 'error':
        return 'bg-orange-100 text-[#ff4000] border-orange-300';
      case 'warning':
        return 'bg-orange-100 text-[#ff4000] border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>🔧 Diagnostic Wallet Agent</span>
          <Badge variant="outline">ID: {agentId.slice(0, 8)}...</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Button
            onClick={runDiagnostics}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Diagnostic en cours...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Lancer le diagnostic
              </>
            )}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm mb-2">{t('agentWalletDiagnosticTool.resultats')}</h3>
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${getStatusColor(result.status)}`}
              >
                <div className="flex items-start gap-2">
                  {getStatusIcon(result.status)}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{result.test}</p>
                    <p className="text-xs mt-1">{result.message}</p>
                    {result.details && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer hover:underline">
                          Voir les détails
                        </summary>
                        <pre className="text-xs mt-1 p-2 bg-black/5 rounded overflow-auto max-h-40">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted rounded">
            <p className="font-semibold mb-1">💡 Astuce:</p>
            <p>{t('agentWalletDiagnosticTool.ouvrezLaConsoleF12Pour')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
