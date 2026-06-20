import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🔧 MODULE RÉPARATION / MÉCANIQUE — réel (YourMechanic). Devis d'intervention avec
 * paiement SÉQUESTRÉ (libéré après réparation validée) + galerie d'interventions.
 * Wallet/Copilot/abonnement fournis par le ServiceDashboard.
 */

import { Wrench } from 'lucide-react';
import { ServiceProjectWorkspace } from '@/components/service-common/ServiceProjectWorkspace';

interface RepairModuleProps { serviceId: string; businessName?: string; }

export function RepairModule({ serviceId, businessName }: RepairModuleProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#04439e] rounded-xl"><Wrench className="w-8 h-8 text-white" /></div>
        <div>
          <h2 className="text-2xl font-bold">{businessName || 'Réparation / Mécanique'}</h2>
          <p className="text-muted-foreground">{t('repairModule.devisDInterventionSecurisesInterventions')}</p>
        </div>
      </div>
      <ServiceProjectWorkspace serviceId={serviceId} escrowDefault portfolio quoteLabel="Devis" />
    </div>
  );
}

export default RepairModule;
