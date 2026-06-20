/**
 * 🚗 MODULE VTC / TRANSPORT — réel (Uber/Bolt). Dispatch de courses + suivi temps réel
 * + encaissement wallet/espèces, via le socle mobilité. Wallet/Copilot/abonnement
 * fournis par le ServiceDashboard.
 */

import { Car } from 'lucide-react';
import { MobilityWorkspace } from '@/components/service-common/MobilityWorkspace';
import { useTranslation } from '@/hooks/useTranslation';

interface VTCModuleProps { serviceId: string; businessName?: string; }

export function VTCModule({ serviceId, businessName }: VTCModuleProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#04439e] rounded-xl"><Car className="w-8 h-8 text-white" /></div>
        <div>
          <h2 className="text-2xl font-bold">{businessName || t('vtcModule.title')}</h2>
          <p className="text-muted-foreground">{t('vtcModule.subtitle')}</p>
        </div>
      </div>
      <MobilityWorkspace serviceId={serviceId} jobType="course" />
    </div>
  );
}

export default VTCModule;
