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

export interface DjomyPaymentFormProps {
  amount: number;
  description?: string;
  orderId?: string;
  vendorId?: string;
  onSuccess?: (transactionId: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
  className?: string;
}

type PaymentMethod = 'OM' | 'MOMO' | 'KULU';

interface PaymentStatus {
  status: 'idle' | 'processing' | 'success' | 'error';
  message?: string;
  transactionId?: string;
}

const PAYMENT_METHODS = [
  {
    id: 'OM' as PaymentMethod,
    name: 'Orange Money',
    icon: '🍊',
    color: 'border-orange-500 bg-orange-50 dark:bg-orange-950/30',
    activeColor: 'ring-2 ring-orange-500 border-orange-500'
  },
  {
    id: 'MOMO' as PaymentMethod,
    name: 'MTN Mobile Money',
    icon: '💛',
    color: 'border-[#ff4000] bg-orange-50 dark:bg-[#ff4000]/30',
    activeColor: 'ring-2 ring-[#ff4000] border-[#ff4000]'
  },
  {
    id: 'KULU' as PaymentMethod,
    name: 'Kulu',
    icon: '💳',
    color: 'border-blue-500 bg-blue-50 dark:bg-blue-950/30',
    activeColor: 'ring-2 ring-blue-500 border-blue-500'
  },
];

export function DjomyPaymentForm({
  amount,
  description,
  orderId,
  vendorId,
  onSuccess,
  onError,
  onCancel,
  className,
}: DjomyPaymentFormProps) {
  const { t } = useTranslation();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('OM');
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
      toast.error(t('djomyPaymentForm.numeroDeTelephoneInvalide'));
      return;
    }

    setStatus({ status: 'processing', message: t('djomyPaymentForm.initialisationDuPaiement') });

    try {
      const { data, error } = await supabase.functions.invoke('djomy-init-payment', {
        body: {
          amount,
          payerPhone: phoneNumber.replace(/\s/g, ''),
          paymentMethod,
          vendorId,
          orderId,
          description: description || `Paiement 224Solutions`,
          payerName,
          countryCode: 'GN',
          useSandbox: false,
          idempotencyKey: `${orderId || Date.now()}-${phoneNumber.replace(/\s/g, '')}`,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setStatus({
          status: 'success',
          message: t('djomyPaymentForm.paiementInitieValidezSurVotre'),
          transactionId: data.transactionId,
        });

        toast.success(t('djomyPaymentForm.paiementInitieAvecSucces'));
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
      <Card className={cn('max-w-md mx-auto', className)}>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-orange-100 dark:bg-[#ff4000]/30 rounded-full flex items-center justify-center mx-auto">
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
              <p className="text-sm"><strong>{t('djomyPaymentForm.montant')}</strong> {formatAmount(amount)}</p>
              <p className="text-sm"><strong>{t('djomyPaymentForm.methode')}</strong> {PAYMENT_METHODS.find(m => m.id === paymentMethod)?.name}</p>
              {status.transactionId && (
                <p className="text-xs text-muted-foreground font-mono">
                  Réf: {status.transactionId.slice(0, 8)}...
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="w-4 h-4" />
              <span>{t('djomyPaymentForm.vousRecevrezUneNotificationUne')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status.status === 'error') {
    return (
      <Card className={cn('max-w-md mx-auto', className)}>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-orange-100 dark:bg-[#ff4000]/30 rounded-full flex items-center justify-center mx-auto">
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
            <Button onClick={() => setStatus({ status: 'idle' })} variant="outline" className="w-full">
              Réessayer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('max-w-md mx-auto', className)}>
      <CardHeader className="text-center">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
          <CreditCard className="w-6 h-6 text-primary" />
        </div>
        <CardTitle>{t('djomyPaymentForm.paiementSecurise')}</CardTitle>
        <CardDescription>
          Payez {formatAmount(amount)} via Mobile Money
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {/* Payment Method Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">{t('djomyPaymentForm.methodeDePaiement')}</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              className="grid grid-cols-2 sm:grid-cols-3 gap-3"
            >
              {PAYMENT_METHODS.map((method) => (
                <div key={method.id}>
                  <RadioGroupItem
                    value={method.id}
                    id={method.id}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={method.id}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-lg border-2 p-3 cursor-pointer transition-all',
                      method.color,
                      paymentMethod === method.id && method.activeColor
                    )}
                  >
                    <span className="text-2xl mb-1">{method.icon}</span>
                    <span className="text-xs font-medium text-center">{method.name}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">
              <Smartphone className="w-4 h-4 inline-block mr-1" />
              Numéro de téléphone
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="XX XX XX XX XX"
              value={phoneNumber}
              onChange={handlePhoneChange}
              className="text-lg tracking-wider"
              required
            />
            <p className="text-xs text-muted-foreground">
              Le numéro associé à votre compte {PAYMENT_METHODS.find(m => m.id === paymentMethod)?.name}
            </p>
          </div>

          {/* Payer Name (optional) */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Nom (optionnel)
            </Label>
            <Input
              id="name"
              type="text"
              placeholder={t('djomyPaymentForm.votreNom')}
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
            />
          </div>

          {/* Amount Summary */}
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t('djomyPaymentForm.montant2')}</span>
              <span className="font-semibold">{formatAmount(amount)}</span>
            </div>
            {description && (
              <p className="text-xs text-muted-foreground border-t pt-2">
                {description}
              </p>
            )}
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
                {status.message || 'Traitement...'}
              </>
            ) : (
              `Payer ${formatAmount(amount)}`
            )}
          </Button>

          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={onCancel}
              disabled={status.status === 'processing'}
            >
              Annuler
            </Button>
          )}

          <p className="text-xs text-center text-muted-foreground">
            🔒 Paiement sécurisé via ChapChapPay - 224Solutions
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default DjomyPaymentForm;
