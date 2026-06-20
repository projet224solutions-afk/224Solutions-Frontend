import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Star, Package, Search } from 'lucide-react';
import { OrderSupplierProductDialog } from './OrderSupplierProductDialog';

interface SupplierProduct {
  id: string;
  product_name: string;
  images: any[];
  price_wholesale: number;
  price_retail: number;
  stock: number;
  minimum_order: number;
  product_category: string | null;
  sku: string | null;
  description: string | null;
  supplier_id: string;
  supplier: {
    business_name: string;
    rating: number;
  };
}

interface SupplierCatalogProps {
  vendorId: string;
}

export function SupplierCatalog({ vendorId }: SupplierCatalogProps) {
  const { t } = useTranslation();
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<SupplierProduct | null>(null);
  const [showOrderDialog, setShowOrderDialog] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = products.filter(
        (p) =>
          p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.supplier.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.product_category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchTerm, products]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplier_products')
        .select(`
          *,
          supplier:suppliers(business_name, rating)
        `)
        .eq('is_active', true)
        .gt('stock', 0)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProducts(data || []);
      setFilteredProducts(data || []);
    } catch (error: any) {
      console.error('Erreur chargement produits:', error);
      toast.error(t('supplierCatalog.erreurLorsDuChargementDu'));
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' GNF';
  };

  if (loading) {
    return <div className="text-center py-8">{t('supplierCatalog.chargementDuCatalogue')}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('supplierCatalog.rechercherUnProduitFournisseurOu')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Grille de produits */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchTerm ? 'Aucun produit trouvé pour votre recherche' : 'Aucun produit disponible dans le catalogue'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                {/* Image */}
                <div className="w-full h-40 bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                  {product.images && product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.product_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Package className="w-12 h-12 text-muted-foreground" />
                  )}
                </div>

                {/* Informations */}
                <div className="space-y-2">
                  <h3 className="font-semibold line-clamp-2">{product.product_name}</h3>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Fournisseur:</span>
                    <span className="font-medium">{product.supplier.business_name}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-[#ff4000] text-[#ff4000]" />
                    <span className="text-sm font-medium">{product.supplier.rating.toFixed(1)}</span>
                  </div>

                  {product.product_category && (
                    <Badge variant="secondary">{product.product_category}</Badge>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-sm pt-2">
                    <div>
                      <p className="text-muted-foreground">Prix Gros</p>
                      <p className="font-bold text-primary">{formatAmount(product.price_wholesale)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Stock</p>
                      <p className="font-medium">{product.stock} unités</p>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Commande min: {product.minimum_order} unités
                  </div>

                  <Button
                    className="w-full mt-2"
                    onClick={() => {
                      setSelectedProduct(product);
                      setShowOrderDialog(true);
                    }}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Commander
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedProduct && (
        <OrderSupplierProductDialog
          product={selectedProduct}
          vendorId={vendorId}
          open={showOrderDialog}
          onOpenChange={setShowOrderDialog}
          onSuccess={loadProducts}
        />
      )}
    </div>
  );
}
