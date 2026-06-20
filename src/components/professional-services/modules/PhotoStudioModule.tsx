/**
 * 📸 MODULE PHOTO / VIDÉO — réel (Snappr). Packages/devis + galerie de réalisations.
 * Livraison HD sécurisée via le système de téléchargement digital. Wallet/Copilot/
 * abonnement fournis par le ServiceDashboard.
 */

import { Camera } from 'lucide-react';
import { ServiceProjectWorkspace } from '@/components/service-common/ServiceProjectWorkspace';
import { useTranslation } from '@/hooks/useTranslation';

interface PhotoStudioModuleProps { serviceId: string; businessName?: string; }

export function PhotoStudioModule({ serviceId, businessName }: PhotoStudioModuleProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#04439e] rounded-xl"><Camera className="w-8 h-8 text-white" /></div>
        <div>
          <h2 className="text-2xl font-bold">{businessName || t('photoModule.title')}</h2>
          <p className="text-muted-foreground">{t('photoModule.subtitle')}</p>
        </div>
      </div>
      <ServiceProjectWorkspace serviceId={serviceId} escrowDefault={false} portfolio quoteLabel={t('photoModule.quoteLabel')} />
    </div>
  );
}

export default PhotoStudioModule;
