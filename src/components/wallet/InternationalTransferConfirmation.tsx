/**
 * 🌍 Écran de confirmation de transfert international
 * Affiche la décomposition des frais, le taux de change et un timer de verrouillage
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Globe, Clock, ArrowRight, AlertTriangle, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useTranslation } from "@/hooks/useTranslation";

export interface InternationalPreviewData {
  success: boolean;
  amount_sent: number;
  currency_sent: string;
  fee_percentage: number;
  fee_amount: number;
  amount_after_fee: number;
  rate_displayed: number;
  amount_received: number;
  currency_received: string;
  is_international: boolean;
  official_rate?: number;
  fx_margin?: number;
  rate_source?: string | null;
  rate_fetched_at?: string | null;
  rate_source_type?: string | null;
  rate_source_url?: string | null;
  rate_is_official?: boolean;
  rate_is_stale?: boolean;
  sender_country: string;
  receiver_country: string;
  commission_conversion: number;
  frais_international: number;
  total_debit?: number;
  rate_lock_seconds?: number;
  current_balance?: number;
  balance_after?: number;
  // For RPC-based flows
  receiver_name?: string;
  receiver_code?: string;
}

interface InternationalTransferConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: InternationalPreviewData | null;
  onConfirm: () => Promise<void>;
  loading?: boolean;
}

export function InternationalTransferConfirmation({
  open,
  onOpenChange,
  preview,
  onConfirm,
  loading = false,
}: InternationalTransferConfirmationProps) {
  const { t } = useTranslation();
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [expired, setExpired] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);

  const lockDuration = preview?.rate_lock_seconds || 60;

  // Start countdown when dialog opens
  useEffect(() => {
    if (open && preview?.is_international) {
      setSecondsLeft(lockDuration);
      setExpired(false);
      setTimerStarted(true);
    } else {
      setTimerStarted(false);
    }
  }, [open, preview?.is_international, lockDuration]);

  useEffect(() => {
    if (!open || !timerStarted || !preview?.is_international || secondsLeft <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open, timerStarted, preview?.is_international, secondsLeft]);

  const handleConfirm = useCallback(async () => {
    if (expired) return;
    await onConfirm();
  }, [expired, onConfirm]);

  if (!preview) return null;

  const progressPercent = (secondsLeft / lockDuration) * 100;

  const countryFlag = (code: string) => {
    const flags: Record<string, string> = {
      GN: '🇬🇳', SN: '🇸🇳', CI: '🇨🇮', ML: '🇲🇱', BF: '🇧🇫',
      NE: '🇳🇪', TG: '🇹🇬', BJ: '🇧🇯', GH: '🇬🇭', NG: '🇳🇬',
      CM: '🇨🇲', GA: '🇬🇦', FR: '🇫🇷', US: '🇺🇸', GB: '🇬🇧',
      MA: '🇲🇦', DZ: '🇩🇿', TN: '🇹🇳', CD: '🇨🇩', CG: '🇨🇬',
    };
    return flags[code?.toUpperCase()] || '🏳️';
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-lg">
            <Globe className="w-5 h-5 text-blue-500" />
            🌍 Transfert International
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 mt-3">
              {/* Route */}
              <div className="flex items-center justify-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <div className="text-center">
                  <span className="text-2xl">{countryFlag(preview.sender_country)}</span>
                  <p className="text-xs font-medium mt-1">{preview.sender_country}</p>
                  <Badge variant="secondary" className="text-xs mt-1">{preview.currency_sent}</Badge>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
                <div className="text-center">
                  <span className="text-2xl">{countryFlag(preview.receiver_country)}</span>
                  <p className="text-xs font-medium mt-1">{preview.receiver_country}</p>
                  <Badge variant="secondary" className="text-xs mt-1">{preview.currency_received}</Badge>
                </div>
              </div>

              {preview.receiver_name && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <strong>Destinataire :</strong> {preview.receiver_name}
                  {preview.receiver_code && (
                    <Badge variant="outline" className="ml-2 font-mono">{preview.receiver_code}</Badge>
                  )}
                </div>
              )}

              {/* Breakdown */}
              <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>{t('internationalTransferConfirmation.montantEnvoye')}</span>
                  <span className="font-bold">{preview.amount_sent.toLocaleString()} {preview.currency_sent}</span>
                </div>

                {/* La commission plateforme est prélevée côté backend mais N'EST PAS
                    affichée à l'utilisateur (décision PDG). Le client ne voit que
                    montant envoyé / taux / montant reçu. */}

                {preview.currency_sent !== preview.currency_received && (() => {
                  // Le taux affiché à l'expéditeur INCLUT la commission (taux net + %),
                  // sans afficher le pourcentage. Le destinataire reçoit au taux net
                  // (amount_received est calculé au taux net côté backend).
                  const commissionPct = preview.is_international ? Number(preview.fee_percentage) || 0 : 0;
                  const displayedRate = preview.rate_displayed * (1 + commissionPct / 100);
                  return (
                    <div className="flex justify-between text-blue-600 dark:text-blue-400 text-sm">
                      <span>{t('internationalTransferConfirmation.tauxDeChange')}</span>
                      <span className="font-medium">1 {preview.currency_sent} = {displayedRate.toLocaleString(undefined, { maximumFractionDigits: 4 })} {preview.currency_received}</span>
                    </div>
                  );
                })()}

                <div className="border-t pt-2 flex justify-between">
                  <span className="text-sm font-medium">{t('internationalTransferConfirmation.montantRecu')}</span>
                  <span className="text-lg font-bold text-[#ff4000] dark:text-[#ff4000]">
                    {preview.amount_received.toLocaleString()} {preview.currency_received}
                  </span>
                </div>

                {typeof preview.current_balance === 'number' && (
                  <div className="flex justify-between text-sm text-muted-foreground border-t pt-2">
                    <span>{t('internationalTransferConfirmation.soldeActuel')}</span>
                    <span className="font-semibold">{preview.current_balance.toLocaleString()} {preview.currency_sent}</span>
                  </div>
                )}
                {typeof preview.balance_after === 'number' && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{t('internationalTransferConfirmation.soldeApresTransfert')}</span>
                    <span className="font-semibold">{preview.balance_after.toLocaleString()} {preview.currency_sent}</span>
                  </div>
                )}
              </div>

              {/* Rate lock timer */}
              {preview.is_international && (
                <div className={`p-3 rounded-lg border ${expired ? 'bg-orange-50 dark:bg-[#ff4000]/30 border-orange-300' : 'bg-orange-50 dark:bg-[#ff4000]/30 border-orange-300'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className={`w-4 h-4 ${expired ? 'text-[#ff4000]' : 'text-[#ff4000]'}`} />
                    <span className="text-sm font-medium">
                      {expired
                        ? '⏰ Taux expiré — veuillez relancer la prévisualisation'
                        : `Taux verrouillé : ${secondsLeft}s restantes`
                      }
                    </span>
                  </div>
                  {!expired && (
                    <Progress value={progressPercent} className="h-2" />
                  )}
                </div>
              )}

              {preview.is_international && preview.rate_is_stale && (
                <div className="p-3 rounded-lg border text-xs bg-orange-50 dark:bg-[#ff4000]/30 border-orange-200 text-[#ff4000] dark:text-orange-300">
                  ⚠️ Le taux de change n'a pas été mis à jour récemment. Le montant reçu peut légèrement varier.
                </div>
              )}

              {expired && (
                <div className="flex items-center gap-2 p-3 bg-orange-100 dark:bg-[#ff4000]/40 rounded-lg text-[#ff4000] dark:text-[#ff4000] text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Le taux de change a expiré. Fermez et relancez la prévisualisation pour un nouveau taux.
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t('internationalTransferConfirmation.annuler')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading || expired}
            className={expired ? 'opacity-50 cursor-not-allowed' : ''}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {expired ? 'Taux expiré' : 'Confirmer le transfert'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
