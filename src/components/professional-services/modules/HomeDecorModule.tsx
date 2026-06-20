import { useTranslation } from "@/hooks/useTranslation";
/**
 * 🛋️ MODULE MAISON & DÉCO — réel (Houzz). Devis de projets déco/aménagement +
 * galerie de réalisations. Wallet/Copilot/abonnement fournis par le ServiceDashboard.
 */

import { Home } from 'lucide-react';
import { ServiceProjectWorkspace } from '@/components/service-common/ServiceProjectWorkspace';

interface HomeDecorModuleProps { serviceId: string; businessName?: string; }

export function HomeDecorModule({ serviceId, businessName }: HomeDecorModuleProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#04439e] rounded-xl"><Home className="w-8 h-8 text-white" /></div>
        <div>
          <h2 className="text-2xl font-bold">{businessName || 'Maison & Déco'}</h2>
          <p className="text-muted-foreground">{t('homeDecorModule.devisDeProjetsGalerieDe')}</p>
        </div>
      </div>
      <ServiceProjectWorkspace serviceId={serviceId} escrowDefault={false} portfolio quoteLabel="Devis" />
    </div>
  );
}

export default HomeDecorModule;
