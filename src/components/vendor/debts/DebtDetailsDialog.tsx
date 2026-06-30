import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';



interface Debt {
  id: string;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  minimum_installment: number;
  description: string | null;
  status: string;
  due_date: string | null;
  created_at: string;
}

interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  comment: string | null;
  created_at: string;
}

interface DebtDetailsDialogProps {
  debt: Debt;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DebtDetailsDialog({ debt, open, onOpenChange }: DebtDetailsDialogProps) {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadPayments();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debt.id]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('debt_payments')
        .select('*')
        .eq('debt_id', debt.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPayments(data || []);
    } catch (error: any) {
      console.error('Erreur chargement paiements:', error);
      toast.error(t('debtDetailsDialog.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Espèces',
      wallet: 'Wallet',
      mobile_money: 'Mobile Money',
      card: 'Carte Bancaire'
    };
    return labels[method] || method;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      in_progress: { label: 'En cours', variant: 'default' },
      paid: { label: t('debtDetailsDialog.payee'), variant: 'secondary' },
      overdue: { label: 'En retard', variant: 'destructive' },
      cancelled: { label: t('debtDetailsDialog.annulee'), variant: 'outline' }
    };

    const config = variants[status] || variants.in_progress;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base sm:text-lg">{t('debtDetailsDialog.detailsDeLaDette')}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Informations complètes sur la dette et l'historique des paiements
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Informations client */}
          <div className="border rounded-lg p-3 sm:p-4 space-y-2">
            <h3 className="font-semibold text-sm sm:text-lg mb-2 sm:mb-3">{t('debtDetailsDialog.informationsClient')}</h3>
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Nom:</span>
                <p className="font-medium text-sm">{debt.customer_name}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t('debtDetailsDialog.telephone')}</span>
                <p className="font-medium text-sm">{debt.customer_phone}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Statut:</span>
                <div className="mt-1">{getStatusBadge(debt.status)}</div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t('debtDetailsDialog.dateDeCreation')}</span>
                <p className="font-medium text-xs sm:text-sm">{formatDate(debt.created_at)}</p>
              </div>
            </div>
            {debt.description && (
              <div className="pt-2">
                <span className="text-xs text-muted-foreground">Description:</span>
                <p className="text-xs sm:text-sm mt-1">{debt.description}</p>
              </div>
            )}
          </div>

          {/* Informations financières */}
          <div className="border rounded-lg p-3 sm:p-4 space-y-3">
            <h3 className="font-semibold text-sm sm:text-lg mb-2 sm:mb-3">{t('debtDetailsDialog.informationsFinancieres')}</h3>
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              <div className="text-center p-2 sm:p-3 bg-muted rounded-lg">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">{t('debtDetailsDialog.montantTotal')}</p>
                <p className="text-sm sm:text-lg font-bold break-all">{formatAmount(debt.total_amount)}</p>
              </div>
              <div className="text-center p-2 sm:p-3 bg-orange-50 dark:bg-[#ff4000]/30 rounded-lg">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">{t('debtDetailsDialog.montantPaye')}</p>
                <p className="text-sm sm:text-lg font-bold text-[#ff4000] dark:text-[#ff4000] break-all">{formatAmount(debt.paid_amount)}</p>
              </div>
              <div className="text-center p-2 sm:p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Restant</p>
                <p className="text-sm sm:text-lg font-bold text-orange-600 dark:text-orange-400 break-all">{formatAmount(debt.remaining_amount)}</p>
              </div>
              <div className="text-center p-2 sm:p-3 bg-muted rounded-lg">
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Tranche Min.</p>
                <p className="text-sm sm:text-lg font-bold break-all">{formatAmount(debt.minimum_installment)}</p>
              </div>
            </div>

            {/* Barre de progression */}
            <div className="mt-3 sm:mt-4">
              <div className="flex justify-between text-xs sm:text-sm mb-1">
                <span className="text-muted-foreground">Progression</span>
                <span className="font-medium">
                  {Math.round((debt.paid_amount / debt.total_amount) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ff4000] transition-all duration-300"
                  style={{ width: `${(debt.paid_amount / debt.total_amount) * 100}%` }}
                />
              </div>
            </div>

            {debt.due_date && (
              <div className="mt-3 text-center">
                <span className="text-xs sm:text-sm text-muted-foreground">Date limite: </span>
                <span className="text-xs sm:text-sm font-medium">{formatDate(debt.due_date)}</span>
              </div>
            )}
          </div>

          {/* Historique des paiements */}
          <div className="border rounded-lg p-3 sm:p-4">
            <h3 className="font-semibold text-sm sm:text-lg mb-2 sm:mb-3">
              Historique des Paiements ({payments.length})
            </h3>
            {loading ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Chargement...
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Aucun paiement enregistré
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div key={payment.id} className="p-2 sm:p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">{formatDate(payment.created_at)}</p>
                        <p className="font-semibold text-sm text-[#ff4000] mt-0.5">
                          {formatAmount(payment.amount)}
                        </p>
                        {payment.comment && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{payment.comment}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] sm:text-xs flex-shrink-0">
                        {getPaymentMethodLabel(payment.payment_method)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
