/**
 * MODULE GESTION FOURNISSEURS & ACHATS
 * Point central de gestion des achats de stock vendeur
 * Niveau professionnel POS/ERP
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, ShoppingCart, TrendingUp, Package, DollarSign } from 'lucide-react';
import { VendorSuppliersList } from './VendorSuppliersList';
import { PurchasesList } from './PurchasesList';
import { SupplierDebts } from './SupplierDebts';
import { ValidatedPurchasesSheet } from './ValidatedPurchasesSheet';
import { DraftPurchasesSheet } from './DraftPurchasesSheet';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from '@/hooks/useTranslation';

interface SupplierPurchaseManagementProps {
  vendorId: string;
}

export function SupplierPurchaseManagement({ vendorId }: SupplierPurchaseManagementProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('purchases');
  const [isValidatedSheetOpen, setIsValidatedSheetOpen] = useState(false);
  const [isDraftSheetOpen, setIsDraftSheetOpen] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);

  const handleViewPurchase = (purchaseId: string) => {
    setSelectedPurchaseId(purchaseId);
    setActiveTab('purchases');
  };

  // Stats pour les badges
  const { data: stats } = useQuery({
    queryKey: ['supplier-purchase-stats', vendorId],
    queryFn: async () => {
      const [suppliersRes, validatedPurchasesRes, draftPurchasesRes] = await Promise.all([
        supabase
          .from('vendor_suppliers')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorId)
          .eq('is_active', true),
        // Compter uniquement les achats validés
        supabase
          .from('stock_purchases')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorId)
          .eq('status', 'validated'),
        // Compter tous les achats non validés (brouillons)
        supabase
          .from('stock_purchases')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorId)
          .neq('status', 'validated')
      ]);

      return {
        suppliersCount: suppliersRes.count || 0,
        validatedPurchasesCount: validatedPurchasesRes.count || 0,
        draftPurchasesCount: draftPurchasesRes.count || 0
      };
    },
    enabled: !!vendorId
  });

  return (
    <div className="space-y-4">
      {/* Header avec stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-5 md:p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 md:p-2 rounded-lg bg-primary/20">
                <Building2 className="h-6 w-6 md:h-5 md:w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.suppliersCount || 0}</p>
                <p className="text-xs text-muted-foreground">{t('suppliers.stat.suppliers')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Carte Achats cliquable */}
        <Card
          className="bg-[#ff4000]/10 border-[#ff4000]/20 cursor-pointer hover:border-[#ff4000]/40 hover:shadow-md transition-all active:scale-95"
          onClick={() => setIsValidatedSheetOpen(true)}
        >
          <CardContent className="p-5 md:p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 md:p-2 rounded-lg bg-[#ff4000]/20">
                <ShoppingCart className="h-6 w-6 md:h-5 md:w-5 text-[#ff4000]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.validatedPurchasesCount || 0}</p>
                <p className="text-xs text-muted-foreground">{t('suppliers.stat.purchases')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Carte Brouillons cliquable */}
        <Card
          className="bg-orange-500/10 border-orange-500/20 cursor-pointer hover:border-orange-500/40 hover:shadow-md transition-all active:scale-95"
          onClick={() => setIsDraftSheetOpen(true)}
        >
          <CardContent className="p-5 md:p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 md:p-2 rounded-lg bg-orange-500/20">
                <Package className="h-6 w-6 md:h-5 md:w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.draftPurchasesCount || 0}</p>
                <p className="text-xs text-muted-foreground">{t('suppliers.stat.drafts')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#04439e]/10 border-[#04439e]/20">
          <CardContent className="p-5 md:p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 md:p-2 rounded-lg bg-[#04439e]/20">
                <TrendingUp className="h-6 w-6 md:h-5 md:w-5 text-[#04439e]" />
              </div>
              <div>
                <p className="text-2xl font-bold">ERP</p>
                <p className="text-xs text-muted-foreground">{t('suppliers.stat.integrated')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principales */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="w-5 h-5" />
            {t('suppliers.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-4 h-12 md:h-10">
              <TabsTrigger value="purchases" className="flex items-center gap-2 text-sm md:text-xs">
                <ShoppingCart className="w-5 h-5 md:w-4 md:h-4" />
                <span>{t('suppliers.tab.purchases')}</span>
              </TabsTrigger>
              <TabsTrigger value="suppliers" className="flex items-center gap-2 text-sm md:text-xs">
                <Building2 className="w-5 h-5 md:w-4 md:h-4" />
                <span>{t('suppliers.tab.suppliers')}</span>
                {stats?.suppliersCount ? (
                  <Badge variant="outline" className="ml-1 text-xs">
                    {stats.suppliersCount}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="debts" className="flex items-center gap-2 text-sm md:text-xs">
                <DollarSign className="w-5 h-5 md:w-4 md:h-4" />
                <span>Dettes</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="purchases" className="mt-0">
              <PurchasesList vendorId={vendorId} initialPurchaseId={selectedPurchaseId} onPurchaseViewed={() => setSelectedPurchaseId(null)} />
            </TabsContent>

            <TabsContent value="suppliers" className="mt-0">
              <VendorSuppliersList vendorId={vendorId} />
            </TabsContent>

            <TabsContent value="debts" className="mt-0">
              <SupplierDebts vendorId={vendorId} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Sheets */}
      <ValidatedPurchasesSheet
        vendorId={vendorId}
        isOpen={isValidatedSheetOpen}
        onClose={() => setIsValidatedSheetOpen(false)}
        onViewPurchase={handleViewPurchase}
      />
      <DraftPurchasesSheet
        vendorId={vendorId}
        isOpen={isDraftSheetOpen}
        onClose={() => setIsDraftSheetOpen(false)}
      />
    </div>
  );
}
