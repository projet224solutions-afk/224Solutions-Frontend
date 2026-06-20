/**
 * 🏦 WalletBar (PHASE 2) — solde wallet TEMPS RÉEL + bouton recharge.
 * Affiché sur chaque interface de service (RÈGLE N°2). Le solde se met à jour en direct
 * via `useWalletBalance` (abonnement Supabase Realtime sur la table wallets, filtré user).
 * `context` adapte le libellé au service (ex. « Commande en cours », « Course estimée »).
 */

import { useNavigate } from 'react-router-dom';
import { Wallet, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/Money';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useAuth } from '@/hooks/useAuth';

interface WalletBarProps {
  /** Libellé contextuel au service (défaut : « Solde wallet »). */
  context?: string;
  /** Montant contextuel optionnel à afficher à droite (ex. total commande en cours). */
  contextAmount?: number;
  contextAmountLabel?: string;
  rechargePath?: string;
  className?: string;
}

export function WalletBar({ context, contextAmount, contextAmountLabel, rechargePath = '/wallet', className = '' }: WalletBarProps) {
  const { user } = useAuth();
  const { balance, currency, loading } = useWalletBalance(user?.id);
  const navigate = useNavigate();

  return (
    <div className={`flex items-center gap-3 rounded-xl border bg-card px-3 py-2 ${className}`}>
      <Wallet className="h-4 w-4 flex-shrink-0 text-[#ff4000]" />
      <div className="min-w-0">
        <div className="text-[11px] leading-none text-muted-foreground">{context || 'Solde wallet'}</div>
        <div className="font-bold leading-tight">{loading ? '…' : <Money amount={balance} from={currency as any} />}</div>
      </div>
      {typeof contextAmount === 'number' && (
        <div className="ml-1 min-w-0 border-l pl-3">
          <div className="text-[11px] leading-none text-muted-foreground">{contextAmountLabel || 'En cours'}</div>
          <div className="font-semibold leading-tight text-[#ff4000]"><Money amount={contextAmount} /></div>
        </div>
      )}
      <Button size="sm" className="ml-auto flex-shrink-0" onClick={() => navigate(rechargePath)}>
        <Plus className="h-4 w-4 mr-1" />Recharger
      </Button>
    </div>
  );
}

export default WalletBar;
