import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from "@/hooks/useTranslation";
import ContractForm from '@/components/vendor/contracts/ContractForm';
import ContractsList from '@/components/vendor/contracts/ContractsList';
import AIContractForm from '@/components/vendor/contracts/AIContractForm';
import AIContractEditor from '@/components/vendor/contracts/AIContractEditor';
import { FileText, History, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {} from 'react';

export default function VendorContracts() {
  const { t } = useTranslation();
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewingContract, setViewingContract] = useState<any>(null);
  const [_loadingContract, setLoadingContract] = useState(false);

  const handleContractCreated = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleAIContractCreated = async (contractId: string) => {
    setLoadingContract(true);
    try {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', contractId)
        .single();

      if (error) throw error;

      setViewingContract(data);
    } catch (error) {
      console.error('Error loading contract:', error);
    } finally {
      setLoadingContract(false);
    }
  };

  const handleContractSaved = () => {
    setRefreshKey(prev => prev + 1);
  };

  // If viewing a generated contract
  if (viewingContract) {
    return (
      <div className="container mx-auto p-6">
        <AIContractEditor
          contract={viewingContract}
          onSaved={handleContractSaved}
          onClose={() => {
            setViewingContract(null);
            setRefreshKey(prev => prev + 1);
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2">{t('vendorContracts.gestionDesContrats')}</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Créez et gérez vos contrats professionnels
        </p>
      </div>

      <Tabs defaultValue="ai" className="w-full">
        <TabsList className="w-full h-auto flex flex-wrap gap-1 p-1">
          <TabsTrigger value="ai" className="flex-1 min-w-0 gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
            <Zap className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Contrat IA</span>
          </TabsTrigger>
          <TabsTrigger value="create" className="flex-1 min-w-0 gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
            <FileText className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Manuel</span>
          </TabsTrigger>
          <TabsTrigger value="list" className="flex-1 min-w-0 gap-1 sm:gap-2 text-xs sm:text-sm px-2 py-2">
            <History className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Contrats</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-6">
          <AIContractForm onSuccess={handleAIContractCreated} />
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <ContractForm onSuccess={handleContractCreated} />
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <ContractsList refresh={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
