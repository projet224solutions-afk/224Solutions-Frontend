/**
 * MODULES STUBS - Services en cours de développement
 * Le module Traiteur sera développé prochainement
 */

import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from "@/hooks/useTranslation";
import { Utensils } from 'lucide-react';

interface ModuleProps {
  serviceId: string;
  businessName: string;
}

// Traiteur - Inspiré de ezCater
export function CateringModule({ serviceId, businessName }: ModuleProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-[#ff4000] rounded-xl">
          <Utensils className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{businessName}</h2>
          <p className="text-muted-foreground">{t('stubs.serviceTraiteur')}</p>
        </div>
      </div>
      <Card>
        <CardContent className="py-12 text-center">
          <Utensils className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Module Traiteur</h3>
          <p className="text-muted-foreground">
            🍱 Gestion des menus, devis événements et commandes groupe.<br/>
            Module en cours de développement.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default {
  CateringModule
};

