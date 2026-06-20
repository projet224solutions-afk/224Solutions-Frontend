import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, RefreshCw, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { QuickTransferButton } from "./QuickTransferButton";
import { usePriceConverter } from '@/hooks/usePriceConverter';
import { useTranslation } from '@/hooks/useTranslation';

interface WalletBalanceWidgetProps {
  className?: string;
  showTransferButton?: boolean;
  variant?: 'default' | 'surface';
}

export function WalletBalanceWidget({
  className = "",
  showTransferButton = true,
  variant = 'default',
}: WalletBalanceWidgetProps) {
  const { user } = useAuth();
  const { convert } = usePriceConverter();
  const { t } = useTranslation();
  const [balance, setBalance] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('GNF');
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  const loadBalance = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance, currency')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      if (data) { setBalance(data.balance || 0); setCurrency(data.currency || 'GNF'); }
    } catch (error) {
      console.error('Wallet load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBalance();
    const handleWalletUpdate = () => loadBalance();
    window.addEventListener('wallet-updated', handleWalletUpdate);
    return () => window.removeEventListener('wallet-updated', handleWalletUpdate);
  }, [user?.id]);

  const formatBalance = () => {
    if (hidden) return '••••••';
    return convert(balance, currency).formatted;
  };

  const isSurfaceVariant = variant === 'surface';

  return (
    <Card
      className={[
        isSurfaceVariant
          ? 'border border-slate-200 bg-white text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.06)]'
          : 'border-0 bg-[hsl(220,96%,32%)] text-white',
        className,
      ].join(' ')}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <div
              className={[
                'flex h-10 w-10 items-center justify-center rounded-full',
                isSurfaceVariant ? 'bg-slate-100 text-[#04439e]' : 'bg-white/20',
              ].join(' ')}
            >
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className={[
                'text-xs font-medium',
                isSurfaceVariant ? 'text-slate-500' : 'opacity-90',
              ].join(' ')}>{t('wallet.currentBalance')}</p>
              <p className="text-xl font-bold">
                {loading ? t('wallet.loading') : formatBalance()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className={isSurfaceVariant ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'text-white hover:bg-white/20'}
              onClick={() => setHidden(!hidden)}
            >
              {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={isSurfaceVariant ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'text-white hover:bg-white/20'}
              onClick={loadBalance}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {showTransferButton && (
              <QuickTransferButton
                variant="ghost"
                size="icon"
                className={isSurfaceVariant ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'text-white hover:bg-white/20'}
                showText={false}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}