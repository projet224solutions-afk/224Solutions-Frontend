import { useTranslation } from "@/hooks/useTranslation";
/**
 * 💻 MODULE INFORMATIQUE / TECH — réel. Devis de projets/dépannage avec paiement
 * SÉQUESTRÉ (libéré à la livraison validée) + portfolio. Wallet/Copilot/abonnement
 * fournis par le ServiceDashboard.
 */

import { Laptop } from 'lucide-react';
import { ServiceProjectWorkspace } from '@/components/service-common/ServiceProjectWorkspace';

interface DeveloperModuleProps { serviceId: string; businessName?: string; }

export function DeveloperModule({ serviceId, businessName }: DeveloperModuleProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#04439e] rounded-xl"><Laptop className="w-8 h-8 text-white" /></div>
        <div>
          <h2 className="text-2xl font-bold">{businessName || 'Informatique / Tech'}</h2>
          <p className="text-muted-foreground">{t('developerModule.devisDeProjetsSecurisesPortfolio')}</p>
        </div>
      </div>
      <ServiceProjectWorkspace serviceId={serviceId} escrowDefault portfolio quoteLabel="Devis" />
    </div>
  );
}

export default DeveloperModule;
