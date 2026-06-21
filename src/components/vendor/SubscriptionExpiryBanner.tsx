import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useVendorRestrictions } from "@/hooks/useVendorRestrictions";

export function SubscriptionExpiryBanner() {
  const { t } = useTranslation();
  const { restrictions, loading } = useVendorRestrictions();
  const navigate = useNavigate();

  if (loading || !restrictions.isRestricted) {
    return null;
  }

  const handleRenew = () => {
    navigate('/vendeur/subscription');
  };

  return (
    <div className="sticky top-16 z-30 px-6 py-4 bg-[#ff4000]/5 border-b border-orange-200">
      <Alert variant="destructive" className="border-orange-400 bg-white/90 backdrop-blur-sm">
        <AlertTriangle className="h-5 w-5 text-orange-600" />
        <AlertTitle className="text-lg font-semibold text-orange-900 flex items-center gap-2">
          Abonnement Expiré
          {restrictions.isInGracePeriod && (
            <span className="text-sm font-normal text-orange-700 flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Période de grâce : {restrictions.gracePeriodDaysRemaining} jour(s) restant(s)
            </span>
          )}
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <div className="text-orange-800">
            <p className="font-medium mb-2">
              Votre abonnement a expiré. Les fonctionnalités suivantes sont temporairement désactivées :
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm ml-2">
              {!restrictions.canSendMessages && <li>{t('subscriptionExpiryBanner.messagerieEtReponses')}</li>}
              {!restrictions.canMakeCalls && <li>Appels sortants</li>}
              {!restrictions.canTransfer && <li>Transferts wallet</li>}
              {!restrictions.canReceivePayments && <li>{t('subscriptionExpiryBanner.receptionDeNouveauxPaiements')}</li>}
              {!restrictions.canUseVirtualCard && <li>Carte virtuelle</li>}
              {!restrictions.canCreateProducts && !restrictions.isInGracePeriod && (
                <li>{t('subscriptionExpiryBanner.ajoutDeNouveauxProduits')}</li>
              )}
            </ul>
            {restrictions.isInGracePeriod && (
              <p className="text-sm mt-2 text-orange-700 font-medium">
                ⏰ Vos produits existants restent visibles pendant encore {restrictions.gracePeriodDaysRemaining} jour(s).
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleRenew}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Renouveler maintenant
            </Button>
            <p className="text-sm text-orange-700">
              Vous conservez l'accès à toutes vos données (produits, historique, messages).
            </p>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
