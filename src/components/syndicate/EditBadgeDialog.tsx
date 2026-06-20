/**
 * Dialog pour modifier les informations d'un badge
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface EditBadgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleData: {
    id: string;
    member_name: string;
    driver_photo_url?: string;
    driver_date_of_birth?: string;
  };
  bureauName?: string;
  bureauCode?: string;
  bureauPrefecture?: string;
  bureauCommune?: string;
  onUpdate: () => void;
}

export default function EditBadgeDialog({
  open,
  onOpenChange,
  vehicleData,
  bureauName = '',
  bureauCode = '',
  bureauPrefecture = '',
  bureauCommune = '',
  onUpdate
}: EditBadgeDialogProps) {
  const { t } = useTranslation();
  // Séparer le nom complet en prénom et nom
  const nameParts = vehicleData.member_name.split(' ');
  const initialFirstName = nameParts.slice(0, -1).join(' ') || '';
  const initialLastName = nameParts.slice(-1)[0] || '';

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [dateOfBirth, setDateOfBirth] = useState(vehicleData.driver_date_of_birth || '');
  const [photoUrl, setPhotoUrl] = useState(vehicleData.driver_photo_url || '');

  // Construire le titre du badge automatiquement basé sur la commune ou préfecture
  const locationName = bureauCommune || bureauPrefecture || bureauName;
  const defaultBadgeTitle = locationName && locationName !== 'VOTRE BUREAU'
    ? `TAXI-MOTO Bureau Syndicat de ${locationName}`
    : 'TAXI-MOTO Bureau Syndicat';
  const [badgeTitle, setBadgeTitle] = useState(defaultBadgeTitle);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      toast.error(t('editBadgeDialog.veuillezSelectionnerUneImage'));
      return;
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('editBadgeDialog.lImageNeDoitPas'));
      return;
    }

    try {
      setUploading(true);
      toast.info(t('editBadgeDialog.uploadDeLaPhotoEn'));

      // Créer un nom de fichier unique
      const fileExt = file.name.split('.').pop();
      const fileName = `${vehicleData.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload vers Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('driver-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('driver-photos')
        .getPublicUrl(filePath);

      setPhotoUrl(publicUrl);
      toast.success(t('editBadgeDialog.photoUploadeeAvecSucces'));
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error(t('editBadgeDialog.erreurLorsDeLUpload'));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      toast.info(t('editBadgeDialog.enregistrementDesModifications'));

      // Combiner prénom et nom
      const fullName = `${firstName} ${lastName}`.trim();

      // Mettre à jour les informations du véhicule (y compris le titre du badge)
      const { error } = await supabase
        .from('vehicles')
        .update({
          driver_photo_url: photoUrl || null,
          driver_date_of_birth: dateOfBirth || null,
          badge_title: badgeTitle || null,
        })
        .eq('id', vehicleData.id);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Mettre à jour le nom dans syndicate_workers si nécessaire
      if (vehicleData.id) {
        const { data: vehicle } = await supabase
          .from('vehicles')
          .select('owner_member_id')
          .eq('id', vehicleData.id)
          .single();

        if (vehicle?.owner_member_id) {
          await supabase
            .from('syndicate_workers')
            .update({ nom: fullName })
            .eq('id', vehicle.owner_member_id);
        }
      }

      toast.success(t('editBadgeDialog.informationsMisesAJourAvec'));
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating badge info:', error);
      toast.error(`Erreur lors de la mise à jour: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span>{t('editBadgeDialog.modifierLesInformationsDuBadge')}</span>
              <div className="text-sm font-normal text-muted-foreground space-y-0.5">
                <div className="text-xs">224Solutions - Dashboard Bureau Syndicat</div>
                <div className="font-medium">
                  {bureauCode && `${bureauCode} - `}
                  {bureauPrefecture}
                  {bureauCommune && ` - ${bureauCommune}`}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
        <div className="space-y-6">
          {/* Titre du badge */}
          <div className="space-y-2">
            <Label htmlFor="badge-title">{t('editBadgeDialog.titreDuBadge')}</Label>
            <Input
              id="badge-title"
              type="text"
              value={badgeTitle}
              onChange={(e) => setBadgeTitle(e.target.value)}
              placeholder={`Ex: TAXI-MOTO Bureau Syndicat de ${bureauCommune || 'Coyah'}`}
              className="font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Ce titre apparaîtra sur le badge du conducteur
            </p>
          </div>

          {/* Nom et Prénom */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first-name">{t('editBadgeDialog.prenomS')}</Label>
              <Input
                id="first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t('editBadgeDialog.prenomDuConducteur')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-name">Nom</Label>
              <Input
                id="last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t('editBadgeDialog.nomDuConducteur')}
              />
            </div>
          </div>

          {/* Photo du conducteur */}
          <div className="space-y-2">
            <Label>{t('editBadgeDialog.photoDuConducteur')}</Label>
            {photoUrl && (
              <div className="flex justify-center mb-4">
                <img
                  src={photoUrl}
                  alt={t('editBadgeDialog.photoDuConducteur')}
                  className="w-32 h-32 object-cover rounded-lg border-2 border-border"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploading}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={uploading}
              >
                <Upload className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Format: JPG, PNG. Taille max: 5MB
            </p>
          </div>

          {/* Date de naissance */}
          <div className="space-y-2">
            <Label htmlFor="date-of-birth">{t('editBadgeDialog.dateDeNaissanceDuConducteur')}</Label>
            <Input
              id="date-of-birth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || uploading}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Enregistrer
            </Button>
          </div>
        </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
