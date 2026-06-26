/**
 * Gestion Multi-Entrepôts & Multi-POS
 * 224SOLUTIONS - Interface vendeur professionnelle
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useFormatCurrency } from '@/hooks/useFormatCurrency';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { _Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { _Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { _Progress } from '@/components/ui/progress';
import { _Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Warehouse,
  _Store,
  MapPin,
  Plus,
  ArrowRightLeft,
  AlertTriangle,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  _MoreVertical,
  Edit,
  _Trash2,
  Star,
  Eye,
  _Phone,
  _Mail,
  User,
  TrendingDown,
  _BarChart3,
  RefreshCw,
  _Search,
  _Filter,
  _ChevronRight,
  Building2,
  _ShoppingBag,
  _AlertCircle,
  FileDown
} from 'lucide-react';
import { useMultiWarehouse, VendorLocation, StockTransfer, CreateLocationInput, CreateTransferInput } from '@/hooks/useMultiWarehouse';
import TransferCreator from '@/components/vendor/TransferCreator';
import TransferReception from '@/components/vendor/TransferReception';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Composant pour les stats d'un lieu
function LocationStatsCard({ stats }: { stats: any }) {
  const { t } = useTranslation();
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
      <div className="text-center p-2 bg-muted/50 rounded-lg">
        <p className="text-2xl font-bold text-primary">{stats.total_products || 0}</p>
        <p className="text-xs text-muted-foreground">{t('multiWarehouse.products')}</p>
      </div>
      <div className="text-center p-2 bg-muted/50 rounded-lg">
        <p className="text-2xl font-bold">{stats.total_quantity || 0}</p>
        <p className="text-xs text-muted-foreground">{t('multiWarehouse.units')}</p>
      </div>
      <div className="text-center p-2 bg-muted/50 rounded-lg">
        <p className="text-2xl font-bold text-[#ff4000]">{stats.low_stock_count || 0}</p>
        <p className="text-xs text-muted-foreground">{t('multiWarehouse.lowStock')}</p>
      </div>
      <div className="text-center p-2 bg-muted/50 rounded-lg">
        <p className="text-2xl font-bold text-[#ff4000]">{stats.out_of_stock_count || 0}</p>
        <p className="text-xs text-muted-foreground">{t('multiWarehouse.outOfStock')}</p>
      </div>
    </div>
  );
}

// Carte d'un lieu logistique
function LocationCard({
  location,
  onEdit,
  _onDelete,
  onSetDefault,
  onViewStock
}: {
  location: VendorLocation;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onViewStock: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card className={cn(
      "relative overflow-hidden transition-all hover:shadow-lg",
      location.is_default && "ring-2 ring-primary"
    )}>
      {/* Badge type */}
      <div className="absolute top-3 right-3 flex gap-2">
        {location.is_default && (
          <Badge variant="default" className="bg-primary">
            <Star className="w-3 h-3 mr-1" />
            {t('multiWarehouse.default')}
          </Badge>
        )}
        <Badge variant="secondary">
          <Warehouse className="w-3 h-3 mr-1" />
          {t('multiWarehouse.warehouse')}
        </Badge>
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/50">
            <Warehouse className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate pr-20">{location.name}</CardTitle>
            {location.code && (
              <p className="text-sm text-muted-foreground font-mono">{location.code}</p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Adresse */}
        {(location.address || location.city) && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="line-clamp-2">
              {[location.address, location.city, location.country].filter(Boolean).join(', ')}
            </span>
          </div>
        )}

        {/* Manager */}
        {location.manager_name && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4 shrink-0" />
            <span>{location.manager_name}</span>
            {location.manager_phone && (
              <span className="text-xs">• {location.manager_phone}</span>
            )}
          </div>
        )}

        {/* Stats */}
        <LocationStatsCard stats={location.stats} />

        {/* Transferts en attente */}
        {(location.stats?.pending_transfers_in > 0 || location.stats?.pending_transfers_out > 0) && (
          <div className="flex gap-2 pt-2">
            {location.stats?.pending_transfers_in > 0 && (
              <Badge variant="outline" className="text-blue-600">
                <Truck className="w-3 h-3 mr-1" />
                {location.stats.pending_transfers_in} {t('multiWarehouse.entriesIn')}
              </Badge>
            )}
            {location.stats?.pending_transfers_out > 0 && (
              <Badge variant="outline" className="text-orange-600">
                <Truck className="w-3 h-3 mr-1" />
                {location.stats.pending_transfers_out} {t('multiWarehouse.exitsOut')}
              </Badge>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2 pt-3 border-t">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onViewStock}
        >
          <Eye className="w-4 h-4 mr-1" />
          {t('multiWarehouse.stockBtn')}
        </Button>

        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Edit className="w-4 h-4" />
        </Button>

        {!location.is_default && (
          <Button variant="ghost" size="icon" onClick={onSetDefault}>
            <Star className="w-4 h-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// Badge de statut de transfert
function TransferStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const config = {
    pending: { label: t('multiWarehouse.statusPending'), color: 'bg-gray-100 text-gray-700', icon: Clock },
    in_transit: { label: t('multiWarehouse.statusInTransit'), color: 'bg-blue-100 text-blue-700', icon: Truck },
    delivered: { label: t('multiWarehouse.statusDelivered'), color: 'bg-blue-100 text-[#04439e]', icon: Package },
    completed: { label: t('multiWarehouse.statusCompleted'), color: 'bg-orange-100 text-[#ff4000]', icon: CheckCircle2 },
    partial: { label: t('multiWarehouse.statusPartial'), color: 'bg-orange-100 text-[#ff4000]', icon: AlertTriangle },
    cancelled: { label: t('multiWarehouse.statusCancelled'), color: 'bg-orange-100 text-[#ff4000]', icon: XCircle },
  }[status] || { label: status, color: 'bg-gray-100 text-gray-700', icon: Clock };

  const Icon = config.icon;

  return (
    <Badge className={cn("font-medium", config.color)}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

// Composant principal
export default function MultiWarehouseManagement() {
  const { t } = useTranslation();
  const fc = useFormatCurrency();
  const {
    warehouses,
    transfers,
    pendingTransfers,
    inTransitTransfers,
    losses,
    totalLossValue,
    _productMappings,
    loading,
    createLocation,
    updateLocation,
    deleteLocation,
    togglePOS,
    setDefaultLocation,
    getLocationStock,
    createTransfer,
    shipTransfer,
    confirmTransferReception,
    cancelTransfer,
    downloadTransferReceipt,
    refresh
  } = useMultiWarehouse();

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('locations');

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Selected items
  const [selectedLocation, setSelectedLocation] = useState<VendorLocation | null>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [locationStock, setLocationStock] = useState<any[]>([]);
  // ✅ Remplacent la confirmation native (bloquée sur Android/WebView)
  const [shipConfirm, setShipConfirm] = useState<{ transfer: StockTransfer } | null>(null);
  const [deleteLocationConfirm, setDeleteLocationConfirm] = useState<{ id: string; name: string } | null>(null);

  // Form states
  const [newLocation, setNewLocation] = useState<CreateLocationInput>({
    name: '',
    code: '',
    location_type: 'warehouse',
    address: '',
    city: '',
    manager_name: '',
    manager_phone: '',
  });

  const [transferForm, setTransferForm] = useState<CreateTransferInput>({
    from_location_id: '',
    to_location_id: '',
    items: [],
    notes: ''
  });

  const resetLocationForm = () => {
    setSelectedLocation(null);
    setNewLocation({
      name: '',
      code: '',
      location_type: 'warehouse',
      address: '',
      city: '',
      manager_name: '',
      manager_phone: '',
    });
  };

  const handleCreateDialogChange = (open: boolean) => {
    setShowCreateDialog(open);
    if (!open) {
      resetLocationForm();
    }
  };

  // Charger le stock d'un lieu
  const handleViewStock = async (location: VendorLocation) => {
    setSelectedLocation(location);
    const stock = await getLocationStock(location.id);
    setLocationStock(stock);
    setShowStockDialog(true);
  };

  // Créer ou modifier un lieu
  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();

    const success = selectedLocation
      ? await updateLocation(selectedLocation.id, newLocation)
      : await createLocation(newLocation);

    if (success) {
      setShowCreateDialog(false);
      resetLocationForm();
    }
  };

  // Toggle POS
  const _handleTogglePOS = async (location: VendorLocation) => {
    await togglePOS(location.id, !location.is_pos_enabled);
  };

  // Créer un transfert
  const _handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transferForm.items.length === 0) {
      toast({
        title: t('multiWarehouse.errorTitle'),
        description: t('multiWarehouse.addProductError'),
        variant: "destructive"
      });
      return;
    }
    const result = await createTransfer(transferForm);
    if (result) {
      setShowTransferDialog(false);
      setTransferForm({
        from_location_id: '',
        to_location_id: '',
        items: [],
        notes: ''
      });
    }
  };

  // Expédier un transfert
  const handleShipTransfer = (transfer: StockTransfer) => {
    setShipConfirm({ transfer });
  };

  // Confirmer réception
  const _handleConfirmReception = async () => {
    if (!selectedTransfer) return;

    // Pour simplifier, on confirme tout comme reçu
    const items = selectedTransfer.items?.map(item => ({
      product_id: item.product_id,
      quantity_received: item.quantity_sent,
    })) || [];

    await confirmTransferReception({
      transfer_id: selectedTransfer.id,
      items
    });

    setShowConfirmDialog(false);
    setSelectedTransfer(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground">{t('multiWarehouse.loadingSystem')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-[#04439e] shadow-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{t('multiWarehouse.title')}</h1>
              <p className="text-muted-foreground">
                {t('multiWarehouse.subtitle')} • {warehouses.length} {t('multiWarehouse.warehousesCount')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={() => refresh()} className="flex-1 md:flex-none">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('multiWarehouse.refresh')}
          </Button>
          <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1 md:flex-none">
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                {t('multiWarehouse.logisticTransfer')}
              </Button>
            </DialogTrigger>
          </Dialog>
          <Dialog open={showCreateDialog} onOpenChange={handleCreateDialogChange}>
            <DialogTrigger asChild>
              <Button
                className="flex-1 md:flex-none bg-primary hover:bg-primary/90 shadow-lg shadow-primary/40"
                onClick={() => {
                  resetLocationForm();
                  setShowCreateDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('multiWarehouse.newSite')}
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>

      {/* Vue d'ensemble professionnelle */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('multiWarehouse.activeWarehouses')}</p>
                <p className="text-2xl font-bold">{warehouses.length}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                <Warehouse className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('multiWarehouse.transfersToProcess')}</p>
                <p className="text-2xl font-bold">{pendingTransfers.length + inTransitTransfers.length}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-100 text-[#04439e]">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('multiWarehouse.reportedGaps')}</p>
                <p className="text-2xl font-bold">{losses.length}</p>
              </div>
              <div className="p-2 rounded-lg bg-orange-100 text-[#ff4000]">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert className="border-primary/20 bg-primary/5">
        <Package className="h-4 w-4 text-primary" />
        <AlertTitle>{t('multiWarehouse.proModeTitle')}</AlertTitle>
        <AlertDescription>
          {t('multiWarehouse.proModeDesc')}
        </AlertDescription>
      </Alert>

      {/* Alertes */}
      {pendingTransfers.length > 0 && (
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <Truck className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800 dark:text-blue-200">{t('multiWarehouse.pendingTitle')}</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            {pendingTransfers.length} {t('multiWarehouse.pendingDesc')}
          </AlertDescription>
        </Alert>
      )}

      {inTransitTransfers.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50 dark:bg-[#ff4000]/20">
          <Truck className="h-4 w-4 text-[#ff4000]" />
          <AlertTitle className="text-[#ff4000] dark:text-orange-200">{t('multiWarehouse.inTransitTitle')}</AlertTitle>
          <AlertDescription className="text-[#ff4000] dark:text-orange-300">
            {inTransitTransfers.length} {t('multiWarehouse.inTransitDesc')}
          </AlertDescription>
        </Alert>
      )}

      {/* Onglets */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-3 h-auto w-full md:w-auto gap-1">
          <TabsTrigger value="locations" className="gap-2">
            <Building2 className="w-4 h-4" />
            <span className="hidden md:inline">{t('multiWarehouse.tabWarehouses')}</span>
            <Badge variant="secondary" className="ml-1">{warehouses.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="transfers" className="gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            <span className="hidden md:inline">{t('multiWarehouse.tabTransfers')}</span>
            <Badge variant="secondary" className="ml-1">{transfers.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="losses" className="gap-2">
            <TrendingDown className="w-4 h-4" />
            <span className="hidden md:inline">{t('multiWarehouse.tabAudit')}</span>
            <Badge variant="secondary" className="ml-1">{losses.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Lieux */}
        <TabsContent value="locations" className="space-y-4">
          {warehouses.length === 0 ? (
            <Card className="p-6 sm:p-8 md:p-10 text-center mb-20 lg:mb-0">
              <Warehouse className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">{t('multiWarehouse.emptyTitle')}</h3>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                {t('multiWarehouse.emptyDesc')}
              </p>

              <div className="grid md:grid-cols-2 gap-3 text-left mb-6">
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="font-semibold mb-1">{t('multiWarehouse.feat1Title')}</p>
                  <p className="text-sm text-muted-foreground">{t('multiWarehouse.feat1Desc')}</p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="font-semibold mb-1">{t('multiWarehouse.feat2Title')}</p>
                  <p className="text-sm text-muted-foreground">{t('multiWarehouse.feat2Desc')}</p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="font-semibold mb-1">{t('multiWarehouse.feat3Title')}</p>
                  <p className="text-sm text-muted-foreground">{t('multiWarehouse.feat3Desc')}</p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="font-semibold mb-1">{t('multiWarehouse.feat4Title')}</p>
                  <p className="text-sm text-muted-foreground">{t('multiWarehouse.feat4Desc')}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-2">
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('multiWarehouse.createWarehouse')}
                </Button>
                <Button variant="outline" onClick={() => setShowTransferDialog(true)}>
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  {t('multiWarehouse.prepareTransfer')}
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {warehouses.map((location) => (
                <LocationCard
                  key={location.id}
                  location={location}
                  onEdit={() => {
                    setSelectedLocation(location);
                    setNewLocation({
                      name: location.name,
                      code: location.code || '',
                      location_type: location.location_type,
                      address: location.address || '',
                      city: location.city || '',
                      manager_name: location.manager_name || '',
                      manager_phone: location.manager_phone || '',
                    });
                    setShowCreateDialog(true);
                  }}
                  onDelete={() => setDeleteLocationConfirm({ id: location.id, name: location.name })}
                  onSetDefault={() => setDefaultLocation(location.id)}
                  onViewStock={() => handleViewStock(location)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Transferts */}
        <TabsContent value="transfers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>{t('multiWarehouse.transferHistory')}</CardTitle>
                  <CardDescription>
                    {t('multiWarehouse.transferHistoryDesc')}
                  </CardDescription>
                </div>
                <Button onClick={() => setShowTransferDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('multiWarehouse.newTransfer')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {transfers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{t('multiWarehouse.noTransfers')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transfers.map((transfer) => (
                    <Card key={transfer.id} className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-muted">
                            <ArrowRightLeft className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-semibold">{transfer.transfer_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {transfer.from_location?.name} → {transfer.to_location?.name}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-medium">{transfer.total_items || transfer.total_quantity_sent || 0} {t('multiWarehouse.itemsCount')}</p>
                            <p className="text-xs text-muted-foreground">
                              {transfer.created_at ? format(new Date(transfer.created_at), 'dd MMM yyyy HH:mm', { locale: fr }) : '-'}
                            </p>
                          </div>
                          <TransferStatusBadge status={transfer.status} />
                        </div>

                        <div className="flex gap-2 flex-wrap justify-end">
                          {transfer.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleShipTransfer(transfer)}
                              >
                                <Truck className="w-4 h-4 mr-1" />
                                {t('multiWarehouse.ship')}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => cancelTransfer(transfer.id)}
                              >
                                {t('multiWarehouse.cancel')}
                              </Button>
                            </>
                          )}
                          {transfer.status === 'in_transit' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedTransfer(transfer);
                                setShowConfirmDialog(true);
                              }}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              {t('multiWarehouse.confirmReception')}
                            </Button>
                          )}
                          {['completed', 'partial', 'delivered'].includes(transfer.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadTransferReceipt(transfer)}
                            >
                              <FileDown className="w-4 h-4 mr-1" />
                              {t('multiWarehouse.pdfReceipt')}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Détails des items */}
                      {transfer.items && transfer.items.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex flex-wrap gap-2">
                            {transfer.items.slice(0, 3).map((item) => (
                              <Badge key={item.id} variant="outline">
                                {item.product?.name || t('multiWarehouse.productFallback')} × {item.quantity_sent}
                              </Badge>
                            ))}
                            {transfer.items.length > 3 && (
                              <Badge variant="secondary">
                                +{transfer.items.length - 3} {t('multiWarehouse.moreItems')}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* Tab: Pertes */}
        <TabsContent value="losses" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-[#ff4000]" />
                    {t('multiWarehouse.auditTitle')}
                  </CardTitle>
                  <CardDescription>
                    {t('multiWarehouse.auditDesc')}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#ff4000]">
                    {fc(totalLossValue)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t('multiWarehouse.totalLossValue')}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {losses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-[#ff4000]" />
                  <p>{t('multiWarehouse.noLosses')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('multiWarehouse.ref')}</TableHead>
                      <TableHead>{t('multiWarehouse.product')}</TableHead>
                      <TableHead>{t('multiWarehouse.place')}</TableHead>
                      <TableHead>{t('multiWarehouse.type')}</TableHead>
                      <TableHead>{t('multiWarehouse.quantity')}</TableHead>
                      <TableHead>{t('multiWarehouse.value')}</TableHead>
                      <TableHead>{t('multiWarehouse.date')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {losses.map((loss) => (
                      <TableRow key={loss.id}>
                        <TableCell className="font-mono text-sm">{loss.loss_number}</TableCell>
                        <TableCell>{loss.product?.name || 'N/A'}</TableCell>
                        <TableCell>{loss.location?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{loss.source_type}</Badge>
                        </TableCell>
                        <TableCell>{loss.quantity}</TableCell>
                        <TableCell className="text-[#ff4000] font-medium">
                          {fc(loss.total_loss_value || 0)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {loss.reported_at ? format(new Date(loss.reported_at), 'dd/MM/yyyy', { locale: fr }) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Créer/Modifier un lieu */}
      <Dialog open={showCreateDialog} onOpenChange={handleCreateDialogChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLocation ? (
                <>
                  <Edit className="w-5 h-5" />
                  {t('multiWarehouse.editPlace')}
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  {t('multiWarehouse.newPlace')}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedLocation
                ? t('multiWarehouse.editPlaceDesc')
                : t('multiWarehouse.newPlaceDesc')
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateLocation} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="name">{t('multiWarehouse.placeName')}</Label>
                <Input
                  id="name"
                  placeholder={t('multiWarehouse.placeNamePlaceholder')}
                  value={newLocation.name}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="code">{t('multiWarehouse.code')}</Label>
                <Input
                  id="code"
                  placeholder={t('multiWarehouse.codePlaceholder')}
                  value={newLocation.code}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, code: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="type">{t('multiWarehouse.placeType')}</Label>
                <Select
                  value={newLocation.location_type}
                  onValueChange={(v) => setNewLocation(prev => ({ ...prev, location_type: v as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warehouse">
                      <span className="flex items-center gap-2">
                        <Warehouse className="w-4 h-4" />
                        {t('multiWarehouse.warehouse')}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label htmlFor="address">{t('multiWarehouse.address')}</Label>
                <Input
                  id="address"
                  placeholder={t('multiWarehouse.addressPlaceholder')}
                  value={newLocation.address}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="city">{t('multiWarehouse.city')}</Label>
                <Input
                  id="city"
                  placeholder={t('multiWarehouse.cityPlaceholder')}
                  value={newLocation.city}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="manager_name">{t('multiWarehouse.manager')}</Label>
                <Input
                  id="manager_name"
                  placeholder={t('multiWarehouse.managerPlaceholder')}
                  value={newLocation.manager_name}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, manager_name: e.target.value }))}
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="manager_phone">{t('multiWarehouse.managerPhone')}</Label>
                <Input
                  id="manager_phone"
                  placeholder="+224 XXX XXX XXX"
                  value={newLocation.manager_phone}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, manager_phone: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setShowCreateDialog(false);
                resetLocationForm();
              }}>
                {t('multiWarehouse.cancel')}
              </Button>
              <Button type="submit">
                {selectedLocation ? t('multiWarehouse.save') : t('multiWarehouse.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Créer un transfert */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" />
              {t('multiWarehouse.createTransferTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('multiWarehouse.createTransferDesc')}
            </DialogDescription>
          </DialogHeader>

          <TransferCreator
            onSuccess={() => {
              setShowTransferDialog(false);
              refresh();
            }}
            onCancel={() => setShowTransferDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog: Voir le stock d'un lieu */}
      <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {t('multiWarehouse.stockOf')} {selectedLocation?.name}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[500px]">
            {locationStock.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('multiWarehouse.noStock')}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('multiWarehouse.product')}</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">{t('multiWarehouse.stock')}</TableHead>
                    <TableHead className="text-right">{t('multiWarehouse.reserved')}</TableHead>
                    <TableHead className="text-right">{t('multiWarehouse.available')}</TableHead>
                    <TableHead className="text-right">{t('multiWarehouse.min')}</TableHead>
                    <TableHead>{t('multiWarehouse.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locationStock.map((stock) => (
                    <TableRow key={stock.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {stock.product?.images?.[0] && (
                            <img
                              src={stock.product.images[0]}
                              alt=""
                              className="w-8 h-8 rounded object-cover"
                            />
                          )}
                          <span className="font-medium">{stock.product?.name || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {stock.product?.sku || '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">{stock.quantity}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {stock.reserved_quantity || 0}
                      </TableCell>
                      <TableCell className="text-right font-medium text-[#ff4000]">
                        {stock.available_quantity}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {stock.minimum_stock}
                      </TableCell>
                      <TableCell>
                        {stock.quantity === 0 ? (
                          <Badge variant="destructive">{t('multiWarehouse.outOfStock')}</Badge>
                        ) : stock.quantity <= stock.minimum_stock ? (
                          <Badge variant="outline" className="text-[#ff4000] border-orange-300">
                            {t('multiWarehouse.lowStock')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[#ff4000] border-orange-300">
                            {t('multiWarehouse.ok')}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmer réception */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {selectedTransfer && (
            <TransferReception
              transfer={selectedTransfer}
              onSuccess={() => {
                setShowConfirmDialog(false);
                setSelectedTransfer(null);
                refresh();
              }}
              onCancel={() => {
                setShowConfirmDialog(false);
                setSelectedTransfer(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* AlertDialog : Confirmer expédition transfert (remplace la confirmation native) */}
      <AlertDialog open={!!shipConfirm} onOpenChange={(o) => { if (!o) setShipConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('multiWarehouse.shipConfirm1')} {shipConfirm?.transfer.transfer_number} ?</AlertDialogTitle>
            <AlertDialogDescription>{t('multiWarehouse.shipConfirm2')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('multiWarehouse.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#04439e] hover:bg-[#04439e]/90"
              onClick={() => { const tr = shipConfirm!.transfer; setShipConfirm(null); shipTransfer(tr.id); }}
            >
              {t('multiWarehouse.ship')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog : Supprimer entrepôt (remplace la confirmation native) */}
      <AlertDialog open={!!deleteLocationConfirm} onOpenChange={(o) => { if (!o) setDeleteLocationConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('multiWarehouse.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleteLocationConfirm?.name} » — {t('multiWarehouse.irreversible')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('multiWarehouse.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { const id = deleteLocationConfirm!.id; setDeleteLocationConfirm(null); deleteLocation(id); }}
            >
              {t('multiWarehouse.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
