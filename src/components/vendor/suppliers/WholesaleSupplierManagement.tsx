import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Package, ShoppingCart, CreditCard } from 'lucide-react';
import { SuppliersList } from './SuppliersList';
import { SupplierCatalog } from './SupplierCatalog';
import { SupplierOrders } from './SupplierOrders';
import { SupplierDebts } from './SupplierDebts';

interface WholesaleSupplierManagementProps {
  vendorId: string;
}

export function WholesaleSupplierManagement({ vendorId }: WholesaleSupplierManagementProps) {
  const [activeTab, setActiveTab] = useState('catalog');

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-6 h-6" />
          Fournisseurs Professionnels (Wholesale)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="catalog" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Catalogue
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Mes Commandes
            </TabsTrigger>
            <TabsTrigger value="debts" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Mes Dettes
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Fournisseurs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="mt-6">
            <SupplierCatalog vendorId={vendorId} />
          </TabsContent>

          <TabsContent value="orders" className="mt-6">
            <SupplierOrders vendorId={vendorId} />
          </TabsContent>

          <TabsContent value="debts" className="mt-6">
            <SupplierDebts vendorId={vendorId} />
          </TabsContent>

          <TabsContent value="suppliers" className="mt-6">
            <SuppliersList />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
