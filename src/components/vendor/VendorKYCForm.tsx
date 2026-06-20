import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useStorageUpload } from '@/hooks/useStorageUpload';

interface VendorKYCFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function VendorKYCForm({ onSuccess, onCancel }: VendorKYCFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { uploadFile } = useStorageUpload();
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const file = e.target.files?.[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(t('vendorKYCForm.leFichierNeDoitPas'));
          return;
        }
        setDocumentFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setDocumentPreview(reader.result as string);
        };
        reader.onerror = () => {
          toast.error(t('vendorKYCForm.erreurLorsDeLaLecture'));
        };
        reader.readAsDataURL(file);
      }
    } catch (error) {
      console.error('Erreur lors du changement de fichier:', error);
      toast.error(t('vendorKYCForm.erreurLorsDuTraitementDu'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error(t('vendorKYCForm.vousDevezEtreConnecte'));
      return;
    }

    if (!phoneNumber || !documentType || !documentFile) {
      toast.error(t('vendorKYCForm.veuillezRemplirTousLesChamps'));
      return;
    }

    setLoading(true);

    try {
      // Upload du document KYC via GCS (fallback Supabase)
      const uploadResult = await uploadFile(documentFile, {
        folder: 'kyc',
        subfolder: user.id,
      });

      if (!uploadResult.success || !uploadResult.publicUrl) {
        throw new Error(uploadResult.error || 'Échec upload document');
      }

      const publicUrl = uploadResult.publicUrl;

      // Créer ou mettre à jour le KYC
      const { error: kycError } = await supabase
        .from('vendor_kyc')
        .upsert({
          vendor_id: user.id,
          phone_number: phoneNumber,
          id_document_type: documentType,
          id_document_url: publicUrl,
          status: 'under_review',
          phone_verified: false
        });

      if (kycError) {
        throw kycError;
      }

      toast.success(t('vendorKYCForm.documentsSoumisPourVerification'));
      onSuccess?.();
    } catch (error) {
      console.error('Erreur soumission KYC:', error);
      toast.error(t('vendorKYCForm.erreurLorsDeLaSoumission'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="phone">{t('vendorKYCForm.numeroDeTelephone')}</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+224 XXX XXX XXX"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="docType">{t('vendorKYCForm.typeDeDocument')}</Label>
          <Select value={documentType} onValueChange={setDocumentType} required>
            <SelectTrigger id="docType">
              <SelectValue placeholder={t('vendorKYCForm.selectionnerUnDocument')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="carte_identite">{t('vendorKYCForm.carteDIdentiteNationale')}</SelectItem>
              <SelectItem value="passeport">Passeport</SelectItem>
              <SelectItem value="permis_conduire">{t('vendorKYCForm.permisDeConduire')}</SelectItem>
              <SelectItem value="registre_commerce">{t('vendorKYCForm.registreDeCommerce')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="document">{t('vendorKYCForm.documentDIdentiteMax5')}</Label>
          <div className="mt-2">
            {documentPreview ? (
              <div className="relative">
                <img
                  src={documentPreview}
                  alt={t('vendorKYCForm.apercu')}
                  className="max-h-48 rounded-lg border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setDocumentFile(null);
                    setDocumentPreview(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50">
                <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{t('vendorKYCForm.cliquezPourTelecharger')}</span>
                <input
                  id="document"
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                  required
                />
              </label>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? 'Envoi en cours...' : 'Soumettre les documents'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
