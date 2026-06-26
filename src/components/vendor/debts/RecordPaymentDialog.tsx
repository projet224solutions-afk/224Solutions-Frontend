import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { DollarSign, Banknote, Smartphone, CreditCard, Wallet, Loader2 } from 'lucide-react';
import { sendPaymentReceivedNotification, sendDebtPaidNotification } from '@/utils/debtNotifications';

interface Debt {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_id: string | null;
  remaining_amount: number;
  minimum_installment: number;
  total_amount: number;
}

interface RecordPaymentDialogProps {
  debt: Debt;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type PaymentMethod = 'cash' | 'wallet' | 'mobile_money' | 'card';

const paymentMethods: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'cash', label: "Espèces", icon: <Banknote className="w-4 h-4" /> },
  { value: 'wallet', label: 'Wallet', icon: <Wallet className="w-4 h-4" /> },
  { value: 'mobile_money', label: 'Mobile Money', icon: <Smartphone className="w-4 h-4" /> },
  { value: 'card', label: 'Carte Bancaire', icon: <CreditCard className="w-4 h-4" /> },
];

export function RecordPaymentDialog({ debt, open, onOpenChange, onSuccess }: RecordPaymentDialogProps) {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [comment, setComment] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error(t('recordPaymentDialog.vousDevezEtreConnecte'));
      return;
    }

    const paymentAmount = parseFloat(amount);

    // Validation
    if (!amount || isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error(t('recordPaymentDialog.veuillezEntrerUnMontantValide'));
      return;
    }

    if (paymentAmount < debt.minimum_installment && paymentAmount !== debt.remaining_amount) {
      toast.error(`Le montant doit être au minimum ${fc(debt.minimum_installment)} (sauf pour solder la dette)`);
      return;
    }

    if (paymentAmount > debt.remaining_amount) {
      toast.error(`Le montant ne peut pas dépasser le restant dû (${fc(debt.remaining_amount)})`);
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('debt_payments')
        .insert({
          debt_id: debt.id,
          amount: paymentAmount,
          payment_method: paymentMethod,
          comment: comment || null,
          recorded_by: user.id
        });

      if (error) throw error;

      // Calculer le nouveau solde restant
      const newRemainingAmount = debt.remaining_amount - paymentAmount;

      // Envoyer notification appropriée
      if (newRemainingAmount <= 0) {
        // Dette entièrement payée
        await sendDebtPaidNotification(
          debt.customer_id,
          debt.customer_name,
          debt.customer_phone,
          debt.total_amount,
          'Votre vendeur'
        );
        toast.success(t('recordPaymentDialog.detteEntierementSoldee'));
      } else {
        // Paiement partiel
        await sendPaymentReceivedNotification(
          debt.id,
          debt.customer_id,
          debt.customer_name,
          debt.customer_phone,
          paymentAmount,
          newRemainingAmount,
          'Votre vendeur'
        );
        toast.success(t('recordPaymentDialog.paiementEnregistreAvecSucces'));
      }

      // Reset form
      setAmount('');
      setComment('');
      setPaymentMethod('cash');

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erreur enregistrement paiement:', error);
      toast.error(error.message || 'Erreur lors de l\'enregistrement du paiement');
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
  };

  const handleClose = () => {
    if (!loading) {
      setAmount('');
      setComment('');
      setPaymentMethod('cash');
      onOpenChange(false);
    }
  };

  // Boutons de montants rapides
  const quickAmounts = [
    debt.minimum_installment,
    Math.min(debt.minimum_installment * 2, debt.remaining_amount),
    debt.remaining_amount
  ].filter((v, i, a) => a.indexOf(v) === i && v <= debt.remaining_amount);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('recordPaymentDialog.encaisserUneTranche')}</DialogTitle>
          <DialogDescription>
            Client: <span className="font-medium">{debt.customer_name}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Informations */}
          <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('recordPaymentDialog.restantDu')}</span>
              <span className="font-bold text-orange-600">{formatAmount(debt.remaining_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tranche minimale:</span>
              <span className="font-medium">{formatAmount(debt.minimum_installment)}</span>
            </div>
          </div>

          {/* Montants rapides */}
          <div className="space-y-2">
            <Label>Montants rapides</Label>
            <div className="flex gap-2 flex-wrap">
              {quickAmounts.map((quickAmount) => (
                <Button
                  key={quickAmount}
                  type="button"
                  variant={parseFloat(amount) === quickAmount ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAmount(quickAmount.toString())}
                >
                  {quickAmount === debt.remaining_amount ? 'Solder' : formatAmount(quickAmount)}
                </Button>
              ))}
            </div>
          </div>

          {/* Montant */}
          <div className="space-y-2">
            <Label htmlFor="amount">{t('recordPaymentDialog.montantEncaisseGnf')}</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                min="1"
                max={debt.remaining_amount}
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Min: ${debt.minimum_installment.toLocaleString('fr-FR')}`}
                className="pl-10"
                required
              />
            </div>
          </div>

          {/* Mode de paiement */}
          <div className="space-y-2">
            <Label>{t('recordPaymentDialog.modeDePaiement')}</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
              className="grid grid-cols-2 gap-2"
            >
              {paymentMethods.map((method) => (
                <div key={method.value}>
                  <RadioGroupItem
                    value={method.value}
                    id={method.value}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={method.value}
                    className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary hover:bg-muted"
                  >
                    {method.icon}
                    <span className="text-sm">{method.label}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Commentaire */}
          <div className="space-y-2">
            <Label htmlFor="comment">Commentaire (optionnel)</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('recordPaymentDialog.noteSurCePaiement')}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Boutons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={loading}
            >
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer le paiement'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
