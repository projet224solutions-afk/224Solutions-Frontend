import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVendorCurrency } from '@/hooks/useVendorCurrency';
import { useTranslation } from '@/hooks/useTranslation';

interface WalletBalanceDisplayProps {
  userId?: string;
  className?: string;
  compact?: boolean;
}

export function WalletBalanceDisplay({ userId, className = '', compact = false }: WalletBalanceDisplayProps) {
  const { t } = useTranslation();
  const { currency: vendorCurrency, convert: convertVendor, isReady: currencyReady } = useVendorCurrency();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [walletId, setWalletId] = useState<string | null>(null);

  const loadWallet = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('wallets')
        .select('id, balance, currency, wallet_status')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        setLoading(false);
        toast.error(t('wallet.depositError'));
        return;
      }

      if (!data) {
        try {
          const { data: _initResult, error: rpcError } = await supabase
            .rpc('initialize_user_wallet', { p_user_id: userId });

          if (rpcError) {
            setLoading(false);
            return;
          }

          const { data: reloadedWallet, error: reloadError } = await supabase
            .from('wallets')
            .select('id, balance, currency, wallet_status')
            .eq('user_id', userId)
            .maybeSingle();

          if (reloadError || !reloadedWallet) {
            setLoading(false);
            return;
          }

          setWalletId(String(reloadedWallet.id));
          setBalance(reloadedWallet.balance || 0);
        } catch (initError) {
          console.error('Wallet init failed:', initError);
        }
        setLoading(false);
        return;
      }

      setWalletId(String(data.id));
      setBalance(data.balance || 0);
      setLoading(false);
    } catch (error: any) {
      console.error('Wallet load error:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
    if (userId) {
      const channel = supabase
        .channel(`wallet-${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` }, () => loadWallet())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const formatAmount = (amount: number) => {
    if (!currencyReady) return '—';
    return `${Math.round(convertVendor(amount)).toLocaleString('fr-FR')} ${vendorCurrency}`;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className={compact ? "py-2 px-3" : "py-3 px-4"}>
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <span className="text-xs text-muted-foreground">{t('wallet.loading')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!walletId) return null;

  if (compact) {
    return (
      <Card className={className}>
        <CardContent className="py-2 px-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">{t('wallet.availableBalance')}</p>
                <p className="text-sm font-bold text-primary">{formatAmount(balance)}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={loadWallet} className="h-7 w-7 p-0">
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
              <p className="text-xs text-muted-foreground">{t('wallet.currentBalance')}</p>
              <p className="text-lg font-bold text-primary">{formatAmount(balance)}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadWallet}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}