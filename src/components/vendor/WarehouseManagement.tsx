import React, { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Warehouse, Package, MapPin, Plus, ArrowRightLeft, AlertTriangle, TrendingUp, BarChart3 } from 'lucide-react';
import { useWarehouseManagement } from '@/hooks/useWarehouseManagement';
import { useToast } from '@/hooks/use-toast';

export default function WarehouseManagement() {
  const { t } = useTranslation();
  const {
    warehouses,
    warehouseStocks,
    stockMovements,
    loading,
    error,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    updateStock,
    transferStock
  } = useWarehouseManagement();
  const { toast } = useToast();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [newWarehouse, setNewWarehouse] = useState({
    name: '',
    address: '',
    contact_person: '',
    contact_phone: ''
  });
  const [transferData, setTransferData] = useState({
    product_id: '',
    from_warehouse_id: '',
    to_warehouse_id: '',
    quantity: '',
    notes: ''
  });

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const warehouseData = {
        name: newWarehouse.name,
        address: newWarehouse.address,
        contact_person: newWarehouse.contact_person,
        contact_phone: newWarehouse.contact_phone
      };

      await createWarehouse(warehouseData);
      toast({
        title: "Entrepôt créé",
        description: "L'entrepôt a été ajouté avec succès"
      });
      setIsCreateDialogOpen(false);
      setNewWarehouse({ name: '', address: '', contact_person: '', contact_phone: '' });
    } catch (_error) {
      toast({
        title: "Erreur",
        description: "Impossible de créer l'entrepôt",
        variant: "destructive"
      });
    }
  };

  const handleTransferStock = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await transferStock(
        transferData.product_id,
        transferData.from_warehouse_id,
        transferData.to_warehouse_id,
        parseInt(transferData.quantity),
        transferData.notes
      );
      toast({
        title: "Transfert effectué",
        description: "Le stock a été transféré avec succès"
      });
      setIsTransferDialogOpen(false);
      setTransferData({ product_id: '', from_warehouse_id: '', to_warehouse_id: '', quantity: '', notes: '' });
    } catch (_error) {
      toast({
        title: "Erreur",
        description: "Impossible d'effectuer le transfert",
        variant: "destructive"
      });
    }
  };

  const handleDeleteWarehouse = async (warehouseId: string) => {
    if (!window.confirm(t('warehouseManagement.etesVousSurDeVouloir'))) return;

    try {
      await deleteWarehouse(warehouseId);
      toast({
        title: "Entrepôt supprimé",
        description: "L'entrepôt a été supprimé avec succès"
      });
    } catch (_error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'entrepôt",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="w-8 h-8 border-4 border-vendeur-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground">{t('warehouseManagement.chargementDeLaGestionDes')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {error && (
        <Alert variant="destructive" className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {/* Header Moderne */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-vendeur-gradient shadow-glow">
              <Warehouse className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{t('warehouseManagement.gestionDesEntrepots')}</h1>
              <p className="text-muted-foreground text-lg">
                Gérez vos sites de stockage multi-entrepôts • {warehouses.length} entrepôt(s)
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="hover:shadow-glow transition-all duration-300">
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transférer Stock
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5" />
                  Transférer du Stock
                </DialogTitle>
                <DialogDescription>
                  Déplacez des produits entre vos différents entrepôts
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleTransferStock} className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="product_id" className="text-sm font-medium">{t('warehouseManagement.idProduit')}</Label>
                    <Input
                      id="product_id"
                      placeholder={t('warehouseManagement.uuidDuProduitATransferer')}
                      value={transferData.product_id}
                      onChange={(e) => setTransferData(prev => ({ ...prev, product_id: e.target.value }))}
                      className="mt-1"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="from_warehouse" className="text-sm font-medium">{t('warehouseManagement.entrepotSource')}</Label>
                      <select
                        id="from_warehouse"
                        className="w-full mt-1 p-2 border border-input rounded-md bg-background text-sm"
                        value={transferData.from_warehouse_id}
                        onChange={(e) => setTransferData(prev => ({ ...prev, from_warehouse_id: e.target.value }))}
                        required
                      >
                        <option value="">{t('warehouseManagement.selectionner')}</option>
                        {warehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <Label htmlFor="to_warehouse" className="text-sm font-medium">{t('warehouseManagement.entrepotDestination')}</Label>
                      <select
                        id="to_warehouse"
                        className="w-full mt-1 p-2 border border-input rounded-md bg-background text-sm"
                        value={transferData.to_warehouse_id}
                        onChange={(e) => setTransferData(prev => ({ ...prev, to_warehouse_id: e.target.value }))}
                        required
                      >
                        <option value="">{t('warehouseManagement.selectionner')}</option>
                        {warehouses.map((warehouse) => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="quantity" className="text-sm font-medium">{t('warehouseManagement.quantite')}</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      placeholder={t('warehouseManagement.quantiteATransferer')}
                      value={transferData.quantity}
                      onChange={(e) => setTransferData(prev => ({ ...prev, quantity: e.target.value }))}
                      className="mt-1"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="notes" className="text-sm font-medium">Notes (optionnel)</Label>
                    <Textarea
                      id="notes"
                      placeholder={t('warehouseManagement.raisonDuTransfertInstructionsSpeciales')}
                      value={transferData.notes}
                      onChange={(e) => setTransferData(prev => ({ ...prev, notes: e.target.value }))}
                      className="mt-1 min-h-[80px]"
                    />
                  </div>
                </div>

                <DialogFooter className="mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsTransferDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" className="bg-vendeur-gradient">
                    Effectuer le Transfert
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-vendeur-gradient hover:shadow-glow transition-all duration-300">
                <Plus className="h-4 w-4 mr-2" />
                Nouvel Entrepôt
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Warehouse className="h-5 w-5" />
                  Créer un nouvel entrepôt
                </DialogTitle>
                <DialogDescription>
                  Ajoutez un nouveau site de stockage à votre réseau
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateWarehouse} className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium">{t('warehouseManagement.nomDeLEntrepot')}</Label>
                    <Input
                      id="name"
                      placeholder={t('warehouseManagement.exEntrepotCentralConakry')}
                      value={newWarehouse.name}
                      onChange={(e) => setNewWarehouse(prev => ({ ...prev, name: e.target.value }))}
                      className="mt-1"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="address" className="text-sm font-medium">{t('warehouseManagement.adresseComplete')}</Label>
                    <Textarea
                      id="address"
                      placeholder={t('warehouseManagement.adresseCompleteAvecVilleQuartier')}
                      value={newWarehouse.address}
                      onChange={(e) => setNewWarehouse(prev => ({ ...prev, address: e.target.value }))}
                      className="mt-1 min-h-[80px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contact_person" className="text-sm font-medium">Responsable</Label>
                      <Input
                        id="contact_person"
                        placeholder={t('warehouseManagement.nomDuResponsable')}
                        value={newWarehouse.contact_person}
                        onChange={(e) => setNewWarehouse(prev => ({ ...prev, contact_person: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact_phone" className="text-sm font-medium">{t('warehouseManagement.telephone')}</Label>
                      <Input
                        id="contact_phone"
                        placeholder="+224 xxx xxx xxx"
                        value={newWarehouse.contact_phone}
                        onChange={(e) => setNewWarehouse(prev => ({ ...prev, contact_phone: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter className="mt-6">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" className="bg-vendeur-gradient">
                    Créer l'Entrepôt
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Grille d'Entrepôts - Style Moderne */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {warehouses.map((warehouse) => (
          <Card key={warehouse.id} className="border-0 shadow-elegant hover:shadow-glow transition-all duration-300 group cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-vendeur-gradient shadow-glow group-hover:scale-105 transition-transform duration-300">
                    <Warehouse className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg group-hover:text-vendeur-primary transition-colors duration-300">
                      {warehouse.name}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      Créé le {new Date(warehouse.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="bg-vendeur-accent/50 border-vendeur-primary/20">
                  Actif
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {warehouse.address && (
                <div className="flex items-start gap-3 p-3 bg-vendeur-accent/30 rounded-lg">
                  <MapPin className="h-4 w-4 text-vendeur-primary mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    {warehouse.address}
                  </div>
                </div>
              )}

              {warehouse.contact_person && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Package className="h-4 w-4 text-vendeur-primary flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Responsable: {warehouse.contact_person}</p>
                    {warehouse.contact_phone && (
                      <p className="text-xs text-muted-foreground">Tél: {warehouse.contact_phone}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteWarehouse(warehouse.id);
                  }}
                  className="hover:bg-orange-50 hover:text-[#ff4000] hover:border-orange-200 transition-all duration-300"
                >
                  Supprimer
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-vendeur-gradient hover:shadow-glow transition-all duration-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: Ouvrir la gestion des stocks pour cet entrepôt
                  }}
                >
                  Gérer Stocks
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {warehouses.length === 0 && (
          <Card className="col-span-full border-2 border-dashed border-vendeur-primary/20 bg-vendeur-accent/10">
            <CardContent className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-vendeur-gradient flex items-center justify-center shadow-glow">
                <Warehouse className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('warehouseManagement.aucunEntrepotConfigure')}</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Commencez par créer votre premier entrepôt pour gérer vos stocks de manière professionnelle
              </p>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-vendeur-gradient hover:shadow-glow transition-all duration-300"
              >
                <Plus className="h-4 w-4 mr-2" />
                Créer le Premier Entrepôt
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Mouvements de Stock Récents - Style Moderne */}
      <Card className="border-0 shadow-elegant">
        <CardHeader className="bg-vendeur-accent/30 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-vendeur-primary" />
                Mouvements de Stock Récents
              </CardTitle>
              <CardDescription className="text-base">
                Historique des transferts et ajustements de stock entre entrepôts
              </CardDescription>
            </div>
            {stockMovements.length > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-vendeur-accent/50 border-vendeur-primary/20">
                  {stockMovements.length} mouvement(s)
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="hover:shadow-glow transition-all duration-300"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Voir Rapport
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {stockMovements.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-vendeur-accent/50 flex items-center justify-center">
                <Package className="h-8 w-8 text-vendeur-primary opacity-50" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('warehouseManagement.aucunMouvementDeStock')}</h3>
              <p className="text-muted-foreground">
                Les transferts et ajustements de stock s'afficheront ici
              </p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-semibold">{t('warehouseManagement.typeDeMouvement')}</TableHead>
                    <TableHead className="font-semibold">{t('warehouseManagement.produit')}</TableHead>
                    <TableHead className="font-semibold">{t('warehouseManagement.quantite2')}</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockMovements.slice(0, 10).map((movement) => (
                    <TableRow key={movement.id} className="hover:bg-vendeur-accent/20 transition-colors duration-200">
                      <TableCell>
                        <Badge
                          variant={
                            movement.movement_type === 'in' ? 'default' :
                            movement.movement_type === 'out' ? 'destructive' :
                            'secondary'
                          }
                          className={
                            movement.movement_type === 'in' ? 'bg-vendeur-secondary/10 text-vendeur-secondary border-vendeur-secondary/20' :
                            movement.movement_type === 'transfer' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                            ''
                          }
                        >
                          {movement.movement_type === 'in' ? '📦 Entrée' :
                           movement.movement_type === 'out' ? '📤 Sortie' :
                           '🔄 Transfert'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-vendeur-gradient flex items-center justify-center">
                            <Package className="h-4 w-4 text-white" />
                          </div>
                          <span className="font-mono text-sm">
                            {movement.product_id.substring(0, 8)}...
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{movement.quantity}</span>
                          <TrendingUp className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(movement.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <p className="text-sm text-muted-foreground truncate">
                            {movement.notes || 'Aucune note'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}