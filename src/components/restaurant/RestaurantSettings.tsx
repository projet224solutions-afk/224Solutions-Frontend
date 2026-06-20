/**
 * Paramètres du Restaurant - Horaires, Description, Images
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock, Save, Store, Phone, Mail, MapPin,
  Image as ImageIcon, Globe, Upload, X, Loader2,
  Navigation, CheckCircle2
} from 'lucide-react';
import { mapService } from '@/services/mapService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useStorageUpload } from '@/hooks/useStorageUpload';

interface RestaurantSettingsProps {
  serviceId: string;
}

interface OpeningHour {
  open: string;
  close: string;
  closed: boolean;
}

interface OpeningHours {
  monday: OpeningHour;
  tuesday: OpeningHour;
  wednesday: OpeningHour;
  thursday: OpeningHour;
  friday: OpeningHour;
  saturday: OpeningHour;
  sunday: OpeningHour;
}

const DAYS_FR: Record<string, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
};

const DEFAULT_HOURS: OpeningHours = {
  monday: { open: '08:00', close: '22:00', closed: false },
  tuesday: { open: '08:00', close: '22:00', closed: false },
  wednesday: { open: '08:00', close: '22:00', closed: false },
  thursday: { open: '08:00', close: '22:00', closed: false },
  friday: { open: '08:00', close: '22:00', closed: false },
  saturday: { open: '08:00', close: '22:00', closed: false },
  sunday: { open: '08:00', close: '22:00', closed: true },
};

export function RestaurantSettings({ serviceId }: RestaurantSettingsProps) {
  const { t } = useTranslation();
  const { uploadFile, isUploading } = useStorageUpload();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingType, setUploadingType] = useState<'logo' | 'cover' | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [detectedCoords, setDetectedCoords] = useState<{ lat: number; lng: number } | null>(null);

  const handleDetectPosition = useCallback(async () => {
    setGpsLoading(true);
    setGpsSuccess(false);
    try {
      const position = await mapService.getCurrentPosition();
      const fullAddress = await mapService.reverseGeocode(position.latitude, position.longitude);

      // Parse address parts
      const parts = fullAddress.split(',').map(p => p.trim());
      const streetPart = parts[0] || '';
      const neighborhoodPart = parts[1] || '';
      const cityPart = parts.length >= 3 ? parts[2] : (parts[1] || 'Conakry');

      setFormData(prev => ({
        ...prev,
        address: streetPart,
        neighborhood: neighborhoodPart,
        city: cityPart,
      }));
      setDetectedCoords({ lat: position.latitude, lng: position.longitude });
      setGpsSuccess(true);
      toast.success(t('restaurantSettings.positionDetecteeAvecSucces'));

      // Update coordinates in DB
      await supabase
        .from('professional_services')
        .update({ latitude: position.latitude, longitude: position.longitude })
        .eq('id', serviceId);

      setTimeout(() => setGpsSuccess(false), 3000);
    } catch (err: any) {
      console.error('Erreur GPS:', err);
      toast.error(t('restaurantSettings.impossibleDeDetecterVotrePosition'));
    } finally {
      setGpsLoading(false);
    }
  }, [serviceId]);

  const [formData, setFormData] = useState({
    business_name: '',
    description: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    city: '',
    neighborhood: '',
    logo_url: '',
    cover_image_url: '',
    cuisine: '',
    delivery_fee: '',
    delivery_eta: '',
  });

  const [metadata, setMetadata] = useState<Record<string, any>>({});
  const [openingHours, setOpeningHours] = useState<OpeningHours>(DEFAULT_HOURS);

  useEffect(() => {
    loadSettings();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('professional_services')
        .select('*')
        .eq('id', serviceId)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          business_name: data.business_name || '',
          description: data.description || '',
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
          address: data.address || '',
          city: data.city || '',
          neighborhood: data.neighborhood || '',
          logo_url: data.logo_url || '',
          cover_image_url: data.cover_image_url || '',
          cuisine: (data.metadata as any)?.cuisine || '',
          delivery_fee: (data.metadata as any)?.delivery_fee != null ? String((data.metadata as any).delivery_fee) : '',
          delivery_eta: (data.metadata as any)?.delivery_eta_minutes != null ? String((data.metadata as any).delivery_eta_minutes) : '',
        });
        setMetadata((data.metadata as any) || {});

        if (data.opening_hours && typeof data.opening_hours === 'object') {
          setOpeningHours({ ...DEFAULT_HOURS, ...(data.opening_hours as Partial<OpeningHours>) });
        }
      }
    } catch (err: any) {
      console.error('Error loading settings:', err);
      toast.error(t('restaurantSettings.erreurLorsDuChargementDes'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Convert opening hours to Json-compatible format
      const openingHoursJson = JSON.parse(JSON.stringify(openingHours));

      const { error } = await supabase
        .from('professional_services')
        .update({
          business_name: formData.business_name,
          description: formData.description,
          phone: formData.phone,
          email: formData.email,
          website: formData.website,
          address: formData.address,
          city: formData.city,
          neighborhood: formData.neighborhood,
          logo_url: formData.logo_url,
          cover_image_url: formData.cover_image_url,
          opening_hours: openingHoursJson,
          // Marketplace : cuisine + frais/temps de livraison (préservent les autres clés metadata).
          metadata: {
            ...metadata,
            cuisine: formData.cuisine.trim() || null,
            delivery_fee: Math.max(0, Number(formData.delivery_fee) || 0),
            delivery_eta_minutes: formData.delivery_eta ? Math.max(0, Number(formData.delivery_eta)) : null,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', serviceId);

      if (error) throw error;

      toast.success(t('restaurantSettings.parametresSauvegardes'));
    } catch (err: any) {
      console.error('Error saving settings:', err);
      toast.error(t('restaurantSettings.erreurLorsDeLaSauvegarde'));
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File, type: 'logo' | 'cover') => {
    if (!file) return;

    try {
      setUploadingType(type);

      // Upload vers GCS via le hook unifié
      const result = await uploadFile(file, {
        folder: 'restaurant',
        subfolder: serviceId,
        metadata: { type },
      });

      if (!result.success || !result.publicUrl) {
        throw new Error(result.error || 'Échec de l\'upload');
      }

      if (type === 'logo') {
        setFormData(prev => ({ ...prev, logo_url: result.publicUrl! }));
      } else {
        setFormData(prev => ({ ...prev, cover_image_url: result.publicUrl! }));
      }

      toast.success(t('restaurantSettings.imageUploadee'));
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(t('restaurantSettings.erreurLorsDeLUpload'));
    } finally {
      setUploadingType(null);
    }
  };

  const handleDayChange = (day: keyof OpeningHours, field: keyof OpeningHour, value: string | boolean) => {
    setOpeningHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Informations générales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            Informations du Restaurant
          </CardTitle>
          <CardDescription>
            Ces informations seront visibles par vos clients
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('restaurantSettings.nomDuRestaurant')}</Label>
              <Input
                value={formData.business_name}
                onChange={(e) => setFormData(prev => ({ ...prev, business_name: e.target.value }))}
                placeholder="Mon Restaurant"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('restaurantSettings.telephone')}</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+224 XXX XX XX XX"
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="contact@restaurant.com"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Site web</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://..."
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('restaurantSettings.decrivezVotreRestaurantVotreCuisine')}
              rows={3}
            />
          </div>

          {/* MARKETPLACE : ce que le client voit sur la carte du restaurant */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border p-3">
            <div className="space-y-1.5 sm:col-span-3">
              <Label className="text-sm font-semibold">{t('restaurantSettings.visibiliteMarketplace')}</Label>
              <p className="text-xs text-muted-foreground">{t('restaurantSettings.afficheSurLaCarteDe')}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('restaurantSettings.categorieDeCuisine')}</Label>
              <Input value={formData.cuisine} onChange={(e) => setFormData(prev => ({ ...prev, cuisine: e.target.value }))} placeholder="Ex : Grillades, Pizza, Poulet…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('restaurantSettings.fraisDeLivraisonGnf')}</Label>
              <Input type="number" min={0} value={formData.delivery_fee} onChange={(e) => setFormData(prev => ({ ...prev, delivery_fee: e.target.value }))} placeholder="0 = gratuite" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('restaurantSettings.tempsDePrepaMin')}</Label>
              <Input type="number" min={0} value={formData.delivery_eta} onChange={(e) => setFormData(prev => ({ ...prev, delivery_eta: e.target.value }))} placeholder="20" />
            </div>
          </div>

          {/* Bouton Position Actuelle */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-primary/30 bg-primary/5">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{t('restaurantSettings.localisationDuRestaurant')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {detectedCoords
                  ? `Coordonnées : ${detectedCoords.lat.toFixed(5)}, ${detectedCoords.lng.toFixed(5)}`
                  : 'Détectez automatiquement votre adresse via GPS'
                }
              </p>
            </div>
            <Button
              type="button"
              variant={gpsSuccess ? 'default' : 'outline'}
              size="sm"
              onClick={handleDetectPosition}
              disabled={gpsLoading}
              className={`gap-2 transition-all duration-300 ${
                gpsSuccess
                  ? 'bg-[#ff4000] hover:bg-[#ff4000] text-white border-[#ff4000]'
                  : 'border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground'
              }`}
            >
              {gpsLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Détection...
                </>
              ) : gpsSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Localisé !
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4" />
                  Position actuelle
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Adresse</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Rue / Avenue"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Quartier</Label>
              <Input
                value={formData.neighborhood}
                onChange={(e) => setFormData(prev => ({ ...prev, neighborhood: e.target.value }))}
                placeholder="Kaloum, Ratoma..."
              />
            </div>
            <div className="space-y-2">
              <Label>Ville</Label>
              <Input
                value={formData.city}
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                placeholder="Conakry"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Images du Restaurant
          </CardTitle>
          <CardDescription>
            Logo et image de couverture
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo */}
            <div className="space-y-3">
              <Label>Logo</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                {formData.logo_url ? (
                  <div className="relative inline-block">
                    <img
                      src={formData.logo_url}
                      alt="Logo"
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
                      className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="py-4">
                    <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">{t('restaurantSettings.aucunLogo')}</p>
                  </div>
                )}
                <label className="mt-3 inline-block">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'logo')}
                    disabled={uploadingType === 'logo'}
                  />
                  <Button variant="outline" size="sm" asChild disabled={uploadingType === 'logo'}>
                    <span className="cursor-pointer">
                      {uploadingType === 'logo' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      {uploadingType === 'logo' ? 'Upload...' : 'Changer le logo'}
                    </span>
                  </Button>
                </label>
              </div>
            </div>

            {/* Cover Image */}
            <div className="space-y-3">
              <Label>{t('restaurantSettings.imageDeCouverture')}</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                {formData.cover_image_url ? (
                  <div className="relative inline-block">
                    <img
                      src={formData.cover_image_url}
                      alt="Cover"
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, cover_image_url: '' }))}
                      className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="py-4">
                    <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">{t('restaurantSettings.aucuneImage')}</p>
                  </div>
                )}
                <label className="mt-3 inline-block">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'cover')}
                    disabled={uploadingType === 'cover'}
                  />
                  <Button variant="outline" size="sm" asChild disabled={uploadingType === 'cover'}>
                    <span className="cursor-pointer">
                      {uploadingType === 'cover' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      {uploadingType === 'cover' ? 'Upload...' : 'Changer l\'image'}
                    </span>
                  </Button>
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Horaires */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Horaires d'ouverture
          </CardTitle>
          <CardDescription>
            Configurez vos heures d'ouverture pour chaque jour
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(Object.keys(openingHours) as Array<keyof OpeningHours>).map((day) => (
              <div key={day} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="w-24 font-medium text-sm">
                  {DAYS_FR[day]}
                </div>
                <Switch
                  checked={!openingHours[day].closed}
                  onCheckedChange={(checked) => handleDayChange(day, 'closed', !checked)}
                />
                {!openingHours[day].closed && (
                  <>
                    <Input
                      type="time"
                      value={openingHours[day].open}
                      onChange={(e) => handleDayChange(day, 'open', e.target.value)}
                      className="w-28"
                    />
                    <span className="text-muted-foreground">à</span>
                    <Input
                      type="time"
                      value={openingHours[day].close}
                      onChange={(e) => handleDayChange(day, 'close', e.target.value)}
                      className="w-28"
                    />
                  </>
                )}
                {openingHours[day].closed && (
                  <span className="text-sm text-muted-foreground">{t('restaurantSettings.ferme')}</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saving ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
        </Button>
      </div>
    </div>
  );
}

export default RestaurantSettings;
