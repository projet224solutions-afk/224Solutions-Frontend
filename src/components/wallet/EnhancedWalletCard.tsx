/**
 * 💳 CARTE WALLET AMÉLIORÉE
 * Affiche le wallet avec public_id, solde, et actions rapides
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PublicIdBadge } from '@/components/PublicIdBadge';
import { useWallet } from '@/hooks/useWallet';
import { usePriceConverter } from '@/hooks/usePriceConverter';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Send,
  RefreshCw,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useState } from 'react';

interface EnhancedWalletCardProps {
  className?: string;
  showActions?: boolean;
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onTransfer?: () => void;
}

export function EnhancedWalletCard({
  className = '',
  showActions = true,
  onDeposit,
  onWithdraw,
  onTransfer
}: EnhancedWalletCardProps) {
  const { wallet, stats, loading, processing, refresh } = useWallet();
  const { convert } = usePriceConverter();
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(false);

  const formatBalance = () => {
    if (!wallet) return '0';
    if (hidden) return '••••••';
    return convert(wallet.balance, wallet.currency).formatted;
  };

  const getStatusBadge = () => {
    if (!wallet) return null;
    if (wallet.is_blocked) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="w-3 h-3" />
          {t('wallet.blocked')}
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="gap-1 bg-[#ff4000]">
        <CheckCircle className="w-3 h-3" />
        {t('wallet.active')}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!wallet) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t('wallet.unavailable')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-primary-blue-600 text-white border-0 shadow-xl ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-white text-lg">{t('wallet.myWallet')}</CardTitle>
              {wallet.id && (
                <PublicIdBadge
                  publicId={String(wallet.id).slice(0, 8).toUpperCase()}
                  variant="outline"
                  size="sm"
                  className="mt-1 bg-white/10 border-white/30 text-white"
                />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setHidden(!hidden)}>
              {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={refresh} disabled={processing}>
              <RefreshCw className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Solde principal */}
        <div className="bg-white/10 backdrop-blur rounded-lg p-3 sm:p-4">
          <p className="text-sm opacity-90 mb-1">{t('wallet.availableBalance')}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl sm:text-4xl font-bold">{formatBalance()}</p>
          </div>
        </div>

        {/* Statistiques rapides */}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 backdrop-blur rounded-lg p-3">
              <p className="text-xs opacity-75 mb-1">{t('wallet.totalReceived')}</p>
              <p className="text-lg font-semibold">{convert(stats.total_received, 'GNF').formatted}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-3">
              <p className="text-xs opacity-75 mb-1">{t('wallet.totalSent')}</p>
              <p className="text-lg font-semibold">{convert(stats.total_sent, 'GNF').formatted}</p>
            </div>
          </div>
        )}

        {/* Actions rapides */}
        {showActions && !wallet.is_blocked && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
            <Button variant="secondary" size="sm" className="flex flex-col h-16 gap-1 bg-white/20 hover:bg-white/30 text-white border-0" onClick={onDeposit} disabled={processing}>
              <ArrowDownToLine className="w-5 h-5" />
              <span className="text-xs">{t('wallet.depositBtn')}</span>
            </Button>
            <Button variant="secondary" size="sm" className="flex flex-col h-16 gap-1 bg-white/20 hover:bg-white/30 text-white border-0" onClick={onWithdraw} disabled={processing}>
              <ArrowUpFromLine className="w-5 h-5" />
              <span className="text-xs">{t('wallet.withdrawBtn2')}</span>
            </Button>
            <Button variant="secondary" size="sm" className="flex flex-col h-16 gap-1 bg-white/20 hover:bg-white/30 text-white border-0" onClick={onTransfer} disabled={processing}>
              <Send className="w-5 h-5" />
              <span className="text-xs">{t('wallet.sendBtn')}</span>
            </Button>
          </div>
        )}

        {/* Message si bloqué */}
        {wallet.is_blocked && (
          <div className="bg-[#ff4000]/20 border border-orange-300/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">{t('wallet.walletBlocked')}</p>
                <p className="text-xs opacity-90 mt-1">
                  {wallet.blocked_reason || t('wallet.contactSupport')}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default EnhancedWalletCard;