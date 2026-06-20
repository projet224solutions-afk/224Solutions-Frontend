import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Car } from "lucide-react";
import { toast } from "sonner";

interface EditVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleData: {
    id: string;
    serial_number?: string;
    license_plate?: string;
    vehicle_type?: string;
    brand?: string;
    model?: string;
    year?: number;
    color?: string;
    status?: string;
    member_name?: string;
  };
  onUpdate: () => void;
}

export default function EditVehicleDialog({
  open,
  onOpenChange,
  vehicleData,
  onUpdate
}: EditVehicleDialogProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [serialNumber, setSerialNumber] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [vehicleType, setVehicleType] = useState('motorcycle');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState<number | undefined>();
  const [color, setColor] = useState('');
  const [status, setStatus] = useState('active');

  useEffect(() => {
    if (vehicleData && open) {
      setSerialNumber(vehicleData.serial_number || '');
      setLicensePlate(vehicleData.license_plate || '');
      setVehicleType(vehicleData.vehicle_type || 'motorcycle');
      setBrand(vehicleData.brand || '');
      setModel(vehicleData.model || '');
      setYear(vehicleData.year);
      setColor(vehicleData.color || '');
      setStatus(vehicleData.status || 'active');
    }
  }, [vehicleData, open]);

  const handleSave = async () => {
    try {
      setSaving(true);
      toast.info(t('editVehicleDialog.enregistrementDesModifications'));

      // SÉCURITÉ: Vérifier si le véhicule est volé avant de permettre un changement de statut
      const { data: currentVehicle, error: checkError } = await supabase
        .from('vehicles')
        .select('is_stolen, stolen_status, security_lock_level, status')
        .eq('id', vehicleData.id)
        .single();

      if (checkError) throw checkError;

      // BLOQUER le changement manuel de statut si le véhicule est volé
      if (currentVehicle?.is_stolen || currentVehicle?.stolen_status === 'stolen') {
        if (status !== 'suspended' && status !== currentVehicle.status) {
          toast.error(t('editVehicleDialog.impossibleDeModifierLeStatut'));
          setSaving(false);
          return;
        }
      }

      // Ne pas permettre de changer manuellement vers/depuis 'stolen' ou 'suspended' si security_lock
      if (currentVehicle?.security_lock_level && currentVehicle.security_lock_level > 0) {
        if (status !== currentVehicle.status) {
          toast.error(t('editVehicleDialog.vehiculeVerrouillePourRaisonDe'));
          setSaving(false);
          return;
        }
      }

      const { error } = await supabase
        .from('vehicles')
        .update({
          serial_number: serialNumber,
          license_plate: licensePlate,
          type: vehicleType,
          brand: brand || null,
          model: model || null,
          year: year || null,
          color: color || null,
          // Ne pas permettre le changement de statut si verrouillé
          ...(currentVehicle?.security_lock_level === 0 || !currentVehicle?.security_lock_level ? { status } : {})
        })
        .eq('id', vehicleData.id);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      toast.success(t('editVehicleDialog.vehiculeMisAJourAvec'));
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating vehicle:', error);
      toast.error(`Erreur lors de la mise à jour: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            Modifier le véhicule
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Numéro de série et Plaque */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="serial-number">{t('editVehicleDialog.numeroDeSerie')}</Label>
              <Input
                id="serial-number"
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Ex: ABC123456"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="license-plate">Plaque d'immatriculation</Label>
              <Input
                id="license-plate"
                type="text"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                placeholder="Ex: DK1234"
              />
            </div>
          </div>

          {/* Type de véhicule */}
          <div className="space-y-2">
            <Label>{t('editVehicleDialog.typeDeVehicule')}</Label>
            <Select value={vehicleType} onValueChange={setVehicleType}>
              <SelectTrigger>
                <SelectValue placeholder={t('editVehicleDialog.selectionnerLeType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="motorcycle">Moto</SelectItem>
                <SelectItem value="tricycle">Tricycle</SelectItem>
                <SelectItem value="car">Voiture</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Marque et Modèle */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Marque</Label>
              <Input
                id="brand"
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ex: Bajaj, Honda..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">{t('editVehicleDialog.modele')}</Label>
              <Input
                id="model"
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Ex: Discover 125"
              />
            </div>
          </div>

          {/* Année et Couleur */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">{t('editVehicleDialog.annee')}</Label>
              <Input
                id="year"
                type="number"
                value={year || ''}
                onChange={(e) => setYear(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Ex: 2024"
                min={1990}
                max={new Date().getFullYear() + 1}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Couleur</Label>
              <Input
                id="color"
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Ex: Rouge Noir"
              />
            </div>
          </div>

          {/* Statut */}
          <div className="space-y-2">
            <Label>Statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder={t('editVehicleDialog.selectionnerLeStatut')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="suspended">Suspendu</SelectItem>
                <SelectItem value="maintenance">En maintenance</SelectItem>
                <SelectItem value="retired">{t('editVehicleDialog.retire')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
