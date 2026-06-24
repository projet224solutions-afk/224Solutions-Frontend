/**
 * Composant de création de transfert de stock
 * 224SOLUTIONS - Sélection avancée des produits
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { _Table, _TableBody, _TableCell, _TableHead, _TableHeader, _TableRow } from '@/components/ui/table';
import { _Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Warehouse,
  Store,
  ArrowRightLeft,
  Package,
  Search,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  ChevronRight,
  Check,
  ArrowRight
} from 'lucide-react';
import { useMultiWarehouse, LocationStock } from '@/hooks/useMultiWarehouse';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  buildDestinationSummary,
  computeTotalUnits,
  normalizeStockUnits,
  splitTotalUnits,
} from '@/lib/inventory/multiWarehouseUtils';

interface TransferItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  product_image?: string;
  available_quantity: number;
  available_cartons: number;
  available_units_loose: number;
  units_per_carton: number;
  quantity_cartons: number;
  quantity_units: number;
  total_units: number;
  shop_product_id?: string | null;
  shop_product_name?: string | null;
}

interface TransferCreatorProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function TransferCreator({ onSuccess, onCancel }: TransferCreatorProps) {
  const { t } = useTranslation();
  const {
    locations,
    posLocations,
    _productMappings,
    getLocationStock,
    getShopProductMappingForItem,
    createAdvancedTransfer,
  } = useMultiWarehouse();

  const { toast } = useToast();

  // Étapes du wizard
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  // Sélection des lieux
  const [fromLocationId, setFromLocationId] = useState<string>('');
  const [toLocationId, setToLocationId] = useState<string>('');
  const [destinationType, setDestinationType] = useState<'warehouse' | 'shop' | 'client'>('warehouse');
  const [clientInfo, setClientInfo] = useState({
    name: '',
    phone: '',
    address: '',
  });

  // Stock source et items à transférer
  const [sourceStock, setSourceStock] = useState<LocationStock[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [transferItems, setTransferItems] = useState<TransferItem[]>([]);

  // Notes
  const [notes, setNotes] = useState('');

  // Soumission
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lieux disponibles pour la source
  const sourceLocations = useMemo(() =>
    locations.filter(l => !l.is_pos_enabled && l.location_type !== 'shop' && l.id !== toLocationId),
    [locations, toLocationId]
  );

  // Lieux disponibles pour la destination
  const destinationLocations = useMemo(() => {
    if (destinationType === 'shop') {
      return posLocations.filter(l => l.id !== fromLocationId);
    }

    if (destinationType === 'warehouse') {
      return locations.filter(l => !l.is_pos_enabled && l.location_type !== 'shop' && l.id !== fromLocationId);
    }

    return [];
  }, [destinationType, locations, posLocations, fromLocationId]);

  // Lieu source sélectionné
  const fromLocation = useMemo(() =>
    locations.find(l => l.id === fromLocationId),
    [locations, fromLocationId]
  );

  // Lieu destination sélectionné
  const toLocation = useMemo(() =>
    locations.find(l => l.id === toLocationId),
    [locations, toLocationId]
  );

  // Charger le stock quand on sélectionne un lieu source
  useEffect(() => {
    if (fromLocationId) {
      loadSourceStock();
    } else {
      setSourceStock([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromLocationId]);

  useEffect(() => {
    setTransferItems((prev) => prev.map((item) => {
      if (destinationType !== 'shop') {
        return {
          ...item,
          shop_product_id: undefined,
          shop_product_name: undefined,
        };
      }

      const mapping = getShopProductMappingForItem(item.product_id, toLocationId);
      return {
        ...item,
        shop_product_id: mapping?.shop_product_id || item.product_id,
        shop_product_name: mapping?.shop_product?.name || item.product_name,
      };
    }));
  }, [destinationType, toLocationId, getShopProductMappingForItem]);

  const loadSourceStock = async () => {
    setLoadingStock(true);
    try {
      const stock = await getLocationStock(fromLocationId);
      setSourceStock(stock.filter(s => {
        const normalized = normalizeStockUnits(s);
        return (s.available_quantity ?? normalized.availableUnits) > 0;
      }));
    } finally {
      setLoadingStock(false);
    }
  };

  // Filtrer le stock par recherche
  const filteredStock = useMemo(() => {
    if (!searchQuery.trim()) return sourceStock;
    const q = searchQuery.toLowerCase();
    return sourceStock.filter(s =>
      s.product?.name?.toLowerCase().includes(q) ||
      s.product?.sku?.toLowerCase().includes(q)
    );
  }, [sourceStock, searchQuery]);

  // Ajouter un produit au transfert
  const addToTransfer = (stock: LocationStock) => {
    const normalized = normalizeStockUnits(stock);
    const existing = transferItems.find(i => i.product_id === stock.product_id);
    const mapping = destinationType === 'shop' ? getShopProductMappingForItem(stock.product_id, toLocationId) : null;
    const _defaultShopProductId = mapping?.shop_product_id || (destinationType === 'shop' ? stock.product_id : null);
    const _defaultShopProductName = mapping?.shop_product?.name || (destinationType === 'shop' ? stock.product?.name || 'Produit boutique lié' : null);

    if (existing) {
      updateBreakdown(stock.product_id, {
        quantity_units: existing.quantity_units + 1,
      });
    } else {
      setTransferItems(prev => [...prev, {
        product_id: stock.product_id,
        product_name: stock.product?.name || 'Produit',
        product_sku: stock.product?.sku || '',
        product_image: stock.product?.images?.[0],
        available_quantity: stock.available_quantity ?? normalized.availableUnits,
        available_cartons: normalized.qtyCartonsClosed,
        available_units_loose: normalized.qtyUnitsLoose,
        units_per_carton: stock.units_per_carton || normalized.unitsPerCarton || 1,
        quantity_cartons: 0,
        quantity_units: 1,
        total_units: 1,
        shop_product_id: mapping?.shop_product_id || null,
        shop_product_name: mapping?.shop_product?.name || null,
      }]);
    }
  };

  // Mettre à jour la quantité d'un item en cartons + unités
  const updateBreakdown = (
    productId: string,
    updates: Partial<Pick<TransferItem, 'quantity_cartons' | 'quantity_units' | 'shop_product_id'>>,
  ) => {
    setTransferItems(prev => prev.map(item => {
      if (item.product_id !== productId) return item;

      const nextCartons = Math.max(0, Number(updates.quantity_cartons ?? item.quantity_cartons ?? 0));
      const nextUnits = Math.max(0, Number(updates.quantity_units ?? item.quantity_units ?? 0));
      const proposedTotal = computeTotalUnits({
        unitsPerCarton: item.units_per_carton,
        quantityCartons: nextCartons,
        quantityUnits: nextUnits,
      });

      const clampedTotal = Math.min(item.available_quantity, proposedTotal);
      const normalizedBreakdown = splitTotalUnits(clampedTotal, item.units_per_carton);

      return {
        ...item,
        quantity_cartons: normalizedBreakdown.qtyCartonsClosed,
        quantity_units: normalizedBreakdown.qtyUnitsLoose,
        total_units: clampedTotal,
        shop_product_id: updates.shop_product_id ?? item.shop_product_id ?? null,
      };
    }).filter(item => item.total_units > 0));
  };

  // Supprimer un item
  const removeItem = (productId: string) => {
    setTransferItems(prev => prev.filter(i => i.product_id !== productId));
  };

  // Vérifier si un produit est déjà dans le transfert
  const isInTransfer = (productId: string) =>
    transferItems.some(i => i.product_id === productId);

  // Total des items
  const totalItems = transferItems.reduce((sum, i) => sum + i.total_units, 0);

  const hasMissingShopMapping = destinationType === 'shop' && transferItems.some(item => !item.shop_product_id);
  const destinationSummary = buildDestinationSummary(destinationType, {
    locationName: toLocation?.name,
    clientName: clientInfo.name,
    clientPhone: clientInfo.phone,
    clientAddress: clientInfo.address,
  });

  // Soumettre le transfert
  const handleSubmit = async () => {
    const clientTargetMissing = destinationType === 'client' && !clientInfo.name.trim() && !clientInfo.phone.trim();

    if (!fromLocationId || transferItems.length === 0 || clientTargetMissing || (destinationType !== 'client' && !toLocationId)) {
      toast({
        title: 'Erreur',
        description: t('transferCreator.veuillezRenseignerLaSourceLa'),
        variant: 'destructive'
      });
      return;
    }

    if (hasMissingShopMapping) {
      toast({
        title: t('transferCreator.liaisonBoutiqueManquante'),
        description: t('transferCreator.chaqueProduitDoitEtreLie'),
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createAdvancedTransfer({
        source_location_id: fromLocationId,
        destination_type: destinationType,
        destination_location_id: destinationType === 'client' ? null : toLocationId,
        destination_shop_id: destinationType === 'shop' ? toLocationId : null,
        destination_client_info: destinationType === 'client' ? clientInfo : null,
        items: transferItems.map(i => ({
          product_id: i.product_id,
          quantity_cartons: i.quantity_cartons,
          quantity_units: i.quantity_units,
          units_per_carton: i.units_per_carton,
          shop_product_id: i.shop_product_id || null,
        })),
        notes,
      });

      if (result) {
        onSuccess?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Peut-on passer à l'étape suivante ?
  const canProceed = () => {
    if (step === 1) {
      if (!fromLocationId) return false;
      if (destinationType === 'client') {
        return Boolean(clientInfo.name.trim() || clientInfo.phone.trim());
      }
      return Boolean(toLocationId);
    }

    if (step === 2) {
      return transferItems.length > 0 && !hasMissingShopMapping;
    }

    return true;
  };

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Étape {step} sur {totalSteps}</span>
          <span className="font-medium">
            {step === 1 && 'Sélection des lieux'}
            {step === 2 && 'Choix des produits'}
            {step === 3 && 'Confirmation'}
          </span>
        </div>
        <Progress value={(step / totalSteps) * 100} className="h-2" />
      </div>

      {/* Étape 1: Sélection des lieux */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('transferCreator.selectionnezLesSitesLogistiques')}</CardTitle>
            <CardDescription>
              Choisissez l’entrepôt source puis la destination : client final ou autre entrepôt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Lieu source */}
              <div className="space-y-3">
                  <Label className="text-base font-semibold">{t('transferCreator.entrepotSource')}</Label>
                <Select value={fromLocationId} onValueChange={setFromLocationId}>
                  <SelectTrigger className="h-14">
                    <SelectValue placeholder={t('transferCreator.dOuTransferer')} />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceLocations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-1.5 rounded",
                            loc.is_pos_enabled ? "bg-orange-100" : "bg-blue-100"
                          )}>
                            {loc.is_pos_enabled ? (
                              <Store className="w-4 h-4 text-[#ff4000]" />
                            ) : (
                              <Warehouse className="w-4 h-4 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{loc.name}</p>
                            {loc.code && (
                              <p className="text-xs text-muted-foreground">{loc.code}</p>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {fromLocation && (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          fromLocation.is_pos_enabled ? "bg-orange-100" : "bg-blue-100"
                        )}>
                          {fromLocation.is_pos_enabled ? (
                            <Store className="w-5 h-5 text-[#ff4000]" />
                          ) : (
                            <Warehouse className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{fromLocation.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {fromLocation.city || fromLocation.address || 'Adresse non définie'}
                          </p>
                          <p className="text-xs text-blue-700 mt-1">Stock logistique / approvisionnement</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                        <div className="p-2 bg-background rounded">
                          <p className="text-lg font-bold">{fromLocation.stats?.total_products || 0}</p>
                          <p className="text-xs text-muted-foreground">{t('transferCreator.produits')}</p>
                        </div>
                        <div className="p-2 bg-background rounded">
                          <p className="text-lg font-bold">{fromLocation.stats?.total_quantity || 0}</p>
                          <p className="text-xs text-muted-foreground">{t('transferCreator.unites')}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Flèche */}
              <div className="hidden md:flex items-center justify-center">
                <div className="p-4 rounded-full bg-muted">
                  <ArrowRight className="w-8 h-8 text-muted-foreground" />
                </div>
              </div>

              {/* Lieu destination */}
              <div className="space-y-3 md:-mt-16">
                <Label className="text-base font-semibold">{t('transferCreator.destinationOperationnelle')}</Label>

                <div className="space-y-2">
                  <Label>{t('transferCreator.typeDeDestination')}</Label>
                  <Select value={destinationType} onValueChange={(value: 'warehouse' | 'shop' | 'client') => {
                    setDestinationType(value);
                    setToLocationId('');
                  }}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder={t('transferCreator.choisirUnType')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warehouse">{t('transferCreator.autreEntrepot')}</SelectItem>
                      <SelectItem value="client">{t('transferCreator.clientFinal')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {destinationType !== 'client' ? (
                  <>
                    <Select value={toLocationId} onValueChange={setToLocationId}>
                      <SelectTrigger className="h-14">
                        <SelectValue placeholder={t('transferCreator.versQuelEntrepot')} />
                      </SelectTrigger>
                      <SelectContent>
                        {destinationLocations.map(loc => (
                          <SelectItem key={loc.id} value={loc.id}>
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "p-1.5 rounded",
                                loc.is_pos_enabled ? "bg-orange-100" : "bg-blue-100"
                              )}>
                                {loc.is_pos_enabled ? (
                                  <Store className="w-4 h-4 text-[#ff4000]" />
                                ) : (
                                  <Warehouse className="w-4 h-4 text-blue-600" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{loc.name}</p>
                                {loc.code && (
                                  <p className="text-xs text-muted-foreground">{loc.code}</p>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {toLocation && (
                      <Card className="bg-muted/50">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-lg",
                              toLocation.is_pos_enabled ? "bg-orange-100" : "bg-blue-100"
                            )}>
                              {toLocation.is_pos_enabled ? (
                                <Store className="w-5 h-5 text-[#ff4000]" />
                              ) : (
                                <Warehouse className="w-5 h-5 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold">{toLocation.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {toLocation.city || toLocation.address || 'Adresse non définie'}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <Card className="bg-muted/50">
                    <CardContent className="pt-4 space-y-3">
                      <div>
                        <Label>{t('transferCreator.nomDuClient')}</Label>
                        <Input
                          placeholder="Ex: Mamadou Diallo"
                          value={clientInfo.name}
                          onChange={(e) => setClientInfo((prev) => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>{t('transferCreator.telephone')}</Label>
                        <Input
                          placeholder="+224 ..."
                          value={clientInfo.phone}
                          onChange={(e) => setClientInfo((prev) => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Adresse</Label>
                        <Textarea
                          placeholder={t('transferCreator.adresseDeLivraisonOuRetrait')}
                          value={clientInfo.address}
                          onChange={(e) => setClientInfo((prev) => ({ ...prev, address: e.target.value }))}
                          rows={2}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Étape 2: Sélection des produits */}
      {step === 2 && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Stock disponible */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Stock disponible</CardTitle>
              <CardDescription>
                {fromLocation?.name} - {sourceStock.length} produit(s)
              </CardDescription>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('transferCreator.rechercherUnProduit')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loadingStock ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredStock.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>{t('transferCreator.aucunStockDisponible')}</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {filteredStock.map(stock => {
                      const inTransfer = isInTransfer(stock.product_id);
                      const _item = transferItems.find(i => i.product_id === stock.product_id);
                      const normalizedStock = normalizeStockUnits(stock);
                      const mappedShopProduct = destinationType === 'shop'
                        ? getShopProductMappingForItem(stock.product_id, toLocationId)
                        : null;

                      return (
                        <div
                          key={stock.id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                            inTransfer
                              ? "bg-primary/5 border-primary/30"
                              : "hover:bg-muted/50"
                          )}
                          onClick={() => addToTransfer(stock)}
                        >
                          {/* Image */}
                          <div className="w-12 h-12 rounded bg-muted overflow-hidden shrink-0">
                            {stock.product?.images?.[0] ? (
                              <img
                                src={stock.product.images[0]}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{stock.product?.name}</p>
                            {stock.product?.sku && (
                              <p className="text-xs text-muted-foreground font-mono">
                                {stock.product.sku}
                              </p>
                            )}
                            {destinationType === 'shop' && (
                              <p className={cn(
                                'text-[11px] mt-1 font-medium',
                                mappedShopProduct ? 'text-[#ff4000]' : 'text-[#ff4000]'
                              )}>
                                {mappedShopProduct ? `Liaison boutique: ${mappedShopProduct.shop_product?.name || 'OK'}` : 'Liaison auto: même produit boutique'}
                              </p>
                            )}
                          </div>

                          {/* Quantité disponible */}
                          <div className="text-right shrink-0">
                            <p className="font-bold">{stock.available_quantity ?? normalizedStock.availableUnits}</p>
                            <p className="text-xs text-muted-foreground">
                              {normalizedStock.unitsPerCarton > 1
                                ? `${normalizedStock.qtyCartonsClosed} ctn + ${normalizedStock.qtyUnitsLoose} u`
                                : 'unités dispo.'}
                            </p>
                          </div>

                          {/* Bouton ou check */}
                          <div className="shrink-0">
                            {inTransfer ? (
                              <div className="p-2 rounded-full bg-primary text-primary-foreground">
                                <Check className="w-4 h-4" />
                              </div>
                            ) : (
                              <Button size="icon" variant="ghost">
                                <Plus className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Panier de transfert */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{t('transferCreator.aTransferer')}</CardTitle>
                  <CardDescription>
                    {transferItems.length} produit(s) • {totalItems} unité(s)
                  </CardDescription>
                </div>
                {transferItems.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTransferItems([])}
                  >
                    Vider
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {transferItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ArrowRightLeft className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>{t('transferCreator.cliquezSurLesProduitsA')}</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {transferItems.map(item => (
                      <div
                        key={item.product_id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        {/* Image */}
                        <div className="w-10 h-10 rounded bg-background overflow-hidden shrink-0">
                          {item.product_image ? (
                            <img
                              src={item.product_image}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{item.product_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Max: {item.available_quantity}
                          </p>
                        </div>

                        {/* Contrôles de quantité */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 shrink-0 min-w-[190px]">
                          {item.units_per_carton > 1 && (
                            <div>
                              <Label className="text-[11px] text-muted-foreground">Cartons</Label>
                              <Input
                                type="number"
                                min={0}
                                max={item.available_cartons}
                                value={item.quantity_cartons}
                                onChange={(e) => updateBreakdown(item.product_id, { quantity_cartons: Number(e.target.value || 0) })}
                                className="h-8 text-center"
                              />
                            </div>
                          )}
                          <div>
                            <Label className="text-[11px] text-muted-foreground">{t('transferCreator.unites')}</Label>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => updateBreakdown(item.product_id, { quantity_units: item.quantity_units - 1 })}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <Input
                                type="number"
                                min={0}
                                max={item.available_quantity}
                                value={item.quantity_units}
                                onChange={(e) => updateBreakdown(item.product_id, { quantity_units: Number(e.target.value || 0) })}
                                className="w-16 h-8 text-center"
                              />
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => updateBreakdown(item.product_id, { quantity_units: item.quantity_units + 1 })}
                                disabled={item.total_units >= item.available_quantity}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="sm:col-span-2 text-[11px] text-muted-foreground">
                            Total auto: <span className="font-semibold text-foreground">{item.total_units} unité(s)</span>
                            {item.units_per_carton > 1 && ` • 1 carton = ${item.units_per_carton} unités`}
                            {destinationType === 'shop' && item.shop_product_name && ` • Boutique: ${item.shop_product_name}`}
                          </div>
                        </div>

                        {/* Supprimer */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeItem(item.product_id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Étape 3: Confirmation */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('transferCreator.confirmerLeTransfert')}</CardTitle>
            <CardDescription>
              Vérifiez les détails avant de créer le transfert
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Résumé des lieux */}
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              <div className="flex-1 text-center">
                <div className={cn(
                  "inline-flex p-3 rounded-lg mb-2",
                  fromLocation?.is_pos_enabled ? "bg-orange-100" : "bg-blue-100"
                )}>
                  {fromLocation?.is_pos_enabled ? (
                    <Store className="w-6 h-6 text-[#ff4000]" />
                  ) : (
                    <Warehouse className="w-6 h-6 text-blue-600" />
                  )}
                </div>
                <p className="font-semibold">{fromLocation?.name}</p>
                <p className="text-sm text-muted-foreground">{t('transferCreator.stockEntrepotSource')}</p>
              </div>

              <div className="p-3 rounded-full bg-primary/10">
                <ArrowRight className="w-6 h-6 text-primary" />
              </div>

              <div className="flex-1 text-center">
                <div className={cn(
                  "inline-flex p-3 rounded-lg mb-2",
                  destinationType === 'client'
                    ? 'bg-orange-100'
                    : toLocation?.is_pos_enabled ? 'bg-orange-100' : 'bg-blue-100'
                )}>
                  {destinationType === 'client' ? (
                    <Package className="w-6 h-6 text-[#ff4000]" />
                  ) : toLocation?.is_pos_enabled ? (
                    <Store className="w-6 h-6 text-[#ff4000]" />
                  ) : (
                    <Warehouse className="w-6 h-6 text-blue-600" />
                  )}
                </div>
                <p className="font-semibold">{destinationSummary}</p>
                <p className="text-sm text-muted-foreground">Destination {destinationType}</p>
              </div>
            </div>

            {/* Liste des items */}
            <div>
              <h4 className="font-semibold mb-3">
                Produits à transférer ({transferItems.length})
              </h4>
              <div className="space-y-2">
                {transferItems.map(item => (
                  <div key={item.product_id} className="flex justify-between items-center p-2 bg-muted/50 rounded gap-3">
                    <div>
                      <span className="font-medium">{item.product_name}</span>
                      {destinationType === 'shop' && item.shop_product_name && (
                        <p className="text-xs text-muted-foreground">Produit boutique lié: {item.shop_product_name}</p>
                      )}
                    </div>
                    <Badge variant="secondary">
                      {item.quantity_cartons > 0 ? `${item.quantity_cartons} carton(s) + ` : ''}
                      {item.quantity_units} unité(s) • {item.total_units} total
                    </Badge>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{totalItems} unité(s)</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                placeholder={t('transferCreator.ajoutezDesNotesPourCe')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Alerte */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Le stock logistique reste tracé à chaque étape. Il sera retiré de la source après expédition, puis confirmé à la réception avec reçu PDF et historique d’audit.
              </AlertDescription>
            </Alert>

            {hasMissingShopMapping && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Au moins un produit n'est pas lié à un produit boutique. Le transfert vers boutique est bloqué tant que le mapping n'existe pas.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => {
            if (step > 1) {
              setStep(step - 1);
            } else {
              onCancel?.();
            }
          }}
        >
          {step === 1 ? 'Annuler' : 'Retour'}
        </Button>

        {step < totalSteps ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
          >
            Continuer
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/40"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Création...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Créer le transfert
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
