/**
 * Widget Wallet pour le module immobilier
 */
import { WalletBalanceWidget } from '@/components/wallet/WalletBalanceWidget';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface RealEstateWalletWidgetProps {
  className?: string;
}

export function RealEstateWalletWidget({ className }: RealEstateWalletWidgetProps) {
  const { t } = useTranslation();
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          Portefeuille Immobilier
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <WalletBalanceWidget showTransferButton={true} />
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <ArrowUpRight className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Revenus</p>
              <p className="text-sm font-semibold">Commissions</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <ArrowDownRight className="h-4 w-4 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">{t('realEstateWalletWidget.depenses')}</p>
              <p className="text-sm font-semibold">{t('realEstateWalletWidget.publicites')}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
