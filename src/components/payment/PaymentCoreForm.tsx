/**
 * 💳 PAYMENT CORE FORM - FORMULAIRE DE PAIEMENT UNIFIÉ 224SOLUTIONS
 * Interface utilisateur pour tous types de paiements
 * Orange Money, MTN MoMo, Carte bancaire, KULU
 */

import React, { useState } from 'react';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, Smartphone, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

type PaymentType = 'ORDER_PAYMENT' | 'SUBSCRIPTION' | 'BOOST' | 'DELIVERY' | 'COMMISSION' | 'WALLET_TOPUP';
type PaymentMethod = 'OM' | 'MOMO' | 'CARD' | 'MTN' | 'KULU';

interface PaymentCoreFormProps {
  type: PaymentType;
  referenceId: string;
  amount: number;
  currency?: string;
  vendorId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  onSuccess?: (transactionId: string, orderId: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

const paymentMethods: { id: PaymentMethod; name: string; icon: React.ReactNode; color: string }[] = [
  { id: 'OM', name: 'Orange Money', icon: <Smartphone className="h-5 w-5" />, color: 'bg-orange-500' },
  { id: 'MOMO', name: 'MTN MoMo', icon: <Smartphone className="h-5 w-5" />, color: 'bg-[#ff4000]' },
  { id: 'CARD', name: 'Carte Bancaire', icon: <CreditCard className="h-5 w-5" />, color: 'bg-blue-500' },
  { id: 'KULU', name: 'KULU', icon: <CreditCard className="h-5 w-5" />, color: 'bg-[#04439e]' },
];

const typeLabels: Record<PaymentType, string> = {
  ORDER_PAYMENT: 'Paiement de commande',
  SUBSCRIPTION: 'Abonnement',
  BOOST: 'Boost produit',
  DELIVERY: 'Livraison',
  COMMISSION: 'Commission',
  WALLET_TOPUP: 'Recharge portefeuille',
};

export const PaymentCoreForm: React.FC<PaymentCoreFormProps> = ({
  type,
  referenceId,
  amount,
  currency = 'GNF',
  vendorId,
  description,
  metadata = {},
  onSuccess,
  onError,
  onCancel,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('OM');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [resultMessage, setResultMessage] = useState('');

  const formatAmount = useFormatCurrency();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone || phone.length < 8) {
      toast.error('Veuillez entrer un numéro de téléphone valide');
      return;
    }

    setIsLoading(true);
    setStatus('processing');
    setResultMessage('Initialisation du paiement...');

    try {
      throw new Error('Le flux legacy Payment Core a ete retire. Veuillez utiliser la page /payment pour payer via Wallet, Stripe ou ChapChapPay.');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue';
      setStatus('error');
      setResultMessage(errorMsg);
      toast.error(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'success') {
    return (
      <Card className="w-full max-w-md mx-auto border-orange-200 bg-orange-50">
        <CardContent className="pt-6 text-center">
          <CheckCircle2 className="h-12 w-12 sm:h-16 sm:w-16 text-[#ff4000] mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-[#ff4000] mb-2">Paiement Initié</h3>
          <p className="text-[#ff4000] mb-4">{resultMessage}</p>
          <p className="text-sm text-muted-foreground mb-4">
            Confirmez le paiement sur votre téléphone pour finaliser la transaction.
          </p>
          <Button variant="outline" onClick={onCancel}>
            Fermer
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-primary">Paiement Sécurisé</span>
        </div>
  <CardTitle className="text-lg sm:text-xl">{typeLabels[type]}</CardTitle>
  <CardDescription>{description || `Référence: ${referenceId}`}</CardDescription>

        <div className="mt-4 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Montant à payer</p>
          <p className="text-3xl font-bold text-foreground">
            {formatAmount(amount)} <span className="text-lg font-normal">{currency}</span>
          </p>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Méthode de paiement */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Moyen de paiement</Label>
            <RadioGroup
              value={selectedMethod}
              onValueChange={(value) => setSelectedMethod(value as PaymentMethod)}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {paymentMethods.map((method) => (
                <div key={method.id}>
                  <RadioGroupItem
                    value={method.id}
                    id={method.id}
                    className="sr-only"
                  />
                  <Label
                    htmlFor={method.id}
                    className={`
                      flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${selectedMethod === method.id
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-primary/50'
                      }
                    `}
                  >
                    <div className={`p-2 rounded-full ${method.color} text-white`}>
                      {method.icon}
                    </div>
                    <span className="font-medium text-sm">{method.name}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Numéro de téléphone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-base font-medium">
              Numéro de téléphone
            </Label>
            <div className="flex gap-2">
              <div className="flex items-center px-3 bg-muted rounded-l-md border border-r-0">
                <span className="text-sm font-medium">+224</span>
              </div>
              <Input
                id="phone"
                type="tel"
                placeholder="6XX XXX XXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9\s]/g, ''))}
                className="rounded-l-none"
                disabled={isLoading}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Entrez le numéro associé à votre compte {selectedMethod === 'OM' ? 'Orange Money' : selectedMethod === 'MOMO' || selectedMethod === 'MTN' ? 'MTN MoMo' : 'de paiement'}
            </p>
          </div>

          {/* Status d'erreur */}
          {status === 'error' && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{resultMessage}</p>
            </div>
          )}

          {/* Boutons */}
          <div className="flex gap-3 pt-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1"
              >
                Annuler
              </Button>
            )}
            <Button
              type="submit"
              disabled={isLoading || !phone}
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Traitement...
                </>
              ) : (
                `Payer ${formatAmount(amount)} ${currency}`
              )}
            </Button>
          </div>

          {/* Badge sécurité */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <Badge variant="secondary" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              Paiement 100% sécurisé
            </Badge>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default PaymentCoreForm;
