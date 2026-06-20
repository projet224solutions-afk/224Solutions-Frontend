import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Package, Search, Eye, Ban, Trash2, Edit, AlertTriangle, DollarSign, TrendingUp, TrendingDown, Box, Store, AlertCircle } from 'lucide-react';
import { usePDGProductsData } from '@/hooks/usePDGProductsData';
import { getPdgVisibilityOverview, updatePdgVisibilityConfig } from '@/services/marketplaceVisibilityService';
import { toast } from 'sonner';

export default function PDGProductsManagement() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { products, vendors, loading, stats, toggleProductStatus, deleteProduct, updateProduct } = usePDGProductsData();
  const [visibilityOverview, setVisibilityOverview] = useState<any>(null);
  const [savingVisibilityConfig, setSavingVisibilityConfig] = useState(false);
  const [visibilityConfig, setVisibilityConfig] = useState({
    subscription_weight: 35,
    performance_weight: 25,
    boost_weight: 20,
    quality_weight: 10,
    relevance_weight: 10,
    sponsored_slots_ratio: 20,
    popular_slots_ratio: 30,
    organic_slots_ratio: 50,
    max_boost_per_vendor: 10,
    vendor_diversity_penalty: 8,
    min_quality_threshold: 20,
    rotation_factor: 10,
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [viewProduct, setViewProduct] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'orphan' | 'active' | 'inactive'>('all');

  useEffect(() => {
    let mounted = true;
    getPdgVisibilityOverview().then((resp) => {
      if (!mounted) return;
      if (resp.success) {
        const data = resp.data || {};
        setVisibilityOverview(data);
        if (data.settings) {
          setVisibilityConfig((prev) => ({ ...prev, ...data.settings }));
        }
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveVisibilityConfig = async () => {
    setSavingVisibilityConfig(true);
    try {
      const totalWeight =
        Number(visibilityConfig.subscription_weight) +
        Number(visibilityConfig.performance_weight) +
        Number(visibilityConfig.boost_weight) +
        Number(visibilityConfig.quality_weight) +
        Number(visibilityConfig.relevance_weight);

      if (Math.abs(totalWeight - 100) > 0.01) {
        toast.error(t('pDGProductsManagement.lesPoidsDeRankingDoivent'));
        return;
      }

      const resp = await updatePdgVisibilityConfig(visibilityConfig);
      if (!resp.success) {
        toast.error(resp.error || 'Échec de sauvegarde de la configuration visibilité');
        return;
      }

      toast.success(t('pDGProductsManagement.configurationVisibiliteMiseAJour'));
    } finally {
      setSavingVisibilityConfig(false);
    }
  };

  // Filtrer les produits
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    switch (filterType) {
      case 'orphan':
        return !product.vendor_is_active;
      case 'active':
        return product.is_active && product.vendor_is_active;
      case 'inactive':
        return !product.is_active;
      default:
        return true;
    }
  });

  const handleDelete = async (productId: string) => {
    await deleteProduct(productId);
    setShowDeleteConfirm(null);
  };

  const handleUpdate = async () => {
    if (!editingProduct) return;

    const success = await updateProduct(editingProduct.id, {
      name: editingProduct.name,
      description: editingProduct.description,
      price: parseFloat(editingProduct.price) || 0,
      sku: editingProduct.sku,
      is_active: editingProduct.is_active
    });

    if (success) {
      setEditingProduct(null);
    }
  };

  const getVendorDisplay = (product: any) => {
    if (!product.vendor_is_active) {
      return (
        <span className="flex items-center gap-1 text-[#ff4000]">
          <AlertCircle className="w-3 h-3" />
          {product.vendor_name} (Supprimée)
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-muted-foreground">
        <Store className="w-3 h-3" />
        {product.vendor_name}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">{t('pDGProductsManagement.gestionDesProduits')}</h2>
          <p className="text-muted-foreground mt-1">{t('pDGProductsManagement.administrationDesProduitsDeLa')}</p>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t('pDGProductsManagement.totalProduits')}</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('pDGProductsManagement.produitsEnregistres')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Actifs</CardTitle>
            <TrendingUp className="w-4 h-4 text-[#ff4000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ff4000]">
              {stats.active}
            </div>
            <p className="text-xs text-muted-foreground mt-1">en vente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inactifs</CardTitle>
            <TrendingDown className="w-4 h-4 text-[#ff4000]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#ff4000]">
              {stats.inactive}
            </div>
            <p className="text-xs text-muted-foreground mt-1">suspendus</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stock Total</CardTitle>
            <Box className="w-4 h-4 text-[#04439e]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#04439e]">
              {stats.totalStock.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('pDGProductsManagement.unitesEnStock')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stock Bas</CardTitle>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">
              {stats.lowStock}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('pDGProductsManagement.produitsConcernes')}</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Valeur Totale</CardTitle>
            <DollarSign className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {fc(stats.totalValue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">valeur catalogue</p>
          </CardContent>
        </Card>

        {stats.orphanProducts > 0 && (
          <Card className="border-2 border-[#ff4000]/20 bg-gradient-to-br from-[#ff4000]/5 to-[#ff4000]/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Orphelins</CardTitle>
              <AlertCircle className="w-4 h-4 text-[#ff4000]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff4000]">
                {stats.orphanProducts}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t('pDGProductsManagement.boutiquesSupprimees')}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle>{t('pDGProductsManagement.cockpitVisibiliteMarketplace')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">Boosts actifs</p>
              <p className="text-2xl font-bold">{Number(visibilityOverview?.activeBoostCount || 0)}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">Revenus boosts</p>
              <p className="text-2xl font-bold">{fc(Number(visibilityOverview?.totalBoostRevenue || 0))}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">Vendeurs boosteurs (top)</p>
              <p className="text-2xl font-bold">{Array.isArray(visibilityOverview?.topBoostVendors) ? visibilityOverview.topBoostVendors.length : 0}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">{t('pDGProductsManagement.plansConfigures')}</p>
              <p className="text-2xl font-bold">{Array.isArray(visibilityOverview?.planScores) ? visibilityOverview.planScores.length : 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <Label>Poids abonnement (%)</Label>
              <Input type="number" value={visibilityConfig.subscription_weight} onChange={(e) => setVisibilityConfig(prev => ({ ...prev, subscription_weight: Number(e.target.value || 0) }))} />
            </div>
            <div>
              <Label>Poids performance (%)</Label>
              <Input type="number" value={visibilityConfig.performance_weight} onChange={(e) => setVisibilityConfig(prev => ({ ...prev, performance_weight: Number(e.target.value || 0) }))} />
            </div>
            <div>
              <Label>Poids boost (%)</Label>
              <Input type="number" value={visibilityConfig.boost_weight} onChange={(e) => setVisibilityConfig(prev => ({ ...prev, boost_weight: Number(e.target.value || 0) }))} />
            </div>
            <div>
              <Label>{t('pDGProductsManagement.poidsQualite')}</Label>
              <Input type="number" value={visibilityConfig.quality_weight} onChange={(e) => setVisibilityConfig(prev => ({ ...prev, quality_weight: Number(e.target.value || 0) }))} />
            </div>
            <div>
              <Label>Poids pertinence (%)</Label>
              <Input type="number" value={visibilityConfig.relevance_weight} onChange={(e) => setVisibilityConfig(prev => ({ ...prev, relevance_weight: Number(e.target.value || 0) }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>{t('pDGProductsManagement.ratioSponsorise')}</Label>
              <Input type="number" value={visibilityConfig.sponsored_slots_ratio} onChange={(e) => setVisibilityConfig(prev => ({ ...prev, sponsored_slots_ratio: Number(e.target.value || 0) }))} />
            </div>
            <div>
              <Label>Ratio populaire (%)</Label>
              <Input type="number" value={visibilityConfig.popular_slots_ratio} onChange={(e) => setVisibilityConfig(prev => ({ ...prev, popular_slots_ratio: Number(e.target.value || 0) }))} />
            </div>
            <div>
              <Label>Ratio organique (%)</Label>
              <Input type="number" value={visibilityConfig.organic_slots_ratio} onChange={(e) => setVisibilityConfig(prev => ({ ...prev, organic_slots_ratio: Number(e.target.value || 0) }))} />
            </div>
            <div>
              <Label>{t('pDGProductsManagement.penaliteDiversiteVendeur')}</Label>
              <Input type="number" value={visibilityConfig.vendor_diversity_penalty} onChange={(e) => setVisibilityConfig(prev => ({ ...prev, vendor_diversity_penalty: Number(e.target.value || 0) }))} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveVisibilityConfig} disabled={savingVisibilityConfig}>
              {savingVisibilityConfig ? 'Sauvegarde...' : 'Sauvegarder la configuration visibilité'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recherche et Filtres */}
      <Card>
        <CardHeader>
          <CardTitle>{t('pDGProductsManagement.rechercherEtFiltrer')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('pDGProductsManagement.rechercherParNomSkuOu')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('all')}
              >
                Tous ({stats.total})
              </Button>
              <Button
                variant={filterType === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('active')}
              >
                Actifs ({stats.active})
              </Button>
              <Button
                variant={filterType === 'inactive' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterType('inactive')}
              >
                Inactifs ({stats.inactive})
              </Button>
              {stats.orphanProducts > 0 && (
                <Button
                  variant={filterType === 'orphan' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType('orphan')}
                  className={filterType !== 'orphan' ? 'border-[#ff4000] text-[#ff4000] hover:bg-orange-50' : ''}
                >
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Orphelins ({stats.orphanProducts})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des produits */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des Produits ({filteredProducts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className={`flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors ${
                  !product.vendor_is_active ? 'border-[#ff4000]/50 bg-orange-50/30 dark:bg-[#ff4000]/10' : ''
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                    ) : (
                      <Package className="w-10 h-10 text-primary" />
                    )}
                    {!product.vendor_is_active && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#ff4000] rounded-full flex items-center justify-center">
                        <AlertCircle className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{product.name}</h3>
                      {product.sku && (
                        <Badge variant="outline" className="text-xs">
                          {product.sku}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Prix: {fc(product.price)}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Box className="w-3 h-3" />
                          Stock: <span className="font-medium text-foreground">{product.total_stock || 0}</span> unités
                        </span>
                        {getVendorDisplay(product)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!product.vendor_is_active && (
                      <Badge variant="destructive" className="text-xs">
                        Boutique supprimée
                      </Badge>
                    )}
                    {product.is_active ? (
                      <Badge className="bg-[#ff4000]">Actif</Badge>
                    ) : (
                      <Badge className="bg-[#ff4000]">Inactif</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewProduct(product)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingProduct({ ...product })}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleProductStatus(product.id, product.is_active)}
                  >
                    <Ban className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(product.id)}
                  >
                    <Trash2 className="w-4 h-4 text-[#ff4000]" />
                  </Button>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t('pDGProductsManagement.aucunProduitTrouve')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog Détails Produit */}
      <Dialog open={!!viewProduct} onOpenChange={() => setViewProduct(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pDGProductsManagement.detailsDuProduit')}</DialogTitle>
          </DialogHeader>
          {viewProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Nom</Label>
                  <p className="font-medium">{viewProduct.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">SKU</Label>
                  <p className="font-medium">{viewProduct.sku || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Prix</Label>
                  <p className="font-medium">{fc(viewProduct.price)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('pDGProductsManagement.vendeur')}</Label>
                  <div className="font-medium">{getVendorDisplay(viewProduct)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('pDGProductsManagement.statutBoutique')}</Label>
                  <Badge className={viewProduct.vendor_is_active ? "bg-[#ff4000]" : "bg-[#ff4000]"}>
                    {viewProduct.vendor_is_active ? "Active" : "Supprimée"}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Statut</Label>
                  <Badge className={viewProduct.is_active ? "bg-[#ff4000]" : "bg-[#ff4000]"}>
                    {viewProduct.is_active ? "Actif" : "Inactif"}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('pDGProductsManagement.dateDeCreation')}</Label>
                  <p className="font-medium">
                    {new Date(viewProduct.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              {viewProduct.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1">{viewProduct.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Édition Produit */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('pDGProductsManagement.modifierLeProduit')}</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nom</Label>
                  <Input
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>SKU</Label>
                  <Input
                    value={editingProduct.sku || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Prix (GNF)</Label>
                  <Input
                    type="number"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={editingProduct.is_active}
                    onChange={(e) => setEditingProduct({ ...editingProduct, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">{t('pDGProductsManagement.produitActif')}</Label>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProduct(null)}>
              Annuler
            </Button>
            <Button onClick={handleUpdate}>
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmation Suppression */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('pDGProductsManagement.confirmerLaSuppression')}</DialogTitle>
          </DialogHeader>
          <p>{t('pDGProductsManagement.etesVousSurDeVouloir')}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
