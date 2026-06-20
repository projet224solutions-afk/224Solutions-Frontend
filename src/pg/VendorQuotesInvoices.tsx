/**
 * PAGE DEVIS & FACTURES - INTERFACE VENDEUR
 */

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import QuoteForm from '@/components/vendor/quotes/QuoteForm';
import QuotesList from '@/components/vendor/quotes/QuotesList';
import InvoicesList from '@/components/vendor/invoices/InvoicesList';
import { FileText, Receipt } from 'lucide-react';

export default function VendorQuotesInvoices() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleQuoteCreated = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Devis & Factures</h1>
        <p className="text-muted-foreground">
          Créez des devis professionnels et convertissez-les en factures
        </p>
      </div>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
          <TabsTrigger value="create" className="gap-2">
            <FileText className="w-4 h-4" />
            Créer un devis
          </TabsTrigger>
          <TabsTrigger value="quotes" className="gap-2">
            <FileText className="w-4 h-4" />
            Mes Devis
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <Receipt className="w-4 h-4" />
            Mes Factures
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-6">
          <QuoteForm onSuccess={handleQuoteCreated} />
        </TabsContent>

        <TabsContent value="quotes" className="mt-6">
          <QuotesList refresh={refreshKey} />
        </TabsContent>

        <TabsContent value="invoices" className="mt-6">
          <InvoicesList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
