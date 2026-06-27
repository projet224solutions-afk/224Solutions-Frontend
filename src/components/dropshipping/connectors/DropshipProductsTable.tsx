import { useTranslation } from "@/hooks/useTranslation";
/**
 * DROPSHIP PRODUCTS TABLE
 * Table de gestion des produits dropshipping importés
 * Affiche les produits, leur statut de sync, et les actions disponibles
 *
 * @module DropshipProductsTable
 * @version 1.0.0
 * @author 224Solutions
 */

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  MoreHorizontal,
  RefreshCw,
  ExternalLink,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Package,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';

// ==================== INTERFACES ====================

export interface DropshipProduct {
  id: string;
  title: string;
  thumbnail: string;
  sourceConnector: string;
  sourceProductId: string;
  sourceUrl: string;
  costPrice: number;
  costCurrency: string;
  sellingPrice: number;
  margin: number;
  stockQuantity: number | null;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
  syncStatus: 'synced' | 'pending' | 'error' | 'never';
  lastSyncAt: string | null;
  priceChange: 'up' | 'down' | 'stable' | null;
  priceChangePct: number | null;
  isPublished: boolean;
  totalSold: number;
  totalRevenue: number;
  createdAt: string;
}

interface DropshipProductsTableProps {
  products: DropshipProduct[];
  loading: boolean;
  onRefreshProduct: (productId: string) => Promise<void>;
  onRefreshAll: () => Promise<void>;
  onEditProduct: (product: DropshipProduct) => void;
  onDeleteProduct: (productId: string) => void;
  onTogglePublish: (productId: string, published: boolean) => void;
  onViewOnSource: (url: string) => void;
}

// ==================== HELPER COMPONENTS ====================

function SyncStatusBadge({ status, lastSync }: { status: string; lastSync: string | null }) {
  const { t } = useTranslation();
  const getStatusConfig = () => {
    switch (status) {
      case 'synced':
        return { icon: CheckCircle, label: t('dropshipProductsTable.synchronise'), variant: 'default' as const, className: 'bg-[#ff4000]' };
      case 'pending':
        return { icon: Loader2, label: 'En cours', variant: 'secondary' as const, className: 'animate-spin' };
      case 'error':
        return { icon: XCircle, label: 'Erreur', variant: 'destructive' as const, className: '' };
      default:
        return { icon: AlertTriangle, label: 'Jamais', variant: 'outline' as const, className: '' };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={config.variant} className={config.className}>
            <Icon className={`w-3 h-3 mr-1 ${status === 'pending' ? 'animate-spin' : ''}`} />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {lastSync ? (
            <p>Dernière sync: {formatRelativeTime(lastSync)}</p>
          ) : (
            <p>{t('dropshipProductsTable.jamaisSynchronise')}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StockStatusBadge({ status, quantity }: { status: string; quantity: number | null }) {
  const { t } = useTranslation();
  const getConfig = () => {
    switch (status) {
      case 'in_stock':
        return { label: quantity ? `${quantity} en stock` : 'En stock', className: 'bg-orange-100 text-[#ff4000]' };
      case 'low_stock':
        return { label: `${quantity} restants`, className: 'bg-orange-100 text-[#ff4000]' };
      case 'out_of_stock':
        return { label: 'Rupture', className: 'bg-orange-100 text-[#ff4000]' };
      default:
        return { label: 'Inconnu', className: 'bg-gray-100 text-gray-800' };
    }
  };

  const config = getConfig();

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

function PriceChangeIndicator({ change, pct }: { change: string | null; pct: number | null }) {
  const { t } = useTranslation();
  if (!change || change === 'stable') return <Minus className="w-4 h-4 text-muted-foreground" />;

  if (change === 'up') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center text-[#ff4000]">
              <TrendingUp className="w-4 h-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Prix fournisseur augmenté de {pct?.toFixed(1)}%</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center text-[#ff4000]">
            <TrendingDown className="w-4 h-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Prix fournisseur diminué de {Math.abs(pct || 0).toFixed(1)}%</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ==================== MAIN COMPONENT ====================

export function DropshipProductsTable({
  products,
  loading,
  onRefreshProduct,
  onRefreshAll,
  onEditProduct,
  onDeleteProduct,
  onTogglePublish,
  onViewOnSource
}: DropshipProductsTableProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [filterConnector, setFilterConnector] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  // Filtrage des produits
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Recherche textuelle
      if (searchQuery && !product.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Filtre par connecteur
      if (filterConnector !== 'all' && product.sourceConnector !== filterConnector) {
        return false;
      }

      // Filtre par statut
      if (filterStatus === 'published' && !product.isPublished) return false;
      if (filterStatus === 'draft' && product.isPublished) return false;
      if (filterStatus === 'error' && product.syncStatus !== 'error') return false;
      if (filterStatus === 'out_of_stock' && product.stockStatus !== 'out_of_stock') return false;

      return true;
    });
  }, [products, searchQuery, filterConnector, filterStatus]);

  // Liste des connecteurs uniques
  const connectors = useMemo(() => {
    const unique = new Set(products.map(p => p.sourceConnector));
    return Array.from(unique);
  }, [products]);

  // Sélection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleSelectOne = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
    }
    setSelectedProducts(newSelected);
  };

  // Refresh individuel
  const handleRefresh = async (productId: string) => {
    setRefreshingId(productId);
    await onRefreshProduct(productId);
    setRefreshingId(null);
  };

  // Refresh tous
  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    await onRefreshAll();
    setRefreshingAll(false);
  };

  return (
    <div className="space-y-4">
      {/* Barre d'outils */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-2 items-center">
          {/* Recherche */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('dropshipProductsTable.rechercherUnProduit')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filtre connecteur */}
          <Select value={filterConnector} onValueChange={setFilterConnector}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Connecteur" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('dropshipProductsTable.tous')}</SelectItem>
              {connectors.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtre statut */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('dropshipProductsTable.tous')}</SelectItem>
              <SelectItem value="published">{t('dropshipProductsTable.publies')}</SelectItem>
              <SelectItem value="draft">Brouillons</SelectItem>
              <SelectItem value="error">Erreurs sync</SelectItem>
              <SelectItem value="out_of_stock">Rupture</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {selectedProducts.size > 0 && (
            <Button variant="outline" size="sm">
              {selectedProducts.size} sélectionné(s)
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={refreshingAll || loading}
          >
            {refreshingAll ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sync tous
          </Button>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm text-muted-foreground">{t('dropshipProductsTable.totalProduits')}</p>
          <p className="text-2xl font-bold">{products.length}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-3">
          <p className="text-sm text-[#ff4000]">{t('dropshipProductsTable.publies')}</p>
          <p className="text-2xl font-bold text-[#ff4000]">
            {products.filter(p => p.isPublished).length}
          </p>
        </div>
        <div className="bg-orange-50 rounded-lg p-3">
          <p className="text-sm text-[#ff4000]">Erreurs sync</p>
          <p className="text-2xl font-bold text-[#ff4000]">
            {products.filter(p => p.syncStatus === 'error').length}
          </p>
        </div>
        <div className="bg-orange-50 rounded-lg p-3">
          <p className="text-sm text-[#ff4000]">Rupture stock</p>
          <p className="text-2xl font-bold text-[#ff4000]">
            {products.filter(p => p.stockStatus === 'out_of_stock').length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[60px]">Image</TableHead>
              <TableHead>{t('dropshipProductsTable.produit')}</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">{t('dropshipProductsTable.cout')}</TableHead>
              <TableHead className="text-right">Prix vente</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Sync</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  <p className="text-sm text-muted-foreground mt-2">Chargement...</p>
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center">
                  <Package className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">
                    Aucun produit trouvé
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id} className={!product.isPublished ? 'opacity-60' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={selectedProducts.has(product.id)}
                      onCheckedChange={(checked) => handleSelectOne(product.id, checked as boolean)}
                    />
                  </TableCell>

                  <TableCell>
                    <div className="w-10 h-10 rounded bg-muted overflow-hidden">
                      <img
                        src={product.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="max-w-[200px]">
                      <p className="font-medium truncate">{product.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.totalSold} ventes • {formatCurrency(product.totalRevenue, 'GNF')}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline">{product.sourceConnector}</Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span>{formatCurrency(product.costPrice, product.costCurrency)}</span>
                      <PriceChangeIndicator change={product.priceChange} pct={product.priceChangePct} />
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div>
                      <p className="font-medium">{formatCurrency(product.sellingPrice, 'GNF')}</p>
                      <p className="text-xs text-[#ff4000]">+{product.margin.toFixed(0)}%</p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <StockStatusBadge status={product.stockStatus} quantity={product.stockQuantity} />
                  </TableCell>

                  <TableCell>
                    <SyncStatusBadge status={product.syncStatus} lastSync={product.lastSyncAt} />
                  </TableCell>

                  <TableCell>
                    {product.isPublished ? (
                      <Badge className="bg-[#ff4000]">
                        <Eye className="w-3 h-3 mr-1" />
                        Publié
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <EyeOff className="w-3 h-3 mr-1" />
                        Brouillon
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        <DropdownMenuItem onClick={() => handleRefresh(product.id)}>
                          {refreshingId === product.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                          )}
                          Synchroniser
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => onEditProduct(product)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => onViewOnSource(product.sourceUrl)}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Voir chez le fournisseur
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => onTogglePublish(product.id, !product.isPublished)}
                        >
                          {product.isPublished ? (
                            <><EyeOff className="w-4 h-4 mr-2" /> {t('dropshipProductsTable.depublier')}</>
                          ) : (
                            <><Eye className="w-4 h-4 mr-2" /> Publier</>
                          )}
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className="text-[#ff4000]"
                          onClick={() => onDeleteProduct(product.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination simple */}
      {filteredProducts.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            Affichage de {filteredProducts.length} sur {products.length} produits
          </p>
        </div>
      )}
    </div>
  );
}

export default DropshipProductsTable;
