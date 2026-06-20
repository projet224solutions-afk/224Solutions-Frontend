import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, List } from 'lucide-react';
import { CreateDebtForm } from './CreateDebtForm';
import { DebtsList } from './DebtsList';

interface VendorDebtManagementProps {
  vendorId: string;
}

export function VendorDebtManagement({ vendorId }: VendorDebtManagementProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('list');

  return (
    <Card className="w-full">
      <CardHeader className="pb-3 px-3 sm:px-6">
        <CardTitle className="text-lg sm:text-xl">{t('vendorDebtManagement.gestionDesDettes')}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="list" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
              <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">{t('vendorDebtManagement.listeDes')}</span> Dettes
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-1.5 text-xs sm:text-sm py-2">
              <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">{t('vendorDebtManagement.creerUne')}</span> Dette
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            <DebtsList vendorId={vendorId} />
          </TabsContent>

          <TabsContent value="create" className="mt-4">
            <CreateDebtForm
              vendorId={vendorId}
              onSuccess={() => setActiveTab('list')}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
