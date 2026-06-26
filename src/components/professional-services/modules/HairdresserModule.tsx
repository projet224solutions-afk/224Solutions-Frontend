import { useTranslation } from "@/hooks/useTranslation";
/**
 * MODULE COIFFEUR / SALON — données réelles.
 * Réutilise les composants Beauté (agenda Fresha-style, services, clients, galerie) qui sont
 * déjà branchés sur les tables réelles (beauty_appointments / beauty_services / …) via serviceId.
 * Plus de données fictives.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Scissors, Calendar, Users, Image as ImageIcon, Crown } from 'lucide-react';
import { BeautyAgenda } from '@/components/professional-services/modules/beauty/BeautyAgenda';
import { BeautyServices } from '@/components/professional-services/modules/beauty/BeautyServices';
import { BeautyClients } from '@/components/professional-services/modules/beauty/BeautyClients';
import { BeautyGallery } from '@/components/professional-services/modules/beauty/BeautyGallery';

interface HairdresserModuleProps {
  serviceId: string;
  businessName?: string;
}

export function HairdresserModule({ serviceId, businessName }: HairdresserModuleProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-[#04439e] p-3"><Scissors className="h-8 w-8 text-white" /></div>
        <div>
          <h2 className="text-2xl font-bold">{businessName || 'Salon de Coiffure'}</h2>
          <p className="text-muted-foreground">{t('hairdresserModule.agendaPrestationsClientsEtGalerie')}</p>
        </div>
      </div>

      <Tabs defaultValue="agenda">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="agenda"><Calendar className="mr-1 hidden h-4 w-4 md:block" />Agenda</TabsTrigger>
          <TabsTrigger value="services"><Crown className="mr-1 hidden h-4 w-4 md:block" />Prestations</TabsTrigger>
          <TabsTrigger value="clients"><Users className="mr-1 hidden h-4 w-4 md:block" />Clients</TabsTrigger>
          <TabsTrigger value="gallery"><ImageIcon className="mr-1 hidden h-4 w-4 md:block" />Galerie</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="mt-4"><BeautyAgenda serviceId={serviceId} /></TabsContent>
        <TabsContent value="services" className="mt-4"><BeautyServices serviceId={serviceId} /></TabsContent>
        <TabsContent value="clients" className="mt-4"><BeautyClients serviceId={serviceId} /></TabsContent>
        <TabsContent value="gallery" className="mt-4"><BeautyGallery serviceId={serviceId} /></TabsContent>
      </Tabs>
    </div>
  );
}

export default HairdresserModule;
