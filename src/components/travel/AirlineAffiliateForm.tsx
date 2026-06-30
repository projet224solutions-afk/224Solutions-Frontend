/**
 * Formulaire de création d'affiliation aérienne
 * Upload vers Google Cloud Storage
 * Interface similaire à DigitalProductForm - l'utilisateur entre manuellement:
 * - Nom de la compagnie
 * - Images
 * - Lien d'affiliation
 * - Prix, devise, commission
 */

import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import {
  ArrowLeft, Plane, Link2, Percent, Tag,
  Upload, X, DollarSign, MapPin, Loader2,
  Zap, Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CurrencySelect } from '@/components/ui/currency-select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStorageUpload } from '@/hooks/useStorageUpload';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AirlineAffiliateFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function AirlineAffiliateForm({ onBack, onSuccess }: AirlineAffiliateFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);

  // Hook pour upload vers GCS
  const { uploadFile: uploadToGCS } = useStorageUpload();

  const [formData, setFormData] = useState({
    airlineName: '',
    title: '',
    description: '',
    shortDescription: '',
    affiliateUrl: '',
    originCity: '',
    destinationCity: '',
    flightType: 'all' as 'all' | 'one-way' | 'round-trip',
    price: '',
    currency: 'USD',
    commissionRate: '',
    images: [] as string[]
  });

  // Upload d'image vers GCS
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploadingImage(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        console.log(`[AirlineAffiliateForm] Uploading image to GCS...`);

        const uploadResult = await uploadToGCS(file, {
          folder: 'products',
          subfolder: `${user.id}/airlines`,
        });

        if (uploadResult.success && uploadResult.publicUrl) {
          console.log(`[AirlineAffiliateForm] ✅ Image uploaded via ${uploadResult.provider}: ${uploadResult.publicUrl}`);
          uploadedUrls.push(uploadResult.publicUrl);
        }
      }

      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...uploadedUrls]
      }));
      toast.success(`${uploadedUrls.length} image(s) uploadée(s) vers GCS`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(t('airlineAffiliateForm.erreurLorsDeLUpload'));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (url: string) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter(img => img !== url)
    }));
  };

  // Générer le titre automatiquement
  const generateTitle = () => {
    if (formData.airlineName) {
      let title = `Vols ${formData.airlineName}`;
      if (formData.originCity && formData.destinationCity) {
        title = `${formData.originCity} → ${formData.destinationCity} avec ${formData.airlineName}`;
      } else if (formData.destinationCity) {
        title = `Vols vers ${formData.destinationCity} - ${formData.airlineName}`;
      }
      setFormData(prev => ({ ...prev, title }));
    } else {
      toast.info(t('airlineAffiliateForm.veuillezDAbordSaisirLe'));
    }
  };

  // Générer la description par IA
  const handleGenerateDescription = async () => {
    if (!formData.title.trim() && !formData.airlineName.trim()) {
      toast.error(t('airlineAffiliateForm.veuillezDAbordSaisirUn'));
      return;
    }

    setGeneratingDescription(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-product-description', {
        body: {
          name: formData.title || formData.airlineName,
          category: 'voyage',
          productType: 'billet_avion'
        }
      });

      if (error) throw error;

      const nextDescription = (data?.description ?? '').toString();
      const nextShort = (data?.shortDescription ?? data?.short_description ?? '').toString().trim();

      if (nextDescription.trim()) {
        setFormData(prev => ({
          ...prev,
          description: nextDescription,
          shortDescription: nextShort || prev.shortDescription,
        }));
        toast.success(t('airlineAffiliateForm.descriptionGenereeAvecSucces'));
      }
    } catch (error) {
      console.error('Erreur génération description:', error);
      toast.error(t('airlineAffiliateForm.erreurLorsDeLaGeneration'));
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error(t('airlineAffiliateForm.vousDevezEtreConnecte'));
      return;
    }

    if (!formData.airlineName.trim()) {
      toast.error(t('airlineAffiliateForm.leNomDeLaCompagnie'));
      return;
    }

    if (!formData.affiliateUrl.trim()) {
      toast.error(t('airlineAffiliateForm.leLienDAffiliationEst'));
      return;
    }

    setLoading(true);
    try {
      // Récupérer le vendor_id
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      // Générer le titre si vide
      const title = formData.title.trim() || `Vols ${formData.airlineName}`;

      const productData = {
        merchant_id: user.id,
        vendor_id: vendor?.id || null,
        title: title,
        description: formData.description || formData.shortDescription || title,
        short_description: formData.shortDescription || title,
        category: 'voyage',
        product_type: 'billet_avion',
        product_mode: 'affiliate',
        affiliate_url: formData.affiliateUrl,
        affiliate_platform: formData.airlineName,
        commission_rate: formData.commissionRate ? parseFloat(formData.commissionRate) : 0,
        price: formData.price ? parseFloat(formData.price) : 0,
        currency: formData.currency,
        images: formData.images,
        status: 'published',
        published_at: new Date().toISOString(),
        is_featured: false,
        tags: [
          formData.airlineName,
          formData.originCity,
          formData.destinationCity,
          'vol',
          'avion',
          'airline',
          'voyage'
        ].filter(Boolean)
      };

      const { error } = await supabase
        .from('digital_products')
        .insert(productData);

      if (error) throw error;

      onSuccess();
    } catch (error: any) {
      console.error('Error creating affiliate:', error);
      toast.error(t('airlineAffiliateForm.erreurLorsDeLaCreation') + (error.message || 'Erreur inconnue'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-md border-b border-border sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-foreground">{t('airlineAffiliateForm.nouvelleAffiliationAerienne')}</h1>
              <p className="text-xs text-muted-foreground">
                Créez votre lien d'affiliation compagnie aérienne
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {/* Nom de la compagnie */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plane className="w-4 h-4 text-primary" />
              Compagnie Aérienne
            </CardTitle>
            <CardDescription className="text-xs">
              Entrez le nom de la compagnie aérienne
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <Label className="text-xs">
                Nom de la compagnie <span className="text-destructive">*</span>
              </Label>
              <Input
                value={formData.airlineName}
                onChange={(e) => setFormData(prev => ({ ...prev, airlineName: e.target.value }))}
                placeholder="Ex: Air France, Ethiopian Airlines, Turkish Airlines..."
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Images */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              Images
            </CardTitle>
            <CardDescription className="text-xs">
              Ajoutez des images de la compagnie ou des offres
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {formData.images.map((url, idx) => (
                <div key={idx} className="relative group aspect-square">
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(url)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* Upload button */}
              <label className={cn(
                "aspect-square border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors",
                uploadingImage && "opacity-50 cursor-not-allowed"
              )}>
                {uploadingImage ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-muted-foreground mb-1" />
                    <span className="text-[10px] text-muted-foreground">{t('airlineAffiliateForm.ajouter')}</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploadingImage}
                />
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Lien d'affiliation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="w-4 h-4 text-primary" />
              Lien d'Affiliation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label className="text-xs">
                URL d'affiliation <span className="text-destructive">*</span>
              </Label>
              <Input
                value={formData.affiliateUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, affiliateUrl: e.target.value }))}
                placeholder="https://www.compagnie.com/?ref=votre-id"
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Collez votre lien d'affiliation avec votre ID de tracking
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Itinéraire optionnel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Itinéraire (optionnel)
            </CardTitle>
            <CardDescription className="text-xs">
              Spécifiez une route pour un ciblage précis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t('airlineAffiliateForm.villeDeDepart')}</Label>
                <Input
                  value={formData.originCity}
                  onChange={(e) => setFormData(prev => ({ ...prev, originCity: e.target.value }))}
                  placeholder="Ex: Paris"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Destination</Label>
                <Input
                  value={formData.destinationCity}
                  onChange={(e) => setFormData(prev => ({ ...prev, destinationCity: e.target.value }))}
                  placeholder="Ex: Conakry"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">{t('airlineAffiliateForm.typeDeVol')}</Label>
              <Select
                value={formData.flightType}
                onValueChange={(v: 'all' | 'one-way' | 'round-trip') =>
                  setFormData(prev => ({ ...prev, flightType: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('airlineAffiliateForm.tousLesVols')}</SelectItem>
                  <SelectItem value="one-way">Aller simple</SelectItem>
                  <SelectItem value="round-trip">{t('airlineAffiliateForm.allerRetour')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateTitle}
              className="w-full"
            >
              Générer le titre automatiquement
            </Button>
          </CardContent>
        </Card>

        {/* Informations de l'offre */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              Informations de l'offre
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Titre</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder={t('airlineAffiliateForm.exVolsParisConakryAvec')}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Laissez vide pour générer automatiquement
              </p>
            </div>

            <div>
              <Label className="text-xs">Description courte</Label>
              <Input
                value={formData.shortDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, shortDescription: e.target.value }))}
                placeholder={t('airlineAffiliateForm.resumeEnUneLigne')}
                className="mt-1"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">{t('airlineAffiliateForm.descriptionDetaillee')}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateDescription}
                  disabled={generatingDescription}
                  className="h-6 text-xs gap-1"
                >
                  {generatingDescription ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Zap className="w-3 h-3" />
                  )}
                  Générer par IA
                </Button>
              </div>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('airlineAffiliateForm.decrivezLOffreEnDetail')}
                className="min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Prix indicatif */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Prix indicatif
            </CardTitle>
            <CardDescription className="text-xs">
              Prix affiché aux visiteurs (optionnel)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t('airlineAffiliateForm.montant')}</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="Ex: 500"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Devise</Label>
                <CurrencySelect
                  value={formData.currency}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, currency: v }))}
                  className="mt-1"
                  showFlag={true}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Commission */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary" />
              Commission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label className="text-xs">{t('airlineAffiliateForm.tauxDeCommission')}</Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  value={formData.commissionRate}
                  onChange={(e) => setFormData(prev => ({ ...prev, commissionRate: e.target.value }))}
                  placeholder="Ex: 5"
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  %
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <Alert className="bg-blue-500/5 border-blue-500/20">
          <Plane className="w-4 h-4 text-blue-500" />
          <AlertDescription className="text-xs text-blue-600">
            Votre lien d'affiliation sera affiché sur le marketplace.
            Les visiteurs seront redirigés vers le site de la compagnie via votre lien de tracking.
          </AlertDescription>
        </Alert>

        {/* Bouton de soumission */}
        <Button
          onClick={handleSubmit}
          disabled={loading || !formData.airlineName || !formData.affiliateUrl}
          className="w-full bg-[#04439e] text-white"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Création en cours...
            </>
          ) : (
            <>
              <Plane className="w-4 h-4 mr-2" />
              Créer l'affiliation aérienne
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
