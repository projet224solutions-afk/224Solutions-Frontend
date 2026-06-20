import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, RefreshCw, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AgentWalletDiagnosticProps {
  agentId: string;
  agentCode: string;
}

export function AgentWalletDiagnostic({ agentId, agentCode }: AgentWalletDiagnosticProps) {
  const { t } = useTranslation();
  const [diagnosticStatus, setDiagnosticStatus] = useState<{
    agentExists: boolean;
    walletExists: boolean;
    walletId: string | null;
    balance: number | null;
    checking: boolean;
  }>({
    agentExists: false,
    walletExists: false,
    walletId: null,
    balance: null,
    checking: true
  });
  const [fixing, setFixing] = useState(false);

  const runDiagnostic = async () => {
    try {
      setDiagnosticStatus(prev => ({ ...prev, checking: true }));

      // Vérifier si l'agent existe
      const { error: agentError } = await supabase
        .from('agents_management')
        .select('id, agent_code')
        .eq('id', agentId)
        .single();

      if (agentError) {
        console.error('Erreur agent:', agentError);
        setDiagnosticStatus(prev => ({
          ...prev,
          agentExists: false,
          checking: false
        }));
        return;
      }

      // Vérifier si le wallet existe
      const { data: wallet, error: walletError } = await supabase
        .from('agent_wallets')
        .select('id, balance, currency')
        .eq('agent_id', agentId)
        .single();

      if (walletError || !wallet) {
        console.error('Erreur wallet:', walletError);
        setDiagnosticStatus({
          agentExists: true,
          walletExists: false,
          walletId: null,
          balance: null,
          checking: false
        });
        return;
      }

      setDiagnosticStatus({
        agentExists: true,
        walletExists: true,
        walletId: wallet.id,
        balance: wallet.balance,
        checking: false
      });
    } catch (error) {
      console.error('Erreur diagnostic:', error);
      setDiagnosticStatus(prev => ({ ...prev, checking: false }));
    }
  };

  const fixWallet = async () => {
    try {
      setFixing(true);
      toast.info(t('agentWalletDiagnostic.tentativeDeCreationDuWallet'));

      // Créer le wallet manuellement
      const { data, error } = await supabase
        .from('agent_wallets')
        .insert({
          agent_id: agentId,
          balance: 10000,
          currency: 'GNF',
          wallet_status: 'active'
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          // Le wallet existe déjà, juste recharger
          toast.info(t('agentWalletDiagnostic.leWalletExisteDejaRechargement'));
          await runDiagnostic();
          return;
        }
        throw error;
      }

      toast.success(t('agentWalletDiagnostic.walletCreeAvecSucces'));
      await runDiagnostic();
    } catch (error: any) {
      console.error('Erreur création wallet:', error);
      toast.error(`Erreur: ${error.message}`);
    } finally {
      setFixing(false);
    }
  };

  useEffect(() => {
    if (agentId) {
      runDiagnostic();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wrench className="w-4 h-4" />
          Diagnostic Wallet Agent {agentCode}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {diagnosticStatus.checking ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Vérification en cours...
          </div>
        ) : (
          <>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {diagnosticStatus.agentExists ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-[#ff4000]" />
                    <span>{t('agentWalletDiagnostic.agentTrouve')}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-[#ff4000]" />
                    <span>Agent introuvable ✗</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {diagnosticStatus.walletExists ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-[#ff4000]" />
                    <span>Wallet trouvé ✓ (Balance: {diagnosticStatus.balance} GNF)</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-[#ff4000]" />
                    <span className="font-medium">Wallet manquant ✗</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={runDiagnostic}
                disabled={diagnosticStatus.checking}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Revérifier
              </Button>

              {!diagnosticStatus.walletExists && diagnosticStatus.agentExists && (
                <Button
                  size="sm"
                  onClick={fixWallet}
                  disabled={fixing}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {fixing ? 'Création...' : 'Créer le Wallet'}
                </Button>
              )}
            </div>

            {!diagnosticStatus.walletExists && (
              <p className="text-xs text-[#ff4000] mt-2">
                ⚠️ Le wallet n'existe pas. Cliquez sur "Créer le Wallet" pour le créer avec un solde initial de 10,000 GNF.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
