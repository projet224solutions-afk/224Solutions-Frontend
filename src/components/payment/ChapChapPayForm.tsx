/**
 * 📱 FORMULAIRE DE PAIEMENT CHAPCHAPPAY - 224SOLUTIONS
 * Composant de paiement Mobile Money via ChapChapPay
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Smartphone, CreditCard, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface ChapChapPayFormProps {
  amount: number;
  description?: string;
  orderId?: string;
  vendorId?: string;
  onSuccess?: (transactionId: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  className?: string;
}

type PaymentMethod = 'orange_money' | 'mtn_momo' | 'paycard';

interface PaymentStatus {
  status: 'idle' | 'processing' | 'success' | 'error';
  message?: string;
  transactionId?: string;
}

const PAYMENT_METHODS = [
  {
    id: 'orange_money' as PaymentMethod,
    name: 'Orange Money',
    icon: '🍊',
    color: 'border-orange-500 bg-orange-50 dark:bg-orange-950/30',
    activeColor: 'ring-2 ring-orange-500 border-orange-500'
  },
  {
    id: 'mtn_momo' as PaymentMethod,
    name: 'MTN Mobile Money',
    icon: '💛',
    color: 'border-[#ff4000] bg-orange-50 dark:bg-[#ff4000]/30',
    activeColor: 'ring-2 ring-[#ff4000] border-[#ff4000]'
  },
  {
    id: 'paycard' as PaymentMethod,
    name: 'PayCard',
    icon: '💳',
    color: 'border-blue-500 bg-blue-50 dark:bg-blue-950/30',
    activeColor: 'ring-2 ring-blue-500 border-blue-500'
  },
];

export function ChapChapPayForm({
  amount,
  description,
  orderId,
  vendorId,
  onSuccess,
  onError,
  onCancel,
  className,
}: ChapChapPayFormProps) {
  const { t } = useTranslation();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('orange_money');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [payerName, setPayerName] = useState('');
  const [status, setStatus] = useState<PaymentStatus>({ status: 'idle' });

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    // Format: XX XX XX XX XX
    const formatted = digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
    return formatted.slice(0, 14); // Max 10 digits with spaces
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(formatPhoneNumber(e.target.value));
  };

  const validatePhone = (phone: string) => {
    const digits = phone.replace(/\s/g, '');
    return digits.length >= 9;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePhone(phoneNumber)) {
      toast.error(t('chapChapPayForm.numeroDeTelephoneInvalide'));
      return;
    }

    setStatus({ status: 'processing', message: t('chapChapPayForm.initialisationDuPaiement') });

    try {
      // Formater le numéro de téléphone pour ChapChapPay (format 224XXXXXXXXX)
      const digits = phoneNumber.replace(/\s/g, '');
      const customerPhone = digits.length === 9 ? `224${digits}` : digits;

      const { data, error } = await supabase.functions.invoke('chapchappay-pull', {
        body: {
          amount,
          customerPhone,
          paymentMethod,
          vendorId,
          orderId,
          description: description || `Paiement 224Solutions`,
          idempotencyKey: `${orderId || Date.now()}-${customerPhone}`,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setStatus({
          status: 'success',
          message: t('chapChapPayForm.paiementInitieValidezSurVotre'),
          transactionId: data.transactionId,
        });

        toast.success(t('chapChapPayForm.paiementInitieAvecSucces'));
        onSuccess?.(data.transactionId);
      } else {
        throw new Error(data?.error || 'Erreur inconnue');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Erreur lors du paiement';
      setStatus({
        status: 'error',
        message: errorMessage,
      });
      toast.error(errorMessage);
      onError?.(errorMessage);
    }
  };

  const formatAmount = useFormatCurrency();

  if (status.status === 'success') {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-orange-100 dark:bg-[#ff4000]/30 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-[#ff4000] dark:text-[#ff4000]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#ff4000] dark:text-[#ff4000]">
                Paiement initié !
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Veuillez valider le paiement sur votre téléphone
              </p>
            </div>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="text-sm"><strong>{t('chapChapPayForm.montant')}</strong> {formatAmount(amount)}</p>
              <p className="text-sm"><strong>{t('chapChapPayForm.methode')}</strong> {PAYMENT_METHODS.find(m => m.id === paymentMethod)?.name}</p>
              {status.transactionId && (
                <p className="text-xs text-muted-foreground font-mono">
                  Réf: {status.transactionId.slice(0, 8)}...
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4" />
              <span>{t('chapChapPayForm.vousRecevrezUneNotificationUne')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status.status === 'error') {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-orange-100 dark:bg-[#ff4000]/30 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-[#ff4000] dark:text-[#ff4000]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#ff4000] dark:text-[#ff4000]">
                Échec du paiement
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {status.message}
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                onClick={() => setStatus({ status: 'idle' })}
              >
                Réessayer
              </Button>
              {onCancel && (
                <Button
                  variant="ghost"
                  onClick={onCancel}
                >
                  Annuler
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          Paiement Mobile Money
        </CardTitle>
        <CardDescription>
          Payez facilement avec Orange Money, MTN MoMo ou PayCard
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {/* Montant */}
          <div className="bg-primary/10 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">{t('chapChapPayForm.montantAPayer')}</p>
            <p className="text-3xl font-bold text-primary mt-1">
              {formatAmount(amount)}
            </p>
          </div>

          {/* Choix du moyen de paiement */}
          <div className="space-y-3">
            <Label>{t('chapChapPayForm.moyenDePaiement')}</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              className="grid grid-cols-3 sm:grid-cols-3 gap-2"
            >
              {PAYMENT_METHODS.map((method) => (
                <Label
                  key={method.id}
                  htmlFor={method.id}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all',
                    method.color,
                    paymentMethod === method.id && method.activeColor
                  )}
                >
                  <RadioGroupItem
                    value={method.id}
                    id={method.id}
                    className="sr-only"
                  />
                  <span className="text-2xl">{method.icon}</span>
                  <span className="text-xs font-medium text-center">
                    {method.name}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          {/* Numéro de téléphone */}
          <div className="space-y-2">
            <Label htmlFor="phone">{t('chapChapPayForm.numeroDeTelephone')}</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="XX XX XX XX XX"
              value={phoneNumber}
              onChange={handlePhoneChange}
              disabled={status.status === 'processing'}
              className="text-lg tracking-wider"
            />
            <p className="text-xs text-muted-foreground">
              Le numéro associé à votre compte {PAYMENT_METHODS.find(m => m.id === paymentMethod)?.name}
            </p>
          </div>

          {/* Nom du payeur (optionnel) */}
          <div className="space-y-2">
            <Label htmlFor="name">{t('chapChapPayForm.votreNomOptionnel')}</Label>
            <Input
              id="name"
              type="text"
              placeholder="Nom complet"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              disabled={status.status === 'processing'}
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={status.status === 'processing' || !validatePhone(phoneNumber)}
          >
            {status.status === 'processing' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {status.message || 'Traitement en cours...'}
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Payer {formatAmount(amount)}
              </>
            )}
          </Button>

          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={status.status === 'processing'}
              className="w-full"
            >
              Annuler
            </Button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            🔒 Paiement sécurisé via ChapChapPay
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

// Export pour rétrocompatibilité avec les imports existants
export { ChapChapPayForm as MobileMoneyPaymentForm };
