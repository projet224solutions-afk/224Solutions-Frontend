/**
 * ECOMMERCE PRODUCTS - Stub (backward compatibility)
 */

import { Card, CardContent } from '@/components/ui/card';
import { Package } from 'lucide-react';

interface EcommerceProductsProps {
  serviceId: string;
}

export function EcommerceProducts({ serviceId }: EcommerceProductsProps) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">
          🛒 Gestion des produits en cours de développement
        </p>
      </CardContent>
    </Card>
  );
}

export default EcommerceProducts;
