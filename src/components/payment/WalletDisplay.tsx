/**
 * WALLET DISPLAY COMPONENT
 * Affichage du solde du portefeuille
 * 224SOLUTIONS
 */

import React from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useWallet } from '@/hooks/useWallet';
import {
  Wallet,
  TrendingUp,
  Clock,
  Lock,
  RefreshCw,
  Eye,
  EyeOff,
  ArrowUpRight
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface WalletDisplayProps {
  userId?: string;
  showActions?: boolean;
  onWithdraw?: () => void;
  compact?: boolean;
}

export function WalletDisplay({
  showActions = true,
  onWithdraw,
  compact = false
}: WalletDisplayProps) {
  const { t } = useTranslation();
  const {
    wallet,
    loading,
    balance,
    currency,
    isBlocked,
    refresh
  } = useWallet();

  const [showBalance, setShowBalance] = React.useState(true);

  const formatAmount = useFormatCurrency();

  const handleRefresh = async () => {
    await refresh();
  };

  if (loading && !wallet) {
    return (
      <Card className="w-full">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!wallet) {
    return (
      <Card className="w-full border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">
            Impossible de charger le portefeuille
          </p>
          <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  const walletStatus = wallet.wallet_status || 'active';
  const isActive = walletStatus === 'active' && !isBlocked;

  if (compact) {
    return (
      <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{t('walletDisplay.soldeDisponible')}</p>
            <p className="text-2xl font-bold">
              {showBalance ? formatAmount(balance, currency) : '••••••'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowBalance(!showBalance)}
        >
          {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </Button>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Wallet className="w-5 h-5" />
              <span>{t('walletDisplay.monPortefeuille')}</span>
            </CardTitle>
            <CardDescription>
              Gérez vos fonds et transactions
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={isActive ? 'default' : 'destructive'}>
              {isActive ? 'Actif' : isBlocked ? 'Bloqué' : 'Inactif'}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowBalance(!showBalance)}
            >
              {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Solde principal */}
        <div className="space-y-2">
          <div className="flex items-baseline space-x-2">
            <h3 className="text-4xl font-bold tracking-tight">
              {showBalance ? formatAmount(balance, currency) : '••••••'}
            </h3>
            <span className="text-sm text-muted-foreground">
              {currency.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{t('walletDisplay.soldeDisponible')}</p>
        </div>

        <Separator />

        {/* Détails des soldes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {/* Reçu */}
          <div className="space-y-1">
            <div className="flex items-center space-x-1 text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">{t('walletDisplay.recu')}</span>
            </div>
            <p className="text-lg font-semibold">
              {showBalance ? formatAmount((wallet as any).total_received || 0, currency) : '•••'}
            </p>
          </div>

          {/* Envoyé */}
          <div className="space-y-1">
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-xs">{t('walletDisplay.envoye')}</span>
            </div>
            <p className="text-lg font-semibold">
              {showBalance ? formatAmount((wallet as any).total_sent || 0, currency) : '•••'}
            </p>
          </div>

          {/* Solde */}
          <div className="space-y-1">
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Lock className="w-4 h-4" />
              <span className="text-xs">{t('walletDisplay.solde')}</span>
            </div>
            <p className="text-lg font-semibold">
              {showBalance ? formatAmount(balance, currency) : '•••'}
            </p>
          </div>
        </div>

        {/* Statut bloqué */}
        {isBlocked && (
          <div className="p-3 rounded-lg bg-[#ff4000]/10 border border-[#ff4000]/20">
            <p className="text-sm text-[#ff4000] dark:text-[#ff4000]">
              ⚠️ Votre portefeuille est bloqué. {wallet.blocked_reason || ''}
            </p>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex space-x-2 pt-2">
            <Button
              onClick={onWithdraw}
              disabled={balance === 0 || !isActive}
              className="flex-1"
            >
              <ArrowUpRight className="w-4 h-4 mr-2" />
              Retirer
            </Button>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        )}

        {/* Dernière mise à jour */}
        <p className="text-xs text-muted-foreground text-center">
          Dernière mise à jour : {new Date(wallet.created_at).toLocaleString('fr-FR')}
        </p>
      </CardContent>
    </Card>
  );
}
