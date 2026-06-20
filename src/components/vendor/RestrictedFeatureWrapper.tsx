import { ReactNode } from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useVendorSubscription } from "@/hooks/useVendorSubscription";
import { useTranslation } from "@/hooks/useTranslation";

interface RestrictedFeatureWrapperProps {
  children: ReactNode;
  feature: 'products' | 'messages' | 'calls' | 'transfer' | 'virtualCard' | 'payments';
  fallbackMessage?: string;
}

export function RestrictedFeatureWrapper({
  children,
  feature,
  fallbackMessage
}: RestrictedFeatureWrapperProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasAccess, isExpired, loading } = useVendorSubscription();

  // En cours de chargement
  if (loading) {
    return <div className="animate-pulse bg-muted h-20 rounded" />;
  }

  // ✅ Accès autorisé si abonnement actif
  if (hasAccess && !isExpired) {
    return <>{children}</>;
  }

  // ❌ Accès refusé - Afficher le message de restriction
  const defaultMessages = {
    products: t('restrictedFeature.products'),
    messages: t('restrictedFeature.messages'),
    calls: t('restrictedFeature.calls'),
    transfer: t('restrictedFeature.transfer'),
    virtualCard: t('restrictedFeature.virtualCard'),
    payments: t('restrictedFeature.payments'),
  };

  return (
    <div className="p-8">
      <Alert className="border-orange-200 bg-orange-50">
        <Lock className="h-5 w-5 text-orange-600" />
        <AlertDescription className="mt-2">
          <p className="font-semibold text-orange-900 mb-2">
            {fallbackMessage || defaultMessages[feature]}
          </p>
          <p className="text-orange-800 mb-4">
            {t('restrictedFeature.expiredInfo')}
          </p>
          <Button
            onClick={() => navigate('/vendeur/subscription')}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {t('restrictedFeature.renew')}
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
