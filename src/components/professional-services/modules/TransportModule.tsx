import { useTranslation } from "@/hooks/useTranslation";
/**
 * ✈️ MODULE VOYAGE / TOURISME — DÉSACTIVÉ (règle N°4 : IS_ACTIVE=false).
 * Affiche « Bientôt disponible » : le module sera activé dans une prochaine version.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Plane, Clock } from 'lucide-react';

interface TransportModuleProps { serviceId: string; businessName?: string; }

export const VOYAGE_IS_ACTIVE = false;

export function TransportModule({ businessName }: TransportModuleProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardContent className="space-y-4 p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#04439e]/10"><Plane className="h-8 w-8 text-[#04439e]" /></div>
          <h2 className="text-xl font-bold">{businessName || 'Voyage & Tourisme'}</h2>
          <div className="flex items-center justify-center gap-2 text-[#ff4000]"><Clock className="h-4 w-4" /><span className="font-medium">{t('transportModule.bientotDisponible')}</span></div>
          <p className="text-sm text-muted-foreground">
            Le module Voyage & Tourisme (réservations de séjours, billets, circuits) est en préparation
            et sera activé prochainement. Merci de votre patience.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default TransportModule;
