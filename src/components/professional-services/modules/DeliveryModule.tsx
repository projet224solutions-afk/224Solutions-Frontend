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
      {/* Barème tarifaire — style Meituan (cohérent avec le calcul auto par distance) */}
      <div className="rounded-xl border border-[#04439e]/20 bg-[#04439e]/5 p-3">
        <p className="mb-2 text-xs font-semibold text-[#04439e]">{t('deliveryModule.baremeTarifaire')}</p>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {[
            { label: '0 – 3 km', price: '10 000 GNF' },
            { label: '3 – 7 km', price: '20 000 GNF' },
            { label: t('deliveryModule.t7KmEt'), price: '35 000 GNF' },
          ].map((t2) => (
            <div key={t2.label} className="rounded-lg border bg-white p-2">
              <p className="text-muted-foreground">{t2.label}</p>
              <p className="font-bold text-[#04439e]">{t2.price}</p>
            </div>
          ))}
        </div>
      </div>

      <MobilityWorkspace serviceId={serviceId} jobType="livraison" />
    </div>
  );
}

export default DeliveryModule;
