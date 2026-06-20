/**
 * 📦 MODULE LIVRAISON — réel (Glovo). Dispatch de livraisons + suivi temps réel +
 * encaissement wallet/espèces, via le socle mobilité. Wallet/Copilot/abonnement
 * fournis par le ServiceDashboard.
 */

import { Package } from 'lucide-react';
import { MobilityWorkspace } from '@/components/service-common/MobilityWorkspace';
import { useTranslation } from '@/hooks/useTranslation';

interface DeliveryModuleProps { serviceId: string; businessName?: string; }

export function DeliveryModule({ serviceId, businessName }: DeliveryModuleProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#04439e] rounded-xl"><Package className="w-8 h-8 text-white" /></div>
        <div>
          <h2 className="text-2xl font-bold">{businessName || t('deliveryModule.title')}</h2>
          <p className="text-muted-foreground">{t('deliveryModule.subtitle')}</p>
        </div>
      </div>
      <MobilityWorkspace serviceId={serviceId} jobType="livraison" />
    </div>
  );
}

export default DeliveryModule;
