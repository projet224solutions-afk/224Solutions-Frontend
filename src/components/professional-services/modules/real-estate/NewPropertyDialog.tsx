import { useState, useRef } from 'react';
import { useTranslation } from "@/hooks/useTranslation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MapPin, CheckCircle2, ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface NewPropertyDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<any>;
  saving: boolean;
}

const AMENITIES_OPTIONS = [
  'Parking', 'Piscine', 'Jardin', 'Balcon', 'Terrasse', 'Ascenseur',
  'Climatisation', 'Meublé', 'Gardien', 'Caméras', 'Groupe électrogène', 'Eau courante'
];

export function NewPropertyDialog({ open, onClose, onSubmit, saving }: NewPropertyDialogProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    title: '',
    description: '',
    offer_type: '',
    property_type: '',
    price: '',
    surface: '',
    rooms: '',
    bathrooms: '',
    address: '',
    city: '',
    neighborhood: '',
    amenities: [] as string[],
    // Bonus — fiche enrichie (optionnels)
    year_built: '',
    floor_number: '',
    total_floors: '',
    charges_amount: '',
    orientation: '',
    has_parking: false,
    furnished: false,
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const handlePhotosSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const newFiles: File[] = [];
    const newPreviews: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} est trop lourd (max 5MB)`);
        continue;
      }
      newFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
    }
    setPhotos(prev => [...prev, ...newFiles]);
    setPhotoPreviews(prev => [...prev, ...newPreviews]);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotosForProperty = async (propertyId: string) => {
    for (let i = 0; i < photos.length; i++) {
      const file = photos[i];
      const ext = file.name.split('.').pop();
      const path = `${propertyId}/${Date.now()}_${i}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(path, file, { upsert: true });
      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }
      const { data: { publicUrl } } = supabase.storage
        .from('property-images')
        .getPublicUrl(path);
      await supabase.from('property_images').insert({
        property_id: propertyId,
        image_url: publicUrl,
        is_cover: i === 0,
        display_order: i,
      });
    }
  };

  const updateField = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const toggleAmenity = (amenity: string) => {
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error(t('newPropertyDialog.geolocalisationNonSupportee'));
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
        toast.success(t('newPropertyDialog.positionRecuperee'));
      },
      () => {
        setGeoLoading(false);
        toast.error(t('newPropertyDialog.impossibleDeRecupererLaPosition'));
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSubmit = async () => {
    if (!form.title || !form.offer_type || !form.property_type || !form.price) {
      toast.error(t('newPropertyDialog.veuillezRemplirLesChampsObligatoires'));
      return;
    }
    const result = await onSubmit({
      ...form,
      price: parseFloat(form.price) || 0,
      surface: parseFloat(form.surface) || 0,
      rooms: parseInt(form.rooms) || 0,
      bathrooms: parseInt(form.bathrooms) || 0,
      latitude: coords?.lat,
      longitude: coords?.lng,
      // Bonus — fiche enrichie
      year_built: form.year_built ? parseInt(form.year_built) : undefined,
      floor_number: form.floor_number ? parseInt(form.floor_number) : undefined,
      total_floors: form.total_floors ? parseInt(form.total_floors) : undefined,
      charges_amount: form.charges_amount ? parseFloat(form.charges_amount) : undefined,
      orientation: form.orientation || undefined,
      has_parking: form.has_parking,
      furnished: form.furnished,
    });
    if (result) {
      // Upload photos after property creation
      if (photos.length > 0) {
        await uploadPhotosForProperty(result.id);
        toast.success(`${photos.length} photo(s) ajoutée(s)`);
      }
      photoPreviews.forEach(url => URL.revokeObjectURL(url));
      setForm({
        title: '', description: '', offer_type: '', property_type: '',
        price: '', surface: '', rooms: '', bathrooms: '',
        address: '', city: '', neighborhood: '', amenities: [],
        year_built: '', floor_number: '', total_floors: '', charges_amount: '',
        orientation: '', has_parking: false, furnished: false,
      });
      setPhotos([]);
      setPhotoPreviews([]);
      setCoords(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('newPropertyDialog.publierUnBienImmobilier')}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Type d'offre & Type de bien */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type d'offre *</Label>
              <Select value={form.offer_type} onValueChange={v => updateField('offer_type', v)}>
                <SelectTrigger><SelectValue placeholder={t('newPropertyDialog.selectionner')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vente">🔑 Vente</SelectItem>
                  <SelectItem value="location">📋 Location</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('newPropertyDialog.typeDeBien')}</Label>
              <Select value={form.property_type} onValueChange={v => updateField('property_type', v)}>
                <SelectTrigger><SelectValue placeholder={t('newPropertyDialog.selectionner')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="appartement">🏢 Appartement</SelectItem>
                  <SelectItem value="maison">🏠 Maison</SelectItem>
                  <SelectItem value="villa">🏡 Villa</SelectItem>
                  <SelectItem value="terrain">🌍 Terrain</SelectItem>
                  <SelectItem value="bureau">🏬 Bureau</SelectItem>
                  <SelectItem value="boutique">{t('newPropertyDialog.boutique')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Titre */}
          <div className="space-y-2">
            <Label>{t('newPropertyDialog.titreDeLAnnonce')}</Label>
            <Input
              placeholder={t('newPropertyDialog.exAppartement3PiecesVue')}
              value={form.title}
              onChange={e => updateField('title', e.target.value)}
            />
          </div>

          {/* Prix, Surface, Pièces, SdB */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label>Prix (GNF) *</Label>
              <Input type="number" placeholder="0" value={form.price} onChange={e => updateField('price', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Surface (m²)</Label>
              <Input type="number" placeholder="0" value={form.surface} onChange={e => updateField('surface', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Chambres</Label>
              <Input type="number" placeholder="0" value={form.rooms} onChange={e => updateField('rooms', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('newPropertyDialog.sallesDeBain')}</Label>
              <Input type="number" placeholder="0" value={form.bathrooms} onChange={e => updateField('bathrooms', e.target.value)} />
            </div>
          </div>

          {/* Bonus — Caractéristiques (optionnel) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Année de construction</Label><Input type="number" placeholder="ex: 2018" value={form.year_built} onChange={e => updateField('year_built', e.target.value)} /></div>
            <div className="space-y-2"><Label>Étage</Label><Input type="number" placeholder="0" value={form.floor_number} onChange={e => updateField('floor_number', e.target.value)} /></div>
            <div className="space-y-2"><Label>Nb d'étages</Label><Input type="number" placeholder="0" value={form.total_floors} onChange={e => updateField('total_floors', e.target.value)} /></div>
            <div className="space-y-2"><Label>Charges (GNF/mois)</Label><Input type="number" placeholder="0" value={form.charges_amount} onChange={e => updateField('charges_amount', e.target.value)} /></div>
            <div className="space-y-2"><Label>Exposition</Label><Input placeholder="ex: Sud" value={form.orientation} onChange={e => updateField('orientation', e.target.value)} /></div>
            <div className="flex items-end gap-3 pb-1">
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={form.has_parking} onChange={e => updateField('has_parking', e.target.checked)} /> Parking</label>
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={form.furnished} onChange={e => updateField('furnished', e.target.checked)} /> Meublé</label>
            </div>
          </div>

          {/* Adresse */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Ville</Label>
              <Input placeholder="Conakry" value={form.city} onChange={e => updateField('city', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Quartier</Label>
              <Input placeholder="Kaloum" value={form.neighborhood} onChange={e => updateField('neighborhood', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('newPropertyDialog.adresseComplete')}</Label>
              <Input placeholder={t('newPropertyDialog.rueNumero')} value={form.address} onChange={e => updateField('address', e.target.value)} />
            </div>
          </div>

          {/* GPS */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">📍 Position GPS</p>
              <p className="text-xs text-muted-foreground">
                {coords ? `Lat: ${coords.lat.toFixed(5)}, Lng: ${coords.lng.toFixed(5)}` : 'Pour afficher sur la carte'}
              </p>
            </div>
            <Button type="button" variant={coords ? 'outline' : 'default'} size="sm" onClick={handleGetLocation} disabled={geoLoading}>
              {geoLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : coords ? <CheckCircle2 className="h-4 w-4 mr-1 text-[#ff4000]" /> : <MapPin className="h-4 w-4 mr-1" />}
              {coords ? 'Repositionner' : 'Localiser'}
            </Button>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder={t('newPropertyDialog.decrivezLeBienEnDetail')}
              rows={4}
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
            />
          </div>

          {/* Équipements */}
          <div className="space-y-2">
            <Label>{t('newPropertyDialog.equipementsCommodites')}</Label>
            <div className="flex flex-wrap gap-2">
              {AMENITIES_OPTIONS.map(amenity => (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => toggleAmenity(amenity)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    form.amenities.includes(amenity)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {amenity}
                </button>
              ))}
            </div>
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <Label>{t('newPropertyDialog.photosDuBien')}</Label>
            <div className="flex flex-wrap gap-2">
              {photoPreviews.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {i === 0 && (
                    <span className="absolute bottom-0 left-0 right-0 bg-primary text-primary-foreground text-[9px] text-center py-0.5">
                      Couverture
                    </span>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors"
              >
                <ImagePlus className="h-5 w-5" />
                <span className="text-[9px]">{t('newPropertyDialog.ajouter')}</span>
              </button>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotosSelected}
            />
            <p className="text-xs text-muted-foreground">{t('newPropertyDialog.max5mbParPhotoLa')}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('newPropertyDialog.annuler')}</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Publier l'annonce
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
