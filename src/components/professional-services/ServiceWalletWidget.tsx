/**
 * 💰 WIDGET WALLET POUR SERVICES DE PROXIMITÉ
 * Intègre le wallet universel dans chaque interface de service professionnel
 * avec l'affichage de l'ID du prestataire
 */

import { lazy, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

const UniversalWalletTransactions = lazy(() =>
  import('@/components/wallet/UniversalWalletTransactions').then(m => ({ default: m.UniversalWalletTransactions }))
);

interface ServiceWalletWidgetProps {
  userId?: string;
  businessName?: string;
}

export function ServiceWalletWidget({ userId, businessName }: ServiceWalletWidgetProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      {businessName && (
        <div className="flex items-center gap-2 mb-2">
          <Wallet className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">{t('serviceWallet.walletOf')} {businessName}</h2>
        </div>
      )}
      <Suspense fallback={
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </CardContent>
        </Card>
      }>
        <UniversalWalletTransactions userId={userId} showBalance={true} />
      </Suspense>
    </div>
  );
}

export default ServiceWalletWidget;
