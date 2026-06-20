/**
 * Module Gestion Fournisseurs & Achats
 * Point d'entrée principal intégrant le nouveau système d'achats POS/ERP
 */

import {} from 'react';
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { SupplierPurchaseManagement } from './suppliers/SupplierPurchaseManagement';
import { Loader2 } from 'lucide-react';

export default function SupplierManagement() {
  const { vendorId, loading } = useCurrentVendor();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!vendorId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Aucun compte vendeur trouvé
      </div>
    );
  }

  return <SupplierPurchaseManagement vendorId={vendorId} />;
}
