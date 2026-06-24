/**
 * Liste des produits Dropshipping
 * Gestion du catalogue avec import et synchronisation
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Package,
  Search,
  Plus,
  RefreshCw,
  MoreVertical,
  Edit,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  Store
} from 'lucide-react';
import { toast } from 'sonner';
import { backendFetch } from '@/services/backendApi';
import type { DropshipProduct, DropshipSupplier } from '@/types/dropshipping';
import { AddDropshipProductDialog } from './AddDropshipProductDialog';

interface DropshipProductsProps {
  products: DropshipProduct[];
  suppliers: DropshipSupplier[];
  loading: boolean;
  onSync: (productId: string) => Promise<boolean>;
  onUpdate: (productId: string, updates: Record<string, unknown>) => Promise<boolean>;
  onDelete: (productId: string) => Promise<boolean>;
  onAdd: (product: Record<string, unknown>) => Promise<unknown>;
}

export function DropshipProducts({
  products,
  suppliers,
  loading,
  onSync,
  onUpdate,
  onDelete,
  onAdd
}: DropshipProductsProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  // Publie (ou retire) le produit dropship dans le catalogue marketplace via le backend
  // atomique → le produit importé devient réellement ACHETABLE (bridge type Shopify).
  const handleTogglePublish = async (product: DropshipProduct) => {
    const isPublished = Boolean((product as any).is_published);
    const action = isPublished ? 'unpublish' : 'publish';
    setPublishingId(product.id);
    try {
      const res = await backendFetch(`/api/v2/dropship/${product.id}/${action}`, { method: 'POST', body: {} });
      if (res.success) {
        toast.success(isPublished ? 'Produit retiré du marketplace' : 'Produit publié — il est maintenant achetable');
        await onUpdate(product.id, { is_published: !isPublished });
      } else {
        toast.error(res.error || 'Action impossible');
      }
    } finally {
      setPublishingId(null);
    }
  };

  const filteredProducts = products.filter(p =>
    p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = useFormatCurrency();

  const getAvailabilityBadge = (status: string) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      available: { label: 'Disponible', variant: 'default' },
      low_stock: { label: 'Stock faible', variant: 'secondary' },
      out_of_stock: { label: 'Rupture', variant: 'destructive' },
      temporarily_unavailable: { label: 'Indisponible', variant: 'outline' },
      discontinued: { label: t('dropshipProducts.arrete'), variant: 'destructive' }
    };
    const c = config[status] || { label: status, variant: 'secondary' as const };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const calculateMargin = (selling: number, supplier: number) => {
    if (supplier === 0) return 0;
    const exchangeRate = 8500; // USD to GNF approximatif
    const supplierGNF = supplier * exchangeRate;
    return ((selling - supplierGNF) / selling * 100);
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec recherche et actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('dropshipProducts.rechercherUnProduit')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Synchroniser tout
          </Button>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Importer Produit
          </Button>
        </div>
      </div>

      {/* Tableau des produits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Catalogue Dropshipping ({filteredProducts.length} produits)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="font-medium text-lg mb-2">{t('dropshipProducts.aucunProduitDropshipping')}</h3>
              <p className="mb-4">{t('dropshipProducts.importezDesProduitsDepuisVos')}</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Importer un Produit
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('dropshipProducts.produit')}</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Prix Achat</TableHead>
                    <TableHead>Prix Vente</TableHead>
                    <TableHead>Marge</TableHead>
                    <TableHead>{t('dropshipProducts.disponibilite')}</TableHead>
                    <TableHead>{t('dropshipProducts.livraison')}</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                            {product.images?.[0] ? (
                              <img
                                src={product.images[0]}
                                alt={product.product_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="w-6 h-6 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium line-clamp-1">{product.product_name}</p>
                            {product.category && (
                              <p className="text-xs text-muted-foreground">{product.category}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{product.supplier?.name || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {formatCurrency(product.supplier_price, product.supplier_currency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {formatCurrency(product.selling_price, product.selling_currency)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${
                          calculateMargin(product.selling_price, product.supplier_price) > 20
                            ? 'text-[#ff4000]'
                            : 'text-orange-600'
                        }`}>
                          {calculateMargin(product.selling_price, product.supplier_price).toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        {getAvailabilityBadge(product.availability_status)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {product.estimated_delivery_min}-{product.estimated_delivery_max} jours
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onSync(product.id)}>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Synchroniser
                            </DropdownMenuItem>
                            {product.supplier_product_url && (
                              <DropdownMenuItem asChild>
                                <a href={product.supplier_product_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Voir chez fournisseur
                                </a>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => onUpdate(product.id, { is_active: !product.is_active })}
                            >
                              {product.is_active ? (
                                <>
                                  <EyeOff className="w-4 h-4 mr-2" />
                                  Désactiver
                                </>
                              ) : (
                                <>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Activer
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={publishingId === product.id}
                              onClick={() => handleTogglePublish(product)}
                            >
                              <Store className="w-4 h-4 mr-2" />
                              {(product as any).is_published ? 'Retirer du marketplace' : 'Publier sur le marketplace'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onDelete(product.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog d'ajout de produit */}
      <AddDropshipProductDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        suppliers={suppliers}
        onAdd={onAdd}
      />
    </div>
  );
}
