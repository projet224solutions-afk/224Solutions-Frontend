import { useState, useEffect } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Save, Building2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface VendorBusinessSettingsProps {
  vendorId: string;
}

export default function VendorBusinessSettings({ vendorId }: VendorBusinessSettingsProps) {
  const { t } = useTranslation();
  const [businessName, setBusinessName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    loadVendorData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const loadVendorData = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('business_name, logo_url, is_active')
        .eq('id', vendorId)
        .single();

      if (error) throw error;

      if (data) {
        setBusinessName(data.business_name || '');
        setLogoUrl(data.logo_url || '');
        setLogoPreview(data.logo_url || null);
        setIsActive(data.is_active ?? false);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error(t('vendorBusinessSettings.erreurLorsDuChargementDes'));
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error(t('vendorBusinessSettings.veuillezSelectionnerUneImage'));
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error(t('vendorBusinessSettings.lImageNeDoitPas'));
        return;
      }

      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async () => {
    if (!logoFile) return logoUrl;

    setUploading(true);
    try {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${vendorId}-${Date.now()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, logoFile, {
          contentType: logoFile.type,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Erreur upload logo:', error);
      toast.error(t('vendorBusinessSettings.erreurLorsDuTelechargementDu'));
      return logoUrl;
    } finally {
      setUploading(false);
    }
  };

  const handleToggleActive = async (checked: boolean) => {
    setActivating(true);
    try {
      const { error } = await supabase
        .from('vendors')
        .update({ is_active: checked })
        .eq('id', vendorId);

      if (error) throw error;

      setIsActive(checked);
      toast.success(checked ? 'Boutique activée avec succès !' : 'Boutique désactivée');
    } catch (error) {
      console.error('Erreur activation:', error);
      toast.error(t('vendorBusinessSettings.erreurLorsDeLaModification'));
    } finally {
      setActivating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let newLogoUrl = logoUrl;
      if (logoFile) {
        newLogoUrl = await uploadLogo() || logoUrl;
      }

      const { error } = await supabase
        .from('vendors')
        .update({
          business_name: businessName,
          logo_url: newLogoUrl
        })
        .eq('id', vendorId);

      if (error) throw error;

      setLogoUrl(newLogoUrl);
      setLogoFile(null);
      toast.success(t('vendorBusinessSettings.informationsMisesAJourAvec'));
    } catch (error) {
      console.error('Erreur mise à jour:', error);
      toast.error(t('vendorBusinessSettings.erreurLorsDeLaMise'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Statut de la boutique */}
      {!isActive && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('vendorBusinessSettings.boutiqueInactive')}</AlertTitle>
          <AlertDescription>
            Votre boutique n'est pas visible par les clients. Activez-la pour commencer à vendre.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isActive ? (
              <CheckCircle2 className="w-5 h-5 text-[#ff4000]" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-destructive" />
            )}
            Statut de la boutique
          </CardTitle>
          <CardDescription>
            Activez ou désactivez votre boutique selon votre disponibilité
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">
                {isActive ? 'Boutique active' : 'Boutique inactive'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isActive
                  ? 'Vos produits sont visibles par les clients'
                  : 'Vos produits ne sont pas visibles'}
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={handleToggleActive}
              disabled={activating}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Informations de l'entreprise
          </CardTitle>
          <CardDescription>
            Personnalisez le nom et le logo de votre entreprise qui apparaîtront sur vos devis et factures
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="businessName">{t('vendorBusinessSettings.nomDeLEntreprise')}</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ex: 224Solutions SARL"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo">{t('vendorBusinessSettings.logoDeLEntreprise')}</Label>
              <div className="flex items-start gap-4">
                {logoPreview && (
                  <div className="w-24 h-24 border-2 border-border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}

                <div className="flex-1">
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Format: PNG, JPG, SVG • Taille max: 2 MB • Recommandé: 500x500px
                  </p>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Upload className="w-4 h-4 mr-2 animate-spin" />
                  Téléchargement du logo...
                </>
              ) : loading ? (
                <>
                  <Save className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer les modifications
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
