import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatCurrency } from "@/hooks/useFormatCurrency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Package, AlertTriangle, TrendingDown, Warehouse, Search, Filter, Plus, Edit, History, TrendingUp, DollarSign, Trash2, Wifi, WifiOff, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from "@/hooks/use-toast";
import { useInventoryService } from "@/hooks/useInventoryService";
import InventoryAlerts from "./InventoryAlerts";
import InventoryHistory from "./InventoryHistory";
import WarehouseStockManagement from "./WarehouseStockManagement";
import offlinePOSManager from '@/lib/offlinePOSManager';
import { readSectionCache, writeSectionCache, isBrowserOffline } from '@/lib/offline/sectionCache';

interface InventoryItem {
  id: string;
  product_id: string;
  quantity: number;
  reserved_quantity: number;
  minimum_stock: number;
  warehouse_location?: string;
  lot_number?: string;
  expiry_date?: string;
  product: {
    name: string;
    price: number;
    sku?: string;
  };
}

interface Warehouse {
  id: string;
  name: string;
  address?: string;
  is_active: boolean;
}

export default function InventoryManagement() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const { _user } = useAuth();
  const { toast } = useToast();
  const {
    inventory,
    alerts,
    history,
    stats,
    loading,
    updateStock,
    markAlertAsRead,
    resolveAlert,
    refresh,
    vendorId,
  } = useInventoryService();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [products, setProducts] = useState<Array<{ id: string; name: string; sku?: string; price: number }>>([]);

  // États pour le mode offline
  const [isOnline, setIsOnline] = useState(offlinePOSManager.isOnline());

  const fetchWarehouses = useCallback(async () => {
    try {
      if (!vendorId) return;

      // 📴 Hors ligne : derniers entrepôts connus.
      if (isBrowserOffline()) {
        const cached = readSectionCache('inventory_warehouses', vendorId);
        if (cached) setWarehouses(cached);
        return;
      }

      const { data: warehousesData, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('vendor_id', vendorId);

      if (error) throw error;
      setWarehouses(warehousesData || []);
      writeSectionCache('inventory_warehouses', vendorId, warehousesData || []);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      const cached = readSectionCache('inventory_warehouses', vendorId);
      if (cached) setWarehouses(cached);
    }
  }, [vendorId]);

  const fetchProducts = useCallback(async () => {
    try {
      if (!vendorId) return;

      // 📴 Hors ligne : derniers produits connus (cache).
      if (isBrowserOffline()) {
        const cached = readSectionCache('inventory_products', vendorId);
        if (cached) setProducts(cached);
        return;
      }

      const { data: productsData, error } = await supabase
        .from('products')
        .select('id, name, sku, price')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      console.log('📦 Produits chargés dans InventoryManagement:', productsData?.length);
      setProducts(productsData || []);
      writeSectionCache('inventory_products', vendorId, productsData || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      const cached = readSectionCache('inventory_products', vendorId);
      if (cached) {
        setProducts(cached);
      } else {
        toast({ title: 'Erreur', description: t('inventoryManagement.impossibleDeChargerLesProduits'), variant: 'destructive' });
      }
    }
  }, [vendorId, toast]);

  useEffect(() => {
    if (!vendorId) return;

    console.log('🔄 Chargement initial InventoryManagement');
    fetchWarehouses();
    fetchProducts();
    refresh(); // Forcer le rechargement de l'inventaire
  }, [vendorId, fetchWarehouses, fetchProducts, refresh]);

  // Détection du statut réseau
  useEffect(() => {
    const cleanup = offlinePOSManager.onNetworkChange((online) => {
      setIsOnline(online);

      if (online) {
        toast({ title: t('inventoryManagement.connexionRetablie'), description: 'Inventaire en ligne' });
        // Recharger l'inventaire
        refresh();
      } else {
        toast({
          title: 'Mode hors ligne',
          description: 'Inventaire en lecture seule',
          variant: 'default'
        });
      }
    });

    return cleanup;
  }, [refresh, toast]);

  // Note: Rechargement automatique désactivé pour éviter les actualisations intempestives
  // L'utilisateur peut rafraîchir manuellement si nécessaire

  // Synchronisation produits gérée dans useInventoryService (centralisée)

  // Combiner les produits avec leur stock (même sans entrée inventory)
  const allProductsWithStock = products.map(product => {
    const inventoryItem = inventory.find(item => item.product_id === product.id);
    return {
      id: inventoryItem?.id || `product-${product.id}`,
      product_id: product.id,
      quantity: inventoryItem?.quantity || 0,
      reserved_quantity: inventoryItem?.reserved_quantity || 0,
      minimum_stock: inventoryItem?.minimum_stock || 10,
      warehouse_location: inventoryItem?.warehouse_location,
      lot_number: inventoryItem?.lot_number,
      expiry_date: inventoryItem?.expiry_date,
      product: {
        name: product.name,
        price: product.price || 0,
        sku: product.sku
      },
      hasInventoryRecord: !!inventoryItem
    };
  });

  const filteredInventory = allProductsWithStock.filter(item => {
    const matchesSearch = !searchTerm ||
      item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.lot_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = stockFilter === 'all' ||
      (stockFilter === 'low' && item.quantity <= item.minimum_stock && item.quantity > 0) ||
      (stockFilter === 'out' && item.quantity === 0);

    return matchesSearch && matchesFilter;
  });

  // Statistiques basées sur tous les produits (avec ou sans stock)
  const lowStockItems = allProductsWithStock.filter(item => item.quantity <= item.minimum_stock && item.quantity > 0);
  const outOfStockItems = allProductsWithStock.filter(item => item.quantity === 0);
  const totalProducts = products.length; // Total des produits du vendeur

  // Calcul intelligent de la valeur totale du stock
  const calculatedTotalValue = allProductsWithStock.reduce((acc, item) => {
    const price = item.product?.price || 0;
    const quantity = item.quantity || 0;
    return acc + (price * quantity);
  }, 0);

  const totalValue = calculatedTotalValue;
  const totalCost = stats?.total_cost || 0;
  const potentialProfit = stats?.potential_profit || (totalValue - totalCost);

  console.log('📊 Stats inventaire - Total produits:', totalProducts, 'Valeur totale:', totalValue, 'Stock faible:', lowStockItems.length, 'Rupture:', outOfStockItems.length);


  const [addOpen, setAddOpen] = useState(false);
  const [addQty, setAddQty] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const [newWarehouse, setNewWarehouse] = useState({
    country: '',
    city: '',
    name: '',
    address: '',
    manager_name: '',
    manager_phone: '',
    manager_email: ''
  });
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null);
  const [deletingWarehouse, setDeletingWarehouse] = useState<any>(null);
  const [restockOpen, setRestockOpen] = useState(false);
  const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
  const [restockQty, setRestockQty] = useState('');

  if (loading) return <div className="p-4">{t('inventoryManagement.chargementDeLInventaire')}</div>;

  const addStock = async () => {
    if (!selectedProductId) {
      toast({ title: t('inventoryManagement.selectionnezUnProduit'), variant: 'destructive' });
      return;
    }
    const qty = parseInt(addQty || '0', 10);
    if (qty <= 0) {
      toast({ title: t('inventoryManagement.quantiteInvalide'), variant: 'destructive' });
      return;
    }
    try {
      const inventoryItem = inventory.find(item => item.product_id === selectedProductId);
      if (inventoryItem) {
        // Mettre à jour le stock existant
        const newQty = inventoryItem.quantity + qty;
        await updateStock(inventoryItem.id, newQty);
      } else {
        // Créer une nouvelle entrée d'inventaire
        if (vendorId) {
          const { error } = await supabase
            .from('inventory')
            .insert([{
              product_id: selectedProductId,
              quantity: qty,
              minimum_stock: 10,
              reserved_quantity: 0
            }]);

          if (error) throw error;
          await refresh();
        }
      }
      setAddOpen(false);
      setAddQty('');
      setSelectedProductId('');
      toast({ title: t('inventoryManagement.stockAjouteAvecSucces') });
    } catch (e: any) {
      toast({ title: 'Erreur ajout stock', description: e?.message, variant: 'destructive' });
    }
  };

  const addWarehouse = async () => {
    // Validation des champs requis
    if (!newWarehouse.country.trim()) {
      toast({ title: 'Erreur', description: t('inventoryManagement.lePaysEstRequis'), variant: 'destructive' });
      return;
    }
    if (!newWarehouse.city.trim()) {
      toast({ title: 'Erreur', description: t('inventoryManagement.laVilleEstRequise'), variant: 'destructive' });
      return;
    }
    if (!newWarehouse.name.trim()) {
      toast({ title: 'Erreur', description: t('inventoryManagement.leNomDeLEntrepot'), variant: 'destructive' });
      return;
    }

    try {
      if (!vendorId) return;

      const { error } = await supabase
        .from('warehouses')
        .insert([{
          vendor_id: vendorId,
          country: newWarehouse.country.trim(),
          city: newWarehouse.city.trim(),
          name: newWarehouse.name.trim(),
          address: newWarehouse.address.trim(),
          manager_name: newWarehouse.manager_name.trim() || null,
          manager_phone: newWarehouse.manager_phone.trim() || null,
          manager_email: newWarehouse.manager_email.trim() || null,
          is_active: true
        }]);

      if (error) throw error;

      toast({ title: t('inventoryManagement.entrepotCreeAvecSucces') });
      setWarehouseOpen(false);
      setNewWarehouse({ country: '', city: '', name: '', address: '', manager_name: '', manager_phone: '', manager_email: '' });
      await fetchWarehouses();

      // Déclencher un événement pour synchroniser avec l'onglet Entrepôts
      window.dispatchEvent(new CustomEvent('warehouseUpdated'));
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    }
  };

  const toggleWarehouseStatus = async (warehouseId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('warehouses')
        .update({ is_active: !currentStatus })
        .eq('id', warehouseId);

      if (error) throw error;

      toast({ title: t('inventoryManagement.statutMisAJour') });
      await fetchWarehouses();

      // Déclencher un événement pour synchroniser avec l'onglet Entrepôts
      window.dispatchEvent(new CustomEvent('warehouseUpdated'));
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    }
  };

  const handleRestock = async () => {
    if (!restockItem) return;

    const qty = parseInt(restockQty || '0', 10);
    if (qty <= 0) {
      toast({ title: t('inventoryManagement.quantiteInvalide'), variant: 'destructive' });
      return;
    }

    try {
      const newQty = restockItem.quantity + qty;
      await updateStock(restockItem.id, newQty);
      setRestockOpen(false);
      setRestockItem(null);
      setRestockQty('');
      toast({ title: t('inventoryManagement.stockReapprovisionneAvecSucces') });
    } catch (e: any) {
      toast({ title: t('inventoryManagement.erreurReapprovisionnement'), description: e?.message, variant: 'destructive' });
    }
  };

  const handleUpdateWarehouse = async () => {
    if (!editingWarehouse) return;

    try {
      const { error } = await supabase
        .from('warehouses')
        .update({
          name: editingWarehouse.name,
          address: editingWarehouse.address,
          country: editingWarehouse.country,
          city: editingWarehouse.city,
          manager_name: editingWarehouse.manager_name || null,
          manager_phone: editingWarehouse.manager_phone || null,
          manager_email: editingWarehouse.manager_email || null
        })
        .eq('id', editingWarehouse.id);

      if (error) throw error;

      setEditingWarehouse(null);
      await fetchWarehouses();
      toast({ title: t('inventoryManagement.entrepotModifieAvecSucces') });

      // Déclencher un événement pour synchroniser avec l'onglet Entrepôts
      window.dispatchEvent(new CustomEvent('warehouseUpdated'));
    } catch (e: any) {
      toast({ title: 'Erreur modification', description: e?.message, variant: 'destructive' });
    }
  };

  const handleDeleteWarehouse = async () => {
    if (!deletingWarehouse) return;

    try {
      const { error } = await supabase
        .from('warehouses')
        .delete()
        .eq('id', deletingWarehouse.id);

      if (error) throw error;

      setDeletingWarehouse(null);
      await fetchWarehouses();
      toast({ title: t('inventoryManagement.entrepotSupprimeAvecSucces') });

      // Déclencher un événement pour synchroniser avec l'onglet Entrepôts
      window.dispatchEvent(new CustomEvent('warehouseUpdated'));
    } catch (e: any) {
      toast({ title: 'Erreur suppression', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 px-2 md:px-0">
      {/* Header mobile optimisé */}
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg md:text-2xl font-bold truncate">{t('inventoryManagement.gestionDesStocks')}</h2>
              <p className="text-xs md:text-sm text-muted-foreground truncate">{t('inventoryManagement.inventaireSynchroniseEnTempsReel')}</p>
            </div>

            {/* Indicateur de statut réseau */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${
              isOnline
                ? 'bg-orange-50 border-orange-200 dark:bg-[#ff4000] dark:border-[#ff4000]'
                : 'bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800'
            }`}>
              {isOnline ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-[#ff4000] dark:text-[#ff4000]" />
                  <span className="font-medium text-[#ff4000] dark:text-orange-300 hidden md:inline">
                    En ligne
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                  <span className="font-medium text-orange-700 dark:text-orange-300 hidden md:inline">
                    Lecture seule
                  </span>
                  <Eye className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="flex-shrink-0 h-9 px-3 text-xs md:text-sm"
                disabled={!isOnline}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden sm:inline">{t('inventoryManagement.ajouter')}</span> stock
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] md:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('inventoryManagement.ajouterDuStock')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">{t('inventoryManagement.produit')}</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-background text-sm"
                  >
                    <option value="">{t('inventoryManagement.selectionnerUnProduit')}</option>
                    {products.map((product) => {
                      const inventoryItem = inventory.find(item => item.product_id === product.id);
                      return (
                        <option key={product.id} value={product.id}>
                          {product.name} {product.sku ? `(${product.sku})` : ''} - Stock: {inventoryItem?.quantity || 0}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">{t('inventoryManagement.quantiteAAjouter')}</label>
                  <Input
                    type="number"
                    placeholder={t('inventoryManagement.quantite')}
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                    min="1"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setAddOpen(false)}>{t('inventoryManagement.annuler')}</Button>
                  <Button onClick={addStock}>{t('inventoryManagement.ajouter')}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={warehouseOpen} onOpenChange={setWarehouseOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-shrink-0 h-9 px-3 text-xs md:text-sm">
                <Warehouse className="w-3.5 h-3.5 mr-1.5" />
                Entrepôts
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('inventoryManagement.gestionDesEntrepots')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-3">
                  <h3 className="font-medium">{t('inventoryManagement.ajouterUnEntrepot')}</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <Input
                      placeholder="Pays *"
                      value={newWarehouse.country}
                      onChange={(e) => setNewWarehouse({ ...newWarehouse, country: e.target.value })}
                      maxLength={100}
                      required
                    />
                    <Input
                      placeholder="Ville *"
                      value={newWarehouse.city}
                      onChange={(e) => setNewWarehouse({ ...newWarehouse, city: e.target.value })}
                      maxLength={100}
                      required
                    />
                    <Input
                      placeholder={t('inventoryManagement.nomDeLEntrepot')}
                      value={newWarehouse.name}
                      onChange={(e) => setNewWarehouse({ ...newWarehouse, name: e.target.value })}
                      maxLength={100}
                      required
                    />
                    <Input
                      placeholder="Adresse"
                      value={newWarehouse.address}
                      onChange={(e) => setNewWarehouse({ ...newWarehouse, address: e.target.value })}
                      maxLength={255}
                    />
                    <Input
                      placeholder={t('inventoryManagement.nomDuResponsable')}
                      value={newWarehouse.manager_name}
                      onChange={(e) => setNewWarehouse({ ...newWarehouse, manager_name: e.target.value })}
                      maxLength={100}
                    />
                    <Input
                      placeholder={t('inventoryManagement.telephoneDuResponsable')}
                      value={newWarehouse.manager_phone}
                      onChange={(e) => setNewWarehouse({ ...newWarehouse, manager_phone: e.target.value })}
                      maxLength={20}
                    />
                    <Input
                      placeholder={t('inventoryManagement.emailDuResponsable')}
                      type="email"
                      value={newWarehouse.manager_email}
                      onChange={(e) => setNewWarehouse({ ...newWarehouse, manager_email: e.target.value })}
                      maxLength={100}
                    />
                  </div>
                  <Button onClick={addWarehouse} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Créer l'entrepôt
                  </Button>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium mb-3">Entrepôts existants ({warehouses.length})</h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                     {warehouses.map((warehouse) => (
                      <div key={warehouse.id} className="space-y-2 p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium">{warehouse.name}</h4>
                              <Badge variant={warehouse.is_active ? "default" : "secondary"}>
                                {warehouse.is_active ? "Actif" : "Inactif"}
                              </Badge>
                            </div>
                            {(warehouse as any).city && (warehouse as any).country && (
                              <p className="text-sm text-muted-foreground">
                                {(warehouse as any).city}, {(warehouse as any).country}
                              </p>
                            )}
                            {warehouse.address && (
                              <p className="text-sm text-muted-foreground">{warehouse.address}</p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingWarehouse(warehouse)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDeletingWarehouse(warehouse)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleWarehouseStatus(warehouse.id, warehouse.is_active)}
                            >
                              {warehouse.is_active ? 'Désactiver' : 'Activer'}
                            </Button>
                          </div>
                        </div>
                        {((warehouse as any).manager_name || (warehouse as any).manager_phone || (warehouse as any).manager_email) && (
                          <div className="border-t pt-2 mt-2">
                            <p className="text-sm font-medium mb-1">Responsable:</p>
                            {(warehouse as any).manager_name && (
                              <p className="text-sm text-muted-foreground">• {(warehouse as any).manager_name}</p>
                            )}
                            {(warehouse as any).manager_phone && (
                              <p className="text-sm text-muted-foreground">• {(warehouse as any).manager_phone}</p>
                            )}
                            {(warehouse as any).manager_email && (
                              <p className="text-sm text-muted-foreground">• {(warehouse as any).manager_email}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {warehouses.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        Aucun entrepôt configuré
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dialog Réapprovisionnement */}
      <Dialog open={restockOpen} onOpenChange={setRestockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('inventoryManagement.reapprovisionnerLeStock')}</DialogTitle>
          </DialogHeader>
          {restockItem && (
            <div className="space-y-4">
              <div className="p-4 bg-accent/50 rounded-lg">
                <h4 className="font-medium mb-2">{restockItem.product.name}</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Stock actuel</p>
                    <p className="font-medium">{restockItem.quantity}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Seuil minimum</p>
                    <p className="font-medium">{restockItem.minimum_stock}</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">{t('inventoryManagement.quantiteAAjouter')}</label>
                <Input
                  type="number"
                  placeholder={t('inventoryManagement.quantite')}
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  min="1"
                />
                {restockQty && parseInt(restockQty) > 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Nouveau stock: {restockItem.quantity + parseInt(restockQty)} unités
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setRestockOpen(false);
                  setRestockItem(null);
                  setRestockQty('');
                }}>
                  Annuler
                </Button>
                <Button onClick={handleRestock}>Confirmer</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Statistiques - Mobile optimisé en grille 2x2 puis 3 colonnes */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 md:w-5 md:h-5 text-blue-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] md:text-sm text-muted-foreground truncate">{t('inventoryManagement.produits')}</p>
                <p className="text-lg md:text-2xl font-bold">{totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-orange-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] md:text-sm text-muted-foreground truncate">Stock faible</p>
                <p className="text-lg md:text-2xl font-bold text-orange-600">{lowStockItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-[#ff4000] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] md:text-sm text-muted-foreground truncate">Rupture</p>
                <p className="text-lg md:text-2xl font-bold text-[#ff4000]">{outOfStockItems.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-[#ff4000] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] md:text-sm text-muted-foreground truncate">Valeur Stock</p>
                <p className="text-sm md:text-xl font-bold truncate text-[#ff4000]">{fc(totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-3 md:p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-[#04439e] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] md:text-sm text-muted-foreground truncate">Profit potentiel</p>
                <p className="text-sm md:text-xl font-bold truncate">{fc(potentialProfit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs - Mobile avec scroll horizontal */}
      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="w-full overflow-x-auto flex md:grid md:grid-cols-4 scrollbar-hide">
          <TabsTrigger value="inventory" className="flex-shrink-0 text-xs md:text-sm px-2 md:px-4">
            <Package className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Inventaire</span>
            <span className="sm:hidden">Stock</span>
          </TabsTrigger>
          <TabsTrigger value="warehouse" className="flex-shrink-0 text-xs md:text-sm px-2 md:px-4">
            <Warehouse className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1 md:mr-2" />
            Entrepôts
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex-shrink-0 text-xs md:text-sm px-2 md:px-4">
            <AlertTriangle className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1 md:mr-2" />
            Alertes <span className="ml-1">({alerts.length})</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-shrink-0 text-xs md:text-sm px-2 md:px-4">
            <History className="w-3.5 h-3.5 md:w-4 md:h-4 mr-1 md:mr-2" />
            <span className="hidden sm:inline">Historique</span>
            <span className="sm:hidden">Hist.</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          {/* Filtres - Mobile optimisé */}
          <Card>
            <CardContent className="p-3 md:p-4">
              <div className="flex flex-col gap-2 md:flex-row md:gap-4 md:items-center">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('inventoryManagement.rechercher')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9 text-sm"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value as "all" | "low" | "out")}
                    className="px-2 py-1.5 border rounded-md text-sm flex-1 md:flex-none h-9"
                  >
                    <option value="all">{t('inventoryManagement.tous')}</option>
                    <option value="low">Stock faible</option>
                    <option value="out">Rupture</option>
                  </select>
                  <Filter className="w-4 h-4 text-muted-foreground hidden md:block" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Liste d'inventaire */}
          <Card>
        <CardHeader>
          <CardTitle>{t('inventoryManagement.inventaireDetaille')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredInventory.map((item) => {
              const availableStock = item.quantity - item.reserved_quantity;
              const stockPercentage = item.minimum_stock > 0
                ? (item.quantity / item.minimum_stock) * 100
                : 100;

              return (
                <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{item.product.name}</h4>
                      {item.product.sku && (
                        <Badge variant="outline">{item.product.sku}</Badge>
                      )}
                      {item.quantity === 0 && (
                        <Badge variant="destructive">Rupture</Badge>
                      )}
                      {item.quantity <= item.minimum_stock && item.quantity > 0 && (
                        <Badge className="bg-orange-100 text-orange-800">Stock faible</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Stock total</p>
                        <p className="font-medium">{item.quantity}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Disponible</p>
                        <p className="font-medium">{availableStock}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t('inventoryManagement.reserve')}</p>
                        <p className="font-medium">{item.reserved_quantity}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Seuil minimum</p>
                        <p className="font-medium">{item.minimum_stock}</p>
                      </div>
                    </div>

                    {item.lot_number && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Lot: {item.lot_number}
                        {item.expiry_date && ` • Expire le: ${new Date(item.expiry_date).toLocaleDateString('fr-FR')}`}
                      </p>
                    )}

                    {item.warehouse_location && (
                      <p className="text-xs text-muted-foreground">
                        Emplacement: {item.warehouse_location}
                      </p>
                    )}

                    <div className="mt-2">
                      <Progress
                        value={Math.min(stockPercentage, 100)}
                        className={`h-2 ${stockPercentage <= 100 ? 'bg-orange-100' : 'bg-orange-100'}`}
                      />
                    </div>
                  </div>

                  <div className="text-right ml-6">
                    <p className="font-semibold text-lg">
                      {fc(item.quantity * item.product.price)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {fc(item.product.price)}/unité
                    </p>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button size="sm" variant="outline">
                      <Edit className="w-4 h-4" />
                    </Button>
                    {item.quantity <= item.minimum_stock && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setRestockItem(item);
                          setRestockOpen(true);
                        }}
                      >
                        Réapprovisionner
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredInventory.length === 0 && (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('inventoryManagement.aucunProduitTrouve')}</h3>
              <p className="text-muted-foreground">
                {searchTerm || stockFilter !== 'all'
                  ? 'Aucun produit ne correspond aux critères de recherche.'
                  : 'Votre inventaire est vide. Commencez par ajouter des produits.'}
              </p>
            </div>
          )}
        </CardContent>
          </Card>

          {/* Entrepôts */}
      {warehouses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="w-5 h-5" />
              Entrepôts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {warehouses.map((warehouse) => (
                <div key={warehouse.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{warehouse.name}</h4>
                    <Badge variant={warehouse.is_active ? "default" : "secondary"}>
                      {warehouse.is_active ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                  {warehouse.address && (
                    <p className="text-sm text-muted-foreground">{warehouse.address}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="warehouse">
          <WarehouseStockManagement />
        </TabsContent>

        <TabsContent value="alerts">
          <InventoryAlerts
            alerts={alerts}
            onMarkAsRead={markAlertAsRead}
            onResolve={resolveAlert}
          />
        </TabsContent>

        <TabsContent value="history">
          <InventoryHistory history={history} />
        </TabsContent>
      </Tabs>

      {/* Edit Warehouse Dialog */}
      <Dialog open={!!editingWarehouse} onOpenChange={() => setEditingWarehouse(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('inventoryManagement.modifierLEntrepot')}</DialogTitle>
          </DialogHeader>
          {editingWarehouse && (
            <div className="space-y-4">
              <Input
                placeholder="Pays *"
                value={(editingWarehouse as any).country || ""}
                onChange={(e) => setEditingWarehouse({ ...editingWarehouse, country: e.target.value })}
                maxLength={100}
              />
              <Input
                placeholder="Ville *"
                value={(editingWarehouse as any).city || ""}
                onChange={(e) => setEditingWarehouse({ ...editingWarehouse, city: e.target.value })}
                maxLength={100}
              />
              <Input
                placeholder={t('inventoryManagement.nomDeLEntrepot')}
                value={editingWarehouse.name || ""}
                onChange={(e) => setEditingWarehouse({ ...editingWarehouse, name: e.target.value })}
                maxLength={100}
              />
              <Input
                placeholder="Adresse"
                value={editingWarehouse.address || ""}
                onChange={(e) => setEditingWarehouse({ ...editingWarehouse, address: e.target.value })}
                maxLength={255}
              />
              <Input
                placeholder={t('inventoryManagement.nomDuResponsable')}
                value={(editingWarehouse as any).manager_name || ""}
                onChange={(e) => setEditingWarehouse({ ...editingWarehouse, manager_name: e.target.value })}
                maxLength={100}
              />
              <Input
                placeholder={t('inventoryManagement.telephoneDuResponsable')}
                value={(editingWarehouse as any).manager_phone || ""}
                onChange={(e) => setEditingWarehouse({ ...editingWarehouse, manager_phone: e.target.value })}
                maxLength={20}
              />
              <Input
                placeholder={t('inventoryManagement.emailDuResponsable')}
                type="email"
                value={(editingWarehouse as any).manager_email || ""}
                onChange={(e) => setEditingWarehouse({ ...editingWarehouse, manager_email: e.target.value })}
                maxLength={100}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingWarehouse(null)}>
                  Annuler
                </Button>
                <Button onClick={handleUpdateWarehouse}>
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Warehouse Dialog */}
      <Dialog open={!!deletingWarehouse} onOpenChange={() => setDeletingWarehouse(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('inventoryManagement.supprimerLEntrepot')}</DialogTitle>
          </DialogHeader>
          {deletingWarehouse && (
            <div className="space-y-4">
              <p>{t('inventoryManagement.etesVousSurDeVouloir')} <strong>{deletingWarehouse.name}</strong> ?</p>
              <p className="text-sm text-muted-foreground">{t('inventoryManagement.cetteActionEstIrreversible')}</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDeletingWarehouse(null)}>
                  Annuler
                </Button>
                <Button variant="destructive" onClick={handleDeleteWarehouse}>
                  Supprimer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}