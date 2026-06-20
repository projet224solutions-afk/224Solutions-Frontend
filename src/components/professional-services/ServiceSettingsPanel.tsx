import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUnifiedSubscription } from '@/hooks/useUnifiedSubscription';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { toast } from 'sonner';
import { Loader2, Save, Navigation, CheckCircle2, MapPin, Upload, X, Image as ImageIcon, Video, Lock } from 'lucide-react';
import { mapService } from '@/services/mapService';

interface ServiceSettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: {
    id: string;
    business_name: string;
    description: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
  };
  onUpdated?: () => void;
}

const MAX_PORTFOLIO_IMAGES = 10;
const MAX_VIDEO_SIZE_MB = 50;
const MAX_VIDEO_DURATION_S = 45;

export function ServiceSettingsPanel({ open, onOpenChange, service, onUpdated }: ServiceSettingsPanelProps) {
  const { t } = useTranslation();
  const { subscription } = useUnifiedSubscription(false);
  const isElite = subscription?.plan_name?.toLowerCase() === 'elite';
  const { uploadFile } = useStorageUpload();

  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [detectedCoords, setDetectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const [form, setForm] = useState({
    business_name: '',
    description: '',
    address: '',
    phone: '',
    email: '',
    website: '',
  });
  const [portfolioImages, setPortfolioImages] = useState<string[]>([]);
  const [promoVideoUrl, setPromoVideoUrl] = useState('');

  useEffect(() => {
    if (!service) return;
    setForm({
      business_name: service.business_name || '',
      description: service.description || '',
      address: service.address || '',
      phone: service.phone || '',
      email: service.email || '',
      website: service.website || '',
    });
    setGpsSuccess(false);
    setDetectedCoords(null);

    // Charger portfolio_images et promo_video_url depuis la DB
    supabase
      .from('professional_services')
      .select('portfolio_images, promo_video_url')
      .eq('id', service.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setPortfolioImages(Array.isArray(data.portfolio_images) ? data.portfolio_images : []);
          setPromoVideoUrl((data as any).promo_video_url || '');
        }
      });
  }, [service]);

  const handleDetectPosition = useCallback(async () => {
    setGpsLoading(true);
    setGpsSuccess(false);
    try {
      const position = await mapService.getCurrentPosition();
      const fullAddress = await mapService.reverseGeocode(position.latitude, position.longitude);
      if (fullAddress && fullAddress !== 'Adresse inconnue') {
        setForm(prev => ({ ...prev, address: fullAddress }));
      }
      setDetectedCoords({ lat: position.latitude, lng: position.longitude });
      setGpsSuccess(true);
      toast.success(t('serviceSettingsPanel.positionDetecteeAvecSucces'));
      await supabase
        .from('professional_services')
        .update({ latitude: position.latitude, longitude: position.longitude })
        .eq('id', service.id);
      setTimeout(() => setGpsSuccess(false), 3000);
    } catch (err: any) {
      console.error('Erreur GPS:', err);
      toast.error(t('serviceSettingsPanel.impossibleDeDetecterVotrePosition'));
    } finally {
      setGpsLoading(false);
    }
  }, [service.id]);

  const handlePortfolioImageUpload = async (file: File) => {
    if (portfolioImages.length >= MAX_PORTFOLIO_IMAGES) {
      toast.error(`Maximum ${MAX_PORTFOLIO_IMAGES} photos dans le portfolio`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('serviceSettingsPanel.lImageNeDoitPas'));
      return;
    }
    try {
      setUploadingImage(true);
      const result = await uploadFile(file, { folder: 'products', subfolder: `services-portfolio/${service.id}` });
      if (!result.success || !result.publicUrl) throw new Error(result.error);
      setPortfolioImages(prev => [...prev, result.publicUrl!]);
      toast.success(t('serviceSettingsPanel.photoAjouteeAuPortfolio'));
    } catch (err: any) {
      toast.error("Erreur upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemovePortfolioImage = (index: number) => {
    setPortfolioImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleVideoUpload = async (file: File) => {
    if (!isElite) {
      toast.error(t('serviceSettingsPanel.uploadVideoReserveAuPlan'));
      return;
    }
    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      toast.error(`La vidéo ne doit pas dépasser ${MAX_VIDEO_SIZE_MB} MB`);
      return;
    }
    const duration = await getVideoDuration(file);
    if (duration > MAX_VIDEO_DURATION_S) {
      toast.error(`La vidéo ne doit pas dépasser ${MAX_VIDEO_DURATION_S} secondes (durée : ${Math.round(duration)}s)`);
      return;
    }
    try {
      setUploadingVideo(true);
      const result = await uploadFile(file, { folder: 'videos', subfolder: `services-promo/${service.id}` });
      if (!result.success || !result.publicUrl) throw new Error(result.error);
      setPromoVideoUrl(result.publicUrl);
      toast.success(t('serviceSettingsPanel.videoDePresentationUploadee'));
    } catch (err: any) {
      toast.error(t('serviceSettingsPanel.erreurUploadVideo'));
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleSave = async () => {
    if (!form.business_name.trim()) {
      toast.error(t('serviceSettingsPanel.leNomDuServiceEst'));
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('professional_services')
        .update({
          business_name: form.business_name.trim(),
          description: form.description.trim() || null,
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          website: form.website.trim() || null,
          portfolio_images: portfolioImages,
          promo_video_url: promoVideoUrl || null,
        } as any)
        .eq('id', service.id);

      if (error) throw error;
      toast.success(t('serviceSettingsPanel.parametresMisAJour'));
      onOpenChange(false);
      onUpdated?.();
    } catch (err: any) {
      console.error('Erreur mise à jour:', err);
      toast.error(t('serviceSettingsPanel.erreurLorsDeLaSauvegarde'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('serviceSettingsPanel.parametresDuService')}</SheetTitle>
          <SheetDescription>{t('serviceSettingsPanel.modifiezLesInformationsDeVotre')}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="business_name">{t('serviceSettingsPanel.nomDuService')}</Label>
            <Input
              id="business_name"
              value={form.business_name}
              onChange={(e) => setForm(f => ({ ...f, business_name: e.target.value }))}
              placeholder={t('serviceSettingsPanel.nomDeVotreEntreprise')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder={t('serviceSettingsPanel.decrivezVotreService')}
              rows={4}
            />
          </div>

          {/* GPS Location Detection */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-primary/30 bg-primary/5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  Localisation
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {detectedCoords
                    ? `${detectedCoords.lat.toFixed(5)}, ${detectedCoords.lng.toFixed(5)}`
                    : 'Détectez votre adresse via GPS'
                  }
                </p>
              </div>
              <Button
                type="button"
                variant={gpsSuccess ? 'default' : 'outline'}
                size="sm"
                onClick={handleDetectPosition}
                disabled={gpsLoading}
                className={`gap-2 flex-shrink-0 transition-all duration-300 ${
                  gpsSuccess
                    ? 'bg-[#ff4000] hover:bg-[#ff4000] text-white border-[#ff4000]'
                    : 'border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground'
                }`}
              >
                {gpsLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span className="hidden sm:inline">{t('serviceSettingsPanel.detection')}</span></>
                ) : gpsSuccess ? (
                  <><CheckCircle2 className="w-4 h-4" />{t('serviceSettingsPanel.localise')}</>
                ) : (
                  <><Navigation className="w-4 h-4" />Position</>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder={t('serviceSettingsPanel.adresseDuService')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t('serviceSettingsPanel.telephone')}</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+224 XXX XXX XXX"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="contact@exemple.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Site Web</Label>
            <Input
              id="website"
              value={form.website}
              onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          {/* Portfolio photos */}
          <div className="space-y-2">
            <Label>
              Photos du portfolio
              <span className="text-xs text-muted-foreground ml-2">
                ({portfolioImages.length}/{MAX_PORTFOLIO_IMAGES})
              </span>
            </Label>
            <div className="border-2 border-dashed rounded-lg p-3 space-y-3">
              {portfolioImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {portfolioImages.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img src={url} alt={`Portfolio ${idx + 1}`} className="w-full h-20 object-cover rounded-md" />
                      <button
                        onClick={() => handleRemovePortfolioImage(idx)}
                        className="absolute -top-1.5 -right-1.5 p-0.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {portfolioImages.length === 0 && (
                <div className="text-center py-2">
                  <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">{t('serviceSettingsPanel.aucunePhotoDansLePortfolio')}</p>
                </div>
              )}
              {portfolioImages.length < MAX_PORTFOLIO_IMAGES && (
                <label className="block text-center">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handlePortfolioImageUpload(e.target.files[0])}
                    disabled={uploadingImage}
                  />
                  <Button variant="outline" size="sm" asChild disabled={uploadingImage}>
                    <span className="cursor-pointer">
                      {uploadingImage
                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        : <Upload className="w-4 h-4 mr-2" />
                      }
                      {uploadingImage ? 'Upload...' : 'Ajouter une photo'}
                    </span>
                  </Button>
                </label>
              )}
            </div>
          </div>

          {/* Vidéo de présentation — Elite uniquement */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Vidéo de présentation (max 45 s)
              {!isElite && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Lock className="w-3 h-3" /> Elite
                </Badge>
              )}
            </Label>
            <div className={`border-2 border-dashed rounded-lg p-3 ${!isElite ? 'opacity-60' : ''}`}>
              {promoVideoUrl ? (
                <div className="space-y-2">
                  <video
                    src={promoVideoUrl}
                    controls
                    className="w-full rounded-md max-h-40 object-contain bg-black"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPromoVideoUrl('')}
                    className="w-full"
                  >
                    <X className="w-4 h-4 mr-2" /> Supprimer la vidéo
                  </Button>
                </div>
              ) : (
                <div className="text-center py-2">
                  <Video className="w-8 h-8 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground mb-2">
                    {isElite ? 'MP4 / MOV · max 45 s · max 50 MB' : 'Disponible avec le plan Elite'}
                  </p>
                  {isElite && (
                    <label className="block">
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0])}
                        disabled={uploadingVideo}
                      />
                      <Button variant="outline" size="sm" asChild disabled={uploadingVideo}>
                        <span className="cursor-pointer">
                          {uploadingVideo
                            ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            : <Upload className="w-4 h-4 mr-2" />
                          }
                          {uploadingVideo ? 'Upload...' : 'Ajouter une vidéo'}
                        </span>
                      </Button>
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2 mt-4">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(video.duration); };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Impossible de lire la vidéo')); };
    video.src = url;
  });
}
