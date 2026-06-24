/**
 * Formulaire d'enregistrement de moto
 * Upload vers Google Cloud Storage
 */
import { useState } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Upload, CheckCircle2, Bike, User, FileText, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useBureauOfflineSync } from '@/hooks/useBureauOfflineSync';
import { useAuth } from '@/hooks/useAuth';
import { useStorageUpload } from '@/hooks/useStorageUpload';

// Import mode offline pour MotoRegistrationForm
import _offlineSyncManager from '@/lib/offlineSyncManager';

interface MotoForm {
  owner_name: string;
  owner_phone: string;
  vest_number: string;
  plate_number: string;
  serial_number: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  documents?: string[];
  photos?: string[];
}

interface Props {
  bureauId: string;
  onSuccess?: () => void;
}

export default function MotoRegistrationForm({ bureauId, onSuccess }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('moto');
  const [loading, setLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [conducteurSearch, setConducteurSearch] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const { storeOfflineEvent, isOnline } = useBureauOfflineSync(bureauId);

  // Hook pour upload vers GCS
  const { uploadFile: uploadToGCS } = useStorageUpload();

  const [form, setForm] = useState<MotoForm>({
    owner_name: '',
    owner_phone: '',
    vest_number: '',
    plate_number: '',
    serial_number: '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    documents: [],
    photos: [],
  });

  const updateForm = (field: keyof MotoForm, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const _handleFileUpload = async (file: File, field: keyof MotoForm) => {
    try {
      console.log(`[MotoRegistrationForm] Uploading file to GCS for field: ${field}`);

      const uploadResult = await uploadToGCS(file, {
        folder: 'products',
        subfolder: `motos/${bureauId}`,
      });

      if (!uploadResult.success || !uploadResult.publicUrl) {
        throw new Error(uploadResult.error || 'Upload échoué');
      }

      console.log(`[MotoRegistrationForm] ✅ File uploaded via ${uploadResult.provider}: ${uploadResult.publicUrl}`);

      updateForm(field, uploadResult.publicUrl);
      toast.success(t('motoRegistrationForm.photoTelechargeeAvecSucces'));
    } catch (error) {
      console.error('Erreur upload:', error);
      toast.error(t('motoRegistrationForm.erreurLorsDuTelechargement'));
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingDoc(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        console.log('📄 Téléchargement du fichier vers GCS:', file.name);

        const uploadResult = await uploadToGCS(file, {
          folder: 'documents',
          subfolder: `moto-documents/${bureauId}`,
        });

        if (!uploadResult.success || !uploadResult.publicUrl) {
          throw new Error(uploadResult.error || 'Upload échoué');
        }

        console.log(`✅ Fichier téléchargé via ${uploadResult.provider}:`, uploadResult.publicUrl);

        uploadedUrls.push(uploadResult.publicUrl);
      }

      setForm(prev => ({
        ...prev,
        documents: [...(prev.documents || []), ...uploadedUrls]
      }));

      toast.success(`${uploadedUrls.length} document(s) téléchargé(s) vers GCS`);
    } catch (error: any) {
      console.error('❌ Erreur complète upload documents:', error);
      const errorMessage = error?.message || 'Erreur inconnue';
      toast.error(`Erreur: ${errorMessage}`);
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  const removeDocument = (index: number) => {
    setForm(prev => ({
      ...prev,
      documents: prev.documents?.filter((_, i) => i !== index) || []
    }));
    toast.success(t('motoRegistrationForm.documentRetire'));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhoto(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        console.log('📸 Téléchargement photo vers GCS:', file.name);

        const uploadResult = await uploadToGCS(file, {
          folder: 'products',
          subfolder: `motos/${bureauId}`,
        });

        if (!uploadResult.success || !uploadResult.publicUrl) {
          throw new Error(uploadResult.error || 'Upload échoué');
        }

        console.log(`✅ Photo téléchargée via ${uploadResult.provider}:`, uploadResult.publicUrl);

        uploadedUrls.push(uploadResult.publicUrl);
      }

      setForm(prev => ({
        ...prev,
        photos: [...(prev.photos || []), ...uploadedUrls]
      }));

      toast.success(`${uploadedUrls.length} photo(s) téléchargée(s) vers GCS`);
    } catch (error: any) {
      console.error('❌ Erreur complète upload photos:', error);
      const errorMessage = error?.message || 'Erreur inconnue';
      toast.error(`Erreur: ${errorMessage}`);
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setForm(prev => ({
      ...prev,
      photos: prev.photos?.filter((_, i) => i !== index) || []
    }));
    toast.success(t('motoRegistrationForm.photoRetiree'));
  };

  const searchConducteur = async () => {
    if (!conducteurSearch) return;
    toast.info(t('motoRegistrationForm.rechercheDeConducteurFonctionnaliteA'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!form.plate_number || !form.serial_number || !form.brand || !form.model) {
      toast.error(t('motoRegistrationForm.veuillezRemplirTousLesChamps'));
      return;
    }

    if (form.brand === 'Autre' && !customBrand.trim()) {
      toast.error(t('motoRegistrationForm.veuillezSpecifierLaMarqueDe'));
      return;
    }

    if (!form.owner_name || !form.owner_phone) {
      toast.error(t('motoRegistrationForm.informationsDuProprietaireRequises'));
      return;
    }

    setLoading(true);
    try {
      const finalBrand = form.brand === 'Autre' ? customBrand : form.brand;

      const motoData = {
        bureau_id: bureauId,
        worker_id: user?.id, // ID de l'utilisateur qui enregistre
        serial_number: form.serial_number,
        plate_number: form.plate_number,
        vest_number: form.vest_number || null,
        brand: finalBrand,
        model: form.model,
        year: form.year,
        color: form.color || null,
        owner_name: form.owner_name,
        owner_phone: form.owner_phone,
        documents: form.documents || [], // Array JSONB
        photos: form.photos || [], // Array JSONB
        status: 'pending'
      };

      if (isOnline) {
        // CENTRALISÉ: Enregistrement dans la table vehicles (pas registered_motos)
        const vehicleData = {
          serial_number: form.serial_number,
          license_plate: form.plate_number,
          brand: form.brand,
          model: form.model,
          year: form.year,
          color: form.color || null,
          type: 'motorcycle',
          status: 'pending',
          bureau_id: bureauId
        };

        const { data, error } = await supabase
          .from('vehicles')
          .insert([vehicleData])
          .select()
          .single();

        if (error) throw error;

        // Note: L'association propriétaire-véhicule se fait via owner_member_id dans vehicles
        // syndicate_workers est géré séparément via l'interface de gestion des membres

        toast.success(t('motoRegistrationForm.vehiculeEnregistreAvecSucces'), {
          description: t('motoRegistrationForm.enAttenteDeValidation')
        });
      } else {
        // Stockage hors ligne - sera synchronisé vers vehicles
        await storeOfflineEvent('moto_registration', { ...motoData, target_table: 'vehicles' });

        toast.success(t('motoRegistrationForm.vehiculeEnregistreLocalement'), {
          description: t('motoRegistrationForm.ilSeraSynchroniseALa')
        });
      }

      // Reset form
      setForm({
        owner_name: '',
        owner_phone: '',
        vest_number: '',
        plate_number: '',
        serial_number: '',
        brand: '',
        model: '',
        year: new Date().getFullYear(),
        color: '',
        documents: [],
        photos: [],
      });
      setCustomBrand('');

      setActiveTab('moto');
      onSuccess?.();
    } catch (error: any) {
      console.error('Erreur enregistrement:', error);
      toast.error(error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bike className="w-5 h-5" />
            Enregistrement de Moto
          </CardTitle>
          <CardDescription>
            Formulaire complet d'enregistrement et de vérification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="moto">
                <Bike className="w-4 h-4 mr-2" />
                Moto
              </TabsTrigger>
              <TabsTrigger value="proprietaire">
                <User className="w-4 h-4 mr-2" />
                Propriétaire
              </TabsTrigger>
              <TabsTrigger value="documents">
                <FileText className="w-4 h-4 mr-2" />
                Documents
              </TabsTrigger>
              <TabsTrigger value="photos">
                <Camera className="w-4 h-4 mr-2" />
                Photos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="moto" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plate_number">Plaque d'immatriculation *</Label>
                  <Input
                    id="plate_number"
                    required
                    value={form.plate_number}
                    onChange={(e) => updateForm('plate_number', e.target.value.toUpperCase())}
                    placeholder="GN-1234-AB"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serial_number">{t('motoRegistrationForm.numeroDeSerie')}</Label>
                  <Input
                    id="serial_number"
                    required
                    value={form.serial_number}
                    onChange={(e) => updateForm('serial_number', e.target.value)}
                    placeholder="123456789"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vest_number">{t('motoRegistrationForm.numeroDeGilet')}</Label>
                  <Input
                    id="vest_number"
                    value={form.vest_number}
                    onChange={(e) => updateForm('vest_number', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">Marque *</Label>
                  <Select value={form.brand} onValueChange={(val) => {
                    updateForm('brand', val);
                    if (val !== 'Autre') {
                      setCustomBrand('');
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('motoRegistrationForm.selectionner')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TVS">TVS</SelectItem>
                      <SelectItem value="Autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.brand === 'Autre' && (
                  <div className="space-y-2">
                    <Label htmlFor="customBrand">{t('motoRegistrationForm.specifierLaMarque')}</Label>
                    <Input
                      id="customBrand"
                      required
                      value={customBrand}
                      onChange={(e) => setCustomBrand(e.target.value)}
                      placeholder="Ex: Honda, Yamaha, Suzuki..."
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="model">{t('motoRegistrationForm.modele')}</Label>
                  <Input
                    id="model"
                    required
                    value={form.model}
                    onChange={(e) => updateForm('model', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Couleur</Label>
                  <Input
                    id="color"
                    value={form.color}
                    onChange={(e) => updateForm('color', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">{t('motoRegistrationForm.annee')}</Label>
                  <Input
                    id="year"
                    type="number"
                    value={form.year}
                    onChange={(e) => updateForm('year', parseInt(e.target.value))}
                    min="1980"
                    max={new Date().getFullYear()}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="proprietaire" className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <Label>{t('motoRegistrationForm.rechercherUnConducteurExistant')}</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder={t('motoRegistrationForm.telephoneOuNom')}
                    value={conducteurSearch}
                    onChange={(e) => setConducteurSearch(e.target.value)}
                  />
                  <Button type="button" onClick={searchConducteur}>
                    Rechercher
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="owner_name">Nom complet *</Label>
                  <Input
                    id="owner_name"
                    required
                    value={form.owner_name}
                    onChange={(e) => updateForm('owner_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner_phone">{t('motoRegistrationForm.telephone')}</Label>
                  <Input
                    id="owner_phone"
                    required
                    type="tel"
                    value={form.owner_phone}
                    onChange={(e) => updateForm('owner_phone', e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Documents officiels (Carte grise, Assurance, etc.)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingDoc}
                    onClick={() => document.getElementById('doc-upload')?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingDoc ? 'Téléchargement...' : 'Ajouter des documents'}
                  </Button>
                  <input
                    id="doc-upload"
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    onChange={handleDocumentUpload}
                  />
                </div>

                {form.documents && form.documents.length > 0 ? (
                  <div className="space-y-2">
                    {form.documents.map((docUrl, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="text-sm">Document {index + 1}</span>
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Téléchargé
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(docUrl, '_blank', 'noopener,noreferrer')}
                          >
                            Voir
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDocument(index)}
                          >
                            Retirer
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 border-2 border-dashed rounded-lg">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Aucun document téléchargé
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, Images, Word acceptés
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="photos" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <Label>{t('motoRegistrationForm.photosDeLaMoto')}</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingPhoto}
                      onClick={() => document.getElementById('camera-upload')?.click()}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      {uploadingPhoto ? 'Téléchargement...' : 'Prendre une photo'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingPhoto}
                      onClick={() => document.getElementById('photo-upload')?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingPhoto ? 'Téléchargement...' : 'Galerie'}
                    </Button>
                  </div>
                  <input
                    id="camera-upload"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </div>

                {form.photos && form.photos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                    {form.photos.map((photoUrl, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={photoUrl}
                          alt={`Moto ${index + 1}`}
                          className="w-full h-48 object-cover rounded-lg border"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => window.open(photoUrl, '_blank', 'noopener,noreferrer')}
                          >
                            Voir
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removePhoto(index)}
                          >
                            Supprimer
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 border-2 border-dashed rounded-lg">
                    <Camera className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Aucune photo téléchargée
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Prenez des photos ou sélectionnez depuis la galerie
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between mt-6">
            <Button type="button" variant="outline" onClick={() => {
              const tabs = ['moto', 'proprietaire', 'documents', 'photos'];
              const currentIndex = tabs.indexOf(activeTab);
              if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1]);
            }}>
              Précédent
            </Button>

            {activeTab !== 'photos' ? (
              <Button type="button" onClick={() => {
                const tabs = ['moto', 'proprietaire', 'documents', 'photos'];
                const currentIndex = tabs.indexOf(activeTab);
                if (currentIndex < tabs.length - 1) setActiveTab(tabs[currentIndex + 1]);
              }}>
                Suivant
              </Button>
            ) : (
              <Button type="submit" disabled={loading}>
                {loading ? 'Enregistrement...' : 'Enregistrer la Moto'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  );
}