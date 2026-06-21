import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from "@/hooks/useTranslation";
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DjomyPaymentForm } from '@/components/payment/DjomyPaymentForm';
import { useAuth } from '@/hooks/useAuth';

export default function DjomyPayment() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // Get payment params from URL
  const amount = parseInt(searchParams.get('amount') || '0', 10);
  const orderId = searchParams.get('orderId') || undefined;
  const vendorId = searchParams.get('vendorId') || undefined;
  const description = searchParams.get('description') || undefined;
  const returnUrl = searchParams.get('returnUrl') || '/';

  const [_paymentComplete, setPaymentComplete] = useState(false);

  const handleSuccess = (transactionId: string) => {
    setPaymentComplete(true);
    // Redirect after short delay
    setTimeout(() => {
      navigate(`${returnUrl}?payment=success&transactionId=${transactionId}`);
    }, 3000);
  };

  const handleError = (error: string) => {
    console.error('Payment error:', error);
  };

  const handleCancel = () => {
    navigate(returnUrl);
  };

  if (amount <= 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold text-destructive">{t('djomyPayment.montantInvalide')}</h1>
          <p className="text-muted-foreground">{t('djomyPayment.leMontantDuPaiementN')}</p>
          <Button onClick={() => navigate('/')} variant="outline">
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold">{t('djomyPayment.paiementMobileMoney')}</h1>
            <p className="text-xs text-muted-foreground">224Solutions</p>
          </div>
          <div className="flex items-center gap-1 text-[#ff4000] dark:text-[#ff4000]">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-medium">{t('djomyPayment.securise')}</span>
          </div>
        </div>
      </div>

      {/* Payment Form */}
      <div className="max-w-md mx-auto px-4 py-8">
        <DjomyPaymentForm
          amount={amount}
          description={description}
          orderId={orderId}
          vendorId={vendorId}
          onSuccess={handleSuccess}
          onError={handleError}
          onCancel={handleCancel}
        />

        {/* Security Info */}
        <div className="mt-8 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>{t('djomyPayment.paiementSecurise100Local')}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Vos données de paiement ne transitent jamais par nos serveurs.
            <br />
            Paiement traité par Djomy.
          </p>
        </div>
      </div>
    </div>
  );
}
