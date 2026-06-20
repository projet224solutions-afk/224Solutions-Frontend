import { useTranslation } from "@/hooks/useTranslation";
/**
 * 💼 MODULE FREELANCE / SERVICES PRO — réel (Fiverr/Upwork). Devis avec paiement
 * SÉQUESTRÉ (libéré à la validation du client) + portfolio. Wallet/Copilot/abonnement
 * fournis par le ServiceDashboard.
 */

import { Briefcase } from 'lucide-react';
import { ServiceProjectWorkspace } from '@/components/service-common/ServiceProjectWorkspace';

interface FreelanceModuleProps { serviceId: string; businessName?: string; }

export function FreelanceModule({ serviceId, businessName }: FreelanceModuleProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#04439e] rounded-xl"><Briefcase className="w-8 h-8 text-white" /></div>
        <div>
          <h2 className="text-2xl font-bold">{businessName || 'Services Professionnels'}</h2>
          <p className="text-muted-foreground">{t('freelanceModule.devisSecurisesSequestrePortfolio')}</p>
        </div>
      </div>
      <ServiceProjectWorkspace serviceId={serviceId} escrowDefault portfolio quoteLabel="Devis" />
    </div>
  );
}

export default FreelanceModule;
