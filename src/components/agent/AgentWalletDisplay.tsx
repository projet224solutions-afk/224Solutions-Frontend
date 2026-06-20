import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';

interface AgentWalletDisplayProps {
  agentId: string;
  agentCode?: string;
  className?: string;
  compact?: boolean;
}

export function AgentWalletDisplay({
  agentId,
  agentCode,
  className = '',
  compact = false
}: AgentWalletDisplayProps) {
  const { t } = useTranslation();
  const [balance, setBalance] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('GNF');
  const [loading, setLoading] = useState(true);
  const [agentUserId, setAgentUserId] = useState<string | null>(null);
  const [walletFound, setWalletFound] = useState(false);

  const loadWallet = async (userId?: string) => {
    const targetUserId = userId || agentUserId;
    if (!targetUserId) return;

    try {
      const { data: walletData, error } = await supabase
        .from('wallets')
        .select('balance, currency')
        .eq('user_id', targetUserId)
        .single();

      if (error) {
        console.error('❌ Erreur chargement wallet agent:', error);
        setWalletFound(false);
        return;
      }

      setBalance(walletData?.balance || 0);
      setCurrency(walletData?.currency || 'GNF');
      setWalletFound(true);
    } catch (error) {
      console.error('Erreur chargement wallet agent:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!agentId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      setLoading(true);

      // Résoudre le user_id depuis agents_management
      const { data: agentData, error: agentError } = await supabase
        .from('agents_management')
        .select('user_id')
        .eq('id', agentId)
        .single();

      if (agentError || !agentData?.user_id) {
        console.error('❌ Agent non trouvé:', agentError);
        setLoading(false);
        return;
      }

      const userId = agentData.user_id;
      setAgentUserId(userId);

      await loadWallet(userId);

      // Subscription sur wallets (source de vérité) par user_id
      channel = supabase
        .channel(`agent-wallet-display-${agentId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'wallets',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (payload.new && typeof (payload.new as any).balance === 'number') {
              setBalance((payload.new as any).balance);
              setCurrency((payload.new as any).currency || 'GNF');
            } else {
              loadWallet(userId);
            }
          }
        )
        .subscribe();
    };

    init();

    return () => {
      channel?.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const fc = useFormatCurrency();

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className={compact ? "py-2 px-3" : "py-3 px-4"}>
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span className="text-xs text-muted-foreground">Chargement wallet...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!walletFound) {
    return (
      <Card className={`${className} border-orange-200 bg-orange-50`}>
        <CardContent className={compact ? "py-2 px-3" : "py-3 px-4"}>
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-orange-600" />
            <span className="text-xs text-orange-600 font-medium">{t('agentWalletDisplay.walletNonCree')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className={className}>
        <CardContent className="py-2 px-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Wallet Agent {agentCode ? `(${agentCode})` : ''}</p>
                <p className="text-sm font-bold text-primary">{fc(balance, currency)}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadWallet()}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Wallet Agent {agentCode ? `(${agentCode})` : ''}
              </p>
              <p className="text-lg font-bold text-primary">{fc(balance, currency)}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadWallet()}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
