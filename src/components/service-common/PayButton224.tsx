import { useTranslation } from "@/hooks/useTranslation";
/**
 * 💳 PayButton224 (PHASE 2) — bouton de paiement standard, sûr et atomique.
 * RÈGLE N°2/N°3 :
 *  - JAMAIS cliquable deux fois (verrou in-flight + état processing) ;
 *  - génère une CLÉ D'IDEMPOTENCE avant chaque déclenchement (transmise à `onPay`) ;
 *  - le montant est validé CÔTÉ SERVEUR (l'appel atomique réel est dans `onPay`).
 * `onPay(idempotencyKey)` doit faire l'appel backend (RPC PostgreSQL atomique) et
 * renvoyer true si le paiement a réussi.
 */

import { useRef, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/Money';
import { generateIdempotencyKey } from '@/services/backendApi';
import { toast } from 'sonner';

interface PayButton224Props {
  amount: number;
  label?: string;
  disabled?: boolean;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
  /** Effectue le paiement atomique côté serveur avec la clé d'idempotence. Renvoie true si OK. */
  onPay: (idempotencyKey: string) => Promise<boolean>;
  onSuccess?: () => void;
}

export function PayButton224({ amount, label = 'Payer', disabled, className = '', size = 'default', onPay, onSuccess }: PayButton224Props) {
  const { t } = useTranslation();
  const [processing, setProcessing] = useState(false);
  const inFlight = useRef(false);

  const handle = async () => {
    if (inFlight.current || processing) return; // anti double-clic strict
    if (!(amount > 0)) { toast.error(t('payButton224.montantInvalide')); return; }
    inFlight.current = true;
    setProcessing(true);
    try {
      const key = generateIdempotencyKey();
      const ok = await onPay(key);
      if (ok) onSuccess?.();
      else toast.error(t('payButton224.paiementNonAbouti'));
    } catch (e: any) {
      toast.error(e?.message || 'Erreur lors du paiement');
    } finally {
      setProcessing(false);
      inFlight.current = false;
    }
  };

  return (
    <Button onClick={handle} disabled={disabled || processing} size={size} className={`gap-2 ${className}`}>
      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
      {label} · <Money amount={amount} />
    </Button>
  );
}

export default PayButton224;
