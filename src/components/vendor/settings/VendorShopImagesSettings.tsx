import { useState, useEffect, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Camera, Image, Save, Upload, X } from 'lucide-react';

interface VendorShopImagesSettingsProps {
  vendorId: string;
}

export default function VendorShopImagesSettings({ vendorId }: VendorShopImagesSettingsProps) {
  const { t } = useTranslation();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadVendorData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const loadVendorData = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('business_name, logo_url, cover_image_url')
        .eq('id', vendorId)
        .single();

      if (error) throw error;

      if (data) {
        const vendorData = data as { business_name: string; logo_url: string | null; cover_image_url: string | null };
        setBusinessName(vendorData.business_name || '');
        setLogoUrl(vendorData.logo_url || null);
        setCoverUrl(vendorData.cover_image_url || null);
        setLogoPreview(vendorData.logo_url || null);
        setCoverPreview(vendorData.cover_image_url || null);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error(t('vendorShopImagesSettings.erreurLorsDuChargementDes'));
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'logo' | 'cover'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier le type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('vendorShopImagesSettings.formatNonSupporteUtilisezJpg'));
      return;
    }

    // Vérifier la taille (10 MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`L'image ne doit pas dépasser 10 Mo`);
      return;
    }

    // Créer un aperçu
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'logo') {
        setLogoFile(file);
        setLogoPreview(reader.result as string);
      } else {
        setCoverFile(file);
        setCoverPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const uploadImage = async (file: File, type: 'logo' | 'cover'): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${vendorId}-${type}-${Date.now()}.${fileExt}`;
      const filePath = `vendor-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          contentType: file.type,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error(`Erreur upload ${type}:`, error);
      toast.error(`Erreur lors du téléchargement de l'image`);
      return null;
    }
  };

  const handleRemoveImage = (type: 'logo' | 'cover') => {
    if (type === 'logo') {
      setLogoFile(null);
      setLogoPreview(null);
    } else {
      setCoverFile(null);
      setCoverPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setUploading(true);

    try {
      let newLogoUrl = logoUrl;
      let newCoverUrl = coverUrl;

      // Upload du logo si un nouveau fichier a été sélectionné
      if (logoFile) {
        const uploadedUrl = await uploadImage(logoFile, 'logo');
        if (uploadedUrl) newLogoUrl = uploadedUrl;
      } else if (logoPreview === null && logoUrl) {
        // L'utilisateur a supprimé le logo
        newLogoUrl = null;
      }

      // Upload de la couverture si un nouveau fichier a été sélectionné
      if (coverFile) {
        const uploadedUrl = await uploadImage(coverFile, 'cover');
        if (uploadedUrl) newCoverUrl = uploadedUrl;
      } else if (coverPreview === null && coverUrl) {
        // L'utilisateur a supprimé la couverture
        newCoverUrl = null;
      }

      // Mise à jour des données vendeur
      const { error } = await supabase
        .from('vendors')
        .update({
          logo_url: newLogoUrl,
          cover_image_url: newCoverUrl
        })
        .eq('id', vendorId);

      if (error) throw error;

      setLogoUrl(newLogoUrl);
      setCoverUrl(newCoverUrl);
      setLogoFile(null);
      setCoverFile(null);

      toast.success(t('vendorShopImagesSettings.imagesDeLaBoutiqueMises'));
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      toast.error(t('vendorShopImagesSettings.erreurLorsDeLaMise'));
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="w-5 h-5" />
          Images de la boutique
        </CardTitle>
        <CardDescription>
          Personnalisez la photo de profil et la bannière de couverture de votre boutique
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Aperçu en temps réel */}
          <div className="relative rounded-xl overflow-hidden border">
            {/* Couverture */}
            <div
              className="h-32 sm:h-40 bg-primary/10 relative group cursor-pointer"
              onClick={() => coverInputRef.current?.click()}
            >
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt="Couverture"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <div className="text-center text-muted-foreground">
                    <Image className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">{t('vendorShopImagesSettings.cliquezPourAjouterUneBanniere')}</p>
                  </div>
                </div>
              )}

              {/* Overlay au survol */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="text-white text-center">
                  <Camera className="w-8 h-8 mx-auto mb-1" />
                  <span className="text-sm">{t('vendorShopImagesSettings.changerLaCouverture')}</span>
                </div>
              </div>

              {/* Bouton supprimer */}
              {coverPreview && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage('cover');
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Photo de profil */}
            <div className="absolute left-4 -bottom-12 sm:-bottom-16">
              <div
                className="relative group cursor-pointer"
                onClick={() => logoInputRef.current?.click()}
              >
                <Avatar className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-background shadow-lg">
                  <AvatarImage src={logoPreview || undefined} alt="Logo" />
                  <AvatarFallback className="text-2xl sm:text-3xl bg-primary text-primary-foreground">
                    {getInitials(businessName || 'B')}
                  </AvatarFallback>
                </Avatar>

                {/* Overlay au survol */}
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>

                {/* Bouton supprimer */}
                {logoPreview && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-1 -right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage('logo');
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Espace pour le nom */}
            <div className="h-16 sm:h-20 bg-background" />
          </div>

          {/* Nom de la boutique (prévisualisation) */}
          <div className="pl-28 sm:pl-40 -mt-8">
            <p className="font-semibold text-lg">{businessName || 'Votre boutique'}</p>
            <p className="text-sm text-muted-foreground">{t('vendorShopImagesSettings.apercuDeVotreBoutique')}</p>
          </div>

          {/* Inputs cachés */}
          <Input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange(e, 'logo')}
            className="hidden"
          />
          <Input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileChange(e, 'cover')}
            className="hidden"
          />

          {/* Instructions */}
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-muted rounded-lg">
              <Label className="font-medium">{t('vendorShopImagesSettings.photoDeProfil')}</Label>
              <p className="text-muted-foreground mt-1">
                Format: PNG, JPG, GIF, WebP • Max: 10 Mo<br />
                Recommandé: 500x500px (carré)
              </p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <Label className="font-medium">{t('vendorShopImagesSettings.photoDeCouverture')}</Label>
              <p className="text-muted-foreground mt-1">
                Format: PNG, JPG, GIF, WebP • Max: 10 Mo<br />
                Recommandé: 1500x500px (3:1)
              </p>
            </div>
          </div>

          {/* Bouton de sauvegarde */}
          <Button
            type="submit"
            disabled={loading || (!logoFile && !coverFile && logoPreview === logoUrl && coverPreview === coverUrl)}
            className="w-full"
          >
            {uploading ? (
              <>
                <Upload className="w-4 h-4 mr-2 animate-spin" />
                Téléchargement des images...
              </>
            ) : loading ? (
              <>
                <Save className="w-4 h-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Enregistrer les images
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
