import { useCallback, useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertCircle, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AgentWalletDiagnosticTool from "./AgentWalletDiagnosticTool";
import UniversalWalletDashboard from "@/components/wallet/UniversalWalletDashboard";

interface AgentWalletManagementProps {
  agentId: string;
  agentCode?: string;
  showTransactions?: boolean;
}

/**
 * Composant de gestion du wallet agent
 * Réutilise UniversalWalletDashboard pour éviter la duplication de code
 * Le système de dépôt/retrait est identique à celui des vendeurs/clients
 */
export default function AgentWalletManagement({
  agentId,
  agentCode,
  showTransactions = true
}: AgentWalletManagementProps) {
  const { t } = useTranslation();
  const [agentUserId, setAgentUserId] = useState<string | null>(null);
  const [agentUserCode, setAgentUserCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Récupérer le user_id de l'agent depuis agents_management
  const loadAgentData = useCallback(async () => {
    if (!agentId) {
      setError('ID agent manquant');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Chargement données agent:', agentId);

      // Récupérer le user_id de l'agent
      const { data: agentData, error: agentError } = await supabase
        .from('agents_management')
        .select('user_id, name, agent_code')
        .eq('id', agentId)
        .single();

      if (agentError || !agentData?.user_id) {
        console.error('❌ Agent non trouvé ou sans user_id:', agentError);
        setError('Agent non trouvé ou non lié à un compte utilisateur');
        setLoading(false);
        return;
      }

      const userId = agentData.user_id;
      console.log('✅ Agent trouvé:', agentData.name, '| user_id:', userId);

      setAgentUserId(userId);
      setAgentUserCode(agentData.agent_code || agentCode || null);

      // Vérifier/créer le wallet si nécessaire
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!walletData && !walletError) {
        // Créer le wallet automatiquement via RPC
        console.log('💡 Initialisation du wallet pour agent userId:', userId);
        const { error: initError } = await supabase
          .rpc('initialize_user_wallet', { p_user_id: userId });

        if (initError) {
          console.warn('⚠️ Initialisation wallet échouée:', initError);
        }
      }

      setLoading(false);
    } catch (err: any) {
      console.error('❌ Erreur chargement agent:', err);
      setError(err?.message || 'Erreur inconnue');
      setLoading(false);
    }
  }, [agentId, agentCode]);

  useEffect(() => {
    loadAgentData();
  }, [loadAgentData]);


  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">{t('agentWalletManagement.chargementDuWalletAgent')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !agentUserId) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 space-y-4">
              <AlertCircle className="w-16 h-16 mx-auto text-[#ff4000] mb-4" />
              <div>
                <p className="text-lg font-semibold mb-2">
                  {error || 'Impossible de charger le wallet agent'}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Agent ID: <code className="bg-muted px-2 py-1 rounded">{agentId}</code>
                </p>
              </div>
              <Button onClick={loadAgentData} variant="default">
                <RefreshCw className="w-4 h-4 mr-2" />
                Réessayer
              </Button>
            </div>
          </CardContent>
        </Card>

        <AgentWalletDiagnosticTool agentId={agentId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête Agent */}
      <Card className="bg-gradient-to-r from-[#ff4000]/10 to-[#ff4000]/10 border-orange-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="w-5 h-5 text-[#ff4000]" />
            <span>{t('agentWalletManagement.portefeuilleAgent')}</span>
            {agentUserCode && (
              <Badge variant="outline" className="ml-auto bg-orange-50 text-[#ff4000] border-orange-300">
                {agentUserCode}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            Gérez vos fonds avec les mêmes outils que les vendeurs et clients.
          </p>
        </CardContent>
      </Card>

      {/* Utilisation du dashboard wallet universel - même système que vendeur/client */}
      <UniversalWalletDashboard
        userId={agentUserId}
        userCode={agentUserCode || agentCode}
        showTransactions={showTransactions}
      />
    </div>
  );
}
