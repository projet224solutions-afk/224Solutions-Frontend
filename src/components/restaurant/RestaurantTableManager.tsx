/**
 * Gestionnaire de tables restaurant
 * Plan de salle visuel avec statuts
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus, Users, MapPin, Square, Circle,
  Check, Clock, Sparkles, Trash2, Edit2, QrCode, Download
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useRestaurantTables, RestaurantTable } from '@/hooks/useRestaurantTables';
import { toast } from 'sonner';

/**
 * Base PUBLIQUE pour les liens scannés par les clients (autres appareils) : on privilégie l'URL
 * canonique configurée (VITE_APP_URL) — sinon le QR encoderait l'URL du navigateur du restaurateur
 * (preview Vercel, localhost…) et ne fonctionnerait pas une fois scanné. Repli sur l'origin courant
 * uniquement si VITE_APP_URL est absent ou local (dev).
 */
function publicBaseUrl(): string {
  const env = String((import.meta as any).env?.VITE_APP_URL || '').replace(/\/+$/, '');
  if (env && !/localhost|127\.0\.0\.1/.test(env)) return env;
  return typeof window !== 'undefined' ? window.location.origin : env;
}

/** Indique si la base est locale (le QR ne sera pas scannable depuis un autre appareil). */
function isLocalBase(): boolean {
  return /localhost|127\.0\.0\.1/.test(publicBaseUrl());
}

/** URL que le QR ouvre : le menu du restaurant avec le n° de table pré-rempli (Mode 3). */
function tableMenuUrl(serviceId: string, tableNumber: string): string {
  return `${publicBaseUrl()}/restaurant/${serviceId}/menu?table=${encodeURIComponent(tableNumber)}`;
}

interface RestaurantTableManagerProps {
  serviceId: string;
}

const STATUS_CONFIG = {
  available: { label: 'Libre', color: 'bg-[#ff4000]', icon: Check },
  occupied: { label: 'Occupée', color: 'bg-[#ff4000]', icon: Users },
  reserved: { label: 'Réservée', color: 'bg-blue-500', icon: Clock },
  cleaning: { label: 'Nettoyage', color: 'bg-[#ff4000]', icon: Sparkles },
};

const LOCATIONS = [
  { value: 'interieur', label: '🏠 Intérieur' },
  { value: 'terrasse', label: '☀️ Terrasse' },
  { value: 'salon_prive', label: '🚪 Salon privé' },
  { value: 'bar', label: '🍸 Bar' },
];

export function RestaurantTableManager({ serviceId }: RestaurantTableManagerProps) {
  const { t } = useTranslation();
  const {
    tables,
    loading,
    error,
    createTable,
    updateTable,
    updateTableStatus,
    deleteTable,
    getTableStats,
    refresh,
  } = useRestaurantTables(serviceId);

  const [showDialog, setShowDialog] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [qrTable, setQrTable] = useState<RestaurantTable | null>(null);

  // Télécharge le QR (PNG haute résolution) — à imprimer et poser sur la table.
  const downloadQr = (tableNumber: string) => {
    const svg = document.getElementById(`qr-table-${tableNumber}`);
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const size = 1024;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 64, 64, size - 128, size - 128);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `QR-table-${tableNumber}.png`;
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
  };
  const [tableForm, setTableForm] = useState({
    table_number: '',
    capacity: '4',
    location: 'interieur',
    shape: 'rectangle',
  });

  const stats = getTableStats();

  const resetForm = () => {
    setTableForm({
      table_number: '',
      capacity: '4',
      location: 'interieur',
      shape: 'rectangle',
    });
    setEditingTable(null);
  };

  const handleSave = async () => {
    const num = tableForm.table_number.trim();
    if (!num) {
      toast.error(t('restaurantTableManager.numeroDeTableRequis'));
      return;
    }
    // Anti-doublon : un même numéro = même QR → on refuse (l'index DB unique est le garde-fou final).
    const dup = tables.find(t => t.table_number.trim().toLowerCase() === num.toLowerCase() && t.id !== editingTable?.id);
    if (dup) {
      toast.error(`La table « ${num} » existe déjà.`);
      return;
    }

    try {
      if (editingTable) {
        await updateTable(editingTable.id, {
          table_number: num,
          capacity: parseInt(tableForm.capacity),
          location: tableForm.location,
          shape: tableForm.shape,
        });
        toast.success(t('restaurantTableManager.tableMiseAJour'));
      } else {
        await createTable({
          table_number: num,
          capacity: parseInt(tableForm.capacity),
          location: tableForm.location,
          shape: tableForm.shape,
        });
        toast.success(t('restaurantTableManager.tableAjoutee'));
      }
      setShowDialog(false);
      resetForm();
    } catch (err: any) {
      toast.error(/duplicate|unique/i.test(err?.message || '') ? `La table « ${num} » existe déjà.` : err.message);
    }
  };

  const handleEdit = (table: RestaurantTable) => {
    setEditingTable(table);
    setTableForm({
      table_number: table.table_number,
      capacity: table.capacity.toString(),
      location: table.location || 'interieur',
      shape: table.shape || 'rectangle',
    });
    setShowDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('restaurantTableManager.supprimerCetteTable'))) return;
    try {
      await deleteTable(id);
      toast.success(t('restaurantTableManager.tableSupprimee'));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStatusChange = async (id: string, status: RestaurantTable['status']) => {
    try {
      await updateTableStatus(id, status);
      toast.success(t('restaurantTableManager.statutMisAJour'));
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-[#ff4000]">{stats.available}</div>
            <div className="text-sm text-[#ff4000]">Tables libres</div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-[#ff4000]">{stats.occupied}</div>
            <div className="text-sm text-[#ff4000]">{t('restaurantTableManager.occupees')}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.reserved}</div>
            <div className="text-sm text-blue-700">{t('restaurantTableManager.reservees')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.occupiedCapacity}/{stats.totalCapacity}</div>
            <div className="text-sm text-muted-foreground">{t('restaurantTableManager.couvertsOccupes')}</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">{t('restaurantTableManager.planDeSalle')}</h3>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une table
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTable ? 'Modifier la table' : 'Nouvelle table'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('restaurantTableManager.numeroDeTable')}</Label>
                  <Input
                    value={tableForm.table_number}
                    onChange={(e) => setTableForm(prev => ({ ...prev, table_number: e.target.value }))}
                    placeholder="Ex: T1, A2..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('restaurantTableManager.capacitePlaces')}</Label>
                  <Input
                    type="number"
                    value={tableForm.capacity}
                    onChange={(e) => setTableForm(prev => ({ ...prev, capacity: e.target.value }))}
                    min="1"
                    max="20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Emplacement</Label>
                  <Select
                    value={tableForm.location}
                    onValueChange={(v) => setTableForm(prev => ({ ...prev, location: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATIONS.map(loc => (
                        <SelectItem key={loc.value} value={loc.value}>
                          {loc.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Forme</Label>
                  <Select
                    value={tableForm.shape}
                    onValueChange={(v) => setTableForm(prev => ({ ...prev, shape: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rectangle">◻️ Rectangle</SelectItem>
                      <SelectItem value="round">⬤ Ronde</SelectItem>
                      <SelectItem value="square">{t('restaurantTableManager.carree')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Annuler
              </Button>
              <Button onClick={handleSave}>
                {editingTable ? 'Mettre à jour' : 'Créer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grille des tables */}
      {tables.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              Aucune table configurée
            </p>
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une table
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {tables.map(table => {
            const statusConfig = STATUS_CONFIG[table.status];
            const StatusIcon = statusConfig.icon;
            const location = LOCATIONS.find(l => l.value === table.location);

            return (
              <Card
                key={table.id}
                className={`relative cursor-pointer transition-all hover:shadow-md ${
                  table.status === 'occupied' ? 'ring-2 ring-[#ff4000]' : ''
                }`}
              >
                <div className={`absolute top-0 left-0 right-0 h-1 ${statusConfig.color}`} />
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1">
                      {table.shape === 'round' ? (
                        <Circle className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Square className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="font-bold text-lg">{table.table_number}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      <Users className="w-3 h-3 mr-1" />
                      {table.capacity}
                    </Badge>
                  </div>

                  {location && (
                    <div className="text-xs text-muted-foreground mb-2">
                      {location.label}
                    </div>
                  )}

                  <div className="flex items-center gap-1 mb-3">
                    <StatusIcon className={`w-3 h-3 ${
                      table.status === 'available' ? 'text-[#ff4000]' :
                      table.status === 'occupied' ? 'text-[#ff4000]' :
                      table.status === 'reserved' ? 'text-blue-600' : 'text-[#ff4000]'
                    }`} />
                    <span className="text-xs">{statusConfig.label}</span>
                  </div>

                  {/* Actions rapides de statut */}
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                      <Button
                        key={key}
                        variant={table.status === key ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => handleStatusChange(table.id, key as RestaurantTable['status'])}
                      >
                        {config.label.slice(0, 4)}
                      </Button>
                    ))}
                  </div>

                  <div className="flex justify-end gap-1 pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[#ff4000]"
                      title={t('restaurantTableManager.qrCodeDeLaTable')}
                      onClick={() => setQrTable(table)}
                    >
                      <QrCode className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleEdit(table)}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(table.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* QR code d'une table (Mode 3) — à imprimer et poser sur la table. */}
      <Dialog open={!!qrTable} onOpenChange={(o) => !o && setQrTable(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><QrCode className="w-5 h-5 text-[#ff4000]" /> QR — Table {qrTable?.table_number}</DialogTitle>
          </DialogHeader>
          {qrTable && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="rounded-2xl border-2 border-[#ff4000]/30 bg-white p-4">
                <QRCodeSVG id={`qr-table-${qrTable.table_number}`} value={tableMenuUrl(serviceId, qrTable.table_number)} size={220} level="M" includeMargin />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Le client scanne → le menu s'ouvre avec la <strong>Table {qrTable.table_number}</strong> déjà sélectionnée.
              </p>
              <p className="w-full break-all rounded bg-muted px-2 py-1 text-center text-[10px] text-muted-foreground">{tableMenuUrl(serviceId, qrTable.table_number)}</p>
              {isLocalBase() && (
                <p className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
                  ⚠️ Adresse locale ({publicBaseUrl()}) — ce QR ne fonctionnera que sur cet appareil. Sur le site en ligne, le QR pointera vers le vrai domaine.
                </p>
              )}
              <Button className="w-full gap-2" onClick={() => downloadQr(qrTable.table_number)}>
                <Download className="w-4 h-4" /> Télécharger (PNG à imprimer)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RestaurantTableManager;
