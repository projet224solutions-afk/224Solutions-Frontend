import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Star, Phone, Mail, MapPin } from 'lucide-react';

interface Supplier {
  id: string;
  business_name: string;
  manager_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  supplier_category: string | null;
  rating: number;
  total_orders: number;
  is_active: boolean;
}

export function SuppliersList() {
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('is_active', true)
        .order('rating', { ascending: false });

      if (error) throw error;

      setSuppliers(data || []);
    } catch (error: any) {
      console.error('Erreur chargement fournisseurs:', error);
      toast.error(t('suppliersList.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">{t('suppliersList.chargementDesFournisseurs')}</div>;
  }

  if (suppliers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Aucun fournisseur disponible pour le moment
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {suppliers.map((supplier) => (
        <Card key={supplier.id} className="hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{supplier.business_name}</h3>
                <p className="text-sm text-muted-foreground">{supplier.manager_name}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {supplier.supplier_category && (
                <Badge variant="outline">{supplier.supplier_category}</Badge>
              )}

              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-[#ff4000] text-[#ff4000]" />
                <span className="text-sm font-medium">{supplier.rating.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">
                  ({supplier.total_orders} commandes)
                </span>
              </div>

              <div className="space-y-1 text-sm">
                {supplier.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{supplier.phone}</span>
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{supplier.email}</span>
                  </div>
                )}
                {supplier.address && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="line-clamp-2">{supplier.address}</span>
                  </div>
                )}
              </div>
            </div>

            <Button variant="outline" className="w-full mt-4">
              Voir le catalogue
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
