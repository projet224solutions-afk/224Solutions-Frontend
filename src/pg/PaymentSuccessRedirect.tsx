/**
 * PAGE DE REDIRECTION APRÈS 3D SECURE
 * Stripe redirige ici après authentification 3D Secure.
 * Cette page vérifie le statut du paiement et redirige vers /my-purchases.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function PaymentSuccessRedirect() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'checking' | 'success' | 'failed'>('checking');

  useEffect(() => {
    const paymentIntentId = searchParams.get('payment_intent');
    const redirectStatus = searchParams.get('redirect_status');

    if (redirectStatus === 'succeeded' || redirectStatus === 'requires_capture') {
      setStatus('success');
      toast.success(t('paymentSuccessRedirect.paiementConfirmeRedirectionVersVos'));
      const timer = setTimeout(() => navigate('/my-purchases', { replace: true }), 2000);
      return () => clearTimeout(timer);
    } else if (redirectStatus === 'failed') {
      setStatus('failed');
      toast.error(t('paymentSuccessRedirect.lePaiementAEchoue'));
    } else {
      // No redirect_status or unknown - assume success if payment_intent exists
      if (paymentIntentId) {
        setStatus('success');
        toast.success(t('paymentSuccessRedirect.paiementTraiteRedirectionVersVos'));
        const timer = setTimeout(() => navigate('/my-purchases', { replace: true }), 2000);
        return () => clearTimeout(timer);
      } else {
        // No payment info at all - redirect home
        navigate('/', { replace: true });
      }
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8">
          {status === 'checking' && (
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">{t('paymentSuccessRedirect.verificationDuPaiement')}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-orange-100 p-3">
                  <CheckCircle2 className="w-12 h-12 text-[#ff4000]" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-[#ff4000]">{t('paymentSuccessRedirect.paiementConfirme')}</h3>
              <p className="text-sm text-muted-foreground animate-pulse">
                Redirection vers vos achats...
              </p>
            </div>
          )}

          {status === 'failed' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-orange-100 p-3">
                  <XCircle className="w-12 h-12 text-[#ff4000]" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-[#ff4000]">{t('paymentSuccessRedirect.paiementEchoue')}</h3>
              <p className="text-sm text-muted-foreground">
                Votre paiement n'a pas pu être traité. Veuillez réessayer.
              </p>
              <Button onClick={() => navigate(-1)} className="mt-4">
                Retour
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
